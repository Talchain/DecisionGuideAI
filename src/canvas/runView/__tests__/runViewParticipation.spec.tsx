/**
 * RunView PR 1b (DL 8 Oct; probe 08-debug-94160333): an unadopted Olumi suggestion the Run left out is carried by the
 * Run's one view, and the results card offers "Include it", drafting the turn CEE's own adoption door reads.
 * DATA: the captured served turn (CEE 2334956288d3a87eaece7a5ab3d948b20a5f9dfb), mapped by the product's own mapper.
 */
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { runViewOf } from '../runView'
import { readOptionParticipation } from '../../state/storedOptionParticipation'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'

const openAskOlumi = vi.fn()
vi.mock('../../../components/results/coaching/askOlumiStore', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  openAskOlumi: (arg: unknown) => openAskOlumi(arg),
}))
const { NotAnalysedOptionCard } = await import('../../../components/results/NotAnalysedOptionCard')
const { INCLUDE_OLUMI_OPTION_LABEL, includeOlumiOptionPrompt } = await import('../../../components/results/utils/notAnalysedCopy')

const fx = JSON.parse(readFileSync(resolve(process.cwd(), 'src/canvas/runView/__tests__/fixtures/probe-94160333.json'), 'utf8')) as {
  analysis_block: unknown; option_participation: unknown; analysis_ready_options: Array<{ option_id: string; label: string }>
}
const SUGGESTION = 'raise_pro_price_to_54'
const LABEL = fx.analysis_ready_options.find((o) => o.option_id === SUGGESTION)!.label

afterEach(() => { cleanup(); openAskOlumi.mockReset() })

describe('RunView PR 1b: an Olumi suggestion the Run left out', () => {
  it('captured 94160333: the Run\'s one view carries excluded_olumi_proposed for the £54 suggestion; a compared option has none', () => {
    const report = mapV5AnalysisToReport(fx.analysis_block as never, { optionParticipation: readOptionParticipation(fx.option_participation) } as never)
    const view = runViewOf(report)
    expect(view.participationOf(SUGGESTION)?.state).toBe('excluded_olumi_proposed')
    expect(view.participationOf('raise_pro_price_to_59')).toBeNull()
  })

  it('the results card says Olumi suggested it and offers "Include it", drafting the turn that names it by its EXACT label', () => {
    render(<NotAnalysedOptionCard option={{ id: SUGGESTION, label: LABEL, notAnalysed: true, notAnalysedReason: 'excluded_olumi_proposed' } as never} />)
    expect(screen.getByTestId(`not-analysed-reason-${SUGGESTION}`).textContent).toContain('Olumi suggested this option')
    fireEvent.click(screen.getByTestId(`not-analysed-resolve-${SUGGESTION}`))
    expect(screen.getByTestId(`not-analysed-resolve-${SUGGESTION}`).textContent).toBe(INCLUDE_OLUMI_OPTION_LABEL)
    expect(openAskOlumi).toHaveBeenCalledTimes(1)
    const draft = (openAskOlumi.mock.calls[0]![0] as { draft: string }).draft
    // CEE's adoption door (`proposeNewOption`) needs the suggestion named by its exact label in the user's words.
    expect(draft).toBe(includeOlumiOptionPrompt(LABEL))
    expect(draft).toContain(`"${LABEL}"`)
  })

  it('CONTROL: an option with no values keeps its own press ("Tell Olumi what it changes"), not "Include it"', () => {
    render(<NotAnalysedOptionCard option={{ id: 'x', label: 'X', notAnalysed: true, notAnalysedReason: 'no_interventions' } as never} />)
    expect(screen.getByTestId('not-analysed-resolve-x').textContent).toBe('Tell Olumi what it changes')
  })
})
