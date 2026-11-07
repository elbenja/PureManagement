import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'

export interface BackupEstimate { hours: number; powerLimited: boolean }

export const estimateBackup = (
  socEndKwh: number,
  trailingHomeKwh: number,
  slotCount: number,
): BackupEstimate => {
  const averageKw = trailingHomeKwh / (slotCount * LOS_ANGELES_2026.intervalMinutes / 60)
  if (averageKw > LOS_ANGELES_2026.battery.maxPowerKw) {
    return { hours: 0, powerLimited: true }
  }
  return {
    hours: averageKw === 0
      ? 0
      : socEndKwh * Math.sqrt(LOS_ANGELES_2026.battery.roundTripEfficiency) / averageKw,
    powerLimited: false,
  }
}
