/**
 * useScenario — React hook bridging Supabase persistence with the canvas Zustand store.
 *
 * Responsibilities:
 * - Create, load, delete scenarios via scenarioService
 * - Auto-save graph (debounced 1500ms) and framing to Supabase
 * - Expose save status for the UI (saved / saving / error)
 * - Hydrate canvas store from a Supabase row on load
 * - Retry failed saves once after 3 seconds
 *
 * Persistence is gated on auth: when `user.id === 'guest'` (PoC / guest mode),
 * all operations are no-ops and the existing localStorage system continues to work.
 *
 * This hook does NOT replace existing state management — it wires into the
 * canvas Zustand store via selectors and `setState()`.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCanvasStore } from '../canvas/store'
import * as scenarioService from '../services/scenarioService'
import type { ScenarioStage, AnalysisProvenance, AnalysisStatus } from '../types/scenario'
import { hydrateAnalysisFromV2Response } from './hydrateAnalysis'
import type { Edge } from '@xyflow/react'
import { DEFAULT_EDGE_DATA, type EdgeData } from '../canvas/domain/edges'

export type SaveStatus = 'saved' | 'saving' | 'error'

export interface UseScenarioReturn {
  // CRUD
  createScenario: (title?: string) => Promise<string>
  loadScenario: (id: string) => Promise<void>
  deleteScenario: (id: string) => Promise<void>

  // Save status
  saveStatus: SaveStatus
  lastSavedAt: number | null
  saveError: string | null

  // Is Supabase persistence active?
  isPersistenceActive: boolean

  // Analysis persistence
  setAnalysisRunning: () => Promise<void>
  resetAnalysisStatus: () => Promise<void>
  persistAnalysisSuccess: (
    analysis: unknown,
    graphHash: string,
    seedUsed: number,
    responseHash: string,
    details?: Record<string, unknown>,
    turnId?: string,
  ) => Promise<void>
  persistAnalysisFailure: (
    errorPayload: { code: string; message: string },
    turnId?: string,
  ) => Promise<void>
  persistBrief: (brief: unknown, turnId?: string) => Promise<void>
  setStage: (stage: ScenarioStage, turnId?: string) => Promise<void>
  createSharedBrief: () => Promise<{ slug: string } | null>

  // Graph staleness — true when graph has been edited after the last analysis
  analysisStale: boolean
  clearAnalysisStale: () => void
}

const GRAPH_DEBOUNCE_MS = 1500
const FRAMING_DEBOUNCE_MS = 1500
const RETRY_DELAY_MS = 3000

export function useScenario(): UseScenarioReturn {
  const { user, authenticated } = useAuth()
  const navigate = useNavigate()

  // Persistence is active only for real Supabase users, not guest mode
  const isPersistenceActive = authenticated && !!user && user.id !== 'guest'

  // Canvas store selectors — only scalars/functions that don't create new
  // references on every ReactFlow tick.  nodes/edges/framing are read via
  // getState() inside a store subscription (see below) to avoid subscribing
  // the calling component to high-frequency ReactFlow position/measurement
  // updates, which previously caused an infinite render loop in CanvasMVP.
  const currentScenarioId = useCanvasStore((s) => s.currentScenarioId)

  // Save state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Graph staleness — true when graph has been edited after the last analysis
  const [analysisStale, setAnalysisStale] = useState(false)

  // Timer refs for debounce and retry (cleared on unmount)
  const graphSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const framingSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track mounted state to avoid setState on unmounted component
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Track the last saved graph to skip redundant saves.
  // Uses a serialised snapshot (JSON string) for deep comparison.
  const lastSavedGraphRef = useRef<string>('')
  const lastSavedFramingRef = useRef<string>('')

  // Stable reference to the current scenario ID for use inside timers
  const scenarioIdRef = useRef(currentScenarioId)
  scenarioIdRef.current = currentScenarioId

  // Keep isPersistenceActive in a ref so the subscription callback can read it
  const isPersistenceActiveRef = useRef(isPersistenceActive)
  isPersistenceActiveRef.current = isPersistenceActive

  // -----------------------------------------------------------------------
  // Auto-save graph (subscription-based, debounced 1500ms)
  // Uses useCanvasStore.subscribe to avoid subscribing the component to
  // nodes/edges, which change on every ReactFlow measurement tick.
  // -----------------------------------------------------------------------

  useEffect(() => {
    const unsubscribe = useCanvasStore.subscribe((state, prevState) => {
      // Only react to nodes/edges changes
      if (state.nodes === prevState.nodes && state.edges === prevState.edges) return

      const sid = scenarioIdRef.current
      if (!isPersistenceActiveRef.current || !sid) return
      if (!mountedRef.current) return

      const { nodes, edges } = state
      const graphSnapshot = JSON.stringify({ nodes, edges })
      if (graphSnapshot === lastSavedGraphRef.current) return

      // Mark results as stale when graph changes after a completed analysis
      if (state.results.status === 'complete') {
        setAnalysisStale(true)
      }

      if (graphSaveTimerRef.current) clearTimeout(graphSaveTimerRef.current)

      graphSaveTimerRef.current = setTimeout(async () => {
        const saveSid = scenarioIdRef.current
        if (!saveSid || !mountedRef.current) return

        if (mountedRef.current) setSaveStatus('saving')

        try {
          const currentState = useCanvasStore.getState()
          await scenarioService.saveGraph(saveSid, { nodes: currentState.nodes, edges: currentState.edges })
          lastSavedGraphRef.current = JSON.stringify({ nodes: currentState.nodes, edges: currentState.edges })
          if (mountedRef.current) {
            const now = Date.now()
            setSaveStatus('saved')
            setLastSavedAt(now)
            setSaveError(null)
            useCanvasStore.getState().markClean()
            useCanvasStore.setState({ lastSavedAt: now })
          }
        } catch (err) {
          if (mountedRef.current) {
            setSaveStatus('error')
            setSaveError(err instanceof Error ? err.message : 'Save failed')
          }
          // Retry once after 3 seconds
          retryTimerRef.current = setTimeout(async () => {
            const retrySid = scenarioIdRef.current
            if (!retrySid || !mountedRef.current) return
            try {
              const retryState = useCanvasStore.getState()
              await scenarioService.saveGraph(retrySid, { nodes: retryState.nodes, edges: retryState.edges })
              lastSavedGraphRef.current = JSON.stringify({ nodes: retryState.nodes, edges: retryState.edges })
              if (mountedRef.current) {
                const now = Date.now()
                setSaveStatus('saved')
                setLastSavedAt(now)
                setSaveError(null)
                useCanvasStore.getState().markClean()
                useCanvasStore.setState({ lastSavedAt: now })
              }
            } catch (retryErr) {
              console.error('[useScenario] save retry failed:', retryErr)
            }
          }, RETRY_DELAY_MS)
        }
      }, GRAPH_DEBOUNCE_MS)
    })

    return () => {
      unsubscribe()
      if (graphSaveTimerRef.current) clearTimeout(graphSaveTimerRef.current)
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [])

  // -----------------------------------------------------------------------
  // Auto-save framing (subscription-based, debounced 1500ms)
  // -----------------------------------------------------------------------

  useEffect(() => {
    const unsubscribe = useCanvasStore.subscribe((state, prevState) => {
      if (state.currentScenarioFraming === prevState.currentScenarioFraming) return

      const sid = scenarioIdRef.current
      if (!isPersistenceActiveRef.current || !sid) return
      if (!mountedRef.current) return

      const framing = state.currentScenarioFraming
      if (!framing) return

      const framingSnapshot = JSON.stringify(framing)
      if (framingSnapshot === lastSavedFramingRef.current) return

      if (framingSaveTimerRef.current) clearTimeout(framingSaveTimerRef.current)

      framingSaveTimerRef.current = setTimeout(async () => {
        const saveSid = scenarioIdRef.current
        if (!saveSid || !mountedRef.current) return

        try {
          const currentFraming = useCanvasStore.getState().currentScenarioFraming
          if (currentFraming) {
            await scenarioService.saveFraming(saveSid, currentFraming)
            lastSavedFramingRef.current = JSON.stringify(currentFraming)
          }
        } catch {
          if (import.meta.env.DEV) {
            console.warn('[useScenario] Framing save failed')
          }
        }
      }, FRAMING_DEBOUNCE_MS)
    })

    return () => {
      unsubscribe()
      if (framingSaveTimerRef.current) clearTimeout(framingSaveTimerRef.current)
    }
  }, [])

  // -----------------------------------------------------------------------
  // Cleanup all timers on unmount + best-effort flush of pending saves
  // -----------------------------------------------------------------------

  useEffect(() => {
    return () => {
      // Best-effort flush: if a debounced graph save is pending, fire it now
      if (graphSaveTimerRef.current) {
        clearTimeout(graphSaveTimerRef.current)
        const sid = scenarioIdRef.current
        if (sid) {
          const { nodes: n, edges: e } = useCanvasStore.getState()
          scenarioService.saveGraph(sid, { nodes: n, edges: e }).catch((err) => {
            console.error('[useScenario] Unmount graph flush failed:', err)
          })
        }
      }
      if (framingSaveTimerRef.current) {
        clearTimeout(framingSaveTimerRef.current)
        const sid = scenarioIdRef.current
        const f = useCanvasStore.getState().currentScenarioFraming
        if (sid && f) {
          scenarioService.saveFraming(sid, f).catch((err) => {
            console.error('[useScenario] Unmount framing flush failed:', err)
          })
        }
      }
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [])

  // -----------------------------------------------------------------------
  // Title auto-generation from framing goal (C.1b Task 10)
  // Only auto-set once per scenario load — don't overwrite user edits.
  // The ref tracks whether we've already auto-set for the current scenario.
  // -----------------------------------------------------------------------

  const titleAutoSetForScenarioRef = useRef<string | null>(null)

  useEffect(() => {
    // Check on mount and subscribe for changes
    const tryAutoTitle = () => {
      const sid = scenarioIdRef.current
      if (!isPersistenceActiveRef.current || !sid) return
      if (titleAutoSetForScenarioRef.current === sid) return

      const framingObj = useCanvasStore.getState().currentScenarioFraming as Record<string, unknown> | null

      const existingTitle = framingObj?.title
      if (existingTitle && typeof existingTitle === 'string' && existingTitle.trim().length > 0) {
        titleAutoSetForScenarioRef.current = sid
        return
      }

      const goal = framingObj?.goal
      if (!goal || typeof goal !== 'string') return

      const autoTitle = goal.length > 60
        ? goal.substring(0, 57) + '...'
        : goal

      titleAutoSetForScenarioRef.current = sid
      scenarioService.saveTitle(sid, autoTitle).catch((err) => {
        console.error('[useScenario] Auto-title save failed:', err)
      })
    }

    tryAutoTitle()

    const unsubscribe = useCanvasStore.subscribe((state, prevState) => {
      if (
        state.currentScenarioFraming === prevState.currentScenarioFraming &&
        state.currentScenarioId === prevState.currentScenarioId
      ) return
      tryAutoTitle()
    })

    return unsubscribe
  }, [])

  // -----------------------------------------------------------------------
  // Navigation guard — beforeunload (C.1b Task 11)
  // Warn the user when navigating away with pending saves.
  // -----------------------------------------------------------------------

  const isDirty = useCanvasStore((s) => s.isDirty)

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveStatus === 'saving' || isDirty) {
        e.preventDefault()
        // Required for Chrome — string value is ignored by modern browsers
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [saveStatus, isDirty])

  // -----------------------------------------------------------------------
  // createScenario — insert row + navigate to /scenario/:id
  // -----------------------------------------------------------------------

  const createScenario = useCallback(
    async (title?: string): Promise<string> => {
      if (!isPersistenceActive || !user) {
        throw new Error('Persistence not active')
      }
      const eventId = crypto.randomUUID()
      const row = await scenarioService.createScenario(user.id, eventId, title)
      navigate(`/scenario/${row.id}`)
      return row.id
    },
    [isPersistenceActive, user, navigate],
  )

  // -----------------------------------------------------------------------
  // loadScenario — fetch from Supabase and hydrate canvas store
  // -----------------------------------------------------------------------

  const loadScenario = useCallback(
    async (id: string): Promise<void> => {
      if (!isPersistenceActive) return

      const row = await scenarioService.loadScenario(id)
      if (!row) {
        if (import.meta.env.DEV) {
          console.warn('[useScenario] Scenario not found:', id)
        }
        return
      }

      // The graph JSONB column stores { nodes: Node[], edges: Edge[] }
      const graph = row.graph as { nodes?: unknown[]; edges?: unknown[] } | null
      const graphNodes = (graph?.nodes ?? []) as Parameters<
        ReturnType<typeof useCanvasStore.getState>['hydrateGraphSlice']
      >[0]['nodes']
      // Upgrade persisted edges to strongly-typed Edge<EdgeData>,
      // matching the pattern in store.ts loadScenario
      const rawEdges = (graph?.edges ?? []) as Edge[]
      const graphEdges: Edge<EdgeData>[] = rawEdges.map((edge) => ({
        ...edge,
        data: {
          ...DEFAULT_EDGE_DATA,
          ...((edge.data as Partial<EdgeData> | undefined) ?? {}),
        },
      }))

      // Update local refs BEFORE hydrating the store to prevent the
      // subscription callbacks from scheduling a redundant re-save when
      // hydrateGraphSlice fires synchronous store updates.
      lastSavedGraphRef.current = JSON.stringify({
        nodes: graphNodes,
        edges: graphEdges,
      })
      lastSavedFramingRef.current = JSON.stringify(row.framing ?? null)

      // Hydrate graph slice (resets history, selection, reseeds IDs)
      useCanvasStore.getState().hydrateGraphSlice({
        nodes: graphNodes,
        edges: graphEdges,
        currentScenarioId: row.id,
      })

      // Hydrate framing + stage
      useCanvasStore.setState({
        currentScenarioFraming: (row.framing as Record<string, unknown> | null) ?? null,
        currentStage: row.stage,  // A.15: Hydrate lifecycle stage from Supabase
        isDirty: false,
        lastSavedAt: new Date(row.updated_at).getTime(),
      })

      if (mountedRef.current) {
        setLastSavedAt(new Date(row.updated_at).getTime())
        setSaveStatus('saved')
        setSaveError(null)
      }

      // Handle interrupted analysis: if analysis_status is 'running',
      // the analysis was interrupted — reset to 'none' (Schema v2.0 §7)
      if (row.analysis_status === 'running') {
        // Fire-and-forget status reset on the server
        scenarioService
          .resetAnalysisStatus(row.id)
          .catch((err) => {
            // Non-critical — the UI already treats it as 'none'
            console.error('[useScenario] Reset interrupted analysis status failed:', err)
          })
      }

      // Hydrate analysis results from Supabase when status is 'ready'
      if (row.analysis_status === 'ready' && row.analysis != null) {
        const hydrated = hydrateAnalysisFromV2Response(
          row.analysis,
          (row.analysis_provenance as AnalysisProvenance) ?? null,
        )

        if (hydrated) {
          useCanvasStore.getState().resultsHydrateFromSupabase(hydrated)

          // Set staleness-detection metadata on the store
          const prov = row.analysis_provenance as AnalysisProvenance | null
          useCanvasStore.setState({
            currentScenarioLastResultHash: hydrated.results.hash ?? null,
            currentScenarioLastRunAt: prov?.analysed_at ?? null,
            currentScenarioLastRunSeed:
              prov?.seed_used != null ? String(prov.seed_used) : null,
          })
        } else if (import.meta.env.DEV) {
          console.warn(
            '[useScenario] Failed to hydrate analysis — invalid V2RunResponse shape',
          )
        }
      }

      // Track 3: Store thread and events on canvas store for consumption by
      // useConversation (hydration) and JourneyTabBody (timeline).
      // These are transient — consumed once, then cleared.
      const rawThread = row.thread as unknown[] | null
      const rawEvents = Array.isArray(row.events) ? row.events : null
      useCanvasStore.setState({
        _hydratedThread: rawThread && Array.isArray(rawThread) && rawThread.length > 0 ? rawThread : null,
        _hydratedEvents: rawEvents,
      })

      // Hydrate error state when analysis previously failed
      if (row.analysis_status === 'failed' && row.analysis_error != null) {
        const errorPayload = row.analysis_error as {
          code?: string
          message?: string
        }
        // Clear stale results state before setting error
        useCanvasStore.setState({
          results: {
            status: 'error',
            progress: 0,
            error: {
              code: errorPayload?.code ?? 'PERSISTED_FAILURE',
              message: errorPayload?.message ?? 'Previous analysis failed',
              canRetry: true,
            },
          },
          runMeta: {
            diagnostics: undefined,
            correlationIdHeader: undefined,
            degraded: undefined,
            ceeReview: null,
            ceeTrace: null,
            ceeError: null,
            ceeReviewV1: null,
            ceeTraceV1: null,
            ceeErrorV1: null,
          },
          currentScenarioLastResultHash: null,
          currentScenarioLastRunAt: null,
          currentScenarioLastRunSeed: null,
        })
      }
    },
    [isPersistenceActive],
  )

  // -----------------------------------------------------------------------
  // deleteScenario
  // -----------------------------------------------------------------------

  const deleteScenario = useCallback(
    async (id: string): Promise<void> => {
      if (!isPersistenceActive) return
      await scenarioService.deleteScenario(id)

      // If we deleted the active scenario, clear the store reference
      if (useCanvasStore.getState().currentScenarioId === id) {
        useCanvasStore.setState({ currentScenarioId: null })
      }
    },
    [isPersistenceActive],
  )

  // -----------------------------------------------------------------------
  // Analysis persistence (C.1b)
  // -----------------------------------------------------------------------

  const setAnalysisRunningCb = useCallback(
    async (): Promise<void> => {
      if (!isPersistenceActive || !currentScenarioId) return
      await scenarioService.setAnalysisRunning(currentScenarioId)
    },
    [isPersistenceActive, currentScenarioId],
  )

  const resetAnalysisStatusCb = useCallback(
    async (): Promise<void> => {
      if (!isPersistenceActive || !currentScenarioId) return
      await scenarioService.resetAnalysisStatus(currentScenarioId)
    },
    [isPersistenceActive, currentScenarioId],
  )

  const clearAnalysisStale = useCallback(() => {
    setAnalysisStale(false)
  }, [])

  const persistAnalysisSuccess = useCallback(
    async (
      analysis: unknown,
      graphHash: string,
      seedUsed: number,
      responseHash: string,
      details?: Record<string, unknown>,
      turnId?: string,
    ): Promise<void> => {
      // Clear staleness when new analysis completes
      setAnalysisStale(false)

      if (!isPersistenceActive || !currentScenarioId) return
      const eventId = crypto.randomUUID()
      await scenarioService.storeAnalysis(
        currentScenarioId,
        analysis,
        graphHash,
        seedUsed,
        responseHash,
        eventId,
        details,
        turnId,
      )
    },
    [isPersistenceActive, currentScenarioId],
  )

  const persistAnalysisFailure = useCallback(
    async (
      errorPayload: { code: string; message: string },
      turnId?: string,
    ): Promise<void> => {
      if (!isPersistenceActive || !currentScenarioId) return
      const eventId = crypto.randomUUID()
      await scenarioService.storeAnalysisFailure(
        currentScenarioId,
        errorPayload,
        eventId,
        turnId,
      )
    },
    [isPersistenceActive, currentScenarioId],
  )

  const persistBrief = useCallback(
    async (brief: unknown, turnId?: string): Promise<void> => {
      if (!isPersistenceActive || !currentScenarioId) return
      const eventId = crypto.randomUUID()
      await scenarioService.storeBrief(currentScenarioId, brief, eventId, turnId)
    },
    [isPersistenceActive, currentScenarioId],
  )

  const setStage = useCallback(
    async (stage: ScenarioStage, turnId?: string): Promise<void> => {
      if (!isPersistenceActive || !currentScenarioId) return
      const eventId = crypto.randomUUID()
      await scenarioService.setStage(currentScenarioId, stage, eventId, turnId)
    },
    [isPersistenceActive, currentScenarioId],
  )

  const createSharedBrief = useCallback(async (): Promise<{
    slug: string
  } | null> => {
    if (!isPersistenceActive || !currentScenarioId) return null
    const result = await scenarioService.createSharedBrief(currentScenarioId)
    return { slug: result.slug }
  }, [isPersistenceActive, currentScenarioId])

  // -----------------------------------------------------------------------
  // Return value (stable via useMemo to prevent unnecessary re-renders)
  // -----------------------------------------------------------------------

  return useMemo(
    () => ({
      createScenario,
      loadScenario,
      deleteScenario,
      saveStatus,
      lastSavedAt,
      saveError,
      isPersistenceActive,
      setAnalysisRunning: setAnalysisRunningCb,
      resetAnalysisStatus: resetAnalysisStatusCb,
      persistAnalysisSuccess,
      persistAnalysisFailure,
      persistBrief,
      setStage,
      createSharedBrief,
      analysisStale,
      clearAnalysisStale,
    }),
    [
      createScenario,
      loadScenario,
      deleteScenario,
      saveStatus,
      lastSavedAt,
      saveError,
      isPersistenceActive,
      setAnalysisRunningCb,
      resetAnalysisStatusCb,
      persistAnalysisSuccess,
      persistAnalysisFailure,
      persistBrief,
      setStage,
      createSharedBrief,
      analysisStale,
      clearAnalysisStale,
    ],
  )
}
