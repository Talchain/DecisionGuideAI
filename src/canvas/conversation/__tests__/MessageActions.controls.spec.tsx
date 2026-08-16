/**
 * L-72 / L-73 — message controls.
 *
 * L-73 is a LAYOUT claim ("hover controls can cover message text") and jsdom
 * cannot prove layout (platform trap 3). So this file does NOT pretend to
 * measure pixels. It pins the ARITHMETIC CONTRACT that makes overlap
 * impossible, against the SAME exported constants the component and its host
 * consume — so the guard binds the rule rather than a copy of it:
 *
 *     offset + height <= gutter
 *
 * and it pins that `ChatMessage` actually reserves the gutter, by identity.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import {
  ACTION_BAR_GUTTER_PX,
  ACTION_BAR_HEIGHT_PX,
  ACTION_BAR_TOP_OFFSET_PX,
  MessageActions,
} from '../zones/MessageActions'
import { ChatMessage } from '../zones/ChatMessage'
import type { ConversationMessage } from '../types'

const noop = async () => {}

describe('L-73 — the controls have their own band', () => {
  it('the bar cannot extend past the reserved gutter', () => {
    // The load-bearing inequality. A future tweak to any of the three numbers
    // that re-introduces overlap fails HERE, loudly, rather than on a screen.
    expect(ACTION_BAR_TOP_OFFSET_PX + ACTION_BAR_HEIGHT_PX).toBeLessThanOrEqual(
      ACTION_BAR_GUTTER_PX,
    )
  })

  it('the bar reaches UP into the inter-message gap rather than down into the text', () => {
    expect(ACTION_BAR_TOP_OFFSET_PX).toBeLessThan(0)
  })

  it('ChatMessage reserves exactly that gutter above the bubble', () => {
    const message: ConversationMessage = {
      id: 'm1',
      role: 'assistant',
      content: 'A message with text on its first line.',
      timestamp: new Date(),
    }
    render(
      <ChatMessage message={message} isFirst onChipClick={noop} onRetry={() => {}} />,
    )
    const host = screen.getByTestId('chat-message-assistant')
    expect(host.getAttribute('data-actions-gutter-px')).toBe(String(ACTION_BAR_GUTTER_PX))
    expect(host.style.paddingTop).toBe(`${ACTION_BAR_GUTTER_PX}px`)
  })

  it('the bar positions itself from the shared constants, not a local literal', () => {
    render(<MessageActions role="assistant" content="x" onRetry={() => {}} />)
    const bar = screen.getByTestId('message-actions')
    expect(bar.style.top).toBe(`${ACTION_BAR_TOP_OFFSET_PX}px`)
    expect(bar.style.height).toBe(`${ACTION_BAR_HEIGHT_PX}px`)
  })
})

describe('L-72 — control parity', () => {
  it('an Olumi message carries BOTH copy and retry', () => {
    render(<MessageActions role="assistant" content="x" onRetry={() => {}} />)
    expect(screen.getByTestId('message-action-copy')).toBeTruthy()
    expect(screen.getByTestId('message-action-retry')).toBeTruthy()
  })

  it('a user message carries copy and NOT retry — a deliberate asymmetry', () => {
    // Retrying a user message means RE-DELIVERING a failed send, which already
    // has its own affordance on the bubble. Two Retry controls with two
    // meanings under one name is the shape this platform has already paid for.
    render(<MessageActions role="user" content="x" onRetry={() => {}} />)
    expect(screen.getByTestId('message-action-copy')).toBeTruthy()
    expect(screen.queryByTestId('message-action-retry')).toBeNull()
  })

  it('retry fires the handler it was given', () => {
    const onRetry = vi.fn()
    render(<MessageActions role="assistant" content="x" onRetry={onRetry} />)
    fireEvent.click(screen.getByTestId('message-action-retry'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})

describe('L-72 — copy reports what happened', () => {
  const original = navigator.clipboard

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: original,
      configurable: true,
      writable: true,
    })
  })

  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    })
  })

  it('announces success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    })
    render(<MessageActions role="assistant" content="COPY-ME" />)
    fireEvent.click(screen.getByTestId('message-action-copy'))
    expect(writeText).toHaveBeenCalledWith('COPY-ME')
    await waitFor(() =>
      expect(screen.getByTestId('message-action-status').textContent).toBe('Message copied'),
    )
  })

  it('announces FAILURE instead of swallowing it — the "reportedly fail" report', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    })
    render(<MessageActions role="assistant" content="COPY-ME" />)
    fireEvent.click(screen.getByTestId('message-action-copy'))
    await waitFor(() =>
      expect(screen.getByTestId('message-action-status').textContent).toContain("Couldn't copy"),
    )
  })

  it('announces failure when the clipboard API is absent (insecure origin)', async () => {
    // The previous handler called straight through, which THROWS synchronously
    // when `navigator.clipboard` is undefined and never reaches a rejection
    // handler — silence, with the icon animating as if it had worked.
    render(<MessageActions role="assistant" content="COPY-ME" />)
    fireEvent.click(screen.getByTestId('message-action-copy'))
    await waitFor(() =>
      expect(screen.getByTestId('message-action-status').textContent).toContain("Couldn't copy"),
    )
  })

  it('says nothing at rest', () => {
    render(<MessageActions role="assistant" content="COPY-ME" />)
    expect(screen.getByTestId('message-action-status').textContent).toBe('')
  })
})
