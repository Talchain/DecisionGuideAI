import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MissingKnowledgePrompt } from '../MissingKnowledgePrompt'

describe('MissingKnowledgePrompt', () => {
  it('renders the prompt text and Tell the AI button', () => {
    render(<MissingKnowledgePrompt />)
    expect(screen.getByText(/Something missing from the model/)).toBeInTheDocument()
    expect(screen.getByText(/Tell the AI/)).toBeInTheDocument()
  })

  it('sends pre-filled message when Tell the AI is clicked', () => {
    const onSend = vi.fn()
    render(<MissingKnowledgePrompt onSendMessage={onSend} />)

    fireEvent.click(screen.getByText(/Tell the AI/))

    expect(onSend).toHaveBeenCalledTimes(1)
    expect(onSend).toHaveBeenCalledWith(
      expect.stringContaining('add something to the model'),
    )
  })

  it('does not crash when onSendMessage is not provided', () => {
    render(<MissingKnowledgePrompt />)
    // Should not throw when clicked without handler
    fireEvent.click(screen.getByText(/Tell the AI/))
  })

  it('dismisses on X click', () => {
    render(<MissingKnowledgePrompt />)
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(screen.queryByText(/Something missing/)).not.toBeInTheDocument()
  })

  it('stays dismissed after dismiss', () => {
    const { container } = render(<MissingKnowledgePrompt />)
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(container.querySelector('[class*="rounded-lg"]')).toBeNull()
  })
})
