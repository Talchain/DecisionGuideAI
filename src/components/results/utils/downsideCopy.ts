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
 * ROADMAP 2.581 — what a reader in expert mode gets when the tail is genuinely
 * absent, instead of the silence that used to be there.
 *
 * WHY IT DOES NOT NAME A CAUSE, AND WHY IT DOES NOT PROMISE A RERUN. The
 * producers omit this block across at least five distinct branches and send NO
 * reason with the omission:
 *
 *   ISL (`DownsideV2`, enforced by `OptionResultV2._downside_requires_samples`)
 *     · `outcome.percentiles_source != 'samples'` — necessary condition unmet
 *     · the threaded pre-noise joint regret absent or non-finite
 *     · `cvar_10`/`p05` non-finite on an extreme finite population
 *   PLoT (`buildDownside`, routes/v2/numeric-egress-guards.ts)
 *     · the whole `outcome` object dropped (a required stat non-finite)
 *     · any component non-finite, or `expected_regret` negative
 *
 * A rerun with a different seed could plausibly clear the non-finite branches
 * and cannot clear the percentiles-source one — and nothing on the wire says
 * which applied. Writing "try running it again" would therefore be a claim we
 * have not earned, which is the exact failure this whole surface exists to
 * avoid. So the sentence states the absence, states that the reason is not
 * disclosed to us, and stops. Making it able to say more is producer-side work
 * (an omission-reason channel through ISL → PLoT → CEE), not a wording choice.
 *
 * CONTAINS NO NUMERAL, deliberately: see rule 3 above.
 */
export const DOWNSIDE_UNAVAILABLE_COPY =
  'No worst-case view for this option in this run. The engine did not return one and does not say why, so we cannot tell you whether running it again would produce one.'
