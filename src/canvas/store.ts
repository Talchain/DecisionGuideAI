// Hardened store with timer cleanup, ID reseeding, edge debouncing
import { create } from 'zustand'
import { Node, Edge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from '@xyflow/react'
import { saveSnapshot as persistSnapshot, importCanvas as persistImport, exportCanvas as persistExport } from './persist'
import { setsEqual } from './store/utils'
import { DEFAULT_EDGE_DATA, type EdgeData } from './domain/edges'
import { NODE_REGISTRY, type NodeType } from './domain/nodes'
import { applyLayout, applyLayoutWithPolicy } from './layout'
import { mergePolicy } from './layout/policy'
import { policyToPreset, policyToSpacing } from './layout/adapters'
import { getInvalidNodes as getInvalidNodesUtil, getNextInvalidNode as getNextInvalidNodeUtil, type InvalidNodeInfo } from './utils/validateOutgoing'
import type { ReportV1, ErrorV1 } from '../adapters/plot/types'
import { trackResultsViewed, trackIssuesOpened } from './utils/sandboxTelemetry'
import { addRun, generateGraphHash, type StoredRun } from './store/runHistory'
import * as scenarios from './store/scenarios'
import type { Scenario, ScenarioFraming } from './store/scenarios'
import type { GraphHealth, ValidationIssue, NeedleMover } from './validation/types'
import type { Document, Citation } from './share/types'
import type { Snapshot, DecisionRationale } from './snapshots/types'
import type { CeeDecisionReviewPayload, CeeTraceMeta, CeeErrorViewModel } from './decisionReview/types'
import type { CeeDebugHeaders } from './utils/ceeDebugHeaders'
import { loadSearchQuery, loadSortPreferences, saveSearchQuery, saveSortPreferences, __test__ as docsTest } from './store/documents'
import { loadUIPreferences, saveUIPreference } from './store/uiPreferences'

/**
 * Generate deterministic content hash using FNV-1a algorithm
 * Fast, simple, and produces consistent hashes for content integrity checks
 */
function generateContentHash(content: string): string {
  let hash = 2166136261 // FNV offset basis
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i)
    hash = Math.imul(hash, 16777619) // FNV prime
  }
  // Convert to unsigned 32-bit hex string
  return (hash >>> 0).toString(16).padStart(8, '0')
}

// Results panel state machine
export type ResultsStatus = 'idle' | 'preparing' | 'connecting' | 'streaming' | 'complete' | 'error' | 'cancelled'

export interface ResultsState {
  status: ResultsStatus
  progress: number              // 0..100 (cap 90 until COMPLETE)
  runId?: string
  isDuplicateRun?: boolean      // v1.2: true if this run hash already existed in history
  wasForced?: boolean           // v1.2: true if this was a forced rerun (suppresses duplicate toast)
  seed?: number
  hash?: string                 // response_hash
  report?: ReportV1 | null
  error?: { code: string; message: string; retryAfter?: number } | null
  startedAt?: number
  finishedAt?: number
  drivers?: Array<{ kind: 'node' | 'edge'; id: string }>
}

export type SseDiagnostics = {
  resumes: number
  trims: 0 | 1
  recovered_events: number
  correlation_id: string
}

export type RunMetaState = {
  diagnostics?: SseDiagnostics
  correlationIdHeader?: string
  degraded?: boolean
  ceeReview?: CeeDecisionReviewPayload | null
  ceeTrace?: CeeTraceMeta | null
  ceeError?: CeeErrorViewModel | null
  ceeDebugHeaders?: CeeDebugHeaders // Phase 1 Section 4.1: Dev-only debug headers
}

const initialNodes: Node[] = []

const initialEdges: Edge<EdgeData>[] = []

interface ClipboardData {
  nodes: Node[]
  edges: Edge<EdgeData>[]
}

type ReconnectEnd = 'source' | 'target'

interface ReconnectState {
  edgeId: string
  end: ReconnectEnd
}

interface CanvasState {
  nodes: Node[]
  edges: Edge<EdgeData>[]
  history: { past: { nodes: Node[]; edges: Edge<EdgeData>[] }[]; future: { nodes: Node[]; edges: Edge<EdgeData>[] }[] }
  selection: { nodeIds: Set<string>; edgeIds: Set<string> }
  clipboard: ClipboardData | null
  reconnecting: ReconnectState | null
  touchedNodeIds: Set<string>  // Nodes with edited probabilities
  outcomeNodeId: string | null  // Selected outcome node for analysis
  nextNodeId: number
  nextEdgeId: number
  _internal: { lastHistoryHash: string }
  results: ResultsState  // Analysis results panel state
  runMeta: RunMetaState
  // Scenario state
  currentScenarioId: string | null  // Active scenario ID
  currentScenarioFraming: ScenarioFraming | null
  currentScenarioLastResultHash: string | null  // Most recent analysis hash for the active scenario
  currentScenarioLastRunAt: string | null  // ISO timestamp of last analysis run for the active scenario
  currentScenarioLastRunSeed: string | null  // Seed used for last analysis run (stringified)
  hasCompletedFirstRun: boolean  // True after at least one successful or restored run in this session
  isDirty: boolean  // Has unsaved changes
  isSaving: boolean  // P0-2: Currently saving
  lastSavedAt: number | null  // P0-2: Timestamp of last successful save
  // Panel visibility
  showResultsPanel: boolean
  showInspectorPanel: boolean
  showTemplatesPanel: boolean
  templatesPanelInvoker: HTMLElement | null
  showDraftChat: boolean
  // M4: Graph Health & Repair
  graphHealth: GraphHealth | null
  showIssuesPanel: boolean
  needleMovers: NeedleMover[]
  // Phase 3: Interaction enhancements (Set for O(1) lookup)
  highlightedNodes: Set<string>
  // M5: Grounding & Provenance
  documents: Document[]
  citations: Citation[]
  showProvenanceHub: boolean
  showDocumentsDrawer: boolean
  provenanceRedactionEnabled: boolean
  // S7-FILEOPS: Document management state
  documentSearchQuery: string
  documentSortField: 'name' | 'date' | 'size' | 'type'
  documentSortDirection: 'asc' | 'desc'
  // M6: Compare & Decision Rationale
  selectedSnapshotsForComparison: string[] // Snapshot IDs
  showComparePanel: boolean
  currentDecisionRationale: DecisionRationale | null
  updateScenarioFraming: (partial: ScenarioFraming) => void
  addNode: (pos?: { x: number; y: number }, type?: NodeType) => void
  updateNodeLabel: (id: string, label: string) => void
  updateNode: (id: string, updates: Partial<Node>) => void
  updateEdge: (id: string, updates: Partial<Edge<EdgeData>>) => void
  updateEdgeData: (id: string, data: Partial<EdgeData>) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onSelectionChange: (params: { nodes: Node[]; edges: Edge<EdgeData>[] }) => void
  selectNodeWithoutHistory: (nodeId: string) => void
  addEdge: (edge: Omit<Edge<EdgeData>, 'id'>) => void
  pushHistory: (debounced?: boolean) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  deleteSelected: () => void
  duplicateSelected: () => void
  copySelected: () => void
  pasteClipboard: () => void
  cutSelected: () => void
  selectAll: () => void
  nudgeSelected: (dx: number, dy: number) => void
  saveSnapshot: () => boolean
  importCanvas: (json: string) => boolean
  exportCanvas: () => string
  applyLayout: () => Promise<void>
  applySimpleLayout: (preset: 'grid' | 'hierarchy' | 'flow', spacing: 'small' | 'medium' | 'large') => void
  applyGuidedLayout: (policy?: Partial<import('./layout/policy').LayoutPolicy>) => void
  resetCanvas: () => void
  createNodeId: () => string
  createEdgeId: () => string
  reseedIds: (nodes: Node[], edges: Edge[]) => void
  deleteEdge: (id: string) => void
  updateEdgeEndpoints: (id: string, updates: { source?: string; target?: string }) => void
  beginReconnect: (edgeId: string, end: ReconnectEnd) => void
  completeReconnect: (nodeId: string) => void
  cancelReconnect: () => void
  reset: () => void
  cleanup: () => void
  // Outcome node
  setOutcomeNode: (nodeId: string | null) => void
  // Results actions
  resultsStart: (params: { seed: number; wasForced?: boolean }) => void
  resultsConnecting: (runId: string) => void
  resultsProgress: (percent: number) => void
  resultsComplete: (params: {
    report: ReportV1
    hash: string
    drivers?: Array<{ kind: 'node' | 'edge'; id: string }>
    ceeReview?: CeeDecisionReviewPayload | null
    ceeTrace?: CeeTraceMeta | null
    ceeError?: CeeErrorViewModel | null
  }) => void
  resultsError: (params: { code: string; message: string; retryAfter?: number }) => void
  resultsCancelled: () => void
  resultsReset: () => void
  resultsLoadHistorical: (run: StoredRun) => void
  setRunMeta: (meta: RunMetaState) => void
  // Scenario actions
  loadScenario: (id: string) => boolean
  saveCurrentScenario: (name?: string) => string | null
  createScenarioFromTemplate: (params: { templateId: string; templateVersion?: string; name: string }) => string
  duplicateCurrentScenario: (newName?: string) => string | null
  renameCurrentScenario: (name: string) => void
  deleteScenario: (id: string) => void
  markDirty: () => void
  markClean: () => void
  // Panel actions
  setShowResultsPanel: (show: boolean) => void
  setShowInspectorPanel: (show: boolean) => void
  openTemplatesPanel: (invoker?: HTMLElement) => void
  closeTemplatesPanel: () => void
  setShowDraftChat: (show: boolean) => void
  // M4: Graph Health actions
  validateGraph: () => void
  setShowIssuesPanel: (show: boolean) => void
  applyRepair: (issueId: string) => void
  applyAllRepairs: () => void
  setNeedleMovers: (movers: NeedleMover[]) => void
  // Phase 3: Interaction actions
  setHighlightedNodes: (ids: string[]) => void
  // M5: Provenance actions
  addDocument: (document: Omit<Document, 'id' | 'uploadedAt'>) => string
  removeDocument: (id: string) => void
  renameDocument: (id: string, newName: string) => void  // S7-FILEOPS
  setDocumentSearchQuery: (query: string) => void  // S7-FILEOPS
  setDocumentSort: (field: 'name' | 'date' | 'size' | 'type', direction: 'asc' | 'desc') => void  // S7-FILEOPS
  addCitation: (citation: Omit<Citation, 'id' | 'createdAt'>) => void
  setShowProvenanceHub: (show: boolean) => void
  setShowDocumentsDrawer: (show: boolean) => void
  toggleProvenanceRedaction: () => void
  // M6: Compare & Snapshots actions
  setSelectedSnapshotsForComparison: (snapshotIds: string[]) => void
  setShowComparePanel: (show: boolean) => void
  setDecisionRationale: (rationale: DecisionRationale | null) => void
  exportLocal: () => string
  // P2: Hydration hygiene
  hydrateGraphSlice: (loaded: { nodes?: Node[]; edges?: Edge<EdgeData>[]; currentScenarioId?: string | null }) => void
}

let historyTimer: ReturnType<typeof setTimeout> | null = null
let nudgeTimer: ReturnType<typeof setTimeout> | null = null
const MAX_HISTORY = 50
export const HISTORY_DEBOUNCE_MS = 200

function clearTimers() {
  if (historyTimer) {
    clearTimeout(historyTimer)
    historyTimer = null
  }
  if (nudgeTimer) {
    clearTimeout(nudgeTimer)
    nudgeTimer = null
  }
}

function historyHash(nodes: Node[], edges: Edge[]): string {
  const n = nodes.map(n => `${n.id}@${n.position.x},${n.position.y}:${n.type ?? ''}:${n.data?.label ?? ''}`).join('|')
  const e = edges.map(e => `${e.id}:${e.source}>${e.target}:${e.label ?? ''}:${(e.data as any)?.schemaVersion ?? ''}`).join('|')
  return `${n}#${e}`
}

function pushToHistory(get: () => CanvasState, set: (fn: (s: CanvasState) => Partial<CanvasState>) => void) {
  const { nodes, edges, history, _internal } = get()

  // Guard: only push if state actually changed (unless history is empty - always push first snapshot)
  const h = historyHash(nodes, edges)
  if (history.past.length > 0 && h === _internal.lastHistoryHash) {
    // Even if no change, clear future (user took new action after undo)
    if (history.future.length > 0) {
      set(() => ({ history: { ...history, future: [] } }))
    }
    return
  }

  // Strip selection flags from history snapshots - selection is ephemeral UI state
  const cleanNodes = nodes.map(n => ({ ...n, selected: undefined }))
  const cleanEdges = edges.map(e => ({ ...e, selected: undefined }))

  const past = [...history.past, { nodes: cleanNodes, edges: cleanEdges }].slice(-MAX_HISTORY)
  set(() => ({
    history: { past, future: [] },
    _internal: { lastHistoryHash: h }
  }))
}

function scheduleHistoryPush(get: () => CanvasState, set: (fn: (s: CanvasState) => Partial<CanvasState>) => void) {
  if (historyTimer) clearTimeout(historyTimer)
  historyTimer = setTimeout(() => pushToHistory(get, set), HISTORY_DEBOUNCE_MS)
}

function getMaxNumericId(ids: string[]): number {
  return ids.reduce((max, id) => {
    const num = parseInt(id.replace(/\D/g, ''), 10)
    return isNaN(num) ? max : Math.max(max, num)
  }, 0)
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  history: { past: [], future: [] },
  selection: { nodeIds: new Set(), edgeIds: new Set() },
  _internal: { lastHistoryHash: '' },
  clipboard: null,
  reconnecting: null,
  touchedNodeIds: new Set(),
  outcomeNodeId: null,
  nextNodeId: 1,
  nextEdgeId: 1,
  results: {
    status: 'idle',
    progress: 0
  },
  runMeta: {},
  // Scenario state
  currentScenarioId: scenarios.getCurrentScenarioId(),
  currentScenarioFraming: null,
  currentScenarioLastResultHash: null,
  currentScenarioLastRunAt: null,
  currentScenarioLastRunSeed: null,
  hasCompletedFirstRun: false,
  isDirty: false,
  isSaving: false,  // P0-2: Initially not saving
  lastSavedAt: null,  // P0-2: No save yet
  // Phase 3: Panel visibility with persistence
  ...{
    showResultsPanel: false,
    showInspectorPanel: false,
    showTemplatesPanel: false,
    showDraftChat: false,
    showIssuesPanel: false,
    showProvenanceHub: false,
    showDocumentsDrawer: false,
    showComparePanel: false,
    ...loadUIPreferences(), // Override with persisted preferences
  },
  templatesPanelInvoker: null,
  // M4: Graph Health & Repair
  graphHealth: null,
  needleMovers: [],
  highlightedNodes: new Set<string>(),
  // M5: Grounding & Provenance
  documents: [],
  citations: [],
  provenanceRedactionEnabled: true, // M5: Redaction ON by default
  // S7-FILEOPS: Document management initial state
  documentSearchQuery: loadSearchQuery(),
  ...loadSortPreferences(),
  // M6: Compare & Decision Rationale
  selectedSnapshotsForComparison: [],
  currentDecisionRationale: null,

  createNodeId: () => {
    const { nextNodeId } = get()
    set({ nextNodeId: nextNodeId + 1 })
    return String(nextNodeId)
  },

  createEdgeId: () => {
    const { nextEdgeId } = get()
    set({ nextEdgeId: nextEdgeId + 1 })
    return `e${nextEdgeId}`
  },

  reseedIds: (nodes, edges) => {
    const maxNodeId = getMaxNumericId(nodes.map(n => n.id))
    const maxEdgeId = getMaxNumericId(edges.map(e => e.id))
    set({ 
      nextNodeId: Math.max(maxNodeId + 1, 5),
      nextEdgeId: Math.max(maxEdgeId + 1, 5)
    })
  },

  addNode: (pos, type = 'decision') => {
    pushToHistory(get, set)
    const id = get().createNodeId()
    set((s) => ({ nodes: [...s.nodes, { id, type, position: pos || { x: 200, y: 200 }, data: { label: `Node ${id}` } }] }))
  },

  updateNodeLabel: (id, label) => {
    pushToHistory(get, set)
    set((s) => ({ nodes: s.nodes.map(n => n.id === id ? { ...n, data: { ...n.data, label } } : n) }))
  },

  updateNode: (id, updates) => {
    // Validate node type if being updated
    if (updates.type && !NODE_REGISTRY[updates.type as NodeType]) {
      console.warn(`[Canvas] Invalid node type: ${updates.type}`)
      return
    }
    pushToHistory(get, set)
    set((s) => ({ 
      nodes: s.nodes.map(n => n.id === id ? { ...n, ...updates, data: { ...n.data, ...updates.data } } : n) 
    }))
  },

  updateEdge: (id, updates) => {
    pushToHistory(get, set)
    set((s) => {
      const touchedNodeIds = new Set(s.touchedNodeIds)

      const edges = s.edges.map(e => {
        if (e.id !== id) return e

        // Check if confidence changed
        const oldConfidence = e.data?.confidence
        const newConfidence = updates.data?.confidence

        // If confidence changed, mark source node as touched
        if (newConfidence !== undefined && oldConfidence !== newConfidence) {
          touchedNodeIds.add(e.source)
        }

        // Merge updates, ensuring required EdgeData fields are preserved
        const updatedEdge: Edge<EdgeData> = {
          ...e,
          ...updates,
          data: updates.data ? { ...e.data, ...updates.data } : e.data
        }
        return updatedEdge
      })

      return { edges, touchedNodeIds }
    })
  },

  updateEdgeData: (id, data) => {
    // Clamp weight and belief to valid range [0, 1]
    const clampedData = {
      ...data,
      weight: data.weight !== undefined ? Math.max(0, Math.min(1, data.weight)) : undefined,
      belief: data.belief !== undefined ? Math.max(0, Math.min(1, data.belief)) : undefined
    }
    get().updateEdge(id, { data: clampedData })
  },

  onNodesChange: (changes) => {
    // Guard no-op changes
    if (!changes || changes.length === 0) return
    
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) }))
    
    // Debounce history for drag operations
    const isDrag = changes.some(c => c.type === 'position' && (c as any).dragging)
    if (isDrag) {
      scheduleHistoryPush(get, set)
    } else {
      // Immediate push for non-drag changes (select, remove, add)
      pushToHistory(get, set)
    }
  },

  onEdgesChange: (changes) => {
    // Guard no-op changes
    if (!changes || changes.length === 0) return
    
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) as Edge<EdgeData>[] }))
    
    // Edges don't have position changes, always push immediately
    pushToHistory(get, set)
  },

  onSelectionChange: ({ nodes, edges }) => {
    const newNodeIds = new Set(nodes.map(n => n.id))
    const newEdgeIds = new Set(edges.map(e => e.id))

    const { selection } = get()

    // Handle initial state safely
    const prevNodeIds = selection?.nodeIds ?? new Set<string>()
    const prevEdgeIds = selection?.edgeIds ?? new Set<string>()

    // Compare by value using setsEqual utility
    const nodeIdsChanged = !setsEqual(newNodeIds, prevNodeIds)
    const edgeIdsChanged = !setsEqual(newEdgeIds, prevEdgeIds)

    // Early return if selection didn't actually change (prevents render loop)
    if (!nodeIdsChanged && !edgeIdsChanged) return

    // Only commit when different
    set({
      selection: {
        nodeIds: newNodeIds,
        edgeIds: newEdgeIds,
      },
    })
  },

  // Select a node without pushing to history (for focus/navigation)
  selectNodeWithoutHistory: (nodeId) => {
    set(s => ({
      nodes: s.nodes.map(n => ({
        ...n,
        selected: n.id === nodeId
      })),
      selection: {
        nodeIds: new Set([nodeId]),
        edgeIds: new Set()
      }
    }))
  },

  addEdge: (edge) => {
    pushToHistory(get, set)
    const id = get().createEdgeId()
    set((s) => {
      const touchedNodeIds = new Set(s.touchedNodeIds)

      // If edge has non-zero confidence, mark source node as touched
      if (edge.data?.confidence && edge.data.confidence > 0) {
        touchedNodeIds.add(edge.source)
      }

      return {
        edges: [...s.edges, { id, ...edge }],
        touchedNodeIds
      }
    })
  },

  pushHistory: (debounced = false) => {
    if (debounced) {
      clearTimers()
      historyTimer = setTimeout(() => pushToHistory(get, set), HISTORY_DEBOUNCE_MS)
      return
    }
    pushToHistory(get, set)
  },

  undo: () => {
    const { history, nodes, edges } = get()
    if (history.past.length === 0) return
    const prev = history.past[history.past.length - 1]
    const past = history.past.slice(0, -1)
    const future = [{ nodes, edges }, ...history.future]
    set({ nodes: prev.nodes, edges: prev.edges, history: { past, future } })
    // Reset hash after undo
    const { nodes: newNodes, edges: newEdges } = get()
    set(() => ({ _internal: { lastHistoryHash: historyHash(newNodes, newEdges) } }))
  },

  redo: () => {
    const { history, nodes, edges } = get()
    if (history.future.length === 0) return
    const next = history.future[0]
    const past = [...history.past, { nodes, edges }]
    const future = history.future.slice(1)
    set({ nodes: next.nodes, edges: next.edges, history: { past, future } })
    // Reset hash after redo
    const { nodes: newNodes, edges: newEdges } = get()
    set(() => ({ _internal: { lastHistoryHash: historyHash(newNodes, newEdges) } }))
  },

  canUndo: () => get().history.past.length > 0,
  canRedo: () => get().history.future.length > 0,

  deleteSelected: () => {
    pushToHistory(get, set)
    const { selection } = get()
    set((s) => ({
      nodes: s.nodes.filter(n => !selection.nodeIds.has(n.id)),
      edges: s.edges.filter(e => !selection.nodeIds.has(e.source) && !selection.nodeIds.has(e.target) && !selection.edgeIds.has(e.id)),
      selection: { nodeIds: new Set(), edgeIds: new Set() }
    }))
  },

  duplicateSelected: () => {
    pushToHistory(get, set)
    const { nodes, edges, selection } = get()
    const selectedNodes = nodes.filter(n => selection.nodeIds.has(n.id))
    if (selectedNodes.length === 0) return

    const idMap: Record<string, string> = {}
    const newNodes: Node[] = []
    
    selectedNodes.forEach(node => {
      const newId = get().createNodeId()
      idMap[node.id] = newId
      newNodes.push({
        ...node,
        id: newId,
        position: { x: node.position.x + 50, y: node.position.y + 50 },
        data: { ...node.data }
      })
    })

    const selectedEdges = edges.filter(e => selection.nodeIds.has(e.source) && selection.nodeIds.has(e.target))
    const newEdges: Edge<EdgeData>[] = selectedEdges.map(edge => ({
      ...edge,
      id: get().createEdgeId(),
      source: idMap[edge.source],
      target: idMap[edge.target]
    }))

    set((s) => ({
      nodes: [...s.nodes, ...newNodes],
      edges: [...s.edges, ...newEdges],
      selection: { nodeIds: new Set(newNodes.map(n => n.id)), edgeIds: new Set() }
    }))
  },

  copySelected: () => {
    const { nodes, edges, selection } = get()
    const selectedNodes = nodes.filter(n => selection.nodeIds.has(n.id))
    const selectedEdges = edges.filter(e => selection.nodeIds.has(e.source) && selection.nodeIds.has(e.target))
    set({ clipboard: { nodes: selectedNodes, edges: selectedEdges } })
  },

  pasteClipboard: () => {
    const { clipboard } = get()
    if (!clipboard || clipboard.nodes.length === 0) return

    pushToHistory(get, set)
    const idMap: Record<string, string> = {}
    const newNodes: Node[] = []

    clipboard.nodes.forEach(node => {
      const newId = get().createNodeId()
      idMap[node.id] = newId
      newNodes.push({
        ...node,
        id: newId,
        position: { x: node.position.x + 50, y: node.position.y + 50 },
        data: { ...node.data }
      })
    })

    const newEdges: Edge<EdgeData>[] = clipboard.edges.map(edge => ({
      ...edge,
      id: get().createEdgeId(),
      source: idMap[edge.source],
      target: idMap[edge.target]
    }))

    set((s) => ({
      nodes: [...s.nodes, ...newNodes],
      edges: [...s.edges, ...newEdges],
      selection: { nodeIds: new Set(newNodes.map(n => n.id)), edgeIds: new Set() }
    }))
  },

  cutSelected: () => {
    // Atomic operation: copy + delete in single history frame
    // This prevents double-frame if copySelected ever mutates in future
    const { nodes, edges, selection } = get()
    const selectedNodes = nodes.filter(n => selection.nodeIds.has(n.id))
    const selectedEdges = edges.filter(e => selection.nodeIds.has(e.source) && selection.nodeIds.has(e.target))
    
    // Push history once before mutation
    pushToHistory(get, set)
    
    // Set clipboard and delete in same transaction
    set((s) => ({
      clipboard: { nodes: selectedNodes, edges: selectedEdges },
      nodes: s.nodes.filter(n => !selection.nodeIds.has(n.id)),
      edges: s.edges.filter(e => !selection.nodeIds.has(e.source) && !selection.nodeIds.has(e.target) && !selection.edgeIds.has(e.id)),
      selection: { nodeIds: new Set(), edgeIds: new Set() }
    }))
  },

  selectAll: () => {
    const { nodes, edges, history, _internal } = get()

    // Save current state to history BEFORE selection (if hash matches last save)
    // This ensures undo will work after delete-all
    const currentHash = historyHash(nodes, edges)

    // If hash matches, no structural changes happened since last push
    // But we're about to modify selection, so save current state first
    // This enables: selectAll → delete → undo to work
    if (_internal.lastHistoryHash === currentHash) {
      const cleanNodes = nodes.map(n => ({ ...n, selected: undefined }))
      const cleanEdges = edges.map(e => ({ ...e, selected: undefined }))
      const past = [...history.past, { nodes: cleanNodes, edges: cleanEdges }].slice(-MAX_HISTORY)

      // Mark hash as "dirty" so next operation (like delete) will push
      set({
        history: { past, future: [] },
        _internal: { lastHistoryHash: '' }
      })
    }

    // Set selected: true on all nodes and edges so React Flow shows them as selected
    const updatedNodes = nodes.map(n => ({ ...n, selected: true }))
    const updatedEdges = edges.map(e => ({ ...e, selected: true }))
    set({
      nodes: updatedNodes,
      edges: updatedEdges,
      selection: {
        nodeIds: new Set(nodes.map(n => n.id)),
        edgeIds: new Set(edges.map(e => e.id))
      }
    })
  },

  nudgeSelected: (dx, dy) => {
    const { selection } = get()
    if (selection.nodeIds.size === 0) return

    // On first nudge in burst, push current state to history
    // Subsequent nudges within 500ms window won't push (coalesced into single undo frame)
    if (!nudgeTimer) {
      pushToHistory(get, set)
    }

    // Apply nudge immediately (responsive)
    set((s) => ({
      nodes: s.nodes.map(n => 
        selection.nodeIds.has(n.id)
          ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
          : n
      )
    }))

    // Reset debounce timer: if 500ms passes without another nudge, burst is complete
    if (nudgeTimer) clearTimeout(nudgeTimer)
    nudgeTimer = setTimeout(() => {
      nudgeTimer = null
    }, 500)
  },

  saveSnapshot: () => {
    const { nodes, edges } = get()
    return persistSnapshot({ nodes, edges })
  },

  importCanvas: (json: string) => {
    const imported = persistImport(json)
    if (!imported) return false

    // Clear history since this is a full import
    clearTimers()
    
    // Reseed IDs to avoid collisions
    get().reseedIds(imported.nodes, imported.edges)
    
    set({
      nodes: imported.nodes,
      edges: imported.edges,
      history: { past: [], future: [] },
      selection: { nodeIds: new Set(), edgeIds: new Set() },
      showDraftChat: false,
    })
    
    return true
  },

  exportCanvas: () => {
    const { nodes, edges } = get()
    return persistExport({ nodes, edges })
  },

  applyLayout: async () => {
    const { nodes, edges } = get()
    
    // Dynamic import to avoid bundling ELK if not used
    const { layoutGraph } = await import('./utils/layout')
    const { useLayoutStore } = await import('./layoutStore')
    const layoutOptions = useLayoutStore.getState()
    
    // Push to history before layout
    pushToHistory(get, set)
    
    try {
      const { nodes: layoutedNodes } = await layoutGraph(nodes, edges, {
        direction: layoutOptions.direction,
        spacing: layoutOptions.nodeSpacing,
        preserveLocked: layoutOptions.respectLocked
      })
      
      set({ nodes: layoutedNodes })
    } catch (err) {
      console.error('[CANVAS] Layout failed:', err)
      // Rethrow so callers can provide user-facing error feedback
      throw err
    }
  },

  applySimpleLayout: (preset, spacing) => {
    const { nodes, edges, selection } = get()
    
    if (nodes.length < 2) {
      return // Nothing to layout
    }
    
    // Convert nodes to layout format
    const layoutNodes = nodes.map(n => ({
      id: n.id,
      width: n.width || 200,
      height: n.height || 80,
      locked: selection.nodeIds.has(n.id) // Preserve selected nodes
    }))
    
    const layoutEdges = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target
    }))
    
    // Apply layout
    const result = applyLayout(layoutNodes, layoutEdges, {
      preset,
      spacing,
      preserveSelection: false,
      minimizeCrossings: true
    })
    
    // Push to history before applying
    pushToHistory(get, set)
    
    // Update node positions
    const updatedNodes = nodes.map(node => {
      const newPos = result.positions[node.id]
      return newPos ? { ...node, position: newPos } : node
    })
    
    set({ nodes: updatedNodes })
  },

  applyGuidedLayout: (policy) => {
    const { nodes, edges } = get()
    
    if (nodes.length < 2) {
      return
    }
    
    const effectivePolicy = mergePolicy(policy)
    
    // Convert to layout format with semantic node types
    const layoutNodes = nodes.map(n => ({
      id: n.id,
      kind: (n.type || 'decision') as 'goal' | 'decision' | 'option' | 'risk' | 'outcome',
      width: n.width || 200,
      height: n.height || 80,
      locked: effectivePolicy.respectLocked && Boolean(n.data?.locked)
    }))
    
    const layoutEdges = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target
    }))
    
    // Apply semantic layout with full policy support
    const result = applyLayoutWithPolicy(
      layoutNodes,
      layoutEdges,
      {
        preset: policyToPreset(effectivePolicy),
        spacing: policyToSpacing(effectivePolicy),
        preserveSelection: false,
        minimizeCrossings: true
      },
      effectivePolicy
    )
    
    pushToHistory(get, set)
    
    const updatedNodes = nodes.map(node => {
      const newPos = result.positions[node.id]
      return newPos ? { ...node, position: newPos } : node
    })
    
    set({ nodes: updatedNodes })
  },

  resetCanvas: () => {
    const { nodes, edges } = get()
    if (nodes.length === 0 && edges.length === 0) return

    pushToHistory(get, set)
    set({
      nodes: [],
      edges: [],
      touchedNodeIds: new Set(),
      nextNodeId: 1,
      nextEdgeId: 1,
      showDraftChat: false,
    })
  },

  deleteEdge: (id) => {
    const { edges, selection } = get()
    const edge = edges.find(e => e.id === id)
    if (!edge) return

    pushToHistory(get, set)
    
    const newEdges = edges.filter(e => e.id !== id)
    const newEdgeIds = new Set(selection.edgeIds)
    newEdgeIds.delete(id)
    
    set({ 
      edges: newEdges,
      selection: { ...selection, edgeIds: newEdgeIds }
    })
  },

  updateEdgeEndpoints: (id, updates) => {
    const { edges, nodes } = get()
    const edge = edges.find(e => e.id === id)
    if (!edge) return

    const newSource = updates.source ?? edge.source
    const newTarget = updates.target ?? edge.target

    // Validate: no self-loops
    if (newSource === newTarget) {
      return // Caller should show toast: "That connection isn't allowed."
    }

    // Validate: no duplicates
    const duplicate = edges.find(e => 
      e.id !== id && e.source === newSource && e.target === newTarget
    )
    if (duplicate) {
      return // Caller should show toast: "A connector already exists between those nodes."
    }

    // Validate: nodes exist
    const sourceExists = nodes.some(n => n.id === newSource)
    const targetExists = nodes.some(n => n.id === newTarget)
    if (!sourceExists || !targetExists) {
      return
    }

    pushToHistory(get, set)

    const newEdges = edges.map(e => 
      e.id === id 
        ? { ...e, source: newSource, target: newTarget }
        : e
    )

    set({ 
      edges: newEdges,
      selection: { ...get().selection, edgeIds: new Set([id]) }
    })
  },

  beginReconnect: (edgeId, end) => {
    const { edges } = get()
    const edge = edges.find(e => e.id === edgeId)
    if (!edge) return

    set({ reconnecting: { edgeId, end } })
  },

  completeReconnect: (nodeId) => {
    const { reconnecting } = get()
    if (!reconnecting) return

    const { edgeId, end } = reconnecting
    const updates = end === 'source' 
      ? { source: nodeId }
      : { target: nodeId }

    get().updateEdgeEndpoints(edgeId, updates)
    set({ reconnecting: null })
  },

  cancelReconnect: () => {
    set({ reconnecting: null })
  },

  reset: () => {
    clearTimers()
    set({
      nodes: initialNodes,
      edges: initialEdges,
      history: { past: [], future: [] },
      selection: { nodeIds: new Set(), edgeIds: new Set() },
      nextNodeId: 1,
      nextEdgeId: 1,
      _internal: { lastHistoryHash: historyHash(initialNodes, initialEdges) },
      hasCompletedFirstRun: false,
      showDraftChat: false,
    })
  },

  setOutcomeNode: (nodeId) => {
    set({ outcomeNodeId: nodeId })
  },

  // Results actions
  resultsStart: ({ seed, wasForced }) => {
    set({
      results: {
        status: 'preparing',
        progress: 0,
        seed,
        wasForced,
        startedAt: Date.now(),
        error: undefined,
        report: undefined,
        hash: undefined,
        runId: undefined,
        finishedAt: undefined,
        drivers: undefined,
        isDuplicateRun: undefined
      }
    })
  },

  resultsConnecting: (runId) => {
    set(s => ({
      results: {
        ...s.results,
        status: 'connecting',
        runId,
        progress: Math.max(s.results.progress, 5)
      }
    }))
  },

  resultsProgress: (percent) => {
    set(s => ({
      results: {
        ...s.results,
        status: 'streaming',
        // Cap at 90% until complete event arrives
        progress: Math.min(percent, 90)
      }
    }))
  },

  resultsComplete: ({ report, hash, drivers, ceeReview, ceeTrace, ceeError }) => {
    const { nodes, edges, results, currentScenarioId } = get()

    const finishedAt = Date.now()
    const completedAtIso = new Date(finishedAt).toISOString()
    const seedString = results.seed != null ? String(results.seed) : null

    set(s => ({
      results: {
        ...s.results,
        status: 'complete',
        progress: 100,
        report,
        hash,
        drivers,
        finishedAt,
        error: undefined
      },
      currentScenarioLastResultHash: hash ?? null,
      currentScenarioLastRunAt: completedAtIso,
      currentScenarioLastRunSeed: seedString,
      hasCompletedFirstRun: true
    }))

    // Persist last run metadata onto the active scenario record (if any)
    if (currentScenarioId) {
      scenarios.updateScenario(currentScenarioId, {
        last_result_hash: hash,
        last_run_at: completedAtIso,
        last_run_seed: seedString || undefined
      })
    }

    // Save to run history
    if (report && results.seed !== undefined) {
      const graphHash = generateGraphHash(nodes, edges, results.seed)

      const graphSnapshot = JSON.parse(JSON.stringify({ nodes, edges })) as {
        nodes: typeof nodes
        edges: typeof edges
      }

      const storedRun: StoredRun = {
        id: results.runId || crypto.randomUUID(),
        ts: Date.now(),
        seed: results.seed,
        hash,
        adapter: 'auto', // TODO: Track actual adapter used
        summary: (report as any).summary || '',
        graphHash,
        report,
        drivers: drivers?.map(d => ({
          kind: d.kind,
          id: d.id,
          label: undefined // Backend should provide label if available
        })),
        graph: graphSnapshot, // v1.2: Store graph snapshot for computing deltas
        ceeReview: ceeReview ?? null,
        ceeTrace: ceeTrace ?? null,
        ceeError: ceeError ?? null
      }

      const isDuplicate = addRun(storedRun)

      // Store duplicate flag so UI can show appropriate toast
      set(s => ({
        results: {
          ...s.results,
          isDuplicateRun: isDuplicate
        }
      }))
    }
  },

  resultsError: ({ code, message, retryAfter }) => {
    set(s => ({
      results: {
        ...s.results,
        status: 'error',
        error: { code, message, retryAfter },
        finishedAt: Date.now()
      }
    }))
  },

  resultsCancelled: () => {
    set(s => ({
      results: {
        ...s.results,
        status: 'cancelled',
        finishedAt: Date.now()
      }
    }))
  },

  resultsLoadHistorical: (run: StoredRun) => {
    if (typeof window !== 'undefined') {
      try {
        const win = window as any
        win.__SAFE_DEBUG__ ||= { logs: [] }
        const debug = win.__SAFE_DEBUG__
        const logs = Array.isArray(debug.logs) ? debug.logs : null
        if (logs && logs.length < 1000) {
          logs.push({
            t: Date.now(),
            m: 'canvas:resultsLoadHistorical',
            data: {
              id: run.id,
              seed: run.seed,
              hash: run.hash,
            }
          })
        }
      } catch {}
    }

    set({
      results: {
        status: 'complete',
        progress: 100,
        runId: run.id,
        seed: run.seed,
        hash: run.hash,
        report: run.report,
        startedAt: run.ts,
        finishedAt: run.ts,
        drivers: run.drivers as any,
        error: undefined
      },
      runMeta: {
        diagnostics: undefined,
        correlationIdHeader: undefined,
        degraded: undefined,
        ceeReview: run.ceeReview ?? null,
        ceeTrace: run.ceeTrace ?? null,
        ceeError: run.ceeError ?? null
      },
      isDirty: false,
      hasCompletedFirstRun: true
    })
  },

  resultsReset: () => {
    set({
      results: {
        status: 'idle',
        progress: 0
      }
    })
  },

  setRunMeta: (meta: RunMetaState) => {
    set(s => ({
      runMeta: {
        ...s.runMeta,
        ...meta
      }
    }))
  },

  // Scenario actions
  loadScenario: (id: string) => {
    const scenario = scenarios.getScenario(id)
    if (!scenario) {
      console.warn('[Canvas] Scenario not found:', id)
      return false
    }

    const { nodes, edges: rawEdges } = scenario.graph

    // Upgrade persisted edges (generic Edge) to strongly-typed Edge<EdgeData>
    const edges: Edge<EdgeData>[] = rawEdges.map((edge) => ({
      ...edge,
      data: {
        ...DEFAULT_EDGE_DATA,
        ...(edge.data as Partial<EdgeData> | undefined ?? {}),
      },
    }))

    // Reseed IDs to avoid conflicts
    get().reseedIds(nodes, edges)

    set({
      nodes,
      edges,
      currentScenarioId: id,
      currentScenarioFraming: scenario.framing ?? null,
      currentScenarioLastResultHash: scenario.last_result_hash ?? null,
      currentScenarioLastRunAt: scenario.last_run_at ?? null,
      currentScenarioLastRunSeed: scenario.last_run_seed ?? null,
      isDirty: false,
      history: { past: [], future: [] },
      selection: { nodeIds: new Set(), edgeIds: new Set() },
      touchedNodeIds: new Set(),
      showDraftChat: false,
    })

    scenarios.setCurrentScenarioId(id)
    return true
  },

  saveCurrentScenario: (name?: string) => {
    const {
      nodes,
      edges,
      currentScenarioId,
      currentScenarioFraming,
      currentScenarioLastResultHash,
      currentScenarioLastRunAt,
      currentScenarioLastRunSeed,
    } = get()

    // P0-2: Set saving state
    set({ isSaving: true })

    try {
      if (currentScenarioId) {
        // Update existing scenario
        scenarios.updateScenario(currentScenarioId, {
          name,
          graph: { nodes, edges },
          framing: currentScenarioFraming || undefined,
          last_result_hash: currentScenarioLastResultHash || undefined,
          last_run_at: currentScenarioLastRunAt || undefined,
          last_run_seed: currentScenarioLastRunSeed || undefined,
        })
        set({
          isDirty: false,
          isSaving: false,
          lastSavedAt: Date.now()
        })
        return currentScenarioId
      } else {
        // Create new scenario
        if (!name) {
          console.warn('[Canvas] Cannot save scenario without a name')
          set({ isSaving: false })
          return null
        }

        const scenario = scenarios.createScenario({
          name,
          nodes,
          edges,
          framing: currentScenarioFraming || undefined,
          last_result_hash: currentScenarioLastResultHash || undefined,
          last_run_at: currentScenarioLastRunAt || undefined,
          last_run_seed: currentScenarioLastRunSeed || undefined,
        })

        set({
          currentScenarioId: scenario.id,
          isDirty: false,
          isSaving: false,
          lastSavedAt: Date.now()
        })

        return scenario.id
      }
    } catch (error) {
      set({ isSaving: false })
      throw error
    }
  },

  createScenarioFromTemplate: ({ templateId, templateVersion, name }) => {
    const { nodes, edges } = get()

    const scenario = scenarios.createScenario({
      name,
      nodes,
      edges,
      source_template_id: templateId,
      source_template_version: templateVersion
    })

    set({
      currentScenarioId: scenario.id,
      isDirty: false,
      showDraftChat: false,
    })

    return scenario.id
  },

  duplicateCurrentScenario: (newName?: string) => {
    const { currentScenarioId } = get()
    if (!currentScenarioId) {
      console.warn('[Canvas] No current scenario to duplicate')
      return null
    }

    const duplicate = scenarios.duplicateScenario(currentScenarioId, newName)
    if (!duplicate) return null

    // Load the duplicate
    get().loadScenario(duplicate.id)
    return duplicate.id
  },

  renameCurrentScenario: (name: string) => {
    const { currentScenarioId } = get()
    if (!currentScenarioId) {
      console.warn('[Canvas] No current scenario to rename')
      return
    }

    scenarios.renameScenario(currentScenarioId, name)
  },

  deleteScenario: (id: string) => {
    const { currentScenarioId } = get()

    scenarios.deleteScenario(id)

    // If we deleted the current scenario, clear the current ID
    if (currentScenarioId === id) {
      set({ currentScenarioId: null })
    }
  },

  markDirty: () => {
    set({ isDirty: true })
  },

  markClean: () => {
    set({ isDirty: false })
  },

  // Panel actions
  setShowResultsPanel: (show: boolean) => {
    const prev = get().showResultsPanel
    if (!prev && show) {
      trackResultsViewed()
    }
    set({ showResultsPanel: show })
    saveUIPreference('showResultsPanel', show)

    if (typeof window !== 'undefined') {
      try {
        const win = window as any
        win.__SAFE_DEBUG__ ||= { logs: [] }
        const debug = win.__SAFE_DEBUG__
        const logs = Array.isArray(debug.logs) ? debug.logs : null
        if (logs && logs.length < 1000) {
          logs.push({
            t: Date.now(),
            m: 'canvas:setShowResultsPanel',
            data: { prev, next: show }
          })
        }
      } catch {}
    }
  },

  setShowInspectorPanel: (show: boolean) => {
    set({ showInspectorPanel: show })
    saveUIPreference('showInspectorPanel', show)
  },

  openTemplatesPanel: (invoker?: HTMLElement) => {
    set({
      showTemplatesPanel: true,
      templatesPanelInvoker: invoker || null
    })
    saveUIPreference('showTemplatesPanel', true)
  },

  closeTemplatesPanel: () => {
    const { templatesPanelInvoker } = get()
    set({
      showTemplatesPanel: false,
      templatesPanelInvoker: null
    })
    saveUIPreference('showTemplatesPanel', false)

    // Restore focus to invoker after a brief delay (allows panel to unmount)
    if (templatesPanelInvoker && typeof templatesPanelInvoker.focus === 'function') {
      setTimeout(() => {
        try {
          templatesPanelInvoker.focus()
        } catch (err) {
          // Element may have been removed from DOM
        }
      }, 100)
    }
  },

  setShowDraftChat: (show: boolean) => {
    set({ showDraftChat: show })
    saveUIPreference('showDraftChat', show)
  },

  // M4: Graph Health actions
  validateGraph: async () => {
    const { nodes, edges } = get()

    // Dynamic import to avoid bundling validation if not used
    const { validateGraph: validate } = await import('./validation/graphValidator')
    const health = validate(nodes, edges)

    set({ graphHealth: health })
  },

  setShowIssuesPanel: (show: boolean) => {
    const prev = get().showIssuesPanel
    if (!prev && show) {
      trackIssuesOpened()
    }
    set({ showIssuesPanel: show })
    saveUIPreference('showIssuesPanel', show)
  },

  applyRepair: async (issueId: string) => {
    const { graphHealth, nodes, edges } = get()
    if (!graphHealth) return

    const issue = graphHealth.issues.find(i => i.id === issueId)
    if (!issue || !issue.suggestedFix) return

    // Push to history before repair
    pushToHistory(get, set)

    const { applyRepair: apply } = await import('./validation/graphRepair')
    const { nodes: repairedNodes, edges: repairedEdges } = apply(nodes, edges, issue.suggestedFix)

    const typedEdges: Edge<EdgeData>[] = repairedEdges.map(edge => ({
      ...edge,
      data: {
        ...DEFAULT_EDGE_DATA,
        ...(edge.data as Partial<EdgeData> | undefined ?? {}),
      },
    }))

    set({ nodes: repairedNodes, edges: typedEdges })

    // Re-validate after repair
    get().validateGraph()
  },

  applyAllRepairs: async () => {
    const { graphHealth, nodes, edges } = get()
    if (!graphHealth) return

    const fixableIssues = graphHealth.issues.filter(i => i.suggestedFix)
    if (fixableIssues.length === 0) return

    // Push to history before repairs
    pushToHistory(get, set)

    const { quickFixAll } = await import('./validation/graphRepair')
    const { nodes: repairedNodes, edges: repairedEdges } = quickFixAll(nodes, edges, graphHealth.issues)

    const typedEdges: Edge<EdgeData>[] = repairedEdges.map(edge => ({
      ...edge,
      data: {
        ...DEFAULT_EDGE_DATA,
        ...(edge.data as Partial<EdgeData> | undefined ?? {}),
      },
    }))

    set({ nodes: repairedNodes, edges: typedEdges })

    // Re-validate after repairs
    get().validateGraph()
  },

  setNeedleMovers: (movers: NeedleMover[]) => {
    set({ needleMovers: movers })
  },

  // Phase 3: Interaction actions (accepts array, stores as Set for O(1) lookup)
  setHighlightedNodes: (ids: string[]) => {
    set({ highlightedNodes: new Set(ids) })
  },

  // M5: Provenance actions
  addDocument: (document) => {
    // P0: Document memory guard - reject files >1MB
    const MAX_FILE_SIZE = 1 * 1024 * 1024 // 1MB
    const MAX_CHAR_PER_FILE = 5000 // 5k chars
    const MAX_TOTAL_CHARS = 25000 // 25k total

    if (document.size && document.size > MAX_FILE_SIZE) {
      throw new Error('This file is too large for in-app preview. Please reduce its size.')
    }

    // Calculate current total stored chars
    const { documents } = get()
    const currentTotal = documents.reduce((sum, doc) =>
      sum + (doc.displayBytes || 0), 0)

    // Truncate content if needed
    let content = document.content || ''
    let truncated = false
    if (content.length > MAX_CHAR_PER_FILE) {
      content = content.slice(0, MAX_CHAR_PER_FILE) + '…'
      truncated = true
    }

    const displayBytes = content.length

    // Check total cap
    if (currentTotal + displayBytes > MAX_TOTAL_CHARS) {
      throw new Error(`Document storage limit reached (${MAX_TOTAL_CHARS} chars). Remove existing documents to add new ones.`)
    }

    // Generate checksum for integrity (FNV-1a hash)
    const checksum = document.content
      ? generateContentHash(document.content)
      : undefined

    const id = crypto.randomUUID()
    const newDoc: Document = {
      ...document,
      id,
      content, // Truncated text only
      uploadedAt: new Date(),
      displayBytes,
      truncated,
      checksum
    }
    set(s => ({ documents: [...s.documents, newDoc] }))
    return id
  },

  removeDocument: (id) => {
    set(s => ({
      documents: s.documents.filter(d => d.id !== id),
      citations: s.citations.filter(c => c.documentId !== id)
    }))
  },

  // S7-FILEOPS: Rename document with undo/redo and event emission
  renameDocument: (id, newName) => {
    const { documents } = get()
    const doc = documents.find(d => d.id === id)
    if (!doc) return

    const oldName = doc.name
    const trimmed = newName.trim()

    // Update document name
    set(s => ({
      documents: s.documents.map(d =>
        d.id === id ? { ...d, name: trimmed } : d
      )
    }))

    // Emit rename event for provenance chip sync
    docsTest.emitDocumentRenamed(id, oldName, trimmed)

    // Push to history for undo/redo
    get().pushHistory()
  },

  // S7-FILEOPS: Set document search query with session persistence
  setDocumentSearchQuery: (query) => {
    set({ documentSearchQuery: query })
    saveSearchQuery(query)
  },

  // S7-FILEOPS: Set document sort with session persistence
  setDocumentSort: (field, direction) => {
    set({ documentSortField: field, documentSortDirection: direction })
    saveSortPreferences(field, direction)
  },

  addCitation: (citation) => {
    const id = crypto.randomUUID()
    const newCitation: Citation = {
      ...citation,
      id,
      createdAt: new Date()
    }
    set(s => ({ citations: [...s.citations, newCitation] }))
  },

  setShowProvenanceHub: (show: boolean) => {
    set({ showProvenanceHub: show })
    saveUIPreference('showProvenanceHub', show)
  },

  setShowDocumentsDrawer: (show: boolean) => {
    set({ showDocumentsDrawer: show })
    saveUIPreference('showDocumentsDrawer', show)
  },

  toggleProvenanceRedaction: () => {
    set(s => ({ provenanceRedactionEnabled: !s.provenanceRedactionEnabled }))
  },

  // M6: Compare & Snapshots actions
  setSelectedSnapshotsForComparison: (snapshotIds: string[]) => {
    // De-duplicate: Keep most recent two unique IDs, maintain order
    const unique = Array.from(new Set(snapshotIds))
    const capped = unique.slice(-2) // Most recent two

    // Ignore no-op re-selects (same IDs in same order)
    const current = get().selectedSnapshotsForComparison
    if (capped.length === current.length &&
        capped.every((id, i) => id === current[i])) {
      return // No-op
    }

    set({ selectedSnapshotsForComparison: capped })
  },

  setShowComparePanel: (show: boolean) => {
    set({ showComparePanel: show })
    saveUIPreference('showComparePanel', show)
  },

  setDecisionRationale: (rationale: DecisionRationale | null) => {
    set({ currentDecisionRationale: rationale })
  },

  exportLocal: () => {
    const { nodes, edges, results, currentDecisionRationale } = get()

    const exportData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      graph: { nodes, edges },
      lastRun: results.report ? {
        summary: results.report.summary,
        p10: results.report.p10,
        p50: results.report.p50,
        p90: results.report.p90,
        seed: results.seed,
        hash: results.hash
      } : null,
      rationale: currentDecisionRationale,
      note: 'Local export — openable on this device/profile only.'
    }

    return JSON.stringify(exportData, null, 2)
  },

  // P2: Hydration hygiene - merge only graph/scenario bits, ignore unknown keys
  hydrateGraphSlice: (loaded) => {
    const updates: Partial<CanvasState> = {}

    // Only merge known graph/scenario keys
    if (loaded.nodes !== undefined) {
      updates.nodes = loaded.nodes
    }
    if (loaded.edges !== undefined) {
      updates.edges = loaded.edges
    }
    if (loaded.currentScenarioId !== undefined) {
      updates.currentScenarioId = loaded.currentScenarioId
    }

    // Reset history and selection for clean state
    if (loaded.nodes || loaded.edges) {
      updates.history = { past: [], future: [] }
      updates.selection = { nodeIds: new Set(), edgeIds: new Set() }
      updates.touchedNodeIds = new Set()
    }

    // Apply updates without clobbering panels/results/other slices
    set(updates)

    // Reseed IDs to prevent collisions
    if (loaded.nodes && loaded.edges) {
      get().reseedIds(loaded.nodes, loaded.edges)
    }
  },

  cleanup: clearTimers,

  updateScenarioFraming: (partial) => {
    set(s => ({
      currentScenarioFraming: {
        ...(s.currentScenarioFraming ?? {}),
        ...partial,
      },
      isDirty: true,
    }))
  }
}))

// Expose store on window for E2E tests (Playwright helpers and direct injection)
if (typeof window !== 'undefined') {
  ;(window as any).useCanvasStore = useCanvasStore
}

/**
 * Validation selectors and helpers
 */

// Re-export InvalidNodeInfo type for compatibility
export type InvalidNode = InvalidNodeInfo

/**
 * Get all nodes with invalid outgoing probability sums
 * A node is invalid if it has 2+ non-zero outgoing edges and probabilities don't sum to 100% (±1%)
 * Uses shared validation util with touched node tracking to avoid flagging pristine nodes
 */
export const getInvalidNodes = (state: CanvasState): InvalidNode[] => {
  return getInvalidNodesUtil(state.nodes, state.edges, state.touchedNodeIds)
}

/**
 * Check if the canvas has any validation errors
 */
export const hasValidationErrors = (state: CanvasState): boolean => {
  return getInvalidNodes(state).length > 0
}

/**
 * Get the next invalid node (for Alt+V cycling)
 * If currentNodeId is provided, returns the next invalid node after it
 * Otherwise returns the first invalid node
 */
export const getNextInvalidNode = (state: CanvasState, currentNodeId?: string): InvalidNode | null => {
  return getNextInvalidNodeUtil(state.nodes, state.edges, state.touchedNodeIds, currentNodeId)
}

/**
 * Results panel selectors
 */
export const selectResultsStatus = (state: CanvasState): ResultsStatus => state.results.status
export const selectProgress = (state: CanvasState): number => state.results.progress
export const selectReport = (state: CanvasState): ReportV1 | null | undefined => state.results.report
export const selectDrivers = (state: CanvasState): Array<{ kind: 'node' | 'edge'; id: string }> | undefined => state.results.drivers
export const selectError = (state: CanvasState): { code: string; message: string; retryAfter?: number } | null | undefined => state.results.error
export const selectRunId = (state: CanvasState): string | undefined => state.results.runId
export const selectSeed = (state: CanvasState): number | undefined => state.results.seed
export const selectHash = (state: CanvasState): string | undefined => state.results.hash
