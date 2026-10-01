import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Sparkles,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  ShieldAlert,
  Laptop,
  Clock,
  UserCheck,
  Zap,
} from 'lucide-react';
import { getAdminRouteFromHash } from '../../utils/adminRoutes';

export const SimulationToolbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    role,
    setRole,
    startStudentExamAttempt,
    students,
    teachers,
    admins,
    setCurrentTeacher,
    setCurrentAdmin,
    currentStudent,
    currentExamId,
    currentTeacher,
    currentAdmin,
    triggerViolation,
    adjustExamTime,
    reopenSubmission,
    toggleMachineStatus,
    resetToMockDefaults,
    rooms,
    setActiveTeacherRoute,
    setActiveAdminRoute,
    language,
  } = useApp();
  const isThai = language === 'th';

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {isOpen ? (
        <div className="bg-white/95 text-gray-900 p-4 rounded-2xl shadow-xl border border-gray-200 w-84 backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span className="font-semibold text-sm text-gray-900">
                {isThai ? 'ตัวจำลองการทดสอบห้องแล็บ' : 'Interactive Lab Simulator'}
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-700 p-1 rounded transition-colors cursor-pointer"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 space-y-3 text-xs">
            {/* Quick Role Switcher */}
            <div>
              <label className="text-gray-500 block mb-1 font-medium">
                {isThai ? 'สลับบทบาทการใช้งาน:' : 'Switch Active Role:'}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => {
                    setRole('admin');
                    setActiveAdminRoute(getAdminRouteFromHash());
                  }}
                  className={`py-1.5 px-2 rounded-lg font-medium transition-all cursor-pointer ${
                    role === 'admin'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  {isThai ? 'แอดมิน' : 'Admin'}
                </button>
                <button
                  onClick={() => {
                    setRole('teacher');
                    setActiveTeacherRoute('T1');
                  }}
                  className={`py-1.5 px-2 rounded-lg font-medium transition-all cursor-pointer ${
                    role === 'teacher'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  {isThai ? 'อาจารย์' : 'Teacher'}
                </button>
                <button
                  onClick={() => {
                    const student = currentStudent || students[0];
                    if (student) startStudentExamAttempt(student, currentExamId);
                  }}
                  className={`py-1.5 px-2 rounded-lg font-medium transition-all cursor-pointer ${
                    role === 'student'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}
                >
                  {isThai ? 'นักศึกษา' : 'Student'}
                </button>
              </div>
            </div>

            {/* Persona picker based on active role */}
            {role === 'student' && (
              <div>
                <label className="text-gray-500 block mb-1 font-medium">
                  {isThai ? 'เลือกตัวตนนักศึกษา:' : 'Select Student Persona:'}
                </label>
                <select
                  value={currentStudent?.id}
                  onChange={(e) => {
                    const found = students.find((s) => s.id === e.target.value);
                    if (found) {
                      startStudentExamAttempt(found, currentExamId);
                    }
                  }}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg p-1.5 text-xs focus:ring-1 focus:ring-blue-500"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.isFirstTime ? (isThai ? 'ครั้งแรก' : '1st-Time New') : s.accountStatus})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {role === 'teacher' && (
              <div>
                <label className="text-gray-500 block mb-1 font-medium">
                  {isThai ? 'เลือกตัวตนอาจารย์:' : 'Select Teacher Persona:'}
                </label>
                <select
                  value={currentTeacher?.id}
                  onChange={(e) => {
                    const found = teachers.find((t) => t.id === e.target.value);
                    if (found) {
                      setCurrentTeacher(found);
                      setActiveTeacherRoute('T1');
                    }
                  }}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 rounded-lg p-1.5 text-xs focus:ring-1 focus:ring-blue-500"
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} ({t.icitProfileStatus === 'pending' ? (isThai ? 'รอยืนยันโปรไฟล์' : 'Pending profile') : (isThai ? 'ยืนยันแล้ว' : 'Confirmed')})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Simulation Action Triggers */}
            <div className="pt-2 border-t border-gray-200 space-y-1.5">
              <span className="text-gray-500 block font-medium mb-1">
                {isThai ? 'จำลองเหตุการณ์ทันที:' : 'Instant Event Triggers:'}
              </span>

              <button
                onClick={() =>
                  triggerViolation(
                    'exam_0001',
                    'std_0002',
                    'A2',
                    'unauthorized_website',
                    'Accessed unauthorized domain: facebook.com'
                  )
                }
                className="w-full text-left py-1.5 px-2.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span>{isThai ? 'จำลองเข้าเว็บต้องห้าม (ที่นั่ง A2)' : 'Trigger Website Violation (Seat A2)'}</span>
              </button>

              <button
                onClick={() =>
                  triggerViolation(
                    'exam_0001',
                    'std_0001',
                    'A1',
                    'duplicate_login',
                    'Duplicate session detected from IP 192.168.10.88'
                  )
                }
                className="w-full text-left py-1.5 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>{isThai ? 'จำลองล็อกอินซ้ำซ้อน (ที่นั่ง A1)' : 'Trigger Duplicate Login (Seat A1)'}</span>
              </button>

              <button
                onClick={() => {
                  const room = rooms[0];
                  const seat = room?.seats?.find((s) => s.seatNo === 'A3');
                  const nextStatus = seat?.status === 'offline' ? 'online' : 'offline';
                  toggleMachineStatus('room_0001', 'A3', nextStatus);
                }}
                className="w-full text-left py-1.5 px-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Laptop className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>{isThai ? 'สลับสถานะ PC-301-03 (ที่นั่ง A3) ออนไลน์/ออฟไลน์' : 'Toggle PC-301-03 (Seat A3) Offline/Online'}</span>
              </button>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  onClick={() => adjustExamTime('exam_0001', 5, 'room', undefined, 'Simulator quick +5m')}
                  className="py-1.5 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-center font-medium cursor-pointer"
                >
                  {isThai ? '+5 นาที' : '+5 Mins'}
                </button>
                <button
                  onClick={() => reopenSubmission('exam_0001', 15, 'room', undefined, 'Simulator reopen')}
                  className="py-1.5 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-center font-medium cursor-pointer"
                >
                  {isThai ? 'เปิดส่งซ้ำ +15 นาที' : 'Reopen +15m'}
                </button>
              </div>
            </div>

            {/* Reset Defaults */}
            <div className="pt-2 border-t border-gray-200">
              <button
                onClick={resetToMockDefaults}
                className="w-full py-1.5 px-2 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isThai ? 'รีเซ็ตเป็นข้อมูลเริ่มต้น' : 'Reset to PRD Baseline Data'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-900 px-3.5 py-2 rounded-full shadow-lg border border-gray-200 text-xs font-semibold backdrop-blur-sm transition-all hover:scale-105 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>{isThai ? 'จำลองระบบแล็บ' : 'Lab Simulator'}</span>
          <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
        </button>
      )}
    </div>
  );
};
