import { useEffect, useState, useSyncExternalStore } from 'react';
import { getDemoTimeState, getEffectiveNow, subscribeDemoTime } from '../services/demoTime';

export const useExamClock = (): Date => {
  const [realNow, setRealNow] = useState(() => new Date());
  const demoTime = useSyncExternalStore(subscribeDemoTime, getDemoTimeState, getDemoTimeState);

  useEffect(() => {
    if (demoTime.enabled) return;
    const refresh = () => setRealNow(new Date());
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [demoTime.enabled]);

  const visibleRealNow = demoTime.resumedAt > realNow.getTime()
    ? new Date(demoTime.resumedAt)
    : realNow;
  return getEffectiveNow(visibleRealNow);
};
