import { useSectionActive } from '@creator-studio/ui'
import { ChevronLeft, ChevronRight } from '@gravity-ui/icons'
import { Button, Kbd, Tooltip } from '@heroui/react'
import { useEffect, useRef, useState } from 'react'

interface Props {
  time: number
  duration: number
  fps: number
  onChange: (t: number) => void
}

/** hh:mm:ss.mmm */
export function timecode(t: number) {
  const ms = Math.round(Math.max(0, t) * 1000)
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  const r = ms % 1000
  const p = (n: number, l = 2) => n.toString().padStart(l, '0')
  return `${h ? `${h}:` : ''}${p(m)}:${p(s)}.${p(r, 3)}`
}

/**
 * Selector de fotograma: una línea fina sobre una pista delgada con un
 * globo encima que muestra el tiempo exacto y el número de fotograma.
 */
export default function FrameScrubber({ time, duration, fps, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const active = useSectionActive()
  const [dragging, setDragging] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const rate = fps > 0 ? fps : 30
  const frameDur = 1 / rate
  const maxT = Math.max(0, duration - frameDur)
  const snap = (t: number) => Math.min(maxT, Math.max(0, Math.round(t * rate) / rate))
  const frame = Math.round(time * rate)
  const totalFrames = Math.max(1, Math.floor(duration * rate))
  const pct = (t: number) => (maxT > 0 ? (t / maxT) * 100 : 0)

  const timeAt = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect()
    return snap(((clientX - r.left) / r.width) * maxT)
  }

  useEffect(() => {
    if (!dragging) return
    const move = (e: PointerEvent) => onChange(timeAt(e.clientX))
    const up = () => setDragging(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  })

  const step = (n: number) => onChange(snap(time + n * frameDur))

  // ← → fotograma a fotograma, Shift = 1 segundo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (
        (e.target as HTMLElement)?.closest?.(
          '[role="tablist"],[role="radiogroup"],[role="listbox"],[role="dialog"]',
        )
      )
        return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const dir = e.key === 'ArrowLeft' ? -1 : 1
        onChange(snap(time + dir * (e.shiftKey ? 1 : frameDur)))
      }
    }
    if (!active) return
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Marcas de la regla
  const ticks: number[] = []
  if (duration > 0) {
    const steps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800]
    const every = steps.find((s) => duration / s <= 24) ?? 3600
    for (let t = 0; t <= duration; t += every) ticks.push(t)
  }

  return (
    <div className="flex items-center gap-3">
      <Tooltip delay={300}>
        <Button
          isIconOnly
          size="sm"
          variant="secondary"
          aria-label="Fotograma anterior"
          onPress={() => step(-1)}
        >
          <ChevronLeft />
        </Button>
        <Tooltip.Content>
          Fotograma anterior <Kbd className="ml-1">←</Kbd>
        </Tooltip.Content>
      </Tooltip>

      <div className="relative flex-1 pt-9">
        {/* Globo con el tiempo exacto */}
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 font-mono text-[11px] tabular-nums text-background shadow-md"
          style={{ left: `clamp(64px, ${pct(time)}%, calc(100% - 64px))` }}
        >
          {timecode(time)} <span className="opacity-60">· f{frame}</span>
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-foreground" />
        </div>

        <div
          ref={trackRef}
          className="relative h-6 cursor-pointer touch-none"
          onPointerDown={(e) => {
            onChange(timeAt(e.clientX))
            setDragging(true)
          }}
          onPointerMove={(e) => setHover(timeAt(e.clientX))}
          onPointerLeave={() => setHover(null)}
          role="slider"
          aria-label="Fotograma"
          aria-valuemin={0}
          aria-valuemax={maxT}
          aria-valuenow={time}
          aria-valuetext={timecode(time)}
        >
          {/* pista */}
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
          <div
            className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-accent"
            style={{ width: `${pct(time)}%` }}
          />
          {/* regla */}
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute top-[calc(50%+3px)] h-1.5 w-px bg-muted/50"
              style={{ left: `${pct(Math.min(t, maxT))}%` }}
            />
          ))}
          {/* posición del cursor */}
          {hover != null && !dragging && (
            <>
              <div
                className="absolute inset-y-1 w-px bg-muted/70"
                style={{ left: `${pct(hover)}%` }}
              />
              <div
                className="pointer-events-none absolute -top-4 -translate-x-1/2 font-mono text-[10px] text-muted"
                style={{ left: `${pct(hover)}%` }}
              >
                {timecode(hover)}
              </div>
            </>
          )}
          {/* rallita */}
          <div
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
            style={{ left: `${pct(time)}%` }}
          />
        </div>
        <div className="mt-0.5 flex justify-between font-mono text-[10px] text-muted">
          <span>00:00.000</span>
          <span>
            {totalFrames} fotogramas · {rate.toFixed(rate % 1 ? 2 : 0)} fps
          </span>
          <span>{timecode(duration)}</span>
        </div>
      </div>

      <Tooltip delay={300}>
        <Button
          isIconOnly
          size="sm"
          variant="secondary"
          aria-label="Fotograma siguiente"
          onPress={() => step(1)}
        >
          <ChevronRight />
        </Button>
        <Tooltip.Content>
          Fotograma siguiente <Kbd className="ml-1">→</Kbd>
        </Tooltip.Content>
      </Tooltip>
    </div>
  )
}
