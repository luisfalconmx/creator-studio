import { LogoMark } from '@creator-studio/ui'
import { ArrowDownToLine, Filmstrip, Picture } from '@gravity-ui/icons'
import type { ComponentType, SVGProps } from 'react'

export type SectionId = 'videos' | 'images' | 'downloads'

export const SECTIONS: {
  id: SectionId
  label: string
  hint: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}[] = [
  { id: 'videos', label: 'Videos', hint: 'Editor de video y metadatos', icon: Filmstrip },
  { id: 'images', label: 'Imágenes', hint: 'Optimizador de imágenes', icon: Picture },
  { id: 'downloads', label: 'Descargas', hint: 'Descarga videos y audio', icon: ArrowDownToLine },
]

/** Riel vertical de navegación entre secciones. */
export function Rail({
  active,
  onChange,
}: {
  active: SectionId
  onChange: (id: SectionId) => void
}) {
  return (
    <nav
      aria-label="Secciones"
      className="relative z-20 flex w-[84px] shrink-0 flex-col items-center gap-1 border-r border-white/[0.06] bg-[#0a0a0c] py-4"
    >
      <div className="mb-4" title={`Creator Studio v${__APP_VERSION__}`}>
        <LogoMark />
      </div>
      <ul className="flex w-full flex-col items-center gap-1.5 px-2">
        {SECTIONS.map(({ id, label, hint, icon: Icon }) => {
          const selected = id === active
          return (
            <li key={id} className="w-full">
              <button
                type="button"
                title={hint}
                aria-current={selected ? 'page' : undefined}
                onClick={() => onChange(id)}
                className={`group relative flex w-full flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-[11px] font-medium transition ${
                  selected
                    ? 'bg-red-600/15 text-white'
                    : 'text-white/50 hover:bg-white/[0.05] hover:text-white/85'
                }`}
              >
                {selected && (
                  <span className="absolute top-1/2 -left-2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-red-500 shadow-[0_0_12px_rgba(231,0,11,0.8)]" />
                )}
                <span
                  className={`flex size-9 items-center justify-center rounded-xl transition ${
                    selected
                      ? 'bg-gradient-to-br from-red-500 via-red-600 to-red-900 text-white shadow-[0_0_24px_rgba(231,0,11,0.55)]'
                      : 'bg-white/[0.04] group-hover:bg-white/[0.08]'
                  }`}
                >
                  <Icon className="size-[18px]" />
                </span>
                {label}
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex-1" />
      <span className="text-[10px] tabular-nums text-white/25">v{__APP_VERSION__}</span>
    </nav>
  )
}
