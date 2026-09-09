/**
 * humaniseCritique — converts raw PLoT critique messages into user-safe copy.
 *
 * PLoT critiques can contain internal field names like `constraint_fac_customer_churn_max`,
 * `observed_state.value`, `intercept=0`. This utility maps known critique codes to
 * human-readable templates and provides a safe fallback for unknown codes that NEVER
 * exposes the raw message to users.
 *
 * Global rule: labels resolve via nodeId → graph store lookup ONLY.
 * Never parsed from critique message strings.
 *
 * Factor label resolution chain:
 * 1. nodeId from affectedNodes → look up in nodeLabels map → use node.label
 * 2. affectedNodes present but not in map → "This factor" + factorId
 * 3. No affectedNodes → "This factor", no factorId
 */

import type { UncertaintyItem } from '../types'

// ─── Public types ────────────────────────────────────────────────────────────

export interface HumanisedCritique {
  title: string
  description: string
  /** V14.3: Canonical user-safe text for banner display. null = exclude from banner. */
  displayText: string | null
  suggestion?: string
  /** Resolved factor/node ID for GraphLink CTA */
  factorId?: string
}

// ─── CEE-owned display-copy codes ────────────────────────────────────────────

/**
 * Codes whose USER-FACING COPY is owned by CEE's critique pipeline
 * (`olumi-assistants-service/src/orchestrator-v5/compose/sanitise-enrichment.ts`
 * at `d2cdd99b`): the 10 S-bucket codes (CEE REPLACES the message with
 * Paul-approved copy, 2026-04-30, labels resolved CEE-side) + the 3 U-bucket
 * codes (producer plain-English `user_message` shipped as-is). For these, a
 * clean `userMessage` outranks any UI template — the UI must not restate an
 * approved disclosure in its own words.
 *
 * ⚠ HAND-MAINTAINED MIRROR of CEE's bucket table (CLAUDE.md trap 12),
 * accepted deliberately for Car 1 and guarded two ways: (1) the sentinel
 * corpus test in `__tests__/projectedCritiques.reach.spec.ts` walks every
 * entry; (2) Car 2 (schemas seam-split, ROADMAP 2.293) is the rowed home for
 * exporting this set from `@talchain/schemas` so both sides derive it.
 * D-bucket codes never reach the browser (dropped by CEE's projection), so
 * they are deliberately not listed.
 */
export const CEE_OWNED_CRITIQUE_CODES: ReadonlySet<string> = new Set([
  // S bucket (approved replacement copy)
  'EMPTY_INTERVENTIONS',
  'INVALID_INTERVENTION_TARGET',
  'NO_EFFECTIVE_PATH_TO_GOAL',
  'IDENTICAL_OPTIONS',
  'GRAPH_DISCONNECTED',
  'OPTION_NO_INTERVENTIONS',
  'LOW_EFFECTIVE_SAMPLES',
  'DEGENERATE_OPTION_ZERO_VARIANCE',
  'HIGH_TIE_RATE',
  'SAMPLES_REDUCED_FOR_COMPLEXITY',
  // U bucket (producer plain-English user_message, shipped as-is)
  'NO_OPTIONS',
  'INSUFFICIENT_OPTIONS',
  'DEGENERATE_OUTCOMES',
])

// ─── Code → template map ─────────────────────────────────────────────────────

type TemplateFactory = (factorLabel: string) => Omit<HumanisedCritique, 'factorId' | 'displayText'>

const CODE_TEMPLATES: Record<string, TemplateFactory> = {
  MISSING_OBSERVED_STATE: (label) => ({
    title: `${label} is missing a current value`,
    description: 'A default was assumed, so results involving this factor may be less reliable.',
    suggestion: `Add your current estimate for ${label}`,
  }),
  CONSTRAINT_MISSING_VALUE: (label) => ({
    title: `${label} target can't be fully evaluated`,
    description: 'This factor is missing data needed to assess your success target accurately.',
    suggestion: `Set a value for ${label}`,
  }),
  LOW_EVIDENCE: () => ({
    title: 'Limited evidence available',
    description: 'Some factors have low evidence coverage, which may affect reliability.',
    suggestion: 'Add data or expert estimates for factors with low confidence',
  }),
  NO_RISK_NODES: () => ({
    title: 'No risk factors connected',
    description: 'The model doesn\'t include any risk nodes. Consider whether risks could affect the outcome.',
    suggestion: 'Add risk factors that could influence your decision',
  }),
  ORPHAN_NODES: () => ({
    title: 'Some factors aren\'t connected',
    description: 'Parts of your model aren\'t linked to the main decision and won\'t affect the analysis.',
    suggestion: 'Connect or remove disconnected factors',
  }),
  DECISION_AFTER_OUTCOME: () => ({
    title: 'Model structure needs review',
    description: 'Some connections may not follow the expected cause-and-effect flow.',
    suggestion: 'Check that factors flow into outcomes, not the other way around',
  }),
  ASSUMPTIONS_USED: () => ({
    title: 'Default assumptions applied',
    description: 'Some values were assumed because data wasn\'t provided. Results may be less reliable for these areas.',
    suggestion: 'Review and update assumed values where you have better information',
  }),
  EMPTY_COMPUTED_RESULTS: () => ({
    title: 'Analysis returned limited results',
    description: 'The computation completed but produced fewer results than expected.',
    suggestion: 'Check your model structure and try running the analysis again',
  }),
  GRAPH_SIZE_INFO: () => ({
    title: 'Large model',
    description: 'Your model has many nodes. Analysis may take longer and results could be less precise.',
  }),
  EVIDENCE_SUGGESTION: () => ({
    title: 'Consider adding more evidence',
    description: 'Adding data or references to key factors would strengthen the analysis.',
    suggestion: 'Gather data for your highest-impact factors',
  }),
  CONSTRAINT_TARGET_NO_OBSERVED_VALUE: (label) => ({
    title: `${label} has no estimate set`,
    description: 'Results may be unreliable without a current value for this constraint.',
    suggestion: 'Set estimate',
  }),
  // ⭐ RE-GROUNDED IN THE PRODUCER (N-21 item 4, P7). PLoT emits this as
  // `createInfo`, and its own branch comment declares the case "informational
  // only (no downstream impact since constraint values pass through raw to
  // ISL)" (`preflight-v2.ts:670-671`); its humanised copy reads "The constraint
  // on {label} cannot be range-checked. The constraint value will be used
  // as-is." The previous description — "A range is needed to assess whether
  // this target can be met" — asserted the target could NOT be assessed, which
  // the emitter contradicts: the target IS assessed, only the sanity-check
  // against a min/max is skipped. The suggestion stays because setting a range
  // genuinely clears the note (P8: the ask has an acceptance path); what goes
  // is the false consequence attached to not doing it.
  CONSTRAINT_MISSING_RANGE: (label) => ({
    title: `${label} has no range to check your target against`,
    description:
      'Your target is used exactly as you set it. Recording a lowest and highest value for this factor lets Olumi sanity-check it.',
    suggestion: 'Set range',
  }),
  CONSTRAINT_FILTERED_TEMPORAL: () => ({
    title: 'Some time-based constraints were excluded',
    description: 'Temporal constraints outside the analysis window were filtered from results.',
    // No suggestion — not actionable by the user
  }),
  CONSTRAINT_OUT_OF_DOMAIN: (label) => ({
    title: `${label} constraint value is outside the expected range`,
    description: 'The target for this constraint falls outside the range the model can assess.',
    suggestion: 'Review',
  }),
  // ⛔ `CONSTRAINT_NO_DERIVABLE_RANGE` WAS HERE AND IS DELETED (N-21 item 4).
  // It was a UI-LOCAL INVENTION: swept at the producers with contrast controls
  // (PLoT `staging` fb63b03d / ISL 28fe0c9 / schemas 8149308) it reads 0/0/0,
  // while the sibling codes read 13/16/8 — so the zero is real absence, not a
  // blind instrument. Its template duplicated
  // `CONSTRAINT_TARGET_NO_OBSERVED_VALUE`'s title and suggestion VERBATIM
  // ("{label} has no estimate set" / "Set estimate"), which is the duplicate
  // sentence N-21 reported; and its description ("results may be less precise")
  // asserted a consequence PLoT explicitly denies for the range case.
  // The real producer code for that message is `CONSTRAINT_MISSING_RANGE`,
  // which already has its own honest template above.
  INBOUND_STRENGTH_SUM_EXCEEDED: (label) => ({
    title: `The factors driving ${label} may be over-weighted`,
    description: 'The combined strength of connections into this node exceeds the expected range. Consider reducing some edge strengths.',
    suggestion: 'Review connection strengths',
  }),
  MIXED_RANGE_DERIVATION: () => ({
    title: 'Some factor ranges use estimates rather than confirmed values',
    description: 'Not all factor ranges are derived from the same source. Results may be less consistent.',
    suggestion: 'Review factor data sources',
  }),
  // ROADMAP 1.12 — warning surfacing. Producer WARNING-severity code (PLoT
  // constraint-reliability.ts): a goal constraint's target could not be
  // scaled/evaluated reliably (default-range threshold and/or a defaulted
  // base), so PLoT withholds goal-fit probabilities for the run rather than
  // emit a meaningless number. Doctrine rule 6 (defaulted-value disclosure):
  // names the concrete, actionable fix — set a value/range — never quotes
  // the withheld number itself.
  CONSTRAINT_TARGET_UNRELIABLE: (label) => ({
    title: `${label}'s success target can't be evaluated reliably`,
    description: 'The value needed to assess this target is missing or unscaled, so goal-fit results were withheld for this run rather than shown as a meaningless number.',
    suggestion: `Set a value or range for ${label}`,
  }),
  // 1.52 follow-up — producer WARNING-severity codes (PLoT constraint
  // direction detection) distinct from CONSTRAINT_TARGET_UNRELIABLE: there
  // the target *value* is the problem; here the target's *direction*
  // (higher-is-better vs lower-is-better) is the problem. SUSPECT = PLoT
  // couldn't confirm the direction so goal-fit isn't shown for this option.
  // ASSUMED = PLoT proceeded with an assumed direction (goal-fit shown but
  // built on an unconfirmed assumption). Same pattern as the 1.12 fix
  // (PR #250): a code-keyed template naming the concrete, actionable fix,
  // never quoting internal field names.
  CONSTRAINT_DIRECTION_SUSPECT: (label) => ({
    title: `${label}'s target direction couldn't be confirmed`,
    description: "The direction of your target (whether higher or lower is better) couldn't be confirmed for this option, so its goal-fit isn't shown.",
    suggestion: `Review the target direction for ${label}`,
  }),
  // ROADMAP 1.54 density wall (PLoT #209): dense graphs now analyse at an
  // adaptively reduced Monte Carlo depth instead of 500ing. The producer
  // message names both sample depths; the template keeps the honest
  // substance (reduced precision, results still complete) without quoting
  // engine internals.
  SAMPLES_REDUCED_FOR_COMPLEXITY: () => ({
    title: 'Analysis ran at reduced precision',
    description: 'This model is dense, so the analysis ran with fewer simulation samples than standard. Results shown were computed at this reduced depth, and probabilities may be slightly less stable than usual.',
    suggestion: 'Remove weaker or duplicate influences to restore full precision',
  }),
  // Blocker sibling of the above: past the engine's ceiling even at the
  // minimum reliable depth the run is refused up front. FORWARD-PROVISIONING:
  // the 422-blocked path renders via userFriendlyErrors' GRAPH_TOO_COMPLEX
  // entry (useV2Run promotes the critique code) — blocker critiques do not
  // currently flow through this humaniser; the template exists so the copy
  // stays consistent if that routing ever changes.
  GRAPH_TOO_COMPLEX: () => ({
    title: 'Model too complex to analyse',
    description: "This model has more factors and connections than the analysis engine can compute reliably, so the analysis wasn't run rather than returning unstable numbers.",
    suggestion: 'Remove weaker or duplicate influences, or split the decision into smaller models, then re-run',
  }),
  CONSTRAINT_DIRECTION_ASSUMED: (label) => ({
    title: `${label}'s target direction was assumed`,
    description: "The direction of your target (whether higher or lower is better) wasn't confirmed, so it was assumed for this run. Goal-fit results for this option may be less reliable.",
    suggestion: `Confirm the target direction for ${label}`,
  }),
  // ROADMAP 2.300 item 1 (extends 2.271) — ISL's two goal-threshold refusal
  // codes (robustness_analyzer_v2.py `_resolve_goal_threshold`, fail-closed:
  // probability_of_goal is OMITTED rather than guessed, the warning names
  // why). Without templates these goal-level refusals fell to the generic
  // FACTOR-framed fallback ("Review this factor's inputs"), mislabelling the
  // condition. Both templates deliberately ignore the resolved label: the
  // condition is about the GOAL's target/baseline, and the fallback label
  // ("This factor") would be a category error when affectedNodes is absent.
  //
  // NOT_CONVERTIBLE's producer reasons include missing_goal_baseline (no
  // recorded current level — the tester-reachable case) plus structural ones
  // (goal pinned by an intervention, root goal, parameter uncertainty on the
  // goal, auto-noise), so the description states the withhold factually and
  // the suggestion names the user-actionable remedy without claiming it is
  // the only cause.
  // ⚠ THEIR ROUTE WAS INVISIBLE, AND ONLY THE TITLE IS RENDERED.
  // The 2.300 fix put the remedy in `suggestion`. Both surfaces that show
  // inference warnings render the TITLE ALONE — `InferenceWarningStrip` as its
  // single <span>, and the Advanced list through
  // `selectHumanisedInferenceWarningsOutsideStrip`, which projects only
  // `{code, title}`. So these two shipped as honest DEAD ENDS: they named the
  // condition and, where the user could see it, nothing to do about it.
  // The fix is deliberately the smallest one that closes it — the ratified
  // title and the ratified suggestion, both VERBATIM, joined so the remedy is
  // on the surface that renders. No approved wording is rewritten here.
  GOAL_THRESHOLD_NOT_CONVERTIBLE: () => ({
    title: "Your goal's target couldn't be measured for this run. State the current level for your goal.",
    description: 'The target couldn\'t be compared with where the goal stands today — for example when no current level is recorded for it — so goal-fit results were withheld rather than guessed.',
    suggestion: 'State the current level for your goal',
  }),
  GOAL_THRESHOLD_FRAME_UNSPECIFIED: () => ({
    title: "Your goal's target could mean a level or a change. Restate the target as a level to reach or a change from your current level.",
    description: "The target doesn't say whether it's a level to reach or a change from today, so goal-fit results were withheld for this run rather than guessed.",
    suggestion: 'Restate the target as a level to reach or a change from your current level',
  }),

  // ══════════════════════════════════════════════════════════════════════════
  // ISL `inference_warnings` — the remaining 24 of the 26 codes that reach the
  // UI. Extends the ROADMAP 2.300 item 1 fix above, which closed exactly two
  // of them and left the rest on the FACTOR-framed generic fallback: "Review
  // this factor's inputs". For the compute-degradation family that sentence is
  // ACTIVELY FALSE — it blames the user's factor inputs for a phase that ran
  // out of budget, and prescribes an action that cannot help.
  //
  // ⭐ HOW THIS COPY WAS DERIVED, AND WHY IT IS NOT DERIVED FROM THE CODE NAME.
  // Every sentence below was written from the PRODUCER's bytes at ISL
  // `staging` 28fe0c95 — the construction site, its `reason` values and its own
  // `detail.message`. Reading intent off the code name is precisely how the
  // wrong copy got here. The sharpest case is `EVPI_UNAVAILABLE`, whose `field`
  // is `p_win_sensitivity`, NOT EVPI: robustness_analyzer_v2.py:2580-2583
  // records that the code kept its operational name while the wire field was
  // renamed. Its copy describes win-probability sensitivity, not EVPI.
  //
  // ⭐ EVERY TEMPLATE IGNORES THE RESOLVED LABEL, DELIBERATELY.
  // PLoT forwards `{code, message, severity, field?, elapsed_ms?}` and NEVER
  // `affected_nodes` (run.ts:3771), so `useResultsSectionData.ts:3517` reads an
  // empty node list for every one of these codes and `resolveFactorLabel`
  // returns the unresolved "This factor". Interpolating a label here would
  // print that string at the user. The two 2.300 templates above already say
  // this for the goal codes; it holds for the whole vocabulary.
  //
  // ⭐ THE ROUTE ONWARD LIVES IN THE TITLE, NOT IN `suggestion`.
  // Both live surfaces render the TITLE ONLY — `InferenceWarningStrip` as its
  // single <span>, and the Advanced list through
  // `selectHumanisedInferenceWarningsOutsideStrip`, which projects `{code,
  // title}`. A route parked in `description`/`suggestion` would be invisible.
  // Those fields are still filled honestly for the other critique surfaces.
  //
  // ⭐ WHAT THE COPY MAY NOT DO: overstate or blur. "Unavailable" and "less
  // precise" are different claims and are kept apart — FACTOR_EVPPI_PARTIAL is
  // the one PARTIAL member of its family and says so, because calling it
  // unavailable would discard rows that were computed correctly.

  // ── Kind A: compute / budget degradation ─────────────────────────────────
  // A phase did not complete. Not the user's fault, and the producer states at
  // every one of these sites that "Base analysis is unaffected" — so the copy
  // must say the rest still stands, or an honest caveat reads as a broken run.

  // Reasons: request_budget_exhausted | e_value_budget_exceeded.
  E_VALUES_UNAVAILABLE: () => ({
    title:
      'The check on how wrong your assumptions could be before the recommendation changes didn\'t run — the analysis hit its time limit. Your results stand; re-run to add it.',
    description:
      'E-value analysis was skipped for time. It does not affect the recommendation, the probabilities, or anything else already shown.',
  }),

  // Reasons: e_values_unavailable | request_budget_exhausted |
  // flip_stability_budget_exceeded. All three roots are the time budget: the
  // bands ride on the E-value sweep, so "unavailable because E-values were
  // unavailable" is still a budget story, never a model one.
  STABILITY_BANDS_UNAVAILABLE: () => ({
    title:
      'The confidence bands around the tipping points didn\'t run — the analysis hit its time limit. Your results stand; re-run to add them.',
    description:
      'Flip-stability bands ride on the E-value sweep, which the request budget could not fund. Nothing else shown is affected.',
  }),

  // Reasons: request_budget_exhausted | factor_flip_budget_exceeded.
  // All-or-nothing at the producer, so this is never a partial set.
  FACTOR_FLIPS_UNAVAILABLE: () => ({
    title:
      'How far each factor would have to move to change the recommendation wasn\'t computed — the analysis hit its time limit. Your results stand; re-run to add it.',
    description:
      'Factor-flip analysis was omitted whole rather than part-computed. Nothing else shown is affected.',
  }),

  // Reasons: request_budget_exhausted | path_decomposition_budget_exceeded.
  PATH_DECOMPOSITION_UNAVAILABLE: () => ({
    title:
      'The breakdown of which causal pathways drive the result didn\'t run — the analysis hit its time limit. Your results stand; re-run to add it.',
    description:
      'Path decomposition was omitted whole rather than part-computed. Nothing else shown is affected.',
  }),

  // ⚠ MIXED REASONS, AND THE TEMPLATE CANNOT DISCRIMINATE. Three producer call
  // sites: request_budget_exhausted and evpi_budget_exceeded (budget) plus
  // constraints_not_convertible (a model-shape condition). The reason rides in
  // `detail.reason`, which PLoT folds into `message` — and this humaniser is
  // forbidden from reading `message`. Keying on the prose would also be exactly
  // the mirror this file keeps paying for. So the sentence is written to be
  // TRUE UNDER ALL THREE, and the route covers both worlds: re-running fixes
  // the budget cases, and the constraint check is what fixes the third. Naming
  // only "re-run" would be the futile-action defect again for one reason in
  // three.
  EVPI_UNAVAILABLE: () => ({
    title:
      'Which unknowns most affect each option\'s chance of hitting your goal wasn\'t computed. Your results stand; re-run, and if it repeats check each success target says whether it\'s a level or a change.',
    description:
      'Win-probability sensitivity was skipped — either the request budget ran out, or a goal constraint could not be resolved into its target\'s frame. The rest of the analysis is unaffected.',
  }),

  // Reason: estimator_error. NOT a budget case — re-running an identical model
  // may well fail again, so the route says so rather than promising a retry
  // will work.
  FACTOR_EVPPI_UNAVAILABLE: () => ({
    title:
      'Olumi couldn\'t rank what\'s most worth learning next for this run. Your results stand; re-run — if it repeats, this ranking can\'t be produced for this model.',
    description:
      'The per-factor value-of-information estimator failed and the ranking was omitted rather than shown with unreliable ordering.',
  }),

  // ⭐ THE PARTIAL MEMBER. Reason: per_factor_dropped. Some factors WERE
  // computed. Calling this "unavailable" would tell the user to discard a
  // ranking that is correct for the rows it shows — the overstatement the
  // scientific-credibility constraint forbids.
  FACTOR_EVPPI_PARTIAL: () => ({
    title:
      'Some factors were left out of the "most worth learning next" ranking; the ones shown are ranked correctly. Re-run to try for the full set.',
    description:
      'Per-factor value of information could not be computed for every factor requested. The factors that did compute are ranked against each other correctly.',
  }),

  // Reason: compute_error. Same posture as FACTOR_EVPPI_UNAVAILABLE.
  FACTOR_EVPC_UNAVAILABLE: () => ({
    title:
      'How much it would be worth being able to control each factor wasn\'t computed. Your results stand; re-run — if it repeats, this model can\'t produce it.',
    description:
      'Value-of-control estimation failed and was omitted rather than shown as an unreliable number.',
  }),

  // ── Kind B: model-shape conditions ───────────────────────────────────────
  // Something about the model or the stated inputs genuinely limits what can be
  // computed. Here the user CAN act, and the route names the actual remedy.

  // The per-constraint twins of the two 2.300 goal templates above. Same
  // producer rules (`_resolve_threshold_in_sample_frame`), different disclosure
  // vocabulary — the producer is explicit that the rule set is shared and the
  // vocabulary is not, so these get their own sentences rather than reusing the
  // goal ones.
  CONSTRAINT_NOT_CONVERTIBLE: () => ({
    title:
      'One of your success targets couldn\'t be compared with where its factor stands today, so its goal-fit was withheld rather than guessed. State that factor\'s current level.',
    description:
      'The target could not be resolved into its factor\'s measurement frame — for example when no current level is recorded for it.',
    suggestion: 'State the current level for that factor',
  }),
  CONSTRAINT_FRAME_UNSPECIFIED: () => ({
    title:
      'One of your success targets could mean a level to reach or a change from today, so its goal-fit was withheld rather than guessed. Restate it as a level or a change.',
    description:
      'The constraint does not say whether its value is a level or a change, and the producer refuses to guess between them.',
    suggestion: 'Restate that target as a level to reach or a change from today',
  }),

  // Producer: root ancestors with no observed value and no ParameterUncertainty
  // defaulted to 0.0, so "goal-level probabilities partially rest on
  // placeholder zeros". PARTIALLY is load-bearing — the result is degraded,
  // not void.
  GOAL_ANCESTOR_DATA_GAP: () => ({
    title:
      'Some starting factors feeding your goal have no value recorded, so part of your goal\'s probability rests on placeholder zeros. Add current values for those factors.',
    description:
      'The goal is still scored from its forward-propagated distribution, but some of what feeds it is a placeholder rather than a measurement.',
    suggestion: 'Add current values for the starting factors that feed your goal',
  }),

  // Producer: goal is a root, has no ParameterUncertainty and epsilon_std == 0,
  // so "its samples are the constant base".
  GOAL_NODE_ROOT_STATIC: () => ({
    title:
      'Nothing feeds into your goal and it has no uncertainty set, so its value is fixed rather than modelled. Connect the factors that drive it, or give it a range.',
    description:
      'With no parents, no parameter uncertainty and no noise, every simulated sample of the goal is the same number.',
    suggestion: 'Connect the factors that drive your goal, or give the goal a range',
  }),

  // ── Kind B (user-stated ranges): the closed RangeFitRefusalCode vocabulary ─
  // ⚠ THESE ARE NOT COMPUTE DEGRADATION, despite sitting beside it on the wire.
  // At `services/range_fit.py` each is a refusal of a range the USER stated,
  // and the producer's own remedies are user actions. `models/range_fit.py`
  // states the posture that every sentence below must carry: "A refusal always
  // means: the value stays disclosed as confirmed, NO distribution is produced,
  // compute is untouched." Without that clause a user reads a range refusal as
  // a broken analysis, which is the opposite of what happened.

  RANGE_OPEN_ENDED: () => ({
    title:
      'A range you stated has only one end, which doesn\'t pin down a distribution — the value is still used as you confirmed it. State both ends.',
    description:
      'Open-ended statements ("at least X" / "no more than X") plus a coverage do not determine a distribution, so no distribution was fitted.',
    suggestion: 'State both ends of the range',
  }),
  RANGE_INVALID_ORDER: () => ({
    title:
      'A range you stated runs from high to low, so it wasn\'t used — the value is still used as you confirmed it. Restate it lowest first.',
    description:
      'The bounds are never silently swapped: order is part of what was said, and an inverted range is more likely a slip worth seeing than a convention to normalise.',
    suggestion: 'Restate the range with the lower bound first',
  }),
  RANGE_ZERO_WIDTH: () => ({
    title:
      'A range you stated has the same number at both ends, so there\'s no uncertainty to fit — the value is still used as you confirmed it. Give it some width, or leave it as a single value.',
    description:
      'A zero-width range asserts a certainty this method cannot represent; a single confirmed value is the way to express that.',
    suggestion: 'Give the range some width, or leave the value as confirmed',
  }),
  RANGE_NON_FINITE: () => ({
    title:
      'A range you stated isn\'t a pair of finite numbers, so it wasn\'t used — the value is still used as you confirmed it. Restate it with two numbers.',
    description: 'Range bounds must both be finite numbers; they are never silently skipped.',
    suggestion: 'Restate the range with two finite numbers',
  }),
  RANGE_OUT_OF_DOMAIN: () => ({
    title:
      'A range you stated falls outside what that quantity can be, so it wasn\'t used — the value is still used as you confirmed it. Restate it within the factor\'s range.',
    description:
      'The stated bounds lie outside the quantity\'s declared domain. They are never clamped, because clamping would invent a different range from the one you stated.',
    suggestion: 'Restate the range within the quantity\'s domain',
  }),
  RANGE_AT_DOMAIN_EDGE: () => ({
    title:
      'A range you stated sits exactly on the edge of what that quantity can be, which no distribution can fit — the value is still used as you confirmed it. Move the bound just inside.',
    description:
      'No distribution in this family can place a quartile exactly at the edge of its support. Bounds very close to the edge are legitimate and are fitted normally.',
    suggestion: 'Move the bound just inside the edge',
  }),
  // The one solver-failure member of the family. Still bound to the range the
  // user stated, so the route is about the range, not about re-running.
  RANGE_FIT_NONCONVERGENT: () => ({
    title:
      'Olumi couldn\'t fit a distribution to one of the ranges you stated — the value is still used as you confirmed it. Try slightly wider bounds.',
    description:
      'The fit did not converge for this range. No fallback distribution is invented, because a minted distribution wearing real provenance would be worse than none.',
    suggestion: 'Try slightly wider bounds',
  }),

  // ── Kind C: defaulting and modelling notices ─────────────────────────────
  // A value was defaulted, or a modelling rule applied. These are info-severity
  // at the producer and surface in the Advanced list, not the top strip.

  ROOT_NODE_DEFAULT_VALUE: () => ({
    title:
      'A starting factor has no current value recorded, so zero was assumed — anything downstream of it may be unreliable. Add its current value.',
    description:
      'The producer defaults an unspecified root value to 0.0 and says so rather than hiding it. Results for downstream factors inherit that assumption.',
    suggestion: 'Add the current value for that starting factor',
  }),
  CONSTRAINT_NODE_DEFAULT_BASE: () => ({
    title:
      'A factor carrying a success target has no current value or uncertainty recorded, so zero was assumed as its starting point. Add its current value.',
    description:
      'With no parameter uncertainty the base is taken as a zero offset and the parents\' contribution propagates on top of it.',
    suggestion: 'Add the current value for that factor',
  }),
  // Not user-actionable — the honest route is how to READ the number, which is
  // still a route: it tells the reader what to do with what they are seeing.
  CONSTRAINT_SAMPLES_UNNOISED: () => ({
    title:
      'Some success-target factors didn\'t get the extra real-world variation applied to your goal, so their probabilities reflect model variation only — read them as more confident than they are.',
    description:
      'Auto-scaled noise was applied to the goal samples but not to these constraint samples, so the two are not on the same footing.',
  }),
  GOAL_OBSERVED_VALUE_UNUSED: () => ({
    title:
      'Your goal is modelled from the factors feeding it, so the current value you recorded on the goal itself isn\'t used as its starting point. Record current values on those factors instead.',
    description:
      'For a goal with parents the distribution is the forward-propagated composition of those parents, so a value recorded on the goal has nothing to attach to.',
    suggestion: 'Record current values on the factors that feed your goal',
  }),
  // Pure semantics. Saying "no action is needed" IS the route here: it tells the
  // reader to stop looking for something to fix.
  GOAL_PU_BASE_ADDITIVE: () => ({
    title:
      'Your goal\'s own uncertainty is added on top of what the factors feeding it contribute, rather than replacing it — this is how its range is built, and no action is needed.',
    description:
      'Each sample draws a base from the goal\'s own distribution and adds the parents\' propagated contribution. The goal is shifted by that base, not pinned to it.',
  }),
}

// ─── ISL inference-warning classification ────────────────────────────────────

/**
 * The three kinds an ISL `inference_warnings` code can belong to. The kind is
 * what makes the copy defensible: it decides whether the sentence may name a
 * user action at all.
 *
 *  · `compute_degradation` — a phase did not complete (budget exhausted, or an
 *    estimator failed). NOT the user's fault; there may be nothing to do but
 *    re-run or accept the reduced scope. This is the family the old generic
 *    fallback actively lied about.
 *  · `model_shape` — something about the model or a stated input genuinely
 *    limits what can be computed. The user CAN act.
 *  · `defaulting_notice` — a value was defaulted or a modelling rule applied.
 *    The user may want to supply the real value.
 */
export type InferenceWarningKind =
  | 'compute_degradation'
  | 'model_shape'
  | 'defaulting_notice'

/**
 * The 26 ISL codes that reach this UI, classified.
 *
 * ⚠ THIS IS A CROSS-REPO, CROSS-LANGUAGE MIRROR AND IT WILL DRIFT. ISL types
 * `code` as a bare `str` with no registry (a registry sweep over ISL reads
 * zero), so nothing can derive this list from the producer at build time. It
 * was enumerated by an AST walk over every `InferenceWarning(...)` construction
 * site at ISL `staging` 28fe0c95 — 28 codes, of which PLoT drops two
 * (`STRENGTH_MEAN_CLAMPED`, `EXISTS_PROBABILITY_DEFAULT`) at `run.ts:3759`
 * because it requires a derivable message and those two carry only structured
 * numerics.
 *
 * ⭐ SO THIS MAP IS NOT THE PROTECTION. A guard derived from it proves the map
 * and the templates agree; it can never prove the map is COMPLETE, and it is
 * structurally blind to an ISL code added tomorrow. The protection that
 * actually holds is the GENERIC FALLBACK below being true of anything — which
 * is why the fallback is no longer factor-framed. Treat this map as
 * documentation of intent that happens to be machine-checkable, and the
 * fallback as the thing standing between a new code and a false sentence.
 */
export const ISL_INFERENCE_WARNING_KINDS: Readonly<Record<string, InferenceWarningKind>> = {
  // Compute / budget degradation
  E_VALUES_UNAVAILABLE: 'compute_degradation',
  STABILITY_BANDS_UNAVAILABLE: 'compute_degradation',
  FACTOR_FLIPS_UNAVAILABLE: 'compute_degradation',
  PATH_DECOMPOSITION_UNAVAILABLE: 'compute_degradation',
  EVPI_UNAVAILABLE: 'compute_degradation',
  FACTOR_EVPPI_UNAVAILABLE: 'compute_degradation',
  FACTOR_EVPPI_PARTIAL: 'compute_degradation',
  FACTOR_EVPC_UNAVAILABLE: 'compute_degradation',
  // Model shape
  GOAL_THRESHOLD_NOT_CONVERTIBLE: 'model_shape',
  GOAL_THRESHOLD_FRAME_UNSPECIFIED: 'model_shape',
  CONSTRAINT_NOT_CONVERTIBLE: 'model_shape',
  CONSTRAINT_FRAME_UNSPECIFIED: 'model_shape',
  GOAL_ANCESTOR_DATA_GAP: 'model_shape',
  GOAL_NODE_ROOT_STATIC: 'model_shape',
  // Model shape — user-stated range refusals (compute is untouched)
  RANGE_OPEN_ENDED: 'model_shape',
  RANGE_INVALID_ORDER: 'model_shape',
  RANGE_ZERO_WIDTH: 'model_shape',
  RANGE_NON_FINITE: 'model_shape',
  RANGE_OUT_OF_DOMAIN: 'model_shape',
  RANGE_AT_DOMAIN_EDGE: 'model_shape',
  RANGE_FIT_NONCONVERGENT: 'model_shape',
  // Defaulting / modelling notices
  ROOT_NODE_DEFAULT_VALUE: 'defaulting_notice',
  CONSTRAINT_NODE_DEFAULT_BASE: 'defaulting_notice',
  CONSTRAINT_SAMPLES_UNNOISED: 'defaulting_notice',
  GOAL_OBSERVED_VALUE_UNUSED: 'defaulting_notice',
  GOAL_PU_BASE_ADDITIVE: 'defaulting_notice',
}

// ─── Internal token detection ────────────────────────────────────────────────

/** V14.3: Consolidated internal-token regex. If resolved text trips this, displayText = null. */
const INTERNAL_TOKEN_REGEX = /constraint_[a-z_]+|observed_state\.|intercept\s*=|fac_[a-z_]+|blocks_analysis|node_id\s*=|edge_id\s*=|opt_[a-z_]+|goal_[a-z_]+|compared as-is by ISL|no derivable range/i

// ─── Label resolution ────────────────────────────────────────────────────────

const FALLBACK_LABEL = 'This factor'

/**
 * V12.2: Generate human-readable label from raw factor ID.
 * Strips fac_ prefix, replaces underscores with spaces, title cases each word.
 */
function factorIdToLabel(factorId: string): string {
  let label = factorId.replace(/^fac_/, '').replace(/_/g, ' ')
  label = label.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return label
}

/**
 * Resolve a human-readable factor label from the critique.
 *
 * Resolution chain (global rule: nodeId → graph store only, never parse messages):
 * 1. affectedNodes[0] → nodeLabels map → use label
 * 2. affectedNodes[0] exists but not in map → derive label from ID (V12.2)
 * 3. No affectedNodes → "This factor", no factorId
 */
function resolveFactorLabel(
  item: UncertaintyItem,
  nodeLabels?: Map<string, string>,
): { label: string; factorId?: string } {
  const nodeId = item.affectedNodes?.[0]
  if (nodeId && nodeLabels?.has(nodeId)) {
    return { label: nodeLabels.get(nodeId)!, factorId: nodeId }
  }
  if (nodeId) {
    // V12.2: Derive label from ID instead of generic fallback
    return { label: factorIdToLabel(nodeId), factorId: nodeId }
  }

  return { label: FALLBACK_LABEL }
}

// ─── Main function ───────────────────────────────────────────────────────────

/**
 * Convert a raw PLoT critique into user-safe copy.
 *
 * @param item — UncertaintyItem from useResultsSectionData
 * @param nodeLabels — Map of nodeId → display label (from graph nodes)
 * @returns Humanised title, description, suggestion, and optional factorId
 */
export function humaniseCritique(
  item: UncertaintyItem,
  nodeLabels?: Map<string, string>,
): HumanisedCritique {
  const { label: factorLabel, factorId } = resolveFactorLabel(item, nodeLabels)

  // Lane 3 (ROADMAP 2.358): for the codes whose display copy is OWNED by
  // CEE's critique pipeline, a clean `userMessage` wins over any UI template.
  // For S-bucket codes that text is the Paul-approved 2026-04-30 copy
  // rendered CEE-side with resolved labels — a UI template rewriting it is a
  // surface stating its own version of an approved claim (pass-condition 2
  // class; SAMPLES_REDUCED_FOR_COMPLEXITY was live in both maps). Scope is
  // DELIBERATELY narrow: for every other code the V14.3 template-first
  // contract stands (templates carry label-resolved titles + CTA
  // suggestions that generic engine copy lacks — pinned in
  // humaniseCritique.spec.ts "template takes precedence"), and templates
  // still serve owned-code rows that arrive WITHOUT user_message (the
  // reduced-precision safety net). Contaminated userMessage falls through to
  // template/generic exactly as before (positive-control-pinned).
  if (
    CEE_OWNED_CRITIQUE_CODES.has(item.code) &&
    item.userMessage &&
    !INTERNAL_TOKEN_REGEX.test(item.userMessage)
  ) {
    return {
      title: item.userMessage,
      description: 'Review this factor to improve result accuracy.',
      displayText: item.userMessage,
      // Wire-carried remediation (projected `suggestion` → mapper
      // `suggested_fix` → consumer `suggestion`) rides along when present —
      // no auto-generated CTA is invented for producer rows without one.
      ...(item.suggestion ? { suggestion: item.suggestion } : {}),
      factorId,
    }
  }

  // Try mapped template
  const template = CODE_TEMPLATES[item.code]
  if (template) {
    const result = template(factorLabel)
    const displayText = INTERNAL_TOKEN_REGEX.test(result.title) ? null : result.title
    return { ...result, displayText, factorId }
  }

  // Message-based safety net for a row that carries PLoT's range MESSAGE under
  // a code this map does not hold (historically `GENERAL`).
  //
  // ⭐ RE-POINTED (N-21 item 4). It used to resolve to the invented
  // `CONSTRAINT_NO_DERIVABLE_RANGE` template, i.e. the "has no estimate set"
  // sentence — a DIFFERENT finding from the one the message describes. The
  // phrase is PLoT's `CONSTRAINT_MISSING_RANGE` message verbatim
  // (`preflight-v2.ts:677`), so that is the template it must reach.
  //
  // Note this branch sits AFTER the code-keyed lookup, and
  // `CONSTRAINT_MISSING_RANGE` IS in the map — so for any correctly-coded
  // producer row it is unreachable by construction. It survives only as the
  // net for a mis-coded one, and it now lands on the same sentence that row
  // would have got.
  if (/no derivable range/i.test(item.message)) {
    const result = CODE_TEMPLATES.CONSTRAINT_MISSING_RANGE(factorLabel)
    const displayText = INTERNAL_TOKEN_REGEX.test(result.title) ? null : result.title
    return { ...result, displayText, factorId }
  }

  // Safe fallback — NEVER expose raw message
  if (import.meta.env.DEV) {
    console.warn('[humaniseCritique] Unmapped critique code:', item.code, '| Raw message:', item.message)
  }

  // V14.2→V14.3b: Prefer user_message from PLoT (humanised by the engine) over generic fallback.
  // No auto-generated suggestion — only template-matched codes get actionable CTAs.
  // Items without suggestion are excluded from the banner but shown in ConfidenceSection.
  // V14.3b: If userMessage contains internal tokens, fall through to generic fallback —
  // never use contaminated text as title (which renders in ConfidenceSection Group 2).
  if (item.userMessage && !INTERNAL_TOKEN_REGEX.test(item.userMessage)) {
    return {
      title: item.userMessage,
      description: 'Review this factor to improve result accuracy.',
      displayText: item.userMessage,
      factorId,
    }
  }

  // No user_message and no template match → generic fallback.
  // displayText: null → excluded from banner. Title/description still render
  // inside ConfidenceSection rows for unmapped codes.
  //
  // ⭐⭐ THIS IS THE LOAD-BEARING HONESTY GUARANTEE, NOT THE TEMPLATE MAP.
  // It used to read "Review this factor's inputs" / "Some information needed to
  // assess this factor isn't available yet." That was a FACTOR-FRAMED sentence
  // asserted over an OPEN vocabulary, and it was the source of the defect this
  // block was rewritten to fix: 24 of the 26 ISL `inference_warnings` codes
  // landed here, and for the compute-degradation family it was actively false —
  // it blamed the user's factor inputs for a phase that ran out of budget, and
  // prescribed an action that could not help. The templates above fix the 26
  // codes we know about. THIS fixes code 29, which ISL has not written yet.
  //
  // The three properties it must keep, and why each is load-bearing:
  //  1. NOT FACTOR-FRAMED. An unmapped code may be about a factor, the goal, a
  //     constraint, a stated range, or a compute phase. Only a claim true of
  //     all of them may be made, so it claims nothing about WHAT is limited.
  //  2. NO PRESCRIBED ACTION. We cannot know one is warranted, and a futile
  //     instruction is the exact defect being fixed — one level up.
  //  3. STILL A ROUTE, NOT A DEAD END. It names where the raw code IS visible:
  //     the audit trail, where `ModelHealthSection` lists inference-warning
  //     codes verbatim. A machine code is correct content for an audit trail
  //     and wrong content for a caveat strip, so pointing there is the honest
  //     onward step — the user can quote it, and support can resolve it.
  //
  // It also does not promise the rest of the result is unaffected. That IS true
  // of every degradation code above, and is stated in each of their templates
  // on the producer's own authority — but it is not knowable for a code we
  // cannot classify, and asserting it here would be the same overreach in the
  // reassuring direction.
  return {
    title: 'Part of this analysis was limited',
    description:
      'Olumi\'s engine reported a condition this version has no wording for yet. Nothing has been hidden — the raw code is listed in the run\'s audit details.',
    displayText: null,
    factorId,
  }
}
