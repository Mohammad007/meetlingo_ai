/** RFC 4122 v4 UUID. Uses the platform crypto API when present, otherwise expo-crypto. */
export function uuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ExpoCrypto = require('expo-crypto') as typeof import('expo-crypto');
  return ExpoCrypto.randomUUID();
}
