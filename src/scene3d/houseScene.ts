import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { createAmbient } from './ambient'
import { createEnergy } from './energy'
import { createHouseLights } from './houseLights'
import { buildDiorama } from './model'
import { SCENARIOS, lookState, mixLook, type LookState, type ScenarioId } from './scenarios'
import { createSky } from './sky'
import { createWeather } from './weather'

export interface HouseScene {
  /** Blend to another scenario's light, weather and energy state. */
  setScenario(id: ScenarioId): void
  setReducedMotion(reduced: boolean): void
  dispose(): void
}

const ELEVATION = THREE.MathUtils.degToRad(25)
const AZIMUTH = Math.PI / 4
const TARGET = new THREE.Vector3(0, 1.4, 0)
// Screen-space extent of the diorama (world units) plus breathing room,
// zoomed out 20 % so the house reads between the dashboard's side panels.
const FIT_WIDTH = 21.1 * 1.18 * 1.25
const FIT_HEIGHT = 13.1 * 1.25 * 1.25
/** Seconds a scenario change takes. */
const BLEND = 1.8

/** Soft baked shadow under the base, so nothing else casts onto the backdrop. */
function dropShadow() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const g = canvas.getContext('2d')!
  g.filter = 'blur(18px)'
  g.fillStyle = 'rgba(30, 24, 18, 0.5)'
  g.fillRect(48, 48, 160, 160)
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(14 * 1.6, 15.8 * 1.6).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }),
  )
  shadow.position.set(-0.4, -0.91, -0.6)
  return shadow
}

export function createHouseScene(container: HTMLElement, initial: ScenarioId = 'A'): HouseScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  const pixelRatio = Math.min(window.devicePixelRatio, 2)
  renderer.setPixelRatio(pixelRatio)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.toneMapping = THREE.NeutralToneMapping
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = environment

  const hemi = new THREE.HemisphereLight()
  const key = new THREE.DirectionalLight()
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  Object.assign(key.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 60 })
  key.shadow.bias = -0.0005
  key.shadow.normalBias = 0.06
  scene.add(hemi, key, key.target, dropShadow())

  const diorama = buildDiorama()
  scene.add(diorama.root)
  const ambient = createAmbient(diorama)
  const weather = createWeather(diorama, pixelRatio)
  const lights = createHouseLights(diorama)
  const energy = createEnergy(diorama, pixelRatio)
  const effects = [weather.fx, lights.fx, energy.fx]
  scene.add(...effects)
  const sky = createSky()

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
  camera.position.set(
    TARGET.x + 60 * Math.cos(ELEVATION) * Math.sin(AZIMUTH),
    TARGET.y + 60 * Math.sin(ELEVATION),
    TARGET.z + 60 * Math.cos(ELEVATION) * Math.cos(AZIMUTH),
  )
  camera.lookAt(TARGET)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.copy(TARGET)
  controls.enablePan = false
  controls.enableDamping = true
  controls.minPolarAngle = 0.8
  controls.maxPolarAngle = 1.4
  controls.minZoom = 0.7
  controls.maxZoom = 2.5

  // Sky first, then the diorama over it; soft contact shadows; a glow on the brightest light.
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(sky.scene, sky.camera))
  const main = new RenderPass(scene, camera)
  main.clear = false
  main.clearDepth = true
  composer.addPass(main)
  const ao = new GTAOPass(scene, camera, 512, 512)
  ao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.4, thickness: 1.2, scale: 1.2, samples: 16 })
  ao.blendIntensity = 0.75
  // Rain, light pools and pulses are transparent: keep them out of the occlusion estimate.
  const renderAo = ao.render.bind(ao)
  ao.render = (...args: Parameters<GTAOPass['render']>) => {
    for (const group of effects) group.visible = false
    renderAo(...args)
    for (const group of effects) group.visible = true
  }
  composer.addPass(ao)
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.12, 0.6, 0.92)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  let aspect = 1
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container
    if (!w || !h) return
    renderer.setSize(w, h)
    composer.setPixelRatio(pixelRatio)
    composer.setSize(w, h)
    aspect = w / h
    const halfH = Math.max(FIT_HEIGHT / 2, FIT_WIDTH / 2 / aspect)
    Object.assign(camera, { top: halfH, bottom: -halfH, left: -halfH * aspect, right: halfH * aspect })
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  resize()

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reduced = motionQuery.matches
  const onMotionChange = (e: MediaQueryListEvent) => (reduced = e.matches)
  motionQuery.addEventListener('change', onMotionChange)

  // Scenario blending.
  let scenario = SCENARIOS[initial]
  const look = lookState(scenario.look)
  const from = lookState(scenario.look)
  let to: LookState = lookState(scenario.look)
  let clock = 0
  let blendFrom = -BLEND

  const keyDir = new THREE.Vector3()
  const applyLook = (flash: number) => {
    keyDir.set(look.keyDir[0], look.keyDir[1], look.keyDir[2]).normalize()
    key.position.copy(TARGET).addScaledVector(keyDir, 30)
    key.target.position.copy(TARGET)
    key.color.copy(look.keyColor)
    key.intensity = look.keyIntensity + flash * 1.5
    key.shadow.radius = look.shadowSoftness
    hemi.color.copy(look.hemiSky)
    hemi.groundColor.copy(look.hemiGround)
    hemi.intensity = look.hemiIntensity + flash * 2.2
    scene.environmentIntensity = look.environment
    renderer.toneMappingExposure = look.exposure
    bloom.strength = look.bloom + flash * 0.3
  }

  let elapsed = 0
  let last = performance.now()
  let frame = 0
  const tick = (now: number) => {
    frame = requestAnimationFrame(tick)
    // Blends follow real time even when frames are throttled; motion steps stay capped.
    clock += (now - last) / 1000
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    if (!reduced) elapsed += dt

    const k = reduced ? 1 : THREE.MathUtils.smootherstep(clock - blendFrom, 0, BLEND)
    mixLook(look, from, to, k)
    const flash = weather.update(look, elapsed, !reduced)
    applyLook(flash)
    lights.update(look, scenario, clock)
    energy.update(scenario, elapsed, reduced ? 1 : dt)
    ambient.update(elapsed, look)
    sky.update(look, elapsed, flash, aspect)

    controls.update()
    composer.render()
  }
  frame = requestAnimationFrame(tick)

  return {
    setScenario(id) {
      if (id === scenario.id) return
      mixLook(from, look, look, 0)
      to = lookState(SCENARIOS[id].look)
      scenario = SCENARIOS[id]
      blendFrom = clock
    },
    setReducedMotion(value) {
      reduced = value
    },
    dispose() {
      cancelAnimationFrame(frame)
      observer.disconnect()
      motionQuery.removeEventListener('change', onMotionChange)
      controls.dispose()
      weather.dispose()
      lights.dispose()
      energy.dispose()
      sky.dispose()
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.geometry.dispose()
        for (const material of ([] as THREE.Material[]).concat(mesh.material)) {
          ;(material as THREE.MeshStandardMaterial).map?.dispose()
          material.dispose()
        }
      })
      for (const pass of composer.passes) pass.dispose()
      composer.dispose()
      environment.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
