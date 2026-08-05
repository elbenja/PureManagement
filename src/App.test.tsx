import { StrictMode } from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const actualGenerateMonth = await vi.importActual<
  typeof import('./simulation/generateMonth')
>('./simulation/generateMonth').then((module) => module.generateMonth)

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.doUnmock('./simulation/generateMonth')
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('generates the dataset once under the application Strict Mode', async () => {
    const generateMonth = vi.fn(actualGenerateMonth)
    vi.doMock('./simulation/generateMonth', () => ({ generateMonth }))
    const { default: App } = await import('./App')

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    expect(generateMonth).toHaveBeenCalledTimes(1)
    expect(screen.getByText('8,928 records')).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Energy simulation inspector' }),
    ).toBeVisible()
  })

  it('shows the generation failure boundary', async () => {
    const generateMonth = vi.fn(() => {
      throw new Error('invalid simulation')
    })
    vi.doMock('./simulation/generateMonth', () => ({ generateMonth }))
    const { default: App } = await import('./App')

    render(
      <StrictMode>
        <App />
      </StrictMode>,
    )

    expect(generateMonth).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('alert'),
    ).toHaveTextContent('Simulation data unavailable.')
    expect(
      screen.getByRole('heading', { name: 'Simulation data unavailable.' }),
    ).toBeVisible()
  })
})
