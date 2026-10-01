import type {
  Course,
  ExamPolicy,
  ExamResourceRule,
  ExamRule,
  ExamSession,
  ExamType,
  Room,
  Student,
} from '../types';
import { studentMatchesSection } from './courseState';

export interface ExamWizardState {
  courseId: string;
  sectionNo: string;
  examName: string;
  examType: ExamType;
  examDate: string;
  startTime: string;
  endTime: string;
  roomId: string;
  format: 'online' | 'offline';
  acceptedExtensions: string[];
  maxSizeMb: number;
  filenamePattern: string;
  requiredFileCount: number;
  instructions: string;
  rules: ExamRule[];
  policy: ExamPolicy;
}

export interface ExamDraftRecord {
  id: string;
  teacherId: string;
  editingExamId?: string;
  updatedAt: string;
  state: ExamWizardState;
}

export interface ExamWizardEnvironment {
  courses: Course[];
  students: Student[];
  rooms: Room[];
  examSessions: ExamSession[];
  editingExamId?: string;
}

export const examDraftStorageKey = 'securelab_teacher_exam_drafts_v1';

export const policySubStepCount = 4;
export const initialPolicySubStep = 0;
export const policySubSteps = ['ตัวตนและเครื่อง', 'ไฟล์คำตอบ', 'รูปแบบการสอบ', 'ทรัพยากร'] as const;

export const getPolicySubStepLabel = (index: number, format: ExamSession['format']) =>
  index === 2 ? (format === 'online' ? 'ออนไลน์' : 'ออฟไลน์') : policySubSteps[index] || '';

export const getNextPolicySubStep = (current: number) => Math.min(current + 1, policySubStepCount - 1);

export const getPreviousPolicySubStep = (current: number) => Math.max(current - 1, 0);

export const isFinalPolicySubStep = (current: number) => current === policySubStepCount - 1;

export const filterExamDrafts = (
  drafts: ExamDraftRecord[],
  courses: Course[],
  query: string,
) => {
  const normalizedQuery = query.trim().toLocaleLowerCase('th');
  if (!normalizedQuery) return [...drafts];

  return drafts.filter((draft) => {
    const course = courses.find((candidate) => candidate.id === draft.state.courseId);
    return [
      draft.state.examName,
      course?.courseCode,
      course?.courseName,
      draft.state.sectionNo,
      draft.state.sectionNo ? `Section ${draft.state.sectionNo}` : undefined,
    ].some((value) => value?.toLocaleLowerCase('th').includes(normalizedQuery));
  });
};

export const defaultExamPolicy = (): ExamPolicy => ({
  common: {
    requireRegisteredDevice: true,
    requireAgent: true,
    requireFaceBeforeExam: true,
    requirePeriodicFaceCheck: false,
    preventDuplicateSession: true,
    blockUsbStorage: true,
    logViolations: true,
  },
  file: {
    requireExamWorkspace: true,
    requireDeviceSignature: true,
    lockAfterFinalSubmit: true,
    blockExternalStorageSource: true,
  },
  online: {
    resourceMode: 'allowlist',
    allowedDomains: ['securelab.ic.it.ac.th'],
    allowedResources: [],
    blockedResources: [],
    blockUnknownApplications: true,
    restrictBrowser: true,
    blockCommunicationApps: true,
    blockRemoteDesktop: true,
  },
  offline: {
    blockInternet: true,
    localServerOnly: true,
    localServerHost: 'exam.local',
    isolateClients: true,
    blockSsh: true,
    blockSmb: true,
    blockFtp: true,
    blockScp: true,
    blockRemoteDesktop: true,
    blockExternalNetwork: true,
  },
});

export const createEmptyExamWizardState = (): ExamWizardState => ({
  courseId: '',
  sectionNo: '',
  examName: '',
  examType: 'final',
  examDate: '',
  startTime: '09:00',
  endTime: '12:00',
  roomId: '',
  format: 'online',
  acceptedExtensions: ['.zip', '.pdf'],
  maxSizeMb: 100,
  filenamePattern: '{studentCode}_final',
  requiredFileCount: 1,
  instructions: 'ตรวจสอบไฟล์ให้ถูกต้องก่อนยืนยันส่งคำตอบขั้นสุดท้าย',
  rules: [
    { id: 'rule_registered_device', text: 'ใช้เครื่องสอบและบัญชีที่ได้รับอนุญาตเท่านั้น' },
    { id: 'rule_no_communication', text: 'ห้ามสื่อสารกับบุคคลอื่นระหว่างการสอบ' },
    { id: 'rule_verify_files', text: 'ตรวจสอบไฟล์คำตอบก่อนยืนยันส่งขั้นสุดท้าย' },
  ],
  policy: defaultExamPolicy(),
});

export const examWizardStateFromSession = (exam: ExamSession): ExamWizardState => ({
  ...createEmptyExamWizardState(),
  courseId: exam.courseId,
  sectionNo: exam.sectionNo,
  examName: exam.examName || 'การสอบ',
  examType: exam.examType || 'other',
  examDate: exam.examDate,
  startTime: exam.startTime,
  endTime: exam.endTime,
  roomId: exam.roomId,
  format: exam.format,
  acceptedExtensions: [...exam.fileRequirements.acceptedExtensions],
  maxSizeMb: exam.fileRequirements.maxSizeMb,
  filenamePattern: exam.fileRequirements.filenamePattern,
  requiredFileCount: exam.fileRequirements.requiredFileCount,
  instructions: exam.fileRequirements.instructions,
  rules: structuredClone(exam.rules),
  policy: exam.policy ? structuredClone(exam.policy) : defaultExamPolicy(),
});

export const sectionsForWizardCourse = (courses: Course[], courseId: string) =>
  courses.find((course) => course.id === courseId)?.sections.filter((section) => section.status !== 'inactive') || [];

export const selectWizardCourse = (state: ExamWizardState, courseId: string, courses: Course[]): ExamWizardState => ({
  ...state,
  courseId,
  sectionNo: sectionsForWizardCourse(courses, courseId).some((section) => section.sectionNo === state.sectionNo)
    ? state.sectionNo
    : '',
});

export const resolveWizardSection = (state: ExamWizardState, courses: Course[]) =>
  sectionsForWizardCourse(courses, state.courseId).find((section) => section.sectionNo === state.sectionNo);

export const resolveEligibleExamStudents = (
  state: Pick<ExamWizardState, 'courseId' | 'sectionNo'>,
  courses: Course[],
  students: Student[],
) => {
  const section = courses.find((course) => course.id === state.courseId)?.sections
    .find((candidate) => candidate.sectionNo === state.sectionNo && candidate.status !== 'inactive');
  return section ? students.filter((student) => studentMatchesSection(student, section)) : [];
};

const timeToMinutes = (value: string): number | null => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
};

export const calculateExamDurationMinutes = (startTime: string, endTime: string): number | null => {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  return start !== null && end !== null && end > start ? end - start : null;
};

export const findExamRoomConflict = (
  examSessions: ExamSession[],
  candidate: Pick<ExamWizardState, 'examDate' | 'startTime' | 'endTime' | 'roomId'>,
  editingExamId?: string,
) => {
  const start = timeToMinutes(candidate.startTime);
  const end = timeToMinutes(candidate.endTime);
  if (!candidate.roomId || !candidate.examDate || start === null || end === null) return undefined;

  return examSessions.find((exam) => {
    if (exam.id === editingExamId || exam.roomId !== candidate.roomId || exam.examDate !== candidate.examDate) return false;
    const existingStart = timeToMinutes(exam.startTime);
    const existingEnd = timeToMinutes(exam.endTime);
    return existingStart !== null && existingEnd !== null && start < existingEnd && end > existingStart;
  });
};

export const getExamRoomCapacity = (room?: Room) => room?.seats.length || 0;
export const getExamRoomComputerCount = (room?: Room) => room?.seats.filter((seat) => !seat.disabled && seat.machineNo).length || 0;

export const normalizeFileExtension = (value: string) => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9.]/g, '');
  if (!normalized) return '';
  const extension = normalized.startsWith('.') ? normalized : `.${normalized}`;
  return /^\.[a-z0-9]+(?:\.[a-z0-9]+)*$/.test(extension) ? extension : '';
};

export const normalizeResourceValue = (value: string, type: ExamResourceRule['type']): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (type === 'application') return trimmed.replace(/\s+/g, ' ');

  const withoutProtocol = trimmed.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/\.$/, '');
  return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(withoutProtocol)
    ? withoutProtocol
    : null;
};

export const createResourceRule = (
  name: string,
  type: ExamResourceRule['type'],
  value: string,
): { rule?: ExamResourceRule; error?: string } => {
  const normalizedName = name.trim();
  const normalizedValue = normalizeResourceValue(value, type);
  if (!normalizedName) return { error: 'กรุณาระบุชื่อเว็บไซต์หรือโปรแกรม' };
  if (!normalizedValue) return { error: type === 'application' ? 'กรุณาระบุชื่อโปรแกรม' : 'รูปแบบโดเมนไม่ถูกต้อง' };
  return {
    rule: {
      id: `resource_${crypto.randomUUID()}`,
      name: normalizedName,
      type,
      value: normalizedValue,
    },
  };
};

export const recommendedBlockedResources: ExamResourceRule[] = [
  { id: 'preset_chatgpt', name: 'ChatGPT', type: 'web_app', value: 'chatgpt.com', category: 'GENERATIVE AI & ASSISTANTS' },
  { id: 'preset_gemini', name: 'Gemini', type: 'web_app', value: 'gemini.google.com', category: 'GENERATIVE AI & ASSISTANTS' },
  { id: 'preset_claude', name: 'Claude', type: 'web_app', value: 'claude.ai', category: 'GENERATIVE AI & ASSISTANTS' },
  { id: 'preset_perplexity', name: 'Perplexity', type: 'web_app', value: 'perplexity.ai', category: 'GENERATIVE AI & ASSISTANTS' },
  { id: 'preset_copilot', name: 'Copilot', type: 'web_app', value: 'copilot.microsoft.com', category: 'GENERATIVE AI & ASSISTANTS' },
  { id: 'preset_quillbot', name: 'QuillBot', type: 'web_app', value: 'quillbot.com', category: 'GENERATIVE AI & ASSISTANTS' },
  { id: 'preset_blackbox', name: 'Blackbox AI', type: 'web_app', value: 'blackbox.ai', category: 'GENERATIVE AI & ASSISTANTS' },
  { id: 'preset_teamviewer', name: 'TeamViewer', type: 'application', value: 'TeamViewer', category: 'REMOTE DESKTOP & SCREEN SHARING' },
  { id: 'preset_anydesk', name: 'AnyDesk', type: 'application', value: 'AnyDesk', category: 'REMOTE DESKTOP & SCREEN SHARING' },
  { id: 'preset_chrome_remote', name: 'Chrome Remote Desktop', type: 'web_app', value: 'remotedesktop.google.com', category: 'REMOTE DESKTOP & SCREEN SHARING' },
  { id: 'preset_zoom', name: 'Zoom', type: 'application', value: 'Zoom', category: 'REMOTE DESKTOP & SCREEN SHARING' },
  { id: 'preset_teams', name: 'Microsoft Teams', type: 'application', value: 'Microsoft Teams', category: 'REMOTE DESKTOP & SCREEN SHARING' },
  { id: 'preset_skype', name: 'Skype', type: 'application', value: 'Skype', category: 'REMOTE DESKTOP & SCREEN SHARING' },
  { id: 'preset_discord', name: 'Discord', type: 'application', value: 'Discord', category: 'COMMUNICATION & SOCIAL MEDIA' },
  { id: 'preset_line', name: 'LINE', type: 'application', value: 'LINE', category: 'COMMUNICATION & SOCIAL MEDIA' },
  { id: 'preset_facebook', name: 'Facebook', type: 'website', value: 'facebook.com', category: 'COMMUNICATION & SOCIAL MEDIA' },
  { id: 'preset_messenger', name: 'Messenger', type: 'web_app', value: 'messenger.com', category: 'COMMUNICATION & SOCIAL MEDIA' },
  { id: 'preset_whatsapp', name: 'WhatsApp', type: 'web_app', value: 'web.whatsapp.com', category: 'COMMUNICATION & SOCIAL MEDIA' },
  { id: 'preset_telegram', name: 'Telegram', type: 'application', value: 'Telegram', category: 'COMMUNICATION & SOCIAL MEDIA' },
  { id: 'preset_x', name: 'X / Twitter', type: 'website', value: 'x.com', category: 'COMMUNICATION & SOCIAL MEDIA' },
  { id: 'preset_instagram', name: 'Instagram', type: 'website', value: 'instagram.com', category: 'COMMUNICATION & SOCIAL MEDIA' },
  { id: 'preset_google', name: 'Google Search', type: 'website', value: 'google.com', category: 'SEARCH & ENTERTAINMENT' },
  { id: 'preset_youtube', name: 'YouTube', type: 'website', value: 'youtube.com', category: 'SEARCH & ENTERTAINMENT' },
  { id: 'preset_reddit', name: 'Reddit', type: 'website', value: 'reddit.com', category: 'SEARCH & ENTERTAINMENT' },
];

export const examResourceCategoryLabels: Record<string, string> = {
  'GENERATIVE AI & ASSISTANTS': 'ผู้ช่วย AI',
  'REMOTE DESKTOP & SCREEN SHARING': 'ควบคุมระยะไกลและแชร์หน้าจอ',
  'COMMUNICATION & SOCIAL MEDIA': 'การสื่อสารและสื่อสังคม',
  'SEARCH & ENTERTAINMENT': 'ค้นหาและความบันเทิง',
  'DEVELOPMENT DOCUMENTATION': 'เอกสารสำหรับพัฒนาโปรแกรม',
};

export const recommendedAllowedResources: ExamResourceRule[] = [
  { id: 'recommended_python_docs', name: 'เอกสาร Python', type: 'website', value: 'docs.python.org', category: 'DEVELOPMENT DOCUMENTATION' },
  { id: 'recommended_mdn', name: 'เอกสาร MDN', type: 'website', value: 'developer.mozilla.org', category: 'DEVELOPMENT DOCUMENTATION' },
];

export const getSelectedExamResources = (policy: ExamPolicy, format: ExamSession['format']) =>
  format === 'online' && policy.online.resourceMode === 'allowlist'
    ? policy.online.allowedResources || []
    : policy.online.blockedResources;

export const getExamResourceMeaning = (policy: ExamPolicy, format: ExamSession['format']) =>
  format === 'online' && policy.online.resourceMode === 'allowlist' ? 'allowed' as const : 'blocked' as const;

export const setSelectedExamResources = (
  policy: ExamPolicy,
  format: ExamSession['format'],
  resources: ExamResourceRule[],
): ExamPolicy => ({
  ...policy,
  online: getExamResourceMeaning(policy, format) === 'allowed'
    ? { ...policy.online, allowedResources: resources }
    : { ...policy.online, blockedResources: resources },
});

export const applyRecommendedExamResources = (policy: ExamPolicy, format: ExamSession['format']): ExamPolicy => {
  const recommendedBlockedIds = ['preset_chatgpt', 'preset_discord', 'preset_anydesk'];
  const resources = getExamResourceMeaning(policy, format) === 'allowed'
    ? recommendedAllowedResources
    : recommendedBlockedResources.filter((rule) => recommendedBlockedIds.includes(rule.id));
  const next = setSelectedExamResources(policy, format, resources);
  return getExamResourceMeaning(policy, format) === 'allowed'
    ? { ...next, online: { ...next.online, allowedDomains: Array.from(new Set([...next.online.allowedDomains, 'docs.python.org', 'developer.mozilla.org'])) } }
    : next;
};

export const validateExamWizard = (state: ExamWizardState, environment: ExamWizardEnvironment) => {
  const errors: Record<string, string> = {};
  const course = environment.courses.find((candidate) => candidate.id === state.courseId && candidate.status === 'active');
  const section = course?.sections.find((candidate) => candidate.sectionNo === state.sectionNo && candidate.status !== 'inactive');
  const room = environment.rooms.find((candidate) => candidate.id === state.roomId);
  const eligibleCount = resolveEligibleExamStudents(state, environment.courses, environment.students).length;
  const durationMinutes = calculateExamDurationMinutes(state.startTime, state.endTime);
  const conflict = findExamRoomConflict(environment.examSessions, state, environment.editingExamId);

  if (!course) errors.courseId = 'กรุณาเลือกรายวิชาที่คุณได้รับมอบหมาย';
  if (!section) errors.sectionNo = 'กรุณาเลือก Section ที่คุณได้รับมอบหมาย';
  if (!state.examName.trim()) errors.examName = 'กรุณาระบุชื่อการสอบ';
  if (!eligibleCount) errors.students = 'Section นี้ไม่มีผู้มีสิทธิ์สอบจากข้อมูลปัจจุบัน';
  if (!state.examDate) errors.examDate = 'กรุณาเลือกวันที่สอบ';
  if (!durationMinutes) errors.time = 'เวลาเริ่มต้องมาก่อนเวลาสิ้นสุด';
  if (!room || room.status !== 'ready') errors.roomId = 'กรุณาเลือกห้องสอบที่พร้อมใช้งาน';
  if (conflict) errors.conflict = `ห้อง ${room?.labName || ''} มีการสอบในช่วงเวลานี้แล้ว`;
  if (room && eligibleCount > getExamRoomCapacity(room)) errors.capacity = 'จำนวนที่นั่งไม่เพียงพอสำหรับผู้เข้าสอบ';
  if (!state.acceptedExtensions.length) errors.files = 'กรุณาเลือกประเภทไฟล์อย่างน้อย 1 ประเภท';
  if (!Number.isFinite(state.maxSizeMb) || state.maxSizeMb < 1) errors.maxSizeMb = 'ขนาดไฟล์สูงสุดต้องมากกว่า 0 MB';
  if (state.format === 'online' && !['allowlist', 'blocklist'].includes(state.policy.online.resourceMode)) {
    errors.onlinePolicy = 'กรุณาเลือกรูปแบบการควบคุมออนไลน์';
  } else if (state.format === 'online' && state.policy.online.resourceMode === 'allowlist' &&
    !state.policy.online.allowedDomains.length && !state.policy.online.allowedResources?.length) {
    errors.onlinePolicy = 'Allowlist ต้องมีเว็บไซต์หรือทรัพยากรที่อนุญาตอย่างน้อย 1 รายการ';
  }
  if (state.format === 'offline' && state.policy.offline.localServerOnly && !state.policy.offline.localServerHost.trim()) {
    errors.offlinePolicy = 'กรุณาระบุ Local Exam Server';
  }

  return errors;
};

export const examWizardToSession = (
  state: ExamWizardState,
  status: ExamSession['status'] = 'upcoming',
): Omit<ExamSession, 'id'> => ({
  examName: state.examName.trim(),
  examType: state.examType,
  courseId: state.courseId,
  sectionNo: state.sectionNo,
  examDate: state.examDate,
  startTime: state.startTime,
  endTime: state.endTime,
  durationMinutes: calculateExamDurationMinutes(state.startTime, state.endTime) || 0,
  roomId: state.roomId,
  format: state.format,
  fileRequirements: {
    acceptedExtensions: state.acceptedExtensions,
    maxSizeMb: state.maxSizeMb,
    filenamePattern: state.filenamePattern,
    requiredFileCount: state.requiredFileCount,
    instructions: state.instructions,
  },
  rules: state.rules,
  policy: state.policy,
  status,
});

const storageOrUndefined = (storage?: Pick<Storage, 'getItem' | 'setItem'>) => storage || (typeof localStorage === 'undefined' ? undefined : localStorage);

export const loadExamDrafts = (
  teacherId: string,
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): ExamDraftRecord[] => {
  try {
    const value = storageOrUndefined(storage)?.getItem(examDraftStorageKey);
    const records = value ? JSON.parse(value) : [];
    return Array.isArray(records) ? records.filter((record) => record.teacherId === teacherId) : [];
  } catch {
    return [];
  }
};

export const persistExamDraft = (
  draft: ExamDraftRecord,
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
) => {
  const target = storageOrUndefined(storage);
  if (!target) return;
  let records: ExamDraftRecord[] = [];
  try {
    const value = target.getItem(examDraftStorageKey);
    records = value ? JSON.parse(value) : [];
    if (!Array.isArray(records)) records = [];
  } catch {
    records = [];
  }
  target.setItem(examDraftStorageKey, JSON.stringify([...records.filter((record) => record.id !== draft.id), draft]));
};

export const removeExamDraft = (
  draftId: string,
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
) => {
  const target = storageOrUndefined(storage);
  if (!target) return;
  let records: ExamDraftRecord[] = [];
  try {
    const value = target.getItem(examDraftStorageKey);
    records = value ? JSON.parse(value) : [];
  } catch {
    records = [];
  }
  target.setItem(examDraftStorageKey, JSON.stringify(records.filter((record) => record.id !== draftId)));
};
