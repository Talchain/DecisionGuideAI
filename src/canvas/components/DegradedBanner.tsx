import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { fetchHealth, type Health } from '../../lib/health'
import { useCanvasStore } from '../store'

export function DegradedBanner() {
  const [health, setHealth] = useState<Health | null>(null)
  const runMetaDegraded = useCanvasStore(s => s.runMeta.degraded)

  useEffect(() => {
    let cancelled = false

    if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
      return
    }

    const load = async () => {
      try {
        const next = await fetchHealth()
        if (!cancelled) {
          setHealth(next)
        }
      } catch {
        if (!cancelled) {
          setHealth(null)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const isDegradedFromRun = !!runMetaDegraded
  const isDegradedFromHealth = health?.status === 'degraded'
  const isDownFromHealth = health?.status === 'down'

  if (!isDegradedFromRun && !isDegradedFromHealth && !isDownFromHealth) {
    return null
  }

  const isDown = isDownFromHealth

  const handleLearnMore = () => {
    try {
      const btn = document.querySelector('[data-testid="outputs-dock-tab-diagnostics"]') as HTMLButtonElement | null
      if (btn) {
        btn.click()
        btn.focus()
        return
      }

      if (typeof sessionStorage !== 'undefined') {
        const existingRaw = sessionStorage.getItem('canvas.outputsDock.v1')
        let next: any = { isOpen: true, activeTab: 'diagnostics' }
        if (existingRaw) {
          try {
            const parsed = JSON.parse(existingRaw)
            next = { ...parsed, isOpen: true, activeTab: 'diagnostics' }
          } catch {
            // ignore parse errors and fall back to default
          }
        }
        sessionStorage.setItem('canvas.outputsDock.v1', JSON.stringify(next))
      }
    } catch {
      // noop - banner is best-effort only
    }
  }

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[1050] w-full max-w-2xl px-4">
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-warning-200 bg-warning-50 text-warning-800 shadow-sm">
        <AlertTriangle className="w-4 h-4 mt-0.5" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-medium">
            {isDown
              ? 'Engine currently unavailable; try again shortly.'
              : 'Engine running in degraded mode; performance reduced.'}
          </p>
          <p className="mt-1 text-xs text-warning-900/80">
            {isDown
              ? 'Runs may fail until the engine recovers. You can still explore your graph and past results.'
              : 'Some runs may be slower or limited while the engine is in degraded mode.'}
          </p>
          <button
            type="button"
            onClick={handleLearnMore}
            className="mt-2 inline-flex items-center px-2 py-1 rounded border border-warning-300 text-xs font-medium text-warning-900 hover:bg-warning-100"
          >
            Learn more
          </button>
        </div>
      </div>
    </div>
  )
}
