import { AppLanguage } from '../types';

export interface TranslationDict {
  [key: string]: {
    th: string;
    en: string;
  };
}

export const translations: TranslationDict = {
  // App General & Branding
  appName: {
    th: 'SecureLab',
    en: 'SecureLab',
  },
  appTagline: {
    th: 'ระบบจัดการการสอบในห้องปฏิบัติการคอมพิวเตอร์และความปลอดภัยทางวิชาการ',
    en: 'Lab Exam & Integrity System',
  },
  portalBadge: {
    th: 'ระบบการสอบ',
    en: 'PORTAL',
  },
  icitAuthGateway: {
    th: 'เกตเวย์ยืนยันตัวตน ICIT มหาวิทยาลัย',
    en: 'ICIT Authentication Gateway',
  },
  protectedLan: {
    th: 'เครือข่าย LAN ห้องสอบปลอดภัย',
    en: 'Protected LAN',
  },
  signOut: {
    th: 'สลับผู้ใช้ / ออกจากระบบ SSO',
    en: 'Switch User / Sign out to SSO Landing',
  },
  activeAlerts: {
    th: 'การแจ้งเตือนความปลอดภัย',
    en: 'Active Alerts',
  },
  
  // Roles
  adminRole: {
    th: 'ผู้ดูแลระบบ',
    en: 'System Administrator',
  },
  teacherRole: {
    th: 'อาจารย์ผู้คุมสอบ',
    en: 'Exam Proctor / Teacher',
  },
  studentRole: {
    th: 'นักศึกษาผู้เข้าสอบ',
    en: 'Examinee / Student',
  },

  // Common Actions & Buttons
  confirm: {
    th: 'ยืนยัน',
    en: 'Confirm',
  },
  cancel: {
    th: 'ยกเลิก',
    en: 'Cancel',
  },
  save: {
    th: 'บันทึกข้อมูล',
    en: 'Save Changes',
  },
  close: {
    th: 'ปิด',
    en: 'Close',
  },
  search: {
    th: 'ค้นหา...',
    en: 'Search...',
  },
  filter: {
    th: 'ตัวกรอง',
    en: 'Filter',
  },
  export: {
    th: 'ส่งออกข้อมูล',
    en: 'Export',
  },
  import: {
    th: 'นำเข้าข้อมูล',
    en: 'Import',
  },
  download: {
    th: 'ดาวน์โหลด',
    en: 'Download',
  },
  viewDetails: {
    th: 'ดูรายละเอียด',
    en: 'View Details',
  },
  refresh: {
    th: 'รีเฟรช',
    en: 'Refresh',
  },
  back: {
    th: 'ย้อนกลับ',
    en: 'Back',
  },
  continue: {
    th: 'ดำเนินการต่อ',
    en: 'Continue',
  },
  submit: {
    th: 'ส่งข้อมูล',
    en: 'Submit',
  },
  acknowledge: {
    th: 'รับทราบ',
    en: 'Acknowledge',
  },

  // Statuses
  active: {
    th: 'ปกติ (ใช้งานได้)',
    en: 'Active',
  },
  suspended: {
    th: 'ถูกระงับสิทธิ์',
    en: 'Suspended',
  },
  graduated_inactive: {
    th: 'สำเร็จการศึกษา / พ้นสภาพ',
    en: 'Graduated / Inactive',
  },
  online: {
    th: 'ออนไลน์',
    en: 'Online',
  },
  offline: {
    th: 'ออฟไลน์',
    en: 'Offline',
  },
  damaged: {
    th: 'เครื่องชำรุด',
    en: 'Damaged',
  },
  unavailable: {
    th: 'ไม่พร้อมใช้งาน',
    en: 'Unavailable',
  },
  submitted: {
    th: 'ส่งข้อสอบแล้ว',
    en: 'Submitted',
  },
  working: {
    th: 'กำลังทำข้อสอบ',
    en: 'Working',
  },
  late: {
    th: 'ส่งล่าช้า',
    en: 'Late Submission',
  },
  violation: {
    th: 'ตรวจพบการทุจริต',
    en: 'Violation Flagged',
  },
  reopened: {
    th: 'เปิดให้ส่งเพิ่ม',
    en: 'Reopened',
  },
  not_started: {
    th: 'ยังไม่เริ่มสอบ',
    en: 'Not Started',
  },

  // Student Flow
  accessCheckTitle: {
    th: 'กำลังตรวจสอบบัญชีนักศึกษา ICIT...',
    en: 'Verifying ICIT Student Account...',
  },
  accessCheckDesc: {
    th: 'ระบบกำลังตรวจสอบสถานะการลงทะเบียน สิทธิ์การเข้าสอบ และเครื่องสอบประจำที่นั่ง...',
    en: 'Checking initial enrollment status, biometric reference data, and seat assignment...',
  },
  firstTimeSetup: {
    th: 'การตั้งค่าเริ่มต้นสำหรับนักศึกษาใหม่',
    en: 'First-Time Setup',
  },
  createPassword: {
    th: 'ตั้งรหัสผ่านสำหรับเข้าสอบ',
    en: 'Create Exam Password',
  },
  faceEnrollment: {
    th: 'ลงทะเบียนภาพใบหน้าอ้างอิง',
    en: 'Face Biometric Enrollment',
  },
  faceVerification: {
    th: 'ยืนยันตัวตนด้วยใบหน้าก่อนเข้าสอบ',
    en: 'Face Verification Login',
  },
  examBriefing: {
    th: 'ข้อกำหนดและระเบียบปฏิบัติในการสอบ',
    en: 'Pre-Exam Briefing & Rules',
  },
  remainingTime: {
    th: 'เวลาสอบคงเหลือ',
    en: 'Remaining Time',
  },
  uploadAnswer: {
    th: 'ส่งไฟล์คำตอบข้อสอบ',
    en: 'Submit Answer File',
  },
  fileIntegrityChecking: {
    th: 'กำลังตรวจสอบความถูกต้องของไฟล์คำตอบ...',
    en: 'Verifying file integrity...',
  },
  submissionSuccess: {
    th: 'ส่งไฟล์ข้อสอบเรียบร้อยแล้ว',
    en: 'Submission Successfully Recorded',
  },

  // Teacher Navigation
  teacherNavDashboard: {
    th: 'ภาพรวมการสอบ',
    en: 'Exam Overview',
  },
  teacherNavCourses: {
    th: 'รายวิชาและรอบการสอบ',
    en: 'Courses & Exam Sessions',
  },
  teacherNavStudents: {
    th: 'กลุ่มนักศึกษาและรายชื่อ',
    en: 'Student Groups & Rosters',
  },
  teacherNavSeats: {
    th: 'ผังที่นั่งห้องปฏิบัติการ',
    en: 'Lab Seat Layout',
  },
  teacherNavLiveMonitoring: {
    th: 'ติดตามการสอบแบบเรียลไทม์',
    en: 'Live Exam Monitoring',
  },
  teacherNavRepository: {
    th: 'คลังไฟล์คำตอบข้อสอบ',
    en: 'Answer File Repository',
  },
  teacherNavProfile: {
    th: 'ข้อมูลอาจารย์ผู้คุมสอบ',
    en: 'Teacher Profile',
  },

  // Admin Navigation
  adminNavDashboard: {
    th: 'แดชบอร์ดความปลอดภัยและระบบ',
    en: 'System Security Dashboard',
  },
  adminNavUsers: {
    th: 'จัดการผู้ใช้และสิทธิ์',
    en: 'User & Role Management',
  },
  adminNavRooms: {
    th: 'ผังห้องสอบและเครื่องคอมพิวเตอร์',
    en: 'Rooms & Workstations',
  },
  adminNavBiometrics: {
    th: 'คลังข้อมูลชีวมิติใบหน้าอ้างอิง',
    en: 'Biometric Reference Library',
  },
  adminNavCheatRules: {
    th: 'กำหนดค่านโยบายตรวจจับทุจริต',
    en: 'Cheat Detection Policies',
  },
  adminNavAudit: {
    th: 'บันทึกประวัติการใช้งานระบบ',
    en: 'System Audit Logs',
  },
  adminNavProfile: {
    th: 'ข้อมูลผู้ดูแลระบบ',
    en: 'Administrator Profile',
  },
};

export function getTranslation(key: string, lang: AppLanguage = 'th', fallback?: string): string {
  if (translations[key] && translations[key][lang]) {
    return translations[key][lang];
  }
  return fallback || key;
}
