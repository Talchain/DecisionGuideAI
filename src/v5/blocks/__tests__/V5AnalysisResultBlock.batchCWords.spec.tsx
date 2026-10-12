/**
 * Recovery Batch C, #2747 Codex round 1 (B4): the persisted chat card says THIS Run's own stored Batch C words, never
 * the generic "chance of meeting your goal". Hiring's chance covers productivity only, so its notes (what it leaves out)
 * are said; marketing's withheld joint still says why, its bound and each target. The licence records are C CEE's
 * (`batchCGoalChance.ts`), read from the block, never the store.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { V5AnalysisResultBlock } from '../V5AnalysisResultBlock'
import { useCanvasStore } from '../../../canvas/store'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../../canvas/conversation/types'
import {
  HIRING_NOTES, HIRING_STATUS_QUO_LINE, HIRING_TECH_LEAD_FACE, HIRING_TWO_DEVS_FACE, MARKETING_CONVERSION_TARGET_LINE,
  MARKETING_FRECHET_LINE, MARKETING_JOINT_WITHHELD_LINE, MARKETING_NEW_CUSTOMERS_TARGET_LINE, MARKETING_NOTES,
  hiringJourney, marketingJourney,
} from '../../../components/results/__tests__/helpers/batchCGoalChance'

const initialState = useCanvasStore.getState()
function mount(journey: ReturnType<typeof hiringJourney>) {
  useCanvasStore.setState({ nodes: journey.nodes, results: null, ceeAnalysisReady: null } as never)
  const block = { type: 'v5_analysis_result', summary: 'The analysis completed.', leading_option_id: null,
    win_probabilities: {}, enrichment: (journey.block as { enrichment: unknown }).enrichment } as V5AnalysisResultBlockType
  render(<V5AnalysisResultBlock block={block} />)
}
const items = (testId: string) => [...(screen.queryByTestId(testId)?.querySelectorAll('li') ?? [])].map(li => li.textContent)

afterEach(() => { cleanup(); useCanvasStore.setState(initialState, true) })

describe('#2747 r1 B4: the chat card says the Run\'s own Batch C words', () => {
  it('hiring: each option in the chance words, the status quo by assumption, then the notes; never "your goal"', () => {
    mount(hiringJourney())
    expect(items('v5-analysis-result-goal-chances')).toEqual([HIRING_TECH_LEAD_FACE, HIRING_TWO_DEVS_FACE, HIRING_STATUS_QUO_LINE])
    expect(items('v5-analysis-result-goal-chance-detail')).toEqual(HIRING_NOTES)
    expect(document.body.textContent).not.toMatch(/chance of meeting your goal/)
  })

  it('marketing (joint withheld): no option is quoted; the withheld line, the bound, each target and the note are said', () => {
    mount(marketingJourney('withheld'))
    expect(screen.queryByTestId('v5-analysis-result-goal-chances')).toBeNull()
    expect(items('v5-analysis-result-goal-chance-detail')).toEqual([MARKETING_JOINT_WITHHELD_LINE, MARKETING_FRECHET_LINE,
      MARKETING_NEW_CUSTOMERS_TARGET_LINE, MARKETING_CONVERSION_TARGET_LINE, MARKETING_NOTES[0]])
  })

  it('CONTROL: a pre-C licence record (no Batch C parts) is said exactly as before', () => {
    const j = hiringJourney()
    const warnings = (j.block.enrichment as { inference_warnings: Record<string, unknown>[] }).inference_warnings
    const { chance_words: _w, notes: _n, status_quo: _s, ...preC } = warnings[0]
    warnings[0] = { ...preC, target: { comparator: 'at_least', value: 10, unit: '%' } }
    mount(j)
    expect(items('v5-analysis-result-goal-chances')[1]).toBe('‘Hire two developers’: about 31% chance of meeting your goal, in this model.')
    expect(screen.queryByTestId('v5-analysis-result-goal-chance-detail')).toBeNull()
  })
})
