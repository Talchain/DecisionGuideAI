/**
 * ⭐ A WITHHELD GOAL FIGURE IS NOT A LOST ONE (Panel, Track 1 truth fix, 1 Oct 2026).
 *
 * Served UI `0406f10c`, CEE `ff5453bd`, R3's acceptance draft of Paul's funding brief (guest `dafdc620`, cold reload of
 * a `complete_current` Run). The producer withheld every option's goal figures with its typed
 * `GOAL_PROBABILITY_IDENTITY_NOT_EVALUATED` ("Not shown. 'Investment-firm funding secured' depends on … so the figures
 * for each option would be wrong."): both compared options are `computed`, and their outcome carries sample counts and
 * no figure. The Reasoning tab rendered that sentence AND, above it, "This analysis is partial. The expected outcome did
 * not come back." The second says something was lost, which a re-run would fix. Nothing was lost: it was withheld, and
 * the producer said why. The Analysis tab already shows only the producer's words.
 *
 * The read is the served one (`fixtures/served-funding-goal-figures-withheld-dafdc620.json`), through the REAL
 * `mapV5AnalysisToReport` → store → `useResultsSectionData` → `buildAnalysisNewViewModel` → `AnalysisNewTabBody`.
 * CLAIM TYPE: jsdom render of the real chain; no model calls.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, renderHook, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import served from './fixtures/served-funding-goal-figures-withheld-dafdc620.json'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import { useResultsSectionData } from '../../useResultsSectionData'
import { GOAL_IDENTITY_NOT_EVALUATED_CODE } from '../../utils/goalIdentityWithheld'

const PROVISIONAL = 'analysis-new-status-provisional'
type Warning = { code?: string; message?: string }
const block = served.analysis_result as unknown as { enrichment: { inference_warnings: Warning[] } }
const WITHHELD_WORDS = block.enrichment.inference_warnings.find((w) => w.code === GOAL_IDENTITY_NOT_EVALUATED_CODE)?.message ?? ''

/** The served block, or (CONTRAST) the same block with the producer's withhold taken out and nothing else changed. */
function servedBlock(withhold: boolean): unknown {
  const copy = JSON.parse(JSON.stringify(served.analysis_result)) as typeof block
  if (!withhold) {
    copy.enrichment.inference_warnings = copy.enrichment.inference_warnings.filter((w) => w.code !== GOAL_IDENTITY_NOT_EVALUATED_CODE)
  }
  return copy
}

function seed(withhold: boolean) {
  const report = mapV5AnalysisToReport(servedBlock(withhold) as never, {} as never)
  useCanvasStore.setState({
    hasCompletedFirstRun: true,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
    analysisFreshnessDirty: false,
    nodes: served.nodes.map((n, i) => ({ id: n.id, type: n.kind, position: { x: i * 220, y: 0 }, data: { label: n.label, kind: n.kind } })),
    edges: [],
    results: { status: 'complete', progress: 100, report },
  } as never)
  return renderHook(() => useResultsSectionData()).result.current
}

const statusOf = (data: ReturnType<typeof seed>) =>
  buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false, responseHash: 'run_x' }).status

beforeEach(() => useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never))
afterEach(cleanup)

describe('⭐ a goal figure the producer withheld is not a result that "did not come back"', () => {
  it('PRECONDITION: on the served read, the completeness check counts the withheld outcome as missing, and the producer said why', () => {
    const data = seed(true)
    expect(WITHHELD_WORDS.startsWith('Not shown.')).toBe(true)
    expect(data.completeness.missing).toContain('expected_outcome')
    expect(data.recommendation.goalFiguresWithheldMessage).toBe(WITHHELD_WORDS)
    expect(data.recommendation.analysisStatus, 'the producer did not call it partial').not.toBe('partial')
  })

  it('⭐ the served withheld run is not called partial, and the producer\'s own words still say why', () => {
    const data = seed(true)
    const status = statusOf(data)
    expect(status.missingResults).not.toContain('the expected outcome')
    expect(status.isProvisional).toBe(false)

    render(<AnalysisNewTabBody resultsSectionData={data} isPreRun={false} isRunning={false} isStale={false} responseHash="h" />)
    expect(screen.queryByTestId(PROVISIONAL)).toBeNull()
    expect(document.body.textContent ?? '').not.toContain('did not come back')
    expect(document.body.textContent ?? '').toContain(WITHHELD_WORDS)
  })

  it('CONTRAST: the same served read without the producer\'s withhold still names the missing outcome', () => {
    const data = seed(false)
    expect(data.recommendation.goalFiguresWithheldMessage ?? null).toBeNull()
    const status = statusOf(data)
    expect(status.isProvisional).toBe(true)
    expect(status.missingResults).toContain('the expected outcome')

    render(<AnalysisNewTabBody resultsSectionData={data} isPreRun={false} isRunning={false} isStale={false} responseHash="h" />)
    expect(screen.getByTestId(PROVISIONAL)).toHaveTextContent('The expected outcome did not come back.')
  })
})
