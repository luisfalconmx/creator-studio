import { Choice } from '@creator-studio/ui'
import { Display, MagicWand } from '@gravity-ui/icons'
import { Button } from '@heroui/react'
import {
  CODECS,
  detectExportSettings,
  type ExportSettings,
  formatTime,
  type MediaItem,
  outputDuration,
  type Project,
  QUALITY,
  RESOLUTIONS,
} from '../../lib/project'

interface Props {
  project: Project
  firstMedia: MediaItem | null
  onChange: (s: ExportSettings) => void
}

/** Configuración de salida del proyecto (antes estaba en el modal de exportar). */
export default function ProjectSettingsPanel({ project, firstMedia, onChange }: Props) {
  const s = project.export
  const res = RESOLUTIONS[s.resolution]
  const [w, h] = s.orientation === 'portrait' ? [res.h, res.w] : [res.w, res.h]
  const set = (patch: Partial<ExportSettings>) => onChange({ ...s, ...patch })
  const detected = firstMedia ? detectExportSettings(firstMedia, s) : null
  const matches =
    detected &&
    detected.resolution === s.resolution &&
    detected.orientation === s.orientation &&
    detected.fps === s.fps

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Resumen del formato de salida */}
      <div className="flex items-center gap-4 rounded-2xl bg-white/[0.04] p-4">
        <div
          className="flex shrink-0 items-center justify-center rounded-lg border-2 border-red-600 bg-red-600/10 text-[10px] font-semibold text-red-300"
          style={
            s.orientation === 'portrait' ? { width: 34, height: 60 } : { width: 72, height: 41 }
          }
        >
          {s.orientation === 'portrait' ? '9:16' : '16:9'}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-semibold tabular-nums">
            {w}×{h} <span className="text-white/45">@ {s.fps} fps</span>
          </p>
          <p className="text-xs text-white/50">
            Duración final {formatTime(outputDuration(project.clips), true)} ·{' '}
            {CODECS[s.codec].split(' (')[0]}
          </p>
        </div>
      </div>

      {firstMedia && !matches && detected && (
        <div className="flex items-center gap-3 rounded-xl bg-red-600/10 p-3 ring-1 ring-red-600/30">
          <Display className="size-5 shrink-0 text-red-400" />
          <p className="min-w-0 flex-1 text-xs text-white/70">
            Tu primer video es {firstMedia.width}×{firstMedia.height} a {Math.round(firstMedia.fps)}{' '}
            fps.
          </p>
          <Button size="sm" variant="secondary" onPress={() => onChange(detected)}>
            <MagicWand />
            Igualar
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Choice
          label="Resolución"
          value={s.resolution}
          options={{
            '1080p': RESOLUTIONS['1080p'].label,
            '1440p': RESOLUTIONS['1440p'].label,
            '2160p': RESOLUTIONS['2160p'].label,
          }}
          onChange={(resolution) => set({ resolution })}
        />
        <Choice
          label="Orientación"
          value={s.orientation}
          options={{ landscape: 'Horizontal 16:9', portrait: 'Vertical 9:16' }}
          onChange={(orientation) => set({ orientation })}
        />
        <Choice
          label="Cuadros por segundo"
          value={String(s.fps) as '60' | '120'}
          options={{ '60': '60 fps', '120': '120 fps' }}
          onChange={(fps) => set({ fps: Number(fps) as 60 | 120 })}
        />
        <Choice
          label="Calidad"
          value={s.quality}
          options={{
            high: QUALITY.high.label,
            medium: QUALITY.medium.label,
            low: QUALITY.low.label,
          }}
          onChange={(quality) => set({ quality })}
        />
      </div>
      <Choice label="Códec" value={s.codec} options={CODECS} onChange={(codec) => set({ codec })} />

      <p className="rounded-xl bg-white/[0.03] p-3 text-[11px] leading-snug text-white/50">
        La vista previa, la portada capturada y el video exportado usan este formato. Los clips con
        otra relación de aspecto se ajustan con barras negras (o puedes llenarlas con zoom en
        Encuadre).
      </p>
    </div>
  )
}
