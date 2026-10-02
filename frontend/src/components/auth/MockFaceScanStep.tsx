import { useEffect, useState } from 'react';
import { Check, CircleUserRound, RotateCcw, ScanFace } from 'lucide-react';
import type { FaceEnrollmentStatus } from '../../types/auth';

interface MockFaceScanStepProps {
  status: FaceEnrollmentStatus;
  error?: string;
  onStatusChange: (status: FaceEnrollmentStatus) => void;
  onBack: () => void;
  onContinue: () => void;
}

const scanTasks = [
  { title: 'หน้าตรง', detail: 'มองตรงไปที่กล้อง' },
  { title: 'หลับตา-ลืมตา', detail: 'หลับตาแล้วลืมตา' },
  { title: 'หันซ้าย', detail: 'หันหน้าไปทางซ้ายช้าๆ' },
  { title: 'หันขวา', detail: 'หันหน้าไปทางขวาช้าๆ' },
  { title: 'เงยหน้า-ก้มหน้า', detail: 'ขยับศีรษะขึ้นและลง' },
  { title: 'ใบหน้าเข้าใกล้', detail: 'ขยับใบหน้าเข้าใกล้กล้อง' },
];

export const advanceMockFaceScan = (index: number): { index: number; complete: boolean } => {
  const nextIndex = Math.min(scanTasks.length, index + 1);
  return { index: nextIndex, complete: nextIndex === scanTasks.length };
};

const secondaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600';
const primaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40';

export const MockFaceScanStep = ({ status, error, onStatusChange, onBack, onContinue }: MockFaceScanStepProps) => {
  const [scanIndex, setScanIndex] = useState(0);
  const scanning = status === 'scanning';
  const verified = status === 'verified_mock';

  useEffect(() => {
    if (!scanning) return;
    const timer = window.setTimeout(() => {
      const next = advanceMockFaceScan(scanIndex);
      setScanIndex(next.index);
      if (next.complete) onStatusChange('verified_mock');
    }, 850);
    return () => window.clearTimeout(timer);
  }, [scanning, scanIndex, onStatusChange]);

  const reset = () => {
    setScanIndex(0);
    onStatusChange('not_started');
  };

  const start = () => {
    setScanIndex(0);
    onStatusChange('scanning');
  };

  const completedTasks = verified ? scanTasks.length : scanning ? scanIndex : 0;

  return <div className="min-w-0 space-y-4">
    <div>
      <h2 className="text-lg font-bold text-slate-900">ลงทะเบียนใบหน้า</h2>
      <p className="mt-1 text-xs text-slate-500">ขั้นตอนบังคับแบบจำลอง ไม่เปิดกล้อง ไม่ถ่ายภาพ และไม่ตรวจชีวมิติจริง</p>
    </div>

    <section aria-label="ภารกิจการสแกนใบหน้า" className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-sm font-bold text-slate-900">ภารกิจการสแกน</h3><p className="mt-0.5 text-xs text-slate-500">ระบบจำลองการตรวจท่าทางทีละขั้นโดยอัตโนมัติ</p></div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-blue-700">{completedTasks}/{scanTasks.length} ขั้นตอน</span>
      </div>
      <div className="grid min-w-0 gap-3 lg:grid-cols-[160px_minmax(0,1fr)]">
        <div className={`flex min-h-36 flex-col items-center justify-center rounded-xl border text-center ${verified ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : scanning ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}>
          <CircleUserRound className={`h-14 w-14 ${scanning ? 'animate-pulse' : ''}`} strokeWidth={1.5} />
          <span className="mt-2 px-2 text-xs font-semibold">{verified ? 'สแกนจำลองครบแล้ว' : scanning ? 'กำลังสแกนจำลอง' : 'พร้อมเริ่มสแกน'}</span>
        </div>
        <ol className="grid min-w-0 gap-2 sm:grid-cols-2">
          {scanTasks.map((task, index) => {
            const passed = index < completedTasks;
            const active = scanning && index === scanIndex;
            return <li key={task.title} className={`flex min-w-0 items-start gap-2 rounded-xl border p-2.5 ${passed ? 'border-emerald-200 bg-emerald-50' : active ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white'}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${passed ? 'bg-emerald-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{passed ? <Check className="h-4 w-4" /> : index + 1}</span>
              <span className="min-w-0 flex-1"><strong className="block text-xs text-slate-900">{task.title}</strong><span className="block text-[11px] text-slate-600">{task.detail}</span></span>
              <span className={`shrink-0 text-[10px] font-semibold ${passed ? 'text-emerald-700' : active ? 'text-blue-700' : 'text-slate-400'}`}>{passed ? 'ผ่านแล้ว' : active ? 'กำลังตรวจสอบ' : 'ยังไม่เริ่ม'}</span>
            </li>;
          })}
        </ol>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {!scanning && !verified && <button type="button" onClick={start} className={primaryButton}><ScanFace className="h-4 w-4" />เริ่มสแกน</button>}
        {(scanning || verified) && <button type="button" onClick={reset} className={secondaryButton}><RotateCcw className="h-4 w-4" />{verified ? 'เริ่มใหม่' : 'ยกเลิกการสแกน'}</button>}
      </div>
    </section>

    <div aria-live="polite">{verified && <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700"><Check className="h-5 w-5 shrink-0" />ลงทะเบียนใบหน้าแบบจำลองสำเร็จ</p>}</div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={() => { if (!verified) reset(); onBack(); }} className={secondaryButton}>ย้อนกลับ</button><button type="button" onClick={onContinue} disabled={!verified} className={primaryButton}>ดำเนินการต่อ</button></div>
  </div>;
};
