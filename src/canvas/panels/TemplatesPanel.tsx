import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Layout } from 'lucide-react'
import { plot, adapterName } from '../../adapters/plot'
import type { Blueprint } from '../../templates/blueprints/types'
import { useTemplatesRun } from '../../routes/templates/hooks/useTemplatesRun'
import { SummaryCard } from '../../routes/templates/components/SummaryCard'
import { WhyPanel } from '../../routes/templates/components/WhyPanel'
import { ReproduceShareCard } from '../../routes/templates/components/ReproduceShareCard'
import { ErrorBanner } from '../../routes/templates/components/ErrorBanner'
import { ProgressStrip } from '../../routes/templates/components/ProgressStrip'
import { TemplateCard } from './TemplateCard'
import { TemplateAbout } from './TemplateAbout'
import { PlotHealthPill } from '../../adapters/plot/v1/components/PlotHealthPill'
import { AdapterStatusBanner } from './AdapterStatusBanner'
import { PanelShell } from './_shared/PanelShell'
import { PanelSection } from './_shared/PanelSection'
import { useCanvasStore } from '../store'
import { createScenario, saveScenarios, loadScenarios, setCurrentScenarioId } from '../store/scenarios'
import { TemplateSkeleton } from '../components/TemplateSkeleton'

interface TemplatesPanelProps {
  isOpen: boolean
  onClose: () => void
  onInsertBlueprint?: (blueprint: Blueprint) => void
  onPinToCanvas?: (data: { template_id: string; seed: number; response_hash: string; likely_value: number }) => void
  insertionError?: string | null // Sprint 2: Show error when blueprint insertion fails
}

export function TemplatesPanel({ isOpen, onClose, onInsertBlueprint, onPinToCanvas, insertionError }: TemplatesPanelProps): JSX.Element | null {
  const [blueprints, setBlueprints] = useState<Array<{ id: string; name: string; description: string; category?: string }>>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedBlueprintId, setSelectedBlueprintId] = useState<string | null>(null)
  const [selectedBlueprint, setSelectedBlueprint] = useState<Blueprint | null>(null)
  const [templateVersion, setTemplateVersion] = useState<string | undefined>(undefined)
  const [showDevControls, setShowDevControls] = useState(false)
  const [seed, setSeed] = useState<string>('1337')
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const { loading, progress, canCancel, result, error, run, cancel, clearError } = useTemplatesRun()

  // Load templates from adapter (supports both mock and httpv1)
  useEffect(() => {
    setTemplatesLoading(true)
    plot.templates()
      .then(list => {
        // Guard for both { items: [...] } and legacy [...] array formats
        let templates: any[] = []

        if (Array.isArray(list)) {
          // Legacy format: direct array
          templates = list
        } else if (list && Array.isArray(list.items)) {
          // New format: wrapped in items
          templates = list.items
        } else {
          if (import.meta.env.DEV) {
            console.error('❌ Invalid templates response:', list)
          }
          setBlueprints([])
          return
        }

        setBlueprints(templates.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          category: t.category || 'Other'
        })))
        setTemplatesLoading(false)
      })
      .catch(err => {
        if (import.meta.env.DEV) {
          console.error('❌ Failed to load templates from PLoT engine:', err)
        }
        // NO FALLBACK - fail loudly to surface issues
        setBlueprints([])
        setTemplatesLoading(false)
      })
  }, [])

  // Get unique categories with counts
  const categories = ['all', ...Array.from(new Set(blueprints.map(bp => bp.category || 'Other').filter(Boolean)))]
  const categoryCounts = blueprints.reduce((acc, bp) => {
    const cat = bp.category || 'Other'
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const filteredBlueprints = blueprints.filter(bp => {
    const matchesSearch = bp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bp.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || bp.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // Focus management: Focus close button on open for easy dismissal
  // On close, focus restoration is handled by store.closeTemplatesPanel()
  useEffect(() => {
    if (isOpen && panelRef.current) {
      // Target close button explicitly for consistent UX
      const closeButton = panelRef.current.querySelector<HTMLElement>('[aria-label="Close panel"]')
      if (closeButton) {
        closeButton.focus()
      } else {
        // Fallback: focus first interactive element
        const firstFocusable = panelRef.current.querySelector<HTMLElement>('button, input')
        firstFocusable?.focus()
      }
    }
  }, [isOpen])

  const handleInsert = useCallback(async (templateId: string) => {
    // P0-6: Confirm before starting from template (replaces canvas)
    const state = useCanvasStore.getState()
    const hasUnsavedChanges = state.isDirty || state.nodes.length > 0

    if (hasUnsavedChanges) {
      const confirm = window.confirm(
        'Start from Template will replace your current canvas. Any unsaved changes will be lost. Continue?'
      )
      if (!confirm) {
        return
      }
    }

    try {
      // Fetch template from API (works for both mock and httpv1)
      const templateDetail = await plot.template(templateId)

      // Validate graph structure (graph is typed as 'unknown' in TemplateDetail)
      const graph = templateDetail.graph as any
      if (!graph || typeof graph !== 'object') {
        throw new Error(`Template ${templateId} has invalid graph structure`)
      }

      if (!Array.isArray(graph.nodes)) {
        throw new Error(`Template ${templateId} graph.nodes is not an array`)
      }

      // Convert backend graph to Blueprint format for canvas insertion
      // Backend nodes may not have 'kind' or 'position', add defaults
      const blueprintNodes = (graph.nodes || []).map((node: any, index: number) => ({
        id: node.id,
        label: node.label || node.id,
        kind: node.kind || 'decision', // Default to decision if not specified
        body: node.body, // v1.2: preserve body text
        position: node.position || { x: 200 + (index % 3) * 250, y: 100 + Math.floor(index / 3) * 200 }, // Grid layout if no position
      }))

      // Backend edges may not have IDs, generate them
      const blueprintEdges = (graph.edges || []).map((edge: any) => ({
        id: edge.id || `${edge.from}-${edge.to}`, // Generate ID if missing
        from: edge.from,
        to: edge.to,
        probability: edge.probability,
        weight: edge.weight,
        belief: edge.belief,          // v1.2: epistemic confidence
        provenance: edge.provenance,  // v1.2: source tracking
      }))

      const blueprint: Blueprint = {
        id: templateDetail.id,
        name: templateDetail.name,
        description: templateDetail.description,
        nodes: blueprintNodes,
        edges: blueprintEdges,
      }

      if (onInsertBlueprint) {
        onInsertBlueprint(blueprint)
        setSelectedBlueprintId(templateId)
        setSelectedBlueprint(blueprint)

        // v1.2: Capture template version with diagnostic logging (dev only)
        const capturedVersion = templateDetail.version || graph.version
        if (import.meta.env.DEV) {
          console.log('[VersionCapture]', {
            templateId,
            templateDetailVersion: templateDetail.version,
            graphVersion: graph.version,
            captured: capturedVersion
          })
        }
        setTemplateVersion(capturedVersion)

        setSeed(String(templateDetail.default_seed || 1337))
        showToast('Scenario created from template.')
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to load template:', err)
      }
      showToast('Failed to load template.')
    }
  }, [onInsertBlueprint])

  // P0-6: Merge template into current canvas (from template card)
  const handleMerge = useCallback(async (templateId: string) => {
    try {
      // P0-6: Confirm before merging (adds nodes/edges to canvas)
      const templateDetail = await plot.template(templateId)
      const graph = templateDetail.graph as any

      if (!graph || !Array.isArray(graph.nodes)) {
        throw new Error(`Template ${templateId} has invalid graph structure`)
      }

      const nodeCount = graph.nodes.length
      const edgeCount = (graph.edges || []).length

      const confirm = window.confirm(
        `Merge "${templateDetail.name}" into current canvas? This will add ${nodeCount} nodes and ${edgeCount} edges to your existing work.`
      )

      if (!confirm) {
        return
      }

      // Calculate offset to avoid overlapping existing nodes
      const state = useCanvasStore.getState()
      let xOffset = 0
      let yOffset = 0

      if (state.nodes.length > 0) {
        // Find rightmost existing node
        const maxX = Math.max(...state.nodes.map(n => n.position.x + (n.width || 200)))
        // Place merged content 300px to the right of existing content
        xOffset = maxX + 300
      }

      // Create ID mapping for edges
      const nodeIdMap = new Map<string, string>()

      // Convert template nodes to ReactFlow nodes with new IDs and offset positions
      const newNodes: any[] = (graph.nodes || []).map((node: any, index: number) => {
        const newNodeId = state.createNodeId()
        nodeIdMap.set(node.id, newNodeId)

        const defaultPos = { x: 200 + (index % 3) * 250, y: 100 + Math.floor(index / 3) * 200 }
        const pos = node.position || defaultPos

        return {
          id: newNodeId,
          type: node.kind || 'decision',
          position: { x: pos.x + xOffset, y: pos.y + yOffset },
          data: {
            label: node.label || node.id,
            body: node.body,
            prior: node.prior,
            utility: node.utility,
            templateId: templateDetail.id,
            templateName: templateDetail.name,
            templateCreatedAt: Date.now()
          }
        }
      })

      // Convert template edges to ReactFlow edges with mapped IDs
      const newEdges: any[] = (graph.edges || []).map((edge: any) => {
        const newEdgeId = state.createEdgeId()
        const mappedSource = nodeIdMap.get(edge.from || edge.source) || edge.from || edge.source
        const mappedTarget = nodeIdMap.get(edge.to || edge.target) || edge.to || edge.target

        return {
          id: newEdgeId,
          source: mappedSource,
          target: mappedTarget,
          data: {
            schemaVersion: 3,
            weight: edge.weight ?? 1.0,
            confidence: edge.probability,
            belief: edge.belief ?? edge.probability,
            provenance: edge.provenance,
            templateId: templateDetail.id
          }
        }
      })

      // Directly append to store
      state.pushHistory()
      useCanvasStore.setState(currentState => ({
        nodes: [...currentState.nodes, ...newNodes],
        edges: [...currentState.edges, ...newEdges]
      }))

      showToast(`Merged "${templateDetail.name}" into canvas.`)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to merge template:', err)
      }
      showToast('Failed to merge template.')
    }
  }, [showToast])

  const handleRun = useCallback(async () => {
    if (!selectedBlueprintId) return
    let seedNum = parseInt(seed, 10)
    if (isNaN(seedNum) || seedNum < 1) {
      showToast('Please enter a valid seed (≥1)')
      return
    }

    // P0-5: "Analyse again" always runs - bump seed to bypass cache
    if (result) {
      seedNum += 1
      setSeed(String(seedNum))
    }

    // P0-3: Hand-off to Results panel - close Templates panel and open Results
    onClose() // Close Templates panel
    useCanvasStore.getState().setShowResultsPanel(true) // Open Results panel

    await run({ template_id: selectedBlueprintId, seed: seedNum })
  }, [selectedBlueprintId, seed, run, onClose, result])

  const handleReset = useCallback(() => {
    clearError()
    setSeed('1337')
    setSelectedBlueprintId(null)
    setSelectedBlueprint(null)
    setTemplateVersion(undefined)
  }, [clearError])

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }, [])

  const handlePinToCanvas = useCallback(() => {
    if (result && selectedBlueprint && onPinToCanvas) {
      onPinToCanvas({
        template_id: selectedBlueprint.id,
        seed: parseInt(seed, 10),
        response_hash: result.model_card.response_hash,
        likely_value: result.results.likely
      })
      showToast('Pinned to canvas.')
    }
  }, [result, selectedBlueprint, seed, onPinToCanvas, showToast])

  // v1.2: Save current canvas as a named scenario
  const handleSaveAsScenario = useCallback(() => {
    if (!selectedBlueprint) return

    const name = window.prompt('Scenario name:', selectedBlueprint.name)

    // User cancelled or entered empty name
    if (!name || !name.trim()) {
      if (name === '') {
        showToast('Scenario name cannot be empty.')
      }
      return
    }

    const trimmedName = name.trim()

    // Check for duplicate names
    const existingScenarios = loadScenarios()
    const duplicate = existingScenarios.find(s => s.name.toLowerCase() === trimmedName.toLowerCase())

    if (duplicate) {
      const overwrite = window.confirm(`A scenario named "${trimmedName}" already exists. Overwrite it?`)
      if (!overwrite) {
        showToast('Scenario save cancelled.')
        return
      }
      // Remove the duplicate before saving new one
      const filtered = existingScenarios.filter(s => s.id !== duplicate.id)
      saveScenarios(filtered)
    }

    const state = useCanvasStore.getState()
    const scenario = createScenario({
      name: trimmedName,
      nodes: state.nodes,
      edges: state.edges,
      source_template_id: selectedBlueprint.id,
      source_template_version: templateVersion
    })

    const scenarios = loadScenarios()
    scenarios.unshift(scenario)
    saveScenarios(scenarios)
    setCurrentScenarioId(scenario.id)

    showToast(`Scenario "${trimmedName}" saved.`)
  }, [selectedBlueprint, templateVersion, showToast])

  // v1.2: Merge another template into current canvas
  const handleMergeIntoCurrent = useCallback(async () => {
    if (!selectedBlueprintId) return

    try {
      // Fetch template to merge
      const templateDetail = await plot.template(selectedBlueprintId)
      const graph = templateDetail.graph as any

      if (!graph || !Array.isArray(graph.nodes)) {
        throw new Error(`Template ${selectedBlueprintId} has invalid graph structure`)
      }

      // Calculate offset to avoid overlapping existing nodes
      const state = useCanvasStore.getState()
      let xOffset = 0
      let yOffset = 0

      if (state.nodes.length > 0) {
        // Find rightmost existing node
        const maxX = Math.max(...state.nodes.map(n => n.position.x + (n.width || 200)))
        // Place merged content 300px to the right of existing content
        xOffset = maxX + 300
      }

      // Create ID mapping for edges
      const nodeIdMap = new Map<string, string>()

      // Convert template nodes to ReactFlow nodes with new IDs and offset positions
      const newNodes: Node[] = (graph.nodes || []).map((node: any, index: number) => {
        const newNodeId = state.createNodeId()
        nodeIdMap.set(node.id, newNodeId)

        const defaultPos = { x: 200 + (index % 3) * 250, y: 100 + Math.floor(index / 3) * 200 }
        const pos = node.position || defaultPos

        return {
          id: newNodeId,
          type: node.kind || 'decision',
          position: { x: pos.x + xOffset, y: pos.y + yOffset },
          data: {
            label: node.label || node.id,
            body: node.body,
            prior: node.prior,
            utility: node.utility,
            templateId: templateDetail.id,
            templateName: templateDetail.name,
            templateCreatedAt: Date.now()
          }
        }
      })

      // Convert template edges to ReactFlow edges with mapped IDs
      const newEdges: Edge[] = (graph.edges || []).map((edge: any) => {
        const newEdgeId = state.createEdgeId()
        const mappedSource = nodeIdMap.get(edge.from || edge.source) || edge.from || edge.source
        const mappedTarget = nodeIdMap.get(edge.to || edge.target) || edge.to || edge.target

        return {
          id: newEdgeId,
          source: mappedSource,
          target: mappedTarget,
          data: {
            schemaVersion: 3,
            weight: edge.weight ?? 1.0,
            confidence: edge.probability,
            belief: edge.belief ?? edge.probability,
            provenance: edge.provenance,
            templateId: templateDetail.id
          }
        }
      })

      // Directly append to store bypassing existing template check
      state.pushHistory()
      useCanvasStore.setState(currentState => ({
        nodes: [...currentState.nodes, ...newNodes],
        edges: [...currentState.edges, ...newEdges]
      }))

      showToast('Template merged into current scenario.')
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Failed to merge template:', err)
      }
      showToast('Failed to merge template.')
    }
  }, [selectedBlueprintId, showToast])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // Keyboard shortcut: Cmd/Ctrl+T to toggle, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault()
        if (isOpen) handleClose()
      }
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  if (!isOpen) return null

  // Health chip
  const healthChip = (adapterName === 'httpv1' || adapterName === 'auto') ? (
    <PlotHealthPill pause={!isOpen} />
  ) : undefined

  // Footer with Run button and scenario actions (only show when template loaded and not running)
  const footer = selectedBlueprintId && !loading ? (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleRun}
        disabled={loading}
        className={`w-full px-6 py-3 text-base font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed ${
          result
            ? 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
            : 'text-white bg-blue-600 hover:bg-blue-700 shadow-sm hover:shadow-md'
        }`}
        type="button"
      >
        {loading ? 'Running Analysis…' : result ? 'Analyse again' : '▶ Run Analysis'}
      </button>
      <div className="flex gap-2">
        <button
          onClick={handleSaveAsScenario}
          className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          type="button"
          title="Save current canvas as a named scenario"
        >
          Save as Scenario
        </button>
        <button
          onClick={handleMergeIntoCurrent}
          className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          type="button"
          title="Merge this template into current canvas"
        >
          Merge into Current
        </button>
      </div>
    </div>
  ) : undefined

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[1999]"
        onClick={handleClose}
      />

      {/* Panel Shell */}
      <div className="fixed right-0 top-0 bottom-0 z-[2000]" ref={panelRef}>
        <PanelShell
          icon={<Layout className="w-5 h-5" />}
          title="Templates"
          chips={healthChip}
          onClose={handleClose}
          footer={footer}
          width="420px"
        >
          <div className="relative">
            {/* Adapter Status Banner (dev-only, shows when v1 unavailable) */}
            <AdapterStatusBanner visible={isOpen && adapterName === 'auto'} />

            {/* Insertion Error Banner (Sprint 2) */}
            {insertionError && (
              <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-danger-100 flex items-center justify-center mt-0.5">
                    <span className="text-danger-700 text-xs font-bold">!</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-danger-900 mb-1">Blueprint Insertion Failed</p>
                    <p className="text-xs text-danger-700 leading-relaxed">{insertionError}</p>
                  </div>
                </div>
              </div>
            )}

          {/* Template Browser */}
          {!selectedBlueprintId && (
            <>
              {/* Category Pills */}
              {!templatesLoading && categories.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {categories.map(cat => {
                    const count = cat === 'all' ? blueprints.length : categoryCounts[cat] || 0
                    return (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                          selectedCategory === cat
                            ? 'bg-info-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        type="button"
                      >
                        {cat === 'all' ? 'All' : cat} ({count})
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-info-500"
                />
              </div>

              {/* Show skeleton while loading templates */}
              {templatesLoading ? (
                <TemplateSkeleton />
              ) : filteredBlueprints.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  No templates found matching your criteria
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredBlueprints.map(bp => (
                    <TemplateCard
                      key={bp.id}
                      template={{ id: bp.id, name: bp.name, description: bp.description }}
                      nodes={bp.nodes}
                      edges={bp.edges}
                      onInsert={handleInsert}
                      onMerge={handleMerge}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* About Section */}
          {selectedBlueprint && (
            <>
              <TemplateAbout blueprint={selectedBlueprint} version={templateVersion} />

              <button
                onClick={() => {
                  setSelectedBlueprintId(null)
                  setSelectedBlueprint(null)
                  setTemplateVersion(undefined)
                }}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                type="button"
              >
                ← Back to templates
              </button>
            </>
          )}


          {/* Dev Controls Toggle */}
          {selectedBlueprintId && (
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <label htmlFor="dev-toggle" className="text-sm font-medium text-gray-700">
                Show dev controls
              </label>
              <button
                id="dev-toggle"
                role="switch"
                aria-checked={showDevControls}
                onClick={() => setShowDevControls(!showDevControls)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-info-500 ${
                  showDevControls ? 'bg-info-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showDevControls ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}

          {/* Dev Toolbar (collapsible) */}
          {showDevControls && selectedBlueprintId && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-yellow-800 uppercase tracking-wide">Dev Controls</span>
                <span className="text-xs bg-yellow-200 text-yellow-900 px-2 py-1 rounded font-mono">Adapter: {adapterName}</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label htmlFor="seed-input" className="block text-sm font-medium text-gray-700 mb-1">
                    Seed
                  </label>
                  <input
                    id="seed-input"
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-info-500"
                    min="1"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleRun}
                    disabled={loading || !selectedBlueprintId}
                    className="flex-1 px-4 py-2 text-sm text-white bg-info-500 hover:bg-info-600 rounded-md focus:outline-none focus:ring-2 focus:ring-info-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Running…' : 'Run'}
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Progress */}
          <ProgressStrip
            isVisible={loading}
            progress={progress}
            canCancel={canCancel}
            onCancel={cancel}
          />

          {/* Error */}
          {error && (
            <ErrorBanner error={error} onRetry={handleRun} onDismiss={clearError} />
          )}

          {/* Results */}
          {result && selectedBlueprint && (
            <div className="space-y-4">
              <SummaryCard 
                report={result} 
                onCopyHash={() => showToast('Verification hash copied.')}
              />
              <WhyPanel report={result} />
              <ReproduceShareCard
                report={result}
                template={{ 
                  id: selectedBlueprint.id,
                  name: selectedBlueprint.name,
                  version: '1.0',
                  description: selectedBlueprint.description,
                  default_seed: parseInt(seed, 10),
                  graph: {}
                }}
                seed={parseInt(seed, 10)}
                onCopySeed={() => showToast('Seed copied.')}
                onCopyHash={() => showToast('Verification hash copied.')}
                onAddToNote={() => showToast('Added to Note.')}
              />
              
              {/* Pin to Canvas button */}
              {onPinToCanvas && (
                <button
                  onClick={handlePinToCanvas}
                  className="w-full px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1"
                  type="button"
                >
                  Pin to Canvas
                </button>
              )}
            </div>
          )}

            {/* Toast */}
            {toastMessage && (
              <div
                role="status"
                aria-live="polite"
                className="absolute bottom-4 left-0 right-0 mx-4 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg text-sm"
              >
                {toastMessage}
              </div>
            )}
          </div>
        </PanelShell>
      </div>
    </>
  )
}
