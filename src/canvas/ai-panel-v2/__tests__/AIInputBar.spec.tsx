import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../hooks/useStageAwarePlaceholder', () => ({
  useStageAwarePlaceholder: () => 'Ask about this model…',
}))

import { AIInputBar } from '../AIInputBar'

afterEach(() => cleanup())

function setup(overrides: Partial<{ onSend: (t: string) => void; isThinking: boolean; onAttach: () => void }> = {}) {
  const onSend = vi.fn()
  const onAttach = vi.fn()
  render(
    <AIInputBar
      onSend={overrides.onSend ?? onSend}
      isThinking={overrides.isThinking ?? false}
      onAttach={overrides.onAttach ?? onAttach}
    />,
  )
  return { onSend, onAttach }
}

describe('AIInputBar (step 3 — brief §5.1 compact mockup)', () => {
  it('renders the textarea with the stage-aware placeholder', () => {
    setup()
    const textarea = screen.getByTestId('ai-panel-v2-textarea') as HTMLTextAreaElement
    expect(textarea.placeholder).toBe('Ask about this model…')
  })

  it('renders cog and send buttons stacked in the right corner', () => {
    setup()
    expect(screen.getByTestId('ai-panel-v2-cog')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-send')).toBeInTheDocument()
  })

  it('send is disabled when the textarea is empty', () => {
    setup()
    expect(screen.getByTestId('ai-panel-v2-send')).toBeDisabled()
  })

  it('Enter sends and clears the textarea', async () => {
    const { onSend } = setup()
    const textarea = screen.getByTestId('ai-panel-v2-textarea') as HTMLTextAreaElement
    await userEvent.type(textarea, 'hello world')
    expect(textarea.value).toBe('hello world')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith('hello world')
    expect(textarea.value).toBe('')
  })

  it('Shift+Enter inserts a newline and does not send', async () => {
    const { onSend } = setup()
    const textarea = screen.getByTestId('ai-panel-v2-textarea') as HTMLTextAreaElement
    await userEvent.type(textarea, 'line1')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    // Shift+Enter is not prevented; userEvent typing already handled normal
    // input. The key assertion is that send was NOT called.
    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not send when only whitespace is present', async () => {
    const { onSend } = setup()
    const textarea = screen.getByTestId('ai-panel-v2-textarea')
    await userEvent.type(textarea, '   ')
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('disables send and textarea while isThinking', () => {
    setup({ isThinking: true })
    expect(screen.getByTestId('ai-panel-v2-textarea')).toBeDisabled()
    expect(screen.getByTestId('ai-panel-v2-send')).toBeDisabled()
  })

  it('cog opens the popover and the popover shows Attach evidence', async () => {
    setup()
    expect(screen.queryByTestId('ai-panel-v2-cog-popover')).toBeNull()
    await act(async () => {
      screen.getByTestId('ai-panel-v2-cog').click()
    })
    expect(screen.getByTestId('ai-panel-v2-cog-popover')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-cog-attach')).toHaveTextContent(/attach evidence/i)
  })

  it('clicking Attach in the popover triggers onAttach and closes the popover', async () => {
    const { onAttach } = setup()
    await act(async () => { screen.getByTestId('ai-panel-v2-cog').click() })
    await act(async () => { screen.getByTestId('ai-panel-v2-cog-attach').click() })
    expect(onAttach).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('ai-panel-v2-cog-popover')).toBeNull()
  })

  it('Escape closes the popover (when open)', async () => {
    setup()
    await act(async () => { screen.getByTestId('ai-panel-v2-cog').click() })
    expect(screen.getByTestId('ai-panel-v2-cog-popover')).toBeInTheDocument()
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(screen.queryByTestId('ai-panel-v2-cog-popover')).toBeNull()
  })

  it('outside-click closes the popover', async () => {
    setup()
    await act(async () => { screen.getByTestId('ai-panel-v2-cog').click() })
    expect(screen.getByTestId('ai-panel-v2-cog-popover')).toBeInTheDocument()
    // Capture-phase pointerdown is what the popover listens for now
    // (so mode-control buttons that stopPropagation() on pointerdown
    // still trigger dismiss). Dispatch pointerdown, not mousedown.
    await act(async () => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(screen.queryByTestId('ai-panel-v2-cog-popover')).toBeNull()
  })

  it('returns focus to the cog button after the popover closes via Escape', async () => {
    setup()
    const cogBtn = screen.getByTestId('ai-panel-v2-cog')
    await act(async () => { cogBtn.click() })
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(document.activeElement).toBe(cogBtn)
  })

  it('does NOT close the popover when the user types (key events) in the textarea', async () => {
    // Requirement: popover must not close *unexpectedly while typing*. This
    // models a user who already had the popover open from a previous
    // interaction and then resumes typing — keystrokes alone (no
    // mousedown) must not trigger the outside-click handler.
    setup()
    await act(async () => { screen.getByTestId('ai-panel-v2-cog').click() })
    expect(screen.getByTestId('ai-panel-v2-cog-popover')).toBeInTheDocument()
    const textarea = screen.getByTestId('ai-panel-v2-textarea')
    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'h' })
      fireEvent.keyDown(textarea, { key: 'i' })
    })
    expect(screen.getByTestId('ai-panel-v2-cog-popover')).toBeInTheDocument()
  })
})
