/**
 * ⛔ Codex CHANGES_REQUIRED 5810966650 (#1932 @ edeb32b3, 24 Sep 2026): the bounded
 * anatomy (ED 5809278282) moved an option's change rows and `+N more` into its
 * PORTALLED popover. On touch, this hook's document-capture `pointerdown` closed
 * the popover for any target outside the card — and the portal renders under
 * `document.body`, outside the card — so tapping `+N more` could unmount the
 * popover before its click reached the inspector. Model detail relocated for
 * height became unreachable for touch users.
 *
 * The card's OWN portal (`[data-node-popover="<this node id>"]`, the identity the
 * keyboard path already uses) counts as inside; another node's portal, the canvas
 * and the page do not.
 *
 * Real hook, real portal, emulated touch (`(hover: none)`). jsdom performs no
 * layout; this pins the event protocol.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createPortal } from 'react-dom'
import { usePopoverHover } from '../usePopoverHover'

function Card({ id }: { id: string }) {
  const { showPopover, nodeHandlers, nodeElRef } = usePopoverHover()
  return (
    <div className="react-flow__node" data-id={id}>
      <div ref={nodeElRef as React.RefObject<HTMLDivElement>} {...nodeHandlers} data-testid={`card-${id}`}>card</div>
      <span data-testid={`open-${id}`}>{String(showPopover)}</span>
      {showPopover && createPortal(
        <div data-node-popover={id}><button type="button" data-testid={`more-${id}`}>+1 more</button></div>,
        document.body,
      )}
    </div>
  )
}

const realMatchMedia = window.matchMedia
beforeEach(() => {
  window.matchMedia = ((q: string) => ({
    matches: q === '(hover: none)', media: q, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
})
afterEach(() => { cleanup(); window.matchMedia = realMatchMedia })

function openByTap(id: string) {
  act(() => { fireEvent.click(screen.getByTestId(`card-${id}`)) })
  expect(screen.getByTestId(`open-${id}`).textContent, 'precondition: a tap opens the popover').toBe('true')
}

describe('on touch, a card\'s own portalled popover is INSIDE the card', () => {
  it('tapping a control in the card\'s OWN popover keeps it open', () => {
    render(<Card id="opt_a" />)
    openByTap('opt_a')
    act(() => { fireEvent.pointerDown(screen.getByTestId('more-opt_a')) })
    expect(screen.getByTestId('open-opt_a').textContent).toBe('true')
  })

  it('CONTROL — tapping the page outside closes it', () => {
    render(<Card id="opt_a" />)
    openByTap('opt_a')
    act(() => { fireEvent.pointerDown(document.body) })
    expect(screen.getByTestId('open-opt_a').textContent).toBe('false')
  })

  it('CONTROL — another node\'s portal is NOT this card\'s', () => {
    render(<><Card id="opt_a" /><Card id="opt_b" /></>)
    openByTap('opt_a')
    // A stray portal owned by opt_b, as NodePopover would render it.
    const foreign = document.createElement('div')
    foreign.setAttribute('data-node-popover', 'opt_b')
    const btn = document.createElement('button')
    foreign.appendChild(btn)
    document.body.appendChild(foreign)
    act(() => { fireEvent.pointerDown(btn) })
    expect(screen.getByTestId('open-opt_a').textContent).toBe('false')
    foreign.remove()
  })
})
