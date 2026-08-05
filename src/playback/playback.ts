const SLOTS_PER_REAL_MS = 288 / 60_000

export const advancePosition = (
  position: number,
  elapsedMs: number,
  count: number,
): number => {
  if (count <= 0) return 0

  const nextPosition = position + elapsedMs * SLOTS_PER_REAL_MS
  return ((nextPosition % count) + count) % count
}

export const interpolatePower = (
  start: number,
  end: number,
  fraction: number,
): number => {
  const clampedFraction = Math.min(1, Math.max(0, fraction))
  return start + (end - start) * clampedFraction
}
