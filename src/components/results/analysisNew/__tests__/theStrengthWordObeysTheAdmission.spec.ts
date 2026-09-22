/**
 * ⛔⛔ THE REASONING TAB CALLED A RESULT "STABLE" ON A MODEL WHOSE ADMISSION
 * FORBIDS EXACTLY THAT (#1206).
 *
 * Witnessed on served `db758d83`, *International Expansion Strategy*: the
 * producer's admission sentence — "…no option can be called the leader and no
 * result can be called stable or robust until you have set at least one of
 * them" — and the verdict chip **Stable**, in the same 669px screenful.
 *
 * The sentence is right and the chip is wrong. CEE's contract for
 * `permitted_analysis_mode` (`orchestrator/types.ts`): "MAKES IMPOSSIBLE: naming
 * a leader, or calling a result stable or robust, over a comparison NONE of
 * whose parameters the user has set." `analysisClaimPolicy().mayStateStability`
 * already answers that question and the Analysis tab obeys it; the Reasoning
 * tab's glance read the producer's robustness verdict and nothing else.
 *
 * The producer still decides WHICH word. The admission decides whether any
 * strength word may be stated — including the unflattering one.
 */
import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { decisionWithLeaderWithheldAndReason, makeData } from './analysisNewFixtures'
import type { PermittedAnalysisMode } from '../../../../adapters/cee/types'

type Verdict = 'robust' | 'moderate' | 'fragile'

const build = (data: ReturnType<typeof makeData>) =>
  buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })

const verdictUnder = (mode: PermittedAnalysisMode | 'absent', robustnessVerdict: Verdict) =>
  build(
    makeData({
      recommendation:
        mode === 'absent'
          ? { robustnessVerdict: robustnessVerdict as never }
          : {
              robustnessVerdict: robustnessVerdict as never,
              analysisAdmission: { permitted_analysis_mode: mode, reasons: [] },
            },
    }),
  ).atAGlance.verdict

const EVERY_WORD: readonly Verdict[] = ['robust', 'moderate', 'fragile']

describe('the glance states a strength word only where the admission licenses one', () => {
  it.each(['quantified_provisional', 'none'] as const)(
    'states NO strength word under `%s` — not the flattering one, not the unflattering one',
    (mode) => {
      for (const v of EVERY_WORD) expect(verdictUnder(mode, v), `${mode} + ${v}`).toBeNull()
    },
  )

  it('keeps the producer’s own word where the admission licenses a ranking', () => {
    expect(verdictUnder('comparative_leader', 'robust')?.label).toBe('Stable')
    expect(verdictUnder('comparative_leader', 'moderate')?.label).toBe('Mixed')
    expect(verdictUnder('comparative_leader', 'fragile')?.label).toBe('Sensitive')
  })

  it('treats an ABSENT admission as an older producer, never as a refusal', () => {
    expect(verdictUnder('absent', 'robust')?.label).toBe('Stable')
  })

  it('never renders the refusal and the word it forbids together — the witnessed screen', () => {
    const data = decisionWithLeaderWithheldAndReason()
    const vm = build({
      ...data,
      recommendation: { ...data.recommendation, robustnessVerdict: 'robust' as never },
    })
    // Precondition: the refusal is on screen, carrying the forbidding sentence.
    expect(vm.atAGlance.designationWithheldReason).toMatch(/stable or robust/)
    expect(vm.atAGlance.verdict).toBeNull()
  })
})
