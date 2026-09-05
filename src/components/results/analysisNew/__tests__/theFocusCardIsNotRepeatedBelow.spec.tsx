/**
 * The coaching item promoted to the top of the panel does not appear a second
 * time in the list beneath it.
 *
 * ── THE WITNESSED DEFECT (Paul, deployed `a9c2e050`, 5 Sep 2026) ────────────
 * One screen carried the SAME ~40-word producer paragraph twice: once in the
 * card headed "Work through with Olumi" (`AtAGlance`), and again a few hundred
 * pixels below under the card headed "Narrow framing"
 * (`StrengthenTheReasoning`). Two headings, two surfaces, one sentence — so the
 * panel looked like it had two findings and had one.
 *
 * ── THE MECHANISM, MEASURED ────────────────────────────────────────────────
 * Both draw from the same array. `AnalysisNewTabBody` picks `glancePrimary` out
 * of `vm.strengthen.interventions` and hands its `signal` to `AtAGlance`, then
 * passes THE WHOLE UNFILTERED ARRAY to `StrengthenTheReasoning`, which reorders
 * but never excludes. `STRENGTHEN_PREVIEW` keeps the top item visible, so the
 * promoted card is always the one repeated.
 *
 * ── WHY EXCLUSION IS THE RIGHT FIX AND NOT A LOSS ──────────────────────────
 * The design prototype's spine is "one question, one method, one move": a
 * FOCUS NOW card, then ALSO WORTH DOING — the rest. The item under focus is not
 * missing from the list; it is the thing the list is "also" relative to.
 * Removing it makes the two sections mean what their headings say.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { selectAlsoWorthDoing } from '../AnalysisNewTabBody'

type Rec = { id: string; signal: string }
const REC = (id: string, signal: string) => ({ id, signal }) as unknown as Rec

const A = REC('r1', 'Six options, all one funding channel — the frame may be too narrow.')
const B = REC('r2', 'Four factors still sit on Olumi’s estimates.')
const C = REC('r3', 'The leading option is sensitive to one relationship.')

describe('the focused item is not repeated in the list below it', () => {
  it('CONTROL: with no focus card, every item stays in the list', () => {
    // Without this the selector could pass every assertion below by returning
    // an empty array — the failure mode that silently empties the section.
    expect(selectAlsoWorthDoing([A, B, C] as never, null).map((r) => r.id)).toEqual([
      'r1',
      'r2',
      'r3',
    ])
  })

  it('the focused item is removed, and only it', () => {
    const rest = selectAlsoWorthDoing([A, B, C] as never, A as never)
    expect(rest.map((r) => r.id)).toEqual(['r2', 'r3'])
  })

  it('DISCRIMINATOR: a LONE recommendation keeps its full card', () => {
    // ⚠ Excluding unconditionally would delete the only card carrying the
    // method control, the science grounding and the dismissal — to prevent a
    // repeat that cannot happen, because the section rests CLOSED and there is
    // no second copy on screen. Below two items there is no "also" to be
    // relative to. Measured: removing this branch takes the section off the
    // surface on a one-recommendation run and REDs seven order specs.
    expect(selectAlsoWorthDoing([A] as never, A as never).map((r) => r.id)).toEqual(['r1'])
  })

  it('DISCRIMINATOR: bound by IDENTITY, not by a value another item could match', () => {
    // Two items can legitimately carry the same producer sentence — the phase-3
    // path sets `signal` and `whyNow` from one `item.body`, so text equality is
    // NOT identity here. Removing by text would delete a second, genuinely
    // different finding. CLAUDE.md trap 19, in the one place it would bite.
    const twin = REC('r9', A.signal)
    const rest = selectAlsoWorthDoing([A, twin, B] as never, A as never)
    expect(rest.map((r) => r.id), 'a same-worded sibling must survive').toEqual(['r9', 'r2'])
  })

  it('a focus card that is not in the list leaves the list untouched', () => {
    const rest = selectAlsoWorthDoing([B, C] as never, A as never)
    expect(rest.map((r) => r.id)).toEqual(['r2', 'r3'])
  })

  it('no rendered sentence appears in both places at once', () => {
    // The property as a user would state it, over the pair the defect produced.
    const focus = A
    const rest = selectAlsoWorthDoing([A, B, C] as never, focus as never)
    expect(rest.some((r) => r.id === focus.id), 'the promoted card is repeated below').toBe(false)
  })
})
