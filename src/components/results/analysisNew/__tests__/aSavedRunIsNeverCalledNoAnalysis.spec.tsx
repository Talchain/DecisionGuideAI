/**
 * ⭐ A SAVED RUN IS NEVER CALLED "NO ANALYSIS" (Panel, DL #75 5922639119 cross-surface currentness sweep, 1 Oct 2026).
 *
 * Served `4a715223`, R3's funding train `2d5982b5`, the cold open of its `complete_stale` read (an approved edit,
 * not yet re-run — `train-2255Z/07-cold-after-consent.json`, replayed into the real served UI):
 *   CEE      `complete_stale`, cause `graph_changed` — Run 1 exists, the model changed since
 *   Run ctrl "Re-run analysis" (`selectRunOnRecord`)
 *   Chat     the restored run reply
 *   Reasoning "No analysis has run yet for this model."   ← false
 * The read ships no result block on a stale Run, so the panel is pre-run, and the pre-run status had one sentence.
 * The dock already knows a Run is on record (the Run control's own facts); Reasoning now reads the same facts.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { FOOTER_COPY } from '../../../../canvas/components/pre-analysis-v3/constants'
import { selectRunOnRecordWithoutResult, type RunOnRecordWithoutResult } from '../../../../canvas/stores/declinedSavedRunStore'
import { openStrategicChallenge } from './analysisNewFixtures'

afterEach(cleanup)
beforeEach(() => {
  useCanvasStore.setState({
    nodes: [
      { id: 'g1', type: 'goal', data: { label: 'Secure funding' } },
      { id: 'o1', type: 'option', data: { label: 'Continue Current Process' } },
      { id: 'o2', type: 'option', data: { label: 'Angel Outreach Pilot' } },
    ],
    goalThreshold: null,
  } as never)
  useStrengthenStore.setState({ records: {} })
})

const draw = (runOnRecordWithoutResult?: RunOnRecordWithoutResult) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={openStrategicChallenge()}
      isPreRun
      isRunning={false}
      isStale={false}
      blockedListing={null}
      {...(runOnRecordWithoutResult === undefined ? {} : { runOnRecordWithoutResult })}
    />,
  )
const status = () => screen.getByTestId('analysis-new-status-pre-run')

describe('the selector: one answer from the Run control\'s own facts', () => {
  it.each([
    ['a stale Run restored, no result held', { isPreRun: true, savedRunUnconfirmed: false, runStateKind: 'complete_stale' }, 'stale'],
    ['a saved Run the boot could not confirm', { isPreRun: true, savedRunUnconfirmed: true, runStateKind: null }, 'unconfirmed'],
    ['unconfirmed wins over a stale verdict', { isPreRun: true, savedRunUnconfirmed: true, runStateKind: 'complete_stale' }, 'unconfirmed'],
    ['CONTRAST: no Run on record', { isPreRun: true, savedRunUnconfirmed: false, runStateKind: null }, null],
    ['CONTRAST: never_run', { isPreRun: true, savedRunUnconfirmed: false, runStateKind: 'never_run' }, null],
    ['CONTRAST: a result IS held (not pre-run)', { isPreRun: false, savedRunUnconfirmed: true, runStateKind: 'complete_stale' }, null],
  ] as const)('%s', (_name, input, expected) => {
    expect(selectRunOnRecordWithoutResult(input)).toBe(expected)
  })
})

describe('⭐ Reasoning\'s pre-run status says a Run exists when one does', () => {
  it('⭐ served stale cold open: the saved Run is named, never "No analysis has run yet"', () => {
    draw('stale')
    expect(status()).toHaveTextContent(COPY.status.savedRunStale)
    expect(status()).toHaveTextContent("A saved Run exists, but the model has changed since it ran, so it isn't shown.")
    expect(status()).not.toHaveTextContent('No analysis has run yet')
  })

  it('⭐ a saved Run the boot could not confirm: the Run control\'s own sentence, verbatim', () => {
    draw('unconfirmed')
    expect(status()).toHaveTextContent(FOOTER_COPY.savedRunUnconfirmedSub)
    expect(status()).not.toHaveTextContent('No analysis has run yet')
  })

  it('CONTROL: no Run on record (and the prop absent, as every other mount passes it) keeps "No analysis has run yet"', () => {
    draw()
    expect(status()).toHaveTextContent('No analysis has run yet for this model.')
    cleanup()
    draw(null)
    expect(status()).toHaveTextContent(COPY.status.preRun)
  })
})
