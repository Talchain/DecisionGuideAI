// POC: minimal, dependency-light safe UI that can't fail
import React from 'react'

export default function SafeMode() {
  const [engine, setEngine] = React.useState<{ ok?: boolean; json?: any; err?: string }>({})

  React.useEffect(() => {
    // Gate health check behind flag (default: disabled in dev to avoid CORS noise)
    const enabled = (import.meta as any)?.env?.VITE_ENABLE_PLOT_HEALTH === 'true'
    if (!enabled) {
      setEngine({ ok: false, err: 'Health check disabled (set VITE_ENABLE_PLOT_HEALTH=true)' })
      return
    }
    
    // Use proxy only (NEVER call origin directly from browser - causes CORS)
    const proxyBase = (import.meta as any)?.env?.VITE_PLOT_PROXY_BASE || '/bff/engine'
    const urls = [`${proxyBase}/v1/health`]
    ;(async () => {
      for (const u of urls) {
        try {
          const r = await fetch(u, { cache: 'no-store', mode: 'cors' })
          const j = await r.json()
          setEngine({ ok: true, json: j })
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.debug('[plot-lite] health OK via', u)
          }
          return
        } catch (e: any) {
          setEngine({ ok: false, err: String(e) })
          // Silent failure - no console spam
        }
      }
    })()
  }, [])

  return (
    <div style={{ fontFamily: 'system-ui', padding: '16px' }}>
      <div
        style={{
          background: '#13c27a',
          color: '#0a1f16',
          padding: '10px 12px',
          borderRadius: 8,
          display: 'inline-block',
          fontWeight: 600,
        }}
      >
        PoC Safe Mode · build: {String((window as any).__BUILD_ID__ || '')}
      </div>
      <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.4 }}>
        <div>
          <strong>Env:</strong> poc={String((import.meta as any)?.env?.VITE_POC_ONLY)} auth=
          {String((import.meta as any)?.env?.VITE_AUTH_MODE)} edge=
          {(import.meta as any)?.env?.VITE_EDGE_GATEWAY_URL || '/engine'}
        </div>
        <div style={{ marginTop: 8 }}>
          <strong>Engine:</strong> {engine.ok ? 'OK' : 'Checking…'}
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: '#0b0f14',
              color: '#e5f8f0',
              padding: 8,
              borderRadius: 6,
              marginTop: 6,
              maxHeight: 240,
              overflow: 'auto',
            }}
          >
            {engine.json ? JSON.stringify(engine.json, null, 2) : engine.err || '(no response yet)'}
          </pre>
        </div>
        <div style={{ opacity: 0.7, marginTop: 6 }}>
          If this renders, the deploy is healthy. We can now iteratively enable the Sandbox UI.
        </div>
      </div>
    </div>
  )
}
