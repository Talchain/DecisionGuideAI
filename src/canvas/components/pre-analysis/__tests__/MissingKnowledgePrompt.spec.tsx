import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MissingKnowledgePrompt } from '../MissingKnowledgePrompt'

describe('MissingKnowledgePrompt', () => {
  it('renders the prompt text and Tell the AI button', () => {
    render(<MissingKnowledgePrompt />)
    expect(screen.getByText(/Know something the model/)).toBeInTheDocument()
    expect(screen.getByText('Tell the AI')).toBeInTheDocument()
  })

  it('shows input when Tell the AI is clicked', () => {
    render(<MissingKnowledgePrompt />)
    fireEvent.click(screen.getByText('Tell the AI'))
    expect(screen.getByPlaceholderText(/regulatory changes/)).toBeInTheDocument()
  })

  it('sends message with user input on submit', () => {
    const onSend = vi.fn()
    render(<MissingKnowledgePrompt onSendMessage={onSend} />)

    fireEvent.click(screen.getByText('Tell the AI'))
    const input = screen.getByPlaceholderText(/regulatory changes/)
    fireEvent.change(input, { target: { value: 'New tariffs expected Q2' } })
    fireEvent.click(screen.getByText('Send'))

    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith(
      expect.stringContaining('New tariffs expected Q2')
    )
  })

  it('does not send when input is empty', () => {
    const onSend = vi.fn()
    render(<MissingKnowledgePrompt onSendMessage={onSend} />)

    fireEvent.click(screen.getByText('Tell the AI'))
    fireEvent.click(screen.getByText('Send'))

    expect(onSend).not.toHaveBeenCalled()
  })

  it('dismisses on X click', () => {
    render(<MissingKnowledgePrompt />)
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(screen.queryByText(/Know something/)).not.toBeInTheDocument()
  })

  it('cancels input on Escape', () => {
    render(<MissingKnowledgePrompt />)
    fireEvent.click(screen.getByText('Tell the AI'))
    const input = screen.getByPlaceholderText(/regulatory changes/)
    fireEvent.keyDown(input, { key: 'Escape' })
    // Input should be hidden, Tell the AI button visible again
    expect(screen.getByText('Tell the AI')).toBeInTheDocument()
  })

  it('sends on Enter key', () => {
    const onSend = vi.fn()
    render(<MissingKnowledgePrompt onSendMessage={onSend} />)

    fireEvent.click(screen.getByText('Tell the AI'))
    const input = screen.getByPlaceholderText(/regulatory changes/)
    fireEvent.change(input, { target: { value: 'Market shift' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSend).toHaveBeenCalledWith(expect.stringContaining('Market shift'))
  })
})
