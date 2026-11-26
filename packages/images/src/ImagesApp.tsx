import { AppHeader, PageBackdrop, Panel } from '@creator-studio/ui'
import { CompareView } from './components/CompareView'
import { DropOverlay, DropZone } from './components/DropZone'
import { ImageList } from './components/ImageList'
import { SettingsPanel } from './components/SettingsPanel'
import { Toolbar } from './components/Toolbar'
import { useAddFiles } from './hooks/useAddFiles'
import { useExport } from './hooks/useExport'
import { useFileDrop } from './hooks/useFileDrop'
import { selectSelectedItem, useImages } from './store/images'

function EmptyState() {
  return (
    <div className="flex h-full flex-col">
      <AppHeader
        section="Imágenes"
        title={<h1>Optimizador de imágenes</h1>}
        subtitle={
          <span className="ml-3 hidden border-l border-white/10 pl-4 text-sm text-white/45 md:inline">
            Más ligeras, misma calidad y sin metadatos.
          </span>
        }
      />
      <main className="relative min-h-0 flex-1">
        <DropZone />
      </main>
    </div>
  )
}

function Workspace() {
  const selected = useImages(selectSelectedItem)
  const runExport = useExport()

  return (
    <div className="flex h-full flex-col">
      <Toolbar onExportAll={() => void runExport()} />
      <div className="relative flex min-h-0 flex-1 gap-3 p-3">
        <Panel className="flex w-80 shrink-0 flex-col">
          <aside aria-label="Cola de imágenes" className="min-h-0 flex-1 overflow-y-auto p-2">
            <ImageList />
          </aside>
        </Panel>
        <Panel className="flex min-w-0 flex-1 flex-col">
          <main className="min-h-0 flex-1">
            {selected && <CompareView key={selected.id} item={selected} />}
          </main>
        </Panel>
        {selected && (
          <Panel className="flex w-96 shrink-0 flex-col">
            <aside aria-label="Ajustes" className="min-h-0 flex-1 overflow-y-auto p-4">
              <SettingsPanel
                key={selected.id}
                item={selected}
                onExport={() => void runExport([selected.id])}
              />
            </aside>
          </Panel>
        )}
      </div>
    </div>
  )
}

/** Sección Imágenes: optimizador con los códecs de Squoosh (todo local). */
export function ImagesApp() {
  const hasItems = useImages((s) => s.items.length > 0)
  const addFiles = useAddFiles()
  const isDragging = useFileDrop(addFiles)

  return (
    <div className="relative flex h-full flex-col text-white">
      <PageBackdrop />
      <div className="relative min-h-0 flex-1">{hasItems ? <Workspace /> : <EmptyState />}</div>
      {isDragging && <DropOverlay />}
    </div>
  )
}
