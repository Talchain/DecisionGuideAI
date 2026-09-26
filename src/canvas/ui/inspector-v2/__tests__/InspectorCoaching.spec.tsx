/**
 * InspectorCoaching — unit tests
 *
 * Verifies:
 * - Orchestrator GuidanceItems render through CoachingCard visual
 * - Guidance filtered to selected element only
 * - v3.1 (DESIGN-GAP-v31 row 32): NO static fallback — with no grounded
 *   guidance item for the element, nothing renders (the generic lightbulb
 *   card is retired)
 * - "Ask about this" PREFILLS an editable draft and waits (never auto-sends)
 * - Button hidden when _prefillChat and _sendMessage are both null
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { useGuidanceStore, type GuidanceItem } from '../../../stores/guidanceStore'
import { resolveAskTemplate } from '../inspectorStrings'

function makeGuidanceItem(overrides: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    item_id: 'g1',
    signal_code: 'evidence_gap',
    category: 'should_fix',
    source: 'analysis',
    title: 'Orchestrator guidance title',
    detail: 'with detail',
    primary_action: { type: 'discuss', prompt: 'Tell me more about this' },
    target_object: { type: 'node', id: 'node-1', label: 'Test Factor' },
    priority: 80,
    ...overrides,
  }
}

const defaultProps = {
  elementId: 'node-1',
  panelType: 'factor-controllable',
  fallbackText: 'Static coaching fallback text',
  labelContext: { label: 'Marketing Budget' },
}

/**
 * ⚠ DERIVED FROM THE REGISTER, NOT COPIED FROM IT (trap 12). This used to be the
 * literal 'How important is Marketing Budget to the outcome?' in two places — a
 * hand-maintained mirror of `ASK_TEMPLATES['factor-controllable']` that went
 * stale the moment that copy changed. What these two tests are actually about is
 * the CARRIER (prefill, never send), so the question text is resolved from the
 * same register the component reads. The COPY itself is pinned as a property in
 * `askTemplatesHandJudgementBack.spec.ts`.
 */
const EXPECTED_QUESTION = resolveAskTemplate(
  defaultProps.panelType,
  defaultProps.labelContext,
) as string

beforeEach(() => {
  useGuidanceStore.setState({
    guidanceItems: [],
    activeGuidanceItemId: null,
    inspectorDeepLinkField: null,
    _sendMessage: null,
    _runAnalysis: null,
    _sendChip: null,
    _scrollToPatch: null,
    _prefillChat: null,
  })
})

describe('InspectorCoaching', () => {
  it('v3.1: renders NOTHING when no guidance item targets the element — no generic fallback card', () => {
    useGuidanceStore.setState({ _prefillChat: vi.fn() })
    const { container } = render(<InspectorCoaching {...defaultProps} />)
    expect(screen.queryByText('Static coaching fallback text')).toBeNull()
    expect(container.innerHTML).toBe('')
  })

  it('renders orchestrator guidance text when a matching item exists', () => {
    useGuidanceStore.setState({
      guidanceItems: [makeGuidanceItem()],
      _prefillChat: vi.fn(),
    })
    render(<InspectorCoaching {...defaultProps} />)
    expect(screen.getByText(/Orchestrator guidance title/)).toBeTruthy()
    // Static fallback should NOT appear
    expect(screen.queryByText('Static coaching fallback text')).toBeNull()
  })

  it('filters guidance to selected element only — items for other elements do not appear', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        makeGuidanceItem({ item_id: 'other', target_object: { type: 'node', id: 'node-99' }, title: 'Wrong node guidance' }),
      ],
      _prefillChat: vi.fn(),
    })
    const { container } = render(<InspectorCoaching {...defaultProps} />)
    // Not the guidance for node-99 — and, since v3.1, no fallback either.
    expect(screen.queryByText('Wrong node guidance')).toBeNull()
    expect(container.innerHTML).toBe('')
  })

  it('shows highest-priority guidance item when multiple match', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        makeGuidanceItem({ item_id: 'low', priority: 20, title: 'Low priority' }),
        makeGuidanceItem({ item_id: 'high', priority: 90, title: 'High priority' }),
      ],
      _prefillChat: vi.fn(),
    })
    render(<InspectorCoaching {...defaultProps} />)
    expect(screen.getByText(/High priority/)).toBeTruthy()
    expect(screen.queryByText(/Low priority/)).toBeNull()
  })

  /**
   * ⚠ THIS TEST'S EXPECTATION WAS INVERTED, DELIBERATELY (ledger L-18).
   *
   * It previously read: '"Ask about this" SENDS the question via _sendMessage
   * (not _prefillChat)' — and it was a correct pin on the behaviour that
   * shipped. That behaviour is the defect. This component auto-sent while the
   * inspector's OTHER ask affordance (DiscussWithAiButton) prefilled and
   * waited: same intent, opposite semantics, one panel (a trap-21 pair). The
   * auto-send half is the one that lies, because the question lands in a
   * surface the user may not be looking at.
   *
   * The ruling is prefill-and-confirm everywhere (`askSemantic.ts`). This is
   * not a fixture being tidied to match new code — it is a semantic that was
   * ruled against, and the old expectation is recorded above rather than
   * deleted so the reversal is legible.
   */
  // v3.1: the card renders only for a GROUNDED item. An item whose action is
  // not `discuss`/`run_exercise` takes the default arm — the element's own
  // question, under the caller's ask label — which is what these pins cover.
  const ASK_ARM_ITEM = makeGuidanceItem({ primary_action: { type: 'navigate', target: 'x' } })

  it('"Ask about this" PREFILLS the question and does NOT auto-send', () => {
    const prefill = vi.fn()
    const send = vi.fn()
    useGuidanceStore.setState({ guidanceItems: [ASK_ARM_ITEM], _prefillChat: prefill, _sendMessage: send })
    render(<InspectorCoaching {...defaultProps} />)

    const button = screen.getByText('Ask about this')
    fireEvent.click(button)

    expect(send).not.toHaveBeenCalled()
    expect(prefill).toHaveBeenCalledTimes(1)
    expect(prefill).toHaveBeenCalledWith(EXPECTED_QUESTION)
  })

  it('still lands the draft when only _prefillChat is registered', () => {
    const prefill = vi.fn()
    useGuidanceStore.setState({ guidanceItems: [ASK_ARM_ITEM], _prefillChat: prefill, _sendMessage: null })
    render(<InspectorCoaching {...defaultProps} />)

    const button = screen.getByText('Ask about this')
    fireEvent.click(button)

    expect(prefill).toHaveBeenCalledTimes(1)
    expect(prefill).toHaveBeenCalledWith(EXPECTED_QUESTION)
  })

  it('hides action button when both _prefillChat and _sendMessage are null', () => {
    useGuidanceStore.setState({ guidanceItems: [ASK_ARM_ITEM], _prefillChat: null, _sendMessage: null })
    render(<InspectorCoaching {...defaultProps} />)

    expect(screen.queryByText('Ask about this')).toBeNull()
    // But the grounded guidance text itself should still render
    expect(screen.getByText(/Orchestrator guidance title/)).toBeTruthy()
  })

  it('renders a grounded item FLAT — the contract\'s section-highlight, no box, no lightbulb (v3.1)', () => {
    // v3.1 (DESIGN-GAP-v31 row 32): the card was a boxed notification (an
    // inline 1px info border at 30%, `rounded-lg shadow-1`, a lightbulb and a
    // dismiss ×). It is now `.section-highlight`: a 2px #A3C5D1 left rule.
    useGuidanceStore.setState({
      guidanceItems: [makeGuidanceItem()],
      _prefillChat: vi.fn(),
    })
    const { container } = render(<InspectorCoaching {...defaultProps} />)
    const card = screen.getByTestId('inspector-guidance')
    expect(card.className).toContain('border-l-2')
    expect(card.className).toContain('border-[#A3C5D1]')
    expect(card.className).not.toMatch(/rounded|shadow/)
    expect(card.style.border).toBe('')
    expect(container.querySelector('svg.lucide-lightbulb')).toBeNull()
    expect(screen.queryByLabelText('Dismiss suggestion')).toBeNull()
  })

  // ── related_elements matching ──────────────────────────────────────

  it('surfaces guidance item when elementId matches a related_elements entry', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        makeGuidanceItem({
          item_id: 'related-match',
          target_object: { type: 'node', id: 'other-node' },
          related_elements: [{ id: 'node-1', type: 'node' }],
          title: 'Weakly connected guidance',
        }),
      ],
      _prefillChat: vi.fn(),
    })
    render(<InspectorCoaching {...defaultProps} />)
    expect(screen.getByText(/Weakly connected guidance/)).toBeTruthy()
  })

  it('prefers direct target_object.id match over higher-priority related_elements match', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        makeGuidanceItem({
          item_id: 'related-high',
          target_object: { type: 'node', id: 'other-node' },
          related_elements: [{ id: 'node-1', type: 'node' }],
          title: 'Related high priority',
          priority: 99,
        }),
        makeGuidanceItem({
          item_id: 'direct-low',
          target_object: { type: 'node', id: 'node-1' },
          title: 'Direct low priority',
          priority: 10,
        }),
      ],
      _prefillChat: vi.fn(),
    })
    render(<InspectorCoaching {...defaultProps} />)
    expect(screen.getByText(/Direct low priority/)).toBeTruthy()
    expect(screen.queryByText(/Related high priority/)).toBeNull()
  })

  it('direct match wins over related match even at identical priority', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        makeGuidanceItem({
          item_id: 'related-same-pri',
          target_object: { type: 'node', id: 'other-node' },
          related_elements: [{ id: 'node-1', type: 'node' }],
          title: 'Related same priority',
          priority: 80,
        }),
        makeGuidanceItem({
          item_id: 'direct-same-pri',
          target_object: { type: 'node', id: 'node-1' },
          title: 'Direct same priority',
          priority: 80,
        }),
      ],
      _prefillChat: vi.fn(),
    })
    render(<InspectorCoaching {...defaultProps} />)
    expect(screen.getByText(/Direct same priority/)).toBeTruthy()
    expect(screen.queryByText(/Related same priority/)).toBeNull()
  })

  it('renders nothing (no static fallback, v3.1) when related_elements has no id match', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        makeGuidanceItem({
          item_id: 'unrelated',
          target_object: { type: 'node', id: 'other-node' },
          related_elements: [{ id: 'different-node', type: 'node' }],
          title: 'Unrelated guidance',
        }),
      ],
      _prefillChat: vi.fn(),
    })
    const { container } = render(<InspectorCoaching {...defaultProps} />)
    expect(screen.queryByText('Unrelated guidance')).toBeNull()
    expect(container.innerHTML).toBe('')
  })
})

// ── clearItemsByTargetIds + related_elements ──────────────────────────

describe('clearItemsByTargetIds — related_elements', () => {
  it('clears items when a related_elements[].id matches the edited node', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        makeGuidanceItem({
          item_id: 'related-item',
          target_object: { type: 'node', id: 'primary-node' },
          related_elements: [{ id: 'edited-node', type: 'node' }],
        }),
      ],
    })

    useGuidanceStore.getState().clearItemsByTargetIds(['edited-node'])

    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(0)
  })

  it('preserves items when neither target_object.id nor related_elements match', () => {
    useGuidanceStore.setState({
      guidanceItems: [
        makeGuidanceItem({
          item_id: 'unrelated',
          target_object: { type: 'node', id: 'safe-node' },
          related_elements: [{ id: 'also-safe', type: 'node' }],
        }),
      ],
    })

    useGuidanceStore.getState().clearItemsByTargetIds(['edited-node'])

    expect(useGuidanceStore.getState().guidanceItems).toHaveLength(1)
  })
})
