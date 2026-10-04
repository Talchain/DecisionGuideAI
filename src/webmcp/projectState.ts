/**
 * EXPERIMENT ONLY (#76) — package CEE's canonical scenario read for ChatGPT.
 *
 * GROUNDING CONTRACT (plan §4):
 *  - The source is `fetchScenarioGraph` (CEE `POST /scenarios/:id/graph`), the
 *    same canonical read the UI hydrates from. Nothing is recomputed here.
 *  - Figures appear ONLY when CEE says the analysis is `complete_current`.
 *    A stale, blocked, running or absent analysis carries no figures at all.
 *  - Analysis text is CEE's gated `summary` and CEE's blocker `message`s,
 *    verbatim. A withheld leader (`leading_option_id: null`) stays withheld.
 *  - Factor values: CEE's `display_value`, else `raw_value` + `unit`; a bare
 *    model-scale `value` is never shown (it is not in the user's units).
 *  - Authorship: the UI's own provenance classifier and labels.
 *  - Output is kept under ~1,500 characters by dropping items, never by
 *    rounding numbers.
 */
import { classifyValueProvenance, VALUE_PROVENANCE_LABEL } from '../canvas/domain/valueProvenance'
import type { ScenarioGraphResult } from '../adapters/cee/scenarioGraph'
import type { WebMcpResult } from './modelContext'

export const OUTPUT_BUDGET_CHARS = 1500
export const GROUNDING_RULE =
  'Quote only figures that appear in this result. Anything missing or withheld is not available: say so, do not estimate it. This result replaces any earlier Olumi result.'

type Json = Record<string, unknown>

function asRecord(v: unknown): Json | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}

interface NodeView {
  id: string
  kind: string
  label: string
  observed: Json | null
}

function nodesOf(graph: unknown): NodeView[] {
  const nodes = asRecord(graph)?.nodes
  if (!Array.isArray(nodes)) return []
  const out: NodeView[] = []
  for (const n of nodes) {
    const r = asRecord(n)
    const id = str(r?.id)
    const kind = str(r?.kind)
    const label = str(r?.label)
    if (id && kind && label) out.push({ id, kind, label, observed: asRecord(r?.observed_state) })
  }
  return out
}

function valueOf(observed: Json | null): string | null {
  if (!observed) return null
  const display = str(observed.display_value)
  if (display) return display
  const unit = str(observed.unit)
  const raw = observed.raw_value
  if (unit && typeof raw === 'number' && Number.isFinite(raw)) return `${raw} ${unit}`
  return null
}

function authorshipOf(observed: Json | null): string {
  const cls = classifyValueProvenance(typeof observed?.source === 'string' ? observed.source : null)
  return cls ? VALUE_PROVENANCE_LABEL[cls.kind] : 'Source not recorded'
}

export type AnalysisKind =
  | 'never_run'
  | 'running'
  | 'blocked'
  | 'refused'
  | 'complete_current'
  | 'complete_stale'
  | 'unknown_degraded'
  | 'none'

export function analysisKindOf(analysisState: unknown): AnalysisKind {
  const kind = str(asRecord(asRecord(analysisState)?.run_state)?.kind)
  switch (kind) {
    case 'never_run':
    case 'running':
    case 'blocked':
    case 'refused':
    case 'complete_current':
    case 'complete_stale':
    case 'unknown_degraded':
      return kind
    default:
      return 'none'
  }
}

function blockerMessages(analysisState: unknown): string[] {
  const blockers = asRecord(asRecord(analysisState)?.run_state)?.blockers
  if (!Array.isArray(blockers)) return []
  return blockers.map((b) => str(asRecord(b)?.message)).filter((m): m is string => m !== null).slice(0, 3)
}

const NEXT_BY_KIND: Record<AnalysisKind, string> = {
  complete_current: 'Analysis is current. After any approved change, call olumi_run_analysis.',
  complete_stale: 'The model changed since the last analysis: call olumi_run_analysis before discussing results.',
  never_run: 'No analysis yet: call olumi_run_analysis.',
  none: 'No analysis yet: call olumi_run_analysis.',
  running: 'Analysis is running: call olumi_get_state again shortly.',
  blocked: 'Analysis is blocked for the reasons given; the user resolves them in Olumi.',
  refused: 'Olumi declined to run this analysis; see the reasons given.',
  unknown_degraded: 'Olumi cannot confirm the analysis state; call olumi_run_analysis.',
}

function analysisView(kind: AnalysisKind, analysisState: unknown, analysisResult: unknown, labelById: Map<string, string>): Json {
  const view: Json = { state: kind }
  if (kind === 'complete_current') {
    const r = asRecord(analysisResult)
    const summary = str(r?.summary)
    if (summary) view.summary = summary
    const leaderId = str(r?.leading_option_id)
    view.leading_option = leaderId ? (labelById.get(leaderId) ?? null) : null
    if (!leaderId) view.leader_withheld = true
    const wp = asRecord(r?.win_probabilities)
    if (wp) {
      const byLabel: Json = {}
      for (const [id, p] of Object.entries(wp)) {
        if (typeof p === 'number' && Number.isFinite(p)) byLabel[labelById.get(id) ?? id] = p
      }
      if (Object.keys(byLabel).length > 0) view.win_probability_by_option = byLabel
    }
  } else if (kind === 'blocked' || kind === 'refused') {
    view.reasons = blockerMessages(analysisState)
  } else if (kind === 'complete_stale') {
    view.rerun_required = true
  }
  return view
}

export interface ProjectInput {
  scenarioId: string
  read: ScenarioGraphResult
  turnInFlight: boolean
}

export function projectState(input: ProjectInput): WebMcpResult {
  const { read, turnInFlight } = input
  const activity = turnInFlight ? 'olumi_is_working' : 'idle'
  if (read.status !== 'graph') {
    const reason: Record<string, string> = {
      absent: turnInFlight ? 'The model is still being built.' : 'This scenario has no model yet.',
      notReadable: 'Olumi could not read this scenario.',
      unavailable: 'Olumi is temporarily unavailable.',
      signInRequired: 'Sign in to Olumi to read this scenario.',
      refused: 'Olumi refused to read this scenario for this user.',
      unusable: 'Olumi returned a model it could not use.',
    }
    return {
      ok: read.status === 'absent',
      status: read.status === 'absent' ? (turnInFlight ? 'building' : 'no_model') : read.status,
      activity,
      message: reason[read.status] ?? read.status,
      next: read.status === 'absent' && !turnInFlight ? 'Call olumi_build_model with the user’s brief.' : 'Call olumi_get_state again shortly.',
      rule: GROUNDING_RULE,
    }
  }

  const nodes = nodesOf(read.graph)
  const labelById = new Map(nodes.map((n) => [n.id, n.label]))
  const kind = analysisKindOf(read.analysisState)
  const pick = (k: string) => nodes.filter((n) => n.kind === k)

  const factors = pick('factor').map((n) => {
    const v = valueOf(n.observed)
    return v ? { label: n.label, value: v, source: authorshipOf(n.observed) } : { label: n.label }
  })

  const result: Json = {
    ok: true,
    status: 'model_ready',
    activity,
    brief: read.briefText ? read.briefText.slice(0, 240) : null,
    goal: pick('goal').map((n) => n.label),
    options: pick('option').map((n) => n.label),
    factors,
    risks: pick('risk').map((n) => n.label),
    constraints: pick('constraint').map((n) => n.label),
    analysis: analysisView(kind, read.analysisState, read.analysisResult, labelById),
    next: NEXT_BY_KIND[kind],
    rule: GROUNDING_RULE,
  }
  return fitBudget(result)
}

/** Drop list items (factors first, then risks/constraints) until under budget. Never rounds a number. */
function fitBudget(result: Json): Json {
  const size = () => JSON.stringify(result).length
  const trimmed: string[] = []
  for (const key of ['factors', 'risks', 'constraints', 'options'] as const) {
    const list = result[key]
    if (!Array.isArray(list)) continue
    while (size() > OUTPUT_BUDGET_CHARS && list.length > 3) {
      list.pop()
      if (!trimmed.includes(key)) trimmed.push(key)
    }
  }
  if (trimmed.length > 0) result.truncated = `Some ${trimmed.join(', ')} omitted for length; they are visible in Olumi.`
  return result
}
