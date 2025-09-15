import * as React from 'react'
import { useFlags } from '@/lib/flags'
import { useGraph } from '@/sandbox/state/graphStore'
import { useOverrides } from '@/sandbox/state/overridesStore'
import { useTelemetry } from '@/lib/useTelemetry'
import { scoreGraph } from '@/domain/kr'
import { topContributors } from '@/domain/krExplain'

/**
 * ExplainDeltaPanel
 * UI-only, flag-gated. Landmark region that explains Scenario Score Δ.
 * Stable selectors:
 *  - data-dg-explain="true"
 *  - data-testid="explain-panel"
 * Row click calls onHighlight(nodeId); highlight overlay is rendered by Canvas via data-dg-explain-highlight.
 */
export function ExplainDeltaPanel({
  decisionId,
  onClose,
  onHighlight,
}: {
  decisionId: string
  onClose: () => void
  onHighlight: (nodeId: string) => void
}) {
  const flags = useFlags()
  const { graph } = useGraph()
  const overrides = useOverrides()
  const { track } = useTelemetry()

  if (!flags.sandboxExplain) return null

  // Compute before/after via current overrides (UI-only)
  const before = React.useMemo(() => scoreGraph(graph), [graph])
  const after = React.useMemo(() => {
    try {
      if (overrides?.hasOverrides) return scoreGraph(overrides.effectiveGraph(graph))
    } catch {}
    return before
  }, [graph, overrides?.version, before])

  const scenarioBefore = Math.round(before.scenarioScore)
  const scenarioAfter = Math.round(after.scenarioScore)
  const delta = scenarioAfter - scenarioBefore
  const list = React.useMemo(() => topContributors(before, after, graph), [before, after, graph])

  // Focus management and live announcements
  const [live, setLive] = React.useState('')
  const [copyLive, setCopyLive] = React.useState('')
  const headingRef = React.useRef<HTMLDivElement | null>(null)
  const prevFocusRef = React.useRef<HTMLElement | null>(null)
  React.useEffect(() => {
    setLive('Explain panel opened.')
    try { prevFocusRef.current = (document.activeElement as HTMLElement) || null } catch {}
    // Focus heading on open
    const id = window.setTimeout(() => { try { headingRef.current?.focus() } catch {} }, 0)
    return () => { window.clearTimeout(id); try { prevFocusRef.current?.focus?.() } catch {} }
  }, [])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // v1.5: cap contributors to top K when flag enabled; otherwise legacy 7
  const CAP = 5
  const items = React.useMemo(() => {
    if (flags.sandboxExplainV15) return list.slice(0, CAP)
    return list.slice(0, 7)
  }, [flags.sandboxExplainV15, list])
  const limited = flags.sandboxExplainV15 && list.length > CAP

  // Utilities
  const sanitize = (s: string, max = 120) => {
    try {
      const noCtl = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      return noCtl.trim().slice(0, max)
    } catch { return (s || '').slice(0, max) }
  }
  const clampNum = (n: number) => Math.max(-9999, Math.min(9999, Math.round(n)))

  const copyText = React.useCallback(() => {
    const header = `Explain Δ — Before ${scenarioBefore}% → After ${scenarioAfter}% (Δ ${delta >= 0 ? `+${delta}` : delta})`
    const k = items.length
    const total = list.length
    const lines = [header]
    lines.push(`Top ${k} contributors${flags.sandboxExplainV15 ? ` (of ${total})` : ''}:`)
    for (const it of items) {
      const title = sanitize(it.title)
      const tot = clampNum(it.total)
      const d = clampNum(it.delta)
      lines.push(`- ${title}: total ${tot} (Δ ${d >= 0 ? `+${d}` : d})`)
    }
    return lines.join('\n')
  }, [flags.sandboxExplainV15, items, list.length, scenarioBefore, scenarioAfter, delta])

  const handleCopy = React.useCallback(async () => {
    try {
      if (flags.sandboxExplainV15) {
        try { track('sandbox_score_explain_copy', { decisionId, route: 'combined', contributorCount: items.length, limitedTo: CAP }) } catch {}
      } else {
        try { track('sandbox_score_explain_copy', { decisionId, route: 'combined', contributorCount: items.length }) } catch {}
      }
    } catch {}
    const text = copyText()
    let ok = false
    try {
      if (navigator?.clipboard?.writeText) { await navigator.clipboard.writeText(text); ok = true }
    } catch {}
    if (!ok) {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        ok = true
      } catch {}
    }
    if (ok) setCopyLive('Explanation copied.')
  }, [copyText, decisionId, items.length, track, flags.sandboxExplainV15])

  return (
    <aside
      role="region"
      aria-label="Explain Δ"
      className="pointer-events-auto absolute top-[56px] right-2 z-[1100] w-[300px] max-h-[60vh] overflow-auto rounded border bg-white/95 shadow"
      data-dg-explain="true"
      data-testid="explain-panel"
      data-dg-explain-decision={decisionId}
    >
      <header className="sticky top-0 bg-white/95 border-b px-3 py-2 flex items-center gap-2">
        <div ref={headingRef} tabIndex={-1} className="text-xs font-medium outline-none">Explain Δ</div>
        <div className="ml-auto text-[11px] text-gray-600">{`Before ${scenarioBefore}% → After ${scenarioAfter}% (Δ ${delta >= 0 ? `+${delta}` : delta})`}</div>
        {flags.sandboxExplainV15 && (
          <button
            aria-label="Copy explanation"
            className="ml-2 px-1.5 py-0.5 text-xs rounded border bg-white hover:bg-gray-50"
            onClick={handleCopy}
          >Copy</button>
        )}
        <button
          aria-label="Close"
          className="ml-2 px-1.5 py-0.5 text-xs rounded border bg-white hover:bg-gray-50"
          onClick={onClose}
        >Close</button>
      </header>
      {limited && (
        <div data-dg-explain-limited className="px-3 py-1 text-[11px] text-amber-800 bg-amber-50 border-b">{`Showing top ${CAP} of ${list.length}`}</div>
      )}
      <ul className="divide-y">
        {items.map(it => (
          <li key={it.id} className="px-3 py-2 text-xs flex items-center gap-2">
            <button
              data-testid={`explain-row-${it.id}`}
              className="flex-1 text-left hover:underline"
              onClick={() => onHighlight(it.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onHighlight(it.id) } }}
              tabIndex={0}
              title={it.title}
            >
              <div className="font-medium truncate">{it.title}</div>
              <div className="text-[11px] text-gray-600 truncate">{`Total ${Math.round(it.total)} (Δ ${it.delta >= 0 ? `+${Math.round(it.delta)}` : Math.round(it.delta)}) — ${it.reasons.join('; ') || 'No change'}`}</div>
            </button>
            <div className="w-12 h-2 rounded bg-gray-100 overflow-hidden" aria-hidden>
              <div className={`h-full ${it.total >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} style={{ width: `${Math.min(100, Math.abs(it.total))}%` }} />
            </div>
          </li>
        ))}
        {items.length === 0 && (
          <li className="px-3 py-2 text-xs text-gray-500">No contributors</li>
        )}
      </ul>
      {/* Open/close announcer: not a score live region */}
      <div aria-live="polite" className="sr-only">{live}</div>
      {/* Local announce for copy status */}
      {flags.sandboxExplainV15 && <div aria-live="polite" className="sr-only">{copyLive}</div>}
    </aside>
  )
}
