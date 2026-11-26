import { useEffect, useRef } from 'react'

/**
 * Registro global de "cambios sin guardar". Cada sección registra una función;
 * el shell la consulta antes de reiniciar la app para actualizarse.
 */
const guards = new Set<() => boolean>()

export const hasUnsavedChanges = () => [...guards].some((g) => g())

/** Registra `dirty` (se lee en el momento de la consulta, no al registrar). */
export function useUnsavedChanges(dirty: boolean) {
  const ref = useRef(dirty)
  ref.current = dirty
  useEffect(() => {
    const guard = () => ref.current
    guards.add(guard)
    return () => {
      guards.delete(guard)
    }
  }, [])
}
