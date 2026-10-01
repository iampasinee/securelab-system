import { calculateYearLevelFromAdmissionYear } from '../../utils/academicYear';
import React from 'react';
import { useApp } from '../../context/AppContext';
import { ShieldCheck, LogOut, Bell, ChevronRight, Menu } from 'lucide-react';
import { Badge } from './Badge';
import { DemoTimeIndicator } from '../simulation/DemoTimeControl';

interface HeaderProps {
  onAdminMenuToggle?: () => void;
  onTeacherMenuToggle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onAdminMenuToggle, onTeacherMenuToggle }) => {
  const {
    role,
    setRole,
    currentStudent,
    currentTeacher,
    currentAdmin,
    violations,
    setActiveTeacherRoute,
    setActiveAdminRoute,
    language,
  } = useApp();

  const isThai = language === 'th';
  const unacknowledgedViolations = violations.filter((v) => !v.acknowledged);

  const currentUserDisplay = () => {
    if (role === 'admin') {
      return {
        name: currentAdmin?.fullName || (isThai ? 'ผู้ดูแลระบบ' : 'Administrator'),
        email: currentAdmin?.email || 'admin@icit.university.ac.th',
        roleLabel: isThai ? 'ผู้ดูแลระบบส่วนกลาง (ICIT)' : 'System Administrator',
        badge: isThai ? 'ผู้ดูแลระบบ' : 'Admin',
      };
    }
    if (role === 'teacher') {
      return {
        name: currentTeacher?.fullName || (isThai ? 'อาจารย์ผู้คุมสอบ' : 'Teacher'),
        email: currentTeacher?.email || 'teacher@icit.university.ac.th',
        roleLabel: currentTeacher?.faculty || (isThai ? 'คณะวิศวกรรมศาสตร์' : 'Faculty of Engineering'),
        badge: isThai ? 'อาจารย์ผู้คุมสอบ' : 'Teacher',
      };
    }
    return {
      name: currentStudent?.fullName || (isThai ? 'นักศึกษา' : 'Student'),
      email: currentStudent?.email || 'student@icit.university.ac.th',
      roleLabel: currentStudent
        ? `${currentStudent.studentCode} • ชั้นปีที่ ${currentStudent.admissionYear ? calculateYearLevelFromAdmissionYear(currentStudent.admissionYear).yearLevel || '—' : '—'}`
        : (isThai ? 'เข้าสู่ระบบแล้ว' : 'Signed In'),
      badge: isThai ? 'ผู้เข้าสอบ' : 'Examinee',
    };
  };

  const user = currentUserDisplay();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-3 shadow-xs sm:px-6">
      {/* Brand & Context */}
      <div className="flex items-center gap-4">
        {role === 'admin' && onAdminMenuToggle && (
          <button
            type="button"
            onClick={onAdminMenuToggle}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 md:hidden"
            aria-label="เปิดเมนูผู้ดูแลระบบ"
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
        )}
        {role === 'teacher' && onTeacherMenuToggle && (
          <button
            type="button"
            onClick={onTeacherMenuToggle}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 md:hidden"
            aria-label="เปิดเมนูอาจารย์"
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
        )}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 tracking-tight leading-none text-base">
                SecureLab
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-100">
                {isThai ? 'ระบบการสอบ' : 'PORTAL'}
              </span>
            </div>
            <span className="text-[11px] text-gray-400 font-medium leading-none">
              {role === 'student' ? 'ระบบจัดการการสอบในห้องปฏิบัติการ' : isThai ? 'ระบบจัดการการสอบแล็บคอมพิวเตอร์' : 'Lab Exam & Integrity System'}
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center text-xs text-gray-400 gap-1 pl-4 border-l border-gray-200">
          <span>เข้าสู่ระบบด้วยบัญชี ICIT</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <Badge variant="success" size="sm">
            เครือข่ายแลนภายในปลอดภัย
          </Badge>
        </div>
      </div>

      {/* Right User & Actions */}
      <div className="flex items-center gap-3">
        {role !== 'student' && <>
          <DemoTimeIndicator compact className="max-w-24 lg:hidden" />
          <DemoTimeIndicator className="hidden max-w-44 lg:inline-flex" />
        </>}
        {/* Violation alert counter for teacher */}
        {role === 'teacher' && (
          <button
            onClick={() => setActiveTeacherRoute('T5')}
            className={`relative p-2 rounded-xl border transition-colors flex items-center gap-2 text-xs font-medium ${
              unacknowledgedViolations.length > 0
                ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <Bell className={`w-4 h-4 ${unacknowledgedViolations.length > 0 ? 'text-red-600 animate-bounce' : ''}`} />
            <span className="hidden sm:inline">
              {isThai ? 'แจ้งเตือนผิดปกติ' : 'Active Alerts'}
            </span>
            {unacknowledgedViolations.length > 0 && (
              <span className="bg-red-600 text-white rounded-full px-1.5 py-0.2 text-[10px] font-bold">
                {unacknowledgedViolations.length}
              </span>
            )}
          </button>
        )}

        {/* User Card */}
        <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-gray-900 leading-tight">
              {user.name}
            </div>
            <div className="text-[11px] text-gray-500 font-medium">
              {user.email}
            </div>
          </div>

          <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
            {user.name.charAt(0)}
          </div>

          <button
            onClick={() => setRole(null)}
            title="ออกจากระบบ"
            aria-label="ออกจากระบบ"
            className="flex items-center gap-1.5 rounded-xl p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden text-xs font-semibold lg:inline">ออกจากระบบ</span>
          </button>
        </div>
      </div>
    </header>
  );
};
