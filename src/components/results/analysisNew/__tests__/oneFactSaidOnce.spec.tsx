/**
 * A SECTION HEADER STATES A FACT ONCE.
 *
 * ## Witnessed
 *
 * Deployed build, real session: the Strengthen header rendered a count badge
 * reading **"4"** beside a subtitle reading **"0 addressed · 4 worth checking"**.
 * The same number twice, 40px apart — and the badge is the copy that says LESS.
 *
 * It arrived the way duplications usually do: `count` had been on this shell
 * since it shipped, and a subtitle was added later by a different change that
 * had no reason to look at the badge.
 *
 * ## Why the rule is DERIVED and not a prop
 *
 * ⚠ A `showCount` prop would let a caller pass a subtitle that states the count
 * AND ask for the badge anyway — the drift this closes, re-admitted through the
 * API. Asking the SUBTITLE whether it already carries the number cannot go
 * stale, because the subtitle is the thing that carries it.
 *
 * ⚠ WORD-BOUNDARY MATCHED. A substring test would let a subtitle mentioning
 * "14" suppress a badge reading "4" — hiding a count for the wrong reason, which
 * is worse than showing it twice.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Sparkles } from 'lucide-react'

import { SectionShell } from '../sections/SectionShell'

afterEach(() => cleanup())

const T = 'sec'
const shell = (props: { count: number | null; subtitle?: string }) =>
  render(
    <SectionShell icon={Sparkles} title="Strengthen the reasoning" testId={T} {...props}>
      <p>body</p>
    </SectionShell>,
  )

describe('a header states a fact once', () => {
  it('⛔ suppresses the badge when the subtitle already states the count', () => {
    shell({ count: 4, subtitle: '0 addressed · 4 worth checking' })
    expect(screen.getByTestId(`${T}-subtitle`), 'PRECONDITION: the subtitle renders').toBeInTheDocument()
    expect(
      screen.queryByTestId(`${T}-count`),
      'the badge repeats the subtitle and says less than it',
    ).toBeNull()
  })

  it('keeps the badge when the subtitle says something else entirely', () => {
    shell({ count: 4, subtitle: 'Drivers, what is worth resolving, and the receipts' })
    expect(screen.getByTestId(`${T}-count`)).toHaveTextContent('4')
  })

  it('keeps the badge when there is no subtitle at all', () => {
    shell({ count: 4 })
    expect(screen.getByTestId(`${T}-count`)).toHaveTextContent('4')
  })

  /**
   * ⛔ THE ARM THAT STOPS A SUBSTRING TEST CREEPING BACK IN. "14" contains "4",
   * and a naive `includes` would hide a badge the reader needs.
   */
  it('⛔ a subtitle mentioning 14 does not suppress a badge for 4', () => {
    shell({ count: 4, subtitle: '14 findings were considered' })
    expect(
      screen.getByTestId(`${T}-count`),
      'hiding a count for the wrong reason is worse than showing it twice',
    ).toHaveTextContent('4')
  })

  it('still renders no badge for a zero count — the convention this shell already owns', () => {
    shell({ count: 0, subtitle: 'nothing to report' })
    expect(screen.queryByTestId(`${T}-count`)).toBeNull()
  })
})

/**
 * ⭐⭐ THE HALF THIS CHANGE GOT WRONG FIRST, AND CI CAUGHT.
 *
 * Suppressing the badge is a rule about what the READER meets. It must not be
 * a rule about what the section KNOWS. The first version of this change let
 * the number leave the DOM entirely when the subtitle stated it — and three
 * preconditions in `strengthenOpensPreRun.spec.tsx` were reading that badge to
 * prove their fixture still grounded exactly one finding.
 *
 * ⚠ Note the DIRECTION of the harm. Those preconditions exist so the assertions
 * beneath them cannot pass vacuously. Binding a precondition to a rendered
 * element whose presence depends on COPY means a future subtitle reword
 * silently removes the guard — no red, and the file goes on agreeing with
 * itself. That is this estate's trap 13b reached through a display rule.
 *
 * So the count is now carried on the section unconditionally, and the badge is
 * the only thing the rule governs.
 */
describe('the fact is still KNOWN when it is not SAID', () => {
  it('⛔ carries the count on the section even when the badge is suppressed', () => {
    shell({ count: 4, subtitle: '0 addressed · 4 worth checking' })
    expect(
      screen.queryByTestId(`${T}-count`),
      'PRECONDITION: this is the suppressed case, or the arm proves nothing',
    ).toBeNull()
    expect(
      screen.getByTestId(T),
      'a suppressed badge must not take the fact out of the DOM',
    ).toHaveAttribute('data-section-count', '4')
  })

  it('carries the count when the badge DOES draw, so readers need only one binding', () => {
    shell({ count: 4, subtitle: 'Drivers, what is worth resolving, and the receipts' })
    expect(screen.getByTestId(`${T}-count`)).toHaveTextContent('4')
    expect(screen.getByTestId(T)).toHaveAttribute('data-section-count', '4')
  })

  it('carries a zero rather than dropping it — 0 findings is a fact, not an absence', () => {
    shell({ count: 0, subtitle: 'nothing to report' })
    expect(screen.getByTestId(T)).toHaveAttribute('data-section-count', '0')
  })

  /**
   * ⚠ THE DISCRIMINATING TWIN. Without it, an implementation that stamped a
   * constant on every section would satisfy every arm above.
   */
  it('⛔ omits the attribute entirely when the section has no count to carry', () => {
    shell({ count: null, subtitle: 'nothing countable here' })
    expect(
      screen.getByTestId(T),
      'absent is a different fact from zero, and the shell already distinguishes them',
    ).not.toHaveAttribute('data-section-count')
  })
})
