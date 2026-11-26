import { ArrowRotateLeft, Crop } from '@gravity-ui/icons'
import { Button, Label, Slider } from '@heroui/react'
import { fileUrl } from '../../lib/api'
import { type Clip, type ClipZoom, clipLen, formatTime, type MediaItem } from '../../lib/project'

interface Props {
  clip: Clip | null
  index: number
  media: Map<string, MediaItem>
  aspect: number
  onChange: (clipId: string, zoom: ClipZoom | undefined) => void
}

const PRESETS = [1, 1.25, 1.5, 2, 3]
const ANCHORS: [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [0, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
]

/** Zoom y encuadre del clip: amplía dentro del cuadro de salida, sin cambiar su formato. */
export default function ZoomPanel({ clip, index, media, aspect, onChange }: Props) {
  if (!clip) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-white/50">
        <Crop className="size-8 text-white/30" />
        Selecciona un clip en la línea de tiempo para hacerle zoom y encuadrarlo.
      </div>
    )
  }
  const z: ClipZoom = clip.zoom ?? { scale: 1, x: 0, y: 0 }
  const m = media.get(clip.mediaId)
  const set = (patch: Partial<ClipZoom>) => {
    const next = { ...z, ...patch }
    onChange(clip.id, next.scale <= 1.001 ? undefined : next)
  }
  // Rectángulo visible dentro del cuadro completo (para el mini mapa)
  const vw = 100 / z.scale
  const left = ((100 - vw) * (z.x + 1)) / 2
  const top = ((100 - vw) * (z.y + 1)) / 2

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2">
        <div className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-black">
          {m?.thumb && (
            <img
              alt=""
              src={fileUrl(m.thumb)}
              className="h-full w-full object-cover"
              draggable={false}
            />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            Clip {index + 1} · {m?.name ?? '—'}
          </p>
          <p className="text-[11px] text-white/45">
            {formatTime(clipLen(clip), true)} · el formato de salida no cambia
          </p>
        </div>
      </div>

      {/* Mini mapa: cuadro de salida y zona visible */}
      <div className="flex flex-col gap-2">
        <span className="section-title">Encuadre</span>
        <div
          className="relative w-full overflow-hidden rounded-xl bg-black ring-1 ring-white/10"
          style={{ aspectRatio: aspect }}
        >
          {m?.thumb && (
            <img
              alt=""
              src={fileUrl(m.thumb)}
              className="absolute inset-0 h-full w-full object-contain opacity-40"
              draggable={false}
            />
          )}
          <div
            className="absolute rounded-md border-2 border-red-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] transition-all duration-150"
            style={{ left: `${left}%`, top: `${top}%`, width: `${vw}%`, height: `${vw}%` }}
          >
            {m?.thumb && (
              <div className="absolute inset-0 overflow-hidden">
                <img
                  alt=""
                  src={fileUrl(m.thumb)}
                  className="absolute max-w-none object-contain"
                  style={{
                    width: `${z.scale * 100}%`,
                    height: `${z.scale * 100}%`,
                    left: `${-left * z.scale}%`,
                    top: `${-top * z.scale}%`,
                  }}
                  draggable={false}
                />
              </div>
            )}
          </div>
        </div>
        <p className="text-[11px] text-white/45">
          También puedes arrastrar el video en la vista previa (en pausa) para mover el encuadre.
        </p>
      </div>

      {/* Zoom */}
      <Slider
        minValue={1}
        maxValue={4}
        step={0.01}
        value={z.scale}
        onChange={(v) => set({ scale: Array.isArray(v) ? v[0] : v })}
        formatOptions={{ style: 'percent', maximumFractionDigits: 0 }}
      >
        <div className="flex w-full justify-between">
          <Label>Zoom</Label>
          <Slider.Output />
        </div>
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
      <div className="-mt-2 flex gap-1.5">
        {PRESETS.map((p) => (
          <button
            type="button"
            key={p}
            onClick={() => set({ scale: p })}
            className={`flex-1 rounded-lg py-1 text-xs transition ${
              Math.abs(z.scale - p) < 0.005
                ? 'bg-red-600 text-white'
                : 'bg-white/[0.05] text-white/70 hover:bg-white/10'
            }`}
          >
            {Math.round(p * 100)}%
          </button>
        ))}
      </div>

      {/* Posición */}
      <div className="grid grid-cols-[auto_1fr] items-start gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="section-title">Anclar</span>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-white/[0.04] p-1.5">
            {ANCHORS.map(([ax, ay]) => {
              const active = Math.abs(z.x - ax) < 0.01 && Math.abs(z.y - ay) < 0.01
              return (
                <button
                  type="button"
                  key={`${ax}${ay}`}
                  aria-label={`Anclar ${ax},${ay}`}
                  disabled={z.scale <= 1.001}
                  onClick={() => set({ x: ax, y: ay })}
                  className={`size-6 rounded-md transition disabled:opacity-30 ${active ? 'bg-red-600' : 'bg-white/10 hover:bg-white/25'}`}
                />
              )
            })}
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {(['x', 'y'] as const).map((k) => (
            <Slider
              key={k}
              minValue={-1}
              maxValue={1}
              step={0.01}
              value={z[k]}
              isDisabled={z.scale <= 1.001}
              onChange={(v) => set({ [k]: Array.isArray(v) ? v[0] : v })}
            >
              <Label>{k === 'x' ? 'Horizontal' : 'Vertical'}</Label>
              <Slider.Track>
                <Slider.Fill />
                <Slider.Thumb />
              </Slider.Track>
            </Slider>
          ))}
        </div>
      </div>

      <Button
        variant="secondary"
        isDisabled={!clip.zoom}
        onPress={() => onChange(clip.id, undefined)}
      >
        <ArrowRotateLeft />
        Restablecer (100 %)
      </Button>
    </div>
  )
}
