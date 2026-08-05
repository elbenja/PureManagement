const SLOTS_PER_REAL_MS = 288 / 60_000

export const advancePosition = (
  position: number,
  elapsedMs: number,
  count: number,
): number => {
  const normalizedCount = Number.isFinite(count) ? Math.trunc(count) : 0
  if (normalizedCount <= 0 || !Number.isFinite(position)) return 0

  const normalizedPosition =
    ((position % normalizedCount) + normalizedCount) % normalizedCount
  if (!Number.isFinite(elapsedMs)) return normalizedPosition

  const nextPosition =
    normalizedPosition + elapsedMs * SLOTS_PER_REAL_MS
  if (!Number.isFinite(nextPosition)) return normalizedPosition

  return (
    ((nextPosition % normalizedCount) + normalizedCount) % normalizedCount
  )
}

export const interpolatePower = (
  start: number,
  end: number,
  fraction: number,
): number => {
  const clampedFraction = Math.min(1, Math.max(0, fraction))
  return start + (end - start) * clampedFraction
}
