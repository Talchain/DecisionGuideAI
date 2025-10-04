// src/poc/AppPoC.tsx
// POC: Full PoC UI (no auth, no Supabase) mounting real components with safe providers

import { StrictMode, useState, useEffect, Suspense } from 'react'
import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { simulateTokens, getJSON } from './adapters/StreamAdapter'
import { feature } from '../lib/pocFlags'
import { fetchFlow as fetchFlowEngine, openSSE } from '../lib/pocEngine'
import GraphCanvas, { type Node, type Edge, type LocalEdits } from '../components/GraphCanvas'
import SandboxV1 from '../routes/SandboxV1'

// POC: Read feature flags from env
const FEATURE_SANDBOX = feature('VITE_FEATURE_SCENARIO_SANDBOX')
const FEATURE_SSE = feature('VITE_FEATURE_SSE')

// POC: hard-enable features for PoC shell (legacy)
const FEATURES = {
  sse: FEATURE_SSE,
  scenarioSandbox: FEATURE_SANDBOX,
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

  // POC: Scenario Sandbox state
  const [template, setTemplate] = useState('pricing_change')
  const [seed, setSeed] = useState(101)
  const [flowResult, setFlowResult] = useState<any>(null)
  const [flowError, setFlowError] = useState<string>('')
  const [flowTiming, setFlowTiming] = useState<number>(0)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [localEdits, setLocalEdits] = useState<LocalEdits>({
    addedNodes: [],
    renamedNodes: {},
    addedEdges: []
  })
  const [liveStream, setLiveStream] = useState(false)
  const [sseTokens, setSseTokens] = useState<string>('')
  const [sseStopFn, setSseStopFn] = useState<(() => void) | null>(null)

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

  // POC: Scenario Sandbox - Run flow
  const runFlow = async () => {
    setFlowError('')
    try {
      const result = await fetchFlowEngine({ template, seed })
      setFlowTiming(result.ms)
      setLastUpdated(new Date().toLocaleTimeString('en-GB'))
      
      if (result.ok && result.data) {
        setFlowResult(result.data)
        // POC: Extract graph from report.v1 schema
        if (result.data.graph) {
          setNodes(result.data.graph.nodes || [])
          setEdges(result.data.graph.edges || [])
        }
        console.info('UI_POC_SANDBOX', { edge, template, seed, flags: { sandbox: FEATURE_SANDBOX, sse: FEATURE_SSE } })
      } else {
        setFlowError(result.error || 'Unknown error')
      }
    } catch (e) {
      setFlowError(String(e))
    }
  }

  // POC: SSE streaming toggle
  const toggleLiveStream = () => {
    if (liveStream) {
      // Stop SSE
      if (sseStopFn) {
        sseStopFn()
        setSseStopFn(null)
      }
      setLiveStream(false)
    } else {
      // Start SSE
      setSseTokens('')
      try {
        const stop = openSSE('/demo/stream?hello=1', {
          onToken: (token) => setSseTokens(prev => prev + (prev ? ' ' : '') + token),
          onDone: () => {
            setSseTokens(prev => prev + '\n[done]')
            setSseStopFn(null)
            setLiveStream(false)
          },
          onError: (error) => {
            setSseTokens(prev => prev + `\n[SSE unavailable — using mock]\n${error}`)
            setSseStopFn(null)
            setLiveStream(false)
            // Fallback to mock
            startStream()
          }
        })
        setSseStopFn(() => stop)
        setLiveStream(true)
      } catch (e) {
        setSseTokens(`SSE failed: ${String(e)}\nFalling back to mock stream`)
        setLiveStream(false)
        startStream()
      }
    }
  }

  const { SandboxStreamPanel, EngineAuditPanel, Whiteboard } = components

  // POC: Main sandbox content component
  const MainSandboxContent = () => (
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

              {/* POC: Scenario Sandbox (flag-gated) */}
              {FEATURE_SANDBOX && (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 600 }}>Scenario Sandbox (PoC)</h3>
                  
                  {/* Controls */}
                  <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: 500 }}>Template:</span>
                      <input
                        type="text"
                        value={template}
                        onChange={(e) => setTemplate(e.target.value)}
                        style={{
                          padding: '6px 10px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px',
                          minWidth: '200px'
                        }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: 500, marginLeft: '12px' }}>Seed:</span>
                      <input
                        type="number"
                        value={seed}
                        onChange={(e) => setSeed(Number(e.target.value))}
                        style={{
                          padding: '6px 10px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '14px',
                          width: '100px'
                        }}
                      />
                      <button
                        onClick={runFlow}
                        style={{
                          padding: '8px 16px',
                          border: '1px solid #10b981',
                          borderRadius: '6px',
                          background: '#10b981',
                          color: '#fff',
                          cursor: 'pointer',
                          fontWeight: 600,
                          marginLeft: '8px'
                        }}
                      >
                        Run
                      </button>
                      {FEATURE_SSE && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '12px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={liveStream}
                            onChange={toggleLiveStream}
                            style={{ cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '14px' }}>Live stream</span>
                        </label>
                      )}
                    </div>
                    {lastUpdated && (
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        Last updated: {lastUpdated} ({flowTiming}ms) • Edge: {edge} • Template: {template} • Seed: {seed}
                      </div>
                    )}
                  </div>

                  {/* Error */}
                  {flowError && (
                    <div style={{
                      background: '#fee',
                      border: '1px solid #fcc',
                      borderRadius: '6px',
                      padding: '12px',
                      marginBottom: '12px',
                      fontSize: '14px',
                      color: '#991b1b'
                    }}>
                      <strong>Error:</strong> {flowError}
                    </div>
                  )}

                  {/* Results */}
                  {flowResult && (
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Results</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                        {flowResult.scenarios?.conservative && (
                          <div style={{ padding: '8px', background: '#fef3c7', borderRadius: '6px' }}>
                            <div style={{ fontSize: '12px', color: '#92400e', fontWeight: 600 }}>Conservative</div>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: '#92400e' }}>
                              {flowResult.scenarios.conservative.value}
                            </div>
                          </div>
                        )}
                        {flowResult.scenarios?.most_likely && (
                          <div style={{ padding: '8px', background: '#dbeafe', borderRadius: '6px' }}>
                            <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: 600 }}>Most Likely</div>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e40af' }}>
                              {flowResult.scenarios.most_likely.value}
                            </div>
                          </div>
                        )}
                        {flowResult.scenarios?.optimistic && (
                          <div style={{ padding: '8px', background: '#d1fae5', borderRadius: '6px' }}>
                            <div style={{ fontSize: '12px', color: '#065f46', fontWeight: 600 }}>Optimistic</div>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: '#065f46' }}>
                              {flowResult.scenarios.optimistic.value}
                            </div>
                          </div>
                        )}
                      </div>
                      {flowResult.thresholds && flowResult.thresholds.length > 0 && (
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Thresholds:</div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {flowResult.thresholds.map((t: any, i: number) => (
                              <span
                                key={i}
                                style={{
                                  padding: '4px 8px',
                                  background: t.crossed ? '#fee' : '#f0fdf4',
                                  border: `1px solid ${t.crossed ? '#fcc' : '#bbf7d0'}`,
                                  borderRadius: '4px',
                                  fontSize: '12px',
                                  color: t.crossed ? '#991b1b' : '#065f46'
                                }}
                              >
                                {t.label} {t.crossed && '(crossed)'}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Graph */}
                  {nodes.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Decision Graph</h4>
                      <GraphCanvas
                        nodes={nodes}
                        edges={edges}
                        localEdits={localEdits}
                        onEditsChange={setLocalEdits}
                      />
                    </div>
                  )}

                  {/* SSE Stream Output */}
                  {liveStream && sseTokens && (
                    <div>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>Live Stream</h4>
                      <pre style={{
                        background: '#f6f8fa',
                        padding: '12px',
                        borderRadius: '6px',
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                        fontSize: '14px',
                        margin: 0
                      }}>
                        {sseTokens}
                      </pre>
                    </div>
                  )}
                </div>
              )}

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
  )

  return (
    <StrictMode>
      {/* @ts-expect-error POC: stub may not match exact QueryClientProvider API */}
      <QueryClientProvider client={queryClient}>
        <Router>
          <Routes>
            {/* POC: New preview route (hard-enabled features) */}
            <Route path="/sandbox-v1" element={<SandboxV1 />} />
            {/* POC: Main sandbox route (flag-gated features) */}
            <Route path="*" element={<MainSandboxContent />} />
          </Routes>
        </Router>
      </QueryClientProvider>
    </StrictMode>
  )
}
