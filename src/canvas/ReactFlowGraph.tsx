import { useCallback, useEffect, useState, useMemo, useRef, lazy, Suspense } from 'react'
import { useLocation } from 'react-router-dom'
import { ReactFlow, ReactFlowProvider, MiniMap, Background, BackgroundVariant, type Connection, type NodeChange, type EdgeChange, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
// Note: shallow from 'zustand/shallow' was removed - causes infinite loops with Zustand v5
// Use individual selectors instead (see React #185 fix comment below)
import { useCanvasStore } from './store'
import { DEFAULT_EDGE_DATA } from './domain/edges'
import { parseRunHash } from './utils/shareLink'
import { nodeTypes } from './nodes/registry'
import { StyledEdge } from './edges/StyledEdge'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { loadState, saveState } from './persist'
import { ContextMenu } from './ContextMenu'
import { CanvasToolbar } from './CanvasToolbar'
import { LeftSidebar } from '../components/layout/LeftSidebar'
import { RightPanel } from '../components/layout/RightPanel'
import { AlignmentGuides } from './components/AlignmentGuides'
import { InspectorPopover } from './components/InspectorPopover'
import { InspectorModal } from './components/InspectorModal'
import { CommandPalette } from './components/CommandPalette'
import { ReconnectBanner } from './components/ReconnectBanner'
import { KeyboardLegend, useKeyboardLegend } from './help/KeyboardLegend'
// HelpMenu moved to TopBar dropdown - now using custom events
import { SettingsPanel } from './components/SettingsPanel'
import { useSettingsStore } from './settingsStore'
import { CanvasErrorBoundary } from './ErrorBoundary'
import { ToastProvider, useToast } from './ToastContext'
import { DiagnosticsOverlay } from './DiagnosticsOverlay'
import { ConfirmDialog } from './components/ConfirmDialog'
// ValidationChip removed - validation consolidated into OutputsDock panel
import { LayerProvider } from './components/LayerProvider'
import { RecoveryBanner } from './components/RecoveryBanner'
import { OnboardingOverlay } from './onboarding/OnboardingOverlay'
import { useOnboarding } from './onboarding/useOnboarding'
import { useCanvasKeyboardShortcuts } from './hooks/useCanvasKeyboardShortcuts'
import type { Blueprint } from '../templates/blueprints/types'
import { blueprintToGraph } from '../templates/mapper/blueprintToGraph'
import { InfluenceExplainer, useInfluenceExplainer } from '../components/assistants/InfluenceExplainer'
import { DraftChat } from './components/DraftChat'
import { CanvasEmptyState } from './components/CanvasEmptyState'
// N5: Code-split heavy panels with named chunks
const InspectorPanel = lazy(() => import(/* webpackChunkName: "inspector-panel" */ './panels/InspectorPanel').then(m => ({ default: m.InspectorPanel })))
import { useResultsRun } from './hooks/useResultsRun'
import { HighlightLayer } from './highlight/HighlightLayer'
import { registerFocusHelpers, unregisterFocusHelpers } from './utils/focusHelpers'
import { loadRuns } from './store/runHistory'
// HealthStatusBar removed - validation consolidated into OutputsDock panel
import { DegradedBanner } from './components/DegradedBanner'
import { LayoutProgressBanner } from './components/LayoutProgressBanner'
const IssuesPanel = lazy(() => import(/* webpackChunkName: "issues-panel" */ './panels/IssuesPanel').then(m => ({ default: m.IssuesPanel })))
const AIClarifierChat = lazy(() => import(/* webpackChunkName: "ai-clarifier" */ './panels/AIClarifierChat').then(m => ({ default: m.AIClarifierChat })))
import { NeedleMoversOverlay } from './components/NeedleMoversOverlay'
import { CoachingNudge } from '../components/coaching/CoachingNudge'
import { useCEECoaching } from './hooks/useCEECoaching'
import { DocumentsManager } from './components/DocumentsManager'
import { ProvenanceHubTab } from './components/ProvenanceHubTab'
import { RadialQuickAddMenu } from './components/RadialQuickAddMenu'
import { ConnectPrompt } from './components/ConnectPrompt'
import { ConnectivityChip } from './components/ConnectivityChip'
import { StatusChips } from './components/StatusChips'
// EdgeLabelToggle moved to CanvasToolbar for cleaner UI
import { LimitsPanel } from './components/LimitsPanel'
import { BottomSheet } from './components/BottomSheet'
import type { NodeType } from './domain/nodes'
import { InputsDock } from './components/InputsDock'
import { OutputsDock } from './components/OutputsDock'
import { isInputsOutputsEnabled, isCommandPaletteEnabled, isDegradedBannerEnabled, isOnboardingTourEnabled, pocFlags } from '../flags'
import { useEngineLimits } from './hooks/useEngineLimits'
import { useRunEligibilityCheck } from './hooks/useRunEligibilityCheck'

type CanvasDebugMode = 'normal' | 'blank' | 'no-reactflow' | 'rf-only' | 'rf-bare' | 'rf-minimal' | 'rf-empty' | 'rf-no-fitview' | 'rf-no-bg' | 'rf-store' | 'provider-only' | 'no-provider'

function getCanvasDebugMode(): CanvasDebugMode {
  if (typeof window === 'undefined') return 'normal'
  try {
    const url = new URL(window.location.href)
    // First check regular query params (for non-HashRouter URLs)
    let fromQuery = url.searchParams.get('canvasDebug')

    // HashRouter: query params are AFTER the hash, e.g. #/canvas?canvasDebug=blank
    // So we need to parse them from window.location.hash
    if (!fromQuery && window.location.hash) {
      const hash = window.location.hash
      const queryIndex = hash.indexOf('?')
      if (queryIndex !== -1) {
        const hashQuery = hash.slice(queryIndex + 1)
        const hashParams = new URLSearchParams(hashQuery)
        fromQuery = hashParams.get('canvasDebug')
      }
    }

    const fromStorage = window.localStorage ? window.localStorage.getItem('CANVAS_DEBUG_MODE') : null
    const raw = (fromQuery || fromStorage || '').toLowerCase()
    const validModes = ['blank', 'no-reactflow', 'rf-only', 'rf-bare', 'rf-minimal', 'rf-empty', 'rf-no-fitview', 'rf-no-bg', 'rf-store', 'provider-only', 'no-provider']
    if (validModes.includes(raw)) return raw as CanvasDebugMode
    return 'normal'
  } catch {
    return 'normal'
  }
}

function logCanvasBreadcrumb(message: string, data?: Record<string, any>) {
  if (typeof window === 'undefined') return
  try {
    const win = window as any
    win.__SAFE_DEBUG__ ||= { logs: [] }
    const debug = win.__SAFE_DEBUG__
    const logs = Array.isArray(debug.logs) ? debug.logs : null
    if (!logs || logs.length >= 2000) return
    logs.push({ t: Date.now(), m: `canvas:trace:${message}`, data })
    const mode = getCanvasDebugMode()
    if (mode !== 'normal' && typeof console !== 'undefined' && console.log) {
      // eslint-disable-next-line no-console
      console.log('[CANVAS TRACE]', message, data || {})
    }
  } catch {}
}

// Week 2 Layout Migration: New layout is NOW THE DEFAULT
// Old dock layout (InputsDock, OutputsDock, CanvasToolbar) is deprecated
// Set VITE_FEATURE_CONTEXT_BAR=0 to temporarily revert to old layout
// Note: pocFlags.contextBar requires VITE_POC_ONLY=1 or explicit opt-in
// So we hardcode true and only check for explicit opt-OUT
const USE_NEW_LAYOUT = (import.meta as any)?.env?.VITE_FEATURE_CONTEXT_BAR !== '0'

// Debug: Log layout mode once on module load
if (typeof window !== 'undefined') {
  console.log('[LAYOUT]', USE_NEW_LAYOUT ? 'NEW (canvas-first)' : 'OLD (docks)')
}

export interface BlueprintInsertResult {
  error?: string
}

export interface BlueprintEventBus {
  subscribe: (fn: (blueprint: Blueprint) => BlueprintInsertResult) => () => void
}

interface ReactFlowGraphProps {
  blueprintEventBus?: BlueprintEventBus
  onCanvasInteraction?: () => void
  enableGhostSuggestions?: boolean
}

function ReactFlowGraphInner({ blueprintEventBus, onCanvasInteraction, enableGhostSuggestions = false }: ReactFlowGraphProps) {
  // React #185 FIX: Use INDIVIDUAL selectors - NOT object + shallow
  //
  // ROOT CAUSE: In Zustand v5 with useSyncExternalStore, when a selector returns a
  // new object on every call (even with shallow comparison), it triggers infinite
  // re-render loops in production builds. This is because the selector function
  // `s => ({ ... })` creates a new object reference on every invocation.
  //
  // SOLUTION: Use individual selectors that return stable primitive/reference values.
  // Each selector returns the exact same reference as long as that specific state
  // slice hasn't changed.
  //
  // Evidence: rf-store debug mode crashed with object+shallow but works with individual selectors.
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const showResultsPanel = useCanvasStore(s => s.showResultsPanel)
  const showInspectorPanel = useCanvasStore(s => s.showInspectorPanel)
  const graphHealth = useCanvasStore(s => s.graphHealth)
  const showIssuesPanel = useCanvasStore(s => s.showIssuesPanel)
  const needleMovers = useCanvasStore(s => s.needleMovers)
  const documents = useCanvasStore(s => s.documents)
  const citations = useCanvasStore(s => s.citations)
  const showDocumentsDrawer = useCanvasStore(s => s.showDocumentsDrawer)
  const showProvenanceHub = useCanvasStore(s => s.showProvenanceHub)
  const provenanceRedactionEnabled = useCanvasStore(s => s.provenanceRedactionEnabled)
  const reconnecting = useCanvasStore(s => s.reconnecting)
  // Week 3: AI Clarifier
  const showAIClarifier = useCanvasStore(s => s.showAIClarifier)
  const setShowAIClarifier = useCanvasStore(s => s.setShowAIClarifier)

  // Week 3: AI Coaching
  const { activeNudge } = useCEECoaching()

  const { getViewport, setCenter, fitView, zoomIn, zoomOut } = useReactFlow()

  // Canvas control actions from store
  const undo = useCanvasStore(s => s.undo)
  const redo = useCanvasStore(s => s.redo)
  const canUndo = useCanvasStore(s => s.canUndo)
  const canRedo = useCanvasStore(s => s.canRedo)
  const resetCanvas = useCanvasStore(s => s.resetCanvas)
  const applyLayout = useCanvasStore(s => s.applyLayout)
  const pendingFitView = useCanvasStore(s => s.pendingFitView)
  const setPendingFitView = useCanvasStore(s => s.setPendingFitView)
  const debugMode: CanvasDebugMode = getCanvasDebugMode()

  // Handle pending fit view request (from AI graph insertion)
  useEffect(() => {
    if (pendingFitView) {
      // Small delay to allow layout to settle
      const timer = setTimeout(() => {
        fitView({ padding: 0.2, duration: 400 })
        setPendingFitView(false)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [pendingFitView, fitView, setPendingFitView])

  const HARD_ISOLATE_MINIMAL_CANVAS = false
  if (HARD_ISOLATE_MINIMAL_CANVAS) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 'var(--topbar-h)',
            bottom: 'var(--bottombar-h)',
            left: 0,
            right: 0,
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            minZoom={0.1}
            maxZoom={4}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} />
          </ReactFlow>
        </div>
      </div>
    )
  }

  // Phase 3: Memoize heavy computations for performance
  const memoizedNodes = useMemo(() => nodes, [nodes])
  const memoizedEdges = useMemo(() => edges, [edges])

  // Actions are stable references - don't need shallow comparison
  const createNodeId = useCanvasStore(s => s.createNodeId)
  const createEdgeId = useCanvasStore(s => s.createEdgeId)
  const setShowResultsPanel = useCanvasStore(s => s.setShowResultsPanel)
  const setShowInspectorPanel = useCanvasStore(s => s.setShowInspectorPanel)

  // State declarations
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [draggingNodeIds, setDraggingNodeIds] = useState<Set<string>>(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showFullInspector, setShowFullInspector] = useState(true)
  const [pendingBlueprint, setPendingBlueprint] = useState<Blueprint | null>(null)
  const [existingTemplate, setExistingTemplate] = useState<{ id: string; name: string } | null>(null)
  const { isOpen: isKeyboardLegendOpen, open: openKeyboardLegend, close: closeKeyboardLegend } = useKeyboardLegend()
  const { isOpen: isOnboardingOpen, open: openOnboarding, close: closeOnboarding } = useOnboarding()
  const onboardingEnabled = isOnboardingTourEnabled()
  const {
    shouldShow: shouldShowInfluenceExplainer,
    forceShow: isInfluenceExplainerForced,
    show: showInfluenceExplainer,
    hide: hideInfluenceExplainer
  } = useInfluenceExplainer()

  // Listen for help events from TopBar dropdown
  useEffect(() => {
    const handleShowOnboarding = () => openOnboarding()
    const handleShowKeyboard = () => openKeyboardLegend()
    const handleShowInfluence = () => showInfluenceExplainer()

    window.addEventListener('topbar:show-onboarding', handleShowOnboarding)
    window.addEventListener('topbar:show-keyboard-legend', handleShowKeyboard)
    window.addEventListener('topbar:show-influence-explainer', handleShowInfluence)

    return () => {
      window.removeEventListener('topbar:show-onboarding', handleShowOnboarding)
      window.removeEventListener('topbar:show-keyboard-legend', handleShowKeyboard)
      window.removeEventListener('topbar:show-influence-explainer', handleShowInfluence)
    }
  }, [openOnboarding, openKeyboardLegend, showInfluenceExplainer])

  // P0-7: Quick-add mode state
  const [quickAddMode, setQuickAddMode] = useState(false)
  const [radialMenuPosition, setRadialMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const addNode = useCanvasStore(s => s.addNode)

  // Phase 3: Empty state actions
  // Use store selectors directly - Zustand actions are stable references
  const setShowDraftChat = useCanvasStore(s => s.setShowDraftChat)
  const openTemplatesPanel = useCanvasStore(s => s.openTemplatesPanel)

  // React #185 FIX: Selection state for inspector popover/modal
  const selectedNodeId = useCanvasStore(s => {
    const ids = s.selection.nodeIds
    if (ids.size !== 1) return null
    return ids.values().next().value ?? null
  })
  const selectedEdgeId = useCanvasStore(s => {
    const ids = s.selection.edgeIds
    if (ids.size !== 1) return null
    return ids.values().next().value ?? null
  })

  // Stable callbacks for CanvasEmptyState (React #185 prevention)
  const handleEmptyStateDraft = useCallback(() => setShowDraftChat(true), [setShowDraftChat])
  const handleEmptyStateTemplate = useCallback(() => openTemplatesPanel(), [openTemplatesPanel])

  // React #185 FIX: Memoize keyboard shortcut callbacks to prevent infinite re-render loops.
  // Without useCallback, new function references are created on every render,
  // causing useCanvasKeyboardShortcuts to re-run its effects.
  const handleToggleResults = useCallback(() => {
    // Cmd/Ctrl+3: ensure Results are visible in the Outputs dock.
    setShowResultsPanel(true)
  }, [setShowResultsPanel])

  const handleToggleInspector = useCallback(() => {
    const next = !useCanvasStore.getState().showInspectorPanel
    setShowInspectorPanel(next)
  }, [setShowInspectorPanel])

  // P0-8: Auto-connect state
  const [connectPrompt, setConnectPrompt] = useState<{
    newNodeId: string
    targetNodeId: string
    targetNodeLabel: string
    position: { x: number; y: number }
  } | null>(null)
  const addEdge = useCanvasStore(s => s.addEdge)
  const [showLimits, setShowLimits] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)


  // M4: Graph Health actions (graphHealth, showIssuesPanel state selected above)
  const setShowIssuesPanel = useCanvasStore(s => s.setShowIssuesPanel)
  const applyRepair = useCanvasStore(s => s.applyRepair)
  const applyAllRepairs = useCanvasStore(s => s.applyAllRepairs)

  // M5: Grounding & Provenance actions (documents, citations, etc. state selected above)
  const setShowDocumentsDrawer = useCanvasStore(s => s.setShowDocumentsDrawer)
  const setShowProvenanceHub = useCanvasStore(s => s.setShowProvenanceHub)
  const toggleProvenanceRedaction = useCanvasStore(s => s.toggleProvenanceRedaction)
  const addDocument = useCanvasStore(s => s.addDocument)

  // Results run hook
  const { run: runAnalysis } = useResultsRun()
  const inputsOutputsEnabled = isInputsOutputsEnabled()
  const dockLayoutEnabled = inputsOutputsEnabled && !USE_NEW_LAYOUT
  const paletteEnabled = isCommandPaletteEnabled()
  const degradedBannerEnabled = isDegradedBannerEnabled()
  useEngineLimits()
  const checkRunEligibility = useRunEligibilityCheck()

  useEffect(() => {
    if (!USE_NEW_LAYOUT || typeof document === 'undefined') return

    const root = document.documentElement
    const computed = getComputedStyle(root).getPropertyValue('--bottombar-h')
    const previous = root.style.getPropertyValue('--bottombar-h') || computed
    root.style.setProperty('--bottombar-h', '0px')

    return () => {
      root.style.setProperty('--bottombar-h', previous || '0px')
    }
  }, [])

  // SAFE_DEBUG: Lightweight instrumentation to detect render storms and state thrash in production.
  // Logs only the first 50 renders to window.__SAFE_DEBUG__.logs as 'canvas:render' entries.
  // This does not touch React state and is safe to remove once React 185 is resolved.
  if (typeof window !== 'undefined') {
    try {
      const win = window as any
      win.__SAFE_DEBUG__ ||= { logs: [] }
      const debug = win.__SAFE_DEBUG__
      debug.__canvas_render_count__ = (debug.__canvas_render_count__ || 0) + 1
      const renderCount = debug.__canvas_render_count__
      if (Array.isArray(debug.logs) && renderCount <= 50) {
        debug.logs.push({
          t: Date.now(),
          m: 'canvas:render',
          data: {
            count: renderCount,
            href: window.location.href,
            showResultsPanel,
            debugMode,
          },
        })
      }
    } catch {
      // Swallow debug logging errors
    }
  }

  // Diagnostics resume toast (B3)
  // REACT #185 DEBUG: Disabled to isolate root cause
  // useRunDiagnosticsToast()

  // E2E-only helper: when dock layout is OFF, auto-open the legacy documents drawer
  // so that documents flows remain testable without relying on shortcut ordering.
  useEffect(() => {
    if (debugMode !== 'normal') {
      logCanvasBreadcrumb('e2e-docs:skip', { debugMode, inputsOutputsEnabled })
      return
    }

    if (!inputsOutputsEnabled && typeof window !== 'undefined') {
      const win = window as any
      if (win.__E2E === '1') {
        setShowDocumentsDrawer(true)
        logCanvasBreadcrumb('e2e-docs:auto-open', { debugMode })
      }
    }
  }, [inputsOutputsEnabled, setShowDocumentsDrawer, debugMode])

  // Autosave hook - saves graph every 30s when dirty
  // REACT #185 DEBUG: Disabled to isolate root cause
  // useAutosave()

  // P1 Polish: Cross-tab sync for edge label mode
  // REACT #185 DEBUG: Disabled to isolate root cause
  // useEffect(() => {
  //   return useEdgeLabelModeSync()
  // }, [])

  // Auto-open behaviour for Results is now handled by OutputsDock based on results.status.

  const handleSelectionChange = useCallback((params: { nodes: any[]; edges: any[] }) => {
    useCanvasStore.getState().onSelectionChange(params)
  }, [])

  // reconnecting state is selected at the top of this component
  const completeReconnect = useCanvasStore(s => s.completeReconnect)
  const { showToast } = useToast()
  const handleQuickAddClick = useCallback(() => {
    setQuickAddMode(true)
    setRadialMenuPosition(null)
    showToast('Quick-add mode enabled. Click canvas to add nodes.', 'info')
  }, [showToast])
  const handleOpenCompare = useCallback(() => {
    // Check if we have runs to compare (need at least 2)
    // Use loadRuns() which reads from localStorage (store.runHistory doesn't exist)
    const runs = loadRuns()
    if (runs.length < 2) {
      showToast('Need at least 2 analysis runs to compare. Run analysis first.', 'info')
      return
    }

    // Open results panel in compare mode
    const store = useCanvasStore.getState()
    store.setShowResultsPanel(true)
    store.setShowComparePanel(true)
  }, [showToast])
  const resultsLoadHistorical = useCanvasStore(s => s.resultsLoadHistorical)

  // v1.2: Share link resolver - load run from localStorage when ?run=hash is present
  // Uses useLocation to detect route changes and hashchange listener for direct navigation
  const location = useLocation()

  // React #185 FIX: Track which share-link hash has been applied this session.
  // This prevents re-triggering resultsLoadHistorical + setShowResultsPanel
  // on every re-render when the URL contains a run parameter.
  const appliedShareHashRef = useRef<string | null>(null)
  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const resolveShareLink = () => {
      // Parse URL using robust parser (handles both sha256: prefix and plain hex)
      const fullUrl = window.location.href
      const runHash = parseRunHash(fullUrl)

      // SAFE_DEBUG: Log share-link resolution attempts (capped) to help diagnose URL-driven loops.
      try {
        const win = window as any
        win.__SAFE_DEBUG__ ||= { logs: [] }
        const debug = win.__SAFE_DEBUG__
        debug.__canvas_share_resolve_count__ = (debug.__canvas_share_resolve_count__ || 0) + 1
        const resolveCount = debug.__canvas_share_resolve_count__
        if (Array.isArray(debug.logs) && resolveCount <= 20) {
          debug.logs.push({
            t: Date.now(),
            m: 'canvas:share:resolve',
            data: {
              count: resolveCount,
              hasRunParam: Boolean(runHash),
              href: fullUrl,
              alreadyApplied: appliedShareHashRef.current === runHash,
            },
          })
        }
      } catch {
        // Swallow debug logging errors
      }

      if (!runHash) {
        return // No run parameter in URL
      }

      // React #185 FIX: Skip if we've already applied this hash this session.
      // This prevents the infinite loop: effect → setState → render → effect.
      if (appliedShareHashRef.current === runHash) {
        if (import.meta.env.DEV) {
          console.log('[ReactFlowGraph] Share link already applied, skipping:', runHash.slice(0, 8))
        }
        return
      }

      if (import.meta.env.DEV) {
        console.log('[ReactFlowGraph] Share link detected, loading run:', runHash.slice(0, 8))
      }

      // Load all runs from localStorage (local-device only)
      const runs = loadRuns()

      // Find run by hash
      const run = runs.find(r => r.hash === runHash)

      if (run) {
        // Mark as applied BEFORE triggering state updates to prevent re-entry
        appliedShareHashRef.current = runHash

        // Load historical run into canvas
        resultsLoadHistorical(run)

        // React #185 FIX: Only open Results panel if not already open.
        // This guards against unnecessary state updates that could trigger re-renders.
        if (!useCanvasStore.getState().showResultsPanel) {
          setShowResultsPanel(true)
        }

        if (import.meta.env.DEV) {
          console.log('[ReactFlowGraph] Run loaded successfully:', run.summary)
        }
      } else {
        // Run not found - still mark hash as "processed" to avoid repeated toasts
        appliedShareHashRef.current = runHash

        // Run not found in localStorage
        console.warn('[ReactFlowGraph] Shared run not found in history:', runHash)

        // Show user-friendly toast notification (local-only scope explicit)
        showToast(
          `Run not found. This link can only be opened on the device it was created on.`,
          'warning'
        )

        if (import.meta.env.DEV) {
          console.log('[ReactFlowGraph] Run not found in local history.')
        }
      }
    }

    // Resolve on mount and when location changes
    resolveShareLink()

    // Also listen for hashchange events (fallback for direct hash manipulation)
    const handleHashChange = () => {
      // React #185 FIX: Clear the applied hash ref when URL actually changes
      // so a new share link can be applied.
      const newHash = parseRunHash(window.location.href)
      if (newHash !== appliedShareHashRef.current) {
        appliedShareHashRef.current = null
      }
      if (import.meta.env.DEV) {
        console.log('[ReactFlowGraph] Hash changed, re-resolving share link')
      }
      resolveShareLink()
    }

    window.addEventListener('hashchange', handleHashChange, { passive: true })

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash, location.search])  // Re-run when hash or search params change

  // M4: Graph Health validation lifecycle (debounced)
  // REACT #185 FIX: Re-enabled with stable dependencies (lengths instead of arrays)
  const validateGraph = useCanvasStore(s => s.validateGraph)

  // Validate on mount (initial load)
  useEffect(() => {
    validateGraph()

    // Cleanup timer on unmount
    return () => {
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  // Stable dependencies for graph changes - use lengths to avoid array reference issues
  const nodeCount = nodes.length
  const edgeCount = edges.length

  // Debounced validation on graph changes
  useEffect(() => {
    // Clear existing timer
    if (validationTimerRef.current) {
      clearTimeout(validationTimerRef.current)
    }

    // Debounce validation by 500ms after graph changes
    validationTimerRef.current = setTimeout(() => {
      validateGraph()
    }, 500)

    return () => {
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current)
      }
    }
  }, [nodeCount, edgeCount, validateGraph])

  const handleNodeClick = useCallback((_: any, node: any) => {
    // Close Templates panel when interacting with canvas
    onCanvasInteraction?.()

    if (reconnecting) {
      completeReconnect(node.id)
      showToast('Connector updated — press ⌘Z to undo.', 'success')
    }
  }, [reconnecting, completeReconnect, showToast, onCanvasInteraction])

  const handleEdgeClick = useCallback(() => {
    // Close Templates panel when clicking an edge
    onCanvasInteraction?.()
  }, [onCanvasInteraction])

  // Double-click handlers for opening full inspector modal
  const handleNodeDoubleClick = useCallback(() => {
    setShowFullInspector(true)
  }, [])

  const handleEdgeDoubleClick = useCallback(() => {
    setShowFullInspector(true)
  }, [])

  // Focus node handler (for Alt+V validation cycling and Results panel drivers)
  const handleFocusNode = useCallback((nodeId: string) => {
    const store = useCanvasStore.getState()
    const targetNode = store.nodes.find(n => n.id === nodeId)

    if (!targetNode) return

    // Select node WITHOUT pushing to history (navigation-only, not structural change)
    store.selectNodeWithoutHistory(nodeId)

    // Center viewport on the node with smooth animation
    const viewport = getViewport()
    setCenter(targetNode.position.x, targetNode.position.y, {
      zoom: viewport.zoom,
      duration: 300
    })
  }, [getViewport, setCenter])

  // Focus edge handler (for Results panel drivers)
  const handleFocusEdge = useCallback((edgeId: string) => {
    const store = useCanvasStore.getState()
    const targetEdge = store.edges.find(e => e.id === edgeId)

    if (!targetEdge) return

    // Find source and target nodes
    const sourceNode = store.nodes.find(n => n.id === targetEdge.source)
    const targetNode = store.nodes.find(n => n.id === targetEdge.target)

    if (!sourceNode || !targetNode) return

    // Calculate midpoint between source and target
    const midX = (sourceNode.position.x + targetNode.position.x) / 2
    const midY = (sourceNode.position.y + targetNode.position.y) / 2

    // Select edge (not in history, just for visual feedback)
    useCanvasStore.setState({
      edges: store.edges.map(e => ({
        ...e,
        selected: e.id === edgeId
      }))
    })

    // Center viewport on edge midpoint with smooth animation
    const viewport = getViewport()
    setCenter(midX, midY, {
      zoom: viewport.zoom,
      duration: 300,
    })
  }, [getViewport, setCenter])

  // Register focus helpers for external use (Results panel)
  useEffect(() => {
    registerFocusHelpers(handleFocusNode, handleFocusEdge)
    return () => unregisterFocusHelpers()
  }, [handleFocusNode, handleFocusEdge])

  // Run simulation handler with shared eligibility gating
  const handleRunSimulation = useCallback(async () => {
    const eligibility = checkRunEligibility()
    if (!eligibility.canRun) {
      // Toast already shown by checkRunEligibility
      return
    }

    // Get latest state for graph data
    const { nodes, edges, outcomeNodeId } = useCanvasStore.getState()

    // Additional validation: Check for empty graph
    if (nodes.length === 0) {
      showToast('Add at least one node before running analysis.', 'warning')
      return
    }

    // Check for disconnected graph (nodes without any edges)
    if (nodes.length > 1 && edges.length === 0) {
      showToast('Connect your nodes with edges before running analysis.', 'warning')
      return
    }

    // Open Results panel before running
    setShowResultsPanel(true)

    try {
      // Run analysis with canvas graph
      await runAnalysis({
        template_id: 'canvas-graph',
        seed: 1337,
        graph: { nodes, edges },
        outcome_node: outcomeNodeId || undefined,
      })
    } catch (err: any) {
      console.error('[ReactFlowGraph] Run analysis failed:', err)
      showToast(err?.message || 'Analysis failed. Please try again.', 'error')
    }
  }, [checkRunEligibility, runAnalysis, setShowResultsPanel, showToast])

  // M4: Health panel handlers
  const handleFixIssue = useCallback(async (issue: any) => {
    await applyRepair(issue.id)
    showToast('Issue fixed — graph updated', 'success')
  }, [applyRepair, showToast])

  const handleQuickFixAll = useCallback(async () => {
    await applyAllRepairs()
    showToast('All fixable issues resolved', 'success')
  }, [applyAllRepairs, showToast])

  // M5: Documents handlers
  const handleUploadDocuments = useCallback(async (files: File[]) => {
    try {
      let uploadedCount = 0
      for (const file of files) {
        try {
          const content = await file.text()
          const type = file.name.endsWith('.pdf') ? 'pdf' :
                       file.name.endsWith('.txt') ? 'txt' :
                       file.name.endsWith('.md') ? 'md' :
                       file.name.endsWith('.csv') ? 'csv' : 'txt'

          addDocument({
            name: file.name,
            type: type as any,
            content,
            size: file.size
          })
          uploadedCount++
        } catch (fileErr) {
          // Show specific error for this file
          const message = fileErr instanceof Error ? fileErr.message : 'Failed to upload document'
          showToast(`${file.name}: ${message}`, 'error')
        }
      }
      if (uploadedCount > 0) {
        showToast(`${uploadedCount} document${uploadedCount > 1 ? 's' : ''} uploaded`, 'success')
      }
    } catch (err) {
      showToast('Failed to upload documents', 'error')
    }
  }, [addDocument, showToast])

  const handleDeleteDocument = useCallback((_documentId: string, doc?: any) => {
    const name = doc?.name ?? 'Document'
    showToast(`${name} removed`, 'success')
  }, [showToast])

  const showDocuments = useCallback(() => {
    if (dockLayoutEnabled) {
      if (typeof document === 'undefined') return

      const dock = document.querySelector('[data-testid="inputs-dock"]') as HTMLElement | null
      if (!dock) return

      const toggleButton = dock.querySelector('[data-testid="inputs-dock-toggle"]') as HTMLButtonElement | null
      if (toggleButton && toggleButton.getAttribute('aria-label')?.includes('Expand')) {
        toggleButton.click()
      }

      const documentsTab = dock.querySelector('[data-testid="inputs-dock-tab-documents"]') as HTMLButtonElement | null
      if (documentsTab) {
        documentsTab.click()
      }

      // Focus the documents panel body for keyboard users
      requestAnimationFrame(() => {
        const panel = document.querySelector('[data-testid="documents-panel"]') as HTMLElement | null
        panel?.focus()
      })

      return
    }

    // Legacy drawer path: ensure drawer is open and focus it
    if (!useCanvasStore.getState().showDocumentsDrawer) {
      setShowDocumentsDrawer(true)
    }

    requestAnimationFrame(() => {
      if (typeof document === 'undefined') return
      const drawer = document.querySelector('[data-testid="documents-drawer"]') as HTMLElement | null
      drawer?.focus()
    })
  }, [dockLayoutEnabled, setShowDocumentsDrawer])

  // Setup keyboard shortcuts (P, Alt+V, Cmd/Ctrl+Enter, Cmd/Ctrl+3, Cmd/Ctrl+I, Cmd/Ctrl+D, ?)
  useCanvasKeyboardShortcuts({
    onFocusNode: handleFocusNode,
    onRunSimulation: handleRunSimulation,
    onToggleResults: handleToggleResults,
    onToggleInspector: handleToggleInspector,
    onToggleDocuments: showDocuments,
    onShowToast: showToast
  })

  // P0-7: Q key to toggle quick-add mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'q' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        setQuickAddMode(prev => !prev)
        setRadialMenuPosition(null) // Close menu if open
        if (!quickAddMode) {
          showToast('Quick-add mode enabled. Click canvas to add nodes.', 'info')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [quickAddMode, showToast])

  // P0-7: Handle pane click to show radial menu in quick-add mode
  const handlePaneClick = useCallback((event: React.MouseEvent) => {
    if (quickAddMode) {
      setRadialMenuPosition({ x: event.clientX, y: event.clientY })
    }
  }, [quickAddMode])

  // P0-7: Handle node type selection from radial menu
  const handleRadialMenuSelect = useCallback((nodeType: NodeType) => {
    if (radialMenuPosition) {
      const viewport = getViewport()
      // Convert screen coordinates to canvas coordinates
      const canvasX = (radialMenuPosition.x - viewport.x) / viewport.zoom
      const canvasY = (radialMenuPosition.y - viewport.y) / viewport.zoom

      // Get current node ID before adding (to identify new node)
      const state = useCanvasStore.getState()
      const beforeNodeCount = state.nodes.length

      addNode({ x: canvasX, y: canvasY }, nodeType)
      setRadialMenuPosition(null)
      showToast(`Added ${nodeType} node`, 'success')

      // P0-8: Check for nearby nodes within 300px
      setTimeout(() => {
        const newState = useCanvasStore.getState()
        if (newState.nodes.length > beforeNodeCount) {
          // Find the newly added node (last node)
          const newNode = newState.nodes[newState.nodes.length - 1]

          // Find nearby nodes within 300px
          const nearbyNodes = newState.nodes.filter(n => {
            if (n.id === newNode.id) return false
            const dx = n.position.x - newNode.position.x
            const dy = n.position.y - newNode.position.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            return distance <= 300
          })

          if (nearbyNodes.length > 0) {
            // Show prompt for the closest node
            const closest = nearbyNodes.reduce((prev, curr) => {
              const prevDist = Math.sqrt(
                Math.pow(prev.position.x - newNode.position.x, 2) +
                Math.pow(prev.position.y - newNode.position.y, 2)
              )
              const currDist = Math.sqrt(
                Math.pow(curr.position.x - newNode.position.x, 2) +
                Math.pow(curr.position.y - newNode.position.y, 2)
              )
              return currDist < prevDist ? curr : prev
            })

            // Convert target node's canvas position to screen coordinates
            const viewport = getViewport()
            const screenX = closest.position.x * viewport.zoom + viewport.x
            const screenY = closest.position.y * viewport.zoom + viewport.y

            setConnectPrompt({
              newNodeId: newNode.id,
              targetNodeId: closest.id,
              targetNodeLabel: (closest.data as any)?.label || closest.id,
              position: { x: screenX, y: screenY }
            })
          }
        }
      }, 50) // Small delay to ensure node is added to store
    }
  }, [radialMenuPosition, getViewport, addNode, showToast])

  // P0-7: Cancel radial menu
  const handleRadialMenuCancel = useCallback(() => {
    setRadialMenuPosition(null)
  }, [])

  // P0-8: Confirm connection to nearby node
  const handleConfirmConnect = useCallback(() => {
    if (connectPrompt) {
      addEdge({
        source: connectPrompt.newNodeId,
        target: connectPrompt.targetNodeId,
        data: { ...DEFAULT_EDGE_DATA, weight: 0.5, belief: 0.5 }
      })
      showToast(`Connected to ${connectPrompt.targetNodeLabel}`, 'success')
      setConnectPrompt(null)
    }
  }, [connectPrompt, addEdge, showToast])

  // P0-8: Cancel connection prompt
  const handleCancelConnect = useCallback(() => {
    setConnectPrompt(null)
  }, [])

  // Blueprint insertion handler
  const insertBlueprint = useCallback((blueprint: Blueprint): { nodeIdMap: Map<string, string>; newNodes: any[]; newEdges: any[]; error?: string } => {
    // Transform to goal-first graph
    const graph = blueprintToGraph(blueprint)

    const viewport = getViewport()
    const centerX = -viewport.x + (window.innerWidth / 2) / viewport.zoom
    const centerY = -viewport.y + (window.innerHeight / 2) / viewport.zoom

    // Create ID mapping
    const nodeIdMap = new Map<string, string>()
    graph.nodes.forEach(node => {
      nodeIdMap.set(node.id, createNodeId())
    })

    // Calculate blueprint center
    const positions = graph.nodes.map(n => n.position || { x: 0, y: 0 })
    const minX = Math.min(...positions.map(p => p.x))
    const maxX = Math.max(...positions.map(p => p.x))
    const minY = Math.min(...positions.map(p => p.y))
    const maxY = Math.max(...positions.map(p => p.y))
    const blueprintCenterX = (minX + maxX) / 2
    const blueprintCenterY = (minY + maxY) / 2

    // Create nodes with correct types and template metadata
    const templateCreatedAt = new Date().toISOString()

    const newNodes = graph.nodes.map(node => {
      const pos = node.position || { x: 0, y: 0 }
      return {
        id: nodeIdMap.get(node.id)!,
        type: node.kind,
        position: {
          x: centerX + (pos.x - blueprintCenterX),
          y: centerY + (pos.y - blueprintCenterY)
        },
        data: {
          label: node.label,
          kind: node.kind,
          templateId: blueprint.id,
          templateName: blueprint.name,
          templateCreatedAt
        }
      }
    })

    // Create edges with v1.2 metadata (weight, belief, provenance)
    const newEdges = graph.edges.map(edge => {
      const pct = edge.probability != null ? Math.round(edge.probability * 100) : undefined
      const label = pct != null ? `${pct}%` : undefined
      const edgeId = createEdgeId()

      // Detect edge kind: influence network (has weight, no probability) vs decision tree (has probability)
      const isInfluenceEdge = edge.weight !== undefined && edge.probability === undefined
      const edgeKind = isInfluenceEdge ? 'influence-weight' as const : 'decision-probability' as const

      return {
        id: edgeId,
        type: 'styled',
        source: nodeIdMap.get(edge.from)!,
        target: nodeIdMap.get(edge.to)!,
        data: {
          ...DEFAULT_EDGE_DATA,
          kind: edgeKind,                                // Auto-detect influence vs probability edges
          weight: edge.weight ?? DEFAULT_EDGE_DATA.weight,
          label,
          confidence: edge.probability,
          belief: edge.belief ?? edge.probability,      // v1.2: prefer belief, fallback to probability
          provenance: edge.provenance ?? 'template',    // v1.2: default to template source
          templateId: blueprint.id
        }
      }
    })

    // Batch update store - REPLACE existing graph, not merge
    // This matches the user expectation from "Start from Template" confirmation
    const store = useCanvasStore.getState()
    store.pushHistory()
    useCanvasStore.setState(() => ({
      nodes: newNodes,
      edges: newEdges
    }))

    showToast(`Started from "${blueprint.name}" template.`, 'success')

    // Return result object for caller to check
    return { nodeIdMap, newNodes, newEdges }
  }, [getViewport, createNodeId, createEdgeId, showToast])
  
  useEffect(() => {
    if (!blueprintEventBus) return

    const unsubscribe = blueprintEventBus.subscribe((blueprint: Blueprint) => {
      // Check for existing template
      const existingTemplateNode = nodes.find(n => n.data?.templateId)
      if (existingTemplateNode && existingTemplateNode.data) {
        setPendingBlueprint(blueprint)
        setExistingTemplate({
          id: String(existingTemplateNode.data.templateId || ''),
          name: String(existingTemplateNode.data.templateName || 'Existing flow')
        })
        return { error: 'Cannot insert: template already exists on canvas' }
      }

      // Sprint 2: Handle limit errors and return result
      const result = insertBlueprint(blueprint)
      if (result.error) {
        showToast(result.error, 'warning')
      }
      return result
    })

    return unsubscribe
  }, [blueprintEventBus, nodes, insertBlueprint])
  
  const handleConfirmReplace = useCallback(() => {
    if (!pendingBlueprint) return
    
    // Remove all nodes/edges from existing template
    const store = useCanvasStore.getState()
    store.pushHistory()
    
    const remainingNodes = nodes.filter(n => !n.data?.templateId)
    const remainingNodeIds = new Set(remainingNodes.map(n => n.id))
    const remainingEdges = edges.filter(e => 
      remainingNodeIds.has(e.source) && remainingNodeIds.has(e.target)
    )
    
    useCanvasStore.setState({
      nodes: remainingNodes,
      edges: remainingEdges
    })

    // Insert new blueprint (Sprint 2: Handle limit errors)
    const result = insertBlueprint(pendingBlueprint)
    if (result.error) {
      showToast(result.error, 'warning')
    }

    setPendingBlueprint(null)
    setExistingTemplate(null)
  }, [pendingBlueprint, nodes, edges, insertBlueprint])
  
  const handleCancelReplace = useCallback(() => {
    setPendingBlueprint(null)
    setExistingTemplate(null)
  }, [])
  
  const { showGrid, gridSize, snapToGrid, showAlignmentGuides, loadSettings } = useSettingsStore()
  const snapGridValue = useMemo<[number, number]>(() => [gridSize, gridSize], [gridSize])
  const edgeTypes = useMemo(() => ({ styled: StyledEdge as any }), [])
  const defaultEdgeOpts = useMemo(() => ({ type: 'styled' as const, animated: false }), [])
  const miniMapStyle = useMemo(() => ({ width: 120, height: 80 }), [])

  if (import.meta.env.DEV) {
    const renderCount = useRef(0)
    renderCount.current++
    if (renderCount.current > 100) console.warn('[ReactFlowGraph] Render storm detected')
  }

  useKeyboardShortcuts()

  useEffect(() => {
    // Always load visual/settings preferences (grid, snap, etc.)
    loadSettings()

    // In production, disable legacy canvas-storage graph persistence entirely.
    // This avoids loading potentially incompatible or corrupted graphs that
    // could trigger ReactFlow/React update loops on mount.
    if (import.meta.env.PROD) {
      if (typeof window !== 'undefined') {
        try {
          const win = window as any
          win.__SAFE_DEBUG__ ||= { logs: [] }
          const debug = win.__SAFE_DEBUG__
          const logs = Array.isArray(debug.logs) ? debug.logs : null
          if (logs && logs.length < 1000) {
            logs.push({
              t: Date.now(),
              m: 'canvas:persist:skip',
              data: { env: (import.meta as any)?.env?.MODE ?? 'production' }
            })
          }
        } catch {}
      }
      return
    }

    const loaded = loadState()
    if (loaded) {
      // P2: Use hydrateGraphSlice to avoid clobbering panels/results
      useCanvasStore.getState().hydrateGraphSlice({
        nodes: loaded.nodes,
        edges: loaded.edges
      })
    }
  }, [loadSettings])

  useEffect(() => {
    // Disable graph auto-persistence to localStorage in production to avoid
    // re-introducing bad or incompatible graph state. Dev keeps this enabled
    // for convenience while iterating on the editor.
    if (import.meta.env.PROD) return

    const unsubscribe = useCanvasStore.subscribe((state) =>
      saveState({ nodes: state.nodes, edges: state.edges })
    )
    return unsubscribe
  }, [])

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    useCanvasStore.getState().onNodesChange(changes)
  }, [])

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    useCanvasStore.getState().onEdgesChange(changes)
  }, [])

  const onConnect = useCallback((connection: Connection) => {
    useCanvasStore.getState().addEdge({ ...connection, data: DEFAULT_EDGE_DATA })
  }, [])

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY })
  }, [])

  const onNodeContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY })
  }, [])

  const onNodeDragStart = useCallback((_: React.MouseEvent | MouseEvent, node: any) => {
    setDraggingNodeIds(prev => new Set([...prev, node.id]))
    setIsDragging(true)
  }, [])

  const onNodeDragStop = useCallback(() => {
    setDraggingNodeIds(new Set())
    setIsDragging(false)
  }, [])

  const handleCloseContextMenu = useCallback(() => setContextMenu(null), [])

  // Canvas debug mode: 'blank' short-circuits the full canvas UI so we can
  // quickly determine whether React 185 is coming from inside the canvas
  // subtree or elsewhere. When debugMode === 'blank', we render a minimal
  // placeholder instead of mounting ReactFlow and related hooks.
  if (debugMode === 'blank') {
    logCanvasBreadcrumb('mode:blank', {})
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#f87171',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: 14,
        }}
      >
        Canvas debug: BLANK MODE (canvas UI disabled)
      </div>
    )
  }

  // Canvas debug mode: 'rf-only' renders ReactFlow WITHOUT any handlers
  // to isolate whether the React #185 loop is in node/edge components
  // vs the event handlers (onNodesChange, onSelectionChange, etc.)
  if (debugMode === 'rf-only') {
    logCanvasBreadcrumb('mode:rf-only', {
      nodes: memoizedNodes.length,
      edges: memoizedEdges.length,
    })
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 'var(--topbar-h)',
            bottom: 'var(--bottombar-h)',
            left: 0,
            right: 0,
          }}
        >
          <ReactFlow
            nodes={memoizedNodes}
            edges={memoizedEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOpts}
            fitView
            minZoom={0.1}
            maxZoom={4}
            // NOTE: No handlers passed - this isolates whether the loop is in
            // node/edge components vs the handlers
          >
            <Background variant={showGrid ? BackgroundVariant.Dots : BackgroundVariant.Lines} gap={gridSize} />
            <MiniMap style={miniMapStyle} />
          </ReactFlow>
        </div>
        <div
          style={{
            position: 'absolute',
            top: 'calc(var(--topbar-h) + 8px)',
            left: '8px',
            padding: '4px 8px',
            background: 'rgba(251, 191, 36, 0.9)',
            color: '#78350f',
            borderRadius: '4px',
            fontSize: '11px',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
            fontWeight: 500,
            zIndex: 1000,
          }}
        >
          RF-ONLY MODE: ReactFlow without handlers (no toolbar/overlays)
        </div>
      </div>
    )
  }

  // Canvas debug mode: 'rf-bare' renders ReactFlow with completely empty
  // arrays and NO custom node/edge types. This isolates whether the loop
  // is in our custom components vs ReactFlow itself.
  if (debugMode === 'rf-bare') {
    logCanvasBreadcrumb('mode:rf-bare', {})
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 'var(--topbar-h)',
            bottom: 'var(--bottombar-h)',
            left: 0,
            right: 0,
          }}
        >
          <ReactFlow
            nodes={[]}
            edges={[]}
            fitView
            minZoom={0.1}
            maxZoom={4}
            // NOTE: No nodeTypes, edgeTypes, handlers - completely bare ReactFlow
          >
            <Background variant={BackgroundVariant.Dots} gap={20} />
          </ReactFlow>
        </div>
        <div
          style={{
            position: 'absolute',
            top: 'calc(var(--topbar-h) + 8px)',
            left: '8px',
            padding: '4px 8px',
            background: 'rgba(220, 38, 38, 0.9)',
            color: 'white',
            borderRadius: '4px',
            fontSize: '11px',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
            fontWeight: 500,
            zIndex: 1000,
          }}
        >
          RF-BARE MODE: Empty ReactFlow (no nodes/edges/types)
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        cursor: quickAddMode ? 'crosshair' : undefined,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 'var(--topbar-h)',
          bottom: dockLayoutEnabled ? 'var(--bottombar-h)' : 0,
          // New layout: offset for LeftSidebar (48px). Old layout: offset for InputsDock
          left: dockLayoutEnabled ? 'var(--dock-left-offset, 0rem)' : 'var(--leftsidebar-w, 48px)',
          right: dockLayoutEnabled ? 'var(--dock-right-offset, 0rem)' : 0,
        }}
      >
        {debugMode === 'no-reactflow' ? (
          (() => {
            logCanvasBreadcrumb('mode:no-reactflow', { nodes: memoizedNodes.length, edges: memoizedEdges.length })
            return (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px dashed var(--surface-border)',
                  color: '#4b5563',
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
                  fontSize: 13,
                  background: 'rgba(248, 250, 252, 0.85)',
                }}
              >
                Canvas debug: NO-REACTFLOW MODE (graph rendering disabled)
              </div>
            )
          })()
        ) : (
          <ReactFlow
            nodes={memoizedNodes}
            edges={memoizedEdges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onSelectionChange={handleSelectionChange}
            onNodeClick={handleNodeClick}
            onNodeDoubleClick={handleNodeDoubleClick}
            onEdgeClick={handleEdgeClick}
            onEdgeDoubleClick={handleEdgeDoubleClick}
            onPaneClick={handlePaneClick}
            onPaneContextMenu={onPaneContextMenu}
            onNodeContextMenu={onNodeContextMenu}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOpts}
            snapToGrid={snapToGrid}
            snapGrid={snapGridValue}
            fitView
            minZoom={0.1}
            maxZoom={4}
          >
            <Background variant={showGrid ? BackgroundVariant.Dots : BackgroundVariant.Lines} gap={gridSize} />
            {/* TODO: Future enhancement - Add legend and interaction controls to MiniMap */}
            <MiniMap style={miniMapStyle} />
            <svg style={{ position: 'absolute', top: 0, left: 0 }}>
              <defs>
                {/* Arrowheads matching edge colors - original size (6x6), fixed regardless of stroke width */}
                <marker id="arrowhead-default" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <polygon points="0 0, 6 3, 0 6" fill="var(--surface-border)" />
                </marker>
                <marker id="arrowhead-selected" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <polygon points="0 0, 6 3, 0 6" fill="var(--info-500)" />
                </marker>
              </defs>
            </svg>
          </ReactFlow>
        )}
      </div>

      {/* Highlight layer for Results drivers (keyed off global showResultsPanel flag) */}
      <HighlightLayer isResultsOpen={showResultsPanel} />

      {/* Empty canvas state - shows helpful prompts when no nodes exist */}
      {/* Uses stable callbacks (handleEmptyStateDraft/handleEmptyStateTemplate) to prevent re-renders */}
      {nodes.length === 0 && debugMode === 'normal' && (
        <CanvasEmptyState
          onDraft={handleEmptyStateDraft}
          onTemplate={handleEmptyStateTemplate}
        />
      )}

      {showAlignmentGuides && isDragging && <AlignmentGuides nodes={nodes} draggingNodeIds={draggingNodeIds} isActive={isDragging} />}
      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={handleCloseContextMenu} />}
      {reconnecting && <ReconnectBanner />}

      {!USE_NEW_LAYOUT && <CanvasToolbar />}
      <LeftSidebar
        onAiClick={() => setShowDraftChat(true)}
        onAddNodeClick={handleQuickAddClick}
        onTemplatesClick={handleEmptyStateTemplate}
        onRunClick={handleRunSimulation}
        onCompareClick={handleOpenCompare}
        onEvidenceClick={() => setShowProvenanceHub(true)}
        onFitClick={() => fitView({ padding: 0.2, duration: 300 })}
        onHelpClick={openKeyboardLegend}
        // Canvas control actions (new)
        onUndoClick={undo}
        onRedoClick={redo}
        onResetClick={() => {
          if (nodes.length === 0 && edges.length === 0) {
            showToast('Canvas is already empty.', 'info')
            return
          }
          setShowResetConfirm(true)
        }}
        onZoomInClick={() => zoomIn({ duration: 200 })}
        onZoomOutClick={() => zoomOut({ duration: 200 })}
        onAutoArrangeClick={() => {
          if (nodes.length === 0) {
            showToast('No nodes to arrange.', 'info')
            return
          }
          applyLayout()
          showToast('Auto-arranged layout.', 'success')
        }}
        onExportClick={() => {
          // Export and download as JSON file
          const state = useCanvasStore.getState()
          const json = state.exportLocal()

          // Create blob and trigger download
          const blob = new Blob([json], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `decision-graph-${new Date().toISOString().slice(0, 10)}.json`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)

          showToast('Canvas exported and downloaded.', 'success')
        }}
        canUndo={canUndo()}
        canRedo={canRedo()}
      />
      {/* Status badges - positioned in bottom-left to avoid dock tabs */}
      <div
        className="absolute z-[1200] flex flex-row items-center gap-2"
        style={{
          bottom: 'calc(var(--bottombar-h, 3rem) + 1rem)',
          left: dockLayoutEnabled ? 'calc(var(--dock-left-offset, 0rem) + 1rem)' : '1rem',
        }}
      >
        <ConnectivityChip />
        <StatusChips
          currentNodes={nodes.length}
          currentEdges={edges.length}
          onClick={() => setShowLimits(true)}
        />
      </div>
      {/* Influence Explainer - shown when triggered from TopBar dropdown */}
      {shouldShowInfluenceExplainer && (
        <div
          className="absolute z-[1200] flex flex-col items-end gap-3"
          style={{
            top: 'calc(var(--topbar-h, 0px) + 1rem)',
            right: dockLayoutEnabled ? 'calc(var(--dock-right-offset, 0rem) + 1rem)' : '1rem',
          }}
        >
          <InfluenceExplainer forceShow={isInfluenceExplainerForced} onDismiss={hideInfluenceExplainer} compact />
        </div>
      )}
      {!showFullInspector && (
        <InspectorPopover onExpandToFull={() => setShowFullInspector(true)} />
      )}
      {showFullInspector && (
        <InspectorModal
          nodeId={selectedNodeId}
          edgeId={selectedEdgeId}
          onClose={() => setShowFullInspector(false)}
        />
      )}
      <SettingsPanel />
      <DiagnosticsOverlay />
      {/* ValidationChip removed - consolidated into OutputsDock */}
      <RecoveryBanner />
      <LayoutProgressBanner />

      {/* M4: Graph Health UI - HealthStatusBar removed, consolidated into OutputsDock */}
      {needleMovers.length > 0 && (
        <NeedleMoversOverlay
          movers={needleMovers}
          onFocusNode={handleFocusNode}
        />
      )}

      {paletteEnabled && showCommandPalette && (
        <CommandPalette
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          onOpenInspector={() => setShowInspectorPanel(true)}
        />
      )}
      {degradedBannerEnabled && <DegradedBanner />}
      <KeyboardLegend isOpen={isKeyboardLegendOpen} onClose={closeKeyboardLegend} />
      {showInspectorPanel && (
        <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-black/20"><div className="text-sm text-white">Loading...</div></div>}>
          <InspectorPanel isOpen={showInspectorPanel} onClose={() => setShowInspectorPanel(false)} />
        </Suspense>
      )}
      {showIssuesPanel && graphHealth && (
        <Suspense fallback={<div className="fixed inset-0 flex items-center justify-center bg-black/20"><div className="text-sm text-white">Loading...</div></div>}>
          <IssuesPanel
            issues={graphHealth.issues}
            onFixIssue={handleFixIssue}
            onClose={() => setShowIssuesPanel(false)}
          />
        </Suspense>
      )}

      {/* M5: Documents drawer (left side). When inputs/outputs layout is enabled, the
          DocumentsManager is rendered inside the InputsDock instead of this drawer. */}
      {!dockLayoutEnabled && showDocumentsDrawer && (
        <div
          className="fixed left-0 w-96 bg-white border-r border-gray-200 shadow-panel overflow-hidden"
          style={{ zIndex: 2000, top: 'var(--topbar-h)', bottom: 'var(--bottombar-h)' }}
          data-testid="documents-drawer"
          tabIndex={-1}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Documents</h2>
            <button
              onClick={() => setShowDocumentsDrawer(false)}
              className="p-1 hover:bg-gray-100 rounded"
              aria-label="Close documents drawer"
            >
              ✕
            </button>
          </div>
          <div className="h-full">
            <DocumentsManager
              onUpload={handleUploadDocuments}
              onDelete={handleDeleteDocument}
            />
          </div>
        </div>
      )}

      {/* M5: Provenance Hub panel (right side) */}
      {showProvenanceHub && (
        <RightPanel
          width="32rem"
          title="Provenance Hub"
          onClose={() => setShowProvenanceHub(false)}
        >
          <ProvenanceHubTab
            citations={citations}
            documents={documents}
            redactionEnabled={provenanceRedactionEnabled}
            onToggleRedaction={toggleProvenanceRedaction}
            onFocusNode={handleFocusNode}
          />
        </RightPanel>
      )}

      {/* Week 3: AI Clarifier panel */}
      {showAIClarifier && (
        <RightPanel
          width="400px"
          title="Olumi AI"
          onClose={() => setShowAIClarifier(false)}
        >
          <Suspense fallback={<div className="flex items-center justify-center p-8"><div className="text-sm text-gray-500">Loading...</div></div>}>
            <AIClarifierChat />
          </Suspense>
        </RightPanel>
      )}

      {existingTemplate && pendingBlueprint && (
        <ConfirmDialog
          title="Replace existing flow?"
          message={`This will replace the existing '${existingTemplate.name}' flow on the canvas.`}
          confirmLabel="Replace"
          cancelLabel="Cancel"
          onConfirm={handleConfirmReplace}
          onCancel={handleCancelReplace}
        />
      )}

      {/* P0-7: Radial quick-add menu */}
      {radialMenuPosition && (
        <RadialQuickAddMenu
          position={radialMenuPosition}
          onSelect={handleRadialMenuSelect}
          onCancel={handleRadialMenuCancel}
        />
      )}

      {/* P0-8: Auto-connect prompt */}
      {connectPrompt && (
        <ConnectPrompt
          targetNodeLabel={connectPrompt.targetNodeLabel}
          position={connectPrompt.position}
          onConfirm={handleConfirmConnect}
          onCancel={handleCancelConnect}
        />
      )}

      {/* Onboarding overlay for first-time users */}
      {onboardingEnabled && (
        <OnboardingOverlay
          isOpen={isOnboardingOpen}
          onClose={closeOnboarding}
          onShowKeyboardLegend={openKeyboardLegend}
          onShowInfluenceExplainer={showInfluenceExplainer}
        />
      )}

      {dockLayoutEnabled && (
        <div className="absolute inset-y-0 left-0 z-[900] flex pointer-events-none">
          <InputsDock
            currentNodes={nodes.length}
            currentEdges={edges.length}
            renderDocumentsTab={() => (
              <div className="h-full overflow-auto" data-testid="documents-panel" tabIndex={-1}>
                <DocumentsManager
                  onUpload={handleUploadDocuments}
                  onDelete={handleDeleteDocument}
                />
              </div>
            )}
          />
        </div>
      )}
      {/* OutputsDock (Results panel) - render in both old and new layouts */}
      <OutputsDock />
      <LimitsPanel
        isOpen={showLimits}
        onClose={() => setShowLimits(false)}
        currentNodes={nodes.length}
        currentEdges={edges.length}
      />

      {/* R1: Draft My Model chat loop (bottom overlay above toolbar) */}
      <DraftChat />

      {/* Week 3: AI Coaching nudges */}
      {activeNudge && <CoachingNudge nudge={activeNudge} />}

      {/* Reset Canvas Confirmation */}
      <BottomSheet isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)} title="Start fresh?">
        <div className="space-y-4">
          <p className="text-base text-gray-600">
            This will clear your entire decision, including:
          </p>
          <ul className="text-base text-gray-600 list-disc pl-5 space-y-1">
            <li>All nodes and connections in your graph</li>
            <li>Any analysis results</li>
            <li>AI assistant conversation</li>
          </ul>
          <p className="text-sm text-gray-500">
            You can undo this action with Ctrl+Z (Cmd+Z on Mac).
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowResetConfirm(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Keep working
            </button>
            <button
              onClick={() => {
                resetCanvas()
                setShowResetConfirm(false)
                showToast('Canvas reset.', 'success')
              }}
              className="flex-1 px-4 py-2 bg-danger-600 text-white rounded hover:bg-danger-700"
              data-testid="btn-confirm-reset-sidebar"
            >
              Reset everything
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}

/**
 * Debug label component for minimal modes
 */
function DebugLabel({ mode, color }: { mode: string; color: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(var(--topbar-h) + 8px)',
        left: '8px',
        padding: '4px 8px',
        background: color,
        color: 'white',
        borderRadius: '4px',
        fontSize: '11px',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        fontWeight: 500,
        zIndex: 1000,
      }}
    >
      {mode}
    </div>
  )
}

/**
 * RF-MINIMAL: ReactFlow with fitView, zoom, Background
 * Tests: Full minimal ReactFlow configuration
 */
function ReactFlowMinimal() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 'var(--topbar-h)', bottom: 'var(--bottombar-h)', left: 0, right: 0 }}>
        <ReactFlow nodes={[]} edges={[]} fitView minZoom={0.1} maxZoom={4}>
          <Background variant={BackgroundVariant.Dots} gap={20} />
        </ReactFlow>
      </div>
      <DebugLabel mode="RF-MINIMAL: fitView + zoom + Background" color="rgba(16, 185, 129, 0.9)" />
    </div>
  )
}

/**
 * RF-EMPTY: Absolutely empty ReactFlow - no props, no children
 * Tests: Is the loop in ReactFlow's core mounting logic?
 */
function ReactFlowEmpty() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 'var(--topbar-h)', bottom: 'var(--bottombar-h)', left: 0, right: 0 }}>
        <ReactFlow nodes={[]} edges={[]} />
      </div>
      <DebugLabel mode="RF-EMPTY: No props, no children" color="rgba(220, 38, 38, 0.9)" />
    </div>
  )
}

/**
 * RF-NO-FITVIEW: ReactFlow without fitView prop
 * Tests: Is fitView causing the loop?
 */
function ReactFlowNoFitView() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 'var(--topbar-h)', bottom: 'var(--bottombar-h)', left: 0, right: 0 }}>
        <ReactFlow nodes={[]} edges={[]} minZoom={0.1} maxZoom={4}>
          <Background variant={BackgroundVariant.Dots} gap={20} />
        </ReactFlow>
      </div>
      <DebugLabel mode="RF-NO-FITVIEW: zoom + Background (no fitView)" color="rgba(251, 146, 60, 0.9)" />
    </div>
  )
}

/**
 * RF-NO-BG: ReactFlow without Background child
 * Tests: Is Background causing the loop?
 */
function ReactFlowNoBg() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 'var(--topbar-h)', bottom: 'var(--bottombar-h)', left: 0, right: 0 }}>
        <ReactFlow nodes={[]} edges={[]} fitView minZoom={0.1} maxZoom={4} />
      </div>
      <DebugLabel mode="RF-NO-BG: fitView + zoom (no Background)" color="rgba(139, 92, 246, 0.9)" />
    </div>
  )
}

/**
 * RF-STORE: ReactFlow with nodes/edges from Zustand store, NO OTHER HOOKS
 * Tests: Is the loop in the store selector or in other hooks?
 *
 * CRITICAL: Uses INDIVIDUAL selectors (not object + shallow) to guarantee stable references.
 * In Zustand v5, object selectors with shallow can cause infinite loops with useSyncExternalStore
 * because the selector creates a new object on every call.
 *
 * NOTE: Uses default node/edge types (not custom) for simplest possible isolation.
 */
function ReactFlowStoreOnly() {
  // INDIVIDUAL SELECTORS - guaranteed stable references
  // Each selector returns the exact same reference as long as that specific value hasn't changed
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 'var(--topbar-h)', bottom: 'var(--bottombar-h)', left: 0, right: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          minZoom={0.1}
          maxZoom={4}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} />
        </ReactFlow>
      </div>
      <DebugLabel mode={`RF-STORE: Store nodes(${nodes.length})/edges(${edges.length}), no handlers`} color="rgba(16, 185, 129, 0.9)" />
    </div>
  )
}

/**
 * PROVIDER-ONLY: ReactFlowProvider with just a div (no ReactFlow component)
 * Tests: Is the loop in ReactFlowProvider itself?
 */
function ProviderOnlyContent() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          top: 'var(--topbar-h)',
          bottom: 'var(--bottombar-h)',
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          border: '2px dashed #cbd5e1',
        }}
      >
        <span style={{ color: '#64748b', fontSize: '14px' }}>
          ReactFlowProvider active, no ReactFlow component
        </span>
      </div>
      <DebugLabel mode="PROVIDER-ONLY: ReactFlowProvider with div child" color="rgba(59, 130, 246, 0.9)" />
    </div>
  )
}

export default function ReactFlowGraph(props: ReactFlowGraphProps) {
  // Check debug mode BEFORE entering the complex component tree
  const debugMode = getCanvasDebugMode()

  // NO-PROVIDER: Render WITHOUT ReactFlowProvider to test if provider is the issue
  if (debugMode === 'no-provider') {
    logCanvasBreadcrumb('mode:no-provider', {})
    return (
      <CanvasErrorBoundary>
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: 'var(--topbar-h)',
              bottom: 'var(--bottombar-h)',
              left: 0,
              right: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fef2f2',
              border: '2px dashed #fca5a5',
            }}
          >
            <span style={{ color: '#dc2626', fontSize: '14px' }}>
              NO ReactFlowProvider - just CanvasErrorBoundary + div
            </span>
          </div>
          <DebugLabel mode="NO-PROVIDER: No ReactFlowProvider at all" color="rgba(220, 38, 38, 0.9)" />
        </div>
      </CanvasErrorBoundary>
    )
  }

  // PROVIDER-ONLY: ReactFlowProvider with div child (no ReactFlow component)
  if (debugMode === 'provider-only') {
    logCanvasBreadcrumb('mode:provider-only', {})
    return (
      <CanvasErrorBoundary>
        <ReactFlowProvider>
          <ProviderOnlyContent />
        </ReactFlowProvider>
      </CanvasErrorBoundary>
    )
  }

  // BLANK: Absolutely minimal - just a div, no providers, no hooks
  // This tests if the loop is in ToastProvider/LayerProvider/ReactFlowProvider
  if (debugMode === 'blank') {
    logCanvasBreadcrumb('mode:blank', {})
    return (
      <CanvasErrorBoundary>
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f87171',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: 14,
          }}
        >
          Canvas debug: BLANK MODE (no providers, no hooks)
        </div>
      </CanvasErrorBoundary>
    )
  }

  // RF-* modes: Bypass ReactFlowGraphInner entirely to isolate ReactFlow issues
  // Each mode tests a specific hypothesis about what's causing React #185
  const minimalModes: Record<string, JSX.Element> = {
    'rf-minimal': <ReactFlowMinimal />,
    'rf-empty': <ReactFlowEmpty />,
    'rf-no-fitview': <ReactFlowNoFitView />,
    'rf-no-bg': <ReactFlowNoBg />,
    'rf-bare': <ReactFlowEmpty />,  // Same as rf-empty but explicitly named
    'rf-store': <ReactFlowStoreOnly />,  // Store selector ONLY, no other hooks
  }

  if (debugMode in minimalModes) {
    logCanvasBreadcrumb(`mode:${debugMode}`, {})
    return (
      <CanvasErrorBoundary>
        <ReactFlowProvider>
          {minimalModes[debugMode]}
        </ReactFlowProvider>
      </CanvasErrorBoundary>
    )
  }

  return (
    <CanvasErrorBoundary>
      <ToastProvider>
        <LayerProvider>
          <ReactFlowProvider>
            <ReactFlowGraphInner {...props} />
          </ReactFlowProvider>
        </LayerProvider>
      </ToastProvider>
    </CanvasErrorBoundary>
  )
}
