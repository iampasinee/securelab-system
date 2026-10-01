# Repository Guidelines

## Project Structure & Module Organization

This project is a React 19, TypeScript, Vite 6, and Tailwind CSS 4 frontend prototype for a university exam submission and exam management system.

The application starts in `src/main.tsx`.

`src/App.tsx` selects and renders role-based flows.

Put role-specific UI in:

* `src/components/student/`
* `src/components/teacher/`
* `src/components/admin/`

Put shared UI primitives in:

* `src/components/common/`

Put demo, mock, and simulation controls in:

* `src/components/simulation/`

Application state, persisted browser state, and migrations live primarily in:

* `src/context/AppContext.tsx`

Models, domain types, and seed/mock data live in:

* `src/types.ts`
* `src/types/`
* `src/data/`

Domain services and migrations live in:

* `src/services/academicState.ts`
* `src/services/courseState.ts`
* `src/services/roomState.ts`

Global styles belong in:

* `src/index.css`

Static assets belong in:

* `public/`

Do not rebuild the project from scratch unless explicitly requested.

Preserve existing Student, Teacher, and Admin flows when modifying unrelated features.

Before changing shared types, state schemas, or domain relationships, inspect all consumers first.

---

## Project Purpose

This system is primarily an exam submission and exam management system.

Its main flows are:

* Student Flow
* Teacher Flow
* Admin Flow

Do not unnecessarily turn the project into a full university registration system.

Academic data should be only as complex as required to support:

* student identity
* course/section assignment
* teacher assignment
* exam creation
* exam access
* exam submission
* administrative management

Prefer simple and maintainable domain structures over unnecessary hierarchy.

---

## Build, Test, and Development Commands

Use:

* `npm install` — install locked dependencies
* `npm run dev` — start Vite on port 3000 and expose it on the LAN
* `npm run lint` — run TypeScript validation with `tsc --noEmit`
* `npm run test:auth` — test university-email parsing, mock role resolution, face-enrollment gates, and auth migration
* `npm run test:academic` — test academic hierarchy, student assignment, migrations, and derived academic data
* `npm run test:courses` — test course/section migration, validation, teacher assignment, student eligibility, and portal assignments
* `npm run test:rooms` — test Floor/Physical Room/Exam Room relationships, room migration, layouts, and computer binding
* `npm run test:exam-wizard` — test teacher exam setup, authorization, draft persistence, and schedule validation
* `npm run test:exam-management` — test teacher exam search and filters
* `npm run test:monitoring` — test authorized monitoring summaries, calendar counts, and daily filters
* `npm run build` — create the production bundle in `dist/`
* `npm run preview` — serve the production bundle locally
* `git diff --check` — check whitespace errors before finishing

Use `npm.cmd` in PowerShell if script policy blocks npm.

After meaningful domain or cross-flow changes, run:

```bash
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

Also inspect `package.json` and run any other relevant tests already defined by the project.

Do not consider a task complete if tests or build errors introduced by the change remain unresolved.

---

## Coding Style & Naming Conventions

Use:

* two-space indentation
* semicolons
* single quotes
* multiline trailing commas where appropriate

Prefer:

* PascalCase component filenames
* camelCase variables and functions
* descriptive Props interfaces
* named exports
* shared domain utilities instead of repeated local logic

Reuse existing:

* context actions
* services
* selectors
* helpers
* shared types

before introducing new parallel implementations.

Style UI with Tailwind CSS utilities.

No ESLint or formatter is currently configured.

Interface copy is Thai-only unless explicitly requested otherwise.

Technical terms may remain English when appropriate, including:

* ICIT
* CSV
* IP Address
* MAC Address
* IndexedDB
* ID

Avoid unnecessary English text in user-facing Thai interfaces.

---

## Stable ID Convention

Domain relationships must use stable IDs.

Do not use display names as relational identifiers.

Examples of stable relationship keys include:

* `facultyId`
* `departmentId`
* `majorId`
* `courseId`
* `sectionId`
* `teacherId`
* `studentId`
* `uploadId`

Display names, codes, labels, and descriptions may change.

Relationships must continue working if a display label changes.

---

## Academic Structure

The canonical academic hierarchy is:

```text
Faculty
→ Department
→ Major
```

Thai UI wording:

```text
คณะ
→ ภาควิชา
→ สาขาวิชา
```

The Admin sidebar/menu name must remain:

`จัดการคณะและกลุ่มเรียน`

Do not rename this menu unless explicitly requested.

Inside the `จัดการคณะและกลุ่มเรียน` page, Admin manages:

* คณะ
* ภาควิชา
* สาขาวิชา
* กลุ่มเรียน

Do not use manually managed Year Level entities. Class Group is supported as a lightweight grouping record keyed by `majorId + admissionYear`; it is not another parent level in the canonical hierarchy.

The previous academic structure:

```text
Faculty
→ Department
→ Program
→ Year
→ Class Group
```

must not return as the canonical hierarchy. Class Group remains adjacent cohort data rather than a child hierarchy that owns Year entities.

Use `Major` for the domain concept corresponding to:

`สาขาวิชา`

Avoid creating competing `Program` and `Major` concepts unless migration compatibility requires it temporarily.

---

## Academic Entity Relationships

Department belongs to one Faculty.

Conceptually:

```ts
type Department = {
  id: string;
  facultyId: string;
  code: string;
  name: string;
};
```

Major belongs to one Department.

Conceptually:

```ts
type Major = {
  id: string;
  departmentId: string;
  code: string;
  name: string;
};
```

Faculty conceptually contains:

```ts
type Faculty = {
  id: string;
  code: string;
  name: string;
};
```

Use the project's existing type naming conventions when implementing actual code.

Do not duplicate parent relationships unnecessarily.

For example, if Major already references Department and Department references Faculty, avoid storing a second conflicting Faculty relationship on Major unless the existing architecture requires it temporarily.

---

## Academic State Service

Use:

`src/services/academicState.ts`

for academic relationships, validation, migration, selectors, and academic domain rules where appropriate.

Do not scatter duplicate academic relationship logic across UI components.

Prefer reusable selectors and helpers.

Before modifying `academicState.ts`, inspect:

* student management
* Course/Section management
* Teacher portal
* Student portal
* persisted state migrations

because academic relationships may be consumed across multiple role flows.

---

## Cascading Academic Selectors

Academic selectors cascade as:

```text
Faculty
→ Department
→ Major
```

Required behavior:

* selecting Faculty filters available Departments
* selecting Department filters available Majors
* changing Faculty clears an invalid selected Department
* changing Faculty also clears an invalid selected Major
* changing Department clears an invalid selected Major
* inactive or unavailable parents must not allow invalid child assignments

The final canonical student academic assignment should save:

`majorId`

rather than separately storing all parent identifiers.

Do not allow the UI to save inconsistent combinations such as:

```text
Faculty A
Department B from Faculty C
Major D from another Department
```

---

## Student Academic Identity

A student's canonical academic assignment should primarily use:

```ts
{
  studentId: string;
  majorId: string;
  admissionYear: number;
  classGroupId?: string;
}
```

Other profile fields may exist normally.

Do not use these as canonical stored academic identity fields:

* `facultyId`
* `departmentId`
* `yearLevel`
* legacy `groupId` or multiple primary group IDs

Faculty and Department should be derived through:

```text
student.majorId
→ Major.departmentId
→ Department.facultyId
```

This avoids duplicated academic data becoming inconsistent.

Temporary compatibility fields may remain only where required for safe migration.

The new canonical source of truth must be:

* `majorId`
* `admissionYear`
* optional `classGroupId` for one primary Class Group

---

## Admission Year and "ปีที่เข้าศึกษา"

The student admission cohort is shown in the UI using the Thai label:

`ปีที่เข้าศึกษา`

Examples:

```text
admissionYear = 2567
display = ปีที่เข้าศึกษา 67

admissionYear = 2568
display = ปีที่เข้าศึกษา 68

admissionYear = 2569
display = ปีที่เข้าศึกษา 69
```

Store the full Buddhist academic year where possible.

Example:

```ts
admissionYear: 2567
```

Display the shortened admission code where appropriate:

```text
67
```

Do not use the term:

`รุ่น`

for this concept in the UI.

Use:

* `ปีที่เข้าศึกษา`
* `ปีที่เข้าศึกษา 67`
* `ปีที่เข้าศึกษา 68`

instead.

Create or reuse one shared admission-code formatting helper.

Conceptually:

```ts
function getAdmissionCode(admissionYear: number): string {
  return String(admissionYear).slice(-2);
}
```

Do not duplicate `slice`, `substring`, or admission-code formatting logic across many components.

---

## Student ID and Admission Year

Do not use the first digits of `studentId` as the canonical admission-year source.

The student ID may be used as a convenience to:

* suggest the admission year
* auto-fill the admission year
* assist Admin during data entry

when the format is recognizable.

However, `admissionYear` must remain stored separately.

Admin must be able to correct the admission year if the student ID format does not match the expected convention.

Do not derive critical domain behavior permanently from student ID substring logic.

The frontend-only Student Registration mock is a scoped exception for initial account enrollment. A valid university email such as `s6701011500167@email.kmutnb.ac.th` is parsed once to initialize and save `studentCode = 6701011500167` and `admissionYear = 2567`. Those values are read-only during Registration. After registration, normal domain behavior must read the separately persisted `admissionYear`; it must not repeatedly derive academic state from the email or Student ID.

---

## Automatic Student Year Level

Student year level is derived data.

Do not permanently store year level as the canonical source of truth.

Use:

`src/utils/academicYear.ts`

for derived academic-year and student-year calculations.

Use the central current academic year already provided by the application.

Do not use the device calendar year directly.

Do not hard-code a separate academic year inside individual components.

The canonical calculation is:

```ts
yearLevel = currentAcademicYear - admissionYear + 1;
```

Example:

```text
currentAcademicYear = 2569
admissionYear = 2567

yearLevel = 3
```

Therefore the student displays:

`ชั้นปี 3`

When the central current academic year changes, displayed student year levels must update automatically without manually editing each student.

Year level is read-only.

Admin must not manually assign or edit it.

Do not create Year Level as a manually managed academic entity.

---

## Year-Level Validation

Derived student year level must be validated.

Future admission years must not silently produce valid student years.

Invalid academic-year combinations should be handled explicitly.

Do not silently convert invalid values into plausible student years.

Prefer shared helper logic for:

* valid admission year
* derived year level
* academic-year formatting

instead of implementing separate behavior in each page.

---

## Student Management UI

Admin Student Management should clearly display academic information.

Recommended table columns:

* รหัสนักศึกษา
* ชื่อ-นามสกุล
* คณะ
* ภาควิชา
* สาขาวิชา
* ปีที่เข้าศึกษา
* ชั้นปี
* กลุ่มเรียน
* สถานะ
* การดำเนินการ

Example:

```text
รหัสนักศึกษา: 6706022510158
สาขาวิชา: IT
ปีที่เข้าศึกษา: 67
ชั้นปี: 3
กลุ่มเรียน: INET-DE-RA
```

`ชั้นปี` is derived automatically.

Do not provide a manual year-level edit control.

---

## Student Create/Edit Form

Student academic selection should follow:

```text
คณะ
→ ภาควิชา
→ สาขาวิชา
```

The final canonical value saved to the student should be:

`majorId`

The form should also collect or determine:

`admissionYear`

The form may optionally assign one active `classGroupId` after Major and admission year are selected. Available groups must match both values, and changing either value must clear an incompatible group.

The UI may display a shortened admission code such as:

`67`

where appropriate.

If student ID auto-fill exists, treat it as a suggestion rather than the canonical source.

Do not permanently save duplicated Faculty and Department values if they can be derived safely from Major.

---

## Student Filters

Student Management may support filters for:

* รหัสนักศึกษา / ชื่อ
* คณะ
* ภาควิชา
* สาขาวิชา
* ปีที่เข้าศึกษา
* ชั้นปี
* กลุ่มเรียน
* สถานะ

Academic filters must cascade consistently:

```text
Faculty
→ Department
→ Major
```

Year-level filtering must use the derived year level.

Admission-year filtering should resolve against stored `admissionYear`, and Class Group options must be scoped to the selected Major and admission year.

Do not create a separate persistent Year entity merely to support filtering.

---

## Deletion and Referential Integrity

Block deletion of academic records that are still referenced unless there is an explicit safe migration or reassignment flow.

Examples:

* Department cannot be deleted while Majors still depend on it
* Major cannot be deleted while Students still depend on it
* Faculty cannot be deleted while Departments still depend on it

Inactive ancestors should be excluded from new assignments.

Existing historical data should not be silently corrupted because a record is deactivated.

Do not silently cascade-delete academic relationships unless explicitly required.

---

## Legacy Year-Level Data

Search for old fields and entities such as:

* `yearLevel`
* `yearLevelId`
* academic Year entity
* Program Year
* Class Year

when modifying the academic model.

Refactor these usages so derived student year level comes from:

```text
admissionYear
+
currentAcademicYear
```

Do not leave two active competing sources of truth.

Temporary legacy fields may exist only during migration or compatibility handling.

---

## Class Group Data

Class Group is a lightweight grouping adjacent to the canonical Faculty → Department → Major hierarchy. It is not a manually managed Year Level and is not a parent of Major.

Use stable IDs and this conceptual shape:

```ts
type ClassGroup = {
  id: string;
  majorId: string;
  admissionYear: number;
  code: string;
  name?: string;
  sequence: number;
  isActive: boolean;
};
```

A student may have at most one optional primary `classGroupId`. The referenced group must match both the student's `majorId` and `admissionYear`. Do not use multiple group IDs as the student's primary academic identity.

Group codes are generated automatically within `majorId + admissionYear` from the Major code and a sequence, for example `INET-DE-RA`, `INET-DE-RB`, and `INET-DE-RC`. Never reuse a sequence that was previously assigned to an active, inactive, or historical group.

Inactive groups must not be offered for new assignments. Existing historical relationships must remain readable. Block deletion while students or Sections still reference a group.

Search for legacy usages such as `groupId`, `groupIds`, legacy group codes, and compatibility fields before changing group behavior. Do not blindly delete them: forward migration may need them to reconstruct an unambiguous `classGroupId` or Section cohort.

---

## Course and Section Domain

Course and section rules live primarily in:

`src/services/courseState.ts`

The Admin UI is primarily in:

`src/components/admin/CoursesAndSectionsPage.tsx`

Preserve the existing:

`จัดการรายวิชาและตอนเรียน`

flow.

Do not break:

* Course CRUD
* Section creation
* Section editing
* academic year selection
* semester selection
* primary teacher assignment
* co-teacher assignment
* teacher portal visibility
* student eligibility
* exam creation flow

Course/Section changes must preserve stable IDs and foreign-key relationships.

---

## Course Uniqueness

Preserve existing composite uniqueness rules.

A Section should not be duplicated for the same meaningful combination of:

* course
* academic year
* semester
* section number

Use the existing project domain implementation as the source of truth when exact constraints already exist.

Do not weaken existing validation while refactoring academic structure.

---

## Teacher Assignment

Sections may have:

* Primary Teacher
* Co-Teachers

Primary Teacher must be valid and active according to existing business rules.

Co-Teachers must not duplicate the Primary Teacher.

Teacher portal access should continue to derive from assigned Sections.

Do not break Teacher Flow while changing academic student grouping.

---

## Teacher Academic Affiliation

Teacher profile affiliation uses stable `facultyId` and `departmentId` values. Department must belong to the selected Faculty, and create/edit selectors cascade as:

```text
Faculty
→ Department
```

Legacy Faculty or Department names may remain only as display fallbacks during forward migration. Map them to IDs only when the relationship is unambiguous; do not silently assign an incorrect affiliation.

Inactive academic records remain readable for existing profiles but must not be selectable for new assignments.

Teacher affiliation is profile metadata. Teacher Portal course visibility must continue to derive from Primary Teacher and Co-Teacher assignments on Sections, not from Faculty or Department profile values.

---

## Section Student Eligibility

Section targeting is based on Major and admission year, with optional Class Group narrowing:

```ts
type SectionCohort = {
  majorId: string;
  admissionYear: number;
  classGroupIds?: string[];
};
```

Example:

```ts
section.cohorts = [
  {
    majorId: 'major_it',
    admissionYear: 2567,
    classGroupIds: ['group_it_67_ra', 'group_it_67_rb'],
  },
];
```

An absent or empty `classGroupIds` array targets the whole Major + admission-year cohort. Otherwise, eligible students must match the Major and admission year and belong to one of the selected groups:

```ts
student.majorId === cohort.majorId
&&
student.admissionYear === cohort.admissionYear
&&
(
  !cohort.classGroupIds?.length
  || cohort.classGroupIds.includes(student.classGroupId ?? '')
)
```

This allows a Section to represent:

```text
สาขาวิชา IT
ปีที่เข้าศึกษา 67
```

or multiple cohorts such as:

```text
IT ปีที่เข้าศึกษา 67
IT ปีที่เข้าศึกษา 68
```

A Section may combine RA + RB or target RA and RB in separate Sections. Class Group is the student's primary academic grouping; Section is the teaching arrangement for one Course, academic year, and semester. Do not merge these concepts.

Use stable IDs and stored academic years.

Do not use display strings such as:

`IT-67`

as relational identifiers.

---

## Section Cohort Selection UI

When assigning academic student groups to a Section, prefer a simple UI based on:

* คณะ
* ภาควิชา
* สาขาวิชา
* ปีที่เข้าศึกษา
* กลุ่มเรียน

Example:

```text
สาขาวิชา: IT

ปีที่เข้าศึกษา:
☑ 67
☑ 68
☐ 69

กลุ่มเรียน:
☑ RA
☑ RB
```

The UI may use Faculty and Department to filter Majors.

The stored cohort relationship should primarily use:

* `majorId`
* `admissionYear`
* optional `classGroupIds`

Avoid storing redundant parent relationships when they can be derived safely.

---

## Section Collision Rules

Preserve existing business rules preventing invalid duplicate student/cohort assignment where applicable.

For example, if the current domain prevents overlapping students from being assigned to multiple Sections of the same Course in the same academic year and semester, preserve that behavior. Collision checks must understand whole-cohort assignments, repeated individual groups, and overlaps between a whole cohort and one of its groups.

Adapt existing collision checks from legacy `groupId` logic to the new academic cohort representation where necessary.

Do not remove validation merely because the underlying grouping model changes.

---

## Student Membership and Exam Integrity

Dynamic cohort resolution is acceptable for normal Section eligibility.

However, exam integrity may require stable membership at a specific point in time.

If the current architecture uses explicit membership snapshots, preserve them where appropriate.

If a snapshot is needed, prefer creating it at the relevant workflow stage rather than relying only on mutable labels.

Do not let renamed academic display labels alter historical exam membership.

---

## Academic Migration Rules

Existing browser-persisted state and mock data may use older schemas.

Academic schema changes require forward migration.

Migration should attempt to:

* preserve existing valid students
* preserve student IDs
* preserve admission years
* map legacy academic assignments to `majorId` where safely possible
* derive year level rather than storing it
* remove obsolete Year dependencies where safe
* preserve or reconstruct an optional `classGroupId` only where a legacy relationship maps unambiguously
* preserve Course/Section relationships
* preserve Teacher assignments
* avoid duplicate academic entities
* avoid invalid parent-child relationships

Do not silently assign an incorrect Major.

If a legacy record cannot be mapped safely, use an explicit safe fallback and document the limitation.

Do not silently corrupt persisted academic relationships.

---

## Migration Compatibility

Temporary compatibility fields may remain during migration if necessary.

However:

* clearly identify the new canonical source of truth
* avoid continuing to write new data into legacy structures
* prefer one-way forward migration
* avoid maintaining two active competing models indefinitely

When modifying persisted schemas, inspect all migration versions and existing state initialization logic.

---

## App Context and Persistence

State and migration logic live primarily in:

`src/context/AppContext.tsx`

Before changing persisted shapes:

* inspect initialization
* inspect storage reads
* inspect storage writes
* inspect migration version logic
* inspect mock seed fallback behavior
* inspect all affected selectors

Do not clear user browser state simply to avoid writing a migration unless explicitly requested.

Preserve valid existing demo data where practical.

---

## Authentication and Registration Mockup

Authentication is frontend-only and lives primarily in:

* `src/components/auth/`
* `src/services/authState.ts`
* `src/types/auth.ts`
* the mock-auth slice in `src/context/AppContext.tsx`

Supported university domains are:

* Student: `@email.kmutnb.ac.th`
* Teacher/Admin: `@itm.kmutnb.ac.th`

For Student accounts, the local part must be `s` followed by Student ID digits. Use the shared `parseStudentUniversityEmail()` helper. Do not duplicate email parsing in React components.

Example:

```text
s6701011500167@email.kmutnb.ac.th
→ studentCode: 6701011500167
→ admissionYear: 2567
```

Student ID and admission year are read-only in the Student Registration UI. Year level remains read-only derived data from `academicSettings.currentAcademicYear` and is never persisted as a manual field. Major remains a stable `majorId` selection. Optional Class Group options must be active and match the selected `majorId + admissionYear`; changing Major clears an incompatible group.

The staff domain alone must never grant Admin access. Resolve Teacher/Admin from the predefined mock account record, and require `adminProvisioned` for Admin. Do not provide public Admin self-registration.

Student and Teacher Registration have five steps:

```text
Google account
→ SecureLab password
→ role-specific profile
→ required mock face enrollment
→ review and confirmation
```

Face enrollment stores status only. Do not store face images, perform biometric matching, or describe the mock as production authentication. Registration cannot complete unless the status is `verified_mock`.

The password step is required before either role-specific profile step. Validation requires at least 8 characters, an English letter, a number, matching confirmation, and no leading/trailing whitespace. Keep credentials in mock auth state, never Student/Teacher profiles, and show only a "ตั้งค่าแล้ว" status on Review. Login checks the mock password. Existing registered demo accounts without a password migrate to the documented demo password. Browser-managed plaintext credentials are mock-only and never production-safe; a production backend must hash passwords server-side (Argon2/bcrypt or equivalent), manage sessions, and provide a secure reset/change flow.

Mock registration state is stored under `securelab_mock_auth_users_v1`. Forward migration may map known legacy demo emails by stable auth ID, but persisted data must not override canonical role, email, subject ID, or Admin provisioning. A persisted `registered` state is valid only with verified mock face enrollment.

Teacher/Admin email rules and their existing role flows must remain unchanged when refining Student Registration.

---

## Course/Section Migration

If existing Sections use:

* `groupId`
* `groupIds`

for student grouping, migrate carefully.

Preferred new representation:

```ts
type SectionCohort = {
  majorId: string;
  admissionYear: number;
};
```

Do not remove old group relationships before extracting enough information to reconstruct equivalent cohort relationships where safely possible.

If exact migration cannot be guaranteed, document that limitation.

Do not silently assign students from the wrong Major or admission year.

---

## Teacher Exam Management and Monitoring

The Teacher `จัดการรายวิชา & กลุ่มเรียน` page is course-first, then Section-first. Only assigned Sections may be shown. Student master records remain Admin-managed. Individual exceptions to cohort membership use `includedStudentIds` and `excludedStudentIds` on existing Sections in `securelab_courses`; effective membership is base cohort plus inclusions minus exclusions. Teacher add/move operations must validate both Section assignments, prevent duplicates and cross-course moves, and never modify Student master data. Before an override changes an in-progress or completed exam's Section, freeze that exam's eligible student IDs; upcoming exams continue using the effective live roster.


Teacher exam setup lives in `src/components/teacher/ExamCreationWizard.tsx` and `src/services/examWizard.ts`. The `จัดการสอบ` page lives in `src/components/teacher/CourseExamSessionManager.tsx`; its canonical exam filters live in `src/services/teacherExamManagement.ts`.

The exam Wizard has six steps: exam information, eligible students, schedule and Exam Room, online/offline mode, policies, and review/save. Course and Section choices must be authorized through Primary Teacher or Co-Teacher assignments. Resolve eligible students through existing Section cohorts. Validate the time range, room conflict, and capacity before final creation. Policies are frontend configuration only; do not imply that an Agent, network control, or biometric verification is enforced.

Keep incomplete drafts separate from canonical `ExamSession` records under `securelab_teacher_exam_drafts_v1`. Saving a draft must not create a canonical exam. Editing an existing exam must preserve its stable ID and current status restrictions. A created exam should appear in monitoring through canonical state, not a duplicate monitoring record.

The `การสอบทั้งหมด` tab filters already-authorized exams by search text, canonical status (`upcoming`, `in_progress`, `completed`), and exam mode (`online`, `offline`). Its tab count represents all authorized canonical exams, while a separate result count may reflect filters. The `ร่างการสอบ` tab has independent draft search; canonical exam filters must not affect it.

Teacher monitoring lives in `src/components/teacher/LiveExamMonitoring.tsx`, `MonitoringCalendar.tsx`, `MonitoringDatePickerPopover.tsx`, and `src/services/teacherMonitoring.ts`. The daily overview retains status counters and search/status/course/room filters. The full calendar and compact date picker display schedule dates and exam counts (`N รอบ`) only, without status dots, status categories, or a status legend in their date cells. Both date controls use the same selected date; choosing a date returns to the daily overview without opening an exam detail automatically. Keep monitoring restricted to the Teacher's authorized Course/Sections.

---

## Portal Compatibility

After academic changes, verify all role portals.

### Admin Flow

Verify:

* academic CRUD
* student management
* Course/Section management
* filters
* assignments
* migrations

### Teacher Flow

Verify:

* assigned Sections remain visible
* assigned Courses remain visible
* student eligibility remains correct
* exam creation still works
* exam management still works
* exam drafts, authorization, and canonical exam filters remain separate
* monitoring calendar counts and daily status views remain correct

### Student Flow

Verify:

* student profile academic information renders correctly
* available exams still resolve correctly
* exam access is not lost due to academic migration
* submission flow remains unchanged unless explicitly modified

Do not consider an academic refactor complete if only the Admin page works.

---

## Room and Computer Domain

Room and device rules live primarily in:

`src/services/roomState.ts`

Types live in:

`src/types/rooms.ts`

The Admin UI is primarily in:

`src/components/admin/RoomComputerSetup.tsx`

The canonical hierarchy is:

```text
Floor
→ PhysicalRoom
→ ExamRoom
→ RoomSeat
→ ComputerDevice
```

Thai UI concepts are:

```text
ชั้น
→ ห้องในชั้น
→ เปิดเป็นห้องสอบ
→ ผังที่นั่ง
→ เครื่องคอมพิวเตอร์
```

Do not reintroduce Building/อาคาร as a managed parent. A compatibility `building` field may remain on the legacy projected `Room` type, but the canonical persisted room state must not use it as a relationship.

---

## Physical Room and Exam Room

Physical Room is the catalog record under a Floor:

```ts
type PhysicalRoomRecord = {
  id: string;
  floorId: string;
  roomCode: string;
  status: 'active' | 'inactive';
};
```

Exam Room is the examination configuration linked to one Physical Room:

```ts
type ExamRoomRecord = {
  id: string;
  physicalRoomId: string;
  status: 'ready' | 'maintenance' | 'inactive';
  rows: number;
  columns: number;
};
```

Derive Floor and room code through:

```text
ExamRoom.physicalRoomId
→ PhysicalRoom.floorId
→ Floor
```

Do not duplicate `floorId` or `roomCode` on new Exam Room records. Physical Room and Exam Room IDs are stable relationship keys; display codes are not.

A Physical Room may be opened as an Exam Room at most once. Inactive Physical Rooms remain readable but cannot be opened as new Exam Rooms. Rooms not opened as Exam Rooms cannot receive layouts, seats, or computer assignments.

---

## Room-Code Generation

For newly created Physical Rooms, Admin enters only a suffix and the system generates the full code from the selected Floor:

```text
ชั้น 4 + 08  → B4-08
ชั้น 4 + 01A → B4-01A
```

Use the shared helpers in `src/services/roomState.ts`:

* `normalizeRoomSuffix`
* `generateRoomCodeFromFloor`
* `getRoomSuffixForFloor`

Do not duplicate prefix/suffix concatenation inside components.

Normalize suffixes by trimming whitespace, removing internal whitespace, and converting English letters to uppercase. New suffixes support English letters, numbers, and hyphens. Generated room codes must be unique within one Floor; the corresponding suffix on a different Floor is valid because it produces a different full code.

Preserve legacy full codes such as `LAB 301` without rewriting them when Admin only changes status. A legacy code may be converted to the generated format only when Admin deliberately enters a new suffix. Stable IDs must not change when a room code changes.

---

## Room Admin UI

The page `ห้องสอบและเครื่องคอมพิวเตอร์` has three tabs:

```text
[ ห้องสอบ ] [ ผังที่นั่งและเครื่อง ] [ เครื่องคอมพิวเตอร์ ]
```

The `ห้องสอบ` tab uses this compact order:

```text
Summary cards
→ Main tabs
→ Filter bar
→ Room table
```

Do not insert Floor overview cards or a selected-Floor management panel between the tabs and filter bar unless explicitly requested. Floor and Physical Room CRUD remain available through the page-level actions and modals.

The room table is based on all Physical Rooms, not only opened Exam Rooms. It should show:

* รหัสห้อง
* ชั้น
* สถานะห้อง
* สถานะการเปิดเป็นห้องสอบ
* ผังห้อง
* จำนวนที่นั่ง
* จำนวนเครื่อง
* การดำเนินการ

The filter bar supports room-code search, Floor, Physical Room status, opened/unopened Exam Room status, and reset. Keep it directly above the table.

Unopened active rooms provide an `เปิดเป็นห้องสอบ` action. Opened rooms expose their Exam Room state and retain safe edit/removal actions. Detail UI must distinguish Physical Room information from Exam Room information and must not expose raw relationship IDs.

Page-level actions remain available for:

* เพิ่มชั้น
* เพิ่มห้องในชั้น
* เพิ่มห้องสอบ

The Physical Room modal selects a Floor, accepts `รหัสย่อย/เลขห้อง`, previews the generated `รหัสห้อง` read-only, and selects status. The Exam Room modal cascades `ชั้น → ห้อง` and keeps already-opened or inactive rooms visible but disabled where practical.

---

## Room Layout and Computer Binding

Seat layout and computer assignment continue to target Exam Rooms:

```text
Floor → Exam Room → Seat → Computer
```

Seat IDs and existing exam seat labels must remain stable when expanding a layout. Reducing or clearing a layout must be blocked when removed seats have computers or exam-history references.

Computer metadata includes:

* computer code
* Serial Number
* IPv4 address
* MAC Address
* readiness status

Preserve global duplicate validation for computer code, Serial Number, IP, and MAC. Allow at most one computer per seat. Do not move, rename, or delete a referenced device in ways that invalidate exam history.

Teacher and Student flows consume a read-only legacy `Room[]` projection from the canonical room state. Keep this projection compatible with existing exam IDs, room IDs, seat labels, monitoring, seat assignment, and submission flows.

---

## Room Persistence and Migration

Canonical room state is stored in:

`securelab_room_state`

Current canonical version is version 2. Forward migration must support:

* version 1 room state using `floorId + roomCode` directly on Exam Room
* legacy `securelab_rooms`

Migration must create or reuse one Physical Room for the same Floor + normalized room code while preserving:

* Exam Room IDs
* Seat IDs
* Computer IDs
* exam and seat-assignment references
* runtime/device statuses

Do not wipe browser storage to avoid migration. Do not invent a Floor for data whose Floor cannot be resolved safely. Historical relationships must remain readable even when a parent is inactive.

Block deletion when references exist:

* Floor while Physical Rooms belong to it
* Physical Room while an Exam Room references it
* Exam Room while seats or exam history reference it
* Computer while exam history references its seat

Prefer deactivation when destructive deletion is unsafe.

---

## Upload Domain Conventions

### Permanent uploaded-file execution boundary

**SecureLab Upload / Preview: NEVER EXECUTE.**

**SecureLab Storage: NEVER EXECUTE.**

**Future Code Judge: EXECUTE ONLY INSIDE AN ISOLATED SANDBOX.**

Treat **every user-uploaded file as untrusted data**, regardless of its extension, MIME type, filename, Student identity, or exam configuration. Preview and execution are separate capabilities. Source code (including HTML, JavaScript, and shell scripts) may be decoded and displayed only as escaped, read-only text; it must never be imported, evaluated, compiled, launched, or inserted as active markup by the SecureLab application. SVG and unknown/binary files must remain non-active. Never use uploaded content in `eval`, `new Function`, scripts, workers, executable iframes, shell commands, or similar execution paths. Keep preview classification fail-closed; MIME type alone is not trustworthy.

Current SecureLab storage, including browser-staged files, receives, stores, retrieves, and authorizes data; it does not execute it. Future Backend APIs, PostgreSQL, MinIO/Object Storage, Central Servers, and Local Exam Servers must also never execute uploaded files directly. Verification and hashing are storage/security operations, not execution.

If automatic code judging is introduced later, it must be a **separate** subsystem with validation and an isolated, disposable container or VM; enforce CPU, memory, and time limits, a restricted filesystem, read-only inputs, and no network by default, then destroy the sandbox after collecting results. Never run uploaded code on the SecureLab web/backend server, Central or Local Exam Server, database host, or storage host. Do not implement a code judge or sandbox as part of the frontend preview flow.

For staged uploads, use:

`uploadId`

as the stable record identifier.

Do not use filenames as primary identifiers.

Validate raw file size using:

`sizeBytes`

Rename operations may change only:

`submissionName`

Preserve:

* `originalName`
* extension
* sequence
* blob
* progress
* status
* upload identity

Do not regenerate unrelated upload state when renaming a file.

---

## Submission Filename Rules

Generated submission filenames must preserve the original extension.

User-editable filename labels should use a safe allowlist.

Prefer:

* English letters
* numbers
* hyphen
* underscore

The system should control the extension.

Do not rely on a blacklist of invalid characters when an allowlist can be used.

Do not allow filename changes to alter stable upload identity.

---

## IndexedDB Rules

IndexedDB changes require forward migrations.

Do not silently discard existing staged submission data when changing storage structure.

Inspect existing IndexedDB schema/version logic before changing persisted upload data.

---

## CSV Behavior

Preserve existing CSV behavior unless explicitly modified.

When academic schema changes affect CSV:

* update import/export mappings carefully
* maintain clear Thai headers where applicable
* validate academic references
* avoid silently creating invalid Faculty/Department/Major combinations

Manually test affected CSV flows.

---

## UI Consistency

Reuse the project's existing Admin UI patterns.

Do not introduce a completely different design language for one page.

Preserve:

* spacing conventions
* table patterns
* modal patterns
* button hierarchy
* form styling
* Tailwind usage
* loading/empty/error states where already used

Academic simplification should make the UI easier to use, not merely reduce data fields.

---

## Add-User Workflow

The Admin add-user workflow begins with a role-selection screen for Student, Teacher, or Admin. Every role-specific create form must use the same secondary action semantics:

* `ย้อนกลับ` returns to role selection without submitting and clears incompatible temporary form state
* the modal `X` closes the entire workflow
* the primary action creates the selected account using the existing validation and handlers

Back navigation must not trigger validation. Do not label a one-step back action as `ยกเลิก`.

---

## Academic Structure UI

The page:

`จัดการคณะและกลุ่มเรียน`

should focus on managing:

```text
คณะ
ภาควิชา
สาขาวิชา
กลุ่มเรียน
```

Recommended presentation may use tabs:

```text
[ คณะ ] [ ภาควิชา ] [ สาขาวิชา ] [ กลุ่มเรียน ]
```

or another pattern consistent with the current application.

Do not reintroduce a manually managed Year Level or a Year Level tab. Class Group management must remain lightweight and scoped by `majorId + admissionYear`.

The `เพิ่มโครงสร้างการศึกษา` action uses a five-step wizard:

```text
คณะ
→ ภาควิชา
→ สาขาวิชา
→ ปีที่เข้าศึกษาและกลุ่มเรียน
→ ตรวจสอบและบันทึก
```

Each step may select an existing record or prepare a new one. Validate against temporary state, preview generated group codes, and commit the complete structure once on final confirmation. A failed validation must not leave partial Faculty, Department, Major, or Class Group records.

---

## Required Thai Terminology

Use these labels consistently:

* `จัดการคณะและกลุ่มเรียน`
* `คณะ`
* `ภาควิชา`
* `สาขาวิชา`
* `ปีที่เข้าศึกษา`
* `ชั้นปี`
* `กลุ่มเรียน`
* `รหัสนักศึกษา`
* `ชื่อ-นามสกุล`
* `สถานะ`

Do not use:

`รุ่น`

for the admission cohort unless explicitly requested in a future change. Use `ปีที่เข้าศึกษา` for admission-year filters, forms, tables, and group/Section configuration. `รหัสนักศึกษา` remains the correct label for Student ID.

---

## Testing Guidelines

Run:

```bash
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

when relevant to the change.

No coverage threshold is currently configured.

Update or add tests when domain behavior changes.

Do not only test rendering.

---

## Academic Tests

Academic changes should verify at least:

1. Faculty → Department relationship
2. Department → Major relationship
3. Student Major assignment
4. Admission year persistence
5. Admission-year display formatting
6. Automatic student year-level calculation
7. Academic-year changes update derived year level
8. Invalid future admission years
9. Cascading Faculty → Department → Major selectors
10. Student filtering by Faculty
11. Student filtering by Department
12. Student filtering by Major
13. Student filtering by admission year
14. Student filtering by derived year level
15. deletion guards
16. migration from legacy Year data
17. migration from legacy Group data where applicable
18. Class Group code generation and non-reused sequence
19. Class Group uniqueness within Major + admission year
20. valid and invalid Student Class Group assignment
21. Class Group deactivation and deletion guards
22. Teacher Faculty → Department affiliation and migration

---

## Course Tests

Course/Section changes should verify at least:

1. Course loading
2. Course CRUD where supported
3. Section loading
4. Section uniqueness
5. Primary Teacher assignment
6. Co-Teacher assignment
7. cohort assignment
8. cohort collision validation
9. migration from old `groupId` / `groupIds`
10. Teacher portal assignment
11. student eligibility
12. exam creation compatibility
13. RA-only and RB-only Section targeting
14. combined RA + RB Section targeting
15. separate RA/RB Sections and collision validation

Preserve existing tests where still valid.

Update tests to reflect the new canonical academic model.

---

## Room Tests

Room and device changes should verify at least:

1. Floor CRUD and uniqueness
2. Physical Room creation under a Floor
3. suffix normalization and generated room codes such as `B4-08` and `B4-01A`
4. duplicate generated code prevention within one Floor
5. the same suffix on different Floors
6. legacy room-code preservation
7. Physical Room → Exam Room relationship
8. one Exam Room per Physical Room
9. inactive-room restrictions
10. opened/unopened room filtering and display
11. stable seat IDs during layout expansion
12. layout reduction and history guards
13. computer metadata normalization and uniqueness
14. one computer per seat
15. version 1 and legacy `Room[]` migration
16. preservation of Exam Room, Seat, Computer, and history IDs
17. deletion guards
18. Teacher/Student room projection compatibility

Preserve existing room/device tests when refining the Admin UI. UI-only changes should still be checked in a browser for responsive overflow, filters, actions, and console errors.

---

## Manual Verification

When relevant, manually verify:

* Faculty CRUD
* Department CRUD
* Major CRUD
* Student create
* Student edit
* Student search
* valid and invalid university-email formats
* Student Registration read-only Student ID, admission year, and derived year level
* Student Registration Major/Class Group filtering and incompatible-group reset
* required mock face enrollment and registration review
* Teacher/Admin mock-account role resolution
* cascading selectors
* admission year
* derived year level
* academic-year change
* Class Group create, edit, assignment, reassignment, deactivation, and deletion guard
* five-step academic structure wizard and atomic failure behavior
* Section creation
* teacher assignment
* Teacher Faculty/Department cascade and migrated affiliation
* cohort assignment
* RA only, RB only, and RA + RB Section targeting
* authorized exam creation, draft save/reopen, and online/offline policy configuration
* exam time, room conflict, and capacity validation
* canonical exam search/status/mode filters independent from draft search
* monitoring date selection, calendar counts, daily status filters, and exam detail
* add-user role selection, `ย้อนกลับ`, close, and form-state reset
* add/edit/deactivate Floor and Physical Room
* room suffix preview and generated room code
* all-room table, Floor filter, room-status filter, and opened/unopened filter
* open Physical Room as Exam Room and duplicate-open prevention
* layout creation, expansion, reduction guards, and clearing
* computer create, assignment, movement, uniqueness, and history guards
* room persistence and forward migration after reload
* Teacher Flow
* Student Flow
* Admin Flow
* CSV
* persistence after reload

Check the browser console for errors.

Do not consider a task complete merely because the page renders.

---

## Definition of Done

A task is not complete only because the UI renders.

Before finishing a meaningful change:

* inspect affected consumers
* verify data relationships
* verify migration behavior
* verify create/edit/delete where relevant
* verify filters
* verify role flows
* run required tests
* run build
* check for TypeScript errors
* check for console errors where possible
* run `git diff --check`

Fix regressions introduced by the change.

At completion, report:

1. files changed
2. data model changes
3. migration changes
4. UI changes
5. tests run
6. known limitations or assumptions

---

## Commit & Pull Request Guidelines

Use short imperative commit subjects.

Optional prefixes:

* `feat:`
* `fix:`
* `refactor:`
* `test:`
* `docs:`

Pull requests should describe:

* visible changes
* business-rule changes
* data model changes
* storage migrations
* verification performed
* tests run
* known limitations
* screenshots for visible UI changes where useful

Avoid vague commit messages such as:

* `update`
* `fix stuff`
* `changes`

---

## Security & Configuration

Never commit secrets.

Never log sensitive:

* biometric data
* authentication credentials
* exam submission contents
* private student data
* tokens
* passwords

Browser storage is mock persistence for this prototype.

It is not:

* a production database
* a secure backup
* a production authentication boundary

Do not present browser-local persistence as production-grade security.

---

## Refactoring Rules

Before large refactors:

1. inspect current types
2. inspect persisted-state migrations
3. inspect services
4. inspect Admin consumers
5. inspect Teacher consumers
6. inspect Student consumers
7. inspect tests

Prefer incremental forward-compatible changes.

Do not rewrite working unrelated modules.

Do not remove legacy data structures until their remaining consumers are understood.

Do not suppress TypeScript errors to make a migration appear complete.

---

## Source of Truth

For academic identity, the new canonical source of truth is:

```text
Student
├── studentId
├── majorId
├── admissionYear
└── classGroupId? (optional primary group)
```

Derived dynamically:

```text
Faculty
Department
Admission Year Display
Year Level
```

For academic master data, the canonical source of truth is:

```text
Faculty
→ Department
→ Major
```

For Course/Section academic cohort assignment, prefer:

```text
Major
+
Admission Year
+
optional Class Group IDs
```

An empty Class Group selection represents the whole Major + admission-year cohort.

Do not introduce another competing academic model without explicit instruction.

---

## Final Architecture Summary

Frontend authentication mock:

```text
University email
├── Student domain → parse s + Student ID
└── Staff domain → resolve Teacher/Admin from mock account data

Registration
→ SecureLab password
→ profile data
→ required mock face status
→ review
→ return to Login
```

Academic master data:

```text
คณะ
└── ภาควิชา
    └── สาขาวิชา
```

Student academic identity:

```text
นักศึกษา
├── รหัสนักศึกษา
├── majorId
├── admissionYear
├── classGroupId? (กลุ่มประจำแบบ optional)
└── ข้อมูลโปรไฟล์อื่น ๆ
```

Derived display data:

```text
คณะ
ภาควิชา
สาขาวิชา
ปีที่เข้าศึกษา 67 / 68 / 69
ชั้นปี
กลุ่มเรียน
```

Section academic targeting:

```text
สาขาวิชา
+
ปีที่เข้าศึกษา
+
กลุ่มเรียน (optional)
```

Example:

```text
สาขาวิชา IT
ปีที่เข้าศึกษา 67
```

or:

```text
IT ปีที่เข้าศึกษา 67 กลุ่ม RA
IT ปีที่เข้าศึกษา 67 กลุ่ม RB
```

Room and device infrastructure:

```text
ชั้น (Floor)
└── ห้องในชั้น (Physical Room)
    └── ห้องสอบ (Exam Room, optional one-to-one)
        └── ที่นั่ง (Room Seat)
            └── เครื่องคอมพิวเตอร์ (optional one-to-one)
```

New Physical Room codes are generated from Floor + suffix, while legacy full codes remain readable. The `ห้องสอบ` tab lists all Physical Rooms directly beneath its filters without Floor overview cards or a selected-Floor panel.

The system should remain simple enough for an exam submission application while preserving valid academic relationships and existing Student, Teacher, and Admin flows.
