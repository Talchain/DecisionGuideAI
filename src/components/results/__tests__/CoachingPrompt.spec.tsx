/**
 * CoachingPrompt — UI-BUG-7: the prompt uses the standard DiscussWithAiButton
 * sparkle, not the legacy Target + "Tell the AI" text pill.
 */

import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CoachingPrompt } from '../CoachingPrompt'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'

describe('CoachingPrompt (UI-BUG-7)', () => {
  beforeEach(() => {
    useGuidanceStore.setState({ _sendMessage: vi.fn() })
  })
  afterEach(() => {
    useGuidanceStore.setState({ _sendMessage: null, _prefillChat: null })
  })

  it('renders the standard Discuss-with-AI sparkle', () => {
    render(<CoachingPrompt />)
    expect(screen.getByTestId('discuss-with-ai')).toBeInTheDocument()
  })

  it('does not render the legacy "Tell the AI" text pill', () => {
    render(<CoachingPrompt />)
    expect(screen.queryByText('Tell the AI')).not.toBeInTheDocument()
  })

  it('keeps the dismiss button', () => {
    render(<CoachingPrompt />)
    expect(screen.getByLabelText('Dismiss coaching prompt')).toBeInTheDocument()
  })
})
