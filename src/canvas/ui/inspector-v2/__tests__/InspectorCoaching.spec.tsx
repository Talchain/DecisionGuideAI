/**
 * InspectorCoaching — unit tests
 *
 * Verifies:
 * - Orchestrator GuidanceItems render through CoachingCard visual
 * - Guidance filtered to selected element only
 * - Static coaching is fallback when no guidance exists
 * - "Ask about this" SENDS via _sendMessage (falls back to _prefillChat)
 * - Button hidden when _prefillChat and _sendMessage are both null
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen, fireEvent } from '@testing-library/react'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { useGuidanceStore, type GuidanceItem } from '../../../stores/guidanceStore'

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
  it('renders static coaching text when no guidance items exist', () => {
    useGuidanceStore.setState({ _prefillChat: vi.fn() })
    render(<InspectorCoaching {...defaultProps} />)
    expect(screen.getByText('Static coaching fallback text')).toBeTruthy()
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
    render(<InspectorCoaching {...defaultProps} />)
    // Should show fallback, not the guidance for node-99
    expect(screen.getByText('Static coaching fallback text')).toBeTruthy()
    expect(screen.queryByText('Wrong node guidance')).toBeNull()
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

  it('"Ask about this" SENDS the question via _sendMessage (not _prefillChat)', () => {
    const prefill = vi.fn()
    const send = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: send })
    render(<InspectorCoaching {...defaultProps} />)

    const button = screen.getByText('Ask about this')
    fireEvent.click(button)

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('How important is Marketing Budget to the outcome?')
    expect(prefill).not.toHaveBeenCalled()
  })

  it('falls back to _prefillChat when _sendMessage is unavailable', () => {
    const prefill = vi.fn()
    useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: null })
    render(<InspectorCoaching {...defaultProps} />)

    const button = screen.getByText('Ask about this')
    fireEvent.click(button)

    expect(prefill).toHaveBeenCalledTimes(1)
    expect(prefill).toHaveBeenCalledWith('How important is Marketing Budget to the outcome?')
  })

  it('hides action button when both _prefillChat and _sendMessage are null', () => {
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null })
    render(<InspectorCoaching {...defaultProps} />)

    expect(screen.queryByText('Ask about this')).toBeNull()
    // But the coaching text itself should still render
    expect(screen.getByText('Static coaching fallback text')).toBeTruthy()
  })

  it('renders guidance item action through CoachingCard visual (full thin border)', () => {
    useGuidanceStore.setState({
      guidanceItems: [makeGuidanceItem()],
      _prefillChat: vi.fn(),
    })
    const { container } = render(<InspectorCoaching {...defaultProps} />)
    // CoachingCard uses inline style with info border.
    //
    // This used to assert the raw triple `rgba(82, 163, 200, 0.3)` — the PRE-D1
    // blue. That literal was invisible to every hex-based DS sweep, so when
    // `--info` became #277A9D the card silently kept rendering the old colour
    // and THIS TEST WENT ON PASSING, pinning the drift in place. So assert the
    // property D1 actually wants (the border DERIVES from the token) instead of
    // any one value: a future retint of `--info` then cannot break this test,
    // and — the point — cannot pass while the card drifts away from the token.
    const card = container.firstElementChild as HTMLElement
    expect(card.style.border).toBe(
      '1px solid color-mix(in srgb, var(--info) 30%, transparent)',
    )
    // A hardcoded channel triple here is exactly the regression this file once
    // enshrined; fail loudly if one comes back.
    expect(card.style.border).not.toMatch(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/)
    // And the token it points at must really be declared — `var(--typo)` renders
    // NO border at all, which the assertions above cannot distinguish. Read the
    // source of truth rather than trusting the name (trap 12: derive, don't mirror).
    //
    // Assert the RESOLVED VALUE, not the file's current spelling. This used to
    // regex for `--info: #RRGGBB`, which broke the moment the channel split
    // (#379) restated the token as `--info-rgb: 39 122 157; --info:
    // rgb(var(--info-rgb))`, a change that left the colour bit-for-bit
    // identical. Pinning the prose format made a correct refactor look like a
    // regression, so follow the `var()` chain instead: any spelling that bottoms
    // out in a real colour passes, and only a token that is missing or dangling
    // fails. That is the property this assertion was always about.
    const brandCss = readFileSync(
      join(__dirname, '../../../../styles/brand.css'),
      'utf-8',
    )
    // Comments in brand.css illustrate the token shape; they are not declarations.
    const declared = new Map<string, string>()
    for (const m of Array.from(
      brandCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g),
    )) {
      declared.set(m[1], m[2].trim())
    }

    const resolve = (value: string, depth = 0): string =>
      depth > 10
        ? value
        : value.replace(/var\(\s*(--[\w-]+)\s*\)/g, (whole, name: string) => {
            const next = declared.get(name)
            return next === undefined ? whole : resolve(next, depth + 1)
          })

    expect(declared.has('--info'), '--info is not declared in brand.css').toBe(true)
    expect(
      resolve(declared.get('--info')!),
      '--info must resolve to a real colour, not a dangling var()',
    ).toMatch(/^(#[0-9A-Fa-f]{3,8}|rgba?\([\d\s,./%]+\))$/)
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

  it('falls back to static coaching when related_elements has no id match', () => {
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
    render(<InspectorCoaching {...defaultProps} />)
    expect(screen.getByText('Static coaching fallback text')).toBeTruthy()
    expect(screen.queryByText('Unrelated guidance')).toBeNull()
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
