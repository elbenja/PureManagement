import * as THREE from 'three'

// The seven prototype scenarios from the PureEnergy design canvas (pe-core.js),
// each with the energy state the dashboard shows and the look the 3D scene takes.

export type ScenarioId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

export interface Energy {
  solarKw: number
  homeKw: number
  /** + charging, − discharging */
  batteryKw: number
  batteryPct: number
  ev: 'away' | 'idle' | 'charging'
  evKw: number
  grid: 'import' | 'export' | 'idle' | 'outage'
  gridKw: number
  /** Battery close to its 5 kW output limit. */
  strain: boolean
}

export interface Look {
  skyTop: string
  skyMid: string
  skyBottom: string
  /** Sun glow position on screen, 0–1 from bottom left. */
  sunUv: [number, number]
  sunGlow: number
  sunGlowColor: string
  stars: number
  moon: number
  /** Direction the key light (sun or moon) comes from. */
  keyDir: [number, number, number]
  keyColor: string
  keyIntensity: number
  shadowSoftness: number
  hemiSky: string
  hemiGround: string
  hemiIntensity: number
  environment: number
  exposure: number
  bloom: number
  clouds: number
  cloudColor: string
  rain: number
  /** Wind, lightning and heavier clouds. */
  storm: number
  wet: number
  /** Dust and pollen drifting in low sun. */
  dust: number
  /** Interior lights and wall lamps. */
  lights: number
  streetLight: number
  birds: number
  butterflies: number
  moths: number
  grassTint: string
  canopyTint: string
}

export interface Scenario {
  id: ScenarioId
  name: string
  when: string
  weather: string
  sentence: string
  energy: Energy
  look: Look
}

const SUMMER = { grassTint: '#ffffff', canopyTint: '#ffffff' }
const GREEN = { grassTint: '#a6ffe6', canopyTint: '#bafffa' }
const NONE = { stars: 0, moon: 0, rain: 0, storm: 0, wet: 0, dust: 0, lights: 0, streetLight: 0, birds: 0, butterflies: 0, moths: 0 }

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  A: {
    id: 'A',
    name: 'Midday export',
    when: 'Mon, Jul 20, 12:30 PM PDT',
    weather: 'Clear 85°F',
    sentence: 'Solar is powering the home and sending extra to the grid.',
    energy: { solarKw: 5.77, homeKw: 2.74, batteryKw: 0, batteryPct: 100, ev: 'away', evKw: 0, grid: 'export', gridKw: 3.04, strain: false },
    look: {
      ...NONE,
      ...SUMMER,
      skyTop: '#7fb6d8', skyMid: '#bcdbe6', skyBottom: '#f1efe6',
      sunUv: [0.58, 0.97], sunGlow: 0.9, sunGlowColor: '#fff2d6',
      keyDir: [1.6, 10, 2.6], keyColor: '#fff6e9', keyIntensity: 2.9, shadowSoftness: 5,
      hemiSky: '#e3eef7', hemiGround: '#dcc49c', hemiIntensity: 0.95,
      environment: 0.4, exposure: 1, bloom: 0.12,
      clouds: 0.3, cloudColor: '#ffffff',
      birds: 1, butterflies: 1,
    },
  },
  B: {
    id: 'B',
    name: 'Spring charge',
    when: 'Fri, Apr 3, 9:55 AM PDT',
    weather: 'Clear 63°F',
    sentence: 'Solar is covering the home, charging the battery, and sending the rest to the grid.',
    energy: { solarKw: 4.82, homeKw: 0.48, batteryKw: 3.58, batteryPct: 42, ev: 'away', evKw: 0, grid: 'export', gridKw: 0.76, strain: false },
    look: {
      ...NONE,
      ...GREEN,
      skyTop: '#8dbbe0', skyMid: '#cfe3ea', skyBottom: '#f7efdf',
      sunUv: [0.1, 0.78], sunGlow: 1, sunGlowColor: '#ffe6bf',
      keyDir: [-3.5, 6, 6.5], keyColor: '#fff0d8', keyIntensity: 2.6, shadowSoftness: 4.5,
      hemiSky: '#dbe8f2', hemiGround: '#c8cfa0', hemiIntensity: 0.95,
      environment: 0.4, exposure: 1, bloom: 0.12,
      clouds: 0.45, cloudColor: '#ffffff', dust: 0.35,
      birds: 1, butterflies: 1,
    },
  },
  C: {
    id: 'C',
    name: 'Evening battery',
    when: 'Wed, Jul 22, 6:30 PM PDT',
    weather: '89°F',
    sentence: 'Solar and the battery are powering the home. The grid is idle.',
    energy: { solarKw: 1.72, homeKw: 5.7, batteryKw: -3.98, batteryPct: 76, ev: 'idle', evKw: 0, grid: 'idle', gridKw: 0, strain: false },
    look: {
      ...NONE,
      ...SUMMER,
      skyTop: '#7d93c4', skyMid: '#e9b48f', skyBottom: '#f8d9a8',
      sunUv: [0.9, 0.6], sunGlow: 1, sunGlowColor: '#ffc98a',
      keyDir: [8, 4, -3.5], keyColor: '#ffcf94', keyIntensity: 2.6, shadowSoftness: 4,
      hemiSky: '#b8c3e0', hemiGround: '#dfae84', hemiIntensity: 0.8,
      environment: 0.32, exposure: 1, bloom: 0.16,
      clouds: 0.35, cloudColor: '#ffd9c4', dust: 0.8,
      lights: 0.3, birds: 1,
    },
  },
  D: {
    id: 'D',
    name: 'EV + grid import',
    when: 'Wed, Jul 1, 8:00 PM PDT',
    weather: 'Dusk',
    sentence: 'The grid is powering the home and charging the car.',
    energy: { solarKw: 0, homeKw: 4.17, batteryKw: 0, batteryPct: 24, ev: 'charging', evKw: 7.2, grid: 'import', gridKw: 11.37, strain: false },
    look: {
      ...NONE,
      ...SUMMER,
      skyTop: '#1d2350', skyMid: '#5a4b85', skyBottom: '#d08479',
      sunUv: [0.95, 0.42], sunGlow: 0.35, sunGlowColor: '#ff9a7a',
      stars: 0.45, moon: 0.8,
      keyDir: [-3, 9, 5], keyColor: '#a9b8ff', keyIntensity: 0.55, shadowSoftness: 8,
      hemiSky: '#5e68a8', hemiGround: '#7a5866', hemiIntensity: 0.75,
      environment: 0.12, exposure: 1.05, bloom: 0.32,
      clouds: 0.2, cloudColor: '#6a5f8f',
      lights: 1, streetLight: 1, moths: 1,
    },
  },
  E: {
    id: 'E',
    name: 'At reserve',
    when: 'Thu, Jan 1, 7:35 PM PST',
    weather: 'Rain 63°F',
    sentence: 'The battery is down to its reserve. The grid is covering most of the home.',
    energy: { solarKw: 0, homeKw: 3.89, batteryKw: -1.43, batteryPct: 15, ev: 'idle', evKw: 0, grid: 'import', gridKw: 2.46, strain: false },
    look: {
      ...NONE,
      ...GREEN,
      skyTop: '#060a17', skyMid: '#121b38', skyBottom: '#24304f',
      sunUv: [0.5, 0.9], sunGlow: 0, sunGlowColor: '#000000',
      stars: 0.6, moon: 1,
      keyDir: [-4, 10, 4], keyColor: '#9fb4ff', keyIntensity: 0.45, shadowSoftness: 10,
      hemiSky: '#2c3b66', hemiGround: '#202432', hemiIntensity: 0.55,
      environment: 0.08, exposure: 1.1, bloom: 0.38,
      clouds: 0.75, cloudColor: '#2b3552', rain: 0.55, storm: 0.15, wet: 1,
      lights: 1, streetLight: 1,
    },
  },
  F: {
    id: 'F',
    name: 'Grid outage',
    when: 'Tue, Jul 21, 3:00 PM PDT',
    weather: 'Thunderstorm 91°F',
    sentence: 'Grid outage (simulated). Solar is carrying the home on its own; the battery is on standby.',
    energy: { solarKw: 2.12, homeKw: 2.12, batteryKw: 0, batteryPct: 100, ev: 'away', evKw: 0, grid: 'outage', gridKw: 0, strain: false },
    look: {
      ...NONE,
      ...SUMMER,
      skyTop: '#4b5563', skyMid: '#77808b', skyBottom: '#a6a9a6',
      sunUv: [0.62, 0.92], sunGlow: 0.25, sunGlowColor: '#fff3dc',
      keyDir: [2, 10, 3], keyColor: '#e9eef2', keyIntensity: 0.9, shadowSoftness: 14,
      hemiSky: '#aab4be', hemiGround: '#7f8078', hemiIntensity: 1,
      environment: 0.3, exposure: 1, bloom: 0.22,
      clouds: 1, cloudColor: '#69717d', rain: 1, storm: 1, wet: 1,
      lights: 1,
    },
  },
  G: {
    id: 'G',
    name: 'At the 5 kW limit',
    when: 'Wed, Jun 10, 7:35 PM PDT',
    weather: 'Golden hour',
    sentence: 'The battery is carrying nearly all of the home, close to its 5 kW output limit.',
    energy: { solarKw: 0.45, homeKw: 4.89, batteryKw: -4.43, batteryPct: 56, ev: 'idle', evKw: 0, grid: 'idle', gridKw: 0, strain: true },
    look: {
      ...NONE,
      ...SUMMER,
      skyTop: '#4b5490', skyMid: '#d9876f', skyBottom: '#f5c483',
      sunUv: [0.95, 0.47], sunGlow: 1, sunGlowColor: '#ff9f6a',
      stars: 0.08, moon: 0.3,
      keyDir: [9, 2.2, -3], keyColor: '#ffa76f', keyIntensity: 2.2, shadowSoftness: 3.5,
      hemiSky: '#8a8cc4', hemiGround: '#c98b70', hemiIntensity: 0.7,
      environment: 0.22, exposure: 1, bloom: 0.22,
      clouds: 0.35, cloudColor: '#f0b49a', dust: 0.9,
      lights: 0.75, birds: 0.6,
    },
  },
}

export const SCENARIO_IDS = Object.keys(SCENARIOS) as ScenarioId[]

/** Battery state the way the dashboard derives it (15 % reserve). */
export function batteryState({ batteryPct, batteryKw }: Energy) {
  if (batteryPct <= 15.5 && batteryKw <= 0) return 'reserve'
  if (batteryKw > 0.004) return 'charging'
  if (batteryKw < -0.004) return 'discharging'
  return 'idle'
}

// ---------------------------------------------------------------------------
// Blending looks: colors become THREE.Color (linear), tuples stay arrays.

export type LookState = {
  [K in keyof Look]: Look[K] extends string ? THREE.Color : Look[K] extends number ? number : number[]
}

export function lookState(look: Look): LookState {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(look)) {
    out[key] = typeof value === 'string' ? new THREE.Color(value) : Array.isArray(value) ? [...value] : value
  }
  return out as LookState
}

const lerp = (x: number, y: number, t: number) => x * (1 - t) + y * t

/** out = a·(1 − t) + b·t, key by key. */
export function mixLook(out: LookState, a: LookState, b: LookState, t: number) {
  const o = out as Record<string, unknown>
  const from = a as Record<string, unknown>
  const to = b as Record<string, unknown>
  for (const key of Object.keys(o)) {
    const x = from[key]
    const y = to[key]
    if (typeof x === 'number' && typeof y === 'number') o[key] = lerp(x, y, t)
    else if (x instanceof THREE.Color && y instanceof THREE.Color) {
      const c = o[key] as THREE.Color
      c.r = lerp(x.r, y.r, t)
      c.g = lerp(x.g, y.g, t)
      c.b = lerp(x.b, y.b, t)
    }
    else if (Array.isArray(x) && Array.isArray(y)) (o[key] as number[]).forEach((_, i, arr) => (arr[i] = lerp(x[i], y[i], t)))
  }
  return out
}
