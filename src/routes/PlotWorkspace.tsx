// src/routes/PlotWorkspace.tsx
// Unified canvas workspace - whiteboard as background, graph overlay, shared camera

import { useState, useEffect, useCallback } from 'react'
import { fetchFlow, loadFixture } from '../lib/pocEngine'
import { CameraProvider, useCamera } from '../components/PlotCamera'
import WhiteboardCanvas, { type DrawPath } from '../components/WhiteboardCanvas'
import DecisionGraphLayer from '../components/DecisionGraphLayer'
import PlotToolbar, { Tool, NodeType } from '../components/PlotToolbar'
import ResultsPanel from '../components/ResultsPanel'
import OnboardingHints from '../components/OnboardingHints'
import KeyboardShortcuts from '../components/KeyboardShortcuts'
import { saveWorkspaceState, loadWorkspaceState, createAutosaver, clearWorkspaceState } from '../lib/plotStorage'

// Types
type Node = { id: string; label: string; x?: number; y?: number; type?: string }
type Edge = { from: string; to: string; label?: string; weight?: number }
type StickyNote = { id: string; x: number; y: number; text: string; color: string }

// Inner component that has access to camera
function PlotWorkspaceInner() {
  const { camera, setCamera } = useCamera()
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false)
  const [initializationComplete, setInitializationComplete] = useState(false)
  
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
  
  // Whiteboard
  const [whiteboardPaths, setWhiteboardPaths] = useState<DrawPath[]>([])
  
  // Sticky Notes
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteText, setEditingNoteText] = useState('')
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null)
  const [noteDragOffset, setNoteDragOffset] = useState({ x: 0, y: 0 })
  
  // Biases
  const [biases, setBiases] = useState<any[]>([])
  const [biasesSource, setBiasesSource] = useState<'live' | 'demo'>('demo')
  
  // Toolbar
  const [currentTool, setCurrentTool] = useState<Tool>('select')
  
  // Connect mode state
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null)
  
  // Rename state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  
  // UI state
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Load saved workspace state on mount
  useEffect(() => {
    const savedState = loadWorkspaceState()
    if (savedState && savedState.nodes && savedState.nodes.length > 0) {
      // Restore saved workspace
      if (savedState.camera) {
        setCamera(savedState.camera)
      }
      setNodes(savedState.nodes)
      if (savedState.edges) {
        setEdges(savedState.edges)
      }
      if (savedState.whiteboardPaths) {
        setWhiteboardPaths(savedState.whiteboardPaths)
      }
      if (savedState.stickyNotes) {
        setStickyNotes(savedState.stickyNotes)
      }
      console.info('✅ Restored workspace:', savedState.nodes.length, 'nodes,', (savedState.stickyNotes?.length || 0), 'notes,', (savedState.whiteboardPaths?.length || 0), 'paths from', new Date(savedState.lastSaved || 0))
      setWorkspaceLoaded(true) // Mark as loaded with data
    } else {
      // No saved workspace - will fetch fresh scenario
      console.info('No saved workspace - will fetch fresh scenario')
      setWorkspaceLoaded(true)
    }
  }, [setCamera])

  // Initialize on mount: version info, auto-run flow, load biases (ONE TIME ONLY)
  useEffect(() => {
    if (!workspaceLoaded || initializationComplete) return // Wait for workspace load, run once only

    // Fetch version info
    fetch('/version.json')
      .then(r => {
        if (!r.ok) throw new Error('version.json not found')
        return r.json()
      })
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

    // Only fetch fresh scenario if we have no nodes
    if (nodes.length === 0) {
      console.info('🔄 No nodes found - fetching fresh scenario')
      runFlow()
    } else {
      console.info('✅ Using restored workspace -', nodes.length, 'nodes')
    }
    
    // Load biases
    loadBiases()

    console.info('UI_PLOT_WORKSPACE', {
      route: '/plot',
      mode: 'canvas_workspace',
      unified_camera: true,
      whiteboard_bundled: true,
      autosave: true,
      restored: nodes.length > 0
    })

    // Mark initialization as complete
    setInitializationComplete(true)
  }, [workspaceLoaded, initializationComplete, nodes.length])

  // Autosave workspace state
  useEffect(() => {
    if (!workspaceLoaded) return

    const stopAutosave = createAutosaver(() => ({
      camera,
      nodes,
      edges,
      whiteboardPaths,
      stickyNotes
    }))

    return stopAutosave
  }, [workspaceLoaded, camera, nodes, edges, whiteboardPaths, stickyNotes])

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
    // Clear connect source when leaving connect mode
    if (tool !== 'connect') {
      setConnectSourceId(null)
    }
  }, [])

  // Handle add node at viewport center
  const handleAddNode = useCallback((type: NodeType) => {
    // Calculate viewport center in world coordinates
    const viewportCenterX = window.innerWidth / 2
    const viewportCenterY = window.innerHeight / 2
    const worldX = (viewportCenterX - camera.x) / camera.zoom
    const worldY = (viewportCenterY - camera.y) / camera.zoom

    const newNode: Node = {
      id: `node_${Date.now()}`,
      label: `New ${type}`,
      x: worldX,
      y: worldY,
      type
    }
    setNodes(prev => [...prev, newNode])
    setSelectedNodeId(newNode.id)
  }, [camera])

  // Handle add note at viewport center
  const handleAddNote = useCallback(() => {
    // Calculate viewport center in world coordinates
    const canvasRect = { width: window.innerWidth, height: window.innerHeight }
    const viewCenterScreen = { x: canvasRect.width / 2, y: canvasRect.height / 2 }
    const viewCenterWorld = {
      x: (viewCenterScreen.x - camera.x) / camera.zoom,
      y: (viewCenterScreen.y - camera.y) / camera.zoom
    }

    const noteColors = ['#fef3c7', '#fde68a', '#fed7aa', '#fecaca', '#ddd6fe']
    const newNote: StickyNote = {
      id: `note_${Date.now()}`,
      x: viewCenterWorld.x,
      y: viewCenterWorld.y,
      text: 'New note',
      color: noteColors[Math.floor(Math.random() * noteColors.length)]
    }
    
    setStickyNotes(prev => [...prev, newNote])
    setSelectedNoteId(newNote.id)
    // Start editing immediately
    setEditingNoteId(newNote.id)
    setEditingNoteText(newNote.text)
  }, [camera])

  // Handle node click
  const handleNodeClick = useCallback((node: Node) => {
    if (currentTool === 'connect') {
      if (!connectSourceId) {
        // First click: set source
        setConnectSourceId(node.id)
        setSelectedNodeId(node.id)
      } else if (connectSourceId !== node.id) {
        // Second click: create edge if not same node
        const newEdge: Edge = {
          from: connectSourceId,
          to: node.id
        }
        setEdges(prev => [...prev, newEdge])
        setConnectSourceId(null) // Reset for next connection
        setSelectedNodeId(node.id)
      }
    } else {
      // Normal select mode
      setSelectedNodeId(node.id)
    }
  }, [currentTool, connectSourceId])

  // Handle node move (dragging)
  const handleNodeMove = useCallback((nodeId: string, x: number, y: number) => {
    setNodes(prev => prev.map(n => 
      n.id === nodeId ? { ...n, x, y } : n
    ))
  }, [])

  // Handle node delete
  const handleNodeDelete = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId))
    setEdges(prev => prev.filter(e => e.from !== nodeId && e.to !== nodeId))
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null)
    }
  }, [selectedNodeId])

  // Start renaming a node (double-click)
  const handleStartRename = useCallback((node: Node) => {
    setEditingNodeId(node.id)
    setEditingLabel(node.label)
  }, [])

  // Commit rename on Enter
  const handleCommitRename = useCallback(() => {
    if (editingNodeId && editingLabel.trim()) {
      setNodes(prev => prev.map(n =>
        n.id === editingNodeId ? { ...n, label: editingLabel.trim() } : n
      ))
    }
    setEditingNodeId(null)
    setEditingLabel('')
  }, [editingNodeId, editingLabel])

  // Cancel rename on Esc
  const handleCancelRename = useCallback(() => {
    setEditingNodeId(null)
    setEditingLabel('')
  }, [])

  // Reset view to origin
  const handleResetView = useCallback(() => {
    setCamera({ x: 0, y: 0, zoom: 1 })
  }, [setCamera])

  // Clear workspace
  const handleClearWorkspace = useCallback(() => {
    if (confirm('Clear all nodes, edges, notes, and drawings? This cannot be undone.')) {
      setNodes([])
      setEdges([])
      setSelectedNodeId(null)
      setStickyNotes([])
      setSelectedNoteId(null)
      setWhiteboardPaths([])
      setCamera({ x: 0, y: 0, zoom: 1 })
      clearWorkspaceState()
    }
  }, [setCamera])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      if (e.key === 'v' || e.key === 'V') {
        setCurrentTool('select')
        setConnectSourceId(null) // Clear connect state
      } else if (e.key === 'h' || e.key === 'H') {
        setCurrentTool('pan')
        setConnectSourceId(null) // Clear connect state
      } else if (e.key === 'c' || e.key === 'C') {
        setCurrentTool('connect')
        setConnectSourceId(null) // Start fresh
      } else if (e.key === 'n' || e.key === 'N') {
        handleAddNode('decision')
        setConnectSourceId(null) // Clear connect state
      } else if (e.key === 'm' || e.key === 'M') {
        handleAddNote()
        setConnectSourceId(null) // Clear connect state
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          e.preventDefault()
          handleNodeDelete(selectedNodeId)
        }
      } else if (e.key === 'Enter') {
        if (editingNodeId) {
          handleCommitRename()
        }
      } else if (e.key === 'Escape') {
        if (editingNodeId) {
          // Cancel rename in progress
          handleCancelRename()
        } else if (showShortcuts) {
          setShowShortcuts(false)
        } else if (connectSourceId) {
          // Cancel connection in progress
          setConnectSourceId(null)
          setSelectedNodeId(null)
        } else {
          setSelectedNodeId(null)
          setCurrentTool('select')
        }
      } else if (e.key === '?') {
        setShowShortcuts(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleAddNode, handleAddNote, selectedNodeId, handleNodeDelete, showShortcuts, connectSourceId, editingNodeId, handleCommitRename, handleCancelRename])

  // Note dragging
  useEffect(() => {
    if (!draggingNoteId) return

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      
      // Convert screen position to world coordinates
      const worldX = (e.clientX - camera.x) / camera.zoom
      const worldY = (e.clientY - camera.y) / camera.zoom
      
      setStickyNotes(prev => prev.map(n =>
        n.id === draggingNoteId
          ? { ...n, x: worldX, y: worldY }
          : n
      ))
    }

    const handleMouseUp = () => {
      setDraggingNoteId(null)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingNoteId, camera])

  // Banner status
  const allPending = checkEngine === 'pending' || checkFixtures === 'pending' || checkVersion === 'pending'
  const allOk = checkEngine === 'ok' && checkFixtures === 'ok' && checkVersion === 'ok'
  const hasFailure = checkEngine === 'fail' || checkFixtures === 'fail' || checkVersion === 'fail'
  const firstFailure = 
    checkEngine === 'fail' ? 'engine' : 
    checkFixtures === 'fail' ? 'fixtures' : 
    checkVersion === 'fail' ? 'version.json' : null

  // Determine banner appearance
  const bannerClass = allPending ? 'bg-blue-50 border-blue-200 text-blue-900' :
                     allOk && isLiveData ? 'bg-green-50 border-green-200 text-green-900' : 
                     allOk && !isLiveData ? 'bg-teal-50 border-teal-200 text-teal-900' :
                     'bg-amber-50 border-amber-200 text-amber-900'
  
  const bannerMessage = allPending ? '🔄 Checking...' :
                       hasFailure ? `⚠ ${firstFailure}: FAIL` :
                       isLiveData ? '✓ Ready' :
                       '📋 Demo Mode'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Banner */}
      <div className="bg-white border-b border-gray-200 px-4 py-2">
        <div className={`rounded-lg p-2 text-xs border ${bannerClass}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-semibold">
                {bannerMessage}
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
        {/* Layer 0: Whiteboard background */}
        <WhiteboardCanvas 
          initialPaths={whiteboardPaths}
          onPathsChange={setWhiteboardPaths}
        />
        
        {/* Layer 1: Decision graph */}
        <DecisionGraphLayer
          nodes={nodes}
          edges={edges}
          selectedNodeId={selectedNodeId || undefined}
          connectSourceId={connectSourceId || undefined}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleStartRename}
          onNodeMove={handleNodeMove}
        />
        
        {/* Toolbar (left) */}
        <PlotToolbar
          currentTool={currentTool}
          onToolChange={handleToolChange}
          onAddNode={handleAddNode}
          onAddNote={handleAddNote}
          onHelpClick={() => setShowShortcuts(true)}
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
            <div className="border-l border-gray-300 h-6"></div>
            <button
              onClick={handleResetView}
              className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              title="Reset camera to origin"
            >
              Reset View
            </button>
            <button
              onClick={handleClearWorkspace}
              className="px-3 py-1 text-xs font-medium bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors"
              title="Clear all workspace data"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Onboarding hints (dismissible) */}
        <OnboardingHints />

        {/* Keyboard shortcuts modal */}
        <KeyboardShortcuts isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

        {/* Sticky Notes (z-30, above graph nodes) */}
        {stickyNotes.map(note => {
          const screenX = note.x * camera.zoom + camera.x
          const screenY = note.y * camera.zoom + camera.y
          const isEditing = editingNoteId === note.id
          const isSelected = selectedNoteId === note.id
          
          return (
            <div
              key={note.id}
              className="absolute z-30 cursor-move"
              style={{
                left: screenX - 75,
                top: screenY - 60,
                width: 150,
                minHeight: 120
              }}
              onMouseDown={(e) => {
                if (isEditing) return // Don't drag while editing
                e.stopPropagation()
                setSelectedNoteId(note.id)
                setDraggingNoteId(note.id)
                
                // Calculate drag offset in world coordinates
                const rect = e.currentTarget.getBoundingClientRect()
                const canvasX = e.clientX - rect.left
                const canvasY = e.clientY - rect.top
                setNoteDragOffset({ x: canvasX, y: canvasY })
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                setEditingNoteId(note.id)
                setEditingNoteText(note.text)
              }}
            >
              <div
                className={`w-full h-full p-3 rounded-lg shadow-lg border-2 ${
                  isSelected ? 'border-amber-500' : 'border-amber-200'
                }`}
                style={{ backgroundColor: note.color }}
              >
                {isEditing ? (
                  <textarea
                    value={editingNoteText}
                    onChange={(e) => setEditingNoteText(e.target.value)}
                    onBlur={() => {
                      setStickyNotes(prev => prev.map(n =>
                        n.id === note.id ? { ...n, text: editingNoteText } : n
                      ))
                      setEditingNoteId(null)
                    }}
                    autoFocus
                    className="w-full h-full bg-transparent text-sm resize-none focus:outline-none font-handwriting"
                    style={{ fontFamily: 'Comic Sans MS, cursive' }}
                  />
                ) : (
                  <div className="text-sm whitespace-pre-wrap font-handwriting" style={{ fontFamily: 'Comic Sans MS, cursive' }}>
                    {note.text}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Inline rename input */}
        {editingNodeId && (() => {
          const node = nodes.find(n => n.id === editingNodeId)
          if (!node || node.x === undefined || node.y === undefined) return null
          
          // Calculate screen position
          const screenX = node.x * camera.zoom + camera.x
          const screenY = node.y * camera.zoom + camera.y
          
          return (
            <div
              className="absolute z-50"
              style={{
                left: screenX - 80,
                top: screenY - 20,
                width: 160
              }}
            >
              <input
                type="text"
                value={editingLabel}
                onChange={(e) => setEditingLabel(e.target.value)}
                onBlur={handleCommitRename}
                autoFocus
                className="w-full px-3 py-2 text-sm font-semibold text-center bg-white border-2 border-indigo-500 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="Node name..."
              />
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// Outer wrapper provides camera context
export default function PlotWorkspace() {
  return (
    <CameraProvider>
      <PlotWorkspaceInner />
    </CameraProvider>
  )
}
