import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  UserCheck,
  ShieldCheck,
  Building2,
  Mail,
  Hash,
  Award,
  Calendar,
  LogOut,
  CheckCircle2,
} from 'lucide-react';
import { Badge } from '../common/Badge';

export const TeacherProfile: React.FC = () => {
  const { currentTeacher, courses, setRole, showToast, language } = useApp();
  const isThai = language === 'th';

  return (
    <div className="max-w-3xl mx-auto space-y-6 text-left">
      <div className="pb-4 border-b border-gray-200">
        <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
          {isThai ? 'ข้อมูลอัตลักษณ์ทางวิชาการ (T9)' : 'Academic Identity (T9)'}
        </span>
        <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
          {isThai ? 'โปรไฟล์อาจารย์ผู้คุมสอบ' : 'Instructor Proctor Profile'}
        </h1>
        <p className="text-xs text-gray-500">
          {isThai
            ? 'ข้อมูลประจำตัวสถาบัน เชื่อมต่อระบบ ICIT SSO และสังกัดคณะ/ภาควิชา'
            : 'University credentials, verified ICIT SSO link, and faculty department affiliations.'}
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-md">
            {currentTeacher?.fullName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">{currentTeacher?.fullName}</h2>
              <Badge variant="purple" size="sm">
                <ShieldCheck className="w-3 h-3" />
                <span>{isThai ? 'อาจารย์ผู้สอน' : 'Teacher Role'}</span>
              </Badge>
              <Badge variant="success" size="sm">
                <CheckCircle2 className="w-3 h-3" />
                <span>{isThai ? 'ICIT เชื่อมต่อแล้ว' : 'ICIT Active'}</span>
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">
              {isThai ? 'รหัสบุคลากร: ' : 'Staff ID: '}
              {currentTeacher?.teacherCode} • {currentTeacher?.email}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-gray-500 block mb-1 font-medium">{isThai ? 'คณะ' : 'Faculty'}</span>
            <span className="font-semibold text-gray-900 text-sm">{currentTeacher?.faculty}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-gray-500 block mb-1 font-medium">{isThai ? 'ภาควิชา' : 'Department'}</span>
            <span className="font-semibold text-gray-900 text-sm">{currentTeacher?.department}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-gray-500 block mb-1 font-medium">
              {isThai ? 'ระดับสิทธิ์การคุมสอบ' : 'Proctor Access Level'}
            </span>
            <span className="font-semibold text-gray-900 text-sm">
              {isThai
                ? 'ผู้คุมสอบห้องปฏิบัติการ & เจ้าของคลังไฟล์ข้อสอบ'
                : 'Laboratory Exam Proctor & Repository Owner'}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-gray-500 block mb-1 font-medium">
              {isThai ? 'ผู้ให้บริการยืนยันตัวตน' : 'Authentication Provider'}
            </span>
            <span className="font-semibold text-gray-900 text-sm">
              {isThai
                ? 'ระบบสารสนเทศกลาง ICIT มหาวิทยาลัยเทคโนโลยีพระจอมเกล้า'
                : "King Mongkut's University of Technology ICIT Directory"}
            </span>
          </div>
        </div>

        {/* Assigned Courses */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
            {isThai ? 'รายวิชาที่ได้รับมอบหมายดูแลการสอบ' : 'Assigned Course Examinations'}
          </h3>
          <div className="space-y-2">
            {courses.map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-gray-900">{c.courseCode}: {c.courseName}</span>
                  <span className="text-gray-500 block text-[11px]">{c.academicYear} • {c.semester}</span>
                </div>
                <Badge variant="blue" size="sm">
                  {isThai ? 'อาจารย์ผู้ประสานงานหลัก' : 'Primary Instructor'}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {isThai
              ? 'ข้อมูลโปรไฟล์ซิงค์อัตโนมัติกับฐานข้อมูลกลาง ICIT'
              : 'Profile synchronized automatically with ICIT central database.'}
          </span>
          <button
            onClick={() => {
              showToast(
                isThai ? 'ออกจากระบบแล้ว' : 'Logged Out',
                isThai ? 'เซสชันอาจารย์ถูกสิ้นสุดอย่างปลอดภัย' : 'Instructor session terminated safely.',
                'info'
              );
              setRole(null);
            }}
            className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>{isThai ? 'ออกจากระบบอาจารย์ผู้สอน' : 'Sign Out of Instructor Portal'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
