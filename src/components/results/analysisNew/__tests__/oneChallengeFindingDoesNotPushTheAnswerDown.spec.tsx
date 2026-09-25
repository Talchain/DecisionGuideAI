/**
 * ⭐ ONE "WHAT WOULD CHANGE YOUR MIND" FINDING DOES NOT PUSH THE ANSWER DOWN.
 *
 * Measured 25 Sep 2026 03:00Z on a local build of #1978 + bundle 3 against CEE
 * staging, OpenAI, Paul's pricing brief. The run was explicit, the leader
 * permitted, with ONE fragile edge.
 * - "What would change your mind" sits in the challenge zone, above the answer,
 *   by ruling (#1946, 5818389086). The zone's own note says it lives there
 *   "closed".
 * - Its single finding opened it anyway (`sectionOpensItself`: one finding
 *   opens), taking 323px at 1440 and 387px at the 290 dock.
 * - At 1440 "Move towards commitment" landed at 814 against the 829 fold, and
 *   the chart at 935, below it.
 * - This is the state a user reaches after "change a value → re-run".
 *
 * So above the answer the one finding stays behind the row, whose count badge
 * advertises it. The rule for every other caller is unchanged.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { AnalysisNewSection } from '../sections/AnalysisNewSection'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { manyFragileEdges, withLeaderLicensed } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const SENSITIVITY = 'analysis-new-sensitivity'

/** The permitted run with exactly ONE fragile edge (the first of the captured three). */
function permittedWithOneFragileEdge(): ResultsSectionDataReturn {
  const data = withLeaderLicensed(manyFragileEdges())
  const conf = data.confidence as { uncertainties?: unknown[] }
  return { ...data, confidence: { ...data.confidence, uncertainties: (conf.uncertainties ?? []).slice(0, 1) } } as ResultsSectionDataReturn
}

const renderBody = (data: ResultsSectionDataReturn) =>
  render(<AnalysisNewTabBody resultsSectionData={data} isPreRun={false} isRunning={false} isStale={false} responseHash="one-edge" />)

const precedes = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

beforeEach(() => useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never))
afterEach(cleanup)

describe('one challenge finding above the answer stays behind its row', () => {
  it('⭐ the section mounts above the answer, closed, and its row says there is one', () => {
    renderBody(permittedWithOneFragileEdge())
    const section = screen.getByTestId(SENSITIVITY)
    expect(precedes(section, screen.getByTestId('analysis-new-commitment')), 'PRECONDITION: above the answer').toBe(true)
    expect(section).toHaveAttribute('data-section-open', 'false')
    expect(within(section).getByText('1'), 'the count badge advertises the finding').toBeInTheDocument()
  })

  it('the finding is one press away, with its own sentence', () => {
    renderBody(permittedWithOneFragileEdge())
    fireEvent.click(screen.getByTestId(`${SENSITIVITY}-toggle`))
    const section = screen.getByTestId(SENSITIVITY)
    expect(section).toHaveAttribute('data-section-open', 'true')
    expect(section.textContent).toContain('Peak Season Throughput')
  })

  it('CONTROL: the rule for every other caller is unchanged (one finding still opens itself)', () => {
    const vm = buildAnalysisNewViewModel({
      data: permittedWithOneFragileEdge(), recommendations: [], isPreRun: false, isRunning: false, isStale: false, responseHash: 'one-edge',
    })
    expect(vm.sensitivity.findings, 'PRECONDITION: exactly one finding').toHaveLength(1)
    render(<AnalysisNewSection title="Elsewhere" findings={vm.sensitivity.findings} testId="elsewhere" />)
    expect(screen.getByTestId('elsewhere')).toHaveAttribute('data-section-open', 'true')
  })

  it('CONTROL: with no findings and only a header, the section still opens itself (no badge would advertise it)', () => {
    render(<AnalysisNewSection title="Header only" findings={[]} header={<p>The threshold the run found.</p>} testId="header-only" opensForOneFinding={false} />)
    expect(screen.getByTestId('header-only')).toHaveAttribute('data-section-open', 'true')
  })
})
