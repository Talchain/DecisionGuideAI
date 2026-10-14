/**
 * Paul's test (27 Sep, served e8ba18e6, bundle 17d1cd3a): the automatic first
 * pass carried `withheld_reason: unrequested_analysis_withheld` behind a
 * PERMITTING admission, so no cause was named and "Still open" read "Olumi
 * could not confirm which option is most likely", a failed check that never
 * happened. The first pass now says what it is, and "Before acting" names the
 * move that can change it. The Run offer is untouched (no cause is named).
 */
import { describe, it, expect } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { buildCommitmentSynthesis, COMMITMENT_COPY } from '../commitmentSynthesis'
import { decisionWithLeaderWithheld } from './analysisNewFixtures'

const FIRST_PASS = 'unrequested_analysis_withheld'

const vmFor = (reason: string, isStale = false) =>
  buildAnalysisNewViewModel({
    data: decisionWithLeaderWithheld() as never,
    producerLeaderWithholdReason: reason,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale,
    responseHash: 'first-pass',
  } as never)

describe('the automatic first pass says what it is', () => {
  it('PRECONDITION: withheld, no nameable cause, and a re-run is still offered', () => {
    const vm = vmFor(FIRST_PASS)
    expect(vm.checks.leaderWithheld).toBe(true)
    expect(vm.checks.leaderWithholdCause).toBeNull()
    expect(vm.checks.rerunWouldNotHelp).toBe(false)
    expect(vm.checks.firstPassWithheld).toBe(true)
  })

  it('⭐ Still open names the first pass, not a failed check', () => {
    const s = buildCommitmentSynthesis(vmFor(FIRST_PASS))
    expect(s.open?.source).toBe('first_pass')
    // 8 Oct 2026: short at rest; how to get a comparison is one click away.
    expect(s.open?.text).toBe(COMMITMENT_COPY.short.firstPass)
    expect(s.open?.detail).toBe(COMMITMENT_COPY.short.firstPassDetail)
    expect(s.open?.text).not.toMatch(/could not confirm/i)
  })

  it('⭐ Before acting names the move that can change it', () => {
    const s = buildCommitmentSynthesis(vmFor(FIRST_PASS))
    expect(s.before?.source).toBe('first_pass')
    expect(s.before?.text).toBe(COMMITMENT_COPY.firstPassBefore)
  })

  it('CONTRAST: another withheld token keeps its own sentences', () => {
    const vm = vmFor('separation_unavailable')
    expect(vm.checks.firstPassWithheld).toBe(false)
    const s = buildCommitmentSynthesis(vm)
    expect(s.open?.source).not.toBe('first_pass')
    expect(s.before?.source).not.toBe('first_pass')
  })

  it('CONTRAST: on a stale first pass the re-run advice wins bullet 3', () => {
    const s = buildCommitmentSynthesis(vmFor(FIRST_PASS, true))
    expect(s.before?.source).not.toBe('first_pass')
  })
})
