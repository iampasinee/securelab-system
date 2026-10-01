import { useSyncExternalStore } from 'react';
import { Clock3, FlaskConical } from 'lucide-react';
import type { ExamSession } from '../../types';
import {
  DemoTimePreset,
  getDemoTimeState,
  isDemoTimeFeatureEnabled,
  setDemoTimePreset,
  subscribeDemoTime,
} from '../../services/demoTime';

const presets: { id: DemoTimePreset; label: string }[] = [
  { id: 'real', label: 'เวลาจริง' },
  { id: 'before', label: 'ก่อนเริ่ม' },
  { id: 'during', label: 'กำลังสอบ' },
  { id: 'after', label: 'หลังสอบ' },
];

const formatSimulatedTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

export const DemoTimeIndicator = ({ compact = false, className = '' }: { compact?: boolean; className?: string }) => {
  const state = useSyncExternalStore(subscribeDemoTime, getDemoTimeState, getDemoTimeState);
  if (!isDemoTimeFeatureEnabled() || !state.enabled || state.simulatedNow === null) return null;

  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900 ${className}`} title={`เวลาเดโมสำหรับทดสอบหน้าเว็บเท่านั้น: ${formatSimulatedTime(state.simulatedNow)}`}>
      <Clock3 className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{compact ? 'เวลาเดโม' : `จำลองเวลา: ${formatSimulatedTime(state.simulatedNow)}`}</span>
    </span>
  );
};

export const DemoTimeControl = ({ exam }: { exam?: ExamSession }) => {
  const state = useSyncExternalStore(subscribeDemoTime, getDemoTimeState, getDemoTimeState);
  if (!isDemoTimeFeatureEnabled()) return null;

  return (
    <section aria-label="โหมดจำลองเวลา" className="shrink-0 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 sm:p-3">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-amber-900">
          <FlaskConical className="h-4 w-4 shrink-0" />
          โหมดจำลองเวลา <span className="font-normal">(ทดสอบหน้าเว็บเท่านั้น)</span>
        </div>
        <DemoTimeIndicator />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap">
        {presets.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            disabled={id !== 'real' && !exam}
            aria-pressed={state.preset === id && (id === 'real' || state.examId === exam?.id)}
            onClick={() => setDemoTimePreset(id, exam)}
            className={`min-h-9 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40 ${state.preset === id && (id === 'real' || state.examId === exam?.id) ? 'border-blue-600 bg-blue-600 text-white' : 'border-amber-200 bg-white text-amber-900 hover:border-blue-400'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
};
