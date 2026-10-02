# SecureLab System

ระบบจัดการสอบและส่งไฟล์คำตอบ ประกอบด้วย React 19 / TypeScript / Vite 6 / Tailwind CSS 4 และ backend Python / FastAPI / PostgreSQL 17 / SQLAlchemy / Alembic

MVP มีบัญชีที่ Admin จัดเตรียม ข้อมูลวิชาการ รายวิชา/ตอนเรียน ห้อง/เครื่อง การสอบ ที่นั่ง การส่งไฟล์จริง ประวัติเวอร์ชัน การเปิดรับส่งใหม่ monitoring และ audit แล้ว ส่วน Google OIDC, Agent, biometric และการบังคับ network policy อยู่ในระยะถัดไป

## โครงสร้าง

| โฟลเดอร์ | หน้าที่ |
|---|---|
| `frontend/` | หน้าจอเดิมและ API adapters |
| `backend/` | API, domain services, models, Alembic, worker และ tests |
| `storage/data/` | ไฟล์ที่ backend รับจริง ไม่ใช่ browser localStorage |
| `infra/` | PostgreSQL สำหรับ integration tests |
| `docs/` | API และสถาปัตยกรรม |
| `agent/` | พื้นที่สำหรับ integration ในอนาคต |

## Mock mode

เป็นค่าเริ่มต้น รักษา seed, browser migrations, localStorage, IndexedDB และ simulation เดิม

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

## Backend และ API mode

1. คัดลอก `.env.example` เป็น `.env` เฉพาะเมื่อยังไม่มีไฟล์ กำหนดรหัสผ่านฐานข้อมูลแยกสำหรับ migration/application และ JWT secret สุ่มอย่างน้อย 32 bytes ให้ DATABASE_URL ตรงกับ APP_DB_PASSWORD และ MIGRATION_DATABASE_URL ตรงกับ POSTGRES_PASSWORD
2. กำหนด FRONTEND_URL / TRUSTED_ORIGINS ให้ตรงกับ origin ที่เปิด frontend ใช้ COOKIE_SECURE=false เฉพาะการพัฒนาผ่าน HTTP; HTTPS ใช้ true
3. รันจาก root:

```powershell
docker compose config --quiet
docker compose up --build --wait
docker compose exec backend securelab bootstrap-admin --email admin@itm.kmutnb.ac.th --name "ผู้ดูแลระบบ" --code ADMIN001
docker compose exec backend securelab seed-development
```

คำสั่ง bootstrap อ่านรหัสผ่านจาก prompt ไม่ส่งรหัสผ่านผ่าน command arguments ส่วน seed เป็นคำสั่ง explicit ที่เรียกซ้ำได้โดยไม่เขียนทับข้อมูลเดิม Student/Teacher ที่ seed สร้างยังต้องรับลิงก์ตั้งรหัสผ่านจาก Admin

4. เปิด frontend แบบ API:

```powershell
cd frontend
$env:VITE_SECURELAB_DATA_SOURCE = 'api'
$env:SECURELAB_BACKEND_URL = 'http://localhost:8000'
npm.cmd run dev
```

Frontend ใช้ proxy `/api` และ refresh cookie; access token อยู่ใน memory API mode ไม่อ่านข้อมูล mock มาปะปน ไม่ให้ simulation เปลี่ยน role/เวลา/สิทธิ์ และแสดง capability ที่ยังไม่พร้อมตามจริง

`/health` ตรวจ liveness โดยไม่ต้องมีฐานข้อมูล ส่วน `/ready` ตรวจฐานข้อมูล storage และ JWT configuration API docs อยู่ที่ [localhost:8000/docs](http://localhost:8000/docs)

สำหรับ workspace ที่ตรวจสอบครั้งนี้ backend อยู่พอร์ต 8000, API frontend พอร์ต 3001 และ mock frontend พอร์ต 3002 เพื่อเว้นพอร์ตที่ถูกใช้งานอยู่ หากสร้าง Admin สำหรับ development ใน workspace นี้แล้ว ข้อมูลรหัสผ่านอยู่ในไฟล์ local ที่ Git ignore ใต้ `storage/data/` ไม่อยู่ในเอกสารหรือ source code

## ตรวจสอบ

```powershell
cd frontend
npm.cmd run lint
node -e "const p=require('./package.json'),s=require('node:child_process');for(const n of Object.keys(p.scripts).filter(n=>n.startsWith('test:'))){const r=s.spawnSync('npm.cmd',['run',n],{stdio:'inherit',shell:true});if(r.status!==0)process.exit(r.status||1)}"
npm.cmd run build
cd ..
docker compose config --quiet
git diff --check
```

Backend integration tests ใช้ PostgreSQL 17 จริงและอนุญาตเฉพาะ database ที่ลงท้าย `_test` เพราะ fixture ล้างข้อมูลในฐานทดสอบ:

```powershell
docker compose -f infra/test-compose.yml up -d --wait
$env:SECURELAB_TEST_DATABASE_URL = 'postgresql+psycopg://securelab_test:isolated_test_only@127.0.0.1:15432/securelab_test'
cd backend
.venv/Scripts/python.exe -m pytest --basetemp ../storage/data/pytest
```

ดูวิธีสร้าง virtual environment ใน [backend/README.md](backend/README.md) และ browser checks ใน [docs/backend-implementation.md](docs/backend-implementation.md)

## ไฟล์และประวัติการส่ง

Server สร้าง UUID paths รับ bytes จริง คำนวณ SHA-256 และตอบ READY หลัง metadata commit สำเร็จ FINAL แก้หรือลบไม่ได้ทั้ง service และ database triggers การเปิดรับส่งใหม่สร้าง version ใหม่โดยเก็บ FINAL เดิม

Worker ทำงานแม้ browser ปิด เมื่อหมดเวลาจะเก็บเฉพาะไฟล์ที่รับสำเร็จเป็น FINAL แม้ไม่ครบจำนวน พร้อม isComplete=false; ไม่มีไฟล์สำเร็จเป็น expired การรับ bytes ที่เริ่มก่อน deadline มี grace สูงสุด 10 วินาที

ระบบไม่ execute, import, compile หรือคลาย archive ของไฟล์ที่ส่ง SHA-256 เป็น digest ของ bytes ที่ server รับ ไม่รับรองความถูกต้องของโปรแกรมหรือ WORM

อ่าน [คู่มือ backend](backend/README.md), [API contract](docs/api/README.md), [สถาปัตยกรรม](docs/architecture/README.md), [สถานะ implementation](docs/backend-implementation.md) และ [storage](storage/README.md)
