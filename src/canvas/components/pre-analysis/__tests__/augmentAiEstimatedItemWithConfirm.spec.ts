/**
 * Brief 5.7 D7 — AI-estimated factor Confirm action augmentation.
 *
 * Defensive: usePreAnalysisData should attach a confirm action to every
 * cee_inference item, but if the action is missing for any reason the
 * helper supplies one so the improve-confidence-tier triage card renders the
 * Confirm chip plus the inline editor instead of an inert card.
 */

import { describe, it, expect } from 'vitest'
import { augmentAiEstimatedItemWithConfirm } from '../PreAnalysisPanel'

interface TestItem {
  key: string
  label: string
  action?: { kind: string; label: string; targetId?: string; targetType?: string }
  focus?: { id?: string; type?: string; label?: string }
}

describe('augmentAiEstimatedItemWithConfirm (Brief 5.7 D7)', () => {
  it('attaches a Confirm action when item has no action and a valid focus id', () => {
    const item: TestItem = {
      key: 'fac1',
      label: 'Factor 1',
      focus: { id: 'node-1', type: 'node', label: 'Factor 1' },
    }
    const out = augmentAiEstimatedItemWithConfirm(item)
    expect(out.action).toEqual({
      kind: 'confirm',
      label: 'Confirm',
      targetId: 'node-1',
      targetType: 'node',
    })
  })

  it('passes the item through unchanged when an action is already present', () => {
    const item: TestItem = {
      key: 'fac2',
      label: 'Factor 2',
      action: { kind: 'confirm', label: 'Confirm', targetId: 'node-2', targetType: 'node' },
      focus: { id: 'node-2' },
    }
    const out = augmentAiEstimatedItemWithConfirm(item)
    expect(out).toBe(item)
  })

  it('preserves a non-confirm action without overwriting it', () => {
    const item: TestItem = {
      key: 'fac3',
      label: 'Factor 3',
      action: { kind: 'edit', label: 'Edit', targetId: 'node-3', targetType: 'node' },
      focus: { id: 'node-3' },
    }
    const out = augmentAiEstimatedItemWithConfirm(item)
    expect(out.action?.kind).toBe('edit')
  })

  it('passes the item through unchanged when focus.id is missing', () => {
    const item: TestItem = {
      key: 'fac4',
      label: 'Factor 4',
      focus: { type: 'node' },
    }
    const out = augmentAiEstimatedItemWithConfirm(item)
    expect(out).toBe(item)
  })

  it('passes the item through unchanged when focus is undefined entirely', () => {
    const item: TestItem = { key: 'fac5', label: 'Factor 5' }
    const out = augmentAiEstimatedItemWithConfirm(item)
    expect(out).toBe(item)
  })

  it('does not mutate the original item when augmenting', () => {
    const item: TestItem = {
      key: 'fac6',
      label: 'Factor 6',
      focus: { id: 'node-6' },
    }
    const out = augmentAiEstimatedItemWithConfirm(item)
    expect(out).not.toBe(item)
    expect(item.action).toBeUndefined()
  })
})
