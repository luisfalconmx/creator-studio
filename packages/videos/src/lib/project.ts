import { api, type MediaInfo } from './api'

export interface MediaItem extends MediaInfo {
  id: string
  /** Fotograma del video (línea de tiempo y encuadre). */
  thumb?: string
  /** Portada incrustada en el archivo, si tiene (biblioteca de medios). */
  poster?: string
}

/** Un segmento de un medio colocado en la línea de tiempo. El orden del arreglo es el orden de reproducción. */
export interface Clip {
  id: string
  mediaId: string
  in: number
  out: number
  /** Transición hacia el clip siguiente. */
  transition?: ClipTransition
  /** Zoom / encuadre dentro del cuadro de salida (scale ≥ 1, x/y en [-1, 1]). */
  zoom?: ClipZoom
}

export interface ClipZoom {
  scale: number
  x: number
  y: number
}

/** Transform CSS equivalente al zoom del render (escala y recorte centrado en x/y). */
export function zoomTransform(z?: ClipZoom): string | undefined {
  if (!z || z.scale <= 1.001) return undefined
  const k = ((z.scale - 1) / (2 * z.scale)) * 100
  return `scale(${z.scale}) translate(${-z.x * k}%, ${-z.y * k}%)`
}

export interface ClipTransition {
  kind: TransitionKind
  duration: number
}

export type TransitionKind =
  | 'fade'
  | 'fadeblack'
  | 'fadewhite'
  | 'dissolve'
  | 'wipeleft'
  | 'wiperight'
  | 'slideleft'
  | 'slideup'
  | 'circleopen'
  | 'radial'
  | 'pixelize'
  | 'smoothleft'

/** Catálogo de transiciones (nombres del filtro xfade de ffmpeg). */
export const TRANSITIONS: { kind: TransitionKind; label: string; anim: string }[] = [
  { kind: 'fade', label: 'Disolver', anim: 'fade' },
  { kind: 'fadeblack', label: 'Fundido a negro', anim: 'black' },
  { kind: 'fadewhite', label: 'Fundido a blanco', anim: 'white' },
  { kind: 'dissolve', label: 'Granulado', anim: 'fade' },
  { kind: 'wipeleft', label: 'Barrido ←', anim: 'wipeleft' },
  { kind: 'wiperight', label: 'Barrido →', anim: 'wiperight' },
  { kind: 'slideleft', label: 'Deslizar ←', anim: 'slideleft' },
  { kind: 'slideup', label: 'Deslizar ↑', anim: 'slideup' },
  { kind: 'circleopen', label: 'Círculo', anim: 'circle' },
  { kind: 'radial', label: 'Radial', anim: 'radial' },
  { kind: 'pixelize', label: 'Pixelado', anim: 'fade' },
  { kind: 'smoothleft', label: 'Suave ←', anim: 'wipeleft' },
]

export const transitionLabel = (k: TransitionKind) =>
  TRANSITIONS.find((t) => t.kind === k)?.label ?? k

/** Duración efectiva (igual que en el render): máx. 40 % del clip más corto. */
export function effectiveTransition(a: Clip, b: Clip | undefined): number {
  if (!a.transition || !b) return 0
  return Math.max(0.05, Math.min(a.transition.duration, Math.min(clipLen(a), clipLen(b)) * 0.4))
}

/** Duración del video exportado (las transiciones solapan clips). */
export function outputDuration(clips: Clip[]): number {
  let t = totalDuration(clips)
  for (let i = 0; i < clips.length - 1; i++) t -= effectiveTransition(clips[i], clips[i + 1])
  return Math.max(0, t)
}

export interface ExportSettings {
  resolution: '1080p' | '1440p' | '2160p'
  orientation: 'landscape' | 'portrait'
  fps: 60 | 120
  codec: 'h264' | 'hevc' | 'h264_nvenc' | 'hevc_nvenc'
  quality: 'high' | 'medium' | 'low'
  /** Carpeta de exportación elegida (por defecto Videos del usuario). */
  outputDir?: string
  /** Nombre del archivo exportado, sin extensión (por defecto el nombre del proyecto). */
  fileName?: string
}

export interface Project {
  version: 1
  name: string
  media: MediaItem[]
  clips: Clip[]
  cover: string | null
  export: ExportSettings
  /** Metadata que se escribe en el video exportado (título, descripción…). */
  metadata?: Record<string, string>
}

export const RESOLUTIONS: Record<
  ExportSettings['resolution'],
  { label: string; w: number; h: number }
> = {
  '1080p': { label: '1080p Full HD', w: 1920, h: 1080 },
  '1440p': { label: '1440p 2K', w: 2560, h: 1440 },
  '2160p': { label: '2160p 4K UHD', w: 3840, h: 2160 },
}

export const QUALITY: Record<ExportSettings['quality'], { label: string; crf: number }> = {
  high: { label: 'Alta', crf: 18 },
  medium: { label: 'Media', crf: 22 },
  low: { label: 'Ligera', crf: 27 },
}

export const CODECS: Record<ExportSettings['codec'], string> = {
  h264: 'H.264 (CPU, máxima compatibilidad)',
  hevc: 'H.265 / HEVC (CPU, archivos más pequeños)',
  h264_nvenc: 'H.264 NVIDIA NVENC (GPU, rápido)',
  hevc_nvenc: 'H.265 NVIDIA NVENC (GPU, rápido)',
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export const newProject = (name = 'Proyecto sin título'): Project => ({
  version: 1,
  name,
  media: [],
  clips: [],
  cover: null,
  export: {
    resolution: '1080p',
    orientation: 'landscape',
    fps: 60,
    codec: 'h264',
    quality: 'high',
  },
})

export const clipLen = (c: Clip) => Math.max(0, c.out - c.in)

export const totalDuration = (clips: Clip[]) => clips.reduce((s, c) => s + clipLen(c), 0)

/** Devuelve el clip que contiene el tiempo `t` de la línea de tiempo y su inicio. */
export function clipAt(
  clips: Clip[],
  t: number,
): { clip: Clip; index: number; start: number } | null {
  let acc = 0
  for (let i = 0; i < clips.length; i++) {
    const len = clipLen(clips[i])
    if (t < acc + len || i === clips.length - 1) {
      return { clip: clips[i], index: i, start: acc }
    }
    acc += len
  }
  return null
}

export const clipStart = (clips: Clip[], index: number) =>
  clips.slice(0, index).reduce((s, c) => s + clipLen(c), 0)

export function formatTime(sec: number, withFrames = false): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const pad = (n: number) => n.toString().padStart(2, '0')
  const base = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
  if (!withFrames) return base
  const cs = Math.floor((sec % 1) * 100)
  return `${base}.${pad(cs)}`
}

const RECENTS_KEY = 'creator-studio.videos.recents'

export function getRecents(): { path: string; name: string; at: number }[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function pushRecent(path: string, name: string) {
  try {
    const list = getRecents().filter((r) => r.path !== path)
    list.unshift({ path, name, at: Date.now() })
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, 8)))
  } catch {
    /* ignorar */
  }
}

export function removeRecent(path: string) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(getRecents().filter((r) => r.path !== path)))
  } catch {
    /* ignorar */
  }
}

/** Crea y guarda de inmediato un proyecto nuevo (por defecto en la carpeta de datos de la app). */
export async function createProjectFile(
  name: string,
  dir: string | null = null,
): Promise<{ project: Project; path: string }> {
  const project = newProject(name)
  const path = await api.newProjectPath(name, dir)
  await api.saveText(path, JSON.stringify(project, null, 2))
  pushRecent(path, name)
  return { project, path }
}

/**
 * Formato de salida sugerido a partir de un video: orientación según su forma,
 * resolución según su lado corto y 120 fps solo si el video supera ~90 fps.
 */
export function detectExportSettings(
  m: { width: number; height: number; fps: number },
  base: ExportSettings,
): ExportSettings {
  const portrait = m.height > m.width
  const short = Math.min(m.width, m.height)
  const resolution: ExportSettings['resolution'] =
    short >= 2000 ? '2160p' : short >= 1400 ? '1440p' : '1080p'
  return {
    ...base,
    resolution,
    orientation: portrait ? 'portrait' : 'landscape',
    fps: m.fps > 90 ? 120 : 60,
  }
}
