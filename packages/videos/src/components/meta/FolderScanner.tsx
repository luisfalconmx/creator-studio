import { DropZone } from '@creator-studio/ui'
import {
  ArrowsRotateRight,
  Clock,
  Display,
  Filmstrip,
  Folder,
  FolderOpen,
  HardDrive,
  LayoutCells,
  LayoutCellsLarge,
  LinkSlash,
  Lock,
  PencilToSquare,
  Picture,
  Speedometer,
  TriangleExclamation,
} from '@gravity-ui/icons'
import {
  Button,
  Chip,
  SearchField,
  Spinner,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
} from '@heroui/react'
import { open } from '@tauri-apps/plugin-dialog'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, fileUrl, formatBytes, limiter, type ScanItem } from '../../lib/api'
import { formatTime } from '../../lib/project'

export interface FolderState {
  folder: string | null
  recursive: boolean
  items: ScanItem[]
  scanning: boolean
}

interface Props {
  state: FolderState
  onScan: (folder: string, recursive: boolean) => void
  onEdit: (path: string) => void
  onUnlink: () => void
}

type Filter = 'all' | 'with' | 'without' | 'readonly'

const hasCover = (i: ScanItem) => i.info?.coverStream != null

export default function FolderScanner({ state, onScan, onEdit, onUnlink }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [size, setSize] = useState<CardSize>('m')
  const { items, folder, recursive, scanning } = state

  async function pickFolder() {
    const sel = await open({ directory: true })
    if (typeof sel === 'string') onScan(sel, recursive)
  }

  const counts = useMemo(
    () => ({
      all: items.length,
      with: items.filter(hasCover).length,
      without: items.filter((i) => i.editable && !hasCover(i)).length,
      readonly: items.filter((i) => !i.editable).length,
    }),
    [items],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((i) => {
      if (filter === 'with' && !hasCover(i)) return false
      if (filter === 'without' && (!i.editable || hasCover(i))) return false
      if (filter === 'readonly' && i.editable) return false
      if (!q) return true
      return (
        i.name.toLowerCase().includes(q) ||
        i.folder.toLowerCase().includes(q) ||
        (i.info?.tags.title ?? '').toLowerCase().includes(q)
      )
    })
  }, [items, filter, query])

  if (!folder) {
    return (
      <DropZone
        icon={<FolderOpen className="size-9" />}
        title="Revisa una carpeta completa"
        desc="Verás todos tus videos con su portada, título y estado. La carpeta se queda vinculada hasta que la desvincules."
        cta="Elegir carpeta"
        onPress={pickFolder}
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] bg-black/20 px-4 py-3 backdrop-blur">
        <div
          className="glass flex min-w-0 items-center gap-2 rounded-xl px-3 py-1.5"
          title={folder}
        >
          <Folder className="size-4 shrink-0 text-accent" />
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="text-[10px] uppercase tracking-wider text-muted">
              Carpeta vinculada
            </span>
            <span className="max-w-md truncate text-sm">{folder}</span>
          </div>
        </div>
        <Button size="sm" variant="secondary" onPress={pickFolder}>
          <FolderOpen />
          Cambiar
        </Button>
        <Button size="sm" variant="danger-soft" onPress={onUnlink}>
          <LinkSlash />
          Desvincular carpeta
        </Button>
        <Switch isSelected={recursive} onChange={(v) => onScan(folder, v)} size="sm">
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            Incluir subcarpetas
          </Switch.Content>
        </Switch>
        <Button
          size="sm"
          variant="ghost"
          onPress={() => onScan(folder, recursive)}
          isDisabled={scanning}
        >
          <ArrowsRotateRight />
          Re-escanear
        </Button>
        <div className="flex-1" />
        <SearchField aria-label="Buscar" value={query} onChange={setQuery}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input className="w-56" placeholder="Buscar por nombre o título…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>

      <div className="flex items-center gap-3 px-4 py-2">
        <ToggleButtonGroup
          size="sm"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set([filter])}
          onSelectionChange={(keys) => {
            const k = [...keys][0]
            if (k) setFilter(k as Filter)
          }}
        >
          <ToggleButton id="all">
            <Filmstrip /> Todos ({counts.all})
          </ToggleButton>
          <ToggleButton id="with">
            <Picture /> Con portada ({counts.with})
          </ToggleButton>
          <ToggleButton id="without">
            <TriangleExclamation /> Sin portada ({counts.without})
          </ToggleButton>
          {counts.readonly > 0 && (
            <ToggleButton id="readonly">
              <Lock /> Solo lectura ({counts.readonly})
            </ToggleButton>
          )}
        </ToggleButtonGroup>
        <div className="flex-1" />
        <span className="text-xs text-muted">Tamaño de portada</span>
        <ToggleButtonGroup
          size="sm"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={new Set([size])}
          onSelectionChange={(keys) => {
            const k = [...keys][0]
            if (k) setSize(k as CardSize)
          }}
        >
          <ToggleButton id="s" aria-label="Pequeño" isIconOnly>
            <LayoutCells />
          </ToggleButton>
          <ToggleButton id="m" aria-label="Mediano" isIconOnly>
            <LayoutCellsLarge />
          </ToggleButton>
          <ToggleButton id="l" aria-label="Grande" isIconOnly>
            <Picture />
          </ToggleButton>
        </ToggleButtonGroup>
        {scanning && (
          <span className="flex items-center gap-2 text-sm text-muted">
            <Spinner size="sm" /> Escaneando…
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {!scanning && visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            {items.length === 0
              ? 'No se encontraron videos en esta carpeta.'
              : 'Ningún video coincide con el filtro.'}
          </p>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${CARD_SIZES[size]}px, 1fr))` }}
          >
            {visible.map((i) => (
              <VideoCard key={i.path} item={i} onEdit={() => onEdit(i.path)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const CARD_SIZES = { s: 220, m: 320, l: 440 } as const
type CardSize = keyof typeof CARD_SIZES

const thumbQueue = limiter(4)

function VideoCard({ item, onEdit }: { item: ScanItem; onEdit: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const info = item.info
  const cover = hasCover(item)
  const sig = `${item.path}|${info?.size}|${info?.coverStream}|${info?.tags.title ?? ''}`

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), {
      rootMargin: '300px',
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || !info) return
    let alive = true
    setThumb(null)
    const job = cover
      ? thumbQueue(() => api.readCover(item.path))
      : thumbQueue(() => api.thumbnail(item.path, Math.min(1, info.duration / 2), 640))
    job.then((t) => alive && setThumb(t ?? null)).catch(() => {})
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, sig])

  return (
    <div
      ref={ref}
      className="glass group flex flex-col overflow-hidden rounded-2xl ring-red-600/70 transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-20px_rgba(231,0,11,0.45)] hover:ring-2"
    >
      <button
        type="button"
        className="relative aspect-video w-full overflow-hidden bg-black outline-none"
        onClick={onEdit}
        disabled={!info}
        title={item.path}
      >
        {thumb ? (
          <img
            alt=""
            src={fileUrl(thumb)}
            className={`h-full w-full ${cover ? 'object-contain' : 'object-cover opacity-35 grayscale'}`}
            draggable={false}
          />
        ) : (
          visible && info && <Spinner size="sm" className="absolute inset-0 m-auto" />
        )}
        {!cover && info && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white/80">
            <Picture className="size-8" />
            <span className="text-sm font-medium">Sin portada</span>
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          {item.error ? (
            <Chip size="sm" color="danger" title={item.error}>
              <TriangleExclamation className="size-3" /> Error
            </Chip>
          ) : !item.editable ? (
            <Chip size="sm" title="Solo se puede editar MP4 / M4V">
              <Lock className="size-3" /> Solo lectura
            </Chip>
          ) : cover ? (
            <Chip size="sm" color="success">
              <Picture className="size-3" /> Con portada
            </Chip>
          ) : (
            <Chip size="sm" color="warning">
              <TriangleExclamation className="size-3" /> Sin portada
            </Chip>
          )}
        </div>
        {info && (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white">
            <Clock className="size-3" />
            {formatTime(info.duration)}
          </span>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
          <span className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
            <PencilToSquare className="size-4" /> Editar metadata
          </span>
        </div>
      </button>
      <div className="flex min-w-0 flex-col gap-1.5 px-3 py-2.5">
        <div className="min-w-0">
          <p
            className={`truncate text-sm font-semibold ${info?.tags.title ? '' : 'italic text-muted'}`}
            title={info?.tags.title}
          >
            {info?.tags.title || 'Sin título'}
          </p>
          <p className="truncate text-xs text-muted" title={item.path}>
            {item.name}
          </p>
        </div>
        {info ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
            <Meta icon={Display} label="Resolución" value={`${info.width}×${info.height}`} />
            <Meta
              icon={Speedometer}
              label="Cuadros por segundo"
              value={`${Math.round(info.fps)} fps`}
            />
            <Meta icon={HardDrive} label="Tamaño" value={formatBytes(info.size)} />
            {item.folder && <Meta icon={Folder} label="Subcarpeta" value={item.folder} />}
          </div>
        ) : (
          <p className="truncate text-[11px] text-danger">{item.error}</p>
        )}
      </div>
    </div>
  )
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <span className="flex min-w-0 items-center gap-1" title={label}>
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{value}</span>
    </span>
  )
}
