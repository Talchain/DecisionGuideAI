// src/poc/AppPoC.tsx
// POC: Full PoC UI (no auth, no Supabase) mounting real components with safe providers

import { StrictMode, useState, useEffect, Suspense } from 'react'
import { HashRouter as Router } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { simulateTokens, getJSON } from './adapters/StreamAdapter'

// POC: hard-enable features for PoC shell
const FEATURES = {
  sse: false, // no real SSE yet
  scenarioSandbox: true,
  sandboxDecisionCTA: true,
  sandboxMapping: true,
  sandboxProjections: true,
  sandboxRealtime: true,
  sandboxStrategyBridge: true,
  sandboxTriggersBasic: true,
  sandboxVoting: true,
  whiteboard: true,
}

// POC: Create query client for React Query (stub-safe)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const queryClient: any = (QueryClient && typeof QueryClient === 'function')
  ? new (QueryClient as any)({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    })
  : {}

export default function AppPoC() {
  const [build, setBuild] = useState('(unknown)')
  const [edge, setEdge] = useState('/engine')
  const [streamMode, setStreamMode] = useState<'off' | 'simulated'>('off')
  const [fetchResult, setFetchResult] = useState<string>('')
  const [fetchPath, setFetchPath] = useState('/draft-flows?template=pricing_change&seed=101')
  const [streamTokens, setStreamTokens] = useState<string>('')
  const [stopFn, setStopFn] = useState<(() => void) | null>(null)
  const [components, setComponents] = useState<{
    SandboxStreamPanel?: any
    EngineAuditPanel?: any
    Whiteboard?: any
  }>({})

  useEffect(() => {
    // POC: Read build ID from meta tag
    const metaBuild = document.querySelector<HTMLMetaElement>('meta[name="x-build-id"]')?.content || '(unknown)'
    setBuild(metaBuild)

    // POC: Read edge from env
    const edgeUrl = (import.meta as any)?.env?.VITE_EDGE_GATEWAY_URL || '/engine'
    setEdge(edgeUrl)

    // POC: Loud acceptance log
    console.info('UI_POC: build=%s edge=%s features=%o', metaBuild, edgeUrl, FEATURES)

    // POC: Signal HTML failsafe
    try { (window as any).__APP_MOUNTED__?.() } catch {}

    // POC: Try to load real components (guarded dynamic imports)
    ;(async () => {
      const loaded: any = {}
      try {
        const mod = await import('../components/SandboxStreamPanel')
        loaded.SandboxStreamPanel = mod.default
      } catch (e) {
        console.warn('POC: SandboxStreamPanel not available', e)
      }
      try {
        const mod = await import('../components/EngineAuditPanel')
        loaded.EngineAuditPanel = mod.default
      } catch (e) {
        console.warn('POC: EngineAuditPanel not available', e)
      }
      try {
        const mod = await import('../components/Whiteboard')
        loaded.Whiteboard = mod.default
      } catch (e) {
        console.warn('POC: Whiteboard not available', e)
      }
      setComponents(loaded)
    })()
  }, [])

  // POC: Mock stream (simulated SSE tokens)
  const startStream = () => {
    if (stopFn) return
    setStreamMode('simulated')
    setStreamTokens('')
    
    const stop = simulateTokens(
      (token) => setStreamTokens(prev => prev + (prev ? ' ' : '') + token),
      () => {
        setStreamTokens(prev => prev + '\n[done]')
        setStopFn(null)
        setStreamMode('off')
      }
    )
    setStopFn(() => stop)
  }

  const stopStream = () => {
    if (stopFn) {
      stopFn()
      setStreamTokens(prev => prev + '\n[stopped]')
      setStopFn(null)
    }
    setStreamMode('off')
  }

  // POC: Real GET to Engine
  const fetchFlow = async () => {
    try {
      const result = await getJSON(edge, fetchPath)
      if (result.ok && result.json) {
        setFetchResult(`OK (${result.ms} ms)\n${JSON.stringify(result.json, null, 2)}`)
      } else if (result.error) {
        setFetchResult(`FAIL (${result.ms} ms)\n${result.error}\n${result.body || ''}`)
      } else {
        setFetchResult(`Status ${result.status} (${result.ms} ms)\n${JSON.stringify(result, null, 2)}`)
      }
    } catch (e) {
      setFetchResult(`ERROR\n${String(e)}`)
    }
  }

  const { SandboxStreamPanel, EngineAuditPanel, Whiteboard } = components

  return (
    <StrictMode>
      {/* @ts-expect-error POC: stub may not match exact QueryClientProvider API */}
      <QueryClientProvider client={queryClient}>
        <Router>
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
              alignItems: 'center',
              flexWrap: 'wrap'
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

              {/* POC: Real Components */}
              {SandboxStreamPanel && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Sandbox Stream Panel</h3>
                  <Suspense fallback={<div>Loading...</div>}>
                    <SandboxStreamPanel />
                  </Suspense>
                </div>
              )}

              {EngineAuditPanel && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Engine Audit Panel</h3>
                  <Suspense fallback={<div>Loading...</div>}>
                    <EngineAuditPanel />
                  </Suspense>
                </div>
              )}

              {Whiteboard && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Whiteboard</h3>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                    POC: Live collaboration disabled; using local doc
                  </div>
                  <Suspense fallback={<div>Loading...</div>}>
                    <Whiteboard />
                  </Suspense>
                </div>
              )}

              {/* POC: Component status */}
              {!SandboxStreamPanel && !EngineAuditPanel && !Whiteboard && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Real Components</h3>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    <p>(Modules not found) Use the simulated stream and fetch flow above.</p>
                    <p>
                      Or visit{' '}
                      <a href="/poc" style={{ color: '#10b981', textDecoration: 'underline' }}>
                        /poc (static page)
                      </a>
                      {' '}for connectivity demo.
                    </p>
                  </div>
                </div>
              )}

              {/* POC: Fallback link */}
              <div style={{ textAlign: 'center', padding: '16px', color: '#6b7280', fontSize: '14px' }}>
                <p>
                  Static fallback:{' '}
                  <a href="/poc" style={{ color: '#10b981', textDecoration: 'underline' }}>
                    /poc (zero dependencies)
                  </a>
                </p>
              </div>
            </div>
          </div>
        </Router>
      </QueryClientProvider>
    </StrictMode>
  )
}
