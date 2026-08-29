/**
 * THE BLOCKER LIST MUST SURVIVE THE GATE'S OWN SUMMARY SUFFIX.
 *
 * ── THE DEFECT, AS MEASURED ────────────────────────────────────────────────
 * `canRunAnalysis` appends a generated `" (+N more issues)"` to `reason` as soon
 * as a second blocking reason exists. The footer carried the per-blocker list
 * only when the vetted subline was BYTE-IDENTICAL to the join of the sentences
 * beside it — one equality answering two different questions — so that suffix
 * dropped the list entirely.
 *
 * A model with a validation error AND missing option values therefore showed a
 * tester exactly one line:
 *
 *   Connection from "Speed" to "Revenue" has no effect direction (+1 more issue)
 *
 * and NOTHING about which values to supply. The blockers are the actionable
 * half; the product stated a problem and withheld the remedy, in exactly the
 * state where the user had the most to fix.
 *
 * ── THE TWO HARMS, AND WHY EVERY CASE HERE HAS A TWIN ──────────────────────
 * Withholding a needed list and showing a list that does not match the summary
 * are OPPOSITE harms, and they cannot share one window. So each "the list must
 * now appear" case below is paired with a "a genuinely mismatched listing must
 * STILL suppress it" twin. A fix that bought one by losing the other is a
 * regression wearing a fix's clothes.
 *
 * ⚠ ORDER IS NOT UNDER TEST AND MUST NOT BECOME A FEATURE. The assertions pin
 * the gate's own construction order because that is what the gate produces —
 * NOT because it ranks anything. There is no honest ranking available here (see
 * `GateBlockedListing`), and a spec that asserted one would licence inventing it.
 */
import { describe, it, expect } from 'vitest'
import type { AnalysisBlocker } from '@talchain/schemas/boundary'
import { canRunAnalysis } from '@/canvas/utils/canRunAnalysis'
import { deriveReadinessDisplay } from '../readinessDisplay'
import { BLOCKED_REASON_FALLBACK, vetBlockedReason } from '@/canvas/utils/vetBlockedReason'
import { BLOCKED_REASON_COPY } from '@/canvas/utils/composeBlockedReason'

/** The producer's own sentences, verbatim, as they arrive on the wire. */
const KEEP_SENTENCE =
  'Choose the missing effect value for "keep what we have" on "Current CRM Capability Gap".'
const MIGRATE_SENTENCE =
  'Choose the missing effect value for "migrate to Salesforce instead" on "Salesforce Switching Cost".'

/** What the validator says, and what the glossary vet turns it into in place. */
const VALIDATION_RAW = 'Edge from "Speed" to "Revenue" has no effect direction'
const VALIDATION_VETTED = 'Connection from "Speed" to "Revenue" has no effect direction'

const blocker = (message: string, optionId: string, optionLabel: string): AnalysisBlocker => ({
  code: 'MISSING_OPTION_VALUE',
  category: 'option_values',
  repairability: 'user',
  message,
  option_id: optionId,
  option_label: optionLabel,
})

const BLOCKERS: readonly AnalysisBlocker[] = [
  blocker(KEEP_SENTENCE, 'opt_keep', 'keep what we have'),
  blocker(MIGRATE_SENTENCE, 'opt_migrate', 'migrate to Salesforce instead'),
]

const VALIDATION_ISSUE = {
  severity: 'error',
  code: 'EDGE_NO_DIRECTION',
  type: 'edge',
  message: VALIDATION_RAW,
}

/** The real gate, driven the way `OutputsDock` drives it. */
function gate(opts: { withValidationError: boolean }) {
  return canRunAnalysis({
    nodeCount: 4,
    graphHealth: opts.withValidationError ? { issues: [VALIDATION_ISSUE] } : { issues: [] },
    readiness: null,
    analysisReadiness: { status: 'needs_user_input', blockers: BLOCKERS },
    hasBlockers: false,
  })
}

/** The real render derivation, fed the gate's own two values. */
function display(reason: string | undefined, listing: ReturnType<typeof gate>['blockedListing']) {
  return deriveReadinessDisplay({
    readinessCheck: null,
    isAnalysing: false,
    canRun: false,
    blockedReason: reason,
    blockedListing: listing,
    nothingHasAnswered: false,
    resting: { dot: 'success', headline: 'Analysis available', subline: '' },
  })
}

describe('the blocker list survives the gate summary suffix', () => {
  it('PRECONDITION: the two-blocker state really does carry the generated suffix', () => {
    // Without this the whole file could pass while testing a state the defect
    // never occurred in. Binds to the exact suffix the gate composes.
    const result = gate({ withValidationError: true })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe(`${VALIDATION_RAW} (+1 more issue)`)
    expect(result.blockingReasons).toHaveLength(2)
  })

  it('PRECONDITION: the single-authority state carries NO suffix, so the two cases differ', () => {
    const result = gate({ withValidationError: false })
    expect(result.reason).toBe(`${KEEP_SENTENCE} ${MIGRATE_SENTENCE}`)
    expect(result.reason).not.toContain('more issue')
  })

  it('THE FIX: a validation error alongside missing values keeps every blocker line', () => {
    const result = gate({ withValidationError: true })
    const d = display(result.reason, result.blockedListing)

    // Bound by IDENTITY — the exact sentence for each option/factor pair, not a
    // count and not a substring another line could satisfy.
    expect(d.sublineSentences).toEqual([VALIDATION_VETTED, KEEP_SENTENCE, MIGRATE_SENTENCE])
  })

  it('THE FIX, stated as the user experiences it: the option/factor pairs are named', () => {
    const d = display(...(() => {
      const r = gate({ withValidationError: true })
      return [r.reason, r.blockedListing] as const
    })())
    expect(d.sublineSentences).toContain(KEEP_SENTENCE)
    expect(d.sublineSentences).toContain(MIGRATE_SENTENCE)
  })

  it('THE VALIDATION ERROR IS NOT TRADED AWAY FOR THE VALUES', () => {
    // The naive fix renders only the readiness sentences and silently drops the
    // validation error — swapping one withheld fact for another. This pins the
    // whole set, so that trade fails loudly.
    const d = display(...(() => {
      const r = gate({ withValidationError: true })
      return [r.reason, r.blockedListing] as const
    })())
    expect(d.sublineSentences).toContain(VALIDATION_VETTED)
  })

  it('NO REGRESSION: the single-authority state still renders exactly its two sentences', () => {
    const result = gate({ withValidationError: false })
    const d = display(result.reason, result.blockedListing)
    expect(d.sublineSentences).toEqual([KEEP_SENTENCE, MIGRATE_SENTENCE])
  })

  it('THE SUMMARY LINE IS UNCHANGED — this lane withheld a list, it did not reword anything', () => {
    const result = gate({ withValidationError: true })
    const d = display(result.reason, result.blockedListing)
    expect(d.subline).toBe(`${VALIDATION_VETTED} (+1 more issue)`)
  })

  // ── THE OPPOSITE-DIRECTION TWINS ─────────────────────────────────────────

  it('TWIN: a listing whose summary is NOT the reason beside it is STILL suppressed', () => {
    const result = gate({ withValidationError: true })
    // A listing from some other computation — the exact harm the guard exists
    // for. Its sentences are perfectly well-formed; that is the point.
    const d = display('A completely different refusal.', result.blockedListing)
    expect(d.sublineSentences).toBeUndefined()
    expect(d.subline).not.toContain(KEEP_SENTENCE)
  })

  it('TWIN: a stale summary carrying the WRONG count is STILL suppressed', () => {
    // The near-miss case, and the one a suffix-stripping regex would wave
    // through: same primary reason, wrong number of issues behind it.
    const result = gate({ withValidationError: true })
    const d = display(`${VALIDATION_RAW} (+4 more issues)`, result.blockedListing)
    expect(d.sublineSentences).toBeUndefined()
  })

  it('TWIN: a sentence the vet DEGRADES withholds the WHOLE list, never a subset', () => {
    // `vetBlockedReason` degrades a COMPOSED sentence whose quoted label trips
    // the canonical glossary — it will not rewrite the user's own words, so the
    // whole sentence becomes the non-committal fallback. One fallback bullet
    // among real ones is a claim we cannot support, so nothing renders as a list.
    // The label is a term the canonical glossary bans, so the vet refuses the
    // whole sentence rather than rewrite the user's own words.
    const unsafe = BLOCKED_REASON_COPY.canonicalOneBlocker('graph')
    // PIN THE PRECONDITION IN-TEST: this fixture must actually degrade, or the
    // case below passes for the wrong reason and guards nothing.
    expect(vetBlockedReason(unsafe)).toBe(BLOCKED_REASON_FALLBACK)
    expect(unsafe).not.toBe(BLOCKED_REASON_FALLBACK)

    const summary = `${unsafe} (+1 more issue)`
    const d = display(summary, { summary, sentences: [unsafe, KEEP_SENTENCE] })
    expect(d.sublineSentences).toBeUndefined()
  })

  it('TWIN: no listing supplied → no list, and the string is exactly today’s', () => {
    const result = gate({ withValidationError: true })
    const d = display(result.reason, undefined)
    expect(d.sublineSentences).toBeUndefined()
    expect(d.subline).toBe(`${VALIDATION_VETTED} (+1 more issue)`)
  })

  it('TWIN: an OPEN gate carries no list — this is the blocked arm only', () => {
    const d = deriveReadinessDisplay({
      readinessCheck: null,
      isAnalysing: false,
      canRun: true,
      nothingHasAnswered: false,
      resting: { dot: 'success', headline: 'Analysis available', subline: 'all set' },
    })
    expect(d.sublineSentences).toBeUndefined()
  })
})
