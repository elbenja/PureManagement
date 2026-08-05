import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { generateMonth } from './simulation/generateMonth'

vi.mock('./simulation/generateMonth', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./simulation/generateMonth')
  >()
  return {
    ...original,
    generateMonth: vi.fn(original.generateMonth),
  }
})

const actualGenerateMonth = await vi.importActual<
  typeof import('./simulation/generateMonth')
>('./simulation/generateMonth').then((module) => module.generateMonth)

beforeEach(() => {
  vi.mocked(generateMonth).mockReset()
  vi.mocked(generateMonth).mockImplementation(actualGenerateMonth)
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('generates the dataset once and renders the simulation inspector', () => {
    render(<App />)

    expect(generateMonth).toHaveBeenCalledTimes(1)
    expect(screen.getByText('8,928 records')).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Energy simulation inspector' }),
    ).toBeVisible()
  })

  it('shows the generation failure boundary', () => {
    vi.mocked(generateMonth).mockImplementation(() => {
      throw new Error('invalid simulation')
    })

    render(<App />)

    expect(
      screen.getByRole('alert'),
    ).toHaveTextContent('Simulation data unavailable.')
    expect(
      screen.getByRole('heading', { name: 'Simulation data unavailable.' }),
    ).toBeVisible()
  })
})
