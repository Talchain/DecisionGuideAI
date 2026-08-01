/**
 * ROADMAP 2.225 — the documented-but-dropped guidance passthrough.
 *
 * THE DEFECT THIS PINS. `GuidanceItem` in the store declares, in its own
 * doc comments:
 *
 *   actionLabel — "Producer `action_label` VERBATIM when supplied ... The CTA
 *                  label the producer authored for this item — the UI renders
 *                  it verbatim and never invents its own."
 *   signal      — "Producer `signal` display line VERBATIM when supplied ...
 *                  Rendered verbatim where present, never synthesised."
 *
 * `deriveGuidance` duly produced both. The mapper that writes derived items
 * into the store listed NEITHER, so on the V5 path both were silently
 * dropped at the boundary — the store contract documented a field the V5
 * path could not deliver. Classic silent-drop: it validates upstream, it is
 * documented downstream, and it vanishes in the middle where no test looked
 * because the mapper was an anonymous inline `.map()`.
 */
import { describe, it, expect } from 'vitest'

import { toStoreGuidanceItem } from '../useConversation'
import type { DerivedGuidanceItem } from '../../../v5/extractPhase3FromV5Response'

function derived(overrides: Partial<DerivedGuidanceItem> = {}): DerivedGuidanceItem {
  return {
    item_id: 'g-1',
    source: 'coaching',
    title: 'Your revenue estimate may be anchored',
    primary_action: { type: 'discuss', prompt: 'Your revenue estimate may be anchored' },
    priority: 50,
    priorityIsProducerSupplied: false,
    ...overrides,
  } as DerivedGuidanceItem
}

describe('toStoreGuidanceItem — producer passthrough', () => {
  it('carries actionLabel through VERBATIM (was silently dropped)', () => {
    const item = toStoreGuidanceItem(derived({ actionLabel: 'See what would flip' }))
    expect(item.actionLabel).toBe('See what would flip')
  })

  it('carries the signal display line through VERBATIM (was silently dropped)', () => {
    const item = toStoreGuidanceItem(
      derived({ signal: 'Re-run: the graph changed since this analysis.' }),
    )
    expect(item.signal).toBe('Re-run: the graph changed since this analysis.')
  })

  it('omits both when the producer supplied neither — absence stays absence', () => {
    const item = toStoreGuidanceItem(derived())
    expect(item).not.toHaveProperty('actionLabel')
    expect(item).not.toHaveProperty('signal')
  })

  it('still carries every field the mapper already carried (no regression)', () => {
    const item = toStoreGuidanceItem(
      derived({
        signal_code: 'ANCHORING_BIAS',
        category: 'should_fix',
        detail: 'The first number has stayed put through three revisions.',
        target_object: { type: 'node', id: 'fac_rev', label: 'Revenue' },
        related_elements: [{ id: 'fac_rev', type: 'node', label: 'Revenue' }],
        valid_while: { analysis_hash: 'a1', graph_hash: 'g1' },
        priority: 80,
        priorityRank: 120,
        priorityIsProducerSupplied: true,
      }),
    )
    expect(item).toMatchObject({
      item_id: 'g-1',
      signal_code: 'ANCHORING_BIAS',
      category: 'should_fix',
      source: 'coaching',
      title: 'Your revenue estimate may be anchored',
      detail: 'The first number has stayed put through three revisions.',
      primary_action: { type: 'discuss' },
      target_object: { type: 'node', id: 'fac_rev', label: 'Revenue' },
      valid_while: { analysis_hash: 'a1', graph_hash: 'g1' },
      priority: 80,
      priorityRank: 120,
      priorityIsProducerSupplied: true,
    })
  })
})
