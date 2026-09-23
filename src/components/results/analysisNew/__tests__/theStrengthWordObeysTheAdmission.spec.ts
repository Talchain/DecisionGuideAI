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
import { buildStrengthenInputsForAnalysisNew } from '../buildStrengthenInputsForAnalysisNew'
import { buildRecommendations } from '../../strengthen/buildRecommendations'

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
    // ⛔ AND ONE CLICK AWAY. "How this was worked out" opens "What we checked";
    // its robustness row must not say the word the refusal forbids either.
    expect(vm.checks.items.find((i) => i.id === 'robustness')?.code).toBe('robustness_not_established')
  })
})

/**
 * ⛔⛔ THE SIBLING SURFACES — found by an adversarial pre-review of this very PR.
 * Gating the glance alone left two more strength statements on the same tab:
 * the "What we checked" robustness row ("Robust" with a pass tick, or
 * "Sensitive to assumptions"), and Strengthen's commit row ("these numbers held
 * up under stress-testing … result stable"). The Analysis tab already gates its
 * twin row (`TriageActionCardsBody`: "Robustness not established").
 */
const checksRowUnder = (mode: PermittedAnalysisMode | 'absent', robustnessVerdict: Verdict) =>
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
  ).checks.items.find((i) => i.id === 'robustness')

const commitRowUnder = (mode: PermittedAnalysisMode | 'absent') =>
  buildRecommendations(
    buildStrengthenInputsForAnalysisNew({
      data: makeData({
        recommendation:
          mode === 'absent' ? {} : { analysisAdmission: { permitted_analysis_mode: mode, reasons: [] } },
        confidence: { robustnessStatus: 'computed', robustnessLevel: 'high' } as never,
      }),
      guidanceItems: [],
      biasSignals: null,
      currentStage: null,
    }),
  ).find((r) => r.id === 'strengthen:commit')

describe('the sibling surfaces obey the same admission', () => {
  it.each(['quantified_provisional', 'none'] as const)(
    '"What we checked" states no strength word under `%s`, and says robustness is not established',
    (mode) => {
      for (const v of EVERY_WORD) {
        const row = checksRowUnder(mode, v)
        expect(row?.code, `${mode} + ${v}`).toBe('robustness_not_established')
        expect(row?.state, `${mode} + ${v}`).toBe('not_assessed')
      }
    },
  )

  it('"What we checked" keeps the producer’s word where the admission licenses it', () => {
    expect(checksRowUnder('comparative_leader', 'robust')?.code).toBe('robustness_robust')
    expect(checksRowUnder('comparative_leader', 'fragile')?.code).toBe('robustness_sensitive')
    expect(checksRowUnder('absent', 'robust')?.code).toBe('robustness_robust')
  })

  it.each(['quantified_provisional', 'none'] as const)(
    'Strengthen does not tell the user the numbers "held up under stress-testing" under `%s`',
    (mode) => {
      expect(commitRowUnder(mode)).toBeUndefined()
    },
  )

  it('Strengthen still offers the commit row where the admission licenses it (and for an older producer)', () => {
    expect(commitRowUnder('comparative_leader')).toBeDefined()
    expect(commitRowUnder('absent')).toBeDefined()
  })
})
