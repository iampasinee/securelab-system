from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import Connection, Table, delete, insert, select, update

from app.core.errors import fail, missing


def now() -> datetime:
    return datetime.now(timezone.utc)


def get(db: Connection, table: Table, identifier, lock=False, key='id') -> dict:
    statement = select(table).where(table.c[key] == identifier)
    if lock:
        statement = statement.with_for_update()
    value = db.execute(statement).mappings().first()
    if value is None:
        missing()
    return dict(value)


def rows(db: Connection, statement) -> list[dict]:
    return [dict(row) for row in db.execute(statement).mappings()]


def create(db: Connection, table: Table, values: dict) -> dict:
    return dict(db.execute(insert(table).values(**values).returning(table)).mappings().one())


def change(db: Connection, table: Table, record: dict, values: dict, expected_version=None, key='id') -> dict:
    if expected_version is not None and record['row_version'] != expected_version:
        fail('stale_write', 'ข้อมูลมีการเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่')
    values = {**values, 'updated_at': now(), 'row_version': record['row_version'] + 1}
    statement = update(table).where(table.c[key] == record[key], table.c.row_version == record['row_version']).values(**values).returning(table)
    updated = db.execute(statement).mappings().first()
    if updated is None:
        fail('stale_write', 'ข้อมูลมีการเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่')
    return dict(updated)
