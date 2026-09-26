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

/**
 * ⚠ `labelIsGenuine` IS NOT OPTIONAL INFORMATION — IT IS THE WHOLE GUARD.
 * `resolveFactorLabel` returns a label in every case: a real one from the
 * store, else `factorIdToLabel(nodeId)` — which for `c591da5e` is the string
 * "C591da5e" — else "This factor". Only the first is safe to print. A template
 * that interpolates `factorLabel` without checking this flag will publish an
 * engine identifier as prose, which is the defect this module exists to stop.
 */
type TemplateFactory = (
  factorLabel: string,
  labelIsGenuine: boolean,
) => Omit<HumanisedCritique, 'factorId' | 'displayText'>

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
  // ⛔⛔ THIS TEMPLATE BROKE THIS FILE'S OWN RULE, AND IT REACHED A USER.
  //
  // Measured on `olumi-debug-1dd2133d-20260916.json` (staging, UI `6497a251`),
  // the deployed Question card rendered, verbatim:
  //
  //     "This factor's success target can't be evaluated reliably
  //      Set a value or range for This factor."
  //
  // `This factor` is `FALLBACK_LABEL` — `resolveFactorLabel`'s unresolved
  // sentinel — printed at the user twice, once as a possessive subject. The
  // rule against exactly this is stated twice above (the 2.300 goal templates
  // at :244-246, and the whole-vocabulary statement at :457-463: *"EVERY
  // TEMPLATE IGNORES THE RESOLVED LABEL, DELIBERATELY … Interpolating a label
  // here would print that string at the user"*). The rule was right; it simply
  // never reached this entry. That is the estate's named failure mode — the
  // remedy scoped to the instance while nothing swept its siblings — so the
  // companion spec pins the REMAINING unguarded templates as an explicit,
  // exact set rather than leaving the class unobserved.
  //
  // ⚠ WHY A LABEL MAP IS NOT THE FIX, settled at the bytes rather than assumed.
  // In that export the warning arrives as `{code, message, severity}` and
  // NOTHING else — no `affected_nodes`, no `field` — so there is no id to
  // resolve and `DecisionNode`'s own comment (*"a label map would change
  // nothing today"*) is correct. The producer's `message` DOES name the node
  // ("Budget Overrun Risk"), and it stays unread: parsing identity out of
  // message prose is the V14.3 rule `withheldLeaderDisclosure.ts` exists to
  // uphold.
  //
  // ⚠ AND THE ANONYMOUS FORM ASSERTS NO KIND. The target in that run was a
  // RISK node, so "factor" was not merely unresolved, it was wrong. The
  // anonymous copy says "the part of your model this target applies to",
  // matching the sentence CEE already uses for the same situation.
  //
  // The `genuine` branch is the pattern `GOAL_ANCESTOR_DATA_GAP` and
  // `ROOT_NODE_DEFAULT_VALUE` already use; this adopts it rather than minting
  // a second mechanism.
  //
  // ⛔ NO REMEDY, IN EITHER BRANCH (AI Quality, #70 5843266323, 26 Sep 2026).
  // "Set a current value or range…" was prescribed for a cause the wire does
  // not carry. On Paul's churn limit the factor ALREADY had a current value and
  // parents, every turn still carried this code, and PLoT's own message said a
  // current value "would not change that — it is calculated from its inputs".
  // The entry is `{code, message, severity}` and nothing else, so the UI cannot
  // tell a missing value from an uncheckable target and must not prescribe
  // either. The description likewise stops asserting "missing or unscaled".
  // Every consumer already renders the title alone when `suggestion` is empty
  // (`endSentence('')` is `''`; the strips guard on `c.suggestion &&`).
  CONSTRAINT_TARGET_UNRELIABLE: (label, genuine) => ({
    title: genuine
      ? `${label}'s success target can't be evaluated reliably`
      : "A success target on your model can't be evaluated reliably",
    description: 'This target could not be checked against this model, so the probability of reaching it was withheld for this run rather than shown as a meaningless number.',
    suggestion: '',
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
  //
  // ⚠⚠ AND THAT REMEDY WAS A FALSE PRESCRIPTION — INSTRUCTION REMOVED, and the
  // two paragraphs above are left as said because they record why it was put
  // there. "State the current level for your goal" told the user to do
  // something the product gives them NO WAY TO DO. Measured at UI `staging`
  // 67b04e5b: `GoalPanel.tsx` (881 lines) holds ZERO `observed_state`
  // references — contrast control in the same sweep, 31 hits for `target`, so
  // the zero is real absence and not a blind instrument — and
  // `GoalThresholdEditor.tsx` (105 lines) holds zero too, contrast 6: it is a
  // TARGET editor only. The canvas projection's one `observed_state` writer
  // (`readinessStore.ts:379`) is gated `nodeKind === 'factor'` and emits
  // `value`/`raw_value`, never `baseline` and never for the goal. Worse, the
  // starter drafts' own `fix_hint` points at the goal node's
  // `observed_state.value` — precisely the field ISL refuses, on the stated
  // grounds that repurposing "the current observed value" would be a second
  // unattested frame assumption.
  //
  // ⭐ THE TWO FACTS STAY; THE INSTRUCTION GOES. The old wording also invited
  // the WRONG reading — "we could not find your target" — when ISL's resolver
  // is fail-closed (`if threshold is None: return None, None`), so NO threshold
  // means SILENCE, not this warning. This warning firing is positive evidence
  // the target DID arrive. So the copy now states the capture as a fact and the
  // withhold as a fact, and prescribes nothing: an instruction that cannot be
  // followed is worse than no instruction, and inventing a different one would
  // just move the lie.
  //
  // ⭐ WIRE-WITNESSED on staging--olumi.netlify.app at 67b04e5b (fresh guest,
  // 8 keys cleared from /version.json; draft 200 in 54.9s, deliberate rerun 200
  // in 12.1s; two independent captures carried byte-identical arrays). The run
  // emitted, verbatim:
  //   code:    GOAL_THRESHOLD_NOT_CONVERTIBLE
  //   field:   nodes[b4014d90].observed_state.baseline
  //   message: "A 'level' frame requires goal node 'b4014d90' to carry
  //             observed_state.baseline to convert the level into the samples'
  //             frame, but it carries no observed_state at all."
  // So the reason IS the missing goal baseline, and the engine is blunter than
  // the old copy was: the goal node carries NO observed_state AT ALL, while the
  // copy asked only for "the current level". The same run also confirms the
  // target arrived — the goal node read "Target: 12 months / Target set."
  //
  // ⚠ SCOPE OF ONE ABSENCE, STATED NARROWLY (trap 20). The token
  // `missing_goal_baseline` named in the paragraph above does NOT appear in any
  // of the 13 captured payloads — the warning object's keys are exactly
  // {code, message, severity, field}, with no reason/enum field — while two
  // contrast controls in the same sweep (`GOAL_THRESHOLD_NOT_CONVERTIBLE`,
  // `observed_state.baseline`) both fired, so that zero is real absence and not
  // a blind probe. That refutes only the claim that the token reaches the WIRE.
  // It says nothing about ISL's internal `refuse()` reason names, which is what
  // the paragraph was describing and which this capture was not pointed at.
  //
  // → ROADMAP 2.281 is the missing producer: nothing writes the goal node's
  //   `observed_state.baseline`. WHEN 2.281 LANDS AND A GOAL CURRENT-LEVEL
  //   EDITOR EXISTS, THE INSTRUCTION BECOMES LEGITIMATE AND SHOULD COME BACK.
  //   `goalThresholdNoUnreachableInstruction.spec.ts` pins the absence TO ITS
  //   REASON rather than to a literal, so it REDs the day a goal editor gains
  //   an `observed_state` writer — that red is the signal to restore it, not a
  //   regression. No flag, no second code path, and the withhold gate itself is
  //   untouched.
  //
  // ══════════════════════════════════════════════════════════════════════════
  // ⚠⚠ AND THE SENTENCE ALSO BLAMED THE TARGET, ON THE SAME SCREEN THAT WAS
  // DISPLAYING IT. Second measurement, independent of the one above: Netlify
  // deploy `6aa1fdec0d71200008252154` (UI `9eb30b54`) at 2026-09-10T02:05:56Z,
  // fresh guest, Reasoning tab rendered within three lines of each other:
  //
  //   "Your goal's target couldn't be measured for this run. State the
  //    current level for your goal."          <- this template's old title
  //   grow monthly recurring revenue to at least £250k by March
  //   Options 3 · Factors 3 · Risks 1 · Outcomes 1
  //   "Target £250,000 · From brief · Change"  <- the same tab, same screen
  //
  // The same turn's wire carried `goal_threshold_raw: 250000`,
  // `goal_threshold_unit: "£"` and `goal_target_stated: true`. A reader
  // scanning this concluded their number had not been captured, while the tab
  // displayed it. So there were TWO harms in one string: a false ATTRIBUTION
  // and a false PRESCRIPTION. They are closed together here.
  //
  // ⭐ WHY THE FALSE ATTRIBUTION IS FALSE ON THE WHOLE DOMAIN, NOT JUST ON
  // THAT RUN. Derived at ISL `staging` 7781ca4f (2026-09-01),
  // `robustness_analyzer_v2.py`: the nine `refuse()` sites of the shared
  // engine `_resolve_threshold_in_sample_frame` (:3818) are the complete
  // range - `missing_goal_baseline` (:3970, the common one, and the one the
  // capture above witnessed), `goal_pinned_by_intervention` (:3932),
  // `root_goal` (:3944), `goal_parameter_uncertainty_shifts_base` (:3956),
  // `goal_values_outside_normalised_domain` (:4027),
  // `epsilon_breaks_status_quo_reference` (:4076),
  // `auto_scaled_noise_breaks_status_quo_reference` (:2218, flag-off), plus
  // `goal_node_missing` (:3922) and `non_finite_conversion_input` (:3995),
  // both API-unreachable by the producer's own validators.
  // NOT ONE OF THEM MEANS THE TARGET WAS NOT CAPTURED, and the producer makes
  // that structural: `if threshold is None: return None, None` (:3745-3749),
  // so a missing target discloses NOTHING (pinned producer-side by
  // `test_no_threshold_requested_is_silent`). Every refusal fires with the
  // user's number in hand and echoes it in `detail["goal_threshold"]`.
  //
  // ⭐ SO THERE IS NOTHING TO NAME APART HERE (trap 21). "Can this also fire
  // when there genuinely is no target?" is answered NO by construction, so the
  // copy may presuppose a target: that presupposition holds on every path.
  // The separate `Target not captured` chip (`GoalNode.GOAL_NO_TARGET_STATE`)
  // owns the genuinely-absent case and is a different surface with a different
  // trigger; it did not render on this run because a target existed.
  //
  // ⭐ WHY THE TITLE NOW NAMES THE COMPARISON AND NOT MERELY "fit". The eight
  // reachable reasons are indistinguishable on this side of the wire - the
  // UI's `InferenceWarning` (`types.ts:985-1000`) carries no `detail`, so no
  // `reason` - so one sentence has to be true of all eight. What all eight
  // share is that the number arrived and could not be placed against where the
  // goal stands today. "couldn't measure fit against it" is true but names no
  // missing quantity, which leaves the reader nothing to understand; naming
  // the comparison is the most the wire supports without inventing a cause.
  // `CONSTRAINT_NOT_CONVERTIBLE`'s title (:409) already said exactly this for
  // the per-constraint twin, on the SAME producer rules, so this mints no new
  // vocabulary: the two family members now read as one.
  //
  // ⛔ AND THE INSTRUCTION STAYS OUT, on the evidence in the block above. A
  // separate check of the Reasoning tab's model strip found a goal editor that
  // does exist - `SuccessTargetLine.tsx` writes `success_threshold` through
  // `setGoalThresholdAndUpdateNode` - but that writes the TARGET, not the
  // current level, and `clientCanWriteReadableGraph()` returns a hardcoded
  // `false` (`src/lib/clientGraphWritePolicy.ts:55`) so the edit does not
  // survive a reload. Neither fact makes "state the current level" reachable.
  // A remedy pointing at a control whose effect evaporates on reopen is worse
  // than none, because the user believes it worked.
  // ══════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════
  // ⭐⭐ WHY THIS NAMES A QUANTITY AND NOT "goal-fit results" (trap 21).
  // WITNESSED on served `475ee1c7`, Reasoning tab, one screen: this template's
  // title rendered "…so goal-fit results were withheld rather than guessed"
  // directly above "Most likely to serve your goal / Extend Shift Hours at the
  // Existing Site / Scored highest in 48% of simulated futures". The same
  // turn's `analysis_result` carried `leading_option_id` and `win_probabilities`
  // with `permitted_analysis_mode: comparative_leader`.
  //
  // BOTH STATEMENTS WERE TRUE. They answer different questions: the absolute
  // probability of REACHING THE TARGET (genuinely withheld here) and the
  // COMPARATIVE RANKING (genuinely produced, licensed by a separate gate).
  // "goal-fit results" is broad enough to cover the second, so the sentence
  // over-claimed the scope of its own withhold and the panel read as
  // self-contradicting on its primary surface.
  //
  // ⛔ THE FIX IS THE NAME, NOT THE GATE. Nothing here suppresses the ranking
  // and nothing deletes the notice; "rather than guessed" stays because the
  // sentence's job is to say the silence is DELIBERATE.
  //
  // ⚠ "probability" ALONE WOULD NOT HAVE SEPARATED THEM — "Scored highest in
  // 48% of simulated futures" is also a probability. The discriminator is what
  // it is a probability OF, so the copy names the target.
  //
  // ⭐ THE ESTATE ALREADY RATIFIED THIS NAMING ON THE CANVAS: ROADMAP 2.275
  // closed the identical shape on `GoalNode` (`GoalNode.tsx:744-761`), where a
  // node denied a goal probability while per-option goal-fit figures rendered
  // from the same report. Same resolution, reused rather than re-minted.
  //
  // DERIVED, NOT ASSUMED: `licensesComparativeLeaderClaim`
  // (`canvas/hooks/useAnalysisReady.ts:170-174`) reads ONLY
  // `admission.permitted_analysis_mode` and never `inference_warnings`, so a
  // goal-threshold refusal cannot withdraw the comparative claim. The
  // co-render is reachable BY CONSTRUCTION, not a one-off capture, and it is
  // true of ALL of this code's reachable refusal reasons (enumerated above):
  // every one of them fails to resolve the threshold into the samples' frame,
  // and not one of them touches the ranking.
  // `analysisNew/__tests__/goalWithholdNamesTheQuantity.spec.tsx` pins it.
  // ══════════════════════════════════════════════════════════════════════════
  GOAL_THRESHOLD_NOT_CONVERTIBLE: () => ({
    title:
      "Your goal's target was recorded, but it couldn't be compared with where the goal stands today, so the probability of reaching it was withheld rather than guessed.",
    description:
      "Your target was captured. What this run couldn't do is compare it with where the goal stands today, for example when no current level is recorded for the goal. The probability of reaching your target was withheld rather than guessed.",
    // No suggestion: there is no action the user can take until ROADMAP 2.281.
  }),
  GOAL_THRESHOLD_FRAME_UNSPECIFIED: () => ({
    title: "Your goal's target could mean a level or a change. Restate the target as a level to reach or a change from your current level.",
    description: "The target doesn't say whether it's a level to reach or a change from today, so the probability of reaching it was withheld for this run rather than guessed.",
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
      'The check on how wrong your assumptions could be before a different option leads in this model didn\'t run. The analysis hit its time limit. Your results stand; re-run to add it.',
    description:
      'E-value analysis was skipped for time. It does not affect which option leads in this model, the probabilities, or anything else already shown.',
  }),

  // Reasons: e_values_unavailable | request_budget_exhausted |
  // flip_stability_budget_exceeded. All three roots are the time budget: the
  // bands ride on the E-value sweep, so "unavailable because E-values were
  // unavailable" is still a budget story, never a model one.
  STABILITY_BANDS_UNAVAILABLE: () => ({
    title:
      'The confidence bands around the tipping points didn\'t run. The analysis hit its time limit. Your results stand; re-run to add them.',
    description:
      'Flip-stability bands ride on the E-value sweep, which the request budget could not fund. Nothing else shown is affected.',
  }),

  // Reasons: request_budget_exhausted | factor_flip_budget_exceeded.
  // All-or-nothing at the producer, so this is never a partial set.
  FACTOR_FLIPS_UNAVAILABLE: () => ({
    title:
      'How far each factor would have to move before a different option leads in this model wasn\'t computed. The analysis hit its time limit. Your results stand; re-run to add it.',
    description:
      'Factor-flip analysis was omitted whole rather than part-computed. Nothing else shown is affected.',
  }),

  // Reasons: request_budget_exhausted | path_decomposition_budget_exceeded.
  PATH_DECOMPOSITION_UNAVAILABLE: () => ({
    title:
      'The breakdown of which causal pathways drive the result didn\'t run. The analysis hit its time limit. Your results stand; re-run to add it.',
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
      'Win-probability sensitivity was skipped. Either the request budget ran out, or a goal constraint could not be resolved into its target\'s frame. The rest of the analysis is unaffected.',
  }),

  // Reason: estimator_error. NOT a budget case — re-running an identical model
  // may well fail again, so the route says so rather than promising a retry
  // will work.
  FACTOR_EVPPI_UNAVAILABLE: () => ({
    title:
      'Olumi couldn\'t rank what\'s most worth learning next for this run. Your results stand; re-run. If it repeats, this ranking can\'t be produced for this model.',
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

  /**
   * ⭐⭐ THE THIRD EVPPI MEMBER, AND IT IS A DIFFERENT FACT FROM BOTH SIBLINGS.
   *
   * Witnessed on Paul's run `95b92672` (21 Sep 2026), where it arrived
   * UNMAPPED and rendered as the generic fallback — so the producer's actual
   * sentence never reached the screen:
   *
   *   "Value-of-information ran but produced no rows. The reason is not known
   *    at this layer and has deliberately not been inferred."
   *
   * ⛔ IT MUST NOT BORROW EITHER SIBLING'S CAUSE, which is the whole reason it
   * gets its own entry rather than an alias (CLAUDE.md trap 21 — two questions
   * under one name). `FACTOR_EVPPI_UNAVAILABLE` is an estimator FAILURE;
   * `FACTOR_EVPPI_PARTIAL` is some rows computed. This one RAN, completed, and
   * returned NOTHING — and the producer explicitly declines to say why.
   *
   * ⛔ SO NO RE-RUN IS PRESCRIBED. The siblings can honestly say "re-run"
   * because their reasons are known to be transient or model-fixed. Here the
   * reason is stated as unknown, so promising a retry would help is exactly the
   * futile instruction this module exists to refuse.
   *
   * ⚠⚠ IT DOES SAY THE REST STANDS, AND MY FIRST VERSION WITHHELD THAT — the
   * vocabulary guard refused it and was right. My reasoning was "the producer
   * does not assert it here, so neither may we." That confuses the AUTHORITY
   * for the claim with its SOURCE: value of information is a separate phase,
   * every sibling in this family states it, and `FACTOR_EVPPI_UNAVAILABLE`
   * carries it on a strictly WORSE event (the estimator failing outright). A
   * reader told only that a step returned nothing, with no word on the rest,
   * reasonably fears their comparison is compromised — so withholding the
   * clause is not caution, it is a new and worse implication.
   */
  FACTOR_EVPPI_NOT_COMPUTED: () => ({
    title:
      'Nothing was ranked as most worth learning next. That step ran and returned no rows, and the engine did not say why. Your results stand.',
    description:
      'Per-factor value of information completed without producing a ranking. Olumi\'s engine reported no reason for the empty result, and none has been inferred here.',
  }),

  // Reason: compute_error. Same posture as FACTOR_EVPPI_UNAVAILABLE.
  FACTOR_EVPC_UNAVAILABLE: () => ({
    title:
      'How much it would be worth being able to control each factor wasn\'t computed. Your results stand; re-run. If it repeats, this model can\'t produce it.',
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
      'The target could not be resolved into its factor\'s measurement frame, for example when no current level is recorded for it.',
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
  // ⚠ `field` NAMES THE GOAL, NOT THE ANCESTORS. The producer's message quotes
  // the root ancestor ids in prose; those stay unread — parsing them would be
  // the banned route, and they are the ids of nodes this sentence is not about.
  // What the structured field carries is the GOAL node, so that is what gets
  // named, and the sentence keeps saying "some starting factors" for the rest.
  GOAL_ANCESTOR_DATA_GAP: (label, genuine) => ({
    title: genuine
      ? `Some starting factors feeding ${label} have no value recorded, so part of its probability rests on placeholder zeros. Add current values for those factors.`
      : 'Some starting factors feeding your goal have no value recorded, so part of your goal\'s probability rests on placeholder zeros. Add current values for those factors.',
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

  // ── The objective sense: WHAT "this option wins" MEANT on this run ──────
  //
  // Producer: ISL `services/robustness_analyzer_v2.py:4205` at `staging`
  // c9ab543d93ef4fa3b760fe192dc36603bb05b41c. Fires whenever the request
  // carried no `goal_direction` — i.e. on every run today, because no producer
  // in the estate stamps that field yet (measured 2026-09-19 with contrast
  // controls in the same sweep: `goal_direction` ZERO in this repo, ZERO in
  // CEE `staging` 84abbb92 and ZERO in PLoT `staging` 350b0fb6, against
  // `goal_threshold` 177 here and 76 in PLoT. The contract is `olumi-schemas`
  // PR #48, open and CONFLICTING; the transport is PLoT PR #352, open).
  //
  // ISL's own model states what it means: `win_probability` has always been
  // "the fraction of draws on which this option produced the largest goal-node
  // value", while every surface renders it as "which option is best". Those
  // are different sentences. `ObjectiveRanking.attested` is FALSE here, and
  // ISL's field description is explicit that a surface presenting an unattested
  // ranking as "the best option for your goal" is overstating what was
  // computed.
  //
  // ⚠ THIS CODE POST-DATES THE AST WALK THAT BUILT THE MAP BELOW. That walk
  // ran at ISL `staging` 28fe0c95 and the map's own header predicted this:
  // "THIS IS A CROSS-REPO, CROSS-LANGUAGE MIRROR AND IT WILL DRIFT." It did.
  // Until this template existed the sentence resolved to the generic fallback,
  // measured on the Model card as the whole of what a reader saw:
  //   "Inference warnings: Part of this analysis was limited
  //    (GOAL_DIRECTION_UNATTESTED)"
  //
  // ⛔ NO SUGGESTION, AND THE OMISSION IS THE POINT. The producer's own remedy
  // is "send goal_direction", which is an instruction to a CALLER, not to a
  // reader — and this product offers no control, chat affordance or panel that
  // records an objective sense. Telling the user to state their aim would be
  // the same false prescription that was removed from
  // `GOAL_THRESHOLD_NOT_CONVERTIBLE` above, one code over. It is pinned in that
  // template's `NO_ROUTE_EXISTS` set, which asserts this copy prescribes
  // nothing rather than merely permitting it.
  //
  // ⚠ TWO COPY RULINGS SHAPE THESE TWO SENTENCES, AND CI CAUGHT BOTH AFTER A
  // FULLY GREEN FOCUSED RUN. `noEmDashesInRenderedCopy.spec.ts` (Paul,
  // 10 Sep: "no em dashes in product content — it is where a hedge gets bolted
  // on") and `noWinnerVocabulary.spec.ts` (8 Sep: say "scored highest in N% of
  // runs", never a placing) both scan this file through the Reasoning tab's
  // DERIVED import closure. The first draft used an em dash and the phrase
  // "this option wins this draw"; both were flagged. The second ruling
  // improves the copy rather than constraining it: "scored highest" is exactly
  // what the maximiser did, with none of the contest reading.
  //
  // ⛔ AND IT NEVER NAMES A DIRECTION. Inferring "minimise" from a label like
  // "churn" is exactly what the contract forbids (`GoalDirection`'s block in
  // `olumi-schemas` PR #48: "PRODUCERS MUST NOT INFER THIS FROM A NODE
  // LABEL"). A wrong inferred aim would be worse than the honest disclosure it
  // replaced.
  GOAL_DIRECTION_UNATTESTED: () => ({
    title:
      'Your options were ordered by which one produces the largest value at your goal. Nothing in this run said what the goal is for, so that ordering is this version\'s default rather than your aim. If the goal is a quantity to bring down, or one to land on a particular level, it answers a different question.',
    description:
      'Every other number in this analysis stands. What is missing is the objective sense: on this run, the option that scored highest was simply the one that produced the largest number at your goal on the most draws, and nothing confirmed that is the question you are asking.',
    // No suggestion — see the block above. There is no writer for this.
  }),

  /**
   * ⭐⭐ A SHORTER LIST IS NOT A FAILED ONE — and the producer says so plainly.
   *
   * Witnessed UNMAPPED on Paul's run `95b92672` (21 Sep 2026), where it fell to
   * the generic fallback. Its message:
   *
   *   "... carried no finite E-value from the analysis engine (an unflippable
   *    edge, whose current and flip means coincide, has no evidence ratio).
   *    ... shorter because those entries could not be represented, not because
   *    they were computed empty. All other analyses are unaffected."
   *
   * ⭐ THE LOAD-BEARING HALF IS THE SECOND SENTENCE. Absent it, a reader meets
   * a short evidence list and concludes the analysis dropped something it
   * should have had. The true reason is a property of the MODEL — reversing
   * that relationship lands on the same mean, so there is no ratio to form —
   * which is a finding in its own right, not a degradation.
   *
   * ⚠ CLASSIFIED `compute_degradation`, beside `E_VALUES_UNAVAILABLE`. The
   * REASON is a model property, but the EVENT is an E-value output that could
   * not be represented — and `model_shape` obliges copy to name a user route,
   * which nothing honest can do here.
   *
   * ⚠ NO COUNT IS GIVEN. The producer states one, but this template factory
   * takes no arguments and the number lives only in the raw message. Naming a
   * count this signature cannot see would be a fabrication; the sentence is
   * true for any number of such edges.
   *
   * ⭐ "Every other part of this analysis stands" IS carried, unlike the EVPPI
   * entry above, because THIS producer message asserts it in terms.
   */
  EDGE_E_VALUE_NON_FINITE_DROPPED: () => ({
    title:
      'Some relationships have no evidence ratio, because reversing them would land on the same answer. Your results stand.',
    description:
      'Where a relationship\'s current and reversed strength come out the same, there is no ratio to weigh, so those entries are absent from the evidence list rather than empty. Every other part of this analysis stands.',
  }),

  /**
   * ⭐ ABSENT BY CONTRACT, NOT BY FAILURE — the distinction is the whole message.
   *
   * The producer: "edge_sensitivity is empty by wire contract, not by
   * computation failure. Factor-level sensitivity is unaffected." A reader who
   * meets an empty relationship-sensitivity area and no explanation concludes
   * something broke.
   *
   * ⚠ NO WIRE TOKEN AND NO FORMAT VERSION REACHES THE COPY. "the ISL V2
   * response format" and `edge_sensitivity` are internals; the reader needs the
   * consequence, not the mechanism.
   */
  EDGE_SENSITIVITY_UNAVAILABLE_V2_WIRE: () => ({
    title:
      'Sensitivity for individual relationships is not carried by this analysis format, so it is absent by design rather than missing. Your results stand.',
    description:
      'Factor-level sensitivity is unaffected and is shown as usual. Nothing failed to compute here.',
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
      'A range you stated has only one end, which doesn\'t pin down a distribution. The value is still used as you confirmed it. State both ends.',
    description:
      'Open-ended statements ("at least X" / "no more than X") plus a coverage do not determine a distribution, so no distribution was fitted.',
    suggestion: 'State both ends of the range',
  }),
  RANGE_INVALID_ORDER: () => ({
    title:
      'A range you stated runs from high to low, so it wasn\'t used. The value is still used as you confirmed it. Restate it lowest first.',
    description:
      'The bounds are never silently swapped: order is part of what was said, and an inverted range is more likely a slip worth seeing than a convention to normalise.',
    suggestion: 'Restate the range with the lower bound first',
  }),
  RANGE_ZERO_WIDTH: () => ({
    title:
      'A range you stated has the same number at both ends, so there\'s no uncertainty to fit. The value is still used as you confirmed it. Give it some width, or leave it as a single value.',
    description:
      'A zero-width range asserts a certainty this method cannot represent; a single confirmed value is the way to express that.',
    suggestion: 'Give the range some width, or leave the value as confirmed',
  }),
  RANGE_NON_FINITE: () => ({
    title:
      'A range you stated isn\'t a pair of finite numbers, so it wasn\'t used. The value is still used as you confirmed it. Restate it with two numbers.',
    description: 'Range bounds must both be finite numbers; they are never silently skipped.',
    suggestion: 'Restate the range with two finite numbers',
  }),
  RANGE_OUT_OF_DOMAIN: () => ({
    title:
      'A range you stated falls outside what that quantity can be, so it wasn\'t used. The value is still used as you confirmed it. Restate it within the factor\'s range.',
    description:
      'The stated bounds lie outside the quantity\'s declared domain. They are never clamped, because clamping would invent a different range from the one you stated.',
    suggestion: 'Restate the range within the quantity\'s domain',
  }),
  RANGE_AT_DOMAIN_EDGE: () => ({
    title:
      'A range you stated sits exactly on the edge of what that quantity can be, which no distribution can fit. The value is still used as you confirmed it. Move the bound just inside.',
    description:
      'No distribution in this family can place a quartile exactly at the edge of its support. Bounds very close to the edge are legitimate and are fitted normally.',
    suggestion: 'Move the bound just inside the edge',
  }),
  // The one solver-failure member of the family. Still bound to the range the
  // user stated, so the route is about the range, not about re-running.
  RANGE_FIT_NONCONVERGENT: () => ({
    title:
      'Olumi couldn\'t fit a distribution to one of the ranges you stated. The value is still used as you confirmed it. Try slightly wider bounds.',
    description:
      'The fit did not converge for this range. No fallback distribution is invented, because a minted distribution wearing real provenance would be worse than none.',
    suggestion: 'Try slightly wider bounds',
  }),

  // ── Kind C: defaulting and modelling notices ─────────────────────────────
  // A value was defaulted, or a modelling rule applied. These are info-severity
  // at the producer and surface in the Advanced list, not the top strip.

  // ⭐ NAMED WHEN THE STORE KNOWS THE NAME, UNCHANGED OTHERWISE.
  // A run raises this once PER ROOT, so a model with two unset roots printed
  // this sentence twice, word for word — the reader could see that something
  // was wrong and not which factor, which is the one thing that would let them
  // fix it. The id arrives on `field` (`nodes[<id>].observed_state.value`,
  // measured DISTINCT on 6/6 captured entries); `nodeIdFromField` reads it and
  // the store resolves the name. Unresolved, this is byte-identical to before.
  ROOT_NODE_DEFAULT_VALUE: (label, genuine) => ({
    title: genuine
      ? `${label} has no current value recorded, so zero was assumed. Anything downstream of it may be unreliable. Add its current value.`
      : 'A starting factor has no current value recorded, so zero was assumed. Anything downstream of it may be unreliable. Add its current value.',
    description:
      'The producer defaults an unspecified root value to 0.0 and says so rather than hiding it. Results for downstream factors inherit that assumption.',
    suggestion: genuine
      ? `Add the current value for ${label}`
      : 'Add the current value for that starting factor',
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
      'Some success-target factors didn\'t get the extra real-world variation applied to your goal, so their probabilities reflect model variation only. Read them as more confident than they are.',
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
      'Your goal\'s own uncertainty is added on top of what the factors feeding it contribute, rather than replacing it. This is how its range is built, and no action is needed.',
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
 * The 27 ISL codes that reach this UI, classified.
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
 * ⚠⚠ RE-DERIVED 2026-09-19 AT ISL `staging`
 * c9ab543d93ef4fa3b760fe192dc36603bb05b41c, BY THE SAME METHOD — AND THE
 * MIRROR HAD DRIFTED, EXACTLY AS THE PARAGRAPH BELOW SAYS IT WOULD. The walk
 * found two direct `InferenceWarning(...)` sites this map did not hold:
 * `GOAL_DIRECTION_UNATTESTED` (`services/robustness_analyzer_v2.py:4205`) and
 * `OBJECTIVE_RANKING_WITHHELD` (`:4239`). Both carry a `detail.message`, so
 * PLoT forwards both (`run.ts:3967`) and both reach this UI's surfaces.
 *
 * `GOAL_DIRECTION_UNATTESTED` is classified below: it fires on EVERY run today
 * and it fired on both of the 2026-09-19 founder sessions.
 *
 * ⛔ `OBJECTIVE_RANKING_WITHHELD` IS DELIBERATELY NOT CLASSIFIED YET, and the
 * omission is a measurement rather than an oversight. ISL emits it ONLY on
 * `goal_direction == "target"` (`:4232`), and its own comment records that
 * this "today has zero live traffic (no producer sends the field yet)" —
 * confirmed here: `goal_direction` reads ZERO in this repo, ZERO in CEE
 * `staging` 84abbb92 and ZERO in PLoT `staging` 350b0fb6. Classifying it would
 * be copy nobody can reach, unwitnessable at any rung, in a file where every
 * template records the run it was derived from. It belongs with the producer
 * train (`olumi-schemas` PR #48 + PLoT PR #352), which is where the argument
 * for its wording can actually be tested.
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
  // Added 2026-09-21: code 29, witnessed live on run `95b92672`. It post-dates
  // the 28fe0c95 AST walk this map was built from — the drift the vocabulary
  // spec's property (4) predicted, arriving exactly as described.
  FACTOR_EVPPI_NOT_COMPUTED: 'compute_degradation',
  // Added 2026-09-21: code 32. Absent BY WIRE CONTRACT, not by failure — which
  // is why the copy says the results stand rather than describing a shortfall.
  EDGE_SENSITIVITY_UNAVAILABLE_V2_WIRE: 'compute_degradation',
  FACTOR_EVPC_UNAVAILABLE: 'compute_degradation',
  // Model shape
  GOAL_THRESHOLD_NOT_CONVERTIBLE: 'model_shape',
  GOAL_THRESHOLD_FRAME_UNSPECIFIED: 'model_shape',
  CONSTRAINT_NOT_CONVERTIBLE: 'model_shape',
  CONSTRAINT_FRAME_UNSPECIFIED: 'model_shape',
  GOAL_ANCESTOR_DATA_GAP: 'model_shape',
  GOAL_NODE_ROOT_STATIC: 'model_shape',
  // Added 2026-09-19: post-dates the 28fe0c95 AST walk (ISL
  // `robustness_analyzer_v2.py:4205` at `staging` c9ab543d). `model_shape`
  // because the limit is a fact about the request, not a compute failure —
  // but it is in `NO_ROUTE_EXISTS`: the user CANNOT act, because nothing in
  // the estate writes `goal_direction`.
  GOAL_DIRECTION_UNATTESTED: 'model_shape',
  // Added 2026-09-21: code 30, witnessed live on run `95b92672`. Sits beside
  // its direct sibling `E_VALUES_UNAVAILABLE` — the EVENT is an E-value output
  // that could not be represented, even though the REASON is a model property.
  // ⚠ I first classified it `model_shape` and the vocabulary guard refused it:
  // `model_shape` copy must name a route the user can take, and there is none
  // here that is honest. Telling someone to change a relationship's strength so
  // that a diagnostic appears is prescribing a model edit to produce a number,
  // which is the futile-instruction defect one level up.
  EDGE_E_VALUE_NON_FINITE_DROPPED: 'compute_degradation',
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
  nodeLabels?: ReadonlyMap<string, string>,
): { label: string; factorId?: string; genuine: boolean } {
  const nodeId = item.affectedNodes?.[0]
  if (nodeId && nodeLabels?.has(nodeId)) {
    // The ONLY branch that yields a name a user wrote or recognises.
    return { label: nodeLabels.get(nodeId)!, factorId: nodeId, genuine: true }
  }
  if (nodeId) {
    // V12.2: Derive label from ID instead of generic fallback
    return { label: factorIdToLabel(nodeId), factorId: nodeId, genuine: false }
  }

  return { label: FALLBACK_LABEL, genuine: false }
}

// ─── Main function ───────────────────────────────────────────────────────────

/**
 * Convert a raw PLoT critique into user-safe copy.
 *
 * @param item — UncertaintyItem from useResultsSectionData
 * @param nodeLabels — Map of nodeId → display label (from graph nodes)
 * @returns Humanised title, description, suggestion, and optional factorId
 */
/**
 * ⭐ DERIVED, NEVER LISTED — which templates still print the unresolved label?
 *
 * `resolveFactorLabel` returns {@link FALLBACK_LABEL} when a critique carries no
 * resolvable node identity, and this file's standing rule (stated at :244-246
 * and :457-463) is that a template must not interpolate it. The rule lived only
 * in prose, so `CONSTRAINT_TARGET_UNRELIABLE` broke it and shipped
 * *"This factor's success target can't be evaluated reliably"* to a user.
 *
 * This runs every template through the unresolved path and reports which ones
 * still emit the sentinel. It is a DERIVATION over `CODE_TEMPLATES`, so a
 * template added later is covered with no edit here — the hand-maintained-mirror
 * defect this estate keeps paying for cannot occur.
 *
 * ⚠ A DERIVED GUARD PROVES AGREEMENT AND CANNOT PROVE THE REMAINING SET IS
 * ACCEPTABLE. Its companion spec pins the returned set EXACTLY, so the suite
 * REDs when the set GROWS (a new template breaks the rule) **and** when it
 * SHRINKS (one is fixed without the record being updated). The remaining
 * members are a recorded, visible gap rather than an unobserved one.
 */
export function codesRenderingUnresolvedLabel(): readonly string[] {
  const offenders: string[] = []
  for (const [code, template] of Object.entries(CODE_TEMPLATES)) {
    const rendered = template(FALLBACK_LABEL, false)
    const surfaces = [rendered.title, rendered.description, rendered.suggestion]
    if (surfaces.some(text => typeof text === 'string' && text.includes(FALLBACK_LABEL))) {
      offenders.push(code)
    }
  }
  return offenders.sort()
}

export function humaniseCritique(
  item: UncertaintyItem,
  nodeLabels?: ReadonlyMap<string, string>,
): HumanisedCritique {
  const { label: factorLabel, factorId, genuine: labelIsGenuine } = resolveFactorLabel(item, nodeLabels)

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
    const result = template(factorLabel, labelIsGenuine)
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
    const result = CODE_TEMPLATES.CONSTRAINT_MISSING_RANGE(factorLabel, labelIsGenuine)
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
      'Olumi\'s engine reported a condition this version has no wording for yet. Nothing has been hidden. The raw code is listed in the run\'s audit details.',
    displayText: null,
    factorId,
  }
}
