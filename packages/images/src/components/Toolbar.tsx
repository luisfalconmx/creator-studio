import { AppHeader } from '@creator-studio/ui'
import { ArrowDownToLine, Plus, TrashBin } from '@gravity-ui/icons'
import { Button, ProgressBar } from '@heroui/react'
import { useShallow } from 'zustand/react/shallow'
import { formatBytes } from '../lib/size'
import { selectTotals, useImages } from '../store/images'
import { FilePickerButton } from './FilePickerButton'
import { SavingsChip } from './SavingsChip'

export function Toolbar({ onExportAll }: { onExportAll: () => void }) {
  const totals = useImages(useShallow(selectTotals))
  const exporting = useImages((s) => s.exporting)
  const clear = useImages((s) => s.clear)

  return (
    <AppHeader
      section="Imágenes"
      title={<h1>Optimizador de imágenes</h1>}
      right={
        <div className="flex items-center gap-2">
          {exporting && (
            <ProgressBar
              aria-label="Exportando"
              className="w-40"
              size="sm"
              value={exporting.done}
              maxValue={exporting.total}
            >
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
          )}
          <FilePickerButton variant="secondary" size="sm">
            <Plus aria-hidden="true" />
            Agregar imágenes
          </FilePickerButton>
          <Button variant="ghost" size="sm" onPress={clear} isDisabled={!!exporting}>
            <TrashBin aria-hidden="true" />
            Vaciar
          </Button>
          <Button size="sm" onPress={onExportAll} isPending={!!exporting} isDisabled={!!exporting}>
            <ArrowDownToLine aria-hidden="true" />
            Exportar todo
          </Button>
        </div>
      }
    >
      <div
        className="ml-3 flex min-w-0 items-center gap-2 border-l border-white/10 pl-4 text-sm text-white/55"
        data-testid="totals"
      >
        <span>
          {totals.done}/{totals.count} optimizadas
        </span>
        {totals.done > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span>
              {formatBytes(totals.original)} → {formatBytes(totals.optimized)}
            </span>
            <SavingsChip original={totals.original} optimized={totals.optimized} />
          </>
        )}
      </div>
    </AppHeader>
  )
}
