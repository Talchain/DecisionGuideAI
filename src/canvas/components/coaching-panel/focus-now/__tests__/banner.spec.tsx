/**
 * FocusBanner — the three freshness states render correctly and the re-run
 * affordance appears ONLY when appropriate (stale, not in-flight).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FocusBanner } from '../FocusBanner'

describe('FocusBanner', () => {
  it('stale: shows re-run; click fires onRerun', () => {
    const onRerun = vi.fn()
    render(<FocusBanner state={{ kind: 'stale', canRerun: true }} onRerun={onRerun} />)
    fireEvent.click(screen.getByTestId('focus-rerun'))
    expect(onRerun).toHaveBeenCalledTimes(1)
  })

  it('stale: re-run is disabled while a run is in flight', () => {
    render(<FocusBanner state={{ kind: 'stale', canRerun: true }} onRerun={() => {}} rerunDisabled />)
    expect(screen.getByTestId('focus-rerun')).toBeDisabled()
  })

  it('stale: re-run button has an accessible name', () => {
    render(<FocusBanner state={{ kind: 'stale', canRerun: true }} onRerun={() => {}} />)
    expect(screen.getByRole('button', { name: 'Re-run analysis' })).toBeInTheDocument()
  })

  it('cannot_confirm: neutral note, no re-run even when onRerun is provided', () => {
    render(<FocusBanner state={{ kind: 'cannot_confirm' }} onRerun={() => {}} />)
    expect(screen.getByTestId('focus-banner')).toHaveAttribute('data-banner', 'cannot_confirm')
    expect(screen.queryByTestId('focus-rerun')).toBeNull()
  })

  it('none: renders nothing', () => {
    const { container } = render(<FocusBanner state={{ kind: 'none' }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
