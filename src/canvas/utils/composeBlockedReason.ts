/**
 * Deterministic, honest copy for the "analysis is not available" state.
 *
 * ⚠ Why this module exists (Paul, 28 Jul).
 * The pre-analysis footer used to render CEE's own refusal sentence, passed
 * through `guardCeeText`. That sentence — `V3 analysis not ready: 1 option(s)
 * blocked: opt_extend` — contains the glossary-banned word "blocked", which has
 * no safe substitution, so the guard DEGRADED to the fallback
 * `'Add a decision, a goal and at least two options'`.
 *
 * The user's graph had a decision, a goal and FIVE options; the panel two lines
 * above said so. **The honesty guard produced a dishonest sentence.** A guard
 * that replaces a true statement with a false one is worse than no guard — the
 * user is told to do something they have already done, and the real remedy
 * ("tell Olumi what the new option changes") is named nowhere.
 *
 * The fix is not a better fallback string. It is to stop deriving user-facing
 * copy from engine PROSE at all, and compose it from the STRUCTURED fields the
 * readiness verdict already carries. Prose is never parsed here: parsing the
 * engine's sentences would be the same hand-maintained mirror in a new place.
 *
 * This does NOT contradict the engine. It renders the SAME verdict, from the
 * same structured response, in the product's own language.
 *
 * ⚠⚠ AMENDED 28 Jul after an adversarial review of the PR that introduced it.
 * Three findings each RE-CREATED this module's own defect class — a false fact
 * on the blocked surface — and are fixed here:
 *   A1  the render path must VET this copy, never REWRITE it, and the label
 *       must be truncated BEFORE it is vetted (`classifyBlockedReason`,
 *       `safeDisplayLabel`);
 *   A2  a stale-evidence downgrade must publish the VERDICT's own count, never
 *       the length of the list it just ruled untrustworthy;
 *   A3  "…and the analysis can run" is a PROMISE, and a promise the verdict
 *       does not license must not be made.
 */

import type { AnalysisBlocker } from '@talchain/schemas/boundary'

import type { GraphReadiness } from '../hooks/useGraphReadiness'
import { IMPROVEMENT_ACTION_PLACEHOLDER } from './improvementActionPlaceholder'
import {
  containsBannedTerm,
  safeInterpolatedLabel,
} from '../../components/results/utils/glossaryCheck'
import { isSafeCeeText } from '../components/pre-analysis-v3/signals/ceeTextGuard'

/** An option CEE graded as not-yet-ready, with the label the user sees. */
export interface OptionNeedingValues {
  id: string
  label: string
}

/**
 * Every string this module can emit. Kept as one exported constant so the
 * glossary sweep in `signals/__tests__/registry.spec.ts` scans it, and so no
 * blocked-state sentence can be written anywhere else.
 *
 * Copy rules: communication glossary v1, British English, sentence case, no em
 * dashes, and — the rule this module was created for — **never a factual claim
 * about the model that the panel's own counts could contradict.** The generic
 * rung says only that something is missing; it never says what.
 *
 * ⚠ `analysisCanRunAfter` (A3) is REQUIRED, not defaulted. It decides whether
 * the sentence ends with the PROMISE "and the analysis can run". A default of
 * `true` would silently re-create the unconditional promise for every future
 * caller — the mirror-that-reads-green failure mode. Make the decision, at the
 * call site, every time.
 */
export const BLOCKED_REASON_COPY = {
  /** One named option with no effect values. */
  oneOption: (label: string, analysisCanRunAfter: boolean) =>
    `"${label}" has no effect values yet. Tell Olumi what it changes${
      analysisCanRunAfter ? ' and the analysis can run' : ''
    }.`,
  /** Two named options. */
  twoOptions: (a: string, b: string, analysisCanRunAfter: boolean) =>
    `"${a}" and "${b}" have no effect values yet. Tell Olumi what they change${
      analysisCanRunAfter ? ' and the analysis can run' : ''
    }.`,
  /**
   * Count-only rung: three or more (naming them all would not fit the footer),
   * or any count whose labels we could not resolve or could not trust. Still
   * true, just less specific.
   */
  manyOptions: (n: number, analysisCanRunAfter: boolean) =>
    n === 1
      ? `1 option has no effect values yet. Tell Olumi what it changes${
          analysisCanRunAfter ? ' and the analysis can run' : ''
        }.`
      : `${n} options have no effect values yet. Tell Olumi what they change${
          analysisCanRunAfter ? ' and the analysis can run' : ''
        }.`,
  /** The goal the verdict was graded against is not in the model. */
  goalMissing: 'This decision needs a goal before the analysis can run.',
  /** Fewer than two options to compare. */
  tooFewOptions: 'Olumi compares at least two options. Add another one to run the analysis.',
  /**
   * The last rung. Reached when the verdict says not-runnable but carries no
   * structured field specific enough to name the cause. Deliberately makes NO
   * claim about the model — the defect this module fixes was a confident false
   * claim in exactly this position.
   *
   * ⚠ IT USED TO READ "Olumi is not able to run this yet." — and this file's
   * own staleness rung already noted that sentence "still asserts the verdict's
   * `can_run_analysis: false` as a present-tense fact". That assertion became a
   * visible CONTRADICTION on 18 Aug 2026, when `OutputsDock` began feeding the
   * run gate's reason to the POST-analysis footer (`derivePostFooterMeta`'s
   * `blockedReason` — the right fix for a disabled Rerun that explained itself
   * only on hover). From then on the sentence could render directly beneath a
   * completed analysis's ranked results: a claim that Olumi cannot run one,
   * printed next to the output of one it had just run.
   *
   * The rung is not wrong about the verdict; the wording was scoped to a
   * pre-analysis screen. This phrasing carries the SAME information — the
   * verdict refuses, nothing specific can be named, ask in the chat — while
   * being true whether or not a run has already happened. "The next analysis"
   * is the first one on a pre-analysis screen and the rerun on a post-analysis
   * one, so ONE string stays honest in both places rather than a second copy
   * being minted for the second surface (which is how this module acquired its
   * mirrors in the first place).
   */
  unspecified:
    'Olumi needs something more from this model before the next analysis. ' +
    'Ask in the chat and it will explain what is missing.',
  /**
   * ROADMAP 2.635 (I-3) — the verdict on screen was not asked about the model
   * on screen.
   *
   * Every other rung in this object is a claim ABOUT THE MODEL, composed from
   * the verdict's structured fields. That is only honest while the verdict is
   * current. The moment a payload-affecting mutation lands, `readinessStore`
   * marks the verdict `stale` — and those same fields start describing a graph
   * the user has already changed. The user follows the named remedy, the canvas
   * mutates, and the SAME sentence naming the SAME option is still on screen,
   * because nothing has re-asked. That is a false reason, and POC-DONE's PC1 is
   * explicit that a false reason is what makes a dead end where a truthful
   * "can't yet, here's why" would not.
   *
   * So this rung describes THE CHECK, never the graph. It names no option, no
   * count, no goal, and it is the only member of this object that is true
   * independent of the verdict's contents — which is precisely what qualifies
   * it to stand in for them. It is transient by construction: the refetch it
   * describes is already debounced and in flight.
   */
  /**
   * ── THE CANONICAL RUNGS (19 Aug 2026) ───────────────────────────────────
   *
   * The three above them render the SIDE-CAR verdict's structured fields. These
   * three render the PRODUCER's own `analysis_state.readiness.blockers`, and
   * they exist because that list answers a question the side-car fields cannot:
   * it is itemised, and every entry carries its own scope.
   *
   * ⚠ THEY DELIBERATELY DO NOT REUSE `oneOption`/`twoOptions`/`manyOptions`.
   * Those sentences assert a SPECIFIC cause — "has no effect values yet, tell
   * Olumi what it changes" — which an `AnalysisBlocker` may not support: the
   * list also carries goal-scoped and factor-scoped entries. Borrowing a
   * sentence because it is the right SHAPE is how this module acquired the
   * false claims its header records.
   *
   * ⚠⚠ THESE ARE NOW THE FALLBACK, NOT THE FIRST ANSWER (A4, 24 Aug 2026).
   *
   * This block used to read "AND THEY DO NOT QUOTE `blocker.message`. That is
   * producer PROSE, and this module's founding rule is that user-facing copy is
   * composed from STRUCTURED fields, never derived from the engine's sentences."
   * That rule was written against `readiness.confidence_explanation` and CEE's
   * old refusal line — UNTYPED prose with no contract behind it — and it was
   * right about those. It is WRONG about `blocker.message`, and the module was
   * standing in direct contradiction to the contract it imports:
   *
   *   `AnalysisBlockerSchema.message` (`@talchain/schemas/boundary` 0.48.0)
   *   "The producer-authored, user-facing sentence for this blocker, rendered
   *    VERBATIM. CEE owns all user-facing language; a consumer must not
   *    rewrite, summarise, truncate for meaning, or SYNTHESISE A SUBSTITUTE
   *    WHEN IT DISLIKES THE WORDING."
   *
   * `message` is not "the engine's prose" in the sense this module banned. It
   * is a CONTRACTED, typed, `.min(1)` field whose whole declared purpose is to
   * be rendered — the structured field for "what to say", exactly as
   * `option_label` is the structured field for "what to call it". Refusing it
   * was not caution; it was the consumer overriding the producer on the one
   * question the contract assigns to the producer.
   *
   * And the substitute was ACTIVELY WRONG, which is what made this a defect
   * rather than a preference: "Ask in the chat what it needs" names a remedy
   * the user cannot perform. The typed readiness arm is gated on
   * `isReadinessChipClick`, so TYPING in the chat does not reach it — the
   * sentence points at a path only a chip opens. A dead end of exactly the kind
   * POC-DONE's PC1 bans, printed in place of the producer's real instruction
   * ("Choose the missing effect value for …"), which was in scope the whole
   * time and was discarded.
   *
   * SO THE ORDER IS NOW: the producer's own sentences first (see
   * `producerAuthoredReason`), and these rungs when — and only when — the
   * producer's messages cannot be rendered as they were written. They keep
   * their old job of being a LESS SPECIFIC TRUE CLAIM, which is the only thing
   * this module ever allowed a degrade to be. Their thinness is what qualifies
   * them for that: each is true for every blocker category the contract admits.
   */
  /** One blocker, scoped to an element we can quote by name. */
  canonicalOneBlocker: (label: string) =>
    `"${label}" is not ready for analysis yet. Ask in the chat what it needs.`,
  /** Two blockers, both quotable. */
  canonicalTwoBlockers: (first: string, second: string) =>
    `"${first}" and "${second}" are not ready for analysis yet. Ask in the chat what they need.`,
  /**
   * Count-only rung: three or more, or any count whose scope labels could not
   * be quoted. The number is the PRODUCER's own list length — still a fact
   * drawn from the verdict, just a less specific one. Never zero: the caller
   * only composes when the list is non-empty.
   */
  canonicalManyBlockers: (n: number) =>
    n === 1
      ? '1 part of your model is not ready for analysis yet. Ask in the chat what it needs.'
      : `${n} parts of your model are not ready for analysis yet. Ask in the chat what they need.`,
  staleRecheck:
    'Your model changed since the last check. Olumi is checking again, which takes a moment.',
} as const

/** Labels longer than this are elided so the footer stays one line. */
const MAX_LABEL_CHARS = 48

/**
 * Sentinel for "this label cannot be quoted". A plain, unlikely string: it was
 * a literal NUL byte until 28 Jul, which made git classify the whole file as
 * BINARY — `gh pr diff` rendered the single most load-bearing new file in the
 * change as "Binary files differ", so no reviewer working from the diff ever
 * saw its implementation.
 */
const UNQUOTABLE = '__olumi_unquotable_label__'

/**
 * The label as it can safely be quoted back to the user, or `null` when it
 * cannot be. A user-authored label may itself contain a glossary-banned term
 * ("Graph rewrite"); quoting a placeholder like "this option" in its place would
 * read as nonsense, so an unquotable label makes the copy fall to the COUNT
 * rung. Less specific, still true — the module's whole rule.
 *
 * ⚠ A1: TRUNCATE FIRST, THEN VET. Checking the full label and truncating after
 * was the wrong order, proven at the bytes: `'…graphite dashboards'` passes the
 * vet (no `\bgraph\b`), but the 47-character cut lands after "graph" and the
 * ellipsis supplies the missing word boundary — so the ELIDED label carries a
 * banned term the FULL one did not. What is vetted must be exactly what ships.
 */
function safeDisplayLabel(label: string): string | null {
  const trimmed = label.trim()
  if (trimmed.length === 0) return null
  const display =
    trimmed.length <= MAX_LABEL_CHARS
      ? trimmed
      : `${trimmed.slice(0, MAX_LABEL_CHARS - 1).trimEnd()}…`
  if (safeInterpolatedLabel(display, UNQUOTABLE) === UNQUOTABLE) return null
  return display
}

/**
 * The options the readiness verdict graded as not-ready, joined to the labels
 * the user sees.
 *
 * Source note (single source of truth, not a second one): the readiness request
 * is built by `readinessStore` from `useCanvasStore.ceeAnalysisReady` and sent
 * as `payload.analysis_ready`. So `analysisReady.options[].status` is the EXACT
 * input the verdict was computed from — reading it here is reading the verdict's
 * own premises, not an independent guess at them. `verifyAgainstVerdict` below
 * still cross-checks the two before any option is named.
 */
export function selectOptionsNeedingValues(
  analysisReady:
    | { options?: ReadonlyArray<{ id?: unknown; label?: unknown; status?: unknown }> }
    | null
    | undefined,
  nodeLabelById?: ReadonlyMap<string, string>,
): OptionNeedingValues[] {
  const options = analysisReady?.options
  if (!Array.isArray(options)) return []
  const out: OptionNeedingValues[] = []
  for (const opt of options) {
    if (typeof opt?.id !== 'string' || opt.id.length === 0) continue
    if (opt.status === 'ready') continue
    const own = typeof opt.label === 'string' && opt.label.trim().length > 0 ? opt.label : undefined
    const fromCanvas = nodeLabelById?.get(opt.id)
    const label = own ?? (fromCanvas && fromCanvas.trim().length > 0 ? fromCanvas : undefined)
    // No human label anywhere → do NOT fall back to the node id. Showing
    // `opt_extend` to a user is the developer-facing leak this module removes;
    // an unnamed entry still counts, so the copy degrades to a count.
    out.push({ id: opt.id, label: label ?? '' })
  }
  return out
}

/**
 * The verdict's OWN count of not-ready options, or `null` when it did not send
 * the arithmetic (older CEE, the V1/V2 response, the local 404/429 fallback).
 *
 * A2: this is the only number allowed in front of a user once the client-side
 * list has been ruled untrustworthy. Zero or negative means the verdict does not
 * actually claim any option is outstanding — say nothing rather than "0 options".
 */
function verdictNotReadyCount(readiness: GraphReadiness | null | undefined): number | null {
  const total = readiness?.options_total
  const ready = readiness?.options_ready
  if (typeof total !== 'number' || typeof ready !== 'number') return null
  const outstanding = total - ready
  return outstanding > 0 ? outstanding : null
}

/**
 * Cross-check the named options against the verdict's own counts before we put
 * a name in front of the user.
 *
 * `options_total - options_ready` is the verdict's count of not-ready options.
 * If our list disagrees, one of the two is stale (a turn landed between the
 * readiness fetch and this render). Naming an option on stale evidence is
 * exactly the class of error this module exists to stop, so a mismatch
 * DOWNGRADES to count-based copy instead of guessing. Counts absent (older CEE)
 * ⇒ no cross-check available ⇒ proceed, since the option statuses are still the
 * verdict's own input.
 */
function verifyAgainstVerdict(
  readiness: GraphReadiness | null | undefined,
  named: readonly OptionNeedingValues[],
): boolean {
  const total = readiness?.options_total
  const ready = readiness?.options_ready
  if (typeof total !== 'number' || typeof ready !== 'number') return true
  return total - ready === named.length
}

/**
 * A3 — may the option rungs end with the PROMISE "and the analysis can run"?
 *
 * The claim half of that sentence ("X has no effect values yet") and the promise
 * half are separate facts, and the review found the second can be false while
 * the first is true: the option rungs fire whenever ANY option is not-ready,
 * regardless of whether that is the ONLY thing blocking the verdict. On a
 * multi-cause verdict the user does exactly what the copy names, stays blocked,
 * and gets no new explanation — Paul's dead end with a truthier-sounding
 * sentence.
 *
 * So the promise is licensed only when no other cause is present IN THE FIELDS
 * THE UI FORWARDS (not "the verdict itself" — the re-review corrected that
 * overclaim: the wire verdict also carries `issues[]` and `blocker_reason`,
 * which the store normaliser does not forward, so a prose-only co-blocker
 * there could license a promise that a second cause then breaks; residual
 * rowed, ROADMAP 2.118 — fail-safe fix is forwarding `issues.length` and
 * suppressing the promise when it exceeds options_total − options_ready).
 * Determined from the forwarded VERDICT FIELDS ALONE, never from the
 * client-side option list, so a stale-evidence downgrade cannot corrupt it.
 *
 * ⚠ Honest scope note. The first two clauses are the trivially-licensed cases
 * and are, at every live call site today, FALSE by construction: `canRunAnalysis`
 * only composes a blocked reason when `can_run_analysis` is false AND
 * `will_scaffold_options` is not true. They are kept because this function is
 * exported behaviour, not a private branch of that one caller — but the clause
 * that actually decides the promise on the live path is the "no other disclosed
 * cause" test below.
 */
function promiseIsLicensed(readiness: GraphReadiness | null | undefined): boolean {
  if (readiness?.can_run_analysis === true) return true
  if (readiness?.scaffold_plan?.will_scaffold_options === true) return true
  // A second disclosed cause: fixing the options would not unblock the run.
  if (readiness?.goal_node_valid === false) return false
  if (typeof readiness?.options_total === 'number' && readiness.options_total < 2) return false
  return true
}

/**
 * Compose the user-facing reason the analysis is not available.
 *
 * Priority is by SPECIFICITY: name the actual remedy when the structured fields
 * support it, and degrade — never to a different factual claim, only to a less
 * specific true one.
 *
 * @param verdictIsStale ROADMAP 2.635 (I-3) — `readinessStore.stale`: the model
 * has changed in a way this verdict was never asked about. When true, EVERY
 * rung below is short-circuited, because every one of them is a claim about a
 * graph this verdict did not grade. See `BLOCKED_REASON_COPY.staleRecheck`.
 *
 * ⚠ It defaults to `false` — "treat as current" — which is deliberate and is
 * the pre-2.635 behaviour, so a caller who omits it gets today's copy rather
 * than a new one. That default is only safe because the wiring is not left to
 * memory: `blockedReasonStaleWiring.derived.spec.ts` DERIVES the call-site
 * manifest from source and REDs if a production caller stops passing it. A
 * hand-remembered argument is the trap-12 mirror; a derived guard on top of a
 * safe default is not.
 */
/**
 * The producer's own repair guidance from the GRAPH-readiness verdict, ready to
 * render — or `null` when it cannot ship as written.
 *
 * ⚠ WHY THIS EXISTS. The panel has two authorities. When the ANALYSIS authority
 * is present, `composeAnalysisBlockedReason` names the producer's blockers and
 * the user is told exactly what is missing. When it is ABSENT, the footer falls
 * to this composer — which read `options_ready`, `goal_node_valid` and
 * `options_total`, and if none of those rungs matched, said "Olumi needs
 * something more from this model … ask in the chat and it will explain what is
 * missing".
 *
 * ⭐ It was holding the answer while it said that. `GraphReadiness.improvements`
 * carries the producer's own `action` strings — "Choose the missing effect value
 * for X on Y" — and nothing in this module ever read them. The panel discarded
 * named, structured, user-readable remedies and sent the user elsewhere for
 * them. Witnessed mounted with three such actions in the payload.
 *
 * ⚠ DELIBERATELY THE SAME SHAPE AS `producerAuthoredReason`, NOT A SECOND RULE.
 * Same degrade-to-null on any unusable entry, same de-duplication, same join,
 * and the SAME vet: `isSafeCeeText`, never `guardCeeText`. That choice is not
 * stylistic — the sibling's header records it measured: the substituting guard
 * rewrites a user's own quoted option label into one that exists on no canvas
 * ("Move billing to edge computing" -> "… to connection computing"). Producer
 * prose is VETTED here and rewritten nowhere.
 *
 * ⚠ AND IT NAMES ALL OF THEM. Truncating to the first would understate the work
 * outstanding by exactly the number withheld — the defect this module's A2 rung
 * already forbids for counts.
 */
function producerAuthoredImprovement(
  readiness: GraphReadiness | null | undefined,
): string | null {
  const improvements = readiness?.improvements
  if (!Array.isArray(improvements) || improvements.length === 0) return null

  // The ONLY rule specific to this authority: the STORE FABRICATES on this
  // field. An improvement that arrived with neither `action` nor
  // `recommendation` is mapped to a synthesised line so the improvements LIST
  // still renders a row — non-empty, and therefore not caught by the shared
  // emptiness degrade. Mapped to `undefined` so the shared body degrades the
  // WHOLE sentence, which is what a fabricated entry deserves.
  return composeProducerAuthoredSentences(
    improvements.map(improvement =>
      improvement?.action === IMPROVEMENT_ACTION_PLACEHOLDER ? undefined : improvement?.action,
    ),
  )
}

export function composeReadinessBlockedReason(
  readiness: GraphReadiness | null | undefined,
  optionsNeedingValues: readonly OptionNeedingValues[] = [],
  verdictIsStale: boolean = false,
): string {
  // ── ROADMAP 2.635 (I-3): a stale verdict is not quoted as current ──
  //
  // First, and before any field of `readiness` is read. Each rung below draws a
  // specific factual claim — an option's name, a count, a missing goal — from
  // the verdict's structured fields, and those fields describe the graph as it
  // was when the verdict was taken. Once the canvas has moved on, publishing
  // them tells the user to do something they may have just done.
  //
  // Note this rung short-circuits `unspecified` too. That sentence looks
  // claim-free, but "Olumi is not able to run this yet" still asserts the
  // verdict's `can_run_analysis: false` as a present-tense fact about the model
  // on screen, and that is exactly the assertion staleness invalidates.
  if (verdictIsStale) return BLOCKED_REASON_COPY.staleRecheck

  const trustNames = verifyAgainstVerdict(readiness, optionsNeedingValues)
  const labelled = trustNames
    ? optionsNeedingValues
        .map((o) => safeDisplayLabel(o.label))
        .filter((l): l is string => l !== null)
    : []
  const canRunAfter = promiseIsLicensed(readiness)

  // 1. Options awaiting effect values — the state a chat-added option lands in,
  //    and the one with a concrete remedy the user can act on.
  if (optionsNeedingValues.length > 0) {
    if (labelled.length === 1 && optionsNeedingValues.length === 1) {
      return BLOCKED_REASON_COPY.oneOption(labelled[0], canRunAfter)
    }
    if (labelled.length === 2 && optionsNeedingValues.length === 2) {
      return BLOCKED_REASON_COPY.twoOptions(labelled[0], labelled[1], canRunAfter)
    }
    // A2: the verdict's own arithmetic FIRST. The client list's length may only
    // speak when the verdict sent no counts to contradict it — publishing it
    // after a failed cross-check would be a specific numeric claim built on
    // evidence this function had, in the line above, declared stale.
    const count = verdictNotReadyCount(readiness) ?? (trustNames ? optionsNeedingValues.length : 0)
    if (count <= 0) {
      // ⚠ THE SECOND PATH TO `unspecified`, AND IT USED TO SKIP THE PRODUCER.
      // Reaching here means the client's option list and the verdict's own
      // arithmetic DISAGREE (`optionsNeedingValues` non-empty, verdict count
      // zero) — the two come from different stores, which is the skew
      // `verifyAgainstVerdict` exists for. Returning the non-committal rung is
      // the right answer to the DISAGREEMENT, but it was also discarding the
      // producer's own repair actions, which are carried on the SAME readiness
      // object as the count and are therefore consistent with it. Naming them is
      // a LESS SPECIFIC TRUE claim from the same authority, which is this
      // module's standing rule; `unspecified` remains the floor.
      const authoredAtSkew = producerAuthoredImprovement(readiness)
      return authoredAtSkew ?? BLOCKED_REASON_COPY.unspecified
    }
    return BLOCKED_REASON_COPY.manyOptions(count, canRunAfter)
  }

  // 2. The goal the verdict graded against is not in the model.
  if (readiness?.goal_node_valid === false) return BLOCKED_REASON_COPY.goalMissing

  // 3. Not enough options to compare. Read from the verdict's own count, never
  //    from a client-side node tally, so the sentence and the verdict agree.
  if (typeof readiness?.options_total === 'number' && readiness.options_total < 2) {
    return BLOCKED_REASON_COPY.tooFewOptions
  }

  // 4. Nothing the STRUCTURED fields can name — but the verdict may still carry
  //    the producer's own repair guidance, and until now this rung discarded it.
  //
  //    Ordered last on purpose: the rungs above compose OUR sentence from the
  //    verdict's typed fields and are preferred where they match, because they
  //    are the ones this module can guarantee. This is the step before giving
  //    up, not a new preference over them.
  //
  //    ⚠ It cannot outrank the stale short-circuit either: that returns at the
  //    top of this function, so a stale verdict's improvements — which describe
  //    a graph the user has already changed — never reach here.
  const authoredImprovement = producerAuthoredImprovement(readiness)
  if (authoredImprovement !== null) return authoredImprovement

  // 5. Now there is genuinely nothing specific to name. Say exactly that.
  return BLOCKED_REASON_COPY.unspecified
}

/**
 * The producer's own repair guidance, ready to render — or `null` when it
 * cannot ship as written.
 *
 * ── WHY THE VET IS `isSafeCeeText` AND NOT `containsBannedTerm` (MEASURED) ──
 * `safeDisplayLabel` vets LABELS against the canonical glossary. That is the
 * wrong instrument here, and the gap is not theoretical — it was measured at
 * this tip before this function was written:
 *
 *   'Choose the missing effect value for "Move billing to edge computing".'
 *     containsBannedTerm → false   (the canonical list carries no bare "edge")
 *     isSafeCeeText      → false   (`CEE_EXTRA_TERMS` does)
 *     guardCeeText(…)    → '…for "Move billing to connection computing".'
 *
 * A message admitted by the canonical glossary alone still reaches the render
 * seam's SUBSTITUTING guard, and the user's own option label comes out as an
 * option that exists on no canvas — the precise corruption `vetBlockedReason`'s
 * header records, reproduced on the producer's sentence instead of on ours.
 *
 * ── AND THIS IS HOW THE GUARD IS BYPASSED — BY MAKING IT AN IDENTITY ────────
 * `guardCeeText` returns its input UNCHANGED when `isSafeCeeText(text)` is true
 * (`ceeTextGuard.ts:112`). So vetting with the seam's OWN predicate is not a
 * route around the guard, it is a proof that the guard has nothing to do:
 * everything this function returns passes through `vetBlockedReason`'s
 * `foreign` arm byte-for-byte.
 *
 * That is deliberately preferred over threading a provenance flag from here to
 * the render seam. The string reaches SIX surfaces — `PanelFooter`'s subline
 * and its disabled control's `title`, `AnalysisReadinessBar`, the ⌘Enter toast
 * (`PreAnalysisPanelV3:61`, which calls `guardCeeText` DIRECTLY and never sees
 * `vetBlockedReason`), the legacy `StickyFooter`, `derivePostFooterMeta` and
 * `getRunButtonAriaLabel` — and three of those render the string RAW with no
 * guard at all. A provenance channel would have to reach every one of them, and
 * a surface that forgot it would silently get the corrupting arm. Making the
 * TEXT safe is the only answer that cannot be forgotten by a call site, and it
 * also survives `canRunAnalysis`'s ` (+N more issues)` concatenation, which
 * destroys any structure a channel could have carried.
 *
 * ── WHAT IS VETTED IS EXACTLY WHAT SHIPS (A1, one level up) ─────────────────
 * The JOIN is vetted, not the parts. Two individually-safe messages can form a
 * banned phrase across the seam between them ("…the confidence" + "score is…"),
 * which is the same class as A1's truncate-then-vet finding: check the bytes
 * that ship, not the bytes you started with.
 *
 * ── ALL OR NOTHING ─────────────────────────────────────────────────────────
 * One unusable message degrades the WHOLE sentence to the scope rungs. Two
 * reasons, both inherited: rendering the safe subset would understate the work
 * outstanding by exactly the entries declined (A2's rule), and mixing the
 * producer's prose with ours in one sentence attributes our words to the
 * producer — the failure this module exists to end, with the authorship
 * reversed.
 *
 * Order is the producer's own array order: deterministic, and not ours to
 * choose. NOTHING is truncated and nothing is summarised — the contract forbids
 * both, so a list too long for one line degrades whole rather than being cut.
 * The single list-level transformation is EXACT de-duplication: every sentence
 * returned is byte-identical to a message the producer wrote, no message is
 * altered, and repeating one verbatim conveys nothing the first rendering did
 * not while reading as a defect.
 */
/**
 * ⭐ THE ONE COMPOSER for producer-authored refusal prose. Both authorities —
 * `analysisReadiness.blockers[].message` and `graph-readiness
 * improvements[].action` — are the same rule over a different field, so they are
 * the same BODY over a mapped field rather than two implementations that happen
 * to agree today.
 *
 * ⚠ THEY WERE TWO, AND THE COPY HAD ALREADY LOST A GUARD. The improvement path
 * was written as "deliberately the same shape, not a second rule" — which is the
 * sentence that lets a mirror ship. Measured: deleting `isSafeCeeText` from the
 * improvement path ONLY survived all 359 tests, and under that mutant
 * `'Add an edge from "Pilot" to "Cash Burn Rate".'` reaches the render seam raw,
 * where `guardCeeText` rewrites it to
 * `'Add an connection from "Pilot" to "Cash Burn Rate".'` — the exact corruption
 * this module's own header exists to record. One body cannot drift from itself.
 *
 * The rule, in one place:
 *  · DEGRADE WHOLE — one unusable entry degrades the entire sentence rather than
 *    publishing a partial list that reads as complete. A type is not a runtime
 *    guarantee, and these values arrive over a network.
 *  · DE-DUPLICATE — an exactly-repeated sentence is rendered once.
 *  · VET THE JOIN, NOT THE PARTS — a phrase can be formed ACROSS the seam
 *    between two individually-safe sentences, so the vetted string is the one
 *    that ships.
 *  · INVENT NOTHING — the return value is the producer's own text and nothing
 *    else. No prefix, no framing, no connective of ours.
 */
function composeProducerAuthoredSentenceList(
  values: readonly (string | undefined)[],
): readonly string[] | null {
  const sentences: string[] = []
  for (const value of values) {
    const text = typeof value === 'string' ? value.trim() : ''
    if (text.length === 0) return null
    if (!sentences.includes(text)) sentences.push(text)
  }
  if (sentences.length === 0) return null

  // STILL VET THE JOIN, even though the LIST is what ships to the panel. A
  // phrase can form across the seam between two individually-safe sentences,
  // so the join remains the vetted string and a rejection withholds the WHOLE
  // list — never a subset. Rendering the parts is strictly safer than
  // rendering the join: the cross-seam adjacency never reaches the reader.
  const joined = sentences.join(' ')
  return isSafeCeeText(joined) ? sentences : null
}

/** The joined form. Derived from the list, so the two cannot disagree. */
function composeProducerAuthoredSentences(
  values: readonly (string | undefined)[],
): string | null {
  return composeProducerAuthoredSentenceList(values)?.join(' ') ?? null
}

function producerAuthoredSentences(
  blockers: readonly AnalysisBlocker[],
): readonly string[] | null {
  // The TYPE says `string` and the schema says `.min(1)`; the shared body still
  // re-checks at runtime, because a type is not a runtime guarantee here.
  return composeProducerAuthoredSentenceList(blockers.map(blocker => blocker.message))
}

/**
 * Compose the refusal from the PRODUCER's own readiness blockers.
 *
 * The counterpart to `composeReadinessBlockedReason`, for the authority that
 * supersedes it. Same rule, one layer up: name the remedy when the structured
 * fields support it, and degrade only to a LESS SPECIFIC TRUE claim — never to
 * a different one.
 *
 * ⚠ THE EMPTY LIST IS NOT A REFUSAL AND MUST NEVER REACH HERE. The contract is
 * explicit that `blockers: []` is a POSITIVE claim — the producer assessed
 * readiness and found nothing blocking — so a caller composing a refusal from
 * an empty list has already decided something this function cannot justify.
 * The guard below returns the non-committal rung rather than inventing a cause,
 * but the real protection is `readinessObjectsToRun`, which never asks.
 *
 * ⭐ THE PRODUCER'S OWN SENTENCES FIRST (A4). `blocker.message` is contracted to
 * be rendered VERBATIM; the scope-label rungs below are the DEGRADE, reached
 * only when those sentences cannot ship as written. See `producerAuthoredReason`
 * for the vet, and the rung docs above for why the old order was a defect.
 */
export function analysisBlockedSentences(
  blockers: readonly AnalysisBlocker[],
): readonly string[] {
  if (blockers.length === 0) return [BLOCKED_REASON_COPY.unspecified]

  const authored = producerAuthoredSentences(blockers)
  if (authored !== null) return authored

  // `option_label` and `factor_label` are the two scopes the contract carries.
  // Read in that order because an option is the more actionable of the two and
  // the one the user chose the words for; a blocker scoped to neither has no
  // name to give and falls to the count.
  const labelled = blockers
    .map((b) => b.option_label ?? b.factor_label ?? '')
    .map((raw) => (raw.trim().length > 0 ? safeDisplayLabel(raw) : null))
    .filter((label): label is string => label !== null)

  if (blockers.length === 1 && labelled.length === 1) {
    return [BLOCKED_REASON_COPY.canonicalOneBlocker(labelled[0])]
  }
  if (blockers.length === 2 && labelled.length === 2) {
    return [BLOCKED_REASON_COPY.canonicalTwoBlockers(labelled[0], labelled[1])]
  }
  // A2's rule, inherited: the count published is the VERDICT's own list length,
  // never the length of the sub-list we managed to quote. Publishing the latter
  // would understate the work outstanding by exactly the number of entries we
  // could not name.
  return [BLOCKED_REASON_COPY.canonicalManyBlockers(blockers.length)]
}

/**
 * One blocking line, with the producer's own scope for it when there is one.
 *
 * `scope` exists so a surface can offer to TAKE THE USER TO the thing the line
 * is about, instead of making them hunt an option/factor pair on the canvas by
 * hand — the affordance the retired `pre-analysis/BlockersSection` had and the
 * v3 footer dropped.
 *
 * ⚠ IT IS THE PRODUCER'S ID, NOT A CANVAS NODE ID, AND THE TWO ARE NOT THE SAME
 * CLAIM. Nothing here knows whether a node with that id is on the user's canvas.
 * A surface MUST resolve it against the live graph and fall back to plain text
 * when it does not resolve — offering a control that goes nowhere is the
 * "advertises an action that terminates in refusal" defect, not a convenience.
 */
export interface GateBlockedItem {
  /** The renderable sentence, exactly as its author wrote it. */
  readonly text: string
  /** Option first — it is the more actionable scope and the one the user named. */
  readonly scope?: { readonly id?: string; readonly label?: string }
}

/**
 * The same lines as `analysisBlockedSentences`, each carrying the producer's own
 * scope where — and ONLY where — that scope is unambiguous.
 *
 * ⭐ DERIVED FROM THE SENTENCE LIST, NOT COMPOSED BESIDE IT.
 * `items.map(i => i.text)` is `analysisBlockedSentences(...)` by construction, so
 * the linked list and the rendered text cannot drift apart. Composing the two
 * separately is the mirror this module's own header was written about.
 *
 * ⚠ A LINE THAT STANDS FOR SEVERAL BLOCKERS GETS NO SCOPE, and that is the whole
 * care here. Two rungs produce such lines: the de-duplication above (two
 * blockers, one identical sentence) and the DEGRADE rungs, where one sentence
 * summarises the whole list. Attaching one blocker's id to a line that speaks
 * for several would send the user to an arbitrary one of them while looking
 * exactly as authoritative as a correct link. So the scope attaches only when
 * EXACTLY ONE blocker authored that exact text, and every other line stays plain.
 */
export function analysisBlockedItems(
  blockers: readonly AnalysisBlocker[],
): readonly GateBlockedItem[] {
  return analysisBlockedSentences(blockers).map((text) => {
    const authors = blockers.filter((b) => (b.message ?? '').trim() === text)
    if (authors.length !== 1) return { text }
    const author = authors[0]
    // Option first — the more actionable scope, and the one the user chose the
    // words for. Same order `analysisBlockedSentences` reads them in.
    const id = author.option_id ?? author.factor_id
    const label = author.option_label ?? author.factor_label
    return id === undefined && label === undefined ? { text } : { text, scope: { id, label } }
  })
}

/**
 * The joined form — DERIVED from `analysisBlockedSentences`, never composed
 * separately.
 *
 * ⭐ THAT DERIVATION IS THE POINT. The Analyse button's tooltip and readiness
 * bar consume this string while the pre-analysis panel renders the list; if the
 * two were composed independently they could disagree about what the producer
 * said, and one surface would be quietly wrong. One array behind both makes the
 * union byte-identical BY CONSTRUCTION rather than by a test that can drift.
 */
export function composeAnalysisBlockedReason(
  blockers: readonly AnalysisBlocker[],
): string {
  return analysisBlockedSentences(blockers).join(' ')
}

// ══════════════════════════════════════════════════════════════════════════
// A1 — the render path must VET this copy, never REWRITE it.
//
// `guardCeeText` (the panel's runtime guard for CEE-authored prose) PREFERS
// IN-PLACE SUBSTITUTION and enforces terms beyond the canonical glossary
// (node/nodes/edge/edges/graphs/…). Passing a composed sentence through it
// rewrote the user's own quoted option label: "Move billing to edge computing"
// rendered as "Move billing to connection computing", an option that exists on
// no canvas — while the unguarded ⌘Enter toast and dock tooltip showed the real
// name. Two surfaces, two option names, one state.
//
// That is not a bug in the guard. Its own header says substitution applies to
// coaching text and "NEVER to option/factor/risk labels (those are shared graph
// data)" — the composed sentence smuggles a quoted graph label into a guarded
// channel, and the guard cannot know the quotes are sacred. So the render path
// asks THIS module instead, and this module answers without touching a byte.
// ══════════════════════════════════════════════════════════════════════════

/**
 * What a blocked-reason string is, from the point of view of a surface about to
 * render it.
 *
 * - `composed-safe`   — one of ours, with a quotable label: render VERBATIM.
 * - `composed-unsafe` — our shape, but a quoted label trips the canonical
 *                       glossary: degrade the WHOLE sentence to the surface's
 *                       non-committal fallback. Never a rewritten label.
 * - `foreign`         — not ours (engine prose, a validator message): the
 *                       existing guard's contract applies, unchanged.
 */
export type BlockedReasonProvenance = 'composed-safe' | 'composed-unsafe' | 'foreign'

const LABEL_SLOT = 'OLUMI_COMPOSED_LABEL_SLOT'
const SECOND_LABEL_SLOT = 'OLUMI_COMPOSED_LABEL_SLOT_2'
const COUNT_SLOT = 424242

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

let cachedPatterns: RegExp[] | null = null

/**
 * An anchored pattern per sentence `BLOCKED_REASON_COPY` can produce, DERIVED
 * FROM THE FACTORIES THEMSELVES.
 *
 * Deliberately not a second copy of the strings: a hand-written list here would
 * drift the first time a rung was added or reworded, and the drift would read as
 * green — an unrecognised composed sentence degrades silently to the fallback,
 * which is exactly the "guard emits a less useful string than it was given"
 * failure this module exists to end. A spec asserts the sample matrix covers
 * every key of `BLOCKED_REASON_COPY`, so a new rung fails loudly instead.
 */
function composedPatterns(): RegExp[] {
  if (cachedPatterns) return cachedPatterns
  const templates = [
    BLOCKED_REASON_COPY.oneOption(LABEL_SLOT, true),
    BLOCKED_REASON_COPY.oneOption(LABEL_SLOT, false),
    BLOCKED_REASON_COPY.twoOptions(LABEL_SLOT, SECOND_LABEL_SLOT, true),
    BLOCKED_REASON_COPY.twoOptions(LABEL_SLOT, SECOND_LABEL_SLOT, false),
    BLOCKED_REASON_COPY.manyOptions(1, true),
    BLOCKED_REASON_COPY.manyOptions(1, false),
    BLOCKED_REASON_COPY.manyOptions(COUNT_SLOT, true),
    BLOCKED_REASON_COPY.manyOptions(COUNT_SLOT, false),
    BLOCKED_REASON_COPY.goalMissing,
    BLOCKED_REASON_COPY.tooFewOptions,
    BLOCKED_REASON_COPY.unspecified,
    // The canonical rungs. Omitting them here would degrade every
    // producer-sourced refusal to the footer's non-committal fallback at the
    // render seam — i.e. it would re-create the exact false sentence this lane
    // was opened to delete, one layer further down. The sample-matrix spec
    // fails loud if a rung is added without a sample, which is why that spec
    // asserts coverage of every key.
    BLOCKED_REASON_COPY.canonicalOneBlocker(LABEL_SLOT),
    BLOCKED_REASON_COPY.canonicalTwoBlockers(LABEL_SLOT, SECOND_LABEL_SLOT),
    BLOCKED_REASON_COPY.canonicalManyBlockers(1),
    BLOCKED_REASON_COPY.canonicalManyBlockers(COUNT_SLOT),
    // ROADMAP 2.635 (I-3). Omitting it here would have been the exact failure
    // this function's docstring warns about: an unrecognised composed sentence
    // classifies as `foreign` and the render path degrades it to the surface's
    // non-committal fallback — so the staleness disclosure would silently
    // vanish at the very surface it was written for. Caught by the sample-matrix
    // spec, which is why that spec asserts coverage of every key.
    BLOCKED_REASON_COPY.staleRecheck,
  ]
  cachedPatterns = templates.map((template) => {
    const source = escapeForRegex(template)
      // Longest sentinel first: SECOND_LABEL_SLOT contains LABEL_SLOT.
      .split(SECOND_LABEL_SLOT)
      .join('(?<second>[^"]*)')
      .split(LABEL_SLOT)
      .join('(?<first>[^"]*)')
      .split(String(COUNT_SLOT))
      .join('\\d+')
    return new RegExp(`^${source}$`)
  })
  return cachedPatterns
}

/**
 * Classify a blocked-reason string WITHOUT modifying it. Pure and total.
 *
 * The sentence frames are matched against this module's own constants, which the
 * glossary sweep already scans, so only the interpolated labels need vetting —
 * and they are vetted against the CANONICAL glossary, the same matcher
 * `safeDisplayLabel` used to admit them. Terms outside that list (a user's own
 * "edge computing", "node capacity") are the user's words about their own
 * decision, not Olumi speaking jargon, and are quoted back exactly as typed.
 */
export function classifyBlockedReason(text: string): BlockedReasonProvenance {
  for (const pattern of composedPatterns()) {
    const match = pattern.exec(text)
    if (!match) continue
    const labels = [match.groups?.first, match.groups?.second].filter(
      (l): l is string => typeof l === 'string',
    )
    return labels.some((label) => containsBannedTerm(label)) ? 'composed-unsafe' : 'composed-safe'
  }
  return 'foreign'
}
