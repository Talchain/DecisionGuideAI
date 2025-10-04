// src/routes/SandboxV1.tsx
// POC: Enhanced Scenario Sandbox with full rich UI (hard-enabled features, no env flags)

import { useState, useEffect, Suspense } from 'react'
import GraphCanvas, { type Node, type Edge, type LocalEdits } from '../components/GraphCanvas'
import { getEdgeBase } from '../lib/pocFlags'
import { fetchFlow, openSSE, getHashParam } from '../lib/pocEngine'
import { lazySafe } from '../lib/lazySafe'

// POC: Hard-enable features for this preview route
const FEATURE_SANDBOX = true
const FEATURE_SSE = true

// POC: Lazy-load rich components with safe fallbacks
const SandboxStreamPanel = lazySafe(() => import('../components/SandboxStreamPanel'), 'SandboxStreamPanel')
const EngineAuditPanel = lazySafe(() => import('../components/EngineAuditPanel'), 'EngineAuditPanel')
const RunReportDrawer = lazySafe(() => import('../components/RunReportDrawer'), 'RunReportDrawer')
const ConfigDrawer = lazySafe(() => import('../components/ConfigDrawer'), 'ConfigDrawer')
const ScenarioDrawer = lazySafe(() => import('../components/ScenarioDrawer'), 'ScenarioDrawer')
const HealthIndicator = lazySafe(() => import('../components/HealthIndicator'), 'HealthIndicator')
const JobsProgressPanel = lazySafe(() => import('../components/JobsProgressPanel'), 'JobsProgressPanel')
const BiasesCarousel = lazySafe(() => import('../components/BiasesCarousel'), 'BiasesCarousel')

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
  
  // POC: Drawer states
  const [reportDrawerOpen, setReportDrawerOpen] = useState(false)
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false)
  const [scenarioDrawerOpen, setScenarioDrawerOpen] = useState(false)
  
  // POC: Section visibility (URL-based toggles)
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set())

  useEffect(() => {
    // POC: Read build ID from meta tag
    const metaBuild = document.querySelector<HTMLMetaElement>('meta[name="x-build-id"]')?.content || '(unknown)'
    setBuild(metaBuild)

    // POC: Read edge from URL or default
    const edgeOverride = getHashParam('edge')
    const edgeUrl = edgeOverride || getEdgeBase()
    setEdge(edgeUrl)
    
    // POC: Read template and seed from URL if present
    const templateOverride = getHashParam('template')
    const seedOverride = getHashParam('seed')
    if (templateOverride) setTemplate(templateOverride)
    if (seedOverride) setSeed(Number(seedOverride))
    
    // POC: Read sections to show/hide
    const sectionsParam = getHashParam('sections')
    if (sectionsParam) {
      const sectionsList = sectionsParam.split(',').map(s => s.trim())
      setVisibleSections(new Set(sectionsList))
    } else {
      // Default: show all sections
      setVisibleSections(new Set(['stream', 'audit', 'canvas', 'report', 'biases', 'config', 'scenario', 'jobs', 'health']))
    }

    // POC: Loud acceptance log
    console.info('UI_POC_SANDBOX_V1_ENHANCED', {
      edge: edgeUrl,
      template: templateOverride || 'pricing_change',
      seed: seedOverride || 101,
      hardcoded: { sandbox: true, sse: true },
      sections: sectionsParam || 'all'
    })

    // POC: Signal HTML failsafe
    try { (window as any).__APP_MOUNTED__?.() } catch {}
  }, [])

  const isVisible = (section: string) => visibleSections.size === 0 || visibleSections.has(section)

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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Scenario Sandbox (Preview)</h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-2">
            <div><span className="font-semibold">Edge:</span> {edge}</div>
            <div><span className="font-semibold">Build:</span> {build}</div>
          </div>
          <div className="text-xs text-gray-500">
            This preview is hard-enabled for PoC demo purposes. All features active.
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
            {FEATURE_SSE && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={liveStream}
                  onChange={toggleLiveStream}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-gray-700">Live stream</span>
              </label>
            )}
            <div className="ml-auto flex gap-2">
              {isVisible('report') && (
                <button
                  onClick={() => setReportDrawerOpen(true)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
                >
                  Report
                </button>
              )}
              {isVisible('config') && (
                <button
                  onClick={() => setConfigDrawerOpen(true)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
                >
                  Config
                </button>
              )}
              {isVisible('scenario') && (
                <button
                  onClick={() => setScenarioDrawerOpen(true)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
                >
                  Scenarios
                </button>
              )}
            </div>
          </div>
          {lastUpdated && (
            <div className="text-xs text-gray-500">
              Last updated: {lastUpdated} ({flowTiming}ms) • Template: {template} • Seed: {seed}
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Results</h3>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {flowResult.scenarios?.conservative && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-yellow-900 mb-1">Conservative</div>
                      <div className="text-lg font-bold text-yellow-900">
                        {flowResult.scenarios.conservative.cost_delta || flowResult.scenarios.conservative.value}
                      </div>
                      {flowResult.scenarios.conservative.risk && (
                        <div className="text-xs text-yellow-700">Risk: {flowResult.scenarios.conservative.risk}</div>
                      )}
                    </div>
                  )}
                  {flowResult.scenarios?.most_likely && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-blue-900 mb-1">Most Likely</div>
                      <div className="text-lg font-bold text-blue-900">
                        {flowResult.scenarios.most_likely.cost_delta || flowResult.scenarios.most_likely.value}
                      </div>
                      {flowResult.scenarios.most_likely.risk && (
                        <div className="text-xs text-blue-700">Risk: {flowResult.scenarios.most_likely.risk}</div>
                      )}
                    </div>
                  )}
                  {flowResult.scenarios?.optimistic && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-green-900 mb-1">Optimistic</div>
                      <div className="text-lg font-bold text-green-900">
                        {flowResult.scenarios.optimistic.cost_delta || flowResult.scenarios.optimistic.value}
                      </div>
                      {flowResult.scenarios.optimistic.risk && (
                        <div className="text-xs text-green-700">Risk: {flowResult.scenarios.optimistic.risk}</div>
                      )}
                    </div>
                  )}
                </div>
                {flowResult.thresholds && flowResult.thresholds.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold text-gray-700 mb-2">Thresholds:</div>
                    <div className="flex flex-wrap gap-2">
                      {flowResult.thresholds.map((t: any, i: number) => (
                        <span
                          key={i}
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            t.crossed
                              ? 'bg-red-50 border border-red-200 text-red-800'
                              : 'bg-green-50 border border-green-200 text-green-800'
                          }`}
                        >
                          {t.label} {t.crossed && '(crossed)'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* BiasesCarousel */}
            {isVisible('biases') && (
              <Suspense fallback={<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-gray-500">Loading biases...</div>}>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Cognitive Biases</h3>
                  <BiasesCarousel />
                </div>
              </Suspense>
            )}

            {/* SandboxStreamPanel */}
            {isVisible('stream') && (
              <Suspense fallback={<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-gray-500">Loading stream panel...</div>}>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <SandboxStreamPanel />
                </div>
              </Suspense>
            )}

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
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Graph */}
            {nodes.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Decision Graph</h3>
                {isVisible('canvas') ? (
                  <Suspense fallback={<div className="text-gray-500">Loading canvas...</div>}>
                    <GraphCanvas
                      nodes={nodes}
                      edges={edges}
                      localEdits={localEdits}
                      onEditsChange={setLocalEdits}
                    />
                  </Suspense>
                ) : (
                  <GraphCanvas
                    nodes={nodes}
                    edges={edges}
                    localEdits={localEdits}
                    onEditsChange={setLocalEdits}
                  />
                )}
              </div>
            )}

            {/* EngineAuditPanel */}
            {isVisible('audit') && (
              <Suspense fallback={<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-gray-500">Loading audit panel...</div>}>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Engine Audit</h3>
                  <EngineAuditPanel />
                </div>
              </Suspense>
            )}

            {/* HealthIndicator */}
            {isVisible('health') && (
              <Suspense fallback={<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-gray-500">Loading health...</div>}>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
                  <HealthIndicator />
                </div>
              </Suspense>
            )}

            {/* JobsProgressPanel */}
            {isVisible('jobs') && (
              <Suspense fallback={<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-gray-500">Loading jobs...</div>}>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Jobs Progress</h3>
                  <JobsProgressPanel />
                </div>
              </Suspense>
            )}
          </div>
        </div>

        {/* Drawers */}
        {isVisible('report') && reportDrawerOpen && (
          <Suspense fallback={null}>
            <RunReportDrawer isOpen={reportDrawerOpen} onClose={() => setReportDrawerOpen(false)} />
          </Suspense>
        )}
        {isVisible('config') && configDrawerOpen && (
          <Suspense fallback={null}>
            <ConfigDrawer isOpen={configDrawerOpen} onClose={() => setConfigDrawerOpen(false)} />
          </Suspense>
        )}
        {isVisible('scenario') && scenarioDrawerOpen && (
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
