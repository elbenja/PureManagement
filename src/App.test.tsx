import { StrictMode } from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.doUnmock('./simulation/generateYear')
  vi.doUnmock('./inspector/SimulationInspector')
  vi.unstubAllGlobals()
})

const mockInspector = () => {
  vi.doMock('./inspector/SimulationInspector', () => ({
    SimulationInspector: ({
      records,
      scenario,
    }: {
      records: { length: number }
      scenario: { id: string }
    }) => (
      <main>
        <h1>Energy simulation inspector</h1>
        <p>{scenario.id}</p>
        <p>{records.length.toLocaleString('en-US')} records</p>
      </main>
    ),
  }))
}

describe('App', () => {
  it('generates the dataset once under the application Strict Mode', async () => {
    const generateYear = vi.fn(() => ({ length: 105_120 }))
    vi.doMock('./simulation/generateYear', () => ({ generateYear }))
    mockInspector()
    const { default: App } = await import('./App')

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    expect(generateYear).toHaveBeenCalledTimes(1)
    expect(screen.getByText('105,120 records')).toBeVisible()
    expect(screen.getByText('woodland-hills-2026-v1')).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Energy simulation inspector' }),
    ).toBeVisible()
  })

  it('shows the generation failure boundary', async () => {
    const generateYear = vi.fn(() => {
      throw new Error('invalid simulation')
    })
    vi.doMock('./simulation/generateYear', () => ({ generateYear }))
    const { default: App } = await import('./App')

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    expect(generateYear).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('alert'),
    ).toHaveTextContent('Simulation data unavailable.')
    expect(
      screen.getByRole('heading', { name: 'Simulation data unavailable.' }),
    ).toBeVisible()
  })
})
