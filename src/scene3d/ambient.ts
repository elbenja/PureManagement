import * as THREE from 'three'
import type { Diorama } from './model'
import type { LookState } from './scenarios'

// Ambient life: wind in the grass and trees, a butterfly over the yard,
// a small flock of birds that crosses the sky now and then, and moths
// around the wall lamps on dry nights. The scenario's look decides who is out.

interface Flapper {
  root: THREE.Group
  left: THREE.Group
  right: THREE.Group
}

function flapper(wing: THREE.Shape, wingMaterial: THREE.Material, body: THREE.BufferGeometry, bodyMaterial: THREE.Material): Flapper {
  const geometry = new THREE.ShapeGeometry(wing, 6).rotateX(Math.PI / 2) // span along +z
  const root = new THREE.Group()
  root.rotation.order = 'YXZ'
  root.add(new THREE.Mesh(body, bodyMaterial))
  const left = new THREE.Group()
  left.add(new THREE.Mesh(geometry, wingMaterial))
  const right = new THREE.Group()
  right.add(new THREE.Mesh(geometry.clone().scale(1, 1, -1), wingMaterial))
  root.add(left, right)
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true
  })
  return { root, left, right }
}

function flap(f: Flapper, angle: number) {
  f.left.rotation.x = -angle
  f.right.rotation.x = angle
}

/** Turn a +x-forward object to face along (dx, dz). */
const heading = (dx: number, dz: number) => Math.atan2(-dz, dx)

// --- Butterflies -----------------------------------------------------------

const butterflyWing = new THREE.Shape()
butterflyWing.moveTo(0, 0)
butterflyWing.bezierCurveTo(0.05, 0.02, 0.16, 0.1, 0.11, 0.19)
butterflyWing.bezierCurveTo(0.07, 0.24, 0.0, 0.2, -0.01, 0.12)
butterflyWing.bezierCurveTo(-0.06, 0.17, -0.13, 0.13, -0.1, 0.05)
butterflyWing.bezierCurveTo(-0.08, 0.01, -0.03, 0.0, 0, 0)

interface Butterfly extends Flapper {
  center: [number, number]
  radius: [number, number]
  height: number
  speed: number
  phase: number
}

const BUTTERFLIES = [
  { color: '#f3dc8c', center: [4.4, 4.6], radius: [1.6, 1.5], height: 1.0, speed: 0.45, phase: 0 },
] as const

function butterflyPath(b: Butterfly, t: number, out: THREE.Vector3) {
  const s = t * b.speed + b.phase
  return out.set(
    b.center[0] + Math.sin(s) * b.radius[0] + Math.sin(s * 2.3 + b.phase) * b.radius[0] * 0.35,
    b.height + Math.sin(s * 1.9) * 0.35,
    b.center[1] + Math.cos(s * 0.8) * b.radius[1] + Math.sin(s * 3.1) * b.radius[1] * 0.25,
  )
}

// --- Birds -----------------------------------------------------------------

const birdWing = new THREE.Shape()
birdWing.moveTo(0.08, 0)
birdWing.lineTo(-0.02, 0.45)
birdWing.lineTo(-0.16, 0.42)
birdWing.lineTo(-0.1, 0)
birdWing.closePath()

const FLOCK_OFFSETS = [
  [0, 0, 0],
  [-0.9, 0.15, 0.8],
  [-0.9, -0.1, -0.8],
] as const
const CYCLE = 26 // seconds between crossings
const CROSSING = 13 // seconds a crossing takes

const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

// ---------------------------------------------------------------------------

export interface Ambient {
  update(time: number, look: LookState): void
}

/** Grow in or shrink out instead of popping. */
function settle(root: THREE.Object3D, target: number, base: number) {
  const next = THREE.MathUtils.lerp(root.scale.x / base, target, 0.08)
  root.scale.setScalar(Math.max(0, next) * base)
  root.visible = next > 0.01
}

export function createAmbient(diorama: Diorama): Ambient {
  const butterflies: Butterfly[] = BUTTERFLIES.map((spec) => {
    const body = new THREE.CapsuleGeometry(0.012, 0.12, 2, 6).rotateZ(Math.PI / 2)
    const wing = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.7, side: THREE.DoubleSide })
    const f = flapper(butterflyWing, wing, body, new THREE.MeshStandardMaterial({ color: '#3a332c' }))
    f.root.scale.setScalar(1.6)
    f.root.rotation.z = 0.25
    diorama.root.add(f.root)
    return { ...f, center: [...spec.center], radius: [...spec.radius], height: spec.height, speed: spec.speed, phase: spec.phase }
  })

  const flock = new THREE.Group()
  const birdMaterial = new THREE.MeshStandardMaterial({ color: '#5b5651', roughness: 0.8, side: THREE.DoubleSide })
  const birds = FLOCK_OFFSETS.map(([x, y, z]) => {
    const f = flapper(birdWing, birdMaterial, new THREE.ConeGeometry(0.06, 0.4, 5).rotateZ(-Math.PI / 2), birdMaterial)
    f.root.position.set(x, y, z)
    flock.add(f.root)
    return f
  })
  diorama.root.add(flock)

  const mothMaterial = new THREE.MeshStandardMaterial({ color: '#efe6d2', roughness: 0.8, side: THREE.DoubleSide })
  const moths = diorama.lamps.slice(0, 2).map((lamp, i) => {
    const f = flapper(butterflyWing, mothMaterial, new THREE.CapsuleGeometry(0.01, 0.08, 2, 5).rotateZ(Math.PI / 2), mothMaterial)
    f.root.scale.setScalar(0)
    diorama.root.add(f.root)
    return { ...f, lamp: lamp.position.clone().addScaledVector(lamp.facing, 0.25), phase: i * 2.4 }
  })

  const here = new THREE.Vector3()
  const ahead = new THREE.Vector3()

  return {
    update(t, look) {
      diorama.time.value = t
      const wind = diorama.wind.value

      diorama.trees.forEach((tree, i) => {
        tree.rotation.z = Math.sin(t * 0.7 * Math.sqrt(wind) + i * 1.9) * 0.012 * wind
        tree.rotation.x = Math.sin(t * 0.53 + i * 2.7) * 0.01 * wind
      })

      for (const moth of moths) {
        settle(moth.root, look.moths > 0.5 && look.rain < 0.1 ? 1 : 0, 0.9)
        const s = t * 2.6 + moth.phase
        moth.root.position.set(
          moth.lamp.x + Math.sin(s) * 0.32 + Math.sin(s * 3.7) * 0.06,
          moth.lamp.y + Math.sin(s * 1.9) * 0.18,
          moth.lamp.z + Math.cos(s) * 0.32,
        )
        moth.root.rotation.y = heading(Math.cos(s), -Math.sin(s))
        flap(moth, 0.3 + Math.sin(t * 42 + moth.phase) * 0.9)
      }

      for (const b of butterflies) {
        settle(b.root, look.butterflies > 0.5 && look.rain < 0.1 ? 1 : 0, 1.6)
        butterflyPath(b, t, here)
        butterflyPath(b, t + 0.05, ahead)
        const beat = Math.sin(t * 28 + b.phase * 3)
        b.root.position.copy(here)
        b.root.position.y += beat * 0.03
        b.root.rotation.y = heading(ahead.x - here.x, ahead.z - here.z)
        flap(b, 0.25 + beat * 0.95)
      }

      const cycle = Math.floor(t / CYCLE)
      const progress = (t - cycle * CYCLE) / CROSSING
      flock.visible = progress <= 1 && look.birds > 0.5 && look.rain < 0.1
      if (!flock.visible) return

      // Cross the view from screen left to right (or back) above the roof line.
      const dir = hash(cycle + 7) > 0.5 ? 1 : -1
      const depth = (hash(cycle) - 0.5) * 6
      const along = (-30 + 60 * progress) * dir
      flock.position.set((depth + along) / 2, 7.6 + hash(cycle + 3) * 1.2, (depth - along) / 2)
      flock.rotation.y = heading(dir, -dir)
      birds.forEach((bird, i) => {
        const glide = 0.5 + 0.5 * Math.sin(t * 0.8 + i)
        bird.root.position.y = FLOCK_OFFSETS[i][1] + Math.sin(t * 2 + i) * 0.08
        flap(bird, 0.15 + Math.sin(t * 10 + i) * 0.65 * glide)
      })
    },
  }
}
