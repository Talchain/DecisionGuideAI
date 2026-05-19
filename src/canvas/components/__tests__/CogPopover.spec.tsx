/**
 * CogPopover — items, dismissal, focus restoration.
 *
 * Tests addendum J (Attach evidence falls back to Coming soon when no
 * file-picker is wired) plus the brief's dismissal rules (outside click,
 * Escape, item selection) and focus restoration.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CogPopover } from '../CogPopover'

// debug flag controls visibility of the dev model selector item.
vi.mock('../../../flags', () => ({
  isDebugEnabled: () => false,
}))

function setup(props: Partial<React.ComponentProps<typeof CogPopover>> = {}) {
  const anchor = document.createElement('button')
  anchor.setAttribute('aria-label', 'Settings')
  anchor.textContent = 'cog'
  document.body.appendChild(anchor)
  anchor.focus()

  const onClose = vi.fn()
  const utils = render(
    <CogPopover isOpen={true} anchorEl={anchor} onClose={onClose} {...props} />,
  )
  return { anchor, onClose, ...utils }
}

afterEach(() => {
  // Clean up anchors created in setup().
  document.body.querySelectorAll('button[aria-label="Settings"]').forEach((el) => el.remove())
})

describe('CogPopover', () => {
  it('Attach / Voice / Depth all render as Coming soon by default (no host wiring)', () => {
    // Attach evidence is intentionally Coming soon until the orchestrator
    // turn API gains a file parameter — see CogPopover header doc.
    setup()
    expect(screen.getByTestId('cog-popover')).toBeInTheDocument()
    expect(screen.getByTestId('cog-popover-attach')).toBeDisabled()
    expect(screen.getByTestId('cog-popover-voice')).toBeDisabled()
    expect(screen.getByTestId('cog-popover-depth')).toBeDisabled()
    const badges = screen.getAllByText('Coming soon')
    expect(badges.length).toBe(3)
  })

  it('renders an "Assistant options" heading and uses "Attach" (not "Attach evidence") as the menu label', () => {
    setup()
    expect(screen.getByTestId('cog-popover-heading')).toHaveTextContent(/Assistant options/i)
    const attachBtn = screen.getByTestId('cog-popover-attach')
    expect(attachBtn).toHaveTextContent(/^\s*Attach\s*Coming soon\s*$/i)
    expect(attachBtn).not.toHaveTextContent(/evidence/i)
  })

  it('Attach evidence becomes functional ONLY when onAttachEvidence is supplied', () => {
    const onAttachEvidence = vi.fn()
    const { onClose } = setup({ onAttachEvidence })
    const attach = screen.getByTestId('cog-popover-attach')
    expect(attach).not.toBeDisabled()
    fireEvent.click(attach)
    expect(onAttachEvidence).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Attach evidence is inert when no host handler is wired (matches current default)', () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByTestId('cog-popover-attach'))
    // Disabled buttons should NOT trigger the popover close.
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Voice mode and Decision depth are disabled (cannot be selected)', () => {
    const { onClose } = setup()
    const voice = screen.getByTestId('cog-popover-voice')
    const depth = screen.getByTestId('cog-popover-depth')
    expect(voice).toBeDisabled()
    expect(depth).toBeDisabled()
    fireEvent.click(voice)
    fireEvent.click(depth)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('dismisses on Escape', () => {
    const { onClose } = setup()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('dismisses on outside mousedown', () => {
    const { onClose } = setup()
    const stranger = document.createElement('div')
    document.body.appendChild(stranger)
    fireEvent.mouseDown(stranger)
    expect(onClose).toHaveBeenCalled()
    stranger.remove()
  })

  it('dismisses on outside pointerdown (touch coverage)', () => {
    const { onClose } = setup()
    const stranger = document.createElement('div')
    document.body.appendChild(stranger)
    fireEvent.pointerDown(stranger)
    expect(onClose).toHaveBeenCalled()
    stranger.remove()
  })

  it('does NOT dismiss on mousedown inside the popover', () => {
    const { onClose } = setup()
    fireEvent.mouseDown(screen.getByTestId('cog-popover'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does NOT dismiss on pointerdown inside the popover (touch tap on content)', () => {
    const { onClose } = setup()
    fireEvent.pointerDown(screen.getByTestId('cog-popover'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('returns focus to the anchor after close', () => {
    const anchor = document.createElement('button')
    anchor.setAttribute('aria-label', 'Settings')
    anchor.tabIndex = 0
    document.body.appendChild(anchor)
    const onClose = vi.fn()
    const { rerender } = render(<CogPopover isOpen={true} anchorEl={anchor} onClose={onClose} />)
    // Move focus elsewhere while popover is open
    const other = document.createElement('button')
    document.body.appendChild(other)
    other.focus()
    expect(document.activeElement).toBe(other)
    // Close the popover
    rerender(<CogPopover isOpen={false} anchorEl={anchor} onClose={onClose} />)
    expect(document.activeElement).toBe(anchor)
    anchor.remove()
    other.remove()
  })
})
