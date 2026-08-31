/**
 * Where focus goes, and what a screen reader is told.
 *
 * ⭐⭐ THE PANEL'S OWN CONTROLS WERE NOT REACHABLE BY KEYBOARD, and one of them
 * lost producer-grounded content with no recovery path.
 *
 * Measured before fixing, with a contrast control in the same sweep:
 * `.focus()` appeared in ZERO files under `analysisNew/`, against 12 files
 * elsewhere under `results/` (ModalShell, AskOlumiDrawer, …). The estate
 * restores focus; this directory did none. Likewise `aria-controls` read zero
 * in `StrengthenTheReasoning.tsx` while four sibling files in the same
 * directory wire it correctly — the file was the departure from the house
 * convention, not the convention itself.
 *
 * What that cost, concretely:
 *   - "Not relevant" unmounts the `<li>` holding the focused button, so focus
 *     fell to `document.body`. Undo is rendered ABOVE the destroyed position
 *     and expires after six seconds. A keyboard user had to be thrown to the
 *     top of the document, Tab forward through the whole dock, and arrive
 *     inside the window. In practice: a one-way discard, of exactly the thing
 *     the component's own comment calls "not optional furniture".
 *   - Closing the "I disagree" composer — by Save OR by Cancel — unmounted the
 *     button just pressed. So a user was thrown to the top of the page at the
 *     moment they recorded a disagreement, with no confirmation it saved. That
 *     is the reasoning act this surface was built to enable.
 *   - The "I disagree" trigger announced nothing and moved nothing, so the
 *     only route to the textarea was blind-tabbing PAST a destructive
 *     "Not relevant" button.
 *
 * ⚠ These are jsdom assertions about focus and ARIA wiring, which jsdom models
 * faithfully. They are NOT a claim about what any particular screen reader
 * announces — that needs a real AT witness and this file does not provide one.
 */

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { StrengthenTheReasoning } from '../sections/StrengthenTheReasoning'
import type { Recommendation } from '../../strengthen/strengthenTypes'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
vi.mock('../nodeMarks', async (orig) => ({
  ...(await orig<typeof import('../nodeMarks')>()),
  markKindForTarget: () => null,
}))

let records: Record<string, unknown> = {}
const dismiss = vi.fn()
const restoreDismissed = vi.fn()
const dispute = vi.fn()
const seedIfAbsent = vi.fn()

vi.mock('../../../../canvas/stores/strengthenStore', async (orig) => ({
  ...(await orig<typeof import('../../../../canvas/stores/strengthenStore')>()),
  useStrengthenStore: (sel: (s: unknown) => unknown) =>
    sel({
      records,
      priorityOrder: Object.keys(records),
      dismiss,
      restoreDismissed,
      dispute,
      seedIfAbsent,
    }),
}))

const rec = (over: Partial<Recommendation> & { id: string }): Recommendation =>
  ({
    helpType: 'challenge',
    title: 'Pressure-test the leading option',
    signal: 'The ranking was fragile under perturbation.',
    whyNow: 'Small changes flip which option leads.',
    tryThis: 'Imagine it failed. Write down why.',
    sourceLine: 'From the robustness check.',
    action: { kind: 'ai-dialogue', label: 'Work through this', prompt: 'Pressure-test it' },
    priority: 1,
    ...over,
  }) as Recommendation

const renderOpen = (ui: React.ReactElement) => {
  const r = render(ui)
  fireEvent.click(screen.getByTestId('analysis-new-strengthen-toggle'))
  return r
}

beforeEach(() => {
  records = {}
  dismiss.mockClear()
  restoreDismissed.mockClear()
  dispute.mockClear()
  seedIfAbsent.mockClear()
})

const one = [rec({ id: 'strengthen:success-measure' })]

describe('the "I disagree" composer is reachable and announced', () => {
  it('the trigger declares that it is a disclosure, and names what it controls', () => {
    renderOpen(<StrengthenTheReasoning interventions={one} analysisHash="v5:abc" />)
    const trigger = screen.getByTestId('analysis-new-strengthen-disagree')

    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    /**
     * ⭐ THE TARGET MUST EXIST. `aria-controls` pointing at nothing is worse
     * than omitting it — it promises a jump target that is not there. Resolved
     * against the live DOM rather than compared as a string.
     */
    const controls = trigger.getAttribute('aria-controls')
    expect(controls).toBeTruthy()
    expect(document.getElementById(controls!)).toBe(
      screen.getByTestId('analysis-new-strengthen-disagree-form'),
    )
  })

  it('opening moves focus INTO the composer, not past a destructive button', () => {
    renderOpen(<StrengthenTheReasoning interventions={one} analysisHash="v5:abc" />)
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree'))

    expect(document.activeElement).toBe(
      screen.getByTestId('analysis-new-strengthen-disagree-input'),
    )
  })

  it('CANCEL returns focus to the trigger rather than to the top of the document', () => {
    renderOpen(<StrengthenTheReasoning interventions={one} analysisHash="v5:abc" />)
    const trigger = screen.getByTestId('analysis-new-strengthen-disagree')
    fireEvent.click(trigger)
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree-cancel'))

    expect(document.activeElement).toBe(trigger)
    expect(document.activeElement).not.toBe(document.body)
  })

  it('SAVE records the objection AND returns focus to the trigger', () => {
    renderOpen(<StrengthenTheReasoning interventions={one} analysisHash="v5:abc" />)
    const trigger = screen.getByTestId('analysis-new-strengthen-disagree')
    fireEvent.click(trigger)
    fireEvent.change(screen.getByTestId('analysis-new-strengthen-disagree-input'), {
      target: { value: 'The base rate here is wrong.' },
    })
    fireEvent.click(screen.getByTestId('analysis-new-strengthen-disagree-save'))

    // Bound by identity to the recommendation, so a save of the wrong row fails.
    expect(dispute).toHaveBeenCalledWith('strengthen:success-measure', 'The base rate here is wrong.')
    expect(document.activeElement).toBe(trigger)
  })
})

/**
 * ⚠⚠ WHAT IS DELIBERATELY *NOT* TESTED HERE, AND WHY — read this before adding
 * a test back.
 *
 * The dismiss-path focus repair (`useEffect` on `undoable`, which moves focus
 * to Undo only when focus was actually destroyed) CANNOT be discriminated in
 * this harness, and I found that by mutating rather than by inspection.
 *
 * Two tests were written for it and both were removed. `fireEvent.click` does
 * not move focus in jsdom, and this component receives `interventions` as a
 * PROP, so a dismissal does not unmount the row here as it does in the app.
 * `document.activeElement` is therefore `body` for the whole test regardless of
 * what the component does — so the "focus lands on Undo" test passed for the
 * wrong reason, and the "does not steal focus" test passed with the guard
 * DELETED. A mutant that removes the condition entirely does not turn either
 * of them red.
 *
 * A guard that cannot fail is not evidence, and the honest outcome is to say so
 * rather than keep two green tests that certify nothing (CLAUDE.md trap 13). The
 * repair is verified on the deployed build in a real browser instead, where the
 * row genuinely unmounts and focus genuinely moves. If someone later builds a
 * harness that mounts this against a store-driven list, the test belongs back —
 * and it must be re-mutated before it is believed.
 */

describe('"Show N more" names the list it reveals', () => {
  const many = Array.from({ length: 6 }, (_, i) =>
    rec({ id: `strengthen:phase3:b${i}`, title: `Finding ${i}`, priority: i }),
  )

  it('points at a list that exists, because the rows appear ABOVE the button', () => {
    // `preview` is what puts anything below the fold — without it the plan
    // shows everything and the control does not render at all.
    renderOpen(
      <StrengthenTheReasoning interventions={many} preview={3} analysisHash="v5:abc" />,
    )
    const showMore = screen.getByTestId('analysis-new-strengthen-show-more')

    expect(showMore).toHaveAttribute('aria-expanded', 'false')
    const controls = showMore.getAttribute('aria-controls')
    expect(controls).toBeTruthy()
    expect(document.getElementById(controls!)).not.toBeNull()
  })
})

describe('the technique is available to a keyboard reader, not only on hover', () => {
  it('the chip carries its description as text, not only in a title attribute', () => {
    // `strengthen:robustness` maps to the pre-mortem technique.
    renderOpen(
      <StrengthenTheReasoning
        interventions={[rec({ id: 'strengthen:robustness' })]}
        analysisHash="v5:abc"
      />,
    )
    const chip = screen.getByTestId('analysis-new-strengthen-method')
    const described = chip.getAttribute('title')
    expect(described).toBeTruthy()
    // `title` renders on mouse hover only — no major browser shows it on
    // keyboard focus. The same string must be present as real text.
    expect(chip.textContent).toContain(described!)
  })
})
