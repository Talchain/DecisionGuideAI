import { useEffect, useRef, useState } from 'react'
import { getGatewayBaseUrl } from '../lib/config'
import { isE2EEnabled } from '../flags'

export default function HealthIndicator({ pause = false }: { pause?: boolean }) {
  const [ok, setOk] = useState<boolean | null>(null)
  const timerRef = useRef<number | null>(null)
  const base = isE2EEnabled() ? 200 : 30_000
  const max = isE2EEnabled() ? 2_000 : 300_000
  const timeoutMs = isE2EEnabled() ? 100 : 1_000
  const backoffRef = useRef<number>(base)
  const lastProbeRef = useRef<number | null>(null)

  const clearTimer = () => {
    if (timerRef.current != null) {
      try { clearTimeout(timerRef.current) } catch {}
      timerRef.current = null
    }
  }

  const schedule = (delay: number) => {
    clearTimer()
    // @ts-ignore
    timerRef.current = setTimeout(tick, delay)
  }

  const tick = async () => {
    if (pause) { schedule(backoffRef.current); return }
    const baseUrl = getGatewayBaseUrl()
    const mkUrl = (path: string) => {
      if (typeof baseUrl === 'string' && baseUrl.trim().length > 0) {
        try { return new URL(path, baseUrl).toString() } catch { return path }
      }
      return path
    }
    const tryProbe = async (): Promise<boolean> => {
      const ac = new AbortController()
      const t = setTimeout(() => ac.abort(), timeoutMs)
      try {
        const res = await fetch(mkUrl('/health'), { signal: ac.signal })
        clearTimeout(t)
        if (res.ok) return true
      } catch {}
      try {
        const ac2 = new AbortController()
        const t2 = setTimeout(() => ac2.abort(), timeoutMs)
        const res2 = await fetch(mkUrl('/report?probe=1'), { signal: ac2.signal })
        clearTimeout(t2)
        return !!res2?.ok
      } catch {}
      return false
    }
    const okNow = await tryProbe()
    setOk(okNow)
    lastProbeRef.current = Date.now()
    if (okNow) {
      backoffRef.current = base
    } else {
      backoffRef.current = Math.min(max, backoffRef.current * 2)
    }
    schedule(backoffRef.current)
  }

  useEffect(() => {
    void tick() // run immediately on mount
    return () => clearTimer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // If pause toggled, reschedule next tick
    schedule(backoffRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pause])

  const baseTitle = ok == null ? 'Checking…' : ok ? 'Connected' : 'Offline'
  const secs = lastProbeRef.current ? Math.max(0, Math.round((Date.now() - lastProbeRef.current) / 1000)) : 0
  const title = ok == null ? baseTitle : `${baseTitle} — checked ${secs}s ago`
  const cls = ok ? 'bg-emerald-500' : 'bg-gray-400'

  return (
    <span
      data-testid="health-dot"
      title={title}
      className={`inline-block w-2.5 h-2.5 rounded-full ${cls}`}
      aria-hidden="true"
    />
  )
}
