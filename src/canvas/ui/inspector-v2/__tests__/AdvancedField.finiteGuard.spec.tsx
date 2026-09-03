/**
 * ⭐⭐⭐ THE NUMERIC ADVANCED FIELD COMMITTED `Infinity`, AND AN ARGUMENT WAS
 * BUILT ON THE ASSUMPTION THAT IT COULD NOT.
 *
 * ⚠⚠ THIS SPEC EXISTS BECAUSE A CLAIM I WROTE WAS REFUTED BY EXECUTION. A
 * sibling change of mine asserted this field *"rejects a non-parsing input"*,
 * and used that to argue a non-finite goal target was unreachable in the
 * product. An independent review drove it with discriminating controls and
 * found **`Infinity`, `-Infinity`, `1e400` and `9e999` all COMMIT**, while `42`
 * commits and `abc` is refused. The reasoning was done about the WIRE; the
 * local writer was never driven. `9e999` is a fat-finger, not an attack.
 *
 * Three things had to line up, and did:
 *   · `validate` and the commit guard both used `isNaN`, and
 *     `isNaN(Infinity)` is `false`;
 *   · `parseFloat` returns `±Infinity` for `'Infinity'`, `'1e400'`, `'9e999'`;
 *   · the input is `type="text"` on BOTH branches, so no browser sanitisation
 *     sits behind the guard either.
 *
 * What committed flowed through `useInspectorMutations.setThreshold` — an
 * unguarded passthrough — onto `goal_threshold_raw`, which is the field the
 * canvas goal card and the hero success field both read.
 *
 * ⚠ THE CONTROLS ARE THE POINT. An "it is refused" assertion is worthless
 * unless the same harness is shown COMMITTING something, so every refusal case
 * here sits beside `42`, and the refusal case `abc` proves the field was
 * already capable of refusing before this change touched it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AdvancedField } from '../shared/AdvancedField'

function driveNumberField(typed: string): unknown[] {
  const onChange = vi.fn()
  const { unmount } = render(
    <AdvancedField label="Raw threshold" value={undefined} onChange={onChange} type="number" />,
  )
  const input = screen.getByRole('textbox')
  fireEvent.change(input, { target: { value: typed } })
  fireEvent.blur(input)
  const committed = onChange.mock.calls.map((c) => c[0])
  unmount()
  return committed
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AdvancedField (type=number) — what a person can actually commit', () => {
  /**
   * ⛔ POSITIVE CONTROL FIRST. Every refusal below is an absence, and an
   * absence proves nothing unless this harness can be shown to commit.
   */
  it('POSITIVE CONTROL — an ordinary number commits', () => {
    expect(driveNumberField('42')).toEqual([42])
  })

  /**
   * ⛔ CONTRAST CONTROL — the field could already refuse SOMETHING before this
   * change, so a green refusal below is not just "the field refuses
   * everything now".
   */
  it('CONTRAST CONTROL — a non-numeric string was already refused', () => {
    expect(driveNumberField('abc')).toEqual([])
  })

  /**
   * ⭐⭐ THE FOUR THAT COMMITTED. Driven, not reasoned about.
   *
   * ⚠ BOTH SIGNS, DELIBERATELY. `Number.isFinite` is sign-symmetric and the
   * list that missed this defect was not — `-Infinity` is here because the
   * predicate has two sides, not because somebody remembered it.
   */
  it.each([
    ['the word Infinity', 'Infinity'],
    ['a negative Infinity', '-Infinity'],
    ['an overflowing literal', '1e400'],
    ['a fat-finger exponent', '9e999'],
    ['a negative overflow', '-1e400'],
  ])('%s does NOT commit', (_name, typed) => {
    expect(driveNumberField(typed)).toEqual([])
  })

  it.each([
    ['the word Infinity', 'Infinity'],
    ['a fat-finger exponent', '9e999'],
  ])('%s is refused with a reason that is TRUE of it', (_name, typed) => {
    // ⚠ `Infinity` IS a number, so "Must be a number" would refuse the value
    // while denying the reason. The copy moves with the predicate.
    const onChange = vi.fn()
    render(<AdvancedField label="Raw threshold" value={undefined} onChange={onChange} type="number" />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: typed } })
    fireEvent.blur(input)
    expect(screen.getByText('Must be a finite number')).toBeTruthy()
  })

  /**
   * ⭐ THE ACCEPTED HALF, so the guard cannot degenerate into "refuse
   * everything" and pass this file by committing nothing ever.
   */
  it.each([
    ['zero', '0', 0],
    ['a negative', '-3.5', -3.5],
    ['a decimal', '0.5', 0.5],
    ['scientific notation that fits', '1e5', 100000],
    ['a very large but finite literal', '1e308', 1e308],
  ])('ACCEPTED — %s commits', (_name, typed, expected) => {
    expect(driveNumberField(typed)).toEqual([expected])
  })
})
