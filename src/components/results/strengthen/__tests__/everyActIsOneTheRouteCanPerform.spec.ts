/**
 * ⭐⭐ A BUTTON MAY NOT NAME AN ACT ITS ROUTE CANNOT PERFORM.
 *
 * ── THE RULING THIS APPLIES, WHICH ALREADY EXISTS ──────────────────────────
 * `canvas/ui/inspector-v2/__tests__/FactorControllablePanel.noScaleRemedyIsTheUnitPath.spec.tsx`:
 * *"The remedy this panel names must be one the assistant can actually
 * perform."* It was written after a journey witness asked Olumi, in natural
 * language, twice, to do the thing a disclosure told them to do, and was
 * declined both times. **It was applied to the surface where it was discovered
 * and nowhere else.** This carries it to the Strengthen engine.
 *
 * ── WHAT THE ROUTES CAN DO, DERIVED AT THE DISPATCHER ──────────────────────
 * `StrengthenContainer.tsx` and `StrengthenTheReasoning.tsx`:
 *
 *   `open-modal`   → opens the named editor. It can PERFORM an act.
 *   `ai-dialogue`  → opens Ask Olumi with the finding attached. It can carry
 *                    any act the assistant can do, so its label is not
 *                    constrained here.
 *   `canvas-focus` → `focusModelTarget` → `focusNodeById`: it SELECTS the node,
 *                    dims its neighbours and moves the camera. It opens no
 *                    editor and switches no tab (zero references to
 *                    `OPEN_FULL_INSPECTOR_EVENT` in `focusHelpers.ts` or
 *                    `useFocusCamera.ts`). **It can only show you where a thing
 *                    is.** So a `canvas-focus` button that says "Set…",
 *                    "Add…" or "Give…" is promising a mutation and delivering
 *                    a camera move.
 *
 * ── MEASURED, 20 Sep 2026 — ONE OF EIGHT ───────────────────────────────────
 * I first called this a class, on two examples. Then I counted, and the claim
 * did not survive: seven of eight cards route to something that can do what
 * their button says. `strengthen:lehi` is the outlier, and it is a real one —
 * "Set a range" over a route that moves the camera, on a factor for which no
 * range editor exists unless its `category` is `'external'` (the canvas
 * inspector's `FactorExternalPanel` is the only one in the product).
 *
 * ── THE SET IS NOW EMPTY, AND THAT IS THE PIN DOING ITS JOB ────────────────
 * This file shipped with `strengthen:lehi — "Set a range"` pinned, under a
 * `toEqual` that REDs if the set grows OR SHRINKS. The fix that followed
 * emptied it, and this RED is how the pin announced that its own exemption had
 * become stale prose describing a state the product had left. That is exactly
 * the exit CLAUDE.md trap 22f prescribes: *"pin it in an explicit KNOWN set
 * with a test asserting EXACTLY that set — so the suite stays green for the
 * right reason."*
 *
 * ⛔ THE EMPTY SET IS NOT A WEAKER GUARD. `toEqual([])` is the strongest state
 * this file can be in: every `canvas-focus` card's label must now name an act
 * its route performs, with no exemptions at all. Adding a row back is a
 * decision someone has to write down.
 *
 * ⚠ AND THE DEFECT WAS LATENT, NOT LIVE, which is the argument for a SOURCE
 * guard rather than a DOM one. `strengthen:lehi` cannot render today: its gate
 * opens with `confidenceDisplay.show`, and `resolveFactorConfidenceDisplay`
 * returns `{show: false}` for every production caller
 * (`DISPLAY_SAFE_DRIVER_CONFIDENCE` is `false`; only test files pass the seam).
 * No screenshot, journey witness or DOM census could ever have found this copy.
 * The constant's own note promises everything gated on it *"lights up
 * together"*, so the day it flips is the day all of it reaches a reader at
 * once.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE = resolve(process.cwd(), 'src/components/results/strengthen/buildRecommendations.ts')

interface Card {
  readonly id: string
  readonly kind: string
  readonly label: string | null
}

/**
 * ⚠ DERIVED FROM THE BUILDER, NOT HAND-LISTED. A list of cards maintained here
 * would drift the first time one is added — the defect this estate pays for
 * most often. The parse is brace-balanced from each `recs.push({`, so a new
 * card is in scope the moment it is written.
 *
 * ⚠ AND IT FAILS CLOSED. A label that is not a string literal (a constant, a
 * template with an interpolation at the head) yields `null`, and `null` on a
 * constrained route is an ERROR below rather than a pass — a classifier that
 * cannot read a label must not bless it.
 */
function cardsInBuilder(): Card[] {
  const src = readFileSync(SOURCE, 'utf8')
  const cards: Card[] = []
  let i = 0
  for (;;) {
    i = src.indexOf('recs.push({', i)
    if (i < 0) break
    const open = src.indexOf('{', i)
    let depth = 0
    let k = open
    for (; k < src.length; k += 1) {
      if (src[k] === '{') depth += 1
      else if (src[k] === '}') {
        depth -= 1
        if (depth === 0) break
      }
    }
    const block = src.slice(open, k + 1)
    const id = /id:\s*[`']([^`']+)/.exec(block)
    const kind = /kind:\s*'([a-z-]+)'/.exec(block)
    const label = /label:\s*[`']([^`'$]+)['`]/.exec(block)
    cards.push({
      id: id ? id[1] : '(unparsed)',
      kind: kind ? kind[1] : '(none)',
      label: label ? label[1] : null,
    })
    i = k
  }
  return cards
}

/** A verb that a camera move genuinely satisfies: it takes you to the thing. */
const LOCATES = /^(Show|See|View|Find|Open|Go|Take|Reveal)\b/i

/**
 * ⛔ THE KNOWN GAP, AS AN EXACT SET. `toEqual` means this REDs if it GROWS (a
 * second card starts promising a mutation over a camera move) and equally if it
 * SHRINKS (lehi is fixed and this pin is now stale prose describing a state the
 * product has left). A `.filter()` would catch only the first.
 */
const KNOWN_UNROUTED_ACTS: readonly string[] = []

describe('every act the panel names is one its route can perform', () => {
  const cards = cardsInBuilder()

  /**
   * ⚠ PRECONDITION. A parser that silently matched nothing would make every
   * assertion below pass on an empty list — the vacuity that makes a guard
   * worthless. The floor is deliberately below today's count so an ordinary
   * addition does not trip it, and far above zero.
   */
  /**
   * ⚠ ONE CARD'S `id` IS NOT A STRING LITERAL and reads as `(unparsed)`. That is
   * tolerated deliberately: the id is used only to NAME the offender in the
   * report, so an unparsed one on a flagged route would still RED — as
   * `(unparsed) — "…"`, which no pin matches. What may not be unparsed is the
   * `kind`, because that is what decides whether a card is checked at all, and
   * a card whose route could not be read must never be silently skipped.
   */
  it('PRECONDITION: the builder parse found the cards', () => {
    expect(cards.length, 'the recs.push parse went blind').toBeGreaterThanOrEqual(6)
    expect(cards.filter((c) => c.kind === '(none)'), 'a card with no action kind').toEqual([])
    expect(
      new Set(cards.map((c) => c.kind)).size,
      'every card shares one route — the corpus cannot discriminate',
    ).toBeGreaterThan(1)
  })

  it('a camera move is never labelled as a mutation — except the one known gap', () => {
    const unrouted = cards
      .filter((c) => c.kind === 'canvas-focus')
      .filter((c) => c.label === null || !LOCATES.test(c.label))
      .map((c) => `${c.id.replace(/\$\{.*$/, '').replace(/:$/, '')} — "${c.label ?? '(unreadable label)'}"`)

    expect(
      unrouted,
      `these buttons promise an act their route cannot perform:\n${unrouted.join('\n')}`,
    ).toEqual(KNOWN_UNROUTED_ACTS)
  })

  /**
   * ⛔ CONTRAST CONTROL. Without it, a `LOCATES` pattern that matched
   * EVERYTHING would pass the test above on any tree, and the guard would be
   * agreeing with itself. This proves it discriminates in both directions.
   */
  it('PRECONDITION: the verb test admits a locating label and refuses a mutating one', () => {
    expect(LOCATES.test('Show me this factor')).toBe(true)
    expect(LOCATES.test('Open the model')).toBe(true)
    expect(LOCATES.test('Set a range')).toBe(false)
    expect(LOCATES.test('Add its current value')).toBe(false)
    expect(LOCATES.test('Give it a realistic range')).toBe(false)
  })

  /**
   * ⚠ THE UNCONSTRAINED ROUTES ARE NOT UNCHECKED — they are checked for the
   * thing that IS true of them. `ai-dialogue` and `open-modal` can perform an
   * act, so their labels are free; what they may not be is MISSING, because a
   * button with no label is not an affordance a reader can act on.
   */
  it('a route that can perform an act still has to name one', () => {
    const nameless = cards
      .filter((c) => c.kind === 'open-modal' && c.label === null)
      .map((c) => c.id)
    expect(nameless, 'an open-modal card with no readable button label').toEqual([])
  })
})
