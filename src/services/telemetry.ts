/**
 * Local-only telemetry. Counters and a small log ring buffer live in memory for the Diagnostics screen and
 * the user-initiated diagnostic export. Nothing is sent anywhere, and transcript text is never recorded here.
 */
const counters = new Map<string, number>();
const log: { at: number; level: 'info' | 'warn' | 'error'; message: string }[] = [];
const MAX_LOG = 200;

export function recordMetric(name: string, delta = 1) {
  counters.set(name, (counters.get(name) ?? 0) + delta);
}

export function logEvent(level: 'info' | 'warn' | 'error', message: string) {
  log.push({ at: Date.now(), level, message: message.slice(0, 300) });
  if (log.length > MAX_LOG) log.splice(0, log.length - MAX_LOG);
}

export function getMetrics(): Record<string, number> {
  return Object.fromEntries(counters);
}

export function getLog() {
  return [...log];
}
