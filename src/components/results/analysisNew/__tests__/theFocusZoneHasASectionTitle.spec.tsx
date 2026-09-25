/**
 * ⛔ REVERSED — V2 prototype (Paul, 25 Sep 2026: "match the prototype").
 *
 * This file pinned V2 fidelity gap 10: "Focus now" as a 14px/600 h3 section
 * title over its rows, the grammar of "Challenge the thinking". The prototype
 * has no "Focus now" block on the Reasoning tab, so the zone is removed: its
 * nudges stay on the Analysis tab, and the success nudge is the model strip's
 * own "What would success look like?" row.
 *
 * What is kept is the guard that it does not come back — on the very canvas
 * that used to earn it. The section-title grammar it pinned lives on in
 * "Challenge the thinking", which is the contrast in the same render.
 *
 * Deleted cases (both pinned the removed zone): "PRECONDITION: the canvas earns
 * a nudge, so the focus zone renders with rows under its title" and "the zone
 * name is a 14px semibold h3, the same grammar as \"Challenge the thinking\"".
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { genuineDecision } from './analysisNewFixtures'

const node = (id: string, type: string) => ({ id, type, position: { x: 0, y: 0 }, data: { label: id } })
/** The canvas that earned a nudge before V2: the model lacks a risk. */
const USED_TO_EARN_A_NUDGE = [node('o1', 'option'), node('o2', 'option'), node('f1', 'factor'), node('out1', 'outcome')]

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
  useCanvasStore.setState({ nodes: USED_TO_EARN_A_NUDGE } as never)
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: [] } as never)
})

describe('the Reasoning tab renders no "Focus now" zone (V2 prototype, 25 Sep)', () => {
  it('no focus zone, no title and no "Focus now" words — on the canvas that used to earn one', () => {
    render(
      <AnalysisNewTabBody resultsSectionData={genuineDecision()} isPreRun={false} isRunning={false} isStale={false} responseHash="h" />,
    )
    expect(screen.queryByTestId('analysis-new-zone-focus-group')).toBeNull()
    expect(screen.queryByTestId('analysis-new-zone-focus')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Focus now' })).toBeNull()
    expect(screen.getByTestId('analysis-new-tab-body').textContent ?? '').not.toContain('Focus now')

    // CONTRAST, same render: the sibling zone title IS an h3 on screen, and the
    // model strip rendered over this canvas — so the absence is the ruling, not
    // a failed render.
    const challenge = screen.getByTestId('analysis-new-zone-also')
    expect(challenge.tagName).toBe('H3')
    expect(screen.getByRole('heading', { name: 'Challenge the thinking' })).toBe(challenge)
    expect(screen.getByTestId('analysis-new-model-strip')).toBeInTheDocument()
  })
})
