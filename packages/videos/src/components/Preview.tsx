import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import { fileUrl } from '../lib/api'
import {
  type Clip,
  clipAt,
  clipStart,
  type MediaItem,
  totalDuration,
  zoomTransform,
} from '../lib/project'

export interface PreviewHandle {
  /** Devuelve la ruta del medio y el tiempo de origen bajo el cabezal. */
  sourceAt: (t: number) => { path: string; time: number } | null
}

interface Props {
  clips: Clip[]
  media: Map<string, MediaItem>
  playhead: number
  playing: boolean
  aspect: number
  volume: number
  muted: boolean
  /** Uniones con transición: tiempo del corte, duración y color del fundido. */
  dips?: { at: number; d: number; color: string }[]
  /** Permite arrastrar para mover el encuadre del clip actual (si tiene zoom). */
  onPan?: (clipId: string, x: number, y: number) => void
  onTime: (t: number) => void
  onEnded: () => void
}

const EPS = 1 / 120

/**
 * Reproductor que simula la línea de tiempo usando un solo <video>,
 * cambiando de fuente y posición cuando se termina cada clip.
 */
const Preview = forwardRef<PreviewHandle, Props>(function Preview(
  { clips, media, playhead, playing, aspect, volume, muted, dips = [], onPan, onTime, onEnded },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const loadedPath = useRef<string | null>(null)
  const loadToken = useRef(0)
  const activeIndex = useRef(-1)
  const playingRef = useRef(playing)
  // Se actualiza en el render para que el efecto de seek vea el valor nuevo
  // cuando en el mismo cambio se pausa y se mueve el cabezal.
  playingRef.current = playing
  const clipsRef = useRef(clips)
  const mediaRef = useRef(media)
  const cbRef = useRef({ onTime, onEnded })
  clipsRef.current = clips
  mediaRef.current = media
  cbRef.current = { onTime, onEnded }

  const sourceAt = useCallback((t: number) => {
    const hit = clipAt(clipsRef.current, t)
    if (!hit) return null
    const m = mediaRef.current.get(hit.clip.mediaId)
    if (!m) return null
    const local = Math.min(hit.clip.out, hit.clip.in + Math.max(0, t - hit.start))
    return { path: m.path, time: local, index: hit.index }
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.volume = Math.max(0, Math.min(1, volume))
    v.muted = muted
  }, [volume, muted])

  const current = clipAt(clips, playhead)?.clip

  useImperativeHandle(ref, () => ({ sourceAt: (t) => sourceAt(t) }), [sourceAt])

  /** Carga (si hace falta) el archivo y se posiciona en `time`. */
  const load = useCallback(async (path: string, time: number) => {
    const v = videoRef.current
    if (!v) return false
    const token = ++loadToken.current
    if (loadedPath.current !== path) {
      loadedPath.current = path
      v.src = fileUrl(path)
      await new Promise<void>((res) => {
        const done = () => {
          v.removeEventListener('loadedmetadata', done)
          v.removeEventListener('error', done)
          res()
        }
        v.addEventListener('loadedmetadata', done)
        v.addEventListener('error', done)
      })
    }
    if (token !== loadToken.current) return false
    if (Math.abs(v.currentTime - time) > EPS) v.currentTime = time
    return true
  }, [])

  // Seek cuando NO se está reproduciendo (scrub, selección, edición).
  useEffect(() => {
    if (playingRef.current) return
    const src = sourceAt(playhead)
    if (!src) {
      const v = videoRef.current
      if (v && clips.length === 0) {
        v.removeAttribute('src')
        v.load()
        loadedPath.current = null
      }
      return
    }
    activeIndex.current = src.index
    load(src.path, src.time)
  }, [playhead, clips, sourceAt, load])

  // Reproducción
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (!playing) {
      v.pause()
      return
    }
    let raf = 0
    let cancelled = false
    let switching = false

    const startAt = async (t: number) => {
      const src = sourceAt(t)
      if (!src) {
        cbRef.current.onEnded()
        return
      }
      switching = true
      activeIndex.current = src.index
      const ok = await load(src.path, src.time)
      switching = false
      if (!ok || cancelled) return
      try {
        await v.play()
      } catch {
        /* el usuario pausó */
      }
    }

    const tick = () => {
      if (cancelled) return
      raf = requestAnimationFrame(tick)
      if (switching) return
      const list = clipsRef.current
      const i = activeIndex.current
      const clip = list[i]
      if (!clip) return
      const start = clipStart(list, i)
      const t = start + (v.currentTime - clip.in)
      if (v.currentTime >= clip.out - EPS || v.ended) {
        const nextStart = start + (clip.out - clip.in)
        if (i + 1 >= list.length) {
          v.pause()
          cbRef.current.onTime(totalDuration(list))
          cbRef.current.onEnded()
          return
        }
        cbRef.current.onTime(nextStart)
        startAt(nextStart + 0.0001)
        return
      }
      cbRef.current.onTime(Math.max(start, t))
    }

    const total = totalDuration(clipsRef.current)
    const from = playhead >= total - 0.05 ? 0 : playhead
    if (from !== playhead) cbRef.current.onTime(from)
    startAt(from).then(() => {
      if (!cancelled) raf = requestAnimationFrame(tick)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      v.pause()
    }
    // Solo depende de `playing`: el resto se lee por refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  return (
    <div
      className="relative flex h-full w-full items-center justify-center bg-black/90"
      style={{ containerType: 'size' }}
    >
      {/* Marco con la relación de aspecto de la exportación */}
      <div
        className="relative overflow-hidden bg-black shadow-lg"
        style={{ aspectRatio: aspect, width: `min(100cqw, calc(100cqh * ${aspect}))` }}
      >
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-contain will-change-transform"
          style={{ transform: zoomTransform(current?.zoom) }}
          preload="auto"
          playsInline
        />
        {/* Arrastrar para encuadrar cuando el clip tiene zoom */}
        {onPan && current?.zoom && current.zoom.scale > 1.001 && !playing && (
          <div
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
            title="Arrastra para mover el encuadre"
            onDoubleClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => {
              const z = current.zoom!
              const rect = e.currentTarget.getBoundingClientRect()
              const sx = e.clientX,
                sy = e.clientY,
                x0 = z.x,
                y0 = z.y
              // 1 unidad de x = mitad del excedente del cuadro ampliado
              const ux = ((z.scale - 1) * rect.width) / 2
              const uy = ((z.scale - 1) * rect.height) / 2
              const move = (ev: PointerEvent) => {
                const nx = Math.max(-1, Math.min(1, x0 - (ev.clientX - sx) / ux))
                const ny = Math.max(-1, Math.min(1, y0 - (ev.clientY - sy) / uy))
                onPan(current.id, nx, ny)
              }
              const up = () => {
                window.removeEventListener('pointermove', move)
                window.removeEventListener('pointerup', up)
              }
              window.addEventListener('pointermove', move)
              window.addEventListener('pointerup', up)
            }}
          />
        )}
        {/* Vista previa aproximada de transiciones: fundido alrededor del corte */}
        {dips.map((dp) => {
          const o = Math.max(0, 1 - Math.abs(playhead - dp.at) / (dp.d / 2))
          return o > 0 ? (
            <div
              key={dp.at}
              className="pointer-events-none absolute inset-0"
              style={{ background: dp.color, opacity: o * 0.85 }}
            />
          ) : null
        })}
        {clips.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/50">
            Agrega videos a la línea de tiempo
          </div>
        )}
      </div>
    </div>
  )
})

export default Preview
