/**
 * ROADMAP 2.449 — the words a user actually reads for the tail-risk view of an
 * option, and the single source of that wording.
 *
 * WHY THIS FILE EXISTS AT ALL. Olumi already tells a user which option leads
 * and how robust that is. It could not answer the question every serious
 * decision-maker asks next — "and if this goes badly, how badly?" — even though
 * the engine has computed the answer for months. These sentences ARE the
 * capability; the plumbing behind them is only how the numbers got here.
 *
 * THREE RULES, all of them load-bearing:
 *
 * 1. THE NUMBER ARRIVES WITH ITS MEANING ATTACHED. "CVaR 10%" is not a
 *    user-facing string, and neither is "5th percentile" or "expected
 *    shortfall". What the reader gets is what the statistic actually says
 *    about their decision, in their own language: how bad the bad runs were.
 *
 * 2. THE TAIL CUT-OFF IS NOT SETTLED SCIENCE, AND WE SAY SO. ISL's source
 *    marks the 0.10 tail mass `DOCTRINE-PENDING(Neil)` — a risk-modelling
 *    default awaiting ratification, not a convention this product has adopted.
 *    Presenting "the worst 10%" as though it were standard practice would be a
 *    claim we have not earned. {@link DOWNSIDE_TAIL_CAVEAT_COPY} is therefore
 *    NOT decoration: it ships wherever the number ships.
 *
 * 3. ⚠ RULE 3 IS SUPERSEDED BY ROADMAP 2.581 — ABSENCE IS NOW *STATED*, AND
 *    STILL NEVER A NUMBER. The original rule read: "ABSENCE IS BLANK. There is
 *    deliberately no 'no downside data' placeholder and no zero: when the
 *    engine could not compute the tail honestly, the whole surface is simply
 *    not rendered."
 *
 *    The half of that rule which was right is kept and hardened: a zero, a
 *    dash, or any other numeral in a downside statistic is forbidden, because
 *    a zero here does not read as "unknown", it reads as "there is no
 *    downside".
 *
 *    The half that was wrong is this: rendering NOTHING makes an absent tail
 *    indistinguishable from a tail the reader simply failed to find, which is
 *    exactly how 2.581 was reported — a depth feature that "appears in some
 *    sessions and not others" teaches a reader not to trust the depth. So a
 *    reader who has asked for depth and cannot have it is TOLD, in words, that
 *    there is nothing here. See {@link DOWNSIDE_UNAVAILABLE_COPY}.
 */
import type { EnrichmentOutcomeStats } from '@talchain/schemas/boundary'

/** Section label for the tail-risk lines on an option card. */
export const DOWNSIDE_HEADING_COPY = 'If it goes badly'

/**
 * The two magnitudes, each with its meaning attached.
 *
 * `p05` is phrased as "1 in 20 … land below" rather than "5th percentile", and
 * `cvar_10` as "the worst 1 in 10 … average" rather than "expected shortfall".
 * Both are frequency framings of the SAME simulated runs the range bar
 * directly above is drawn from, so the reader is being told more about a
 * picture they are already looking at rather than being handed a second,
 * unrelated statistic.
 */
export function downsideSummaryCopy(p05Display: string, cvar10Display: string): string {
  return `In the worst 1 in 20 simulated runs this lands below ${p05Display}, and the worst 1 in 10 average ${cvar10Display}.`
}

/**
 * The honesty caveat that must accompany the numbers above.
 *
 * It names the un-ratified choice WITHOUT implying the numbers are unreliable:
 * where the tail is cut is a convention question, and the average of whatever
 * is inside that cut is computed exactly.
 */
export const DOWNSIDE_TAIL_CAVEAT_COPY =
  'Where we cut off "the worst" is a working choice we have not settled yet.'

/**
 * ROADMAP 2.581 — what a reader in expert mode gets when the tail is absent,
 * instead of the silence that used to be there.
 *
 * ── WHY IT NAMES NO CAUSE AT ALL, NOT EVEN "the engine" ──────────────────────
 * An earlier draft of this sentence read "The engine did not return one and
 * does not say why". That was itself an unearned claim, and it is exactly the
 * defect this surface exists to prevent — one level up, in our own copy.
 *
 * At the point this string renders, the option's `downside` is `undefined`.
 * **That single observation has at least three causes the UI cannot tell
 * apart:**
 *
 *   1. A PRODUCER omitted the block. ISL omits it (`DownsideV2`, enforced by
 *      `OptionResultV2._downside_requires_samples`) when
 *      `outcome.percentiles_source != 'samples'`, when the threaded pre-noise
 *      joint regret is absent or non-finite, or when `cvar_10`/`p05` are
 *      non-finite. PLoT omits it (`buildDownside`,
 *      `routes/v2/numeric-egress-guards.ts`) when the whole `outcome` object
 *      was dropped, when any component is non-finite, or when
 *      `expected_regret` is negative. None of these puts a reason on the wire.
 *   2. OUR OWN MAPPER dropped it. `normaliseDownside` is all-or-nothing: a
 *      block that arrives with one component missing or non-finite becomes
 *      `undefined` here, indistinguishable from one that never arrived.
 *   3. SCHEMA-PIN SKEW ate it. A consumer on an older `@talchain/schemas`
 *      silently drops fields it does not know; this repo has lost coaching,
 *      evidence and enrichment fields that way before.
 *
 * Cases 2 and 3 are OUR failures, not the engine's. Saying "the engine did not
 * return one" would attribute a fault we have not established, and would read
 * to the user as "the compute is flaky" when the code between the compute and
 * their screen is an equally live suspect.
 *
 * ── WHY IT STILL PROMISES NOTHING ABOUT A RERUN ──────────────────────────────
 * A rerun with a different seed could plausibly clear some non-finite branches
 * and cannot clear the percentiles-source one — and nothing anywhere says which
 * applied. Writing "try running it again" would be a second unearned claim. So
 * the sentence states the absence, states that we cannot account for it, and
 * stops. Making it able to say more is producer-side work (an omission-reason
 * channel through ISL → PLoT → CEE) plus a mapper-side one, not a wording
 * choice.
 *
 * ⚠ THAT PRODUCER-SIDE WORK NOW EXISTS FOR **ONE** OF THE THREE CAUSES — see
 * {@link DOWNSIDE_UNAVAILABLE_ENGINE_COPY}. This string is still what ships
 * whenever the discriminator is ABSENT, and "absent" must never be read as
 * "samples": see {@link downsideUnavailableCopy}.
 *
 * CONTAINS NO NUMERAL, deliberately: see rule 3 above.
 */
export const DOWNSIDE_UNAVAILABLE_COPY =
  'No worst-case view for this option in this run. We cannot tell you why, or whether running it again would produce one.'

/**
 * The percentile-provenance discriminator, at the UI's own boundary.
 *
 * Producer-owned closed vocabulary, declared identically at all three hops that
 * touch it — ISL `OutcomeDistributionV2.percentiles_source`
 * (`Literal["samples","unavailable"]`, `src/models/response_v2.py:234`),
 * PLoT's egress (`routes/v2/run.ts`, the two-literal check before
 * `built.percentiles_source = …`), and `@talchain/schemas` 0.38.0
 * (`EnrichmentOutcomeStatsSchema.percentiles_source`, `.optional()` and
 * deliberately never `.default()`).
 *
 * ⚠ DERIVED FROM THE CONTRACT, NOT RETYPED FROM IT. A hand-written
 * `'samples' | 'unavailable'` here would be a hand-maintained mirror of a
 * vocabulary owned by another repo (CLAUDE.md trap 12), and its drift would be
 * silent in the worst direction: a member added upstream would be a type error
 * at a `switch` we do not have, and a member REMOVED upstream would leave dead
 * UI branches nobody reds on. Deriving costs one line and cannot drift.
 *
 * If the vocabulary ever widens, note the failure direction is the safe one:
 * `downsideUnavailableCopy` tests for `'unavailable'` by identity, so an
 * unrecognised new member falls through to the vague-honest sentence rather
 * than to a claim about the engine.
 */
export type PercentilesSource = NonNullable<
  EnrichmentOutcomeStats['percentiles_source']
>

/**
 * ROADMAP 2.646 — what a reader gets when the tail is absent AND the engine
 * has told us, on the wire, WHY.
 *
 * ── WHAT CHANGED, AND WHY THIS SENTENCE IS NOW EARNED ────────────────────────
 * {@link DOWNSIDE_UNAVAILABLE_COPY} attributes the absence to nobody, because
 * at the moment it renders the UI cannot distinguish three causes: a producer
 * omitted the block with no reason on the wire, OUR OWN mapper dropped a
 * partial one, or schema-pin skew ate it. That was correct — and it was a
 * TRANSIT gap, not a knowledge gap. ISL has always known the difference and
 * said so in `outcome.percentiles_source`; the field simply died before it
 * reached a reader. 0.38.0 declares it, PLoT's 7-Aug egress carries it, CEE
 * transports it untouched, and this repo now reads it.
 *
 * ── WHAT `'unavailable'` LETS US SAY, DERIVED FROM THE PRODUCER, NOT FROM US ─
 * Read at ISL's bytes (`src/models/response_v2.py` @ `c25836f7`), not inherited
 * from this repo's own commentary:
 *
 *   * The field's own declaration: "'unavailable' when no valid samples exist
 *     (p10/p50/p90 will be null)" (`:234-238`).
 *   * `OptionResultV2._downside_requires_samples` (`:412-432`) ENFORCES
 *     `downside present ⟹ percentiles_source == 'samples'`. Its contrapositive
 *     is what this branch stands on: on `'unavailable'`, ISL **never emitted a
 *     downside at all**.
 *
 * That contrapositive is the whole prize, and it is worth stating plainly:
 * causes 2 and 3 above are RETIRED for this case, not merely thought unlikely.
 * Our mapper cannot have dropped a block that was never sent, and pin skew
 * cannot have eaten one either — and skew could not have eaten the
 * discriminator, because we are holding it. So the sentence may name the
 * engine, which {@link DOWNSIDE_UNAVAILABLE_COPY} may not.
 *
 * ── WHAT IT STILL MUST NOT SAY ───────────────────────────────────────────────
 * ⚠ NOT "no samples were drawn", and NOT anything about `mean`. ISL's
 * `_summary_stats_absent_only_without_samples` (`:245-281`) documents in terms
 * that an option "can legitimately have no raw `samples` array (percentiles
 * 'unavailable') while the analyzer still computed an honest mean and std for
 * it" — the biconditional is deliberately NOT enforced. So `'unavailable'`
 * licenses a claim about the PERCENTILE POPULATION and the tail that is drawn
 * from it, and nothing wider. The sentence below is scoped to exactly that.
 *
 * Still NOTHING about a rerun, in either direction: whether re-running would
 * produce a usable population is not on the wire, and a guess would be the
 * same unearned claim one register quieter.
 *
 * CONTAINS NO NUMERAL, deliberately: see rule 3 above.
 */
export const DOWNSIDE_UNAVAILABLE_ENGINE_COPY =
  'No worst-case view for this option. The engine reported it had no usable simulated runs to draw one from, so this is the analysis reaching its limit here rather than something lost on the way to you.'

/**
 * Choose the absence sentence from the producer's discriminator.
 *
 * ⚠ **ABSENCE IS NOT `'samples'`, AND MUST NEVER BE DEFAULTED TO IT.** ISL
 * declares a Python-side `default="samples"`, and every hop after it refuses to
 * re-apply that default on purpose — PLoT states the reason in its egress
 * ("Substituting 'samples' for a build that sent nothing would manufacture a
 * provenance claim PLoT never received"), and 0.38.0's `.describe()` repeats
 * it: "consumers MUST NOT assume 'samples'". This function is the last hop and
 * holds the same line. A `?? 'samples'` here would be the estate's named
 * fabrication class wearing a string, and it would silently downgrade the
 * honest engine sentence to the vague one — failing SILENT and in the
 * direction of a worse claim.
 *
 * Everything that is not exactly `'unavailable'` — absent, `'samples'`, or a
 * value outside the vocabulary — keeps {@link DOWNSIDE_UNAVAILABLE_COPY}, and
 * each for its own good reason:
 *
 *   * **absent** — a producer or a hop that predates 0.38.0. The UI genuinely
 *     cannot tell its own mapper from pin skew there, which is the exact
 *     situation the vague sentence was written for. (The 5 Aug capture this
 *     repo tests against is such a payload, and is the live witness for it.)
 *   * **`'samples'`** — the engine HAD a usable population and the tail is
 *     still missing. That is the interesting residue: some component was
 *     non-finite, or our own mapper dropped a partial block. Naming the engine
 *     here would be false, so this case is deliberately NOT an improvement over
 *     the status quo, and the vague sentence remains the honest one.
 */
export function downsideUnavailableCopy(
  percentilesSource: PercentilesSource | undefined,
): string {
  return percentilesSource === 'unavailable'
    ? DOWNSIDE_UNAVAILABLE_ENGINE_COPY
    : DOWNSIDE_UNAVAILABLE_COPY
}
