/**
 * The core route's fixed answer (CEE `POST /proxy/v5/turn` with `x-olumi-ai-mode: core-route`; contract v1.2, DL 22 Oct).
 * The ONLY place in the UI that knows this contract: `parseV5Response` hands a core-route body here, and the reply goes
 * on as the internal answer the rest of the client already reads, built from contract data alone. Nothing is composed:
 * the reply text, the cards, the notes and the receipts pass through as CEE sent them.
 */
import { z } from 'zod'
import { AMEND_PROPOSAL_ACTION } from '../canvas/conversation/proposalFields'

const actionSchema = z.object({ id: z.string().min(1), label: z.string().min(1), message: z.string().min(1) }).passthrough()
const cardSchema = z.object({
  proposal_id: z.string().min(1),
  issued_turn_id: z.string().min(1).nullable().optional(),
  approve_action: actionSchema,
  decline_action: actionSchema,
}).passthrough()

export const CoreTurnSchema = z.object({
  turn_id: z.string().min(1),
  durability: z.string().optional(),
  assistant_text: z.string(),
  // `revision` is the CAS base a writer sends back; `scenario_revision` the full saved identity the read must serve (v1.5).
  model: z.object({ graph: z.record(z.unknown()), revision: z.string().min(1), scenario_revision: z.string().min(1) }).nullable(),
  cards: z.array(cardSchema).default([]),
  notes: z.array(z.object({ element_id: z.string().min(1), text: z.string().min(1) })).default([]),
  run: z.object({
    run_key: z.string().min(1),
    run_id: z.string().min(1),
    computed_against: z.string().min(1),
    state: z.object({ kind: z.string().min(1), computed_at: z.string().optional() }).passthrough(),
  }).passthrough().nullable(),
  // v1.4: the Run's own result block on a Run turn, and the FULL analysis verdict on every turn (their absence would run
  // the legacy fallbacks: absence audit, 22 Oct). Passed through as sent; never re-derived here.
  analysis_result: z.record(z.unknown()).nullable().optional(),
  analysis_state: z.record(z.unknown()).nullable().optional(),
  receipts: z.array(z.object({ authorised_by: z.enum(['person', 'olumi']) }).passthrough()).default([]),
  paused: z.object({ proposal_id: z.string().min(1) }).nullable().optional(),
  error: z.object({ code: z.string().min(1), message: z.string(), retry_safe: z.boolean(), nothing_saved: z.boolean() }).nullable(),
})
export type CoreTurn = z.infer<typeof CoreTurnSchema>

export function parseCoreTurn(raw: unknown): CoreTurn | null {
  const parsed = CoreTurnSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/** A failed core turn, in the envelope today's failure path reads (`error`, `detail`, `retry_safe`, `nothing_saved`). */
export function coreTurnErrorBody(error: NonNullable<CoreTurn['error']>): Record<string, unknown> {
  return { error: error.code, detail: error.message, retry_safe: error.retry_safe, nothing_saved: error.nothing_saved }
}

type GraphNode = { id?: unknown; label?: unknown; kind?: unknown }
/** The card kinds a note sits beside (CEE `NOTE_NODE_KINDS`); the question itself is never a card to note. */
const NOTE_KINDS = new Set(['factor', 'option', 'goal', 'risk', 'constraint', 'outcome'])

/** The note's card as the canvas names it (its own label and kind); a note on anything else is not drawn. */
function noteTarget(nodes: readonly GraphNode[], id: string): { id: string; label: string; kind: string } | null {
  const node = nodes.find((n) => n.id === id)
  return node && typeof node.label === 'string' && node.label.length > 0 && typeof node.kind === 'string' && NOTE_KINDS.has(node.kind)
    ? { id, label: node.label, kind: node.kind }
    : null
}

/**
 * The answer as the client reads it, from contract data alone: CEE's reply, the saved model and its revision, each
 * held card with its approve / change / decline (as a reopen offers them, `serverConversationTurns`), each note beside
 * its item (the block CEE's `note_on_item` sends today), the Run's result and the analysis verdict as CEE sent them, the
 * receipts with who authorised each write (for undo), and the turn's identity. The stage stays `frame`, as core sends
 * it today: the client works out its own stage from the canvas.
 */
export function coreTurnToClientBody(turn: CoreTurn): Record<string, unknown> {
  const graph = turn.model?.graph
  const revision = turn.model?.revision
  const nodes = (Array.isArray(graph?.nodes) ? graph.nodes : []) as GraphNode[]
  const edges = Array.isArray(graph?.edges) ? graph.edges : []
  const notes = turn.notes.flatMap((n) => {
    const target = noteTarget(nodes, n.element_id)
    return target === null ? [] : [{ type: 'ui_directive', verb: 'highlight', targets: [target], note: n.text, source: 'composer' }]
  })
  const cardActions = turn.cards.length === 0 ? [] : [
    ...turn.cards.map((c) => c.approve_action), AMEND_PROPOSAL_ACTION, ...turn.cards.map((c) => c.decline_action),
  ].map(({ id, label, message }) => ({ id, label, message }))
  return {
    response_version: 2,
    assistant_text: turn.assistant_text,
    blocks: [...(turn.analysis_result ? [{ type: 'analysis_result', ...turn.analysis_result }] : []), ...notes],
    suggested_actions: cardActions,
    insights: [],
    stage_indicator: 'frame',
    // The saved model as the client's draft reader takes it (the read's `living_model` reaches the canvas by the read).
    ...(graph ? { draft_graph: { nodes, edges, node_count: nodes.length, edge_count: edges.length } } : {}),
    ...(revision ? { graph_hash: revision } : {}),
    ...(turn.cards.length > 0 && revision ? { _proposal_fields: { version: 1, graph_hash: revision, proposals: turn.cards } } : {}),
    ...(turn.analysis_state ? { analysis_state: turn.analysis_state } : {}),
    // What the scenario read must serve after this turn: the saved model and, after a Run, that Run (`readAfterWrite.ts`).
    ...(turn.model ? { _read_after_write: { scenario_revision: turn.model.scenario_revision, ...(turn.run ? { run_id: turn.run.run_id } : {}) } } : {}),
    _agent: {
      turn_id: turn.turn_id,
      ...(turn.durability ? { durability: turn.durability } : {}),
      receipts: turn.receipts,
      // Who made each write, as the undo label reads it: the person's approval is `authorise_change`, else Olumi's.
      tool_calls: turn.receipts.map((r) => ({ name: r.authorised_by === 'person' ? 'authorise_change' : 'olumi_change', mutated: true })),
    },
  }
}
