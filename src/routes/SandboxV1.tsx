// src/routes/SandboxV1.tsx
// POC: Full Showcase - All features visible by default, no URL toggles

import { useState, useEffect, Suspense } from 'react'
import { fetchFlow, openSSE, resolveEdge, loadFixture } from '../lib/pocEngine'
import { lazySafe } from '../lib/lazySafe'

// POC: Local types
type Node = { id: string; label: string; x?: number; y?: number }
type Edge = { from: string; to: string; label?: string; weight?: number }
type LocalEdits = { addedNodes: Node[]; renamedNodes: Record<string, string>; addedEdges: Edge[] }

// POC: Lazy-load components with graceful fallbacks
const GraphCanvas = lazySafe(() => import('../components/GraphCanvas'), 'GraphCanvas')
const SandboxStreamPanel = lazySafe(() => import('../components/SandboxStreamPanel'), 'SandboxStreamPanel')
const EngineAuditPanel = lazySafe(() => import('../components/EngineAuditPanel'), 'EngineAuditPanel')
const RunReportDrawer = lazySafe(() => import('../components/RunReportDrawer'), 'RunReportDrawer')
const ConfigDrawer = lazySafe(() => import('../components/ConfigDrawer'), 'ConfigDrawer')
const ScenarioDrawer = lazySafe(() => import('../components/ScenarioDrawer'), 'ScenarioDrawer')

export default function SandboxV1() {
  // Version info
  const [deployCommit, setDeployCommit] = useState<string>('')
  const [deployTimestamp, setDeployTimestamp] = useState<string>('')
  
  // Flow controls
  const [edge] = useState('/engine')
  const [template, setTemplate] = useState('pricing_change')
  const [seed, setSeed] = useState(101)
  
  // Flow results
  const [flowResult, setFlowResult] = useState<any>(null)
  const [flowError, setFlowError] = useState<string>('')
  const [flowTiming, setFlowTiming] = useState<number>(0)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [isLiveData, setIsLiveData] = useState(false)
  
  // Graph
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [localEdits, setLocalEdits] = useState<LocalEdits>({
    addedNodes: [],
    renamedNodes: {},
    addedEdges: []
  })
  
  // Streaming
  const [liveStream, setLiveStream] = useState(false)
  const [streamTokens, setStreamTokens] = useState<string>('')
  const [sseStopFn, setSseStopFn] = useState<(() => void) | null>(null)
  
  // Biases
  const [biases, setBiases] = useState<any[]>([])
  const [biasesSource, setBiasesSource] = useState<'live' | 'demo'>('demo')
  
  // Diagnostics
  const [lastUrl, setLastUrl] = useState<string>('')
  const [lastStatus, setLastStatus] = useState<number | undefined>(undefined)
  const [lastHeaders, setLastHeaders] = useState<Record<string, string>>({})
  
  // Drawers
  const [reportDrawerOpen, setReportDrawerOpen] = useState(false)
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false)
  const [scenarioDrawerOpen, setScenarioDrawerOpen] = useState(false)

  // Initialize on mount: version info, auto-run flow, auto-start stream, load biases
  useEffect(() => {
    // Fetch version info
    fetch('/version.json')
      .then(r => r.json())
      .then(v => {
        setDeployCommit(v.short || v.commit || '')
        setDeployTimestamp(v.timestamp || '')
      })
      .catch(() => {})

    // Auto-run flow on mount
    runFlow()
    
    // Auto-start streaming
    setTimeout(() => {
      if (!liveStream) toggleLiveStream()
    }, 800)
    
    // Load default biases
    loadBiases()

    // Acceptance log
    console.info('UI_POC_SANDBOX_V1_SHOWCASE', {
      edge: '/engine',
      template: 'pricing_change',
      seed: 101,
      mode: 'all_features_on',
      fixtures: true
    })

    // Signal mount
    try { (window as any).__APP_MOUNTED__?.() } catch {}
  }, [])

  // Load biases (fixture fallback)
  const loadBiases = async () => {
    const fixture = await loadFixture('biases.default.json')
    if (fixture?.biases) {
      setBiases(fixture.biases)
      setBiasesSource('demo')
    }
  }

  // Run flow - live first, fixture fallback
  const runFlow = async () => {
    setFlowError('')
    const result = await fetchFlow({ edge, template, seed })
    setFlowTiming(result.ms)
    setLastUpdated(new Date().toLocaleTimeString('en-GB'))
    setLastUrl(result.url || '')
    setLastStatus(result.status)
    setLastHeaders(result.headers || {})

    // Check if we have valid data
    const hasValidData = result.ok && result.data && (result.data.results || result.data.graph)
    
    if (hasValidData) {
      setFlowResult(result.data)
      setIsLiveData(true)
      if (result.data.graph) {
        setNodes(result.data.graph.nodes || [])
        setEdges(result.data.graph.edges || [])
      }
      // Check for live biases
      if (result.data.biases?.length > 0) {
        setBiases(result.data.biases)
        setBiasesSource('live')
      }
    } else {
      // Fallback to fixture
      const fixture = await loadFixture('report_pricing_change.json')
      if (fixture) {
        setFlowResult(fixture)
        setIsLiveData(false)
        if (fixture.graph) {
          setNodes(fixture.graph.nodes || [])
          setEdges(fixture.graph.edges || [])
        }
        setFlowError('Using demo data (live engine unavailable)')
      } else {
        setFlowResult(null)
        setNodes([])
        setEdges([])
        setFlowError(result.error || `Fetch failed (status ${result.status ?? 'n/a'})`)
      }
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
        const stop = openSSE(
          { edge, path: '/demo/stream?hello=1' },
          {
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
          }
        )
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Scenario Sandbox (Preview)
            {deployCommit && (
              <span className="ml-3 text-sm font-mono text-gray-500">@{deployCommit}</span>
            )}
          </h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-2">
            <div><span className="font-semibold">Edge:</span> {edge}</div>
            <div><span className="font-semibold">Build:</span> {deployCommit || '(n/a)'}</div>
            {deployTimestamp && (
              <div><span className="font-semibold">Deployed:</span> {new Date(deployTimestamp).toLocaleString('en-GB')}</div>
            )}
          </div>
          <div className="text-xs text-gray-500">
            This preview is hard-enabled for PoC demo purposes. All features active.
          </div>
        </div>

        {/* Diagnostics (PoC only) */}
        <div className="mb-4 text-xs text-gray-600">
          <div className="inline-flex items-center gap-3 px-2 py-1 rounded border border-gray-200 bg-white">
            <span className="font-semibold">Diagnostics</span>
            <span>edge: <code>{edge}</code></span>
            <span>template: <code>{template}</code></span>
            <span>seed: <code>{seed}</code></span>
            <span>mode: <code>showcase</code></span>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
              <input
                type="text"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                style={{ minWidth: '200px' }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seed</label>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                style={{ width: '100px' }}
              />
            </div>
            <button
              onClick={runFlow}
              className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Run
            </button>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={liveStream}
                onChange={toggleLiveStream}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-700">Live stream</span>
            </label>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setReportDrawerOpen(true)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
              >
                Report
              </button>
              <button
                onClick={() => setConfigDrawerOpen(true)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
              >
                Config
              </button>
              <button
                onClick={() => setScenarioDrawerOpen(true)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
              >
                Scenarios
              </button>
            </div>
          </div>
          {lastUpdated && (
            <div className="text-xs text-gray-500">
              Last updated: {lastUpdated} ({flowTiming}ms) • Template: {template} • Seed: {seed}
            </div>
          )}
          {lastUrl && (
            <div className="text-xs text-gray-500 mt-1">
              Request: <code>{lastUrl}</code>{lastStatus ? ` • status ${lastStatus}` : ''}
            </div>
          )}
        </div>

        {/* Error */}
        {flowError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="text-sm text-red-800">
              <strong>Error:</strong> {flowError}
            </div>
          </div>
        )}

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-6">
            {/* Results */}
            {flowResult && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Results</h3>
                  {isLiveData ? (
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">Live</span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded">Demo data</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {flowResult.results?.conservative && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-yellow-900 mb-1">Conservative</div>
                      <div className="text-lg font-bold text-yellow-900">
                        {flowResult.results.conservative.cost_delta || flowResult.results.conservative.value}
                      </div>
                      {flowResult.results.conservative.risk && (
                        <div className="text-xs text-yellow-700">Risk: {flowResult.results.conservative.risk}</div>
                      )}
                    </div>
                  )}
                  {flowResult.results?.most_likely && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-blue-900 mb-1">Most Likely</div>
                      <div className="text-lg font-bold text-blue-900">
                        {flowResult.results.most_likely.cost_delta || flowResult.results.most_likely.value}
                      </div>
                      {flowResult.results.most_likely.risk && (
                        <div className="text-xs text-blue-700">Risk: {flowResult.results.most_likely.risk}</div>
                      )}
                    </div>
                  )}
                  {flowResult.results?.optimistic && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-green-900 mb-1">Optimistic</div>
                      <div className="text-lg font-bold text-green-900">
                        {flowResult.results.optimistic.cost_delta || flowResult.results.optimistic.value}
                      </div>
                      {flowResult.results.optimistic.risk && (
                        <div className="text-xs text-green-700">Risk: {flowResult.results.optimistic.risk}</div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Mini SVG Chart */}
                {flowResult.results && (
                  <div className="mb-4">
                    <div className="text-sm font-semibold text-gray-700 mb-2">Scenario Values</div>
                    <svg width="100%" height="24" className="border border-gray-200 rounded">
                      {(() => {
                        const cons = parseFloat(flowResult.results.conservative?.cost_delta || flowResult.results.conservative?.value || 0)
                        const likely = parseFloat(flowResult.results.most_likely?.cost_delta || flowResult.results.most_likely?.value || 0)
                        const opt = parseFloat(flowResult.results.optimistic?.cost_delta || flowResult.results.optimistic?.value || 0)
                        const max = Math.max(Math.abs(cons), Math.abs(likely), Math.abs(opt), 1)
                        const w1 = (Math.abs(cons) / max) * 30
                        const w2 = (Math.abs(likely) / max) * 30
                        const w3 = (Math.abs(opt) / max) * 30
                        return (
                          <>
                            <rect x="2" y="4" width={w1 + '%'} height="6" fill="#fbbf24" />
                            <rect x="2" y="11" width={w2 + '%'} height="6" fill="#3b82f6" />
                            <rect x="2" y="18" width={w3 + '%'} height="6" fill="#10b981" />
                          </>
                        )
                      })()}
                    </svg>
                  </div>
                )}
                
                {flowResult.thresholds && flowResult.thresholds.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-gray-700 mb-2">Thresholds</div>
                    <div className="flex flex-wrap">
                      {flowResult.thresholds.map((t: any, i: number) => {
                        const displayText = t.metric || t.label || 'threshold'
                        return (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border mr-2 mb-2 ${
                              t.crossed
                                ? 'bg-red-50 border-red-200 text-red-800'
                                : 'bg-green-50 border-green-200 text-green-800'
                            }`}
                          >
                            {displayText}{t.crossed ? ' (crossed)' : ''}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cognitive Biases */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Cognitive Biases</h3>
                {biasesSource === 'demo' && (
                  <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded">Demo</span>
                )}
              </div>
              {biases.length > 0 ? (
                <div className="space-y-2">
                  {biases.slice(0, 3).map((bias: any, i: number) => (
                    <div key={i} className="p-3 bg-gray-50 rounded border border-gray-200">
                      <div className="font-medium text-sm text-gray-900">{bias.name}</div>
                      <div className="text-xs text-gray-600 mt-1">{bias.description}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-600">No biases detected</div>
              )}
            </div>

            {/* SandboxStreamPanel */}
            <Suspense fallback={<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-gray-500">Loading stream panel...</div>}>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <SandboxStreamPanel />
              </div>
            </Suspense>

            {/* Stream Output */}
            {(liveStream || streamTokens) && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  {liveStream ? 'Live Stream' : 'Stream Output'}
                </h3>
                <pre className="bg-gray-50 border border-gray-200 rounded p-3 overflow-auto text-sm font-mono whitespace-pre-wrap min-h-[60px]">
                  {streamTokens || '[stream idle]'}
                </pre>
              </div>
            )}

            {/* Debug Panel */}
            {!flowResult && flowError && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Debug</h3>
                <div className="mb-2 text-sm text-red-700">Error: {flowError}</div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Graph */}
            {nodes.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Decision Graph</h3>
                <Suspense fallback={<div className="text-gray-500">Loading canvas...</div>}>
                  <GraphCanvas
                    nodes={nodes}
                    edges={edges}
                    localEdits={localEdits}
                    onEditsChange={setLocalEdits}
                  />
                </Suspense>
              </div>
            )}

            {/* Text Graph Fallback */}
            {nodes.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Graph Data (Text)</h3>
                <div className="space-y-2">
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-1">Nodes ({nodes.length})</div>
                    <pre className="bg-gray-50 border border-gray-200 rounded p-2 text-xs overflow-auto">
                      {nodes.map((n, i) => `${i + 1}. ${n.id}: ${n.label}`).join('\n')}
                    </pre>
                  </div>
                  {edges.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Edges ({edges.length})</div>
                      <pre className="bg-gray-50 border border-gray-200 rounded p-2 text-xs overflow-auto">
                        {edges.map((e, i) => `${i + 1}. ${e.from} → ${e.to}${e.label ? ` (${e.label})` : ''}`).join('\n')}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* EngineAuditPanel */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Engine Audit</h3>
                {Object.keys(lastHeaders).length > 0 && (
                  <div className="mb-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">Last Response Headers</div>
                    <div className="bg-gray-50 border border-gray-200 rounded p-3 space-y-1">
                      {Object.entries(lastHeaders).map(([key, val]) => (
                        <div key={key} className="text-xs">
                          <span className="font-mono text-gray-600">{key}:</span>{' '}
                          <span className="font-mono text-gray-900">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <Suspense fallback={<div className="text-gray-500 text-sm">Loading audit panel...</div>}>
                  <EngineAuditPanel />
                </Suspense>
            </div>

            {/* System Health */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
              <div className="text-sm text-gray-600">Not instrumented in PoC</div>
            </div>

            {/* Jobs Progress */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Jobs Progress</h3>
              <div className="text-sm text-gray-600">Not instrumented in PoC</div>
            </div>
          </div>
        </div>

        {/* Drawers */}
        {reportDrawerOpen && (
          <Suspense fallback={null}>
            <RunReportDrawer isOpen={reportDrawerOpen} onClose={() => setReportDrawerOpen(false)} />
          </Suspense>
        )}
        {configDrawerOpen && (
          <Suspense fallback={null}>
            <ConfigDrawer isOpen={configDrawerOpen} onClose={() => setConfigDrawerOpen(false)} />
          </Suspense>
        )}
        {scenarioDrawerOpen && (
          <Suspense fallback={null}>
            <ScenarioDrawer isOpen={scenarioDrawerOpen} onClose={() => setScenarioDrawerOpen(false)} />
          </Suspense>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Other PoC surfaces:{' '}
            <a href="/poc" className="text-indigo-600 hover:text-indigo-800 underline">
              Static PoC
            </a>
            {' • '}
            <a href="/#/sandbox" className="text-indigo-600 hover:text-indigo-800 underline">
              Main Sandbox
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
