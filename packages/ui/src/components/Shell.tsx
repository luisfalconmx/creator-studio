import { ArrowLeft } from '@gravity-ui/icons'
import { Button } from '@heroui/react'
import type { ReactNode } from 'react'
import logo from '../assets/logo.svg'

/** Logo de Creator Studio. */
export function LogoMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'size-8' : size === 'lg' ? 'size-14' : 'size-10'
  return (
    <img
      src={logo}
      alt=""
      className={`${s} shrink-0 drop-shadow-[0_0_18px_rgba(231,0,11,0.45)]`}
      draggable={false}
    />
  )
}

/** Fondo de las vistas: oscuro con resplandores rojos y grano. */
export function PageBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#070708]" aria-hidden>
      <div className="absolute -left-40 -top-56 size-[42rem] rounded-full bg-red-700/25 blur-[140px]" />
      <div className="absolute -right-48 top-1/3 size-[36rem] rounded-full bg-red-900/20 blur-[150px]" />
      <div className="absolute bottom-[-20rem] left-1/3 size-[40rem] rounded-full bg-rose-900/15 blur-[160px]" />
      <div className="noise absolute inset-0 opacity-[0.035]" />
    </div>
  )
}

/** Barra superior de una sección (o de una vista interna, con botón de volver). */
export function AppHeader({
  section,
  onBack,
  backLabel = 'Volver al inicio',
  title,
  subtitle,
  children,
  right,
}: {
  /** Nombre de la sección (Videos, Imágenes, Descargas). */
  section: string
  onBack?: () => void
  backLabel?: string
  title: ReactNode
  subtitle?: ReactNode
  children?: ReactNode
  right?: ReactNode
}) {
  return (
    <header className="relative z-10 flex items-center gap-3 border-b border-white/[0.06] bg-black/30 px-4 py-2.5 backdrop-blur-xl">
      {onBack && (
        <Button isIconOnly variant="ghost" size="sm" aria-label={backLabel} onPress={onBack}>
          <ArrowLeft />
        </Button>
      )}
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
          {section}
        </span>
        <div className="flex min-w-0 items-center gap-2 font-semibold">{title}</div>
      </div>
      {subtitle}
      {children}
      <div className="flex-1" />
      {right}
    </header>
  )
}

/** Panel de vidrio. */
export function Panel({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`glass overflow-hidden rounded-2xl ${className}`}>{children}</section>
}

/** Estado vacío grande con zona para soltar archivos. */
export function DropZone({
  icon,
  title,
  desc,
  cta,
  hint = 'o arrástralos aquí',
  onPress,
}: {
  icon: ReactNode
  title: string
  desc: string
  cta: string
  hint?: string
  onPress: () => void
}) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <button
        type="button"
        onClick={onPress}
        className="group relative flex w-full max-w-3xl flex-col items-center justify-center gap-5 overflow-hidden rounded-[2rem] border-2 border-dashed border-white/10 bg-white/[0.02] px-10 py-16 text-center backdrop-blur-xl transition hover:border-red-600/50 hover:bg-red-600/[0.04]"
      >
        <div className="pointer-events-none absolute -top-32 left-1/2 size-80 -translate-x-1/2 rounded-full bg-red-600/20 blur-[90px] transition-opacity group-hover:opacity-150" />
        <div className="relative flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-red-500 via-red-600 to-red-900 text-white shadow-[0_0_50px_rgba(231,0,11,0.55)] transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
          {icon}
        </div>
        <div className="relative">
          <h3 className="text-3xl font-bold tracking-tight">{title}</h3>
          <p className="mx-auto mt-2 max-w-md text-white/55">{desc}</p>
        </div>
        <span className="relative inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-5 font-semibold text-black transition group-hover:shadow-[0_0_40px_rgba(231,0,11,0.5)]">
          {cta}
        </span>
        <span className="relative text-xs text-white/35">{hint}</span>
      </button>
    </div>
  )
}
