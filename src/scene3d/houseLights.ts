import * as THREE from 'three'
import type { Anchor, Diorama } from './model'
import type { LookState, Scenario } from './scenarios'

// Lights people would see from the street: warm windows, wall lamps with real
// light, pools of light on the ground (stretched into reflections when wet), and
// the street lamp on the pole, which goes dark in a grid outage while the house,
// running on its own solar, stays lit.

function glowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const g = canvas.getContext('2d')!
  const gradient = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.35)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gradient
  g.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** A soft cone of light under the street lamp: brightest at the lamp, fading toward the ground and the edges. */
function lightCone(head: THREE.Vector3, target: THREE.Vector3) {
  const dir = new THREE.Vector3().subVectors(target, head)
  const height = dir.length()
  const geometry = new THREE.ConeGeometry(1.9, height, 32, 1, true).translate(0, -height / 2, 0)
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#ffd9a0') }, uOpacity: { value: 0 }, uHeight: { value: height } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uHeight;
      varying float vDown;
      varying float vFacing;
      void main() {
        vDown = -position.y / uHeight;
        vFacing = abs(normalize(normalMatrix * normal).z);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vDown;
      varying float vFacing;
      void main() {
        gl_FragColor = vec4(uColor, uOpacity * pow(1.0 - vDown, 1.6) * pow(vFacing, 1.5));
      }
    `,
  })
  const cone = new THREE.Mesh(geometry, material)
  cone.position.copy(head)
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize())
  return { cone, material }
}

/** Light flickers for a moment when the grid drops and the house switches over. */
const FLICKER = [1, 0.15, 0.9, 0.05, 0.7, 0.1, 1]

export interface HouseLights {
  /** Transparent effects, kept out of the ambient-occlusion pass. */
  fx: THREE.Group
  update(look: LookState, scenario: Scenario, time: number): void
  dispose(): void
}

export function createHouseLights(d: Diorama): HouseLights {
  const fx = new THREE.Group()
  const glow = glowTexture()

  const lampLights = d.lamps.map((lamp) => {
    const light = new THREE.PointLight('#ffb36b', 0, 5, 2)
    light.position.copy(lamp.position).addScaledVector(lamp.facing, 0.12)
    d.root.add(light)
    return light
  })

  const poolMaterial = new THREE.MeshBasicMaterial({ map: glow, color: '#ffae5c', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })
  const streakMaterial = poolMaterial.clone()
  const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
  const toCamera = new THREE.Vector3(1, 0, 1).normalize()
  const sources: Anchor[] = [...d.windows, ...d.lamps]
  for (const a of sources) {
    const base = new THREE.Vector3(a.position.x, 0.02, a.position.z)
    const pool = new THREE.Mesh(plane, poolMaterial)
    pool.position.copy(base).addScaledVector(a.facing, 0.75)
    pool.rotation.y = -Math.atan2(a.facing.z, a.facing.x)
    pool.scale.set(1.5, 1, Math.max(1.1, a.width + 0.7))
    const streak = new THREE.Mesh(plane, streakMaterial)
    streak.position.copy(base).addScaledVector(toCamera, 1.5).setY(0.025)
    streak.rotation.y = -Math.atan2(toCamera.z, toCamera.x)
    streak.scale.set(3, 1, 0.42)
    fx.add(pool, streak)
  }

  const spot = new THREE.SpotLight('#ffd9a0', 0, 11, 0.62, 0.75, 1.4)
  spot.position.copy(d.street.head)
  spot.target.position.copy(d.street.target)
  d.root.add(spot, spot.target)
  const { cone, material: coneMaterial } = lightCone(d.street.head, d.street.target)
  fx.add(cone)

  let lastGrid = ''
  let flickerFrom = -10

  return {
    fx,
    update(look, scenario, t) {
      if (scenario.energy.grid !== lastGrid) {
        if (scenario.energy.grid === 'outage' && lastGrid !== '') flickerFrom = t
        lastGrid = scenario.energy.grid
      }
      const step = Math.floor((t - flickerFrom) / 0.12)
      const flicker = step >= 0 && step < FLICKER.length ? FLICKER[step] : 1
      const lights = look.lights * flicker
      const dark = 1 - THREE.MathUtils.clamp(look.keyIntensity / 2.6, 0, 1)

      d.windowGlass.emissiveIntensity = lights * 2.4
      d.lampMaterial.emissiveIntensity = lights * 3.5
      for (const light of lampLights) light.intensity = lights * 6
      poolMaterial.opacity = lights * dark * 0.5
      streakMaterial.opacity = lights * dark * look.wet * 0.45

      const street = scenario.energy.grid === 'outage' ? 0 : look.streetLight
      d.streetLens.emissiveIntensity = street * 6
      spot.intensity = street * 40
      coneMaterial.uniforms.uOpacity.value = street * (0.05 + look.rain * 0.07)
      cone.visible = street > 0.01
    },
    dispose() {
      glow.dispose()
      plane.dispose()
      poolMaterial.dispose()
      streakMaterial.dispose()
      coneMaterial.dispose()
      cone.geometry.dispose()
    },
  }
}
