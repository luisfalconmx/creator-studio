import { Camera, Picture, TrashBin } from '@gravity-ui/icons'
import { Button } from '@heroui/react'
import { fileUrl } from '../lib/api'

interface Props {
  cover: string | null
  capturing: boolean
  canCapture: boolean
  onCapture: () => void
  onPickImage: () => void
  onClear: () => void
}

export default function CoverPanel({
  cover,
  capturing,
  canCapture,
  onCapture,
  onPickImage,
  onClear,
}: Props) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="checker relative aspect-video overflow-hidden rounded-xl border border-border">
        {cover ? (
          <img
            alt=""
            src={fileUrl(cover)}
            className="h-full w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted">
            Sin portada. Captura un fotograma del cabezal o elige una imagen.
          </div>
        )}
      </div>
      <Button size="sm" onPress={onCapture} isDisabled={!canCapture} isPending={capturing}>
        <Camera />
        Capturar fotograma actual
      </Button>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" className="flex-1" onPress={onPickImage}>
          <Picture />
          Elegir imagen
        </Button>
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          aria-label="Quitar portada"
          isDisabled={!cover}
          onPress={onClear}
        >
          <TrashBin />
        </Button>
      </div>
      <p className="text-[11px] leading-snug text-muted">
        La portada se incrusta en el MP4 al renderizar (Windows y la mayoría de reproductores la
        muestran como miniatura).
      </p>
    </div>
  )
}
