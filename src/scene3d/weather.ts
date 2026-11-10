import * as THREE from 'three'
import { PLINTH, seeded, type Diorama } from './model'
import type { LookState } from './scenarios'

// Weather over the diorama: low-poly clouds that drift and cast shadows, rain
// streaks and ground splashes, puddles and wet glossy surfaces, lightning with
// a flash, and dust that catches low sun. Rain stays inside the plinth, like a
// snow globe.

const RAIN_HEIGHT = 11

// --- Clouds ----------------------------------------------------------------

/** Each cloud drifts across the view on a line behind the house (x + z = c). */
const CLOUD_LAYOUT = [
  { c: -6.4, y: 6.6, s: 1.1, phase: 0.05, speed: 0.35 },
  { c: -12.4, y: 6.1, s: 1.4, phase: 0.42, speed: 0.28 },
  { c: -7.4, y: 7.0, s: 0.9, phase: 0.72, speed: 0.42 },
  { c: -12.9, y: 6.6, s: 1.2, phase: 0.9, speed: 0.3 },
  { c: -6.0, y: 6.4, s: 1.3, phase: 0.27, speed: 0.33 },
  { c: -13.4, y: 6.2, s: 1.5, phase: 0.6, speed: 0.25 },
]
const CLOUD_TRACK = 44
type Blob = [x: number, y: number, z: number, r: number]
const CLOUD_BLOBS: Blob[] = [
  [0, 0, 0, 1],
  [0.95, -0.12, 0.15, 0.75],
  [-0.9, -0.15, 0.1, 0.72],
  [0.35, 0.38, -0.15, 0.7],
  [-0.4, 0.3, 0.25, 0.62],
  [0.2, -0.2, 0.6, 0.6],
]

function buildClouds(material: THREE.Material) {
  const blob = new THREE.IcosahedronGeometry(1, 1)
  return CLOUD_LAYOUT.map((spec, i) => {
    const cloud = new THREE.Group()
    const puff = new THREE.Group()
    puff.scale.set(1, 0.68, 1)
    puff.rotation.y = i * 1.3
    for (const [x, y, z, r] of CLOUD_BLOBS) {
      const mesh = new THREE.Mesh(blob, material)
      mesh.position.set(x, y, z)
      mesh.scale.setScalar(r)
      mesh.castShadow = true
      puff.add(mesh)
    }
    cloud.add(puff)
    cloud.scale.setScalar(0)
    cloud.visible = false
    return { cloud, spec, size: 0 }
  })
}

// --- Rain and splashes -----------------------------------------------------

function instanced(base: THREE.BufferGeometry, seeds: Float32Array) {
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.index = base.index
  geometry.setAttribute('position', base.getAttribute('position'))
  geometry.setAttribute('uv', base.getAttribute('uv'))
  geometry.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 4))
  geometry.instanceCount = seeds.length / 4
  return geometry
}

function buildRain(random: () => number, uniforms: Record<string, THREE.IUniform>) {
  const count = 1600
  const seeds = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    seeds.set([(random() * 2 - 1) * (PLINTH.x - 0.1), random() * RAIN_HEIGHT, (random() * 2 - 1) * (PLINTH.z - 0.1), random()], i * 4)
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec4 seed;
      uniform float uTime;
      uniform float uAmount;
      uniform float uWind;
      varying vec2 vUv;
      varying float vAlpha;
      void main() {
        vUv = uv;
        float fall = 8.5 + seed.w * 3.0;
        float y = mod(seed.y - uTime * fall, ${RAIN_HEIGHT.toFixed(1)});
        vec4 mv = viewMatrix * vec4(seed.x + uWind * y * 0.08, y, seed.z, 1.0);
        float len = 0.38 + seed.w * 0.22;
        mv.x += position.x * 0.016 + (position.y + 0.5) * len * uWind * 0.12;
        mv.y += (position.y + 0.5) * len;
        vAlpha = step(seed.w, uAmount) * smoothstep(0.0, 0.5, y) * (0.6 + 0.4 * seed.w);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vAlpha;
      void main() {
        float a = (1.0 - abs(vUv.x - 0.5) * 2.0) * (1.0 - vUv.y * 0.85);
        gl_FragColor = vec4(uColor, a * vAlpha * uOpacity);
      }
    `,
  })
  const mesh = new THREE.Mesh(instanced(new THREE.PlaneGeometry(1, 1), seeds), material)
  mesh.frustumCulled = false
  return mesh
}

function buildSplashes(random: () => number, uniforms: Record<string, THREE.IUniform>) {
  const count = 280
  const seeds = new Float32Array(count * 4)
  for (let i = 0; i < count; i++) {
    seeds.set([(random() * 2 - 1) * (PLINTH.x - 0.2), (random() * 2 - 1) * (PLINTH.z - 0.2), random(), random()], i * 4)
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      attribute vec4 seed;
      uniform float uTime;
      uniform float uAmount;
      varying vec2 vUv;
      varying float vAge;
      varying float vOn;
      void main() {
        vUv = uv;
        vAge = fract(uTime * (1.2 + seed.w) + seed.z);
        vOn = step(seed.w, uAmount);
        float size = 0.05 + vAge * 0.2;
        vec3 p = vec3(seed.x + position.x * size, 0.05, seed.y - position.y * size);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vAge;
      varying float vOn;
      void main() {
        float r = length(vUv - 0.5) * 2.0;
        float ring = smoothstep(0.6, 0.85, r) * (1.0 - smoothstep(0.85, 1.0, r));
        gl_FragColor = vec4(uColor, ring * (1.0 - vAge) * vOn * uOpacity * 0.7);
      }
    `,
  })
  const mesh = new THREE.Mesh(instanced(new THREE.PlaneGeometry(1, 1), seeds), material)
  mesh.frustumCulled = false
  return mesh
}

// --- Puddles ----------------------------------------------------------------

const PUDDLES: [x: number, y: number, z: number, sx: number, sz: number, turn: number][] = [
  [4.3, 0.043, -4.4, 0.85, 0.5, 0.4],
  [5.9, 0.043, -2.6, 0.55, 0.36, -0.3],
  [5.7, 0.006, 3.6, 0.9, 0.55, 0.2],
  [2.7, 0.006, 2.7, 0.6, 0.38, -0.5],
  [-2.6, 0.006, 7.25, 0.7, 0.36, 0.1],
]

// --- Lightning --------------------------------------------------------------

const STRIKES = [
  { from: new THREE.Vector3(-11.5, 8.5, -1.5), to: new THREE.Vector3(-13.5, -1.5, -0.5) },
  { from: new THREE.Vector3(-1.5, 8.5, -11.5), to: new THREE.Vector3(-0.5, -1.5, -13.5) },
]

function boltPath(from: THREE.Vector3, to: THREE.Vector3) {
  let points = [from.clone(), to.clone()]
  let offset = from.distanceTo(to) * 0.16
  for (let level = 0; level < 5; level++) {
    const next = [points[0]]
    for (let i = 0; i < points.length - 1; i++) {
      const mid = points[i].clone().lerp(points[i + 1], 0.5)
      mid.x += (Math.random() * 2 - 1) * offset
      mid.z += (Math.random() * 2 - 1) * offset
      next.push(mid, points[i + 1])
    }
    points = next
    offset *= 0.55
  }
  const path = new THREE.CurvePath<THREE.Vector3>()
  for (let i = 0; i < points.length - 1; i++) path.add(new THREE.LineCurve3(points[i], points[i + 1]))
  // One short fork from a third of the way down.
  const forkStart = points[Math.floor(points.length / 3)]
  const forkEnd = forkStart.clone().add(new THREE.Vector3(Math.random() * 2 - 1, -2.6, Math.random() * 2 - 1))
  const fork = new THREE.CurvePath<THREE.Vector3>()
  fork.add(new THREE.LineCurve3(forkStart, forkStart.clone().lerp(forkEnd, 0.5).add(new THREE.Vector3(0.3, 0, -0.3))))
  fork.add(new THREE.LineCurve3(fork.getPoint(1), forkEnd))
  return { path, segments: points.length, fork }
}

/** Two quick peaks, like a real strike. */
function flashEnvelope(age: number) {
  if (age < 0 || age > 0.9) return 0
  const first = age < 0.04 ? age / 0.04 : Math.exp(-(age - 0.04) / 0.08)
  const second = age > 0.17 ? 0.75 * Math.exp(-(age - 0.17) / 0.12) : 0
  return Math.min(1, first + second)
}

// --- Dust and pollen ----------------------------------------------------------

function buildDust(random: () => number, uniforms: Record<string, THREE.IUniform>) {
  const count = 180
  const positions = new Float32Array(count * 3)
  const seeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    positions.set([(random() * 2 - 1) * (PLINTH.x - 0.5), 0.3 + random() * 4.2, (random() * 2 - 1) * (PLINTH.z - 0.5)], i * 3)
    seeds[i] = random()
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1))
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uTime;
      uniform float uSize;
      varying float vTwinkle;
      void main() {
        vec3 p = position + vec3(
          sin(uTime * 0.25 + seed * 6.28) * 0.5,
          sin(uTime * 0.18 + seed * 12.0) * 0.35,
          cos(uTime * 0.22 + seed * 9.0) * 0.5
        );
        vTwinkle = 0.5 + 0.5 * sin(uTime * 1.3 + seed * 30.0);
        gl_PointSize = uSize * (0.5 + seed);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vTwinkle;
      void main() {
        float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(uColor, a * uOpacity * vTwinkle);
      }
    `,
  })
  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  return points
}

// ---------------------------------------------------------------------------

export interface Weather {
  /** Transparent effects, kept out of the ambient-occlusion pass. */
  fx: THREE.Group
  /** Returns the lightning flash, 0–1. */
  update(look: LookState, time: number, motion: boolean): number
  dispose(): void
}

export function createWeather(diorama: Diorama, pixelRatio: number): Weather {
  const random = seeded(77)
  const fx = new THREE.Group()
  const white = new THREE.Color(1, 1, 1)

  const cloudMaterial = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 })
  const clouds = buildClouds(cloudMaterial)
  for (const { cloud } of clouds) diorama.root.add(cloud)

  const rainUniforms = {
    uTime: { value: 0 },
    uAmount: { value: 0 },
    uWind: { value: 0 },
    uColor: { value: new THREE.Color() },
    uOpacity: { value: 0.45 },
  }
  const rain = buildRain(random, rainUniforms)
  const splashUniforms = { uTime: rainUniforms.uTime, uAmount: rainUniforms.uAmount, uColor: rainUniforms.uColor, uOpacity: rainUniforms.uOpacity }
  const splashes = buildSplashes(random, splashUniforms)
  fx.add(rain, splashes)

  const puddleMaterial = new THREE.MeshStandardMaterial({ color: '#3b3a39', roughness: 0.04, transparent: true, opacity: 0, depthWrite: false })
  const puddleGeometry = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2)
  for (const [x, y, z, sx, sz, turn] of PUDDLES) {
    const puddle = new THREE.Mesh(puddleGeometry, puddleMaterial)
    puddle.position.set(x, y, z)
    puddle.scale.set(sx, 1, sz)
    puddle.rotation.y = turn
    puddle.receiveShadow = true
    fx.add(puddle)
  }

  const dustUniforms = { uTime: { value: 0 }, uSize: { value: 3.2 * pixelRatio }, uColor: { value: new THREE.Color() }, uOpacity: { value: 0 } }
  const dust = buildDust(random, dustUniforms)
  fx.add(dust)

  const boltMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(3, 3.2, 4), transparent: true, opacity: 0, depthWrite: false })
  let bolt: THREE.Group | null = null
  let nextStrike = Infinity
  let strikeAt = -10
  let strikeCount = 0

  const strike = (t: number) => {
    if (bolt) {
      fx.remove(bolt)
      bolt.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
    }
    const { from, to } = STRIKES[strikeCount++ % STRIKES.length]
    const { path, segments, fork } = boltPath(from, to)
    bolt = new THREE.Group()
    bolt.add(new THREE.Mesh(new THREE.TubeGeometry(path, segments * 2, 0.04, 4), boltMaterial))
    bolt.add(new THREE.Mesh(new THREE.TubeGeometry(fork, 12, 0.025, 4), boltMaterial))
    fx.add(bolt)
    strikeAt = t
  }

  let lastTime = 0
  return {
    fx,
    update(look, t, motion) {
      const dt = Math.max(0, t - lastTime)
      lastTime = t

      // Clouds: as many as the look asks for, bigger and lower in a storm.
      cloudMaterial.color.copy(look.cloudColor)
      cloudMaterial.emissive.copy(look.cloudColor).multiplyScalar(0.18)
      clouds.forEach((c, i) => {
        const want = THREE.MathUtils.clamp(look.clouds * clouds.length - i, 0, 1) * (1 + look.storm * 0.45)
        c.size += (want - c.size) * Math.min(1, dt * 1.5)
        const along = ((t * c.spec.speed * (1 + look.storm) + c.spec.phase * CLOUD_TRACK) % CLOUD_TRACK) - CLOUD_TRACK / 2
        c.cloud.position.set((c.spec.c + along) / 2, c.spec.y - look.storm * 0.5, (c.spec.c - along) / 2)
        c.cloud.scale.setScalar(c.size * c.spec.s)
        c.cloud.visible = c.size > 0.01
      })

      // Rain, splashes and wind.
      rainUniforms.uTime.value = t
      rainUniforms.uAmount.value = look.rain
      rainUniforms.uWind.value = look.storm * 1.6
      rainUniforms.uColor.value.copy(look.hemiSky).lerp(white, 0.5)
      rain.visible = splashes.visible = look.rain > 0.01
      diorama.wind.value = 1 + look.storm * 1.8

      // Wet surfaces darken and turn glossy; puddles appear.
      for (const w of diorama.wettables) {
        w.material.color.copy(w.color).multiplyScalar(1 - look.wet * w.darken)
        w.material.roughness = THREE.MathUtils.lerp(w.roughness, w.wetRoughness, look.wet)
      }
      puddleMaterial.opacity = look.wet * 0.65

      // Season: greener grass and trees after winter and spring rain.
      diorama.vegetation.color.copy(look.grassTint)
      diorama.canopy.color.set('#dcb45c').multiply(look.canopyTint)

      // Dust in low sun.
      dustUniforms.uTime.value = t
      dustUniforms.uOpacity.value = look.dust * 0.8
      dustUniforms.uColor.value.copy(look.keyColor).multiplyScalar(1.3)
      dust.visible = look.dust > 0.01

      // Lightning only while the storm is on and motion is allowed.
      if (look.storm > 0.6 && motion) {
        if (nextStrike === Infinity) nextStrike = t + 1.5
        if (t >= nextStrike) {
          strike(t)
          nextStrike = t + 3.5 + Math.random() * 5
        }
      } else {
        nextStrike = Infinity
      }
      const flash = flashEnvelope(t - strikeAt) * THREE.MathUtils.clamp((look.storm - 0.6) / 0.4, 0, 1)
      boltMaterial.opacity = Math.min(1, flash * 1.4)
      if (bolt) bolt.visible = flash > 0.02
      return flash
    },
    dispose() {
      cloudMaterial.dispose()
      boltMaterial.dispose()
      puddleMaterial.dispose()
    },
  }
}
