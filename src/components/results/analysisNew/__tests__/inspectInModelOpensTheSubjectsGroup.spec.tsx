/**
 * "Inspect in Model" on the Reasoning tab's signal rows opens the group its
 * SUBJECT lives in — a factor in Factors, not Relationships.
 *
 * ⚠ WHAT WAS WRONG (programme-docs #85 5963788754). The Challenge zone's
 * tipping point, driver and gap rows hand a FACTOR node id to `onInspect`, and
 * the tab bound that to the dock's `onReviewTarget` — `handleReviewTarget`,
 * which opens the Model tab on RELATIONSHIPS (its subjects are edges). The
 * factor sits in the Factors group, collapsed by design, so "inspect the named
 * factor" from the live tipping point landed the reader in the wrong group. That
 * is the UI leg of SCI-HERO's tipping-point journey: fact → refine the named
 * factor → rerun.
 *
 * ⚠ THE FIX ROUTES BY THE SUBJECT'S IDENTITY, read with the estate's own
 * predicate (`resolveNodeTypeLiteral`, as the value-of-information resolver
 * uses): a factor → `openModelValueEditor` (the factors route's single owner);
 * anything else → the dock's route, unchanged.
 *
 * Data: the found tipping point of Paul's run `1dd2133d` (the fixture
 * `theTippingPointRenders.spec.tsx` already uses), node `3457913d`.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
vi.mock('../../../../canvas/nodes/shared/openModelValueEditor', () => ({ openModelValueEditor: vi.fn() }))

import { openModelValueEditor } from '../../../../canvas/nodes/shared/openModelValueEditor'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { manyFragileEdges } from './analysisNewFixtures'
import { seedCurrentRun } from './seedCurrentRun'

const TIP_NODE = '3457913d'
const FOUND_TIP = {
  label: 'Tech Lead Presence',
  node_id: TIP_NODE,
  current_value: 0.6,
  flip_value: 0.9619,
  alternative_winner_label: 'Two Developers',
  flip_reason: 'found',
}

const withTip = (): ResultsSectionDataReturn => {
  const data = manyFragileEdges()
  return {
    ...data,
    recommendation: {
      ...data.recommendation,
      flipThresholds: [FOUND_TIP],
      leaderDesignationPermitted: true,
      verdict: { hasLeadingOption: true },
    },
  } as ResultsSectionDataReturn
}

const seedCanvas = (type: string) =>
  useCanvasStore.setState({
    nodes: [{ id: TIP_NODE, type, position: { x: 0, y: 0 }, data: { label: FOUND_TIP.label } }],
  } as never)

const renderBody = (onReviewTarget?: (id: string) => void) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={withTip()}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="inspect_in_model"
      {...(onReviewTarget ? { onReviewTarget } : {})}
    />,
  )

// #2462: on a current, licensed Run the tipping row's Inspect act is replaced by its explicit "Edit <factor>" door
// (ReasoningSignals, \`offerFactorEdit\`), which calls the SAME \`onInspect\`. So the subject's route is pressed
// there; the old act is asserted absent so a second door cannot quietly come back.
const pressTipInspect = () => {
  expect(screen.queryByTestId('analysis-new-signals-tipping-inspect')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: `Edit ${FOUND_TIP.label}` }))
}

// A current Run: since #2462 the tipping row is passed thresholds only on one (see seedCurrentRun.ts).
beforeEach(seedCurrentRun)
afterEach(() => {
  cleanup()
  vi.mocked(openModelValueEditor).mockClear()
  useCanvasStore.setState({ nodes: [] } as never)
})

describe('"Inspect in Model" opens the group its subject lives in', () => {
  it('a tipping point on a FACTOR opens that factor in the Factors group — never Relationships', () => {
    seedCanvas('factor')
    const onReviewTarget = vi.fn()
    renderBody(onReviewTarget)
    expect(screen.getByTestId('analysis-new-signals-tipping')).toHaveAttribute('data-target-id', TIP_NODE)
    pressTipInspect()
    expect(vi.mocked(openModelValueEditor).mock.calls).toEqual([[TIP_NODE]])
    expect(onReviewTarget).not.toHaveBeenCalled()
  })

  it('CONTROL: a subject that is not a factor keeps the dock’s existing route', () => {
    seedCanvas('outcome')
    const onReviewTarget = vi.fn()
    renderBody(onReviewTarget)
    pressTipInspect()
    expect(onReviewTarget).toHaveBeenCalledWith(TIP_NODE)
    expect(openModelValueEditor).not.toHaveBeenCalled()
  })

  it('CONTROL: a host that offers no Model route still renders no inspect act (absent, never dead)', () => {
    seedCanvas('factor')
    renderBody()
    expect(screen.getByTestId('analysis-new-signals-tipping')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-signals-tipping-inspect')).toBeNull()
  })
})
