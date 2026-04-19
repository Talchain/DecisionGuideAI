/**
 * AiEstimated / MissingData — Brief 5.1 Task 3 row hierarchy + icon parity.
 *
 * Covers:
 * - Value slot renders via formatFactorDisplayValue when rawValue present.
 * - Value slot renders an em-dash placeholder (not empty, not "0") when no
 *   value is available.
 * - Confirm / Pencil / Set-value buttons match Review-next icon sizing
 *   (28×28 = w-7 h-7; 14px icon) for visual parity across surfaces.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AiEstimated } from '../AiEstimated'
import { MissingData } from '../MissingData'
import type { ImprovementItem } from '../../hooks/usePreAnalysisData'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'

// DiscussWithAiButton short-circuits (returns null) when no send/prefill
// callback is registered. Brief 5.2 Task 7 asserts sparkle variant classes,
// so we need the button to render — seed the guidance store each test.
beforeEach(() => {
  useGuidanceStore.setState({ _sendMessage: vi.fn(), _prefillChat: vi.fn() })
})

function makeEstimatedItem(overrides: Partial<ImprovementItem> = {}): ImprovementItem {
  return {
    key: 'ai-f1',
    category: 'verify',
    label: 'Task Handling Quality',
    detail: 'AI estimate',
    subgroup: 'cee_inference',
    focus: { type: 'node', id: 'f1', label: 'Task Handling Quality' },
    rawValue: 75,
    unit: '%',
    ...overrides,
  }
}

function makeMissingItem(overrides: Partial<ImprovementItem> = {}): ImprovementItem {
  return {
    key: 'missing-f2',
    category: 'verify',
    label: 'Churn Rate',
    detail: 'Not set',
    subgroup: 'cee_inference',
    focus: { type: 'node', id: 'f2', label: 'Churn Rate' },
    ...overrides,
  }
}

describe('AiEstimated — Brief 5.1 Task 3 value slot + icon parity', () => {
  it('renders the formatted current value next to the label when rawValue is present', () => {
    render(<AiEstimated items={[makeEstimatedItem({ rawValue: 75, unit: '%' })]} />)

    // 75 + percent via formatFactorDisplayValue renders with trailing %.
    // The value is its own button (click-to-edit); accessible name is the
    // value text itself so screen readers announce "75%, button".
    expect(screen.getByRole('button', { name: '75%' })).toBeInTheDocument()
    // No placeholder when a value is present.
    expect(screen.queryByTestId('expertise-value-placeholder')).not.toBeInTheDocument()
  })

  it('renders an em-dash placeholder in text-text-light when rawValue is null', () => {
    render(<AiEstimated items={[makeEstimatedItem({ rawValue: null })]} />)

    const placeholder = screen.getByTestId('expertise-value-placeholder')
    expect(placeholder).toHaveTextContent('—')
    expect(placeholder.className).toContain('text-text-light')
  })

  it('renders an em-dash placeholder when detail is "Not set"', () => {
    render(<AiEstimated items={[makeEstimatedItem({ rawValue: 50, detail: 'Not set' })]} />)

    expect(screen.getByTestId('expertise-value-placeholder')).toBeInTheDocument()
    // The value-slot click-to-edit button (accessible name = "50%") must
    // not render when the row is in a not-set state. The Pencil icon in
    // row 2 stays — a separate, explicit "Edit value for <name>" button.
    expect(screen.queryByRole('button', { name: /^\d/ })).not.toBeInTheDocument()
  })

  it('action buttons match Review-next parity: 28×28 button (w-7 h-7) with 14px icons', () => {
    render(<AiEstimated items={[makeEstimatedItem()]} />)

    const confirmBtn = screen.getByRole('button', { name: /Confirm value for Task Handling Quality/ })
    const editBtn = screen.getByRole('button', { name: /Edit value for Task Handling Quality/ })

    for (const btn of [confirmBtn, editBtn]) {
      expect(btn.className).toContain('w-7')
      expect(btn.className).toContain('h-7')
      // Old over-sized 44px class string must be gone.
      expect(btn.className).not.toContain('min-h-[44px]')
      expect(btn.className).not.toContain('min-w-[44px]')
    }
  })

  // Brief 5.2 Task 7: expertise rows are a non-primary surface; sparkles
  // should not compete with the hero / triage-card sparkles for attention.
  it('sparkle uses variant="secondary" (opacity-50 at rest, revealed on hover/focus)', () => {
    render(<AiEstimated items={[makeEstimatedItem()]} />)
    const sparkle = screen.getByTestId('discuss-with-ai')
    expect(sparkle.getAttribute('data-variant')).toBe('secondary')
    expect(sparkle.className).toContain('opacity-50')
    expect(sparkle.className).toContain('hover:opacity-100')
    expect(sparkle.className).toContain('focus-visible:opacity-100')
  })
})

describe('MissingData — Brief 5.1 Task 3 copy + Brief 5.2 Task 3 default-open editor', () => {
  it('rows without a current value read "Not set" — consistent with the AiEstimated placeholder and the brief copy spec', () => {
    render(<MissingData items={[makeMissingItem()]} />)
    expect(screen.getByText('Not set')).toBeInTheDocument()
    // Old "No data" wording must not linger — anyone pattern-matching on
    // that string (QA checklists, analytics filters) needs to see the
    // switch.
    expect(screen.queryByText('No data')).not.toBeInTheDocument()
  })

  // Brief 5.2 Task 3: the Pencil affordance is removed. The editor IS the
  // default state for Missing-data rows; there is no separate "open editor"
  // action to expose, and keeping one would imply closing is possible.
  it('does not render a Pencil / Set-value button — the editor is default-open', () => {
    render(
      <MissingData
        items={[makeMissingItem()]}
        activeEditorKey={null}
        onRequestEdit={() => {}}
        onCommitValue={() => {}}
        onCancelEdit={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: /Set value for Churn Rate/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Edit value for Churn Rate/ })).not.toBeInTheDocument()
  })

  it('renders the inline ScientificEditor by default when inline plumbing is available and no other editor is active', () => {
    render(
      <MissingData
        items={[makeMissingItem()]}
        activeEditorKey={null}
        onRequestEdit={() => {}}
        onCommitValue={() => {}}
        onCancelEdit={() => {}}
      />,
    )
    expect(screen.getByTestId('missing-data-editor-missing-f2')).toBeInTheDocument()
  })

  it('collapses (hides the editor) when another editor is active', () => {
    render(
      <MissingData
        items={[makeMissingItem()]}
        activeEditorKey="ai-estimated-row-42"
        onRequestEdit={() => {}}
        onCommitValue={() => {}}
        onCancelEdit={() => {}}
      />,
    )
    expect(screen.queryByTestId('missing-data-editor-missing-f2')).not.toBeInTheDocument()
    // Row still renders name + Not set + technique hint + sparkle even
    // when the editor is collapsed.
    expect(screen.getByTestId('missing-data-row-missing-f2')).toBeInTheDocument()
    expect(screen.getByText('Not set')).toBeInTheDocument()
  })

  it('does not render the editor when inline plumbing is not wired (graceful fallback)', () => {
    render(<MissingData items={[makeMissingItem()]} />)
    expect(screen.queryByTestId('missing-data-editor-missing-f2')).not.toBeInTheDocument()
    // But the row itself must still render so users see the missing-data
    // item and can click the factor label to focus the canvas node.
    expect(screen.getByTestId('missing-data-row-missing-f2')).toBeInTheDocument()
  })

  // Brief 5.2 Task 7: same secondary-variant assertion as AiEstimated so the
  // two sibling surfaces stay in sync.
  it('sparkle uses variant="secondary" (opacity-50 at rest, revealed on hover/focus)', () => {
    render(<MissingData items={[makeMissingItem()]} />)
    const sparkle = screen.getByTestId('discuss-with-ai')
    expect(sparkle.getAttribute('data-variant')).toBe('secondary')
    expect(sparkle.className).toContain('opacity-50')
    expect(sparkle.className).toContain('hover:opacity-100')
    expect(sparkle.className).toContain('focus-visible:opacity-100')
  })
})
