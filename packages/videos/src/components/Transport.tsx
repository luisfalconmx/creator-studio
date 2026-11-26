import {
  BackwardStep,
  ChevronsCollapseUpRight,
  ChevronsExpandUpRight,
  ForwardStep,
  Pause,
  Play,
  Volume,
  VolumeLow,
  VolumeXmark,
} from '@gravity-ui/icons'
import { Button, Kbd, Slider, Tooltip } from '@heroui/react'
import { useRef } from 'react'
import { formatTime } from '../lib/project'

interface Props {
  playhead: number
  total: number
  playing: boolean
  disabled: boolean
  volume: number // 0..1
  muted: boolean
  fullscreen: boolean
  /** Estilo superpuesto sobre el video (pantalla completa). */
  overlay?: boolean
  onTogglePlay: () => void
  onSeek: (t: number) => void
  onVolume: (v: number) => void
  onToggleMute: () => void
  onToggleFullscreen: () => void
}

function Tip({ label, k, children }: { label: string; k?: string; children: React.ReactNode }) {
  return (
    <Tooltip delay={400}>
      {children}
      <Tooltip.Content>
        {label} {k && <Kbd className="ml-1">{k}</Kbd>}
      </Tooltip.Content>
    </Tooltip>
  )
}

export default function Transport(p: Props) {
  const barRef = useRef<HTMLDivElement>(null)
  const VolIcon = p.muted || p.volume === 0 ? VolumeXmark : p.volume < 0.5 ? VolumeLow : Volume
  const ghost = 'ghost' as const
  const txt = p.overlay ? 'text-white' : ''

  const seekFromEvent = (clientX: number) => {
    const r = barRef.current!.getBoundingClientRect()
    p.onSeek(Math.max(0, Math.min(p.total, ((clientX - r.left) / r.width) * p.total)))
  }

  return (
    <div className={`flex flex-col gap-1 ${txt}`}>
      {p.overlay && (
        <div
          ref={barRef}
          className="group relative h-4 cursor-pointer"
          onPointerDown={(e) => {
            seekFromEvent(e.clientX)
            const move = (ev: PointerEvent) => seekFromEvent(ev.clientX)
            const up = () => {
              window.removeEventListener('pointermove', move)
              window.removeEventListener('pointerup', up)
            }
            window.addEventListener('pointermove', move)
            window.addEventListener('pointerup', up)
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/25 group-hover:h-1.5" />
          <div
            className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent group-hover:h-1.5"
            style={{ width: `${p.total ? (p.playhead / p.total) * 100 : 0}%` }}
          />
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="w-28 text-right font-mono text-xs tabular-nums">
          {formatTime(p.playhead, true)}
        </span>
        <Tip label="Al inicio" k="Inicio">
          <Button
            isIconOnly
            size="sm"
            variant={ghost}
            aria-label="Al inicio"
            onPress={() => p.onSeek(0)}
            className={txt}
          >
            <BackwardStep />
          </Button>
        </Tip>
        <Tip label={p.playing ? 'Pausa' : 'Reproducir'} k="Espacio">
          <Button
            isIconOnly
            aria-label={p.playing ? 'Pausa' : 'Reproducir'}
            onPress={p.onTogglePlay}
            isDisabled={p.disabled}
          >
            {p.playing ? <Pause /> : <Play />}
          </Button>
        </Tip>
        <Tip label="Al final" k="Fin">
          <Button
            isIconOnly
            size="sm"
            variant={ghost}
            aria-label="Al final"
            onPress={() => p.onSeek(p.total)}
            className={txt}
          >
            <ForwardStep />
          </Button>
        </Tip>
        <span
          className={`w-28 font-mono text-xs tabular-nums ${p.overlay ? 'text-white/60' : 'text-muted'}`}
        >
          {formatTime(p.total, true)}
        </span>

        <div className="flex-1" />

        {/* Audio */}
        <Tip label={p.muted ? 'Activar sonido' : 'Silenciar'} k="M">
          <Button
            isIconOnly
            size="sm"
            variant={ghost}
            aria-label="Silenciar"
            onPress={p.onToggleMute}
            className={txt}
          >
            <VolIcon />
          </Button>
        </Tip>
        <Slider
          aria-label="Volumen"
          className="w-28"
          minValue={0}
          maxValue={100}
          value={p.muted ? 0 : Math.round(p.volume * 100)}
          onChange={(v) => p.onVolume((Array.isArray(v) ? v[0] : v) / 100)}
        >
          <Slider.Track>
            <Slider.Fill />
            <Slider.Thumb />
          </Slider.Track>
        </Slider>
        <span
          className={`w-9 text-right text-[11px] tabular-nums ${p.overlay ? 'text-white/60' : 'text-muted'}`}
        >
          {p.muted ? '0' : Math.round(p.volume * 100)}%
        </span>

        <Tip
          label={p.fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          k={p.fullscreen ? 'Esc' : 'F'}
        >
          <Button
            isIconOnly
            size="sm"
            variant={ghost}
            aria-label="Pantalla completa"
            onPress={p.onToggleFullscreen}
            className={txt}
          >
            {p.fullscreen ? <ChevronsCollapseUpRight /> : <ChevronsExpandUpRight />}
          </Button>
        </Tip>
      </div>
    </div>
  )
}
