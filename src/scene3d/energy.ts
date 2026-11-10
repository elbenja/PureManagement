import * as THREE from 'three'
import type { Diorama } from './model'
import { batteryState, type Scenario } from './scenarios'

// The energy system made visible on the house itself, in the dashboard's
// colours: the battery's level bar (amber near the 15 % reserve, rising or
// falling pulse while it charges or discharges, a hot glow at the 5 kW limit),
// the charger light, current pulsing along the charge cable and the service
// drop (toward the house on import, away on export), a solar sheen, the car
// arriving or leaving, and sparks at the transformer during an outage.

const COLOR = {
  bat: new THREE.Color('#4FE9BE'),
  amber: new THREE.Color('#FFB726'),
  imp: new THREE.Color('#FF6A9C'),
  exp: new THREE.Color('#A99BFF'),
  ev: new THREE.Color('#62BDFF'),
  mint: new THREE.Color('#7DF2CC'),
  idle: new THREE.Color('#dfe6e2'),
  spark: new THREE.Color('#ffd27a'),
}

const BAR_HEIGHT = 0.62
const PEAK_SOLAR_KW = 5.77

function pulses(count: number, radius: number) {
  const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(), transparent: true, depthWrite: false })
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(radius, 10, 8), material, count)
  mesh.frustumCulled = false
  return { mesh, material }
}

/** Place `shown` pulses along a curve, moving forward (dir 1) or backward (dir −1). */
function flow(mesh: THREE.InstancedMesh, curve: THREE.Curve<THREE.Vector3>, shown: number, phase: number, dir: number) {
  const matrix = new THREE.Matrix4()
  const point = new THREE.Vector3()
  for (let i = 0; i < mesh.count; i++) {
    let u = (((phase + i / Math.max(1, shown)) % 1) + 1) % 1
    if (dir < 0) u = 1 - u
    curve.getPointAt(u, point)
    const s = i < shown ? Math.sin(Math.PI * u) ** 0.35 : 0
    matrix.makeScale(s, s, s).setPosition(point)
    mesh.setMatrixAt(i, matrix)
  }
  mesh.instanceMatrix.needsUpdate = true
}

export interface EnergyCues {
  /** Transparent effects, kept out of the ambient-occlusion pass. */
  fx: THREE.Group
  update(scenario: Scenario, time: number, dt: number): void
  dispose(): void
}

export function createEnergy(d: Diorama, pixelRatio: number): EnergyCues {
  const fx = new THREE.Group()
  const face = d.batteryFace.position

  // Battery level bar on the cabinet front.
  const bottom = face.y - 0.04
  const track = new THREE.Mesh(new THREE.BoxGeometry(0.075, BAR_HEIGHT + 0.03, 0.01), new THREE.MeshStandardMaterial({ color: '#1f2528', roughness: 0.4 }))
  track.position.set(face.x, bottom + BAR_HEIGHT / 2, face.z + 0.005)
  const fillMaterial = new THREE.MeshStandardMaterial({ color: COLOR.bat, emissive: COLOR.bat, emissiveIntensity: 1.4 })
  const fill = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1, 0.012).translate(0, 0.5, 0), fillMaterial)
  fill.position.set(face.x, bottom, face.z + 0.008)
  const pulseMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(2.4, 2.6, 2.5) })
  const pulse = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.05, 0.014), pulseMaterial)
  pulse.position.set(face.x, bottom, face.z + 0.01)
  const batteryGlow = new THREE.PointLight(COLOR.bat, 0, 1.8, 2)
  batteryGlow.position.copy(face).add(new THREE.Vector3(0, 0.25, 0.3))
  d.root.add(track, fill, pulse, batteryGlow)

  // Current along the charge cable and the service drop.
  const cable = pulses(6, 0.045)
  const drop = pulses(9, 0.06)
  fx.add(cable.mesh, drop.mesh)

  // Transformer sparks during an outage.
  const SPARKS = 16
  const sparkGeometry = new THREE.BufferGeometry()
  sparkGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3))
  const sparkMaterial = new THREE.PointsMaterial({
    color: COLOR.spark.clone().multiplyScalar(3),
    size: 3.5 * pixelRatio,
    sizeAttenuation: false,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const sparks = new THREE.Points(sparkGeometry, sparkMaterial)
  sparks.frustumCulled = false
  fx.add(sparks)
  const sparkVelocity = Array.from({ length: SPARKS }, () => new THREE.Vector3())
  let burstAt = -10
  let nextBurst = 0

  const carHome = d.car.position.clone()
  let presence = -1
  let shownPct = -1
  let solar = 0
  const color = new THREE.Color()

  return {
    fx,
    update(scenario, t, dt) {
      const e = scenario.energy
      const state = batteryState(e)
      const ease = Math.min(1, dt * 2.2)

      // Battery bar.
      shownPct = shownPct < 0 ? e.batteryPct : shownPct + (e.batteryPct - shownPct) * ease
      const height = Math.max(0.02, (BAR_HEIGHT * shownPct) / 100)
      fill.scale.y = height
      color.copy(COLOR.amber).lerp(COLOR.bat, THREE.MathUtils.clamp((shownPct - 15) / 30, 0, 1))
      let level = 1.4
      let glow = 0.25
      if (state === 'reserve') level = 0.5 + 0.9 * (0.5 + 0.5 * Math.sin(t * 2.2))
      if (e.strain) {
        color.lerp(COLOR.amber, 0.65)
        level = 1.6 + 0.8 * Math.sin(t * 9)
        glow = 1.1 + 0.6 * Math.sin(t * 9)
      }
      fillMaterial.color.copy(color)
      fillMaterial.emissive.copy(color)
      fillMaterial.emissiveIntensity = level
      batteryGlow.color.copy(color)
      batteryGlow.intensity = glow
      const moving = state === 'charging' || state === 'discharging'
      pulse.visible = moving
      if (moving) {
        const run = (t * (0.35 + Math.abs(e.batteryKw) * 0.12)) % 1
        pulse.position.y = bottom + height * (state === 'charging' ? run : 1 - run)
      }

      // Charger light: soft white with no car, mint when plugged in, breathing blue while charging.
      const charging = e.ev === 'charging'
      if (charging) d.chargerLed.emissive.copy(COLOR.ev)
      else d.chargerLed.emissive.copy(e.ev === 'idle' ? COLOR.mint : COLOR.idle)
      d.chargerLed.color.copy(d.chargerLed.emissive)
      d.chargerLed.emissiveIntensity = charging ? 0.8 + 1.2 * (0.5 + 0.5 * Math.sin(t * 3)) : e.ev === 'idle' ? 1 : 0.4

      // The car drives in or away.
      const home = e.ev === 'away' ? 0 : 1
      presence = presence < 0 ? home : presence + (home - presence) * Math.min(1, dt * 2.5)
      const solid = presence > 0.99
      for (const material of d.carMaterials) {
        if (material.transparent === solid) {
          material.transparent = !solid
          material.needsUpdate = true
        }
        material.opacity = presence
      }
      d.car.position.x = carHome.x + (1 - presence) * 0.9
      d.car.visible = d.cable.visible = presence > 0.01

      // Pulses along the charge cable (from the grid in this prototype's data).
      cable.mesh.visible = charging && presence > 0.5
      if (cable.mesh.visible) {
        cable.material.color.copy(e.grid === 'import' ? COLOR.imp : COLOR.bat).multiplyScalar(2.5)
        flow(cable.mesh, d.cableCurve, 6, t * 0.55, 1)
      }

      // Pulses along the service drop: toward the house on import, away on export.
      const live = e.grid === 'import' || e.grid === 'export'
      drop.mesh.visible = live
      if (live) {
        drop.material.color.copy(e.grid === 'import' ? COLOR.imp : COLOR.exp).multiplyScalar(2.5)
        const shown = Math.min(9, Math.round(2 + e.gridKw * 0.6))
        flow(drop.mesh, d.dropCurve, shown, t * (0.25 + e.gridKw * 0.03), e.grid === 'import' ? 1 : -1)
      }

      // Solar sheen follows output.
      solar += (e.solarKw / PEAK_SOLAR_KW - solar) * ease
      d.solar.value = solar

      // Sparks at the transformer while the grid is down.
      if (e.grid === 'outage' && t >= nextBurst) {
        burstAt = t
        nextBurst = t + 4 + Math.random() * 5
        for (const v of sparkVelocity) v.set(Math.random() * 2 - 1, Math.random() * 1.6, Math.random() * 2 - 1).multiplyScalar(1.6)
      }
      if (e.grid !== 'outage') nextBurst = t + 1
      const age = t - burstAt
      sparks.visible = e.grid === 'outage' && age < 0.8
      if (sparks.visible) {
        const positions = sparkGeometry.getAttribute('position') as THREE.BufferAttribute
        sparkVelocity.forEach((v, i) => {
          positions.setXYZ(i, d.transformer.x + v.x * age, d.transformer.y + v.y * age - 4.9 * age * age, d.transformer.z + v.z * age)
        })
        positions.needsUpdate = true
        sparkMaterial.opacity = 1 - age / 0.8
      }
    },
    dispose() {
      for (const mesh of [track, fill, pulse]) {
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
      }
      for (const p of [cable, drop]) {
        p.mesh.geometry.dispose()
        p.material.dispose()
      }
      sparkGeometry.dispose()
      sparkMaterial.dispose()
    },
  }
}
