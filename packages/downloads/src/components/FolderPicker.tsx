import { Folder } from '@gravity-ui/icons'
import { Button } from '@heroui/react'
import { pickFolder } from '../lib/tauri'
import { useStore } from '../store'

export function FolderPicker({ compact }: { compact?: boolean }) {
  const { settings, updateSettings } = useStore()
  const change = async () => {
    const dir = await pickFolder(settings.outputDir)
    if (dir) updateSettings({ outputDir: dir })
  }
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Folder className="size-4 shrink-0 text-muted" />
      <span className="truncate text-sm text-muted" title={settings.outputDir}>
        {settings.outputDir || '…'}
      </span>
      <Button size="sm" variant={compact ? 'ghost' : 'tertiary'} onPress={change}>
        Cambiar
      </Button>
    </div>
  )
}
