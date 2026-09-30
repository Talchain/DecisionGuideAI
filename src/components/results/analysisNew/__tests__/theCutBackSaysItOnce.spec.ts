/**
 * ⭐ CUT-BACK (Paul, 30 Sep 2026: "finish the reasoning tab"). The chart's "Goal only" line and its
 * "Olumi suggested all of these options" line now ride on the commitment's ONE Provisional qualifier:
 * "goal only" on the line, the full sentences and the producer's cause behind its ⓘ. Nothing is dropped.
 */
import { describe, expect, it } from 'vitest'
import { buildCommitmentQualifier, COMMITMENT_QUALIFIER_COPY } from '../commitmentQualifier'
import { allOptionsOriginSentence, OPTION_ORIGIN_ALL_COPY } from '../optionOriginDisclosure'

type Input = Parameters<typeof buildCommitmentQualifier>[0]

function vm(stale = false): Input {
  return {
    status: { isPreRun: false, isStale: stale, staleKind: stale ? 'changed' : null },
    atAGlance: { inputProvenance: 'user', verdict: null },
    checks: { items: [{ id: 'evidence', code: 'evidence_not_assessed' }] },
    deeper: { critiques: [], caveats: [] },
  } as unknown as Input
}

const CAUSE = "A limit on your model can't be checked reliably."
const ORIGIN = OPTION_ORIGIN_ALL_COPY.ai_suggested

describe('the Provisional line carries the facts the chart no longer prints', () => {
  it('goal only → on the line, read first; the sentence and the cause behind the ⓘ', () => {
    const q = buildCommitmentQualifier(vm(), { goalOnly: true, goalOnlyCause: CAUSE })!
    expect(q.text).toBe('Provisional · goal only · evidence and robustness not established')
    expect(q.detail).toBe(`${COMMITMENT_QUALIFIER_COPY.goalOnlyDetail}. ${CAUSE}`)
  })

  it('every option suggested by Olumi → the sentence behind the ⓘ, not on the line', () => {
    const q = buildCommitmentQualifier(vm(), { allOptionsOrigin: ORIGIN })!
    expect(q.text).toBe('Provisional · evidence and robustness not established')
    expect(q.detail).toBe(ORIGIN)
  })

  it('neither → exactly as before (no detail invented)', () => {
    const q = buildCommitmentQualifier(vm(), {})!
    expect(q.text).toBe('Provisional · evidence and robustness not established')
    expect(q.detail).toBeNull()
  })

  it('a changed model → "Old comparison", and the old line, goal only and the cause stay behind the ⓘ', () => {
    const q = buildCommitmentQualifier(vm(true), { goalOnly: true, goalOnlyCause: CAUSE, allOptionsOrigin: ORIGIN })!
    expect(q.text).toBe(COMMITMENT_QUALIFIER_COPY.oldComparison)
    expect(q.detail).toBe(
      `Provisional · goal only · evidence and robustness not established · ${COMMITMENT_QUALIFIER_COPY.goalOnlyDetail} · ${ORIGIN}. ${CAUSE}`,
    )
  })
})

describe('allOptionsOriginSentence', () => {
  it('two or more options, all Olumi-suggested → the sentence', () => {
    expect(allOptionsOriginSentence([{ origin: 'ai_suggested' }, { origin: 'ai_suggested' }])).toBe(ORIGIN)
  })
  it('a mix, one option, or none → null (the chart keeps its own legend for a mix)', () => {
    expect(allOptionsOriginSentence([{ origin: 'ai_suggested' }, { origin: null }])).toBeNull()
    expect(allOptionsOriginSentence([{ origin: 'ai_suggested' }])).toBeNull()
    expect(allOptionsOriginSentence([])).toBeNull()
  })
})
