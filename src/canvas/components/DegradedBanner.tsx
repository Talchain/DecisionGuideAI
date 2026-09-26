import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'
import { fetchHealth, type Health } from '../../lib/health'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { useOverlayCell } from './CanvasOverlayBand'

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
        // A16: `fetchHealth` already turns a failed fetch into `'unreachable'`
        // rather than throwing; this stays as a defensive fallback for a
        // throw upstream of that, and it must say the same honest thing —
        // never a bare `null` that silently hides the banner nor an invented
        // 'degraded'.
        if (!cancelled) {
          setHealth({ status: 'unreachable', p95_ms: 0 })
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
  // A16 AUDIT — a failed fetch is not the engine's own report of being
  // degraded; it is the UI never having heard from the engine at all.
  const isUnreachable = health?.status === 'unreachable'

  const wants = isDegradedFromRun || isDegradedFromHealth || isDownFromHealth || isUnreachable

  // A16 AUDIT — THE BANNER USED TO POSITION ITSELF (`fixed top-16 left-1/2
  // -translate-x-1/2 z-[1050]`), which drew it directly over the Question
  // card, the anchor of the whole model. `CanvasOverlayBand` is the one
  // place overlay space is reserved and arbitrated (`CanvasOverlayBand.tsx`'s
  // own header); this claims the SAME 'bottom-right' cell `AnalysisStateCue`
  // does, ranked ahead of it — an engine the UI cannot reach or that is
  // reporting failure is a more urgent fact than the model having changed
  // since the last run.
  const { granted, target } = useOverlayCell('bottom-right', 'degraded-banner', wants)

  if (!wants || !granted) {
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

  const heading = isDown
    ? 'Engine currently unavailable; try again shortly.'
    : isUnreachable
      ? 'Could not reach the analysis engine.'
      : 'Engine running in degraded mode; performance reduced.'

  const detail = isDown
    ? 'Runs may fail until the engine recovers. You can still explore your graph and past results.'
    : isUnreachable
      ? 'The health check itself did not respond. You can still explore your graph and past results.'
      : 'Some runs may be slower or limited while the engine is in degraded mode.'

  const body = (
    <div
      data-testid="degraded-banner"
      className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg border border-warning/30 bg-panel text-warning shadow-2 max-w-sm"
    >
      <AlertTriangle className="w-4 h-4 mt-0.5" aria-hidden="true" />
      <div className={typography.body}>
        <p className="font-medium">{heading}</p>
        <p className={`mt-1 ${typography.caption}`}>{detail}</p>
        <button
          type="button"
          onClick={handleLearnMore}
          className={`mt-2 inline-flex items-center px-2 py-1 rounded border border-warning/30 ${typography.caption} font-medium text-warning hover:bg-warning-light/70`}
        >
          Learn more
        </button>
      </div>
    </div>
  )

  // No band (a standalone render, as this component's own spec mounts it)
  // means no portal target — draw inline, exactly as the other occupants do.
  return target ? createPortal(body, target) : body
}
