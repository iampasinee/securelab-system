# สถาปัตยกรรม SecureLab MVP

Frontend มี data source สองแบบที่แยกกัน:

```text
mock → AppContext / localStorage / IndexedDB / simulation
api  → ApiAppProvider / DTO adapters / HTTP client
       → FastAPI services → PostgreSQL 17
                          → local file storage
       → worker จาก backend image เดียวกัน
```

API mode ใช้ actions ของ context เดิม แต่ไม่อ่าน mock IDs และไม่ fallback เป็น mock success API graph/cache ถูกล้างเมื่อเปลี่ยนบัญชี Access token อยู่ memory และ refresh ประสาน concurrent requests/tabs Drafts ยังอยู่ browser แยก namespace ตาม teacher UUID

## Canonical domains

```text
User → profile ตรงบทบาทหนึ่งประเภท
Faculty → Department → Major
Student → Major + admissionYear + optional ClassGroup
Course → Offering(year,semester) → Section
Section → Primary/Co-Teachers + cohorts + student overrides
Floor → PhysicalRoom → ExamRoom → Seat → Computer
Section → Exam → frozen participants / seat history
Exam + Student → Submission → Versions → Files
```

ไม่มี Program/Year Level/Building entity ชั้นปี derive จากค่ากลาง currentAcademicYear โดยไม่ใช้ปีปฏิทินอุปกรณ์ ส่วน Offering เป็น record ภายใน ไม่เพิ่มระบบลงทะเบียนมหาวิทยาลัย

## Transactions และประวัติ

DB บังคับ FK/unique/composite group scope, deferred role-profile/primary-teacher checks และ GiST room-time exclusion Services ล็อก offering/exam/submission/version ตามลำดับ พร้อม expectedVersion และ idempotency receipt

Upcoming ใช้ live roster เมื่อถึงเวลาเริ่ม worker หรือ membership-changing service freeze roster/labels ใน transaction ก่อนแก้ Student/group/Section/overrides จึงไม่เปลี่ยนประวัติย้อนหลัง

เวลา/status มาจาก server และ [start,end) เปลี่ยนเวลาได้ทั้งการสอบ เมื่อ reopen ใช้ grant ต่อคนและสร้าง version ใหม่ FINAL/READY bytes มี database trigger เพิ่มจาก application guard

Audit/seat/time/integrity history เป็น append-only Application DB role ไม่มี DDL หรือ audit UPDATE/DELETE Migration ใช้ owner credential ต่างหาก

## File boundary และ recovery

Stream รับ bytes/hash นอก long DB transaction เขียน temp, flush/fsync และวาง UUID path จาก server จากนั้นล็อก metadata commit READY ก่อนตอบรับ ไม่ใช้ชื่อไฟล์เป็น path และไม่ถือ expected size/MIME จาก client เป็น actual metadata

Filesystem และ PostgreSQL ไม่ atomic ร่วมกัน Worker จัดการ disconnected receivers/timeout หลัง restart และ quarantine command ตรวจ unacknowledged orphan หลัง safety age โดยไม่ลบ FINAL

Backend ไม่ execute/import/compile/extract uploaded files ดาวน์โหลดเป็น attachment/ZIP bounded spool และตรวจ size/digest ที่จัดเก็บ SHA-256 ไม่ใช่ program validator, antivirus หรือ WORM

## MVP capabilities

มี auth, authorization, actual-byte upload/download, immutable version history, monitoring polling และ dev simulation ที่ปิดโดยปริยาย IP/MAC เป็น catalog information ไม่ใช่ trusted device proof Runtime/identity enforcement แสดง unknown/unavailable

Google OIDC, Agent credentials/heartbeat, biometric และ offline synchronization/backup ต้องมี contract เฉพาะและ review ก่อน implementation ไม่สร้าง endpoint ที่ตอบ success แทนงานเหล่านี้
