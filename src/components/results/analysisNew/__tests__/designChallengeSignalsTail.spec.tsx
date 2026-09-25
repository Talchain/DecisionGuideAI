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
import { genuineDecision, openStrategicChallenge } from './analysisNewFixtures'

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

describe('TAIL-1 — "What moves the outcome" is a quiet SectionShell disclose door, not a peer section header', () => {
  it('renders no icon slot, no subtitle line and no count badge', () => {
    renderBody()
    expect(screen.queryByTestId('analysis-new-what-moves-the-outcome-subtitle')).toBeNull()
    expect(screen.queryByTestId('analysis-new-what-moves-the-outcome-count')).toBeNull()
  })

  it('the toggle is a plain button, not wrapped in an h1-h3 heading tag', () => {
    renderBody()
    const toggle = screen.getByTestId('analysis-new-what-moves-the-outcome-toggle')
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle.closest('h1,h2,h3')).toBeNull()
  })

  it('the title carries the section-labelling id directly, so aria-labelledby still resolves', () => {
    renderBody()
    const section = screen.getByTestId('analysis-new-what-moves-the-outcome')
    const labelledBy = section.getAttribute('aria-labelledby')
    expect(labelledBy).toBe('analysis-new-what-moves-the-outcome-heading')
    const title = screen.getByTestId('analysis-new-what-moves-the-outcome-title')
    expect(title.id).toBe('analysis-new-what-moves-the-outcome-heading')
  })

  it('the door is typed panelBody (12px), not panelHeader — the prototype .disclose, not a section title', () => {
    renderBody()
    const toggle = screen.getByTestId('analysis-new-what-moves-the-outcome-toggle')
    expect(toggle.className).toMatch(/text-xs/)
    expect(toggle.className).not.toMatch(/font-semibold/)
  })
})

describe('TAIL-3 — "Drivers and dynamics" is not a second closed door inside "What moves the outcome"', () => {
  /** Two live drivers, so the OLD nested SectionShell would default CLOSED
   * (`sectionOpensItself` only auto-opens on exactly one finding) — the exact
   * state that hid a second toggle behind the first. */
  const renderTwoDrivers = () =>
    render(
      <AnalysisNewTabBody
        resultsSectionData={openStrategicChallenge()}
        isPreRun={false}
        isRunning={false}
        isStale={false}
        responseHash="h-tail-3"
      />,
    )

  const openWhatMovesTheOutcome = () => {
    const toggle = screen.getByTestId('analysis-new-what-moves-the-outcome-toggle')
    if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  }

  it('has no nested drivers toggle — the outer disclosure is the only door', () => {
    renderTwoDrivers()
    openWhatMovesTheOutcome()
    expect(screen.getByTestId('analysis-new-drivers')).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-new-drivers-toggle')).toBeNull()
  })

  it('the count the badge used to show is still carried, on the section itself', () => {
    renderTwoDrivers()
    openWhatMovesTheOutcome()
    expect(screen.getByTestId('analysis-new-drivers')).toHaveAttribute('data-section-count', '2')
    expect(screen.queryByTestId('analysis-new-drivers-count')).toBeNull()
  })

  it('every driver row is on screen the moment the outer door opens — no second click', () => {
    renderTwoDrivers()
    openWhatMovesTheOutcome()
    // Both fixture drivers survive ranking (neither is zero-reasoned out), so
    // both rows must be visible with no further interaction.
    expect(screen.getAllByTestId('analysis-new-drivers-row')).toHaveLength(2)
  })

  it('row headlines read at the quiet body weight, not the section-header weight', () => {
    renderTwoDrivers()
    openWhatMovesTheOutcome()
    const rowToggle = screen.getAllByTestId('analysis-new-drivers-row-toggle')[0]
    const headline = rowToggle.querySelector('span > span')
    expect(headline?.className).toMatch(/text-xs/)
    expect(headline?.className).not.toMatch(/font-semibold/)
  })
})
