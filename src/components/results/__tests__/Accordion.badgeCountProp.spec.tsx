/**
 * The collapsed sections on the Analysis tab must show HOW MUCH is inside them
 * (L-57, "collapsed sections with honest counts").
 *
 * ⚠ THIS EXISTS BECAUSE THE COUNT WAS SILENTLY ABSENT FOR THE WHOLE LIFE OF
 * THE FEATURE. `ResultsBody` passed `count={…}` to `Accordion`, which has no
 * such prop — the badge is `badgeCount`. React drops unknown props on a
 * function component without a word, so the drivers accordion rendered with no
 * count, beside a `badgeState` styling a badge that did not exist. Nothing
 * failed: not the suite, not the browser, not the reviewer's eye, because a
 * missing badge looks exactly like a badge that legitimately has nothing to
 * show. The TypeScript excess-property error that WOULD have caught it is one
 * of three ratcheted into this file's typecheck baseline.
 *
 * So the guard is in two halves, and neither alone is sufficient:
 *   1. a DISCRIMINATING PAIR proving the prop NAME is load-bearing — the right
 *      name renders the number, the wrong name renders nothing. A test that
 *      only asserted "badgeCount renders" would pass just as happily against
 *      the broken call site, because the call site is not what it looks at.
 *   2. a SOURCE SCAN over the real call sites, so the defect cannot return by
 *      someone typing the plausible-but-wrong name again. Derived from the
 *      source, not from a list of known-good call sites.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { Accordion } from '../Accordion'

describe('Accordion count badge', () => {
  it('renders the number when given the REAL prop name', () => {
    const { getByText } = render(
      <Accordion title="What is driving this" badgeCount={7}>
        <div />
      </Accordion>,
    )
    expect(getByText('7')).toBeTruthy()
  })

  it('renders NOTHING for the wrong prop name — the defect, reproduced', () => {
    // The other half of the pair. This is what the product actually shipped.
    const { queryByText } = render(
      <Accordion title="What is driving this" {...({ count: 7 } as Record<string, unknown>)}>
        <div />
      </Accordion>,
    )
    expect(queryByText('7')).toBeNull()
  })

  it('omits the badge at zero — "0 items" is noise, not a disclosure', () => {
    const { queryByText } = render(
      <Accordion title="What is driving this" badgeCount={0}>
        <div />
      </Accordion>,
    )
    expect(queryByText('0')).toBeNull()
  })
})

describe("ResultsBody's accordion call sites use the prop that works", () => {
  const source = readFileSync(resolve(__dirname, '../ResultsBody.tsx'), 'utf8')

  it('CONTROL: the scan can see the call sites it is judging', () => {
    // Trap 13: the assertion below is an absence claim over a file read. A
    // typo in the path, or a moved file, would satisfy it perfectly.
    expect(source).toMatch(/<Accordion/)
    expect(source.match(/badgeCount=\{/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('passes no `count=` prop to any Accordion', () => {
    expect(source).not.toMatch(/^\s*count=\{/m)
  })
})
