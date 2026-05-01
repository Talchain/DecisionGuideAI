/**
 * Brief 5.8A D5 — Sharpen your thinking accordion tests.
 *
 * Asserts:
 *   - Component renders nothing when both bias triggers and framing
 *     conditions are absent (no empty container).
 *   - Bias-only state: preview shows the highest-priority bias and one
 *     bias card renders in the body (when expanded).
 *   - Framing-only state: preview shows "Framing: ..." and the framing
 *     card chip invokes the supplied handler.
 *   - Combined state: bias fills first, framing fills the remainder, and
 *     the total never exceeds 4 cards.
 *   - Accordion trigger uses aria-expanded.
 *   - DOM-leakage assertion (no fac_/opt_/node_ in rendered output).
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { SharpenYourThinking } from '../SharpenYourThinking'
import type { NormalisedBiasTrigger } from '../PreAnalysisPanel'
import { Frame } from 'lucide-react'

// Lightweight mock for the canvas store + chat store so DiscussWithAiButton
// can resolve a sendMessage handler without crashing the render. The buttons
// don't need to do anything in these tests.
vi.mock('../../../store', () => ({
  useCanvasStore: Object.assign(
    (selector: (state: any) => any) => selector({
      setHighlightedNodes: vi.fn(),
      setHighlightedEdges: vi.fn(),
      sendMessage: vi.fn(),
      prefillChat: vi.fn(),
    }),
    { getState: () => ({ sendMessage: vi.fn(), prefillChat: vi.fn() }) },
  ),
}))

const trigger = (overrides: Partial<NormalisedBiasTrigger> = {}): NormalisedBiasTrigger => ({
  id: 'cee_bias_x',
  icon: Frame,
  title: 'Authority bias',
  subtitle: 'Watch for authority bias on Engineering velocity. Reason text.',
  fullExplanation: 'Reason text.',
  severity: 'medium',
  microInterventionStep: null,
  targetFactorId: 'fac-velocity',
  targetFactorLabel: 'Engineering velocity',
  ...overrides,
})

describe('Brief 5.8A D5 — SharpenYourThinking', () => {
  it('renders nothing when there are no bias triggers and no framing conditions fire', () => {
    const { container } = render(
      <SharpenYourThinking
        biasTriggers={[]}
        hasGoalBaseline
        hasSuccessTarget
        goalHasQuantitativeHint
        onSetCurrentValue={vi.fn()}
        onSetTarget={vi.fn()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the bias preview line when at least one trigger exists', () => {
    render(
      <SharpenYourThinking
        biasTriggers={[trigger({ title: 'Authority bias', subtitle: 'Watch for authority bias on Engineering velocity. Senior stakeholder estimates anchored your figure.' })]}
        hasGoalBaseline
        hasSuccessTarget
        goalHasQuantitativeHint
        onSetCurrentValue={vi.fn()}
        onSetTarget={vi.fn()}
      />,
    )
    const preview = screen.getByTestId('accordion-preview-line')
    expect(preview.textContent).toContain('Authority bias:')
    expect(preview.textContent).toContain('Watch for authority bias on Engineering velocity.')
  })

  it('renders the framing preview when no bias triggers but a framing condition fires', () => {
    render(
      <SharpenYourThinking
        biasTriggers={[]}
        hasGoalBaseline={false}
        hasSuccessTarget
        goalHasQuantitativeHint
        onSetCurrentValue={vi.fn()}
        onSetTarget={vi.fn()}
      />,
    )
    const preview = screen.getByTestId('accordion-preview-line')
    expect(preview.textContent).toContain('Framing:')
    expect(preview.textContent).toContain('No baseline value set on the goal.')
  })

  it('expands to show bias and framing cards (bias fills first)', () => {
    render(
      <SharpenYourThinking
        biasTriggers={[trigger({ id: 'b1', title: 'Authority bias' })]}
        hasGoalBaseline={false}
        hasSuccessTarget={false}
        goalHasQuantitativeHint
        onSetCurrentValue={vi.fn()}
        onSetTarget={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /sharpen your thinking/i }))
    expect(screen.getByTestId('sharpen-bias-b1')).toBeInTheDocument()
    expect(screen.getByTestId('sharpen-framing-no_baseline')).toBeInTheDocument()
    expect(screen.getByTestId('sharpen-framing-no_target')).toBeInTheDocument()
  })

  it('caps total cards at 4 (bias fills first, framing absorbs remainder)', () => {
    const triggers = Array.from({ length: 6 }).map((_, i) => trigger({ id: `b${i}`, title: `Bias ${i}` }))
    render(
      <SharpenYourThinking
        biasTriggers={triggers}
        hasGoalBaseline={false}
        hasSuccessTarget={false}
        goalHasQuantitativeHint
        onSetCurrentValue={vi.fn()}
        onSetTarget={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /sharpen your thinking/i }))
    // Match the bias card testids (sharpen-bias-{id}) — there should be at most 4 cards rendered total.
    const allCards = screen.queryAllByTestId(/^sharpen-(bias|framing)-/)
    expect(allCards.length).toBe(4)
  })

  it('fires onSetCurrentValue when the framing chip for no_baseline is clicked', () => {
    const onSetCurrentValue = vi.fn()
    render(
      <SharpenYourThinking
        biasTriggers={[]}
        hasGoalBaseline={false}
        hasSuccessTarget
        goalHasQuantitativeHint
        onSetCurrentValue={onSetCurrentValue}
        onSetTarget={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /sharpen your thinking/i }))
    const card = screen.getByTestId('sharpen-framing-no_baseline')
    fireEvent.click(within(card).getByRole('button', { name: 'Set current value' }))
    expect(onSetCurrentValue).toHaveBeenCalledTimes(1)
  })

  it('fires onSetTarget when the framing chip for no_target is clicked', () => {
    const onSetTarget = vi.fn()
    render(
      <SharpenYourThinking
        biasTriggers={[]}
        hasGoalBaseline
        hasSuccessTarget={false}
        goalHasQuantitativeHint
        onSetCurrentValue={vi.fn()}
        onSetTarget={onSetTarget}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /sharpen your thinking/i }))
    const card = screen.getByTestId('sharpen-framing-no_target')
    fireEvent.click(within(card).getByRole('button', { name: 'Set target' }))
    expect(onSetTarget).toHaveBeenCalledTimes(1)
  })

  it('exposes aria-expanded on the trigger', () => {
    render(
      <SharpenYourThinking
        biasTriggers={[trigger()]}
        hasGoalBaseline
        hasSuccessTarget
        goalHasQuantitativeHint
        onSetCurrentValue={vi.fn()}
        onSetTarget={vi.fn()}
      />,
    )
    const button = screen.getByRole('button', { name: /sharpen your thinking/i })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
  })

  it('survives a rerender from empty to populated without a hook-order error (Rules of Hooks)', () => {
    // Regression test: previously the preview-line useMemo lived AFTER the
    // `cards.length === 0` early return, which violates the Rules of Hooks
    // (hook count must be stable across renders). Toggling from empty →
    // populated would fire a "rendered more hooks than during the previous
    // render" warning and crash in strict mode.
    const Harness = ({ withTriggers }: { withTriggers: boolean }) => (
      <SharpenYourThinking
        biasTriggers={withTriggers ? [trigger()] : []}
        hasGoalBaseline
        hasSuccessTarget
        goalHasQuantitativeHint
        onSetCurrentValue={vi.fn()}
        onSetTarget={vi.fn()}
      />
    )
    const { rerender } = render(<Harness withTriggers={false} />)
    // Toggle to populated.
    rerender(<Harness withTriggers />)
    // Toggle back to empty.
    rerender(<Harness withTriggers={false} />)
    // And populated again — three transitions, all stable.
    rerender(<Harness withTriggers />)
    expect(screen.getByRole('button', { name: /sharpen your thinking/i })).toBeInTheDocument()
  })

  it('does not leak fac_/opt_/node_ id prefixes into the rendered output', () => {
    const { container } = render(
      <SharpenYourThinking
        biasTriggers={[trigger({ targetFactorId: 'fac-velocity' })]}
        hasGoalBaseline={false}
        hasSuccessTarget
        goalHasQuantitativeHint
        onSetCurrentValue={vi.fn()}
        onSetTarget={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /sharpen your thinking/i }))
    const html = container.innerHTML
    expect(html).not.toMatch(/\bfac_/)
    expect(html).not.toMatch(/\bopt_/)
    expect(html).not.toMatch(/\bnode_/)
    expect(html).not.toMatch(/fac-velocity/)
  })
})
