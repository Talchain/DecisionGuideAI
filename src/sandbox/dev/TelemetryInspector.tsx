import * as React from 'react'
import { __getTestBuffer, __clearTestBuffer } from '@/lib/analytics'

export function TelemetryInspector() {
  // Never render in production builds
  // Also safe in tests/dev; this is a read-only in-memory view
  const forceProd = (globalThis as any).__DM_FORCE_PROD === true
  if ((import.meta as any).env && (import.meta as any).env.PROD) return null
  if (forceProd) return null

  const [events, setEvents] = React.useState(() => __getTestBuffer())
  const [filter, setFilter] = React.useState('')
  const [copied, setCopied] = React.useState(false)

  const refresh = React.useCallback(() => setEvents(__getTestBuffer()), [])

  const onClear = React.useCallback(() => {
    __clearTestBuffer()
    refresh()
  }, [refresh])

  const filtered = React.useMemo(() => {
    const f = filter.trim().toLowerCase()
    if (!f) return events
    return events.filter(e => String(e.event).toLowerCase().includes(f))
  }, [events, filter])

  const onCopy = React.useCallback(async () => {
    const payload = JSON.stringify(filtered, null, 2)
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload)
      } else {
        // Fallback: log
        console.log(payload)
      }
      setCopied(true)
      const id = window.setTimeout(() => setCopied(false), 1500)
      return () => clearTimeout(id)
    } catch {
      try { console.log(payload) } catch {}
      setCopied(true)
      const id = window.setTimeout(() => setCopied(false), 1500)
      return () => clearTimeout(id)
    }
  }, [filtered])

  React.useEffect(() => {
    const id = window.setInterval(refresh, 500)
    return () => clearInterval(id)
  }, [refresh])

  const last = events.slice(-50)

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="text-xs text-gray-600">Recent events: {last.length}</div>
        <input
          aria-label="Filter by event"
          placeholder="Filter events"
          className="text-xs border rounded px-1 py-0.5"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <button aria-label="Copy events" onClick={onCopy} className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50">Copy</button>
        {copied && <span role="status" aria-live="polite" className="text-[10px] text-gray-600">Copied!</span>}
        <button aria-label="Clear telemetry" onClick={onClear} className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50 ml-auto">Clear</button>
      </div>
      <ul data-testid="telemetry-list" className="space-y-1">
        {last.filter(e => !filter || String(e.event).toLowerCase().includes(filter.trim().toLowerCase())).map((e, i) => (
          <li key={i} className="text-[11px]">
            <span className="font-mono font-medium">{e.event}</span>
            <span className="ml-1 text-gray-500">{JSON.stringify(e.props)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
