import { CheckCircle2, RefreshCw, X } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '../ui/Button'

export function PwaUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!offlineReady && !needRefresh) return null

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <aside className="fixed right-4 bottom-4 z-[1000] w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-brand-400/30 bg-surface p-4 shadow-panel backdrop-blur-xl" aria-live="polite">
      <button type="button" onClick={close} aria-label="Dismiss" className="absolute top-2 right-2 grid size-8 cursor-pointer place-items-center rounded-lg text-muted hover:bg-elevated hover:text-fg">
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3 pr-7">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-500/12 text-brand-600 dark:text-brand-300">
          {needRefresh ? <RefreshCw className="size-5" /> : <CheckCircle2 className="size-5" />}
        </span>
        <div>
          <p className="font-semibold text-fg">{needRefresh ? 'WildGuard update ready' : 'Ready for offline field work'}</p>
          <p className="mt-1 text-xs text-muted">{needRefresh ? 'Reload to use the latest version. Reports saved on this device remain safe.' : 'The application shell is cached. Incident reports can now be saved without a connection.'}</p>
        </div>
      </div>
      {needRefresh && <Button className="mt-3 w-full" icon={RefreshCw} onClick={() => updateServiceWorker(true)}>Update and reload</Button>}
    </aside>
  )
}
