import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EnergyInterval } from '../domain/energy'
import { LOS_ANGELES_2026 } from '../scenario/losAngeles2026'
import { generateMonth } from '../simulation/generateMonth'
import { generateYear } from '../simulation/generateYear'
import { SimulationInspector } from './SimulationInspector'

const augustRecords = generateMonth()
const sample = augustRecords[0]!
const records = new Array<EnergyInterval>(LOS_ANGELES_2026.records)
for (let index = 0; index < 7; index += 1) {
  records[index] = {
    ...sample,
    index,
    year: 2026,
    month: 1,
    day: index + 1,
    iso: `2026-01-${(index + 1).toString().padStart(2, '0')}T00:00:00.000-08:00`,
  }
}
for (let index = records.length - 2_016; index < records.length; index += 1) {
  records[index] = {
    ...sample,
    index,
    year: 2026,
    month: 12,
    day: 31,
    iso: `2026-12-31T23:55:00.000-08:00`,
  }
}
const renderInspector = () => render(
  <SimulationInspector records={records} scenario={LOS_ANGELES_2026} />,
)

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SimulationInspector', () => {
  it('labels annual outage, backup, and bill values as simulated', () => {
    const annual = generateYear()
    render(<SimulationInspector records={annual} scenario={LOS_ANGELES_2026} />)

    expect(screen.getByText('Grid status (simulated)')).toBeVisible()
    expect(screen.getByText('Battery-only backup estimate (modeled)')).toBeVisible()
    expect(screen.getByText('Amount due (modeled)')).toBeVisible()
    expect(screen.getByText(/No solar or EV charging is assumed for the backup estimate/)).toBeVisible()
    expect(screen.getByText(/Taxes, minimum charges, adjustment factors, and real balances are excluded/)).toBeVisible()

    const outageIndex = annual.findIndex((record) => record.gridStatus === 'outage')
    fireEvent.change(screen.getByLabelText('Simulation interval'), {
      target: { value: String(outageIndex) },
    })
    expect(screen.getAllByText('outage')).toHaveLength(2)
    expect(screen.getByText('Unserved home demand')).toBeVisible()
  }, 30_000)

  it('keeps annual-only context out of the August inspector', () => {
    render(<SimulationInspector records={augustRecords} />)
    expect(screen.queryByText('Grid status (simulated)')).not.toBeInTheDocument()
    expect(screen.queryByText('Amount due (modeled)')).not.toBeInTheDocument()
  })

  it('inspects the public data contract and historical windows', () => {
    renderInspector()

    expect(screen.getByText('woodland-hills-2026-v1')).toBeVisible()
    expect(screen.getByText('Woodland Hills, Los Angeles')).toBeVisible()
    expect(screen.getByText('105,120 records')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Last 24h' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Last week' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Last month' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Last 30 days' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Calendar month' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Year to date' })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Playback controls' })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Time range' })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Period navigation' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Last week' }))

    expect(screen.getByText('2,016 intervals')).toBeVisible()
    expect(screen.getByText('Export credit earned')).toBeVisible()
    expect(screen.queryByText(/money made/i)).not.toBeInTheDocument()
  })

  it('exposes playback, scrubbing, and bounded period navigation', () => {
    renderInspector()

    expect(screen.getByText('Paused')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Previous day' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next period' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Previous period' }))
    expect(screen.getByRole('button', { name: 'Next period' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Next period' }))
    expect(screen.getByRole('button', { name: 'Next period' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(screen.getByLabelText('Simulation interval')).toHaveValue('104831')

    fireEvent.change(screen.getByLabelText('Simulation interval'), {
      target: { value: '0' },
    })
    expect(screen.getByLabelText('Simulation interval')).toHaveValue('0')
    expect(screen.getByRole('button', { name: 'Previous day' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next day' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(screen.getByLabelText('Simulation interval')).toHaveValue('0')

    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(screen.getByText('Playing')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(screen.getByText('Paused')).toBeVisible()
  })

  it('shows five component-ready nodes, transfers, aggregates, and JSON', () => {
    renderInspector()

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

    render(
      <SimulationInspector
        records={recordsWithoutTransfers}
        scenario={LOS_ANGELES_2026}
      />,
    )

    expect(screen.getByText('No active transfers')).toBeVisible()
  })

  it('preserves user navigation for an equivalent dataset copy', () => {
    const { rerender } = renderInspector()
    fireEvent.change(screen.getByLabelText('Simulation interval'), {
      target: { value: '0' },
    })

    rerender(
      <SimulationInspector records={records.slice()} scenario={LOS_ANGELES_2026} />,
    )

    expect(screen.getByLabelText('Simulation interval')).toHaveValue('0')
  })

  it('reinitializes at the final record for a same-length replacement dataset', () => {
    const { rerender } = render(<SimulationInspector records={augustRecords} />)
    fireEvent.change(screen.getByLabelText('Simulation interval'), {
      target: { value: '0' },
    })
    const replacement = augustRecords.map((record, index) => {
      if (index !== 0 && index !== augustRecords.length - 1) return record
      return { ...record, iso: record.iso.replace('2026-08', '2026-09') }
    })

    rerender(<SimulationInspector records={replacement} />)

    expect(screen.getByLabelText('Simulation interval')).toHaveValue('8927')
    expect(screen.getByText('Paused')).toBeVisible()
  })

  it('shows live weather, precipitation, and an accessible simulated outlook', () => {
    renderInspector()
    fireEvent.change(screen.getByLabelText('Simulation interval'), {
      target: { value: '0' },
    })

    expect(screen.getByText('Weather')).toBeVisible()
    expect(screen.getByText('Precipitation')).toBeVisible()
    const outlook = screen.getByRole('table', { name: 'Simulated 7-day outlook' })
    for (const name of ['Date', 'Weather', 'Low', 'High', 'Rain', 'Solar']) {
      expect(within(outlook).getByRole('columnheader', { name })).toBeVisible()
    }
    expect(within(outlook).getAllByRole('row')).toHaveLength(8)
  })
})
