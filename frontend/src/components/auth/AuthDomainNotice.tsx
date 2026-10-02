import React from 'react';
import { GraduationCap, ShieldCheck } from 'lucide-react';

export const AuthDomainNotice: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <section aria-label="เงื่อนไขบัญชีมหาวิทยาลัย" className={`rounded-2xl border border-blue-100 bg-blue-50/60 ${compact ? 'p-3' : 'p-4'}`}>
    <h2 className="text-xs font-bold text-blue-900">เงื่อนไขการเข้าใช้งาน</h2>
    <div className={`mt-3 grid gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2'}`}>
      <div className="flex min-w-0 items-center gap-3 rounded-xl bg-white p-3">
        <GraduationCap className="h-5 w-5 shrink-0 text-blue-600" />
        <div className="min-w-0"><p className="text-xs font-semibold text-slate-700">นักศึกษา</p><p className="break-all font-mono text-xs font-bold text-blue-700">@email.kmutnb.ac.th</p><p className="mt-0.5 text-[10px] text-slate-500">ชื่อบัญชีต้องขึ้นต้นด้วย s ตามด้วยรหัสนักศึกษา</p></div>
      </div>
      <div className="flex min-w-0 items-center gap-3 rounded-xl bg-white p-3">
        <ShieldCheck className="h-5 w-5 shrink-0 text-indigo-600" />
        <div className="min-w-0"><p className="text-xs font-semibold text-slate-700">อาจารย์ / ผู้ดูแลระบบ</p><p className="break-all font-mono text-xs font-bold text-indigo-700">@itm.kmutnb.ac.th</p></div>
      </div>
    </div>
    <p className="mt-3 text-[11px] leading-relaxed text-slate-500">โดเมนบุคลากรไม่ได้ให้สิทธิ์ผู้ดูแลระบบโดยอัตโนมัติ ระบบจะตรวจประเภทบัญชีจากข้อมูลที่กำหนดไว้</p>
  </section>
);
