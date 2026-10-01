import React, { useState } from 'react';
import { Check, Circle, Eye, EyeOff } from 'lucide-react';
import { validateRegistrationPassword } from '../../services/authState';

interface RegistrationPasswordStepProps {
  email: string;
  password: string;
  confirmation: string;
  onPasswordChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-12 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const secondaryButton = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600';
const primaryButton = 'inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40';

export const RegistrationPasswordStep: React.FC<RegistrationPasswordStepProps> = ({
  email, password, confirmation, onPasswordChange, onConfirmationChange, onBack, onContinue,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const requirements = validateRegistrationPassword(password, confirmation);
  const rules = [
    { label: 'อย่างน้อย 8 ตัวอักษร', met: requirements.minLength },
    { label: 'มีตัวอักษรภาษาอังกฤษอย่างน้อย 1 ตัว', met: requirements.hasLetter },
    { label: 'มีตัวเลขอย่างน้อย 1 ตัว', met: requirements.hasNumber },
    { label: 'ไม่มีช่องว่างต้นหรือท้ายรหัสผ่าน', met: requirements.noOuterWhitespace },
    { label: 'รหัสผ่านทั้งสองช่องตรงกัน', met: requirements.matches },
  ];

  return <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); if (requirements.valid) onContinue(); }}>
    <div><h2 className="text-lg font-bold text-slate-900">ตั้งรหัสผ่านสำหรับ SecureLab</h2><p className="mt-1 text-xs text-slate-500">ใช้สำหรับเข้าสู่ระบบจำลองหลังลงทะเบียน โดยยังไม่มีการยืนยันตัวตนกับเซิร์ฟเวอร์</p></div>
    <label className="block text-xs font-semibold text-slate-700" htmlFor="registration-account-email">บัญชีมหาวิทยาลัย<input id="registration-account-email" value={email} readOnly className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-600" /></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="registration-password" className="text-xs font-semibold text-slate-700">รหัสผ่าน</label>
        <div className="relative mt-1"><input id="registration-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => onPasswordChange(event.target.value)} autoComplete="new-password" className={inputClass} aria-describedby="registration-password-rules" /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} className="absolute inset-y-0 right-1 flex min-w-10 items-center justify-center rounded-lg text-slate-500 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
      </div>
      <div>
        <label htmlFor="registration-confirm-password" className="text-xs font-semibold text-slate-700">ยืนยันรหัสผ่าน</label>
        <div className="relative mt-1"><input id="registration-confirm-password" type={showConfirmation ? 'text' : 'password'} value={confirmation} onChange={(event) => onConfirmationChange(event.target.value)} autoComplete="new-password" className={inputClass} aria-describedby="registration-password-rules" /><button type="button" onClick={() => setShowConfirmation((value) => !value)} aria-label={showConfirmation ? 'ซ่อนรหัสผ่านยืนยัน' : 'แสดงรหัสผ่านยืนยัน'} className="absolute inset-y-0 right-1 flex min-w-10 items-center justify-center rounded-lg text-slate-500 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600">{showConfirmation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
      </div>
    </div>
    <div id="registration-password-rules" className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold text-slate-700">เงื่อนไขรหัสผ่าน</p><ul className="mt-3 grid gap-2 text-xs sm:grid-cols-2">{rules.map((rule) => <li key={rule.label} className={`flex items-start gap-2 ${rule.met ? 'text-emerald-700' : 'text-slate-600'}`}>{rule.met ? <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" /> : <Circle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />}<span>{rule.met ? 'ผ่าน: ' : 'ยังไม่ผ่าน: '}{rule.label}</span></li>)}</ul></div>
    <div className="flex flex-wrap justify-between gap-2 border-t pt-4"><button type="button" onClick={onBack} className={secondaryButton}>ย้อนกลับ</button><button type="submit" disabled={!requirements.valid} className={primaryButton}>ดำเนินการต่อ</button></div>
  </form>;
};
