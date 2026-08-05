import { useMemo } from 'react'
import { SimulationInspector } from './inspector/SimulationInspector'
import { generateMonth } from './simulation/generateMonth'

function App() {
  const result = useMemo(() => {
    try {
      return { records: generateMonth(), failed: false as const }
    } catch {
      return { records: null, failed: true as const }
    }
  }, [])

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
