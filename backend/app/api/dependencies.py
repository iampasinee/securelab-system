from uuid import UUID

from fastapi import Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
import jwt

from app.core.config import get_settings
from app.core.database import get_engine
from app.core.errors import fail
from app.models import auth_sessions, users
from app.repositories.base import now


bearer = HTTPBearer(auto_error=False)


def database():
    with get_engine().begin() as connection:
        yield connection


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db=Depends(database)):
    if credentials is None:
        fail('unauthenticated', 'กรุณาเข้าสู่ระบบ', 401)
    settings = get_settings()
    try:
        claims = jwt.decode(credentials.credentials, settings.signing_key(), algorithms=['HS256'],
                            issuer=settings.jwt_issuer, audience=settings.jwt_audience,
                            options={'require': ['sub', 'sid', 'jti', 'iss', 'aud', 'iat', 'nbf', 'exp']})
        user_id, session_id = UUID(claims['sub']), UUID(claims['sid'])
    except (jwt.PyJWTError, ValueError, KeyError):
        fail('unauthenticated', 'เซสชันใช้ไม่ได้ กรุณาเข้าสู่ระบบใหม่', 401)
    user = db.execute(select(users).join(auth_sessions, auth_sessions.c.user_id == users.c.id).where(
        users.c.id == user_id, auth_sessions.c.id == session_id,
        auth_sessions.c.revoked_at.is_(None), auth_sessions.c.expires_at > now(),
        users.c.account_status == 'active', users.c.activated_at.is_not(None))).mappings().first()
    if user is None:
        fail('unauthenticated', 'เซสชันใช้ไม่ได้ กรุณาเข้าสู่ระบบใหม่', 401)
    return {**dict(user), 'session_id': session_id}


def require_roles(*roles):
    def dependency(actor=Depends(current_user)):
        if actor['role'] not in roles:
            fail('forbidden', 'บทบาทของบัญชีไม่มีสิทธิ์ดำเนินการนี้', 403)
        return actor
    return dependency


admin = require_roles('admin')
staff = require_roles('admin', 'teacher')
student = require_roles('student')


def cookie_guard(request: Request):
    if request.headers.get('origin') not in get_settings().origins or request.headers.get('x-securelab-csrf') != '1':
        fail('csrf_rejected', 'ต้นทางคำขอใช้ไม่ได้', 403)
