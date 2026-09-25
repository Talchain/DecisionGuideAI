/**
 * ⭐ BUNDLE b3-challenge-signals-tail — panel-lane design audit 2026-09-25.
 *
 * Pins the presentation gaps this bundle closes, by IDENTITY (data-testid
 * plus the exact class the prototype authority demands), not by a rendered
 * pixel measurement jsdom cannot take.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useCanvasStore } from '../../../../canvas/store'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { genuineDecision } from './analysisNewFixtures'
import { buildModelStrip } from '../buildModelStrip'
import { applicableStaticFocusIds } from '../focusNowApplicability'

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

/**
 * V2 prototype: "What moves the outcome" renders only inside the challenge's
 * "Assumptions and evidence" door. Opens it, asserting it was closed and that
 * the section was off the default scroll until then.
 */
const renderWithEvidenceOpen = () => {
  renderBody()
  expect(screen.queryByTestId('analysis-new-what-moves-the-outcome')).toBeNull()
  const door = screen.getByTestId('analysis-new-signals-disclose')
  expect(door).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(door)
  expect(screen.getByTestId('analysis-new-what-moves-the-outcome')).toBeInTheDocument()
}

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

  // The two focus-zone cases were deleted: Paul removed "Focus now" from this
  // tab (V2 prototype, 25 Sep). This pins the removal on a model that earns a nudge.
  it('no "Focus now" zone renders on this tab, even on a model that earns a nudge', () => {
    const strip = buildModelStrip(EARNS_A_NUDGE)
    const countOf = (kind: 'risk' | 'outcome') => strip.rows.find((r) => r.kind === kind)?.nodes.length ?? 0
    expect(
      applicableStaticFocusIds({ hasGoalTarget: null, outcomeCount: countOf('outcome'), riskCount: countOf('risk') }),
      'PRECONDITION: the model earns a nudge the removed zone would have shown',
    ).not.toHaveLength(0)
    renderBody()
    expect(screen.getByTestId('analysis-new-zone-also')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-zone-focus')).toBeNull()
    expect(screen.queryByTestId('analysis-new-zone-focus-group')).toBeNull()
  })
})

describe('TAIL-1 — "What moves the outcome" is a quiet SectionShell disclose door, not a peer section header', () => {
  it('renders no icon slot, no subtitle line and no count badge', () => {
    renderWithEvidenceOpen()
    expect(screen.queryByTestId('analysis-new-what-moves-the-outcome-subtitle')).toBeNull()
    expect(screen.queryByTestId('analysis-new-what-moves-the-outcome-count')).toBeNull()
  })

  it('the toggle is a plain button, not wrapped in an h1-h3 heading tag', () => {
    renderWithEvidenceOpen()
    const toggle = screen.getByTestId('analysis-new-what-moves-the-outcome-toggle')
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle.closest('h1,h2,h3')).toBeNull()
  })

  it('the title carries the section-labelling id directly, so aria-labelledby still resolves', () => {
    renderWithEvidenceOpen()
    const section = screen.getByTestId('analysis-new-what-moves-the-outcome')
    const labelledBy = section.getAttribute('aria-labelledby')
    expect(labelledBy).toBe('analysis-new-what-moves-the-outcome-heading')
    const title = screen.getByTestId('analysis-new-what-moves-the-outcome-title')
    expect(title.id).toBe('analysis-new-what-moves-the-outcome-heading')
  })

  it('the door is typed panelBody (12px), not panelHeader — the prototype .disclose, not a section title', () => {
    renderWithEvidenceOpen()
    const toggle = screen.getByTestId('analysis-new-what-moves-the-outcome-toggle')
    expect(toggle.className).toMatch(/text-xs/)
    expect(toggle.className).not.toMatch(/font-semibold/)
  })
})
