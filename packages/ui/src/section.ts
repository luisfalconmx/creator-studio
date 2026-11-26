import { createContext, useContext } from 'react'

/**
 * Las secciones (Videos, Imágenes, Descargas) quedan montadas al cambiar de
 * pestaña para no perder su estado. Este contexto les dice si están visibles,
 * para que solo la activa reciba archivos soltados, atajos de teclado o
 * animaciones costosas.
 */
export const SectionActiveContext = createContext(true)

export const useSectionActive = () => useContext(SectionActiveContext)
