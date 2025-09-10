import React from 'react'
import { subscribeRecompute, trackProjectionResolved } from '@/sandbox/state/recompute'
import { mark } from '@/lib/perf'

export const KRCard: React.FC<{ decisionId: string; krId: string; krTitle: string; objectiveTitle?: string }> = ({ decisionId, krId, krTitle, objectiveTitle }) => {
  const [bands, setBands] = React.useState<{ p10: number; p50: number; p90: number } | null>(null)
  const [lastTs, setLastTs] = React.useState<number | null>(null)
  const [renderedVersion, setRenderedVersion] = React.useState<number | null>(null)
  const renderedVersionRef = React.useRef<number | null>(null)
  const lastTrackedRef = React.useRef<number | null>(null)
  React.useEffect(() => { renderedVersionRef.current = renderedVersion }, [renderedVersion])

  React.useEffect(() => {
    const unsub = subscribeRecompute(decisionId, (s) => {
      // Drop-late: ignore updates older than what we've already rendered
      const rv = renderedVersionRef.current
      if (rv !== null && s.version < rv) return
      try { mark('kr-render') } catch {}
      setBands(s.bands)
      setLastTs(s.lastTs)
      setRenderedVersion(s.version)
      if (lastTrackedRef.current !== s.version) {
        lastTrackedRef.current = s.version
        // Emit telemetry once per accepted version
        trackProjectionResolved(decisionId, krId)
        try {
          if ((import.meta as any)?.env?.VITE_DEBUG_BOARD === 'true' && typeof console !== 'undefined' && console.debug) {
            console.debug('[perf] kr-render mark created for', krId, 'v', s.version)
          }
        } catch {}
      }
    })
    return () => unsub()
  }, [decisionId, krId])

  if (!bands) {
    return (
      <div data-testid={`kr-skel-${krId}`} className="animate-pulse border rounded p-3 bg-white">
        <div className="h-3 w-1/3 bg-gray-200 rounded mb-2" />
        <div className="h-3 w-1/2 bg-gray-200 rounded" />
      </div>
    )
  }

  const width = bands.p90 - bands.p10
  const halo = Math.max(0.2, 1 - width) // narrower bands => stronger halo
  const rel = (() => {
    if (!lastTs) return 'just now'
    const delta = Date.now() - lastTs
    if (delta < 5_000) return 'just now'
    const s = Math.floor(delta / 1000)
    if (s < 60) return `${s}s ago`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    return `${h}h ago`
  })()

  return (
    <div data-testid={`kr-resolved-${krId}`} className="border rounded p-3 bg-white">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{krTitle}</div>
        {objectiveTitle ? <div className="text-xs text-gray-500">{objectiveTitle}</div> : null}
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <div className="relative">
          <div className="text-lg font-semibold" style={{ textShadow: `0 0 8px rgba(99,102,241,${halo})` }}>{(bands.p50 * 100).toFixed(0)}%</div>
          <div className="text-[11px] text-gray-600">median</div>
        </div>
        <div className="text-xs text-gray-700">
          <div>p10: {(bands.p10 * 100).toFixed(0)}%</div>
          <div>p90: {(bands.p90 * 100).toFixed(0)}%</div>
        </div>
      </div>
      <div className="mt-1 text-[11px] text-gray-500">updated {rel}</div>
    </div>
  )
}
