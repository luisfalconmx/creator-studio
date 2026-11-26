import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useSectionActive } from '../section'

/** Motivo de los marcos flotantes: fotogramas, fotos o descargas. */
export type HeroMotif = 'video' | 'image' | 'download'

interface Props {
  /** URLs de imágenes (miniaturas de proyectos) que se usan como textura de los marcos. */
  images?: string[]
  /** Qué dibujan los marcos: fotogramas (Videos), fotos (Imágenes) o descargas (Descargas). */
  motif?: HeroMotif
  className?: string
}

const PALETTE = [
  ['#e7000b', '#460809'],
  ['#ff6467', '#9f0712'],
  ['#c10007', '#18181b'],
  ['#ff2056', '#82181a'],
  ['#fb2c36', '#27272a'],
  ['#e7000b', '#ff6467'],
]

/** Tamaño del marco (unidades de la escena) y del lienzo de su textura según el motivo. */
const FRAME: Record<HeroMotif, { w: number; h: number; cw: number; ch: number }> = {
  video: { w: 3.2, h: 1.8, cw: 512, ch: 288 },
  image: { w: 2.6, h: 2.0, cw: 416, ch: 320 },
  download: { w: 3.2, h: 1.8, cw: 512, ch: 288 },
}

/** Lienzo con el degradado de la paleta y un brillo, base de todas las texturas. */
function baseCanvas(i: number, motif: HeroMotif) {
  const { cw, ch } = FRAME[motif]
  const c = document.createElement('canvas')
  c.width = cw
  c.height = ch
  const g = c.getContext('2d')!
  const [a, b] = PALETTE[i % PALETTE.length]
  const grad = g.createLinearGradient(0, 0, cw, ch)
  grad.addColorStop(0, a)
  grad.addColorStop(1, b)
  g.fillStyle = grad
  g.fillRect(0, 0, cw, ch)
  const glow = g.createRadialGradient(cw * 0.3, ch * 0.2, 10, cw * 0.3, ch * 0.2, cw * 0.62)
  glow.addColorStop(0, 'rgba(255,255,255,0.35)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = glow
  g.fillRect(0, 0, cw, ch)
  return { c, g, cw, ch }
}

function toTexture(c: HTMLCanvasElement): THREE.Texture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function frameTexture(i: number, motif: HeroMotif): THREE.Texture {
  if (motif === 'image') return photoTexture(i)
  if (motif === 'download') return downloadTexture(i)
  return videoTexture(i)
}

/** Foto generada: cielo, sol y montañas dentro de un marco claro. */
function photoTexture(i: number): THREE.Texture {
  const { c, g, cw, ch } = baseCanvas(i, 'image')
  // sol
  g.fillStyle = 'rgba(255,255,255,0.8)'
  g.beginPath()
  g.arc(cw * 0.72, ch * 0.3, 28, 0, Math.PI * 2)
  g.fill()
  // montañas
  g.fillStyle = 'rgba(0,0,0,0.35)'
  g.beginPath()
  g.moveTo(0, ch)
  g.lineTo(cw * 0.3, ch * 0.45)
  g.lineTo(cw * 0.55, ch * 0.78)
  g.lineTo(cw * 0.72, ch * 0.58)
  g.lineTo(cw, ch)
  g.closePath()
  g.fill()
  g.fillStyle = 'rgba(0,0,0,0.5)'
  g.beginPath()
  g.moveTo(0, ch)
  g.lineTo(cw * 0.18, ch * 0.7)
  g.lineTo(cw * 0.42, ch)
  g.closePath()
  g.fill()
  // marco
  g.strokeStyle = 'rgba(255,255,255,0.85)'
  g.lineWidth = 18
  g.strokeRect(9, 9, cw - 18, ch - 18)
  return toTexture(c)
}

/** Tarjeta de descarga generada: flecha hacia abajo y barra de progreso. */
function downloadTexture(i: number): THREE.Texture {
  const { c, g, cw, ch } = baseCanvas(i, 'download')
  // flecha
  g.strokeStyle = 'rgba(255,255,255,0.88)'
  g.lineWidth = 16
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.beginPath()
  g.moveTo(cw / 2, ch * 0.18)
  g.lineTo(cw / 2, ch * 0.6)
  g.moveTo(cw / 2 - 44, ch * 0.46)
  g.lineTo(cw / 2, ch * 0.6)
  g.lineTo(cw / 2 + 44, ch * 0.46)
  g.stroke()
  // barra de progreso
  const x = 56
  const y = ch * 0.78
  const w = cw - 112
  g.fillStyle = 'rgba(0,0,0,0.4)'
  g.fillRect(x, y, w, 14)
  g.fillStyle = 'rgba(255,255,255,0.85)'
  g.fillRect(x, y, w * (0.25 + ((i * 29) % 70) / 100), 14)
  return toTexture(c)
}

/** Textura de "fotograma" generada: degradado + perforaciones de película + botón de play. */
function videoTexture(i: number): THREE.Texture {
  const { c, g } = baseCanvas(i, 'video')
  // perforaciones
  g.fillStyle = 'rgba(0,0,0,0.45)'
  g.fillRect(0, 0, 512, 26)
  g.fillRect(0, 262, 512, 26)
  g.fillStyle = 'rgba(255,255,255,0.55)'
  for (let x = 10; x < 512; x += 34) {
    g.fillRect(x, 8, 16, 10)
    g.fillRect(x, 270, 16, 10)
  }
  // play
  g.fillStyle = 'rgba(255,255,255,0.85)'
  g.beginPath()
  g.moveTo(236, 114)
  g.lineTo(236, 174)
  g.lineTo(286, 144)
  g.closePath()
  g.fill()
  return toTexture(c)
}

/** Textura circular suave para las partículas. */
function dotTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.3, 'rgba(255,255,255,0.6)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

const NEBULA_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

// Nebulosa/aurora con ruido fbm que fluye lentamente.
const NEBULA_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uRes;
  uniform vec2 uMouse;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return v;
  }
  void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    float t = uTime * 0.04;
    p += uMouse * 0.04;
    vec2 q = vec2(fbm(p * 1.6 + t), fbm(p * 1.6 - t + 4.0));
    float n = fbm(p * 2.2 + q * 1.8 + vec2(t * 2.0, -t));
    vec3 deep = vec3(0.012, 0.012, 0.03);
    vec3 blue = vec3(0.91, 0.0, 0.04);    // rojo #E7000B
    vec3 violet = vec3(0.45, 0.02, 0.06); // vino
    vec3 pink = vec3(1.0, 0.35, 0.4);     // rojo claro
    vec3 col = mix(deep, blue, smoothstep(0.35, 0.95, n) * 0.55);
    col = mix(col, violet, smoothstep(0.45, 1.0, q.x) * 0.45);
    col += pink * smoothstep(0.62, 1.0, n * q.y * 1.6) * 0.25;
    // viñeta y desvanecido hacia abajo para que el contenido se lea bien
    float vig = smoothstep(1.25, 0.15, length(p * vec2(0.8, 1.1)));
    col *= vig;
    col *= mix(0.35, 1.0, smoothstep(0.0, 0.7, uv.y));
    gl_FragColor = vec4(col, 1.0);
  }
`

/** Fondo 3D animado de las pantallas de inicio: nebulosa roja, marcos flotantes y partículas. */
export function HeroScene({ images = [], motif = 'video', className }: Props) {
  // Con la sección oculta no se dibuja nada (ahorra GPU).
  const active = useSectionActive()
  const activeRef = useRef(active)
  activeRef.current = active
  const mountRef = useRef<HTMLDivElement>(null)
  const imagesKey = images.join('|')

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const urls = imagesKey ? imagesKey.split('|') : []
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      })
    } catch {
      return // sin WebGL: el fondo CSS de respaldo queda visible
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.setClearColor(0x050507, 1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x050507, 0.045)
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
    camera.position.set(0, 0, 14)

    // --- Nebulosa (shader a pantalla completa, detrás de todo) ---
    const nebulaMat = new THREE.ShaderMaterial({
      vertexShader: NEBULA_VERT,
      fragmentShader: NEBULA_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uMouse: { value: new THREE.Vector2() },
      },
      depthWrite: false,
      depthTest: false,
    })
    const nebula = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), nebulaMat)
    nebula.frustumCulled = false
    nebula.renderOrder = -1
    scene.add(nebula)

    // --- Marcos de video flotando en una espiral ---
    const disposables: { dispose: () => void }[] = []
    const group = new THREE.Group()
    scene.add(group)
    const COUNT = 22
    const frameGeo = new THREE.PlaneGeometry(FRAME[motif].w, FRAME[motif].h)
    const borderGeo = new THREE.EdgesGeometry(frameGeo)
    disposables.push(frameGeo, borderGeo)
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    const frames: { mesh: THREE.Mesh; base: THREE.Vector3; phase: number; speed: number }[] = []

    for (let i = 0; i < COUNT; i++) {
      const tex = frameTexture(i, motif)
      disposables.push(tex)
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
      })
      disposables.push(mat)
      // Algunos marcos muestran las miniaturas reales de los proyectos
      if (urls.length && i % 3 === 0) {
        const url = urls[(i / 3) % urls.length]
        loader.load(
          url,
          (t) => {
            t.colorSpace = THREE.SRGBColorSpace
            mat.map = t
            mat.needsUpdate = true
            disposables.push(t)
          },
          undefined,
          () => {},
        )
      }
      const mesh = new THREE.Mesh(frameGeo, mat)
      const line = new THREE.LineSegments(
        borderGeo,
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }),
      )
      disposables.push(line.material as THREE.Material)
      mesh.add(line)

      const angle = (i / COUNT) * Math.PI * 4.2
      const radius = 6.5 + (i % 4) * 1.3
      const base = new THREE.Vector3(
        Math.cos(angle) * radius,
        (i - COUNT / 2) * 0.55,
        Math.sin(angle) * radius - 4,
      )
      mesh.position.copy(base)
      mesh.lookAt(0, base.y * 0.4, 6)
      const s = 0.55 + ((i * 37) % 10) / 22
      mesh.scale.setScalar(s)
      group.add(mesh)
      frames.push({ mesh, base, phase: i * 1.7, speed: 0.4 + ((i * 13) % 7) / 10 })
    }

    // --- Partículas ---
    const P = 1400
    const pos = new Float32Array(P * 3)
    const col = new Float32Array(P * 3)
    const tint = [
      new THREE.Color('#ff6467'),
      new THREE.Color('#e7000b'),
      new THREE.Color('#ffc9c9'),
      new THREE.Color('#ffffff'),
    ]
    for (let i = 0; i < P; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40
      pos[i * 3 + 1] = (Math.random() - 0.5) * 24
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30 - 4
      const c = tint[i % tint.length]
      col.set([c.r, c.g, c.b], i * 3)
    }
    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const dot = dotTexture()
    const pMat = new THREE.PointsMaterial({
      size: 0.09,
      map: dot,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    disposables.push(pGeo, pMat, dot)
    const points = new THREE.Points(pGeo, pMat)
    scene.add(points)

    // --- Interacción ---
    const mouse = new THREE.Vector2()
    const target = new THREE.Vector2()
    const onMove = (e: PointerEvent) => {
      target.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -((e.clientY / window.innerHeight) * 2 - 1),
      )
    }
    window.addEventListener('pointermove', onMove)

    const resize = () => {
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      renderer.setSize(w, h, false)
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      nebulaMat.uniforms.uRes.value.set(w, h)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(mount)
    resize()

    // --- Bucle ---
    const timer = new THREE.Timer()
    let raf = 0
    let running = true
    const tick = () => {
      if (!running) return
      raf = requestAnimationFrame(tick)
      if (!activeRef.current) return
      timer.update()
      const t = timer.getElapsed()
      mouse.lerp(target, 0.05)
      nebulaMat.uniforms.uTime.value = t
      nebulaMat.uniforms.uMouse.value.copy(mouse)

      group.rotation.y = t * 0.05 + mouse.x * 0.25
      group.rotation.x = -0.12 + mouse.y * 0.08
      for (const f of frames) {
        f.mesh.position.y = f.base.y + Math.sin(t * f.speed + f.phase) * 0.35
        f.mesh.rotation.z = Math.sin(t * 0.3 + f.phase) * 0.06
        const m = f.mesh.material as THREE.MeshBasicMaterial
        if (m.opacity < 0.82) m.opacity = Math.min(0.82, m.opacity + 0.008) // aparición gradual
      }
      if (motif === 'download') {
        // las partículas caen como una lluvia de datos
        for (let i = 0; i < P; i++) {
          const y = i * 3 + 1
          pos[y] -= 0.012 + (i % 5) * 0.004
          if (pos[y] < -12) pos[y] += 24
        }
        pGeo.attributes.position.needsUpdate = true
      }
      points.rotation.y = t * 0.012
      points.position.x = mouse.x * 0.6
      points.position.y = mouse.y * 0.4
      camera.position.x = mouse.x * 0.9
      camera.position.y = mouse.y * 0.5
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
    }

    const onVisibility = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (!running) {
        running = true
        tick()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    if (reduced) {
      for (const f of frames) (f.mesh.material as THREE.MeshBasicMaterial).opacity = 0.82
      renderer.render(scene, camera)
      running = false
    } else {
      tick()
    }

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('visibilitychange', onVisibility)
      for (const d of disposables) d.dispose()
      nebulaMat.dispose()
      nebula.geometry.dispose()
      timer.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [imagesKey, motif])

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ background: 'radial-gradient(ellipse at 30% 20%, #2a0204 0%, #050507 60%)' }}
      aria-hidden
    />
  )
}
