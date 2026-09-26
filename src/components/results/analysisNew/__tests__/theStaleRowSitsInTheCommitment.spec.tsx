/**
 * ⭐ V2 `commitHTML()` `.stale` — THE STALE ROW SITS IN "MOVE TOWARDS COMMITMENT".
 *
 * Design audit (25 Sep, §A): "Stale row 'Last run · model changed · Re-run' —
 * absent ✗". The prototype runs synthesis → stale row → chart → qualifier, and
 * on a stale run bullet 1 reads "Last run" and the qualifier says the
 * comparison is old before anything else. Live put the status in an amber box
 * ABOVE the block and left the bullets and the qualifier unchanged.
 *
 * Bound by identity (testids, the ribbon's own `data-ribbon-shape`, the icon's
 * `data-icon`), with a fresh twin and an `unconfirmed` twin as contrasts: a
 * run we only cannot confirm is NOT called an old comparison.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { CommitmentSummary } from '../sections/CommitmentSummary'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { buildCommitmentQualifier } from '../commitmentQualifier'
import type { CommitmentSynthesis } from '../commitmentSynthesis'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { COMMITMENT_QUALIFIER_COPY } from '../commitmentQualifier'
import { COMMITMENT_COPY } from '../commitmentSynthesis'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { genuineDecision } from './analysisNewFixtures'

const C = 'analysis-new-commitment'
const precedes = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

const renderBody = (staleReason: 'changed' | 'unknown' | null) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={genuineDecision()}
      isPreRun={false}
      isRunning={false}
      isStale={staleReason !== null}
      staleReason={staleReason}
      responseHash="stale-row"
    />,
  )

beforeEach(() => useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never))
afterEach(cleanup)

describe('the stale row sits in "Move towards commitment" (V2 .stale)', () => {
  it('⭐ a CHANGED run: the status is a plain row INSIDE the block — after the synthesis, before the chart — with a clock', () => {
    renderBody('changed')
    const block = screen.getByTestId(C)
    const stale = screen.getByTestId('analysis-new-status-stale')
    expect(stale).toHaveTextContent(COPY.status.stale)
    expect(within(block).getByTestId(`${C}-status`)).toContainElement(stale)
    expect(precedes(screen.getByTestId(`${C}-synthesis`), stale), 'after the synthesis').toBe(true)
    expect(precedes(stale, screen.getByTestId('analysis-new-options')), 'before the chart').toBe(true)
    const ribbon = screen.getByTestId('analysis-new-glance-ribbon')
    expect(ribbon).toHaveAttribute('data-ribbon-shape', 'row')
    expect(ribbon.querySelector('[data-icon="clock"]'), 'a clock, as the prototype').not.toBeNull()
    expect(screen.getAllByTestId('analysis-new-status-stale'), 'said once').toHaveLength(1)
  })

  it('⭐ bullet 1 reads "Last run" when the synthesis describes the last run; "What we have" otherwise', () => {
    const synthesis = (describesLastRun: boolean): CommitmentSynthesis => ({
      describesLastRun,
      staleKind: describesLastRun ? 'changed' : null,
      founded: { text: 'Three options compared.', source: 'withheld_count' },
      open: null,
      before: null,
    } as unknown as CommitmentSynthesis)
    render(<CommitmentSummary synthesis={synthesis(true)} isPreRun={false} canCapture={false} record={null} onRecord={vi.fn()} onAsk={vi.fn()} />)
    expect(screen.getByTestId(`${C}-founded`).textContent).toBe(`${COMMITMENT_COPY.labels.lastRun}: Three options compared.`)
    cleanup()
    render(<CommitmentSummary synthesis={synthesis(false)} isPreRun={false} canCapture={false} record={null} onRecord={vi.fn()} onAsk={vi.fn()} />)
    expect(screen.getByTestId(`${C}-founded`).textContent).toBe(`${COMMITMENT_COPY.labels.founded}: Three options compared.`)
  })

  const vmFor = (isStale: boolean, staleReason: 'changed' | 'unconfirmed' | null) =>
    buildAnalysisNewViewModel({ data: genuineDecision(), recommendations: [], isPreRun: false, isRunning: false, isStale, staleReason })

  it('⭐ a CHANGED run: the qualifier says the comparison is OLD; the provisional line moves behind Details, not away', () => {
    const fresh = buildCommitmentQualifier(vmFor(false, null))
    const stale = buildCommitmentQualifier(vmFor(true, 'changed'))
    // ⚠ The LITERAL, and non-null first: on a run whose fresh qualifier is null,
    // `stale?.text` against an absent copy key is `undefined === undefined`.
    expect(stale, 'a changed run always says its comparison is old').not.toBeNull()
    expect(stale!.text).toBe('Old comparison · the model has changed since it ran')
    // PRECONDITION + no loss: whatever the fresh line said is still one click away.
    if (fresh) expect(stale?.detail ?? '').toContain(fresh.text)
  })

  it('CONTRAST: a run we only CANNOT CONFIRM is not called an old comparison', () => {
    const q = buildCommitmentQualifier(vmFor(true, 'unconfirmed'))
    expect(q?.text ?? '').not.toContain(COMMITMENT_QUALIFIER_COPY.oldComparison)
  })

  it('CONTRAST: a FRESH run has no status row and no "Old comparison"', () => {
    renderBody(null)
    expect(screen.queryByTestId('analysis-new-glance-ribbon')).toBeNull()
    expect(buildCommitmentQualifier(vmFor(false, null))?.text ?? '').not.toContain(COMMITMENT_QUALIFIER_COPY.oldComparison)
  })
})
