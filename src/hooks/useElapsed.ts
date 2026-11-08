import { useEffect, useState } from 'react';

import { useSessionStore } from '@/stores/sessionStore';

/** Wall-clock elapsed time of the active meeting (excludes paused time), ticking once per second. */
export function useElapsed(): number {
  const meeting = useSessionStore((s) => s.meeting);
  const pausedTotalMs = useSessionStore((s) => s.pausedTotalMs);
  const pausedAt = useSessionStore((s) => s.pausedAt);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!meeting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [meeting]);
  if (!meeting) return 0;
  const end = pausedAt ?? now;
  return Math.max(0, end - meeting.startedAt - pausedTotalMs);
}
