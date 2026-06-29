/**
 * FocusNowPanel interaction — one row open at a time, show all/fewer, and the
 * prefill-only action contract (the panel never auto-sends).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FocusNowPanel } from '../FocusNowPanel'
import { buildFocusRows } from '../buildFocusRows'
import { serverRow } from '../__fixtures__/focus.fixtures'
import type { FocusNowProps } from '../focusTypes'

const staticRows = buildFocusRows({}).rows
function renderPanel(overrides: Partial<FocusNowProps> = {}) {
  const props: FocusNowProps = { summary: null, rows: staticRows, banner: { kind: 'none' }, ...overrides }
  return render(<FocusNowPanel {...props} />)
}

describe('FocusNowPanel interaction', () => {
  it('opens one row at a time', () => {
    renderPanel()
    const r1 = screen.getByRole('button', { name: /define what success/i })
    const r2 = screen.getByRole('button', { name: /set a time horizon/i })
    fireEvent.click(r1)
    expect(r1).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(r2)
    expect(r1).toHaveAttribute('aria-expanded', 'false')
    expect(r2).toHaveAttribute('aria-expanded', 'true')
  })

  it('toggles a row closed on a second click', () => {
    renderPanel()
    const r1 = screen.getByRole('button', { name: /define what success/i })
    fireEvent.click(r1)
    fireEvent.click(r1)
    expect(r1).toHaveAttribute('aria-expanded', 'false')
  })

  it('reveals hidden rows past the default-visible cap, then collapses again', () => {
    renderPanel({ rows: [serverRow, ...staticRows] }) // 7 rows, cap is 6
    const reveal = screen.getByTestId('focus-reveal')
    expect(reveal).toHaveTextContent('Show all 7')
    fireEvent.click(reveal)
    expect(reveal).toHaveTextContent('Show fewer')
  })

  it('shows no reveal when rows fit within the default-visible cap', () => {
    renderPanel() // exactly 6 static rows
    expect(screen.queryByTestId('focus-reveal')).toBeNull()
  })

  it('the "Try this" action prefills the composer and never auto-sends', () => {
    const onPrefill = vi.fn()
    renderPanel({ onPrefill })
    fireEvent.click(screen.getByRole('button', { name: /add a risk worth watching/i }))
    fireEvent.click(screen.getByTestId('focus-action'))
    expect(onPrefill).toHaveBeenCalledTimes(1)
    expect(onPrefill).toHaveBeenCalledWith(
      'Help me think through a risk worth adding to this decision.',
    )
  })

  it('the Ask Olumi icon prefills the same prompt and never auto-sends', () => {
    const onPrefill = vi.fn()
    renderPanel({ onPrefill })
    fireEvent.click(screen.getByRole('button', { name: /add a risk worth watching/i }))
    fireEvent.click(screen.getByTestId('focus-ask-olumi'))
    expect(onPrefill).toHaveBeenCalledTimes(1)
    expect(onPrefill).toHaveBeenCalledWith(
      'Help me think through a risk worth adding to this decision.',
    )
  })

  it('the Ask Olumi icon has an accessible name and is keyboard-operable', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /add a risk worth watching/i }))
    // Native button named by aria-label → operable by Enter/Space, focusable.
    const icon = screen.getByRole('button', { name: 'Ask Olumi' })
    expect(icon.tagName).toBe('BUTTON')
    expect(icon).not.toHaveAttribute('disabled')
  })

  it('renders NO action controls when actionsEnabled is false (rows stay informational)', () => {
    renderPanel({ actionsEnabled: false })
    // the row still expands and shows its guidance…
    fireEvent.click(screen.getByRole('button', { name: /add a risk worth watching/i }))
    expect(screen.getByTestId('focus-card-body')).toBeInTheDocument()
    // …but neither action control is present (no dead buttons when the chat
    // surface cannot be revealed)
    expect(screen.queryByTestId('focus-action')).toBeNull()
    expect(screen.queryByTestId('focus-ask-olumi')).toBeNull()
  })
})
