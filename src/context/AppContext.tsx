import { useAcademicYear, withCalculatedStudentYear, withoutStudentYear } from '../utils/academicYear';
import { addCs301DemoCoTeacher } from '../data/teacherCourseDemo';
import { RoomState, RoomAction, RoomActionResult } from '../types/rooms';
import { FaceEnrollmentStatus, MockAuthUser } from '../types/auth';
import { applyRoomAction, migrateRoomState, projectRooms } from '../services/roomState';
import {
  completeMockRegistration as completeMockRegistrationState,
  initialMockAuthUsers,
  migrateMockAuthUsers,
  mockAuthStorageKey,
} from '../services/authState';
import { CourseActionResult, CourseInput, SectionInput } from '../types/course';
import {
  addStudentToSection as addStudentEnrollment, courseDeleteError, coursesForStudent, coursesForTeacher,
  enrollmentExamReferenceError,
  findSection, findStudentEnrollmentInCourse, migrateCourses,
  moveStudentBetweenSections as moveStudentEnrollment, saveCourse, saveSection, sectionDeleteError,
  snapshotAffectedExamRosters, studentMatchesExamSection, studentMatchesSection, validateCourseInput, validateSectionInput,
} from '../services/courseState';
import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  Role,
  AppLanguage,
  Student,
  Teacher,
  Admin,
  Room,
  Course,
  ExamSession,
  SeatAssignment,
  Submission,
  Violation,
  AuditLog,
  AccountStatus,
  MachineStatus,
  ViolationType,
  CheatDetectionRules
} from '../types';
import { getTranslation } from '../i18n/translations';
import { canAdjustExamTime, canEditExamSeats, canEditExamSetup, canReopenExamSubmissions, getEffectiveExamStatus } from '../services/examStatus';
import { getEffectiveNow } from '../services/demoTime';
import { canSubmitStudentAttempt, createFreshStudentExamAttemptId, demoSubmissionStorageKey, isDemoSubmissionRetry, recordStudentSubmission } from '../services/studentDemoRetry';
import { useExamClock } from '../utils/useExamClock';
import { getAdminRouteFromHash } from '../utils/adminRoutes';
import { AcademicInput, AcademicResult, AcademicState, AcademicTier } from '../types/academic';
import {
  AcademicStructureTransactionResult,
  AcademicStructureWizardDraft,
  buildAcademicStructureTransaction,
} from '../services/academicStructureWizard';
import {
  academicDeleteError, createInitialAcademicState, isAcademicPathActive, migrateAcademicState, migrateAcademicStudents,
  migrateAcademicTeachers, normalizeAcademicInput, saveAcademicState, studentAcademicFields, teacherAcademicFields,
  validateAcademicInput, validateStudentClassGroup, validateTeacherAffiliation,
} from '../services/academicState';
import {
  initialStudents,
  initialTeachers,
  initialAdmins,
  initialRooms,
  initialCourses,
  initialExamSessions,
  initialSeatAssignments,
  initialSubmissions,
  initialViolations
} from '../data/initialData';

export interface ToastMessage {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface AppContextType {
  // Localization & Language
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;

  // Navigation & Role
  role: Role | null;
  setRole: (role: Role | null) => void;
  activeAdminRoute: string;
  setActiveAdminRoute: (route: string) => void;
  activeTeacherRoute: string;
  setActiveTeacherRoute: (route: string) => void;
  activeStudentStep: 'ST1' | 'ST2A' | 'ST2B' | 'ST2C' | 'ST3' | 'ST4' | 'ST5' | 'ST6' | 'ST7';
  setActiveStudentStep: (step: 'ST1' | 'ST2A' | 'ST2B' | 'ST2C' | 'ST3' | 'ST4' | 'ST5' | 'ST6' | 'ST7') => void;

  // Active Users
  currentStudent: Student | null;
  setCurrentStudent: (student: Student | null) => void;
  currentTeacher: Teacher | null;
  setCurrentTeacher: (teacher: Teacher | null) => void;
  currentAdmin: Admin | null;
  setCurrentAdmin: (admin: Admin | null) => void;
  currentExamId: string;
  setCurrentExamId: (id: string) => void;
  studentExamAttemptId: string;
  startStudentExamAttempt: (student: Student, examId: string) => void;

  // Frontend-only authentication mock state
  mockAuthUsers: MockAuthUser[];
  completeMockRegistration: (userId: string, faceStatus: FaceEnrollmentStatus, password: string, confirmation: string) => { success: boolean; error?: string };

  // Active Violation for Student ST8 Overlay
  activeViolationAlert: Violation | null;
  setActiveViolationAlert: (violation: Violation | null) => void;
  acknowledgeViolation: (id: string) => void;

  // Security & Proctoring
  securityRules: CheatDetectionRules;
  updateSecurityRules: (rules: Partial<CheatDetectionRules>) => void;

  // Collections
  academicState: AcademicState;
  saveAcademicRecord: (tier: AcademicTier, input: AcademicInput, id?: string) => AcademicResult;
  saveAcademicStructure: (draft: AcademicStructureWizardDraft) => AcademicStructureTransactionResult & AcademicResult;
  deleteAcademicRecord: (tier: AcademicTier, id: string) => AcademicResult;
  setAcademicStatus: (tier: AcademicTier, id: string, status: 'active' | 'inactive') => AcademicResult;
  assignStudentsToClassGroup: (groupId: string, studentIds: string[], allowReassign?: boolean) => AcademicResult;
  students: Student[];
  /** Existing Student master records available for teacher Section enrollment search. */
  studentDirectory: Student[];
  teachers: Teacher[];
  admins: Admin[];
  rooms: Room[];
  roomState: RoomState;
  manageRooms: (action: RoomAction) => RoomActionResult;
  courses: Course[];
  examSessions: ExamSession[];
  seatAssignments: SeatAssignment[];
  submissions: Submission[];
  violations: Violation[];
  auditLogs: AuditLog[];

  // Toasts
  toasts: ToastMessage[];
  showToast: (title: string, message?: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;

  // Student Actions
  addStudent: (student: Omit<Student, 'id'>) => boolean;
  updateStudent: (id: string, updates: Partial<Student>) => boolean;
  deleteStudent: (id: string) => boolean;
  updateAccountStatus: (id: string, status: AccountStatus, reason?: string) => void;
  updateFaceReference: (id: string, url: string) => void;

  // Teacher Actions
  addTeacher: (teacher: Omit<Teacher, 'id'>) => boolean;
  updateTeacher: (id: string, updates: Partial<Teacher>) => boolean;
  deleteTeacher: (id: string) => boolean;

  // Admin Actions
  addAdmin: (admin: Omit<Admin, 'id'>) => void;
  updateAdmin: (id: string, updates: Partial<Admin>) => void;
  deleteAdmin: (id: string) => boolean;

  // Room Actions

  // Course Actions
  addCourse: (course: Omit<Course, 'id'>) => void;
  updateCourse: (id: string, updates: Partial<Course>) => void;
  deleteCourse: (id: string) => boolean;
  saveCourseRecord: (input: CourseInput, id?: string) => CourseActionResult;
  saveSectionRecord: (input: SectionInput, id?: string) => CourseActionResult;
  deleteSectionRecord: (sectionId: string) => CourseActionResult;
  setSectionStatus: (sectionId: string, status: 'active' | 'inactive') => CourseActionResult;
  addStudentToSection: (studentId: string, sectionId: string) => CourseActionResult;
  moveStudentBetweenSections: (studentId: string, fromSectionId: string, toSectionId: string) => CourseActionResult;
  findStudentSectionInCourse: (studentId: string, courseId: string, targetSectionId: string) => { sectionId: string; sectionNo: string; manageable: boolean } | null;

  // Exam Actions
  createExamSession: (exam: Omit<ExamSession, 'id'>) => void;
  updateExamSession: (id: string, updates: Partial<ExamSession>) => void;
  adjustExamTime: (examId: string, deltaMinutes: number, scope: 'room' | 'student', targetStudentId?: string, reason?: string) => void;
  reopenSubmission: (examId: string, extraMinutes: number, scope: 'room' | 'student', targetStudentId?: string, reason?: string) => void;

  // Seat Assignment Actions
  assignSeat: (examId: string, seatNo: string, studentId: string) => void;
  unassignSeat: (examId: string, seatNo: string) => void;
  autoAssignSeats: (examId: string, roomId: string) => void;

  // Submission Actions
  submitStudentFiles: (examId: string, studentId: string, files: { uploadId: string; submissionName: string; sizeBytes: number; snippet?: string }[]) => boolean;

  // Simulation helpers
  triggerViolation: (examId: string, studentId: string, seatNo: string, type: ViolationType, detail: string) => void;
  toggleMachineStatus: (roomId: string, seatNo: string, status: MachineStatus) => void;
  resetToMockDefaults: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const defaultSecurityRules: CheatDetectionRules = {
  multipleFaceDetection: true,
  lookingAwayDetection: true,
  lookingAwayThresholdSeconds: 4,
  windowSwitchDetection: true,
  allowedWindowSwitches: 1,
  urlWhitelistEnforcement: true,
  whitelistedUrls: ['*.icit.university.ac.th', 'python.org/docs'],
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const examNow = useExamClock();
  // Website language state (default: 'th')
  const [language, setLanguageState] = useState<AppLanguage>('th');

  const setLanguage = (_lang: AppLanguage) => {
    setLanguageState('th');
    localStorage.setItem('securelab_language', 'th');
  };

  const toggleLanguage = () => {
    setLanguage('th');
  };

  const t = (key: string, fallback?: string) => {
    return getTranslation(key, language, fallback);
  };

  const safeParse = <T,>(key: string, fallback: T): T => {
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return fallback;
      return JSON.parse(saved);
    } catch (err) {
      console.warn(`Error reading localStorage for ${key}:`, err);
      return fallback;
    }
  };

  // Load initial from localStorage if available
  // Authentication is session-only. Always begin at the login landing page
  // instead of restoring a previously selected simulation role.
  const [role, setRole] = useState<Role | null>(null);

  const [activeAdminRoute, setActiveAdminRoute] = useState<string>(() => getAdminRouteFromHash());
  const [activeTeacherRoute, setActiveTeacherRoute] = useState<string>('T1');
  const [activeStudentStep, setActiveStudentStep] = useState<'ST1' | 'ST2A' | 'ST2B' | 'ST2C' | 'ST3' | 'ST4' | 'ST5' | 'ST6' | 'ST7'>('ST1');

  const [legacyAcademicSnapshot] = useState<unknown>(() =>
    safeParse('securelab_academic_state', createInitialAcademicState()));
  const [storedAcademicState, setAcademicState] = useState<AcademicState>(() =>
    migrateAcademicState(legacyAcademicSnapshot));

  const [storedStudentsState, setStudents] = useState<Student[]>(() => {
    const storedStudents = safeParse('securelab_students', initialStudents);
    const seedMigrationKey = 'securelab_academic_mock_students_v1';
    let mergedStudents = storedStudents;

    if (localStorage.getItem(seedMigrationKey) !== 'complete') {
      const existingIds = new Set(storedStudents.map((student) => student.id));
      const academicSamples = initialStudents.filter((student) =>
        student.id.startsWith('std_inet_') || student.id.startsWith('std_ine_'));
      mergedStudents = [
        ...storedStudents,
        ...academicSamples.filter((student) => !existingIds.has(student.id)),
      ];
      localStorage.setItem(seedMigrationKey, 'complete');
    }

    return migrateAcademicStudents(mergedStudents, storedAcademicState, legacyAcademicSnapshot);
  });

  const currentAcademicYear = useAcademicYear();
  const academicState = storedAcademicState;
  const students = useMemo(() => storedStudentsState.map((student) => ({
    ...withCalculatedStudentYear(student, currentAcademicYear), ...studentAcademicFields(academicState, student),
  })), [storedStudentsState, academicState, currentAcademicYear]);

  const [teachers, setTeachers] = useState<Teacher[]>(() => {
    return migrateAcademicTeachers(safeParse('securelab_teachers', initialTeachers), academicState);
  });

  const [admins, setAdmins] = useState<Admin[]>(() => {
    return safeParse('securelab_admins', initialAdmins);
  });

  const [mockAuthUsers, setMockAuthUsers] = useState<MockAuthUser[]>(() =>
    migrateMockAuthUsers(safeParse<unknown>(mockAuthStorageKey, initialMockAuthUsers)));

  const [roomState, setRoomState] = useState<RoomState>(() =>
    migrateRoomState(safeParse<unknown>('securelab_room_state', null), safeParse('securelab_rooms', initialRooms)));
  const rooms = useMemo(() => projectRooms(roomState), [roomState]);

  const [storedCourses, setCourses] = useState<Course[]>(() => {
    const migrated = migrateCourses(safeParse('securelab_courses', initialCourses), academicState, legacyAcademicSnapshot);
    const demoMigrationKey = 'securelab_cs301_teacher_demo_v1';
    if (localStorage.getItem(demoMigrationKey) === 'complete') return migrated;
    return addCs301DemoCoTeacher(migrated);
  });

  const [storedExamSessions, setExamSessions] = useState<ExamSession[]>(() => {
    return safeParse('securelab_exams', initialExamSessions);
  });

  const [seatAssignments, setSeatAssignments] = useState<SeatAssignment[]>(() => {
    return safeParse('securelab_seat_assignments', initialSeatAssignments);
  });

  const [submissions, setSubmissions] = useState<Submission[]>(() => {
    return safeParse('securelab_submissions', initialSubmissions);
  });
  const [demoSubmissionAttempts, setDemoSubmissionAttempts] = useState<Submission[]>(() =>
    safeParse(demoSubmissionStorageKey, []));

  const [violations, setViolations] = useState<Violation[]>(() => {
    return safeParse('securelab_violations', initialViolations);
  });

  const [securityRules, setSecurityRules] = useState<CheatDetectionRules>(() => {
    return safeParse('securelab_security_rules', defaultSecurityRules);
  });

  const updateSecurityRules = (rules: Partial<CheatDetectionRules>) => {
    setSecurityRules((prev) => {
      const updated = { ...prev, ...rules };
      localStorage.setItem('securelab_security_rules', JSON.stringify(updated));
      return updated;
    });
  };

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [activeViolationAlert, setActiveViolationAlert] = useState<Violation | null>(null);

  // Active selected personas
  const [currentStudent, setCurrentStudent] = useState<Student | null>(storedStudentsState[1] || null);
  const derivedCurrentStudent = useMemo(() => currentStudent ? {
    ...withCalculatedStudentYear(currentStudent, currentAcademicYear),
    ...studentAcademicFields(academicState, currentStudent),
  } : null, [currentStudent, currentAcademicYear, academicState]);
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(teachers[0] || null);
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(initialAdmins[0]);
  const [currentExamId, setCurrentExamId] = useState<string>('exam_0001');
  const [studentExamAttemptId, setStudentExamAttemptId] = useState(createFreshStudentExamAttemptId);
  const startStudentExamAttempt = (student: Student, examId: string) => {
    setStudentExamAttemptId(createFreshStudentExamAttemptId());
    setCurrentStudent(student);
    setCurrentExamId(examId);
    setActiveStudentStep('ST1');
    setRole('student');
  };
  const courses = useMemo(() => role === 'teacher' ? coursesForTeacher(storedCourses, currentTeacher?.id)
    : role === 'student' ? coursesForStudent(storedCourses, derivedCurrentStudent, storedExamSessions, examNow) : storedCourses,
  [role, storedCourses, currentTeacher?.id, derivedCurrentStudent, storedExamSessions, examNow]);
  const examSessions = useMemo(() => role === 'admin' || !role ? storedExamSessions : storedExamSessions.filter((exam) =>
    courses.some((course) => course.id === exam.courseId && course.sections.some((section) => section.sectionNo === exam.sectionNo))),
  [role, storedExamSessions, courses]);
  const visibleStudents = useMemo(() => {
    if (role === 'student') return students.filter((student) => student.id === currentStudent?.id);
    if (role !== 'teacher') return students;
    const sections = courses.flatMap((course) => course.sections);
    return students.filter((student) => sections.some((section) => studentMatchesSection(student, section)) ||
      storedExamSessions.some((exam) => getEffectiveExamStatus(exam, examNow) !== 'upcoming' && exam.eligibleStudentIds?.includes(student.id) &&
        courses.some((course) => course.id === exam.courseId && course.sections.some((section) => section.sectionNo === exam.sectionNo))));
  }, [role, students, courses, currentStudent?.id, storedExamSessions, examNow]);
  const studentDirectory = role === 'teacher' ? students : visibleStudents;

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('securelab_academic_state', JSON.stringify(academicState));
    localStorage.setItem('securelab_academic_schema_version', '5');
  }, [academicState]);
  useEffect(() => {
    localStorage.removeItem('securelab_role');
    localStorage.setItem('securelab_language', 'th');
  }, []);

  useEffect(() => {
    localStorage.setItem('securelab_students', JSON.stringify(students.map(withoutStudentYear)));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('securelab_teachers', JSON.stringify(teachers));
  }, [teachers]);

  useEffect(() => {
    localStorage.setItem('securelab_admins', JSON.stringify(admins));
  }, [admins]);

  useEffect(() => {
    localStorage.setItem(mockAuthStorageKey, JSON.stringify(mockAuthUsers));
  }, [mockAuthUsers]);

  useEffect(() => {
    localStorage.setItem('securelab_room_state', JSON.stringify(roomState));
  }, [roomState]);

  useEffect(() => {
    localStorage.setItem('securelab_courses', JSON.stringify(storedCourses));
    localStorage.setItem('securelab_cs301_teacher_demo_v1', 'complete');
  }, [storedCourses]);

  useEffect(() => {
    localStorage.setItem('securelab_exams', JSON.stringify(storedExamSessions));
  }, [storedExamSessions]);

  useEffect(() => {
    localStorage.setItem('securelab_seat_assignments', JSON.stringify(seatAssignments));
  }, [seatAssignments]);

  useEffect(() => {
    localStorage.setItem('securelab_submissions', JSON.stringify(submissions));
  }, [submissions]);

  useEffect(() => {
    localStorage.setItem(demoSubmissionStorageKey, JSON.stringify(demoSubmissionAttempts));
  }, [demoSubmissionAttempts]);

  useEffect(() => {
    localStorage.setItem('securelab_violations', JSON.stringify(violations));
  }, [violations]);

  // Toast Helpers
  const showToast = (title: string, message?: string, type: ToastMessage['type'] = 'info') => {
    const id = 'toast_' + Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      dismissToast(id);
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const completeMockRegistration = (userId: string, faceStatus: FaceEnrollmentStatus, password: string, confirmation: string) => {
    const result = completeMockRegistrationState(mockAuthUsers, userId, faceStatus, password, confirmation);
    if (result.success) setMockAuthUsers(result.users);
    return { success: result.success, error: result.error };
  };

  const academicFailure = (error: string): AcademicResult => {
    showToast('ไม่สามารถดำเนินการได้', error, 'error');
    return { success: false, error };
  };

  const commitAcademicState = (next: AcademicState) => {
    setAcademicState(next);
    setStudents((current) => current.map((student) => ({ ...student, ...studentAcademicFields(next, student) })));
    setCurrentStudent((current) => current ? { ...current, ...studentAcademicFields(next, current) } : null);
    setTeachers((current) => current.map((teacher) => ({ ...teacher, ...teacherAcademicFields(next, teacher) })));
    setCurrentTeacher((current) => current ? { ...current, ...teacherAcademicFields(next, current) } : null);
    setCourses((current) => migrateCourses(current, next));
  };

  const saveAcademicRecord = (tier: AcademicTier, rawInput: AcademicInput, id?: string): AcademicResult => {
    if (role !== 'admin') return academicFailure('เฉพาะผู้ดูแลระบบเท่านั้น');
    const input = normalizeAcademicInput(rawInput);
    const existingGroup = tier === 'classGroups' && id ? academicState.classGroups.find((group) => group.id === id) : undefined;
    if (existingGroup && (existingGroup.majorId !== input.majorId || existingGroup.admissionYear !== input.admissionYear) &&
      (students.some((student) => student.classGroupId === id) || storedCourses.some((course) =>
        course.sections.some((section) => section.cohorts?.some((cohort) => cohort.classGroupIds?.includes(id)))))) {
      return academicFailure('ไม่สามารถเปลี่ยนสาขาวิชาหรือปีที่เข้าศึกษาของกลุ่มที่มีนักศึกษาหรือตอนเรียนอ้างอิงอยู่');
    }
    const error = validateAcademicInput(academicState, tier, input, id);
    if (error) return academicFailure(error);
    commitAcademicState(saveAcademicState(academicState, tier, input, id));
    showToast('บันทึกข้อมูลสำเร็จ', 'อัปเดตโครงสร้างการศึกษาเรียบร้อยแล้ว', 'success');
    return { success: true };
  };

  const saveAcademicStructure = (
    draft: AcademicStructureWizardDraft,
  ): AcademicStructureTransactionResult & AcademicResult => {
    if (role !== 'admin') {
      const result = academicFailure('เฉพาะผู้ดูแลระบบเท่านั้น');
      return { ...result, groupCodes: [] };
    }
    const transaction = buildAcademicStructureTransaction(academicState, draft);
    if (!transaction.state || transaction.error) {
      const result = academicFailure(transaction.error || 'ไม่สามารถตรวจสอบโครงสร้างการศึกษาได้');
      return { ...transaction, ...result };
    }
    commitAcademicState(transaction.state);
    showToast(
      'เพิ่มโครงสร้างการศึกษาเรียบร้อยแล้ว',
      `สร้างกลุ่มเรียน ${transaction.groupCodes.length} กลุ่ม: ${transaction.groupCodes.join(', ')}`,
      'success',
    );
    return { ...transaction, success: true };
  };

  const deleteAcademicRecord = (tier: AcademicTier, id: string): AcademicResult => {
    if (role !== 'admin') return academicFailure('เฉพาะผู้ดูแลระบบเท่านั้น');
    if (!academicState[tier].some((r) => r.id === id)) return academicFailure('ไม่พบข้อมูลที่ต้องการลบ');
    if (tier === 'faculties' && storedCourses.some((course) => course.facultyId === id))
      return academicFailure('ไม่สามารถลบคณะนี้ได้ เนื่องจากมีรายวิชาอ้างอิงอยู่ กรุณาปิดใช้งานแทน');
    if (tier === 'departments' && storedCourses.some((course) => course.departmentId === id))
      return academicFailure('ไม่สามารถลบภาควิชานี้ได้ เนื่องจากมีรายวิชาอ้างอิงอยู่ กรุณาปิดใช้งานแทน');
    if (tier === 'faculties' && teachers.some((teacher) => teacher.facultyId === id))
      return academicFailure('ไม่สามารถลบคณะนี้ได้ เนื่องจากมีอาจารย์อ้างอิงอยู่ กรุณาปิดใช้งานแทน');
    if (tier === 'departments' && teachers.some((teacher) => teacher.departmentId === id))
      return academicFailure('ไม่สามารถลบภาควิชานี้ได้ เนื่องจากมีอาจารย์อ้างอิงอยู่ กรุณาปิดใช้งานแทน');
    if (tier === 'majors' && storedCourses.some((course) =>
      course.sections.some((section) => section.cohorts?.some((cohort) => cohort.majorId === id))))
      return academicFailure('ไม่สามารถลบสาขาวิชานี้ได้ เนื่องจากมีตอนเรียนอ้างอิงอยู่ กรุณาปิดใช้งานแทน');
    if (tier === 'classGroups' && storedCourses.some((course) =>
      course.sections.some((section) => section.cohorts?.some((cohort) => cohort.classGroupIds?.includes(id)))))
      return academicFailure('ไม่สามารถลบกลุ่มเรียนนี้ได้ เนื่องจากมีตอนเรียนอ้างอิงอยู่ กรุณาปิดใช้งานแทน');
    const error = academicDeleteError(academicState, students, tier, id);
    if (error) return academicFailure(error);
    setAcademicState({ ...academicState, [tier]: academicState[tier].filter((r) => r.id !== id) });
    showToast('ลบข้อมูลเรียบร้อยแล้ว', undefined, 'success');
    return { success: true };
  };

  const setAcademicStatus = (tier: AcademicTier, id: string, status: 'active' | 'inactive'): AcademicResult => {
    if (role !== 'admin') return academicFailure('เฉพาะผู้ดูแลระบบเท่านั้น');
    if (!academicState[tier].some((r) => r.id === id)) return academicFailure('ไม่พบข้อมูล');
    setAcademicState({ ...academicState, [tier]: academicState[tier].map((r) =>
      r.id === id ? { ...r, status, updatedAt: new Date().toISOString() } : r) });
    showToast(status === 'active' ? 'เปิดใช้งานแล้ว' : 'ปิดใช้งานแล้ว', 'ข้อมูลนักศึกษาเดิมยังคงอยู่', 'success');
    return { success: true };
  };

  const assignStudentsToClassGroup = (groupId: string, studentIds: string[], allowReassign = false): AcademicResult => {
    if (role !== 'admin') return academicFailure('เฉพาะผู้ดูแลระบบเท่านั้น');
    const group = academicState.classGroups.find((item) => item.id === groupId);
    if (!group || !isAcademicPathActive(academicState, 'classGroups', group.id)) return academicFailure('กลุ่มเรียนนี้ไม่พร้อมใช้งาน');
    const selected = students.filter((student) => studentIds.includes(student.id));
    if (!selected.length) return academicFailure('กรุณาเลือกนักศึกษาอย่างน้อย 1 คน');
    if (selected.some((student) => student.majorId !== group.majorId || student.admissionYear !== group.admissionYear)) {
      return academicFailure('นักศึกษาที่เลือกต้องมีสาขาวิชาและปีที่เข้าศึกษาตรงกับกลุ่มเรียน');
    }
    const reassignment = selected.filter((student) => student.classGroupId && student.classGroupId !== group.id);
    if (reassignment.length && !allowReassign) return academicFailure('พบนักศึกษาที่อยู่ในกลุ่มอื่น กรุณายืนยันการย้ายกลุ่ม');
    const selectedIds = new Set(studentIds);
    setStudents((current) => current.map((student) => selectedIds.has(student.id) ? { ...student, classGroupId: group.id, classGroup: group.code } : student));
    setCurrentStudent((current) => current && selectedIds.has(current.id) ? { ...current, classGroupId: group.id, classGroup: group.code } : current);
    showToast(reassignment.length ? 'ย้ายกลุ่มนักศึกษาสำเร็จ' : 'เพิ่มนักศึกษาเข้ากลุ่มสำเร็จ', `ดำเนินการกับนักศึกษา ${selected.length} คน`, 'success');
    return { success: true };
  };

  // Student CRUD
  const addStudent = (newStd: Omit<Student, 'id'>) => {
    if (!newStd.majorId || !isAcademicPathActive(academicState, 'majors', newStd.majorId)) {
      showToast('ไม่สามารถเพิ่มนักศึกษาได้', 'กรุณาเลือกสาขาวิชาที่เปิดใช้งาน', 'error');
      return false;
    }
    if (!Number.isSafeInteger(newStd.admissionYear) || !newStd.admissionYear || newStd.admissionYear > currentAcademicYear) {
      showToast('ไม่สามารถเพิ่มนักศึกษาได้', 'กรุณากรอกปีการศึกษาที่เข้าที่ถูกต้อง', 'error');
      return false;
    }
    const groupError = validateStudentClassGroup(academicState, newStd);
    if (groupError) {
      showToast('ไม่สามารถเพิ่มนักศึกษาได้', groupError, 'error');
      return false;
    }
    const id = crypto.randomUUID();
    const created: Student = { ...newStd, ...studentAcademicFields(academicState, { ...newStd, id }), id };
    setStudents(prev => [created, ...prev]);
    showToast('เพิ่มนักศึกษาสำเร็จ', `ลงทะเบียน ${created.fullName} (${created.studentCode}) เรียบร้อยแล้ว`, 'success');
    return true;
  };

  const updateStudent = (id: string, updates: Partial<Student>) => {
    const existing = students.find((student) => student.id === id);
    if (!existing) return false;
    const next = { ...existing, ...updates };
    if (!next.majorId || (next.majorId !== existing.majorId && !isAcademicPathActive(academicState, 'majors', next.majorId))) {
      showToast('ไม่สามารถบันทึกนักศึกษาได้', 'กรุณาเลือกสาขาวิชาที่เปิดใช้งาน', 'error');
      return false;
    }
    if (!Number.isSafeInteger(next.admissionYear) || !next.admissionYear || next.admissionYear > currentAcademicYear) {
      showToast('ไม่สามารถบันทึกนักศึกษาได้', 'กรุณากรอกปีการศึกษาที่เข้าที่ถูกต้อง', 'error');
      return false;
    }
    const groupError = validateStudentClassGroup(academicState, next, next.classGroupId === existing.classGroupId);
    if (groupError) {
      showToast('ไม่สามารถบันทึกนักศึกษาได้', groupError, 'error');
      return false;
    }
    updates = { ...updates, ...studentAcademicFields(academicState, next) };
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    if (currentStudent?.id === id) {
      setCurrentStudent(prev => prev ? { ...prev, ...updates } : null);
    }
    showToast('อัปเดตข้อมูลนักศึกษาแล้ว', 'บันทึกข้อมูลเรียบร้อยแล้ว', 'success');
    return true;
  };

  const deleteStudent = (id: string): boolean => {
    // Check if student has exam assignments or submissions
    const hasAssignments = seatAssignments.some(sa => sa.studentId === id);
    if (hasAssignments) {
      showToast('ไม่สามารถลบนักศึกษาได้', 'นักศึกษามีที่นั่งสอบอยู่ กรุณายกเลิกการกำหนดที่นั่งหรือระงับบัญชีก่อน', 'error');
      return false;
    }
    setStudents(prev => prev.filter(s => s.id !== id));
    showToast('ลบนักศึกษาแล้ว', 'นำข้อมูลออกจากระบบเรียบร้อยแล้ว', 'info');
    return true;
  };

  const updateAccountStatus = (id: string, status: AccountStatus, reason?: string) => {
    updateStudent(id, { accountStatus: status, statusReason: reason });
  };

  const updateFaceReference = (id: string, url: string) => {
    updateStudent(id, {
      faceReferenceUrl: url,
      faceReferenceStatus: url ? 'available' : 'missing',
      isFirstTime: false,
    });
    showToast('อัปเดตข้อมูลใบหน้าแล้ว', 'บันทึกข้อมูลใบหน้าสำหรับยืนยันตัวตนเรียบร้อยแล้ว', 'success');
  };

  // Teacher CRUD
  const addTeacher = (newTch: Omit<Teacher, 'id'>) => {
    const affiliationError = validateTeacherAffiliation(academicState, newTch);
    if (affiliationError) {
      showToast('ไม่สามารถเพิ่มอาจารย์ได้', affiliationError, 'error');
      return false;
    }
    const id = `tch_${String(teachers.length + 1).padStart(4, '0')}`;
    const created: Teacher = { ...newTch, ...teacherAcademicFields(academicState, newTch), id };
    setTeachers(prev => [created, ...prev]);
    showToast('เพิ่มอาจารย์สำเร็จ', `ลงทะเบียน ${created.fullName} เรียบร้อยแล้ว`, 'success');
    return true;
  };

  const updateTeacher = (id: string, updates: Partial<Teacher>) => {
    const existing = teachers.find((teacher) => teacher.id === id);
    if (!existing) {
      showToast('ไม่สามารถอัปเดตข้อมูลอาจารย์ได้', 'ไม่พบข้อมูลอาจารย์', 'error');
      return false;
    }
    const merged = { ...existing, ...updates };
    const affiliationChanged = updates.facultyId !== undefined || updates.departmentId !== undefined;
    if (affiliationChanged) {
      const affiliationError = validateTeacherAffiliation(academicState, merged, existing);
      if (affiliationError) {
        showToast('ไม่สามารถอัปเดตข้อมูลอาจารย์ได้', affiliationError, 'error');
        return false;
      }
    }
    const normalized = affiliationChanged
      ? { ...merged, ...teacherAcademicFields(academicState, merged) }
      : merged;
    setTeachers(prev => prev.map(t => t.id === id ? normalized : t));
    if (currentTeacher?.id === id) {
      setCurrentTeacher(normalized);
    }
    showToast('อัปเดตข้อมูลอาจารย์แล้ว', 'บันทึกข้อมูลเรียบร้อยแล้ว', 'success');
    return true;
  };

  const deleteTeacher = (id: string): boolean => {
    const hasAssignedSection = storedCourses.some(c => c.sections.some(s => s.teacherId === id || s.coTeacherIds?.includes(id)));
    if (hasAssignedSection) {
      showToast('ไม่สามารถลบอาจารย์ได้', 'อาจารย์ยังรับผิดชอบรายวิชาที่เปิดใช้งาน กรุณาเปลี่ยนอาจารย์ผู้รับผิดชอบก่อน', 'error');
      return false;
    }
    setTeachers(prev => prev.filter(t => t.id !== id));
    showToast('ลบอาจารย์แล้ว', 'นำข้อมูลออกจากระบบเรียบร้อยแล้ว', 'info');
    return true;
  };

  // Admin CRUD
  const addAdmin = (newAdm: Omit<Admin, 'id'>) => {
    const id = `adm_${String(admins.length + 1).padStart(4, '0')}`;
    const created: Admin = { ...newAdm, id };
    setAdmins(prev => [created, ...prev]);
    showToast('เพิ่มผู้ดูแลระบบสำเร็จ', `เพิ่ม ${created.fullName} พร้อมสิทธิ์ผู้ดูแลระบบแล้ว`, 'success');
  };

  const updateAdmin = (id: string, updates: Partial<Admin>) => {
    setAdmins(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    if (currentAdmin?.id === id) {
      setCurrentAdmin(prev => prev ? { ...prev, ...updates } : null);
    }
    showToast('อัปเดตผู้ดูแลระบบแล้ว', 'บันทึกข้อมูลเรียบร้อยแล้ว', 'success');
  };

  const deleteAdmin = (id: string): boolean => {
    if (admins.length <= 1) {
      showToast('ไม่อนุญาตให้ดำเนินการ', 'ระบบต้องมีผู้ดูแลที่ใช้งานได้อย่างน้อยหนึ่งบัญชี', 'error');
      return false;
    }
    setAdmins(prev => prev.filter(a => a.id !== id));
    showToast('ลบผู้ดูแลระบบแล้ว', 'นำข้อมูลออกจากระบบเรียบร้อยแล้ว', 'info');
    return true;
  };

  // Registered room/device metadata has one canonical store; portals read a projection.
  const manageRooms = (action: RoomAction): RoomActionResult => {
    if (role !== 'admin') return { success: false, error: 'เฉพาะผู้ดูแลระบบเท่านั้น' };
    const result = applyRoomAction(roomState, action, storedExamSessions, seatAssignments);
    if (result.success && result.state) {
      setRoomState(result.state);
      showToast('บันทึกข้อมูลห้องสอบและเครื่องแล้ว', undefined, 'success');
    }
    return result;
  };

  // Course CRUD
  const addCourse = (newCourse: Omit<Course, 'id'>) => {
    const id = `crs_${String(storedCourses.length + 1).padStart(4, '0')}`;
    const created: Course = { ...newCourse, id };
    setCourses(prev => [created, ...prev]);
    showToast('สร้างรายวิชาแล้ว', `เพิ่ม ${created.courseCode} ในรายการรายวิชาเรียบร้อยแล้ว`, 'success');
  };

  const updateCourse = (id: string, updates: Partial<Course>) => {
    setCourses(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    showToast('อัปเดตรายวิชาแล้ว', 'บันทึกข้อมูลรายวิชาเรียบร้อยแล้ว', 'success');
  };

  const deleteCourse = (id: string): boolean => {
    const course = storedCourses.find((item) => item.id === id);
    const error = course && courseDeleteError(course, examSessions);
    if (!course || error) {
      showToast('ไม่สามารถลบรายวิชาได้', error || 'ไม่พบรายวิชา', 'error');
      return false;
    }
    setCourses(prev => prev.filter(c => c.id !== id));
    showToast('ลบรายวิชาแล้ว', 'นำรายวิชาออกจากรายการเรียบร้อยแล้ว', 'info');
    return true;
  };

  const saveCourseRecord = (input: CourseInput, id?: string): CourseActionResult => {
    if (role !== 'admin') return { success: false, error: 'เฉพาะผู้ดูแลระบบเท่านั้น' };
    const error = validateCourseInput(storedCourses, academicState, input, id);
    if (error) return { success: false, error };
    const next = saveCourse(storedCourses, academicState, input, id);
    const courseId = id || next[0].id;
    setCourses(next);
    showToast(id ? 'อัปเดตรายวิชาแล้ว' : 'เพิ่มรายวิชาแล้ว', 'บันทึกข้อมูลรายวิชาเรียบร้อยแล้ว', 'success');
    return { success: true, courseId };
  };

  const saveSectionRecord = (input: SectionInput, id?: string): CourseActionResult => {
    if (role !== 'admin') return { success: false, error: 'เฉพาะผู้ดูแลระบบเท่านั้น' };
    const error = validateSectionInput(storedCourses, academicState, teachers, input, id);
    if (error) return { success: false, error };
    const next = saveSection(storedCourses, input, id);
    const sectionId = id || next.find((course) => course.id === input.courseId)!.sections.at(-1)!.id;
    setCourses(next);
    showToast(id ? 'อัปเดตตอนเรียนแล้ว' : 'เปิดตอนเรียนใหม่แล้ว', 'บันทึกข้อมูลตอนเรียนเรียบร้อยแล้ว', 'success');
    return { success: true, sectionId };
  };

  const deleteSectionRecord = (sectionId: string): CourseActionResult => {
    if (role !== 'admin') return { success: false, error: 'เฉพาะผู้ดูแลระบบเท่านั้น' };
    const located = findSection(storedCourses, sectionId);
    const error = located && sectionDeleteError(located.course, located.section, examSessions);
    if (!located || error) return { success: false, error: error || 'ไม่พบตอนเรียน' };
    setCourses((current) => current.map((course) => ({ ...course, sections: course.sections.filter((section) => section.id !== sectionId) })));
    showToast('ลบตอนเรียนแล้ว', undefined, 'info');
    return { success: true };
  };

  const setSectionStatus = (sectionId: string, status: 'active' | 'inactive'): CourseActionResult => {
    if (role !== 'admin') return { success: false, error: 'เฉพาะผู้ดูแลระบบเท่านั้น' };
    const located = findSection(storedCourses, sectionId);
    if (!located) return { success: false, error: 'ไม่พบตอนเรียน' };
    if (status === 'active' && located.course.status !== 'active') {
      const error = 'ไม่สามารถเปิดใช้งานตอนเรียนภายใต้รายวิชาที่ปิดใช้งานได้';
      showToast('ไม่สามารถเปลี่ยนสถานะได้', error, 'error');
      return { success: false, error };
    }
    setCourses((current) => current.map((course) => ({ ...course, sections: course.sections.map((section) =>
      section.id === sectionId ? { ...section, status, updatedAt: new Date().toISOString() } : section) })));
    showToast(status === 'active' ? 'เปิดใช้งานตอนเรียนแล้ว' : 'ปิดใช้งานตอนเรียนแล้ว', undefined, 'success');
    return { success: true };
  };

  const persistEnrollmentChange = (nextCourses: Course[], affectedSectionIds: string[]) => {
    setExamSessions((current) => snapshotAffectedExamRosters(current, storedCourses, students, affectedSectionIds));
    setCourses(nextCourses);
  };

  const addStudentToSection = (studentId: string, sectionId: string): CourseActionResult => {
    if (role !== 'teacher' || !currentTeacher || currentTeacher.accountStatus !== 'active') {
      return { success: false, error: 'เฉพาะอาจารย์ที่มีสถานะปกติเท่านั้น' };
    }
    const result = addStudentEnrollment(storedCourses, students, studentId, sectionId, currentTeacher.id);
    if (!result.success || !result.courses) return { success: false, error: result.error };
    const examError = enrollmentExamReferenceError(storedExamSessions, storedCourses, result.affectedSectionIds || []);
    if (examError) return { success: false, error: examError };
    persistEnrollmentChange(result.courses, result.affectedSectionIds || []);
    showToast('เพิ่มนักศึกษาเข้า Section แล้ว', undefined, 'success');
    return { success: true, sectionId };
  };

  const moveStudentBetweenSections = (studentId: string, fromSectionId: string, toSectionId: string): CourseActionResult => {
    if (role !== 'teacher' || !currentTeacher || currentTeacher.accountStatus !== 'active') {
      return { success: false, error: 'เฉพาะอาจารย์ที่มีสถานะปกติเท่านั้น' };
    }
    const result = moveStudentEnrollment(storedCourses, students, studentId, fromSectionId, toSectionId, currentTeacher.id);
    if (!result.success || !result.courses) return { success: false, error: result.error };
    const examError = enrollmentExamReferenceError(storedExamSessions, storedCourses, result.affectedSectionIds || []);
    if (examError) return { success: false, error: examError };
    persistEnrollmentChange(result.courses, result.affectedSectionIds || []);
    showToast('ย้ายนักศึกษาแล้ว', 'อัปเดตรายชื่อของทั้งสอง Section เรียบร้อยแล้ว', 'success');
    return { success: true, sectionId: toSectionId };
  };

  const findStudentSectionInCourse = (studentId: string, courseId: string, targetSectionId: string) => {
    if (role !== 'teacher' || !currentTeacher) return null;
    const student = students.find((item) => item.id === studentId);
    return student ? findStudentEnrollmentInCourse(storedCourses, student, courseId, targetSectionId, currentTeacher.id) : null;
  };

  // Exam Sessions
  const createExamSession = (newExam: Omit<ExamSession, 'id'>) => {
    if (!rooms.some((room) => room.id === newExam.roomId && room.status === 'ready')) {
      showToast('ไม่สามารถสร้างรอบการสอบได้', 'กรุณาเลือกห้องสอบที่พร้อมใช้งาน', 'error');
      return;
    }
    const course = courses.find((item) => item.id === newExam.courseId);
    const section = course?.sections.find((item) => item.sectionNo === newExam.sectionNo);
    if (!course || course.status !== 'active' || !section || section.status === 'inactive') {
      showToast('ไม่สามารถสร้างรอบการสอบได้', 'กรุณาเลือกตอนเรียนที่เปิดใช้งานและได้รับมอบหมายให้คุณ', 'error');
      return;
    }
    const id = crypto.randomUUID();
    const created: ExamSession = { ...newExam, id };
    setExamSessions(prev => [created, ...prev]);
    showToast('สร้างรอบการสอบแล้ว', `กำหนดสอบวันที่ ${created.examDate} เวลา ${created.startTime}`, 'success');
  };

  const updateExamSession = (id: string, updates: Partial<ExamSession>) => {
    const existing = storedExamSessions.find((exam) => exam.id === id);
    if (existing && !canEditExamSetup(existing)) {
      showToast('ไม่สามารถแก้ไขการสอบได้', 'การสอบที่เริ่มแล้วหรือเสร็จสิ้นแล้วไม่อนุญาตให้แก้ไขข้อมูลหลัก', 'error');
      return;
    }
    if (updates.roomId && updates.roomId !== existing?.roomId && !rooms.some((room) => room.id === updates.roomId && room.status === 'ready')) {
      showToast('ไม่สามารถเปลี่ยนห้องสอบได้', 'กรุณาเลือกห้องสอบที่พร้อมใช้งาน', 'error');
      return;
    }
    const course = courses.find((item) => item.id === (updates.courseId || existing?.courseId));
    const section = course?.sections.find((item) => item.sectionNo === (updates.sectionNo || existing?.sectionNo));
    if (!existing || !course || course.status !== 'active' || !section || section.status === 'inactive') {
      showToast('ไม่สามารถอัปเดตรอบการสอบได้', 'ตอนเรียนถูกปิดใช้งานหรือคุณไม่ได้รับมอบหมาย', 'error');
      return;
    }
    setExamSessions(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    showToast('อัปเดตรอบการสอบแล้ว', 'บันทึกการเปลี่ยนแปลงเรียบร้อยแล้ว', 'success');
  };

  const adjustExamTime = (
    examId: string,
    deltaMinutes: number,
    scope: 'room' | 'student',
    targetStudentId?: string,
    reason: string = 'Instructor adjustment'
  ) => {
    const exam = storedExamSessions.find((item) => item.id === examId);
    if (!exam || !canAdjustExamTime(exam)) {
      showToast('ไม่สามารถปรับเวลาสอบได้', 'ปรับเวลาได้เฉพาะการสอบที่กำลังดำเนินการ', 'warning');
      return;
    }
    setExamSessions(prev => prev.map(e => {
      if (e.id !== examId) return e;
      const currentAdj = e.adjustedMinutes || 0;
      const newAdj = currentAdj + deltaMinutes;
      return { ...e, adjustedMinutes: newAdj };
    }));

    const log: AuditLog = {
      id: 'log_' + Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      actor: currentTeacher?.fullName || 'อาจารย์',
      action: `${deltaMinutes > 0 ? '+' : ''}${deltaMinutes} นาที (${scope === 'room' ? 'ทั้งห้อง' : 'รายบุคคล'})`,
      details: `เหตุผล: ${reason}${targetStudentId ? ` | นักศึกษา: ${targetStudentId}` : ''}`,
    };
    setAuditLogs(prev => [log, ...prev]);

    showToast(
      'ปรับเวลาสอบแล้ว',
      `ปรับเวลา ${deltaMinutes > 0 ? '+' : ''}${deltaMinutes} นาทีสำหรับ${scope === 'room' ? 'ทั้งห้อง' : 'นักศึกษาที่เลือก'} เหตุผล: ${reason}`,
      'warning'
    );
  };

  const reopenSubmission = (
    examId: string,
    extraMinutes: number,
    scope: 'room' | 'student',
    targetStudentId?: string,
    reason: string = 'อนุญาตเป็นกรณีพิเศษ'
  ) => {
    // Reopening is persisted exam configuration, so its expiry always uses real time.
    const now = new Date();
    const exam = storedExamSessions.find((item) => item.id === examId);
    if (!exam || !canReopenExamSubmissions(exam, now)) {
      showToast('ไม่สามารถเปิดรับส่งใหม่ได้', 'ต้องเริ่มการสอบก่อนจึงจะเปิดรับส่งใหม่ได้', 'warning');
      return;
    }
    const reopenedUntil = new Date(now.getTime() + extraMinutes * 60000).toISOString();

    setExamSessions(prev => prev.map(e => {
      if (e.id !== examId) return e;
      const reopenedStudents = { ...(e.reopenedStudents || {}) };
      if (scope === 'student' && targetStudentId) {
        reopenedStudents[targetStudentId] = { reopenedUntil, reason };
      } else if (scope === 'room') {
        reopenedStudents['*'] = { reopenedUntil, reason };
      }
      return {
        ...e,
        status: 'in_progress',
        adjustedMinutes: (e.adjustedMinutes || 0) + extraMinutes,
        reopenedStudents,
      };
    }));

    const log: AuditLog = {
      id: 'log_' + Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      actor: currentTeacher?.fullName || 'อาจารย์',
      action: `เปิดให้ส่งไฟล์อีกครั้ง (+${extraMinutes} นาที, ${scope === 'room' ? 'ทั้งห้อง' : 'รายบุคคล'})`,
      details: reason,
    };
    setAuditLogs(prev => [log, ...prev]);

    showToast('เปิดให้ส่งไฟล์อีกครั้ง', `ปลดล็อกการส่งไฟล์เพิ่มอีก ${extraMinutes} นาที`, 'success');
  };

  // Seat Assignments
  const assignSeat = (examId: string, seatNo: string, studentId: string) => {
    const exam = storedExamSessions.find((item) => item.id === examId);
    if (!exam || !canEditExamSeats(exam)) {
      showToast('ไม่สามารถจัดที่นั่งได้', 'การสอบสิ้นสุดแล้ว ไม่สามารถเปลี่ยนผังที่นั่งย้อนหลัง', 'warning');
      return;
    }
    const station = rooms.find((room) => room.id === exam?.roomId)?.seats.find((seat) => seat.seatNo === seatNo);
    if (!station || station.disabled || station.status !== 'online') {
      showToast('ไม่สามารถจัดที่นั่งได้', 'ที่นั่งหรือเครื่องไม่พร้อมใช้งาน', 'error');
      return;
    }
    const section = storedCourses.find((course) => course.id === exam?.courseId)?.sections
      .find((item) => item.sectionNo === exam?.sectionNo);
    const student = students.find((item) => item.id === studentId);
    if (!student || !exam || !studentMatchesExamSection(student, exam, section)) {
      showToast('ไม่สามารถจัดที่นั่งได้', 'นักศึกษาไม่อยู่ในสาขาวิชาและรหัสที่กำหนดสำหรับตอนเรียนนี้', 'error');
      return;
    }
    setSeatAssignments(prev => {
      const filtered = prev.filter(sa => !(sa.examId === examId && (sa.seatNo === seatNo || sa.studentId === studentId)));
      return [...filtered, { examId, seatNo, studentId }];
    });
  };

  const unassignSeat = (examId: string, seatNo: string) => {
    const exam = storedExamSessions.find((item) => item.id === examId);
    if (!exam || !canEditExamSeats(exam)) {
      showToast('ไม่สามารถยกเลิกที่นั่งได้', 'การสอบสิ้นสุดแล้ว ไม่สามารถเปลี่ยนผังที่นั่งย้อนหลัง', 'warning');
      return;
    }
    setSeatAssignments(prev => prev.filter(sa => !(sa.examId === examId && sa.seatNo === seatNo)));
  };

  const autoAssignSeats = (examId: string, roomId: string) => {
    const room = rooms.find(r => r.id === roomId);
    const exam = storedExamSessions.find((item) => item.id === examId);
    if (!exam || !canEditExamSeats(exam)) {
      showToast('ไม่สามารถจัดที่นั่งได้', 'การสอบสิ้นสุดแล้ว ไม่สามารถเปลี่ยนผังที่นั่งย้อนหลัง', 'warning');
      return;
    }
    if (!room || room.status !== 'ready' || exam.roomId !== roomId) return;

    // Filter available seats (online, not damaged, not disabled)
    const availableSeats = room.seats.filter(s => s.status === 'online' && !s.disabled);
    const section = storedCourses.find((course) => course.id === exam?.courseId)?.sections
      .find((item) => item.sectionNo === exam?.sectionNo);
    const activeStudents = students.filter((student) =>
      student.accountStatus === 'active' && Boolean(exam && studentMatchesExamSection(student, exam, section)));

    const newAssignments: SeatAssignment[] = [];
    const minCount = Math.min(availableSeats.length, activeStudents.length);

    for (let i = 0; i < minCount; i++) {
      newAssignments.push({
        examId,
        seatNo: availableSeats[i].seatNo,
        studentId: activeStudents[i].id,
      });
    }

    setSeatAssignments(prev => {
      const others = prev.filter(sa => sa.examId !== examId);
      return [...others, ...newAssignments];
    });

    showToast('จัดที่นั่งอัตโนมัติแล้ว', `จัดที่นั่งให้นักศึกษา ${minCount} คน โดยข้ามเครื่องที่ชำรุดและออฟไลน์`, 'success');
  };

  // Student Submissions
  const submitStudentFiles = (
    examId: string,
    studentId: string,
    uploadedFiles: { uploadId: string; submissionName: string; sizeBytes: number; snippet?: string }[]
  ): boolean => {
    const exam = examSessions.find(e => e.id === examId);
    const student = students.find(s => s.id === studentId);
    const existingSubmission = submissions.find(
      s => s.examId === examId && s.studentId === studentId
    );
    const reopening = exam?.reopenedStudents?.[studentId] || exam?.reopenedStudents?.['*'];
    const hasActiveReopening = Boolean(
      reopening && new Date(reopening.reopenedUntil).getTime() > getEffectiveNow().getTime()
    );
    const hasFinalSubmission =
      existingSubmission?.status === 'submitted' || existingSubmission?.status === 'late';

    if (!student || student.accountStatus !== 'active') {
      showToast('ไม่อนุญาตให้อัปโหลด', 'เฉพาะนักศึกษาที่ลงทะเบียนและมีบัญชีสถานะปกติเท่านั้นที่อัปโหลดได้', 'error');
      return false;
    }

    if (!exam || !canSubmitStudentAttempt(exam, getEffectiveNow(), hasActiveReopening, hasFinalSubmission)) {
      showToast('ไม่อนุญาตให้อัปโหลด', 'อัปโหลดไฟล์ได้เฉพาะระหว่างการสอบที่กำลังดำเนินการ', 'error');
      return false;
    }

    const submittedAt = new Date().toISOString();
    const verifiedFiles = uploadedFiles.map(f => {
      const isDamaged = f.sizeBytes === 0;
      return {
        uploadId: f.uploadId,
        fileName: f.submissionName,
        sizeKb: f.sizeBytes / 1024,
        submittedAt,
        integrityStatus: (isDamaged ? 'damaged' : 'valid') as 'valid' | 'damaged',
        integrityMessage: isDamaged
          ? 'The selected file is empty (0 bytes). Please choose a file containing your answer.'
          : 'Format and checksum verified',
        contentSnippet: f.snippet || '',
      };
    });

    const anyDamaged = verifiedFiles.some(f => f.integrityStatus === 'damaged');

    const newSub: Submission = {
      id: 'sub_' + Math.random().toString(36).substring(2, 9),
      examId,
      studentId,
      files: verifiedFiles,
      status: anyDamaged ? 'in_progress' : 'submitted',
      integrityCheck: anyDamaged ? 'failed' : 'passed',
      submittedAt,
    };

    if (isDemoSubmissionRetry(hasFinalSubmission, hasActiveReopening)) {
      setDemoSubmissionAttempts((previous) => recordStudentSubmission(submissions, previous, newSub, true).demoAttempts);
    } else {
      setSubmissions((previous) => recordStudentSubmission(previous, demoSubmissionAttempts, newSub, false).canonical);
    }

    if (anyDamaged) {
      showToast('ตรวจสอบความสมบูรณ์ไม่ผ่าน', 'มีไฟล์ว่างหรือเสียหาย กรุณาอัปโหลดใหม่', 'error');
    } else {
      showToast('ยืนยันการส่งแล้ว', 'ระบบได้รับและสร้างค่าแฮชไฟล์คำตอบเรียบร้อยแล้ว', 'success');
    }
    return true;
  };

  // Simulation controls
  const triggerViolation = (
    examId: string,
    studentId: string,
    seatNo: string,
    type: ViolationType,
    detail: string
  ) => {
    const newViolation: Violation = {
      id: 'vio_' + Date.now(),
      examId,
      studentId,
      seatNo,
      type,
      detail,
      detectedAt: new Date().toLocaleTimeString(),
      acknowledged: false,
    };

    setViolations(prev => [newViolation, ...prev]);

    // If active student matches, trigger ST8 alert immediately
    if (currentStudent?.id === studentId) {
      setActiveViolationAlert(newViolation);
    }

    showToast('แจ้งเตือนเหตุผิดปกติ', `ที่นั่ง ${seatNo}: ${detail}`, 'error');
  };

  const acknowledgeViolation = (id: string) => {
    setViolations(prev => prev.map(v => v.id === id ? { ...v, acknowledged: true } : v));
    setActiveViolationAlert(null);
  };

  const toggleMachineStatus = (roomId: string, seatNo: string, status: MachineStatus) => {
    const seat = roomState.seats.find((item) => item.roomId === roomId && item.examSeatNo === seatNo);
    if (!seat) return;
    setRoomState((current) => ({ ...current, computers: current.computers.map((device) => device.seatId === seat.id
      ? { ...device, machineStatus: status, status: status === 'damaged' ? 'maintenance' : status === 'unavailable' ? 'inactive' : 'ready' } : device) }));
    const statusText: Record<MachineStatus, string> = {
      online: 'ออนไลน์',
      offline: 'ออฟไลน์',
      damaged: 'ชำรุด',
      unavailable: 'ไม่พร้อมใช้งาน',
    };
    showToast('อัปเดตสถานะอุปกรณ์แล้ว', `ตั้งค่าที่นั่ง ${seatNo} เป็น ${statusText[status]}`, 'info');
  };

  const resetToMockDefaults = () => {
    localStorage.clear();
    const academicDefaults = createInitialAcademicState();
    const migratedStudents = migrateAcademicStudents(initialStudents, academicDefaults);
    setAcademicState(academicDefaults);
    setStudents(migratedStudents);
    const migratedTeachers = migrateAcademicTeachers(initialTeachers, academicDefaults);
    setTeachers(migratedTeachers);
    setAdmins(initialAdmins);
    setMockAuthUsers(initialMockAuthUsers.map((user) => ({ ...user })));
    setRoomState(migrateRoomState(null, initialRooms));
    setCourses(migrateCourses(initialCourses, academicDefaults));
    setExamSessions(initialExamSessions);
    setSeatAssignments(initialSeatAssignments);
    setSubmissions(initialSubmissions);
    setDemoSubmissionAttempts([]);
    setViolations(initialViolations);
    setSecurityRules(defaultSecurityRules);
    setAuditLogs([]);
    setCurrentStudent(migratedStudents[1] || null);
    setCurrentTeacher(migratedTeachers[0]);
    setCurrentAdmin(initialAdmins[0]);
    setCurrentExamId('exam_0001');
    setStudentExamAttemptId(createFreshStudentExamAttemptId());
    setActiveStudentStep('ST1');
    showToast('รีเซ็ตข้อมูลแล้ว', 'คืนค่าข้อมูลทั้งหมดเป็นข้อมูลเริ่มต้นเรียบร้อยแล้ว', 'info');
  };

  return (
    <AppContext.Provider
      value={{
        academicState,
        saveAcademicRecord,
        saveAcademicStructure,
        deleteAcademicRecord,
        setAcademicStatus,
        assignStudentsToClassGroup,
        language,
        setLanguage,
        toggleLanguage,
        t,

        role,
        setRole,
        activeAdminRoute,
        setActiveAdminRoute,
        activeTeacherRoute,
        setActiveTeacherRoute,
        activeStudentStep,
        setActiveStudentStep,

        currentStudent: derivedCurrentStudent,
        setCurrentStudent,
        currentTeacher,
        setCurrentTeacher,
        currentAdmin,
        setCurrentAdmin,
        currentExamId,
        setCurrentExamId,
        studentExamAttemptId,
        startStudentExamAttempt,

        mockAuthUsers,
        completeMockRegistration,

        activeViolationAlert,
        setActiveViolationAlert,
        acknowledgeViolation,

        securityRules,
        updateSecurityRules,

        students: visibleStudents,
        studentDirectory,
        teachers,
        admins,
        rooms,
        roomState,
        manageRooms,
        courses,
        examSessions,
        seatAssignments,
        submissions,
        violations,
        auditLogs,

        toasts,
        showToast,
        dismissToast,

        addStudent,
        updateStudent,
        deleteStudent,
        updateAccountStatus,
        updateFaceReference,

        addTeacher,
        updateTeacher,
        deleteTeacher,

        addAdmin,
        updateAdmin,
        deleteAdmin,


        addCourse,
        updateCourse,
        deleteCourse,
        saveCourseRecord,
        saveSectionRecord,
        deleteSectionRecord,
        setSectionStatus,
        addStudentToSection,
        moveStudentBetweenSections,
        findStudentSectionInCourse,

        createExamSession,
        updateExamSession,
        adjustExamTime,
        reopenSubmission,

        assignSeat,
        unassignSeat,
        autoAssignSeats,

        submitStudentFiles,

        triggerViolation,
        toggleMachineStatus,
        resetToMockDefaults,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
