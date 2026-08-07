/**
 * Safety — SERVER strings are rendered verbatim as TEXT (gating is row-TYPE
 * selection by the mapper, never rewriting server copy). No dangerouslySetInnerHTML
 * path: HTML-looking strings appear literally and parse no elements.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FocusNowPanel } from '../FocusNowPanel'
import { buildFocusRows } from '../buildFocusRows'
import { forbiddenSummary, xssSummary, serverRow } from '../__fixtures__/focus.fixtures'
import type { FocusNowProps, FocusRow } from '../focusTypes'

const staticRows = buildFocusRows({}).rows
function renderPanel(overrides: Partial<FocusNowProps> = {}) {
  const props: FocusNowProps = { summary: null, rows: staticRows, banner: { kind: 'none' }, ...overrides }
  return render(<FocusNowPanel {...props} />)
}

describe('FocusNowPanel render-as-text safety', () => {
  it('renders a banned-term server summary verbatim (UI never rewrites server prose)', () => {
    renderPanel({ summary: forbiddenSummary })
    expect(screen.getByTestId('focus-summary')).toHaveTextContent(forbiddenSummary)
  })

  it('renders HTML-looking server prose as literal text, parsing no elements', () => {
    const { container } = renderPanel({ summary: xssSummary })
    expect(screen.getByTestId('focus-summary')).toHaveTextContent('this should appear as text')
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
  })

  it('renders server-row strings containing banned terms verbatim', () => {
    const row: FocusRow = {
      ...serverRow,
      primary: 'recommended winner uses the graph',
      noticed: 'driver sensitivity was flagged',
    }
    renderPanel({ rows: [row] })
    fireEvent.click(screen.getByRole('button', { name: /recommended winner uses the graph/i }))
    expect(screen.getByTestId('focus-noticed')).toHaveTextContent('driver sensitivity was flagged')
  })
})
