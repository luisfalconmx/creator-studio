import { ActionCard, HomeBackdrop, HomeFooter, HomeHero, HomeTopBar } from '@creator-studio/ui'
import {
  Clock,
  Display,
  Filmstrip,
  Folder,
  FolderOpen,
  Picture,
  Play,
  Plus,
  Speedometer,
  TrashBin,
  Xmark,
} from '@gravity-ui/icons'
import { Button, Input, Label, Modal, TextField, toast } from '@heroui/react'
import { open } from '@tauri-apps/plugin-dialog'
import { openPath as openInExplorer, revealItemInDir } from '@tauri-apps/plugin-opener'
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  api,
  errMsg,
  fileUrl,
  inTauri,
  isProjectFile,
  joinPath,
  LEGACY_PROJECT_EXT,
  PROJECT_EXT,
  type ProjectEntry,
  VIDEO_EXTS,
} from '../lib/api'
import {
  createProjectFile,
  formatTime,
  getRecents,
  type Project,
  pushRecent,
  removeRecent,
} from '../lib/project'

interface Props {
  ffmpegVersion: string | null
  onOpenProject: (p: Project, path: string | null) => void
  /** Abre uno o varios videos como un proyecto nuevo. */
  onOpenVideos: (paths: string[]) => void
  onMetadata: () => void
}

const sameDir = (file: string, dir: string) =>
  file.toLowerCase().replace(/[\\/][^\\/]*$/, '') === dir.toLowerCase().replace(/[\\/]+$/, '')

const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
function timeAgo(ms: number) {
  const diff = (ms - Date.now()) / 1000
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [u, s] of units) if (Math.abs(diff) >= s) return rtf.format(Math.round(diff / s), u)
  return 'justo ahora'
}

const GRADIENTS = [
  'from-red-600 via-red-800 to-zinc-950',
  'from-red-500 via-rose-700 to-zinc-950',
  'from-rose-600 via-red-700 to-black',
  'from-red-700 via-red-900 to-zinc-900',
  'from-zinc-700 via-red-800 to-red-950',
]
const gradientFor = (s: string) =>
  GRADIENTS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADIENTS.length]

/** Datos de ejemplo solo para ver el diseño en el navegador durante el desarrollo. */
const DEV_SAMPLE: ProjectEntry[] = [
  {
    path: 'C:\\Users\\demo\\AppData\\Roaming\\com.luisfalconmx.creatorstudio\\projects\\Vlog Japón.cstudio',
    name: 'Vlog Japón 2026',
    clips: 14,
    media: 9,
    modified: Date.now() - 3600e3,
    duration: 754,
    cover: null,
    previewPath: null,
    previewTime: 0,
    resolution: '2160p',
    fps: 60,
    orientation: 'landscape',
  },
  {
    path: 'C:\\Users\\demo\\AppData\\Roaming\\com.luisfalconmx.creatorstudio\\projects\\Tutorial.cstudio',
    name: 'Tutorial de React',
    clips: 6,
    media: 3,
    modified: Date.now() - 86400e3 * 2,
    duration: 1290,
    cover: null,
    previewPath: null,
    previewTime: 0,
    resolution: '1080p',
    fps: 60,
    orientation: 'landscape',
  },
  {
    path: 'C:\\Users\\demo\\AppData\\Roaming\\com.luisfalconmx.creatorstudio\\projects\\Shorts.cstudio',
    name: 'Shorts semana 47',
    clips: 3,
    media: 3,
    modified: Date.now() - 86400e3 * 6,
    duration: 58,
    cover: null,
    previewPath: null,
    previewTime: 0,
    resolution: '1080p',
    fps: 60,
    orientation: 'portrait',
  },
  {
    path: 'C:\\Users\\demo\\AppData\\Roaming\\com.luisfalconmx.creatorstudio\\projects\\Boda.cstudio',
    name: 'Boda Ana & Leo',
    clips: 22,
    media: 17,
    modified: Date.now() - 86400e3 * 20,
    duration: 2410,
    cover: null,
    previewPath: null,
    previewTime: 0,
    resolution: '1440p',
    fps: 60,
    orientation: 'landscape',
  },
]

/** Miniaturas de los proyectos: portada si existe, si no un fotograma del primer clip. */
function useProjectThumbs(projects: ProjectEntry[]) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  useEffect(() => {
    let alive = true
    ;(async () => {
      for (const p of projects) {
        let url: string | null = null
        if (p.cover) url = fileUrl(p.cover)
        else if (p.previewPath) {
          try {
            url = fileUrl(await api.thumbnail(p.previewPath, p.previewTime, 1280))
          } catch {
            /* sin miniatura */
          }
        }
        if (url && alive) setThumbs((t) => ({ ...t, [p.path]: url! }))
      }
    })()
    return () => {
      alive = false
    }
  }, [projects])
  return thumbs
}

export default function Home({ ffmpegVersion, onOpenProject, onOpenVideos, onMetadata }: Props) {
  const [recents, setRecents] = useState(getRecents)
  const [projects, setProjects] = useState<ProjectEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [projectsDir, setProjectsDir] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [name, setName] = useState('Mi video')
  const [targetDir, setTargetDir] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const thumbs = useProjectThumbs(projects)
  const [toDelete, setToDelete] = useState<ProjectEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      if (inTauri()) await api.deleteProject(toDelete.path)
      setProjects((list) => list.filter((p) => p.path !== toDelete.path))
      removeRecent(toDelete.path)
      setRecents(getRecents())
      toast.success(`"${toDelete.name}" se movió a la Papelera`, {
        description: 'Puedes recuperarlo desde la Papelera.',
      })
      setToDelete(null)
    } catch (e) {
      toast.danger('No se pudo eliminar el proyecto', { description: errMsg(e) })
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (!inTauri() && import.meta.env.DEV) {
      setProjectsDir('C:\\Users\\demo\\AppData\\Roaming\\com.luisfalconmx.creatorstudio\\projects')
      setProjects(DEV_SAMPLE)
      setLoaded(true)
      return
    }
    api
      .projectsDir()
      .then(setProjectsDir)
      .catch(() => {})
    api
      .listProjects()
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  async function openPath(path: string) {
    try {
      const text = await api.loadText(path)
      const p = JSON.parse(text) as Project
      if (p.version !== 1 || !Array.isArray(p.clips))
        throw new Error('Archivo de proyecto no válido.')
      pushRecent(path, p.name)
      onOpenProject(p, path)
    } catch (e) {
      toast.danger('No se pudo abrir el proyecto', { description: errMsg(e) })
      removeRecent(path)
      setRecents(getRecents())
    }
  }

  /** Abrir: un proyecto de video, o uno o varios videos como proyecto nuevo. */
  async function openDialog() {
    const sel = await open({
      multiple: true,
      defaultPath: projectsDir ?? undefined,
      title: 'Abrir proyecto o video',
      filters: [
        {
          name: 'Proyectos y videos',
          extensions: [PROJECT_EXT, LEGACY_PROJECT_EXT, ...VIDEO_EXTS],
        },
        { name: 'Proyecto de video', extensions: [PROJECT_EXT, LEGACY_PROJECT_EXT] },
        { name: 'Videos (abrir como proyecto)', extensions: VIDEO_EXTS },
      ],
    })
    const paths = sel == null ? [] : Array.isArray(sel) ? sel : [sel]
    if (!paths.length) return
    const project = paths.find(isProjectFile)
    if (project) {
      if (paths.length > 1) toast('Se abrió el proyecto; los demás archivos se ignoraron.')
      openPath(project)
    } else {
      onOpenVideos(paths)
    }
  }

  async function create() {
    if (!name.trim()) return
    setCreating(true)
    try {
      const { project, path } = await createProjectFile(name.trim(), targetDir)
      setNewOpen(false)
      onOpenProject(project, path)
    } catch (e) {
      toast.danger('No se pudo crear el proyecto', { description: errMsg(e) })
    } finally {
      setCreating(false)
    }
  }

  async function pickTargetDir() {
    const sel = await open({ directory: true, defaultPath: targetDir ?? projectsDir ?? undefined })
    if (typeof sel === 'string') setTargetDir(sel)
  }

  const newProject = () => {
    setTargetDir(null)
    setNewOpen(true)
  }

  const otherRecents = projectsDir ? recents.filter((r) => !sameDir(r.path, projectsDir)) : recents
  const location = targetDir ?? projectsDir
  const fileName = `${(name.trim() || 'Proyecto').replace(/[\\/:*?"<>|]/g, '_')}.${PROJECT_EXT}`
  const [featured, ...rest] = projects
  const hasProjects = projects.length > 0
  const sceneImages = useMemo(() => Object.values(thumbs).slice(0, 8), [thumbs])

  return (
    <div className="relative h-full overflow-hidden bg-[#050507] text-white">
      <HomeBackdrop motif="video" images={sceneImages} />

      <div className="relative h-full overflow-y-auto overflow-x-hidden">
        <div className="mx-auto flex w-full max-w-7xl flex-col px-8 pb-16 lg:px-12">
          <HomeTopBar
            icon={<Filmstrip />}
            title="Videos"
            status={{
              ok: !!ffmpegVersion,
              label: ffmpegVersion ? 'Motor de video listo' : 'ffmpeg no detectado',
              title: ffmpegVersion ?? '',
            }}
          />

          {/* Vista 1 · sin proyectos: bienvenida + tarjetas de acción */}
          {loaded && !hasProjects && (
            <>
              <HomeHero
                badge="4K · 60 fps · sin marcas de agua · sin re-codificar metadata"
                title={
                  <>
                    Edita a la velocidad
                    <br />
                    de <span className="text-shimmer">tus ideas.</span>
                  </>
                }
                desc="Corta, une y exporta tus clips en calidad de estudio. Ponle portada y metadata a cualquier video en segundos."
              />
              <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <ActionCard
                  delay={0.45}
                  icon={<Filmstrip className="size-6" />}
                  accent="from-red-500 to-red-700"
                  title="Editor de video"
                  desc="Línea de tiempo, recortes, transiciones y exportación hasta 4K a 60 fps."
                  cta="Crear proyecto"
                  onPress={newProject}
                />
                <ActionCard
                  delay={0.52}
                  icon={<FolderOpen className="size-6" />}
                  accent="from-red-600 to-rose-900"
                  title="Abrir proyecto o video"
                  desc="Continúa un proyecto o abre uno o varios videos como proyecto nuevo."
                  cta="Buscar archivo"
                  onPress={openDialog}
                />
                <ActionCard
                  delay={0.59}
                  icon={<Picture className="size-6" />}
                  accent="from-rose-600 to-red-950"
                  title="Metadatos"
                  desc="Título, portada y metadata de tus videos, o revisa una carpeta completa. Sin renderizar."
                  cta="Editar metadatos"
                  onPress={onMetadata}
                />
              </section>
            </>
          )}

          {/* Vista 2 · con proyectos: acciones rápidas */}
          {loaded && hasProjects && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="mt-6 flex flex-wrap items-center gap-3"
            >
              <button
                type="button"
                onClick={newProject}
                className="group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-2xl bg-white px-6 font-semibold text-black shadow-[0_0_40px_rgba(231,0,11,0.45)] transition hover:shadow-[0_0_60px_rgba(231,0,11,0.75)] active:scale-[0.98]"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-red-200/70 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <Plus className="relative size-5" />
                <span className="relative">Nuevo proyecto</span>
              </button>
              <button
                type="button"
                onClick={openDialog}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 font-medium text-white backdrop-blur transition hover:border-white/30 hover:bg-white/10 active:scale-[0.98]"
              >
                <FolderOpen className="size-5" />
                Abrir proyecto o video
              </button>
              <button
                type="button"
                onClick={onMetadata}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 font-medium text-white backdrop-blur transition hover:border-white/30 hover:bg-white/10 active:scale-[0.98]"
              >
                <Picture className="size-5" />
                Metadatos
              </button>
            </motion.div>
          )}

          {/* Proyectos */}
          {hasProjects && (
            <section className="mt-12 flex flex-col gap-6">
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="flex flex-wrap items-end gap-3"
              >
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Mis proyectos</h2>
                  {projectsDir && (
                    <p
                      className="mt-1 flex items-center gap-1.5 text-sm text-white/50"
                      title={projectsDir}
                    >
                      <Folder className="size-3.5" />
                      {projectsDir}
                    </p>
                  )}
                </div>
                <div className="flex-1" />
                {projects.length > 0 && (
                  <span className="text-sm text-white/50">{projects.length} proyecto(s)</span>
                )}
                {projectsDir && (
                  <button
                    type="button"
                    onClick={() =>
                      openInExplorer(projectsDir).catch((e) => toast.danger(errMsg(e)))
                    }
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white/80 backdrop-blur transition hover:bg-white/10"
                  >
                    <FolderOpen className="size-4" />
                    Abrir carpeta
                  </button>
                )}
              </motion.div>

              {featured && (
                <FeaturedProject
                  project={featured}
                  thumb={thumbs[featured.path]}
                  onOpen={() => openPath(featured.path)}
                  onReveal={() => revealItemInDir(featured.path).catch(() => {})}
                  onDelete={() => setToDelete(featured)}
                />
              )}

              {rest.length > 0 && (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  <AnimatePresence>
                    {rest.map((p, i) => (
                      <ProjectCard
                        key={p.path}
                        project={p}
                        thumb={thumbs[p.path]}
                        index={i}
                        onOpen={() => openPath(p.path)}
                        onDelete={() => setToDelete(p)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </section>
          )}

          {otherRecents.length > 0 && (
            <section className="mt-14 flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/50">
                Recientes en otras carpetas
              </h3>
              <div className="flex flex-col divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur">
                {otherRecents.map((r) => (
                  <div
                    key={r.path}
                    className="group flex items-center gap-3 px-4 py-3 transition hover:bg-white/5"
                  >
                    <Filmstrip className="size-4 text-white/40" />
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 flex-col text-left"
                      onClick={() => openPath(r.path)}
                    >
                      <span className="truncate font-medium">{r.name}</span>
                      <span className="truncate text-xs text-white/40">{r.path}</span>
                    </button>
                    <span className="text-xs text-white/40">{timeAgo(r.at)}</span>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      aria-label="Quitar de recientes"
                      onPress={() => {
                        removeRecent(r.path)
                        setRecents(getRecents())
                      }}
                    >
                      <Xmark />
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <HomeFooter right={ffmpegVersion ?? 'ffmpeg no detectado'} />
        </div>
      </div>

      {/* Confirmar borrado */}
      <Modal.Backdrop
        isOpen={toDelete != null}
        onOpenChange={(v) => !v && !deleting && setToDelete(null)}
        variant="blur"
      >
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Icon className="bg-danger-soft text-danger-soft-foreground">
                <TrashBin className="size-5" />
              </Modal.Icon>
              <Modal.Heading>¿Eliminar "{toDelete?.name}"?</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3 text-sm text-muted">
              <p>
                El archivo del proyecto se moverá a la{' '}
                <b className="text-foreground">Papelera de reciclaje</b>, desde donde puedes
                recuperarlo.
              </p>
              <p className="rounded-xl bg-surface-secondary p-3 text-xs">
                Tus videos originales y los videos exportados{' '}
                <b className="text-foreground">no se borran</b>.
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary" isDisabled={deleting}>
                Cancelar
              </Button>
              <Button variant="danger" onPress={confirmDelete} isPending={deleting}>
                <TrashBin />
                Mover a la Papelera
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Modal de nuevo proyecto */}
      <Modal.Backdrop isOpen={newOpen} onOpenChange={setNewOpen} variant="blur">
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Nuevo proyecto</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <TextField value={name} onChange={setName} autoFocus>
                <Label>Nombre</Label>
                <Input placeholder="Mi video" onKeyDown={(e) => e.key === 'Enter' && create()} />
              </TextField>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Se guardará en</span>
                <div className="flex items-center gap-2 rounded-xl bg-surface-secondary p-2.5">
                  <Folder className="size-4 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 break-all text-xs" title={location ?? ''}>
                    {location ? joinPath(location, fileName) : '…'}
                  </span>
                  <Button size="sm" variant="ghost" onPress={pickTargetDir}>
                    Cambiar…
                  </Button>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                Cancelar
              </Button>
              <Button isDisabled={!name.trim()} isPending={creating} onPress={create}>
                <Plus />
                Crear
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  )
}

/** Inclinación 3D según la posición del cursor. */
function useTilt(max = 6) {
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 200, damping: 20 })
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 200, damping: 20 })
  const glareX = useTransform(px, (v) => `${v * 100}%`)
  const glareY = useTransform(py, (v) => `${v * 100}%`)
  const glare = useMotionTemplate`radial-gradient(600px circle at ${glareX} ${glareY}, rgba(255,255,255,0.14), transparent 45%)`
  const handlers = {
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect()
      px.set((e.clientX - r.left) / r.width)
      py.set((e.clientY - r.top) / r.height)
    },
    onPointerLeave: () => {
      px.set(0.5)
      py.set(0.5)
    },
  }
  return { rx, ry, glare, handlers }
}

function Thumb({
  project,
  thumb,
  className,
  featured,
}: {
  project: ProjectEntry
  thumb?: string
  className?: string
  featured?: boolean
}) {
  if (thumb) return <img src={thumb} className={className} draggable={false} alt="" />
  return (
    <div className={`${className} overflow-hidden bg-gradient-to-br ${gradientFor(project.name)}`}>
      {/* perforaciones de película */}
      <div className="absolute inset-x-0 top-0 h-6 bg-[repeating-linear-gradient(90deg,transparent_0_14px,rgba(255,255,255,0.18)_14px_30px)] [mask:linear-gradient(transparent_6px,black_6px,black_16px,transparent_16px)]" />
      <div className="absolute inset-x-0 bottom-0 h-6 bg-[repeating-linear-gradient(90deg,transparent_0_14px,rgba(255,255,255,0.18)_14px_30px)] [mask:linear-gradient(transparent_6px,black_6px,black_16px,transparent_16px)]" />
      <Filmstrip
        className={
          featured
            ? 'absolute right-[8%] top-1/2 size-56 -translate-y-1/2 rotate-[-8deg] text-white/15'
            : 'absolute left-1/2 top-[42%] size-16 -translate-x-1/2 -translate-y-1/2 text-white/30'
        }
      />
    </div>
  )
}

function MetaPill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-xs text-white/85 backdrop-blur">
      {icon}
      {children}
    </span>
  )
}

/** Jumbotron del proyecto más reciente. */
function FeaturedProject({
  project,
  thumb,
  onOpen,
  onReveal,
  onDelete,
}: {
  project: ProjectEntry
  thumb?: string
  onOpen: () => void
  onReveal: () => void
  onDelete: () => void
}) {
  const { rx, ry, glare, handlers } = useTilt(3)
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      style={{ perspective: 1400 }}
    >
      <motion.div
        {...handlers}
        style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
        onClick={onOpen}
        className="group relative aspect-[21/9] min-h-[340px] w-full cursor-pointer overflow-hidden rounded-[2rem] border border-white/10 shadow-[0_40px_120px_-30px_rgba(185,0,9,0.5)]"
      >
        <Thumb
          project={project}
          thumb={thumb}
          featured
          className="kenburns absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{ background: glare }}
        />
        <div className="pointer-events-none absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/10 transition group-hover:ring-white/30" />

        <div
          className="relative flex h-full min-w-0 max-w-2xl flex-col justify-end gap-5 p-10"
          style={{ transform: 'translateZ(40px)' }}
        >
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-white/80 backdrop-blur">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
            Continúa donde lo dejaste
          </span>
          <h3
            className="line-clamp-2 max-w-full break-words text-4xl font-bold leading-tight tracking-tight [overflow-wrap:anywhere] md:text-5xl"
            title={project.name}
          >
            {project.name}
          </h3>
          <div className="flex flex-wrap gap-2">
            <MetaPill icon={<Filmstrip className="size-3.5" />}>{project.clips} clip(s)</MetaPill>
            <MetaPill icon={<Clock className="size-3.5" />}>
              {formatTime(project.duration)}
            </MetaPill>
            <MetaPill icon={<Display className="size-3.5" />}>
              {project.resolution} {project.orientation === 'portrait' ? 'vertical' : ''}
            </MetaPill>
            <MetaPill icon={<Speedometer className="size-3.5" />}>{project.fps} fps</MetaPill>
            <MetaPill icon={<Clock className="size-3.5" />}>
              Editado {timeAgo(project.modified)}
            </MetaPill>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-6 font-semibold text-black shadow-[0_0_40px_rgba(255,255,255,0.25)] transition group-hover:shadow-[0_0_60px_rgba(255,255,255,0.45)]">
              <Play className="size-4" />
              Abrir proyecto
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onReveal()
              }}
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/20 bg-black/30 px-5 text-sm font-medium backdrop-blur transition hover:bg-white/10"
            >
              <FolderOpen className="size-4" />
              Mostrar en carpeta
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              aria-label="Eliminar proyecto"
              title="Eliminar proyecto"
              className="inline-flex size-12 items-center justify-center rounded-2xl border border-white/20 bg-black/30 text-white/80 backdrop-blur transition hover:border-red-400/60 hover:bg-red-500/20 hover:text-red-300"
            >
              <TrashBin className="size-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ProjectCard({
  project,
  thumb,
  index,
  onOpen,
  onDelete,
}: {
  project: ProjectEntry
  thumb?: string
  index: number
  onOpen: () => void
  onDelete: () => void
}) {
  const { rx, ry, glare, handlers } = useTilt(7)
  const ref = useRef<HTMLDivElement>(null)
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ delay: (index % 3) * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{ perspective: 1000 }}
    >
      <motion.div
        {...handlers}
        onClick={onOpen}
        whileHover={{ y: -6 }}
        style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
        className="group relative aspect-[16/10] cursor-pointer overflow-hidden rounded-3xl border border-white/10 bg-black shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] transition-shadow hover:shadow-[0_30px_90px_-25px_rgba(231,0,11,0.5)]"
      >
        <Thumb
          project={project}
          thumb={thumb}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{ background: glare }}
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition duration-300 group-hover:opacity-100">
          <span className="flex size-16 scale-75 items-center justify-center rounded-full bg-white/90 text-black shadow-2xl transition duration-300 group-hover:scale-100">
            <Play className="size-6 translate-x-0.5" />
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label="Eliminar proyecto"
          title="Eliminar proyecto"
          className="absolute left-4 top-4 z-10 flex size-9 -translate-y-1 items-center justify-center rounded-xl bg-black/55 text-white/80 opacity-0 backdrop-blur transition duration-300 hover:bg-red-500/80 hover:text-white group-hover:translate-y-0 group-hover:opacity-100"
        >
          <TrashBin className="size-4" />
        </button>
        <div className="absolute right-4 top-4 flex gap-1.5">
          <span className="rounded-lg bg-black/50 px-2 py-1 font-mono text-[11px] text-white/90 backdrop-blur">
            {formatTime(project.duration)}
          </span>
          <span className="rounded-lg bg-black/50 px-2 py-1 text-[11px] font-medium text-white/90 backdrop-blur">
            {project.resolution}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5" style={{ transform: 'translateZ(30px)' }}>
          <h4 className="truncate text-xl font-semibold">{project.name}</h4>
          <p className="mt-1 flex items-center gap-3 text-xs text-white/60">
            <span className="flex items-center gap-1">
              <Filmstrip className="size-3" /> {project.clips} clip(s)
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3" /> {timeAgo(project.modified)}
            </span>
          </p>
        </div>
        <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10 transition group-hover:ring-white/25" />
      </motion.div>
    </motion.div>
  )
}
