// src/poc/AppPoC.tsx
// POC: Full PoC UI (no auth, no Supabase) with real Engine endpoints

import { useState, useEffect } from 'react'
import SandboxStreamPanel from '../components/SandboxStreamPanel'
import EngineAuditPanel from '../components/EngineAuditPanel'

export default function AppPoC() {
  const [build, setBuild] = useState('(unknown)')
  const [edge, setEdge] = useState('/engine')
  const [streamMode, setStreamMode] = useState<'off' | 'simulated'>('off')
  const [fetchResult, setFetchResult] = useState<string>('')
  const [fetchPath, setFetchPath] = useState('/draft-flows?template=pricing_change&seed=101')
  const [streamTokens, setStreamTokens] = useState<string>('')
  const [streamTimer, setStreamTimer] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // POC: Read build ID from meta tag
    const buildId = document.querySelector('meta[name="x-build-id"]')?.getAttribute('content') || '(unknown)'
    setBuild(buildId)

    // POC: Read edge from env
    const edgeUrl = (import.meta as any)?.env?.VITE_EDGE_GATEWAY_URL || '/engine'
    setEdge(edgeUrl)

    // POC: Loud acceptance log
    console.info('UI_POC:', {
      build: buildId,
      edge: edgeUrl,
      features: { stream: 'simulated', fetchFlow: 'real' }
    })

    // POC: Signal HTML failsafe
    try { (window as any).__APP_MOUNTED__?.() } catch {}
  }, [])

  // POC: Mock stream (simulated SSE tokens)
  const startStream = () => {
    if (streamTimer) return
    setStreamMode('simulated')
    setStreamTokens('')
    const total = Math.floor(10 + Math.random() * 40)
    let i = 0
    const timer = setInterval(() => {
      i++
      setStreamTokens(prev => prev + (i === 1 ? '' : ' ') + '▌' + Math.random().toString(36).slice(2, 6))
      if (i >= total) {
        clearInterval(timer)
        setStreamTimer(null)
        setStreamTokens(prev => prev + '\n[done]')
      }
    }, 50 + Math.random() * 100)
    setStreamTimer(timer)
  }

  const stopStream = () => {
    if (streamTimer) {
      clearInterval(streamTimer)
      setStreamTimer(null)
    }
    setStreamTokens(prev => prev + '\n[stopped]')
    setStreamMode('off')
  }

  // POC: Real GET to Engine
  const fetchFlow = async () => {
    const t0 = performance.now()
    try {
      const url = edge.replace(/\/$/, '') + fetchPath
      const r = await fetch(url, { cache: 'no-store' })
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
      const data = await r.json()
      const ms = Math.round(performance.now() - t0)
      setFetchResult(`OK (${ms} ms)\n${JSON.stringify(data, null, 2)}`)
    } catch (e) {
      const ms = Math.round(performance.now() - t0)
      setFetchResult(`FAIL (${ms} ms)\n${String(e)}`)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* POC: Banner */}
      <div style={{
        background: '#10b981',
        color: '#fff',
        padding: '8px 16px',
        fontSize: '14px',
        fontWeight: 600,
        display: 'flex',
        gap: '16px',
        alignItems: 'center'
      }}>
        <span>PoC Mode</span>
        <span style={{ opacity: 0.8 }}>build: {build}</span>
        <span style={{ opacity: 0.8 }}>edge: {edge}</span>
        <span style={{ marginLeft: 'auto', fontSize: '12px', opacity: 0.8 }}>
          No auth • No Supabase • Real Engine
        </span>
      </div>

      {/* POC: Main content */}
      <div style={{ padding: '16px', display: 'grid', gap: '16px', maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* POC: Mock Stream Card */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Simulated Stream</h3>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              onClick={startStream}
              disabled={streamMode === 'simulated'}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                background: streamMode === 'simulated' ? '#e5e7eb' : '#f8f8f8',
                cursor: streamMode === 'simulated' ? 'not-allowed' : 'pointer'
              }}
            >
              Start Stream
            </button>
            <button
              onClick={stopStream}
              disabled={streamMode === 'off'}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                background: streamMode === 'off' ? '#e5e7eb' : '#f8f8f8',
                cursor: streamMode === 'off' ? 'not-allowed' : 'pointer'
              }}
            >
              Stop
            </button>
          </div>
          <pre style={{
            background: '#f6f8fa',
            padding: '12px',
            borderRadius: '6px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            fontSize: '14px',
            margin: 0
          }}>
            {streamTokens || '[stream idle]'}
          </pre>
        </div>

        {/* POC: Real Fetch Card */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Fetch Flow (Real Engine)</h3>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={fetchPath}
              onChange={(e) => setFetchPath(e.target.value)}
              style={{
                flex: 1,
                minWidth: '300px',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <button
              onClick={fetchFlow}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                background: '#f8f8f8',
                cursor: 'pointer'
              }}
            >
              Fetch
            </button>
          </div>
          <pre style={{
            background: '#f6f8fa',
            padding: '12px',
            borderRadius: '6px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            fontSize: '14px',
            margin: 0,
            maxHeight: '400px'
          }}>
            {fetchResult || '[fetch idle]'}
          </pre>
        </div>

        {/* POC: Try to mount real components if available */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Sandbox Components</h3>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            <p>Real React components would render here if SSE is enabled.</p>
            <p>For now, use the simulated stream and fetch flow above.</p>
          </div>
          {/* POC: Attempt to render real components */}
          <div style={{ marginTop: '16px' }}>
            <SandboxStreamPanel />
            <EngineAuditPanel />
          </div>
        </div>

        {/* POC: Fallback link */}
        <div style={{ textAlign: 'center', padding: '16px', color: '#6b7280', fontSize: '14px' }}>
          <p>
            If this UI doesn't work, visit{' '}
            <a href="/poc" style={{ color: '#10b981', textDecoration: 'underline' }}>
              /poc (static page)
            </a>
            {' '}for a zero-dependency fallback.
          </p>
        </div>
      </div>
    </div>
  )
}
