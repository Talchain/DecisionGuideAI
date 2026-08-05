/**
 * ROADMAP 2.490 slice 2 — the DSK protocol badge on the exercise card.
 *
 * ⚠⚠ WHY THE MOUNT PATH IS ASSERTED HERE AND NOT ONLY THE COMPONENT (trap 3b).
 * This estate has shipped a DSK badge DARK **twice**: row 2.466 hosted one on
 * the V17 hero, which mounts only when `analysisHeroPanel` is OFF while staging
 * deploys `=1`; row 2.491 then reproduced it PAST the spec written to prevent a
 * repeat, because all seven render tests and all five mutants pointed at
 * `HeroKeyQuestion` while the live surface was `KeyQuestionCard` (deployed DOM
 * census: `key-question-card` in 14 captures, `hero-v17-key-question` in ZERO).
 * Deleting the live marker left 210/210 GREEN. A green suite is not evidence
 * about a component the deployment does not render.
 *
 * SO THE SURFACE WAS DERIVED, NOT ASSUMED, and the derivation is:
 *   · `netlify.toml` (UI staging) sets NO flag that gates the exercise card —
 *     unlike the hero panel, nothing switches this surface off.
 *   · The mount path is `InlineBlocks.tsx` → `V5ExerciseBlock` for
 *     `block.type === 'v5_exercise'`, and `phase3Pacing.ts` reserves exactly
 *     ONE default-expanded slot for the turn's exercise.
 *   · DOM census over `PHASE0-EVIDENCE-2026-07-28/`: `v5-exercise` appears in
 *     14 capture files and `v5-exercise-counter-case` in 8 — versus the
 *     known-dark control `hero-v17-key-question` at 7 and the known-live
 *     control `key-question-card` at 49.
 *   · A live end-to-end witness already exists for this exact card
 *     (`walk-dsk-exercises-2026-08-05.md`: `exercise_kind:"consider_opposite"`
 *     on the wire, two `[data-testid="v5-exercise"]` nodes in the DOM, one
 *     painted 342x180, copy byte-identical CEE source === wire === DOM).
 * The first test below asserts THE MOUNT PATH ITSELF, through `InlineBlocks`,
 * so the binding fails loud if a flag or a renderer switch ever moves it.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { V5ExerciseBlock } from '../V5ExerciseBlock'
import { InlineBlocks } from '../../../canvas/conversation/InlineBlocks'
import type { V5ExerciseBlock as V5ExerciseBlockType } from '../../../canvas/conversation/types'

/**
 * The DSK-P-003 record, verbatim from `data/dsk/v1.json` (bundle 1.0.0, hash
 * ca0f63fb…). These are the BUNDLE's strings — not copy invented for a test —
 * because the whole claim under assertion is that the badge shows the canonical
 * record rather than assistant prose (the CEE #830 defect).
 */
const DSK_P_003 = {
  protocol_id: 'DSK-P-003',
  protocol_title: 'Disconfirmation exercise',
  evidence_strength: 'medium',
} as const

/** DSK-P-005, a DIFFERENT record — the trap-19 discriminating partner. */
const DSK_P_005 = {
  protocol_id: 'DSK-P-005',
  protocol_title: 'Devil’s advocate exercise',
  evidence_strength: 'medium',
} as const

function exerciseBlock(
  overrides: Partial<V5ExerciseBlockType> = {},
): V5ExerciseBlockType {
  return {
    type: 'v5_exercise',
    block_id: 'blk-dsk-1',
    exercise_kind: 'consider_opposite',
    counter_case: 'Take the opposite view for a moment.',
    target_refs: [],
    freshness: 'fresh',
    ...overrides,
  } as V5ExerciseBlockType
}

describe('V5ExerciseBlock — DSK protocol provenance badge', () => {
  it('MOUNT PATH: the badge reaches the DOM through InlineBlocks, the surface the deployed flags render', () => {
    render(
      <InlineBlocks
        blocks={[exerciseBlock({ dsk_provenance: DSK_P_003 })] as never}
      />,
    )
    // The card itself is on the live path…
    expect(screen.getByTestId('v5-exercise')).toBeInTheDocument()
    // …and so is the badge. Asserting through the router, not the component,
    // is what makes this fail loud if the mount ever moves.
    expect(screen.getByTestId('v5-exercise-dsk-provenance')).toBeInTheDocument()
  })

  it('renders the BUNDLE title verbatim, bound to DSK-P-003 by identity', () => {
    render(<V5ExerciseBlock block={exerciseBlock({ dsk_provenance: DSK_P_003 })} />)
    const badge = screen.getByTestId('v5-exercise-dsk-provenance')
    expect(badge).toHaveAttribute('data-dsk-protocol-id', 'DSK-P-003')
    expect(badge).toHaveTextContent('Disconfirmation exercise')
    expect(badge).toHaveTextContent(/medium/i)
  })

  it('renders a DIFFERENT protocol differently — the badge is not one hardcoded string', () => {
    const { unmount } = render(
      <V5ExerciseBlock block={exerciseBlock({ dsk_provenance: DSK_P_003 })} />,
    )
    const first = screen.getByTestId('v5-exercise-dsk-provenance').textContent
    unmount()

    render(
      <V5ExerciseBlock
        block={exerciseBlock({
          exercise_kind: 'devils_advocacy',
          dsk_provenance: DSK_P_005,
        })}
      />,
    )
    const badge = screen.getByTestId('v5-exercise-dsk-provenance')
    expect(badge).toHaveAttribute('data-dsk-protocol-id', 'DSK-P-005')
    expect(badge).toHaveTextContent('Devil’s advocate exercise')
    expect(badge.textContent).not.toBe(first)
  })

  it('renders NO badge when the block carries no provenance — never an invented attribution', () => {
    render(<V5ExerciseBlock block={exerciseBlock()} />)
    // Precondition (trap 13b): the card itself must still be there, or this
    // absence assertion would pass because nothing rendered at all.
    expect(screen.getByTestId('v5-exercise')).toBeInTheDocument()
    expect(screen.queryByTestId('v5-exercise-dsk-provenance')).toBeNull()
  })

  it('the badge never displaces the producer prose the card exists to show', () => {
    render(<V5ExerciseBlock block={exerciseBlock({ dsk_provenance: DSK_P_003 })} />)
    expect(screen.getByTestId('v5-exercise-counter-case')).toHaveTextContent(
      'Take the opposite view for a moment.',
    )
  })
})
