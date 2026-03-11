import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronUp, Paperclip, Settings, Sparkles, X } from 'lucide-react'
import { useCEEDraft } from '../../hooks/useCEEDraft'
import { DraftLoadingAnimation } from './DraftLoadingAnimation'
import { ErrorAlert } from '../../components/ErrorAlert'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { CEEError } from '../../adapters/cee/client'
import { DraftGuidancePanel } from './DraftGuidancePanel'
import { RateLimitNotice } from './RateLimitNotice'
import { ThinkingModePopover } from './ThinkingModePopover'
import { DEFAULT_EDGE_DATA, trimProvenance } from '../domain/edges'
import { saveAutosave } from '../store/scenarios'
import { hasAnalysisReady, isCeePipelineTrace } from '../../adapters/cee/types'
import type { CEEDraftResponse, CEEv2Response, EffectDirection } from '../../adapters/cee/types'
import { validateBrief } from '../utils/briefValidation'
import { formatCEEError } from '../utils/formatCEEError'
import { EXAMPLE_BRIEF_CHIPS } from '../../constants/validation'
import { ConversationPanel } from '../conversation/ConversationPanel'
import { useConversation } from '../conversation/useConversation'
import { useGraphEditEvents } from '../conversation/useGraphEditEvents'
import { useAnalysisCompleteEvent } from '../conversation/useAnalysisCompleteEvent'
// useSessionResumeEvent disabled — session_resume not in CEE v3 schema
// import { useSessionResumeEvent } from '../conversation/useSessionResumeEvent'

// Storage keys for panel dimension persistence
const DRAFT_PANEL_WIDTH_KEY = 'canvas.draftChat.width'
const DRAFT_PANEL_HEIGHT_KEY = 'canvas.draftChat.height'

/** Read orchestrator flag directly from env + localStorage.
 *  The makeFlag factory uses dynamic key access (`env?.[envKey]`) which Vite
 *  may not resolve in dev mode. This direct-read fallback guarantees the flag
 *  is available regardless of Vite's transform behaviour. */
function useOrchestratorV2Flag(): boolean {
  // localStorage override (same precedence as makeFlag)
  try {
    const ls = localStorage.getItem('feature.orchestratorV2')
    if (ls != null) return !(ls === '0' || ls === 'false')
  } catch {}
  // Direct env access with literal key — Vite can resolve this
  const env = import.meta.env.VITE_ENABLE_ORCHESTRATOR_V2
  return env === 'true' || env === '1' || env === true
}

export function DraftChat() {
  const isOrchV2 = useOrchestratorV2Flag()

  // Initialize description from stored value to maintain context across panel close/reopen
  const lastDraftDescription = useCanvasStore(s => s.lastDraftDescription)
  const [description, setDescription] = useState(lastDraftDescription || '')
  const [showSettingsPopover, setShowSettingsPopover] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const initialHasGraph = useCanvasStore.getState().nodes.length > 0 || useCanvasStore.getState().edges.length > 0
  const [isMinimized, setIsMinimized] = useState(initialHasGraph)

  // Panel width state (persisted to localStorage)
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(DRAFT_PANEL_WIDTH_KEY)
      if (stored) {
        const parsed = parseInt(stored, 10)
        if (Number.isFinite(parsed) && parsed >= 320 && parsed <= 1014) {
          return parsed
        }
      }
    }
    return 676 // default width (30% increase from 520)
  })

  // Panel height state (persisted to localStorage, clamped to 20vh – 90vh)
  const DEFAULT_PANEL_HEIGHT = 864
  // Compact height = 20% of viewport height (recalculated at runtime so it
  // adapts to the actual browser window size)
  const COMPACT_HEIGHT = typeof window !== 'undefined' ? Math.floor(window.innerHeight * 0.2) : 160
  const [panelHeight, setPanelHeight] = useState<number>(() => {
    const minH = typeof window !== 'undefined' ? Math.floor(window.innerHeight * 0.2) : 160
    const maxH = typeof window !== 'undefined' ? Math.floor(window.innerHeight * 0.9) : 864
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(DRAFT_PANEL_HEIGHT_KEY)
      if (stored) {
        const parsed = parseInt(stored, 10)
        if (Number.isFinite(parsed)) {
          return Math.max(minH, Math.min(maxH, parsed))
        }
      }
    }
    return Math.min(DEFAULT_PANEL_HEIGHT, maxH)
  })

  // Task 2: Track whether user has manually resized this session.
  // When false, auto-collapse to compact height after first full_draft graph generation.
  const userHasResizedRef = useRef(false)

  // Track dock offset for dynamic positioning (avoid results panel overlap)
  const [dockOffset, setDockOffset] = useState(0)

  const {
    data: draft,
    loading,
    error,
    draft: generateDraft,
    guidance,
    retryAfterSeconds,
  } = useCEEDraft()
  // React #185 FIX: Use individual selectors instead of destructuring from useCanvasStore()
  const showDraftChat = useCanvasStore(s => s.showDraftChat)
  const setShowDraftChat = useCanvasStore(s => s.setShowDraftChat)
  const setLastDraftDescription = useCanvasStore(s => s.setLastDraftDescription)
  const pushHistory = useCanvasStore(s => s.pushHistory)
  const applyLayout = useCanvasStore(s => s.applyLayout)
  const setPendingFitView = useCanvasStore(s => s.setPendingFitView)
  const resetCanvas = useCanvasStore(s => s.resetCanvas)
  const captureErrorDetail = useCanvasStore(s => s.captureErrorDetail)
  const nodeCount = useCanvasStore(s => s.nodes.length)
  const edgeCount = useCanvasStore(s => s.edges.length)
  const hasGraph = nodeCount > 0 || edgeCount > 0
  // Task 2: Watch for full_draft signal (set by useConversation when ≥3 nodes added at once)
  const fullDraftAppliedAt = useCanvasStore(s => s.fullDraftAppliedAt)


  // A.5+ Conversation mode (feature-flagged)
  const conversation = useConversation()

  // A.5+ Phase 2: Wire system event hooks (all no-ops when flag is OFF)
  useGraphEditEvents(conversation.sendSystemEvent)
  useAnalysisCompleteEvent(conversation.sendSystemEvent)
  // session_resume is not in CEE v3 schema (CEE_V3_KNOWN_TYPES) — disabled
  // until CEE adds support. Re-enable when session_resume is accepted by CEE.
  // useSessionResumeEvent(conversation.sendSystemEvent, conversation.messages)

  // Brief validation
  const [, setIsInputFocused] = useState(false)
  const briefValidation = validateBrief(description)
  const canSubmit = briefValidation.isValid && !loading && !conversation.isThinking

  // Auto-resize textarea based on content
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto'
    // Set to scrollHeight, capped at max height
    const maxHeight = 300
    const newHeight = Math.min(textarea.scrollHeight, maxHeight)
    textarea.style.height = `${newHeight}px`
  }, [])

  useEffect(() => {
    adjustTextareaHeight()
  }, [description, adjustTextareaHeight])

  // Keep minimized state in sync with graph removal (expand when canvas is cleared)
  useEffect(() => {
    if (!showDraftChat) return
    if (nodeCount === 0 && edgeCount === 0) {
      setIsMinimized(false)
    }
  }, [showDraftChat, nodeCount, edgeCount])

  // Task 2: Auto-collapse to compact height after first full_draft graph generation.
  // Fires when useConversation signals a full_draft patch (≥3 nodes added at once),
  // not on every incremental 0→>0 node transition.
  const prevFullDraftAppliedAtRef = useRef(fullDraftAppliedAt)
  useEffect(() => {
    const prev = prevFullDraftAppliedAtRef.current
    prevFullDraftAppliedAtRef.current = fullDraftAppliedAt
    if (!showDraftChat || !isOrchV2) return
    // Only fire when fullDraftAppliedAt changes to a new (non-null) value
    if (fullDraftAppliedAt !== null && fullDraftAppliedAt !== prev && !userHasResizedRef.current && !isMinimized) {
      setPanelHeight(COMPACT_HEIGHT)
      try {
        localStorage.setItem(DRAFT_PANEL_HEIGHT_KEY, String(COMPACT_HEIGHT))
      } catch {}
      if (import.meta.env.DEV) {
        console.warn('[DraftChat] Auto-collapsed to compact height after full_draft graph generation')
      }
    }
  }, [fullDraftAppliedAt, showDraftChat, isOrchV2, isMinimized])

  // Auto-resize expanded textarea when switching from minimized mode with content
  useEffect(() => {
    if (!isMinimized && textareaRef.current && description) {
      // Small delay to ensure DOM is ready after state change
      requestAnimationFrame(() => {
        const textarea = textareaRef.current
        if (textarea) {
          textarea.style.height = 'auto'
          const maxHeight = window.innerHeight * 0.75
          const newHeight = Math.min(textarea.scrollHeight, maxHeight)
          textarea.style.height = `${newHeight}px`
          textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
        }
      })
    }
  }, [isMinimized, description])

  // Handle file attachment
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      setAttachedFiles(prev => [...prev, ...Array.from(files)])
    }
    // Reset input so same file can be selected again
    event.target.value = ''
  }, [])

  const removeFile = useCallback((index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleDraft = async () => {
    if (!validateBrief(description).isValid) return

    // If there is already a graph on the canvas, confirm before clearing it
    const { nodes, edges } = useCanvasStore.getState()
    const hasExistingGraph = (nodes?.length ?? 0) > 0 || (edges?.length ?? 0) > 0

    if (hasExistingGraph) {
      const confirmed = window.confirm(
        'Drafting a new decision will clear your current decision model from the canvas. Start a new draft?'
      )

      if (!confirmed) {
        return
      }

      // resetCanvas also closes the Draft panel; immediately reopen it so the
      // user stays in the drafting flow while we generate the new model.
      resetCanvas()
      setShowDraftChat(true)
    }

    // A.5+: When orchestrator V2 is enabled, route initial brief through the
    // orchestrator conversation path (POST /orchestrate/v1/turn) instead of
    // the legacy /bff/cee/draft-graph endpoint.
    if (isOrchV2) {
      console.info('[handleDraft] orchestrator V2 path — routing brief to /orchestrate/v1/turn')
      setLastDraftDescription(description)
      const briefText = description
      setDescription('')
      // Keep panel expanded so the user sees the conversation response and
      // can interact with graph_patch blocks (Accept/Dismiss).
      await conversation.sendMessage(briefText)
      return
    }
    console.info('[handleDraft] legacy path — routing brief to /bff/cee/draft-graph')

    try {
      // Store description for persistence across panel close/reopen
      setLastDraftDescription(description)

      const result = await generateDraft(description)
      // Auto-apply the draft to canvas immediately
      if (result?.nodes?.length) {
        applyDraftToCanvas(result)
        setIsMinimized(true)
        // Clear UI input state (brief stays in store for /v2/run)
        setDescription('')
        // Clear any previous draft error on success
        useCanvasStore.getState().setLastDraftError(null)
      }
    } catch (err) {
      console.error('Draft failed:', err)

      // Store draft error for pre-analysis panel visibility
      const draftError: { message: string; status?: number; correlationId?: string; timestamp: number; retryable?: boolean } = {
        message: err instanceof Error ? err.message : 'Draft failed',
        timestamp: Date.now(),
      }
      if (err instanceof CEEError) {
        draftError.status = err.status
        draftError.correlationId = err.correlationId ?? undefined
        // Extract retryable from CEE response body, fallback to HTTP status heuristic
        const details = err.details as any
        const ceeRetryable = details?.cee_response?.retryable ?? details?.retryable
        draftError.retryable = typeof ceeRetryable === 'boolean'
          ? ceeRetryable
          : (err.status === 429 || err.status >= 500)
      }
      useCanvasStore.getState().setLastDraftError(draftError)

      // Capture error detail for debug drawer expansion
      if (err instanceof CEEError) {
        const details = err.details as any
        captureErrorDetail({
          timestamp: new Date().toISOString(),
          service: 'CEE',
          httpStatus: err.status,
          errorCode: details?.code ?? details?.details?.code,
          message: err.message,
          requestId: err.correlationId ?? details?.trace?.request_id,
          endpoint: '/draft-graph',
          retryable: draftError.retryable ?? (err.status === 429 || err.status >= 500),
          rawBody: err.details ? JSON.stringify(err.details).slice(0, 2000) : undefined,
        })
      } else if (err instanceof Error) {
        captureErrorDetail({
          timestamp: new Date().toISOString(),
          service: 'CEE',
          message: err.message,
          endpoint: '/draft-graph',
          retryable: false,
        })
      }

      // Extract pipeline trace from error responses (CEE includes trace.pipeline in 400/500s)
      // Check multiple possible locations since error response structure may vary
      if (err instanceof CEEError) {
        const details = err.details as any
        // Check possible trace locations in order of likelihood:
        // 1. details.error.details.trace.pipeline (wrapped error response from proxy)
        // 2. details.trace.pipeline (standard CEE error response)
        // 3. details.cee_response.trace.pipeline (cee_response wrapper)
        // 4. details.details.trace.pipeline (nested details wrapper)
        // 5. details.pipeline_trace (alternative location)
        // 6. details.pipeline (direct pipeline)
        const pipelineTrace =
          details?.error?.details?.trace?.pipeline ??
          details?.trace?.pipeline ??
          details?.cee_response?.trace?.pipeline ??
          details?.details?.trace?.pipeline ??
          details?.pipeline_trace ??
          details?.pipeline

        if (isCeePipelineTrace(pipelineTrace)) {
          const { setCeePipelineTrace } = useCanvasStore.getState()
          setCeePipelineTrace(pipelineTrace)
          if (import.meta.env.DEV) {
            console.warn('[DraftChat] Extracted pipeline trace from error response:', {
              stages: pipelineTrace.stages?.length,
              status: pipelineTrace.status,
              httpStatus: err.status,
            })
          }
        } else if (import.meta.env.DEV) {
          // Log what we found to help debug extraction issues
          console.warn('[DraftChat] No pipeline trace in error response:', {
            httpStatus: err.status,
            detailsKeys: details ? Object.keys(details) : [],
            hasTrace: !!details?.trace,
            traceKeys: details?.trace ? Object.keys(details.trace) : [],
            hasPipeline: !!details?.trace?.pipeline,
          })
        }
      }
    }
  }

  // Apply draft to canvas and return the IDs of added nodes/edges
  const applyDraftToCanvas = useCallback((draftData: CEEDraftResponse | CEEv2Response | null) => {
    // Capture pre-draft snapshot for undo-draft capability (A.5+)
    const store = useCanvasStore.getState()
    store.setDraftChatPreDraftSnapshot({
      nodes: store.nodes,
      edges: store.edges,
    })

    // Check both locations: root level or nested under graph
    const rawNodes = draftData?.nodes ?? (draftData as any)?.graph?.nodes ?? []
    const rawEdgesForCheck = draftData?.edges ?? (draftData as any)?.graph?.edges ?? []

    // Null-safe: bail out if draft or nodes are missing
    if (!rawNodes.length) return { nodeIds: [], edgeIds: [] }

    // P0 DIAGNOSTIC: Log CEE response structure for debugging analysis_ready flow
    if (import.meta.env.DEV) {
      console.warn('[DraftChat] === CEE RESPONSE DIAGNOSTIC ===')
      console.warn('[DraftChat] Response keys:', Object.keys(draftData || {}))
      console.warn('[DraftChat] Has analysis_ready key:', 'analysis_ready' in (draftData || {}))
      console.warn('[DraftChat] analysis_ready value:', (draftData as any)?.analysis_ready)
      console.warn('[DraftChat] hasAnalysisReady() result:', hasAnalysisReady(draftData))
      console.warn('[DraftChat] Nodes location:', draftData?.nodes ? 'root' : (draftData as any)?.graph?.nodes ? 'graph.nodes' : 'none')
      console.warn('[DraftChat] Edges location:', draftData?.edges ? 'root' : (draftData as any)?.graph?.edges ? 'graph.edges' : 'none')

      // P0 INVESTIGATION: Log edge structure received by DraftChat
      const firstEdge = rawEdgesForCheck[0]
      console.warn('[DraftChat] === EDGE STRUCTURE AT DRAFTCHAT ===')
      console.warn('[DraftChat] edges array length:', rawEdgesForCheck.length)
      if (firstEdge) {
        console.warn('[DraftChat] First edge ALL KEYS:', Object.keys(firstEdge))
        console.warn('[DraftChat] First edge RAW:', JSON.stringify(firstEdge, null, 2))
        console.warn('[DraftChat] First edge field check:', {
          'weight (direct)': firstEdge.weight,
          'strength_mean (direct)': firstEdge.strength_mean,
          'strength.mean (nested)': firstEdge.strength?.mean,
          'effect_direction': firstEdge.effect_direction,
          'belief': firstEdge.belief,
        })
      } else {
        console.warn('[DraftChat] No edges received - checked both draftData.edges and draftData.graph.edges')
      }
      console.warn('[DraftChat] === END EDGE INVESTIGATION ===')

      // Detailed type guard checks
      const ar = (draftData as any).analysis_ready
      if (ar) {
        console.warn('[DraftChat] analysis_ready.options:', ar.options)
        console.warn('[DraftChat] analysis_ready.options is array:', Array.isArray(ar.options))
        console.warn('[DraftChat] analysis_ready.options.length:', ar.options?.length)
        console.warn('[DraftChat] analysis_ready.goal_node_id:', ar.goal_node_id)
        console.warn('[DraftChat] goal_node_id is string:', typeof ar.goal_node_id === 'string')

        // Detailed intervention logging for debugging empty interventions issue
        ar.options?.forEach((opt: any, i: number) => {
          console.warn(`[DraftChat] Option ${i} "${opt.label}":`, {
            id: opt.id,
            status: opt.status,
            interventionKeys: Object.keys(opt.interventions || {}),
            interventions: opt.interventions,
          })
        })
      }
      console.warn('[DraftChat] === END DIAGNOSTIC ===')
    }

    // Convert CEE nodes to canvas nodes
    // Note: n.type contains the node kind ("goal", "outcome", "factor", etc.)
    // from adaptDraftResponse() which maps kind → type
    // Use rawNodes which checks both draftData.nodes and draftData.graph.nodes
    // Naming convention: CEE returns snake_case (observed_state, goal_threshold_raw, etc.).
    // Canvas nodes store camelCase (observedState) for React Flow convention.
    // The V2 adapter's extractObservedState() converts back to snake_case for PLoT.
    const nodes = rawNodes.map((n: any) => {
      // Destructure fields handled structurally; spread the rest into data
      // so V3 fields (goal_threshold_*, prior, category, etc.) are preserved.
      const { id, kind, type: nodeType, label, observed_state, ...rest } = n
      return {
        id,
        type: kind || nodeType, // CEE uses 'kind', React Flow needs 'type'
        position: { x: 0, y: 0 }, // Layout algorithm will position
        data: {
          ...rest,                              // V3 pass-through: goal_threshold_*, prior, etc.
          label,
          // P0: Copy kind to data.kind for GoalNodeSelector and other components
          // that check n.data.kind (n.type contains the kind value from CEE)
          kind: kind || nodeType,
          // observed_state (snake_case from CEE) → observedState (camelCase for canvas)
          ...(observed_state ? { observedState: observed_state } : {}),
        },
      }
    })

    // Check both locations: draftData.edges (v2/v3 root) or draftData.graph.edges (nested)
    const rawEdges = draftData?.edges ?? (draftData as any)?.graph?.edges ?? []
    const edges = rawEdges.map((e: any, i: number) => {
      const id = typeof e.id === 'string' && e.id.trim().length > 0 ? e.id : `e-${i}`

      // Destructure known structural fields; spread the rest so unknown/additive
      // CEE edge fields (e.g. edge_type, label, future CIL additions) are preserved.
      const {
        id: _id, from: _from, to: _to,
        weight: _weight, strength: _strength,
        strength_mean: _strengthMean, strength_std: _strengthStd,
        effect_direction: _effectDir,
        belief: _belief, belief_exists: _beliefExists,
        provenance: _provenance, provenance_source: _provSource,
        // CIL 0.2: strip canvas-internal keys from CEE passthrough to
        //          prevent collision with DEFAULT_EDGE_DATA values
        style: _style, curvature: _curvature, kind: _kind,
        functionType: _funcType, beliefStrength: _beliefStr,
        schemaVersion: _schemaVer,
        ...edgeRest
      } = e as Record<string, unknown>

      // Extract edge properties first (needed for signed weight calculation)
      const directionFromEdge: EffectDirection | undefined =
        e.effect_direction === 'positive' || e.effect_direction === 'negative'
          ? e.effect_direction
          : undefined

      // CEE v3 returns strength as nested object: { mean, std }
      // Also support flat strength_std for backwards compatibility
      const strengthStd: number | undefined =
        typeof e.strength?.std === 'number' ? e.strength.std :
        typeof e.strength_std === 'number' ? e.strength_std :
        undefined

      // Priority: strength.mean (CEE v3 nested) > strength_mean (flat) > weight (legacy) > default
      // CEE v3 returns edges with `strength: { mean, std }` structure
      // UI convention: default strength.mean is 0.5 for display when CEE/LLM provides no value.
      // This is the UI's responsibility — CEE and PLoT do not default strengths.
      let rawWeight: number
      let weightSource: string
      if (typeof e.strength?.mean === 'number') {
        rawWeight = e.strength.mean
        weightSource = 'strength.mean'
      } else if (typeof e.strength_mean === 'number') {
        rawWeight = e.strength_mean
        weightSource = 'strength_mean'
      } else if (typeof e.weight === 'number') {
        rawWeight = e.weight
        weightSource = 'weight'
      } else {
        rawWeight = DEFAULT_EDGE_DATA.weight  // 0.5
        weightSource = 'default'
      }

      // Infer direction when missing to preserve sign (negative mean -> negative direction)
      const direction: EffectDirection = directionFromEdge ?? (rawWeight < 0 ? 'negative' : 'positive')

      if (import.meta.env.DEV && directionFromEdge === undefined) {
        console.warn('[DraftChat] Inferred edge direction from signed mean', {
          from: e.from,
          to: e.to,
          rawWeight,
          weightSource,
          inferredDirection: direction,
        })
      }

      // Clamp to valid range (0-2 for magnitude)
      // Store unsigned magnitude in weight - ISL adapter applies sign from direction
      const weight = Math.max(0, Math.min(2, Math.abs(rawWeight)))

      // Diagnostic logging for edge coefficients
      if (import.meta.env.DEV) {
        // Calculate what ISL will compute for verification
        const islSign = direction === 'negative' ? -1 : 1
        const islSignedWeight = islSign * weight
        console.warn('[DraftChat] Edge coefficient:', {
          from: e.from,
          to: e.to,
          'strength (nested)': e.strength, // CEE v3 nested object
          'strength.mean': e.strength?.mean,
          'strength.std': e.strength?.std,
          strength_mean: e.strength_mean, // Flat fallback
          cee_weight: e.weight, // Legacy field
          effect_direction: direction,
          weightSource,
          storedWeight: weight,
          strengthStd,
          islSignedWeight, // What ISL will compute
        })
      }

      const confidence =
        typeof e.belief === 'number' ? Math.max(0, Math.min(1, e.belief)) : undefined

      // P0 Fix: Extract belief_exists / exists_probability (structural certainty) separately from belief (parametric certainty)
      // CEE may use either field name: belief_exists or exists_probability
      const beliefExistsRaw = typeof e.belief_exists === 'number'
        ? e.belief_exists
        : typeof e.exists_probability === 'number'
          ? e.exists_probability
          : undefined
      const beliefExistsValue =
        beliefExistsRaw !== undefined ? Math.max(0, Math.min(1, beliefExistsRaw)) : undefined

      // Diagnostic logging for edge uncertainty data flow
      if (import.meta.env.DEV) {
        const canvasBelief = beliefExistsValue ?? confidence
        console.warn('[DraftChat] Edge uncertainty from CEE:', {
          edge: `${e.from} → ${e.to}`,
          cee_belief_exists: e.belief_exists,
          cee_belief: e.belief,
          cee_strength_std: e.strength_std ?? e.strength?.std,
          extracted_beliefExistsValue: beliefExistsValue,
          extracted_confidence: confidence,
          extracted_strengthStd: strengthStd,
          canvas_beliefExists: canvasBelief,
          canvas_strengthStd: strengthStd,
          DEFAULT_beliefExists: 0.7, // For reference
        })
      }

      let provenanceText: string | undefined
      if (typeof e.provenance === 'string' && e.provenance.trim().length > 0) {
        provenanceText = trimProvenance(e.provenance)
      } else if (e.provenance && typeof e.provenance === 'object') {
        const source = e.provenance.source ?? ''
        const quote = e.provenance.quote ?? ''
        const location = e.provenance.location ?? ''
        const combined = [source, quote, location].filter(Boolean).join(' • ')
        if (combined) {
          provenanceText = trimProvenance(combined)
        }
      }

      return {
        id,
        source: e.from,
        target: e.to,
        type: 'styled' as const,
        data: {
          ...DEFAULT_EDGE_DATA,
          ...edgeRest,                             // spread-first: preserve unknown CEE edge fields
          weight,
          pathType: 'bezier' as const,
          confidence,
          // P0 Fix: Use belief_exists (structural certainty) for beliefExists, fallback to belief (confidence)
          beliefExists: beliefExistsValue ?? confidence,
          provenance: provenanceText,
          // Brief v2.2: New edge properties
          ...(direction ? { direction } : {}),
          ...(strengthStd !== undefined ? { strengthStd } : {}),
        },
      }
    })

    // Push current state to history, then append nodes/edges in a single transaction
    pushHistory()
    const state = useCanvasStore.getState()
    useCanvasStore.setState({
      nodes: [...state.nodes, ...nodes],
      edges: [...state.edges, ...edges],
    })
    // Always apply layout for AI drafts since all nodes start at (0,0)
    // This ensures proper positioning whether starting fresh or replacing an existing graph
    if (import.meta.env.DEV) {
      console.warn('[DraftChat] Applying ELK layout after draft insertion', {
        addedNodes: nodes.length,
        addedEdges: edges.length,
        totalNodes: useCanvasStore.getState().nodes.length,
        totalEdges: useCanvasStore.getState().edges.length,
      })
    }
    void applyLayout()
      .then(() => {
        setPendingFitView(true)
      })
      .catch((error) => {
        console.error('[DraftChat] Layout failed after applying draft', error)
      })

    // IMMEDIATE AUTOSAVE: Save right away so graph survives refresh before 30s interval
    // This eliminates the vulnerability window where AI drafts could be lost
    try {
      const currentState = useCanvasStore.getState()
      saveAutosave({
        timestamp: Date.now(),
        scenarioId: currentState.currentScenarioId || undefined,
        nodes: currentState.nodes,
        edges: currentState.edges,
      })
      if (import.meta.env.DEV) {
        console.warn('[DraftChat] Immediate autosave after draft applied', {
          nodes: currentState.nodes.length,
          edges: currentState.edges.length,
        })
      }
    } catch (err) {
      console.error('[DraftChat] Immediate autosave failed:', err)
    }

    // P0: Auto-select goal node if exactly one goal exists
    // This enables immediate "Run Analysis" without manual selection
    const goalNodes = nodes.filter((n: any) => n.type === 'goal')
    if (goalNodes.length === 1) {
      const { setOutcomeNode } = useCanvasStore.getState()
      setOutcomeNode(goalNodes[0].id)
      if (import.meta.env.DEV) {
        console.warn('[DraftChat] Auto-selected goal node:', goalNodes[0].id)
      }
    } else if (goalNodes.length > 1 && import.meta.env.DEV) {
      console.warn('[DraftChat] Multiple goal nodes found, user must select:', goalNodes.map((n: any) => n.id))
    }

    // CEE V3: Store analysis_ready payload for V2 run if present
    // This enables using CEE's resolved options in the analysis
    if (hasAnalysisReady(draftData)) {
      const { setCeeAnalysisReady } = useCanvasStore.getState()
      const coachingSummary = (draftData as any).coaching?.summary
      const analysisReadyWithCoaching = coachingSummary
        ? { ...draftData.analysis_ready, coaching_summary: coachingSummary }
        : draftData.analysis_ready
      setCeeAnalysisReady(analysisReadyWithCoaching)
      if (import.meta.env.DEV) {
        console.warn('[DraftChat] Stored analysis_ready:', {
          options: draftData.analysis_ready.options.length,
          goal_node_id: draftData.analysis_ready.goal_node_id,
        })
      }
    }

    // Store goal_constraints from CEE response root (NOT inside analysis_ready)
    // These get passed to PLoT /v2/run for multi-constraint analysis
    const rawGoalConstraints = (draftData as any).goal_constraints
    const { setGoalConstraints } = useCanvasStore.getState()
    if (Array.isArray(rawGoalConstraints) && rawGoalConstraints.length > 0) {
      setGoalConstraints(rawGoalConstraints)
      if (import.meta.env.DEV) {
        console.warn('[DraftChat] Stored goal_constraints:', rawGoalConstraints.length)
      }
    } else {
      // Clear stale constraints when CEE omits or returns empty goal_constraints
      setGoalConstraints(null)
    }

    // Store pipeline trace for debug panel if present (using proper type guard)
    // Client extracts trace.pipeline to top-level pipeline_trace for all schema versions
    // Check pipeline_trace first (V1/V2/V3 after extraction), fallback to trace.pipeline (raw V2/V3)
    const pipelineTrace = (draftData as any).pipeline_trace ?? (draftData as any).trace?.pipeline
    if (isCeePipelineTrace(pipelineTrace)) {
      const { setCeePipelineTrace } = useCanvasStore.getState()
      setCeePipelineTrace(pipelineTrace)
    }

    // Store quality dimensions from CEE response for pre-analysis readiness display
    // V3 responses include quality object with dimension scores
    const rawQuality = (draftData as any).quality
    if (rawQuality && typeof rawQuality.overall === 'number') {
      const { setCeeQuality } = useCanvasStore.getState()
      setCeeQuality({
        overall: rawQuality.overall ?? 5,
        structure: rawQuality.structure ?? rawQuality.overall ?? 5,
        coverage: rawQuality.coverage ?? rawQuality.overall ?? 5,
        causality: rawQuality.causality ?? rawQuality.overall ?? 5,
        safety: rawQuality.safety ?? rawQuality.overall ?? 5,
      })
      if (import.meta.env.DEV) {
        console.warn('[DraftChat] Stored CEE quality dimensions:', rawQuality)
      }
    }

  }, [pushHistory, applyLayout, setPendingFitView])

  // Handle panel resize via drag
  const handleResizeStart = useCallback((event: React.MouseEvent) => {
    if (typeof window === 'undefined') return
    event.preventDefault()

    const startX = event.clientX
    const startWidth = panelWidth

    const handleMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX
      const newWidth = Math.max(320, Math.min(1014, startWidth + deltaX))
      setPanelWidth(newWidth)
    }

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      userHasResizedRef.current = true
      // Persist width to localStorage
      try {
        localStorage.setItem(DRAFT_PANEL_WIDTH_KEY, String(panelWidth))
      } catch {}
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [panelWidth])

  // Persist panel width when it changes
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_PANEL_WIDTH_KEY, String(panelWidth))
    } catch {}
  }, [panelWidth])

  // Handle panel height resize via drag (top edge)
  const handleHeightResizeStart = useCallback((event: React.MouseEvent) => {
    if (typeof window === 'undefined') return
    event.preventDefault()

    const startY = event.clientY
    const startHeight = panelHeight
    const maxH = Math.floor(window.innerHeight * 0.9)

    let latestHeight = startHeight

    const handleMove = (e: MouseEvent) => {
      // Dragging up increases height (negative deltaY = taller)
      const deltaY = startY - e.clientY
      const minH = Math.floor(window.innerHeight * 0.2)
      latestHeight = Math.max(minH, Math.min(maxH, startHeight + deltaY))
      setPanelHeight(latestHeight)
    }

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      userHasResizedRef.current = true
      try {
        localStorage.setItem(DRAFT_PANEL_HEIGHT_KEY, String(latestHeight))
      } catch {}
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [panelHeight])

  // Task 7: Corner resize — drag top-right corner to resize both width and height
  const handleCornerResizeStart = useCallback((event: React.MouseEvent) => {
    if (typeof window === 'undefined') return
    event.preventDefault()

    const startX = event.clientX
    const startY = event.clientY
    const startWidth = panelWidth
    const startHeight = panelHeight
    const maxH = Math.floor(window.innerHeight * 0.9)

    let latestWidth = startWidth
    let latestHeight = startHeight

    const handleMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX
      const deltaY = startY - e.clientY // up = taller
      const minH = Math.floor(window.innerHeight * 0.2)
      latestWidth = Math.max(320, Math.min(1014, startWidth + deltaX))
      latestHeight = Math.max(minH, Math.min(maxH, startHeight + deltaY))
      setPanelWidth(latestWidth)
      setPanelHeight(latestHeight)
    }

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      userHasResizedRef.current = true
      try {
        localStorage.setItem(DRAFT_PANEL_WIDTH_KEY, String(latestWidth))
        localStorage.setItem(DRAFT_PANEL_HEIGHT_KEY, String(latestHeight))
      } catch {}
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [panelWidth, panelHeight])

  // Double-click drag handle → reset to default height
  const handleHeightDoubleClick = useCallback(() => {
    const maxH = typeof window !== 'undefined' ? Math.floor(window.innerHeight * 0.9) : DEFAULT_PANEL_HEIGHT
    const resetHeight = Math.min(DEFAULT_PANEL_HEIGHT, maxH)
    setPanelHeight(resetHeight)
    try {
      localStorage.setItem(DRAFT_PANEL_HEIGHT_KEY, String(resetHeight))
    } catch {}
  }, [])

  // Persist panel height when it changes
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_PANEL_HEIGHT_KEY, String(panelHeight))
    } catch {}
  }, [panelHeight])

  // Calculate dock offset by measuring the actual OutputsDock element
  // This is the most reliable approach - measures what's actually on screen
  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkDockOffset = () => {
      const dockElement = document.querySelector('[data-testid="outputs-dock"]')
      if (dockElement) {
        const width = dockElement.getBoundingClientRect().width
        // Only shift when dock is expanded (> 100px), not when collapsed (~40px)
        setDockOffset(width > 100 ? width : 0)
      } else {
        // Dock not mounted - center the panel
        setDockOffset(0)
      }
    }

    checkDockOffset()
    const interval = setInterval(checkDockOffset, 300)
    return () => clearInterval(interval)
  }, [])

  // Don't render if panel is closed
  if (!showDraftChat) {
    return null
  }

  return (
    <div
      ref={panelRef}
      className="fixed z-[2000] flex flex-col transition-all duration-300 ease-out"
      style={{
        // Center by default, shift left when results panel is expanded
        left: dockOffset > 0 ? `calc(50% - ${dockOffset / 2}px)` : '50%',
        transform: 'translateX(-50%)',
        bottom: 'calc(var(--bottombar-h, 0) + 1rem)',
        width: `${panelWidth * 1.44}px`,
        // Constrain max width when dock is expanded
        maxWidth: dockOffset > 0
          ? `calc(100vw - ${dockOffset}px - 112px - 52px - 24px)`
          : 'calc(100vw - 96px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-chat-title"
    >
      <div className="relative">
        <div
          aria-hidden="true"
          onMouseDown={handleResizeStart}
          className="absolute inset-y-0 right-0 w-1.5 cursor-col-resize bg-transparent hover:bg-sky-200/60 transition-colors z-10"
          title="Drag to resize panel"
        />
        {/* Task 7: Corner resize handle — top-right for diagonal resize */}
        <div
          aria-hidden="true"
          onMouseDown={handleCornerResizeStart}
          className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize z-20"
          title="Drag corner to resize"
        />
        <ThinkingModePopover
          isOpen={showSettingsPopover}
          onClose={() => setShowSettingsPopover(false)}
          anchorRef={settingsButtonRef}
        />
        {isMinimized ? (
          isOrchV2 ? (
          /* Orchestrator V2 minimized bar — clean rounded pill matching new design */
          <div
            className="flex items-center gap-2 rounded-[20px] border border-panel-border px-4 py-2.5 bg-panel"
            style={{ boxShadow: 'var(--shadow-2, 0 4px 12px rgba(0,0,0,0.08))' }}
            data-testid="chat-minimized"
          >
            <button
              type="button"
              onClick={() => setIsMinimized(false)}
              className={`${typography.body} text-text-light flex-1 text-left cursor-pointer bg-transparent border-none outline-none`}
              aria-label="Expand panel"
            >
              {hasGraph ? 'Describe changes or rebuild…' : 'Describe your decision…'}
            </button>
            <div
              className="w-[34px] h-[34px] flex-shrink-0 rounded-full flex items-center justify-center bg-panel-hover text-text-light"
              style={{ border: '1px solid var(--border-default, #E8E5E1)' }}
              aria-hidden="true"
            >
              <ChevronUp className="w-4 h-4" />
            </div>
          </div>
          ) : (
          <>
          <div
            className="flex gap-3 rounded-lg border border-panel-border px-4 py-3 shadow-2"
            style={{ backgroundColor: '#FEFEFE' }}
            data-testid="draft-chat-minimized"
          >
            {/* Textarea with submit button inside - takes remaining width */}
            <div className="flex-1 relative">
              <textarea
                ref={inputRef as any}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  // Auto-resize textarea - no max height, always grow
                  e.target.style.height = 'auto'
                  e.target.style.height = `${e.target.scrollHeight}px`
                }}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && canSubmit) {
                    e.preventDefault()
                    handleDraft()
                  }
                }}
                placeholder={hasGraph ? 'Describe changes to your model...' : 'Describe your decision...'}
                className={`${typography.body} w-full h-full pr-12 bg-transparent resize-none placeholder:text-ink-400`}
                style={{
                  minHeight: '24px',
                  outline: 'none',
                  border: 'none',
                  boxShadow: 'none',
                  overflow: 'hidden'
                }}
                rows={1}
                aria-label={hasGraph ? 'Describe changes to your model' : 'Describe your decision'}
              />
              {/* Submit button inside textarea area - anchored to bottom right */}
              <button
                onClick={handleDraft}
                disabled={!canSubmit}
                className="absolute right-1 bottom-0 p-2 rounded-full transition-colors"
                style={{
                  backgroundColor: canSubmit ? '#63ADCF' : '#E8E5E1',
                  color: canSubmit ? '#FFFFFF' : '#9B9B9B',
                  cursor: canSubmit ? 'pointer' : 'not-allowed'
                }}
                aria-label={hasGraph ? 'Rebuild model' : 'Generate draft'}
                title="Press Enter to send"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </div>
            {/* Action buttons on the right - anchored to bottom */}
            <div className="flex items-end gap-1 flex-shrink-0">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-full text-ink-400 hover:text-ink-600 hover:bg-sand-100 transition-colors"
                aria-label="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                ref={settingsButtonRef}
                onClick={() => setShowSettingsPopover(!showSettingsPopover)}
                className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-full text-ink-400 hover:text-ink-600 hover:bg-sand-100 transition-colors"
                aria-label="Thinking mode"
                aria-expanded={showSettingsPopover}
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsMinimized(false)}
                className="p-2 rounded-full text-ink-400 hover:text-ink-600 hover:bg-sand-100 transition-colors"
                aria-label="Expand panel"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>
          </>
          )
        ) : (
          <div className="flex flex-col rounded-[20px] border border-sand-200 shadow-2 overflow-clip relative" style={{ backgroundColor: '#FEFEFE', height: panelHeight, maxHeight: '90vh' }} data-chat-panel="">
            {/* Drag handle — visible grip at top edge for height resize */}
            <div
              aria-hidden="true"
              onMouseDown={handleHeightResizeStart}
              onDoubleClick={handleHeightDoubleClick}
              className="absolute top-0 left-0 right-0 h-2 cursor-row-resize flex items-center justify-center z-10"
              data-testid="panel-drag-handle"
            >
              <div
                className="w-10 rounded-full"
                style={{ height: 2, background: 'var(--border-default, #EEE6D8)' }}
              />
            </div>
            {/* Header — hidden when orchestrator V2 is active (ChatTopBar replaces it) */}
            {!isOrchV2 && (
            <div className="flex items-center justify-between px-4 py-3 border-b border-sand-100" style={{ backgroundColor: '#FEFEFE' }}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-mint-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 id="draft-chat-title" className={`${typography.label} text-ink-900`}>
                    Olumi AI
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-sand-100 transition-colors"
                  aria-label="Attach file"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  ref={settingsButtonRef}
                  onClick={() => setShowSettingsPopover(!showSettingsPopover)}
                  className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-ink-400 hover:text-ink-600 hover:bg-sand-100 transition-colors"
                  aria-label="Thinking mode"
                  aria-expanded={showSettingsPopover}
                >
                  <Settings className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-1.5 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-sand-100 transition-colors"
                  aria-label="Minimize panel"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
            </div>
            )}

            {isOrchV2 ? (
              <ConversationPanel
                conversation={conversation}
                onCollapse={() => setIsMinimized(true)}
                onAttach={() => fileInputRef.current?.click()}
              />
            ) : (
            <>
            {/* Scrollable content area - shrinks to make room for input */}
            <div
              className={`flex-1 min-h-0 overflow-y-auto ${
                loading || draft || guidance || error || retryAfterSeconds !== null || attachedFiles.length > 0
                  ? 'p-4 space-y-4'
                  : 'p-1'
              }`}
            >
              {/* Loading state - show animated visualisation */}
              {loading && !draft && (
                <DraftLoadingAnimation />
              )}

              {!draft && !loading ? (
                <>
                  {/* Guidance panel */}
                  {guidance && (
                    <DraftGuidancePanel
                      guidance={guidance}
                      onQuestionClick={(question) => {
                        setDescription((previous: string) => {
                          const trimmed = previous.trim()
                          if (!trimmed) {
                            return question
                          }
                          return `${trimmed}\n\n${question}`
                        })
                      }}
                    />
                  )}

                  {/* Error handling */}
                  {error && (() => {
                    const formatted = formatCEEError(error)

                    if (formatted.isUnavailable) {
                      return (
                        <div className="p-3 bg-panel border border-warning/30 rounded-lg space-y-2" data-testid="cee-unavailable-banner">
                          <p className={`${typography.body} text-warning font-medium`}>
                            {formatted.message}
                          </p>
                          <p className={`${typography.panelBody} text-text-body`}>
                            Build your model manually using:
                          </p>
                          <ul className={`${typography.panelBody} text-text-body list-disc list-inside space-y-0.5`}>
                            <li><strong>+ Node</strong> button to add factors</li>
                            <li><strong>Templates</strong> drawer for pre-built models</li>
                            <li>Right-click canvas for quick-add menu</li>
                          </ul>
                          {import.meta.env.DEV && formatted.debugInfo && (
                            <details className="mt-1">
                              <summary className={`${typography.panelMeta} text-text-light cursor-pointer select-none`}>
                                Technical details
                              </summary>
                              <pre className={`${typography.panelMeta} text-text-light font-mono mt-1 opacity-70 whitespace-pre-wrap break-all`}>
                                {formatted.debugInfo}
                              </pre>
                            </details>
                          )}
                        </div>
                      )
                    }

                    if (formatted.isTimeout) {
                      return (
                        <div className="p-3 bg-panel border border-warning/30 rounded-lg space-y-2" data-testid="draft-timeout-error">
                          <p className="text-sm font-semibold text-warning">
                            {formatted.title}
                          </p>
                          <p className="text-xs text-text-body">
                            {formatted.message}
                          </p>
                          <ul className="text-xs text-text-body list-disc list-inside space-y-0.5">
                            <li>Wait a bit longer and try again</li>
                            <li>Simplify your brief to fewer factors</li>
                          </ul>
                          {formatted.guidance && (
                            <p className="text-xs text-text-light">
                              {formatted.guidance}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={handleDraft}
                            className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-info bg-panel border border-info/30 rounded-md hover:bg-info-light transition-colors"
                          >
                            Try again
                          </button>
                          {import.meta.env.DEV && formatted.debugInfo && (
                            <details className="mt-1">
                              <summary className="text-xs text-text-light cursor-pointer select-none">
                                Technical details
                              </summary>
                              <pre className="text-xs text-text-light font-mono mt-1 opacity-70 whitespace-pre-wrap break-all">
                                {formatted.debugInfo}
                              </pre>
                            </details>
                          )}
                        </div>
                      )
                    }

                    if (formatted.isGraphInvalid) {
                      return (
                        <div className="p-3 bg-panel border border-danger/30 rounded-lg space-y-2" data-testid="draft-graph-invalid-error">
                          <p className="text-sm font-semibold text-danger">
                            {formatted.title}
                          </p>
                          <p className="text-xs text-text-body">
                            {formatted.message}
                          </p>
                          {formatted.guidance && (
                            <p className="text-xs text-text-light">
                              {formatted.guidance}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={handleDraft}
                            className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-info bg-panel border border-info/30 rounded-md hover:bg-info-light transition-colors"
                          >
                            Try again
                          </button>
                          {import.meta.env.DEV && formatted.debugInfo && (
                            <details className="mt-1">
                              <summary className="text-xs text-text-light cursor-pointer select-none">
                                Technical details
                              </summary>
                              <pre className="text-xs text-text-light font-mono mt-1 opacity-70 whitespace-pre-wrap break-all">
                                {formatted.debugInfo}
                              </pre>
                            </details>
                          )}
                        </div>
                      )
                    }

                    if (formatted.isValidationFailed) {
                      return (
                        <div className="max-w-lg px-4 py-3 bg-panel border border-danger/30 rounded-md" data-testid="draft-validation-error">
                          <p className="text-sm font-semibold text-danger">
                            {formatted.title}
                          </p>
                          <p className="mt-2 text-sm text-text-body">
                            {formatted.message}
                          </p>
                          {formatted.guidance && (
                            <p className="mt-1 text-xs text-text-light">
                              {formatted.guidance}
                            </p>
                          )}
                          <div className="mt-3 flex flex-wrap gap-2" data-testid="brief-suggestion-chips">
                            {EXAMPLE_BRIEF_CHIPS.map((chip) => (
                              <button
                                key={chip.id}
                                type="button"
                                onClick={() => setDescription(chip.text)}
                                className="min-h-11 px-3 py-1.5 text-xs bg-panel text-text-body border border-panel-border rounded-full hover:bg-panel-hover transition-colors cursor-pointer"
                              >
                                {chip.label}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={handleDraft}
                            className="mt-3 inline-flex items-center px-4 py-2 text-sm font-semibold text-text-body bg-transparent border border-[rgba(38,38,38,0.16)] rounded-full hover:bg-panel-hover transition-colors"
                          >
                            Try again
                          </button>
                          {import.meta.env.DEV && formatted.debugInfo && (
                            <details className="mt-2">
                              <summary className="text-xs text-text-light cursor-pointer select-none">
                                Technical details
                              </summary>
                              <pre className="text-xs text-text-light font-mono mt-1 opacity-70 whitespace-pre-wrap break-all">
                                {formatted.debugInfo}
                              </pre>
                            </details>
                          )}
                        </div>
                      )
                    }

                    return (
                      <ErrorAlert
                        title={formatted.title || 'Draft failed'}
                        message={formatted.message}
                        severity="error"
                        debugInfo={formatted.debugInfo}
                        action={{ label: 'Try again', onClick: handleDraft }}
                      />
                    )
                  })()}

                  {retryAfterSeconds !== null && (
                    <RateLimitNotice retryAfterSeconds={retryAfterSeconds} onRetry={handleDraft} />
                  )}

                  {/* Attached files preview */}
                  {attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {attachedFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center gap-1.5 px-2 py-1 bg-sand-50 border border-sand-200 rounded-lg text-xs"
                        >
                          <Paperclip className="w-3 h-3 text-ink-400" />
                          <span className="max-w-[120px] truncate text-ink-700">{file.name}</span>
                          <button
                            onClick={() => removeFile(index)}
                            className="p-0.5 hover:bg-sand-200 rounded"
                            aria-label={`Remove ${file.name}`}
                          >
                            <X className="w-3 h-3 text-ink-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}

              {draft && (
                <div className="p-3 bg-paper-50 border border-sand-200 rounded-xl space-y-2" data-testid="draft-submitted-brief">
                  <p className={`${typography.panelMeta} uppercase tracking-wide text-ink-500`}>
                    Submitted brief
                  </p>
                  <p className={`${typography.body} text-ink-900 whitespace-pre-wrap`}>
                    {description || 'No brief provided.'}
                  </p>
                  <p className={`${typography.panelBody} text-ink-500`}>
                    Draft applied to canvas. Edit the brief below to generate a new version.
                  </p>
                </div>
              )}
            </div>

            {/* Input area - auto-grows with content, scrollbar at 75vh */}
            <div className="border-t border-sand-100 p-3 bg-paper-25 flex-shrink-0">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value)
                    // Auto-resize textarea - grows with content, max 75vh
                    e.target.style.height = 'auto'
                    const maxHeight = window.innerHeight * 0.75
                    const newHeight = Math.min(e.target.scrollHeight, maxHeight)
                    e.target.style.height = `${newHeight}px`
                    e.target.style.overflowY = e.target.scrollHeight > maxHeight ? 'auto' : 'hidden'
                  }}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && canSubmit) {
                      e.preventDefault()
                      handleDraft()
                    }
                  }}
                  placeholder={hasGraph
                    ? 'Describe the changes you want... e.g., Rebuild this model with fewer factors, clearer options, and stronger evidence for market size.'
                    : "Describe your decision... e.g., We're deciding whether to expand into the European market. Key factors include regulatory costs, market size, and competition..."}
                  className={`
                    ${typography.body} w-full p-3 pb-12 rounded-xl border border-sand-200
                    focus:border-sand-200 focus:outline-none focus:ring-0 focus:shadow-none
                    resize-none
                    placeholder:text-ink-400
                  `}
                  style={{
                    minHeight: '288px', // 60% taller than 180px
                    maxHeight: '75vh',
                    outline: 'none',
                    boxShadow: 'none',
                    overflowY: 'hidden'
                  }}
                />

                {/* Submit button - positioned inside textarea, equidistant from bottom-right */}
                <button
                  onClick={handleDraft}
                  disabled={!canSubmit}
                  className="absolute p-2 rounded-lg transition-colors"
                  style={{
                    right: '12px',
                    bottom: '12px',
                    backgroundColor: canSubmit ? '#63ADCF' : '#E8E5E1',
                    color: canSubmit ? '#FFFFFF' : '#9B9B9B',
                    cursor: canSubmit ? 'pointer' : 'not-allowed'
                  }}
                  aria-label={`${hasGraph ? 'Rebuild model' : 'Generate draft'} (Enter to send, Shift+Enter for new line)`}
                  title="Press Enter to send • Shift+Enter for new line"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            </>
            )}
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
        />
      </div>
    </div>
  )
}
