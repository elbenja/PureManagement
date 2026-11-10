import * as THREE from 'three'
import type { LookState } from './scenarios'

// Full-screen backdrop drawn before the diorama: a three-stop gradient,
// sun glow, moon with halo, twinkling stars and the lightning flash.

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uMid;
  uniform vec3 uBottom;
  uniform vec2 uSunUv;
  uniform float uSunGlow;
  uniform vec3 uSunColor;
  uniform float uStars;
  uniform float uMoon;
  uniform float uFlash;
  uniform float uTime;
  uniform float uAspect;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    float y = vUv.y;
    vec3 col = mix(uBottom, uMid, smoothstep(0.0, 0.55, y));
    col = mix(col, uTop, smoothstep(0.45, 1.0, y));

    vec2 aspect = vec2(uAspect, 1.0);

    // Sun: wide warm wash plus a tighter core.
    float r = length((vUv - uSunUv) * aspect);
    col += uSunColor * uSunGlow * (0.5 * exp(-r * r * 22.0) + 0.22 * exp(-r * 4.5));

    // Stars on a jittered grid, twinkling, fading toward the horizon.
    vec2 grid = vUv * aspect * 70.0;
    vec2 cell = floor(grid);
    float h = hash(cell);
    vec2 offset = vec2(hash(cell + 1.7), hash(cell + 4.3)) - 0.5;
    float d = length(fract(grid) - 0.5 - offset * 0.6);
    float twinkle = 0.55 + 0.45 * sin(uTime * (0.8 + h * 2.5) + h * 40.0);
    float star = step(0.975, h) * smoothstep(0.09, 0.0, d) * twinkle;
    col += vec3(1.0, 0.96, 0.9) * star * uStars * smoothstep(0.35, 0.85, y);

    // Moon: soft-edged disc with a darker limb, and a halo.
    vec2 moonUv = vec2(0.82, 0.8);
    // Sized to the narrower screen side, so it stays modest on tall phones.
    float moonScale = min(1.0, uAspect / 1.2);
    vec2 m = (vUv - moonUv) * aspect / moonScale;
    float mr = length(m);
    float disc = smoothstep(0.034, 0.031, mr);
    float limb = smoothstep(0.034, 0.02, length(m - vec2(0.01, 0.006)));
    vec3 moonCol = mix(vec3(0.55, 0.6, 0.82), vec3(1.0, 0.98, 0.92), limb);
    col += vec3(0.55, 0.62, 0.95) * uMoon * (0.22 * exp(-mr * 9.0) + 0.12 * exp(-mr * mr * 300.0));
    col = mix(col, moonCol * 1.4, disc * uMoon);

    col += vec3(0.7, 0.76, 1.0) * uFlash * 0.55;

    // Dither to keep smooth gradients free of banding.
    col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
    gl_FragColor = vec4(col, 1.0);
  }
`

export interface Sky {
  scene: THREE.Scene
  camera: THREE.Camera
  update(look: LookState, time: number, flash: number, aspect: number): void
  dispose(): void
}

export function createSky(): Sky {
  const uniforms = {
    uTop: { value: new THREE.Color() },
    uMid: { value: new THREE.Color() },
    uBottom: { value: new THREE.Color() },
    uSunUv: { value: new THREE.Vector2() },
    uSunGlow: { value: 0 },
    uSunColor: { value: new THREE.Color() },
    uStars: { value: 0 },
    uMoon: { value: 0 },
    uFlash: { value: 0 },
    uTime: { value: 0 },
    uAspect: { value: 1 },
  }
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, depthWrite: false, depthTest: false })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  const scene = new THREE.Scene()
  scene.add(quad)

  return {
    scene,
    camera: new THREE.Camera(),
    update(look, time, flash, aspect) {
      uniforms.uTop.value.copy(look.skyTop)
      uniforms.uMid.value.copy(look.skyMid)
      uniforms.uBottom.value.copy(look.skyBottom)
      uniforms.uSunUv.value.set(look.sunUv[0], look.sunUv[1])
      uniforms.uSunGlow.value = look.sunGlow
      uniforms.uSunColor.value.copy(look.sunGlowColor)
      uniforms.uStars.value = look.stars
      uniforms.uMoon.value = look.moon
      uniforms.uFlash.value = flash
      uniforms.uTime.value = time
      uniforms.uAspect.value = aspect
    },
    dispose() {
      quad.geometry.dispose()
      material.dispose()
    },
  }
}
