import type { ExamSession } from '../types';

// Flip this to false when embedding the frontend in a non-demo shell.
export const DEMO_TIME_ENABLED = true;

export type DemoTimePreset = 'real' | 'before' | 'during' | 'after';

export interface DemoTimeState {
  enabled: boolean;
  simulatedNow: number | null;
  preset: DemoTimePreset;
  examId: string | null;
  resumedAt: number;
}

const realTimeState: DemoTimeState = {
  enabled: false,
  simulatedNow: null,
  preset: 'real',
  examId: null,
  resumedAt: Date.now(),
};

// Module memory is shared by every role, but deliberately resets on refresh.
let state: DemoTimeState = realTimeState;
const listeners = new Set<() => void>();

export const getDemoTimeState = (): DemoTimeState => state;

export const subscribeDemoTime = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const publish = (next: DemoTimeState) => {
  state = next;
  listeners.forEach((listener) => listener());
};

export const getEffectiveNow = (realNow = new Date()): Date =>
  DEMO_TIME_ENABLED && state.enabled && state.simulatedNow !== null && Number.isFinite(state.simulatedNow)
    ? new Date(state.simulatedNow)
    : realNow;

export const setDemoTimePreset = (
  preset: DemoTimePreset,
  exam?: Pick<ExamSession, 'id' | 'examDate' | 'startTime' | 'endTime'>,
): boolean => {
  if (preset === 'real') {
    publish({ ...realTimeState, resumedAt: Date.now() });
    return true;
  }

  if (!DEMO_TIME_ENABLED) return false;
  if (!['before', 'during', 'after'].includes(preset)) return false;
  if (!exam) return false;
  const start = new Date(`${exam.examDate}T${exam.startTime}`).getTime();
  const end = new Date(`${exam.examDate}T${exam.endTime}`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;

  const simulatedNow = preset === 'before' ? start - 5 * 60_000
    : preset === 'during' ? start + Math.floor((end - start) / 2)
    : end + 5 * 60_000;
  publish({ enabled: true, simulatedNow, preset, examId: exam.id, resumedAt: state.resumedAt });
  return true;
};

export const isDemoTimeFeatureEnabled = (): boolean => DEMO_TIME_ENABLED;
