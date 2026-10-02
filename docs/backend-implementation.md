# สถานะ Backend MVP

ทำ phase 1A–1G และเชื่อม frontend API mode แล้ว โดยรักษา mock mode/browser data เดิมไว้ Phase 2–3 เรื่อง Google/Agent/biometric/offline synchronization ไม่รวมใน implementation นี้เพราะยังไม่มี integration contracts ตามแผน

## สิ่งที่มีแล้ว

- [x] Foundation, lazy DB/UoW, typed camelCase schemas, readiness และ app/migration credentials แยก
- [x] Auth/Argon2id/JWT, refresh rotation/replay, revoke, one-use activation/reset, provisioning และ password change
- [x] Faculty/Department/Major/groups/counters, academic settings, atomic wizard/bulk assignment และ Student CSV
- [x] Courses/Offerings/Sections, teacher assignments, cohort collision, roster overrides และ snapshot ก่อน due mutation
- [x] Floor/PhysicalRoom/ExamRoom/layout/computers พร้อม history/reference guards
- [x] Exams/policies/Section IDs/server time/GiST overlap, participants, seats/time history และ reopen grants
- [x] Durable submission versions, binary stream/hash, actual downloads/ZIP, FINAL triggers, timeout worker และ recovery
- [x] Monitoring/counts/unknown capabilities, violations seen/review, security config และ append-only audit/export
- [x] Frontend API adapters/context/actions, activation/login, UUID draft/workspace namespaces และ actual receipts/history
- [x] Mock browser flows และ storage migrations เดิมยังทำงาน

## Migrations

M01 auth/audit/idempotency → M02 academic → M03 profiles → M04 courses/roster → M05 rooms/devices → M06 exams/snapshots → M07 submissions/files → M08 security/violations → M09 defaults/refresh family → M10 setup revision → M11 FK indexes → M12 READY/FINAL file guards

SQL revisions frozen เพื่อให้ fresh install และ forward upgrade ได้ผลเดียวกัน ไม่มี create_all startup ไม่ลบ volumes และไม่ import browser migrations เป็น DB migrations

## Validation

ผลรอบล่าสุด: frontend 206 tests (17 scripts) และ backend 21 tests ผ่าน พร้อม TypeScript lint, mock/API builds, Compose config, Alembic fresh/upgrade/check และ git diff --check Browser checks ผ่านทั้งสามบทบาท และตรวจ flow การปรับเวลาทั้งการสอบ/เปิดรับส่งรายคนผ่านหน้าจอจริง

Argon2id benchmark ใน backend container เฉลี่ยประมาณ 0.115 วินาทีต่อ hash ด้วย memory 64 MiB/time 3/parallelism 4 ค่านี้เป็นผลของเครื่อง development นี้ ต้อง benchmark อีกครั้งบนเครื่อง deploy

Build มีคำเตือน bundle ใหญ่กว่า 500 kB และ backend test dependency มี deprecation warning ของ Starlette TestClient/httpx ไม่มี test/build failure

Backend suite ใช้ PostgreSQL 17 จริง พร้อมตรวจ migrations บนฐานว่างและ upgrade path, Alembic metadata drift, concurrency, authorization, upload failures/grace/retry, immutability, orphan recovery และ audit permissions

Frontend รัน lint, ทุก test:* และ build ทั้ง mock/API พร้อม browser checks ของ Admin/Teacher/Student การทดสอบครบวงจรตรวจ activation → assigned Section → six-step exam wizard → actual upload → refresh/resume → FINAL → Teacher ZIP/history → reopen/new version

คำสั่ง browser smoke (ต้องเปิด Vite API ที่ 3001, mock ที่ 3002 และ backend ที่ 8000):

```powershell
cd frontend
node scripts/browser-smoke.cjs
node scripts/browser-mock-smoke.cjs
$env:SECURELAB_E2E_WRITE = '1'
node scripts/browser-cross-flow.cjs
Remove-Item Env:SECURELAB_E2E_WRITE
```

Cross-flow เป็น explicit development test ที่สร้างข้อมูลใหม่และออก password links ให้ seed Teacher/Student จึงต้องเปิด flag ห้ามรันกับ environment จริง Script จำกัด localhost และไม่เผย passwords/tokens ใน output

Artifacts อยู่ `storage/data/` ที่ Git ignore ไม่มี test ที่ execute uploaded files

## ขอบเขตที่ยังไม่รองรับ

ไม่มี production Google sign-in, trusted Agent/heartbeat/biometric/network enforcement, offline synchronization หรือ backup workflow UI ที่ยังไม่มี capability แสดงว่ายังไม่พร้อม

Monitoring ใช้ polling 5 วินาทีสำหรับ MVP การตรวจนี้เป็น development validation ไม่ใช่ load test หรือ production release certification ดูวิธีรันใน [README](../README.md) และ [API contract](api/README.md)
