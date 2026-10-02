# SecureLab Backend

Backend MVP ใช้ Python 3.12 ขึ้นไป, FastAPI, PostgreSQL 17, SQLAlchemy 2, Alembic, Pydantic, pwdlib/Argon2id และ PyJWT ไฟล์คำตอบอยู่บน local disk

## โครงสร้าง

- `app/api/` — routes และ role/resource authorization
- `app/services/` — domain rules, transactions, snapshots, auth, storage และ worker
- `app/models/` — SQLAlchemy metadata และ constraints
- `app/schemas/` — request validation และ camelCase aliases
- `app/core/` — settings, database และ request context
- `alembic/versions/` — forward migrations M01–M12
- `tests/` — integration tests บน PostgreSQL 17 จริง

ไม่มี create_all ตอน startup ไม่มี public registration และไม่มีการย้าย browser mock data เข้าฐานข้อมูลอัตโนมัติ

## รันด้วย Docker Compose

ใช้ [คู่มือ root](../README.md) migration ใช้ owner credential แยกจาก application role `securelab_app` ที่ไม่มีสิทธิ์ DDL และแก้/ลบ audit

```powershell
docker compose up --build --wait
docker compose exec backend securelab bootstrap-admin --email admin@itm.kmutnb.ac.th --name "ผู้ดูแลระบบ" --code ADMIN001
docker compose exec backend securelab seed-development
docker compose exec backend securelab benchmark-password
```

Bootstrap ถามรหัสผ่านจาก prompt หรือ secret environment `SECURELAB_BOOTSTRAP_PASSWORD` ไม่ใช้ plaintext mock password Seed เรียกซ้ำได้และไม่ overwrite accounts/passwords/data ที่มีอยู่แล้ว

Worker ใช้ backend image เดียวกันใน service แยก ไม่พึ่ง browser countdown

## พัฒนาโดยตรง

สร้าง virtual environment ด้วย Python 3.12 ขึ้นไปที่ติดตั้งอยู่:

```powershell
cd backend
py -m venv .venv
.venv/Scripts/python.exe -m pip install -e ".[test]"
```

กำหนด DATABASE_URL, MIGRATION_DATABASE_URL, APP_DB_PASSWORD, JWT_SECRET, STORAGE_ROOT และ trusted frontend origins ใน environment โดย direct-host URLs ใช้ localhost และ port ที่ publish แทน hostname postgres

```powershell
.venv/Scripts/securelab.exe migrate
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

เปิดอีก terminal สำหรับ worker:

```powershell
.venv/Scripts/securelab.exe worker
```

`securelab migrate` ทำ Alembic upgrade และ provision application grants ต้องใช้ migration credential ไม่ใช้ app credential migration ที่มีข้อมูลประวัติไม่รองรับ destructive downgrade

## ทดสอบ

```powershell
docker compose -f infra/test-compose.yml up -d --wait
$env:SECURELAB_TEST_DATABASE_URL = 'postgresql+psycopg://securelab_test:isolated_test_only@127.0.0.1:15432/securelab_test'
cd backend
.venv/Scripts/python.exe -m pytest --basetemp ../storage/data/pytest
```

ห้ามตั้ง test URL เป็น database ที่ใช้งานจริง Fixture ตรวจ PostgreSQL major version 17 และชื่อฐานลงท้าย _test ก่อนล้างข้อมูล Tests ครอบคลุม auth/token races, academic integrity, roster/snapshots, room overlap, file bytes/grace/FINAL/reopen, recovery, monitoring และ audit

## Recovery และ capabilities

`securelab quarantine-orphans` ตรวจไฟล์ที่ไม่มี acknowledged metadata และเก่ากว่าช่วงปลอดภัย (ค่าเริ่มต้น 24 ชั่วโมง) โดยข้าม active receivers และไฟล์ที่ถูกอ้างอิง ไม่ cleanup FINAL อัตโนมัติ ตรวจ `--help` ก่อนเรียก

`/health` ไม่ต่อฐานข้อมูล `/ready` ตอบข้อมูลขั้นต่ำเมื่อ DB/storage/JWT พร้อม; errors ไม่เผย credentials, filesystem paths หรือ internal exceptions

ENABLE_DEVELOPMENT_SIMULATION=false เป็นค่าเริ่มต้น เหตุที่สร้างผ่าน dev endpoint ต้องระบุ source=development_simulation ไม่มี trusted heartbeat/biometric/network enforcement ใน MVP
