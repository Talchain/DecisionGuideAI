/**
 * The Analysis tab's halves of the cut-3 withhold bar (DL e8, #87 6002009604): the results hook's reason line (the hero
 * and the cards' reason) and the tab's own check row (`buildAnalysisNewViewModel` → `checks.leaderWithholdCause`, what
 * `AnalysisNewTabBody` renders). Each new code reads Science d5's words; `goal_path_unsized` names its link from the
 * Run's typed `GOAL_FIGURES_PLACEHOLDER_PATH` warning and the canvas labels; an unknown code keeps today's behaviour.
 * Paul's served Run (4276f3f9), through the product mapper and the real hook.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { buildAnalysisNewViewModel } from '../analysisNew/buildAnalysisNewViewModel'
import { WITHHELD_REASON_FALLBACK } from '../../../canvas/state/winShareGate'
import { useCanvasStore } from '../../../canvas/store'
import { fx, resetPaulRun, seedPaulRun } from './helpers/paulRun4276f3f9'

const FROM = 'investment_firm_outreach'
const TO = 'investment_firm_meetings'
const UNSIZED_WARNING = { code: 'GOAL_FIGURES_PLACEHOLDER_PATH', severity: 'warning', node_ids: [FROM, TO], option_ids: ['angel_bridge'], message: 'Not shown.' }
/** MC P0's carrier with its full `links` list (two unsized deciding links, nearest the goal first). */
const TWO_LINK_WARNING = { ...UNSIZED_WARNING, links: [{ from: FROM, to: TO }, { from: 'angel_investor_outreach', to: 'angel_investor_meetings' }] }

const WORDS = {
  goal_path_unsized: 'This comparison turns on the link from ‘Investment firm outreach’ to ‘Investment firm meetings’, whose strength nobody has set yet. Set it to see how much it matters.',
  goal_path_unsized_two: 'This comparison turns on the links from ‘Investment firm outreach’ to ‘Investment firm meetings’ and from ‘Angel investor outreach’ to ‘Angel investor meetings’, whose strengths nobody has set yet. Set them to see how much they matter.',
  intake_identity_unverified: 'This comparison depends on which of the model’s options are the ones your brief lists, and that hasn’t been confirmed yet.',
  intake_options_missing: 'Your brief lists at least one option that isn’t in the model yet, so this comparison leaves it out. Check the model’s options against your brief.',
  goal_product_not_read: 'This comparison depends on how the parts of ‘securing funding’ combine, which Olumi hasn’t been able to read yet.',
  options_identical: 'In this model, your options change the same things by the same amounts, so their results come out the same. Change what one of them does to see how they compare.',
} as const

const UNNAMED = 'This comparison turns on a link whose strength nobody has set yet.'
const nodeLabels = new Map((fx as { draft: { nodes: Array<{ id: string; label: string }> } }).draft.nodes.map(n => [n.id, n.label] as const))

function seed(cause: string, warnings: unknown[]): void {
  seedPaulRun({ permitted: false, withheld_reason: 'leader_claim_withheld', producer_cause: cause })
  const results = useCanvasStore.getState().results as unknown as { report: Record<string, unknown> }
  const base = Array.isArray(results.report.inference_warnings) ? results.report.inference_warnings : []
  useCanvasStore.setState({ results: { ...results, report: { ...results.report, inference_warnings: [...base, ...warnings] } } } as never)
}
const data = () => renderHook(() => useResultsSectionData()).result.current

afterEach(() => { cleanup(); resetPaulRun() })

describe.each([
  ['⭐ goal_path_unsized', 'goal_path_unsized', [UNSIZED_WARNING], WORDS.goal_path_unsized],
  // The tab's check row reads the hook's ADAPTED warnings: the adapter must carry `links`, or it names the first only.
  ['⭐ goal_path_unsized, two links (MC links list)', 'goal_path_unsized', [TWO_LINK_WARNING], WORDS.goal_path_unsized_two],
  ['⭐ intake_identity_unverified', 'intake_identity_unverified', [], WORDS.intake_identity_unverified],
  ['⭐ intake_options_missing', 'intake_options_missing', [], WORDS.intake_options_missing],
  ['⭐ goal_product_not_read (RT-10 R6)', 'goal_product_not_read', [], WORDS.goal_product_not_read],
  ['⭐ options_identical (RT-10 R6)', 'options_identical', [], WORDS.options_identical],
] as const)('%s', (_name, cause, warnings, words) => {
  it('the results hook\'s reason line (hero, cards)', () => {
    seed(cause, [...warnings])
    expect(data().winShareWithheldReason).toBe(words)
  })
  it('the Analysis tab\'s own check row', () => {
    seed(cause, [...warnings])
    const vm = buildAnalysisNewViewModel({
      data: data(), recommendations: [], isPreRun: false, isRunning: false, isStale: false,
      producerLeaderWithholdReason: cause, nodeLabels, analysisNodes: useCanvasStore.getState().nodes,
    })
    expect(vm.checks.leaderWithheld).toBe(true) // PRECONDITION: the tab shows a withheld leader on this Run
    expect(vm.checks.leaderWithholdCause).toBe(words)
  })
})

describe('CONTROLS — nothing guessed, nothing else changed', () => {
  it('goal_path_unsized without the warning: the hook and the tab say its unnamed line, never a guessed link', () => {
    seed('goal_path_unsized', [])
    expect(data().winShareWithheldReason).toBe(UNNAMED)
    const vm = buildAnalysisNewViewModel({
      data: data(), recommendations: [], isPreRun: false, isRunning: false, isStale: false,
      producerLeaderWithholdReason: 'goal_path_unsized', nodeLabels,
    })
    expect(vm.checks.leaderWithholdCause).toBe(UNNAMED)
  })
  it('an unknown code: the hook keeps the fallback, the tab names no cause (unchanged)', () => {
    seed('a_cause_nobody_mapped', [])
    expect(data().winShareWithheldReason).toBe(WITHHELD_REASON_FALLBACK)
    const vm = buildAnalysisNewViewModel({
      data: data(), recommendations: [], isPreRun: false, isRunning: false, isStale: false,
      producerLeaderWithholdReason: 'a_cause_nobody_mapped', nodeLabels,
    })
    expect(vm.checks.leaderWithholdCause).toBeNull()
  })
})
