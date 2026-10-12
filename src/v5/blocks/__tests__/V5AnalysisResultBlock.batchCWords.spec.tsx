/**
 * Recovery Batch C, #2747 Codex round 1 (B4): the persisted chat card says THIS Run's own Batch C words, never the generic
 * "chance of meeting your goal". Hiring's chance covers productivity only, so its notes (what it leaves out) are said;
 * marketing's withheld joint still says why, its bound and each target.
 *
 * #2747 RE-SCOPE (DL, after Codex round 2): every figure on the card passes the ONE chance authority gate, against the
 * scenario's canonical view matched to the card's own Run by its graph hash (`chatCardRunViewOf`). A card whose Run is not
 * known to be current, a card for another Run, a card stored without its hash, or no canonical view at all: no figure and
 * no Batch C line. The licence records and canonical views are C CEE's (`batchCGoalChance.ts`).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { V5AnalysisResultBlock } from '../V5AnalysisResultBlock'
import { useCanvasStore } from '../../../canvas/store'
import { useCanonicalAnalysisViewStore } from '../../../canvas/stores/canonicalAnalysisViewStore'
import { parseCanonicalAnalysisView } from '../../../canvas/runView/canonicalAnalysisView'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../../canvas/conversation/types'
import {
  HIRING_NOTES, HIRING_STATUS_QUO_LINE, HIRING_TECH_LEAD_FACE, HIRING_TWO_DEVS_FACE, MARKETING_CONVERSION_TARGET_LINE,
  MARKETING_FRECHET_LINE, MARKETING_JOINT_WITHHELD_LINE, MARKETING_NEW_CUSTOMERS_TARGET_LINE, MARKETING_NOTES,
  hiringJourney, marketingJourney,
} from '../../../components/results/__tests__/helpers/batchCGoalChance'

type Journey = ReturnType<typeof hiringJourney>
const initialState = useCanvasStore.getState()
function mount(journey: Journey, opts: { canonical?: Record<string, unknown> | null; hash?: string | null } = {}) {
  useCanvasStore.setState({ nodes: journey.nodes, results: null, ceeAnalysisReady: null, currentScenarioId: journey.scenarioId } as never)
  const canonical = opts.canonical === undefined ? journey.canonical : opts.canonical
  useCanonicalAnalysisViewStore.getState().adopt(journey.scenarioId, canonical === null ? null : parseCanonicalAnalysisView(canonical))
  const hash = opts.hash === undefined ? (journey.block as { computed_against_hash: string }).computed_against_hash : opts.hash
  const block = { type: 'v5_analysis_result', summary: 'The analysis completed.', leading_option_id: null,
    win_probabilities: {}, enrichment: (journey.block as { enrichment: unknown }).enrichment,
    ...(hash === null ? {} : { computed_against_hash: hash }) } as V5AnalysisResultBlockType
  render(<V5AnalysisResultBlock block={block} />)
}
const items = (testId: string) => [...(screen.queryByTestId(testId)?.querySelectorAll('li') ?? [])].map(li => li.textContent)
const licenceOf = (j: Journey) => (j.block.enrichment as { inference_warnings: Record<string, unknown>[] }).inference_warnings[0]

afterEach(() => {
  cleanup()
  useCanvasStore.setState(initialState, true)
  useCanonicalAnalysisViewStore.setState({ scenarioId: null, view: null })
})

describe('#2747 r1 B4: the chat card says the Run\'s own Batch C words', () => {
  it('hiring: each option in the chance words, the status quo by assumption, then the notes; never "your goal"', () => {
    mount(hiringJourney())
    expect(items('v5-analysis-result-goal-chances')).toEqual([HIRING_TECH_LEAD_FACE, HIRING_TWO_DEVS_FACE, HIRING_STATUS_QUO_LINE])
    expect(items('v5-analysis-result-goal-chance-detail')).toEqual(HIRING_NOTES)
    expect(document.body.textContent).not.toMatch(/chance of meeting your goal/)
  })

  it('provisional (C CEE amendment 7): starting values on every line, an option\'s own settings on its line only', () => {
    const j = hiringJourney()
    Object.assign(licenceOf(j), { olumi_estimate_value_count: 1, olumi_estimate_settings_by_option: { hire_two_developers: 2 } })
    mount(j)
    expect(items('v5-analysis-result-goal-chances').slice(0, 2)).toEqual([
      HIRING_TECH_LEAD_FACE.replace('in this model.', "in this model, using Olumi's estimates for 1 starting value (see Check estimates)."),
      HIRING_TWO_DEVS_FACE.replace('in this model.', "in this model, using Olumi's estimates for 1 starting value and 2 option settings (see Check estimates)."),
    ])
  })

  it('marketing (joint withheld): no option is quoted; the withheld line, the bound, each target and the note are said', () => {
    mount(marketingJourney('withheld'))
    expect(screen.queryByTestId('v5-analysis-result-goal-chances')).toBeNull()
    expect(items('v5-analysis-result-goal-chance-detail')).toEqual([MARKETING_JOINT_WITHHELD_LINE, MARKETING_FRECHET_LINE,
      MARKETING_NEW_CUSTOMERS_TARGET_LINE, MARKETING_CONVERSION_TARGET_LINE, MARKETING_NOTES[0]])
  })

  it('CONTROL: a pre-C Run (no Batch C parts on the licence or the canonical view) is said exactly as before', () => {
    const j = hiringJourney()
    const warnings = (j.block.enrichment as { inference_warnings: Record<string, unknown>[] }).inference_warnings
    const { chance_words: _w, notes: _n, status_quo: _s, ...preC } = warnings[0]
    warnings[0] = { ...preC, target: { comparator: 'at_least', value: 10, unit: '%' } }
    const { goal_chance: _g, ...canonicalPreC } = j.canonical
    mount(j, { canonical: canonicalPreC })
    expect(items('v5-analysis-result-goal-chances')[1]).toBe('‘Hire two developers’: about 31% chance of meeting your goal, in this model.')
    expect(screen.queryByTestId('v5-analysis-result-goal-chance-detail')).toBeNull()
  })
})

describe('#2747 re-scope: the chat card quotes a chance only through the authority gate', () => {
  const quotesNothing = () => {
    expect(screen.queryByTestId('v5-analysis-result-goal-chances')).toBeNull()
    expect(screen.queryByTestId('v5-analysis-result-goal-chance-detail')).toBeNull()
    expect(document.body.textContent).not.toMatch(/\b46%|\b31%/)
  }
  it('its Run is not known to be current (stale canonical view): no figure, no Batch C line', () => {
    const j = hiringJourney()
    mount(j, { canonical: { ...j.canonical, staleness: { ...(j.canonical.staleness as object), stale: true } } })
    quotesNothing()
  })
  it('a card for another Run (its graph hash is not the canonical Run\'s): no figure', () => {
    mount(hiringJourney(), { hash: 'graph-hash-an-older-run' })
    quotesNothing()
  })
  it('a card stored before its hash was kept: no figure', () => {
    mount(hiringJourney(), { hash: null })
    quotesNothing()
  })
  it('no canonical view for the scenario: no figure', () => {
    mount(hiringJourney(), { canonical: null })
    quotesNothing()
  })
})
