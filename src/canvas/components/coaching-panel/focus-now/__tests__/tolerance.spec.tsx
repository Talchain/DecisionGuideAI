/**
 * Tolerance — malformed / missing / extreme data degrades gracefully and never
 * crashes; a gated row passed via props is dropped at the render boundary.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FocusNowPanel } from '../FocusNowPanel'
import { gatedRow } from '../__fixtures__/focus.fixtures'
import type { FocusRow } from '../focusTypes'

function panel(rows: FocusRow[], summary: string | null = null) {
  return render(<FocusNowPanel summary={summary} rows={rows} banner={{ kind: 'none' }} />)
}

describe('FocusNowPanel tolerance', () => {
  it('renders the empty state when rows is empty', () => {
    panel([])
    expect(screen.getByTestId('focus-empty')).toBeInTheDocument()
  })

  it('does not crash on a row with an empty primary (uses a generic name)', () => {
    panel([{ id: 'x', ownership: 'static_hygiene', source: 'static_hygiene', primary: '' }])
    expect(screen.getByRole('button', { name: 'Focus item' })).toBeInTheDocument()
  })

  it('handles a very long primary without crashing', () => {
    panel([{ id: 'long', ownership: 'static_hygiene', source: 'static_hygiene', primary: 'x'.repeat(400) }])
    expect(screen.getByTestId('focus-card')).toBeInTheDocument()
  })

  it('degrades an unknown target kind to a neutral marker', () => {
    panel([
      { id: 'u', ownership: 'server_sourced', source: 'coaching_signal', primary: 'Unknown kind row', targetKind: 'mystery' },
    ])
    expect(screen.getByText('Unknown kind row')).toBeInTheDocument()
  })

  it('drops a gated row passed via props (never renders it)', () => {
    panel([gatedRow])
    expect(screen.queryByText(/most influence on the result/i)).toBeNull()
    expect(screen.getByTestId('focus-empty')).toBeInTheDocument()
  })
})
