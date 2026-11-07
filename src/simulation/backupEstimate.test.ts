import { describe, expect, it } from 'vitest'
import { estimateBackup } from './backupEstimate'

describe('battery-only backup estimate', () => {
  it('uses remaining energy and trailing whole-home demand', () => {
    expect(estimateBackup(9, 2, 12)).toEqual({
      hours: 9 * Math.sqrt(0.9) / 2,
      powerLimited: false,
    })
  })

  it('returns zero hours for empty storage', () => {
    expect(estimateBackup(0, 2, 12)).toEqual({ hours: 0, powerLimited: false })
  })

  it('identifies demand above battery output power', () => {
    expect(estimateBackup(9, 6, 12)).toEqual({ hours: 0, powerLimited: true })
  })
})
