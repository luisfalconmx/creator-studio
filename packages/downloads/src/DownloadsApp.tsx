import { AppHeader, HomeBackdrop, PageBackdrop } from '@creator-studio/ui'
import {
  ArrowDownToLine as Download,
  ListOl as ListOrdered,
  Sliders as Settings2,
} from '@gravity-ui/icons'
import { Tabs } from '@heroui/react'
import { useEffect, useRef, useState } from 'react'
import { DownloadsView } from './components/DownloadsView'
import { DownloadView } from './components/DownloadView'
import { SettingsView } from './components/SettingsView'
import { StoreProvider, useStore } from './store'

type View = 'download' | 'downloads' | 'settings'

function Downloads() {
  const [view, setView] = useState<View>('download')
  const { activeCount } = useStore()
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [view])

  return (
    <div data-section="downloads" className="relative flex h-full flex-col text-white">
      {/* La vista de nueva descarga usa el fondo 3D de las pantallas de inicio. */}
      {view === 'download' ? <HomeBackdrop motif="download" /> : <PageBackdrop />}
      <AppHeader section="Descargas" title="Descargador">
        <Tabs selectedKey={view} onSelectionChange={(k) => setView(k as View)} className="ml-6">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Navegación de descargas">
              <Tabs.Tab id="download" className="whitespace-nowrap">
                <Download className="mr-1.5 size-4" /> Nueva descarga
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="downloads" className="whitespace-nowrap">
                <ListOrdered className="mr-1.5 size-4" /> Cola
                {activeCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[11px] leading-[18px] font-semibold text-accent-foreground tabular-nums">
                    {activeCount}
                  </span>
                )}
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="settings" className="whitespace-nowrap">
                <Settings2 className="mr-1.5 size-4" /> Ajustes
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      </AppHeader>

      <main ref={mainRef} className="relative min-h-0 flex-1 overflow-y-auto">
        {/* Keep the download view mounted so the analysed video survives tab switches. */}
        <div className={view === 'download' ? 'contents' : 'hidden'}>
          <DownloadView
            onShowDownloads={() => setView('downloads')}
            onShowSettings={() => setView('settings')}
          />
        </div>
        {view === 'downloads' && <DownloadsView onNew={() => setView('download')} />}
        {view === 'settings' && <SettingsView />}
      </main>
    </div>
  )
}

/** Sección Descargas: videos y audio de YouTube y más de 1.800 sitios (yt-dlp). */
export function DownloadsApp() {
  return (
    <StoreProvider>
      <Downloads />
    </StoreProvider>
  )
}
