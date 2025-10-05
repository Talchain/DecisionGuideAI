// src/routes/PlotWorkspace.tsx
// Unified canvas workspace - whiteboard as background, graph overlay, shared camera

import { useState, useEffect, useCallback } from 'react'
import { fetchFlow, loadFixture } from '../lib/pocEngine'
import { CameraProvider } from '../components/PlotCamera'
import WhiteboardCanvas from '../components/WhiteboardCanvas'
import DecisionGraphLayer from '../components/DecisionGraphLayer'
import PlotToolbar, { Tool, NodeType } from '../components/PlotToolbar'
import ResultsPanel from '../components/ResultsPanel'

// Types
type Node = { id: string; label: string; x?: number; y?: number; type?: string }
type Edge = { from: string; to: string; label?: string; weight?: number }

export default function PlotWorkspace() {
  // Version & health
  const [deployCommit, setDeployCommit] = useState<string>('')
  const [checkEngine, setCheckEngine] = useState<'pending' | 'ok' | 'fail'>('pending')
  const [checkFixtures, setCheckFixtures] = useState<'pending' | 'ok' | 'fail'>('pending')
  const [checkVersion, setCheckVersion] = useState<'pending' | 'ok' | 'fail'>('pending')
  
  // Flow state
  const [edge] = useState('/engine')
  const [template, setTemplate] = useState('pricing_change')
  const [seed, setSeed] = useState(101)
  const [flowResult, setFlowResult] = useState<any>(null)
  const [flowError, setFlowError] = useState<string>('')
  const [isLiveData, setIsLiveData] = useState(false)
  
  // Graph
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  
  // Biases
  const [biases, setBiases] = useState<any[]>([])
  const [biasesSource, setBiasesSource] = useState<'live' | 'demo'>('demo')
  
  // Toolbar
  const [currentTool, setCurrentTool] = useState<Tool>('select')

  // Initialize
  useEffect(() => {
    // Version check
    fetch('/version.json')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(v => {
        setDeployCommit(v.short || v.commit || '')
        setCheckVersion('ok')
      })
      .catch(() => setCheckVersion('fail'))

    // Fixtures check
    Promise.all([
      fetch('/fixtures/report_pricing_change.json').then(r => r.ok),
      fetch('/fixtures/biases.default.json').then(r => r.ok)
    ]).then(([report, biases]) => {
      setCheckFixtures(report && biases ? 'ok' : 'fail')
    }).catch(() => setCheckFixtures('fail'))

    // Run flow
    runFlow()
    
    // Load biases
    loadBiases()

    console.info('UI_PLOT_WORKSPACE', {
      route: '/plot',
      mode: 'canvas_workspace',
      unified_camera: true,
      whiteboard_bundled: true
    })
  }, [])

  // Load biases from fixtures
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
    
    const hasValidData = result.ok && result.data && (result.data.results || result.data.graph)
    
    if (hasValidData) {
      setCheckEngine('ok')
      setFlowResult(result.data)
      setIsLiveData(true)
      if (result.data.graph) {
        setNodes(result.data.graph.nodes || [])
        setEdges(result.data.graph.edges || [])
      }
      if (result.data.biases?.length > 0) {
        setBiases(result.data.biases)
        setBiasesSource('live')
      }
    } else {
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
      }
    }
  }

  // Handle tool change
  const handleToolChange = useCallback((tool: Tool) => {
    setCurrentTool(tool)
  }, [])

  // Handle add node
  const handleAddNode = useCallback((type: NodeType) => {
    const newNode: Node = {
      id: `node_${Date.now()}`,
      label: `New ${type}`,
      x: 0, // Center of current viewport
      y: 0,
      type
    }
    setNodes(prev => [...prev, newNode])
    setSelectedNodeId(newNode.id)
  }, [])

  // Handle node click
  const handleNodeClick = useCallback((node: Node) => {
    setSelectedNodeId(node.id)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      if (e.key === 'v' || e.key === 'V') {
        setCurrentTool('select')
      } else if (e.key === 'h' || e.key === 'H') {
        setCurrentTool('pan')
      } else if (e.key === 'n' || e.key === 'N') {
        handleAddNode('decision')
      } else if (e.key === 'Escape') {
        setSelectedNodeId(null)
        setCurrentTool('select')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleAddNode])

  // Banner status
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Banner */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className={`rounded-lg p-2 text-xs border ${bannerClass}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-semibold">
                {allPending ? '🔄 Checking...' : allOk ? '✓ Ready' : `⚠ ${firstFailure}: FAIL`}
              </span>
              <div className="flex items-center gap-2 text-[10px]">
                <span className={checkEngine === 'ok' ? 'text-green-700' : checkEngine === 'fail' ? 'text-amber-700' : 'text-gray-500'}>
                  engine: {checkEngine === 'ok' ? 'OK' : checkEngine === 'fail' ? 'FAIL' : '...'}
                </span>
                <span className={checkFixtures === 'ok' ? 'text-green-700' : checkFixtures === 'fail' ? 'text-amber-700' : 'text-gray-500'}>
                  fixtures: {checkFixtures === 'ok' ? 'OK' : checkFixtures === 'fail' ? 'FAIL' : '...'}
                </span>
              </div>
            </div>
            {deployCommit && (
              <span className="font-mono text-gray-600">@{deployCommit}</span>
            )}
          </div>
        </div>
      </div>

      {/* Canvas Workspace */}
      <div className="flex-1 relative overflow-hidden">
        <CameraProvider>
          {/* Layer 0: Whiteboard background */}
          <WhiteboardCanvas />
          
          {/* Layer 1: Decision graph */}
          <DecisionGraphLayer
            nodes={nodes}
            edges={edges}
            selectedNodeId={selectedNodeId || undefined}
            onNodeClick={handleNodeClick}
          />
          
          {/* Toolbar (left) */}
          <PlotToolbar
            currentTool={currentTool}
            onToolChange={handleToolChange}
            onAddNode={handleAddNode}
          />
          
          {/* Results Panel (right) */}
          <ResultsPanel
            flowResult={flowResult}
            isLiveData={isLiveData}
            biases={biases}
            biasesSource={biasesSource}
          />

          {/* Top controls bar */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-2 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-700">Template:</label>
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1"
                >
                  <option value="pricing_change">Pricing Change</option>
                  <option value="feature_launch">Feature Launch</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-700">Seed:</label>
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(parseInt(e.target.value) || 101)}
                  className="text-xs border border-gray-300 rounded px-2 py-1 w-20"
                />
              </div>
              <button
                onClick={runFlow}
                className="px-3 py-1 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
              >
                Run Scenario
              </button>
            </div>
          </div>
        </CameraProvider>
      </div>
    </div>
  )
}
