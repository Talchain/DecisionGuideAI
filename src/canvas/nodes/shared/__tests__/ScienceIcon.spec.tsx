/**
 * ScienceIcon — popover + "discuss with AI" affordance.
 *
 * Bias-coaching slice (proposal 2026-07-16 §2 EXPLORE surface / §1.5(2)): the
 * single useScienceIcons/ScienceIcon node-icon system is the EXPLORE bias
 * channel, and its disclosure shape is "icon -> popover -> discuss with AI
 * turn". This restores the one genuinely-lost affordance from the retired
 * node-level BiasIcon generation (est. #2): an explicit disclosure step with a
 * labelled AI link, instead of a bare click that silently fired a message.
 *
 * Passthrough: the popover surfaces the already-authored per-trigger `action`
 * string; no wire field, no client-side bias inference.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Anchor } from 'lucide-react'
import { ScienceIcon } from '../ScienceIcon'
import { useGuidanceStore } from '../../../stores/guidanceStore'

const ACTION = 'What could go wrong with doing nothing?'
const TOOLTIP = 'Status quo bias: inaction risks often underestimated.'

function renderIcon() {
  return render(
    <ScienceIcon icon={Anchor} tooltip={TOOLTIP} action={ACTION} colour="text-warning" />,
  )
}

beforeEach(() => {
  useGuidanceStore.setState({ _sendMessage: null })
})
afterEach(() => {
  cleanup()
  useGuidanceStore.setState({ _sendMessage: null })
})

describe('ScienceIcon — disclosure step (icon -> popover)', () => {
  it('does NOT send immediately on icon click; opens a popover instead', () => {
    const send = vi.fn()
    useGuidanceStore.setState({ _sendMessage: send })
    renderIcon()

    // No dialog before the click.
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByLabelText(TOOLTIP))

    // The click reveals the popover and does NOT fire the message (the send is
    // now gated behind an explicit disclosure step).
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(send).not.toHaveBeenCalled()
  })

  it('the popover carries an explicit "Discuss with AI" affordance that sends the action', () => {
    const send = vi.fn()
    useGuidanceStore.setState({ _sendMessage: send })
    renderIcon()

    fireEvent.click(screen.getByLabelText(TOOLTIP))
    const discuss = screen.getByTestId('science-icon-discuss')
    expect(discuss.textContent).toMatch(/discuss with ai/i)

    fireEvent.click(discuss)
    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(ACTION)
    // Sending closes the popover.
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('toggles the popover closed on a second icon click', () => {
    useGuidanceStore.setState({ _sendMessage: vi.fn() })
    renderIcon()
    const btn = screen.getByLabelText(TOOLTIP)

    fireEvent.click(btn)
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(btn)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('still shows the glance tooltip on hover', () => {
    renderIcon()
    fireEvent.mouseEnter(screen.getByLabelText(TOOLTIP))
    expect(screen.getByRole('tooltip')).toBeTruthy()
  })

  it('renders NO dead discuss button when no conversation is registered (honest absence)', () => {
    // _sendMessage stays null (beforeEach) — the popover still explains, but
    // offers no button that would do nothing.
    renderIcon()
    fireEvent.click(screen.getByLabelText(TOOLTIP))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.queryByTestId('science-icon-discuss')).toBeNull()
  })
})

describe('ScienceIcon — popover dismissal (matches CanvasLegendPopover idiom)', () => {
  it('closes the popover on Escape', () => {
    renderIcon()
    fireEvent.click(screen.getByLabelText(TOOLTIP))
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    // RED before the fix: the popover had no Esc handler and stayed open.
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes the popover on an outside click', () => {
    renderIcon()
    fireEvent.click(screen.getByLabelText(TOOLTIP))
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.mouseDown(document.body)
    // RED before the fix: no outside-click handler → stayed open.
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('an inside mousedown (on the icon itself) does NOT dismiss via the outside handler', () => {
    renderIcon()
    const btn = screen.getByLabelText(TOOLTIP)
    fireEvent.click(btn)
    expect(screen.getByRole('dialog')).toBeTruthy()

    // A mousedown that lands inside the wrapper is not an outside click; the
    // popover stays open (the second full click is what toggles it closed).
    fireEvent.mouseDown(btn)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
})
