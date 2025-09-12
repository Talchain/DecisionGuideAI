import * as React from 'react'
import { useFlags } from '@/lib/flags'
import { useGraph } from '@/sandbox/state/graphStore'
import { scoreGraph } from '@/domain/kr'
import { useTelemetry } from '@/lib/useTelemetry'

export function ScorePill({ decisionId }: { decisionId: string }) {
  const flags = useFlags()
  const { graph } = useGraph()
  const { track } = useTelemetry()
  const [score, setScore] = React.useState<number | null>(null)
  const [live, setLive] = React.useState('')
  const timerRef = React.useRef<number | null>(null)
  const sessionIdRef = React.useRef<string>(Math.random().toString(36).slice(2))
  const lastAnnouncedRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if (!flags.sandboxScore) return
    // Immediate compute for UI responsiveness (no telemetry)
    try {
      const resNow = scoreGraph(graph)
      const sNow = Math.round(resNow.scenarioScore)
      setScore(sNow)
    } catch {}
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      try {
        const res = scoreGraph(graph)
        const s = Math.round(res.scenarioScore)
        setScore(s)
        if (lastAnnouncedRef.current !== s) {
          lastAnnouncedRef.current = s
          try { track('sandbox_graph_score_update', { decisionId, route: 'combined', sessionId: sessionIdRef.current, score: s }) } catch {}
          setLive(`Scenario score updated to ${s} percent.`)
        }
      } catch {}
    }, 300) as unknown as number
    return () => { if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null } }
  }, [graph, flags.sandboxScore, decisionId, track])

  if (!flags.sandboxScore) return null
  const val = score ?? 0
  const cls = val >= 10 ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : (Math.abs(val) < 10 ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-rose-800 bg-rose-50 border-rose-200')
  return (
    <div className="relative">
      <span className={`text-xs px-2 py-0.5 rounded border ${cls}`} title="Scenario Score">Scenario Score: {val}%</span>
      <div aria-live="polite" className="sr-only">{live}</div>
    </div>
  )
}
