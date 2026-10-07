/**
 * `_method_result` v:1 — the typed rows behind a probe's chat reply (accel P24 / SCI-10).
 *
 * "Test without this link" and "What would change this?" answer from typed results with no model call; the reply puts
 * those results into words. This sidecar carries the SAME lines as typed rows bound to the model items they are about,
 * so the conversation can show them as a card and the canvas can mark the link that was tested.
 *
 * ⛔ A LOCAL COPY OF CEE's ENVELOPE, versioned (DL §7.3): no `@talchain/schemas` release. Anything this file does not
 * know — another version, another outcome, a malformed row — reads as `unavailable` and renders nothing (and says so
 * once in the console). The inner `result` is re-validated through the pinned schemas and never rendered.
 *
 * ⛔ NOTHING BUT WHAT THE REPLY SAYS (Science 393023 ruling 1): `displayableMethodResult` shows rows only when every row
 * and every figure is a substring of the reply the user is reading. CEE enforces the same at egress; this is the
 * consumer's half, so a drifted producer shows nothing rather than a line the chat never said. DGAI never formats a
 * figure: `figures` are CEE's display strings.
 */
import { z } from 'zod'
import { DecisionFlipLinkV1Schema, StructuralChallengeResultV1Schema } from '@talchain/schemas/boundary'
import { ADDITIVE_EXTENSIONS_KEY } from './responseParser'

const id = z.string().min(1).max(200)
const text = z.string().min(1).max(1600).refine(s => s.trim().length > 0)

/** CEE `rank.ts` ItemRef: six kinds, no `limit`. */
export const MethodItemRefSchema = z.union([
  z.object({ kind: z.enum(['option', 'factor', 'risk', 'outcome', 'goal']), id }).strict(),
  z.object({ kind: z.literal('link'), from_id: id, to_id: id }).strict(),
])
export type MethodItemRef = z.infer<typeof MethodItemRefSchema>

/** The outcomes a probe can end in. Only `completed` (test_link) and `measured` (what_changes) carry figure rows. */
export const METHOD_RESULT_OUTCOMES = ['completed', 'measured', 'stale', 'honest_limit', 'refused', 'unsupported', 'unavailable', 'timed_out', 'withheld'] as const
const SHOWN_OUTCOMES: ReadonlySet<string> = new Set(['completed', 'measured'])

const rowSchema = z.object({
  row_id: id,
  item_refs: z.array(MethodItemRefSchema).max(12),
  text,
  // SCI-08 reuses v:1 for Olumi-drafted method rows; SCI-10 emits server-built rows only.
  provenance: z.enum(['server_built', 'olumi_drafted']),
  figures: z.array(z.string().min(1).max(80)).max(12).optional(),
  // SCI-08's evidence badge. Accepted so v:1 carries it; this card never renders it.
  dsk: z.unknown().optional(),
}).strict()

export const MethodResultV1Schema = z.object({
  v: z.literal(1),
  action_id: id,
  outcome: z.enum(METHOD_RESULT_OUTCOMES),
  scenario_id: id,
  turn_id: id,
  run: z.object({
    graph_hash_at_run: z.string().regex(/^[0-9a-f]{16}$/u),
    run_id: id.optional(),
    computed_at: z.string().refine(s => Number.isFinite(Date.parse(s))).optional(),
  }).strict(),
  rows: z.array(rowSchema).max(40),
  result: z.unknown().optional(),
}).strict().superRefine((m, ctx) => {
  if (new Set(m.rows.map(r => r.row_id)).size !== m.rows.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'duplicate row_id', path: ['rows'] })
  }
  m.rows.forEach((row, i) => {
    for (const figure of row.figures ?? []) {
      if (!row.text.includes(figure)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'figure not in its row', path: ['rows', i, 'figures'] })
    }
  })
  // The inner typed result, through the pinned contract. It is evidence for the rows, never rendered.
  if (m.result !== undefined) {
    const inner = m.action_id === 'test_link' ? StructuralChallengeResultV1Schema.safeParse(m.result)
      : m.action_id === 'what_changes' ? z.array(DecisionFlipLinkV1Schema).safeParse(m.result)
      : { success: true }
    if (!inner.success) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'inner result fails its contract', path: ['result'] })
  }
})
export type MethodResultV1 = z.infer<typeof MethodResultV1Schema>

export type MethodResultRead =
  | { status: 'available'; methodResult: MethodResultV1 }
  | { status: 'unavailable'; reason: 'absent' | 'unknown_version' | 'invalid' }

export function methodResultValue(response: unknown): unknown {
  if (response === null || typeof response !== 'object') return undefined
  const root = response as Record<string, unknown>
  const additive = root[ADDITIVE_EXTENSIONS_KEY] as Record<string, unknown> | undefined
  return root._method_result !== undefined ? root._method_result : additive?._method_result
}

export function readMethodResult(response: unknown): MethodResultRead {
  try {
    const value = methodResultValue(response)
    if (value === undefined || value === null) return { status: 'unavailable', reason: 'absent' }
    const version = typeof value === 'object' ? (value as { v?: unknown }).v : undefined
    if (version !== 1) {
      console.info('[v5] _method_result: unknown version, not shown', { v: version })
      return { status: 'unavailable', reason: 'unknown_version' }
    }
    const parsed = MethodResultV1Schema.safeParse(value)
    if (parsed.success) return { status: 'available', methodResult: parsed.data }
    console.info('[v5] _method_result: invalid, not shown', { issues: parsed.error.issues.slice(0, 3).map(i => `${i.path.join('.')}: ${i.message}`) })
    return { status: 'unavailable', reason: 'invalid' }
  } catch {
    return { status: 'unavailable', reason: 'invalid' }
  }
}

/** The action ids this build has a card for. Any other id renders nothing until the UI knows its heading. */
export const METHOD_RESULT_CARD_ACTIONS: ReadonlySet<string> = new Set(['test_link', 'what_changes'])

/**
 * The result as the card may show it, or `null`: a known action, an outcome that carries figure rows, at least one row,
 * and every row and figure found verbatim in the reply the user is reading.
 */
export function displayableMethodResult(m: MethodResultV1 | null | undefined, replyText: string): MethodResultV1 | null {
  if (!m || !METHOD_RESULT_CARD_ACTIONS.has(m.action_id) || !SHOWN_OUTCOMES.has(m.outcome) || m.rows.length === 0) return null
  const inReply = m.rows.every(r => replyText.includes(r.text) && (r.figures ?? []).every(f => replyText.includes(f)))
  return inReply ? m : null
}

/** The Run a result was computed on, and the Run on screen now. A mark stands only while they are the same Run. */
export type MethodRunStamp = { graphHashAtRun: string; runId?: string | null }

export function sameMethodRun(m: Pick<MethodResultV1, 'run'>, current: MethodRunStamp | null | undefined): boolean {
  if (!current || m.run.graph_hash_at_run !== current.graphHashAtRun) return false
  // Both sides name a run: they must be the same one. Either side silent: the graph hash alone decides.
  return !(m.run.run_id && current.runId && m.run.run_id !== current.runId)
}
