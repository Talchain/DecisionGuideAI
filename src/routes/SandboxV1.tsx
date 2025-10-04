// src/routes/SandboxV1.tsx
// POC: Hard-enabled Scenario Sandbox preview (no env flags required)

import { useState, useEffect } from 'react'
import GraphCanvas, { type Node, type Edge, type LocalEdits } from '../components/GraphCanvas'
import { getEdgeBase } from '../lib/pocFlags'
import { fetchFlow, openSSE } from '../lib/pocEngine'

// POC: Hard-enable features for this preview route
const FEATURE_SANDBOX = true
const FEATURE_SSE = true

export default function SandboxV1() {
  const [build, setBuild] = useState('(unknown)')
  const [edge, setEdge] = useState('/engine')
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
  const [streamTokens, setStreamTokens] = useState<string>('')
  const [sseStopFn, setSseStopFn] = useState<(() => void) | null>(null)

  useEffect(() => {
    // POC: Read build ID from meta tag
    const metaBuild = document.querySelector<HTMLMetaElement>('meta[name="x-build-id"]')?.content || '(unknown)'
    setBuild(metaBuild)

    // POC: Read edge from env or default
    const edgeUrl = getEdgeBase()
    setEdge(edgeUrl)

    // POC: Loud acceptance log
    console.info('UI_POC_SANDBOX_V1', {
      edge: edgeUrl,
      template: 'pricing_change',
      seed: 101,
      hardcoded: { sandbox: true, sse: true }
    })

    // POC: Signal HTML failsafe
    try { (window as any).__APP_MOUNTED__?.() } catch {}
  }, [])

  // POC: Run flow
  const runFlow = async () => {
    setFlowError('')
    try {
      const result = await fetchFlow({ template, seed })
      setFlowTiming(result.ms)
      setLastUpdated(new Date().toLocaleTimeString('en-GB'))
      
      if (result.ok && result.data) {
        setFlowResult(result.data)
        // POC: Extract graph from report.v1 schema
        if (result.data.graph) {
          setNodes(result.data.graph.nodes || [])
          setEdges(result.data.graph.edges || [])
        }
      } else {
        setFlowError(result.error || 'Unknown error')
      }
    } catch (e) {
      setFlowError(String(e))
    }
  }

  // POC: Mock stream fallback
  const startMockStream = () => {
    setStreamTokens('')
    const total = Math.floor(10 + Math.random() * 40)
    let i = 0
    const timer = setInterval(() => {
      i++
      setStreamTokens(prev => prev + (prev ? ' ' : '') + '▌' + Math.random().toString(36).slice(2, 6))
      if (i >= total) {
        clearInterval(timer)
        setStreamTokens(prev => prev + '\n[done]')
      }
    }, 50 + Math.random() * 100)
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
      setStreamTokens('')
    } else {
      // Start SSE
      setStreamTokens('')
      try {
        const stop = openSSE('/demo/stream?hello=1', {
          onToken: (token) => setStreamTokens(prev => prev + (prev ? ' ' : '') + token),
          onDone: () => {
            setStreamTokens(prev => prev + '\n[done]')
            setSseStopFn(null)
            setLiveStream(false)
          },
          onError: (error) => {
            setStreamTokens(`Live stream unavailable — falling back to simulated output.\n${error}\n\n`)
            setSseStopFn(null)
            setLiveStream(false)
            // Fallback to mock
            startMockStream()
          }
        })
        setSseStopFn(() => stop)
        setLiveStream(true)
      } catch (e) {
        setStreamTokens(`Live stream unavailable — falling back to simulated output.\n${String(e)}\n\n`)
        setLiveStream(false)
        startMockStream()
      }
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '16px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* POC: Preview Card */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 600 }}>Scenario Sandbox (PoC Preview)</h2>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
            edge: <strong>{edge}</strong> • build: <strong>{build}</strong>
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '16px' }}>
            This preview is hard-enabled for PoC demo purposes.
          </div>

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
                      {flowResult.scenarios.conservative.cost_delta || flowResult.scenarios.conservative.value}
                    </div>
                    {flowResult.scenarios.conservative.risk && (
                      <div style={{ fontSize: '11px', color: '#92400e' }}>Risk: {flowResult.scenarios.conservative.risk}</div>
                    )}
                  </div>
                )}
                {flowResult.scenarios?.most_likely && (
                  <div style={{ padding: '8px', background: '#dbeafe', borderRadius: '6px' }}>
                    <div style={{ fontSize: '12px', color: '#1e40af', fontWeight: 600 }}>Most Likely</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e40af' }}>
                      {flowResult.scenarios.most_likely.cost_delta || flowResult.scenarios.most_likely.value}
                    </div>
                    {flowResult.scenarios.most_likely.risk && (
                      <div style={{ fontSize: '11px', color: '#1e40af' }}>Risk: {flowResult.scenarios.most_likely.risk}</div>
                    )}
                  </div>
                )}
                {flowResult.scenarios?.optimistic && (
                  <div style={{ padding: '8px', background: '#d1fae5', borderRadius: '6px' }}>
                    <div style={{ fontSize: '12px', color: '#065f46', fontWeight: 600 }}>Optimistic</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#065f46' }}>
                      {flowResult.scenarios.optimistic.cost_delta || flowResult.scenarios.optimistic.value}
                    </div>
                    {flowResult.scenarios.optimistic.risk && (
                      <div style={{ fontSize: '11px', color: '#065f46' }}>Risk: {flowResult.scenarios.optimistic.risk}</div>
                    )}
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

          {/* Stream Output */}
          {(liveStream || streamTokens) && (
            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600 }}>
                {liveStream ? 'Live Stream' : 'Stream Output'}
              </h4>
              <pre style={{
                background: '#f6f8fa',
                padding: '12px',
                borderRadius: '6px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                fontSize: '14px',
                margin: 0,
                minHeight: '60px'
              }}>
                {streamTokens || '[stream idle]'}
              </pre>
            </div>
          )}
        </div>

        {/* Fallback link */}
        <div style={{ textAlign: 'center', padding: '16px', color: '#6b7280', fontSize: '14px' }}>
          <p>
            Other PoC surfaces:{' '}
            <a href="/poc" style={{ color: '#10b981', textDecoration: 'underline' }}>
              Static PoC
            </a>
            {' • '}
            <a href="/#/sandbox" style={{ color: '#10b981', textDecoration: 'underline' }}>
              Main Sandbox
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
