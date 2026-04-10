import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MissingKnowledgePrompt } from '../MissingKnowledgePrompt'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'

describe('MissingKnowledgePrompt', () => {
  const sendMock = vi.fn()

  beforeEach(() => {
    sendMock.mockClear()
    // Register _sendMessage so DiscussWithAiButton renders
    useGuidanceStore.setState({ _sendMessage: sendMock })
  })

  it('renders the prompt text and sparkle button', () => {
    render(<MissingKnowledgePrompt />)
    expect(screen.getByText(/Something missing from the model/)).toBeInTheDocument()
    expect(screen.getByTestId('discuss-with-ai')).toBeInTheDocument()
  })

  it('sends pre-filled message when sparkle is clicked', () => {
    render(<MissingKnowledgePrompt />)

    fireEvent.click(screen.getByTestId('discuss-with-ai'))

    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith(
      expect.stringContaining('add something to the model'),
    )
  })

  it('does not render sparkle when guidance store has no sendMessage', () => {
    useGuidanceStore.setState({ _sendMessage: null, _prefillChat: null })
    render(<MissingKnowledgePrompt />)
    expect(screen.queryByTestId('discuss-with-ai')).not.toBeInTheDocument()
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
