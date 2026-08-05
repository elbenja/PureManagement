import { useEffect } from 'react'
import type { EnergyInterval } from '../domain/energy'
import { LOS_ANGELES_AUGUST_2026 } from '../scenario/losAngelesAugust2026'
import { useEnergySimulation } from '../consumer/useEnergySimulation'
import type { TimeRange } from '../simulation/aggregate'

export interface SimulationInspectorProps {
  records: readonly EnergyInterval[]
}

const ranges: { key: TimeRange; label: string }[] = [
  { key: '24h', label: 'Last 24h' },
  { key: '7d', label: 'Last week' },
  { key: '31d', label: 'Last month' },
]

const number = (value: number, digits = 3) => value.toFixed(digits)

export const SimulationInspector = ({ records }: SimulationInspectorProps) => {
  const simulation = useEnergySimulation(records)

  useEffect(() => {
    if (records.length === 0) return
    simulation.scrubTo(records.length - 1)
    simulation.pause()
  }, [records.length, simulation.pause, simulation.scrubTo])

  const { live, history } = simulation

  if (live === null || history === null) {
    return (
      <main>
        <h1>Energy simulation inspector</h1>
        <p>No simulation records available.</p>
      </main>
    )
  }

  return (
    <main className="simulation-inspector">
      <header>
        <h1>Energy simulation inspector</h1>
        <p>{LOS_ANGELES_AUGUST_2026.id}</p>
        <p>{records.length.toLocaleString('en-US')} records</p>
      </header>

      <section aria-labelledby="current-heading">
        <h2 id="current-heading">Current interval</h2>
        <dl className="inspection-fields">
          <div>
            <dt>Timestamp</dt>
            <dd><time dateTime={live.timestamp}>{live.timestamp}</time></dd>
          </div>
          <div>
            <dt>TOU period</dt>
            <dd>{live.tou}</dd>
          </div>
          <div>
            <dt>Day type</dt>
            <dd>{live.dayType}</dd>
          </div>
          <div>
            <dt>Temperature</dt>
            <dd>{number(live.conditions.temperatureF, 1)} °F</dd>
          </div>
          <div>
            <dt>Cloud factor</dt>
            <dd>{number(live.conditions.cloudFactor)}</dd>
          </div>
          <div>
            <dt>Playback</dt>
            <dd>{simulation.isPlaying ? 'Playing' : 'Paused'}</dd>
          </div>
        </dl>

        <div className="controls" aria-label="Playback controls">
          <button type="button" onClick={simulation.play} disabled={simulation.isPlaying}>
            Play
          </button>
          <button type="button" onClick={simulation.pause} disabled={!simulation.isPlaying}>
            Pause
          </button>
          <button type="button" onClick={() => simulation.jumpDay(-1)}>
            Previous day
          </button>
          <button type="button" onClick={() => simulation.jumpDay(1)}>
            Next day
          </button>
        </div>
        <label className="scrubber">
          Simulation interval
          <input
            aria-label="Simulation interval"
            type="range"
            min={0}
            max={records.length - 1}
            value={live.index}
            onChange={(event) => simulation.scrubTo(Number(event.target.value))}
          />
          <output>{live.index + 1} / {records.length}</output>
        </label>
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading">History</h2>
        <div className="controls" aria-label="Time range">
          {ranges.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={simulation.range === key}
              onClick={() => simulation.setRange(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="controls" aria-label="Period navigation">
          <button
            type="button"
            onClick={simulation.previousPeriod}
            disabled={!history.range.canGoPrevious}
          >
            Previous period
          </button>
          <button
            type="button"
            onClick={simulation.nextPeriod}
            disabled={!history.range.canGoNext}
          >
            Next period
          </button>
        </div>
        <p><strong>{history.range.label}</strong></p>
        <p>
          <time dateTime={history.range.startTimestamp}>{history.range.startTimestamp}</time>
          {' — '}
          <time dateTime={history.range.endTimestamp}>{history.range.endTimestamp}</time>
        </p>
        <p>{history.records.length.toLocaleString('en-US')} intervals</p>
      </section>

      <section aria-labelledby="nodes-heading">
        <h2 id="nodes-heading">Energy nodes</h2>
        <table aria-label="Energy nodes">
          <thead>
            <tr>
              <th scope="col">Node</th>
              <th scope="col">Power</th>
              <th scope="col">Direction</th>
              <th scope="col">Status</th>
              <th scope="col">State of charge</th>
            </tr>
          </thead>
          <tbody>
            {live.nodes.map((node) => (
              <tr key={node.id} data-testid="energy-node">
                <th scope="row">{node.label}</th>
                <td>{number(node.powerKw)} kW</td>
                <td>{node.direction}</td>
                <td>{node.status}</td>
                <td>
                  {node.id === 'battery'
                    ? `${number(node.socKwh)} kWh (${number(node.socPercent, 1)}%)`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="transfers-heading">
        <h2 id="transfers-heading">Active transfers</h2>
        {live.transfers.length === 0 ? (
          <p>No active transfers</p>
        ) : (
          <table aria-label="Active transfers">
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Destination</th>
                <th scope="col">kW</th>
                <th scope="col">kWh</th>
              </tr>
            </thead>
            <tbody>
              {live.transfers.map((transfer, index) => (
                <tr key={`${transfer.source}-${transfer.destination}-${index}`}>
                  <td>{transfer.source}</td>
                  <td>{transfer.destination}</td>
                  <td>{number(transfer.kw)}</td>
                  <td>{number(transfer.kwh)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="totals-heading">
        <h2 id="totals-heading">Range totals</h2>
        <dl className="inspection-fields">
          <div><dt>Solar generated</dt><dd>{number(history.totals.solarKwh)} kWh</dd></div>
          <div><dt>Home consumption</dt><dd>{number(history.totals.homeKwh)} kWh</dd></div>
          <div><dt>EV consumption</dt><dd>{number(history.totals.evKwh)} kWh</dd></div>
          <div><dt>Energy consumed</dt><dd>{number(history.totals.energyConsumedKwh)} kWh</dd></div>
          <div><dt>Battery charged</dt><dd>{number(history.totals.batteryChargeKwh)} kWh</dd></div>
          <div><dt>Battery discharged</dt><dd>{number(history.totals.batteryDischargeKwh)} kWh</dd></div>
          <div><dt>Grid imported</dt><dd>{number(history.totals.gridImportKwh)} kWh</dd></div>
          <div><dt>Grid exported</dt><dd>{number(history.totals.gridExportKwh)} kWh</dd></div>
          <div><dt>Import cost</dt><dd>${number(history.totals.importCostUsd, 2)}</dd></div>
          <div><dt>Export credit earned</dt><dd>${number(history.totals.exportCreditUsd, 2)}</dd></div>
          <div><dt>Counterfactual cost</dt><dd>${number(history.totals.counterfactualCostUsd, 2)}</dd></div>
          <div><dt>Savings</dt><dd>${number(history.totals.savingsUsd, 2)}</dd></div>
          <div><dt>Avoided CO2</dt><dd>{number(history.totals.avoidedCo2Kg)} kg CO2e</dd></div>
        </dl>
      </section>

      <details>
        <summary>Data contract JSON</summary>
        <pre data-testid="data-contract-json">
          {JSON.stringify({ live, history: { range: history.range } }, null, 2)}
        </pre>
      </details>
    </main>
  )
}
