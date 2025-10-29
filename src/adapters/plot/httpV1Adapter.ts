/**
 * HTTP v1 adapter - implements UI interface using PLoT v1 API
 * Maps between UI types (ReportV1, ErrorV1) and v1 types
 */

import type {
  RunRequest,
  ReportV1,
  ErrorV1,
  LimitsV1,
  TemplateSummary,
  TemplateDetail,
  TemplateListV1,
  ConfidenceLevel,
} from './types'
import type {
  V1RunRequest,
  V1RunResult,
  V1Error,
  V1StreamHandlers,
} from './v1/types'
import type { ApiGraph, UiGraph, RunResponse } from '../types/plot'
import * as v1http from './v1/http'
import { runStream as v1runStream } from './v1/sseClient'
import { V1_LIMITS } from './v1/types'
import { toApiGraph, isApiGraph, graphToV1Request, computeClientHash, type ReactFlowGraph } from './v1/mapper'
import { toUiReport } from './v1/reportNormalizer'
import { shouldUseSync } from './v1/constants'

/**
 * Load template graph from live v1 endpoint
 */
async function loadTemplateGraph(templateId: string): Promise<any> {
  const response = await v1http.templateGraph(templateId)
  return response.graph
}

/**
 * Map UI confidence (0-1) to ConfidenceLevel
 */
function mapConfidenceLevel(conf: number): ConfidenceLevel {
  if (conf >= 0.7) return 'high'
  if (conf >= 0.4) return 'medium'
  return 'low'
}

/**
 * Map v1 RunResult to UI ReportV1
 */
function mapV1ResultToReport(
  result: V1RunResult,
  templateId: string,
  executionMs: number
): ReportV1 {
  // Use structured summary if available, otherwise fall back to parsing answer
  let conservative: number, likely: number, optimistic: number, units: string

  if (result.summary) {
    conservative = result.summary.conservative
    likely = result.summary.likely
    optimistic = result.summary.optimistic
    units = result.summary.units || 'units'
  } else {
    // Fallback: parse answer for numeric values (best effort)
    const answerMatch = result.answer.match(/(\d+\.?\d*)/g)
    likely = answerMatch ? parseFloat(answerMatch[0]) : 0
    conservative = likely * 0.8
    optimistic = likely * 1.2
    units = 'units'
  }

  // Extract drivers from explain_delta.top_drivers (actual API structure)
  const drivers = (result.explain_delta?.top_drivers ?? []).map((d) => ({
    label: d.label || d.node_id || d.edge_id || 'Unknown',
    polarity: (d.impact || 0) > 0 ? 'up' : (d.impact || 0) < 0 ? 'down' : 'neutral',
    strength: Math.abs(d.impact || 0) > 0.7 ? 'high' : Math.abs(d.impact || 0) > 0.3 ? 'medium' : 'low',
    // Preserve metadata for canvas highlighting
    kind: d.kind, // 'node' or 'edge'
    node_id: d.node_id,
    edge_id: d.edge_id,
  }))

  return {
    schema: 'report.v1',
    meta: {
      seed: result.seed || 1337,
      response_id: result.response_hash || `http-v1-${Date.now()}`,
      elapsed_ms: executionMs,
    },
    model_card: {
      response_hash: result.response_hash || '',
      response_hash_algo: 'sha256',
      normalized: true,
    },
    results: {
      conservative,
      likely,
      optimistic,
      units,
    },
    confidence: {
      level: mapConfidenceLevel(result.confidence),
      why: result.explanation,
    },
    drivers,
  }
}

/**
 * Map v1 Error to UI ErrorV1
 */
function mapV1ErrorToUI(error: V1Error): ErrorV1 {
  return {
    schema: 'error.v1',
    code: error.code as any, // Type compatible
    error: error.message,
    hint: undefined,
    fields: error.field
      ? {
          field: error.field,
          max: error.max,
        }
      : undefined,
    retry_after: error.retry_after,
  }
}

/**
 * Map template graph to V1 request with validation and deterministic hash
 */
function mapGraphToV1Request(graph: any, seed?: number): V1RunRequest {
  // Cast to ReactFlowGraph for type safety
  const rfGraph: ReactFlowGraph = {
    nodes: graph.nodes || [],
    edges: graph.edges || [],
  }

  // Use real mapper with validation (throws ValidationError if limits exceeded)
  const v1Request = graphToV1Request(rfGraph, seed)

  // Add deterministic client hash for idempotency
  const clientHash = computeClientHash(rfGraph, seed)

  return {
    ...v1Request,
    clientHash,
  }
}

/**
 * HTTP v1 Adapter
 */
export const httpV1Adapter = {
  // Run: uses sync endpoint only (stream not deployed yet)
  async run(input: RunRequest): Promise<ReportV1> {
    // Use provided graph (from canvas edits), or fetch template as fallback
    const graph = input.graph || await loadTemplateGraph(input.template_id)

    try {
      // Check if graph is already in API shape (from /v1/templates/{id}/graph)
      // If not, convert UI shape to API shape
      const apiGraph: ApiGraph = isApiGraph(graph)
        ? graph
        : toApiGraph(graph as UiGraph)

      // Build request with API shape + optional knobs
      const requestBody: any = {
        graph: apiGraph,
        seed: input.seed,
      }

      // Add optional knobs if provided
      if (input.k_samples !== undefined) requestBody.k_samples = input.k_samples
      if (input.treatment_node) requestBody.treatment_node = input.treatment_node
      if (input.outcome_node) requestBody.outcome_node = input.outcome_node
      if (input.baseline_value !== undefined) requestBody.baseline_value = input.baseline_value

      const nodeCount = apiGraph.nodes.length

      // Always use sync endpoint (stream not deployed yet - Oct 2025)
      if (import.meta.env.DEV) {
        console.log(
          `🚀 [httpV1] POST /v1/run (${nodeCount} nodes, using sync endpoint) ` +
          `template=${input.template_id}, seed=${input.seed}`
        )
      }

      const response = await v1http.runSync(requestBody)

      if (import.meta.env.DEV) {
        console.log(`✅ [httpV1] Sync completed: ${response.execution_ms}ms`)
      }

      // Normalize response envelope
      const normalized = toUiReport(response.result as RunResponse)

      // Map confidence 0-1 to ConfidenceLevel
      let confidenceLevel: ConfidenceLevel = 'medium'
      if (normalized.confidence !== undefined) {
        if (normalized.confidence >= 0.7) confidenceLevel = 'high'
        else if (normalized.confidence < 0.4) confidenceLevel = 'low'
      }

      // Map to ReportV1 format expected by UI
      //
      // DETERMINISM NOTES:
      // - seed: Prefer response seed (meta.seed or model_card.seed), fall back to input seed,
      //   then 1337 if neither provided. Expected path: backend should echo seed.
      //   QA: Verify backend always returns seed in response.
      // - hash: Prefer response hash (model_card.response_hash or response_hash).
      //   Fallback to timestamp generates non-deterministic ID (should rarely trigger).
      //   QA: Verify backend always returns response_hash for deterministic runs.
      return {
        schema: 'report.v1',
        meta: {
          seed: normalized.seed || input.seed || 1337,
          response_id: normalized.hash || `http-v1-${Date.now()}`,
          elapsed_ms: response.execution_ms || 0,
        },
        model_card: {
          response_hash: normalized.hash || '',
          response_hash_algo: 'sha256',
          normalized: true,
        },
        results: {
          conservative: normalized.conservative || 0,
          likely: normalized.mostLikely || 0,
          optimistic: normalized.optimistic || 0,
          units: normalized.units || 'units',
        },
        confidence: {
          level: confidenceLevel,
          why: normalized.explanation || '',
        },
        drivers: normalized.drivers,
      }
    } catch (err: any) {
      // Handle validation errors from mapper
      if (err.code === 'LIMIT_EXCEEDED' || err.code === 'BAD_INPUT') {
        throw {
          schema: 'error.v1',
          code: err.code,
          error: err.message,
          fields: err.field ? { field: err.field, max: err.max } : undefined,
        } as ErrorV1
      }
      // Handle v1 HTTP errors
      throw mapV1ErrorToUI(err as V1Error)
    }
  },

  // Templates (live v1 endpoints)
  async templates(): Promise<TemplateListV1> {
    try {
      const response = await v1http.templates()

      // v1 API returns bare array, not wrapped object
      if (!Array.isArray(response)) {
        if (import.meta.env.DEV) {
          console.error('[httpV1] Invalid templates response:', response)
        }
        throw {
          code: 'SERVER_ERROR',
          message: 'Invalid templates response from server',
        } as V1Error
      }

      // Map v1 API fields to UI format
      // NOTE: v1 API does not include version field. Using '1.0' as default.
      // This is a placeholder until API provides explicit versioning.
      return {
        schema: 'template-list.v1',
        items: response.map(t => ({
          id: t.id,
          name: t.label, // label → name
          description: t.summary, // summary → description
          version: '1.0', // Default version (API doesn't provide this field)
        })),
      }
    } catch (err: any) {
      throw mapV1ErrorToUI(err as V1Error)
    }
  },

  async template(id: string): Promise<TemplateDetail> {
    try {
      // Fetch graph and list in parallel (not sequential)
      const [graphResponse, listResponse] = await Promise.all([
        v1http.templateGraph(id),
        v1http.templates(),
      ])

      // Find template metadata from list (v1 API returns bare array)
      const metadata = listResponse.find(t => t.id === id)

      if (!metadata) {
        throw {
          code: 'BAD_INPUT',
          message: `Template not found: ${id}`,
        } as V1Error
      }

      // Handle API response format: API returns graph directly at top level
      // Response is: { nodes: [], edges: [] } not { graph: { nodes: [], edges: [] } }
      const graph = (graphResponse as any).graph || graphResponse
      const default_seed = (graphResponse as any).default_seed

      // NOTE: v1 API does not include version field. Using '1.0' as default.
      // This is a placeholder until API provides explicit versioning.
      return {
        id: metadata.id,
        name: metadata.label, // label → name
        version: '1.0', // Default version (API doesn't provide this field)
        description: metadata.summary, // summary → description
        default_seed,
        graph,
      }
    } catch (err: any) {
      throw mapV1ErrorToUI(err as V1Error)
    }
  },

  // Limits
  async limits(): Promise<LimitsV1> {
    return {
      nodes: { max: V1_LIMITS.MAX_NODES },
      edges: { max: V1_LIMITS.MAX_EDGES },
    }
  },

  // Health (optional, specific to httpV1)
  async health() {
    return v1http.health()
  },

  // SSE streaming: NOT AVAILABLE YET (endpoint not deployed - Oct 2025)
  // When /v1/stream endpoint goes live, uncomment the code below and update probe.ts
  // to set result.endpoints.stream = true
  //
  // stream: {
  //   run(input: RunRequest, handlers: { ... }): () => void {
  //     // Stream implementation here
  //   }
  // }
}
