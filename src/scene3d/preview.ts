import { createHouseScene } from './houseScene'
import { SCENARIOS, SCENARIO_IDS, type ScenarioId } from './scenarios'

function element(id: string) {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Missing #${id}`)
  return el
}

const container = element('scene')
const nav = element('scenarios')
const title = element('title')
const meta = element('meta')
const sentence = element('sentence')

const fromHash = location.hash.slice(1).toUpperCase() as ScenarioId
const start: ScenarioId = SCENARIO_IDS.includes(fromHash) ? fromHash : 'A'
const house = createHouseScene(container, start)

const buttons = SCENARIO_IDS.map((id) => {
  const button = document.createElement('button')
  button.type = 'button'
  const badge = document.createElement('b')
  badge.textContent = id
  button.append(badge, SCENARIOS[id].name)
  button.addEventListener('click', () => show(id))
  nav.append(button)
  return button
})

function show(id: ScenarioId) {
  const s = SCENARIOS[id]
  house.setScenario(id)
  title.textContent = `${s.id} · ${s.name}`
  meta.textContent = `${s.when} · ${s.weather}`
  sentence.textContent = s.sentence
  buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(SCENARIO_IDS[i] === id)))
  history.replaceState(null, '', `#${id}`)
}

show(start)
