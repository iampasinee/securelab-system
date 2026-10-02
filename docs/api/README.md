# API contract ของ SecureLab MVP

API ธุรกิจใช้ `/api/v1` ดู request/response schemas ที่ [OpenAPI](http://localhost:8000/docs) หรือ `/openapi.json` ส่วน `/health` และ `/ready` ไม่มี prefix

## Conventions

- JSON ใช้ camelCase, IDs เป็น server-generated UUID
- เวลาส่ง UTC ISO 8601 และแสดง Asia/Bangkok; ปีการศึกษา/ปีที่เข้าศึกษาเก็บ พ.ศ.เต็ม
- List ใช้ items/total/page/pageSize; page เริ่ม 1, pageSize ปกติ 10 สูงสุด 100
- Mutable DTO มี rowVersion; form ที่แก้ข้อมูลส่ง expectedVersion ที่อ่านมาครั้งแรก stale write ตอบ 409
- Critical POST ใช้ Idempotency-Key แบบ UUID ได้แก่สร้างสอบ ปรับเวลา reopen ย้าย roster academic wizard/bulk และ auto-seat Key เดิม payload ต่างตอบ 409 Authorization ตรวจใหม่ก่อนคืน cached receipt
- Exam/monitoring ส่ง serverNow, effective status และ capabilities ไม่รับ client เป็นผู้กำหนดสถานะสอบ
- Response มี X-Request-ID สำหรับเชื่อม audit ของคำสั่งนั้น

## กลุ่ม routes

| กลุ่ม | Routes หลัก |
|---|---|
| Auth | login, refresh, logout, logout-all, me, activation inspect/complete, reset complete, password change |
| บัญชี | users CRUD/status/account-links, students/list/export, teachers |
| วิชาการ | academic/settings, faculties, departments, majors, class-groups, structures preview/create, student-assignments |
| รายวิชา | courses, sections, roster/candidates/inclusions/moves |
| ห้อง/เครื่อง | rooms/floors, physical-rooms, exam-rooms/layout, devices |
| การสอบ | exams, participants, access, seat-assignments/auto, time-adjustments, submission-reopens, events |
| การส่ง | attempts, submissions/versions, files intents/content/rename/remove, finalize, archive |
| Monitoring | daily, calendar, exam detail, overview |
| บริหาร | security-settings, audit-logs/export, overview, violations seen/review |

ไม่มี generic exam status setter, public register, client audit-create, multi-Section exam หรือ API ส่งแทนนักศึกษา

## Authentication และ scope

Access JWT อายุ 15 นาทีเก็บใน frontend memory Refresh opaque token อยู่ HttpOnly SameSite=Lax cookie อายุ family รวม 7 วัน หมุนทุกครั้งและ replay ทำให้ family ถูก revoke Cookie requests ตรวจ trusted Origin และ X-SecureLab-CSRF; HTTPS ใช้ Secure cookie

บัญชีถูกสร้างโดย Admin และตั้งรหัสผ่านจากลิงก์ครั้งเดียวอายุ 24 ชั่วโมง รหัสผ่านอย่างน้อย 8 ตัวอักษร มีอักษรอังกฤษและเลข ไม่มี whitespace ต้น/ท้าย จำกัด 128 ตัวอักษร

ทุก protected request ตรวจสถานะบัญชีและ session จากฐานข้อมูล Teacher ได้สิทธิ์จาก Primary/Co-Teacher assignment ของ Section ปัจจุบัน Student อ่าน/ส่งเฉพาะงานของตน Resource นอก scope ตอบ 404 ส่วน role ไม่มีสิทธิ์ action ตอบ 403

## เวลา roster และการส่ง

Exam อ้าง sectionId เท่านั้น Course/เลขตอน/ปี/เทอมเป็น readonly projection Status ใช้ server time และช่วง [start,end) upcoming อ่าน live roster; เริ่มแล้ว freeze participants และ labels ก่อนการแก้ membership ที่เกี่ยวข้อง

การปรับเวลาใช้ทั้งการสอบ Reopen ไม่เปลี่ยน schedule แต่ให้สิทธิ์สร้าง version ใหม่รายคน/ทั้งห้อง และรักษา FINAL เดิม

1. POST attempts ยอมรับ rules/revision เพื่อสร้างหรือ resume durable attempt
2. POST version/files สร้าง uploadId และ sequence
3. PUT submission-files/{uploadId}/content ส่ง binary จริง
4. READY response ยืนยัน actual size/SHA-256 ที่ commit แล้ว
5. Rename/remove ได้เฉพาะ OPEN; bytes READY เปลี่ยนแทนไม่ได้
6. POST finalize ใช้ไฟล์ของ server ไม่รับ metadata จาก client และเรียกซ้ำได้ receipt เดิม

Worker auto-finalize หลัง deadline พร้อม grace 10 วินาทีเฉพาะ transfer ที่เริ่มรับ bytes ก่อนเวลา FINAL incomplete ระบุ isComplete=false; zero files เป็น expired การส่ง reopen หลัง exam deadline ระบุ late

ดาวน์โหลดเป็น authorized attachment และ ZIP ของ FINAL ที่เลือกไว้ ไม่เปิด storage เป็น static directory ไม่ execute/import/compile/extract uploaded files

## Errors และเหตุผิดปกติ

| HTTP | ความหมาย |
|---|---|
| 401 | credentials/token/session ใช้ไม่ได้ |
| 403 | role/action ไม่อนุญาต |
| 404 | ไม่พบหรืออยู่นอก scope |
| 409 | conflict, reference, stale write, FINAL lock หรือ transition |
| 413 | bytes เกิน policy |
| 422 | validation |
| 429 | auth rate limit |
| 503 | DB/storage ไม่พร้อม |

Domain detail เป็น {code,message}; validation มี loc/msg/type และตัด input/password/token ออก ไม่มี secrets ใน audit

studentSeenAt แยกจาก reviewedAt/reviewedBy นักศึกษารับทราบแล้วไม่ลดรายการที่ staff ยังไม่ได้ review Runtime device เป็น unknown และ biometric/network enforcement เป็น unavailable จนกว่าจะมี trusted integration
