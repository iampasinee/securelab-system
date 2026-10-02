from datetime import timedelta
from hashlib import sha256
from secrets import token_urlsafe
from threading import BoundedSemaphore
from uuid import uuid4

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from sqlalchemy import select, update, func, text

from app.core.config import get_settings
from app.core.errors import fail
from app.models import users, auth_sessions, refresh_tokens, account_tokens, audit_logs
from app.repositories.base import now, create, get, change
from app.services.audit import audit


password_hash = PasswordHash((Argon2Hasher(time_cost=3, memory_cost=65536, parallelism=4, hash_len=32, salt_len=16),))
hash_slots = BoundedSemaphore(get_settings().hash_concurrency)
# A dummy hash ensures unknown accounts follow the same expensive verification path.
dummy_hash = None


def hash_password(password):
    with hash_slots:
        return password_hash.hash(password)


def verify_password(password, encoded):
    global dummy_hash
    if dummy_hash is None:
        dummy_hash = hash_password(token_urlsafe(32))
    try:
        with hash_slots:
            return password_hash.verify_and_update(password, encoded or dummy_hash)
    except (ValueError, TypeError):
        return False, None


def digest(token):
    return sha256(token.encode('utf-8')).digest()


def revoke_all(db, user_id):
    db.execute(update(auth_sessions).where(auth_sessions.c.user_id == user_id, auth_sessions.c.revoked_at.is_(None)).values(revoked_at=now()))


def access_token(user, family):
    settings = get_settings()
    issued = now()
    return jwt.encode({'sub': str(user['id']), 'sid': str(family['id']), 'jti': str(uuid4()),
                       'iss': settings.jwt_issuer, 'aud': settings.jwt_audience, 'iat': issued, 'nbf': issued,
                       'exp': issued + timedelta(minutes=settings.access_token_minutes)}, settings.signing_key(), algorithm='HS256')


def login(db, payload, request):
    email = payload.email.strip().lower()
    # Do not store email, password, or request bodies in auth failure events.
    email_digest = sha256(email.encode()).hexdigest()
    peer = request.client.host if request.client else None
    rate_keys = sorted({f'email:{email_digest}', f'peer:{peer}'})
    for rate_key in rate_keys:
        number = int.from_bytes(sha256(rate_key.encode()).digest()[:8], 'big', signed=True)
        db.execute(text('SELECT pg_advisory_xact_lock(:number)'), {'number': number})
    recent = db.scalar(select(func.count()).select_from(audit_logs).where(
        audit_logs.c.action == 'auth.login_failure', audit_logs.c.created_at > now() - timedelta(seconds=get_settings().auth_rate_window_seconds),
        (audit_logs.c.metadata['emailDigest'].astext == email_digest) | (audit_logs.c.peer_ip == peer if peer not in ('testclient', 'localhost') else False)))
    if recent >= get_settings().auth_failure_limit:
        fail('rate_limited', 'ลองเข้าสู่ระบบหลายครั้งเกินกำหนด กรุณารอสักครู่', 429)
    user_row = db.execute(select(users).where(func.lower(users.c.email) == email).with_for_update()).mappings().first()
    user = dict(user_row) if user_row else None
    valid, replacement = verify_password(payload.password.get_secret_value(), user.get('password_hash') if user else None)
    if not valid or not user or user['activated_at'] is None or user['account_status'] != 'active':
        audit(db, None, 'auth.login_failure', 'user', metadata={'emailDigest': email_digest}, outcome='failure', request=request)
        db.commit()
        fail('invalid_credentials', 'อีเมลหรือรหัสผ่านใช้ไม่ได้', 401)
    if replacement:
        user = change(db, users, user, {'password_hash': replacement})
    family = create(db, auth_sessions, {'user_id': user['id'], 'expires_at': now() + timedelta(days=get_settings().session_days),
                                       'peer_ip': peer if peer not in ('testclient', 'localhost') else None,
                                       'user_agent': request.headers.get('user-agent', '')[:512]})
    refresh = token_urlsafe(32)
    create(db, refresh_tokens, {'session_id': family['id'], 'token_digest': digest(refresh)})
    audit(db, {**user, 'session_id': family['id']}, 'auth.login', 'user', user['id'], request=request)
    return {'accessToken': access_token(user, family), 'tokenType': 'bearer', 'expiresIn': get_settings().access_token_minutes * 60}, refresh, family


def refresh(db, raw, request):
    if not raw:
        fail('unauthenticated', 'เซสชันใช้ไม่ได้', 401)
    token_row = db.execute(select(refresh_tokens).where(refresh_tokens.c.token_digest == digest(raw))).mappings().first()
    if token_row is None:
        fail('unauthenticated', 'เซสชันใช้ไม่ได้', 401)
    # Lock the family before the token, consistently across refresh/logout/reset.
    family = get(db, auth_sessions, token_row['session_id'], lock=True)
    token = get(db, refresh_tokens, token_row['id'], lock=True)
    if token['used_at'] is not None:
        db.execute(update(auth_sessions).where(auth_sessions.c.id == family['id']).values(revoked_at=now()))
        audit(db, None, 'auth.refresh_replay', 'session', family['id'], metadata={'sessionId': str(family['id'])}, outcome='warning', request=request)
        db.commit()
        fail('refresh_replayed', 'เซสชันถูกยกเลิก กรุณาเข้าสู่ระบบใหม่', 401)
    user = get(db, users, family['user_id'])
    if family['revoked_at'] is not None or family['expires_at'] <= now() or user['account_status'] != 'active' or user['activated_at'] is None:
        fail('unauthenticated', 'เซสชันใช้ไม่ได้', 401)
    db.execute(update(refresh_tokens).where(refresh_tokens.c.id == token['id']).values(used_at=now()))
    raw_next = token_urlsafe(32)
    successor = create(db, refresh_tokens, {'session_id': family['id'], 'token_digest': digest(raw_next)})
    db.execute(update(refresh_tokens).where(refresh_tokens.c.id == token['id']).values(successor_id=successor['id']))
    return {'accessToken': access_token(user, family), 'tokenType': 'bearer', 'expiresIn': get_settings().access_token_minutes * 60}, raw_next, family


def account_link(db, actor, user_id, purpose):
    user = get(db, users, user_id, lock=True)
    if (purpose == 'activate') != (user['activated_at'] is None):
        fail('invalid_account_state', 'ประเภทลิงก์ไม่ตรงกับสถานะบัญชี')
    db.execute(update(account_tokens).where(account_tokens.c.user_id == user_id, account_tokens.c.purpose == purpose,
                                            account_tokens.c.used_at.is_(None), account_tokens.c.revoked_at.is_(None)).values(revoked_at=now()))
    raw = token_urlsafe(32)
    token = create(db, account_tokens, {'user_id': user_id, 'purpose': purpose, 'token_digest': digest(raw),
                                       'expires_at': now() + timedelta(hours=24), 'issued_by': actor['id']})
    audit(db, actor, 'auth.account_link', 'user', user_id, {'purpose': purpose})
    return {'link': f'{get_settings().frontend_url}/#/{purpose}?token={raw}', 'expiresAt': token['expires_at']}


def valid_account_token(db, raw, purpose=None, lock=False):
    statement = select(account_tokens).where(account_tokens.c.token_digest == digest(raw))
    if lock:
        statement = statement.with_for_update()
    token = db.execute(statement).mappings().first()
    if token is None or token['used_at'] is not None or token['revoked_at'] is not None or token['expires_at'] <= now() or (purpose and token['purpose'] != purpose):
        fail('invalid_account_token', 'ลิงก์ใช้ไม่ได้หรือหมดอายุแล้ว', 401)
    return dict(token)


def complete_password(db, raw, password, purpose):
    # Hash before locking database rows; revalidate the one-use token under lock.
    encoded = hash_password(password)
    token = valid_account_token(db, raw, purpose, lock=True)
    user = get(db, users, token['user_id'], lock=True)
    if (purpose == 'activate') != (user['activated_at'] is None):
        fail('invalid_account_token', 'ลิงก์ใช้ไม่ได้', 401)
    change(db, users, user, {'password_hash': encoded, 'activated_at': user['activated_at'] or now()})
    db.execute(update(account_tokens).where(account_tokens.c.id == token['id']).values(used_at=now()))
    revoke_all(db, user['id'])
    audit(db, user, f'auth.{purpose}', 'user', user['id'])
