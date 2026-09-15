/**
 * ⭐⭐ ONE WORD, TWICE, ON ONE SCREEN — AND ON THE ROUTINE RUN THE GLANCE HAS
 * NOTHING ELSE TO SAY.
 *
 * ── THE WITNESS ────────────────────────────────────────────────────────────
 * Deployed build `bb27081a`, guest, restored example, completed run, dock at
 * 382px. Read off the live DOM, not inferred:
 *
 *     analysis-new-glance-verdict   → exactly ONE child: the pill, "Sensitive"
 *                                     (bg-warning/10 text-warning), no reason,
 *                                     no share sentence, no win bar
 *     analysis-new-trust-line       → "Sensitive · 3 checks ran ·
 *                                      1 open question · How this was worked out"
 *
 * Two hundred pixels apart, the same producer word, and the upper one carries
 * nothing the lower one does not — while spending the panel's first reading
 * slot and a unit of the rationed amber budget to do it.
 *
 * ── WHY THIS IS THE CODEBASE'S OWN RULE, NOT A NEW ONE ─────────────────────
 * `TrustLine` takes `.label` and `.tone`; its docblock says the reason
 * "belongs to `AtAGlance` and restating it puts one claim on the surface
 * twice", and a comment in its render records `firstViewportCensus` catching
 * exactly that when the reason once shipped here too. The split is deliberate:
 * the WORD is the trust line's, the SENTENCE is the glance's.
 *
 * The live run is the case where the glance's half is empty. `AtAGlance` then
 * renders the word anyway — the same duplication, arriving from the other
 * direction, and no guard could see it because each side is correct alone.
 *
 * ── THE STATE IS ROUTINE ───────────────────────────────────────────────────
 * `AtAGlance`'s own header already derives it: a run with a robustness verdict
 * but no entitled leader carries no headline, no share and no win bar, and
 * "lands here every time". This adds the observation that the producer's reason
 * clause can be absent too — so the reading block can hold nothing at all.
 *
 * ⭐ THE PAIR IS THE POINT. A guard asserting only "the pill is gone" would
 * pass just as happily on a build that deleted the verdict block outright,
 * which loses the share sentence, the reason and the win bar on every run that
 * has them. So the discrimination is EMPTY → suppressed AND CARRIES-A-READING
 * → still rendered, one field apart, on the same component.
 *
 * ⚠ BOUND BY TESTID. "Sensitive" is producer copy and can move; the identities
 * are `analysis-new-glance-verdict` and `analysis-new-trust-line-verdict`
 * (trap 19).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { decisionWithLeaderWithheld, genuineDecision } from './analysisNewFixtures'

const renderBody = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="glance_duplicate_word"
    />,
  )

/**
 * The live shape: the leader is withheld AND the producer sent no reason
 * clause, so the glance's reading block has nothing of its own left.
 */
const withheldAndNoReason = (): ResultsSectionDataReturn => {
  const data = decisionWithLeaderWithheld()
  return {
    ...data,
    recommendation: { ...data.recommendation, robustnessVerdictReason: undefined },
  }
}

/**
 * ⚠ THE CONTROL IS AN ENTITLED RUN, AND DERIVING WHY IS THE RESULT.
 *
 * Setting `robustnessVerdictReason` on a WITHHELD run does not put a reason on
 * screen: `buildAnalysisNewViewModel` gates it on
 * `mayExplainByRanking = !rankingWasWithheld(rec)` — a sentence explaining the
 * verdict by reference to a ranking is unlicensed once the ranking is withheld.
 * That rule is right and is untouched here.
 *
 * ⭐ ITS CONSEQUENCE IS THE FINDING. On a withheld run the reason is suppressed
 * by that rule, and the share and the win bar are suppressed by the leader
 * gate — so the reading block can hold NOTHING BUT THE PILL, always. The empty
 * glance is not an edge case: it is the derived state of the whole class.
 *
 * So the control must be a run that was never withheld.
 */
const REASON = 'The ordering changed in a substantial share of the simulated range.'
const entitledWithReason = (): ResultsSectionDataReturn => {
  const data = genuineDecision()
  return {
    ...data,
    recommendation: { ...data.recommendation, robustnessVerdictReason: REASON },
  }
}

afterEach(cleanup)

describe('the glance does not repeat the trust line’s word', () => {
  it('EMPTY — with no reading of its own, the glance drops the verdict and the trust line keeps it', () => {
    renderBody(withheldAndNoReason())

    const trust = screen.getByTestId('analysis-new-trust-line-verdict')
    expect(trust.textContent?.trim(), 'the trust line still carries the producer word').toBeTruthy()

    expect(
      screen.queryByTestId('analysis-new-glance-verdict'),
      'witnessed on bb27081a: this block held ONE child, a pill repeating the word the trust line prints 200px below',
    ).toBeNull()
  })

  it('CARRIES A READING — on an entitled run the glance keeps its verdict block and its reason', () => {
    renderBody(entitledWithReason())

    const glance = screen.getByTestId('analysis-new-glance-verdict')
    expect(
      glance.textContent,
      'the reason is the glance’s half of the split and must not go with the duplicate',
    ).toContain(REASON)
  })
})
