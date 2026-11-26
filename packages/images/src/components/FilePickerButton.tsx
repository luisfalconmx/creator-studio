import { Button, type ButtonProps } from '@heroui/react'
import { type ReactNode, useRef } from 'react'
import { useAddFiles } from '../hooks/useAddFiles'
import { ACCEPT_ATTRIBUTE } from '../lib/formats'

/**
 * Hidden `<input type="file">` for several images, plus a function that opens it.
 * Works the same in the desktop webview and in the browser (dev / E2E).
 */
export function useFilePicker() {
  const input = useRef<HTMLInputElement>(null)
  const addFiles = useAddFiles()
  const element = (
    <input
      ref={input}
      type="file"
      multiple
      accept={ACCEPT_ATTRIBUTE}
      className="hidden"
      data-testid="file-input"
      onChange={(event) => {
        const files = Array.from(event.currentTarget.files ?? [])
        event.currentTarget.value = ''
        if (files.length > 0) addFiles(files)
      }}
    />
  )
  return [element, () => input.current?.click()] as const
}

interface FilePickerButtonProps extends Omit<ButtonProps, 'onPress' | 'children'> {
  children: ReactNode
}

/** Button that opens the system file picker (multiple images). */
export function FilePickerButton({ children, ...props }: FilePickerButtonProps) {
  const [input, open] = useFilePicker()
  return (
    <>
      <Button {...props} onPress={open}>
        {children}
      </Button>
      {input}
    </>
  )
}
