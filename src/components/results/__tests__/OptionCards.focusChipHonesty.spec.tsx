/**
 * OptionCards — the `onFocusNode` chip must not promise editing.
 *
 * ## The defect, witnessed 2026-08-19
 *
 * `OptionCards.tsx:1085` rendered a chip labelled **"Edit interventions"** whose
 * `onClick` (`:1078-1081`) was `onFocusNode(option.id)`. It edits nothing.
 *
 * The handler it fires, `handleFocusResultNode` (`OutputsDock.tsx:1415-1422`),
 * calls `focusExistingTarget(nodeId, 'node')`, sets a highlight, and clears it
 * after 3s. It opens no editor. The estate's dedicated "open the inspector"
 * helper (`canvas/nodes/shared/openNodeInspector.ts`) is not on this path.
 *
 * ## ⚠ THE MOUNT CLAIM THIS HEADER USED TO MAKE WAS FALSE
 *
 * It read: "Traced on the path this card is MOUNTED through … `ResultsBody`
 * mounts `OptionCards` with no feature-flag gate, and `OutputsDock.tsx:3182`
 * supplies `onFocusNode={handleFocusResultNode}`." Both halves are true
 * SEPARATELY and the conjunction is not: `OutputsDock.tsx:3182` supplies the
 * handler to **`ResultsBody`**, and `ResultsBody` does NOT forward it to the
 * `<OptionCards>` element at `ResultsBody.tsx:587` (it forwards to five other
 * children — see `utils/focusOnCanvasCopy.ts` for the derived list).
 *
 * The chip is gated on `!option.isBaseline && onFocusNode`, so **on the
 * deployed posture this chip does not render at all.** Every case below
 * therefore renders `<OptionCards>` in ISOLATION with a handler injected, which
 * is a claim about the COMPONENT and never about a surface a user loads — the
 * precise distinction trap 3b exists to enforce, and the one this header
 * previously blurred. The mount path itself is pinned separately, and honestly,
 * in `ResultsBody.focusChipMountPath.spec.tsx`.
 *
 * ## What is pinned here, and why each pin exists
 *
 * 1. **The defect itself.** No control on an option card may promise editing.
 *    This is the RED-first assertion: at pristine, "Edit interventions" is on
 *    screen and this fails.
 * 2. **The identity binding.** The chip is found by TESTID
 *    (`focusOnCanvasTestId`) and its accessible name compared to the IMPORTED
 *    constant — never to a literal string. The label is the thing under change,
 *    so a text-bound assertion would pass on any reword including another false
 *    one (trap 19). The mutant pair below is what proves the binding.
 * 3. **The behaviour is unchanged.** Clicking still calls `onFocusNode` with
 *    THIS card's id. The fix is a truthful label on a real affordance, not the
 *    removal of one — so the handler must still fire, and fire for the right
 *    option.
 * 4. **A contrast control in the same render.** A second option card must carry
 *    its OWN chip with its OWN id. Without it, an assertion that "the chip calls
 *    onFocusNode with opt-a" could be satisfied by a single-card render where
 *    every chip is the same chip (trap 19 again, at the card level).
 *
 * ## Convergence
 *
 * The label now comes from `utils/focusOnCanvasCopy.ts`, which `NotAnalysedOptionCard`
 * also reads. The estate previously held two labels for one handler
 * ("Edit interventions" here, "Show on canvas" there); the false one is deleted
 * rather than left beside the true one (Paul's convergence rule).
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import { FOCUS_ON_CANVAS_LABEL, focusOnCanvasTestId } from '../utils/focusOnCanvasCopy'
import type { OptionResult } from '../types'

const OPT_A = 'opt-alpha'
const OPT_B = 'opt-beta'

function analysed(id: string, overrides: Partial<OptionResult> = {}): OptionResult {
  return {
    id,
    label: `Analysed ${id}`,
    expected: 100,
    outcome: { mean: 100, p10: 60, p50: 100, p90: 140 },
    p10: 60,
    p50: 100,
    p90: 140,
    isRecommended: false,
    winProbability: 0.35,
    goalProbability: 0.55,
    ...overrides,
  }
}

const OPTIONS: OptionResult[] = [
  analysed(OPT_A, { isRecommended: true, winProbability: 0.6 }),
  analysed(OPT_B, { winProbability: 0.25 }),
]

function renderCards(props: Record<string, unknown> = {}) {
  return render(
    <OptionCards
      options={OPTIONS}
      winnerId={OPT_A}
      hasLeadingOption
      hasGoalThreshold
      stableNumbers={{ [OPT_A]: 1, [OPT_B]: 2 }}
      {...props}
    />,
  )
}

describe('OptionCards — the focus chip tells the truth about what it does', () => {
  it('PRECONDITION: the chip is rendered at all when onFocusNode is supplied', () => {
    // Pins the discriminator's own precondition (trap 13b). Every absence
    // assertion below is worthless if this card renders no chips whatsoever —
    // and the chip is gated on `!option.isBaseline && onFocusNode`.
    renderCards({ onFocusNode: vi.fn() })
    expect(screen.getByTestId(focusOnCanvasTestId(OPT_A))).toBeTruthy()
    expect(screen.getByTestId(focusOnCanvasTestId(OPT_B))).toBeTruthy()
  })

  it('no control on an option card promises to EDIT anything', () => {
    // THE DEFECT. `onFocusNode` moves the camera and flashes a node; a control
    // that offers editing on top of it is a promise the handler cannot keep.
    renderCards({ onFocusNode: vi.fn() })
    expect(screen.queryByRole('button', { name: /edit interventions/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /\bedit\b/i })).toBeNull()
  })

  it('the chip label comes from the SINGLE owner, bound by testid not by text', () => {
    renderCards({ onFocusNode: vi.fn() })
    const chip = screen.getByTestId(focusOnCanvasTestId(OPT_A))
    // IDENTITY BINDING: testid → element, imported constant → expected name.
    expect(chip.textContent?.trim()).toBe(FOCUS_ON_CANVAS_LABEL)
  })

  it('the chip STILL focuses this card own node — the affordance is kept, not removed', () => {
    const onFocusNode = vi.fn()
    renderCards({ onFocusNode })
    fireEvent.click(screen.getByTestId(focusOnCanvasTestId(OPT_B)))
    expect(onFocusNode).toHaveBeenCalledTimes(1)
    // Bound by id, so a chip wired to the wrong card cannot pass (trap 19).
    expect(onFocusNode).toHaveBeenCalledWith(OPT_B)
  })

  it('CONTRAST CONTROL — each card carries its OWN chip, so the id above discriminates', () => {
    const onFocusNode = vi.fn()
    renderCards({ onFocusNode })
    fireEvent.click(screen.getByTestId(focusOnCanvasTestId(OPT_A)))
    expect(onFocusNode).toHaveBeenLastCalledWith(OPT_A)
    fireEvent.click(screen.getByTestId(focusOnCanvasTestId(OPT_B)))
    expect(onFocusNode).toHaveBeenLastCalledWith(OPT_B)
    expect(onFocusNode).toHaveBeenCalledTimes(2)
  })

  it('the chip is absent when the host offers no focus handler — no dead control', () => {
    renderCards({})
    expect(screen.queryByTestId(focusOnCanvasTestId(OPT_A))).toBeNull()
    expect(screen.queryByTestId(focusOnCanvasTestId(OPT_B))).toBeNull()
  })
})

describe('NotAnalysedOptionCard shares the same owner — one label, one behaviour', () => {
  it('the sibling card that already had the honest label now reads it from the owner', async () => {
    // The convergence assertion. `NotAnalysedOptionCard` hard-coded
    // "Show on canvas" for the SAME handler; if it drifts from the constant
    // this REDs, which is the whole point of naming an owner.
    const { NotAnalysedOptionCard } = await import('../NotAnalysedOptionCard')
    const onFocusNode = vi.fn()
    render(
      <NotAnalysedOptionCard
        option={{
          id: 'opt-excluded',
          label: 'Excluded option',
          expected: null,
          outcome: { mean: null, p10: null, p50: null, p90: null },
          p10: null,
          p50: null,
          p90: null,
          isRecommended: false,
          notAnalysed: true,
          notAnalysedReason: 'no_interventions',
        } as OptionResult}
        onFocusNode={onFocusNode}
      />,
    )
    // Bound by testid to THIS option's chip, then by exact text to the owner.
    // The `?? chip` fallback that used to sit here could not fail: `getByTestId`
    // throws on absence, so the coalesce always yielded a truthy element even
    // when the label query found nothing (trap 13 — an assertion that cannot
    // observe a failure is not evidence).
    const chip = screen.getByTestId('not-analysed-focus-opt-excluded')
    expect(within(chip).getByText(FOCUS_ON_CANVAS_LABEL)).toBeTruthy()
    expect(chip.textContent?.trim()).toBe(FOCUS_ON_CANVAS_LABEL)
  })
})
