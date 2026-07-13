import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MissingKnowledgePrompt } from '@/components/shared/MissingKnowledgePrompt'
import { DiscussWithAiButton } from '@/canvas/components/pre-analysis/DiscussWithAiButton'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'
import { useAskOlumiStore } from '@/components/results/coaching/askOlumiStore'

describe('MissingKnowledgePrompt', () => {
  const sendMock = vi.fn()

  beforeEach(() => {
    sendMock.mockClear()
    // Register _sendMessage so DiscussWithAiButton renders
    useGuidanceStore.setState({ _sendMessage: sendMock })
    useAskOlumiStore.setState({ isOpen: false, draft: '' })
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

  // Parity P7a: the sparkle no longer auto-sends into a conversation the
  // user may not see — it opens the Work-through-it-with-Olumi drawer with
  // the prompt PREFILLED and EDITABLE. Send happens in the drawer.
  it('opens the Ask-Olumi drawer prefilled when sparkle is clicked (no invisible auto-send)', () => {
    render(<MissingKnowledgePrompt context="model" aiAffordance={aiAffordance} />)

    fireEvent.click(screen.getByTestId('discuss-with-ai'))

    expect(sendMock).not.toHaveBeenCalled()
    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)
    expect(drawer.draft).toContain('add something to the model')
  })

  it('does not render sparkle when no aiAffordance passed', () => {
    render(<MissingKnowledgePrompt context="model" />)
    expect(screen.queryByTestId('discuss-with-ai')).not.toBeInTheDocument()
  })

  it('renders results-context AI affordance with the results-specific aria-label', () => {
    // Brief 5.5 close-out P1.1 regression: ResultsBody must pass an aiAffordance
    // matching the original (pre-D3) results-surface contract — sparkle button
    // present, with results-specific aria-label.
    const resultsAffordance = (
      <DiscussWithAiButton element={{ kind: 'missing' }} ariaLabel="Tell AI about something missing from the results" />
    )
    render(<MissingKnowledgePrompt context="results" aiAffordance={resultsAffordance} />)
    expect(screen.getByText(/Something missing from the results/)).toBeInTheDocument()
    const btn = screen.getByTestId('discuss-with-ai')
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-label', 'Tell AI about something missing from the results')
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
