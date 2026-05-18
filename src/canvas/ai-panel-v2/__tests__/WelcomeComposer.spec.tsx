import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { WelcomeComposer } from '../WelcomeComposer'

afterEach(() => cleanup())

describe('WelcomeComposer (State 1)', () => {
  it('renders the guidance copy + a generous textarea with autoFocus', () => {
    render(<WelcomeComposer onSend={vi.fn()} isThinking={false} onAttach={vi.fn()} />)
    expect(screen.getByTestId('ai-panel-v2-welcome-guidance')).toHaveTextContent(
      /Describe your decision/i,
    )
    const ta = screen.getByTestId('ai-panel-v2-welcome-textarea') as HTMLTextAreaElement
    expect(ta).toBeInTheDocument()
    expect(ta.rows).toBe(3)
  })

  it('Enter sends; Shift+Enter inserts a newline', async () => {
    const onSend = vi.fn()
    render(<WelcomeComposer onSend={onSend} isThinking={false} onAttach={vi.fn()} />)
    const ta = screen.getByTestId('ai-panel-v2-welcome-textarea') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'hello' } })
    await act(async () => {
      fireEvent.keyDown(ta, { key: 'Enter' })
    })
    expect(onSend).toHaveBeenCalledWith('hello')
  })

  it('send button is disabled when isThinking is true', () => {
    render(<WelcomeComposer onSend={vi.fn()} isThinking={true} onAttach={vi.fn()} />)
    expect(screen.getByTestId('ai-panel-v2-welcome-send')).toBeDisabled()
  })

  it('opening the cog popover shows Voice mode + Decision depth as coming-soon', async () => {
    render(<WelcomeComposer onSend={vi.fn()} isThinking={false} onAttach={vi.fn()} />)
    await act(async () => { screen.getByTestId('ai-panel-v2-welcome-cog').click() })
    expect(screen.getByTestId('ai-panel-v2-cog-popover')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-cog-attach')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-cog-voice')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-cog-depth')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-cog-voice')).toBeDisabled()
    expect(screen.getByTestId('ai-panel-v2-cog-depth')).toBeDisabled()
  })
})
