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
