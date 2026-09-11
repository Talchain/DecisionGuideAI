/**
 * findingDissent — the sendability predicates and the wire shape.
 *
 * ⭐ WHAT THIS SPEC IS FOR. `finding_dissent` carries a human's stated reason
 * verbatim into a long-lived fact row. Three things can go wrong and only one
 * of them is loud: sending a DANGLING ADDRESS (a placeholder analysis id, which
 * commits a claim nobody can resolve), MUTILATING THE WORDS (a trim, which
 * falsifies the record), and LEAKING THEM (into debug state, which R-004's
 * surviving half forbids). None of the three throws. Each is pinned here.
 *
 * ⚠ ASSERTIONS BIND BY IDENTITY. Every expectation names the exact field and
 * the exact value; none asks "is there a string here", which a different string
 * would satisfy just as well.
 */
import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  MAX_DISSENT_STATEMENT,
  buildFindingDissentEvent,
  isSendableAnalysisId,
  isSendableFindingId,
  isSendableStatement,
  redactStatedReason,
} from '../findingDissent'

const OK = {
  findingId: 'strengthen:robustness',
  analysisId: 'sha256:abc123',
  statement: 'Our Q1 capacity assumption is wrong.',
}

describe('findingDissent — the address must be real', () => {
  it('CONTROL: a real pair builds the exact wire member, all four fields', () => {
    const event = buildFindingDissentEvent(OK)
    // The contrast half: the builder can answer YES at all. Without this, every
    // refusal below would be consistent with a builder that refuses everything.
    expect(event).not.toBeNull()
    expect(event?.type).toBe('finding_dissent')
    expect(event?.payload).toEqual({
      finding_id: 'strengthen:robustness',
      analysis_id: 'sha256:abc123',
      statement: 'Our Q1 capacity assumption is wrong.',
    })
  })

  it("REFUSES the literal 'error' — the hash a FAILED run puts on screen", () => {
    // `createErrorReport` sets model_card.response_hash to exactly this string
    // and the Reasoning tab is handed it as `analysisHash`. It is not an
    // analysis id, and a fact row addressed to it could never be resolved.
    expect(isSendableAnalysisId('error')).toBe(false)
    expect(buildFindingDissentEvent({ ...OK, analysisId: 'error' })).toBeNull()
  })

  it('REFUSES the empty and blank hash — the pre-run state', () => {
    expect(isSendableAnalysisId('')).toBe(false)
    expect(isSendableAnalysisId('   ')).toBe(false)
    expect(buildFindingDissentEvent({ ...OK, analysisId: '' })).toBeNull()
    expect(buildFindingDissentEvent({ ...OK, analysisId: '   ' })).toBeNull()
  })

  it('REFUSES an absent hash, both spellings', () => {
    expect(isSendableAnalysisId(null)).toBe(false)
    expect(isSendableAnalysisId(undefined)).toBe(false)
    expect(buildFindingDissentEvent({ ...OK, analysisId: null })).toBeNull()
    expect(buildFindingDissentEvent({ ...OK, analysisId: undefined })).toBeNull()
  })

  it("ACCEPTS a hash that merely CONTAINS 'error' — the guard is not a substring match", () => {
    // A loose predicate here would silently drop real runs whose hash happens to
    // spell the placeholder. The refusal is by VALUE, not by inclusion.
    expect(isSendableAnalysisId('sha256:error9f')).toBe(true)
    expect(buildFindingDissentEvent({ ...OK, analysisId: 'sha256:error9f' })).not.toBeNull()
  })

  it('REFUSES a blank or absent finding id', () => {
    expect(isSendableFindingId('')).toBe(false)
    expect(isSendableFindingId('  ')).toBe(false)
    expect(isSendableFindingId(null)).toBe(false)
    expect(buildFindingDissentEvent({ ...OK, findingId: '' })).toBeNull()
  })
})

describe('findingDissent — the words are the record', () => {
  it('⭐ SENDS THE STATEMENT VERBATIM — leading and trailing space SURVIVE', () => {
    // The contract's field is the user's reason VERBATIM. A tidy-up here would
    // falsify it, and the tidy-up is the tempting change because the predicate
    // beside it trims.
    const statement = '  we measured this in March  '
    const event = buildFindingDissentEvent({ ...OK, statement })
    expect(event?.payload?.statement).toBe('  we measured this in March  ')
  })

  it('⭐ SENDS INNER WHITESPACE AND NEWLINES UNCOLLAPSED', () => {
    const statement = 'first reason\n\n  second reason'
    const event = buildFindingDissentEvent({ ...OK, statement })
    expect(event?.payload?.statement).toBe('first reason\n\n  second reason')
  })

  it('REFUSES a whitespace-only statement rather than tidying it', () => {
    // `.min(1)` alone would admit " ". A blank statement is this member with
    // its point removed, so it is refused, not trimmed into existence.
    expect(isSendableStatement('   ')).toBe(false)
    expect(isSendableStatement('\n\t ')).toBe(false)
    expect(buildFindingDissentEvent({ ...OK, statement: '   ' })).toBeNull()
  })

  it('ACCEPTS exactly the bound and REFUSES one character past it', () => {
    // The bound is measured on the ORIGINAL, because the original is what CEE
    // receives and therefore what its `.max()` measures. An over-long statement
    // fails CEE's `.strict()` member and takes the WHOLE turn (422) with it.
    expect(MAX_DISSENT_STATEMENT).toBe(2000)
    const atBound = 'x'.repeat(MAX_DISSENT_STATEMENT)
    const overBound = 'x'.repeat(MAX_DISSENT_STATEMENT + 1)
    expect(isSendableStatement(atBound)).toBe(true)
    expect(isSendableStatement(overBound)).toBe(false)
    expect(buildFindingDissentEvent({ ...OK, statement: atBound })?.payload?.statement).toBe(atBound)
    expect(buildFindingDissentEvent({ ...OK, statement: overBound })).toBeNull()
  })

  it('measures the bound on the UNTRIMMED original, not on a trimmed copy', () => {
    // A statement whose trimmed length fits but whose real length does not is
    // still rejected by CEE. Measuring the trimmed copy would send it anyway.
    const overBoundWithSpace = ` ${'x'.repeat(MAX_DISSENT_STATEMENT)} `
    expect(overBoundWithSpace.trim().length).toBe(MAX_DISSENT_STATEMENT)
    expect(overBoundWithSpace.length).toBeGreaterThan(MAX_DISSENT_STATEMENT)
    expect(isSendableStatement(overBoundWithSpace)).toBe(false)
  })
})

describe('findingDissent — the words never reach debug state', () => {
  it('⭐ DROPS `statement` and keeps a presence marker in its place', () => {
    const redacted = redactStatedReason({
      finding_id: 'strengthen:robustness',
      analysis_id: 'sha256:abc123',
      statement: 'my salary is 90000 and I disagree',
    })
    // Bound by identity to the exact secret, not to a shape another string
    // could satisfy.
    expect(redacted).not.toHaveProperty('statement')
    expect(JSON.stringify(redacted)).not.toContain('90000')
    expect(redacted).toEqual({
      finding_id: 'strengthen:robustness',
      analysis_id: 'sha256:abc123',
      statement_present: true,
    })
  })

  it('records ABSENCE as absence — an empty statement is not "present"', () => {
    expect(redactStatedReason({ statement: '' })).toEqual({ statement_present: false })
  })

  it('CONTROL: leaves a payload with no statement completely untouched', () => {
    // Without this, a redactor that returned `{}` for everything would satisfy
    // every assertion above.
    const other = { target_id: 'node-1', value: 42 }
    expect(redactStatedReason(other)).toBe(other)
    expect(redactStatedReason(undefined)).toBeUndefined()
  })

  /**
   * ⭐⭐ AND THE CALL SITE IS BOUND, NOT JUST THE FUNCTION.
   *
   * ⚠ EVERY TEST ABOVE PASSES ON A REDACTOR NOTHING CALLS. They assert what
   * `redactStatedReason` RETURNS; none of them can observe whether
   * `sendSystemEvent` still hands the raw payload to `recordCrossSurfaceEvent`.
   * A value assertion cannot prove a reference — it holds just as well against
   * a byte-identical copy sitting unused. Deleting the call at the seam would
   * leave all of them green while the PII flowed exactly as before.
   *
   * So this reads the SOURCE, which is the only instrument that can see the
   * wiring, and it is the pattern this repo already uses for seams a render
   * test cannot reach (`ribbonAndFooterShareOneAdmission.sourceScan.spec.ts`).
   */
  it('⭐ SOURCE GUARD: sendSystemEvent redacts before it records to debug state', async () => {
    const src = await readFile(
      resolve(process.cwd(), 'src/canvas/conversation/useConversation.ts'),
      'utf8',
    )
    const call = src.slice(
      src.indexOf('recordCrossSurfaceEvent({'),
      src.indexOf('recordCrossSurfaceEvent({') + 1600,
    )
    // The scan must be able to SEE the call at all — an empty slice would make
    // every assertion below pass by looking at nothing.
    expect(call, 'no recordCrossSurfaceEvent call found — the scan is blind').not.toBe('')
    expect(call).toContain('payloadSummary: redactStatedReason(event.payload)')
    // And the discriminating half: the raw form must be gone, not merely
    // accompanied by the redacted one.
    expect(call).not.toContain('payloadSummary: event.payload')
  })

  it('⭐ SOURCE GUARD: the send path logs nothing that could carry the words', async () => {
    // R-004's surviving half: the widening licenses persistence, never
    // "re-emitting the text into telemetry or logs". The dissent send's own
    // rejection handler carries the turn, and the turn carries the statement.
    const src = await readFile(
      resolve(process.cwd(), 'src/components/results/analysisNew/sections/StrengthenTheReasoning.tsx'),
      'utf8',
    )
    expect(src, 'the scan can see the file').toContain('buildFindingDissentEvent')
    // ⚠ COMMENTS ARE STRIPPED FIRST, and the reason is a live false positive:
    // the rejection handler's own comment says a `console.error(err)` there
    // WOULD be the leak, so a naive scan matches the prose warning against the
    // defect and REDs on a file that is clean. A probe that cannot tell code
    // from a comment about code is measuring the wrong text.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1')
    // Contrast controls: the probe must be able to answer BOTH ways, or a zero
    // here is blindness rather than absence.
    expect('console.warn(x)'.replace(/\/\*[\s\S]*?\*\//g, '')).toMatch(/console\.\w+\(/)
    expect(code, 'the strip left real code behind').toContain('buildFindingDissentEvent')
    expect(code).not.toMatch(/console\.\w+\(/)
  })
})
