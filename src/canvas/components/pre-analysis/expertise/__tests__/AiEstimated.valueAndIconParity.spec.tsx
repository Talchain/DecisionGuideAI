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

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AiEstimated } from '../AiEstimated'
import { MissingData } from '../MissingData'
import type { ImprovementItem } from '../../hooks/usePreAnalysisData'

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
})

describe('MissingData — Brief 5.1 Task 3 icon parity', () => {
  it('Set-value button matches Review-next parity: w-7 h-7', () => {
    render(<MissingData items={[makeMissingItem()]} />)

    const setBtn = screen.getByRole('button', { name: /Set value for Churn Rate/ })

    expect(setBtn.className).toContain('w-7')
    expect(setBtn.className).toContain('h-7')
    expect(setBtn.className).not.toContain('min-h-[44px]')
    expect(setBtn.className).not.toContain('min-w-[44px]')
  })
})
