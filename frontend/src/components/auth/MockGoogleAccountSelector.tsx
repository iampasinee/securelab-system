import React from 'react';
import { Chrome, FlaskConical } from 'lucide-react';
import { mockGoogleAccountOptions } from '../../services/authState';

interface MockGoogleAccountSelectorProps {
  value: string;
  onChange: (email: string) => void;
  onContinue: () => void;
  actionLabel: string;
  hideContinue?: boolean;
}

export const MockGoogleAccountSelector: React.FC<MockGoogleAccountSelectorProps> = ({
  value,
  onChange,
  onContinue,
  actionLabel,
  hideContinue = false,
}) => (
  <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <div className="flex items-start gap-3">
      <div className="rounded-xl bg-white p-2 text-blue-600 shadow-xs"><Chrome className="h-5 w-5" /></div>
      <div>
        <p className="text-sm font-bold text-slate-900">เลือกบัญชี Google สำหรับการจำลอง</p>
        <p className="mt-0.5 text-xs text-slate-500">ยังไม่มีการเชื่อมต่อ Google OAuth หรือ backend จริง</p>
      </div>
    </div>
    <label className="block text-xs font-semibold text-slate-700" htmlFor="mock-google-account">บัญชีทดสอบ</label>
    <select id="mock-google-account" value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
      <option value="">เลือกบัญชี</option>
      {mockGoogleAccountOptions.map((option) => <option key={option.email} value={option.email}>{option.email} — {option.label}</option>)}
    </select>
    {!hideContinue && <button type="button" onClick={onContinue} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
      <FlaskConical className="h-4 w-4" />{actionLabel}
    </button>}
  </div>
);
