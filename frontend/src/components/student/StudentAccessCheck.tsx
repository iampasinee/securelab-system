import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Loader2, ShieldCheck, UserCheck } from 'lucide-react';

export const StudentAccessCheck: React.FC = () => {
  const { currentStudent, setActiveStudentStep, language } = useApp();
  const isThai = language === 'th';

  useEffect(() => {
    const timer = setTimeout(() => {
      // If student is first time or has no face reference -> ST2A, else ST2C
      if (currentStudent?.isFirstTime || !currentStudent?.faceReferenceUrl) {
        setActiveStudentStep('ST2A');
      } else {
        setActiveStudentStep('ST2C');
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [currentStudent, setActiveStudentStep]);

  return (
    <div className="relative flex flex-col items-center justify-start overflow-visible px-4 pt-3 pb-6 text-center sm:px-6 sm:pt-4">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-6 shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-2">
        {isThai ? 'กำลังตรวจสอบบัญชีนักศึกษา ICIT...' : 'Verifying ICIT Student Account...'}
      </h2>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {isThai ? (
          <>
            ระบบกำลังตรวจสอบสถานะการลงทะเบียน สิทธิ์การเข้าสอบ และผังที่นั่งของ{' '}
            <strong className="text-gray-900">{currentStudent?.fullName}</strong>
          </>
        ) : (
          <>
            Checking initial enrollment status, biometric reference data, and seat assignment for{' '}
            <strong className="text-gray-900">{currentStudent?.fullName}</strong>.
          </>
        )}
      </p>

      <div className="inline-flex items-center gap-2 text-xs font-mono text-gray-700 bg-white px-3.5 py-1.5 rounded-full border border-gray-200 shadow-xs">
        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
        <span>
          {isThai ? 'รหัสนักศึกษา: ' : 'Student ID: '}
          {currentStudent?.studentCode || '6410123456'}
        </span>
      </div>
    </div>
  );
};
