import type { EnergyInterval } from './domain/energy'
import { SimulationInspector } from './inspector/SimulationInspector'
import { generateMonth } from './simulation/generateMonth'

type GenerationResult =
  | { records: readonly EnergyInterval[]; failed: false }
  | { records: null; failed: true }

let generationResult: GenerationResult | undefined

const getGenerationResult = (): GenerationResult => {
  if (generationResult !== undefined) return generationResult

  try {
    generationResult = { records: generateMonth(), failed: false }
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

  return <SimulationInspector records={result.records} />
}

export default App
