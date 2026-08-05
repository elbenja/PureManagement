import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateMonth } from '../simulation/generateMonth'
import { SimulationInspector } from './SimulationInspector'

const records = generateMonth()

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SimulationInspector', () => {
  it('inspects the public data contract and historical windows', () => {
    render(<SimulationInspector records={records} />)

    expect(screen.getByText('woodland-hills-aug-2026-v1')).toBeVisible()
    expect(screen.getByText('8,928 records')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Last 24h' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Last week' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Last month' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Last week' }))

    expect(screen.getByText('2,016 intervals')).toBeVisible()
    expect(screen.getByText('Export credit earned')).toBeVisible()
    expect(screen.queryByText(/money made/i)).not.toBeInTheDocument()
  })

  it('exposes playback, scrubbing, and bounded period navigation', () => {
    render(<SimulationInspector records={records} />)

    expect(screen.getByText('Paused')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Next period' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }))
    expect(screen.getByRole('button', { name: 'Next period' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Next period' }))
    expect(screen.getByRole('button', { name: 'Next period' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(screen.getByLabelText('Simulation interval')).toHaveValue('8639')

    fireEvent.change(screen.getByLabelText('Simulation interval'), {
      target: { value: '0' },
    })
    expect(screen.getByLabelText('Simulation interval')).toHaveValue('0')

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(screen.getByText('Playing')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(screen.getByText('Paused')).toBeVisible()
  })

  it('shows five component-ready nodes, transfers, aggregates, and JSON', () => {
    render(<SimulationInspector records={records} />)

    const nodes = screen.getByRole('table', { name: 'Energy nodes' })
    expect(within(nodes).getAllByTestId('energy-node')).toHaveLength(5)
    for (const name of ['Solar', 'Home', 'EV', 'Battery', 'Grid']) {
      expect(within(nodes).getByText(name)).toBeVisible()
    }
    expect(within(nodes).getByRole('columnheader', { name: 'Direction' })).toBeVisible()
    expect(within(nodes).getByRole('columnheader', { name: 'State of charge' })).toBeVisible()

    const transfers = screen.getByRole('table', { name: 'Active transfers' })
    for (const name of ['Source', 'Destination', 'kW', 'kWh']) {
      expect(within(transfers).getByRole('columnheader', { name })).toBeVisible()
    }

    expect(screen.getByText('Energy consumed')).toBeVisible()
    expect(screen.getByText('Savings')).toBeVisible()
    expect(screen.getByText('Avoided CO2')).toBeVisible()

    fireEvent.click(screen.getByText('Data contract JSON'))
    const preview = screen.getByTestId('data-contract-json')
    expect(preview).toHaveTextContent('"live"')
    expect(preview).toHaveTextContent('"history"')
    expect(preview).toHaveTextContent('"range"')
  })

  it('shows a clear empty state when an interval has no active transfers', () => {
    const lastIndex = records.length - 1
    const recordsWithoutTransfers = [
      ...records.slice(0, lastIndex),
      { ...records[lastIndex]!, transfers: [] },
    ]

    render(<SimulationInspector records={recordsWithoutTransfers} />)

    expect(screen.getByText('No active transfers')).toBeVisible()
  })
})
