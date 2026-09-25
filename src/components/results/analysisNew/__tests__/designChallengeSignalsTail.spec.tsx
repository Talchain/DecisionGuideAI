/**
 * ⭐ BUNDLE b3-challenge-signals-tail — panel-lane design audit 2026-09-25.
 *
 * Pins the presentation gaps this bundle closes, by IDENTITY (data-testid
 * plus the exact class the prototype authority demands), not by a rendered
 * pixel measurement jsdom cannot take.
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
/** Earns a "Focus now" nudge, the same fixture theFocusZoneHasASectionTitle.spec.tsx uses. */
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

describe('SPACE-1 / FIRST-2 — "Challenge the thinking" sits close under its rule, not 44px under it', () => {
  it('the also-zone group carries its own !mt-0 pt-1, not the ambient space-y-4 margin', () => {
    renderBody()
    const group = screen.getByTestId('analysis-new-zone-also-group')
    expect(group.className).toBe('!mt-0 pt-1 space-y-3')
  })

  it('the also-zone title no longer carries its own pt-3 — that space now lives on the group', () => {
    renderBody()
    const title = screen.getByTestId('analysis-new-zone-also')
    expect(title.className).not.toMatch(/\bpt-3\b/)
  })

  it('the focus-zone title stays byte-identical to the also-zone title (theFocusZoneHasASectionTitle)', () => {
    renderBody()
    const also = screen.getByTestId('analysis-new-zone-also')
    const focus = screen.getByTestId('analysis-new-zone-focus')
    expect(focus.className).toBe(also.className)
  })

  it('the focus-zone group absorbs the pt-3 the title gave up — a relocation, not a visual change there', () => {
    renderBody()
    const group = screen.getByTestId('analysis-new-zone-focus-group')
    expect(group.className).toBe('pt-3 space-y-3')
  })
})
