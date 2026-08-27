/**
 * Analysis (New) — progressive disclosure (brief §12, §21, §24E).
 *
 * Three levels, and the properties that make them honest:
 *   · a collapsed region is UNMOUNTED, not CSS-hidden, so a screen reader never
 *     walks content the sighted user cannot see;
 *   · a row with nothing beneath it is NOT an expander — an affordance that
 *     expands nothing is the same class of lie as a claim nobody measured;
 *   · `aria-expanded` / `aria-controls` are wired to the region that exists.
 */

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DisclosureRow } from '../DisclosureRow'
import type { AnalysisNewFinding } from '../analysisNewTypes'

const rich: AnalysisNewFinding = {
  id: 'driver:f_adopt',
  headline: 'Customer adoption',
  implication: 'Among the strongest influences in this run; raises the outcome.',
  detail: 'This relationship is one the result is sensitive to.',
  groundedIn: 'factor sensitivity, ranked within this run',
  marker: 'not_assessed',
  targetId: 'f_adopt',
  inspect: [
    { label: 'Rank', value: '1' },
    { label: 'Basis', value: 'ranked within this run' },
  ],
  intervention: { recommendationId: 'strengthen:voi', label: 'Gather evidence', targetId: 'f_adopt' },
}

const bare: AnalysisNewFinding = {
  id: 'uncertainty:PLAIN',
  headline: 'A finding with nothing beneath it',
  implication: 'One sentence and no more.',
  groundedIn: 'the critique analysis',
  inspect: [],
}

const renderRow = (finding: AnalysisNewFinding, over: Partial<Parameters<typeof DisclosureRow>[0]> = {}) =>
  render(
    <DisclosureRow
      finding={finding}
      testIdPrefix="row"
      onFocusTarget={vi.fn()}
      onRunIntervention={vi.fn()}
      {...over}
    />,
  )

describe('level 1 — scan', () => {
  it('shows the headline and implication, and nothing deeper', () => {
    renderRow(rich)
    expect(screen.getByText('Customer adoption')).toBeInTheDocument()
    expect(screen.getByText(rich.implication)).toBeInTheDocument()
    // Level 2 is UNMOUNTED, not hidden.
    expect(screen.queryByTestId('row-detail')).toBeNull()
    expect(screen.queryByTestId('row-grounding')).toBeNull()
    expect(screen.queryByTestId('row-inspect')).toBeNull()
  })

  it('renders the provisional/not-assessed marker at level 1 where it can be seen', () => {
    renderRow(rich)
    expect(screen.getByTestId('row-marker')).toHaveTextContent('Not assessed')
  })
})

describe('level 2 — understand', () => {
  it('expands to reveal detail, grounding and the contextual intervention', () => {
    renderRow(rich)
    const toggle = screen.getByTestId('row-toggle')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('row-detail')).toBeInTheDocument()
    expect(screen.getByTestId('row-grounding')).toHaveTextContent(
      'Grounded in factor sensitivity, ranked within this run.',
    )
    // The intervention stays visibly attached to the finding that triggered it,
    // and carries the engine recommendation id that justifies it.
    expect(screen.getByTestId('row-intervention')).toHaveAttribute(
      'data-recommendation-id',
      'strengthen:voi',
    )
  })

  it('wires aria-controls to the region that actually exists', () => {
    renderRow(rich)
    const toggle = screen.getByTestId('row-toggle')
    expect(toggle).not.toHaveAttribute('aria-controls')
    fireEvent.click(toggle)
    const id = toggle.getAttribute('aria-controls')
    expect(id).toBeTruthy()
    expect(document.getElementById(id!)).toBe(screen.getByTestId('row-detail'))
  })

  it('collapses back, unmounting the region', () => {
    renderRow(rich)
    fireEvent.click(screen.getByTestId('row-toggle'))
    fireEvent.click(screen.getByTestId('row-toggle'))
    expect(screen.queryByTestId('row-detail')).toBeNull()
  })
})

describe('level 3 — inspect', () => {
  it('nests inside level 2 and is collapsed until asked for', () => {
    renderRow(rich)
    fireEvent.click(screen.getByTestId('row-toggle'))
    expect(screen.queryByTestId('row-inspect')).toBeNull()

    fireEvent.click(screen.getByTestId('row-inspect-toggle'))
    const inspect = screen.getByTestId('row-inspect')
    expect(inspect).toHaveTextContent('Rank')
    expect(inspect).toHaveTextContent('Basis')
  })
})

describe('a row with nothing beneath it is not an expander', () => {
  it('offers no toggle, no aria-expanded, and is not focusable as a control', () => {
    // The discriminating half: the SAME component, given a finding with no
    // detail / intervention / inspect rows, must not advertise a disclosure.
    renderRow(bare)
    const toggle = screen.getByTestId('row-toggle')
    expect(toggle).toBeDisabled()
    expect(toggle).not.toHaveAttribute('aria-expanded')
    fireEvent.click(toggle)
    expect(screen.queryByTestId('row-detail')).toBeNull()
  })
})

describe('actions', () => {
  it('routes canvas focus by the producer-named target id', () => {
    const onFocusTarget = vi.fn()
    renderRow(rich, { onFocusTarget })
    fireEvent.click(screen.getByTestId('row-toggle'))
    fireEvent.click(screen.getByTestId('row-focus'))
    expect(onFocusTarget).toHaveBeenCalledWith('f_adopt')
  })

  it('runs the intervention by its engine recommendation id, not by its label', () => {
    const onRunIntervention = vi.fn()
    renderRow(rich, { onRunIntervention })
    fireEvent.click(screen.getByTestId('row-toggle'))
    fireEvent.click(screen.getByTestId('row-intervention'))
    expect(onRunIntervention).toHaveBeenCalledWith('strengthen:voi')
  })

  it('offers no focus affordance when the producer named no target', () => {
    renderRow({ ...rich, targetId: undefined })
    fireEvent.click(screen.getByTestId('row-toggle'))
    expect(screen.queryByTestId('row-focus')).toBeNull()
  })
})
