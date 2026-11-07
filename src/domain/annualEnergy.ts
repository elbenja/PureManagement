import type { EnergyInterval } from './energy'
import type { GridStatus } from '../simulation/annualOutages'

export interface AnnualEnergyInterval extends EnergyInterval {
  gridStatus: GridStatus
  solarPotentialKwh: number
  curtailedSolarKwh: number
  unservedHomeKwh: number
  backupHoursEstimate: number
  backupPowerLimited: boolean
}

export const isAnnualEnergyInterval = (value: EnergyInterval): value is AnnualEnergyInterval =>
  'gridStatus' in value && (value.gridStatus === 'connected' || value.gridStatus === 'outage')
