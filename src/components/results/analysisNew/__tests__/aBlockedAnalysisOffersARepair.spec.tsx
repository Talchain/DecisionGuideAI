/**
 * ⭐ A BLOCKED ANALYSIS OFFERS A REPAIR, NOT ONLY A DIAGNOSIS (Paul's brief:
 * "blocked analysis with a repair action"; state map 24 Sep: "names the blocker
 * via WhyNoAnalysisYet but offers only focus, no repair action").
 *
 * Each blocker gets ONE act: an Olumi ask that DRAFTS "help me fix this" in the
 * composer, quoting the gate's sentence verbatim and bound to the blocker's node
 * when the gate named one. It sends nothing and writes nothing; the reader sends
 * it, and any change Olumi proposes is theirs to approve.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { WhyNoAnalysisYet } from '../sections/WhyNoAnalysisYet'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { openAskOlumi } from '../../coaching/askOlumiStore'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { GateBlockedListing } from '../../../../canvas/utils/canRunAnalysis'
import { openStrategicChallenge } from './analysisNewFixtures'

const SCOPED = 'Status Quo: Hold Current Strategy has no effect values yet.'
const UNSCOPED = 'Two options still need values before this can run.'
const listing: GateBlockedListing = {
  summary: `${SCOPED} ${UNSCOPED}`,
  sentences: [
    { text: SCOPED, scope: { id: 'opt_status_quo', label: 'Status Quo: Hold Current Strategy' } },
    { text: UNSCOPED },
  ],
}

beforeEach(() => {
  vi.mocked(openAskOlumi).mockReset()
  useStrengthenStore.setState({ records: {} } as never)
})
afterEach(cleanup)

describe('each blocker carries a repair ask', () => {
  it('drafts "help me fix this" with the sentence verbatim, bound to the named node', () => {
    const onAsk = vi.fn()
    render(<WhyNoAnalysisYet listing={listing} onFocusTarget={vi.fn()} onAsk={onAsk} />)
    const items = screen.getAllByTestId('analysis-new-why-no-analysis-item')
    expect(items).toHaveLength(2)
    fireEvent.click(within(items[0]).getByTestId('analysis-new-why-no-analysis-ask'))
    expect(onAsk).toHaveBeenCalledWith({
      context: SCOPED,
      draft: COPY.whyNoAnalysis.askFixDraft(SCOPED),
      label: COPY.whyNoAnalysis.askFix,
      targetId: 'opt_status_quo',
    })
  })

  it('an unscoped blocker gets the ask with no invented target', () => {
    const onAsk = vi.fn()
    render(<WhyNoAnalysisYet listing={listing} onFocusTarget={vi.fn()} onAsk={onAsk} />)
    const items = screen.getAllByTestId('analysis-new-why-no-analysis-item')
    fireEvent.click(within(items[1]).getByTestId('analysis-new-why-no-analysis-ask'))
    expect(onAsk.mock.calls[0][0]).not.toHaveProperty('targetId')
    expect(onAsk.mock.calls[0][0].draft).toContain(UNSCOPED)
  })

  it('CONTRAST: no handler, no act (never a dead one); focus still routes', () => {
    const onFocus = vi.fn()
    render(<WhyNoAnalysisYet listing={listing} onFocusTarget={onFocus} />)
    expect(screen.queryByTestId('analysis-new-why-no-analysis-ask')).toBeNull()
    fireEvent.click(screen.getByTestId('analysis-new-why-no-analysis-route'))
    expect(onFocus).toHaveBeenCalledWith('opt_status_quo')
  })

  it('on the Reasoning tab, the pre-run blocker list offers the ask and it opens the composer', () => {
    render(
      <AnalysisNewTabBody
        resultsSectionData={openStrategicChallenge()}
        isPreRun={true}
        isRunning={false}
        isStale={false}
        responseHash="blocked"
        blockedListing={listing}
      />,
    )
    const box = screen.getByTestId('analysis-new-why-no-analysis')
    const asks = within(box).getAllByTestId('analysis-new-why-no-analysis-ask')
    expect(asks).toHaveLength(2)
    fireEvent.click(asks[0])
    expect(openAskOlumi).toHaveBeenCalledTimes(1)
    expect(vi.mocked(openAskOlumi).mock.calls[0][0].targetId).toBe('opt_status_quo')
  })
})
