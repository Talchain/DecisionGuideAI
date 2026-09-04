/**
 * decisionVerdict — THE single place entitled to say whether a decision has a
 * leading option.
 *
 * ## Why this module exists
 *
 * The end-to-end journey lane (parallel-briefs/END-TO-END-JOURNEY-2026-07-25.md)
 * caught the product contradicting itself in one screenshot: the canvas badged
 * "Leading option" on the winner while the results panel, four inches away,
 * said "no clear leading option". Both surfaces read the same PLoT report.
 * They disagreed because they were answering DIFFERENT QUESTIONS with
 * DIFFERENT INPUTS:
 *
 *   · `OptionNode.isRecommended` asked "WHO leads?" (argmax / producer
 *     recommendation) and had no gate for "is there a leader at all" — so the
 *     badge fired on 100% of completed runs.
 *   · `certaintyCopy` Rule 1 asked "IS there a leader?" and answered it from
 *     `recommendation_stability < 0.70` alone — a category error: low
 *     stability means the ranking is FRAGILE, not that the options are TIED.
 *     At 72% vs 20% it printed "no clear leading option" and "leads slightly
 *     more often" about a 52-point lead.
 *
 * A repo-wide sweep found **sixteen** live modules independently classifying a
 * leader verdict, across six mutually-inconsistent "too close to call"
 * thresholds (5pp, 10pp, gap <= 0, stability < 0.70, stability < 0.85,
 * win < 70%). Aligning thresholds would not have held: they drift apart the
 * first time one is touched. So the verdict becomes a single derived value,
 * and every surface quotes it.
 *
 * ## The two axes — and why collapsing them is the bug
 *
 * "Is this answer trustworthy?" is TWO facts, and every contradictory string
 * on that screen came from a surface collapsing them into one binary and
 * picking a different one:
 *
 *   1. **Separation** — how far apart the options are *in the model's own
 *      terms*. This, and only this, decides whether a leading option exists.
 *   2. **Robustness** — whether the ranking survives perturbation of the
 *      assumptions. This decides how much to trust it, and is disclosed
 *      SEPARATELY (stability label, footer, robustness block).
 *
 * A 52-point lead that is not robust is still a 52-point lead. The honest
 * verdict is "X leads by 52 points, and the result is not robust — small
 * changes could flip it", which is exactly what the journey lane praised as
 * the product's best sentence. What no surface may do is *deny the lead*
 * because it is fragile, or *assert robustness* because there is a lead.
 *
 * So this module owns axis 1 only. It never reads stability.
 *
 * ## Producer first
 *
 * PLoT already computes this verdict and puts it on the wire — the UI was
 * simply not asking. `robustness.near_tie`
 * (`{ is_tie, top_option_id, second_option_id, gap, threshold }`, produced at
 * `plot-lite-service/src/routes/v2/run.ts` `computeNearTie`, threshold 0.10)
 * is the producer's own answer to "is there a clear leader?". A captured
 * staging response in this repo
 * (`src/test/fixtures/golden-path-staging-2026-04-05.json`) shows the defect
 * exactly: `near_tie.is_tie: false`, `gap: 0.119` — the producer says there IS
 * a leader — while `recommendation_stability: 0.4375` made the panel print
 * "no clear leading option" about the same run.
 *
 * `decision_brief.headline_banded` (`very_close` | `slightly_ahead` |
 * `clearly_ahead`) refines *how far* ahead when present.
 *
 * ## RENDER the owned claim — never DERIVE one (ROADMAP 1.223)
 *
 * There is no third authority. A report carrying NEITHER producer signal
 * yields the `unknown` verdict and no surface may claim a leader.
 *
 * This used to be untrue: a residual "Authority 3" banded the win
 * probabilities itself whenever the producer was silent. CEE #711 then made
 * SILENCE MEANINGFUL — on a turn whose constraint verdict is withheld, CEE
 * deliberately drops `headline` / `headline_banded` and nulls
 * `leading_option_id`, while the per-option win probabilities keep riding the
 * wire because the DATA is not withheld, only the CLAIM. Authority 3 read
 * exactly those numbers and rebuilt exactly that claim, so the product
 * asserted a leader in nine places on the same screen as its own "no option
 * can be put forward yet".
 *
 * The lesson generalises past this one field: once a producer's silence
 * carries information, a consumer-side fallback does not degrade gracefully —
 * it OVERWRITES the message. So the fallback is deleted, not gated.
 */

// ─── Producer leader-confidence band (Lane UI-W4, PLoT #200) ────────────────
//
// Moved here from `src/components/results/types.ts` (2026-07-25) so it sits
// beside the one function entitled to turn producer signals into a leader
// verdict, and so `src/lib` does not import from `src/components`. Re-exported
// from `types.ts` — one implementation, no mirror.
//
// The UI consumes ONLY the fields it needs to select existing copy: the band
// token, the leader identity (so a producer claim about option X is never
// applied to option Y), and the robustness_gated disclosure flag. The
// producer's own `text` sentence is deliberately NOT consumed.

// The producer's per-option computation vocabulary and the ONE predicate over
// it. Imported from the adapter layer rather than respelled here: a second
// reading of `'failed'` would be a second authority on one question, which is
// the defect class this whole module exists to end. `notAnalysedOptions.ts`
// re-exports the same implementation for the component layer.
import { optionEligibleToLead } from '../adapters/plot/optionComputeStatus'

/** Producer band tokens (PLoT BriefBandedHeadline.band, closed set). */
export type HeadlineBandedBand = 'very_close' | 'slightly_ahead' | 'clearly_ahead'

export interface HeadlineBanded {
  band: HeadlineBandedBand
  /** PLoT option id of the leader the band describes (win-probability rank 1). */
  leaderOptionId: string
  /**
   * True when the gap alone qualified for 'clearly_ahead' but robustness was
   * not established, so the PRODUCER downgraded the claim to
   * 'slightly_ahead'. Disclosure metadata only — the downgrade is already
   * folded into `band`, so no UI copy keys off this flag.
   */
  robustnessGated: boolean
}

const HEADLINE_BANDED_BANDS: ReadonlySet<string> = new Set([
  'very_close',
  'slightly_ahead',
  'clearly_ahead',
])

/**
 * Normalise a raw PLoT `decision_brief.headline_banded` payload into
 * `HeadlineBanded`. Fail-closed trust boundary: unknown band tokens,
 * missing/empty leader id, or a non-object all return `null` — a future
 * producer band is never guessed into existing copy. Unknown additive
 * producer fields are ignored.
 */
export function normalizeHeadlineBanded(raw: unknown): HeadlineBanded | null {
  if (raw === null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.band !== 'string' || !HEADLINE_BANDED_BANDS.has(r.band)) return null
  if (typeof r.leader_option_id !== 'string' || r.leader_option_id.length === 0) return null
  return {
    band: r.band as HeadlineBandedBand,
    leaderOptionId: r.leader_option_id,
    // Strict read: only an explicit producer `true` records the downgrade.
    robustnessGated: r.robustness_gated === true,
  }
}

/**
 * How far apart the top options are.
 *
 * - `clear`   — a leading option exists and is well ahead
 * - `slight`  — a leading option exists but the margin is modest
 * - `tied`    — no clear leading option; the top options are within noise
 * - `unknown` — not determinable (fewer than two comparable options, or the
 *               producer sent no win probabilities). Surfaces must make NO
 *               claim either way.
 */
export type LeaderSeparation = 'clear' | 'slight' | 'tied' | 'unknown'

export interface DecisionVerdict {
  /**
   * The front-runner's option id — the producer's recommendation when it sent
   * one, otherwise the win-probability argmax. `null` when no option can be
   * identified. NOTE: a non-null `leaderId` does NOT license the phrase
   * "leading option" — `hasLeadingOption` does. Identity and entitlement are
   * different questions, and conflating them is the defect this module fixes.
   */
  leaderId: string | null
  separation: LeaderSeparation
  /**
   * The single boolean every surface must gate on before asserting OR denying
   * a leading option:
   *   · `true`  — surfaces may say "{leader} is the leading option" / badge it
   *   · `false` — surfaces must NOT badge, and MAY say "no clear leading option"
   *               (only when `separation === 'tied'`; `'unknown'` licenses
   *               silence, never a denial)
   */
  hasLeadingOption: boolean
  /** Win-probability gap, leader vs strongest rival, in percentage points. */
  gapPp: number | null
  /**
   * Which PRODUCER authority decided `separation`. Disclosure / debugging
   * only. `'none'` means no producer claim applied and the UI made none of its
   * own — the only two values that can assert a leading option are the two
   * producer ones. `'win_probability'` was deleted with Authority 3 (ROADMAP
   * 1.223); it is absent from this union deliberately, so re-introducing a
   * UI-derived leader is a type error rather than a silent regression.
   */
  source: 'producer_near_tie' | 'producer_band' | 'none'
}

/**
 * Win probability at or above which the leader is "clear" rather than merely
 * "slight". Same 0.65 the analysis-hero already used for its "most likely to
 * be strongest overall" claim, so no surface changes its mind about a run it
 * previously called clear.
 */
export const LEADER_CLEAR_WIN_PROBABILITY = 0.65

/** Tolerance for IEEE-754 subtraction noise at the band boundaries. */
const FP_EPSILON = 1e-9

/** Minimal shape this module reads out of the PLoT report. Structural, so a
 *  mapped ReportV1, a raw V2 response, or a hydrated report all satisfy it. */
export interface DecisionVerdictReportLike {
  option_probabilities?: Record<
    string,
    {
      win_probability?: number | null
      /**
       * The producer's PER-OPTION computation classification, verbatim off the
       * wire. `unknown` deliberately, matching `V2OptionComparison.status`: the
       * shared contract declares it a BARE `z.ZodOptional<z.ZodString>`, not
       * the closed enum its producer actually emits, so a token this UI has
       * never heard of is a legal payload. Typing it `string` here would let it
       * be read directly; `unknown` makes `narrowOptionComputeStatus` the only
       * way in, and the compiler enforces that rather than a reviewer.
       */
      status?: unknown
    } | null | undefined
  > | null
  robustness?: {
    recommended_option_id?: string | null
    /** PLoT `computeNearTie` output. Snake and camel both appear on the wire. */
    near_tie?: unknown
    nearTie?: unknown
  } | null
  decision_brief?: { headline_banded?: unknown } | null
}

interface ProducerNearTie {
  isTie: boolean
  topOptionId: string | null
}

/**
 * Read PLoT's `near_tie` fail-closed. Anything but an explicit boolean
 * `is_tie` yields `null`, so a malformed producer payload falls through to the
 * next authority rather than being guessed into a verdict.
 */
function readNearTie(raw: unknown): ProducerNearTie | null {
  if (raw === null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const isTie = r.is_tie ?? r.isTie
  if (typeof isTie !== 'boolean') return null
  const top = r.top_option_id ?? r.topOptionId
  return { isTie, topOptionId: typeof top === 'string' && top.length > 0 ? top : null }
}

export interface DecisionVerdictOptions {
  /**
   * Restrict the comparison to options currently on the canvas. Guards the
   * recovered-session identity mismatch (a report naming options the graph no
   * longer has). Omit to consider every option in the report.
   */
  visibleOptionIds?: ReadonlySet<string>
  /**
   * Fresh-run fallback for the producer band. `useResultsSectionData` prefers
   * the mapped report and falls back to the raw V2 response; pass the raw slot
   * here so both callers resolve the identical band.
   */
  rawHeadlineBanded?: unknown
}

/**
 * The no-claim verdict: no leader may be asserted AND none may be denied.
 *
 * EXPORTED (ROADMAP 1.267) so a consumer that must supply a verdict but has
 * none available names this constant explicitly rather than passing
 * `undefined` into an optional parameter. The distinction matters: an omitted
 * verdict used to fall THROUGH the withheld branch of `buildCertaintyCopy`
 * into the rules that assert "{winner} is the leading option". Naming the
 * no-claim case makes the fail-closed choice visible at the call site and
 * impossible to make by accident.
 */
export const NO_CLAIM_VERDICT: DecisionVerdict = {
  leaderId: null,
  separation: 'unknown',
  hasLeadingOption: false,
  gapPp: null,
  source: 'none',
}

const UNKNOWN_VERDICT: DecisionVerdict = NO_CLAIM_VERDICT

const BAND_TO_SEPARATION: Record<HeadlineBanded['band'], LeaderSeparation> = {
  clearly_ahead: 'clear',
  slightly_ahead: 'slight',
  very_close: 'tied',
}

/**
 * Derive the one verdict every surface quotes.
 *
 * Pure and total: any malformed / absent input yields the `unknown` verdict,
 * under which surfaces make no claim in either direction.
 */
export function deriveDecisionVerdict(
  report: DecisionVerdictReportLike | null | undefined,
  options: DecisionVerdictOptions = {},
): DecisionVerdict {
  if (!report) return UNKNOWN_VERDICT

  const { visibleOptionIds, rawHeadlineBanded } = options
  const probs = report.option_probabilities ?? {}

  // Comparable options: those the producer actually COMPUTED, that carry a
  // finite win probability, and that are still on the canvas (when a visibility
  // set is supplied).
  //
  // ⚠⚠ "FINITE" WAS NOT ENOUGH, AND THE GAP DEFEATED THE LENGTH GUARD BELOW.
  // ISL emits `status: 'failed'` exactly when `n_valid === 0` — ZERO finite
  // Monte Carlo samples, so there is no distribution, no share and no rank
  // behind any number attached to the option — and PLoT forwards a
  // `win_probability: 0` beside it. Zero is finite. So a failed option counted
  // as comparable, a run with ONE genuinely computed option plus ONE failed
  // option reached `comparable.length === 2`, and this module went on to author
  // a leader verdict where only one measurement existed. Measured at pristine
  // `8915b0e2`: one computed option at 0.71 beside one failed option returned
  // `hasLeadingOption: true, separation: 'clear', gapPp: 71` — a seventy-one
  // point "lead" whose loser was a fabricated stand-in.
  //
  // ⭐ GATED ON THE PRODUCER'S EMITTED TOKEN, NEVER ON FALSINESS. A `win > 0`
  // or truthiness test would be a SECOND, worse classification: it would admit
  // a failed option carrying any non-zero fabricated value, and it would
  // wrongly drop a GENUINE measured zero — an option ISL computed at n=10,000
  // and found never wins. Those two are indistinguishable by value and
  // distinguishable only by this field, which is the entire reason the producer
  // sends it.
  //
  // The predicate is `optionEligibleToLead` — THE single eligibility authority,
  // the same call `determineWinnerSelection` makes to choose the RENDERED
  // leader. That shared call is load-bearing: when the verdict and the rendered
  // identity were gated by different code, the verdict correctly dropped a
  // failed option while the panel crowned it anyway.
  // It delegates to `optionComputationProducedResult`, QUOTED and not
  // respelled. It is the same one `OptionCards` forks on and the same reading
  // PLoT's own `isFailedIslOption` applies, so the UI cannot classify an option
  // differently from the service that crowned it (CLAUDE.md trap 21). In
  // particular `'partial'` is a DISCLOSURE and stays in — the samples exist —
  // and an ABSENT or unrecognised status stays in too, because that is the
  // legacy V1 shape and reading silence as failure would suppress a real
  // result.
  const comparable: Array<{ id: string; win: number }> = []
  for (const [id, entry] of Object.entries(probs)) {
    if (visibleOptionIds && !visibleOptionIds.has(id)) continue
    if (!optionEligibleToLead(entry?.status)) continue
    const win = entry?.win_probability
    if (typeof win === 'number' && Number.isFinite(win)) comparable.push({ id, win })
  }

  // Fewer than two comparable options: "leading" has no meaning. This is a
  // REACHABLE state, not a defensive branch — single-option runs exist (the
  // results panel has dedicated "is your only option" copy for them), and PLoT
  // omits win probabilities on degraded runs.
  if (comparable.length < 2) return UNKNOWN_VERDICT

  comparable.sort((a, b) => b.win - a.win)
  const [top1, top2] = comparable

  // SEPARATION is measured on the TOP TWO win probabilities — "does the
  // analysis discriminate between options at all?". IDENTITY is a different
  // question, answered by the producer's recommendation (the id every other
  // surface already prefers) with the argmax as fallback. Keeping them apart
  // matters: PLoT may recommend an option that is not the win-probability
  // argmax, and a leader-minus-rival subtraction would then go NEGATIVE and
  // read as a tie. The two options are still separated; the producer has
  // simply pointed at the other one.
  const recommendedId = report.robustness?.recommended_option_id ?? null
  const recommended = recommendedId != null
    ? comparable.find(o => o.id === recommendedId) ?? null
    : null
  const leaderId = (recommended ?? top1).id

  const gap = top1.win - top2.win
  const gapPp = Math.round(gap * 100)

  // ── Authority 1: PLoT's own near-tie verdict ────────────────────────────
  // The producer already answered "is there a clear leader?" — honour it, but
  // only when it NAMES the option it is talking about, and that option is the
  // win-probability rank-1 (`top1`). A producer claim about option X must never
  // be re-pointed at option Y (the recovered-session identity hazard).
  //
  // ⚠⚠ THIS GATE USED TO ACCEPT A MISSING IDENTITY, AND THAT TURNED CEE'S ACT
  // OF WITHHOLDING INTO A PERMISSION. It read
  //   `nearTie.topOptionId == null || nearTie.topOptionId === top1.id`
  // where the `== null` arm was meant to let a producer stay SILENT about which
  // option leads. But CEE's withheld projection is documented "KEEP THE FACT,
  // DROP THE IDENTITIES": on a withheld turn it strips `top_option_id` while
  // `is_tie` and `gap` ship unchanged. The stripped identity SATISFIED the
  // permissive arm, `is_tie: false` reached the "a leading option exists" branch
  // below, and the UI named a leader on the exact payload CEE had just withheld.
  // Measured by execution against CEE's own withheld bytes: `hasLeadingOption:
  // true`, `separation: 'clear'`. The act of withholding licensed the claim.
  //
  // ⭐ A MISSING IDENTITY IS NOT SILENCE — IT IS A FOOTPRINT. It cannot come
  // from the producer: `computeNearTie` (PLoT `routes/v2/run.ts:2045`) returns
  // `NearTieInfoV3 | undefined` and every non-undefined exit sets
  // `top_option_id`; its sole attachment site assigns the block WHOLE or omits
  // it; and `EnrichmentNearTieSchema` (`@talchain/schemas` 0.48.0 — the version
  // THIS repo pins, `file:./vendor/talchain-schemas-0.48.0.tgz`) declares
  // `top_option_id: z.string()` — REQUIRED, while the BLOCK is `.optional()`.
  // Three real captures in this repo carry all six keys. So a `near_tie`
  // arriving without its identity is CONTRACT-INVALID, and the only thing that
  // produces one is a downstream stripper — CEE withholding. Requiring a
  // positive match is therefore not a heuristic that might over-suppress: this
  // gate now reads exactly "did CEE withhold?".
  //
  // Pinned by `__tests__/withheldIdentityGate.spec.ts`, whose OVER-SUPPRESSION
  // CONTROL fails if this is ever tightened into a blanket refusal.
  const nearTie = readNearTie(report.robustness?.near_tie ?? report.robustness?.nearTie)
  const nearTieApplies = nearTie != null && nearTie.topOptionId === top1.id

  const band = normalizeHeadlineBanded(
    report.decision_brief?.headline_banded ?? rawHeadlineBanded,
  )
  const bandApplies = band != null && band.leaderOptionId === top1.id

  if (nearTieApplies && nearTie!.isTie) {
    return { leaderId, separation: 'tied', hasLeadingOption: false, gapPp, source: 'producer_near_tie' }
  }

  // ── An EXACT tie at the top has no argmax, so no ASSERTION may rest on one ─
  //
  // ⚠⚠ THE FOUNDER'S DEFECT: a headline naming a leader over two options the
  // same panel reported as level ("currently leads" beside "essentially tied").
  //
  // `top1` is the head of a sort. When the top two win probabilities are EQUAL
  // there is no argmax — `top1` is whichever key `Object.entries` happened to
  // yield first. BOTH producer identity gates key on `top1.id`, so on an exact
  // tie the entitlement was decided by object insertion order. Measured at
  // pristine `8915b0e2`, two options at 0.35 each with one band naming `opt_a`:
  //
  //     keys {opt_a, opt_b} → hasLeadingOption: true,  separation: 'slight'
  //     keys {opt_b, opt_a} → hasLeadingOption: false, separation: 'unknown'
  //
  // Same data, same producer signal, opposite claims. A verdict that flips on
  // key order is not a verdict, and `hasLeadingOption: true` with `gapPp: 0`
  // reaches `certaintyCopy`'s "{winner} currently leads".
  //
  // ⛔ EXACT EQUALITY, NOT A THRESHOLD, and this is the RIGHT predicate rather
  // than a cautious one. ISL computes `win_probability = wins / n_samples` over
  // a SHARED denominator, so a producer-side tie is BIT-IDENTICAL, and
  // `Array.prototype.sort` is stable — exact equality is therefore precisely
  // coextensive with "`top1` is arbitrary", the condition this guards. A
  // seventh "too close to call" cutoff (this module's header records six) would
  // be the same defect wearing a fix's clothes; closeness stays with the
  // producer, whose `near_tie` and band both require a gap of 0.10.
  //
  // ⭐⭐ IT WITHHOLDS THE ASSERTION AND NEVER THE PRODUCER'S OWN DENIAL — AND
  // THE FIRST VERSION OF THIS GUARD GOT THAT WRONG, WHICH IS WHY IT IS NOW A
  // CLAMP AND NOT AN EARLY RETURN.
  //
  // At `f11432c5` this sat between Authority 1 and Authority 2 and returned
  // `'unknown'` outright. A comment right here claimed it therefore "withheld
  // only the assertion" — but a `very_close` BAND is an explicit producer tie
  // call too, and the early return swallowed it before Authority 2 could speak.
  // Measured: an exact tie carrying `headline_banded.band: 'very_close'`
  // degraded the headline from "no clear leading option" to "the analysis did
  // not put an option forward" — a TRUE sentence replaced by a weaker one. That
  // is CLAUDE.md trap 22b exactly: one predicate cannot guard two opposite
  // harms, and closing the assertion re-opened the denial. The comment asserted
  // the property instead of testing it against the second authority.
  //
  // So the rule is applied where each authority produces its `separation`:
  // an ASSERTING outcome ('clear' / 'slight') cannot stand on level numbers and
  // falls to `'unknown'` (silence, never a counter-claim — a producer band of
  // `clearly_ahead` over level numbers is a disagreement we have authority to
  // resolve in neither direction); a DENIAL ('tied') passes through untouched.
  const levelAtTop = top1.win === top2.win

  // ── Authority 2: the producer's leader-confidence band ──────────────────
  // Refines HOW far ahead. When authority 1 has already ruled "not a tie",
  // a band of `very_close` would contradict it, so the band may only refine
  // clear-vs-slight in that case — the producer's own tie call wins.
  if (bandApplies) {
    const banded = BAND_TO_SEPARATION[band!.band]
    // ⭐ `&& !levelAtTop` — the promotion from a `very_close` band to 'slight'
    // is itself an ASSERTION, so it must not fire on level numbers. Without it
    // the clamp below would catch the result anyway, but as SILENCE rather than
    // as the producer's own tie call: the band said `very_close` and the honest
    // outcome is to keep saying so.
    const separation: LeaderSeparation =
      banded === 'tied' && nearTieApplies && !nearTie!.isTie && !levelAtTop ? 'slight' : banded

    // THE CLAMP. An asserting band cannot stand on an exact tie; a DENIAL
    // ('tied') passes through and keeps "no clear leading option" on screen.
    if (levelAtTop && separation !== 'tied') {
      return { leaderId, separation: 'unknown', hasLeadingOption: false, gapPp, source: 'none' }
    }

    return {
      leaderId,
      separation,
      hasLeadingOption: separation === 'clear' || separation === 'slight',
      gapPp,
      source: 'producer_band',
    }
  }

  // Authority 1 said "not a tie" and there is no band to refine it: a leading
  // option exists. Grade it on the leader's own win probability.
  if (nearTieApplies && !nearTie!.isTie) {
    // THE CLAMP again. This branch only ever ASSERTS, so on level numbers there
    // is nothing here to preserve — it falls to silence. (The producer's own
    // `is_tie: true` denial was already returned above, untouched.)
    if (levelAtTop) {
      return { leaderId, separation: 'unknown', hasLeadingOption: false, gapPp, source: 'none' }
    }
    const separation: LeaderSeparation =
      top1.win >= LEADER_CLEAR_WIN_PROBABILITY - FP_EPSILON ? 'clear' : 'slight'
    return { leaderId, separation, hasLeadingOption: true, gapPp, source: 'producer_near_tie' }
  }

  // ── No applicable producer signal ⇒ NO CLAIM ────────────────────────────
  //
  // There used to be an "Authority 3" here: a residual fallback that banded
  // the win probabilities itself (gap >= 0.10 → a leading option exists,
  // top win >= 0.65 → 'clear'). It is DELETED, and this is the point of
  // ROADMAP 1.223.
  //
  // CEE #711 made absence the signal. On a turn whose constraint verdict is
  // WITHHELD, the wire carries `leading_option_id: null` and a
  // `decision_brief` stripped of `headline` / `headline_banded` — while the
  // per-option win probabilities correctly still ride it, because the DATA is
  // not withheld, only the CLAIM. Authority 3 read those numbers and rebuilt
  // the claim CEE had just withheld: on the live withheld run the render probe
  // captured (gap 0.346, top win 0.66) it returned `separation: 'clear'`,
  // `hasLeadingOption: true`, and nine leader surfaces rendered beside CEE's
  // own "no option can be put forward yet".
  //
  // A fallback that reconstructs a withheld claim is not a fallback, it is the
  // defect — so it is deleted rather than gated. There is no shape of input
  // under which the UI may author a leader claim the producer did not make.
  //
  // Fail toward SILENCE, not toward a denial: `unknown` (surfaces make no
  // claim in either direction), never `tied` (which licenses "no clear leading
  // option" — a second claim we equally have no authority for). This also
  // means a report from an older cached shape, which is indistinguishable from
  // a withheld one by construction, is handled as no-claim.
  //
  // IDENTITY SURVIVES. `leaderId` and `gapPp` are still returned: the module's
  // own doctrine is that identity and entitlement are different questions, and
  // non-claiming consumers (ordering, focus, the decision record) must keep
  // working. Only `hasLeadingOption` — the entitlement — is withheld.
  return {
    leaderId,
    separation: 'unknown',
    hasLeadingOption: false,
    gapPp,
    source: 'none',
  }
}
