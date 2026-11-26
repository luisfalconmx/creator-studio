import { ArrowRight, Ban, Layers } from '@gravity-ui/icons'
import { Button, Label, Slider } from '@heroui/react'
import { fileUrl } from '../../lib/api'
import {
  type Clip,
  type ClipTransition,
  effectiveTransition,
  type MediaItem,
  TRANSITIONS,
  type TransitionKind,
  transitionLabel,
} from '../../lib/project'

interface Props {
  clips: Clip[]
  media: Map<string, MediaItem>
  /** id del clip a la izquierda de la unión seleccionada */
  selected: string | null
  onSelect: (clipId: string) => void
  onChange: (clipId: string, t: ClipTransition | undefined) => void
  onApplyAll: (t: ClipTransition | undefined) => void
}

/** Mini vista previa animada de una transición (A → B). */
function TransitionPreview({ anim }: { anim: string }) {
  return (
    <div className={`tr-prev tr-${anim} relative aspect-video w-full overflow-hidden rounded-lg`}>
      <div className="tr-a absolute inset-0 bg-gradient-to-br from-red-600 to-red-900" />
      <div className="tr-b absolute inset-0 bg-gradient-to-br from-zinc-200 to-zinc-500" />
    </div>
  )
}

export default function TransitionsPanel({
  clips,
  media,
  selected,
  onSelect,
  onChange,
  onApplyAll,
}: Props) {
  const junctions = clips.slice(0, -1).map((c, i) => ({ a: c, b: clips[i + 1], index: i }))
  const current = junctions.find((j) => j.a.id === selected) ?? junctions[0]
  const t = current?.a.transition
  const duration = t?.duration ?? 1

  if (junctions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-white/50">
        <Layers className="size-8 text-white/30" />
        Agrega al menos dos clips a la línea de tiempo para unirlos con una transición.
      </div>
    )
  }

  const thumb = (c: Clip) => media.get(c.mediaId)?.thumb

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Uniones */}
      <div className="flex flex-col gap-2">
        <span className="section-title">Uniones entre clips</span>
        <div className="flex flex-col gap-1.5">
          {junctions.map((j) => {
            const active = j.a.id === current?.a.id
            const ta = thumb(j.a)
            const tb = thumb(j.b)
            return (
              <button
                type="button"
                key={j.a.id}
                onClick={() => onSelect(j.a.id)}
                className={`flex items-center gap-2 rounded-xl p-1.5 pr-3 text-left transition ${
                  active
                    ? 'bg-red-600/15 ring-1 ring-red-600/70'
                    : 'bg-white/[0.03] hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex shrink-0 items-center">
                  <div className="h-8 w-14 overflow-hidden rounded-md bg-black">
                    {ta && (
                      <img
                        alt=""
                        src={fileUrl(ta)}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    )}
                  </div>
                  <ArrowRight className="mx-1 size-3 text-white/40" />
                  <div className="h-8 w-14 overflow-hidden rounded-md bg-black">
                    {tb && (
                      <img
                        alt=""
                        src={fileUrl(tb)}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    )}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">
                    Clip {j.index + 1} → {j.index + 2}
                  </p>
                  <p
                    className={`truncate text-[11px] ${j.a.transition ? 'text-red-400' : 'text-white/40'}`}
                  >
                    {j.a.transition
                      ? `${transitionLabel(j.a.transition.kind)} · ${effectiveTransition(j.a, j.b).toFixed(1)} s`
                      : 'Corte directo'}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tipos */}
      <div className="flex flex-col gap-2">
        <span className="section-title">
          Transición · clip {current.index + 1} → {current.index + 2}
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onChange(current.a.id, undefined)}
            className={`group flex flex-col gap-1.5 rounded-xl p-1.5 text-left transition ${
              !t ? 'bg-red-600/15 ring-1 ring-red-600' : 'bg-white/[0.03] hover:bg-white/[0.07]'
            }`}
          >
            <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-white/[0.04]">
              <Ban className="size-5 text-white/40" />
            </div>
            <span className="px-0.5 text-[11px] font-medium">Corte directo</span>
          </button>
          {TRANSITIONS.map((tr) => {
            const active = t?.kind === tr.kind
            return (
              <button
                type="button"
                key={tr.kind}
                onClick={() =>
                  onChange(current.a.id, { kind: tr.kind as TransitionKind, duration })
                }
                className={`group flex flex-col gap-1.5 rounded-xl p-1.5 text-left transition ${
                  active
                    ? 'bg-red-600/15 ring-1 ring-red-600'
                    : 'bg-white/[0.03] hover:bg-white/[0.07]'
                }`}
                title={tr.label}
              >
                <TransitionPreview anim={tr.anim} />
                <span className="truncate px-0.5 text-[11px] font-medium">{tr.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Duración */}
      <Slider
        minValue={0.2}
        maxValue={3}
        step={0.1}
        value={duration}
        isDisabled={!t}
        onChange={(v) => {
          const d = Array.isArray(v) ? v[0] : v
          if (t) onChange(current.a.id, { ...t, duration: d })
        }}
        formatOptions={{ style: 'unit', unit: 'second', maximumFractionDigits: 1 }}
      >
        <div className="flex w-full justify-between">
          <Label>Duración</Label>
          <Slider.Output />
        </div>
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
      {t && effectiveTransition(current.a, current.b) < duration - 0.05 && (
        <p className="-mt-3 text-[11px] text-amber-300">
          Se ajustará a {effectiveTransition(current.a, current.b).toFixed(1)} s porque uno de los
          clips es corto.
        </p>
      )}

      <div className="flex flex-col gap-2 rounded-xl bg-white/[0.03] p-3">
        <p className="text-[11px] leading-snug text-white/50">
          La transición solapa el final de un clip con el inicio del siguiente. En la vista previa
          se muestra como un fundido aproximado; el video exportado usa la transición real.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="flex-1"
            isDisabled={!t}
            onPress={() => onApplyAll(t)}
          >
            Aplicar a todas
          </Button>
          <Button size="sm" variant="ghost" onPress={() => onApplyAll(undefined)}>
            Quitar todas
          </Button>
        </div>
      </div>
    </div>
  )
}
