import { ErrorBoundary, inTauri } from '@creator-studio/ui'
import { toast } from '@heroui/react'
import { ask } from '@tauri-apps/plugin-dialog'
import { useEffect, useRef, useState } from 'react'
import { api, baseName, errMsg, type FfmpegStatus, stripExt } from './lib/api'
import { createProjectFile, type Project } from './lib/project'
import Editor from './views/Editor'
import Home from './views/Home'
import MetadataManager from './views/MetadataManager'

export type View =
  | { name: 'home' }
  | { name: 'editor'; project: Project; path: string | null; importPaths?: string[]; key: number }
  | { name: 'metadata' }

interface Props {
  /** Pide al shell que muestre la sección (p. ej. al abrir videos desde el explorador). */
  onActivate?: () => void
}

/** Sección Videos: inicio con proyectos, editor de video y gestor de metadatos. */
export function VideosApp({ onActivate }: Props) {
  const [view, setView] = useState<View>({ name: 'home' })
  const [ffmpeg, setFfmpeg] = useState<FfmpegStatus | null>(null)
  const editorDirty = useRef(false)
  const viewRef = useRef(view)
  viewRef.current = view
  const activateRef = useRef(onActivate)
  activateRef.current = onActivate

  const openEditor = (project: Project, path: string | null, importPaths?: string[]) => {
    editorDirty.current = false
    setView({ name: 'editor', project, path, importPaths, key: Date.now() })
  }

  /** Crea un proyecto nuevo con estos videos ya en la línea de tiempo y lo abre. */
  const openVideosAsProject = async (input: string[]) => {
    const paths = [...new Set(input)]
    if (!paths.length) return
    activateRef.current?.()
    if (viewRef.current.name === 'editor' && editorDirty.current) {
      const ok = await ask(
        'El proyecto actual tiene cambios sin guardar. ¿Abrir el nuevo proyecto de todos modos?',
        {
          title: 'Creator Studio',
          kind: 'warning',
          okLabel: 'Abrir nuevo',
          cancelLabel: 'Cancelar',
        },
      )
      if (!ok) return
    }
    try {
      const name = stripExt(baseName(paths[0]))
      const { project, path } = await createProjectFile(
        paths.length > 1 ? `${name} y ${paths.length - 1} más` : name,
      )
      openEditor(project, path, paths)
    } catch (e) {
      toast.danger('No se pudo crear el proyecto', { description: errMsg(e) })
    }
  }
  const openVideosRef = useRef(openVideosAsProject)
  openVideosRef.current = openVideosAsProject

  // "Editar en Creator Studio" desde el Explorador: al iniciar o con la app ya abierta.
  // Explorer lanza un proceso por archivo seleccionado: se agrupan en un solo proyecto.
  useEffect(() => {
    if (!inTauri()) return
    let pending: string[] = []
    let timer: number | undefined
    const flush = () => {
      const paths = pending
      pending = []
      openVideosRef.current(paths)
    }
    const enqueue = (paths: string[]) => {
      pending.push(...paths)
      window.clearTimeout(timer)
      timer = window.setTimeout(flush, 700)
    }
    api
      .takeStartupPaths()
      .then((p) => p.length && enqueue(p))
      .catch(() => {})
    const un = api.onOpenAsProject(enqueue)
    return () => {
      window.clearTimeout(timer)
      un.then((f) => f())
    }
  }, [])

  useEffect(() => {
    if (!inTauri()) {
      setFfmpeg({ ffmpeg: null, ffprobe: null, version: null })
      return
    }
    api
      .ffmpegStatus()
      .then(setFfmpeg)
      .catch(() => setFfmpeg({ ffmpeg: null, ffprobe: null, version: null }))
  }, [])

  return (
    <ErrorBoundary
      resetKey={view.name === 'editor' ? view.key : view.name}
      onHome={() => setView({ name: 'home' })}
    >
      {view.name === 'home' && (
        <Home
          ffmpegVersion={ffmpeg?.version ?? null}
          onOpenProject={(project, path) => openEditor(project, path)}
          onOpenVideos={openVideosAsProject}
          onMetadata={() => setView({ name: 'metadata' })}
        />
      )}
      {view.name === 'editor' && (
        <Editor
          key={view.key}
          initial={view.project}
          initialPath={view.path}
          importPaths={view.importPaths}
          onDirtyChange={(d) => {
            editorDirty.current = d
          }}
          onClose={() => setView({ name: 'home' })}
        />
      )}
      {view.name === 'metadata' && <MetadataManager onBack={() => setView({ name: 'home' })} />}
    </ErrorBoundary>
  )
}
