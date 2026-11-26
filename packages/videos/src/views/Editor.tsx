import {
  AppHeader,
  PageBackdrop,
  Panel,
  useSectionActive,
  useUnsavedChanges,
} from '@creator-studio/ui'
import {
  ArrowShapeTurnUpLeft,
  ArrowUpFromSquare,
  Camera,
  ChevronsLeft,
  ChevronsRight,
  Crop,
  Filmstrip,
  FloppyDisk,
  Gear,
  Layers,
  MagnifierMinus,
  MagnifierPlus,
  Picture,
  Scissors,
  Tag,
  TrashBin,
} from '@gravity-ui/icons'
import { Button, Kbd, Separator, Slider, Tooltip, toast } from '@heroui/react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { ask, open, save } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CoverPanel from '../components/CoverPanel'
import ExportModal from '../components/ExportModal'
import ProjectMetaPanel from '../components/editor/ProjectMetaPanel'
import ProjectSettingsPanel from '../components/editor/ProjectSettingsPanel'
import TransitionsPanel from '../components/editor/TransitionsPanel'
import ZoomPanel from '../components/editor/ZoomPanel'
import MediaBin from '../components/MediaBin'
import Preview, { type PreviewHandle } from '../components/Preview'
import Timeline from '../components/Timeline'
import Transport from '../components/Transport'
import {
  api,
  errMsg,
  fileUrl,
  IMAGE_EXTS,
  isProjectFile,
  joinPath,
  LEGACY_PROJECT_EXT,
  PROJECT_EXT,
  VIDEO_EXTS,
} from '../lib/api'
import {
  type Clip,
  type ClipTransition,
  type ClipZoom,
  clipAt,
  clipLen,
  detectExportSettings,
  effectiveTransition,
  type MediaItem,
  type Project,
  pushRecent,
  RESOLUTIONS,
  totalDuration,
  uid,
} from '../lib/project'

interface Props {
  initial: Project
  initialPath: string | null
  /** Videos a importar y poner en la línea de tiempo al abrir (menú contextual). */
  importPaths?: string[]
  onDirtyChange?: (dirty: boolean) => void
  onClose: () => void
}

const AUDIO_KEY = 'creator-studio.videos.audio'

type SideTab = 'media' | 'zoom' | 'transitions' | 'cover' | 'meta' | 'project'
const SIDE_TABS: {
  id: SideTab
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: 'media', label: 'Medios', icon: Filmstrip },
  { id: 'zoom', label: 'Encuadre', icon: Crop },
  { id: 'transitions', label: 'Transiciones', icon: Layers },
  { id: 'cover', label: 'Portada', icon: Picture },
  { id: 'meta', label: 'Metadatos', icon: Tag },
  { id: 'project', label: 'Proyecto', icon: Gear },
]
function loadAudio(): { volume: number; muted: boolean } {
  try {
    const v = JSON.parse(localStorage.getItem(AUDIO_KEY) ?? '{}')
    return { volume: typeof v.volume === 'number' ? v.volume : 1, muted: !!v.muted }
  } catch {
    return { volume: 1, muted: false }
  }
}

const MAX_HISTORY = 100

export default function Editor({
  initial,
  initialPath,
  importPaths,
  onDirtyChange,
  onClose,
}: Props) {
  const [project, setProject] = useState<Project>(initial)
  const [path, setPath] = useState<string | null>(initialPath)
  const [dirty, setDirty] = useState(false)
  const [playhead, setPlayhead] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(40)
  const [importing, setImporting] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [missing, setMissing] = useState<Set<string>>(new Set())
  const [audio, setAudio] = useState(loadAudio)
  const [fullscreen, setFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [sideTab, setSideTab] = useState<SideTab>('media')
  const [sideCollapsed, setSideCollapsed] = useState(() => {
    try {
      return localStorage.getItem('creator-studio.videos.sidebar') === 'collapsed'
    } catch {
      return false
    }
  })
  const [junction, setJunction] = useState<string | null>(null)
  // Arrastre de un medio de la biblioteca hacia la línea de tiempo
  const [binDrag, setBinDrag] = useState<{
    media: MediaItem
    sx: number
    sy: number
    x: number
    y: number
    active: boolean
  } | null>(null)
  const binDragRef = useRef(binDrag)
  binDragRef.current = binDrag
  const history = useRef<Project[]>([])
  const previewRef = useRef<PreviewHandle>(null)
  const projectRef = useRef(project)
  projectRef.current = project

  const media = useMemo(() => new Map(project.media.map((m) => [m.id, m])), [project.media])
  const total = totalDuration(project.clips)
  const res = RESOLUTIONS[project.export.resolution]
  const aspect = project.export.orientation === 'portrait' ? res.h / res.w : res.w / res.h

  /** Cambia el proyecto. `record` guarda el estado previo para deshacer. */
  const update = useCallback((fn: (p: Project) => Project, record = true) => {
    if (record) {
      history.current.push(projectRef.current)
      if (history.current.length > MAX_HISTORY) history.current.shift()
    }
    setProject((p) => fn(p))
    setDirty(true)
  }, [])

  const undo = useCallback(() => {
    const prev = history.current.pop()
    if (prev) {
      setProject(prev)
      setDirty(true)
    }
  }, [])

  // Al abrir: verificar archivos y regenerar miniaturas
  useEffect(() => {
    ;(async () => {
      const miss = new Set<string>()
      const thumbs: Record<string, string> = {}
      const posters: Record<string, string> = {}
      for (const m of initial.media) {
        if (!(await api.fileExists(m.path))) {
          miss.add(m.id)
          continue
        }
        try {
          thumbs[m.id] = await api.thumbnail(m.path, Math.min(1, m.duration / 2))
          // Se vuelve a leer: la portada pudo cambiar (p. ej. desde el Metadata Manager)
          const poster = await api.readCover(m.path).catch(() => null)
          if (poster) posters[m.id] = poster
        } catch {
          /* ignorar */
        }
      }
      setMissing(miss)
      setProject((p) => ({
        ...p,
        media: p.media.map((m) => ({
          ...m,
          thumb: thumbs[m.id] ?? m.thumb,
          poster: posters[m.id],
        })),
      }))
      if (miss.size) toast.warning(`${miss.size} archivo(s) del proyecto no se encontraron`)
    })()
  }, [initial])

  // Proyecto creado desde el Explorador: importar los videos y guardar.
  const didImport = useRef(false)
  const [saveAfterImport, setSaveAfterImport] = useState(false)

  // Llaves obligatorias: lo que devuelve un efecto React lo usa como limpieza.
  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])
  useUnsavedChanges(dirty)

  useEffect(() => {
    try {
      localStorage.setItem(AUDIO_KEY, JSON.stringify(audio))
    } catch {
      /* ignorar */
    }
  }, [audio])

  const toggleMute = useCallback(
    () => setAudio((a) => ({ ...a, muted: !a.muted || a.volume === 0, volume: a.volume || 1 })),
    [],
  )
  const setVolume = useCallback((volume: number) => setAudio({ volume, muted: volume === 0 }), [])

  // Pantalla completa SOLO del video (Fullscreen API sobre el reproductor).
  // La ventana también pasa a pantalla completa para que el video cubra el monitor.
  const videoWrapRef = useRef<HTMLDivElement>(null)
  const fullscreenRef = useRef(fullscreen)
  fullscreenRef.current = fullscreen
  const toggleFullscreen = useCallback(async (force?: boolean) => {
    const el = videoWrapRef.current
    if (!el) return
    const next = force ?? !document.fullscreenElement
    try {
      if (next && !document.fullscreenElement) {
        await el.requestFullscreen({ navigationUI: 'hide' })
        await getCurrentWindow()
          .setFullscreen(true)
          .catch(() => {})
      } else if (!next && document.fullscreenElement) {
        await document.exitFullscreen()
      }
    } catch {
      /* ignorar */
    }
  }, [])
  useEffect(() => {
    const onChange = () => {
      const on =
        document.fullscreenElement != null && document.fullscreenElement === videoWrapRef.current
      setFullscreen(on)
      if (!on)
        getCurrentWindow()
          .setFullscreen(false)
          .catch(() => {})
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
      getCurrentWindow()
        .setFullscreen(false)
        .catch(() => {})
    }
  }, [])

  // Ocultar controles en pantalla completa tras 2.5 s sin mover el mouse
  const hideTimer = useRef<number | undefined>(undefined)
  const pokeControls = useCallback(() => {
    setControlsVisible(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), 2500)
  }, [])
  useEffect(() => {
    if (fullscreen) pokeControls()
    else setControlsVisible(true)
  }, [fullscreen, pokeControls])

  useEffect(() => {
    getCurrentWindow()
      .setTitle(`${dirty ? '● ' : ''}${project.name} — Creator Studio`)
      .catch(() => {})
  }, [project.name, dirty])

  useEffect(() => {
    if (playhead > total) setPlayhead(total)
  }, [total, playhead])

  // ---------- Medios ----------
  const importPathsImpl = useCallback(
    async (paths: string[], addToTimeline: boolean) => {
      setImporting(true)
      const added: MediaItem[] = []
      for (const p of paths) {
        try {
          const info = await api.probe(p)
          let thumb: string | undefined
          try {
            thumb = await api.thumbnail(p, Math.min(1, info.duration / 2))
          } catch {
            /* sin miniatura */
          }
          const poster =
            info.coverStream != null
              ? ((await api.readCover(p).catch(() => null)) ?? undefined)
              : undefined
          added.push({ ...info, id: uid(), thumb, poster })
        } catch (e) {
          toast.danger(`No se pudo importar ${p.split(/[\\/]/).pop()}`, { description: errMsg(e) })
        }
      }
      setImporting(false)
      if (!added.length) return added
      update((pr) => ({
        ...pr,
        // Primer video del proyecto: el formato de salida se ajusta a él
        export: pr.media.length === 0 ? detectExportSettings(added[0], pr.export) : pr.export,
        media: [...pr.media, ...added],
        clips: addToTimeline
          ? [
              ...pr.clips,
              ...added.map((m) => ({ id: uid(), mediaId: m.id, in: 0, out: m.duration })),
            ]
          : pr.clips,
      }))
      return added
    },
    [update],
  )

  useEffect(() => {
    if (!importPaths?.length || didImport.current) return
    didImport.current = true
    importPathsImpl(importPaths, true).then(async (added) => {
      // Si el video ya trae portada, usarla como portada del proyecto
      const withCover = added.find((m) => m.coverStream != null)
      if (withCover) {
        try {
          const cover = await api.readCover(withCover.path)
          if (cover) {
            update((p) => (p.cover ? p : { ...p, cover }), false)
            toast('Se usó la portada del video como portada del proyecto')
          }
        } catch {
          /* sin portada */
        }
      }
      setSaveAfterImport(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function importDialog() {
    const sel = await open({
      multiple: true,
      filters: [{ name: 'Videos', extensions: VIDEO_EXTS }],
    })
    if (sel) importPathsImpl(Array.isArray(sel) ? sel : [sel], false)
  }

  // Arrastrar archivos desde el explorador de archivos (solo con la sección visible)
  const active = useSectionActive()
  useEffect(() => {
    if (!active) return
    const un = getCurrentWebview().onDragDropEvent((e) => {
      if (e.payload.type === 'drop') {
        const vids = e.payload.paths.filter((p) =>
          VIDEO_EXTS.includes(p.split('.').pop()?.toLowerCase() ?? ''),
        )
        if (vids.length) importPathsImpl(vids, true)
      }
    })
    return () => {
      un.then((f) => f())
    }
  }, [importPathsImpl, active])

  const addToTimeline = (m: MediaItem) =>
    update((p) => ({
      ...p,
      clips: [...p.clips, { id: uid(), mediaId: m.id, in: 0, out: m.duration }],
    }))

  const insertAt = (m: MediaItem, index: number) =>
    update((p) => {
      const clips = [...p.clips]
      clips.splice(Math.min(index, clips.length), 0, {
        id: uid(),
        mediaId: m.id,
        in: 0,
        out: m.duration,
      })
      return { ...p, clips }
    })

  const binDragging = binDrag != null
  useEffect(() => {
    if (!binDragging) return
    const move = (e: PointerEvent) =>
      setBinDrag((d) =>
        d
          ? {
              ...d,
              x: e.clientX,
              y: e.clientY,
              active: d.active || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6,
            }
          : d,
      )
    // Si no llegó a activarse (fue un clic), se limpia aquí; si estaba activo lo resuelve onExternalDrop.
    const up = () => setTimeout(() => setBinDrag(null), 0)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [binDragging])

  const onExternalDrop = (index: number | null) => {
    const d = binDragRef.current
    if (d?.active && index != null) {
      insertAt(d.media, index)
      toast(`Agregado: ${d.media.name}`)
    }
    setBinDrag(null)
  }

  const removeMedia = (m: MediaItem) =>
    update((p) => ({
      ...p,
      media: p.media.filter((x) => x.id !== m.id),
      clips: p.clips.filter((c) => c.mediaId !== m.id),
    }))

  // ---------- Edición ----------
  const splitAtPlayhead = useCallback(() => {
    const p = projectRef.current
    const hit = clipAt(p.clips, playhead)
    if (!hit) return
    const local = hit.clip.in + (playhead - hit.start)
    if (local - hit.clip.in < 0.05 || hit.clip.out - local < 0.05) return
    const a: Clip = { ...hit.clip, out: local }
    const b: Clip = { ...hit.clip, id: uid(), in: local }
    update((pr) => {
      const clips = [...pr.clips]
      clips.splice(hit.index, 1, a, b)
      return { ...pr, clips }
    })
    setSelectedId(b.id)
  }, [playhead, update])

  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    update((p) => ({ ...p, clips: p.clips.filter((c) => c.id !== selectedId) }))
    setSelectedId(null)
  }, [selectedId, update])

  const trim = useCallback(
    (id: string, inPoint: number, outPoint: number) =>
      update(
        (p) => ({
          ...p,
          clips: p.clips.map((c) => (c.id === id ? { ...c, in: inPoint, out: outPoint } : c)),
        }),
        false,
      ),
    [update],
  )

  const reorder = useCallback(
    (from: number, to: number) =>
      update((p) => {
        const clips = [...p.clips]
        const [c] = clips.splice(from, 1)
        clips.splice(to, 0, c)
        return { ...p, clips }
      }, false),
    [update],
  )

  const beginEdit = useCallback(() => {
    history.current.push(projectRef.current)
    if (history.current.length > MAX_HISTORY) history.current.shift()
  }, [])

  // ---------- Transiciones y metadata ----------
  const setTransition = useCallback(
    (clipId: string, t: ClipTransition | undefined) =>
      update((p) => ({
        ...p,
        clips: p.clips.map((c) => (c.id === clipId ? { ...c, transition: t } : c)),
      })),
    [update],
  )
  const setAllTransitions = useCallback(
    (t: ClipTransition | undefined) =>
      update((p) => ({
        ...p,
        clips: p.clips.map((c, i) => (i < p.clips.length - 1 ? { ...c, transition: t } : c)),
      })),
    [update],
  )
  const setClipZoom = useCallback(
    (clipId: string, zoom: ClipZoom | undefined) =>
      update(
        (p) => ({ ...p, clips: p.clips.map((c) => (c.id === clipId ? { ...c, zoom } : c)) }),
        false,
      ),
    [update],
  )
  const lastZoomEdit = useRef(0)
  // Clip del panel Encuadre: el seleccionado o, si no hay, el que está bajo el cabezal
  const zoomClipIndex = (() => {
    const i = project.clips.findIndex((c) => c.id === selectedId)
    return i >= 0 ? i : (clipAt(project.clips, playhead)?.index ?? -1)
  })()
  const setMeta = useCallback(
    (key: string, value: string) =>
      update((p) => ({ ...p, metadata: { ...(p.metadata ?? {}), [key]: value } }), false),
    [update],
  )
  const openSide = (tab: SideTab) => {
    setSideTab(tab)
    setSideCollapsed(false)
  }
  useEffect(() => {
    try {
      localStorage.setItem('creator-studio.videos.sidebar', sideCollapsed ? 'collapsed' : 'open')
    } catch {
      /* ignorar */
    }
  }, [sideCollapsed])

  // Puntos de transición para la vista previa aproximada
  const dips = useMemo(() => {
    const out: { at: number; d: number; color: string }[] = []
    let acc = 0
    project.clips.forEach((c, i) => {
      acc += clipLen(c)
      const d = effectiveTransition(c, project.clips[i + 1])
      if (d > 0)
        out.push({ at: acc, d, color: c.transition?.kind === 'fadewhite' ? '#fff' : '#000' })
    })
    return out
  }, [project.clips])

  // ---------- Portada ----------
  async function captureCover() {
    const src = previewRef.current?.sourceAt(playhead)
    if (!src) return
    setPlaying(false)
    setCapturing(true)
    try {
      // Mismo encuadre y zoom que el video exportado
      const r = RESOLUTIONS[project.export.resolution]
      const [fw, fh] = project.export.orientation === 'portrait' ? [r.h, r.w] : [r.w, r.h]
      const zoom = clipAt(project.clips, playhead)?.clip.zoom ?? null
      const img = await api.captureFrame(src.path, src.time, { width: fw, height: fh, zoom })
      update((p) => ({ ...p, cover: img }))
      toast.success('Fotograma capturado como portada')
    } catch (e) {
      toast.danger('No se pudo capturar el fotograma', { description: errMsg(e) })
    } finally {
      setCapturing(false)
    }
  }

  async function pickCover() {
    const sel = await open({ filters: [{ name: 'Imágenes', extensions: IMAGE_EXTS }] })
    if (typeof sel === 'string') update((p) => ({ ...p, cover: sel }))
  }

  // ---------- Guardar / cerrar ----------
  const saveProject = useCallback(
    async (saveAs = false) => {
      let target = path
      if (!target || saveAs) {
        const dir = await api.projectsDir().catch(() => null)
        const file = `${projectRef.current.name.replace(/[\\/:*?"<>|]/g, '_')}.${PROJECT_EXT}`
        const sel = await save({
          defaultPath: dir ? joinPath(dir, file) : file,
          filters: [{ name: 'Proyecto de video', extensions: [PROJECT_EXT, LEGACY_PROJECT_EXT] }],
        })
        if (!sel) return false
        target = isProjectFile(sel) ? sel : `${sel}.${PROJECT_EXT}`
      }
      try {
        await api.saveText(target, JSON.stringify(projectRef.current, null, 2))
        setPath(target)
        setDirty(false)
        pushRecent(target, projectRef.current.name)
        toast.success('Proyecto guardado')
        return true
      } catch (e) {
        toast.danger('No se pudo guardar', { description: errMsg(e) })
        return false
      }
    },
    [path],
  )

  // Guardar automáticamente cuando termina la importación inicial (ya con el estado aplicado).
  useEffect(() => {
    if (!saveAfterImport) return
    setSaveAfterImport(false)
    saveProject(false)
  }, [saveAfterImport, saveProject])

  async function close() {
    if (dirty) {
      const ok = await ask('Hay cambios sin guardar. ¿Salir de todos modos?', {
        title: 'Creator Studio',
        kind: 'warning',
        okLabel: 'Salir sin guardar',
        cancelLabel: 'Cancelar',
      })
      if (!ok) return
    }
    getCurrentWindow()
      .setTitle('Creator Studio')
      .catch(() => {})
    onClose()
  }

  // ---------- Atajos (solo con la sección visible) ----------
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || exportOpen) return
      if ((e.target as HTMLElement)?.closest?.('[role="slider"],[role="listbox"],[role="dialog"]'))
        return
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveProject(e.shiftKey)
      } else if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      } else if (e.code === 'Space') {
        // Captura: evita que un botón enfocado también reciba el Espacio.
        e.preventDefault()
        e.stopPropagation()
        if (projectRef.current.clips.length) setPlaying((v) => !v)
      } else if (e.key === 'Escape' && fullscreenRef.current) {
        e.preventDefault()
        toggleFullscreen(false)
      } else if (e.key.toLowerCase() === 'f' && !e.ctrlKey) {
        toggleFullscreen()
      } else if (e.key.toLowerCase() === 'm' && !e.ctrlKey) {
        toggleMute()
      } else if (e.key.toLowerCase() === 's' && !e.ctrlKey) {
        splitAtPlayhead()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected()
      } else if (e.key === 'ArrowLeft') {
        setPlaying(false)
        setPlayhead((t) => Math.max(0, t - (e.shiftKey ? 1 : 1 / 60)))
      } else if (e.key === 'ArrowRight') {
        setPlaying(false)
        setPlayhead((t) => Math.min(total, t + (e.shiftKey ? 1 : 1 / 60)))
      } else if (e.key === 'Home') {
        setPlayhead(0)
      } else if (e.key === 'End') {
        setPlayhead(total)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [
    active,
    saveProject,
    undo,
    splitAtPlayhead,
    deleteSelected,
    total,
    exportOpen,
    toggleFullscreen,
    toggleMute,
  ])

  const seek = useCallback((t: number) => {
    setPlaying(false)
    setPlayhead(t)
  }, [])

  const tip = (label: string, key?: string) => (
    <Tooltip.Content>
      {label} {key && <Kbd className="ml-1">{key}</Kbd>}
    </Tooltip.Content>
  )

  return (
    <div className="relative flex h-full flex-col text-white">
      <PageBackdrop />
      {/* Barra superior */}
      <AppHeader
        section="Videos"
        onBack={close}
        backLabel="Volver a mis proyectos"
        title={
          <input
            className="min-w-0 max-w-sm rounded-lg bg-transparent px-1.5 py-0.5 -ml-1.5 text-base font-semibold outline-none transition hover:bg-white/5 focus:bg-white/10 focus:ring-1 focus:ring-accent/60"
            value={project.name}
            onChange={(e) => update((p) => ({ ...p, name: e.target.value }), false)}
            aria-label="Nombre del proyecto"
          />
        }
        subtitle={
          dirty ? (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
              <span className="size-1.5 rounded-full bg-amber-400" /> Sin guardar
            </span>
          ) : path ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-400" /> Guardado
            </span>
          ) : null
        }
        right={
          <div className="flex items-center gap-2">
            <Tooltip delay={300}>
              <Button size="sm" variant="ghost" onPress={undo} isDisabled={!history.current.length}>
                <ArrowShapeTurnUpLeft />
                Deshacer
              </Button>
              {tip('Deshacer', 'Ctrl+Z')}
            </Tooltip>
            <Tooltip delay={300}>
              <Button size="sm" variant="secondary" onPress={() => saveProject()}>
                <FloppyDisk />
                Guardar
              </Button>
              {tip('Guardar proyecto', 'Ctrl+S')}
            </Tooltip>
            <Button
              size="sm"
              onPress={() => setExportOpen(true)}
              isDisabled={!project.clips.length}
              className="shadow-[0_0_24px_rgba(231,0,11,0.45)]"
            >
              <ArrowUpFromSquare />
              Exportar
            </Button>
          </div>
        }
      />

      {/* Zona superior: barra lateral (40%) · vista previa (60%) */}
      <div className="relative flex min-h-0 flex-1 gap-3 p-3 pb-0">
        <Panel
          className={`flex shrink-0 transition-[width] duration-300 ${sideCollapsed ? 'w-14' : 'w-[40%] min-w-[380px]'}`}
        >
          {/* Riel de pestañas */}
          <nav
            className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-white/[0.06] bg-black/60 py-2"
            aria-label="Paneles"
          >
            {SIDE_TABS.map((t) => {
              const active = !sideCollapsed && sideTab === t.id
              return (
                <Tooltip key={t.id} delay={300}>
                  <button
                    type="button"
                    aria-label={t.label}
                    onClick={() => (active ? setSideCollapsed(true) : openSide(t.id))}
                    className={`relative flex size-10 items-center justify-center rounded-xl transition ${
                      active
                        ? 'bg-red-600 text-white shadow-[0_0_20px_-4px_rgba(231,0,11,0.8)]'
                        : 'text-white/55 hover:bg-white/[0.07] hover:text-white'
                    }`}
                  >
                    <t.icon className="size-5" />
                    {t.id === 'transitions' && dips.length > 0 && (
                      <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-white text-[9px] font-bold text-black">
                        {dips.length}
                      </span>
                    )}
                  </button>
                  <Tooltip.Content placement="right">{t.label}</Tooltip.Content>
                </Tooltip>
              )
            })}
            <div className="flex-1" />
            <Tooltip delay={300}>
              <button
                type="button"
                aria-label={sideCollapsed ? 'Expandir panel' : 'Contraer panel'}
                onClick={() => setSideCollapsed((v) => !v)}
                className="flex size-10 items-center justify-center rounded-xl text-white/45 transition hover:bg-white/[0.07] hover:text-white"
              >
                {sideCollapsed ? (
                  <ChevronsRight className="size-5" />
                ) : (
                  <ChevronsLeft className="size-5" />
                )}
              </button>
              <Tooltip.Content placement="right">
                {sideCollapsed ? 'Expandir panel' : 'Contraer panel'}
              </Tooltip.Content>
            </Tooltip>
          </nav>

          {/* Contenido de la pestaña */}
          {!sideCollapsed && (
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-2 border-b border-white/[0.06] bg-black/25 px-4 py-2.5">
                <h2 className="text-sm font-semibold">
                  {SIDE_TABS.find((t) => t.id === sideTab)?.label}
                </h2>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {sideTab === 'media' && (
                  <MediaBin
                    media={project.media}
                    importing={importing}
                    missing={missing}
                    onImport={importDialog}
                    onAdd={addToTimeline}
                    onRemove={removeMedia}
                    onDragStart={(m, e) =>
                      setBinDrag({
                        media: m,
                        sx: e.clientX,
                        sy: e.clientY,
                        x: e.clientX,
                        y: e.clientY,
                        active: false,
                      })
                    }
                  />
                )}
                {sideTab === 'zoom' && (
                  <ZoomPanel
                    clip={project.clips[zoomClipIndex] ?? null}
                    index={zoomClipIndex}
                    media={media}
                    aspect={aspect}
                    onChange={(id, z) => {
                      // Un solo paso de deshacer por ráfaga de ajustes
                      if (Date.now() - lastZoomEdit.current > 800) beginEdit()
                      lastZoomEdit.current = Date.now()
                      setClipZoom(id, z)
                    }}
                  />
                )}
                {sideTab === 'transitions' && (
                  <TransitionsPanel
                    clips={project.clips}
                    media={media}
                    selected={junction}
                    onSelect={setJunction}
                    onChange={setTransition}
                    onApplyAll={setAllTransitions}
                  />
                )}
                {sideTab === 'cover' && (
                  <CoverPanel
                    cover={project.cover}
                    capturing={capturing}
                    canCapture={project.clips.length > 0}
                    onCapture={captureCover}
                    onPickImage={pickCover}
                    onClear={() => update((p) => ({ ...p, cover: null }))}
                  />
                )}
                {sideTab === 'meta' && (
                  <ProjectMetaPanel metadata={project.metadata ?? {}} onChange={setMeta} />
                )}
                {sideTab === 'project' && (
                  <ProjectSettingsPanel
                    project={project}
                    firstMedia={
                      project.clips[0]
                        ? (media.get(project.clips[0].mediaId) ?? null)
                        : (project.media[0] ?? null)
                    }
                    onChange={(ex) => update((p) => ({ ...p, export: ex }))}
                  />
                )}
              </div>
            </div>
          )}
        </Panel>

        <Panel className="flex min-w-0 flex-1 flex-col">
          <div
            ref={videoWrapRef}
            className="relative min-h-0 flex-1 bg-black"
            style={fullscreen && !controlsVisible ? { cursor: 'none' } : undefined}
            onPointerMove={fullscreen ? pokeControls : undefined}
            onDoubleClick={() => toggleFullscreen()}
          >
            <Preview
              ref={previewRef}
              clips={project.clips}
              media={media}
              playhead={playhead}
              playing={playing}
              aspect={aspect}
              volume={audio.volume}
              muted={audio.muted}
              dips={dips}
              onPan={(id, x, y) => {
                const c = project.clips.find((cl) => cl.id === id)
                if (c?.zoom) setClipZoom(id, { ...c.zoom, x, y })
              }}
              onTime={setPlayhead}
              onEnded={() => setPlaying(false)}
            />
            {fullscreen && (
              <div
                className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-6 pb-4 pt-16 transition-opacity duration-300 ${
                  controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
                onDoubleClick={(e) => e.stopPropagation()}
              >
                <Transport
                  overlay
                  playhead={playhead}
                  total={total}
                  playing={playing}
                  disabled={!project.clips.length}
                  volume={audio.volume}
                  muted={audio.muted}
                  fullscreen
                  onTogglePlay={() => setPlaying((v) => !v)}
                  onSeek={seek}
                  onVolume={setVolume}
                  onToggleMute={toggleMute}
                  onToggleFullscreen={() => toggleFullscreen(false)}
                />
              </div>
            )}
          </div>
          <div className="border-t border-white/[0.06] bg-black/20 px-3 py-2">
            <Transport
              playhead={playhead}
              total={total}
              playing={playing}
              disabled={!project.clips.length}
              volume={audio.volume}
              muted={audio.muted}
              fullscreen={false}
              onTogglePlay={() => setPlaying((v) => !v)}
              onSeek={seek}
              onVolume={setVolume}
              onToggleMute={toggleMute}
              onToggleFullscreen={() => toggleFullscreen(true)}
            />
          </div>
        </Panel>
      </div>

      {/* Línea de tiempo */}
      <Panel className="relative m-3 flex shrink-0 flex-col">
        <div className="flex items-center gap-1 border-b border-white/[0.06] px-3 py-1.5">
          <Tooltip delay={300}>
            <Button
              size="sm"
              variant="ghost"
              onPress={splitAtPlayhead}
              isDisabled={!project.clips.length}
            >
              <Scissors />
              Dividir
            </Button>
            {tip('Dividir en el cabezal', 'S')}
          </Tooltip>
          <Tooltip delay={300}>
            <Button size="sm" variant="ghost" onPress={deleteSelected} isDisabled={!selectedId}>
              <TrashBin />
              Eliminar
            </Button>
            {tip('Eliminar clip seleccionado', 'Supr')}
          </Tooltip>
          <Tooltip delay={300}>
            <Button
              size="sm"
              variant="ghost"
              onPress={captureCover}
              isDisabled={!project.clips.length}
              isPending={capturing}
            >
              <Camera />
              Captura → portada
            </Button>
            {tip('Usar el fotograma actual como portada')}
          </Tooltip>
          <Separator orientation="vertical" className="mx-2 h-5" />
          <span className="section-title mr-2">Línea de tiempo</span>
          <span className="text-xs text-muted">
            Arrastra medios a la pista · bordes para recortar · clip para reordenar.
          </span>
          <div className="flex-1" />
          <MagnifierMinus className="text-muted" />
          <Slider
            aria-label="Zoom"
            className="w-40"
            minValue={5}
            maxValue={300}
            value={zoom}
            onChange={(v) => setZoom(Array.isArray(v) ? v[0] : v)}
          >
            <Slider.Track>
              <Slider.Fill />
              <Slider.Thumb />
            </Slider.Track>
          </Slider>
          <MagnifierPlus className="text-muted" />
        </div>

        <div className="h-36 shrink-0">
          <Timeline
            clips={project.clips}
            media={media}
            playhead={playhead}
            zoom={zoom}
            selectedId={selectedId}
            onSeek={seek}
            onSelect={setSelectedId}
            onBeginEdit={beginEdit}
            onTrim={trim}
            onReorder={reorder}
            selectedJunction={sideTab === 'transitions' && !sideCollapsed ? junction : null}
            onSelectJunction={(id) => {
              setJunction(id)
              openSide('transitions')
            }}
            externalDrag={binDrag?.active ? { x: binDrag.x, y: binDrag.y } : null}
            onExternalDrop={onExternalDrop}
          />
        </div>
      </Panel>

      {binDrag?.active && (
        <div
          className="pointer-events-none fixed z-50 w-40 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border-2 border-red-600 bg-[#141416] shadow-[0_20px_50px_-10px_rgba(231,0,11,0.6)]"
          style={{ left: binDrag.x, top: binDrag.y }}
        >
          <div className="aspect-video bg-black">
            {(binDrag.media.poster ?? binDrag.media.thumb) && (
              <img
                alt=""
                src={fileUrl(binDrag.media.poster ?? binDrag.media.thumb!)}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <p className="truncate px-2 py-1 text-[11px]">{binDrag.media.name}</p>
        </div>
      )}

      <ExportModal
        isOpen={exportOpen}
        onOpenChange={setExportOpen}
        project={project}
        media={media}
        onSettings={(s) => update((p) => ({ ...p, export: s }), false)}
        onEditSettings={() => {
          setExportOpen(false)
          openSide('project')
        }}
      />
    </div>
  )
}
