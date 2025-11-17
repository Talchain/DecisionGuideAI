/**
 * M2: Assistants API Types (v1.3.1)
 * Draft my model integration
 */

// Draft Request
export interface DraftRequest {
  prompt: string
  context?: string
  files?: Array<{
    name: string
    content: string
    type: string
  }>
  clarifier_answers?: Array<{
    question_id: string
    answer: string | string[] // MCQ can be multiple
  }>
}

// Draft Response (sync)
export interface DraftResponse {
  schema: 'draft.v1'
  graph: {
    nodes: Array<{
      id: string
      label: string
      type?: string
      meta?: {
        suggested_position?: { x: number; y: number }
      }
      rationale?: string // S7-RATIONALE: Explains why this node was added
    }>
    edges: Array<{
      id: string
      from: string
      to: string
      label?: string
      rationale?: string // S7-RATIONALE: Explains why this edge was added
    }>
  }
  provenance?: {
    documents: Array<{
      id: string
      name: string
      snippet?: string
      char_offset?: number
    }>
    citations: Array<{
      node_id: string
      document_ids: string[]
    }>
  }
  clarifier?: {
    questions: Array<{
      id: string
      text: string
      type: 'mcq' | 'text'
      options?: string[]
      required?: boolean
      multiple?: boolean // AUDIT FIX 4: Explicit flag for multi-select MCQs
      impact_hint?: string // S7-HINTS: Optional hint explaining impact of this question
    }>
    round: number
  }
}

// Stream Events (SSE format)
export type DraftStreamEvent =
  | { type: 'node'; data: { id: string; label: string; type?: string } }
  | { type: 'edge'; data: { id: string; from: string; to: string; label?: string } }
  | { type: 'provenance'; data: { document?: any; citation?: any } }
  | { type: 'complete'; data: DraftResponse }
  | { type: 'error'; data: { message: string; code?: string } }

// Assistants API Error
export interface AssistError {
  code: 'TIMEOUT' | 'NETWORK_ERROR' | 'SERVER_ERROR' | 'BAD_INPUT'
  message: string
  details?: any
}
