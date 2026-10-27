/**
 * The core route's fixed answer (CEE `POST /proxy/v5/turn` with `x-olumi-ai-mode: core-route`; contract v1.2, DL 22 Oct).
 * The ONLY place in the UI that knows this contract: `parseV5Response` hands a core-route body here, and the reply goes
 * on as the internal answer the rest of the client already reads, built from contract data alone. Nothing is composed:
 * the reply text, the cards, the notes and the receipts pass through as CEE sent them.
 */
import { z } from 'zod'
import { AMEND_PROPOSAL_ACTION } from '../canvas/conversation/proposalFields'
import { receiptsProveOwnSave } from './saveReceipts'

const actionSchema = z.object({ id: z.string().min(1), label: z.string().min(1), message: z.string().min(1) }).passthrough()
const cardSchema = z.object({
  proposal_id: z.string().min(1),
  issued_turn_id: z.string().min(1).nullable().optional(),
  approve_action: actionSchema,
  decline_action: actionSchema,
}).passthrough()

/**
 * Field for field CEE's own `CoreTurnContract` (`orchestrator-v5/core-route/contract.ts`), so a body CEE may send is never
 * read as a mismatch: the served journey of 22 Oct lost a valid chat-edit reply because a turn with no Run carries `run`
 * with null fields (`{ run_id: null, run_key: null, computed_against: null, state: { kind, computed_at: null } }`), which
 * an all-strings schema refused, and the person was told the server did not reply.
 */
const nullableId = z.string().min(1).nullable()
export const CoreTurnSchema = z.object({
  turn_id: nullableId,
  durability: z.string().optional(),
  assistant_text: z.string(),
  // `revision` is the CAS base a writer sends back; `scenario_revision` the full saved identity the read must serve (v1.5).
  // Both are null, and the graph absent, on a turn that saved nothing to show (a failure, a turn that never drafted).
  model: z.object({ graph: z.record(z.unknown()).optional(), revision: nullableId, scenario_revision: nullableId }).passthrough().nullable(),
  cards: z.array(cardSchema).default([]),
  notes: z.array(z.object({ element_id: z.string().min(1), text: z.string().min(1) })).default([]),
  run: z.object({
    run_key: nullableId,
    run_id: nullableId,
    computed_against: nullableId,
    state: z.object({ kind: z.string().min(1), computed_at: z.string().nullable().optional() }).passthrough(),
  }).passthrough().nullable(),
  // v1.4: the Run's own result block on a Run turn, and the FULL analysis verdict on every turn (their absence would run
  // the legacy fallbacks: absence audit, 22 Oct). Passed through as sent; never re-derived here.
  analysis_result: z.record(z.unknown()).nullable().optional(),
  analysis_state: z.record(z.unknown()).nullable().optional(),
  receipts: z.array(z.object({ authorised_by: z.enum(['person', 'olumi']) }).passthrough()).default([]),
  paused: z.object({ proposal_id: nullableId }).nullable().optional(),
  // CEE's action bar (`action_bar` v1, null when it offers nothing), raw: its one reader is `readActionBar`, as on a reload.
  action_bar: z.unknown().optional(),
  error: z.object({ code: z.string().min(1), message: z.string(), retry_safe: z.boolean(), nothing_saved: z.boolean() }).nullable(),
})
export type CoreTurn = z.infer<typeof CoreTurnSchema>

export function parseCoreTurn(raw: unknown): CoreTurn | null {
  const parsed = CoreTurnSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/** CEE's typed refusal of a scenario saved before the living model (409 `legacy_scenario`): the one line the person sees. */
export const LEGACY_SCENARIO_COPY =
  'This scenario was built with an earlier version of Olumi. Start a new scenario to continue; this one stays here to read.'

/**
 * A failed core turn, in the envelope today's failure path reads (`error`, `detail`, `retry_safe`, `nothing_saved`). A turn
 * that saved before it failed carries each saved version's receipt (CEE C7), so it reads as `save_outcome: 'VERIFIED_SAVED'`
 * with those receipts: a receipt is the one proof of a save, and `nothing_saved: false` alone proves nothing either way. The
 * receipts are read by the one predicate the normal reply uses (`saveReceipts.ts`), so a malformed set is never a save here.
 */
export function coreTurnErrorBody(error: NonNullable<CoreTurn['error']>, receipts: CoreTurn['receipts'] = []): Record<string, unknown> {
  return { error: error.code, detail: error.message, retry_safe: error.retry_safe, nothing_saved: error.nothing_saved,
    ...(receiptsProveOwnSave(receipts) ? { save_outcome: 'VERIFIED_SAVED', receipts } : {}) }
}

type GraphNode = { id?: unknown; label?: unknown; kind?: unknown }
/**
 * The answer as the client reads it, from contract data alone: CEE's reply, the saved model and its revision, each
 * held card with its approve / change / decline (as a reopen offers them, `serverConversationTurns`), the Run's result
 * and the analysis verdict as CEE sent them, the receipts with who authorised each write (for undo), and the turn's
 * identity. Notes, the stage and the action bar are not translated: the core applier (`applyCoreTurn.ts`, U4) owns the
 * note, and a program has neither a client stage nor a bar contract.
 */
export function coreTurnToClientBody(turn: CoreTurn): Record<string, unknown> {
  const graph = turn.model?.graph
  const revision = turn.model?.revision
  const nodes = (Array.isArray(graph?.nodes) ? graph.nodes : []) as GraphNode[]
  const edges = Array.isArray(graph?.edges) ? graph.edges : []
  // A card kept for review (CEE PR-2) offers its "Review this change", never its approve, and "Change something first" sits
  // only beside a card that can still be approved: exactly as a reopen offers them (`reconcileRestoredProposalFields`).
  const reviewOf = (c: CoreTurn['cards'][number]) => { const r = actionSchema.safeParse(c.review_action); return r.success ? r.data : undefined }
  const cardActions = turn.cards.length === 0 ? [] : [
    ...turn.cards.map((c) => reviewOf(c) ?? c.approve_action),
    ...(turn.cards.some((c) => reviewOf(c) === undefined) ? [AMEND_PROPOSAL_ACTION] : []),
    ...turn.cards.map((c) => c.decline_action),
  ].map(({ id, label, message }) => ({ id, label, message }))
  return {
    response_version: 2,
    assistant_text: turn.assistant_text,
    // A note is the core applier's (`applyCoreTurn.ts`, U4), never a legacy highlight directive.
    blocks: turn.analysis_result ? [{ type: 'analysis_result', ...turn.analysis_result }] : [],
    suggested_actions: cardActions,
    insights: [],
    // The saved model as the client's draft reader takes it (the read's `living_model` reaches the canvas by the read).
    // Its limits too: a draft apply clears the canvas's limits when the draft carries none (`applyDraftResult`).
    ...(graph ? { draft_graph: { nodes, edges, node_count: nodes.length, edge_count: edges.length,
      ...(Array.isArray(graph.goal_constraints) ? { goal_constraints: graph.goal_constraints } : {}) } } : {}),
    ...(revision ? { graph_hash: revision } : {}),
    ...(turn.cards.length > 0 && revision ? { _proposal_fields: { version: 1, graph_hash: revision, proposals: turn.cards } } : {}),
    ...(turn.analysis_state ? { analysis_state: turn.analysis_state } : {}),
    // What the scenario read must serve after this turn: the saved model and, after a Run, that Run (`readAfterWrite.ts`).
    // A turn with no saved identity, or no Run, asks nothing of the read (`readAfterWriteExpectation`).
    ...(turn.model?.scenario_revision ? { _read_after_write: { scenario_revision: turn.model.scenario_revision, ...(turn.run?.run_id ? { run_id: turn.run.run_id } : {}) } } : {}),
    _agent: {
      ...(turn.turn_id ? { turn_id: turn.turn_id } : {}),
      ...(turn.durability ? { durability: turn.durability } : {}),
      receipts: turn.receipts,
      // Who made each write, as the undo label reads it: the person's approval is `authorise_change`, else Olumi's.
      tool_calls: turn.receipts.map((r) => ({ name: r.authorised_by === 'person' ? 'authorise_change' : 'olumi_change', mutated: true })),
    },
  }
}
