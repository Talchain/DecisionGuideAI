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

import type { GraphReadiness } from '../hooks/useGraphReadiness'
import {
  containsBannedTerm,
  safeInterpolatedLabel,
} from '../../components/results/analysisHeroV17/glossaryCheck'

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
   */
  unspecified: 'Olumi is not able to run this yet. Ask in the chat and it will explain what is missing.',
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
 */
export function composeReadinessBlockedReason(
  readiness: GraphReadiness | null | undefined,
  optionsNeedingValues: readonly OptionNeedingValues[] = [],
): string {
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
    if (count <= 0) return BLOCKED_REASON_COPY.unspecified
    return BLOCKED_REASON_COPY.manyOptions(count, canRunAfter)
  }

  // 2. The goal the verdict graded against is not in the model.
  if (readiness?.goal_node_valid === false) return BLOCKED_REASON_COPY.goalMissing

  // 3. Not enough options to compare. Read from the verdict's own count, never
  //    from a client-side node tally, so the sentence and the verdict agree.
  if (typeof readiness?.options_total === 'number' && readiness.options_total < 2) {
    return BLOCKED_REASON_COPY.tooFewOptions
  }

  // 4. Nothing specific enough to name. Say exactly that, and nothing more.
  return BLOCKED_REASON_COPY.unspecified
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
