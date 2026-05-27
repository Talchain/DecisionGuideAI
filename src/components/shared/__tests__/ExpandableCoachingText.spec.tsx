/**
 * ExpandableCoachingText — disclosureLabels prop tests
 * (pre-analysis-power-v1 Task 6).
 *
 * The prop is additive: pre-analysis call-sites pass
 * `{ more: 'Show more', less: 'Show less' }` while the post-analysis
 * DriversSection keeps the default `{ more: 'More', less: 'Less' }`.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ExpandableCoachingText } from '../ExpandableCoachingText'

// Strings need to cross SHORT_TEXT_THRESHOLD (80 chars) AND visibly overflow
// the two-line clamp. We stub scrollHeight / clientHeight on the paragraph
// so the overflow detection fires deterministically without depending on
// jsdom's layout (which has none).
const LONG_TEXT =
  'This is a long CEE coaching string that crosses the eighty-character threshold so the More and Less disclosure toggle actually renders for the user.'

beforeEach(() => {
  // jsdom returns 0 for scrollHeight / clientHeight, so we mock the geometry
  // to force overflow detection true.
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 100 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 30 })
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (HTMLElement.prototype as unknown as { scrollHeight?: number }).scrollHeight
  delete (HTMLElement.prototype as unknown as { clientHeight?: number }).clientHeight
})

describe('ExpandableCoachingText — disclosureLabels prop', () => {
  it('renders the default "More" / "Less" pair when the prop is not provided (results panel preserved)', () => {
    render(<ExpandableCoachingText text={LONG_TEXT} />)
    const toggle = screen.getByRole('button', { name: /^more$/i })
    expect(toggle).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: /^less$/i })).toBeInTheDocument()
  })

  it('renders "Show more" / "Show less" when disclosureLabels is provided (pre-analysis panel)', () => {
    render(
      <ExpandableCoachingText
        text={LONG_TEXT}
        disclosureLabels={{ more: 'Show more', less: 'Show less' }}
      />,
    )
    const toggle = screen.getByRole('button', { name: /^show more$/i })
    expect(toggle).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: /^show less$/i })).toBeInTheDocument()
    // Regression guard: the default copy must not appear when the prop is set.
    expect(screen.queryByRole('button', { name: /^more$/i })).not.toBeInTheDocument()
  })
})
