import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Lock, Check, AlertCircle, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export const PasswordSetup: React.FC = () => {
  const { setActiveStudentStep, showToast, currentStudent, language } = useApp();
  const isThai = language === 'th';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Password validation rules
  const hasMinLength = newPassword.length >= 8;
  const hasNumber = /\d/.test(newPassword);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const isFormValid = hasMinLength && hasNumber && hasSpecial && passwordsMatch;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      setError(isThai ? 'กรุณากรอกรหัสผ่านให้ถูกต้องตามเกณฑ์ความปลอดภัยทั้งหมด' : 'Please fulfill all password security criteria.');
      return;
    }

    showToast(
      isThai ? 'ตั้งรหัสผ่านสำเร็จ' : 'Password Established',
      isThai ? 'สร้างรหัสผ่านประจำเครื่องสอบในห้องปฏิบัติการแล้ว' : 'Laboratory examination credentials created.',
      'success'
    );
    setActiveStudentStep('ST2B'); // Continue to Face Enrollment
  };

  return (
    <div className="relative mx-auto mt-3 mb-6 w-[calc(100%-2rem)] max-w-md scroll-mt-[92px] rounded-2xl border border-gray-100 bg-white p-6 text-left shadow-xl sm:mt-4">
      <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-5">
        <Lock className="w-6 h-6" />
      </div>

      <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
        {isThai ? 'การตั้งค่าสำหรับผู้เข้าสอบครั้งแรก (ขั้นตอนที่ 1 จาก 2)' : 'First-Time Setup (Step 1 of 2)'}
      </span>
      <h2 className="text-2xl font-bold text-gray-900 mt-1 mb-2">
        {isThai ? 'ตั้งรหัสผ่านสำหรับเข้าสอบ' : 'Create Exam Password'}
      </h2>
      <p className="text-sm text-gray-500 mb-6 leading-relaxed">
        {isThai ? (
          <>
            ยินดีต้อนรับ <strong className="text-gray-800">{currentStudent?.fullName}</strong> กำหนดรหัสผ่านความปลอดภัยประจำเครื่องคอมพิวเตอร์เพื่อใช้ยืนยันตัวตนในเครือข่ายห้องปฏิบัติการ
          </>
        ) : (
          <>
            Welcome <strong className="text-gray-800">{currentStudent?.fullName}</strong>. Establish your secure examination workstation password to authenticate within the laboratory network.
          </>
        )}
      </p>

      {error && (
        <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            {isThai ? 'รหัสผ่านใหม่สำหรับเครื่องสอบ' : 'New Workstation Password'}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setError('');
              }}
              placeholder={isThai ? 'อย่างน้อย 8 ตัวอักษร' : 'At least 8 characters'}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">
            {isThai ? 'ยืนยันรหัสผ่านอีกครั้ง' : 'Confirm Password'}
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError('');
            }}
            placeholder={isThai ? 'กรอกรหัสผ่านเดิมอีกครั้ง' : 'Re-enter password'}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Security Checklist */}
        <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 space-y-2 text-xs text-gray-600">
          <span className="font-semibold text-gray-700 block text-[11px] uppercase tracking-wider">
            {isThai ? 'ข้อกำหนดความปลอดภัยของรหัสผ่าน:' : 'Password Requirements:'}
          </span>
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${hasMinLength ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              <Check className="w-2.5 h-2.5" />
            </div>
            <span>{isThai ? 'ความยาวอย่างน้อย 8 ตัวอักษร' : 'At least 8 characters'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${hasNumber ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              <Check className="w-2.5 h-2.5" />
            </div>
            <span>{isThai ? 'มีตัวเลขอักขระอย่างน้อย 1 ตัว (0-9)' : 'At least one number (0-9)'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${hasSpecial ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              <Check className="w-2.5 h-2.5" />
            </div>
            <span>{isThai ? 'มีอักขระพิเศษอย่างน้อย 1 ตัว (!@#$%...)' : 'At least one special character (!@#$%...)'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${passwordsMatch ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              <Check className="w-2.5 h-2.5" />
            </div>
            <span>{isThai ? 'รหัสผ่านทั้งสองช่องตรงกัน' : 'Passwords match'}</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={!isFormValid}
          className="w-full mt-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <span>{isThai ? 'บันทึกรหัสผ่านและดำเนินการถ่ายภาพใบหน้า' : 'Create Password & Proceed to Face Enrollment'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
