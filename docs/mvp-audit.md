# รายงาน Audit ของ SecureLab MVP

## 1. Executive summary

ตรวจเมื่อ 3 ตุลาคม 2569 (Asia/Bangkok) ใน workspace `D:/inet1/Pre-Project/System/securelab-system` เท่านั้น อ่าน repository-wide AGENTS.md และคำขอ /audit ก่อนตรวจ

- Git root: `D:/inet1/Pre-Project/System/securelab-system`
- Branch: `main`; HEAD: `5f6cf42` — `feat: Implement API client and adapters for secure lab application`
- Remote fetch/push: `https://github.com/iampasinee/securelab-system.git`
- ก่อนตรวจ working tree สะอาดและ main ตรงกับ origin/main ตามข้อมูล Git ในเครื่อง ไม่ได้ fetch, commit, push หรือเปลี่ยน remote
- ผลรวม: **CRITICAL 0 / HIGH 2 / MEDIUM 10 / LOW 3** รวม 15 findings ส่วน INFO เป็นขอบเขตและข้อจำกัดที่ไม่นับเป็นข้อผิดพลาด

โครงสร้าง MVP รองรับระบบสอบจริงแล้ว: relational domain, server authentication/authorization, roster snapshots, binary uploads, server SHA-256, immutable FINAL/version history และ worker ส่งเมื่อหมดเวลา การตรวจไม่พบเส้นทางให้ Student ดาวน์โหลดงานคนอื่นหรือ Teacher ข้าม Section assignment จาก source ที่ตรวจ แต่มีข้อมูล roster IDs เกินความจำเป็นใน Student DTO

**ควรแก้ F01 และ F02 ก่อนต่อ Agent/Offline:** transaction dependency commit หลังส่ง response และ streaming upload ใช้ connection หลายชุดพร้อมกันจนเสี่ยงทำให้การรับงานทั้งห้องหยุดชะงัก ไม่พบหลักฐานเพียงพอให้จัดรายการใดเป็น CRITICAL

อีกสามรายการที่ควรทบทวนก่อนคือ F03 orphan quarantine race ภายใต้เงื่อนไขไฟล์เก่า, F04 การเผย override IDs ให้ Student และ F05 การยอมรับ revision ใหม่ทั้งที่หน้าจอแสดงกฎเก่า รายละเอียดเงื่อนไขและวิธีพิสูจน์อยู่ข้อ 20

งานนี้สร้างเฉพาะรายงานนี้ **ไม่แก้ application code, migrations หรือพฤติกรรม frontend/backend และไม่สั่งเขียนฐานข้อมูล** ไม่รัน integration fixtures ที่ TRUNCATE ข้อมูล ไม่ออก password links ไม่ login ผ่าน backend และไม่เรียก download ที่เพิ่ม audit/integrity records

### วิธีอ่านหลักฐาน

- **ยืนยันจาก source:** ติดตาม route → dependency → service → SQL/DDL → frontend caller
- **ยืนยันด้วยการทดสอบที่ไม่ใช้ DB:** frontend lint/unit tests, health test และ harness ในหน่วยความจำ
- **ตรวจ DB แบบ read-only:** Alembic current/check ผ่าน PGOPTIONS ให้ transaction เป็น read-only
- **ยังไม่ทดสอบ runtime:** load จริง, concurrent maintenance กับ receiver, concurrent link reissue/consume, crash/power-loss และ browser regression รอบนี้
- ผล validation ก่อนหน้าที่อยู่ในเอกสาร repository แยกจากผลที่รันใหม่ ไม่ถือว่า test count เป็นหลักฐานว่าไม่มี race

## 2. Current architecture snapshot

| ชั้น | Implementation ปัจจุบัน | Source of truth |
|---|---|---|
| Frontend | React 19/TypeScript/Vite; App เลือก mock หรือ API provider | API mode อ่าน server; mock mode ใช้ browser state |
| Transport | ApiClient, memory access token, HttpOnly refresh cookie, DTO adapters | Backend ตรวจ identity/session ทุก protected request |
| Backend | FastAPI, SQLAlchemy Core Connection/Table, services และ repository helpers | PostgreSQL transactions + constraints/triggers |
| Database | PostgreSQL 17; 45 domain tables, 80 FK constraints ใน metadata | Alembic M01–M12; ไม่ create_all ตอน startup |
| Files | UUID directory hierarchy บน local disk | DB เก็บ metadata/digest/storage_key; bytes อยู่ storage mount |
| Worker | image เดียวกับ backend, polling OPEN versions และ due snapshots | เวลาและ state จาก server/DB |
| Monitoring | polling 5 วินาที; scoped aggregates และเหตุจำลอง | Backend ไม่มี trusted device/identity telemetry |
| Infrastructure | postgres, migrate, backend, worker ใน Compose | named PG volume และ bind-mounted storage |

Domain hierarchy ถูกต้อง: User → role profile; Faculty → Department → Major; Major + admission year → ClassGroup; Course → Offering → Section; Floor → PhysicalRoom → ExamRoom → Seat → Device; Exam → Participants/Seat history; Submission → Versions → Files

SQLAlchemy ใช้ Core tables ไม่ใช่ ORM object graph แต่ metadata ถูก register ผ่าน app.models และใช้กับ Alembic ได้ ไม่มีความจำเป็นต้องเปลี่ยนเป็น ORM เพื่อให้สอดคล้องกับแผน

## 3. Database findings

### สิ่งที่ออกแบบถูกต้อง

- UUID ที่ server สร้างสำหรับ entity IDs; join tables ใช้ composite keys ตามความสัมพันธ์ ไม่ใช้ชื่อหรือ filename เป็น PK
- เวลาจริงเป็น timestamptz; Buddhist years เป็น smallint; status ใช้ text + named CHECK
- Mutable records มี created_at/updated_at/row_version; repository.change ใช้ row_version ใน WHERE ป้องกัน stale update เพิ่มจาก expectedVersion
- FK โดยทั่วไป RESTRICT; ไม่มี silent cascade-delete ประวัติ
- User หนึ่ง role และ matching profile หนึ่งประเภท enforced ด้วย deferred triggers; role immutable
- Student เก็บ Major/year/optional group; composite FK ตรวจ group scope ถูกต้อง ไม่เก็บ Faculty/Department/year level เป็น canonical fields
- Section uniqueness ครอบคลุม offering + section number รวม inactive; primary teacher partial unique และ deferred exactly-one trigger
- Cohort/group scope มี deferred trigger; include/exclude ใช้หนึ่ง row ต่อ student/Section
- Device code/serial/IP/MAC unique; seat binding unique nullable; layout และ device-history guards
- Exam room/time overlap ใช้ btree_gist + exclusion constraint ของช่วง [start,end)
- Snapshot/history tables append-only; submission มี composite participant FK, latest FINAL ownership FK/trigger
- หนึ่ง OPEN และหนึ่ง initial version ต่อ submission; grant ใช้หนึ่ง version; version/sequence ไม่ reuse; SHA-256 ไม่ unique เพื่อให้คนละคนส่ง bytes เดียวกันได้
- M11 เพิ่ม FK lookup indexes ที่ไม่ครอบคลุมด้วย key เดิม; Alembic check รอบนี้ไม่พบ metadata drift

### ช่องว่างและข้อพิจารณา

- **F08:** READY CHECK ไม่บังคับ size_bytes IS NOT NULL อย่างชัดเจน SQL NULL ทำให้ CHECK ผ่านได้ แม้ service ปัจจุบันส่ง actual size ถูกต้อง
- Cross-table active/readiness/capacity/cohort-overlap rules หลายรายการอยู่ service ไม่ใช่ DB trigger ทั้งหมด เหมาะกับ domain ที่ซับซ้อน แต่ต้องใช้ lock คู่กับการแก้สถานะด้วย **F11**
- DB FINAL triggers ป้องกันแก้ FINAL และ byte identity ของ READY; application role ยังมี CRUD บน mutable tables จึงไม่ถือว่าเป็น protection จากผู้ดูแล DB หรือ WORM
- Snapshot labels เป็นข้อมูลซ้ำที่จำเป็นเพื่อรักษาประวัติ ไม่ใช่ competing master data
- Stored exam status/duration/yearLevel/root submission status ไม่เป็นอีกแหล่งจริง; derive จาก timestamps/profiles/versions ถูกต้อง
- Normalization ของ policy เป็น typed columns/resources/extensions ไม่เป็น opaque JSON ทั้งก้อน; Offering เป็น record ภายใน ไม่เพิ่มระบบทะเบียนเกินขอบเขต
- ไม่พบเหตุผลให้เพิ่ม Program, Year entity, Building, separate Attempt table หรือ telemetry warehouse
- auth_sessions user lookup และ audit actor lookup มี indexes แต่ยังไม่ครบ composite index ทุกชุดตามแผน ควรพิจารณาจาก query plan/volume ไม่จัดเป็น integrity bug โดยไม่มี benchmark

แหล่ง: backend/app/models/*.py, backend/alembic/versions/*.sql และ m09–m12; ปัญหา commit ของ deferred checks ดู F01

## 4. Auth findings

Argon2id parameters m=65536 KiB/t=3/p=4, hash length 32, salt 16 พร้อม hash concurrency semaphore และ successful-login rehash; DB credentials ของบัญชีเป็น hash ไม่ใช่ plaintext User DTO ไม่ expose hash

Access JWT มี sub/sid/jti/iss/aud/iat/nbf/exp จำกัด HS256 และ issuer/audience, อายุ default 15 นาที ไม่ใช้ client role claims ให้สิทธิ์ Refresh random 256 bits เก็บ digest เท่านั้น, rotation/replay revoke family, absolute session expiry 7 วัน Activation/reset random one-use 24 ชั่วโมง เก็บ digest ไม่มี raw token ใน audit

Protected requests อ่าน user/session จาก DB จึงรับผล revoke/suspend ใน request ถัดไป Logout family, logout-all, password reset/change และ suspension revoke sessions; Origin allowlist และ X-SecureLab-CSRF ใช้กับ cookie refresh/logout ส่วน bearer actions ไม่ใช้ cookie เป็น authority

Login unknown/wrong/unactivated/inactive ให้ข้อความเดียวกัน มี DB-backed rate limit และ advisory locking ตาม email digest/IP ไม่มี public registration หรือ staff-domain auto-admin Bootstrap เป็น CLI เท่านั้นและอ่านรหัสผ่านจาก prompt/environment

**สิ่งที่ยังต้องแก้:** F01 session/credential transaction receipt timing, F06 lock order ของ account link, F07 hashing ก่อนตรวจ token และ F14 การหมุน DB-role password

คำว่า “plaintext passwords NEVER stored” ยืนยันได้เฉพาะ **บัญชีจริงใน backend/API mode** ไม่ใช่ทั้ง repository: mock auth เก็บ mockPassword ใน localStorage ตาม scoped exception ของ AGENTS.md และมี test/demo password literals ที่ไม่ใช่ production secrets ต้องคงคำอธิบายนี้ ไม่ทำรายงานว่าระบบ mock ปลอดภัยเท่าระบบจริง

ตรวจ tracked environment files พบเฉพาะ .env.example สามตำแหน่ง; credentials/JWT placeholders ไม่ใช่ secrets จริง signing_key ปฏิเสธ placeholder และ key สั้น เอกสารนี้ไม่คัดลอกค่า .env หรือ local password artifacts การตรวจไม่ได้เป็น forensic secret scan ครบทุก Git object ในอดีต

Access token อยู่ memory, refresh HttpOnly/SameSite=Lax; Secure ขึ้นกับ config และ local HTTP example เป็น false ข้อจำกัดนี้ตั้งใจสำหรับพัฒนา ต้องใช้ HTTPS/Secure ใน deployment ถัดไป XSS ที่รันใน origin เดียวกันยังสามารถใช้ memory token ได้ จึงไม่อ้างว่า memory storage กำจัด XSS

## 5. Authorization findings

| Resource | Backend enforcement | ข้อสรุป |
|---|---|---|
| User directory/profile CRUD | admin dependency; /auth/me คืนเฉพาะตน | Student/Teacher อ่าน users directory ไม่ได้ |
| Course/Section | visible_sections + require_section; teacher current assignment, student effective roster | ไม่ใช้ Department/Faculty/creator เป็นสิทธิ์ |
| Exam/participants/time/seats/reopen | require_exam + staff/student dependencies; participant snapshot เมื่อ frozen | Teacher ที่ถูกถอด assignment เสียสิทธิ์ request ถัดไป |
| Submission/version/file | require_root/require_version/require_file ตรวจ owner/exam scope; staff อ่าน FINAL เท่านั้น | IDOR งาน/ไฟล์คนอื่นถูกปิดจาก source |
| Violations | Student own row + exam scope; seen Student, review staff | ไม่ใช้ปุ่มซ่อนเป็น enforcement |
| Audit/security/users mutations | admin dependency | ไม่มี client audit-create หรือ public admin registration |
| Room/device catalog | Admin CRUD; staff catalog; teacher device/layout จำกัด relevant exam rooms; Student layout เฉพาะ own seat rows | ข้อมูล catalog ไม่ใช่ proof of device |

Resource นอก scope ใช้ 404; role/action ไม่อนุญาตใช้ 403 ไม่พบ route ธุรกิจที่ไม่มี auth dependency โดยไม่ได้ตั้งใจ Public routes เป็น health/ready และ auth token flows เท่านั้น

**F04** เป็น least-privilege gap ที่พบจริง: Student ที่อ่าน Section ของตนได้ยังได้รับ includedStudentIds/excludedStudentIds ของคนอื่น รวมใน nested Course DTO ไม่ใช่ช่องทางอ่าน full profile/file และไม่จัดเป็น CRITICAL

Teacher candidate search เปิด institution-wide เฉพาะข้อมูลสำหรับเพิ่ม Student ผ่าน authorized Section ตามแผน; ไม่ใช่ full users endpoint แต่ข้อมูลชื่อแยกภาษาที่ roster_summary แผ่เพิ่มควรลดตามสิ่งที่ UI ใช้ Global room/floor catalog สำหรับเลือกห้องเป็น intentional read scope ไม่ใช่สิทธิ์แก้ unrelated exams

ตรวจ service scope ก่อน cached idempotency receipts ของ time/reopen/move/auto/create exam แล้ว ไม่พบ cache ที่ให้ผู้ถูกถอด assignment ข้าม authorization

## 6. Academic/course/roster findings

Canonical Faculty → Department → Major ถูกต้อง Faculty/Department/year level ใน DTO derive ผ่าน Major; student code กับ admission year เก็บแยก ไม่ parse email ซ้ำเพื่อเปลี่ยน cohort ทุก login

ClassGroup เป็น optional primary grouping ไม่ใช่ Section; group counter lock และไม่ลดเมื่อ group ถูกลบ code ไม่ regenerate ตาม Major rename คำนวณ year level จาก academic settings; reject future admission year ไม่ clamp

Section Primary/Co-Teachers distinct/active ใน service; teachers one-to-many ผ่าน join table Cohort list ไม่มี group หมายถึง whole Major/year; effective roster = base ∪ includes − excludes มี offering collision checks รวม inactive, whole↔group และ group↔group

Student move ตรวจ authorized source/target และ same offering ไม่แก้ Student master Academic wizard/bulk assignments อยู่ transaction เดียว Preview ไม่สร้าง records หรือจองเลข

Historical protection: before_membership_change ล็อก offerings และ freeze due exams ก่อนเปลี่ยน Student/profile/group/cohorts/overrides/labels; worker และ exam read services freeze ด้วย unique participant keys Upcoming ใช้ live roster, ตรวจ nonempty/capacity และ remove invalid seats พร้อม events/audit

หลัง freeze membership/code/name/academic labels ไม่ย้อนเปลี่ยนตาม live Student หรือ Course rename ส่วน account status ที่แสดงเป็นสถานะปัจจุบันโดยตั้งใจ ไม่ใช่ academic-history field

**F09:** ล็อกทุก offering และ scan roster/exams ทั้งระบบ ทำให้ถูกต้องแต่ serialize แม้คำสั่งอยู่คนละ Course; polling ของ frontend ขยายภาระนี้ **F11:** active account/path validation ยังไม่ serialize กับการเปลี่ยนสถานะทุกเส้นทาง

## 7. Exam findings

Exam อ้าง section_id จริง; Course/year/semester/Section number derive ผ่าน Offering ไม่มี multi-Section exam และไม่มี generic status setter Policy ทุก flag แยก common/file/online/offline และ allowed/blocked resources ไม่ปะปน

เวลา backend เป็น authoritative ช่วง [start,end); starts_at/scheduled_end_at/ends_at แยกแผนเดิมและเวลาปัจจุบัน Status upcoming/in_progress/completed ไม่ stored เป็น authority

Creation/edit validate future schedule/same Bangkok day, active assigned Section, room readiness, roster nonempty/capacity และ overlap ที่ DB Upcoming edit เท่านั้น setup_revision แยกจาก row_version จึงไม่ให้ seat/time actions ทำให้นักศึกษาต้องยอมรับกฎใหม่โดยไม่มี setup change

Time adjustment เป็น whole exam, มีประวัติและ idempotency, overlap recheck Deadline ของ normal OPEN versions อ่าน ends_at ปัจจุบัน; reopen grant มี deadline ของตน ไม่เปลี่ยน Exam schedule/room reservation

Seat assignment ใช้ seat/device IDs ตรวจ room/eligibility/active student/readiness, displacement atomic และ append-only events Auto-seat คืน unassigned count ไม่สร้าง seat A1 ปลอม Completed seat changes ถูกปิด

Policy configuration ที่ require Agent/face/network ยังไม่ fail-closed เพื่อบังคับ integration ที่ไม่มีอยู่ MVP จึงเป็น demo configuration พร้อม capabilities unavailable ไม่ใช่ Agent authentication

**F05:** backend revision check ทำงาน แต่ frontend อาจส่ง revision ใหม่จาก /access พร้อม checkbox ที่รับทราบกฎเก่า เพราะ selected Exam DTO ไม่ refresh

## 8. Submission/file findings

### เส้นทางจริง

1. POST attempts ตรวจ owning Student, server window, snapshot membership, rules/revision; resume OPEN เดิม
2. POST files สร้าง stable uploadId/sequence/generated name; expected size/MIME เป็น hints
3. PUT content รับ stream จริง ตรวจ own file/version และอ่าน deadline ใหม่ระหว่างรับ
4. เขียน temporary bytes, hash SHA-256 ขณะเขียน, actual length/limit, flush/fsync, os.link ไป UUID path
5. commit_receive บันทึก actual metadata/integrity/audit ใน internal engine.begin ก่อน return READY
6. FINAL ล็อก exam/root/version/files ตรวจ READY/minimum/manual window แล้ว update FINAL/latest pointer/audit
7. Reopen สร้าง per-student grant และ version ใหม่; FINAL เดิมไม่ overwrite

Path เป็น exams/{examId}/{studentId}/{submissionId}/versions/{versionId}/{uploadId} ไม่ใช้ original/submission filename เป็น path; resolve containment ตรวจ root; Windows รองรับ extended path Runtime storage ignored by Git

Rename เปลี่ยน submission name เท่านั้น คุม base ASCII letters/digits/_/- และ extension; original/UUID/sequence/digest ไม่เปลี่ยน Remove เป็น logical removed, ไม่ reuse sequence READY PUT retry คืน receipt เดิม ไม่ replace bytes Concurrent same-upload lease ปฏิเสธ receiver ซ้อน

Manual FINAL ปฏิเสธ reserved/receiving/failed และไฟล์ไม่ครบ Timeout รับเฉพาะ READY, incomplete FINAL มี isComplete=false; zero READY เป็น expired Transfer ต้องเริ่ม bytes ก่อน deadline จึงมี grace 10 วินาที Reopen หลัง end เป็น late; normal timeout grace ไม่ถูกตี late โดยอัตโนมัติ

FINAL มี application guards และ DB triggers; previous FINAL ทุก version ยังอ่าน/download ได้ staff ไม่มีสิทธิ์ส่งแทน Student Archive ใช้ server-selected latest FINAL IDs, ZIP_STORED ไม่ extract student ZIP

**F01:** FINAL endpoint ยังตอบก่อน outer DB commit ต่างจาก READY ที่ internal commit ถูกต้อง **F02/F03/F12:** connection pressure, orphan quarantine race และ storage/archive resource limits

Local DB กับ filesystem ไม่ atomic: file placement ก่อน DB commit อาจเหลือ orphan เมื่อ commit ล้ม แต่ไม่คืน READY ก่อน commit_receive สำเร็จ Retry/quarantine/worker recovery รองรับบางกรณี การ rename/link directory ไม่ได้ fsync ทุก parent และยังไม่มี power-loss/restore proof จึงไม่อ้าง physical crash durability หรือ WORM

## 9. SHA-256/integrity findings

Digest มาจาก actual streamed bytes ที่ backend เขียนลง temp file แล้ว flush/fsync และ link ไฟล์ inode เดียวกันไป canonical path ไม่เชื่อ client hash; size เทียบ actual กับ expected/policy ก่อน READY

ค่า BYTEA 32 bytes อยู่ file row เดียวกับ metadata/storage key; DTO แปลงเป็น hex DB M12 ป้องกันแก้ READY size/digest/path/time และ FINAL ป้องกัน mutation ทั้ง workspace

verify_stored_file อ่าน bytes จาก disk ใหม่ก่อน download/archive, เทียบ size + digest และเพิ่ม append-only integrity checks; missing/mismatch ตอบ 503 พร้อม audit โดยไม่แก้ hash ประวัติเดิม การตรวจซ้ำจึง **implemented** ไม่ใช่ deferred

ไม่มี hash uniqueness เพราะ identical content ระหว่างนักศึกษาเป็นไปได้ Digest ไม่พิสูจน์ว่า code ถูกต้อง/ปลอดภัย/execute ได้ และไม่พิสูจน์ original authorship

ข้อจำกัด: receipt adapter submissionFromApi ยังแสดง integrityCheck=passed/integrityStatus=valid จากการมี FINAL ไม่ได้แสดง latest re-check outcome ถึงแม้ backend ปิด download เมื่อ mismatch ควรแยก “รับ bytes/hash แล้ว” กับ “ตรวจปัจจุบันผ่าน” ในงานแสดงผลถัดไป ไม่ใช้ label นี้เป็น security authority

ไม่พบ path ให้ Student เปลี่ยน bytes หลัง READY/FINAL ผ่าน API ไม่รับรองความคงอยู่จากสิทธิ์ host/DB owner; TOCTOU ระหว่าง verify กับเปิดอ่านยังเป็น operational hardening เมื่อ storage ถูกแก้จากภายนอก API

## 10. Transaction/concurrency findings

| Operation | Safeguards ที่มี | ความเสี่ยงที่เหลือ |
|---|---|---|
| User/profile provision, academic wizard | transaction + FK/unique/deferred profile | F01 commit หลัง HTTP response |
| Refresh rotation | family/token locks + digest + replay revoke | F01 token/cookie ส่งก่อน commit |
| Activation/reset | token + user locks, one-use atomic | F01 และ F06 lock order; F07 hashing invalid token |
| Section/cohort/roster changes | offering locks, collision + due snapshot + reconcile | F09 global contention; F11 status check race |
| Exam/policy/resources | transaction + deferred completeness + GiST exclusion | F01 false-success เมื่อ commit fail |
| Seat displacement/auto | exam lock + uniqueness + append-only events | F01 receipt timing |
| Time/reopen critical commands | actor/key advisory lock, request digest/receipt, scope recheck | F01 receipt timing |
| Receive | session upload lease, stream นอก DB txn ยาว, short READY commit | F02 auth dependency ยังถือ txn; F03 maintenance stale view |
| Manual FINAL | root/version/files locks, repeat receipt, DB immutable guards | F01 receipt ก่อน durable commit |
| Timeout/recovery | worker internal engine.begin, repeated execution ได้ | ไม่มี worker liveness/progress health; head-of-line risk |
| File integrity failure | immutable original + separate checks; explicit commit ก่อน error | FS read OSError บางเส้นทางเป็น generic 500 |

Concurrency tests มี room overlap, concurrent cohort creation, parallel attempt/finalize และ one-use activation จริง แต่ไม่ได้ทดสอบ response-send/commit ordering, pool exhaustion, opposite lock order หรือ maintenance/receiver race

Idempotency record อยู่ DB txn เดียวกับ mutation; payload mismatch 409 Authorization ตรวจใหม่ แต่ network response จะเป็น durable receipt ได้ก็ต่อเมื่อแก้ F01 แล้ว ไม่มี credential/token responses เข้า idempotency store

## 11. API findings และ complete route inventory

ตรวจ AST ของ routes และ OpenAPI ในหน่วยความจำตรงกัน **103 method/path patterns** เมื่อขยาย {name} เป็น faculties/departments/majors/class-groups จะเป็น 118 concrete method/path combinations ไม่รวม FastAPI docs/OpenAPI framework routes

ตารางด้านล่างระบุ actual registered names เช่น {identifier} ซึ่งเป็น UUID ส่วน {name} มี allowlist 4 collections ไม่ได้เปิด arbitrary table access

**Roles/auth:** A=Admin, T=Teacher, S=Student, U=A/T/S, P=public; R=opaque refresh cookie + Origin/CSRF, K=one-use account token ไม่ใช่ JWT staff หมายถึง A/T; Teacher/Student ต้องผ่าน scope เพิ่มแม้ role ถูกต้อง

**Scope legend:** own=owner Student; section=Teacher current assignment/Student roster; exam=Teacher assigned Section/Student eligible snapshot; room=authorized relevant exam room + Student own seat; catalog=reference catalog; admin=all within administrative role ไม่ใช่ anonymous

**Tables legend** (R/W เป็นการอ่าน/เขียนตาม method/service; mutation เพิ่ม audit_logs เว้น auth failure ที่ commit แยก):
- AU: users/role profiles; AS: auth_sessions/refresh_tokens/account_tokens
- AC: academic_settings/faculties/departments/majors/class_groups/counters
- CO: courses/course_offerings/sections/section_teachers/cohorts/cohort_groups/overrides
- RO: floors/physical_rooms/exam_rooms/room_seats/computer_devices
- EX: exam_sessions/policies/extensions/domains/resources/rules/participants/current seats/seat events/time adjustments
- SU: submissions/versions/reopen_grants/files; IC: file_integrity_checks + disk bytes
- MO: violations/security_settings/security_allowed_domains; AL: audit_logs; IK: idempotency_keys
- Scoped exam GET บางรายการ freeze participants/write AL ได้ และ file GET เพิ่ม IC/AL จึงไม่ได้เรียกผ่านจริงใน audit นี้

**Frontend caller legend:** AP=ApiAppProvider ผ่าน context actions ให้ shared pages; ST=ApiStudentFlow; LG=ApiLoginLanding/ApiClient; AA=ApiAccountActions; SG=StudentGroupManager; MT=ApiExamMonitoringDetail; AR=ApiAnswerFileRepository; AUUI=SystemAuditLog; SUUI=StudentManagement; AW=AcademicStructureWizard; SE=ApiSecuritySettings; AY=ApiAcademicSettings; OPS=operations/Compose; —=ไม่มี frontend caller โดยตรงที่พบ เป็น API support/contract route ไม่ใช่พิสูจน์ว่า endpoint ใช้ไม่ได้


### auth (9 routes)

| Method / path | Auth / roles | Ownership / scope | Service / handler | Tables R/W | Frontend caller |
|---|---|---|---|---|---|
| POST `/api/v1/auth/login` | P / ไม่ต้อง auth | credentials | [auth.login](../backend/app/api/auth.py) :25 | R/W R/W AU+AS+AL | LG |
| POST `/api/v1/auth/refresh` | R / cookie+CSRF / ต้อง auth | own session/account | [auth.refresh](../backend/app/api/auth.py) :32 | R/W R/W AU+AS+AL | LG |
| POST `/api/v1/auth/logout` | R / cookie+CSRF / ต้อง auth | own session/account | [auth.digest](../backend/app/api/auth.py) :39 | R/W R/W AU+AS+AL | LG |
| POST `/api/v1/auth/logout-all` | U / ต้อง auth | own session/account | [auth.revoke_all](../backend/app/api/auth.py) :52 | R/W R/W AU+AS+AL | AA |
| GET `/api/v1/auth/me` | U / ต้อง auth | own session/account | [me (route/helpers)](../backend/app/api/auth.py) :59 | R AU+AC | AP |
| POST `/api/v1/auth/activation/inspect` | K / account token / ต้อง auth | valid token owner | [auth.valid_account_token](../backend/app/api/auth.py) :65 | R AU+AS | LG |
| POST `/api/v1/auth/activation/complete` | K / account token / ต้อง auth | valid token owner | [auth.complete_password](../backend/app/api/auth.py) :72 | R/W R/W AU+AS+AL | LG |
| POST `/api/v1/auth/password-reset/complete` | K / account token / ต้อง auth | valid token owner | [auth.complete_password](../backend/app/api/auth.py) :77 | R/W R/W AU+AS+AL | LG |
| POST `/api/v1/auth/password/change` | U / ต้อง auth | own session/account | [auth.verify_password, auth.revoke_all, auth.hash_password](../backend/app/api/auth.py) :82 | R/W R/W AU+AS+AL | AA |

### users (10 routes)

| Method / path | Auth / roles | Ownership / scope | Service / handler | Tables R/W | Frontend caller |
|---|---|---|---|---|---|
| GET `/api/v1/users` | A / ต้อง auth | admin | [users.user_dto](../backend/app/api/users.py) :64 | R AU+AC | AP |
| GET `/api/v1/students/export` | A / ต้อง auth | admin | [users.user_dto](../backend/app/api/users.py) :76 | R AU+AC | SUUI |
| GET `/api/v1/students` | A / ต้อง auth | admin | [users.user_dto](../backend/app/api/users.py) :87 | R AU+AC | — |
| GET `/api/v1/teachers` | A/T / ต้อง auth | admin / T limited selector metadata | [users.user_dto](../backend/app/api/users.py) :92 | R AU+AC | AP |
| GET `/api/v1/users/{identifier}` | A / ต้อง auth | admin | [users.user_dto, users.reference_count](../backend/app/api/users.py) :107 | R AU+AC | AA |
| POST `/api/v1/users` | A / ต้อง auth | admin | [users.save](../backend/app/api/users.py) :114 | R/W AU+AC+CO+EX+AL | AP |
| PATCH `/api/v1/users/{identifier}` | A / ต้อง auth | admin | [users.save](../backend/app/api/users.py) :119 | R/W AU+AC+CO+EX+AL | AP |
| PATCH `/api/v1/users/{identifier}/status` | A / ต้อง auth | admin | [users.status](../backend/app/api/users.py) :124 | R/W AU+AS+AL | AP |
| DELETE `/api/v1/users/{identifier}` | A / ต้อง auth | admin | [users.remove](../backend/app/api/users.py) :129 | R/W AU+AC+CO+EX+AL | AP |
| POST `/api/v1/users/{identifier}/account-links` | A / ต้อง auth | admin | [issue_link (route/helpers)](../backend/app/api/users.py) :134 | R/W AU+AS+AL | AA |

### academic (10 routes)

| Method / path | Auth / roles | Ownership / scope | Service / handler | Tables R/W | Frontend caller |
|---|---|---|---|---|---|
| GET `/api/v1/academic/settings` | U / ต้อง auth | catalog | [academic.settings](../backend/app/api/academic.py) :20 | R AC | AP |
| PATCH `/api/v1/academic/settings` | A / ต้อง auth | admin + valid parent/group | [update_settings (route/helpers)](../backend/app/api/academic.py) :25 | R/W R/W AC+AL | AY |
| POST `/api/v1/academic/structures/preview` | A / ต้อง auth | admin + valid parent/group | [academic.preview_structure](../backend/app/api/academic.py) :39 | R AC | AW |
| POST `/api/v1/academic/structures` | A / ต้อง auth | admin + valid parent/group | [academic.structure](../backend/app/api/academic.py) :44 | R/W AC+EX+AL+IK | AP |
| POST `/api/v1/academic/class-groups/{identifier}/student-assignments` | A / ต้อง auth | admin + valid parent/group | [academic.student_assignment](../backend/app/api/academic.py) :49 | R/W AU+AC+CO+EX+AL+IK | AP |
| GET `/api/v1/academic/{name}` | U / ต้อง auth | catalog | [academic.collection](../backend/app/api/academic.py) :72 | R AC+AU+CO/EX refs | AP |
| GET `/api/v1/academic/{name}/{identifier}` | U / ต้อง auth | catalog | [academic.collection](../backend/app/api/academic.py) :89 | R AC+AU+CO/EX refs | — |
| POST `/api/v1/academic/{name}` | A / ต้อง auth | admin + valid parent/group | [academic.save](../backend/app/api/academic.py) :96 | R/W AC+AU+CO/EX refs+AL | AP |
| PATCH `/api/v1/academic/{name}/{identifier}` | A / ต้อง auth | admin + valid parent/group | [academic.save](../backend/app/api/academic.py) :101 | R/W AC+AU+CO/EX refs+AL | AP |
| DELETE `/api/v1/academic/{name}/{identifier}` | A / ต้อง auth | admin + valid parent/group | [academic.collection](../backend/app/api/academic.py) :106 | R/W AC+AU+CO/EX refs+AL | AP |

### courses (14 routes)

| Method / path | Auth / roles | Ownership / scope | Service / handler | Tables R/W | Frontend caller |
|---|---|---|---|---|---|
| GET `/api/v1/courses` | U / ต้อง auth | section (T current assignment / S effective membership) | [courses.course_dto, courses.visible_sections](../backend/app/api/courses.py) :28 | R CO+AU+AC | AP |
| GET `/api/v1/courses/{identifier}` | U / ต้อง auth | section (T current assignment / S effective membership) | [courses.course_dto](../backend/app/api/courses.py) :43 | R CO+AU+AC | — |
| POST `/api/v1/courses` | A / ต้อง auth | admin + dependency/roster checks | [courses.save_course](../backend/app/api/courses.py) :48 | R/W CO+AU+AC +EX+AL | AP |
| PATCH `/api/v1/courses/{identifier}` | A / ต้อง auth | admin + dependency/roster checks | [courses.save_course](../backend/app/api/courses.py) :53 | R/W CO+AU+AC +EX+AL | AP |
| DELETE `/api/v1/courses/{identifier}` | A / ต้อง auth | admin + dependency/roster checks | [roster.before_membership_change](../backend/app/api/courses.py) :58 | R/W CO+AU+AC +EX+AL | AP |
| GET `/api/v1/sections` | U / ต้อง auth | section (T current assignment / S effective membership) | [courses.visible_sections, courses.section_dto](../backend/app/api/courses.py) :70 | R CO+AU+AC | — |
| GET `/api/v1/sections/{identifier}` | U / ต้อง auth | section (T current assignment / S effective membership) | [courses.section_dto, roster.require_section](../backend/app/api/courses.py) :84 | R CO+AU+AC | — |
| POST `/api/v1/sections` | A / ต้อง auth | admin + dependency/roster checks | [courses.save_section](../backend/app/api/courses.py) :89 | R/W CO+AU+AC +EX+AL | AP |
| PATCH `/api/v1/sections/{identifier}` | A / ต้อง auth | admin + dependency/roster checks | [courses.save_section](../backend/app/api/courses.py) :94 | R/W CO+AU+AC +EX+AL | AP |
| DELETE `/api/v1/sections/{identifier}` | A / ต้อง auth | admin + dependency/roster checks | [courses.delete_section](../backend/app/api/courses.py) :99 | R/W CO+AU+AC +EX+AL | AP |
| GET `/api/v1/sections/{identifier}/roster` | A/T / ต้อง auth | section (T current assignment / S effective membership) | [roster.require_section, roster.effective_roster](../backend/app/api/courses.py) :110 | R CO+AU+AC | AP |
| GET `/api/v1/sections/{identifier}/roster/candidates` | A/T / ต้อง auth | section (T current assignment / S effective membership) | [roster.require_section, roster.effective_roster, roster.can_manage_section](../backend/app/api/courses.py) :129 | R CO+AU+AC | SG |
| POST `/api/v1/sections/{identifier}/roster/inclusions` | A/T / ต้อง auth | section (T current assignment / S effective membership) | [roster.inclusion](../backend/app/api/courses.py) :146 | R/W CO+AU+AC +EX+AL | AP |
| POST `/api/v1/sections/{identifier}/roster/moves` | A/T / ต้อง auth | section (T current assignment / S effective membership) | [roster.require_section, roster.move](../backend/app/api/courses.py) :151 | R/W CO+AU+AC +EX+AL+IK | AP |

### rooms (20 routes)

| Method / path | Auth / roles | Ownership / scope | Service / handler | Tables R/W | Frontend caller |
|---|---|---|---|---|---|
| GET `/api/v1/rooms/floors` | A/T / ต้อง auth | staff catalog | [list_floors (route/helpers)](../backend/app/api/rooms.py) :19 | R RO+EX refs | AP |
| POST `/api/v1/rooms/floors` | A / ต้อง auth | admin + layout/history refs | [rooms.save_floor](../backend/app/api/rooms.py) :28 | R/W RO+EX refs+AL | AP |
| PATCH `/api/v1/rooms/floors/{identifier}` | A / ต้อง auth | admin + layout/history refs | [rooms.save_floor](../backend/app/api/rooms.py) :33 | R/W RO+EX refs+AL | AP |
| DELETE `/api/v1/rooms/floors/{identifier}` | A / ต้อง auth | admin + layout/history refs | [rooms.remove](../backend/app/api/rooms.py) :38 | R/W RO+EX refs+AL | AP |
| GET `/api/v1/rooms/physical-rooms` | A/T / ต้อง auth | staff catalog | [rooms.physical_dto](../backend/app/api/rooms.py) :43 | R RO+EX refs | AP |
| GET `/api/v1/rooms/physical-rooms/{identifier}` | A/T / ต้อง auth | staff catalog | [rooms.physical_dto](../backend/app/api/rooms.py) :58 | R RO+EX refs | — |
| POST `/api/v1/rooms/physical-rooms` | A / ต้อง auth | admin + layout/history refs | [rooms.save_physical](../backend/app/api/rooms.py) :63 | R/W RO+EX refs+AL | AP |
| PATCH `/api/v1/rooms/physical-rooms/{identifier}` | A / ต้อง auth | admin + layout/history refs | [rooms.save_physical](../backend/app/api/rooms.py) :68 | R/W RO+EX refs+AL | AP |
| DELETE `/api/v1/rooms/physical-rooms/{identifier}` | A / ต้อง auth | admin + layout/history refs | [rooms.remove](../backend/app/api/rooms.py) :73 | R/W RO+EX refs+AL | AP |
| GET `/api/v1/rooms/exam-rooms` | A/T / ต้อง auth | staff catalog | [rooms.room_dto](../backend/app/api/rooms.py) :78 | R RO+EX refs | AP |
| GET `/api/v1/rooms/exam-rooms/{identifier}` | U / ต้อง auth | room; S own assigned seats | [rooms.room_dto](../backend/app/api/rooms.py) :89 | R RO+EX refs | AP |
| POST `/api/v1/rooms/exam-rooms` | A / ต้อง auth | admin + layout/history refs | [rooms.save_room](../backend/app/api/rooms.py) :94 | R/W RO+EX refs+AL | AP |
| PATCH `/api/v1/rooms/exam-rooms/{identifier}` | A / ต้อง auth | admin + layout/history refs | [rooms.save_room](../backend/app/api/rooms.py) :99 | R/W RO+EX refs+AL | AP |
| DELETE `/api/v1/rooms/exam-rooms/{identifier}` | A / ต้อง auth | admin + layout/history refs | [rooms.remove](../backend/app/api/rooms.py) :104 | R/W RO+EX refs+AL | AP |
| PUT `/api/v1/rooms/exam-rooms/{identifier}/layout` | A / ต้อง auth | admin + layout/history refs | [rooms.layout](../backend/app/api/rooms.py) :109 | R/W RO+EX refs+AL | AP |
| GET `/api/v1/devices` | A/T / ต้อง auth | T relevant authorized exam rooms | [rooms.device_dto, rooms.allowed_room_ids](../backend/app/api/rooms.py) :122 | R RO+EX refs | AP |
| GET `/api/v1/devices/{identifier}` | A/T / ต้อง auth | T relevant authorized exam rooms | [rooms.device_dto](../backend/app/api/rooms.py) :137 | R RO+EX refs | — |
| POST `/api/v1/devices` | A / ต้อง auth | admin + layout/history refs | [rooms.save_device](../backend/app/api/rooms.py) :142 | R/W RO+EX refs+AL | AP |
| PATCH `/api/v1/devices/{identifier}` | A / ต้อง auth | admin + layout/history refs | [rooms.save_device](../backend/app/api/rooms.py) :147 | R/W RO+EX refs+AL | AP |
| DELETE `/api/v1/devices/{identifier}` | A / ต้อง auth | admin + layout/history refs | [rooms.remove](../backend/app/api/rooms.py) :152 | R/W RO+EX refs+AL | AP |

### exams (13 routes)

| Method / path | Auth / roles | Ownership / scope | Service / handler | Tables R/W | Frontend caller |
|---|---|---|---|---|---|
| GET `/api/v1/exams` | U / ต้อง auth | exam (T current Section / S eligible / A) | [exams.authorized_ids, exams.exam_dto](../backend/app/api/exams.py) :21 | R EX+CO+RO+AU | AP |
| GET `/api/v1/exams/{identifier}` | U / ต้อง auth | exam (T current Section / S eligible / A) | [exams.exam_dto, exams.require_exam](../backend/app/api/exams.py) :51 | R/W EX+CO+RO+AU (+ due snapshot/AL) | — |
| POST `/api/v1/exams` | A/T / ต้อง auth | exam (T current Section / S eligible / A) | [roster.require_section, exams.save](../backend/app/api/exams.py) :56 | R/W EX+CO+RO+AU+AL+IK | AP |
| PATCH `/api/v1/exams/{identifier}` | A/T / ต้อง auth | exam (T current Section / S eligible / A) | [exams.save](../backend/app/api/exams.py) :62 | R/W EX+CO+RO+AU+AL | AP |
| GET `/api/v1/exams/{identifier}/participants` | A/T / ต้อง auth | exam (T current Section / S eligible / A) | [exams.require_exam, roster.exam_roster](../backend/app/api/exams.py) :67 | R/W EX+CO+RO+AU (+ due snapshot/AL) | AP/AR |
| GET `/api/v1/exams/{identifier}/access` | S / ต้อง auth | own eligibility | [exams.require_exam](../backend/app/api/exams.py) :88 | R/W EX+CO+RO+AU+SU (+ due snapshot/AL) | ST |
| GET `/api/v1/exams/{identifier}/seat-assignments` | U / ต้อง auth | exam (T current Section / S eligible / A) | [exams.require_exam, exams.assignments_dto](../backend/app/api/exams.py) :95 | R/W EX+CO+RO+AU (+ due snapshot/AL) | AP |
| PUT `/api/v1/exams/{identifier}/seat-assignments/{seat_id}` | A/T / ต้อง auth | exam (T current Section / S eligible / A) | [exams.assign](../backend/app/api/exams.py) :101 | R/W EX+CO+RO+AU+AL | AP |
| DELETE `/api/v1/exams/{identifier}/seat-assignments/{seat_id}` | A/T / ต้อง auth | exam (T current Section / S eligible / A) | [exams.assign](../backend/app/api/exams.py) :106 | R/W EX+CO+RO+AU+AL | AP |
| POST `/api/v1/exams/{identifier}/seat-assignments/auto` | A/T / ต้อง auth | exam (T current Section / S eligible / A) | [exams.require_exam, exams.auto_assign](../backend/app/api/exams.py) :111 | R/W R/W EX+CO+RO+AU+AL+IK | AP |
| POST `/api/v1/exams/{identifier}/time-adjustments` | A/T / ต้อง auth | exam (T current Section / S eligible / A) | [exams.require_exam, exams.time_adjustment](../backend/app/api/exams.py) :117 | R/W R/W EX+CO+RO+AU+AL+IK | AP/MT |
| POST `/api/v1/exams/{identifier}/submission-reopens` | A/T / ต้อง auth | exam (T current Section / A); participant grant scope | [exams.require_exam + submissions.grant_reopen](../backend/app/api/exams.py) :123 | R/W R/W EX+AU+SU+AL+IK | AP/MT |
| GET `/api/v1/exams/{identifier}/events` | A/T / ต้อง auth | exam (T current Section / S eligible / A) | [exams.require_exam](../backend/app/api/exams.py) :130 | R EX+CO+AL | MT |

### submissions (12 routes)

| Method / path | Auth / roles | Ownership / scope | Service / handler | Tables R/W | Frontend caller |
|---|---|---|---|---|---|
| POST `/api/v1/exams/{identifier}/attempts` | S / ต้อง auth | own + eligible exam + OPEN/window | [submissions.start_attempt](../backend/app/api/submissions.py) :24 | R/W EX+AU+SU+AL | ST |
| GET `/api/v1/exams/{identifier}/submissions/archive` | A/T / ต้อง auth | exam (T assigned Section) | [exams.require_exam + storage.verify_stored_file + ZIP](../backend/app/api/submissions.py) :29 | R EX+SU+disk; W IC+AL | AR |
| GET `/api/v1/exams/{identifier}/submissions` | A/T / ต้อง auth | exam (T assigned Section) | [exams.require_exam, submissions.root_dto](../backend/app/api/submissions.py) :51 | R/W EX+AU+SU (+ due snapshot/AL) | AP/AR |
| GET `/api/v1/submissions/{identifier}` | U / ต้อง auth | own S / assigned T / A; OPEN metadata owner only | [submissions.require_root, submissions.root_dto](../backend/app/api/submissions.py) :63 | R EX+AU+SU | — |
| GET `/api/v1/submissions/{identifier}/versions` | U / ต้อง auth | own S / assigned T / A; staff FINAL only | [submissions.require_root, submissions.version_dto](../backend/app/api/submissions.py) :69 | R EX+AU+SU | ST/AR |
| GET `/api/v1/submissions/{identifier}/versions/{version_id}` | U / ต้อง auth | own S / assigned T / A; staff FINAL only | [submissions.require_version, submissions.version_dto](../backend/app/api/submissions.py) :78 | R EX+AU+SU | — |
| POST `/api/v1/submissions/{identifier}/versions/{version_id}/files` | S / ต้อง auth | own + eligible exam + OPEN/window | [submissions.file_intent](../backend/app/api/submissions.py) :84 | R/W EX+AU+SU+AL | ST |
| PUT `/api/v1/submission-files/{upload_id}/content` | S / ต้อง auth | own + eligible exam + OPEN/window | [storage.receive](../backend/app/api/submissions.py) :89 | R/W R/W EX+AU+AS+SU+IC+AL+disk | ST |
| PATCH `/api/v1/submission-files/{upload_id}` | S / ต้อง auth | own + eligible exam + OPEN/window | [submissions.rename_file](../backend/app/api/submissions.py) :94 | R/W EX+AU+SU+AL | ST |
| DELETE `/api/v1/submission-files/{upload_id}` | S / ต้อง auth | own + eligible exam + OPEN/window | [submissions.remove_file](../backend/app/api/submissions.py) :99 | R/W EX+AU+SU+AL | ST |
| GET `/api/v1/submission-files/{upload_id}/content` | U / ต้อง auth | own S / assigned T / A; staff FINAL only | [submissions.require_file + storage.verify_stored_file](../backend/app/api/submissions.py) :104 | R EX+SU+disk; W IC+AL | ST/AR |
| POST `/api/v1/submissions/{identifier}/versions/{version_id}/finalize` | S / ต้อง auth | own + eligible exam + OPEN/window | [submissions.finalize](../backend/app/api/submissions.py) :114 | R/W EX+AU+SU+AL | ST |

### monitoring (13 routes)

| Method / path | Auth / roles | Ownership / scope | Service / handler | Tables R/W | Frontend caller |
|---|---|---|---|---|---|
| GET `/api/v1/monitoring/daily` | A/T / ต้อง auth | assigned exams T / A | [monitoring.daily_exams, exams.exam_dto, exams.status](../backend/app/api/monitoring.py) :23 | R EX+CO+RO+SU+AU+MO+AL | — |
| GET `/api/v1/monitoring/calendar` | A/T / ต้อง auth | assigned exams T / A | [monitoring.day_bounds, exams.authorized_ids](../backend/app/api/monitoring.py) :38 | R EX+CO+RO+SU+AU+MO+AL | — |
| GET `/api/v1/monitoring/exams/{identifier}` | A/T / ต้อง auth | assigned exams T / A | [monitoring.summary](../backend/app/api/monitoring.py) :53 | R EX+CO+RO+SU+AU+MO+AL | MT |
| GET `/api/v1/monitoring/overview` | A/T / ต้อง auth | assigned exams T / A | [monitoring.overview](../backend/app/api/monitoring.py) :58 | R AU+CO+RO+EX+SU+MO | AP |
| GET `/api/v1/violations` | U / ต้อง auth | own S / assigned exam T / A | [exams.authorized_ids](../backend/app/api/monitoring.py) :77 | R MO+EX+AU | AP/MT |
| POST `/api/v1/violations/{identifier}/seen` | S / ต้อง auth | own event + exam | [seen (route/helpers)](../backend/app/api/monitoring.py) :94 | R/W MO+EX+AU+AL | AP/ST |
| POST `/api/v1/violations/{identifier}/review` | A/T / ต้อง auth | exam (T assigned) | [review (route/helpers)](../backend/app/api/monitoring.py) :103 | R/W MO+EX+AU+AL | AP/MT |
| POST `/api/v1/dev/exams/{identifier}/violations` | A/T / ต้อง auth | exam (T assigned); explicit development flag | [exams.require_exam, roster.exam_roster](../backend/app/api/monitoring.py) :112 | R/W MO+EX+AU+AL | — |
| GET `/api/v1/admin/security-settings` | A / ต้อง auth | admin | [security (route/helpers)](../backend/app/api/monitoring.py) :131 | R MO | AP/SE |
| PUT `/api/v1/admin/security-settings` | A / ต้อง auth | admin | [exams.normalized_domain](../backend/app/api/monitoring.py) :136 | R/W MO+AL | AP/SE |
| GET `/api/v1/admin/audit-logs/export` | A / ต้อง auth | admin | [export_audit (route/helpers)](../backend/app/api/monitoring.py) :165 | R AL | AUUI |
| GET `/api/v1/admin/audit-logs` | A / ต้อง auth | admin | [audit_list (route/helpers)](../backend/app/api/monitoring.py) :176 | R AL | AP |
| GET `/api/v1/admin/overview` | A / ต้อง auth | admin | [monitoring.overview](../backend/app/api/monitoring.py) :186 | R AU+CO+RO+EX+SU+MO | AP |

### health (1 route)

| Method / path | Auth / roles | Ownership / scope | Service / handler | Tables R/W | Frontend caller |
|---|---|---|---|---|---|
| GET `/health` | P / ไม่ต้อง auth | liveness | [health](../backend/app/api/health.py) :9 | — | OPS |

### Readiness (1 route)

| Method / path | Auth / roles | Ownership / scope | Service / handler | Tables R/W | Frontend caller |
|---|---|---|---|---|---|
| GET `/ready` | P / ไม่ต้อง auth | readiness | [main.ready](../backend/app/main.py) :59 | DB SELECT + storage probe | OPS |

### API contract gaps และ error behavior

Route inventory ไม่พบ duplicate method/path ที่แย่ง handler ไม่มี generic client audit-create, public register, arbitrary table route หรือ submission impersonation Dead frontend callers ที่เหลือคือ support GETs และ monitoring daily/calendar ซึ่ง UI ปัจจุบัน derive จาก AP graph ไม่เรียก read models นี้โดยตรง ไม่ควรลบ endpoints โดยถือว่าเสียจากเหตุนี้เพียงอย่างเดียว

- List endpoints ส่วนใหญ่ page/pageSize bound; singleton/layout/current seat sets/calendar/aggregate ไม่จำเป็นต้อง paginate แต่ room layout สูงสุด 1,000
- AP/AR ใช้ api.all ดึงทุกหน้าแล้ว filter/sort ที่ browser จึงลดประโยชน์ pagination และทำให้ F09
- /students ยังไม่มี sort allowlist ตามแผน; /submissions q ค้น full_name ไม่ค้น student code และไม่มี submission-status query; /exams q ใช้ live Course labels ต่างจาก frozen labels ที่ DTO แสดง เป็น contract gaps ที่ UI local filtering กลบอยู่
- Response shapes ส่วนใหญ่ camelCase และ paged lists; seat/calendar sets ใช้ items กับ counts ไม่ได้มี page ทุกครั้ง ต้อง document เป็น bounded/read-model responses
- Routes academic settings/group assignments/delete, auth logout/password, monitoring settings/violations/export และ Course delete มี SQL โดยตรงใน API layer Scope ยังมี แต่ทำให้ service layer ไม่เป็น boundary เดียวและยากนำไปใช้ worker/tests
- expectedVersion ครอบคลุม form mutations; POST commands บางชนิดไม่ต้อง expectedVersion แต่ใช้ locks/idempotency หรือ natural unique transition

| HTTP | สิ่งที่ตรวจ |
|---|---|
| 400 | ไม่มี domain action จำเป็นต้องใช้ 400 ตาม contract ปัจจุบัน; validation ใช้ 422 |
| 401 | generic credentials/session/token failure; profile/hash ไม่อยู่ response |
| 403 | role/action/CSRF ไม่อนุญาต |
| 404 | missing/out-of-scope resource, development endpoint disabled |
| 409 | stale/transition/reference/unique/GiST/FINAL conflict; IntegrityError ตัด SQL/parameters ออก |
| 413 | actual received bytes เกิน policy/expected |
| 422 | Pydantic/domain input; validation response เฉพาะ loc/msg/type ไม่ input/token/password |
| 429 | login rate limit |
| 503 | OperationalError/storage failure/integrity unavailable |
| 500 | uncaught pool TimeoutError, FS read error, unexpected bug; generic server response แต่แปล dependency errors ไม่ครบ |

F01 ทำให้ deferred commit failures ที่เกิดหลัง response ไม่สามารถแปลงเป็น 409/503 ให้ client ได้ แม้มี exception handler อยู่ ส่วน stacktrace ใน server exception logs ไม่ถือว่าเป็น API disclosure โดยอัตโนมัติ ไม่พบ handler ที่คืน DB credential/storage path/token ให้ client ไม่มีการรับรองว่าทุก unexpected exception จะถูก redaction ในทุก logging configuration

## 12. Frontend integration findings

App เลือก provider ตาม build-time dataSource; API mode มี login/activation, account controls, admin CRUD, academic/course/rooms, exam wizard/seats/time/reopen, real Student workspace และ Teacher archive/history

ApiAppProvider เริ่มจาก empty graph ไม่มี mock fallback อัพเดทจาก server DTOs Mutation failure คืน error/toast ไม่แสดง success เงียบ ๆ และเมื่อ command สำเร็จแต่ reload ล้มจะรักษา committed receipt แล้วแสดง reload error ซึ่งจะถูกต้องเมื่อ F01 แก้แล้ว

ApiClient retry 401 หลัง refresh หนึ่งครั้ง, coalesce refresh ใน tab และ Web Locks/BroadcastChannel สำหรับ cross-tab เมื่อ browser รองรับ, idempotency key คงเดิมเมื่อ network/lost response ไม่มี credential ลง browser storage Generation counters ช่วยกัน stale response ข้าม user Session change/logout ล้าง graph/cache และ draft owner

Server UUID เป็น stable relationships Section selector ใช้ sectionId; compatibility display adapters ไม่เขียนเลขตอนเป็น FK; room/device runtime unknown ไม่มี online fallback API Student บอก Agent/face/network ยังไม่ตรวจจริง ไม่มี legacy camera Data URL ถูกส่งเข้าบัญชีจริง

ข้อพบ: F05 selected exam/rules stale; F09 full graph polling; F10 audit roles/export contract; F12 download blob/archive limits Backend ยังคุม access/time/FINAL แม้ UI counter หรือ buttonstate ผิด

IndexedDB API workspace namespace api:userUUID:examUUID:attemptUUID, restore durable server attempt, delete เฉพาะ browserworkspace ของ version ที่ FINAL acknowledge แล้ว ไม่ล้าง mock workspace Draft API แยก user UUID จาก mock draft key ไม่เดา old ambiguous sectionNo

การรับผล attempt ซึ่งเปิดใหม่/selected history ควรมี component-level race tests ไม่ใช่ทดสอบเฉพาะ adapter การ logout ระหว่าง upload อาจยังมี bytes ใน transientmemory/IndexedDB แต่ backend ตรวจ revokedsession อีกครั้งตอน READY commit สิทธิ์ไม่ได้มาจาก browsercache

## 13. Mock/API mode findings

VITE_SECURELAB_DATA_SOURCE เลือก api อย่าง explicit; ค่าอื่นใช้ mock ApiStudentFlow/ApiAnswerFileRepository/APIoverview แยกจาก mock counterparts SimulationToolbar แสดงเฉพาะ mock; API actions สำหรับ persona/time bypass/reset/face update/simulation ถูกปิดหรือแจ้งยังไม่พร้อม

Mock localStorage/IndexedDB/migrations/seeds เดิมยังอยู่ ไม่มีการนำ browser state เข้าฐานข้อมูลเอง Shared code import mocktypes/services เพื่อ selectors/compatibility ไม่เท่ากับนำ mock records มาใช้เป็น authority

API mode อ่าน academicSettings จาก server และใช้ serverClock; mock time subscription อาจยังอยู่ใน sharedcomponents แต่ useExamClock เลือก server path ไม่ให้ demo override ผ่าน API

Mock plaintext credentials/face mock claims และ legacy mockplaceholder ไม่ใช่ currentbackendsecurity implementation การตรวจนี้ไม่ตัด mock ออกเพื่อแก้ชื่อ field เพราะจะผิด scope และทำ demo เสีย

Frontend mock/domain/preview tests ทั้งหมดใน package ผ่านรอบนี้; ไม่รัน browsermock อีกครั้งเพื่อหลีกเลี่ยงเปลี่ยน browserstate ของผู้ใช้ สิ่งนี้ไม่ใช่หลักฐานว่า UI ทุก flow ถูกตรวจด้วย browser ในรอบ audit

## 14. Migration findings

| Revision | Scope |
|---|---|
| M01 | users/admin/auth tokens/sessions/audit/idempotency |
| M02 | academic hierarchy/settings/groups/counters |
| M03 | Student/Teacher profiles + role/profile triggers |
| M04 | Courses/Offerings/Sections/teachers/cohorts/overrides |
| M05 | Room/layout/device catalog |
| M06 | Exam/policy/snapshot/seats/time + btree_gist/exclusion |
| M07 | Submission/grants/versions/files/integrity + FINAL guards |
| M08 | Global security/violations seen/review |
| M09 | singleton defaults + refresh successor family constraint |
| M10 | setup revision |
| M11 | remaining FK indexes |
| M12 | READY byte identity and serialize file mutation with FINAL |

Single linear chain มี 12revisions และ head เดียว m12_ready_file_guard Actual running DB current ถึง head และ Alembic check ไม่พบ new upgrade operations รอบนี้ ใช้ PGOPTIONS read-only ไม่ upgrade/schemaDDL

Fresh empty DB upgrade/forward upgrade **ไม่ได้รันใหม่** เพราะต้องสร้าง/เปลี่ยนฐานข้อมูล เอกสาร backend-implementation.md บันทึกผลรอบก่อนว่าผ่าน จึงเป็น historical evidence Source order/FKs/circular latest-owner FK และ frozen SQL สอดคล้องกัน ไม่มี create_all startup

Alembic check ไม่ตรวจ PL/pgSQL function semantics/CHECK ทั้งหมดได้เท่ากับ review SQL หรือ constraint tests จึงยังพบ F08 ได้แม้ check ผ่าน Destructive downgrade ทุก revision ปิดและต้อง review restore/forward migration เป็นข้อตกลงป้องกันประวัติ ไม่ใช่ downgradebug แต่ยังไม่มี restoreexercise

Development seed explicit/idempotent ไม่รัน startup ไม่ overwriteexistingrecords ไม่ importbrowserpassword/face/hash ใช้ serverUUID ใหม่ครั้งแรกแล้ว reuse IDs เดิมจาก scopedlookup UUID ไม่คงตัวข้ามฐานใหม่ สิ่งนี้ต่างจาก fixture ที่ให้ fixedIDs แต่ไม่ทำให้ relationalintegrity ผิด

Scoped code seed lookup เช่น Department/Major ใช้ code อย่างเดียวในบางจุดพร้อม parentmismatchguard อาจปฏิเสธเมื่ออีก Faculty มี code เดียวกัน แม้ schema อนุญาต ถือเป็น seed usability limitation ไม่ใช่ production domain corruption

Application role provisioning/grants อยู่ CLI migrate ไม่อยู่ Alembic table history ล้วน การใช้ alembic upgrade head อย่างเดียวสร้าง schema ได้แต่ต้อง provision/grant สำหรับ app runtime ตาม README ห้ามกล่าวว่าไม่ต้องมี setuprole เลย **F14** เรื่อง passwordrotation

## 15. Docker/PostgreSQL findings

Compose config --quiet ผ่าน Runningpostgres/backendhealthy และ worker running; ไม่ restart/stop/deletevolume ใน audit

PostgreSQL17namedvolume คงข้อมูลข้าม containerrestart Storage bind mount เดียวกันระหว่าง migrate/backend/worker จึงไม่อยู่ ephemeralimage ไม่เปิด storage เป็น staticdirectory Backend/PGpublished127.0.0.1 เป็น localdevdefault User ใน backend/worker เป็น UID10001; migrationserviceroot เพื่อ chownstorage และใช้ privilegedmigrationDBcredentials ต่างจาก app

JWT/DBcredentials จาก environment ไม่ hardcode จริง .env.example เป็น placeholders POSTGRES_USER ของ officialimage เป็น bootstrapprivilegedrole จึงต้องจำกัด migrationcredential ไม่เอาให้ backend app Runtime role NOSUPERUSER/NOCREATEDB/NOCREATEROLE และ schemaCREATE ถูก revoke; audit/historyUPDATE/DELETE ไม่มี grant

Dependenciespostgreshealthy→migratesuccess→backend/worker ไม่มี implicitDDL ตอน appstart /healthDB-independent; /ready ตรวจ DB/signingkey/storagewrite แต่ไม่ตรวจ Alembichead/workerprogress BackendComposehealthcheck เรียก health จึงยัง healthy ได้เมื่อ DB/storage ใช้ไม่ได้ ต้องแยก liveness/readiness ชัด

ไม่มี workerhealthcheck/progressmetric; caughtworkerfailuresloggeneric แล้ว retry แต่ run_once exception ที่ version หนึ่งหยุดรายการที่เหลือในรอบนั้น ควรเพิ่ม per-versionisolation/observability เมื่อ hardening ไม่ถือว่าการเปิด browser จะทำ worker ทำงานเอง

**F13:** dependency ranges/image tags ไม่มี lock/digest ทำ freshbuild เปลี่ยน runtime ได้ **F12:** aggregate storage/archive limits ยังไม่มี

ไม่ทดสอบ powerrestart/restore ใน audit เพราะจะเปลี่ยน environment ผล containerhealthy ปัจจุบันไม่ใช่หลักฐาน backup/restore หรือ offlineoperation ผ่าน

## 16. Audit-log findings

audit_logs มี actorID/role snapshot/action/target/outcome/metadata/peerIP/session/requestID/created_at; requestmiddleware สร้าง X-Request-ID และ ContextVar ทำ services เชื่อม request ได้ Source logsevents หลักครบ:loginfailure/success/replay/logout/bootstrap/accounttokens/password/status/domainmutations/snapshot/seat/time/reopen/upload/FINAL/timeout/expired/export/download/violations/config

Metadata ใช้ allowlistedkeys ไม่ serializebody Password/token/filecontents และ Studentnames ไม่ถูกเติมอัตโนมัติ reason เป็นข้อความผู้ใช้จึงอาจมี PII ที่ผู้ใช้พิมพ์เองได้ ต้องมี guidance/retention ตาม deployment ไม่ถือว่า allowlist ตรวจเนื้อหาข้อความได้

Auditappend-onlytrigger และ rolepermission ป้องกัน update/delete ไม่มี clientPOSTaudit; ไม่อ้าง HMAC/blockchain/WORM Applicationrole/host/DBowner เป็นคนละ boundary Studentseen ไม่ลด staffpending-review จน review

ข้อพบ F01: download/commandaudit อาจ commit หลัง response มีโอกาสส่ง bytes หรือ receipt แล้วไม่ได้ log หาก commitfail **F10:** roleadaptercase ต่างจาก filter ทำ rolefilter ว่างและ CSV ใช้ filters ไม่ตรงรายการ

Actor ของ loginfail/replay เป็น NULL โดยตั้งใจเพื่อไม่เปิด identity จาก credential ผิด มี emailDigest/peer/sessionmetadata เพื่อสืบค้น PeerIP ใช้ connection ไม่ trustforwardedheader ใด ๆ เมื่อผ่าน Vite/reverseproxy อาจเป็น proxyIP ต้องออกแบบ trustedproxy ก่อน deployment IP นี้ไม่ใช่ devicecatalogIP/MAC UI คำว่า “IP เครื่อง” จึงไม่ควรตีความเป็น authenticateddeviceproof

## 17. Security findings

ค้น backend/app และ frontend/src ไม่พบ uploadedcontent ถูก eval/exec/subprocess/compile/import หรือส่ง shellcommand ไม่พบ unsafearchiveextraction RegExp.exec ของ frontendhelpers เป็น regexparser ไม่ใช่ codeexecution SQLAlchemy.execute คือ DBcommand ไม่ใช่รัน studentprogram

Preview แยก text/image/archive/metadata; textReactescaped/read-only, SVGmetadata, MIMEhint ไม่ authority ZIPpreviewbounded ไม่ extract ไป disk Downloadattachmentapplication/octet-stream/nosniff ไม่ serveactiveHTMLpublic ไม่ judgeuploadedcode

Storage UUIDpath+resolvedcontainment, originalfilename ไม่เป็น path Filenameextensionallowlist เป็น uploadpolicy ไม่ใช่ content-typeverification/antimalware ดังนั้นรับ .py/.html เป็น untrustedbytes ตาม NEVER EXECUTE ถูกต้อง ไม่ต้องเรียกโปรแกรมเพื่อตรวจว่า “เปิดได้”

No publicregistration/adminrolespoof/resetendpoint/globalmockreset Client ไม่ตั้ง FINALstatus/time/identity DevicecatalogIP/MAC/code ไม่มี credentialauthority Phase2integration ต้องเพิ่ม contract แยก

ขอบเขตที่ต้อง hardening: F01/F02/F07/F12, proxyIP/rate-limit กลุ่มผู้ใช้หลัง proxy, HTTPS/CSP/request-ratecontrols และ diskcapacity ไม่มี evidence ว่า secrets ถูก expose ใน errorbody ปัจจุบัน แต่การตรวจนี้ไม่ใช่ penetrationtest หรือ dependencyCVEscan

## 18. Test coverage findings

### สิ่งที่รันใหม่ใน audit

| Check | ผล | Scope/ข้อจำกัด |
|---|---|---|
| npm.cmd run lint | PASS | tsc --noEmit |
| ทุก test:* ใน frontend/package.json (17 scripts) | PASS ทุก script | runner เก็บ exit status;ไม่ได้เก็บ testcount ราย case อย่างครบถ้วน |
| backend test_health.py, -p no:cacheprovider | 1 PASS | monkeypatchEngine.connect ให้ fail ถ้า health แตะ DB;ไม่ใช้ pgfixture |
| docker compose config --quiet | PASS | ไม่ dumpresolvedsecrets |
| Alembic current (read-only) | m12_ready_file_guard head | DB ที่รันอยู่ |
| Alembic check (read-only) | No new upgrade operations detected | ไม่ครอบคลุมทุก trigger/CHECKsemantic |
| OpenAPI vs AST inventory | 103 methods ตรงกัน | สร้างใน memory ไม่ยิง businessrequests |
| Pure ASGI harness defaultyieldtransaction | ยืนยันส่ง 200/body ก่อน commit และก่อน commitexception | framework0.142.2 ทั้ง local/container;ไม่มี DB/files |
| Pure in-memory quarantine harness | staleacknowledgementsnapshot สามารถ rename หลัง simulatedREADYcommit | ยืนยัน logicgap ภายใต้ oldmtime/ordering ไม่ใช่ liveDBrace |
| git diff --check | PASS ก่อนสร้างรายงาน;ตรวจซ้ำตอนจบ | ไม่ format applicationfiles |

ไม่รัน backendintegrationpytest ทั้ง suite เพราะ conftestupgrade/TRUNCATE/UPDATEdatabase; ไม่รัน browser-cross-flow เพราะสร้าง accounts/exams และ passwordlinks ไม่ build ซ้ำเพราะ audit ไม่เปลี่ยน frontend ผล 206frontendtests/21backendtests, mock/APIbuild และ browsercrossflow ที่เอกสารระบุเป็นผลรอบก่อน **ไม่ได้อ้างว่ารันใหม่ใน audit นี้**

### คุณภาพของ tests ที่อ่าน

Backend21tests ไม่ใช่แค่ render มี actualPostgreSQL17guard/_testdatabase guard, concreteDBassertions, SHA256knownbytes, downloadableactualZIP, FINAL SQLmutationdenial, oldversionpreservation, IDOR404, role403, revokedTeacherassignment, authrotation/replay, missing/oversize/retry/storagefull, snapshot-before-mutation และ workerrecover/idempotenttimeout

Concurrency มี ThreadPoolExecutor แข่งจริงใน roomoverlap/cohort/activation/attempt/FINAL แต่ TestClient ส่ง response หลัง app เสร็จทั้งหมด ทำให้ไม่แยกเวลาที่ ASGI ส่ง body กับ transactionteardown จึงไม่จับ F01 Testsquarantine ใส่ filehashmetadata ก่อนเรียก maintenance เท่านั้น ไม่จับ F03

Frontendtest:api8tests เน้น adapter/time/allow-vs-block/no-fakeseat/refreshcoalesce/idempotentkey/retry ไม่ mountApiAppProvider/ApiStudentFlow และไม่จับ stalerules, rolefilter,fullpolling หรือ crosstab จริง Browsercrossflow ใน scripts มี authorizationflow แต่ไม่ใช้แทน componentrace/loadtests


ชื่อ test ที่มีคำว่า rollback/restart ไม่ยืนยันทุก failure mode: wizard test ปัจจุบันตรวจ preview/no-write, success/idempotency และ stale write แต่ยังไม่มี failing multi-level wizard assert ว่าทุก table rollback; recovery test เรียก run_once ซ้ำและจำลอง RECEIVING row ไม่ได้ kill/restart process จริง เหล่านี้เป็นช่องว่างที่ต้องเติมใน validation หลังแก้ ไม่ใช่ข้อสรุปว่า service rollback/restart ทำไม่ได้

### Tests ที่ควรเพิ่มหลังอนุมัติแก้

1. ASGIresponsecapture + deferredcommitfailure:ไม่มี successreceipt ก่อน commit รวม FINAL/login/audit/download
2. 30–60concurrentstreaminguploads จริงกับ productionpoolsetting, slowclient,deadline และ workerprogress
3. Maintenance หยุดหลัง snapshot แล้ว receivercommit พร้อม oldmtime;assertREADY/FINALfile ไม่ move
4. Activation/resetconsume แข่งกับ Adminreissue;ไม่มี deadlock/one-use ยังถูกต้อง
5. StudentSectionDTO ไม่มี rosterIDs ของคนอื่น;currentTeacherrevocations ทุก read/write/filecache
6. Teacher แก้กฎ upcoming ขณะ Student อ่าน:resetacceptance และแสดง revision เดียวกับ attemptPOST
7. READYNULLactualsizeconstraintnegativecases และ active-statusassignmentrace
8. APIauditrole/filter/exportparity, providerpollrequestbudget, browsercrosstabrefresh, storagequota/archivecapacity
9. FreshDB/forwardupgrade/triggerpermissions ใน isolatedPG17;ตรวจว่าการ skip ทั้ง suite เมื่อไม่มี URL ไม่ถูกตีเป็น passingreleasegate

## 19. Requirement traceability table

| Requirement | Implemented? | Location | Test coverage จาก source | Risk/Gap |
|---|---|---|---|---|
| Stable server UUIDs | ใช่ | models/helpers.py, adapters | domain/APItests | browserlegacydisplaykeys ไม่ใช่ FK |
| One role/one profile | ใช่ | M03triggers/users service | profilecommitnegative +rolespoof | F01 deferredfailureafterresponse |
| Faculty→Department→Major | ใช่ | models/academic, academic service | test_auth_academic/frontacademic | active-pathraceF11 |
| Major/year/optionalgroup canonical | ใช่ | student_profiles/compositeFK | group scope/derivedyear | ไม่ storeFaculty/Dept/yearLevel |
| Group sequence ไม่ reuse | ใช่ | make_group/counter | delete→nextsequence | counterserialization ดี |
| Primary/Co-teachers | ใช่ | section_teachers/service | cohort/assignmentrevocation | statusraceF11 |
| Cohort∪include−exclude | ใช่ | roster.py | moves/collisions | StudentDTOIDsF04 |
| Frozen historical roster/labels | ใช่ | roster.freeze/worker/mutations | provision/editafterstart | globallocksF09 |
| UUIDSection ข้ามปี/เทอม | ใช่ | exam.section_id, adapter/wizard | APIadapter/backendscope | oldmockdraft ไม่ guess |
| Server schedule/status [start,end) | ใช่ | exams.status/open_window | exactend/touchingoverlap | UIclock เป็น display |
| Whole-examtime | ใช่ | time_adjustment/ends_at | overlap/idempotentdelta | outercommitF01 |
| RowVersion/idempotency | ใช่ | repository/common/AP | stale/keypayload/lostresponse | receiptprematureF01 |
| JWT/hash/refresh/activation | ใช่ | auth/dependencies/client | replay/redaction/oneuserace | F01/F06/F07 |
| Studentown +TeacherSection scope | ใช่ | require_root/file/exam/section | fileIDOR/Teacher403/404 | minimizedDTOF04 |
| Realbinary+serverSHA | ใช่ | storage.receive/commit_receive | bytesknownhash/retry | poolF02/quotaF12 |
| UUIDdiskpath/NEVEREXECUTE | ใช่ | storage_path/preview | traversal/type/preview | nojudgeassumption |
| DurableREADYreceipt | ใช่ใน internalcommit | storage.commit_receive | storagefull/length | physicalpowerlosstests ยังไม่มี |
| ManualFINALatomicreceipt | บางส่วน | submissions.finalize/DBguards | doubleFINAL/SQLdenial | F01responsebeforecommit |
| Immutableversions/reopen | ใช่ | grants/versions/latestFK | priorFINAL/version2 | maintenanceF03 |
| Timeoutincomplete/zero/grace | ใช่ | worker/finalize/next_chunk | incomplete/no-files/grace/recovery | pool/workerload ยังไม่ tested |
| Integrityrecheck | ใช่ | verify_stored_file/IC | corruption503+immutablehash | latestresultUI ยังไม่ project |
| Realdownload/archive | ใช่ | submissions API/AR | byte/ZIPassertions | quota/tempdisk/blobF12 |
| Monitoringauthorizedactualcounts | ใช่ | monitoring service/AP/MT | daily/calendar/unseated | pollingF09;readmodels บาง routeunused |
| Studentseen≠staffreview | ใช่ | violations fields/routes | monitoringtest/adapter | ไม่เป็น cheatjudgement |
| Append-onlyaudit/redaction | ใช่ใน DB | auditservice/trigger/grants | permissions/requestID/secrets | F01/F10 |
| Mock/APIseparation | ใช่ | App/providers/dataSource | mockdomain+APItransport | providercomponenttests น้อย |
| Freshmigration/metadata | currenthead/drift ยืนยันใหม่ | M01–M12/env | priorvalidation+read-onlycheck | freshupgrade ไม่ rerun |
| Readiness/persistence | config มี | Compose/ready/mounts | healthtest/configcheck | workerhealth/restoredeferred |
| Agent/face/network/Google/offlinesync | ไม่ใช่ MVP | capabilitiesunavailable/UIcopy | provenance/unknownprojection | INFO ไม่เป็น missingMVPbug |

## 20. Severity-ranked findings

### F01 — HIGH: HTTP success/FINAL receipt ถูกส่งก่อน transaction commit

**หลักฐาน:** [dependencies.py](../backend/app/api/dependencies.py) บรรทัด 18–20 ใช้ engine.begin แล้ว yield โดย Depends(database)ไม่มี scope=function; [submissions API](../backend/app/api/submissions.py) final route ใช้ dependency นี้ [main.py](../backend/app/main.py) exceptionhandlers ไม่ได้เปลี่ยน teardownorder RuntimeFastAPI0.142.2 ใช้ requestscope กับ yield ตาม pattern นี้

**ยืนยัน:** pureASGIharness ลำดับ begin → handlerreturnsFINAL → http_status_sent_200 → receipt_body_sent → commit กรณีจำลอง commitfail ก็ส่ง 200/body ก่อนเกิด serverexception ไม่ใช้ realDB/file

**ผลกระทบ:** deferredconstraints/connectionfailure สามารถ rollback แต่ client ได้ success; FINALUI อาจแสดง receipt และ cleanupIndexedDB ก่อน durableFINAL; login อาจได้ JWT/cookie ก่อน sessionrowcommit และ download/exportaudit อาจไม่บันทึกแม้ส่ง bytes แล้ว READYinternalcommit_receive ไม่ได้มีปัญหาเดียวกัน

**แนวแก้เมื่ออนุมัติ:** transaction/UoW ต้อง commit ก่อน response เริ่มส่ง ใช้ dependencyfunctionscope หรือ explicitshorttransaction ที่เหมาะสม แยก streamresponses กับ authlookup ไม่ให้ถือ txn ตลอด download ตรวจ deferrederrors ให้ตอบ 409/503 ก่อนส่ง receipt ไม่เพียงเพิ่ม retryclient

**Test gap:** TestClient รอ request ทั้งวงจรจึงไม่ตรวจ realresponse-sendorder ต้องเพิ่ม ASGI/event-leveltest และ commitfailureinjection ยังไม่พบ irreversibledata-loss จากข้อนี้ใน environment จริงจึงจัด HIGH ไม่ CRITICAL

### F02 — HIGH: Streaming upload ถือ auth DB transaction และ dedicated lease พร้อมกันจน pool starvation

**หลักฐาน:** [database.py](../backend/app/core/database.py) บรรทัด 19 max10+20=30; studentdependency เรียก current_user→database; [storage.py](../backend/app/services/storage.py) บรรทัด 141 ขึ้นไป leaseconnectheld ตลอด stream และ additionalshortDBtransactions ใน initial/deadline/prepare/commit

**เงื่อนไข:** upload แต่ละ request ถืออย่างน้อย 2connections ระยะยาว+shortthirdconnection ประมาณ 15activeuploads ใช้ 30slots ก่อนเผื่อ poll/auth/worker อีก request หรือ deadlinepoll ต้องรอ pool ส ynchronousconnect/advisorySQL ใน asyncroute อาจ blockeventloop ทำให้การรับ chunk และ 10sgrace หมด

**ผลกระทบ:** เป็น load ปกติของห้องสอบที่มีหลายสิบคน ไม่ต้องมี rolebypass; legituploads/FINAL/monitoring อาจ timeout หรือ expired PoolTimeoutError ไม่ได้ map เป็น dependency503 ทั้งหมด

**แนวแก้:** authDBlookup ต้องจบก่อน stream คืน actor ข้อมูลจำเป็นแบบ readonly snapshot แล้ว recheckrevocation ใน shortcommittxn, ลด leaseconnectioncost หรือจัด dedicatedpool/admissioncontrol, offloadsynchronousoperations และจัด capacity/backpressure/loadtest ไม่เพียงขยาย pool โดยไม่วัด

**ระดับหลักฐาน:** lifecycle และ connectioncount ยืนยันจาก source/framework; ยังไม่รัน loadtest บน DB จริง

### F03 — MEDIUM: Orphan maintenance ใช้ acknowledged snapshot เก่าหลังได้ upload lock

**หลักฐาน:** [storage_maintenance.py](../backend/app/services/storage_maintenance.py) บรรทัด 23 อ่าน storage_keyset ครั้งเดียว, บรรทัด 36trylock แล้ว rename ไม่ rereadmetadata/mtime; [storage.py](../backend/app/services/storage.py) receivercommitREADY ก่อน releaselease

**ลำดับ:** maintenance อ่าน ackset ก่อน READYcommit → candidate มี oldmtime และผ่าน age → receivercommit/release → maintenancelock ได้ → rename ไฟล์ที่ตอนนี้ acknowledged แล้วรวมถึงไฟล์ที่ FINAL ภายหลัง; originalhash/pathDB ไม่เปลี่ยนแต่ download503

**ยืนยัน:** fakeDB/fakePathharness ใน memory จำลอง ordering ดังกล่าวและบันทึก ACKNOWLEDGED_FILE_MOVED ไม่มี filesystem/database จริง

**ข้อจำกัดที่ลด severity:** candidate ต้องผ่าน age ด้วย Default24h ช่วยกัน freshuploads ใน same-dayexam จึงไม่กล่าวว่าทุก upload เร็วเสี่ยงทันที เห็นช่องทางชัดเมื่อใช้ age1h กับ long/idlechunkedtransfer ที่ bytes เขียนก่อน EOF นาน หรือ old/restoredmtime/clockskew ไฟล์ถูก quarantine ไม่ delete และกู้คืนได้ จัด MEDIUM แบบมีเงื่อนไข

**แนวแก้:** หลัง lock ตรวจ currentDBstorage_key/owner/state และ stat ใหม่ ห้าม move ถ้า metadataack แล้ว รวม racecases ใน tests CLI ข้อความ“Acknowledgedcontentpreserved”ควรมีหลักฐานรองรับจริง

### F04 — MEDIUM: StudentSection/Course DTO เผย include/exclude IDs ของนักศึกษาคนอื่น

**หลักฐาน:** [courses service](../backend/app/services/courses.py) บรรทัด 17–25 section_dto คืน includedStudentIds/excludedStudentIds ไม่แยก actor; GETcourses/sections ทั้ง list/detail เปิด scopedStudent และใช้ DTO เดียวกัน

**ผลกระทบ:** Student ได้รับ internalstudentUUID และ override/exclusionmembership ที่ไม่จำเป็นต่อ view ของตน อาจมีคนที่ไม่มีสิทธิ์อยู่ใน Section นั้นแล้ว ไม่ได้เผย fullprofile/password/bytes และไม่มี IDORfilebypass

**แนวแก้:** role-specificprojection ให้ Studentowneligibility/Sectionmetadata และ counts ที่จำเป็น; rosterarrays เฉพาะ authorizedstaff เพิ่ม negativeDTOtests ทั้ง nestedCourse และ Sectionroutes

### F05 — MEDIUM: Student ยอมรับ exam revision ใหม่ขณะหน้าจอแสดงกฎเก่า

**หลักฐาน:** [ApiStudentFlow.tsx](../frontend/src/components/student/ApiStudentFlow.tsx) selectedexamstate ตั้งจาก list ตอนเลือก; update บรรทัด 68 อ่าน/access แล้ว setAccess แต่ไม่ setExam; start บรรทัด 114 ส่ง access.examRevision UIrules/instructions/extensions อ่าน selectedexam

**Trigger:** Student เปิด upcomingexam → Teacher แก้ instructions/policy/rules → /accesspoll ได้ newrevision → checkboxaccepted เดิมยัง true → start เมื่อถึงเวลาส่ง newrevision แม้ข้อความที่อ่านเป็น oldrevision Backendvalidate revision ตรงจึงไม่ reject

**แนวแก้:** refreshdisplayDTO พร้อม accessversion และ resetaccepted เมื่อ setuprevision เปลี่ยน ส่ง revision ที่แสดง/ยอมรับจริง กำหนด loading/error เมื่อข้อมูลสองชุดไม่ตรงกัน Testmountcomponentteacher-edit/student-start

### F06 — MEDIUM: Account link reissue และ consume ใช้ lock order ตรงข้าม

**หลักฐาน:** [auth.py](../backend/app/services/auth.py) account_link บรรทัด 113lockuser ก่อน UPDATEoldtokens; complete_password บรรทัด 136locktoken ผ่าน valid_account_token แล้ว lockuser

**Trigger:** Adminreissueactivate/reset กับ Studentconsume พร้อมกัน: txnA ถือ user รอ token, txnB ถือ token รอ user PostgreSQLdeadlockabort หนึ่ง txn; handlerOperationalError503 และ clientretry อาจไม่ได้ตาม token ใหม่

**แนวแก้:** consistentuser→token/familylockorder และ revalidateunderlock; testoppositemutations ไม่เพียง consume สองครั้ง ข้อมูลยัง rollback จึงไม่จัด HIGH

### F07 — MEDIUM: Public password-complete hash รหัสผ่านก่อนตรวจ token ใช้ได้

**หลักฐาน:** auth.complete_password บรรทัด 138 เรียก hash_password ก่อน valid_account_token บรรทัด 139; activation/resetroutes เป็น public และไม่มี per-routebudget/rate-limit Login มี rate-limit แต่ไม่ครอบคลุมสอง route นี้

**ผลกระทบ:** randomvalid-lengthtoken+validpassword ทำ Argon2cost64MiB ก่อน 401 concurrencysemaphore2 ป้องกัน parallelhash ไม่จำกัดแต่รอ syncworkerthreads และทำ authavailability ลดได้ Local-loopbackdeployment ลด exposure แต่ต้องแก้ก่อนเปิด LANpublicentry

**แนวแก้:** cheapvalidtokencheck ก่อน hash แล้ว lock/revalidate ตอน consume, route/IP/tokenbudget และ boundedqueue โดยยังคง one-use/anti-enumeration เพิ่ม invalid-token-no-hashassertion และ bounded-loadtest

### F08 — MEDIUM: READY CHECK ยอมรับ NULL actual size

**หลักฐาน:** [models/submissions.py](../backend/app/models/submissions.py) บรรทัด 35 และ M07frozenDDL `state <> 'ready' OR (size_bytes > 0 AND ...)`; size_bytesnullable และไม่มี ISNOTNULL ใน branch

**ผล:** stateREADY,sizeNULL,sha/path/time ครบให้ SQLexpressionNULL ซึ่ง CHECK ไม่ reject; DB ไม่รับประกัน READYactualsize แม้ plan ต้องมี ขณะนี้ APIcommit_receive ส่ง positivesize จึงไม่พบ normalHTTP สร้าง badrow เป็น defense-in-depthgap ไม่ใช่ SHA ปลอมจาก client

**แนวแก้:** explicitnotnullsize ใน READYbranch/constraint และ snapshotpositivecountchecks ตาม contract เพิ่ม directSQLnegativeNULLcases ด้วย reviewedforwardmigration ไม่แก้ appliedrevision ใน audit

### F09 — MEDIUM: Full graph polling และ global offering locks ทำงานสอบ serialize/ขยาย N+1

**หลักฐาน:** [ApiAppProvider.tsx](../frontend/src/context/ApiAppProvider.tsx) loaddefaultfull=true และ timer บรรทัด 150 เรียก load ไม่ใช้ full=false ดึง allpagesusers/audits/courses/catalogs/rooms/ทุก exam ทุก 5s; backendauthorized_ids/exam_dto/root_dto ทำ per-rowqueries; roster.lock_offerings และ workerlockallofferings ทุก version

**ผลกระทบ:** auditlogs โตขึ้นทำ poll หนักต่อเนื่อง แม้ผู้ใช้เปิดหน้าเดียว; concurrentrooms/Courses แย่ง locks ที่ไม่เกี่ยวข้องและหนุน F02 Initialfullgraph บาง endpoint ล้มทำหน้าอื่นโหลดไม่ได้ ไม่มี recordbounds/conditionalfetch ตาม view

**แนวแก้:** targetedpoll/changedreadmodels/pagination และ batchedqueries, lock เฉพาะ affectedofferings พร้อม deterministicorder เพิ่ม requestbudget/querycount และ large-rosterbenchmark ถือสำคัญกว่า optimization เล็กเพราะใช้ทั้งห้อง

### F10 — MEDIUM: Audit role filter และ CSV export ไม่ตรง UI

**หลักฐาน:** [apiAdapters.ts](../frontend/src/services/apiAdapters.ts) บรรทัด 100 ส่ง lowercaseadmin/teacher หรือระบบ; [SystemAuditLog.tsx](../frontend/src/components/admin/SystemAuditLog.tsx) บรรทัด 31filter เทียบ Teacher/Admin/System และบรรทัด 43export ส่งเฉพาะ q BackendAuditFiltersq ค้น action/target_type ไม่ตรง UIactor/target/ip และไม่มี actorRolefilter

**ผล:** เลือก role ที่มี events จริงได้ table ว่าง; exportedCSV ไม่ได้ใช้ rolefilter และ searchsemantics ชุดเดียวกับ table อาจได้ row เกิน/ขาดเมื่อใช้ search ทำ review เหตุการณ์ผิด แม้ scope ยัง Admin

**แนวแก้:** canonicalroleDTO/displayadapter และ sharedtypedfilters ใช้ทั้ง list/export ระบุ CSVboundedset เพิ่ม actualrole/filter/exportparitytests

### F11 — MEDIUM: New assignment active checks ไม่ล็อกกับ account/status mutation ทุกเส้นทาง

**หลักฐาน:** sectionteacher validation ใน[courses.py](../backend/app/services/courses.py) อ่าน users ด้วย get ไม่ lock; roster.inclusion/move อ่าน activeStudent ไม่ lock ส่วน[users.py](../backend/app/services/users.py) statuslockuser และ adminrows แต่ไม่ shareofferinglockprotocol Bulk group assignment มี versioned user update เป็น guard เพิ่ม; finding นี้ยืนยันชัดกับ Section teacher และ roster override

**Trigger:** writer อ่าน Teacher/Studentactive → Adminsuspendcommit → writer เพิ่ม newassignment แล้ว commit แม้ข้อกำหนดห้าม newassignmentinactive ภายหลัง auth ยังปฏิเสธ inactiveaccount จึงไม่เป็น rolebypass

**แนวแก้:** lockaccount/parentstatus ตาม order เดียวกับ statuswrite หรือ validateundertransactionprotocol ที่ serialize ทั้งสองฝั่ง เพิ่ม barriercontrolledstatus-vs-assignmenttests; historicalinactive อ่านได้ยังคงเดิม

### F12 — MEDIUM: จำกัดต่อไฟล์ แต่ไม่มี aggregate storage/archive budget

**หลักฐาน:** fileintent/receive บังคับ max500MiB ต่อ file แต่ requiredcount เป็น minimum ไม่มี maximumfiles/bytes ต่อ version/student/exam หรือ free-spaceadmission; [submissions API](../backend/app/api/submissions.py) บรรทัด 36–37 สร้าง ZIP เต็มใน TemporaryFile ก่อน StreamingResponse; ApiClientdownload ใช้ response.blob()

**ผล:** owningactiveStudent ส่งหลายไฟล์ถูก policy แต่กิน shareddisk จนคนอื่นส่งไม่ได้; archive ต้องใช้ temporarydisk เพิ่มและ browserRAM ตามขนาด ZIP ไม่ใช่ boundedstreamend-to-end แม้ server ไม่โหลดทุก bytes เข้าหน่วยความจำ

**แนวแก้:** domainquota/admissionstoragebudget/reserveheadroom, boundarchive selection/size/temporarylocation หรือ streamZIP, browserdownloadstrategy สำหรับ largefiles เพิ่ม capacity/failuretests ไม่ลด perfilepolicy เงียบ ๆ

### F13 — LOW: Backend build ไม่ reproducible จาก dependency ranges/tag อย่างเดียว

pyproject.toml มี ranges ไม่มี resolvedlock; Docker ใช้ python:3.12-slim/postgres:17 โดยไม่ pin digest Freshbuild เปลี่ยน FastAPI behavior ได้และ F01 แสดงว่าความต่าง dependency สำคัญ แนวแก้ล็อก resolveddependencies/imageversions พร้อม scheduledupdates/SBOM ไม่ได้อ้างว่าตรวจพบ CVE

### F14 — LOW: APP_DB_PASSWORD ใหม่ไม่ rotate role ที่มีอยู่

database_roles.provision สร้าง role เมื่อไม่ exists เท่านั้น ไม่มี ALTERROLE เมื่อ exists เปลี่ยน .env APP_DB_PASSWORD/DATABASE_URL แล้ว migrate ยังพิมพ์ ready แต่ appauthenticate ไม่ผ่าน การไม่หมุน password เองอาจตั้งใจให้ manualrotation แต่ README ยังไม่กำหนด procedure ชัด ควรมี explicitrotationcommand/validation/documentation ไม่ทำขณะ audit

### F15 — LOW: Root AGENTS.md บอก backend health-only/empty metadata ทั้งที่ MVP เปลี่ยนแล้ว

AGENTS.md บรรทัด 24/28 ยังระบุ health-only/fullauth/domain/uploadsdeferred ขัดกับ 45tables/103routes และ docs/backend-implementation.md อาจทำผู้พัฒนาถัดไปหลีกเลี่ยง features ที่ implemented แล้ว ควรปรับ currentarchitecture และ deferredlist หลังอนุมัติ ไม่ถือว่าผู้ใช้สั่ง MVPimplementation ขัด AGENTS เพราะ explicituserauthorization มาก่อน

## 21. Recommended fix order

1. **F01:** commit ก่อน successreceipt รวม auth/FINAL/audit พร้อม ASGIcommit-failuretests
2. **F02:** streamauthsession/pool/event-looplifecycles แล้วทดสอบ 30–60concurrentclients พร้อม deadlineworker
3. **F03:** quarantineunder-lockrevalidation ก่อนใช้งาน maintenance พร้อม uploads
4. **F04/F05:** least-privilegeStudentDTO และ revision ที่แสดง/รับทราบต้องชุดเดียวกัน
5. **F06/F07:** consistentaccount-tokenlockorder และ invalidtokenhashbudget
6. **F08/F11:** DBnullguard/statusassignmentserialization ผ่าน forwardmigration และ racesuite
7. **F09/F12:** targetedpoll/locks/queries, perattemptstoragebudget และ largearchivehandling
8. **F10:** auditfilter/exportparity เพื่อให้การสืบค้นเชื่อถือได้
9. **F13–F15:** lockedbuild/rotationprocedure/currentAGENTSdocs

ก่อน fix merge ควรใช้ isolatedPG17 ทั้ง backendintegration/freshupgrade/constraints,frontend17scripts/lint/mock+APIbuild และ controlledbrowserthree-roleflow ตาม AGENTS ไม่รัน destructivetests กับ DBworkspace ที่มีข้อมูลผู้ใช้ ไม่มี finding ใดถูก autofix ในงานนี้

## 22. Deferred/future items (INFO)

ไม่คิดเป็น missingMVPbugs: GoogleOIDC/externalidentitylinking, ICITtrustedmapping, Agentcredential/certificate/heartbeat/sessionlease, biometricprovider/retention/verification, networkpolicy จริง, localexamserver/offlinesynchronization/conflicts, backup/restoreworkflow, WORM/ObjectLock/HMAC/blockchain และ codejudge

MVPoffline เป็น examconfiguration ไม่ใช่ air-gappedoperation policyrequireAgent/face ไม่ถูก enforce จริง runtimeunknown/identityunavailable ถูกต้อง ไม่เพิ่ม endpoint ที่ให้ success ปลอมเพื่อให้หน้า UI ดูครบ

ต้อง designtrustedintegrationcontracts ก่อน schema/APIPhase2–3 และรักษา NEVEREXECUTE ใน storage แม้วันหนึ่งมี judge จะเป็น isolatedsubsystem คนละ service Filehash ไม่เปลี่ยนเป็น biometric/deviceproof หรือ digital-signature เพียงเพราะเพิ่ม Agent

Operationalhardening ที่ยังไม่มีหลักฐาน: process/power-lossdurability, DB+filestoreconsistentrestore, workerhealth/SLO, timezone/clockmonitoring, proxyIP/rate-limitpolicy, TLS/CSP/dependencysecurityupdates สิ่งเหล่านี้ควรมี releasecriteria เฉพาะ ไม่ถือว่า containerhealthy พิสูจน์แล้ว

## 23. Questions/ambiguities

คำถามสำหรับ review ถัดไป ไม่มีการหยุด audit หรือขอ permission แก้โดยปริยาย:

1. UI Student จำเป็นต้องเห็น Sectionteacher/cohortaggregate ใดบ้าง เพื่อกำหนด minimalDTO หลังตัด overrideIDs?
2. Maintenance จะรันตาม schedule หรือ manual และจะอนุญาต age ต่ำกว่า 24h ขณะสอบหรือไม่? ต้องคง absolute“nevermoveacknowledged”ทุก configuration
3. เป้าหมาย concurrentstudents/exams และ bandwidth เท่าไร เพื่อกำหนด pool/admission/storagequota/loadacceptance?
4. FilenamePattern เป็นเพียง displayhint หรือ validationpattern ที่ต้องบังคับ? backend บังคับ safeautomatictemplate/rename แต่ไม่ validatefilename_pattern เป็น regex ตามชื่อ field ต้องไม่ใช้ eval/arbitraryformatter
5. AuditCSV ต้องตรง filteredrows ทุก field และ role หรือเป็น rawexport คนละ operation? UI ปัจจุบันทำให้เข้าใจว่า export ตาม filter
6. IntegrityUI ต้องแสดง latestrecheckoutcome หรือแค่ digestreceipt? ไม่ควรแสดง“valid”จากการมี FINAL เมื่อมี mismatchevent แล้ว
7. APP_DB_PASSWORDrotation จะเป็น explicitCLI หรือ operationsprocedure? Applicationrole ไม่ควรใช้ migrationcredentials แทนแก้ loginfailure
8. Foundationsection ใน AGENTS ควรสะท้อน Phase1A–1Gcomplete และ defer เฉพาะ Phase2–3 ใช่หรือไม่?
9. “Durable”ใน releasecriteria รวม powerloss/fsyncdirectory+DB/storagerestore หรือเฉพาะ processrestart? ยังไม่มี contract/test เพียงพอให้รับรองส่วนแรก

**ขอบเขตการส่งมอบ:** เพิ่ม docs/mvp-audit.md เท่านั้น ไม่แก้โค้ด ไม่สร้าง migration ไม่ alterDB ไม่ commit/push ไม่เปลี่ยน remote และไม่แตะ workflow-architect

