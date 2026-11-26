import { DownloadsApp } from '@creator-studio/downloads'
import { ImagesApp } from '@creator-studio/images'
import { SectionActiveContext } from '@creator-studio/ui'
import { VideosApp } from '@creator-studio/videos'
import { Toast } from '@heroui/react'
import { useEffect, useState } from 'react'
import { Rail, SECTIONS, type SectionId } from './shell/Rail'
import { UpdateNotifier } from './shell/UpdateNotifier'

const SECTION_KEY = 'creator-studio.section'

function initialSection(): SectionId {
  const saved = localStorage.getItem(SECTION_KEY)
  return SECTIONS.some((s) => s.id === saved) ? (saved as SectionId) : 'videos'
}

/**
 * Creator Studio: una sola ventana con tres secciones. Cada sección se monta la
 * primera vez que se abre y después queda montada (oculta) para conservar su
 * estado: el proyecto abierto, la cola de imágenes o las descargas en curso.
 */
export function App() {
  const [section, setSection] = useState<SectionId>(initialSection)
  const [visited, setVisited] = useState<Set<SectionId>>(() => new Set([section]))

  useEffect(() => {
    localStorage.setItem(SECTION_KEY, section)
    setVisited((v) => (v.has(section) ? v : new Set(v).add(section)))
  }, [section])

  // Soltar archivos fuera de una zona de drop no debe navegar el webview.
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault()
    window.addEventListener('dragover', prevent)
    window.addEventListener('drop', prevent)
    return () => {
      window.removeEventListener('dragover', prevent)
      window.removeEventListener('drop', prevent)
    }
  }, [])

  const panes: Record<SectionId, React.ReactNode> = {
    // Videos se monta siempre: recibe los videos abiertos desde el explorador de archivos.
    videos: <VideosApp onActivate={() => setSection('videos')} />,
    images: visited.has('images') && <ImagesApp />,
    downloads: visited.has('downloads') && <DownloadsApp />,
  }

  return (
    <div className="flex h-full bg-background text-foreground">
      <Rail active={section} onChange={setSection} />
      <div className="relative min-w-0 flex-1">
        {SECTIONS.map(({ id, label }) => (
          <section key={id} aria-label={label} hidden={section !== id} className="absolute inset-0">
            <SectionActiveContext.Provider value={section === id}>
              {panes[id]}
            </SectionActiveContext.Provider>
          </section>
        ))}
      </div>
      <UpdateNotifier />
      <Toast.Provider placement="bottom end" />
    </div>
  )
}
