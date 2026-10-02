import { courseOfferingSettings } from '../services/courseState';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppContext, AppContextType, defaultSecurityRules, ToastMessage } from './AppContext';
import { api } from '../services/apiClient';
import { adminFromApi, assignmentFromApi, auditFromApi, candidateFromApi, courseFromApi, examFromApi, examWritePayload, legacySeatLabel, roomFromApi, studentFromApi, submissionFromApi, teacherFromApi, violationFromApi } from '../services/apiAdapters';
import type { ApiAssignment, ApiAudit, ApiCandidate, ApiCourse, ApiDevice, ApiExam, ApiRecord, ApiRoom, ApiSubmission, ApiUser, ApiViolation } from '../types/api';
import type { AcademicInput, AcademicState, AcademicTier } from '../types/academic';
import type { CourseInput, SectionInput } from '../types/course';
import type { RoomAction, RoomState } from '../types/rooms';
import type { Admin, Course, ExamSession, Student, Teacher, Violation } from '../types';
import { academicSettings } from '../utils/academicYear';
import { getTranslation } from '../i18n/translations';
import { getAdminRouteFromHash } from '../utils/adminRoutes';
import { synchronizeServerClock } from '../services/serverClock';
import { setExamDraftOwner } from '../services/examDraftNamespace';

const emptyAcademic: AcademicState = { faculties: [], departments: [], majors: [], classGroups: [], classGroupSequenceCounters: {} };
const emptyRooms: RoomState = { version: 2, floors: [], physicalRooms: [], rooms: [], seats: [], computers: [] };
const initialGraph = {
  users: [] as ApiUser[], courses: [] as ApiCourse[], exams: [] as ApiExam[], rooms: [] as ApiRoom[],
  students: [] as Student[], academic: emptyAcademic, roomState: emptyRooms,
  assignments: [] as ApiAssignment[], submissions: [] as ApiSubmission[], violations: [] as ApiViolation[], audits: [] as ApiAudit[],
  security: { ...defaultSecurityRules, whitelistedUrls: [] as string[] }, securityVersion: 1,
  overview: {} as Record<string, unknown>,
  participantIds: {} as Record<string, string[]>, teacherCatalog: [] as Teacher[],
};

const unique = <T extends { id: string }>(records: T[]): T[] => [...new Map(records.map((record) => [record.id, record])).values()];
const tierPath = (tier: AcademicTier) => tier === 'classGroups' ? 'class-groups' : tier;
const studentProfile = (student: Omit<Student, 'id'>) => ({
  studentCode: student.studentCode, majorId: student.majorId, admissionYear: student.admissionYear, classGroupId: student.classGroupId || null,
  ...Object.fromEntries(['firstName', 'lastName', 'firstNameTh', 'lastNameTh', 'firstNameEn', 'lastNameEn'].map((key) => [key, student[key as keyof Student] || null])),
});
const teacherProfile = (teacher: Omit<Teacher, 'id'>) => ({ teacherCode: teacher.teacherCode, departmentId: teacher.departmentId, icitProfileStatus: teacher.icitProfileStatus });

/** API state has no browser-seed fallback and never writes mock domain storage. */
export const ApiAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [graph, setGraph] = useState(initialGraph);
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const userRef = useRef(user);
  userRef.current = user;
  const generation = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [adminRoute, setAdminRoute] = useState(getAdminRouteFromHash);
  const [teacherRoute, setTeacherRoute] = useState('T1');
  const [studentStep, setStudentStep] = useState<AppContextType['activeStudentStep']>('ST1');
  const [examId, setExamId] = useState('');
  const [alert, setAlert] = useState<Violation | null>(null);
  const showToast = useCallback<AppContextType['showToast']>((title, message, type = 'info') => {
    const id = crypto.randomUUID();
    setToasts((items) => [...items, { id, title, message, type }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 6000);
  }, []);

  const load = useCallback(async (actor: ApiUser, stamp: number, full = true) => {
    const exams = await api.all<ApiExam>('/exams');
    if (exams[0]) synchronizeServerClock(exams[0].serverNow);
    const staff = actor.role !== 'student';
    const [assignments, submissions, violations, overview] = await Promise.all([
      Promise.all(exams.map((exam) => api.request<{ items: ApiAssignment[] }>(`/exams/${exam.id}/seat-assignments`))).then((items) => items.flatMap((item) => item.items)),
      staff ? Promise.all(exams.map((exam) => api.all<ApiSubmission>(`/exams/${exam.id}/submissions`))).then((items) => items.flat()) : Promise.resolve([]),
      api.all<ApiViolation>('/violations'),
      staff ? api.request<Record<string, unknown>>(actor.role === 'admin' ? '/admin/overview' : '/monitoring/overview') : Promise.resolve({}),
    ]);
    if (generation.current !== stamp) return;
    if (!full) {
      setGraph((prior) => ({ ...prior, exams, assignments, submissions, violations, overview }));
      return;
    }
    const [settings, faculties, departments, majors, classGroups, courses, users] = await Promise.all([
      api.request<{ currentAcademicYear: number; currentSemester: string }>('/academic/settings'),
      api.all<AcademicState['faculties'][number]>('/academic/faculties'),
      api.all<AcademicState['departments'][number]>('/academic/departments'),
      api.all<AcademicState['majors'][number]>('/academic/majors'),
      api.all<AcademicState['classGroups'][number]>('/academic/class-groups'),
      api.all<ApiCourse>('/courses'),
      actor.role === 'admin' ? api.all<ApiUser>('/users') : Promise.resolve([actor]),
    ]);
    const teacherSummaries = actor.role === 'teacher' ? await api.all<{ id: string; fullName: string; teacherCode: string; departmentId: string; accountStatus: Teacher['accountStatus'] }>('/teachers') : [];
    const teacherCatalog: Teacher[] = teacherSummaries.map((person) => {
      const department = departments.find((item) => item.id === person.departmentId);
      const faculty = faculties.find((item) => item.id === department?.facultyId);
      return { ...person, role: 'teacher', email: '', facultyId: faculty?.id, faculty: faculty?.name || '', department: department?.name || '', icitProfileStatus: 'pending' };
    });
    const sections = courses.flatMap((course) => course.sections);
    const [roomSummaries, floors, physicalRooms, devices, rosterStudents, audits, security] = await Promise.all([
      staff ? api.all<ApiRoom>('/rooms/exam-rooms') : Promise.resolve([]),
      actor.role === 'admin' ? api.all<RoomState['floors'][number]>('/rooms/floors') : Promise.resolve([]),
      actor.role === 'admin' ? api.all<RoomState['physicalRooms'][number]>('/rooms/physical-rooms') : Promise.resolve([]),
      actor.role === 'admin' ? api.all<ApiDevice>('/devices') : Promise.resolve([]),
      actor.role === 'teacher' ? Promise.all(sections.map((section) => api.all<ApiCandidate>(`/sections/${section.id}/roster`))).then((records) => unique(records.flat()).map(candidateFromApi)) : Promise.resolve([]),
      actor.role === 'admin' ? api.all<ApiAudit>('/admin/audit-logs') : Promise.resolve([]),
      actor.role === 'admin' ? api.request<typeof initialGraph.security & { rowVersion: number; allowedDomains: string[] }>('/admin/security-settings') : Promise.resolve(null),
    ]);
    const layouts = await Promise.all(roomSummaries.map((room) => actor.role === 'admin' || exams.some((exam) => exam.roomId === room.id)
      ? api.request<ApiRoom>(`/rooms/exam-rooms/${room.id}`) : Promise.resolve(room)));
    // Past participant snapshots remain readable after a Student leaves the live roster.
    const historical = staff ? await Promise.all(exams.filter((exam) => exam.rosterFrozenAt).map(async (exam) => {
      const records = await api.all<{ studentId: string; studentCodeSnapshot: string; nameSnapshot: string; majorId: string; admissionYearSnapshot: number; classGroupId: string | null; accountStatus: Student['accountStatus'] }>(`/exams/${exam.id}/participants`);
      const students = records.map((record): Student => ({ id: record.studentId, studentCode: record.studentCodeSnapshot, fullName: record.nameSnapshot,
        majorId: record.majorId, admissionYear: record.admissionYearSnapshot, classGroupId: record.classGroupId || undefined,
        email: '', faculty: '', department: '', year: settings.currentAcademicYear - record.admissionYearSnapshot + 1,
        accountStatus: record.accountStatus, faceReferenceUrl: '', faceReferenceStatus: 'missing' }));
      return { examId: exam.id, students };
    })) : [];
    if (generation.current !== stamp) return;
    academicSettings.currentAcademicYear = settings.currentAcademicYear;
    courseOfferingSettings.currentSemester = settings.currentSemester === 'summer' ? 'summer' : settings.currentSemester === '2' ? 2 : 1;
    const roomState: RoomState = { version: 2, floors, physicalRooms,
      rooms: layouts.map((room) => ({ id: room.id, physicalRoomId: room.physicalRoomId, rows: room.rows, columns: room.columns, status: room.status, rowVersion: room.rowVersion })),
      seats: layouts.flatMap((room) => (room.seats || []).map((seat) => ({ id: seat.id, roomId: room.id, row: seat.rowNumber, column: seat.columnNumber,
        seatCode: seat.seatCode, examSeatNo: legacySeatLabel(seat.rowNumber, seat.columnNumber) }))),
      computers: devices.map((device) => ({ ...device, machineStatus: 'unknown' })),
    };
    setGraph({ users, teacherCatalog, courses, exams, rooms: layouts, assignments, submissions, violations, audits, overview, roomState,
      participantIds: Object.fromEntries(historical.map((entry) => [entry.examId, entry.students.map((student) => student.id)])),
      academic: { faculties, departments, majors, classGroups, classGroupSequenceCounters: {} },
      students: actor.role === 'admin' ? users.filter((item) => item.role === 'student').map(studentFromApi) : actor.role === 'student' ? [studentFromApi(actor)] : unique([...historical.flatMap((entry) => entry.students), ...rosterStudents]),
      security: security ? { ...security, whitelistedUrls: security.allowedDomains } : initialGraph.security,
      securityVersion: security?.rowVersion || 1,
    });
    setError('');
  }, []);

  const refresh = useCallback(async () => {
    const stamp = generation.current;
    const actor = await api.request<ApiUser>('/auth/me');
    if (generation.current !== stamp) return;
    setUser(actor);
    setExamDraftOwner(actor.id);
    await load(actor, stamp);
  }, [load]);
  useEffect(() => {
    api.onSignedOut = () => {
      generation.current += 1;
      setUser(null); setGraph(initialGraph); setExamId(''); setAlert(null); setExamDraftOwner(null); setLoading(false);
    };
    api.onSessionChanged = () => { void refresh().catch(() => {}); };
    let mounted = true;
    refresh().catch((failure) => { if (mounted && failure.status !== 401) setError(failure.message); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; generation.current += 1; api.onSignedOut = null; api.onSessionChanged = null; };
  }, [refresh]);
  useEffect(() => {
    if (!user) return;
    let busy = false;
    const timer = window.setInterval(async () => {
      if (busy || document.hidden) return;
      busy = true;
      try { await load(user, generation.current); }
      catch (failure) { setError(failure instanceof Error ? failure.message : 'ไม่สามารถปรับปรุงข้อมูลได้'); }
      finally { busy = false; }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [user, load]);

  const mutate = async <T,>(path: string, method: string, body?: unknown, idempotent = false): Promise<{ success: boolean; error?: string; result?: T }> => {
    try {
      const result = await api.request<T>(path, { method, body, idempotent });
      // Saving succeeded even if a later read fails; retain the committed receipt.
      try { await refresh(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'บันทึกแล้ว แต่ยังโหลดข้อมูลใหม่ไม่ได้'); }
      showToast('บันทึกสำเร็จ', undefined, 'success');
      return { success: true, result };
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'ไม่สามารถบันทึกได้';
      showToast('บันทึกไม่สำเร็จ', message, 'error');
      return { success: false, error: message };
    }
  };
  const blocked = () => showToast('ยังไม่พร้อมใช้งาน', 'ความสามารถนี้ยังไม่มีการเชื่อมต่อจริงใน API mode', 'info');
  const version = (record?: { rowVersion?: number }) => {
    if (!record?.rowVersion) throw new Error('กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก');
    return record.rowVersion;
  };
  const createUser = async (role: ApiUser['role'], record: Omit<Student | Teacher | Admin, 'id'>) => {
    const profile = role === 'student' ? studentProfile(record as Student) : role === 'teacher' ? teacherProfile(record as Teacher) : { adminCode: (record as Admin).adminCode };
    return (await mutate('/users', 'POST', { role, email: record.email, fullName: record.fullName, accountStatus: record.accountStatus, profile })).success;
  };
  const editUser = async (id: string, updates: Partial<Student | Teacher | Admin>) => {
    const prior = graphRef.current.users.find((item) => item.id === id);
    if (!prior) return false;
    const full = { ...(prior.role === 'student' ? studentFromApi(prior) : prior.role === 'teacher' ? teacherFromApi(prior) : adminFromApi(prior)), ...updates };
    if (updates.accountStatus && updates.accountStatus !== prior.accountStatus) return (await mutate(`/users/${id}/status`, 'PATCH', { status: updates.accountStatus,
      reason: 'statusReason' in updates ? updates.statusReason : null, expectedVersion: updates.rowVersion || version(prior) })).success;
    return (await mutate(`/users/${id}`, 'PATCH', { email: full.email, fullName: full.fullName,
      profile: prior.role === 'student' ? studentProfile(full as Student) : prior.role === 'teacher' ? teacherProfile(full as Teacher) : { adminCode: (full as Admin).adminCode },
      expectedVersion: updates.rowVersion || version(prior) })).success;
  };
  const academicWrite = async (tier: AcademicTier, input: AcademicInput, id?: string) => {
    const prior = graphRef.current.academic[tier].find((item) => item.id === id);
    const body = { name: input.name, status: input.status,
      ...(tier === 'classGroups' ? { majorId: input.majorId, admissionYear: input.admissionYear } : { code: input.code }),
      ...(tier === 'departments' ? { facultyId: input.facultyId } : {}), ...(tier === 'majors' ? { departmentId: input.departmentId } : {}),
      ...(id ? { expectedVersion: input.expectedVersion || version(prior) } : {}),
    };
    return mutate(`/academic/${tierPath(tier)}${id ? `/${id}` : ''}`, id ? 'PATCH' : 'POST', body);
  };
  const sectionRecord = (id: string) => graphRef.current.courses.flatMap((course) => course.sections).find((section) => section.id === id);
  const courseWrite = (input: CourseInput, id?: string) => mutate(`/courses${id ? `/${id}` : ''}`, id ? 'PATCH' : 'POST',
    { code: input.code, name: input.name, departmentId: input.departmentId, status: input.status,
      ...(id ? { expectedVersion: input.expectedVersion || version(graphRef.current.courses.find((course) => course.id === id)) } : {}) });
  const sectionWrite = (input: SectionInput, id?: string) => mutate(`/sections${id ? `/${id}` : ''}`, id ? 'PATCH' : 'POST',
    { ...input, semester: String(input.semester), ...(id ? { expectedVersion: input.expectedVersion || version(sectionRecord(id)) } : {}) });
  const manageRooms = async (action: RoomAction) => {
    const state = graphRef.current.roomState;
    const actionVersion = (action as RoomAction & { expectedVersion?: number }).expectedVersion;
    if (action.type === 'delete') {
      const route = { floors: '/rooms/floors', physicalRooms: '/rooms/physical-rooms', rooms: '/rooms/exam-rooms', computers: '/devices' }[action.entity];
      return mutate(`${route}/${action.id}`, 'DELETE');
    }
    if (action.type === 'layout') return mutate(`/rooms/exam-rooms/${action.roomId}/layout`, 'PUT', { rows: action.rows, columns: action.columns,
      expectedVersion: actionVersion || version(graphRef.current.rooms.find((room) => room.id === action.roomId)) });
    const route = { floor: '/rooms/floors', physicalRoom: '/rooms/physical-rooms', room: '/rooms/exam-rooms', computer: '/devices' }[action.type];
    const prior = action.type === 'floor' ? state.floors.find((item) => item.id === action.id) : action.type === 'physicalRoom'
      ? state.physicalRooms.find((item) => item.id === action.id) : action.type === 'room' ? graphRef.current.rooms.find((item) => item.id === action.id)
        : state.computers.find((item) => item.id === action.id);
    const body = action.type === 'floor' ? { floorNumber: action.floorNumber, status: action.status }
      : action.type === 'physicalRoom' ? { floorId: action.floorId, suffix: action.roomCode.split('-').slice(1).join('-') || action.roomCode, status: action.status }
        : action.type === 'room' ? { physicalRoomId: action.physicalRoomId, status: action.status }
          : { computerCode: action.computerCode, serialNumber: action.serialNumber, ipAddress: action.ipAddress, macAddress: action.macAddress, seatId: action.seatId, status: action.status };
    return mutate(`${route}${action.id ? `/${action.id}` : ''}`, action.id ? 'PATCH' : 'POST', { ...body,
      ...(action.id ? { expectedVersion: actionVersion || version(prior as { rowVersion?: number }) } : {}) });
  };
  const examRecord = (id: string) => graphRef.current.exams.find((exam) => exam.id === id);
  const examMutation = async (id: string, suffix: string, method: string, body?: object, idempotent = false) => {
    const record = examRecord(id);
    return mutate(`/exams/${id}${suffix}`, method, { ...body, expectedVersion: version(record) }, idempotent);
  };
  const projectedRooms = graph.rooms.map(roomFromApi);
  const assignments = graph.assignments.map((assignment) => assignmentFromApi(assignment, projectedRooms.find((room) => room.id === graph.exams.find((exam) => exam.id === assignment.examId)?.roomId)));
  const value: AppContextType = {
    apiLoading: loading, apiError: error, apiUser: user, apiRefresh: refresh,
    apiLogin: async (email, password) => { setLoading(true); try { await api.login(email, password); await refresh(); } finally { setLoading(false); } },
    apiOverview: graph.overview,
    language: 'th', setLanguage: () => {}, toggleLanguage: () => {}, t: (key, fallback) => getTranslation(key, 'th', fallback),
    role: user?.role || null, setRole: (role) => { if (role === null) void api.logout().catch((failure) => showToast('ออกจากระบบในอุปกรณ์นี้แล้ว', failure.message, 'warning')); },
    activeAdminRoute: adminRoute, setActiveAdminRoute: setAdminRoute, activeTeacherRoute: teacherRoute, setActiveTeacherRoute: setTeacherRoute,
    activeStudentStep: studentStep, setActiveStudentStep: setStudentStep,
    currentStudent: user?.role === 'student' ? studentFromApi(user) : null, setCurrentStudent: () => {},
    currentTeacher: user?.role === 'teacher' ? teacherFromApi(user) : null, setCurrentTeacher: () => {},
    currentAdmin: user?.role === 'admin' ? adminFromApi(user) : null, setCurrentAdmin: () => {},
    currentExamId: examId, setCurrentExamId: setExamId, studentExamAttemptId: '', startStudentExamAttempt: blocked,
    mockAuthUsers: [], completeMockRegistration: () => ({ success: false, error: 'ใช้ลิงก์ตั้งรหัสผ่านจากผู้ดูแลระบบ' }),
    activeViolationAlert: alert, setActiveViolationAlert: setAlert,
    acknowledgeViolation: async (id) => { await mutate(`/violations/${id}/${user?.role === 'student' ? 'seen' : 'review'}`, 'POST'); },
    securityRules: graph.security,
    updateSecurityRules: async (updates) => { const full = { ...graphRef.current.security, ...updates }; await mutate('/admin/security-settings', 'PUT', {
      multipleFaceDetection: full.multipleFaceDetection, lookingAwayDetection: full.lookingAwayDetection, lookingAwayThresholdSeconds: full.lookingAwayThresholdSeconds,
      windowSwitchDetection: full.windowSwitchDetection, allowedWindowSwitches: full.allowedWindowSwitches, urlWhitelistEnforcement: full.urlWhitelistEnforcement,
      allowedDomains: full.whitelistedUrls, expectedVersion: graphRef.current.securityVersion,
    }); },
    academicState: graph.academic, saveAcademicRecord: academicWrite,
    saveAcademicStructure: async (draft) => { const result = await mutate<import('../services/academicStructureWizard').AcademicStructureTransactionResult>('/academic/structures', 'POST', {
      ...draft, ...Object.fromEntries(['faculty', 'department', 'major'].map((key) => { const choice = draft[key as 'faculty']; return [key, { ...choice, existingId: choice.existingId || null }]; })),
    }, true); return { ...result.result, success: result.success, error: result.error, groupCodes: result.result?.groupCodes || [] }; },
    deleteAcademicRecord: (tier, id) => mutate(`/academic/${tierPath(tier)}/${id}`, 'DELETE'),
    setAcademicStatus: (tier, id, status) => { const prior = graphRef.current.academic[tier].find((item) => item.id === id)!; return academicWrite(tier,
      { ...prior, facultyId: 'facultyId' in prior ? String(prior.facultyId) : '', departmentId: 'departmentId' in prior ? String(prior.departmentId) : '', status, expectedVersion: prior.rowVersion }, id); },
    assignStudentsToClassGroup: (id, studentIds, allowReassign = false) => mutate(`/academic/class-groups/${id}/student-assignments`, 'POST', { studentIds, allowReassign }, true),
    students: graph.students, studentDirectory: user?.role === 'admin' ? graph.students : [],
    teachers: unique([...graph.teacherCatalog, ...graph.users.filter((item) => item.role === 'teacher').map(teacherFromApi)]), admins: graph.users.filter((item) => item.role === 'admin').map(adminFromApi),
    rooms: projectedRooms, roomState: graph.roomState, manageRooms, courses: graph.courses.map(courseFromApi),
    examSessions: graph.exams.map((exam) => ({ ...examFromApi(exam), eligibleStudentIds: graph.participantIds[exam.id] })),
    seatAssignments: assignments, submissions: graph.submissions.map(submissionFromApi), violations: graph.violations.map((event) => violationFromApi(event, assignments)), auditLogs: graph.audits.map(auditFromApi),
    toasts, showToast, dismissToast: (id) => setToasts((items) => items.filter((toast) => toast.id !== id)),
    addStudent: (record) => createUser('student', record), updateStudent: editUser, deleteStudent: async (id) => (await mutate(`/users/${id}`, 'DELETE')).success,
    addTeacher: (record) => createUser('teacher', record), updateTeacher: editUser, deleteTeacher: async (id) => (await mutate(`/users/${id}`, 'DELETE')).success,
    addAdmin: (record) => createUser('admin', record), updateAdmin: editUser, deleteAdmin: async (id) => (await mutate(`/users/${id}`, 'DELETE')).success,
    updateAccountStatus: async (id, status, reason, expectedVersion) => (await mutate(`/users/${id}/status`, 'PATCH', { status, reason: reason || null, expectedVersion: expectedVersion || version(graphRef.current.users.find((item) => item.id === id)) })).success,
    updateFaceReference: blocked,
    saveCourseRecord: courseWrite, saveSectionRecord: sectionWrite,
    addCourse: async (record) => { await courseWrite({ ...record, code: record.courseCode, name: record.courseName } as CourseInput); },
    updateCourse: async (id, updates) => { const prior = graphRef.current.courses.find((item) => item.id === id)!; await courseWrite({ ...prior, ...updates } as CourseInput, id); },
    deleteCourse: async (id) => (await mutate(`/courses/${id}`, 'DELETE')).success,
    deleteSectionRecord: (id) => mutate(`/sections/${id}`, 'DELETE'),
    setSectionStatus: (id, status) => { const prior = sectionRecord(id)!; return sectionWrite({ ...prior, status, semester: prior.semester === 'summer' ? 'summer' : Number(prior.semester) as 1 | 2 }, id); },
    addStudentToSection: (studentId, id) => mutate(`/sections/${id}/roster/inclusions`, 'POST', { studentId }),
    moveStudentBetweenSections: (studentId, from, to) => mutate(`/sections/${from}/roster/moves`, 'POST', { studentId, targetSectionId: to }, true),
    findStudentSectionInCourse: () => null,
    createExamSession: async (record) => { const result = await mutate('/exams', 'POST', examWritePayload(record), true); return result.success; },
    updateExamSession: async (id, updates) => { const prior = examRecord(id)!; const full = { ...examFromApi(prior), ...updates }; const result = await mutate(`/exams/${id}`, 'PATCH', { ...examWritePayload(full), expectedVersion: updates.rowVersion || version(prior) }); return result.success; },
    adjustExamTime: async (id, deltaMinutes, _scope, _student, reason) => { await examMutation(id, '/time-adjustments', 'POST', { deltaMinutes, reason: reason || '' }, true); },
    reopenSubmission: async (id, minutes, scope, studentId, reason) => { const result = await mutate<{ affectedCount: number; skipped: unknown[] }>(`/exams/${id}/submission-reopens`, 'POST', { minutes, scope, ...(scope === 'student' ? { studentId } : {}), reason: reason || '' }, true);
      if (result.result?.skipped.length) showToast('เปิดรับส่งใหม่แล้ว', `ข้าม ${result.result.skipped.length} คนที่ยังไม่เข้าเงื่อนไข`, 'info'); },
    assignSeat: async (id, label, studentId) => { const room = projectedRooms.find((item) => item.id === examRecord(id)?.roomId); const seat = room?.seats.find((item) => item.seatNo === label); return seat?.seatId ? (await examMutation(id, `/seat-assignments/${seat.seatId}`, 'PUT', { studentId })).success : false; },
    unassignSeat: async (id, label) => { const seat = projectedRooms.find((item) => item.id === examRecord(id)?.roomId)?.seats.find((item) => item.seatNo === label); return seat?.seatId ? (await mutate(`/exams/${id}/seat-assignments/${seat.seatId}?expectedVersion=${version(examRecord(id))}`, 'DELETE')).success : false; },
    autoAssignSeats: async (id) => { const result = await examMutation(id, '/seat-assignments/auto', 'POST', {}, true); const receipt = result.result as { unassignedCount?: number } | undefined;
      if (receipt?.unassignedCount) showToast('จัดที่นั่งแล้ว', `ยังไม่มีที่นั่ง ${receipt.unassignedCount} คน`, 'warning'); return result.success; },
    submitStudentFiles: () => false, triggerViolation: blocked, toggleMachineStatus: blocked, resetToMockDefaults: blocked,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
