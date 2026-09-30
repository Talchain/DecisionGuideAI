/**
 * EXPERIMENT ONLY (#76) — a small on-page status pill so a human can see, at a
 * glance, whether ChatGPT site tools are live on this page and what ChatGPT
 * last called (brief §11: Olumi visibly reflects each tool call).
 *
 * Green: tools registered with document.modelContext, plus the last call.
 * Amber: this browser exposes no site tools, with how to fix that.
 */
import { useEffect, useState } from 'react'
import { getWebMcpDiagnostics, WEBMCP_EVENT } from './registry'

const FRIENDLY: Record<string, string> = {
  olumi_ping: 'check connection',
  olumi_get_state: 'read the model',
  olumi_build_model: 'build a model',
  olumi_run_analysis: 'run the analysis',
  olumi_probe_large: 'probe (large result)',
  olumi_probe_write: 'probe (write)',
}

interface View {
  available: boolean
  count: number
  last: { tool: string; at: string; outcome: 'ok' | 'error' } | null
  calls: number
}

function read(available: boolean): View {
  const d = getWebMcpDiagnostics()
  const last = d.calls.at(-1) ?? null
  return { available, count: d.registered.length, last: last ? { tool: last.tool, at: last.at, outcome: last.outcome } : null, calls: d.calls.length }
}

export function SiteToolsStatus({ available }: { available: boolean }) {
  const [view, setView] = useState<View>(() => read(available))
  useEffect(() => {
    const update = () => setView(read(available))
    update()
    window.addEventListener(WEBMCP_EVENT, update)
    return () => window.removeEventListener(WEBMCP_EVENT, update)
  }, [available])

  const connected = view.available && view.count > 0
  const text = connected
    ? view.last
      ? `ChatGPT site tools connected · ChatGPT last asked Olumi to ${FRIENDLY[view.last.tool] ?? view.last.tool} at ${new Date(view.last.at).toLocaleTimeString()}${view.last.outcome === 'error' ? ' (failed)' : ''} · ${view.calls} call${view.calls === 1 ? '' : 's'}`
      : `ChatGPT site tools connected · ${view.count} tools ready · ask ChatGPT (not Olumi’s chat) to use them`
    : 'ChatGPT site tools are not available in this browser. Open this page in the ChatGPT desktop app’s built-in browser and type to ChatGPT, not in Olumi’s chat.'

  return (
    <div
      role="status"
      data-testid="webmcp-status"
      data-connected={connected ? 'true' : 'false'}
      style={{
        position: 'fixed',
        top: 58,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        maxWidth: 'min(720px, calc(100vw - 32px))',
        padding: '6px 12px',
        borderRadius: 999,
        fontSize: 12,
        lineHeight: 1.35,
        fontFamily: 'inherit',
        color: connected ? '#0f5132' : '#664d03',
        background: connected ? '#d1e7dd' : '#fff3cd',
        border: `1px solid ${connected ? '#a3cfbb' : '#ffe69c'}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        pointerEvents: 'none',
      }}
    >
      {text}
    </div>
  )
}
