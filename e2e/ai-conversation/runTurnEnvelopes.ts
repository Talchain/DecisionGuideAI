/**
 * RUN-TURN COACHING (#1968) — the V5 envelopes the witness feeds the SHIPPED
 * ingestion chain. Pure data, no DOM: imported by the Vite-served probe AND by
 * the Node-side spec (which route-fulfils `/proxy/v5/turn` with the run turn).
 *
 * ⚠ WHAT IS THE PRODUCER'S AND WHAT IS THE HARNESS'S — stated so the photos are
 * read correctly:
 *   - PRODUCER, VERBATIM: the coaching block (`explicit_run.blocks[0]` of
 *     `run-turn-coaching-fragile-link.producer-v3.json`, CEE's v3 golden
 *     payload). Its `created_at` and `graph_hash_at_generation` are the run
 *     identity every state below is measured against.
 *   - HARNESS: the envelope around it. The fixture carries the coaching block
 *     only — not the run turn's prose, analysis_result or analysis_state — so
 *     `assistant_text` is a labelled placeholder and `analysis_state` /
 *     `analysis_ready` are schema-valid statements built per state. Every
 *     `analysis_state` here passes `AnalysisStateV1Schema` (incl. the 0.47.0
 *     cross-field rules: a stale kind forbids `usable_for_chips`).
 */

export interface ProducerV3Payload {
  explicit_run: { blocks: Array<Record<string, unknown>> }
}

export type RunCardState = 'current' | 'later_run' | 'model_changed' | 'not_current'

/** A later run of the SAME model (same instant the PR's own unit spec uses). */
export const LATER_RUN_AT = '2026-09-24T17:02:11.004Z'
/** CEE's hash after a user edit. Synthetic and labelled as such — only equality matters. */
export const EDITED_GRAPH_HASH = 'witness-edited-graph-hash'

export const RUN_TURN_PLACEHOLDER_TEXT =
  '[Witness harness: the producer v3 fixture carries this turn’s coaching block only, not its prose.]'

/**
 * A later turn needs SOME text: a block-less, text-less turn routes to `empty`,
 * and `useConversation` applies state only for `text_only` / `blocks` turns.
 */
export const LATER_TURN_PLACEHOLDER_TEXT =
  '[Witness harness: a later turn — only its analysis_state / analysis_ready matter here.]'

const VERDICT_COMMON = {
  readiness: { status: 'ready', blockers: [] },
  leader_claim: { permitted: true },
  robustness: {},
  usable_for_prose: true,
  usable_for_chips: true,
  usable_for_followup: true,
  requires_rerun: false,
  blocked_unusable: false,
  contradictions: [],
} as const

export function producerCard(producer: ProducerV3Payload): Record<string, unknown> {
  const card = producer.explicit_run.blocks[0]
  if (!card) throw new Error('[runcard] producer fixture has no explicit_run.blocks[0]')
  return card
}

function envelope(
  blocks: Array<Record<string, unknown>>,
  assistantText: string,
  analysisReady: Record<string, unknown>,
  analysisState: Record<string, unknown>,
): Record<string, unknown> {
  return {
    response_version: 2,
    assistant_text: assistantText,
    blocks,
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    graph_hash: analysisReady.current_graph_hash,
    analysis_ready: analysisReady,
    analysis_state: analysisState,
  }
}

/** The run turn that DELIVERED the card: its own run, current, same instant. */
export function runTurnEnvelope(producer: ProducerV3Payload): Record<string, unknown> {
  const card = producerCard(producer)
  const hash = String(card.graph_hash_at_generation)
  const at = String(card.created_at)
  return envelope(
    [card],
    RUN_TURN_PLACEHOLDER_TEXT,
    { status: 'ready', options: [], goal_node_id: 'goal', freshness: 'fresh', current_graph_hash: hash, graph_hash_at_run: hash, computed_at: at },
    { ...VERDICT_COMMON, run_state: { kind: 'complete_current', computed_at: at } },
  )
}

/**
 * The LATER turn whose verdict governs the card for `state`, or null for
 * `current` (the run turn's own verdict is the one in force). Carries no
 * blocks: only its `analysis_state` / `analysis_ready` reach the store.
 */
export function laterTurnEnvelope(
  producer: ProducerV3Payload,
  state: RunCardState,
): Record<string, unknown> | null {
  const card = producerCard(producer)
  const hash = String(card.graph_hash_at_generation)
  const at = String(card.created_at)
  const ready = (current: string, freshness: string, computedAt: string) => ({
    status: 'ready', options: [], goal_node_id: 'goal', freshness,
    current_graph_hash: current, graph_hash_at_run: hash, computed_at: computedAt,
  })
  switch (state) {
    case 'current':
      return null
    case 'later_run':
      // Same model, a newer run completed: hash unchanged, computed_at moved on.
      return envelope([], LATER_TURN_PLACEHOLDER_TEXT, ready(hash, 'fresh', LATER_RUN_AT),
        { ...VERDICT_COMMON, run_state: { kind: 'complete_current', computed_at: LATER_RUN_AT } })
    case 'model_changed':
      // The user edited the model; CEE's current hash moved, the run is stale.
      return envelope([], LATER_TURN_PLACEHOLDER_TEXT, ready(EDITED_GRAPH_HASH, 'stale', at),
        { ...VERDICT_COMMON, usable_for_chips: false, requires_rerun: true,
          run_state: { kind: 'complete_stale', computed_at: at, cause: 'graph_changed' } })
    case 'not_current':
      // Same model, a rerun is in flight: the run state is not complete_current.
      return envelope([], LATER_TURN_PLACEHOLDER_TEXT, ready(hash, 'fresh', at),
        { ...VERDICT_COMMON, usable_for_chips: false,
          run_state: { kind: 'running', started_at: LATER_RUN_AT } })
  }
}
