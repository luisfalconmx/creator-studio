import {
  HomeBackdrop,
  HomeFooter,
  HomeHero,
  HomeTopBar,
  PageBackdrop,
  Panel,
} from '@creator-studio/ui'
import { Picture } from '@gravity-ui/icons'
import { CompareView } from './components/CompareView'
import { DropOverlay, DropZone } from './components/DropZone'
import { ImageList } from './components/ImageList'
import { SettingsPanel } from './components/SettingsPanel'
import { Toolbar } from './components/Toolbar'
import { useAddFiles } from './hooks/useAddFiles'
import { useExport } from './hooks/useExport'
import { useFileDrop } from './hooks/useFileDrop'
import { selectSelectedItem, useImages } from './store/images'

/** Inicio de la sección: mismo estilo que el de Videos (escena 3D, bienvenida y acciones). */
function EmptyState() {
  return (
    <div className="relative h-full overflow-hidden bg-[#050507]">
      <HomeBackdrop motif="image" />
      <div className="relative h-full overflow-y-auto overflow-x-hidden">
        <div className="mx-auto flex w-full max-w-7xl flex-col px-8 pb-16 lg:px-12">
          <HomeTopBar
            icon={<Picture />}
            section="Imágenes"
            title={<h1>Optimizador de imágenes</h1>}
            status={{ ok: true, label: 'Procesamiento 100 % local' }}
          />
          <HomeHero
            headingLevel={2}
            badge="WebP · AVIF · MozJPEG · OxiPNG · sin subir nada a internet"
            title={
              <>
                Más ligeras,
                <br />
                misma <span className="text-shimmer">calidad.</span>
              </>
            }
            desc="Comprime, redimensiona y convierte todas tus imágenes a la vez con los códecs de Squoosh, y quítales los metadatos en el mismo paso."
          />
          <main>
            <DropZone />
          </main>
          <HomeFooter right="Códecs de Squoosh · WebAssembly" />
        </div>
      </div>
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
      {hasItems && <PageBackdrop />}
      <div className="relative min-h-0 flex-1">{hasItems ? <Workspace /> : <EmptyState />}</div>
      {isDragging && <DropOverlay />}
    </div>
  )
}
