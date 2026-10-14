/**
 * `useHeldHeightWhile` — the shell footer keeps its space while a turn is in flight (S-F; buddy r2: a bar collapsing
 * mid-turn moved a bottom reader's dialogue 50 px). Only the space is held; what fills it is never frozen.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useHeldHeightWhile } from '../useHeldHeightWhile'

function Footer({ active, showBar }: { active: boolean; showBar: boolean }) {
  const held = useHeldHeightWhile(active)
  return (
    <div ref={held.ref} style={held.style} data-testid="footer">
      {showBar ? <div data-testid="bar">Model changed. Results may be out of date.</div> : null}
    </div>
  )
}

/** jsdom has no layout: the footer is 48 px tall while it holds the bar, 0 without. */
function giveLayout() {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.getAttribute('data-testid') === 'footer' && this.querySelector('[data-testid="bar"]') ? 48 : 0
    },
  })
}

describe('useHeldHeightWhile', () => {
  it('⛔ the bar leaving mid-turn: the footer keeps its 48 px until the turn settles, and the words go', () => {
    giveLayout()
    const { rerender } = render(<Footer active={false} showBar />)
    rerender(<Footer active showBar />) // the turn starts
    rerender(<Footer active showBar={false} />) // the Run finishes mid-turn: the bar has nothing true to say
    expect(screen.queryByTestId('bar'), 'the stale words are not held').toBeNull()
    expect(screen.getByTestId('footer').style.minHeight, 'the space collapsed under a pending turn').toBe('48px')
    rerender(<Footer active={false} showBar={false} />) // the turn settles
    expect(screen.getByTestId('footer').style.minHeight).toBe('')
  })

  it('control: no turn in flight → nothing is held', () => {
    giveLayout()
    const { rerender } = render(<Footer active={false} showBar />)
    rerender(<Footer active={false} showBar={false} />)
    expect(screen.getByTestId('footer').style.minHeight).toBe('')
  })
})
