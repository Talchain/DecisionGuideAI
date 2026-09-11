import type { ModelBuildingNoticeKind } from '@talchain/schemas/boundary'

/**
 * The producer's 21 disclosure reasons, as a HAND-WRITTEN corpus.
 *
 * ⚠ NOT A TEST FILE. It carries no `describe`/`it` and its name deliberately
 * lacks `.spec`, so `vitest.config.ts`'s include glob — which requires
 * `.test` or `.spec` immediately before the extension — does not collect it. It
 * lives here so the two suites that ask DIFFERENT questions of the same 21
 * reasons can cross-check each other's coverage without one spec importing the
 * other — an import that would re-register the imported file's tests inside the
 * importer and quietly inflate its collected count.
 *
 * ⭐⭐ THE ORACLE, AND IT COMES FROM THE PRODUCER, NOT FROM THIS AUTHOR.
 *
 * One row per reason in CEE's `NOTICE_KIND_BY_REASON`. `inModel` is the
 * PRODUCER's answer to "is the thing this discloses still in the graph?",
 * quoted from its declaration at `projector.ts`, never inferred from the
 * reason's name (trap 13c: a mutant kit measures whether a test can detect a
 * change, never whether the expectation is right).
 *
 * ⚠ THIS IS A HAND-WRITTEN CORPUS AND THAT IS DELIBERATE (trap 12d). The
 * classification under test is DERIVED from this table's shape; derivation
 * proves the consumers agree with the list and can never prove the list is
 * right. A corpus is the only thing that notices the list is short, so it is
 * written out in full with the producer's own words beside each entry.
 *
 * ⭐ EXPORTED so the SECOND hand-written corpus — `PRODUCER_ATTRIBUTION` in
 * `modelBuildingNotices.attributionIsEarned.spec.tsx`, which asks a DIFFERENT
 * question of the same 21 reasons — can cross-check its reason set against this
 * one. Two independent hand lists that agree are weak evidence apart and real
 * evidence together: a list that goes short disagrees with its twin, which is
 * the one thing neither can notice about itself (trap 12d).
 */
export const PRODUCER_CORPUS: ReadonlyArray<{
  reason: string
  kind: ModelBuildingNoticeKind
  inModel: boolean
  because: string
}> = [
  // ── relationship_not_used — the LINK is absent in all eight ────────────────
  { reason: 'unparseable_ref', kind: 'relationship_not_used', inModel: false, because: 'unresolved reference; no edge minted' },
  { reason: 'ref_out_of_range', kind: 'relationship_not_used', inModel: false, because: 'unresolved reference; no edge minted' },
  { reason: 'ref_target_not_a_node', kind: 'relationship_not_used', inModel: false, because: 'unresolved reference; no edge minted' },
  { reason: 'self_loop', kind: 'relationship_not_used', inModel: false, because: 'refused; no edge minted' },
  { reason: 'missing_ref', kind: 'relationship_not_used', inModel: false, because: 'unresolved reference; no edge minted' },
  { reason: 'ambiguous_ref', kind: 'relationship_not_used', inModel: false, because: '"the projector has no basis for preferring either, so it refuses"' },
  { reason: 'ref_kind_illegal', kind: 'relationship_not_used', inModel: false, because: '"cannot form a legal edge under any repair"' },
  { reason: 'endpoint_demoted_duplicate', kind: 'relationship_not_used', inModel: false, because: '"a link whose endpoint was demoted"' },

  // ── detail_not_connected — the RECORD is withdrawn in both ─────────────────
  { reason: 'unconnected_to_goal', kind: 'detail_not_connected', inModel: false, because: '"projected as a node and then WITHDRAWN"' },
  { reason: 'disconnected_by_shape_gate', kind: 'detail_not_connected', inModel: false, because: '"the connectivity prune WITHDRAWS any factor/constraint that cannot reach the goal"' },

  // ── alternative_consolidated — PRESENT in all three ────────────────────────
  { reason: 'refinement_merged_into_stated_option', kind: 'alternative_consolidated', inModel: true, because: '"the projector BINDS IT TO THE PARENT\'S NODE"; "every link ... lands on the parent"' },
  { reason: 'undeveloped_duplicate_of_stated', kind: 'alternative_consolidated', inModel: true, because: 'a MODEL option duplicating a STATED one; "a STATED option is NEVER demoted"' },
  { reason: 'undeveloped_duplicate_of_model', kind: 'alternative_consolidated', inModel: true, because: 'two MODEL options, "the lowest claim index is KEPT"; no stated member in the group' },

  // ── conflict_resolved_conservatively — PRESENT in all three ────────────────
  { reason: 'parallel_intervention_conflict', kind: 'conflict_resolved_conservatively', inModel: true, because: '"One was CHOSEN canonically"' },
  { reason: 'parallel_causal_link_conflict', kind: 'conflict_resolved_conservatively', inModel: true, because: '"One is chosen canonically"' },
  { reason: 'constraint_direction_unstated', kind: 'conflict_resolved_conservatively', inModel: true, because: '"The node KEEPS THE USER\'S WORDS ... THIS IS THE ASK, NOT A LOSS."' },

  // ── target_not_modelled_as_threshold — MIXED ───────────────────────────────
  { reason: 'stated_target_not_represented_as_threshold', kind: 'target_not_modelled_as_threshold', inModel: true, because: '"It is ON THE GRAPH as the user\'s own words"' },
  { reason: 'stated_target_value_dropped', kind: 'target_not_modelled_as_threshold', inModel: false, because: '"that number reached the graph NOWHERE ... the 8 discarded"' },

  // ── other — MIXED ──────────────────────────────────────────────────────────
  { reason: 'claim_label_not_a_name', kind: 'other', inModel: true, because: '"The node IS on the graph ... NOTHING WAS DROPPED, refused or shortened"' },
  { reason: 'factor_merged_into_stated_cause', kind: 'other', inModel: true, because: '"MODEL-origin content into a USER-stated node"' },
  { reason: 'option_budget_exceeded', kind: 'other', inModel: false, because: '"left OFF the graph to bring it inside the bound"' },
]
