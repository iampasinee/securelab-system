from uuid import uuid4
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, OperationalError

from app.api.health import router as health_router
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.academic import router as academic_router
from app.api.courses import router as courses_router
from app.api.rooms import router as rooms_router
from app.api.exams import router as exams_router
from app.api.submissions import router as submissions_router
from app.api.monitoring import router as monitoring_router
from app.core.config import get_settings
from app.core.request_context import request_context

app = FastAPI(title='SecureLab Backend', version='0.1.0')
app.include_router(health_router)
app.add_middleware(CORSMiddleware, allow_origins=get_settings().origins, allow_credentials=True,
                   allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allow_headers=['Authorization', 'Content-Type', 'Idempotency-Key', 'X-SecureLab-CSRF'],
                   expose_headers=['Content-Disposition', 'X-Request-ID'])
for router in (auth_router, users_router, academic_router, courses_router, rooms_router, exams_router, submissions_router, monitoring_router):
    app.include_router(router, prefix='/api/v1')


@app.middleware('http')
async def request_identifier(request: Request, call_next):
    request.state.request_id = uuid4()
    context_token = request_context.set({'request_id': request.state.request_id, 'peer_ip': request.client.host if request.client else None})
    try:
        response = await call_next(request)
    finally:
        request_context.reset(context_token)
    response.headers['X-Request-ID'] = str(request.state.request_id)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Cache-Control'] = 'no-store'
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request, exception):
    return JSONResponse(status_code=422, content={'detail': [{'loc': error['loc'], 'msg': error['msg'], 'type': error['type']} for error in exception.errors()]})


@app.exception_handler(IntegrityError)
async def constraint_error(request, exception):
    return JSONResponse(status_code=409, content={'detail': {'code': 'constraint_conflict', 'message': 'ข้อมูลซ้ำ ความสัมพันธ์ไม่ถูกต้อง หรือมีข้อมูลประวัติที่ยังอ้างอิงอยู่'}})


@app.exception_handler(OperationalError)
async def dependency_error(request, exception):
    return JSONResponse(status_code=503, content={'detail': {'code': 'dependency_unavailable', 'message': 'ฐานข้อมูลยังไม่พร้อมใช้งาน'}})


@app.get('/ready', tags=['health'])
def ready():
    from tempfile import NamedTemporaryFile
    from sqlalchemy import text
    from app.core.database import get_engine
    try:
        with get_engine().connect() as connection:
            connection.execute(text('SELECT 1'))
        get_settings().signing_key()
        root = get_settings().storage_root
        root.mkdir(parents=True, exist_ok=True)
        with NamedTemporaryFile(dir=root, prefix='.readiness-') as probe:
            probe.write(b'1')
            probe.flush()
    except (OSError, ValueError, OperationalError):
        return JSONResponse(status_code=503, content={'status': 'unavailable'})
    return {'status': 'ready'}
