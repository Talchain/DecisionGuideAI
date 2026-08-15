/**
 * Chip grammar — ONE authority, and the PX-B down-size that authority carries.
 *
 * WHY THIS SPEC EXISTS. `CHIP_CLASS` and the class literal inside
 * `SuggestedChips.tsx` were byte-identical copies of each other. Because they
 * AGREED, nothing ever noticed there were two — and the PX-B chip-weight change
 * (Paul, 15 Aug: "oversized actions") was first written into the SuggestedChips
 * copy alone, which would have shipped two different action-chip sizes into a
 * single panel. The copy is now deleted and SuggestedChips imports the shared
 * constant.
 *
 * TWO KINDS OF GUARD, BOTH NEEDED (platform trap 12d — derivation and a corpus
 * are not redundant and neither supersedes the other):
 *
 *   · DERIVED (the no-mirror arm). Every render site's DOM must carry the
 *     shared constant's tokens, checked against the imported constant rather
 *     than a re-typed list. This catches a re-inlined literal that drifts —
 *     the exact defect above — and keeps catching it after any future DS
 *     tweak, because the expectation moves with the constant.
 *
 *   · HAND-WRITTEN (the ruling arm). Derivation is structurally blind to the
 *     constant itself being wrong: if someone reverts CHIP_CLASS to the
 *     oversized grammar, every derived assertion still passes, in perfect
 *     agreement, because the DOM would faithfully carry the reverted value.
 *     So the ruling is ALSO pinned by value, with its negative twin — the
 *     grammar must be the small one AND must not be the old large one.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SuggestedChips } from '../zones/SuggestedChips'
import { ActionChip } from '../../../v5/blocks/ActionChip'
import { CHIP_CLASS } from '../../../v5/blocks/chipClass'
import { typography } from '../../../styles/typography'
import type { ActionChip as ActionChipType } from '../types'

/**
 * Positive control for every containment assertion below. A `toContain` over an
 * empty or single-token string passes while testing nothing (platform trap 13:
 * an absence/containment probe needs a proof it can see a presence). If
 * CHIP_CLASS is ever reduced to a stub, this REDs first and names why.
 */
const CHIP_CLASS_TOKENS = CHIP_CLASS.split(/\s+/).filter(Boolean)

function makeChip(overrides: Partial<ActionChipType> = {}): ActionChipType {
  return {
    id: 'grammar_1',
    label: 'Explain this',
    intent: 'secondary',
    message: 'Explain this in plain terms',
    ...overrides,
  }
}

describe('chip grammar — the shared constant is real enough to assert against', () => {
  it('carries a substantial token list (control for the containment arms)', () => {
    // Not a style assertion — a vacuity guard. Every test below is a
    // containment check, and containment against a stub is free.
    expect(CHIP_CLASS_TOKENS.length).toBeGreaterThan(10)
  })
})

describe('chip grammar — ONE authority across every render site (derived, no mirror)', () => {
  it('SuggestedChips renders its chip with the shared constant, not a local copy', () => {
    render(
      <SuggestedChips
        chips={[makeChip({ id: 'sc1' })]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    // Bound by identity (the chip's own test id), never by a class predicate
    // another element could satisfy.
    const chip = screen.getByTestId('suggested-chip-sc1')
    for (const token of CHIP_CLASS_TOKENS) {
      expect(chip.className).toContain(token)
    }
  })

  it('ActionChip renders with the shared constant', () => {
    render(<ActionChip label="Do it" message="Do it now" testId="grammar-action-chip" />)
    const chip = screen.getByTestId('grammar-action-chip')
    for (const token of CHIP_CLASS_TOKENS) {
      expect(chip.className).toContain(token)
    }
  })

  it('keeps SuggestedChips own stagger classes alongside the shared idiom', () => {
    // The local classes that are legitimately NOT part of the shared grammar.
    // Pinned so a future consolidation does not quietly delete the animation
    // while "removing the duplicate".
    render(
      <SuggestedChips
        chips={[makeChip({ id: 'sc2' })]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    const chip = screen.getByTestId('suggested-chip-sc2')
    expect(chip.className).toContain('suggested-chip')
    expect(chip.className).toContain('chip-stagger-in')
  })
})

describe('chip grammar — the PX-B ruling itself (hand-written; derivation cannot see this)', () => {
  it('uses the .chip padding grammar (12px/6px), not the oversized one', () => {
    expect(CHIP_CLASS).toContain('px-3 py-1.5')
    // The negative twin. Without it, a revert to the oversized grammar passes
    // every derived assertion in this file.
    expect(CHIP_CLASS).not.toContain('px-4 py-2')
  })

  it('uses the 12px panel type token, not the 14px body token', () => {
    expect(CHIP_CLASS).toContain(typography.panelBody)
    expect(CHIP_CLASS).not.toContain(typography.bodySmall)
  })

  it('KEEPS the 44px pointer-target floor through the down-size', () => {
    // The ruling shrank visual weight, not hit area. These are two different
    // questions and a future tidy-up must not answer the second one by
    // accident: padding went down, the touch target did not.
    expect(CHIP_CLASS).toContain('min-h-[44px]')
  })

  it('keeps the focus and disabled affordances the cards depend on', () => {
    expect(CHIP_CLASS).toContain('focus-visible:ring-2')
    expect(CHIP_CLASS).toContain('disabled:opacity-40')
    expect(CHIP_CLASS).toContain('disabled:pointer-events-none')
  })
})
