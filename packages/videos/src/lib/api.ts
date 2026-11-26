import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export interface MediaInfo {
  path: string
  name: string
  duration: number
  width: number
  height: number
  fps: number
  hasAudio: boolean
  videoCodec: string
  coverStream: number | null
  videoStreams: number
  tags: Record<string, string>
  size: number
  formatName: string
  bitRate: number
  audioCodec: string
  audioChannels: number
  audioSampleRate: number
  subtitleStreams: number
  chapters: number
}

export interface ProjectEntry {
  path: string
  name: string
  clips: number
  media: number
  modified: number
  duration: number
  cover: string | null
  previewPath: string | null
  previewTime: number
  resolution: string
  fps: number
  orientation: string
}

export { errMsg, formatBytes, inTauri } from '@creator-studio/ui'

export type CoverChange = { kind: 'keep' } | { kind: 'remove' } | { kind: 'set'; path: string }

export interface ScanItem {
  path: string
  name: string
  folder: string
  editable: boolean
  info: MediaInfo | null
  error: string | null
}

export interface FfmpegStatus {
  ffmpeg: string | null
  ffprobe: string | null
  version: string | null
}

export interface RenderClip {
  path: string
  start: number
  end: number
  hasAudio: boolean
  transition: { kind: string; duration: number } | null
  zoom: { scale: number; x: number; y: number } | null
}

export interface RenderJob {
  clips: RenderClip[]
  output: string
  width: number
  height: number
  fps: number
  codec: string
  quality: number
  cover: string | null
  metadata: Record<string, string>
}

export interface RenderProgress {
  percent: number
  seconds: number
  total: number
  fps: number
  speed: string
}

export interface RenderDone {
  ok: boolean
  cancelled: boolean
  output: string
  error: string | null
}

/** Convierte una ruta local en una URL que el webview puede cargar. */
export const fileUrl = (path: string) => convertFileSrc(path)

export const api = {
  ffmpegStatus: () => invoke<FfmpegStatus>('plugin:videos|ffmpeg_status'),
  probe: (path: string) => invoke<MediaInfo>('plugin:videos|probe_media', { path }),
  thumbnail: (path: string, time: number, width = 320) =>
    invoke<string>('plugin:videos|thumbnail', { path, time, width }),
  /** Con `frame`, aplica el mismo encuadre/zoom que el video exportado. */
  captureFrame: (
    path: string,
    time: number,
    frame: {
      width: number
      height: number
      zoom: { scale: number; x: number; y: number } | null
    } | null = null,
  ) => invoke<string>('plugin:videos|capture_frame', { path, time, frame }),
  readCover: (path: string) => invoke<string | null>('plugin:videos|read_cover', { path }),
  writeMetadata: (
    video: string,
    tags: Record<string, string>,
    cover: CoverChange,
    output: string | null,
  ) => invoke<string>('plugin:videos|write_metadata', { video, tags, cover, output }),
  scanFolder: (path: string, recursive: boolean) =>
    invoke<ScanItem[]>('plugin:videos|scan_folder', { path, recursive }),
  startRender: (job: RenderJob) => invoke<void>('plugin:videos|start_render', { job }),
  cancelRender: () => invoke<void>('plugin:videos|cancel_render'),
  saveText: (path: string, contents: string) =>
    invoke<void>('plugin:videos|save_text', { path, contents }),
  loadText: (path: string) => invoke<string>('plugin:videos|load_text', { path }),
  fileExists: (path: string) => invoke<boolean>('plugin:videos|file_exists', { path }),
  projectsDir: () => invoke<string>('plugin:videos|projects_dir'),
  newProjectPath: (name: string, dir: string | null = null) =>
    invoke<string>('plugin:videos|new_project_path', { name, dir }),
  listProjects: () => invoke<ProjectEntry[]>('plugin:videos|list_projects'),
  deleteProject: (path: string) => invoke<void>('plugin:videos|delete_project', { path }),
  takeStartupPaths: () => invoke<string[]>('plugin:videos|take_startup_paths'),
  onOpenAsProject: (cb: (paths: string[]) => void): Promise<UnlistenFn> =>
    listen<string[]>('open-as-project', (e) => cb(e.payload)),
  defaultExportDir: () => invoke<string>('plugin:videos|default_export_dir'),
  dirExists: (path: string) => invoke<boolean>('plugin:videos|dir_exists', { path }),
  onRenderProgress: (cb: (p: RenderProgress) => void): Promise<UnlistenFn> =>
    listen<RenderProgress>('render-progress', (e) => cb(e.payload)),
  onRenderDone: (cb: (p: RenderDone) => void): Promise<UnlistenFn> =>
    listen<RenderDone>('render-done', (e) => cb(e.payload)),
}

/** Extensión de los proyectos de video (los `.clipstudio` de ClipStudio se siguen abriendo). */
export const PROJECT_EXT = 'cstudio'
export const LEGACY_PROJECT_EXT = 'clipstudio'
export const isProjectFile = (p: string) => /\.(cstudio|clipstudio)$/i.test(p)

export const VIDEO_EXTS = ['mp4', 'mov', 'm4v', 'mkv', 'webm', 'avi']
export const COVER_VIDEO_EXTS = ['mp4', 'm4v']
export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'bmp']

export const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p
export const dirName = (p: string) => p.replace(/[\\/][^\\/]*$/, '')
export const stripExt = (p: string) => p.replace(/\.[^.\\/]+$/, '')

/** Limita cuántas tareas async corren a la vez (miniaturas del listado). */
export function limiter(max: number) {
  let active = 0
  const queue: (() => void)[] = []
  const next = () => {
    if (active >= max || !queue.length) return
    active++
    queue.shift()!()
  }
  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push(() =>
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--
            next()
          }),
      )
      next()
    })
}

/** Une carpeta + archivo respetando el separador de la plataforma. */
export const joinPath = (dir: string, file: string) => {
  const sep = dir.includes('\\') ? '\\' : '/'
  return dir.endsWith(sep) ? dir + file : dir + sep + file
}
