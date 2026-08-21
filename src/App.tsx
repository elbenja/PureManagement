import type { EnergyInterval } from './domain/energy'
import { SimulationInspector } from './inspector/SimulationInspector'
import { LOS_ANGELES_2026 } from './scenario/losAngeles2026'
import { generateYear } from './simulation/generateYear'

type GenerationResult =
  | { records: readonly EnergyInterval[]; failed: false }
  | { records: null; failed: true }

let generationResult: GenerationResult | undefined

const getGenerationResult = (): GenerationResult => {
  if (generationResult !== undefined) return generationResult

  try {
    generationResult = { records: generateYear(), failed: false }
  } catch {
    generationResult = { records: null, failed: true }
  }

  return generationResult
}

function App() {
  const result = getGenerationResult()

  if (result.failed) {
    return (
      <main role="alert">
        <h1>Simulation data unavailable.</h1>
      </main>
    )
  }

  return (
    <SimulationInspector
      records={result.records}
      scenario={LOS_ANGELES_2026}
    />
  )
}

export default App
