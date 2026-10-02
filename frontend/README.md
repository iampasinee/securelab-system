# SecureLab

SecureLab เป็น frontend prototype ภาษาไทยสำหรับการจัดสอบในห้องปฏิบัติการ การจัดการผู้ใช้งาน/รายวิชา และการส่งไฟล์ข้อสอบ ใช้ React 19, TypeScript, Vite 6 และ Tailwind CSS 4 ระบบ Login, ICIT, biometric verification, exam monitoring, file transfer และ integrity checking เป็นการจำลองใน browser และยังไม่มี production backend

## เริ่มใช้งาน

ติดตั้ง Node.js และ npm แล้วรัน:

```sh
npm install
npm run dev
```

เปิด <http://localhost:3000> แอปเริ่มที่หน้า Login เสมอ จากนั้นเลือกบัญชีจำลองสำหรับ Student, Teacher หรือ Admin ใน PowerShell ใช้ `npm.cmd` แทน `npm` หาก execution policy ปิดกั้น `npm.ps1`

ไม่ต้องใช้ API key ในการรันปัจจุบัน ห้ามใส่ secret ใน client-side environment variables หรือ commit ไฟล์ `.env` ที่มีข้อมูลจริง

## คำสั่งพัฒนา

| คำสั่ง | การทำงาน |
| --- | --- |
| `npm install` | ติดตั้ง dependencies จาก lockfile |
| `npm run dev` | เปิด Vite ที่ port 3000 และ LAN |
| `npm run lint` | ตรวจ TypeScript ด้วย `tsc --noEmit` |
| `npm run test:auth` | ทดสอบโดเมนอีเมล การแยกบทบาท รหัสผ่านจำลอง การลงทะเบียนใบหน้า และ auth migration |
| `npm run test:academic` | ทดสอบ academic model, migration, Class Group, Teacher affiliation และ validation |
| `npm run test:courses` | ทดสอบ Course/Section, teacher assignment, cohort collision และ portal eligibility |
| `npm run test:rooms` | ทดสอบชั้น ห้อง ผังที่นั่ง อุปกรณ์ การย้ายข้อมูล และการป้องกันข้อมูลที่ถูกอ้างอิง |
| `npm run test:exam-wizard` | ทดสอบการสร้าง/แก้ไขการสอบ ร่างการสอบ สิทธิ์ผู้สอน และการตรวจสอบเวลา/ห้องสอบ |
| `npm run test:exam-management` | ทดสอบการค้นหาและตัวกรองรายการสอบของอาจารย์ |
| `npm run test:demo-time` | ทดสอบเวลาเดโม, preset, guard และสถานะข้ามหน้า |
| `npm run test:student-demo` | ทดสอบการเข้าสอบและส่งซ้ำในโหมดทดสอบโดยไม่แก้ submission หลัก |
| `npm run test:exam-status` | ทดสอบสถานะสอบจากวันเวลาและกฎการเข้าสอบ |
| `npm run test:monitoring` | ทดสอบสิทธิ์และข้อมูลปฏิทิน/ภาพรวมการติดตามสอบ |
| `npm run build` | สร้าง production bundle ใน `dist/` |
| `npm run preview` | เปิด production bundle ในเครื่อง |
| `git diff --check` | ตรวจ whitespace errors |

## โครงสร้างโครงการ

- `src/main.tsx`, `src/App.tsx`: startup, login-first และ role-based flow
- `src/components/student/`: identity, exam rules, progress stepper, staged upload และ submission
- `src/components/teacher/`: courses, exams, monitoring, integrity และ reopening
- `src/components/admin/`: dashboard, users, academic structure, Course/Section, rooms, biometric, security, audit และ profile
- `src/components/common/`, `src/components/simulation/`: shared UI และเครื่องมือจำลอง
- `src/components/auth/`: Auth landing, mock Google account selector และ Registration 5 ขั้น
- `src/context/AppContext.tsx`: state, CRUD, persistence และ forward migration
- `src/types.ts`, `src/types/`: domain models
- `src/data/`: mock/seed data
- `src/services/academicState.ts`: academic relationships, migration, selectors และ validation
- `src/services/authState.ts`, `src/types/auth.ts`: กฎโดเมนอีเมล บัญชี mock สถานะใบหน้า และ auth persistence
- `src/services/academicStructureWizard.ts`: atomic-like academic structure wizard transaction
- `src/services/courseState.ts`: Course/Section migration, validation และ portal projections
- `src/services/roomState.ts`, `src/types/rooms.ts`: Floor/Physical Room/Exam Room, ผังที่นั่ง, อุปกรณ์ และ room migration
- `src/services/examWizard.ts`: state ของ Wizard, validation, policy mock และร่างการสอบ
- `src/services/teacherExamManagement.ts`: ตัวกรองรายการสอบของอาจารย์
- `src/services/teacherMonitoring.ts`: สิทธิ์ผู้สอน การสรุปตารางสอบ และตัวกรองติดตามสอบ
- `src/services/demoTime.ts`, `src/utils/useExamClock.ts`: เวลาเดโมชั่วคราวและนาฬิกากลางของหน้าเว็บ
- `src/services/stagedUploadStorage.ts`: IndexedDB staged-file persistence
- `src/utils/academicYear.ts`: current academic year, admission code และ derived year level

## ภาษาและ Navigation

UI ปัจจุบันบังคับภาษาไทยทั้งระบบ แต่ Context ยังเก็บ language API เพื่อ compatibility Admin ใช้ hash routes เช่น `#/admin/users/students`, `#/admin/faculties-and-groups` และ `#/admin/courses` การ refresh ยังคงเริ่มที่ Login แล้วเปิด Admin route จาก hash หลังเข้าสู่ระบบ

Sidebar ผู้ดูแลระบบไม่มีหน้าจัดการบทบาทแบบกำหนดเอง บทบาท `student`, `teacher` และ `admin` เป็นบทบาทคงที่ และ Student/Teacher/Admin flows ยังคงแยกกัน

## Authentication และ Registration Mockup

หน้าเริ่มต้นมี `เข้าสู่ระบบ` และ `ลงทะเบียน` โดยใช้ตัวเลือกบัญชี Google แบบจำลอง ยังไม่มี Google OAuth หรือ backend session จริง โดเมนที่รองรับคือ:

- นักศึกษา: `@email.kmutnb.ac.th` และชื่อบัญชีต้องเป็น `s` ตามด้วยรหัสนักศึกษา เช่น `s6701011500167@email.kmutnb.ac.th`
- อาจารย์/ผู้ดูแลระบบ: `@itm.kmutnb.ac.th`

โดเมน `@itm.kmutnb.ac.th` ระบุเพียงว่าเป็นบัญชีบุคลากร ระบบต้องแยก Teacher/Admin จาก mock account record อีกครั้ง และบัญชี Admin ต้องถูก provision ไว้ล่วงหน้า ไม่มี public self-registration สำหรับ Admin

Student Registration มี 5 ขั้น: บัญชี Google จำลอง → ตั้งรหัสผ่าน → ข้อมูลนักศึกษา → ใบหน้า → ตรวจสอบและยืนยัน Teacher ใช้ขั้นตอนเดียวกัน โดยขั้นข้อมูลเป็นข้อมูลอาจารย์ รหัสผ่านต้องยาวอย่างน้อย 8 ตัว มีตัวอักษรอังกฤษและตัวเลข ยืนยันให้ตรงกัน และห้ามมีช่องว่างต้น/ท้าย ขั้นใบหน้าเป็นข้อบังคับ: กดเริ่มสแกนแล้วระบบจำลองภารกิจ 6 ท่าทางทีละขั้น เมื่อครบจะได้ `verified_mock` และไปหน้า Review ได้ทันที ไม่มีรายการตรวจสอบชุดที่สอง เก็บเฉพาะ `FaceEnrollmentStatus` แบบ mock ไม่เปิดกล้องจริง ไม่เก็บภาพ และไม่ทำ biometric matching เมื่อลงทะเบียนสำเร็จ ระบบจะกลับไป Login โดยไม่สร้าง production session

หน้า Login จำลองตรวจอีเมลและรหัสผ่านจากข้อมูล auth mock เดียวกัน บัญชีเดโมที่ลงทะเบียนก่อนเพิ่มขั้นรหัสผ่านใช้ `SecureLab123` เพื่อความเข้ากันได้เท่านั้น การเปลี่ยนบัญชีในขั้นลงทะเบียนจะล้างรหัสผ่านชั่วคราวของบัญชีก่อนหน้า และหน้า Review แสดงเพียงสถานะว่าตั้งรหัสผ่านแล้ว

สำหรับนักศึกษา `parseStudentUniversityEmail()` จะตัด `s` เพื่อสร้าง Student ID และใช้สองหลักแรกเป็น `admissionYear` เช่น `67 → 2567` ช่องรหัสนักศึกษา ปีที่เข้าศึกษา และชั้นปีเป็น read-only ส่วน Major และ Class Group ยังเลือกจากข้อมูลวิชาการจริง Class Group แสดงเฉพาะกลุ่ม active ที่ตรงกับ `majorId + admissionYear` และจะถูกล้างเมื่อเปลี่ยน Major

## การจัดการผู้ใช้งาน

เมนูจัดการผู้ใช้งานมีหน้าภาพรวม นักศึกษา อาจารย์ และผู้ดูแลระบบ พร้อม search, filters, sorting, pagination, status actions และ CRUD ตามข้อจำกัดเดิม

Workflow “เพิ่มผู้ใช้งาน” เริ่มจากเลือกประเภทบัญชี เมื่อเข้าฟอร์มนักศึกษา อาจารย์ หรือผู้ดูแลระบบ ปุ่ม `ย้อนกลับ` จะกลับไปหน้าประเภทบัญชีโดยไม่ปิด modal และล้าง draft ของบทบาทนั้น ปุ่ม `X` ปิด workflow ทั้งหมด ฟอร์มนักศึกษาใช้ validation และ academic selectors ชุดเดียวกับ Student Management

Teacher affiliation ใช้ stable `facultyId` และ `departmentId` ตามโครงสร้างวิชาการเดียวกับนักศึกษา โดย selector cascade เป็น `คณะ → ภาควิชา` ฟิลด์ข้อความเดิมคงไว้เฉพาะ fallback ของ persisted legacy data รายวิชา/ตอนเรียนที่อาจารย์สอนยังมาจาก Primary Teacher และ Co-Teacher assignment ไม่ได้มาจาก profile affiliation

## โครงสร้างวิชาการ

Canonical hierarchy คือ:

```text
คณะ (Faculty)
└── ภาควิชา (Department)
    └── สาขาวิชา (Major)
```

Student academic identity ใช้:

```ts
{
  majorId: string;
  admissionYear: number;
  classGroupId?: string;
}
```

คณะและภาควิชาของนักศึกษาถูก derive จาก `majorId` ส่วน `classGroupId` เป็นกลุ่มประจำแบบ lightweight เช่น RA/RB ไม่ใช่ parent ระดับที่สี่ของ hierarchy และนักศึกษามีกลุ่มประจำได้ไม่เกินหนึ่งกลุ่ม

หน้า `จัดการคณะและกลุ่มเรียน` มีสี่แท็บ:

```text
[ คณะ ] [ ภาควิชา ] [ สาขาวิชา ] [ กลุ่มเรียน ]
```

Class Group ผูกกับ `majorId + admissionYear` และเก็บ sequence ภายใน กลุ่มใหม่สร้างรหัสอัตโนมัติ เช่น `INET-DE-RA`, `INET-DE-RB`, `INET-DE-RC` ลำดับที่เคยใช้แล้วจะไม่ถูกนำกลับมาใช้แม้กลุ่มถูกปิดใช้งานหรือลบอย่างปลอดภัย การลบถูกป้องกันเมื่อยังมีนักศึกษาหรือ Section อ้างอิง

ปุ่ม `เพิ่มโครงสร้างการศึกษา` เปิด Wizard 5 ขั้น:

```text
คณะ → ภาควิชา → สาขาวิชา → ปีที่เข้าศึกษาและกลุ่มเรียน → ตรวจสอบและบันทึก
```

แต่ละขั้นเลือกข้อมูลเดิมหรือสร้างใหม่ได้ Wizard แสดง preview ของรหัสกลุ่ม ตรวจข้อมูลทั้งหมดบน state ชั่วคราว และ commit ครั้งเดียวเมื่อยืนยัน รายการที่ไม่ผ่าน validation จะไม่ถูกบันทึกบางส่วน

## ปีที่เข้าศึกษาและชั้นปี

`admissionYear` เก็บเป็นปีพุทธศักราชเต็ม เช่น `2567` และแสดงเป็น `ปีที่เข้าศึกษา 67` ใน UI ห้ามใช้คำว่า `รุ่น` ชั้นปีไม่ใช่ master data และคำนวณจาก:

```text
yearLevel = currentAcademicYear - admissionYear + 1
```

`academicSettings.currentAcademicYear` ใน `src/utils/academicYear.ts` เป็นแหล่งปีการศึกษากลาง ห้ามคำนวณจากปีปฏิทินของอุปกรณ์ Student ID ใช้แนะนำปีที่เข้าศึกษาในฟอร์ม Admin ได้ แต่ `admissionYear` ที่บันทึกแยกต่างหากยังเป็น canonical source สำหรับ Student Registration ระบบอนุมาน Student ID และ `admissionYear` จากอีเมลมหาวิทยาลัยครั้งเดียวในขั้นลงทะเบียน แล้วบันทึกลง canonical fields เดิม

Student Management มีโหมด `นักศึกษาทั้งหมด` สำหรับค้นหาเร็ว และ `แยกตามปีที่เข้าศึกษา` สำหรับกรองคณะ ภาควิชา สาขาวิชา ปีที่เข้าศึกษา ชั้นปี และกลุ่มเรียน ตารางแสดงกลุ่มที่กำหนดหรือ `ยังไม่กำหนด` และ CSV ส่งออกรายการทั้งหมดที่ผ่านตัวกรอง

## Course และ Section

Course ผูกกับคณะและภาควิชาด้วย stable IDs ส่วน Section ระบุปีการศึกษา ภาคเรียน หมายเลขตอนเรียน Primary Teacher, Co-Teachers และ cohorts

```ts
type SectionCohort = {
  majorId: string;
  admissionYear: number;
  classGroupIds?: string[];
};
```

`classGroupIds` ว่างหมายถึงทั้ง cohort สาขาวิชา+ปีที่เข้าศึกษา และสามารถเลือก RA, RB หรือ RA+RB ใน Section เดียวได้ Class Group กับ Section เป็นคนละแนวคิด ระบบตรวจ overlap/collision ของนักศึกษาระหว่าง Section ในรายวิชาและภาคการศึกษาเดียวกัน Teacher Portal และ Student eligibility ถูก project จาก Section assignment โดยใช้ stable IDs

หน้า Teacher `จัดการรายวิชา & กลุ่มเรียน` แสดงรายวิชาที่ได้รับมอบหมายก่อน จากนั้นเลือก Section เพื่อดูรายชื่อและค้นหานักศึกษา อาจารย์เพิ่มนักศึกษาที่มีอยู่แล้วหรือย้ายระหว่าง Section ของรายวิชา/ภาคการศึกษาเดียวกันได้เมื่อได้รับมอบหมายทั้งต้นทางและปลายทาง โดยไม่แก้ Student master data การเป็นสมาชิกใช้ cohort เป็นหลัก และเก็บเฉพาะ `includedStudentIds` / `excludedStudentIds` รายคนบน Section เป็นข้อยกเว้น ข้อมูลนี้อยู่ใน `securelab_courses` เดิม; Section เก่าจะมีรายการข้อยกเว้นว่างหลัง migration

การสอบที่ยังไม่เริ่มอ่านรายชื่อ Section ปัจจุบัน ส่วนการสอบที่กำลังสอบหรือเสร็จสิ้นจะบันทึก `eligibleStudentIds` ก่อนการเปลี่ยนรายชื่อครั้งแรก เพื่อไม่ให้การย้ายภายหลังเปลี่ยนสิทธิ์สอบย้อนหลัง ระบบยังเป็น frontend-only และไม่ได้ให้ Teacher สร้างบัญชีนักศึกษา

ข้อจำกัดของ ExamSession เดิม: การอ้างอิง Section ยังใช้ `courseId + sectionNo` หากรายวิชาเดียวกันมี Section หมายเลขซ้ำต่างภาคการศึกษาและมีการสอบอ้างอิง ระบบจะบล็อกการเพิ่ม/ย้ายรายคนใน Section เหล่านั้น เพื่อเลี่ยงการตรึงรายชื่อสอบผิดรอบจนกว่าจะมี Section ID ใน ExamSession

## การจัดการสอบของอาจารย์

หน้า `จัดการสอบ` แยก `การสอบทั้งหมด` กับ `ร่างการสอบ` โดยนับรายการตามสิทธิ์ Course/Section ของอาจารย์ แท็บการสอบทั้งหมดค้นหาชื่อสอบ รหัส/ชื่อวิชา Section และห้องสอบได้ พร้อมกรองสถานะ `กำลังจะถึง` / `กำลังสอบ` / `เสร็จสิ้น` และรูปแบบ `ออนไลน์` / `ออฟไลน์` ตัวกรองนี้ไม่กระทบแท็บร่าง ซึ่งมีการค้นหาแยกต่างหาก

ปุ่ม `สร้างการสอบ` เปิด Wizard 6 ขั้น: ข้อมูลการสอบ → ผู้เข้าสอบ → วันเวลาและห้องสอบ → รูปแบบการสอบ → ข้อกำหนดและนโยบาย → ตรวจสอบและบันทึก รายวิชา/Section ต้องอยู่ในงานสอนที่ได้รับมอบหมาย รายชื่อผู้เข้าสอบมาจาก Section cohort และการสร้างจริงตรวจเวลา ห้องสอบที่เปิดใช้งาน การชนกันของตาราง และความจุห้อง

ร่างการสอบเก็บแยกจาก `ExamSession` ภายใต้ `securelab_teacher_exam_drafts_v1` จนกว่าจะยืนยันสร้าง การแก้ไขการสอบที่มีอยู่คง ID เดิม ตัวเลือกนโยบายออนไลน์/ออฟไลน์เป็นเพียงการตั้งค่าใน frontend; ยังไม่มีการบังคับใช้ผ่าน Agent, เครือข่าย หรือการตรวจใบหน้าจริง

## ติดตามการสอบของอาจารย์

หน้า `ติดตามการสอบ` ใช้การสอบที่อาจารย์มีสิทธิ์จาก Course/Section เดิม ภาพรวมรายวันแสดงตัวนับตามสถานะ ค้นหาและกรองรายการได้ และเปิดรายละเอียดการสอบเดิมเพื่อดูความคืบหน้า ส่วนปฏิทินเต็มหน้าและตัวเลือกวันที่แบบย่อแสดงเฉพาะวันที่กับจำนวนรอบสอบ (`N รอบ`) ไม่ใช้จุดสีหรือสรุปสถานะในช่องวัน

ตัวเลือกวันที่และปฏิทินใช้วันที่ที่เลือกร่วมกัน การเลือกวันจะกลับสู่ภาพรวมรายวันและไม่เปิดรายละเอียดการสอบอัตโนมัติ สถานะการสอบยังอยู่ในภาพรวมรายวันและหน้ารายละเอียด

## เวลาเดโมสำหรับทดสอบหน้าเว็บ

หน้า Student ไม่แสดงแผงหรือปุ่มเลือกเวลาเดโมแล้ว แต่ `demoTime.ts` และ `useExamClock.ts` ยังรองรับการจำลองเวลาภายในสำหรับการทดสอบ frontend โดยไม่แก้ตารางสอบหรือข้อมูลโดเมน โหมดทดสอบการส่งซ้ำยังทำงานได้แม้เวลาสอบจริงผ่านไป หน้า Teacher/Admin ยังคงใช้สถานะสอบจากนาฬิกากลางตามเดิม

สถานะเวลาเดโมอยู่ในหน่วยความจำของแท็บเท่านั้น รีเฟรชแล้วกลับเป็นเวลาจริง ไม่เขียนลง `ExamSession`, `localStorage` หรือข้อมูลโดเมนอื่น ความสามารถภายในนี้ปิดได้ด้วย `DEMO_TIME_ENABLED` ใน `src/services/demoTime.ts` การแก้ไขตารางสอบหรือเปิดรับส่งใหม่ซึ่งบันทึกข้อมูลจริงยังตรวจตามเวลาจริง ไม่ใช่เวลาเดโม นี่เป็นเพียงเครื่องมือทดสอบ frontend ไม่ใช่การบังคับเวลาใน production; ระบบจริงต้องใช้เวลาอ้างอิงจาก server และตรวจช่วงสอบใน backend

## ห้องสอบและเครื่องคอมพิวเตอร์

หน้า Admin มีสามแท็บ: `ห้องสอบ`, `ผังที่นั่งและเครื่อง` และ `เครื่องคอมพิวเตอร์` ใช้โครงสร้าง `Floor → PhysicalRoom → ExamRoom → RoomSeat → ComputerDevice` โดยไม่จัดการอาคาร ห้องจริงถูกสร้างใต้ชั้นก่อน แล้วจึงเลือกเปิดเป็นห้องสอบได้

ข้อมูลหลักอยู่ใน `src/types/rooms.ts` และกฎตรวจสอบใน `src/services/roomState.ts` ห้องจริงอ้างอิง `floorId`, ห้องสอบอ้างอิง `physicalRoomId`, ที่นั่งอ้างอิง `roomId` และเครื่องอ้างอิง `seatId` ด้วย stable ID ผู้ดูแลกรอกเฉพาะรหัสย่อย เช่น `08` หรือ `01A` แล้วระบบสร้าง `B4-08` หรือ `B4-01A` จากชั้นให้อัตโนมัติ รหัสถูก trim/แปลงเป็นตัวพิมพ์ใหญ่และห้ามซ้ำภายในชั้นเดียวกัน ห้องจริงหนึ่งห้องเปิดเป็นห้องสอบได้ครั้งเดียว เครื่องเก็บหมายเลขเครื่อง, Serial Number, IPv4 และ MAC Address; ตรวจข้อมูลซ้ำทั้งระบบและอนุญาตหนึ่งเครื่องต่อที่นั่ง

แท็บ `ห้องสอบ` เรียงเป็น Summary cards → Tabs → Filter bar → Room table โดยไม่มี Floor overview cards หรือแผงชั้นที่เลือก ตารางแสดง Physical Room ทุกห้อง ทั้งที่เปิดและยังไม่เปิดเป็นห้องสอบ พร้อมค้นหารหัสห้อง ตัวกรองชั้น/สถานะห้อง/สถานะการเปิดสอบ ปุ่มเปิดเป็นห้องสอบ และรายละเอียดแยกข้อมูล Physical Room กับ Exam Room การเพิ่มชั้น เพิ่มห้องในชั้น และเพิ่มห้องสอบยังเปิดผ่านปุ่มระดับหน้าและ modal ได้ ห้องที่ยังไม่เปิดเป็นห้องสอบจะยังสร้างผังหรือกำหนดเครื่องไม่ได้

ผังสร้างรหัส A01, A02 … AA01 พร้อม ID คงที่ ขยายผังจะคง ID เดิม ลดผังจะถูกบล็อกหากที่นั่งที่ถูกลบมีเครื่องหรือประวัติการสอบอ้างอิง ใช้ 0 × 0 เพื่อล้างผังที่ไม่มีการอ้างอิงได้

เก็บข้อมูลรุ่น 2 ใน `securelab_room_state` โดย migrate รุ่น 1 และ `securelab_rooms` เดิมไปข้างหน้า สำหรับห้องสอบเดิม ระบบสร้างหรือใช้ Physical Room ร่วมกันจากคู่ชั้น+รหัสห้อง พร้อมคง Exam Room ID, Seat ID, Computer ID และการอ้างอิงประวัติสอบเดิม หน้า Teacher/Student อ่านข้อมูลที่ project จากแหล่งใหม่โดยเก็บชื่อที่นั่งเดิมสำหรับข้อสอบที่มีอยู่

ข้อมูลเก่าที่ไม่มี Serial Number จะแสดง `ยังไม่ระบุ` ให้ผู้ดูแลกรอกเมื่อแก้ไข ไม่สร้าง Serial ขึ้นเอง ชั้นที่แปลงไม่ได้จะแสดง `ยังไม่กำหนดชั้น` และไม่พร้อมสำหรับการจัดสอบใหม่ การย้าย/ลบเครื่องที่มีประวัติการจัดสอบถูกบล็อก ข้อมูลนี้เตรียมไว้สำหรับ Device Binding แต่ยังไม่มีการตรวจฮาร์ดแวร์จริง

## การส่งไฟล์ข้อสอบ

หน้า Student Exam File Submission ใช้ layout สองคอลัมน์บน desktop: กติกาด้านซ้าย และ Drop Zone ตามด้วยไฟล์ที่เตรียมส่งด้านขวา ต่ำกว่า 1024px จะเรียงแนวตั้ง

ไฟล์ที่เลือกถูกเก็บใน IndexedDB ทันที แต่ละไฟล์มี `uploadId` และ `uploadSequence` คงที่ ชื่อส่งเริ่มต้นคือ:

```text
{studentId}_{firstName}_{lastName}_{uploadSequence}.{extension}
6410123457_somying_rakrian_1.py
```

Rename เปลี่ยนเฉพาะ `submissionName` โดยคง `originalName`, extension, sequence, blob, progress และ upload identity การตรวจไฟล์ใช้ `File.size` เป็น bytes และปฏิเสธเฉพาะไฟล์ 0 bytes จึงรองรับไฟล์ต่ำกว่า 1 KB

ไฟล์ใน attempt ปัจจุบันเปิดดูตัวอย่างได้จากรายการไฟล์ที่เตรียมส่งและหน้าก่อนยืนยันการส่ง: ซอร์สโค้ด/ข้อความแสดงเป็นข้อความอ่านอย่างเดียว (สูงสุด 1 MB), PNG/JPG/WebP/GIF แสดงเป็นภาพพร้อมปุ่มซูม 25–300%, ZIP แสดงโครงสร้างชื่อไฟล์/โฟลเดอร์อย่างเดียว ส่วน SVG, RAR, 7Z และไฟล์ไบนารีอื่นแสดงข้อมูลไฟล์เท่านั้น การดูตัวอย่างทำงานในเบราว์เซอร์และไม่เปลี่ยนกฎอนุญาตชนิดไฟล์ของข้อสอบหรือแก้ไขเนื้อหาไฟล์

### Uploaded File Preview & Execution Safety

SecureLab ถือว่าไฟล์ที่ผู้ใช้อัปโหลด **ทุกไฟล์เป็นข้อมูลที่ไม่น่าเชื่อถือ (untrusted data)** ไม่ว่านามสกุล MIME type ชื่อไฟล์ บัญชีนักศึกษา หรือข้อกำหนดการสอบจะเป็นอย่างไร การดูตัวอย่างเป็นเพียงการตรวจดูแบบอ่านอย่างเดียว ไม่ใช่สภาพแวดล้อมเรียกใช้โค้ด:

```text
Uploaded File → Read as bytes/text → Display read-only preview → NEVER EXECUTE

SecureLab Upload / Preview → NEVER EXECUTE
SecureLab Storage          → NEVER EXECUTE
Future Code Judge         → EXECUTE ONLY INSIDE AN ISOLATED SANDBOX
```

ตัวอย่างมีสี่โหมด: TEXT/CODE แสดงซอร์สโค้ดที่ React escape เป็นข้อความอ่านอย่างเดียว; IMAGE (PNG/JPG/WebP/GIF) แสดงภาพพร้อมซูมและคืน object URL เมื่อปิด; ZIP แสดงเฉพาะ directory metadata เป็นโครงสร้างอ่านอย่างเดียว; OTHER BINARY รวม SVG/RAR/7Z/DOCX/XLSX/PPTX แสดงข้อมูลไฟล์เท่านั้น ใช้ `@zip.js/zip.js` อ่านเฉพาะรายการใน central directory โดยไม่อ่านเนื้อหาไฟล์ภายใน ไม่แตกไฟล์ลง filesystem ไม่เปิดไฟล์ย่อย ไม่รันโค้ด และไม่เปลี่ยนสิทธิ์ส่งไฟล์ตาม Exam Policy

การดูโครงสร้าง ZIP จำกัดขนาดไฟล์ 50 MB, จำนวนรายการ 1,000, ความลึก 20 ระดับ, ความยาว path 512 ตัวอักษร และขนาดรวมก่อนบีบอัดที่รายงาน 250 MB พร้อมตรวจอัตราขยายที่ผิดปกติ ไฟล์ผิดรูปแบบ เข้ารหัส หรือเกินเพดานจะแสดงข้อมูลไฟล์แทนโดยไม่ขัดขวางการส่งไฟล์ เส้นทางสัมพัทธ์ที่มี `..` หรือ absolute path อาจถูกตัวอ่านปฏิเสธหรือแสดงคำเตือนเป็นข้อความเท่านั้น ไม่มีการ resolve หรือเขียนลงเครื่องผู้ใช้

บริการจัดเก็บข้อมูลในอนาคต ไม่ว่าจะเป็น Backend API, PostgreSQL, MinIO/Object Storage, Central Server หรือ Local Exam Server มีหน้าที่รับ ตรวจสอบ จัดเก็บ เรียกคืน ทำ hash และอนุญาตการเข้าถึงไฟล์ **ห้ามเรียกใช้ไฟล์อัปโหลดโดยตรง** หากอนาคตต้องตรวจ/ให้คะแนนโค้ดอัตโนมัติ ต้องสร้างระบบแยกที่ตรวจนโยบายก่อน ส่งไปรันใน sandbox แบบทิ้งได้ (container หรือ VM) จำกัด CPU หน่วยความจำ เวลา และ filesystem ใช้อินพุตอ่านอย่างเดียว ปิด network เป็นค่าเริ่มต้น เก็บผลแล้วทำลาย sandbox ห้ามรันบนเว็บเซิร์ฟเวอร์ Backend Central/Local Exam Server ฐานข้อมูล หรือเครื่องจัดเก็บไฟล์ ปัจจุบันยังไม่มี code judge หรือ sandbox

การส่งด้วยตนเองมี confirmation dialog เมื่อหมดเวลา ระบบส่งไฟล์พร้อมใช้โดยอัตโนมัติและให้ grace period 10 วินาทีแก่ไฟล์ที่กำลังอัปโหลด หากไม่มีไฟล์พร้อมส่งจะแสดงสถานะไม่พบไฟล์ Teachers สามารถ reopen submission ตาม flow เดิม

ใน frontend demo (`FRONTEND_DEMO_MODE` ผูกกับ `DEMO_TIME_ENABLED`) นักศึกษาที่ส่งแล้วสามารถเข้าสอบเดิมและทดลองส่งใหม่ได้แม้พ้นเวลาสอบ รอบใหม่ใช้ staging key แยกเพื่อเริ่มจากไฟล์และ checklist ว่าง ผลการทดลองส่งซ้ำเก็บแยกใน `securelab_demo_submission_attempts_v1` และไม่แทน submission หลักใน `securelab_submissions` เมื่อปิด demo mode จะกลับไปใช้กฎล็อกการส่งขั้นสุดท้ายและการเปิดรับส่งใหม่โดยอาจารย์ตามเดิม พฤติกรรมนี้ใช้ทดสอบ frontend เท่านั้น ไม่ใช่การอนุญาตส่งซ้ำในระบบจริง

## Persistence และข้อจำกัด

Application state เก็บใน `localStorage`; สถานะบัญชีและรหัสผ่านจำลองเก็บใน `securelab_mock_auth_users_v1`; staged blobs และ sequence counters เก็บใน IndexedDB `securelab-staged-uploads` browser storage เป็นเพียง mock persistence ไม่ใช่ production database หรือ security boundary รหัสผ่านใน browser เป็น plaintext แบบจำลอง ไม่ปลอดภัยสำหรับใช้งานจริง ระบบ production ต้องใช้ backend ตรวจสอบบัญชี จัดการ session และ hash รหัสผ่านฝั่งเซิร์ฟเวอร์ด้วย Argon2/bcrypt หรือเทียบเท่า พร้อมกระบวนการเปลี่ยน/รีเซ็ตรหัสผ่านที่ปลอดภัย

Auth migration ยอมรับอีเมลนักศึกษา mock รูปแบบเดิมผ่าน stable auth ID แล้วเปลี่ยนไปใช้รูปแบบที่ขึ้นต้นด้วย `s` โดยไม่อนุญาตให้ persisted data เปลี่ยน role หรือ subject identity สถานะ `registered` จะสมบูรณ์ได้เมื่อสถานะใบหน้าเป็น `verified_mock` เท่านั้น

Academic, Teacher และ Course data ใช้ forward migration และไม่ล้างข้อมูลเก่าโดยอัตโนมัติ Legacy records จะถูก map เฉพาะเมื่อระบุความสัมพันธ์ได้อย่างไม่กำกวม มิฉะนั้นเก็บข้อความ fallback ไว้ให้ Admin แก้ไข

## การตรวจสอบก่อนส่งงาน

รัน:

```sh
npm run lint
npm run test:auth
npm run test:academic
npm run test:courses
npm run test:rooms
npm run test:exam-wizard
npm run test:exam-management
npm run test:monitoring
npm run build
git diff --check
```

ควร regression-test Student, Teacher และ Admin flows ที่ได้รับผลกระทบ Vite อาจแสดงคำเตือน bundle size ซึ่งไม่ทำให้ build ล้มเหลว

อ่านกติกาสำหรับผู้พัฒนาที่ [AGENTS.md](AGENTS.md)
