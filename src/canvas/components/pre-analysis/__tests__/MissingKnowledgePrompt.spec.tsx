import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MissingKnowledgePrompt } from '@/components/shared/MissingKnowledgePrompt'
import { DiscussWithAiButton } from '@/canvas/components/pre-analysis/DiscussWithAiButton'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'

describe('MissingKnowledgePrompt', () => {
  const sendMock = vi.fn()

  beforeEach(() => {
    sendMock.mockClear()
    // Register _sendMessage so DiscussWithAiButton renders
    useGuidanceStore.setState({ _sendMessage: sendMock })
  })

  // Helper: renders with the DiscussWithAiButton passed as aiAffordance prop
  // (the canvas-specific button is now injected by the caller, not hardcoded)
  const aiAffordance = (
    <DiscussWithAiButton element={{ kind: 'missing' }} ariaLabel="Tell AI about something missing from the model" />
  )

  it('renders the prompt text and sparkle button', () => {
    render(<MissingKnowledgePrompt context="model" aiAffordance={aiAffordance} />)
    expect(screen.getByText(/Something missing from the model/)).toBeInTheDocument()
    expect(screen.getByTestId('discuss-with-ai')).toBeInTheDocument()
  })

  it('sends pre-filled message when sparkle is clicked', () => {
    render(<MissingKnowledgePrompt context="model" aiAffordance={aiAffordance} />)

    fireEvent.click(screen.getByTestId('discuss-with-ai'))

    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock).toHaveBeenCalledWith(
      expect.stringContaining('add something to the model'),
    )
  })

  it('does not render sparkle when no aiAffordance passed', () => {
    // When no aiAffordance is provided (e.g. results surface), no button renders.
    render(<MissingKnowledgePrompt context="model" />)
    expect(screen.queryByTestId('discuss-with-ai')).not.toBeInTheDocument()
  })

  it('dismisses on X click', () => {
    render(<MissingKnowledgePrompt context="model" />)
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(screen.queryByText(/Something missing/)).not.toBeInTheDocument()
  })

  it('stays dismissed after dismiss', () => {
    const { container } = render(<MissingKnowledgePrompt context="model" />)
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(container.querySelector('[class*="rounded-lg"]')).toBeNull()
  })

  // ── Brief 5.3 Task 11 + 12 regressions ──────────────────────────

  it('shows helper copy below the main prompt text', () => {
    render(<MissingKnowledgePrompt context="model" />)
    expect(screen.getByText(/Describe what's missing and Olumi will suggest/)).toBeInTheDocument()
  })

  it('dismiss button has aria-label "Dismiss"', () => {
    render(<MissingKnowledgePrompt context="model" />)
    const btn = screen.getByLabelText('Dismiss')
    expect(btn).toBeInTheDocument()
    expect(btn.tagName).toBe('BUTTON')
  })

  it('dismiss button has focus-visible ring classes (keyboard accessibility)', () => {
    render(<MissingKnowledgePrompt context="model" />)
    const btn = screen.getByLabelText('Dismiss')
    // focus-visible ring applied via Tailwind — guard the class string so a
    // future refactor cannot silently drop keyboard focus affordance.
    expect(btn.className).toContain('focus-visible:ring-1')
    expect(btn.className).toContain('focus-visible:ring-info')
  })
})
