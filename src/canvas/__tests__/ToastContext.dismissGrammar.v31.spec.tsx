/**
 * contract v3.1 CHR-15 — the toast's dismiss hovers with the DS neutral token
 * (`bg-panel-hover`), not a pure-black tint from outside the palette, and is the
 * same dismiss affordance as every canvas notice (CHR-9): muted at rest, body
 * colour on hover, a visible focus ring, a decorative glyph hidden from AT.
 *
 * Bound by identity: the button is found by its accessible name inside the
 * toast region, not by a class another element could carry.
 */
import { describe, it, expect } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import { useEffect } from 'react'
import { ToastProvider, useShowToast } from '../ToastContext'

function Fire({ message }: { message: string }) {
  const showToast = useShowToast()
  useEffect(() => {
    showToast(message, 'error')
  }, [showToast, message])
  return null
}

describe('toast dismiss (contract v3.1 CHR-15)', () => {
  it('⭐ hovers with bg-panel-hover — never the pure-black bg-black/5 tint', async () => {
    await act(async () => {
      render(
        <ToastProvider>
          <Fire message="Something to say" />
        </ToastProvider>,
      )
    })
    const region = screen.getByRole('region', { name: 'Notifications' })
    const dismiss = within(region).getByRole('button', { name: 'Dismiss' })
    const cls = dismiss.className.split(/\s+/)
    expect(cls).toContain('hover:bg-panel-hover')
    expect(cls).not.toContain('hover:bg-black/5')
    for (const c of ['text-text-light', 'hover:text-text-body', 'focus-visible:ring-2', 'focus-visible:ring-info']) {
      expect(cls).toContain(c)
    }
    expect(dismiss.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })
})
