from datetime import timedelta
from hashlib import sha256
import csv
import io
import json

from fastapi.encoders import jsonable_encoder
from pydantic.alias_generators import to_camel
from sqlalchemy import select, func, text
from sqlalchemy.dialects.postgresql import insert

from app.core.errors import fail
from app.models import idempotency_keys
from app.repositories.base import now, create


def public(record):
    return {to_camel(key): value for key, value in record.items()}


def paginate(db, statement, page=1, page_size=10, transform=public):
    total = db.scalar(select(func.count()).select_from(statement.order_by(None).subquery()))
    values = db.execute(statement.limit(page_size).offset((page - 1) * page_size)).mappings()
    return {'items': [transform(dict(value)) for value in values], 'total': total, 'page': page, 'pageSize': page_size}


def search_pattern(value):
    return '%' + value.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'


def idempotent(db, actor, key, operation, payload, callback):
    if key is None:
        fail('idempotency_required', 'คำสั่งนี้ต้องมี Idempotency-Key', 422)
    encoded = json.dumps(jsonable_encoder(payload), sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()
    request_digest = sha256(encoded).digest()
    # Transaction-scoped lock serializes identical actor/key requests, including first use.
    lock_number = int.from_bytes(sha256(f'{actor["id"]}:{key}'.encode()).digest()[:8], 'big', signed=True)
    db.execute(text('SELECT pg_advisory_xact_lock(:number)'), {'number': lock_number})
    existing = db.execute(select(idempotency_keys).where(idempotency_keys.c.actor_id == actor['id'], idempotency_keys.c.key == key)).mappings().first()
    if existing:
        if existing['operation'] != operation or existing['request_digest'] != request_digest:
            fail('idempotency_conflict', 'Idempotency-Key นี้ถูกใช้กับคำสั่งหรือข้อมูลอื่นแล้ว')
        if existing['expires_at'] <= now():
            fail('idempotency_expired', 'คำสั่งเดิมเกินระยะเวลาที่เก็บผลแล้ว กรุณาตรวจข้อมูลล่าสุดก่อนส่งคำสั่งใหม่')
        return existing['response_body']
    response = jsonable_encoder(callback())
    create(db, idempotency_keys, {'actor_id': actor['id'], 'key': key, 'operation': operation, 'request_digest': request_digest,
                                 'response_status': 201 if operation in ('exam.create', 'academic.structure') else 200,
                                 'response_body': response, 'expires_at': now() + timedelta(hours=24)})
    return response


def csv_bytes(headers, records):
    output = io.StringIO(newline='')
    writer = csv.writer(output)
    writer.writerow(headers)
    for record in records:
        # Quoting alone does not prevent spreadsheet formula execution.
        safe = []
        for value in record:
            cell = '' if value is None else str(value)
            if cell.lstrip().startswith(('=', '+', '-', '@', '\t', '\r', '\n')):
                cell = "'" + cell
            safe.append(cell)
        writer.writerow(safe)
    return ('\ufeff' + output.getvalue()).encode('utf-8')
