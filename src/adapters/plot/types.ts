export type ConfidenceLevel = 'low' | 'medium' | 'high'

export interface ReportV1 {
  schema: 'report.v1'
  meta: {
    seed: number
    response_id: string
    elapsed_ms: number
  }
  model_card: {
    response_hash: string
    response_hash_algo: 'sha256'
    normalized: true
  }
  results: {
    conservative: number
    likely: number
    optimistic: number
    units?: 'currency' | 'percent' | 'count'
    unitSymbol?: string
  }
  confidence: {
    level: ConfidenceLevel
    why: string
  }
  drivers: Array<{
    label: string
    polarity: 'up' | 'down' | 'neutral'
    strength: 'low' | 'medium' | 'high'
    action?: string
    kind?: 'node' | 'edge' // Driver type for canvas highlighting
    node_id?: string // For canvas highlighting
    edge_id?: string // For canvas highlighting
  }>
  critique?: string[]
  // Debug slices (Phase 2+) - only present when include_debug=true
  // These fields DO NOT affect response_hash and MUST NOT be persisted
  debug?: {
    compare?: Record<string, {
      p10: number
      p50: number
      p90: number
      top3_edges: Array<{
        edge_id: string
        from: string
        to: string
        label?: string
        weight: number
      }>
    }>
    inspector?: {
      edges: Array<{
        edge_id: string
        from: string
        to: string
        label: string
        weight: number
        belief?: number
        provenance?: string
      }>
    }
  }
}

export interface ErrorV1 {
  schema: 'error.v1'
  code: 'BAD_INPUT' | 'LIMIT_EXCEEDED' | 'RATE_LIMITED' | 'UNAUTHORIZED' | 'SERVER_ERROR'
  error: string
  hint?: string
  fields?: {
    field?: 'graph.nodes' | 'graph.edges' | string
    max?: number
  }
  retry_after?: number
}

export interface LimitsV1 {
  nodes: { max: number }
  edges: { max: number }
}

export interface TemplateSummary {
  id: string
  name: string
  version: string
  description: string
}

export interface TemplateDetail extends TemplateSummary {
  default_seed: number
  graph: unknown
}

export interface TemplateListV1 {
  items: TemplateSummary[]
}

export interface RunRequest {
  template_id: string
  seed?: number
  mode?: 'strict' | 'real'
  inputs?: Record<string, unknown>
  graph?: {
    nodes: Array<{ id: string; data?: { label?: string; body?: string; [key: string]: unknown }; [key: string]: unknown }>
    edges: Array<{ id: string; source: string; target: string; data?: { confidence?: number; weight?: number; [key: string]: unknown }; [key: string]: unknown }>
  } // Optional: if provided, use this graph instead of fetching template
  // Optional advanced knobs for causal analysis (not exposed in UI yet)
  k_samples?: number
  treatment_node?: string
  outcome_node?: string
  baseline_value?: number
}

export type StreamEvent =
  | { type: 'hello'; data: { response_id: string } }
  | { type: 'tick'; data: { index: number } }
  | { type: 'reconnected'; data: { attempt: number } }
  | { type: 'done'; data: { response_id: string } }
  | { type: 'error'; data: ErrorV1 }

/**
 * Zod Schemas for Debug Slices (Type Safety)
 *
 * Server returns debug slices when `include_debug=true`:
 * - debug.compare[option_id] → { p10, p50, p90, top3_edges[] }
 * - debug.inspector.edges[] → { edge_id, from, to, label, weight, belief?, provenance? }
 *
 * Parse helpers fail closed with Sentry logging.
 */
import { z } from 'zod'

// Debug Compare slice schema (per option)
export const DebugCompareSchema = z.object({
  p10: z.number(),
  p50: z.number(),
  p90: z.number(),
  top3_edges: z.array(z.object({
    edge_id: z.string(),
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    weight: z.number()
  }))
})

export type DebugCompare = z.infer<typeof DebugCompareSchema>

// Debug Compare map (option_id → stats)
export const DebugCompareMapSchema = z.record(z.string(), DebugCompareSchema)
export type DebugCompareMap = z.infer<typeof DebugCompareMapSchema>

// Debug Inspector edge facts schema
export const DebugInspectorEdgeSchema = z.object({
  edge_id: z.string(),
  from: z.string(),
  to: z.string(),
  label: z.string(),
  weight: z.number(),
  belief: z.number().optional().default(1.0),
  provenance: z.string().optional().default('template')
})

export type DebugInspectorEdge = z.infer<typeof DebugInspectorEdgeSchema>

/**
 * Parse debug.compare slice with fail-closed fallback
 * @param data - Raw debug.compare data from server
 * @returns Parsed DebugCompareMap or null if invalid
 */
export function parseDebugCompare(data: unknown): DebugCompareMap | null {
  try {
    return DebugCompareMapSchema.parse(data)
  } catch (err) {
    console.warn('[DebugSlice] Failed to parse debug.compare:', err)
    // TODO: Sentry.captureException(err, { tags: { type: 'debug-slice-parse', slice: 'compare' } })
    return null
  }
}

/**
 * Parse debug.inspector.edges slice with fail-closed fallback
 * @param data - Raw debug.inspector.edges data from server
 * @returns Parsed DebugInspectorEdge[] or null if invalid
 */
export function parseDebugInspectorEdges(data: unknown): DebugInspectorEdge[] | null {
  try {
    return z.array(DebugInspectorEdgeSchema).parse(data)
  } catch (err) {
    console.warn('[DebugSlice] Failed to parse debug.inspector.edges:', err)
    // TODO: Sentry.captureException(err, { tags: { type: 'debug-slice-parse', slice: 'inspector' } })
    return null
  }
}
