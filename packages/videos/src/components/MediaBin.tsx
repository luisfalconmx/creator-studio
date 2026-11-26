import { FileArrowUp, Picture, Plus, TrashBin } from '@gravity-ui/icons'
import { Button, Spinner, Tooltip } from '@heroui/react'
import { fileUrl } from '../lib/api'
import { formatTime, type MediaItem } from '../lib/project'

interface Props {
  media: MediaItem[]
  importing: boolean
  missing: Set<string>
  onImport: () => void
  onAdd: (m: MediaItem) => void
  onRemove: (m: MediaItem) => void
  /** Inicio de arrastre de un medio hacia la línea de tiempo. */
  onDragStart: (m: MediaItem, e: React.PointerEvent) => void
}

export default function MediaBin({
  media,
  importing,
  missing,
  onImport,
  onAdd,
  onRemove,
  onDragStart,
}: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs text-white/45">
          {media.length
            ? `${media.length} archivo(s) · arrastra a la línea de tiempo`
            : 'Sin medios todavía'}
        </span>
        <Button size="sm" variant="secondary" onPress={onImport} isPending={importing}>
          {importing ? <Spinner size="sm" color="current" /> : <FileArrowUp />}
          Importar
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {media.length === 0 ? (
          <button
            type="button"
            onClick={onImport}
            className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/10 text-sm text-white/50 transition hover:border-red-600/50 hover:bg-red-600/5"
          >
            <FileArrowUp className="size-6" />
            Importa o arrastra videos aquí
          </button>
        ) : (
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}
          >
            {media.map((m) => (
              <div
                key={m.id}
                className="group relative cursor-grab overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06] transition hover:ring-red-600/50 active:cursor-grabbing"
                onDoubleClick={() => onAdd(m)}
                onPointerDown={(e) => {
                  if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
                  onDragStart(m, e)
                }}
                title={`${m.path}\nArrastra a la línea de tiempo o haz doble clic para agregar`}
              >
                <div className="relative aspect-video bg-black">
                  {(m.poster ?? m.thumb) && (
                    <img
                      alt=""
                      src={fileUrl(m.poster ?? m.thumb!)}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  )}
                  {m.poster && (
                    <span className="absolute left-1 top-1 flex items-center gap-1 rounded bg-black/70 px-1 text-[10px] text-white">
                      <Picture className="size-3" /> Portada
                    </span>
                  )}
                  <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] text-white">
                    {formatTime(m.duration)}
                  </span>
                  {missing.has(m.id) && (
                    <span className="absolute inset-0 flex items-center justify-center bg-danger/70 text-xs text-white">
                      Archivo no encontrado
                    </span>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition group-hover:opacity-100">
                    <Tooltip delay={300}>
                      <Button
                        isIconOnly
                        size="sm"
                        aria-label="Agregar a la línea de tiempo"
                        onPress={() => onAdd(m)}
                      >
                        <Plus />
                      </Button>
                      <Tooltip.Content>Agregar a la línea de tiempo</Tooltip.Content>
                    </Tooltip>
                    <Tooltip delay={300}>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="danger"
                        aria-label="Quitar"
                        onPress={() => onRemove(m)}
                      >
                        <TrashBin />
                      </Button>
                      <Tooltip.Content>Quitar del proyecto</Tooltip.Content>
                    </Tooltip>
                  </div>
                </div>
                <div className="px-2 py-1">
                  <p className="truncate text-xs font-medium">{m.name}</p>
                  <p className="text-[10px] text-muted">
                    {m.width}×{m.height} · {Math.round(m.fps)} fps{m.hasAudio ? '' : ' · sin audio'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
