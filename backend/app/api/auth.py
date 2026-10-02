from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select, update

from app.api.dependencies import database, current_user, cookie_guard
from app.core.config import get_settings
from app.core.errors import fail
from app.models import auth_sessions, refresh_tokens, users
from app.repositories.base import now, get, change
from app.schemas.auth import Login, TokenInput, PasswordComplete, PasswordChange
from app.services import auth as service
from app.services.audit import audit


router = APIRouter(prefix='/auth', tags=['authentication'])
COOKIE = 'securelab_refresh'


def set_refresh(response, raw, family):
    response.set_cookie(COOKIE, raw, httponly=True, secure=get_settings().cookie_secure, samesite='lax', path='/api/v1/auth',
                        max_age=max(0, int((family['expires_at'] - now()).total_seconds())))
    response.headers['Cache-Control'] = 'no-store'


@router.post('/login')
def login(payload: Login, request: Request, response: Response, db=Depends(database)):
    body, raw, family = service.login(db, payload, request)
    set_refresh(response, raw, family)
    return body


@router.post('/refresh', dependencies=[Depends(cookie_guard)])
def refresh(request: Request, response: Response, db=Depends(database)):
    body, raw, family = service.refresh(db, request.cookies.get(COOKIE), request)
    set_refresh(response, raw, family)
    return body


@router.post('/logout', status_code=204, dependencies=[Depends(cookie_guard)])
def logout(request: Request, response: Response, db=Depends(database)):
    raw = request.cookies.get(COOKIE)
    if raw:
        token = db.execute(select(refresh_tokens).where(refresh_tokens.c.token_digest == service.digest(raw))).mappings().first()
        if token:
            family = get(db, auth_sessions, token['session_id'], lock=True)
            db.execute(update(auth_sessions).where(auth_sessions.c.id == family['id']).values(revoked_at=now()))
            actor = get(db, users, family['user_id'])
            audit(db, actor, 'auth.logout', 'session', family['id'], request=request)
    response.delete_cookie(COOKIE, path='/api/v1/auth', secure=get_settings().cookie_secure, httponly=True, samesite='lax')


@router.post('/logout-all', status_code=204)
def logout_all(response: Response, actor=Depends(current_user), db=Depends(database)):
    service.revoke_all(db, actor['id'])
    audit(db, actor, 'auth.logout_all', 'user', actor['id'])
    response.delete_cookie(COOKIE, path='/api/v1/auth', secure=get_settings().cookie_secure, httponly=True, samesite='lax')


@router.get('/me')
def me(actor=Depends(current_user), db=Depends(database)):
    from app.services.users import user_dto
    return user_dto(db, actor)


@router.post('/activation/inspect')
def inspect(payload: TokenInput, db=Depends(database)):
    token = service.valid_account_token(db, payload.token.get_secret_value())
    user = get(db, users, token['user_id'])
    return {'email': user['email'], 'fullName': user['full_name'], 'role': user['role'], 'purpose': token['purpose'], 'expiresAt': token['expires_at']}


@router.post('/activation/complete', status_code=204)
def activate(payload: PasswordComplete, db=Depends(database)):
    service.complete_password(db, payload.token.get_secret_value(), payload.new_password.get_secret_value(), 'activate')


@router.post('/password-reset/complete', status_code=204)
def reset(payload: PasswordComplete, db=Depends(database)):
    service.complete_password(db, payload.token.get_secret_value(), payload.new_password.get_secret_value(), 'reset_password')


@router.post('/password/change', status_code=204)
def password_change(payload: PasswordChange, actor=Depends(current_user), db=Depends(database)):
    record = get(db, users, actor['id'], lock=True)
    valid, _ = service.verify_password(payload.current_password.get_secret_value(), record['password_hash'])
    if not valid:
        fail('invalid_credentials', 'รหัสผ่านปัจจุบันใช้ไม่ได้', 401)
    change(db, users, record, {'password_hash': service.hash_password(payload.new_password.get_secret_value())})
    service.revoke_all(db, actor['id'])
    audit(db, actor, 'auth.password_change', 'user', actor['id'])
