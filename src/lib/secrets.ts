import { timingSafeEqual } from "node:crypto";

/** Constant-time compare for cron / webhook secrets. */
export function secretsEqual(
  provided: string | undefined,
  expected: string,
): boolean {
  if (!provided || !expected) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    timingSafeEqual(right, right);
    return false;
  }
  return timingSafeEqual(left, right);
}
