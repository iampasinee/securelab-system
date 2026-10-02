import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface SecureLabBrandHeaderProps {
  examControls?: React.ReactNode;
}

export const SecureLabBrandHeader: React.FC<SecureLabBrandHeaderProps> = ({ examControls }) => (
  <header className="relative z-10 min-h-16 border-b border-slate-200 bg-white">
    <div className={`mx-auto max-w-7xl px-4 sm:px-6 ${examControls ? 'flex flex-col gap-2 py-2 lg:min-h-16 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-0' : 'flex h-16 items-center'}`}>
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight text-slate-900">SecureLab</p>
          <p className="text-[11px] leading-tight text-slate-500">ระบบจัดการการสอบในห้องปฏิบัติการ</p>
        </div>
      </div>
      {examControls && <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:flex-1 lg:justify-end lg:gap-4">{examControls}</div>}
    </div>
  </header>
);
