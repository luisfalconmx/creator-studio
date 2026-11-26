import { inTauri, useSectionActive } from '@creator-studio/ui'
import { convertFileSrc } from '@tauri-apps/api/core'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { useEffect, useRef, useState } from 'react'

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

/** Reads a dropped file through the asset protocol (the desktop app gets paths, not `File`s). */
async function fileFromPath(path: string): Promise<File> {
  const name = path.split(/[\\/]/).pop() ?? path
  const blob = await (await fetch(convertFileSrc(path))).blob()
  // The format is detected from the MIME type or, failing that, the extension.
  return new File([blob], name, { type: blob.type })
}

/**
 * Turns the whole window into a drop target for files while the section is visible.
 * Returns `true` while files are being dragged over the window.
 *
 * Desktop: Tauri intercepts native drops (the Videos section needs real paths), so
 * the files are read from disk. Browser (dev / E2E): regular HTML5 drag & drop.
 */
export function useFileDrop(onFiles: (files: File[]) => void): boolean {
  const active = useSectionActive()
  const [isDragging, setIsDragging] = useState(false)
  const depth = useRef(0)
  const callback = useRef(onFiles)
  callback.current = onFiles

  useEffect(() => {
    if (!active) {
      setIsDragging(false)
      return
    }
    if (inTauri()) {
      const un = getCurrentWebview().onDragDropEvent(async (e) => {
        const p = e.payload
        if (p.type === 'enter') setIsDragging(true)
        else if (p.type === 'leave') setIsDragging(false)
        else if (p.type === 'drop') {
          setIsDragging(false)
          const files = await Promise.all(p.paths.map(fileFromPath))
          if (files.length > 0) callback.current(files)
        }
      })
      return () => {
        un.then((f) => f())
      }
    }

    const onDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth.current++
      setIsDragging(true)
    }
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    const onDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setIsDragging(false)
    }
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth.current = 0
      setIsDragging(false)
      const files = Array.from(event.dataTransfer?.files ?? [])
      if (files.length > 0) callback.current(files)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [active])

  return isDragging
}
