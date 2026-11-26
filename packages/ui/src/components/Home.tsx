import { ArrowRight, Sparkles } from '@gravity-ui/icons'
import { motion, useMotionTemplate, useMotionValue } from 'motion/react'
import type { ReactNode } from 'react'
import { type HeroMotif, HeroScene } from './HeroScene'

/**
 * Fondo de las pantallas de inicio: escena 3D + viñeta + grano.
 * Va dentro de un contenedor `relative` que ocupa toda la sección.
 */
export function HomeBackdrop({ motif, images }: { motif: HeroMotif; images?: string[] }) {
  return (
    <>
      <HeroScene motif={motif} images={images} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,rgba(5,5,7,0.25)_55%,rgba(5,5,7,0.9)_100%)]" />
      <div className="noise pointer-events-none absolute inset-0 opacity-[0.04]" />
    </>
  )
}

/** Barra superior de una pantalla de inicio: icono, título y estado del motor. */
export function HomeTopBar({
  icon,
  section,
  title,
  status,
}: {
  icon: ReactNode
  /** Nombre de la sección sobre el título, cuando el título no lo dice. */
  section?: string
  title: ReactNode
  status?: { ok: boolean; label: string; title?: string }
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="flex items-center gap-3 py-6"
    >
      <span className="text-red-400 [&>svg]:size-6">{icon}</span>
      <div className="flex min-w-0 flex-col leading-tight">
        {section && (
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
            {section}
          </span>
        )}
        <div className="text-lg font-semibold tracking-tight">{title}</div>
      </div>
      <div className="flex-1" />
      {status && (
        <span
          className="hidden items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-white/60 backdrop-blur md:flex"
          title={status.title}
        >
          <span
            className={`size-1.5 rounded-full ${status.ok ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-red-500'}`}
          />
          {status.label}
        </span>
      )}
    </motion.header>
  )
}

/** Bienvenida grande: insignia, titular con brillo y descripción. */
export function HomeHero({
  badge,
  title,
  desc,
  children,
  headingLevel = 1,
  className = 'min-h-[44vh]',
}: {
  badge: ReactNode
  title: ReactNode
  desc: ReactNode
  /** Contenido extra bajo la descripción (p. ej. la barra de enlace). */
  children?: ReactNode
  /** Nivel del titular (2 si la barra superior ya tiene el `h1`). */
  headingLevel?: 1 | 2
  className?: string
}) {
  const Heading = headingLevel === 1 ? motion.h1 : motion.h2
  return (
    <section className={`flex flex-col justify-center py-10 ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.6 }}
        className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80 backdrop-blur"
      >
        <Sparkles className="size-3.5 text-red-300" />
        {badge}
      </motion.div>
      <Heading
        initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ delay: 0.15, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl"
      >
        {title}
      </Heading>
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.7 }}
        className="mt-6 max-w-xl text-lg text-white/65"
      >
        {desc}
      </motion.p>
      {children && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="mt-8"
        >
          {children}
        </motion.div>
      )}
    </section>
  )
}

/** Tarjeta de acción con luz que sigue al cursor. */
export function ActionCard(props: {
  icon: ReactNode
  accent: string
  title: string
  desc: string
  cta: string
  delay: number
  onPress: () => void
}) {
  const mx = useMotionValue(-200)
  const my = useMotionValue(-200)
  const spotlight = useMotionTemplate`radial-gradient(320px circle at ${mx}px ${my}px, rgba(255,255,255,0.12), transparent 70%)`
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: props.delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={props.onPress}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        mx.set(e.clientX - r.left)
        my.set(e.clientY - r.top)
      }}
      onPointerLeave={() => {
        mx.set(-200)
        my.set(-200)
      }}
      className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-left backdrop-blur-xl transition-colors hover:border-red-500/40"
    >
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ background: spotlight }}
      />
      <div
        className={`relative mb-5 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${props.accent} shadow-lg transition-transform duration-500 group-hover:rotate-[-6deg] group-hover:scale-110`}
      >
        {props.icon}
      </div>
      <h3 className="relative text-lg font-semibold">{props.title}</h3>
      <p className="relative mt-1.5 text-sm leading-relaxed text-white/55">{props.desc}</p>
      <span className="relative mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-white/80 transition group-hover:text-white">
        {props.cta}
        <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
      </span>
    </motion.button>
  )
}

/** Pie de las pantallas de inicio. */
export function HomeFooter({ right }: { right?: ReactNode }) {
  return (
    <footer className="mt-16 flex items-center justify-between border-t border-white/5 pt-6 text-xs text-white/30">
      <span>Creator Studio v{__APP_VERSION__}</span>
      {right && <span className="truncate pl-4">{right}</span>}
    </footer>
  )
}
