import { describe, expect, it } from 'vitest'
import type { EnergyInterval } from '../domain/energy'
import { validateYear } from './validateYear'

describe('validateYear malformed input safety', () => {
  it('rejects a non-array without throwing', () => {
    expect(validateYear(null as unknown as EnergyInterval[])).toEqual(['records must be an array'])
  })

  it('caps failures and never throws for a grossly malformed annual array', () => {
    const malformed = Array.from({ length: 105_120 }) as unknown as EnergyInterval[]
    let errors: string[] = []
    expect(() => { errors = validateYear(malformed) }).not.toThrow()
    expect(errors).toHaveLength(100)
  })
})
