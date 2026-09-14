/**
 * ⭐⭐⭐ A DECLARED BOUND THAT DOES NOT FIRE, AND A SILENT CLAMP BEHIND IT.
 *
 * `InlineNumberEditor` is the PRIMARY click-to-edit numeric field — the one on
 * the inspector's `PrimaryControlCard`, which a person reaches without opening
 * "Advanced". It ACCEPTS `min` and `max` props, paints them on the DOM element,
 * and — until this change — IGNORED THEM ON COMMIT.
 *
 * HTML `min`/`max` on a number input constrain the STEPPER and set `:invalid`.
 * They do not stop a TYPED value, and nothing here called `checkValidity()`. The
 * guard was `if (isNaN(parsed)) return` (`InlineNumberEditor.tsx:78` at
 * `3b2df4ce`) and nothing else.
 *
 * ⭐ THE WITNESSED CONSEQUENCE. `RiskPanel` declares `min={0} max={100}` on the
 * likelihood field (`RiskPanel.tsx:139-140`) — a bound the repo's own field
 * register states as the contract ("A risk's likelihood [0,1]",
 * `canvas/domain/analyticalNodeFields.ts:184`). Typing `150` committed, and
 * `setProbability` then SILENTLY CLAMPED it to `1`
 * (`useInspectorMutations.ts:459-460`). The model held 100% while the person
 * believed they had said 150%, and nothing on screen said otherwise. A guard
 * that is declared and does not fire is worse than no guard: it reads as
 * protection on review.
 *
 * ⚠⚠ AN ARM OF THE ORIGINAL DIAGNOSIS WAS REFUTED BY THIS FILE'S OWN
 * INSTRUMENT, AND IS RECORDED RATHER THAN QUIETLY DROPPED.
 *
 * The sibling `AdvancedField.finiteGuard.spec.tsx` pins a defect found on
 * 3 Sep 2026: `isNaN(Infinity)` is `false`, `parseFloat` returns `±Infinity`
 * for `'Infinity'`, `'1e400'` and `'9e999'`, so all of them COMMITTED there.
 * This field carried the identical `isNaN` guard, so the obvious conclusion was
 * that it carried the identical defect. **It does not, and the reason is one
 * attribute.** `AdvancedField`'s own header records that its input is
 * `type="text"` on both branches, *"so there is no browser sanitisation behind
 * this either"* — and that clause is exactly what does not hold here.
 *
 * Measured, not reasoned about (jsdom, this repo, 9 Sep 2026): a bare
 * `<input type="number">` given `'Infinity'`, `'-Infinity'`, `'1e400'`,
 * `'9e999'` or `'-1e400'` sanitises its value to `''` for every one of them,
 * while `'42'` and `'150'` are carried through verbatim. So a non-finite value
 * cannot reach this commit path by TYPING, and five refusal assertions written
 * against it would have passed **vacuously** — the input never held the string
 * they described (trap 13: an absence assertion needs a positive control on its
 * own INPUT, not only on its output). They are not in this file.
 *
 * The finite check still lives in the shared predicate this field now calls,
 * because that predicate is `AdvancedField`'s — where the branch IS reachable
 * and IS pinned. Sharing it is the point; claiming it closes a defect HERE
 * would not be.
 *
 * ⚠ THE CONTROLS ARE THE POINT, and they are this file's inheritance from the
 * spec above. Every refusal here sits beside a commit of the SAME number under
 * a different declared bound, so a refusal cannot be some other predicate that
 * happens to dislike `150`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InlineNumberEditor } from '../shared/InlineNumberEditor'

interface DriveOpts {
  min?: number
  max?: number
  /** The editor's seeded exact value. `null` = no current value. */
  value?: number | null
}

/**
 * Drive the editor as a person does: click the display button to enter edit
 * mode, type, blur.
 *
 * ⚠ BINDS BY TESTID, NOT BY ROLE. The display control is a `button` and the
 * editor is an `input`; a role query would silently follow whichever happens to
 * be mounted, and which of the two you are left on is part of this spec's
 * subject.
 */
function drive(typed: string, opts: DriveOpts = {}): { committed: unknown[]; unmount: () => void } {
  const onSave = vi.fn()
  const { unmount } = render(
    <InlineNumberEditor
      readout={opts.value != null ? String(opts.value) : null}
      placeholder="No value set. Click to enter."
      value={opts.value ?? null}
      onSave={onSave}
      displayTestId="probe-display"
      inputTestId="probe-input"
      {...(opts.min != null ? { min: opts.min } : {})}
      {...(opts.max != null ? { max: opts.max } : {})}
    />,
  )
  fireEvent.click(screen.getByTestId('probe-display'))
  const input = screen.getByTestId('probe-input')
  fireEvent.change(input, { target: { value: typed } })
  fireEvent.blur(input)
  return { committed: onSave.mock.calls.map((c) => c[0]), unmount }
}

function driveCommitted(typed: string, opts: DriveOpts = {}): unknown[] {
  const { committed, unmount } = drive(typed, opts)
  unmount()
  return committed
}

beforeEach(() => {
  vi.clearAllMocks()
})

/**
 * ⛔⛔ THE INSTRUMENT'S OWN PRECONDITION, ASSERTED IN-TEST.
 *
 * Every refusal in this file is an absence, and an absence is evidence only if
 * the input actually HELD the string it is about. `type="number"` silently
 * rewrites what it will not accept, so this block pins WHICH strings survive
 * sanitisation — and therefore which of this file's cases are about the
 * component at all. If a future change makes `150` unreachable by typing, this
 * REDs here rather than turning every case below into a tautology.
 */
describe('instrument precondition — what a number input actually carries', () => {
  it.each([
    ['an ordinary number', '42', '42'],
    ['the over-max case this spec is about', '150', '150'],
    ['the under-min case this spec is about', '-5', '-5'],
  ])('%s survives sanitisation', (_name, typed, expected) => {
    render(<input type="number" data-testid="raw" defaultValue="" />)
    const el = screen.getByTestId('raw') as HTMLInputElement
    fireEvent.change(el, { target: { value: typed } })
    expect(el.value).toBe(expected)
  })

  /**
   * ⛔ THE DISCRIMINATION, or the block above proves only that the input
   * accepts things. These are the strings the original diagnosis was written
   * about; they do NOT survive, which is why no case in this file asserts a
   * component-level refusal of them.
   */
  it.each([['Infinity'], ['-Infinity'], ['1e400'], ['9e999'], ['-1e400']])(
    '%s is sanitised away before the component ever sees it',
    (typed) => {
      render(<input type="number" data-testid="raw" defaultValue="" />)
      const el = screen.getByTestId('raw') as HTMLInputElement
      fireEvent.change(el, { target: { value: typed } })
      expect(el.value).toBe('')
    },
  )
})

describe('InlineNumberEditor — the declared min/max is enforced, not decorative', () => {
  /**
   * ⛔ POSITIVE CONTROL FIRST. Without it, every refusal below is equally
   * consistent with a field that ignores its input entirely.
   */
  it('POSITIVE CONTROL — a value inside the declared range commits', () => {
    expect(driveCommitted('40', { min: 0, max: 100 })).toEqual([40])
  })

  /**
   * ⭐ BOTH ENDS, AND BOTH INCLUSIVE. `min`/`max` are inclusive in
   * `AdvancedField`'s predicate (`num < min` / `num > max`), and this field now
   * shares that predicate — so the endpoints must COMMIT. A guard written with
   * `<=` would satisfy every refusal case below while silently making `0%` and
   * `100%` unstateable, and nothing else here would notice.
   */
  it.each([
    ['the lower endpoint', '0', 0],
    ['the upper endpoint', '100', 100],
  ])('ACCEPTED — %s commits (bounds are inclusive)', (_name, typed, expected) => {
    expect(driveCommitted(typed, { min: 0, max: 100 })).toEqual([expected])
  })

  /** ⭐⭐ THE WITNESSED CASE — `RiskPanel`'s `min={0} max={100}` likelihood. */
  it('a value above the declared max does NOT commit', () => {
    expect(driveCommitted('150', { min: 0, max: 100 })).toEqual([])
  })

  it('a value below the declared min does NOT commit', () => {
    expect(driveCommitted('-5', { min: 0, max: 100 })).toEqual([])
  })

  /**
   * ⛔⛔ THE DISCRIMINATING PAIR (trap 19). The refusals above must be the
   * DECLARED bound doing the work, not some other predicate that happens to
   * dislike these numbers. Same component, same typed string, different
   * declaration — and it must COMMIT.
   */
  it('DISCRIMINATOR — the SAME 150 commits when no max is declared', () => {
    expect(driveCommitted('150', { min: 0 })).toEqual([150])
  })

  it('DISCRIMINATOR — the SAME 150 commits when the declared max admits it', () => {
    expect(driveCommitted('150', { min: 0, max: 200 })).toEqual([150])
  })

  it('DISCRIMINATOR — the SAME -5 commits when no min is declared', () => {
    expect(driveCommitted('-5', { max: 100 })).toEqual([-5])
  })

  /**
   * ⭐ FAIL OPEN WHERE NOTHING IS DECLARED. `FactorObservablePanel` passes NO
   * bounds (`FactorObservablePanel.tsx:317-326`) because no bound is known for
   * an arbitrary observed magnitude. Inventing one there would refuse legal
   * values — the opposite defect, and the more expensive one, since it makes
   * true statements unsayable rather than false ones sayable.
   */
  it('with NO declared bounds, a large magnitude still commits', () => {
    expect(driveCommitted('60000')).toEqual([60000])
  })
})

describe('InlineNumberEditor — a refusal SAYS WHY, and keeps the person in the field', () => {
  it('an over-max value names the bound it broke', () => {
    const { unmount } = drive('150', { min: 0, max: 100 })
    expect(screen.getByText('Max: 100')).toBeTruthy()
    unmount()
  })

  it('an under-min value names the bound it broke', () => {
    const { unmount } = drive('-5', { min: 0, max: 100 })
    expect(screen.getByText('Min: 0')).toBeTruthy()
    unmount()
  })

  /**
   * ⭐⭐ THE BEHAVIOURAL HALF, and the reason this is a product change rather
   * than a validator. BEFORE: a refused entry ran `setIsEditing(false)` FIRST
   * and then returned, so the field snapped back to its old readout and the
   * person's number vanished with no explanation. A silent discard and a silent
   * clamp are the same defect wearing different clothes.
   */
  it('a refused entry KEEPS the input open with the typed text intact', () => {
    const { unmount } = drive('150', { min: 0, max: 100 })
    const input = screen.getByTestId('probe-input') as HTMLInputElement
    expect(input.value).toBe('150')
    unmount()
  })

  /**
   * ⛔ THE OTHER DIRECTION, or the assertion above is satisfied by a field that
   * never closes at all.
   */
  it('an ACCEPTED entry closes the input and shows no error', () => {
    const { unmount } = drive('40', { min: 0, max: 100 })
    expect(screen.queryByTestId('probe-input')).toBeNull()
    expect(screen.getByTestId('probe-display')).toBeTruthy()
    expect(screen.queryByText(/^(Min|Max):/)).toBeNull()
    unmount()
  })

  /**
   * ⛔ THE ERROR MUST CLEAR. A message that outlives the condition it describes
   * is the same class of untruth as one that never appears.
   */
  it('the refusal clears once the entry is corrected', () => {
    const onSave = vi.fn()
    render(
      <InlineNumberEditor
        readout={null}
        placeholder="No value set. Click to enter."
        value={null}
        onSave={onSave}
        displayTestId="probe-display"
        inputTestId="probe-input"
        min={0}
        max={100}
      />,
    )
    fireEvent.click(screen.getByTestId('probe-display'))
    fireEvent.change(screen.getByTestId('probe-input'), { target: { value: '150' } })
    fireEvent.blur(screen.getByTestId('probe-input'))
    expect(screen.getByText('Max: 100')).toBeTruthy()

    fireEvent.change(screen.getByTestId('probe-input'), { target: { value: '40' } })
    fireEvent.blur(screen.getByTestId('probe-input'))
    expect(screen.queryByText('Max: 100')).toBeNull()
    expect(onSave.mock.calls.map((c) => c[0])).toEqual([40])
  })

  /**
   * ⭐ AN EMPTY ENTRY IS NOT AN ERROR — IT IS "NO CHANGE", AND THAT IS
   * DELIBERATE RATHER THAN INHERITED.
   *
   * `type="number"` rewrites everything it will not accept to `''` (pinned in
   * the precondition block above), so `abc` and an untouched field are
   * INDISTINGUISHABLE here by the time the commit guard runs. Erroring on that
   * would fire on someone who clicked in and clicked straight out — a false
   * alarm on the commonest gesture there is — and the message could not be
   * true of both cases anyway. Closing silently is exactly today's behaviour
   * for this input, preserved on purpose.
   */
  it('an empty entry neither commits nor errors, and closes the field', () => {
    const { committed, unmount } = drive('', { min: 0, max: 100 })
    expect(committed).toEqual([])
    expect(screen.queryByText(/^(Min|Max):/)).toBeNull()
    expect(screen.queryByText('Must be a finite number')).toBeNull()
    expect(screen.queryByTestId('probe-input')).toBeNull()
    unmount()
  })
})

describe('InlineNumberEditor — the no-op contract (P1-4) is untouched', () => {
  /**
   * ⛔ THE REGRESSION GUARD FOR THE BEHAVIOUR THIS CHANGE MUST NOT BREAK.
   * Opening a `0.376` (displayed "38%") and blurring unchanged must remain a
   * NO-OP — committing the seeded value would round-trip it through the
   * caller's scale conversion, destroy producer precision and falsely dirty the
   * graph. That guarantee predates this change and is pinned in
   * `InlineNumberEditor.precision.spec.tsx`; it is restated here because the
   * admission check runs BEFORE the no-op check and could have swallowed it.
   */
  it('an unchanged blur is still a no-op', () => {
    expect(driveCommitted('0.376', { value: 0.376 })).toEqual([])
  })

  /**
   * ⭐⭐ AND THE ORDER MATTERS THE OTHER WAY TOO. A value the PRODUCER already
   * stored outside today's declared bound must not be re-committed by an
   * unchanged blur — and must not error either, because the person changed
   * nothing and has nothing to correct. Refusing here would put an error on a
   * field the reader merely looked at.
   */
  it('an unchanged blur on an out-of-range seed neither commits nor errors', () => {
    const { committed, unmount } = drive('150', { value: 150, min: 0, max: 100 })
    expect(committed).toEqual([])
    expect(screen.queryByText('Max: 100')).toBeNull()
    unmount()
  })
})
