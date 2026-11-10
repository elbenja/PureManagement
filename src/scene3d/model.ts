import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// World layout (metres): +x faces the viewer's lower right, +z the lower left.
// Main house ridge runs along z; the garage wing crosses it along x.

const COLOR = {
  plinth: '#efe6d4',
  stucco: '#f0eadf',
  roofMain: '#8a847c',
  roofGarage: '#5f666e',
  fascia: '#4b4743',
  trim: '#7b5b44',
  sill: '#e4ddd1',
  glass: '#4d4844',
  door: '#8c5c3e',
  garageDoor: '#8d837a',
  concrete: '#d9d6cf',
  panel: '#3a4961',
  panelLine: '#9fadc2',
  panelFrame: '#c3c7cc',
  appliance: '#f7f6f3',
  led: '#5fe3a1',
  carBody: '#e6e8eb',
  carGlass: '#202328',
  carTrim: '#4a4d52',
  tire: '#2a2a2d',
  rim: '#c9ccd0',
  trunk: '#8a6a4f',
  canopy: '#dcb45c',
  wood: '#7d5b3f',
  transformer: '#9a9da2',
  lamp: '#b9773f',
  cable: '#34312f',
  grass: ['#e6bc58', '#efcb6a', '#d9ab45', '#e2b44f'],
  bush: ['#a8603f', '#b9744a', '#94553a', '#b3814b'],
}

const mat = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra })

/** A box with softly rounded edges (falls back to a sharp box when too thin to round). */
function box(w: number, h: number, d: number, material: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0, radius = 0.025) {
  const r = Math.min(radius, w * 0.45, h * 0.45, d * 0.45)
  const geometry = r > 0.004 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  return mesh
}

export function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function canvasTexture(width: number, height: number, draw: (g: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d')!)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  return texture
}

/** One shingle course: tabs every ~0.33 m along the course, each with a slight tint. */
const shingleTabs = (seed: number) =>
  canvasTexture(32, 256, (g) => {
    const random = seeded(seed)
    const tab = 256 / 6
    for (let i = 0; i < 6; i++) {
      const shade = 236 + Math.floor(random() * 20)
      g.fillStyle = `rgb(${shade},${shade},${shade})`
      g.fillRect(0, i * tab, 32, tab)
      g.fillStyle = 'rgba(0,0,0,0.28)'
      g.fillRect(0, i * tab, 32, 3)
    }
  })

const solarCells = () =>
  canvasTexture(128, 192, (g) => {
    g.fillStyle = COLOR.panel
    g.fillRect(0, 0, 128, 192)
    g.fillStyle = COLOR.panelLine
    for (let i = 1; i < 6; i++) g.fillRect((i * 128) / 6 - 0.5, 0, 1, 192)
    for (let i = 1; i < 10; i++) g.fillRect(0, (i * 192) / 10 - 0.5, 128, 1)
    g.strokeStyle = COLOR.panelFrame
    g.lineWidth = 5
    g.strokeRect(0, 0, 128, 192)
  })

const woodGrain = () =>
  canvasTexture(128, 128, (g) => {
    const random = seeded(7)
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, 128, 128)
    for (let i = 0; i < 46; i++) {
      g.fillStyle = `rgba(55,32,14,${0.06 + random() * 0.16})`
      g.fillRect(random() * 128, 0, 0.6 + random() * 2.6, 128)
    }
  })

// ---------------------------------------------------------------------------
// House wings

const WALL_H = 2.8
const EAVE = 0.45
const GABLE = 0.35
const ROOF_T = 0.14
const COURSE = 0.3
const STEP = 0.035
const WALL_BEVEL = 0.05

interface Wing {
  group: THREE.Group
  roofMaterials: THREE.MeshStandardMaterial[]
  /** Front slope frame: +x runs from the ridge to the eave, the shingle surface is at y ≈ ROOF_T + 0.08. */
  frontSlope: THREE.Group
}

function buildSlope(slopeLen: number, depth: number, base: THREE.Material, courses: THREE.Material[][], gutter: THREE.Material) {
  const slope = new THREE.Group()
  slope.add(box(slopeLen, ROOF_T, depth, base, slopeLen / 2, ROOF_T / 2, 0, 0.04))

  // Overlapping courses, each tipped up at its lower edge so the roof reads as stepped shingles.
  const count = Math.round(slopeLen / COURSE)
  const width = slopeLen / count
  const length = width * 1.2
  for (let i = 0; i < count; i++) {
    const course = new THREE.Group()
    course.position.set(i * width, ROOF_T, 0)
    course.rotation.z = Math.atan2(STEP, length)
    course.add(box(length, 0.04, depth - 0.02, courses[i % courses.length], length / 2, 0.02, 0, 0.012))
    slope.add(course)
  }
  slope.add(box(0.1, 0.12, depth, gutter, slopeLen + 0.03, 0.04, 0, 0.04))
  return slope
}

function buildWing(width: number, length: number, rise: number, roofColor: string, walls: THREE.Material, m: Materials): Wing {
  const group = new THREE.Group()
  const hw = width / 2

  const profile = new THREE.Shape()
  profile.moveTo(-hw, 0)
  profile.lineTo(hw, 0)
  profile.lineTo(hw, WALL_H)
  profile.lineTo(0, WALL_H + rise)
  profile.lineTo(-hw, WALL_H)
  profile.closePath()
  // Bevel inward so the outer faces stay exactly where details are mounted.
  const shell = new THREE.ExtrudeGeometry(profile, {
    depth: length - 2 * WALL_BEVEL,
    bevelEnabled: true,
    bevelThickness: WALL_BEVEL,
    bevelSize: WALL_BEVEL,
    bevelOffset: -WALL_BEVEL,
    bevelSegments: 3,
  })
  shell.translate(0, 0, -length / 2 + WALL_BEVEL)
  group.add(new THREE.Mesh(shell, walls))

  const angle = Math.atan2(rise, hw)
  const slopeLen = Math.hypot(rise, hw) + EAVE
  const depth = length + 2 * GABLE
  const courseMaterials = [0, 1].map((n) => {
    const map = shingleTabs(n + 1)
    map.repeat.set(1, depth / 2)
    const top = mat(roofColor, { map, roughness: 0.9 })
    const edge = mat(new THREE.Color(roofColor).multiplyScalar(0.62).getStyle(), { roughness: 0.9 })
    return [edge, top, top, top, top, top]
  })

  const slopes = [0, Math.PI].map((turn) => {
    const ridge = new THREE.Group()
    ridge.position.set(0, WALL_H + rise, 0)
    ridge.rotation.y = turn
    const frame = new THREE.Group()
    frame.rotation.z = -angle
    frame.add(buildSlope(slopeLen, depth, m.fascia, courseMaterials, m.fascia))
    ridge.add(frame)
    group.add(ridge)
    return frame
  })
  group.add(box(0.34, 0.16, depth + 0.04, m.fascia, 0, WALL_H + rise + ROOF_T + 0.1, 0, 0.06))

  return { group, frontSlope: slopes[0], roofMaterials: courseMaterials.flatMap(([edge, top]) => [edge, top]) as THREE.MeshStandardMaterial[] }
}

// ---------------------------------------------------------------------------
// Walls with openings
//
// The visible walls get a stucco skin with real openings cut into it, so
// windows and doors sit recessed inside the wall instead of on its surface.

const FACADE = 0.14

interface Face {
  axis: 'x' | 'z'
  /** Outer surface of the stucco skin. */
  at: number
}

const MAIN_FRONT: Face = { axis: 'x', at: 1.5 + FACADE }
const MAIN_SIDE: Face = { axis: 'z', at: 6 + FACADE }
const GARAGE_FRONT: Face = { axis: 'x', at: 3 + FACADE }
const GARAGE_SIDE: Face = { axis: 'z', at: -1.5 + FACADE }

/** A box against a wall face, `inset` metres behind its outer surface (negative = in front). `u` runs along the wall. */
function onFace(
  face: Face,
  u: number,
  y: number,
  w: number,
  h: number,
  depth: number,
  material: THREE.Material | THREE.Material[],
  inset = 0,
) {
  const n = face.at - inset + depth / 2
  return face.axis === 'x' ? box(depth, h, w, material, n, y, u) : box(w, h, depth, material, u, y, n)
}

type Pt = [u: number, y: number]
type Rect = [u0: number, u1: number, y0: number, y1: number]

/** The stucco skin for one face: `outline` in (u, y), with `holes` cut through it. */
function facade(face: Face, outline: Pt[], holes: Rect[], material: THREE.Material) {
  // x faces are drawn mirrored and turned a quarter, so +u ends up along world +z.
  const flip = face.axis === 'x' ? -1 : 1
  const point = ([u, y]: Pt) => new THREE.Vector2(flip * u, y)
  const shape = new THREE.Shape(outline.map(point))
  for (const [u0, u1, y0, y1] of holes) {
    shape.holes.push(new THREE.Path(([[u0, y0], [u1, y0], [u1, y1], [u0, y1]] as Pt[]).map(point)))
  }
  const bevel = 0.025
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: FACADE - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 2,
  })
  geometry.translate(0, 0, bevel)
  const mesh = new THREE.Mesh(geometry, material)
  if (face.axis === 'x') {
    mesh.rotation.y = Math.PI / 2
    mesh.position.x = face.at - FACADE
  } else {
    mesh.position.z = face.at - FACADE
  }
  return mesh
}

const WINDOW_FRONT: Rect = [3.6, 5.0, 0.85, 2.15]
const WINDOW_NARROW: Rect = [2.375, 2.925, 0.65, 2.15]
const WINDOW_SIDE: Rect = [-3.5, -2.3, 0.85, 2.15]
const FRONT_DOOR: Rect = [0.72, 1.68, 0, 2.18]
const GARAGE_DOOR: Rect = [-5.7, -2.3, 0, 2.26]

/** A point on a wall face and the direction the face looks. */
export interface Anchor {
  position: THREE.Vector3
  facing: THREE.Vector3
  width: number
}

const anchorOn = (face: Face, u: number, y: number, out = 0, width = 0): Anchor =>
  face.axis === 'x'
    ? { position: new THREE.Vector3(face.at + out, y, u), facing: new THREE.Vector3(1, 0, 0), width }
    : { position: new THREE.Vector3(u, y, face.at + out), facing: new THREE.Vector3(0, 0, 1), width }

function buildHouse(m: Materials) {
  const house = new THREE.Group()
  const walls = mat(COLOR.stucco, { roughness: 0.95 })

  const main = buildWing(6, 7.5, 2.1, COLOR.roofMain, walls, m)
  main.group.position.set(-1.5, 0, 2.25)
  house.add(main.group)

  const garage = buildWing(5, 7.5, 1.7, COLOR.roofGarage, walls, m)
  garage.group.position.set(-0.75, 0, -4)
  garage.group.rotation.y = Math.PI / 2
  house.add(garage.group)

  // Stucco skins. Doors are notches in the outline; windows are holes.
  const [d0, d1, , dTop] = FRONT_DOOR
  house.add(facade(MAIN_FRONT, [[-1.5, 0], [d0, 0], [d0, dTop], [d1, dTop], [d1, 0], [6 + FACADE, 0], [6 + FACADE, 2.8], [-1.5, 2.8]], [WINDOW_FRONT, WINDOW_NARROW], walls))
  house.add(facade(MAIN_SIDE, [[-4.5, 0], [1.5, 0], [1.5, 2.8], [-1.5, 4.9], [-4.5, 2.8]], [WINDOW_SIDE], walls))
  const [g0, g1, , gTop] = GARAGE_DOOR
  house.add(facade(GARAGE_FRONT, [[-6.5, 0], [g0, 0], [g0, gTop], [g1, gTop], [g1, 0], [-1.5 + FACADE, 0], [-1.5 + FACADE, 2.8], [-4, 4.5], [-6.5, 2.8]], [], walls))
  house.add(facade(GARAGE_SIDE, [[1.5 + FACADE, 0], [3, 0], [3, 2.8], [1.5 + FACADE, 2.8]], [], walls))

  // Solar array: 3 rows × 6 panels on rails above the main roof's front slope.
  const panelMaterials = [m.frame, m.frame, m.cells, m.frame, m.frame, m.frame]
  const solar = new THREE.Group()
  const top = ROOF_T + 0.075
  for (let r = 0; r < 3; r++) {
    const u = 0.95 + r * 1.06
    for (const offset of [-0.3, 0.3]) solar.add(box(0.05, 0.07, 6.8, m.fascia, u + offset, top + 0.035, 0, 0.01))
    for (let c = 0; c < 6; c++) {
      solar.add(box(1.0, 0.05, 1.08, panelMaterials, u, top + 0.095, (c - 2.5) * 1.12, 0.012))
    }
  }
  main.frontSlope.add(solar)

  /** Frame lining the sides (and top, and optionally bottom) of an opening, set just behind the wall surface. */
  const FRAME = 0.06
  const lineOpening = (face: Face, [u0, u1, y0, y1]: Rect, bottom: boolean) => {
    const u = (u0 + u1) / 2
    const y = (y0 + y1) / 2
    const depth = FACADE - 0.03
    house.add(onFace(face, u, y1 - FRAME / 2, u1 - u0, FRAME, depth, m.trim, FACADE))
    if (bottom) house.add(onFace(face, u, y0 + FRAME / 2, u1 - u0, FRAME, depth, m.trim, FACADE))
    house.add(onFace(face, u0 + FRAME / 2, y, FRAME, y1 - y0, depth, m.trim, FACADE))
    house.add(onFace(face, u1 - FRAME / 2, y, FRAME, y1 - y0, depth, m.trim, FACADE))
  }
  const windows: Anchor[] = []
  const lamps: Anchor[] = []
  const addWindow = (face: Face, rect: Rect) => {
    const [u0, u1, y0, y1] = rect
    const u = (u0 + u1) / 2
    const y = (y0 + y1) / 2
    windows.push(anchorOn(face, u, y, 0, u1 - u0))
    lineOpening(face, rect, true)
    house.add(onFace(face, u, y, u1 - u0 - 2 * FRAME, y1 - y0 - 2 * FRAME, 0.03, m.glass, FACADE))
    house.add(onFace(face, u, y, 0.05, y1 - y0, 0.06, m.trim, FACADE))
    house.add(onFace(face, u, y0 - 0.03, u1 - u0 + 0.24, 0.06, 0.08, m.sill))
  }
  const lamp = (face: Face, u: number, y: number) => {
    house.add(onFace(face, u, y, 0.14, 0.26, 0.12, m.lamp))
    lamps.push(anchorOn(face, u, y, 0.14))
  }

  // Front of the main house: window, narrow window, recessed door, step, lamp.
  addWindow(MAIN_FRONT, WINDOW_FRONT)
  addWindow(MAIN_FRONT, WINDOW_NARROW)
  lineOpening(MAIN_FRONT, FRONT_DOOR, false)
  house.add(onFace(MAIN_FRONT, (d0 + d1) / 2, (dTop - FRAME) / 2, d1 - d0 - 2 * FRAME, dTop - FRAME, 0.05, m.door, FACADE))
  house.add(onFace(MAIN_FRONT, d0 + 0.2, 1.05, 0.05, 0.05, 0.06, m.rim, FACADE - 0.05))
  house.add(box(0.5, 0.12, 1.4, m.concrete, MAIN_FRONT.at + 0.25, 0.06, 1.2))
  lamp(MAIN_FRONT, 2.05, 1.95)

  // Gable side of the main house: window, AC unit, home battery.
  addWindow(MAIN_SIDE, WINDOW_SIDE)
  house.add(onFace(MAIN_SIDE, -1.2, 1.3, 0.945, 0.65, 0.357, m.appliance))
  for (let i = 0; i < 4; i++) house.add(onFace(MAIN_SIDE, -1.2, 1.111 + i * 0.126, 0.735, 0.032, 0.367, m.fascia))

  const battery = new THREE.Group()
  battery.name = 'battery'
  battery.add(onFace(MAIN_SIDE, 0.55, 0.76, 0.79, 1.42, 0.25, m.appliance))
  battery.add(box(0.95, 0.05, 0.55, m.concrete, 0.55, 0.025, MAIN_SIDE.at + 0.27))
  battery.add(onFace(MAIN_SIDE, 0.55, 1.85, 0.06, 0.9, 0.05, m.fascia))
  house.add(battery)

  // Garage: recessed door with grooves, lamps, gable vent.
  lineOpening(GARAGE_FRONT, GARAGE_DOOR, false)
  const gu = (g0 + g1) / 2
  house.add(onFace(GARAGE_FRONT, gu, (gTop - FRAME) / 2, g1 - g0 - 2 * FRAME, gTop - FRAME, 0.05, m.garageDoor, FACADE))
  for (let i = 1; i < 5; i++) house.add(onFace(GARAGE_FRONT, gu, i * 0.44, g1 - g0 - 2 * FRAME, 0.035, 0.02, m.groove, FACADE - 0.05))
  lamp(GARAGE_FRONT, -6.1, 2.0)
  lamp(GARAGE_FRONT, -1.9, 2.0)
  house.add(onFace(GARAGE_FRONT, -4, 3.45, 0.9, 0.18, 0.05, m.sill))

  // EV charger on the short garage wall facing the car.
  const charger = new THREE.Group()
  charger.name = 'evCharger'
  charger.add(onFace(GARAGE_SIDE, 2.3, 1.15, 0.38, 0.5, 0.14, m.appliance))
  charger.add(onFace(GARAGE_SIDE, 2.3, 1.28, 0.16, 0.03, 0.01, m.chargerLed, -0.14))
  charger.add(onFace(GARAGE_SIDE, 2.3, 0.98, 0.12, 0.16, 0.06, m.tire, -0.12))
  house.add(charger)

  return {
    house,
    walls,
    roofMaterials: [...main.roofMaterials, ...garage.roofMaterials],
    windows,
    lamps,
    /** Center of the battery cabinet's front face. */
    batteryFace: anchorOn(MAIN_SIDE, 0.55, 0.76, 0.25),
  }
}

// ---------------------------------------------------------------------------
// Car: a compact electric hatchback, nose toward +x. The body is lofted from
// rounded cross-sections, so it curves in plan, in profile and in section.

const CAR_POSITION = new THREE.Vector3(4.65, 0, 0.55)
const CAR_HALF_LENGTH = 1.97
const CAR_HALF_WIDTH = 0.88
const WHEEL_X = 1.25
const WHEEL_R = 0.36
const ARCH_R = 0.44
const SECTION = 4 // superellipse exponent: higher = squarer cross-section

type Key = [x: number, y: number]
const ROOF_LINE: Key[] = [
  [-1.97, 0.55], [-1.94, 0.8], [-1.88, 1.05], [-1.75, 1.28], [-1.5, 1.44], [-1.1, 1.5], [-0.5, 1.5],
  [0, 1.42], [0.3, 1.25], [0.7, 1.0], [1.0, 0.95], [1.5, 0.88], [1.8, 0.8], [1.92, 0.7], [1.97, 0.5],
]
const FLOOR_LINE: Key[] = [[-1.97, 0.46], [-1.9, 0.3], [-1.75, 0.25], [1.75, 0.25], [1.9, 0.3], [1.97, 0.44]]

/** Smooth curve through the keys (Catmull-Rom on y). */
function profile(keys: Key[], x: number) {
  let i = 0
  while (i < keys.length - 2 && x > keys[i + 1][0]) i++
  const [x1, y1] = keys[i]
  const [x2, y2] = keys[i + 1]
  const y0 = (keys[i - 1] ?? keys[i])[1]
  const y3 = (keys[i + 2] ?? keys[i + 1])[1]
  const t = THREE.MathUtils.clamp((x - x1) / (x2 - x1), 0, 1)
  return 0.5 * (2 * y1 + (y2 - y0) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t * t + (3 * y1 - y0 - 3 * y2 + y3) * t * t * t)
}

const carTop = (x: number) => profile(ROOF_LINE, x)

function carBottom(x: number) {
  let y = profile(FLOOR_LINE, x)
  for (const wx of [WHEEL_X, -WHEEL_X]) {
    const d = Math.abs(x - wx)
    if (d < ARCH_R) y = Math.max(y, WHEEL_R + Math.sqrt(ARCH_R * ARCH_R - d * d))
  }
  return y
}

const halfWidthAt = (x: number) =>
  CAR_HALF_WIDTH * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(x) / CAR_HALF_LENGTH, 5)), 1 / 5)
const beltAt = (x: number) => 0.98 + Math.max(0, -x) * 0.03

/** The cabin narrows above the belt line (tumblehome). */
function taper(x: number, y: number) {
  const belt = beltAt(x)
  if (y <= belt) return 1
  return 1 - 0.2 * THREE.MathUtils.smoothstep(y, belt, Math.max(belt + 0.01, carTop(x)))
}

const signedPow = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e)

function carPoint(x: number, v: number, out: THREE.Vector3) {
  const top = carTop(x)
  const bottom = carBottom(x)
  const y = (top + bottom) / 2 + ((top - bottom) / 2) * signedPow(Math.sin(v), 2 / SECTION)
  const z = halfWidthAt(x) * signedPow(Math.cos(v), 2 / SECTION) * taper(x, y)
  return out.set(x, y, z)
}

/** Half-width of the body surface at length x and height y (0 when outside). */
function sideZ(x: number, y: number) {
  const top = carTop(x)
  const bottom = carBottom(x)
  const r = Math.abs(y - (top + bottom) / 2) / ((top - bottom) / 2)
  if (r >= 1) return 0
  return halfWidthAt(x) * taper(x, y) * Math.pow(1 - Math.pow(r, SECTION), 1 / SECTION)
}

/** Length position of the nose (dir 1) or tail (dir -1) surface at height y and lateral offset z. */
function endX(y: number, z: number, dir: 1 | -1) {
  let inner = 0.9
  let outer = CAR_HALF_LENGTH
  for (let i = 0; i < 30; i++) {
    const mid = (inner + outer) / 2
    if (sideZ(dir * mid, y) > Math.abs(z)) inner = mid
    else outer = mid
  }
  return dir * inner
}

/**
 * Car paint decided per pixel from the body's local position and normal, so window
 * and trim edges stay crisp at any zoom: glass above the belt line, a body-colored
 * roof and C-pillar, dark trim on the arches, sills, grille, bumpers and underside.
 */
function carBodyMaterial() {
  const f = (n: number) => n.toFixed(3)
  const material = new THREE.MeshPhysicalMaterial({ roughness: 0.32, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.1 })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPaint = { value: new THREE.Color(COLOR.carBody) }
    shader.uniforms.uGlass = { value: new THREE.Color(COLOR.carGlass) }
    shader.uniforms.uTrim = { value: new THREE.Color(COLOR.carTrim) }
    shader.vertexShader = 'varying vec3 vCarPos;\nvarying vec3 vCarNormal;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvCarPos = position;\nvCarNormal = normal;',
    )
    shader.fragmentShader =
      /* glsl */ `
      varying vec3 vCarPos;
      varying vec3 vCarNormal;
      uniform vec3 uPaint;
      uniform vec3 uGlass;
      uniform vec3 uTrim;
      float carArchBottom(float x) {
        float b = 0.25;
        for (int i = 0; i < 2; i++) {
          float d = abs(x - (i == 0 ? ${f(WHEEL_X)} : -${f(WHEEL_X)}));
          if (d < ${f(ARCH_R)}) b = max(b, ${f(WHEEL_R)} + sqrt(${f(ARCH_R * ARCH_R)} - d * d));
        }
        return b;
      }
      ` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          /* glsl */ `#include <color_fragment>
          vec3 carP = vCarPos;
          vec3 carN = normalize(vCarNormal);
          float belt = 0.98 + max(0.0, -carP.x) * 0.03;
          float trimMask = 0.0;
          float glassMask = 0.0;
          if (carN.y < -0.6) trimMask = 1.0;
          if (carP.y < carArchBottom(carP.x) + 0.07 && abs(abs(carP.x) - ${f(WHEEL_X)}) < ${f(ARCH_R + 0.05)}) trimMask = 1.0;
          if (carP.y < 0.36 && abs(carP.x) < ${f(WHEEL_X)} && abs(carN.z) > 0.3) trimMask = 1.0;
          if (carP.x > 1.72 && carP.y > 0.5 && carP.y < 0.62) trimMask = 1.0;
          if (abs(carP.x) > 1.86 && carP.y < 0.47) trimMask = 1.0;
          if (carP.y > belt + 0.015) {
            if (carP.x > -0.02) glassMask = 1.0;
            else if (carP.x > -1.48) glassMask = carN.y < 0.85 ? 1.0 : 0.0;
            else if (carP.x < -1.62 && carP.y > belt + 0.1 && abs(carN.z) < 0.6) glassMask = 1.0;
          }
          diffuseColor.rgb = mix(mix(uPaint, uTrim, trimMask), uGlass, glassMask);`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          '#include <roughnessmap_fragment>\nroughnessFactor = mix(mix(roughnessFactor, 0.6, trimMask), 0.12, glassMask);',
        )
  }
  return material
}

function carBodyGeometry() {
  const U = 140
  const V = 96
  const positions: number[] = []
  const indices: number[] = []
  const p = new THREE.Vector3()
  const q = new THREE.Vector3()
  const DENSE = 480
  const arc = new Float32Array(DENSE + 1)
  for (let i = 0; i <= U; i++) {
    const x = CAR_HALF_LENGTH * Math.sin((i / U - 0.5) * Math.PI) // denser near the nose and tail
    // Space the section's vertices evenly by arc length, so window edges stay crisp.
    carPoint(x, 0, q)
    for (let k = 1; k <= DENSE; k++) {
      carPoint(x, (k / DENSE) * Math.PI * 2, p)
      arc[k] = arc[k - 1] + p.distanceTo(q)
      q.copy(p)
    }
    const total = arc[DENSE]
    let k = 0
    for (let j = 0; j < V; j++) {
      let v = (j / V) * Math.PI * 2
      if (total > 1e-5) {
        const target = (j / V) * total
        while (k < DENSE - 1 && arc[k + 1] < target) k++
        const f = (target - arc[k]) / Math.max(1e-9, arc[k + 1] - arc[k])
        v = ((k + f) / DENSE) * Math.PI * 2
      }
      carPoint(x, v, p)
      positions.push(p.x, p.y, p.z)
    }
  }
  for (let i = 0; i < U; i++) {
    for (let j = 0; j < V; j++) {
      const a = i * V + j
      const b = i * V + ((j + 1) % V)
      const c = (i + 1) * V + j
      const d = (i + 1) * V + ((j + 1) % V)
      indices.push(a, c, b, b, c, d)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** A light strip that wraps around the nose or tail at height y. */
function lightBar(y: number, dir: 1 | -1, halfSpan: number, radius: number, material: THREE.Material) {
  const points: THREE.Vector3[] = []
  for (let k = 0; k <= 16; k++) {
    const z = -halfSpan + (2 * halfSpan * k) / 16
    points.push(new THREE.Vector3(endX(y, z, dir), y, z))
  }
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 40, radius, 6), material)
}

const CHARGE_PORT = new THREE.Vector3(-1.5, 0.9, -(sideZ(-1.5, 0.9) + 0.004))

function buildCar(m: Materials) {
  const car = new THREE.Group()
  car.name = 'ev'
  car.add(new THREE.Mesh(carBodyGeometry(), m.carBody))
  car.add(box(3.3, 0.22, 1.3, m.carTrim, 0, 0.36, 0, 0.05)) // chassis between the wheels

  car.add(lightBar(0.69, 1, 0.58, 0.022, m.headlight))
  car.add(lightBar(1.0, -1, 0.64, 0.026, m.taillight))
  for (const s of [1, -1]) {
    car.add(box(0.17, 0.09, 0.12, m.carTrim, 0.62, 1.04, s * (sideZ(0.62, 1.0) + 0.05), 0.035))
  }
  car.add(box(0.12, 0.09, 0.02, m.carTrim, CHARGE_PORT.x, CHARGE_PORT.y, CHARGE_PORT.z, 0.008))

  // Rounded tires with five-spoke aero rims.
  const tire = new THREE.TorusGeometry(WHEEL_R - 0.1, 0.1, 12, 32).scale(1, 1, 1.25)
  const rim = new THREE.CylinderGeometry(0.26, 0.26, 0.2, 28).rotateX(Math.PI / 2)
  const spoke = new THREE.BoxGeometry(0.05, 0.22, 0.04).translate(0, 0.11, 0)
  for (const x of [WHEEL_X, -WHEEL_X]) {
    for (const s of [1, -1]) {
      const wheel = new THREE.Group()
      wheel.position.set(x, WHEEL_R, s * (CAR_HALF_WIDTH - 0.14))
      wheel.add(new THREE.Mesh(tire, m.carTire), new THREE.Mesh(rim, m.carTrim))
      for (let k = 0; k < 5; k++) {
        const arm = new THREE.Mesh(spoke, m.carRim)
        arm.position.z = s * 0.1
        arm.rotation.z = (k / 5) * Math.PI * 2 + x
        wheel.add(arm)
      }
      car.add(wheel)
    }
  }

  car.position.copy(CAR_POSITION)
  return car
}

function buildChargeCable(m: Materials) {
  const port = CHARGE_PORT.clone().add(CAR_POSITION)
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.3, 0.92, GARAGE_SIDE.at + 0.17),
    new THREE.Vector3(2.38, 0.35, GARAGE_SIDE.at + 0.3),
    new THREE.Vector3(2.7, 0.05, -0.9),
    new THREE.Vector3(3.0, 0.1, -0.6),
    new THREE.Vector3(port.x - 0.05, 0.55, port.z - 0.08),
    port,
  ])
  return { mesh: new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.025, 6), m.chargeCable), curve }
}

// ---------------------------------------------------------------------------
// Grid connection: wooden pole, crossarms, pole-top transformer, service drop.

function stick(from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material, taper = 0.75) {
  const dir = new THREE.Vector3().subVectors(to, from)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * taper, radius, dir.length(), 10), material)
  mesh.position.copy(from).addScaledVector(dir, 0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  return mesh
}

function buildGridConnection(m: Materials) {
  const grid = new THREE.Group()
  grid.name = 'grid'
  const base = new THREE.Vector3(3.9, 0, -7.2)
  const at = (dx: number, y: number, dz = 0) => new THREE.Vector3(base.x + dx, y, base.z + dz)

  grid.add(stick(base, at(0, 6.9), 0.24, m.pole, 0.78))
  grid.add(box(0.34, 0.1, 0.34, m.poleArm, base.x, 6.93, base.z, 0.03))
  for (const y of [6.3, 5.7]) {
    grid.add(box(2.0, 0.17, 0.17, m.poleArm, base.x, y, base.z + 0.2, 0.03))
    for (const s of [-1, 1]) grid.add(stick(at(s * 0.7, y - 0.05, 0.2), at(0, y - 0.75, 0.18), 0.035, m.cable, 1))
  }
  for (const dx of [-0.75, 0, 0.75]) {
    const insulator = new THREE.Group()
    insulator.position.copy(at(dx, 6.44, 0.2))
    insulator.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.18, 10), m.insulator))
    for (const y of [-0.03, 0.04]) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.025, 12), m.insulator)
      disc.position.y = y
      insulator.add(disc)
    }
    grid.add(insulator)
  }

  // Pole-top transformer, bolted on with a bracket.
  const can = new THREE.Group()
  can.position.copy(at(-0.5, 4.75))
  can.add(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.78, 20), m.transformer))
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.transformer)
  lid.scale.y = 0.35
  lid.position.y = 0.39
  can.add(lid)
  can.add(box(0.06, 0.16, 0.06, m.insulator, 0.08, 0.53, 0, 0.02))
  can.add(box(0.26, 0.42, 0.06, m.cable, 0.26, 0, 0, 0.02))
  grid.add(can)
  grid.add(stick(at(-0.42, 5.3), at(-0.75, 6.42, 0.2), 0.012, m.cable, 1))

  // Service mast on the garage roof and the drop line to it.
  const mastTop = new THREE.Vector3(2.4, 3.9, -6.3)
  grid.add(stick(new THREE.Vector3(2.4, 2.9, -6.3), mastTop, 0.04, m.fascia, 1))
  const from = at(-0.75, 6.52, 0.2)
  const sag = from.clone().lerp(mastTop, 0.5)
  sag.y -= 0.35
  const dropCurve = new THREE.CatmullRomCurve3([from, sag, mastTop])
  grid.add(new THREE.Mesh(new THREE.TubeGeometry(dropCurve, 24, 0.02, 6), m.cable))

  // Street lamp on the pole, reaching out over the driveway.
  const reach = new THREE.Vector3(0.32, 0, 0.95)
  const head = at(0, 5.2).addScaledVector(reach, 1.38)
  grid.add(stick(at(0, 5.0), head, 0.035, m.transformer, 1))
  const lampHead = new THREE.Group()
  lampHead.position.copy(head)
  lampHead.rotation.y = -Math.atan2(reach.z, reach.x)
  lampHead.add(box(0.52, 0.12, 0.24, m.transformer, 0.14, 0, 0, 0.05))
  lampHead.add(box(0.36, 0.03, 0.17, m.streetLens, 0.16, -0.065, 0, 0.012))
  grid.add(lampHead)

  return {
    grid,
    dropCurve,
    transformer: at(-0.5, 5.3),
    street: { head: head.clone().addScaledVector(reach, 0.16).setY(head.y - 0.1), target: new THREE.Vector3(5.0, 0, -4.2) },
  }
}

// ---------------------------------------------------------------------------
// Trees, grass and bushes

type Blob = [dx: number, dy: number, dz: number, r: number]

function buildTree(x: number, z: number, scale: number, trunkH: number, blobs: Blob[], m: Materials) {
  const tree = new THREE.Group()
  tree.position.set(x, 0, z)
  tree.scale.setScalar(scale)
  const top = new THREE.Vector3(0, trunkH, 0)
  tree.add(stick(new THREE.Vector3(), top, 0.12, m.trunk))
  for (const [dx, dy, dz, r] of blobs) {
    const center = new THREE.Vector3(dx, dy, dz)
    tree.add(stick(top, center, 0.06, m.trunk))
    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m.canopy)
    canopy.position.copy(center)
    canopy.scale.y = 0.94
    tree.add(canopy)
  }
  return tree
}

// [xMin, xMax, zMin, zMax] areas that stay clear of grass.
const BLOCKED: [number, number, number, number][] = [
  [-4.6, 1.75, -1.6, 6.3],
  [0.0, 1.1, 5.9, 6.85],
  [1.5, 2.2, 0.45, 1.95],
  [-4.6, 3.25, -6.6, -1.25],
  [2.9, 7, -6.05, -1.95],
  [2.5, 7, -0.55, 1.65],
  [1.5, 3.4, -1.45, -0.2],
]
export const PLINTH = { x: 7, z: 7.9 }

function isOpenGround(x: number, z: number) {
  if (Math.abs(x) > PLINTH.x - 0.25 || Math.abs(z) > PLINTH.z - 0.25) return false
  return !BLOCKED.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1)
}

/** A clump of blades. Each blade is drawn with both windings and an upward normal, so it lights evenly. */
function clumpGeometry(random: () => number, blades: number, radius: number, minH: number, maxH: number, splay: number) {
  const positions: number[] = []
  for (let i = 0; i < blades; i++) {
    const a = random() * Math.PI * 2
    const r = Math.sqrt(random()) * radius
    const ox = Math.cos(a) * r
    const oz = Math.sin(a) * r
    const h = minH + random() * (maxH - minH)
    const facing = random() * Math.PI
    const dx = Math.cos(facing) * 0.025
    const dz = Math.sin(facing) * 0.025
    const tip = [ox * splay, h, oz * splay]
    positions.push(ox - dx, 0, oz - dz, ox + dx, 0, oz + dz, ...tip, ox + dx, 0, oz + dz, ox - dx, 0, oz - dz, ...tip)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  const normals = new Float32Array(positions.length)
  const shades = new Float32Array(positions.length)
  for (let i = 0; i < positions.length; i += 3) {
    normals[i + 1] = 1
    // Darker at the root, sunlit at the tip.
    shades.fill(positions[i + 1] > 0 ? 1.15 : 0.7, i, i + 3)
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(shades, 3))
  return geometry
}

function windMaterial(time: { value: number }, wind: { value: number }) {
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, vertexColors: true })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time
    shader.uniforms.uWind = wind
    shader.vertexShader = 'uniform float uTime;\nuniform float uWind;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      /* glsl */ `
      vec4 mvPosition = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      float bend = position.y * position.y;
      float gust = sin( uTime * 1.7 + mvPosition.x * 0.55 + mvPosition.z * 0.35 )
                 + 0.5 * sin( uTime * 0.9 - mvPosition.x * 0.2 );
      mvPosition.x += gust * 0.22 * bend * uWind;
      mvPosition.z -= gust * 0.12 * bend * uWind;
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;
      `,
    )
  }
  return material
}

function scatter(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  spots: { x: number; z: number }[],
  palette: string[],
  scale: [number, number],
  random: () => number,
) {
  const mesh = new THREE.InstancedMesh(geometry, material, spots.length)
  const matrix = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const color = new THREE.Color()
  const up = new THREE.Vector3(0, 1, 0)
  spots.forEach(({ x, z }, i) => {
    const s = scale[0] + random() * (scale[1] - scale[0])
    q.setFromAxisAngle(up, random() * Math.PI * 2)
    matrix.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s, s))
    mesh.setMatrixAt(i, matrix)
    mesh.setColorAt(i, color.set(palette[Math.floor(random() * palette.length)]))
  })
  mesh.receiveShadow = true
  return mesh
}

function buildGrass(material: THREE.Material) {
  const random = seeded(2026)

  // Golden grass in dense patches.
  const grassSpots: { x: number; z: number }[] = []
  while (grassSpots.length < 950) {
    const cx = (random() * 2 - 1) * PLINTH.x
    const cz = (random() * 2 - 1) * PLINTH.z
    const count = 14 + Math.floor(random() * 20)
    const spread = 0.5 + random() * 0.7
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(-2 * Math.log(random() + 1e-6)) * spread
      const a = random() * Math.PI * 2
      const x = cx + Math.cos(a) * r
      const z = cz + Math.sin(a) * r
      if (isOpenGround(x, z)) grassSpots.push({ x, z })
    }
  }
  const grass = scatter(clumpGeometry(random, 16, 0.16, 0.22, 0.46, 1.9), material, grassSpots, COLOR.grass, [0.75, 1.25], random)
  grass.name = 'grass'

  // Rusty bushes along the visible walls and front edges, plus a few strays.
  const bushSpots: { x: number; z: number }[] = []
  const tryBush = (x: number, z: number) => isOpenGround(x, z) && bushSpots.push({ x, z })
  for (let x = -4.2; x < 0; x += 0.55) tryBush(x + random() * 0.2, 6.6 + random() * 0.3)
  for (let z = 2.1; z < 5.9; z += 0.55) tryBush(2.1 + random() * 0.3, z + random() * 0.2)
  for (let z = 1.9; z < 7.5; z += 1.1) tryBush(6.55 - random() * 0.4, z + random() * 0.3)
  for (let x = -6.5; x < 6.6; x += 1.2) tryBush(x + random() * 0.3, 7.45 - random() * 0.4)
  while (bushSpots.length < 75) tryBush((random() * 2 - 1) * PLINTH.x, (random() * 2 - 1) * PLINTH.z)
  const bushes = scatter(clumpGeometry(random, 36, 0.26, 0.28, 0.6, 1.6), material, bushSpots, COLOR.bush, [0.85, 1.3], random)
  bushes.name = 'bushes'

  return [grass, bushes]
}

/** Solar cells with a slow sheen sweeping across them, as strong as the solar output. */
function solarCellsMaterial(time: { value: number }, solar: { value: number }) {
  const material = new THREE.MeshPhysicalMaterial({ map: solarCells(), roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.15 })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time
    shader.uniforms.uSolar = solar
    shader.vertexShader = 'varying vec3 vSolarPos;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvSolarPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    )
    shader.fragmentShader = 'uniform float uTime;\nuniform float uSolar;\nvarying vec3 vSolarPos;\n' + shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      /* glsl */ `#include <emissivemap_fragment>
      float sweep = fract((vSolarPos.x - vSolarPos.z) * 0.08 - uTime * 0.1);
      float sheen = smoothstep(0.0, 0.06, sweep) * (1.0 - smoothstep(0.06, 0.18, sweep));
      totalEmissiveRadiance += vec3(0.55, 0.75, 1.0) * sheen * uSolar * 0.45;`,
    )
  }
  return material
}

// ---------------------------------------------------------------------------

type Materials = ReturnType<typeof createMaterials>

function createMaterials(u: { time: { value: number }; solar: { value: number } }) {
  const grain = woodGrain()
  grain.repeat.set(2, 3)
  const armGrain = woodGrain()
  armGrain.center.set(0.5, 0.5)
  armGrain.rotation = Math.PI / 2
  return {
    fascia: mat(COLOR.fascia),
    trim: mat(COLOR.trim),
    sill: mat(COLOR.sill),
    glass: mat(COLOR.glass, { roughness: 0.2, emissive: '#ffb15e', emissiveIntensity: 0 }),
    door: mat(COLOR.door),
    garageDoor: mat(COLOR.garageDoor),
    groove: mat('#6f665e'),
    concrete: mat(COLOR.concrete, { roughness: 0.95 }),
    frame: mat(COLOR.panelFrame, { roughness: 0.4, metalness: 0.3 }),
    cells: solarCellsMaterial(u.time, u.solar),
    appliance: mat(COLOR.appliance, { roughness: 0.5 }),
    chargerLed: new THREE.MeshStandardMaterial({ color: COLOR.led, emissive: COLOR.led, emissiveIntensity: 1.2 }),
    carBody: carBodyMaterial(),
    carTrim: mat(COLOR.carTrim, { roughness: 0.6 }),
    carTire: mat(COLOR.tire, { roughness: 0.9 }),
    carRim: mat(COLOR.rim, { roughness: 0.3, metalness: 0.6 }),
    chargeCable: mat(COLOR.cable, { roughness: 0.6 }),
    headlight: new THREE.MeshStandardMaterial({ color: '#f6f3ea', emissive: '#f6f3ea', emissiveIntensity: 0.4 }),
    taillight: new THREE.MeshStandardMaterial({ color: '#b5483b', emissive: '#8a2a20', emissiveIntensity: 0.4, roughness: 0.4 }),
    tire: mat(COLOR.tire, { roughness: 0.9 }),
    rim: mat(COLOR.rim, { roughness: 0.3, metalness: 0.6 }),
    trunk: mat(COLOR.trunk),
    canopy: mat(COLOR.canopy, { flatShading: true, roughness: 0.9 }),
    pole: mat(COLOR.wood, { map: grain, roughness: 0.95 }),
    poleArm: mat(COLOR.wood, { map: armGrain, roughness: 0.95 }),
    insulator: mat('#d9dcd6', { roughness: 0.35 }),
    transformer: mat(COLOR.transformer, { roughness: 0.45, metalness: 0.35 }),
    lamp: mat(COLOR.lamp, { roughness: 0.5, emissive: '#ffcf8a', emissiveIntensity: 0 }),
    streetLens: new THREE.MeshStandardMaterial({ color: '#d9d4c8', emissive: '#ffe2b0', emissiveIntensity: 0, roughness: 0.3 }),
    cable: mat(COLOR.cable, { roughness: 0.6 }),
  }
}

/** A material that darkens and turns glossy in the rain. */
export interface Wettable {
  material: THREE.MeshStandardMaterial
  color: THREE.Color
  roughness: number
  wetRoughness: number
  darken: number
}

const wettable = (material: THREE.MeshStandardMaterial, darken: number, wetRoughness: number): Wettable => ({
  material,
  color: material.color.clone(),
  roughness: material.roughness,
  wetRoughness,
  darken,
})

export interface Diorama {
  root: THREE.Group
  trees: THREE.Group[]
  /** Shared clock for shader motion (grass, solar sheen). */
  time: { value: number }
  /** Wind strength, 1 = a breeze. */
  wind: { value: number }
  /** Solar output, 0–1. */
  solar: { value: number }
  vegetation: THREE.MeshStandardMaterial
  canopy: THREE.MeshStandardMaterial
  wettables: Wettable[]
  windowGlass: THREE.MeshStandardMaterial
  lampMaterial: THREE.MeshStandardMaterial
  lamps: Anchor[]
  windows: Anchor[]
  batteryFace: Anchor
  chargerLed: THREE.MeshStandardMaterial
  cableCurve: THREE.Curve<THREE.Vector3>
  dropCurve: THREE.Curve<THREE.Vector3>
  transformer: THREE.Vector3
  streetLens: THREE.MeshStandardMaterial
  street: { head: THREE.Vector3; target: THREE.Vector3 }
}

export function buildDiorama(): Diorama {
  const time = { value: 0 }
  const wind = { value: 1 }
  const solar = { value: 0 }
  const m = createMaterials({ time, solar })
  const root = new THREE.Group()

  const ground = mat(COLOR.plinth, { roughness: 0.95 })
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(PLINTH.x * 2, 0.9, PLINTH.z * 2, 4, 0.22), ground)
  plinth.position.y = -0.45
  root.add(plinth)

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      root.add(box(1.22, 0.04, 1.86, m.concrete, 3.66 + i * 1.27, 0.02, -5.0 + j * 1.91, 0.02))
    }
  }

  const trees = [
    buildTree(-5.3, 6.7, 1.25, 1.3, [[-0.3, 2.3, 0.2, 0.62], [0.35, 2.0, -0.2, 0.55], [0.1, 2.95, -0.1, 0.7], [-0.45, 1.55, -0.3, 0.42]], m),
    buildTree(-2.4, -7.15, 1.1, 2.2, [[0, 3.6, 0, 0.95], [0.7, 2.9, 0.4, 0.75], [-0.6, 3.0, 0.5, 0.7], [0.3, 4.5, -0.3, 0.8], [0.8, 3.9, 0.9, 0.6]], m),
    buildTree(5.9, -6.9, 1.2, 0.9, [[0, 1.9, 0, 0.6], [0.35, 1.45, 0.35, 0.45], [-0.3, 1.4, -0.2, 0.4]], m),
  ]

  const house = buildHouse(m)
  const car = buildCar(m)
  const cable = buildChargeCable(m)
  const grid = buildGridConnection(m)
  root.add(house.house, car, cable.mesh, grid.grid, ...trees)
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true
  })
  const vegetation = windMaterial(time, wind)
  root.add(...buildGrass(vegetation))

  return {
    root,
    trees,
    time,
    wind,
    solar,
    vegetation,
    canopy: m.canopy,
    wettables: [
      wettable(ground, 0.42, 0.4),
      wettable(m.concrete, 0.3, 0.18),
      wettable(house.walls, 0.1, 0.7),
      wettable(m.fascia, 0.15, 0.35),
      wettable(m.pole, 0.3, 0.5),
      wettable(m.poleArm, 0.3, 0.5),
      ...house.roofMaterials.map((roof) => wettable(roof, 0.25, 0.28)),
    ],
    windowGlass: m.glass,
    lampMaterial: m.lamp,
    lamps: house.lamps,
    windows: house.windows,
    batteryFace: house.batteryFace,
    chargerLed: m.chargerLed,
    cableCurve: cable.curve,
    dropCurve: grid.dropCurve,
    transformer: grid.transformer,
    streetLens: m.streetLens,
    street: grid.street,
  }
}
