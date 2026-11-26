import {
  BroadcastSignal,
  Calendar,
  Comment,
  FileText,
  Filmstrip,
  Hashtag,
  Person,
  Shield,
  Tag,
  Text,
  Tv,
} from '@gravity-ui/icons'
import type { ComponentType, SVGProps } from 'react'

type Icon = ComponentType<SVGProps<SVGSVGElement>>

/** Campos editables (solo metadata de video). Las claves son las que ffmpeg escribe como átomos iTunes en MP4. */
export interface MetaField {
  key: string
  label: string
  icon: Icon
  hint?: string
  multiline?: boolean
  half?: boolean
  /** Si se define, se muestra como selector. "" = sin valor. */
  options?: { value: string; label: string }[]
}

export const META_GROUPS: { id: string; label: string; icon: Icon; fields: MetaField[] }[] = [
  {
    id: 'general',
    label: 'General',
    icon: Filmstrip,
    fields: [
      { key: 'title', label: 'Título', icon: Text, hint: 'Título del video' },
      { key: 'artist', label: 'Autor / Creador', icon: Person, hint: 'Canal, director o autor' },
      { key: 'date', label: 'Fecha', icon: Calendar, hint: '2026 o 2026-11-22', half: true },
      { key: 'genre', label: 'Género / Categoría', icon: Tag, hint: 'Tutorial, Vlog…', half: true },
      {
        key: 'media_type',
        label: 'Tipo de video',
        icon: Filmstrip,
        options: [
          { value: '', label: 'Sin especificar' },
          { value: '9', label: 'Película' },
          { value: '10', label: 'Episodio de serie / programa' },
          { value: '0', label: 'Video casero / personal' },
          { value: '6', label: 'Videoclip' },
        ],
      },
      { key: 'copyright', label: 'Copyright', icon: Shield, hint: '© 2026 Nombre' },
    ],
  },
  {
    id: 'description',
    label: 'Descripción',
    icon: FileText,
    fields: [
      { key: 'description', label: 'Descripción corta', icon: FileText, multiline: true },
      { key: 'synopsis', label: 'Sinopsis (descripción larga)', icon: FileText, multiline: true },
      { key: 'comment', label: 'Comentario / Notas', icon: Comment, multiline: true },
    ],
  },
  {
    id: 'tv',
    label: 'Serie',
    icon: Tv,
    fields: [
      { key: 'show', label: 'Serie / Programa', icon: Tv },
      { key: 'season_number', label: 'Temporada', icon: Hashtag, hint: '1', half: true },
      { key: 'episode_sort', label: 'Nº de episodio', icon: Hashtag, hint: '5', half: true },
      { key: 'episode_id', label: 'ID de episodio', icon: Hashtag, hint: 'S01E05', half: true },
      { key: 'network', label: 'Canal / Cadena', icon: BroadcastSignal, half: true },
    ],
  },
]

export const EDITABLE_KEYS = META_GROUPS.flatMap((g) => g.fields.map((f) => f.key))

/** Tags técnicos que ffmpeg gestiona solo y no se muestran como "otras". */
export const HIDDEN_TAGS = ['major_brand', 'minor_version', 'compatible_brands']
