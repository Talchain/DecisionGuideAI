/**
 * ROADMAP 1.42 — Show-reasoning progressive disclosure (Paul ruled
 * VERBATIM-with-label).
 *
 * Verifies:
 *  - collapsed by default when `message.reasoning` is present and the flag
 *    is on
 *  - expands on click, header reads EXACTLY "Model reasoning (verbatim)"
 *  - byte-verbatim rendering, including a literal `<script>` string —
 *    rendered as inert TEXT, never executed (pins the XSS-safety property:
 *    no dangerouslySetInnerHTML / markdown pipeline for this panel)
 *  - absent `reasoning` renders nothing, even with the flag on
 *  - flag off renders nothing, even with `reasoning` present
 */
import { describe, it, expect, vi } from 'vitest'

let mockReasoningDisclosureEnabled = true

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isReasoningDisclosureEnabled: () => mockReasoningDisclosureEnabled,
  }
})

import { render, screen, fireEvent } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'
import type { ConversationMessage } from '../types'

function makeMsg(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    content: 'The answer is 42.',
    timestamp: new Date(),
    ...overrides,
  }
}

const noop = async () => {}

describe('MessageBubble — reasoning disclosure (ROADMAP 1.42)', () => {
  it('collapsed by default: toggle renders, panel does not', () => {
    mockReasoningDisclosureEnabled = true
    render(
      <MessageBubble message={makeMsg({ reasoning: 'Because X implies Y.' })} onChipClick={noop} />,
    )
    expect(screen.getByTestId('message-show-reasoning')).toBeTruthy()
    expect(screen.getByTestId('message-show-reasoning').getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('message-reasoning-panel')).toBeNull()
  })

  it('expands on click, with the exact "Model reasoning (verbatim)" header', () => {
    mockReasoningDisclosureEnabled = true
    render(
      <MessageBubble message={makeMsg({ reasoning: 'Because X implies Y.' })} onChipClick={noop} />,
    )
    const toggle = screen.getByTestId('message-show-reasoning')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const panel = screen.getByTestId('message-reasoning-panel')
    expect(panel).toBeTruthy()
    expect(panel.textContent).toContain('Model reasoning (verbatim)')
    // Exact header text, not a substring match on a longer heading.
    const heading = Array.from(panel.querySelectorAll('p')).find(
      (p) => p.textContent === 'Model reasoning (verbatim)',
    )
    expect(heading).toBeTruthy()
  })

  it('collapses again on a second click', () => {
    mockReasoningDisclosureEnabled = true
    render(
      <MessageBubble message={makeMsg({ reasoning: 'Because X implies Y.' })} onChipClick={noop} />,
    )
    const toggle = screen.getByTestId('message-show-reasoning')
    fireEvent.click(toggle)
    expect(screen.getByTestId('message-reasoning-panel')).toBeTruthy()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByTestId('message-reasoning-panel')).toBeNull()
  })

  it('renders reasoning byte-verbatim, including a literal <script> tag shown as inert text (not executed)', () => {
    mockReasoningDisclosureEnabled = true
    const payload = 'Step 1: assume X.\n\nStep 2: <script>alert(1)</script> therefore Y.'
    render(<MessageBubble message={makeMsg({ reasoning: payload })} onChipClick={noop} />)
    fireEvent.click(screen.getByTestId('message-show-reasoning'))
    const panel = screen.getByTestId('message-reasoning-panel')
    // The panel's innerHTML must show the tag as ESCAPED text (&lt;script&gt;),
    // never as a literal, parseable <script> element — proof no
    // dangerouslySetInnerHTML / markdown pipeline touched this string.
    expect(panel.querySelector('script')).toBeNull()
    expect(panel.innerHTML).toContain('&lt;script&gt;')
    // And the textContent is exactly the source string (verbatim), whitespace
    // and all — no markdown transform, no trimming, no collapsing of blank lines.
    expect(panel.textContent).toContain(payload)
  })

  it('renders nothing when reasoning is absent, even with the flag on', () => {
    mockReasoningDisclosureEnabled = true
    render(<MessageBubble message={makeMsg()} onChipClick={noop} />)
    expect(screen.queryByTestId('message-show-reasoning')).toBeNull()
    expect(screen.queryByTestId('message-reasoning-panel')).toBeNull()
  })

  it('renders nothing when the flag is off, even with reasoning present', () => {
    mockReasoningDisclosureEnabled = false
    render(
      <MessageBubble message={makeMsg({ reasoning: 'Because X implies Y.' })} onChipClick={noop} />,
    )
    expect(screen.queryByTestId('message-show-reasoning')).toBeNull()
    expect(screen.queryByTestId('message-reasoning-panel')).toBeNull()
  })

  it('never renders the reasoning toggle on user messages', () => {
    mockReasoningDisclosureEnabled = true
    render(
      <MessageBubble
        message={makeMsg({ role: 'user', reasoning: 'Should never appear' })}
        onChipClick={noop}
      />,
    )
    expect(screen.queryByTestId('message-show-reasoning')).toBeNull()
  })
})
