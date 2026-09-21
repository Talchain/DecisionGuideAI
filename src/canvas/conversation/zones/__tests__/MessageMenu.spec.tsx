/**
 * MessageMenu — one discreet control carries everything four scattered ones did.
 *
 * ## Why this file replaces four
 *
 * The per-message actions lived on two surfaces — a floating `MessageActions`
 * bar (Copy, Retry) that cost every message a 32px reserved gutter, and a
 * persistent `FollowUpActions` row (Explain more, Summarise) repeated under
 * every assistant turn. Both are retired into `MessageMenu`.
 *
 * ⚠⚠ CONSOLIDATION IS NOT PERMISSION TO DROP GUARDS. The retired specs
 * (`MessageActions.spec`, `MessageActions.controls.spec`, `MessageBubble.actions.spec`,
 * `MessageBubble.followUpLegible.spec`) protected properties that are about the
 * ACTS, not about where the buttons sat: role asymmetry, the exact
 * British-English prompt strings, the single-flight guard, accessible names, a
 * keyboard route, visible labels, and — the one that had already been fixed
 * once for swallowing failure (L-72) — that Copy REPORTS its outcome. Every one
 * of those is re-asserted here against the new surface. Only the assertions
 * about the OLD GEOMETRY are gone, because the geometry is gone.
 *
 * ⛔ TWO ASSERTIONS ARE DELIBERATELY INVERTED, and both are stated rather than
 * quietly dropped:
 *   · "ChatMessage reserves exactly that gutter" → it now reserves NONE. The
 *     gutter existed to keep an absolutely-positioned bar off the first line of
 *     text; an inline control needs no band. Pinned in ChatMessage's own spec.
 *   · "both glyphs render at the standalone-control size" (16px) → menu glyphs
 *     render at `ICON_DENSE` (12px). A 16px glyph was right for a standalone
 *     button floating over the thread; inside a dense menu row it is the panel's
 *     dense tier. The property that MATTERED — the glyph is decorative and the
 *     button's name is its visible label, never the icon — is re-asserted below.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MessageMenu } from '../MessageMenu'

const EXPLAIN_PROMPT = 'Please explain that in more detail.'
const SUMMARISE_PROMPT = 'Please summarise that as concise bullets.'

function openMenu() {
  fireEvent.click(screen.getByTestId('message-menu-trigger'))
  return screen.getByTestId('message-menu-items')
}

let clipboardSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  clipboardSpy = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: clipboardSpy },
    configurable: true,
    writable: true,
  })
})
afterEach(() => vi.restoreAllMocks())

// ---------------------------------------------------------------------------
// Which acts exist — the role asymmetry, carried from MessageActions
// ---------------------------------------------------------------------------

describe('which acts the menu offers', () => {
  it('offers only Copy on a user message', () => {
    render(<MessageMenu role="user" content="hi" />)
    openMenu()
    expect(screen.getByTestId('message-menu-copy')).toBeInTheDocument()
    expect(screen.queryByTestId('message-menu-retry')).toBeNull()
    expect(screen.queryByTestId('message-menu-explain')).toBeNull()
  })

  it('offers Copy and Retry on an assistant message', () => {
    render(<MessageMenu role="assistant" content="hi" onRetry={vi.fn()} />)
    openMenu()
    expect(screen.getByTestId('message-menu-copy')).toBeInTheDocument()
    expect(screen.getByTestId('message-menu-retry')).toBeInTheDocument()
  })

  it('omits Retry when no handler was given — never a dead control', () => {
    render(<MessageMenu role="assistant" content="hi" />)
    openMenu()
    expect(screen.queryByTestId('message-menu-retry')).toBeNull()
  })

  it('omits BOTH follow-ups when nothing can send them', () => {
    // The old row had this gate and it must not widen on consolidation: an
    // affordance that cannot be honoured is worse than an absent one.
    render(<MessageMenu role="assistant" content="hi" onRetry={vi.fn()} />)
    openMenu()
    expect(screen.queryByTestId('message-menu-explain')).toBeNull()
    expect(screen.queryByTestId('message-menu-summarise')).toBeNull()
  })

  it('CONTROL — the follow-ups DO appear when a sender is wired', () => {
    render(<MessageMenu role="assistant" content="hi" onSendFollowUp={vi.fn()} />)
    openMenu()
    expect(screen.getByTestId('message-menu-explain')).toBeInTheDocument()
    expect(screen.getByTestId('message-menu-summarise')).toBeInTheDocument()
  })

  it('never offers a follow-up on a USER message', () => {
    render(<MessageMenu role="user" content="hi" onSendFollowUp={vi.fn()} />)
    openMenu()
    expect(screen.queryByTestId('message-menu-explain')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// The acts themselves — exact producer-facing strings, carried verbatim
// ---------------------------------------------------------------------------

describe('what the acts actually do', () => {
  it('sends the British-English explain prompt, character for character', () => {
    const send = vi.fn()
    render(<MessageMenu role="assistant" content="hi" onSendFollowUp={send} />)
    openMenu()
    fireEvent.click(screen.getByTestId('message-menu-explain'))
    expect(send).toHaveBeenCalledWith(EXPLAIN_PROMPT)
  })

  it('sends the British-English summarise prompt, character for character', () => {
    const send = vi.fn()
    render(<MessageMenu role="assistant" content="hi" onSendFollowUp={send} />)
    openMenu()
    fireEvent.click(screen.getByTestId('message-menu-summarise'))
    expect(send).toHaveBeenCalledWith(SUMMARISE_PROMPT)
  })

  it('fires the retry handler it was given', () => {
    const retry = vi.fn()
    render(<MessageMenu role="assistant" content="hi" onRetry={retry} />)
    openMenu()
    fireEvent.click(screen.getByTestId('message-menu-retry'))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('single-flight: a double click cannot send the same follow-up twice', () => {
    // The old row used a 500ms ref guard. The menu closes on select, which
    // UNMOUNTS the item — a stronger guarantee than a timer, and the reason
    // the timer is not carried over. Asserted because the property matters,
    // not the mechanism.
    const send = vi.fn()
    render(<MessageMenu role="assistant" content="hi" onSendFollowUp={send} />)
    openMenu()
    const item = screen.getByTestId('message-menu-explain')
    fireEvent.click(item)
    fireEvent.click(item)
    expect(send).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Copy reports its outcome — the L-72 fix, carried over rather than re-earned
// ---------------------------------------------------------------------------

describe('copy tells the truth about what happened', () => {
  it('says nothing at rest', () => {
    render(<MessageMenu role="user" content="hi" />)
    expect(screen.getByTestId('message-action-status').textContent).toBe('')
  })

  it('announces success', async () => {
    render(<MessageMenu role="user" content="payload" />)
    openMenu()
    fireEvent.click(screen.getByTestId('message-menu-copy'))
    expect(clipboardSpy).toHaveBeenCalledWith('payload')
    expect(await screen.findByText('Message copied')).toBeInTheDocument()
  })

  it('announces FAILURE instead of swallowing it', async () => {
    clipboardSpy.mockRejectedValue(new Error('denied'))
    render(<MessageMenu role="user" content="payload" />)
    openMenu()
    fireEvent.click(screen.getByTestId('message-menu-copy'))
    expect(await screen.findByText(/Couldn't copy/)).toBeInTheDocument()
  })

  it('announces failure when the clipboard API is absent (insecure origin)', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    render(<MessageMenu role="user" content="payload" />)
    openMenu()
    fireEvent.click(screen.getByTestId('message-menu-copy'))
    expect(await screen.findByText(/Couldn't copy/)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Reachability — names, keyboard, visible labels (carried from followUpLegible)
// ---------------------------------------------------------------------------

describe('every act stays reachable and named', () => {
  it('the trigger has an accessible name and declares its menu', () => {
    render(<MessageMenu role="assistant" content="hi" onSendFollowUp={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: 'Message actions' })
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  it.each([
    ['Copy'],
    ['Retry'],
    ['Explain more'],
    ['Summarise'],
  ])('%s is reachable by its own VISIBLE text, not by a glyph or an sr-only span', (label) => {
    render(
      <MessageMenu role="assistant" content="hi" onRetry={vi.fn()} onSendFollowUp={vi.fn()} />,
    )
    const menu = openMenu()
    const item = within(menu).getByRole('menuitem', { name: label })
    // Visible text: the label is in the item's own textContent, so it cannot be
    // satisfied by an aria-label over a bare icon.
    expect(item.textContent).toContain(label)
    expect(item.querySelector('.sr-only')).toBeNull()
    expect(item.tagName.toLowerCase()).toBe('button')
  })

  it('the glyphs stay decorative — the name is the label, never the icon', () => {
    render(<MessageMenu role="assistant" content="hi" onSendFollowUp={vi.fn()} />)
    const menu = openMenu()
    for (const svg of Array.from(menu.querySelectorAll('svg'))) {
      expect(svg.getAttribute('aria-hidden')).toBe('true')
    }
  })

  it('Escape closes the menu', () => {
    render(<MessageMenu role="assistant" content="hi" onRetry={vi.fn()} />)
    openMenu()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('message-menu-items')).toBeNull()
  })
})
