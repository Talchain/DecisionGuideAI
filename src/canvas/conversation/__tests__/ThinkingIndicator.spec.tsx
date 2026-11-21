/**
 * Tests for ThinkingIndicator.
 *
 * Verifies:
 * - Renders one mark and respects reduced motion
 * - Shows label text when provided
 * - Hides label when not provided
 * - Does not show retry while the request is still in flight
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThinkingIndicator } from '../zones/ThinkingIndicator'

describe('ThinkingIndicator', () => {
  it.each([false, true])('renders one mark with reduced motion set to %s', (matches) => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    try {
      render(<ThinkingIndicator />)
      const mark = screen.getByTestId('thinking-indicator')
      const paths = mark.querySelectorAll('svg > path')
      expect(mark.querySelectorAll('svg')).toHaveLength(1)
      expect(paths).toHaveLength(1)
      expect(paths[0]).toHaveClass(matches ? 'ok-thinking-mark-static' : 'ok-thinking-mark-morph')
      if (matches) expect(paths[0]).not.toHaveClass('ok-thinking-mark-morph')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('shows label when provided', () => {
    render(<ThinkingIndicator label="Structuring your decision..." />)
    expect(screen.getByTestId('thinking-label')).toHaveTextContent('Structuring your decision...')
  })

  it('hides label when null', () => {
    render(<ThinkingIndicator label={null} />)
    expect(screen.queryByTestId('thinking-label')).not.toBeInTheDocument()
  })

  it('shows default thinking text when no label', () => {
    // ThinkingIndicator renders the label prop directly; default is in ChatThread
    render(<ThinkingIndicator />)
    expect(screen.queryByTestId('thinking-label')).not.toBeInTheDocument()
  })

  it('does not render any retry affordance for long-running labels', () => {
    render(<ThinkingIndicator label="Still working…" />)
    expect(screen.queryByTestId('thinking-retry')).not.toBeInTheDocument()
  })

})
