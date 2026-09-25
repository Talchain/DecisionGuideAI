/**
 * ⭐ V2 FIDELITY GAP 10 — the heading scale is not inverted: "Focus now" is a
 * SECTION TITLE over its rows, like "Challenge the thinking" (gap 16) and
 * "Move towards commitment".
 *
 * Staging rendered "Focus now" as an 11px grey caption over 14px rows, so the
 * zone read as a footnote to its own items. The prototype titles every section
 * it has with `h3.section-title` (14px/600).
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
/** The canvas `theZonesAreNamed.spec.tsx` uses to earn a nudge: the model lacks a risk. */
const EARNS_A_NUDGE = [node('o1', 'option'), node('o2', 'option'), node('f1', 'factor'), node('out1', 'outcome')]

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
  useCanvasStore.setState({ nodes: EARNS_A_NUDGE } as never)
})
afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: [] } as never)
})

const renderBody = () =>
  render(
    <AnalysisNewTabBody resultsSectionData={genuineDecision()} isPreRun={false} isRunning={false} isStale={false} responseHash="h" />,
  )

describe('"Focus now" is a section title over its rows', () => {
  it('PRECONDITION: the canvas earns a nudge, so the focus zone renders with rows under its title', () => {
    renderBody()
    const group = screen.getByTestId('analysis-new-zone-focus-group')
    const title = screen.getByTestId('analysis-new-zone-focus')
    expect(group).toContainElement(title)
    expect((group.textContent ?? '').replace(title.textContent ?? '', '').trim().length).toBeGreaterThan(0)
  })

  it('the zone name is a 14px semibold h3, the same grammar as "Challenge the thinking"', () => {
    renderBody()
    const title = screen.getByTestId('analysis-new-zone-focus')
    const challenge = screen.getByTestId('analysis-new-zone-also')
    expect(title.tagName).toBe('H3')
    expect(title).toHaveTextContent('Focus now')
    // Bound to the sibling section title's own class string, not to a guess at
    // the token: both zones must read at one level.
    expect(title.className).toBe(challenge.className)
  })
})
