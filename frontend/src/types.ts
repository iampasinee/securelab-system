export type Role = 'admin' | 'teacher' | 'student';

export type AppLanguage = 'th' | 'en';

export type AccountStatus = 'active' | 'suspended' | 'graduated_inactive';

export type RoomReadiness = 'ready' | 'maintenance' | 'unavailable';

export type MachineStatus = 'online' | 'offline' | 'damaged' | 'unavailable';

export type ExamFormat = 'offline' | 'online';

export type ExamSessionStatus = 'upcoming' | 'in_progress' | 'completed';

export type ExamType = 'midterm' | 'final' | 'lab' | 'quiz' | 'other';

export interface ExamResourceRule {
  id: string;
  name: string;
  type: 'website' | 'web_app' | 'application';
  value: string;
  category?: string;
}

export interface ExamPolicy {
  common: {
    requireRegisteredDevice: boolean;
    requireAgent: boolean;
    requireFaceBeforeExam: boolean;
    requirePeriodicFaceCheck: boolean;
    preventDuplicateSession: boolean;
    blockUsbStorage: boolean;
    logViolations: boolean;
  };
  file: {
    requireExamWorkspace: boolean;
    requireDeviceSignature: boolean;
    lockAfterFinalSubmit: boolean;
    blockExternalStorageSource: boolean;
  };
  online: {
    resourceMode: 'allowlist' | 'blocklist';
    allowedDomains: string[];
    /** Allowlist-specific selections. Absent on older records; never reinterpret blockedResources as allowed. */
    allowedResources?: ExamResourceRule[];
    blockedResources: ExamResourceRule[];
    blockUnknownApplications: boolean;
    restrictBrowser: boolean;
    blockCommunicationApps: boolean;
    blockRemoteDesktop: boolean;
  };
  offline: {
    blockInternet: boolean;
    localServerOnly: boolean;
    localServerHost: string;
    isolateClients: boolean;
    blockSsh: boolean;
    blockSmb: boolean;
    blockFtp: boolean;
    blockScp: boolean;
    blockRemoteDesktop: boolean;
    blockExternalNetwork: boolean;
  };
}

export type StudentExamStatus = 'not_started' | 'working' | 'submitted' | 'late' | 'violation' | 'offline' | 'reopened';

export type FileIntegrityStatus = 'valid' | 'invalid' | 'damaged' | 'pending';

export type ViolationType = 'unauthorized_website' | 'duplicate_login' | 'unauthorized_device' | 'tab_switch' | 'peripheral_connected';

export interface Student {
  id: string;
  studentCode: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  firstNameTh?: string;
  lastNameTh?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  email: string;
  /** Canonical academic assignment. Parent faculty/department are derived from this ID. */
  majorId?: string;
  /** Full Buddhist admission year, for example 2567. */
  admissionYear?: number;
  /** Derived/legacy display fields kept temporarily for migration compatibility. */
  faculty: string;
  facultyId?: string;
  department: string;
  year: number;
  departmentId?: string;
  programId?: string;
  program?: string;
  programCode?: string;
  classGroupId?: string;
  classGroup?: string;
  yearLevel?: number;
  yearLevelId?: string;
  faceReferenceStatus?: 'available' | 'missing';
  faceReferenceUrl: string;
  accountStatus: AccountStatus;
  statusReason?: string;
  isFirstTime?: boolean;
}

export interface SectionCohort {
  majorId: string;
  admissionYear: number;
  /** Empty/undefined targets the whole Major + admissionYear cohort. */
  classGroupIds?: string[];
}

export interface Teacher {
  id: string;
  teacherCode: string;
  fullName: string;
  email: string;
  /** Canonical organizational affiliation. Department must belong to Faculty. */
  facultyId?: string;
  departmentId?: string;
  /** Legacy display fallbacks retained for safe persisted-data migration. */
  faculty: string;
  department: string;
  role: 'teacher';
  icitProfileStatus: 'confirmed' | 'pending';
  accountStatus: AccountStatus;
}

export interface Admin {
  id: string;
  adminCode: string;
  fullName: string;
  email: string;
  role: 'admin';
  accountStatus: AccountStatus;
}

export interface SeatBinding {
  seatNo: string;
  machineNo: string;
  ip: string;
  mac: string;
  status: MachineStatus;
  disabled?: boolean;
}

export interface Room {
  id: string;
  building: string;
  floor: number;
  labName: string;
  status: RoomReadiness;
  rows: number;
  columns: number;
  deskOrientation: 'front' | 'angled' | 'pod';
  seats: SeatBinding[];
}

export interface Section {
  id?: string;
  courseId?: string;
  sectionNo: string;
  sectionNumber?: number;
  semester: 1 | 2 | 'summer' | number | string;
  academicYear: number;
  teacherId: string;
  primaryTeacherId?: string;
  coTeacherIds?: string[];
  /** Canonical student targeting for a section. */
  cohorts?: SectionCohort[];
  /** Individual exceptions to the cohort roster; Student master data stays unchanged. */
  includedStudentIds?: string[];
  excludedStudentIds?: string[];
  /** Legacy persisted relationship; read only by the forward migration. */
  groupIds?: string[];
  status?: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
  studentCount?: number;
}

export interface Course {
  id: string;
  courseCode: string;
  courseName: string;
  code?: string;
  name?: string;
  faculty: string;
  facultyId?: string;
  department: string;
  departmentId?: string;
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
  sections: Section[];
}

export interface ExamRule {
  id: string;
  text: string;
  isCustom?: boolean;
}

export interface ExamSession {
  id: string;
  examName?: string;
  examType?: ExamType;
  courseId: string;
  sectionNo: string;
  examDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  adjustedMinutes?: number;
  roomId: string;
  format: ExamFormat;
  fileRequirements: {
    acceptedExtensions: string[]; // e.g. ['.zip', '.py']
    maxSizeMb: number;
    filenamePattern: string; // e.g. "{studentCode}_final"
    automaticFilenamePattern?: string;
    requiredFileCount: number;
    instructions: string;
  };
  rules: ExamRule[];
  /** Frontend policy configuration for future SecureLab Agent/backend enforcement. */
  policy?: ExamPolicy;
  status: ExamSessionStatus;
  /** Frozen when an active/completed exam could be affected by a roster override. */
  eligibleStudentIds?: string[];
  reopenedStudents?: { [studentId: string]: { reopenedUntil: string; reason: string } };
}

export interface SeatAssignment {
  examId: string;
  seatNo: string;
  studentId: string;
}

export interface SubmittedFile {
  uploadId?: string;
  fileName: string;
  sizeKb: number;
  submittedAt: string;
  integrityStatus: FileIntegrityStatus;
  integrityMessage?: string;
  contentSnippet?: string;
}

export interface Submission {
  id: string;
  examId: string;
  studentId: string;
  files: SubmittedFile[];
  status: 'not_submitted' | 'in_progress' | 'submitted' | 'late';
  integrityCheck: 'pending' | 'passed' | 'failed';
  submittedAt?: string;
}

export interface Violation {
  id: string;
  examId: string;
  studentId: string;
  seatNo: string;
  type: ViolationType;
  detail: string;
  detectedAt: string;
  acknowledged?: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
}

export type UserRole = Role;
export type ExamRoom = Room;
export type SeatStation = SeatBinding;

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  performedBy: string;
  role: string;
  target: string;
  ip: string;
  status: 'success' | 'warning' | 'failure';
}

export interface CheatDetectionRules {
  multipleFaceDetection: boolean;
  lookingAwayDetection: boolean;
  lookingAwayThresholdSeconds: number;
  windowSwitchDetection: boolean;
  allowedWindowSwitches: number;
  urlWhitelistEnforcement: boolean;
  whitelistedUrls?: string[];
}
