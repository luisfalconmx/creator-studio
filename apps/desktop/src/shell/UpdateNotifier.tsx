import { errMsg, formatBytes, hasUnsavedChanges, inTauri } from '@creator-studio/ui'
import { ArrowDownToLine, ArrowsRotateRight, Sparkles } from '@gravity-ui/icons'
import { Button, Modal, ProgressBar } from '@heroui/react'
import { ask } from '@tauri-apps/plugin-dialog'
import { relaunch } from '@tauri-apps/plugin-process'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000 // cada 6 horas mientras la app esté abierta

/** Pregunta antes de reiniciar si alguna sección tiene cambios sin guardar. */
async function confirmLeave() {
  if (!hasUnsavedChanges()) return true
  return ask(
    'Hay cambios sin guardar. Creator Studio se reiniciará para actualizarse. ¿Continuar?',
    { title: 'Creator Studio', kind: 'warning', okLabel: 'Actualizar', cancelLabel: 'Cancelar' },
  )
}

/**
 * Busca actualizaciones firmadas en el último release de GitHub y muestra un
 * botón flotante "Nueva actualización disponible". Al aceptar, descarga el
 * instalador, verifica su firma, lo instala y reinicia Creator Studio.
 */
export function UpdateNotifier() {
  const [update, setUpdate] = useState<Update | null>(null)
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [phase, setPhase] = useState<'idle' | 'downloading' | 'installing' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const runCheck = useCallback(async () => {
    if (!inTauri()) return
    try {
      const u = await check()
      if (u) setUpdate(u)
    } catch {
      /* sin internet o sin release: se reintenta más tarde */
    }
  }, [])

  useEffect(() => {
    const first = window.setTimeout(runCheck, 4000)
    const every = window.setInterval(runCheck, CHECK_EVERY_MS)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(every)
    }
  }, [runCheck])

  async function install() {
    if (!update) return
    if (!(await confirmLeave())) return
    setPhase('downloading')
    setError(null)
    let total = 0
    let done = 0
    try {
      await update.downloadAndInstall((ev) => {
        if (ev.event === 'Started') {
          total = ev.data.contentLength ?? 0
          setProgress({ done: 0, total })
        } else if (ev.event === 'Progress') {
          done += ev.data.chunkLength
          setProgress({ done, total })
        } else if (ev.event === 'Finished') {
          setPhase('installing')
        }
      })
      await relaunch()
    } catch (e) {
      setPhase('error')
      setError(errMsg(e))
    }
  }

  const busy = phase === 'downloading' || phase === 'installing'
  const pct = progress?.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <>
      <AnimatePresence>
        {update && !dismissed && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-5 left-[100px] z-[55] flex items-center gap-2.5 rounded-2xl bg-red-600 py-2.5 pl-3 pr-4 text-sm font-semibold text-white shadow-[0_10px_40px_-8px_rgba(231,0,11,0.9)] ring-1 ring-white/20 transition hover:bg-red-500"
          >
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/80" />
              <span className="relative inline-flex size-2.5 rounded-full bg-white" />
            </span>
            Nueva actualización disponible
            <span className="rounded-lg bg-black/25 px-1.5 py-0.5 text-xs font-medium">
              v{update.version}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <Modal.Backdrop
        isOpen={open}
        onOpenChange={(v) => !busy && setOpen(v)}
        isDismissable={!busy}
        variant="blur"
      >
        <Modal.Container size="md">
          <Modal.Dialog>
            {!busy && <Modal.CloseTrigger />}
            <Modal.Header>
              <Modal.Icon className="bg-red-600 text-white">
                <Sparkles className="size-5" />
              </Modal.Icon>
              <Modal.Heading>Creator Studio {update?.version} está disponible</Modal.Heading>
              <p className="text-sm text-muted">
                Tienes la versión {__APP_VERSION__}
                {update?.date
                  ? ` · publicada el ${new Date(update.date.replace(' ', 'T')).toLocaleDateString()}`
                  : ''}
              </p>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              {update?.body && (
                <div className="max-h-56 overflow-y-auto whitespace-pre-line rounded-xl bg-surface-secondary p-3 text-sm text-white/75">
                  {update.body}
                </div>
              )}
              {busy && (
                <ProgressBar
                  aria-label="Descarga"
                  value={pct}
                  isIndeterminate={phase === 'installing' || !progress?.total}
                >
                  <div className="flex w-full justify-between text-sm">
                    <span>
                      {phase === 'installing'
                        ? 'Instalando… la app se reiniciará'
                        : 'Descargando actualización'}
                    </span>
                    {phase === 'downloading' && progress?.total ? (
                      <span className="tabular-nums text-muted">
                        {formatBytes(progress.done)} / {formatBytes(progress.total)}
                      </span>
                    ) : null}
                  </div>
                  <ProgressBar.Track>
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar>
              )}
              {phase === 'error' && (
                <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger-soft-foreground">
                  No se pudo actualizar: {error}
                </p>
              )}
              <p className="text-xs text-muted">
                La actualización está firmada y se verifica antes de instalarse. Tus proyectos,
                ajustes y descargas se conservan.
              </p>
            </Modal.Body>
            <Modal.Footer>
              {!busy && (
                <Button
                  variant="secondary"
                  onPress={() => {
                    setOpen(false)
                    setDismissed(true)
                  }}
                >
                  Más tarde
                </Button>
              )}
              <Button onPress={install} isPending={busy}>
                {phase === 'error' ? <ArrowsRotateRight /> : <ArrowDownToLine />}
                {phase === 'error' ? 'Reintentar' : 'Actualizar ahora'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  )
}
