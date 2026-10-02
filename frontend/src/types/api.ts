import type { AccountStatus, ExamPolicy, ExamType, Role, SectionCohort } from '../types';

export interface ApiRecord {
  id: string;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiStudentProfile {
  studentCode: string;
  firstName?: string | null;
  lastName?: string | null;
  firstNameTh?: string | null;
  lastNameTh?: string | null;
  firstNameEn?: string | null;
  lastNameEn?: string | null;
  majorId: string;
  admissionYear: number;
  classGroupId?: string | null;
  facultyId: string;
  facultyName: string;
  departmentId: string;
  departmentName: string;
  majorCode: string;
  majorName: string;
  classGroupCode?: string | null;
  yearLevel: number | null;
}

export interface ApiTeacherProfile {
  teacherCode: string;
  departmentId: string;
  facultyId: string;
  facultyName: string;
  departmentName: string;
  icitProfileStatus: 'pending' | 'confirmed';
}

export interface ApiUser extends ApiRecord {
  role: Role;
  email: string;
  fullName: string;
  accountStatus: AccountStatus;
  statusReason?: string | null;
  activatedAt: string | null;
  profile: ApiStudentProfile | ApiTeacherProfile | { adminCode: string };
  capabilities: Record<string, boolean>;
}

export interface ApiCandidate extends ApiStudentProfile {
  id: string;
  fullName: string;
  accountStatus: AccountStatus;
  conflictSectionId?: string | null;
  canMove?: boolean;
  alreadyEnrolled?: boolean;
}

export interface ApiSection extends ApiRecord {
  courseId: string;
  offeringId: string;
  academicYear: number;
  semester: '1' | '2' | 'summer';
  sectionNumber: number;
  status: 'active' | 'inactive';
  primaryTeacherId: string;
  coTeacherIds: string[];
  cohorts: SectionCohort[];
  includedStudentIds: string[];
  excludedStudentIds: string[];
  studentCount: number;
  activeStudentCount: number;
}

export interface ApiCourse extends ApiRecord {
  code: string;
  name: string;
  departmentId: string;
  facultyId: string;
  facultyName: string;
  departmentName: string;
  status: 'active' | 'inactive';
  sections: ApiSection[];
}

export interface ApiDevice extends ApiRecord {
  computerCode: string;
  serialNumber: string;
  ipAddress: string;
  macAddress: string;
  seatId: string | null;
  status: 'ready' | 'maintenance' | 'inactive';
  runtimeStatus: 'unknown';
  isAssignable: boolean;
}

export interface ApiSeat extends ApiRecord {
  examRoomId: string;
  rowNumber: number;
  columnNumber: number;
  seatCode: string;
  isAssignable: boolean;
  device: ApiDevice | null;
}

export interface ApiRoom extends ApiRecord {
  physicalRoomId: string;
  status: 'ready' | 'maintenance' | 'inactive';
  rows: number;
  columns: number;
  floorId: string;
  floorNumber: number;
  roomCode: string;
  capacity: number;
  computerCount?: number;
  isAssignable: boolean;
  runtimeStatus: 'unknown';
  seats?: ApiSeat[];
}

export interface ApiExam extends ApiRecord {
  revision: number;
  sectionId: string;
  roomId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  sectionNumber: number;
  academicYear: number;
  semester: string;
  roomCode: string;
  floorNumber: number;
  name: string;
  examType: ExamType;
  mode: 'online' | 'offline';
  startsAt: string;
  scheduledEndAt: string;
  endsAt: string;
  maxFileSizeBytes: number;
  requiredFileCount: number;
  filenamePattern: string;
  automaticFilenameTemplate?: string | null;
  instructions: string;
  acceptedExtensions: string[];
  rules: { id: string; text: string; isCustom: boolean }[];
  policy: ExamPolicy;
  status: 'upcoming' | 'in_progress' | 'completed';
  durationMinutes: number;
  adjustedMinutes: number;
  rosterFrozenAt?: string | null;
  participantCount: number;
  serverNow: string;
  capabilities: Record<string, boolean>;
}

export interface ApiFile extends ApiRecord {
  uploadId: string;
  versionId: string;
  uploadSequence: number;
  originalName: string;
  submissionName: string;
  extension: string;
  clientMime?: string | null;
  expectedSizeBytes: number;
  sizeBytes?: number | null;
  state: 'reserved' | 'receiving' | 'ready' | 'failed' | 'removed';
  sha256: string | null;
  receivedAt: string | null;
  failureCode?: string | null;
}

export interface ApiVersion extends ApiRecord {
  attemptId: string;
  submissionId: string;
  versionNumber: number;
  state: 'open' | 'final' | 'expired';
  reopenGrantId: string | null;
  finalizedAt: string | null;
  finalizationSource: 'manual' | 'timeout' | null;
  timeliness: 'on_time' | 'late' | null;
  deadline: string;
  requiredFileCount: number;
  receivedFileCount: number;
  isComplete: boolean;
  files: ApiFile[];
  serverNow: string;
}

export interface ApiSubmission extends ApiRecord {
  examId: string;
  studentId: string;
  status: 'not_submitted' | 'in_progress' | 'submitted' | 'late';
  latestFinalVersion: ApiVersion | null;
  openVersion: ApiVersion | null;
  hasOpenVersion: boolean;
  serverNow: string;
}

export interface ApiAssignment {
  examId: string;
  studentId: string;
  seatId: string;
  deviceId: string;
  seatCode: string;
  device: ApiDevice;
}

export interface ApiAccess {
  examId: string;
  examRevision: number;
  eligible: boolean;
  status: ApiExam['status'];
  serverNow: string;
  deadline: string;
  seat: ApiAssignment | null;
  submission: ApiSubmission | null;
  reopenGrant: { id: string; expiresAt: string; reason: string } | null;
  capabilities: Record<string, boolean>;
}

export interface ApiViolation extends ApiRecord {
  examId: string;
  studentId: string;
  seatId: string | null;
  source: 'development_simulation';
  type: import('../types').ViolationType;
  detail: string;
  studentSeenAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  acknowledged: boolean;
}

export interface ApiAudit {
  id: string;
  createdAt: string;
  actorId: string | null;
  actorRoleSnapshot: Role | null;
  action: string;
  targetType: string;
  targetId: string | null;
  outcome: 'success' | 'warning' | 'failure';
  metadata: Record<string, unknown>;
  peerIp: string | null;
}
