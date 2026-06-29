/**
 * Safety — model-supplied strings are rendered as TEXT, never HTML.
 *
 * Proves there is no `dangerouslySetInnerHTML` path: HTML-looking strings appear
 * verbatim and no corresponding elements are parsed into the DOM. Also proves
 * the UI renders model data containing forbidden glossary terms verbatim (it
 * never sanitises or rewrites model strings — that is a CEE concern).
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CoachingPanel } from '../CoachingPanel'
import { xssish, forbiddenTermInLabel } from '../__fixtures__/coaching.fixtures'

describe('CoachingPanel render-as-text safety', () => {
  it('renders HTML-looking strings as literal text, parsing no elements', () => {
    const { container } = render(<CoachingPanel coaching={xssish} />)
    expect(screen.getByText(/should appear as text/)).toBeInTheDocument()
    expect(screen.getByText(/stays as literal text/)).toBeInTheDocument()
    // No injected elements from the model strings.
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
  })

  it('renders model data containing forbidden terms verbatim (no sanitisation)', () => {
    render(<CoachingPanel coaching={forbiddenTermInLabel} />)
    const header = screen.getByRole('button', { name: /large coefficient weight/i })
    expect(header).toBeInTheDocument()
    fireEvent.click(header)
    expect(screen.getByText('the graph node')).toBeInTheDocument()
  })
})
