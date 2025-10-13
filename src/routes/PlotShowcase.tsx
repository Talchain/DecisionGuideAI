// src/routes/PlotShowcase.tsx
// The user-facing Plot Showcase - fully styled, all features visible

import { useState, useEffect, Suspense } from 'react'
import { fetchFlow, openSSE, loadFixture } from '../lib/pocEngine'
import { lazySafe } from '../lib/lazySafe'
import { PlcCanvasAdapter } from '../plot/adapters/PlcCanvasAdapter'

// POC: Feature flag - read once at module level
const USE_PLC_CANVAS = (import.meta as any)?.env?.VITE_FEATURE_PLOT_USES_PLC_CANVAS === '1'

// POC: Local types
type Node = { id: string; label: string; x?: number; y?: number }
type Edge = { from: string; to: string; label?: string; weight?: number }
type LocalEdits = { addedNodes: Node[]; renamedNodes: Record<string, string>; addedEdges: Edge[] }

// POC: Lazy-load components with graceful fallbacks
const GraphCanvas = lazySafe(() => import('../components/GraphCanvas'), 'GraphCanvas')
const RunReportDrawer = lazySafe(() => import('../components/RunReportDrawer'), 'RunReportDrawer')
const ConfigDrawer = lazySafe(() => import('../components/ConfigDrawer'), 'ConfigDrawer')
const ScenarioDrawer = lazySafe(() => import('../components/ScenarioDrawer'), 'ScenarioDrawer')

export default function PlotShowcase() {
  // Version info
  const [deployCommit, setDeployCommit] = useState<string>('')
  const [deployTimestamp, setDeployTimestamp] = useState<string>('')
  
  // Self-check status
  const [checkEngine, setCheckEngine] = useState<'pending' | 'ok' | 'fail'>('pending')
  const [checkFixtures, setCheckFixtures] = useState<'pending' | 'ok' | 'fail'>('pending')
  const [checkVersion, setCheckVersion] = useState<'pending' | 'ok' | 'fail'>('pending')
  
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

  // Initialize on mount: version info, auto-run flow, load biases
  useEffect(() => {
    // Fetch version info
    fetch('/version.json')
      .then(r => {
        if (!r.ok) throw new Error('version.json not found')
        return r.json()
      })
      .then(v => {
        setDeployCommit(v.short || v.commit || '')
        setDeployTimestamp(v.timestamp || '')
        setCheckVersion('ok')
      })
      .catch(() => setCheckVersion('fail'))

    // Check fixtures availability
    Promise.all([
      fetch('/fixtures/report_pricing_change.json').then(r => r.ok),
      fetch('/fixtures/biases.default.json').then(r => r.ok)
    ]).then(([report, biases]) => {
      setCheckFixtures(report && biases ? 'ok' : 'fail')
    }).catch(() => setCheckFixtures('fail'))

    // Auto-run flow on mount (engine check happens in runFlow)
    runFlow()
    
    // Load default biases
    loadBiases()

    // Acceptance log
    console.info('UI_PLOT_SHOWCASE', {
      route: '/plot',
      edge: '/engine',
      template: 'pricing_change',
      seed: 101,
      mode: 'fully_styled',
      whiteboard: true,
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
      setCheckEngine('ok')
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
      // Engine failed - mark it and fallback to fixture
      setCheckEngine('fail')
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
        {/* Self-Check Banner */}
        {(() => {
          const allPending = checkEngine === 'pending' || checkFixtures === 'pending' || checkVersion === 'pending'
          const allOk = checkEngine === 'ok' && checkFixtures === 'ok' && checkVersion === 'ok'
          const firstFailure = 
            checkEngine === 'fail' ? 'engine' : 
            checkFixtures === 'fail' ? 'fixtures' : 
            checkVersion === 'fail' ? 'version.json' : null
          
          const bannerClass = allOk ? 'bg-green-50 border-green-200 text-green-900' : 
                             allPending ? 'bg-blue-50 border-blue-200 text-blue-900' :
                             'bg-amber-50 border-amber-200 text-amber-900'
          
          return (
            <div className={`rounded-lg p-3 mb-4 text-sm border ${bannerClass}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="font-semibold">
                    {allPending ? '🔄 Checking...' : allOk ? '✓ Showcase Ready' : `⚠ ${firstFailure}: FAIL`}
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={checkEngine === 'ok' ? 'text-green-700' : checkEngine === 'fail' ? 'text-amber-700' : 'text-gray-500'}>
                      engine: {checkEngine === 'ok' ? 'OK' : checkEngine === 'fail' ? 'FAIL' : '...'}
                    </span>
                    <span className={checkFixtures === 'ok' ? 'text-green-700' : checkFixtures === 'fail' ? 'text-amber-700' : 'text-gray-500'}>
                      fixtures: {checkFixtures === 'ok' ? 'OK' : checkFixtures === 'fail' ? 'FAIL' : '...'}
                    </span>
                    <span className={checkVersion === 'ok' ? 'text-green-700' : checkVersion === 'fail' ? 'text-amber-700' : 'text-gray-500'}>
                      version.json: {checkVersion === 'ok' ? 'OK' : checkVersion === 'fail' ? 'FAIL' : '...'}
                    </span>
                  </div>
                </div>
                {deployCommit && deployTimestamp && (
                  <div className="text-xs">
                    <span className="font-mono">{deployCommit}</span>
                    <span className="mx-2">•</span>
                    <span>{new Date(deployTimestamp).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Plot Showcase
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
          <div className="text-xs text-indigo-600">
            💡 <strong>Quick start:</strong> Run a scenario, sketch on the whiteboard, then review results and thresholds.
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

        {/* Info Notice (Demo Fallback) */}
        {flowError && flowError.includes('demo data') && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="text-sm text-blue-900">
              <strong>ℹ️ Demo Mode:</strong> {flowError}
            </div>
          </div>
        )}
        {/* Error (True Failures) */}
        {flowError && !flowError.includes('demo data') && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="text-sm text-amber-900">
              <strong>⚠️ Notice:</strong> {flowError}
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
                    <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
                      <div className="text-xs font-semibold text-amber-900 mb-1">Conservative</div>
                      <div className="text-lg font-bold text-amber-900">
                        {flowResult.results.conservative.cost_delta || flowResult.results.conservative.value}
                      </div>
                      {(flowResult.results.conservative.risk || flowResult.results.conservative.confidence) && (
                        <div className="text-xs text-amber-700">
                          {flowResult.results.conservative.confidence ? `Confidence: ${flowResult.results.conservative.confidence}` : `Risk: ${flowResult.results.conservative.risk}`}
                        </div>
                      )}
                    </div>
                  )}
                  {flowResult.results?.most_likely && (
                    <div className="bg-indigo-50 border border-indigo-300 rounded-lg p-3">
                      <div className="text-xs font-semibold text-indigo-900 mb-1">Most Likely</div>
                      <div className="text-lg font-bold text-indigo-900">
                        {flowResult.results.most_likely.cost_delta || flowResult.results.most_likely.value}
                      </div>
                      {(flowResult.results.most_likely.risk || flowResult.results.most_likely.confidence) && (
                        <div className="text-xs text-indigo-700">
                          {flowResult.results.most_likely.confidence ? `Confidence: ${flowResult.results.most_likely.confidence}` : `Risk: ${flowResult.results.most_likely.risk}`}
                        </div>
                      )}
                    </div>
                  )}
                  {flowResult.results?.optimistic && (
                    <div className="bg-teal-50 border border-teal-300 rounded-lg p-3">
                      <div className="text-xs font-semibold text-teal-900 mb-1">Optimistic</div>
                      <div className="text-lg font-bold text-teal-900">
                        {flowResult.results.optimistic.cost_delta || flowResult.results.optimistic.value}
                      </div>
                      {(flowResult.results.optimistic.risk || flowResult.results.optimistic.confidence) && (
                        <div className="text-xs text-teal-700">
                          {flowResult.results.optimistic.confidence ? `Confidence: ${flowResult.results.optimistic.confidence}` : `Risk: ${flowResult.results.optimistic.risk}`}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Scenario Values Chart - Always Visible */}
                {flowResult.results && (
                  <div className="mb-4">
                    <div className="text-sm font-semibold text-gray-700 mb-3">Scenario Values</div>
                    <div className="space-y-2">
                      {(() => {
                        const cons = parseFloat(flowResult.results.conservative?.cost_delta || flowResult.results.conservative?.value || 0)
                        const likely = parseFloat(flowResult.results.most_likely?.cost_delta || flowResult.results.most_likely?.value || 0)
                        const opt = parseFloat(flowResult.results.optimistic?.cost_delta || flowResult.results.optimistic?.value || 0)
                        const max = Math.max(Math.abs(cons), Math.abs(likely), Math.abs(opt), 1)
                        
                        const scenarios = [
                          { label: 'Conservative', value: cons, color: 'bg-amber-400', textColor: 'text-amber-900' },
                          { label: 'Most Likely', value: likely, color: 'bg-indigo-500', textColor: 'text-indigo-900' },
                          { label: 'Optimistic', value: opt, color: 'bg-teal-500', textColor: 'text-teal-900' }
                        ]
                        
                        return scenarios.map((s, i) => {
                          const width = (Math.abs(s.value) / max) * 100
                          const isNegative = s.value < 0
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <div className="w-24 text-xs font-medium text-gray-600 flex-shrink-0">{s.label}</div>
                              <div className="flex-1 h-6 bg-gray-100 rounded relative overflow-hidden">
                                <div 
                                  className={`h-full ${s.color} flex items-center justify-end px-2`}
                                  style={{ width: `${width}%` }}
                                >
                                  <span className="text-xs font-bold text-white">
                                    {isNegative ? '-' : ''}{Math.abs(s.value).toFixed(1)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      })()}
                    </div>
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
                <div className="space-y-3">
                  {biases.slice(0, 5).map((bias: any, i: number) => (
                    <div key={i} className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                      <div className="font-semibold text-sm text-gray-900 mb-1">{bias.name}</div>
                      <div className="text-xs text-gray-700 mb-2">{bias.description}</div>
                      {bias.mitigation && (
                        <div className="text-xs text-indigo-700 font-medium">
                          💡 <span className="font-semibold">Counter it:</span> {bias.mitigation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-600">No biases detected</div>
              )}
            </div>

            {/* Stream Controls + Output */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Live Stream</h3>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${liveStream ? 'text-green-600' : 'text-gray-500'}`}>
                    {liveStream ? 'On' : 'Off'}
                  </span>
                  <button
                    onClick={toggleLiveStream}
                    className={`px-4 py-2 text-sm font-medium rounded-md ${
                      liveStream
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {liveStream ? 'Stop' : 'Start'}
                  </button>
                </div>
              </div>
              <pre className="bg-gray-50 border border-gray-200 rounded p-3 overflow-auto text-sm font-mono whitespace-pre-wrap min-h-[60px]">
                {streamTokens || '[stream idle - click Start to begin]'}
              </pre>
            </div>

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
                  {USE_PLC_CANVAS ? (
                    <PlcCanvasAdapter
                      nodes={nodes}
                      edges={edges}
                      localEdits={localEdits}
                      onNodesChange={setNodes}
                      onEdgesChange={setEdges}
                    />
                  ) : (
                    <GraphCanvas
                      nodes={nodes}
                      edges={edges}
                      localEdits={localEdits}
                      onEditsChange={setLocalEdits}
                    />
                  )}
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

            {/* Whiteboard */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Whiteboard</h3>
              <iframe
                src="/whiteboard.html"
                title="Whiteboard"
                style={{ 
                  width: '100%', 
                  height: '520px', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '8px', 
                  background: '#fff' 
                }}
              />
              <div className="text-xs text-gray-500 mt-2">
                Sketch ideas or annotate scenarios here
              </div>
            </div>

            {/* Engine Audit */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Engine Audit</h3>
              {Object.keys(lastHeaders).length > 0 ? (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Response Headers</div>
                  <div className="bg-gray-50 border border-gray-200 rounded p-3 space-y-1">
                    {Object.entries(lastHeaders).map(([key, val]) => (
                      <div key={key} className="text-xs">
                        <span className="font-mono text-gray-600">{key}:</span>{' '}
                        <span className="font-mono text-gray-900">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600">No headers captured yet</div>
              )}
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
