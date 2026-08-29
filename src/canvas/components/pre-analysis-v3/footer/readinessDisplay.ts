/**
 * readinessDisplay — THE ONE OWNER OF WHICH HEADLINE A PRE-RUN SURFACE STATES.
 *
 * ── WHY IT EXISTS, AND THE MEASUREMENT THAT FORCED IT ─────────────────────
 * Two surfaces render a pre-run readiness line: `PanelFooter` on the Analysis
 * tab, and `AnalysisReadinessBar`, which the shell hosts on the Olumi tab so
 * that the blocked footer's own advice — *"Ask in the chat what they need"* —
 * does not destroy its own context.
 *
 * The bar shipped with a TWO-ARM expression (`blocked ? notReady : ready`)
 * beside the footer's FOUR-ARM ladder. Witnessed on the mounted dock, fresh
 * guest, model on canvas, neither readiness authority having answered
 * (`readiness == null && analysisReadiness == null`):
 *
 *   Analysis footer → "Readiness not checked yet — Olumi has not assessed this
 *                      model yet. You can still run a first pass."   (warning)
 *   Olumi bar       → "Analysis available"                           (SUCCESS)
 *
 * One state, one tab apart, contradictory claims — and the confident one was on
 * the surface the advice sends the user to. That is the defect class the bar was
 * written to end, re-created by the bar.
 *
 * ⚠ NOTE THE DATES, BECAUSE THEY ARE THE WHOLE LESSON. The footer's
 * `nothingHasAnswered` arm landed 19 Aug; the bar landed 20 Aug. Two fixes for
 * one harm, a day apart, each correct in isolation, neither one's tests able to
 * see the other. No amount of care inside either diff would have surfaced it —
 * only a guard that asserts the two surfaces AGREE can, which is why
 * `OutputsDock.readinessSurvivesTabChange.spec.tsx` asserts headline EQUALITY
 * rather than asserting each surface's copy separately.
 *
 * ── THE LADDER, IN ORDER, AND WHO OWNS WHAT ───────────────────────────────
 *   1. outage             — the readiness CHECK failed. Outranks everything,
 *                           including the gate: a surface may not report on a
 *                           model when it knows the assessment did not happen.
 *   2. analysing          — a run is in flight; say that, not "not ready".
 *   3. gate shut          — `canRun === false`, with the gate's own composed
 *                           and vetted reason.
 *   4. nothing has answered — neither authority has spoken. Claim NOTHING about
 *                           the model. (Hoisted here from `usePreAnalysisModel`'s
 *                           footer memo, which was its only previous home and had
 *                           exactly one consumer, so this is a MOVE, not a copy.)
 *   5. resting            — the surface's own healthy-path value.
 *
 * ⚠ THE SCOPE LIMIT OF ARM 5, STATED SO NOBODY READS MORE INTO THE EQUALITY.
 * `resting` is the one arm the surfaces do NOT share, and they cannot: the panel
 * has a full `PreAnalysisModel` (whether success is defined, whether estimates
 * are uncalibrated, whether CEE will scaffold options) and the shell does not.
 * Every resting value on both surfaces states the SAME HEADLINE
 * (`FOOTER_COPY.ready`); they differ only in how much detail they add beneath
 * it, and the shell's states LESS rather than something different. A surface
 * without the panel model supplies `RESTING_AVAILABLE` and says no more.
 *
 * ⚠ AND BECAUSE IT IS THE UNSHARED ARM, IT IS THE ONE THAT CAN STILL DRIFT — so
 * it is pinned by the same headline-equality test as the shared arms
 * (`OutputsDock.readinessSurvivesTabChange.spec.tsx`, "RESTING"), proven to bite
 * in BOTH directions by the mutant pair R1/R2. It shipped guarded on one side
 * only: making the SHELL's constant diverge REDed, while making the PANEL's
 * four-branch memo diverge survived 11/11 green — the guarded half frozen, the
 * unguarded half the one that actually gets edited. One direction tested and the
 * other open is trap 22b, and it would have half-closed the very defect class
 * this module was extracted to close.
 *
 * ⚠ RECORDED, SEEN AND JUDGED — NOT CHASED. `usePreAnalysisModel`'s resting memo
 * has an internal `canRun === false` branch returning `notReady`, where the
 * shell's `RESTING_AVAILABLE` would say `ready`. It is UNREACHABLE while the run
 * gate and the readiness authorities agree: the ladder's own gate arm fires
 * first on `!canRun`, so the panel's branch is reached only if the two ever
 * disagree — which is what its own comment says. A LATENT contradiction, not a
 * live one. If the gate and the hook are ever allowed to diverge, this is where
 * it will surface.
 *
 * ⚠ ALSO RECORDED: `describeReadinessCheck`'s RETAINED and STALE branches render
 * a timestamp through `formatTakenAt`, and the shell's bar now shows that copy on
 * the Olumi surface. Divergence risk is nil — one shared function, one
 * expression — but that copy has never been DRIVEN on the bar; the equality test
 * reaches only the `readinessUnchecked` branch. Presence of a shared function is
 * not coverage of every branch it can take.
 */

import { FOOTER_COPY } from '../constants'
import { vetBlockedReason, BLOCKED_REASON_FALLBACK } from '../../../utils/vetBlockedReason'
import type { GateBlockedListing } from '../../../utils/canRunAnalysis'

/**
 * The readiness CHECK's own failure facts.
 *
 * ⚠ STRUCTURAL, and deliberately not `PreAnalysisModel['readinessCheck']`. The
 * shell's conformance guard scopes its rules to the dock's TRANSITIVE IMPORT
 * CLOSURE, and its crawler follows `import type` exactly as it follows a value
 * import — so naming that type here would pull `usePreAnalysisModel` and its
 * whole dependency tree into the closure to buy nothing. The model's slice is
 * assignable to this; the type test lives in the spec.
 */
export interface ReadinessCheckFacts {
  readonly message: string
  readonly verdictRetained: boolean
  readonly stale: boolean
  readonly verdictAtMs: number | null
}

export type ReadinessDot = 'muted' | 'warning' | 'success'

export interface ReadinessDisplay {
  readonly dot: ReadinessDot
  readonly headline: string
  readonly subline: string
  /**
   * The SAME text as `subline`, unjoined — one entry per producer sentence.
   *
   * Present only on the gate-shut arm, and only when the vetted string is
   * BYTE-IDENTICAL to this array's own join. A surface may render these as a
   * list; every other surface keeps reading `subline`. Because both come from
   * one derivation in one call, the bar and the footer cannot tell different
   * stories about one state.
   *
   * ⚠ ABSENT is the safe default and means "render `subline`". It is absent
   * whenever the vet substituted UI copy for the producer's text — see the
   * equality guard in `deriveReadinessDisplay`.
   */
  readonly sublineSentences?: readonly string[]
}

/** The resting value for a surface that has no `PreAnalysisModel`. See the
 *  scope-limit note in this module's header: same headline, fewer claims. */
export const RESTING_AVAILABLE: ReadinessDisplay = {
  dot: 'success',
  headline: FOOTER_COPY.ready,
  subline: '',
}

/**
 * ROADMAP 2.332 — the moment a retained verdict was taken, as a clock time.
 *
 * Deliberately time-of-day and not a "5 minutes ago" elapsed string: elapsed
 * copy goes stale the instant it is rendered unless something re-renders it on
 * a timer, and a wrong elapsed figure is a worse claim than no figure. The
 * locale format is the browser's; the SENTENCE is what the tests bind to.
 */
function formatTakenAt(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/**
 * ROADMAP 2.332 / 2.339 — what a surface says when the readiness CHECK failed,
 * as opposed to when the model was graded and found wanting.
 *
 * Three distinct states, because they are three distinct facts:
 *   · nothing timestamped stands behind the surface — either no answer has ever
 *     arrived, or what is on screen is a LOCAL fallback rather than a server
 *     answer (the 429 arm, whose behaviour is unchanged and rowed separately);
 *   · a timestamped server answer, retained, still describing this model;
 *   · a timestamped server answer the model has outgrown.
 *
 * ⚠ The discriminator is `verdictAtMs`, NOT "is there a verdict object". The
 * store stamps `verdictAtMs` only where a real answer landed and explicitly
 * NULLS it on the 429 local-fallback arm, so a surface can never cite a time
 * for a number no server produced.
 *
 * Every arm names the cause. Returns null when the check completed, which is
 * what keeps this slice invisible on the healthy path.
 */
export function describeReadinessCheck(
  check: ReadinessCheckFacts | null | undefined,
): { headline: string; subline: string } | null {
  if (!check) return null

  // The store's own message names WHICH failure it was (unreachable / missing
  // / could not answer / rate limited). It is composed in this repo and never
  // carries the response body, so it is safe to render verbatim.
  if (check.verdictAtMs == null) {
    return {
      headline: check.verdictRetained
        ? FOOTER_COPY.readinessRecheckFailed
        : FOOTER_COPY.readinessUnchecked,
      subline: FOOTER_COPY.readinessSub(check.message),
    }
  }

  return {
    headline: check.stale ? FOOTER_COPY.readinessStale : FOOTER_COPY.readinessRecheckFailed,
    subline: FOOTER_COPY.readinessRetainedSub(check.message, formatTakenAt(check.verdictAtMs)),
  }
}

/**
 * NEITHER AUTHORITY HAS SPOKEN — the state in which no surface may claim
 * anything about the model.
 *
 * ⚠ Deliberately NOT `readiness == null` alone: a producer verdict IS an
 * answer, so a surface holding one that reported itself as still waiting to
 * hear would be a false claim of the same family, just in the humble direction.
 * Exported so the shell and the panel ask ONE question rather than restating
 * the conjunction (trap 12 — the mirror this estate keeps paying for).
 */
export function readinessNothingHasAnswered(
  sideCarVerdict: unknown,
  producerVerdict: unknown,
): boolean {
  return sideCarVerdict == null && producerVerdict == null
}

/**
 * Build the CHECK-failure slice from the readiness store's own fields.
 *
 * Both the panel model and the shell derive `readinessCheck` this way; it lives
 * here so there is one expression rather than two that must be kept identical.
 */
export function deriveReadinessCheck<TRetry>(input: {
  error: string | null | undefined
  verdictRetained: boolean
  stale: boolean
  verdictAtMs: number | null
  retry: TRetry
}): (ReadinessCheckFacts & { retry: TRetry }) | null {
  if (!input.error) return null
  return {
    message: input.error,
    verdictRetained: input.verdictRetained,
    stale: input.stale,
    verdictAtMs: input.verdictAtMs,
    retry: input.retry,
  }
}

/**
 * The sentence a surface shows — and puts in its disabled control's `title` —
 * when the GATE is shut. One expression, so a surface's tooltip can never
 * disagree with the line printed beside it.
 */
export function gateBlockedSubline(blockedReason?: string): string {
  return blockedReason ? vetBlockedReason(blockedReason) : FOOTER_COPY.notReadySubFallback
}

export interface ReadinessDisplayInput {
  /** Non-null only when the readiness CHECK failed. Never gates the run. */
  readonly readinessCheck: ReadinessCheckFacts | null | undefined
  readonly isAnalysing: boolean
  /** OutputsDock's `canRunAnalysis` — the run gate, not a copy of it. */
  readonly canRun: boolean
  /** The gate's own reason. Read only while the gate is shut. */
  readonly blockedReason?: string
  /**
   * The ITEMISED form of `blockedReason`, from the gate call that produced it —
   * `CanRunAnalysisResult.blockedListing`.
   *
   * Optional and additive: a caller that supplies nothing gets exactly today's
   * behaviour. Supplying a listing whose `summary` is not the `blockedReason`
   * beside it is not an error — it is simply not used (the guard below), because
   * a mismatch means something composed one of them separately and neither can
   * be trusted to speak for the other.
   */
  readonly blockedListing?: GateBlockedListing
  /** `readinessNothingHasAnswered(...)`, from the same two authorities the gate reads. */
  readonly nothingHasAnswered: boolean
  /** What this surface says when none of the arms above fire. */
  readonly resting: ReadinessDisplay
}

/**
 * The blocker list a shut-gate surface may render, or `undefined` to withhold it.
 *
 * ── TWO OPPOSITE HARMS, AND WHY THEY NOW HAVE TWO CHECKS ───────────────────
 * Withholding the list leaves a user told there is a problem and not told what
 * to supply. Rendering a list that does not belong to the summary beside it is
 * worse: a wrong list looks authoritative. Both are live, and until this change
 * ONE byte-equality answered both — `sentences.join(' ') === subline`.
 *
 * ⚠ THAT SINGLE WINDOW COULD NOT HOLD BOTH, AND THE MEASUREMENT IS THE POINT.
 * The gate appends a generated `" (+N more issues)"` to `reason` the moment a
 * second blocker exists, and it also vets the string, which may substitute a
 * banned term IN PLACE ("Edge" → "Connection"). Either alone broke the equality,
 * so a model with a validation error AND missing option values rendered exactly
 * one line —
 *
 *   Connection from "Speed" to "Revenue" has no effect direction (+1 more issue)
 *
 * — and dropped every "Choose the missing effect value for X on Y." beneath it.
 * The list vanished precisely when it carried the most to act on.
 *
 * So the questions are separated, and each is answered by the thing that can
 * actually answer it:
 *
 *  1. PROVENANCE — did this list and this string come from one computation?
 *     Answered by BYTES THE PRODUCER PUBLISHED (`listing.summary`), never by
 *     parsing the suffix back out of user-visible prose. A regex over copy would
 *     be a mirror of the gate's composition and would drift the first time the
 *     wording moved.
 *  2. VET INTEGRITY — is every line safe to render as written? Answered per
 *     sentence. Rendering the parts is strictly safer than rendering the join
 *     (`composeBlockedReason`'s own rule: a banned phrase can form ACROSS a seam
 *     that separate list items never create), and an in-place glossary
 *     substitution is a legitimate pass. A DEGRADE is not: it replaces a
 *     producer sentence with our non-committal fallback, and a fallback bullet
 *     sitting among real ones is a claim we cannot support. One degrade
 *     withholds the WHOLE list — never a subset, which would understate the work
 *     outstanding by exactly the lines we could not vet.
 *
 * ⚠ ORDER IS THE GATE'S AND IS NOT A RANKING — see `GateBlockedListing`.
 */
function vettedBlockerList(
  listing: GateBlockedListing | undefined,
  blockedReason: string | undefined,
): readonly string[] | undefined {
  if (listing === undefined) return undefined
  // (1) Provenance. `blockedReason` is what this surface is about to render;
  // the listing must be the itemisation OF THAT STRING, not of some other call.
  if (listing.summary !== blockedReason) return undefined
  // (2) Vet integrity, per sentence.
  const vetted = listing.sentences.map(vetBlockedReason)
  const degraded = vetted.some(
    (text, i) => text === BLOCKED_REASON_FALLBACK && listing.sentences[i] !== BLOCKED_REASON_FALLBACK,
  )
  return degraded ? undefined : vetted
}

/** Pure and total. The ladder in this module's header, in that order. */
export function deriveReadinessDisplay(input: ReadinessDisplayInput): ReadinessDisplay {
  const outage = describeReadinessCheck(input.readinessCheck)
  if (outage) {
    return { dot: 'warning', headline: outage.headline, subline: outage.subline }
  }
  if (input.isAnalysing) {
    return { dot: 'success', headline: FOOTER_COPY.running, subline: FOOTER_COPY.runningSub }
  }
  if (!input.canRun) {
    const subline = gateBlockedSubline(input.blockedReason)
    const sentences = vettedBlockerList(input.blockedListing, input.blockedReason)
    return {
      dot: 'muted',
      headline: FOOTER_COPY.notReady,
      subline,
      ...(sentences !== undefined ? { sublineSentences: sentences } : {}),
    }
  }
  if (input.nothingHasAnswered) {
    return {
      dot: 'warning',
      headline: FOOTER_COPY.readinessPending,
      subline: FOOTER_COPY.readinessPendingSub,
    }
  }
  return input.resting
}
