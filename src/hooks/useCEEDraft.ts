import { useState, useCallback, useMemo } from 'react'
import { CEEClient, CEEError } from '../adapters/cee/client'
import type { CEEDraftResponse, CEEv2Response, CEEv3Response } from '../adapters/cee/types'
import { isSchemaV2Enabled } from '../flags'
import { useCanvasStore } from '../canvas/store'

export interface DraftGuidance {
  level: 'ready' | 'needs_clarification' | 'not_ready'
  questions: string[]
  hint?: string
}

interface UseCEEDraftState {
  data: CEEDraftResponse | CEEv2Response | CEEv3Response | null
  loading: boolean
  error: CEEError | null
  guidance: DraftGuidance | null
  retryAfterSeconds: number | null
}

export function useCEEDraft() {
  const [state, setState] = useState<UseCEEDraftState>({
    data: null,
    loading: false,
    error: null,
    guidance: null,
    retryAfterSeconds: null,
  })

  const client = useMemo(() => new CEEClient(), [])

  const draft = useCallback(
    async (description: string) => {
      setState({ data: null, loading: true, error: null, guidance: null, retryAfterSeconds: null })

      try {
        // Brief v2.2: Use schema v2 when feature flag is enabled
        const schemaVersion = isSchemaV2Enabled() ? 'v2' : 'v1'

        // Get model selection from store (null = use default, so not sent to API)
        const state = useCanvasStore.getState()
        const selectedGenerationModel = state.selectedGenerationModel
        const selectedRepairModel = state.selectedRepairModel
        const selectedEnrichmentModel = state.selectedEnrichmentModel

        // Debug: Get raw_output mode from store (bypasses CEE post-processing repairs)
        const debugRawCeeOutput = state.debugRawCeeOutput
        const data = await client.draftModel(description, {
          schemaVersion,
          raw_output: debugRawCeeOutput || undefined,
          // Only send model parameters when they differ from defaults (non-null)
          model: selectedGenerationModel || undefined,
          repair_model: selectedRepairModel || undefined,
          enrichment_model: selectedEnrichmentModel || undefined,
        })

        if (!data?.nodes || data.nodes.length === 0) {
          throw new CEEError(
            'Draft graph is empty; unable to construct model',
            400,
            {
              code: 'CEE_GRAPH_INVALID',
              reason: 'empty_graph',
              node_count: data?.nodes?.length ?? 0,
              edge_count: data?.edges?.length ?? 0,
              source: 'ui_empty_graph_guard',
            }
          )
        }

        setState({ data, loading: false, error: null, guidance: null, retryAfterSeconds: null })
        return data
      } catch (error) {
        const ceeError = error instanceof CEEError
          ? error
          : new CEEError((error as Error).message || 'Draft failed', 500)

        const details = ceeError.details as any

        // Handle 400 errors for invalid/unavailable models
        // Auto-reset affected models to defaults and provide user feedback
        if (ceeError.status === 400 && details) {
          const errorMessage = ceeError.message?.toLowerCase() || ''
          const detailsStr = JSON.stringify(details).toLowerCase()

          // Check if error is related to model availability/validity
          const isModelError =
            errorMessage.includes('model') ||
            detailsStr.includes('model') ||
            detailsStr.includes('unknown model') ||
            detailsStr.includes('disabled model') ||
            detailsStr.includes('blocked model')

          if (isModelError) {
            const store = useCanvasStore.getState()

            // Reset all non-default models to defaults as we can't determine which specific model failed
            if (store.selectedGenerationModel !== null) {
              store.resetModelToDefault('generation')
            }
            if (store.selectedRepairModel !== null) {
              store.resetModelToDefault('repair')
            }
            if (store.selectedEnrichmentModel !== null) {
              store.resetModelToDefault('enrichment')
            }

            // Update error message to inform user
            ceeError.message = "That model isn't available. Reverted to recommended default."
          }
        }

        let guidance: DraftGuidance | null = null
        let retryAfterSeconds: number | null = null
        let reason: string | undefined
        let code: string | undefined
        let nodeCount: number | undefined
        let edgeCount: number | undefined
        let traceId: string | undefined

        if (details && typeof details === 'object') {
          if (typeof details.reason === 'string') {
            reason = details.reason
          }
          if (typeof details.code === 'string') {
            code = details.code
          }
          if (typeof details.node_count === 'number') {
            nodeCount = details.node_count
          }
          if (typeof details.edge_count === 'number') {
            edgeCount = details.edge_count
          }
          const topTrace = details.trace
          if (topTrace && typeof topTrace === 'object' && typeof topTrace.request_id === 'string') {
            traceId = topTrace.request_id
          }

          const innerDetails = details.details
          if (innerDetails && typeof innerDetails === 'object') {
            if (!reason && typeof innerDetails.reason === 'string') {
              reason = innerDetails.reason
            }
            if (!code && typeof innerDetails.code === 'string') {
              code = innerDetails.code
            }
            if (nodeCount === undefined && typeof innerDetails.node_count === 'number') {
              nodeCount = innerDetails.node_count
            }
            if (edgeCount === undefined && typeof innerDetails.edge_count === 'number') {
              edgeCount = innerDetails.edge_count
            }
            const innerTrace = innerDetails.trace
            if (!traceId && innerTrace && typeof innerTrace === 'object' && typeof innerTrace.request_id === 'string') {
              traceId = innerTrace.request_id
            }
          }
        }

        if (reason === 'empty_draft' || reason === 'empty_graph' || code === 'CEE_GRAPH_INVALID') {
          const questions: string[] = [
            'What are the concrete options you are deciding between?',
            'What are the main factors that could influence this decision?',
            'What outcome or KPI are you trying to optimise?',
          ]
          guidance = {
            level: 'needs_clarification',
            questions,
            hint: 'Add more context about your options, key factors, and what success looks like.',
          }
        }

        if (details && typeof details === 'object') {
          const suggested = Array.isArray(details.suggested_questions)
            ? details.suggested_questions.filter((value: unknown) => typeof value === 'string')
            : []
          const hint = typeof details.hint === 'string' ? details.hint : undefined

          if (suggested.length > 0 || hint) {
            const rawLevel = details.level
            const allowedLevels: DraftGuidance['level'][] = ['ready', 'needs_clarification', 'not_ready']
            const level = allowedLevels.includes(rawLevel) ? rawLevel : 'needs_clarification'
            guidance = {
              level,
              questions: guidance ? [...guidance.questions, ...suggested] : suggested,
              hint: hint ?? guidance?.hint,
            }
          }
        }

        if (ceeError.status === 429) {
          const raw =
            (details && typeof details === 'object' && typeof details.retry_after === 'number'
              ? details.retry_after
              : undefined) ||
            (details && typeof details === 'object' && typeof details.retry_after_seconds === 'number'
              ? details.retry_after_seconds
              : undefined)

          if (typeof raw === 'number' && raw > 0 && raw < 600) {
            retryAfterSeconds = raw
          }
        }

        if ((import.meta as any).env?.DEV) {
          try {
            console.debug('[CEE] Draft error', {
              message: ceeError.message,
              status: ceeError.status,
              code,
              reason,
              nodeCount,
              edgeCount,
              correlationId: ceeError.correlationId,
              traceId,
            })
          } catch {
            // Ignore logging errors in DEV-only diagnostics path
          }
        }

        setState({
          data: null,
          loading: false,
          error: ceeError,
          guidance,
          retryAfterSeconds,
        })
        throw ceeError
      }
    },
    []
  )

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null, guidance: null, retryAfterSeconds: null })
  }, [])

  return {
    ...state,
    draft,
    reset,
  }
}
