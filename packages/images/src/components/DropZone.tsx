import { ActionCard } from '@creator-studio/ui'
import { ArrowRightArrowLeft, ArrowsExpand, CloudArrowUpIn, Picture } from '@gravity-ui/icons'
import { useFilePicker } from './FilePickerButton'

export const SUPPORTED_FORMATS = ['JPG', 'JPEG', 'PNG', 'WebP', 'AVIF', 'GIF', 'BMP'] as const

/** Empty state: action cards that open the picker, plus a hint to drop files anywhere. */
export function DropZone() {
  const [input, open] = useFilePicker()
  return (
    <section aria-label="Agregar imágenes" className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ActionCard
          delay={0.45}
          icon={<Picture className="size-6" />}
          accent="from-red-500 to-red-700"
          title="Optimizar imágenes"
          desc="Reduce el peso de todas tus fotos a la vez manteniendo la calidad visual."
          cta="Elegir imágenes"
          onPress={open}
        />
        <ActionCard
          delay={0.52}
          icon={<ArrowRightArrowLeft className="size-6" />}
          accent="from-red-600 to-rose-900"
          title="Convertir formato"
          desc="Pásalas a formatos modernos y compara el antes y el después en vivo."
          cta="Convertir imágenes"
          onPress={open}
        />
        <ActionCard
          delay={0.59}
          icon={<ArrowsExpand className="size-6" />}
          accent="from-rose-600 to-red-950"
          title="Redimensionar y limpiar"
          desc="Cambia el tamaño y elimina los metadatos EXIF y de ubicación de cada foto."
          cta="Preparar imágenes"
          onPress={open}
        />
      </div>
      <div className="flex items-center gap-4 rounded-3xl border-2 border-dashed border-white/10 bg-black/30 px-6 py-5 backdrop-blur-xl">
        <CloudArrowUpIn aria-hidden="true" className="size-8 shrink-0 text-red-400" />
        <div className="min-w-0">
          <h3 className="font-semibold">Suelta tus imágenes aquí</h3>
          <p className="text-sm text-white/55">
            Arrástralas a cualquier parte de la ventana. Formatos: {SUPPORTED_FORMATS.join(', ')}.
            Todo se procesa en tu equipo: tus imágenes nunca salen de él.
          </p>
        </div>
      </div>
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
