import { ArrowUpFromSquare, Folder, FolderOpen, Gear, TriangleExclamation } from '@gravity-ui/icons'
import { Button, Input, Label, Modal, ProgressBar, TextField, toast } from '@heroui/react'
import { open } from '@tauri-apps/plugin-dialog'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { useEffect, useRef, useState } from 'react'
import { api, errMsg, joinPath, type RenderProgress } from '../lib/api'
import {
  CODECS,
  type ExportSettings,
  formatTime,
  type MediaItem,
  outputDuration,
  type Project,
  QUALITY,
  RESOLUTIONS,
} from '../lib/project'

interface Props {
  isOpen: boolean
  onOpenChange: (v: boolean) => void
  project: Project
  media: Map<string, MediaItem>
  onSettings: (s: ExportSettings) => void
  /** Abre la pestaña Proyecto para cambiar resolución, fps, códec… */
  onEditSettings?: () => void
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'rendering'; p: RenderProgress | null }
  | { kind: 'done'; output: string }

export default function ExportModal({
  isOpen,
  onOpenChange,
  project,
  media,
  onSettings,
  onEditSettings,
}: Props) {
  const s = project.export
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const total = outputDuration(project.clips)
  const transitions = project.clips.slice(0, -1).filter((c) => c.transition).length
  const res = RESOLUTIONS[s.resolution]
  const [w, h] = s.orientation === 'portrait' ? [res.h, res.w] : [res.w, res.h]

  // Nombre y carpeta de salida (se recuerdan en el proyecto)
  const [fileName, setFileName] = useState('')
  const [outputDir, setOutputDir] = useState('')
  const [dirOk, setDirOk] = useState(true)
  const [exists, setExists] = useState(false)
  const cleanName = fileName
    .trim()
    .replace(/\.mp4$/i, '')
    .replace(/[\\/:*?"<>|]/g, '_')
  const outputPath = outputDir && cleanName ? joinPath(outputDir, `${cleanName}.mp4`) : ''

  useEffect(() => {
    if (!isOpen) return
    setFileName(s.fileName ?? project.name.replace(/[\\/:*?"<>|]/g, '_'))
    if (s.outputDir) setOutputDir(s.outputDir)
    else
      api
        .defaultExportDir()
        .then(setOutputDir)
        .catch(() => setOutputDir(''))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    if (!outputDir) return
    let alive = true
    api
      .dirExists(outputDir)
      .then((ok) => alive && setDirOk(ok))
      .catch(() => {})
    if (outputPath)
      api
        .fileExists(outputPath)
        .then((e) => alive && setExists(e))
        .catch(() => {})
    return () => {
      alive = false
    }
  }, [outputDir, outputPath])

  async function pickDir() {
    const sel = await open({
      directory: true,
      defaultPath: outputDir || undefined,
      title: 'Ruta de exportación',
    })
    if (typeof sel === 'string') setOutputDir(sel)
  }

  useEffect(() => {
    const un1 = api.onRenderProgress((p) => {
      if (phaseRef.current.kind === 'rendering') setPhase({ kind: 'rendering', p })
    })
    const un2 = api.onRenderDone((d) => {
      if (d.ok) {
        setPhase({ kind: 'done', output: d.output })
        toast.success('Video exportado', { description: d.output })
      } else {
        setPhase({ kind: 'idle' })
        if (d.cancelled) toast('Renderizado cancelado')
        else toast.danger('Error al renderizar', { description: d.error ?? '', timeout: 0 })
      }
    })
    return () => {
      un1.then((f) => f())
      un2.then((f) => f())
    }
  }, [])

  async function start() {
    if (!outputPath || !dirOk) return
    const output = outputPath
    onSettings({ ...s, fileName: cleanName, outputDir })
    const clips = project.clips.map((c) => {
      const m = media.get(c.mediaId)!
      return {
        path: m.path,
        start: c.in,
        end: c.out,
        hasAudio: m.hasAudio,
        transition: c.transition ?? null,
        zoom: c.zoom ?? null,
      }
    })
    try {
      setPhase({ kind: 'rendering', p: null })
      await api.startRender({
        clips,
        output,
        width: w,
        height: h,
        fps: s.fps,
        codec: s.codec,
        quality: QUALITY[s.quality].crf,
        cover: project.cover,
        metadata: project.metadata ?? {},
      })
    } catch (e) {
      setPhase({ kind: 'idle' })
      toast.danger('No se pudo iniciar el renderizado', { description: errMsg(e) })
    }
  }

  const rendering = phase.kind === 'rendering'

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(v) => {
        if (rendering) return // no cerrar mientras renderiza
        if (!v) setPhase({ kind: 'idle' })
        onOpenChange(v)
      }}
      isDismissable={!rendering}
      isKeyboardDismissDisabled={rendering}
    >
      <Modal.Container size="md">
        <Modal.Dialog>
          {!rendering && <Modal.CloseTrigger />}
          <Modal.Header>
            <Modal.Heading>Exportar video</Modal.Heading>
            <p className="text-sm text-muted">
              {project.clips.length} clip(s){transitions ? ` · ${transitions} transición(es)` : ''}{' '}
              · duración {formatTime(total, true)} · {w}×{h} @ {s.fps} fps
            </p>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            {/* Resumen de la configuración del proyecto (se edita en la pestaña Proyecto) */}
            <div className="flex items-start justify-between gap-3 rounded-2xl bg-white/[0.04] p-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  RESOLUTIONS[s.resolution].label,
                  s.orientation === 'portrait' ? 'Vertical 9:16' : 'Horizontal 16:9',
                  `${s.fps} fps`,
                  `Calidad ${QUALITY[s.quality].label.toLowerCase()}`,
                  CODECS[s.codec].split(' (')[0],
                ].map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-white/[0.07] px-2.5 py-1 text-xs text-white/85"
                  >
                    {t}
                  </span>
                ))}
              </div>
              {onEditSettings && !rendering && (
                <Button size="sm" variant="ghost" onPress={onEditSettings}>
                  <Gear />
                  Cambiar
                </Button>
              )}
            </div>
            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <TextField
                value={fileName}
                onChange={setFileName}
                isDisabled={rendering}
                className="col-span-2"
              >
                <Label>Nombre del archivo</Label>
                <div className="flex items-center gap-2">
                  <Input placeholder="Mi video" className="flex-1" />
                  <span className="text-sm text-muted">.mp4</span>
                </div>
              </TextField>
              <TextField value={outputDir} onChange={setOutputDir} isDisabled={rendering}>
                <Label>Ruta de exportación</Label>
                <Input placeholder="C:\\Users\\…\\Videos" />
              </TextField>
              <Button variant="secondary" onPress={pickDir} isDisabled={rendering}>
                <Folder />
                Cambiar…
              </Button>
            </div>
            {!dirOk && (
              <p className="flex items-center gap-1.5 text-xs text-danger">
                <TriangleExclamation className="size-3.5" /> La carpeta no existe.
              </p>
            )}
            {dirOk && exists && phase.kind === 'idle' && (
              <p className="flex items-center gap-1.5 text-xs text-warning">
                <TriangleExclamation className="size-3.5" /> Ya existe un archivo con ese nombre: se
                reemplazará.
              </p>
            )}
            <p className="text-xs text-muted">
              {project.cover
                ? '✓ Se incrustará la portada del proyecto.'
                : 'Sin portada (puedes capturar una en el panel derecho).'}{' '}
              Los videos con otra relación de aspecto se ajustan con barras negras.
            </p>

            {phase.kind === 'rendering' && (
              <ProgressBar
                aria-label="Progreso"
                value={phase.p?.percent ?? 0}
                isIndeterminate={!phase.p}
              >
                <Label>
                  Renderizando
                  {phase.p &&
                    ` · ${formatTime(phase.p.seconds)} / ${formatTime(phase.p.total)} · ${Math.round(phase.p.fps)} fps · ${phase.p.speed}`}
                </Label>
                <ProgressBar.Output />
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
            )}
            {phase.kind === 'done' && (
              <div className="rounded-xl bg-success-soft p-3 text-sm text-success-soft-foreground">
                Listo: <span className="break-all">{phase.output}</span>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            {rendering ? (
              <Button variant="danger" onPress={() => api.cancelRender()}>
                Cancelar
              </Button>
            ) : phase.kind === 'done' ? (
              <>
                <Button variant="secondary" onPress={() => revealItemInDir(phase.output)}>
                  <FolderOpen />
                  Mostrar en carpeta
                </Button>
                <Button slot="close">Cerrar</Button>
              </>
            ) : (
              <>
                <Button slot="close" variant="secondary">
                  Cancelar
                </Button>
                <Button
                  onPress={start}
                  isDisabled={project.clips.length === 0 || !outputPath || !dirOk}
                >
                  <ArrowUpFromSquare />
                  Renderizar
                </Button>
              </>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
