import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { MinimisedBar } from '../MinimisedBar'

afterEach(() => cleanup())

describe('MinimisedBar (State 4)', () => {
  it('renders a single-line input + cog + send + expand at 48px tall', () => {
    render(<MinimisedBar onSend={vi.fn()} onExpand={vi.fn()} onAttach={vi.fn()} isThinking={false} />)
    const bar = screen.getByTestId('ai-panel-v2-minimised-bar')
    expect(bar).toBeInTheDocument()
    expect(bar.style.height).toBe('48px')
    expect(screen.getByTestId('ai-panel-v2-minimised-input')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-minimised-cog')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-minimised-send')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-minimised-expand')).toBeInTheDocument()
  })

  it('focusing the input fires onExpand', () => {
    const onExpand = vi.fn()
    render(<MinimisedBar onSend={vi.fn()} onExpand={onExpand} onAttach={vi.fn()} isThinking={false} />)
    const input = screen.getByTestId('ai-panel-v2-minimised-input')
    fireEvent.focus(input)
    expect(onExpand).toHaveBeenCalled()
  })

  it('clicking the expand icon fires onExpand', () => {
    const onExpand = vi.fn()
    render(<MinimisedBar onSend={vi.fn()} onExpand={onExpand} onAttach={vi.fn()} isThinking={false} />)
    screen.getByTestId('ai-panel-v2-minimised-expand').click()
    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  it('Enter sends the input value via onSend', async () => {
    const onSend = vi.fn()
    render(<MinimisedBar onSend={onSend} onExpand={vi.fn()} onAttach={vi.fn()} isThinking={false} />)
    const input = screen.getByTestId('ai-panel-v2-minimised-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'follow-up' } })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(onSend).toHaveBeenCalledWith('follow-up')
  })
})
