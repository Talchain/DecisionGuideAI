/**
 * TriageCard × DiscussWithAiButton integration — Brief 5.7 close-out follow-up.
 *
 * The shared `TriageCard` no longer owns the canvas-specific
 * `DiscussWithAiButton`; consumers inject it via the `aiDiscussSlot` prop.
 * This test exercises the real path end-to-end: render TriageCard with a
 * real `<DiscussWithAiButton element={…}>` in the slot, click the button,
 * and assert the canvas guidance store's `_sendMessage` fires with the
 * prompt text built from the AI-discuss element.
 *
 * Lives in `src/canvas/components/pre-analysis/__tests__/` (consumer side)
 * because the canvas-store dependency is legitimate here — it cannot be
 * imported from `src/components/shared/__tests__/` per the dependency-
 * direction gate (`rg "from '@/canvas" src/components/shared/` must be 0).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TriageCard } from '@/components/shared/TriageCard'
import { DiscussWithAiButton } from '@/canvas/components/pre-analysis/DiscussWithAiButton'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'

describe('TriageCard × DiscussWithAiButton aiDiscussSlot integration', () => {
  const sendMock = vi.fn()

  beforeEach(() => {
    sendMock.mockClear()
    // Register _sendMessage so DiscussWithAiButton actually renders + fires.
    useGuidanceStore.setState({ _sendMessage: sendMock, _prefillChat: null })
  })

  it('routes a click on the slot button into the guidance store', () => {
    render(
      <TriageCard
        cardKey="k1"
        ordinal={1}
        title="Engineering velocity"
        detail="AI estimate of the team's throughput."
        category="verify"
        action={{ kind: 'confirm', label: 'Confirm', targetId: 'fac-1', targetType: 'node' }}
        sourcePill={{ label: 'AI estimate', borderClass: 'border-info/30' }}
        aiDiscussSlot={
          <DiscussWithAiButton
            element={{ kind: 'factor', label: 'Engineering velocity' }}
          />
        }
      />,
    )

    const button = screen.getByTestId('discuss-with-ai')
    expect(button).toBeInTheDocument()

    fireEvent.click(button)

    expect(sendMock).toHaveBeenCalledTimes(1)
    // Prompt text built by buildAiDiscussPrompt for a factor element should
    // mention the factor label. The exact wording is owned by
    // buildAiDiscussPrompt; we assert containment, not equality.
    const [prompt] = sendMock.mock.calls[0] as [string]
    expect(prompt).toContain('Engineering velocity')
  })

  it('renders no discuss button when aiDiscussSlot is undefined, even with a registered store handler', () => {
    render(
      <TriageCard
        cardKey="k2"
        ordinal={2}
        title="Other factor"
        detail="No AI discussion attached."
        category="verify"
        sourcePill={{ label: 'AI estimate', borderClass: 'border-info/30' }}
      />,
    )

    expect(screen.queryByTestId('discuss-with-ai')).not.toBeInTheDocument()
    fireEvent.click(document.body) // sanity
    expect(sendMock).not.toHaveBeenCalled()
  })
})
