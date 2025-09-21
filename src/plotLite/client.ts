// Thin client for PLoT‑lite (flag-gated externally). Behaviour-neutral while flag is OFF.

export type Severity = 'BLOCKER' | 'IMPROVEMENT' | 'OBSERVATION'
export type CritiqueItem = { note: string; severity: Severity; fix_available: boolean }

export type Draft = {
  id: string
  title: string
  why: string
  suggestion_confidence: number
  parse_json: Record<string, unknown>
  parse_json_hash: string
  critique: CritiqueItem[]
  threshold_crossings?: Array<{ from: string | number; to: string | number }>
  fork_suggested?: boolean
  fork_labels?: string[]
}

export type DraftFlowsResp = { drafts: Draft[] }
export type CritiqueResp = { critique: CritiqueItem[] }

const BASE: string = (import.meta as any).env?.VITE_PLOT_LITE_BASE_URL || '/plot-lite'

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`plot-lite ${path} ${res.status}`)
  return res.json() as Promise<T>
}

export function postDraftFlows(body: {
  seed: number
  parse_text: string
  context?: Record<string, unknown>
  board_feedback?: Record<string, unknown>
}) {
  return post<DraftFlowsResp>('/draft-flows', body)
}

export function postCritique(body: { parse_json: Record<string, unknown> }) {
  return post<CritiqueResp>('/critique', body)
}
