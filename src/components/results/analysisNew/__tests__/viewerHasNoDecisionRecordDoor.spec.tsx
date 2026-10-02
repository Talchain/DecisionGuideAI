/**
 * A decision record is the scenario OWNER's (MG 5951262086: CEE `/commit` refuses a non-owner before any write), so a
 * colleague VIEWING a shared decision is offered no "Record your view" on the Reasoning tab. Same seed, owner contrast.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { genuineDecision } from './analysisNewFixtures'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { COMMITMENT_COPY } from '../commitmentSynthesis'
import { setViewerScenario, __resetViewerModeForTests } from '../../../../lib/viewerMode'

const renderBody = () =>
  render(
    <AnalysisNewTabBody resultsSectionData={genuineDecision()} isPreRun={false} isRunning={false} isStale={false} responseHash="viewer-door" />,
  )

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
  // An analysed option set: the capture door's own precondition (`hasAnalysedOptions`).
  useCanvasStore.setState({
    nodes: [
      { id: 'o1', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Fix the integration bug' } },
      { id: 'o2', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Build the AI module' } },
    ] as never,
    results: { status: 'complete', progress: 100 } as never,
  } as never)
})
afterEach(() => {
  cleanup()
  __resetViewerModeForTests()
})

describe('a viewer is offered no decision record', () => {
  it('OWNER (not a viewer): "Record your view" is offered', () => {
    renderBody()
    expect(screen.getAllByRole('button', { name: new RegExp(COMMITMENT_COPY.record.open) }).length).toBeGreaterThan(0)
  })

  it('⛔ VIEWER, same seed: no "Record your view"', () => {
    act(() => setViewerScenario('11111111-1111-4111-8111-111111111111'))
    renderBody()
    expect(screen.queryAllByRole('button', { name: new RegExp(COMMITMENT_COPY.record.open) })).toHaveLength(0)
  })
})
