import {
  ArrowRotateLeft,
  Camera,
  Clock,
  CopyPlus,
  Display,
  File,
  FloppyDisk,
  Folder,
  FolderOpen,
  HardDrive,
  Layers,
  ListUl,
  PencilToLine,
  Picture,
  Speedometer,
  Tag,
  TrashBin,
  Volume,
} from '@gravity-ui/icons'
import {
  Button,
  Chip,
  Input,
  Label,
  ListBox,
  Select,
  Spinner,
  Tabs,
  TextArea,
  TextField,
  toast,
} from '@heroui/react'
import { open, save } from '@tauri-apps/plugin-dialog'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  api,
  type CoverChange,
  errMsg,
  fileUrl,
  formatBytes,
  IMAGE_EXTS,
  type MediaInfo,
  stripExt,
} from '../../lib/api'
import { EDITABLE_KEYS, HIDDEN_TAGS, META_GROUPS } from '../../lib/metadata'
import FrameScrubber, { timecode } from './FrameScrubber'

interface Props {
  path: string
  /** Se llama después de guardar con la ruta resultante. */
  onSaved?: (output: string, overwritten: boolean) => void
}

type CoverMode = 'keep' | 'set' | 'remove'

const pickTags = (info: MediaInfo) =>
  Object.fromEntries(EDITABLE_KEYS.map((k) => [k, info.tags[k] ?? ''])) as Record<string, string>

export default function MetadataEditor({ path, onSaved }: Props) {
  const [info, setInfo] = useState<MediaInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tags, setTags] = useState<Record<string, string>>({})
  const [currentCover, setCurrentCover] = useState<string | null>(null)
  const [newCover, setNewCover] = useState<string | null>(null)
  const [coverMode, setCoverMode] = useState<CoverMode>('keep')
  const [time, setTime] = useState(0)
  const [saveMode, setSaveMode] = useState<'overwrite' | 'copy'>('overwrite')
  const [busy, setBusy] = useState<'capture' | 'save' | null>(null)
  const [lastOutput, setLastOutput] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const editable = /\.(mp4|m4v)$/i.test(path)

  async function load(p: string) {
    setInfo(null)
    setError(null)
    setNewCover(null)
    setCoverMode('keep')
    setCurrentCover(null)
    setLastOutput(null)
    try {
      const i = await api.probe(p)
      setInfo(i)
      setTags(pickTags(i))
      setTime(Math.min(1, i.duration / 2))
      if (i.coverStream != null)
        api
          .readCover(p)
          .then(setCurrentCover)
          .catch(() => {})
    } catch (e) {
      setError(errMsg(e))
    }
  }

  useEffect(() => {
    load(path)
  }, [path])

  useEffect(() => {
    const v = videoRef.current
    if (v && Math.abs(v.currentTime - time) > 0.01) v.currentTime = time
  }, [time, info])

  const original = useMemo(() => (info ? pickTags(info) : {}), [info])
  const changedKeys = EDITABLE_KEYS.filter(
    (k) => (tags[k] ?? '').trim() !== (original[k] ?? '').trim(),
  )
  const coverChanged =
    coverMode === 'remove' ? currentCover != null || info?.coverStream != null : coverMode === 'set'
  const dirty = changedKeys.length > 0 || coverChanged
  const otherTags = info
    ? Object.entries(info.tags).filter(
        ([k]) => !EDITABLE_KEYS.includes(k) && !HIDDEN_TAGS.includes(k),
      )
    : []

  async function capture() {
    if (!info) return
    setBusy('capture')
    try {
      setNewCover(await api.captureFrame(info.path, time))
      setCoverMode('set')
    } catch (e) {
      toast.danger('No se pudo capturar', { description: errMsg(e) })
    } finally {
      setBusy(null)
    }
  }

  async function pickImage() {
    const sel = await open({ filters: [{ name: 'Imágenes', extensions: IMAGE_EXTS }] })
    if (typeof sel === 'string') {
      setNewCover(sel)
      setCoverMode('set')
    }
  }

  async function saveAll() {
    if (!info) return
    let output: string | null = null
    if (saveMode === 'copy') {
      const ext = info.path.split('.').pop() ?? 'mp4'
      const sel = await save({
        defaultPath: `${stripExt(info.path)}_editado.${ext}`,
        filters: [{ name: 'Video', extensions: [ext] }],
      })
      if (!sel) return
      output = sel
    }
    const cover: CoverChange =
      coverMode === 'set' && newCover
        ? { kind: 'set', path: newCover }
        : coverMode === 'remove'
          ? { kind: 'remove' }
          : { kind: 'keep' }
    // Solo se envían las claves editables; las vacías borran la etiqueta.
    const payload = Object.fromEntries(EDITABLE_KEYS.map((k) => [k, (tags[k] ?? '').trim()]))
    setBusy('save')
    try {
      const out = await api.writeMetadata(info.path, payload, cover, output)
      toast.success('Metadata guardada', { description: out })
      setLastOutput(out)
      onSaved?.(out, output == null)
      if (output == null) await load(out)
      setLastOutput(out)
    } catch (e) {
      toast.danger('No se pudo guardar', { description: errMsg(e), timeout: 0 })
    } finally {
      setBusy(null)
    }
  }

  if (error)
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-danger">
        No se pudo leer el video: {error}
      </div>
    )
  if (!info)
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )

  const shownCover = coverMode === 'set' ? newCover : coverMode === 'remove' ? null : currentCover

  return (
    <div className="flex h-full min-h-0">
      {/* 70%: video y selección de fotograma */}
      <section className="flex min-w-0 basis-[70%] flex-col gap-3 p-4">
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-black shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.07]">
          <video
            ref={videoRef}
            src={fileUrl(info.path)}
            className="absolute inset-0 h-full w-full object-contain"
            preload="auto"
            muted
            onLoadedMetadata={(e) => (e.currentTarget.currentTime = time)}
          />
        </div>
        <FrameScrubber time={time} duration={info.duration} fps={info.fps} onChange={setTime} />
        <div className="flex flex-wrap items-center gap-2">
          <Button onPress={capture} isPending={busy === 'capture'} isDisabled={!editable}>
            <Camera />
            Usar este fotograma como portada
          </Button>
          <div className="flex-1" />
          <Chip size="sm" title={info.path}>
            <File className="size-3" /> {info.name}
          </Chip>
          <Chip size="sm" title="Resolución">
            <Display className="size-3" /> {info.width}×{info.height}
          </Chip>
          <Chip size="sm" title="Cuadros por segundo">
            <Speedometer className="size-3" /> {info.fps.toFixed(info.fps % 1 ? 2 : 0)} fps
          </Chip>
          <Chip size="sm" title="Tamaño">
            <HardDrive className="size-3" /> {formatBytes(info.size)}
          </Chip>
        </div>
      </section>

      {/* 30%: panel de metadata */}
      <aside className="glass m-3 ml-0 flex min-w-[340px] basis-[30%] flex-col overflow-hidden rounded-2xl">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {!editable && (
            <div className="mb-3 rounded-xl bg-warning-soft p-3 text-sm text-warning-soft-foreground">
              Formato de solo lectura. La edición funciona con MP4 y M4V.
            </div>
          )}

          {/* Portada */}
          <div className="mb-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="section-title">Portada</h3>
              {coverMode === 'set' && (
                <Chip size="sm" color="accent">
                  Nueva
                </Chip>
              )}
              {coverMode === 'remove' && (
                <Chip size="sm" color="danger">
                  Se quitará
                </Chip>
              )}
              {coverMode === 'keep' && (
                <Chip size="sm" color={currentCover ? 'success' : 'warning'}>
                  {currentCover ? 'Actual' : 'Sin portada'}
                </Chip>
              )}
            </div>
            <div className="checker aspect-video overflow-hidden rounded-xl border border-border">
              {shownCover ? (
                <img
                  alt=""
                  src={fileUrl(shownCover)}
                  className="h-full w-full object-contain"
                  draggable={false}
                />
              ) : (
                <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted">
                  Sin portada · elige un fotograma a la izquierda
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                onPress={pickImage}
                isDisabled={!editable}
              >
                <Picture />
                Elegir imagen…
              </Button>
              {coverMode !== 'keep' ? (
                <Button size="sm" variant="ghost" onPress={() => setCoverMode('keep')}>
                  <ArrowRotateLeft />
                  Deshacer
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="danger-soft"
                  onPress={() => setCoverMode('remove')}
                  isDisabled={!editable || info.coverStream == null}
                >
                  <TrashBin />
                  Quitar
                </Button>
              )}
            </div>
          </div>

          {/* Metadata */}
          <Tabs className="w-full">
            <Tabs.ListContainer>
              <Tabs.List aria-label="Grupos de metadata">
                {META_GROUPS.map((g) => (
                  <Tabs.Tab key={g.id} id={g.id} className="whitespace-nowrap">
                    <g.icon className="mr-1 size-3.5" />
                    {g.label}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
                <Tabs.Tab id="info" className="whitespace-nowrap">
                  <ListUl className="mr-1 size-3.5" />
                  Info
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
            {META_GROUPS.map((g) => (
              <Tabs.Panel key={g.id} id={g.id} className="pt-4">
                <div className="grid grid-cols-2 gap-3">
                  {g.fields.map((f) => {
                    const changed = changedKeys.includes(f.key)
                    const label = (
                      <Label className="flex items-center gap-1.5">
                        <f.icon className="size-3.5 text-muted" />
                        {f.label}
                        {changed && (
                          <span className="text-accent" title="Modificado">
                            •
                          </span>
                        )}
                      </Label>
                    )
                    const span = f.half ? 'col-span-1' : 'col-span-2'
                    if (f.options) {
                      const known = f.options.some((o) => o.value === (tags[f.key] ?? ''))
                      const opts = known
                        ? f.options
                        : [...f.options, { value: tags[f.key], label: `Otro (${tags[f.key]})` }]
                      return (
                        <Select
                          key={f.key}
                          className={span}
                          value={tags[f.key] || '__none'}
                          onChange={(k) =>
                            k != null &&
                            setTags((t) => ({ ...t, [f.key]: k === '__none' ? '' : String(k) }))
                          }
                          isDisabled={!editable}
                        >
                          {label}
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              {opts.map((o) => (
                                <ListBox.Item
                                  key={o.value || '__none'}
                                  id={o.value || '__none'}
                                  textValue={o.label}
                                >
                                  {o.label}
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              ))}
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      )
                    }
                    return (
                      <TextField
                        key={f.key}
                        className={span}
                        value={tags[f.key] ?? ''}
                        onChange={(v) => setTags((t) => ({ ...t, [f.key]: v }))}
                        isDisabled={!editable}
                      >
                        {label}
                        {f.multiline ? (
                          <TextArea rows={4} placeholder={f.hint} />
                        ) : (
                          <Input placeholder={f.hint} />
                        )}
                      </TextField>
                    )
                  })}
                </div>
              </Tabs.Panel>
            ))}
            <Tabs.Panel id="info" className="pt-4">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
                <Info icon={File} k="Archivo" v={info.name} />
                <Info icon={Folder} k="Carpeta" v={info.path.replace(/[\\/][^\\/]*$/, '')} />
                <Info icon={HardDrive} k="Tamaño" v={formatBytes(info.size)} />
                <Info icon={Clock} k="Duración" v={timecode(info.duration)} />
                <Info icon={Layers} k="Contenedor" v={info.formatName} />
                <Info
                  icon={Display}
                  k="Video"
                  v={`${info.videoCodec} · ${info.width}×${info.height}`}
                />
                <Info icon={Speedometer} k="FPS" v={info.fps.toFixed(3).replace(/\.?0+$/, '')} />
                <Info
                  icon={Volume}
                  k="Audio"
                  v={
                    info.hasAudio
                      ? `${info.audioCodec} · ${info.audioChannels} canal(es) · ${info.audioSampleRate} Hz`
                      : 'Sin audio'
                  }
                />
                <Info
                  icon={Speedometer}
                  k="Bitrate"
                  v={info.bitRate ? `${(info.bitRate / 1_000_000).toFixed(2)} Mb/s` : '—'}
                />
                <Info icon={ListUl} k="Subtítulos" v={String(info.subtitleStreams)} />
                <Info icon={ListUl} k="Capítulos" v={String(info.chapters)} />
                {otherTags.map(([k, v]) => (
                  <Info key={k} icon={Tag} k={k} v={v} muted />
                ))}
              </dl>
            </Tabs.Panel>
          </Tabs>
        </div>

        {/* Guardado */}
        <footer className="flex flex-col gap-3 border-t border-border p-4">
          <div className="flex flex-col gap-1.5">
            <span className="section-title">Al guardar</span>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Modo de guardado">
              <SaveOption
                active={saveMode === 'overwrite'}
                disabled={!editable}
                icon={<PencilToLine className="size-4" />}
                title="Sobrescribir"
                desc="Reemplaza el archivo original"
                onSelect={() => setSaveMode('overwrite')}
              />
              <SaveOption
                active={saveMode === 'copy'}
                disabled={!editable}
                icon={<CopyPlus className="size-4" />}
                title="Guardar copia"
                desc="Crea un archivo nuevo"
                onSelect={() => setSaveMode('copy')}
              />
            </div>
          </div>
          <p className="text-xs text-muted">
            {dirty
              ? `${changedKeys.length} campo(s) modificados${coverChanged ? ' · portada' : ''}`
              : 'Sin cambios'}{' '}
            · no se re-codifica
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              isDisabled={!dirty || busy != null}
              onPress={() => {
                setTags(pickTags(info))
                setCoverMode('keep')
              }}
            >
              <ArrowRotateLeft />
              Descartar
            </Button>
            <Button
              className="flex-1"
              onPress={saveAll}
              isDisabled={!editable || !dirty || busy === 'capture'}
              isPending={busy === 'save'}
            >
              {busy === 'save' ? <Spinner size="sm" color="current" /> : <FloppyDisk />}
              Guardar metadata
            </Button>
          </div>
          {lastOutput && (
            <Button variant="ghost" size="sm" onPress={() => revealItemInDir(lastOutput)}>
              <FolderOpen />
              Mostrar en carpeta
            </Button>
          )}
        </footer>
      </aside>
    </div>
  )
}

function Info({
  k,
  v,
  muted,
  icon: Icon,
}: {
  k: string
  v: string
  muted?: boolean
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <>
      <dt className={`flex items-center gap-1.5 ${muted ? 'text-muted/70' : 'text-muted'}`}>
        <Icon className="size-3.5 shrink-0" />
        {k}
      </dt>
      <dd className="min-w-0 select-text break-all">{v}</dd>
    </>
  )
}

function SaveOption(p: {
  active: boolean
  disabled?: boolean
  icon: React.ReactNode
  title: string
  desc: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={p.active}
      disabled={p.disabled}
      onClick={p.onSelect}
      className={`flex items-start gap-2 rounded-xl border-2 p-2.5 text-left transition disabled:opacity-50 ${
        p.active
          ? 'border-red-600 bg-red-600/10 shadow-[0_0_24px_-6px_rgba(231,0,11,0.6)]'
          : 'border-white/10 hover:bg-white/5'
      }`}
    >
      <span className={`mt-0.5 ${p.active ? 'text-accent' : 'text-muted'}`}>{p.icon}</span>
      <span className="flex flex-col">
        <span className="text-sm font-medium">{p.title}</span>
        <span className="text-[11px] leading-tight text-muted">{p.desc}</span>
      </span>
    </button>
  )
}
