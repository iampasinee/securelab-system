import type { Admin, AuditLog, Course, ExamSession, Room, SeatAssignment, Student, Submission, Teacher, Violation } from '../types';
import type { ApiAssignment, ApiAudit, ApiCandidate, ApiCourse, ApiExam, ApiRoom, ApiStudentProfile, ApiSubmission, ApiTeacherProfile, ApiUser, ApiViolation } from '../types/api';

export const studentFromApi = (user: ApiUser): Student => {
  const profile = user.profile as ApiStudentProfile;
  return {
    id: user.id, studentCode: profile.studentCode, fullName: user.fullName, email: user.email,
    firstName: profile.firstName || undefined, lastName: profile.lastName || undefined,
    firstNameTh: profile.firstNameTh || undefined, lastNameTh: profile.lastNameTh || undefined,
    firstNameEn: profile.firstNameEn || undefined, lastNameEn: profile.lastNameEn || undefined,
    majorId: profile.majorId, admissionYear: profile.admissionYear, classGroupId: profile.classGroupId || undefined,
    classGroup: profile.classGroupCode || undefined, facultyId: profile.facultyId, faculty: profile.facultyName,
    departmentId: profile.departmentId, department: profile.departmentName, program: profile.majorName, programCode: profile.majorCode,
    year: profile.yearLevel || 0, yearLevel: profile.yearLevel || undefined,
    accountStatus: user.accountStatus, statusReason: user.statusReason || undefined,
    faceReferenceUrl: '', faceReferenceStatus: 'missing', isFirstTime: false, rowVersion: user.rowVersion,
  };
};

export const candidateFromApi = (candidate: ApiCandidate): Student => ({
  id: candidate.id, studentCode: candidate.studentCode, fullName: candidate.fullName, email: '',
  majorId: candidate.majorId, admissionYear: candidate.admissionYear, classGroupId: candidate.classGroupId || undefined,
  classGroup: candidate.classGroupCode || undefined, facultyId: candidate.facultyId, faculty: candidate.facultyName,
  departmentId: candidate.departmentId, department: candidate.departmentName, program: candidate.majorName, programCode: candidate.majorCode,
  year: candidate.yearLevel || 0, accountStatus: candidate.accountStatus, faceReferenceUrl: '', faceReferenceStatus: 'missing',
});

export const teacherFromApi = (user: ApiUser): Teacher => {
  const profile = user.profile as ApiTeacherProfile;
  return { id: user.id, teacherCode: profile.teacherCode, fullName: user.fullName, email: user.email, role: 'teacher',
    facultyId: profile.facultyId, faculty: profile.facultyName, departmentId: profile.departmentId, department: profile.departmentName,
    icitProfileStatus: profile.icitProfileStatus, accountStatus: user.accountStatus, rowVersion: user.rowVersion };
};

export const adminFromApi = (user: ApiUser): Admin => ({ id: user.id, adminCode: (user.profile as { adminCode: string }).adminCode,
  fullName: user.fullName, email: user.email, role: 'admin', accountStatus: user.accountStatus, rowVersion: user.rowVersion });

export const courseFromApi = (course: ApiCourse): Course => ({
  id: course.id, courseCode: course.code, courseName: course.name, code: course.code, name: course.name,
  facultyId: course.facultyId, faculty: course.facultyName, departmentId: course.departmentId, department: course.departmentName,
  status: course.status, createdAt: course.createdAt, updatedAt: course.updatedAt, rowVersion: course.rowVersion,
  sections: course.sections.map((section) => ({ ...section, sectionNo: String(section.sectionNumber), teacherId: section.primaryTeacherId })),
});

export const bangkokDateTime = (iso: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const value = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return { date: `${value('year')}-${value('month')}-${value('day')}`, time: `${value('hour')}:${value('minute')}` };
};

export const examFromApi = (exam: ApiExam): ExamSession => ({
  id: exam.id, sectionId: exam.sectionId, courseId: exam.courseId, sectionNo: String(exam.sectionNumber),
  examName: exam.name, examType: exam.examType, examDate: bangkokDateTime(exam.startsAt).date,
  startTime: bangkokDateTime(exam.startsAt).time, endTime: bangkokDateTime(exam.endsAt).time,
  startsAt: exam.startsAt, endsAt: exam.endsAt, serverNow: exam.serverNow, revision: exam.revision, rowVersion: exam.rowVersion,
  durationMinutes: exam.durationMinutes, adjustedMinutes: exam.adjustedMinutes, roomId: exam.roomId, format: exam.mode,
  fileRequirements: { acceptedExtensions: exam.acceptedExtensions, maxSizeMb: exam.maxFileSizeBytes / 1024 / 1024, filenamePattern: exam.filenamePattern,
    automaticFilenamePattern: exam.automaticFilenameTemplate || undefined, requiredFileCount: exam.requiredFileCount, instructions: exam.instructions },
  rules: exam.rules, policy: exam.policy, status: exam.status, capabilities: exam.capabilities,
});

export const legacySeatLabel = (row: number, column: number): string => {
  let label = '';
  while (row) { const digit = (row - 1) % 26; label = String.fromCharCode(65 + digit) + label; row = Math.floor((row - 1) / 26); }
  return `${label}${column}`;
};

export const roomFromApi = (room: ApiRoom): Room => ({
  id: room.id, building: '', floor: room.floorNumber, labName: room.roomCode, rows: room.rows, columns: room.columns,
  status: room.isAssignable ? 'ready' : room.status === 'maintenance' ? 'maintenance' : 'unavailable', deskOrientation: 'front',
  capacity: room.capacity, computerCount: room.computerCount, rowVersion: room.rowVersion,
  seats: (room.seats || []).map((seat) => ({ seatId: seat.id, deviceId: seat.device?.id, seatNo: legacySeatLabel(seat.rowNumber, seat.columnNumber),
    machineNo: seat.device?.computerCode || '—', ip: seat.device?.ipAddress || '—', mac: seat.device?.macAddress || '—',
    status: 'unknown', isAssignable: seat.isAssignable, disabled: !seat.isAssignable })),
});

export const assignmentFromApi = (assignment: ApiAssignment, room?: Room): SeatAssignment => ({
  examId: assignment.examId, studentId: assignment.studentId, seatId: assignment.seatId, deviceId: assignment.deviceId,
  seatNo: room?.seats.find((seat) => seat.seatId === assignment.seatId)?.seatNo || assignment.seatCode,
});

export const submissionFromApi = (root: ApiSubmission): Submission => ({
  id: root.id, examId: root.examId, studentId: root.studentId, status: root.status,
  versionId: root.latestFinalVersion?.id, versionNumber: root.latestFinalVersion?.versionNumber,
  isComplete: root.latestFinalVersion?.isComplete, hasOpenVersion: root.hasOpenVersion,
  integrityCheck: root.latestFinalVersion ? 'passed' : 'pending', submittedAt: root.latestFinalVersion?.finalizedAt || undefined,
  files: (root.latestFinalVersion?.files || []).map((file) => ({ uploadId: file.uploadId, fileName: file.submissionName,
    sizeKb: (file.sizeBytes || 0) / 1024, submittedAt: file.receivedAt || root.latestFinalVersion!.finalizedAt!,
    sha256: file.sha256 || undefined, integrityStatus: 'valid', integrityMessage: 'SHA-256 ของ bytes ที่ backend รับ ไม่ใช่การตรวจโปรแกรมหรือความปลอดภัยของเนื้อหา' })),
});

export const violationFromApi = (event: ApiViolation, assignments: SeatAssignment[]): Violation => ({
  id: event.id, examId: event.examId, studentId: event.studentId, seatNo: assignments.find((seat) => seat.examId === event.examId && seat.studentId === event.studentId)?.seatNo || '—',
  type: event.type, detail: event.detail, detectedAt: event.createdAt, acknowledged: event.acknowledged,
  studentSeenAt: event.studentSeenAt || undefined, reviewedAt: event.reviewedAt || undefined, reviewedBy: event.reviewedBy || undefined, source: event.source,
});

export const auditFromApi = (record: ApiAudit): AuditLog => ({
  id: record.id, timestamp: record.createdAt, actor: record.actorId || 'ระบบ', action: record.action, details: `${record.targetType} ${record.targetId || ''}`,
  performedBy: record.actorId || 'ระบบ', role: record.actorRoleSnapshot || 'ระบบ', target: `${record.targetType} ${record.targetId || ''}`,
  ip: record.peerIp || '—', status: record.outcome,
});

export const examWritePayload = (exam: Omit<ExamSession, 'id'>) => {
  if (!exam.sectionId) throw new Error('กรุณาเลือกตอนเรียนที่ระบุ ID ปีการศึกษา และภาคเรียนชัดเจน');
  const resource = ({ name, type, value, category }: import('../types').ExamResourceRule) => ({ name, type, value, ...(category ? { category } : {}) });
  return {
    sectionId: exam.sectionId, roomId: exam.roomId, name: exam.examName || 'การสอบ', examType: exam.examType || 'other', mode: exam.format,
    startsAt: new Date(`${exam.examDate}T${exam.startTime}:00+07:00`).toISOString(), endsAt: new Date(`${exam.examDate}T${exam.endTime}:00+07:00`).toISOString(),
    maxFileSizeBytes: Math.round(exam.fileRequirements.maxSizeMb * 1024 * 1024), requiredFileCount: exam.fileRequirements.requiredFileCount,
    filenamePattern: exam.fileRequirements.filenamePattern, automaticFilenameTemplate: exam.fileRequirements.automaticFilenamePattern || null,
    instructions: exam.fileRequirements.instructions, acceptedExtensions: exam.fileRequirements.acceptedExtensions,
    rules: exam.rules.map(({ text, isCustom }) => ({ text, isCustom: Boolean(isCustom) })),
    ...(exam.policy ? { policy: { ...exam.policy, online: { ...exam.policy.online,
      allowedResources: (exam.policy.online.allowedResources || []).map(resource), blockedResources: exam.policy.online.blockedResources.map(resource) } } } : {}),
  };
};
