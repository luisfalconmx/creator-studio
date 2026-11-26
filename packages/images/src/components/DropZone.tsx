import { DropZone as BigDropZone } from '@creator-studio/ui'
import { CloudArrowUpIn, Picture } from '@gravity-ui/icons'
import { useFilePicker } from './FilePickerButton'

export const SUPPORTED_FORMATS = ['JPG', 'JPEG', 'PNG', 'WebP', 'AVIF', 'GIF', 'BMP'] as const

/** Empty state: invites the user to drop or pick images. */
export function DropZone() {
  const [input, open] = useFilePicker()
  return (
    <section aria-label="Agregar imágenes" className="h-full">
      <BigDropZone
        icon={<Picture className="size-9" />}
        title="Suelta tus imágenes aquí"
        desc={`Optimiza todas las que quieras a la vez. Formatos: ${SUPPORTED_FORMATS.join(', ')}. Todo se procesa en tu equipo: tus imágenes nunca salen de él.`}
        cta="Elegir imágenes"
        hint="o arrástralas desde tu explorador de archivos"
        onPress={open}
      />
      {input}
    </section>
  )
}

/** Full-window overlay shown while dragging files over the app. */
export function DropOverlay() {
  return (
    <div
      role="presentation"
      data-testid="drop-overlay"
      className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-3 rounded-[2rem] border-2 border-dashed border-red-500/70 bg-red-600/[0.06] px-16 py-12 shadow-[0_0_60px_rgba(231,0,11,0.35)]">
        <CloudArrowUpIn aria-hidden="true" className="size-12 text-red-400" />
        <p className="text-lg font-semibold">Suelta para optimizar</p>
      </div>
    </div>
  )
}
