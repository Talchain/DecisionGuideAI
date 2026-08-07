/**
 * Dormancy trip-wire — Brief 5 follow-up P1-3.
 *
 * TornadoChart's Apply-and-rerun button is gated on `onApplyAndRerun` and
 * rendered dormant in production: commit 2492fb15 (2026-02-12) deliberately
 * disabled the wire from ResultsBody because outcome-space values can't be
 * written to factor-space observedState.value without PLoT factor_sensitivity
 * bounds.
 *
 * This spec is a *tripwire*: it asserts the CURRENT production state
 * (ResultsBody does NOT pass `onApplyAndRerun` to TornadoChart). The day the
 * upstream bounds ship and someone re-enables the wire, this test fails and
 * prompts a review — catching the re-enable rather than letting it slip past.
 *
 * When the wire is re-enabled:
 *   1. Confirm PLoT factor_sensitivity bounds are in place.
 *   2. Update this file to assert the wired-call shape instead.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { blankNonCode } from '../../../../tests/helpers/stripSourceComments'

const RESULTS_BODY = resolve(__dirname, '../ResultsBody.tsx')

describe('Brief 5 P1-3 — TornadoChart apply-rerun dormancy', () => {
  it('ResultsBody does NOT currently pass onApplyAndRerun to TornadoChart (dormant pending PLoT bounds)', () => {
    // blankNonCode blanks comments AND string bodies (offsets preserved): a
    // commented-out `onApplyAndRerun=` prop inside the tag can no longer
    // false-red (the #386/#403 footgun), and blanking string prop values also
    // hardens the opening-tag extraction against a stray `>` inside a string.
    const src = blankNonCode(readFileSync(RESULTS_BODY, 'utf-8'))

    // Find the TornadoChart JSX block. Supports both self-closing
    // (`<TornadoChart ... />`) and open/close (`<TornadoChart ...>...` followed
    // by `</TornadoChart>`). We only need the opening tag's prop list, so we
    // take everything from `<TornadoChart` up to the first `>` that is not
    // part of `=>` (arrow functions in prop expressions would contain `>`,
    // but the opening-tag closer is either `>` after a prop value or `/>`).
    const openIdx = src.indexOf('<TornadoChart')
    expect(openIdx, 'TornadoChart is mounted in ResultsBody').toBeGreaterThan(-1)
    const tail = src.slice(openIdx)
    const openerMatch = tail.match(/<TornadoChart[\s\S]*?\/?>/)
    expect(openerMatch, 'TornadoChart opening tag parses cleanly').not.toBeNull()
    const tornadoBlock = openerMatch![0]

    expect(
      tornadoBlock.includes('onApplyAndRerun='),
      [
        'ResultsBody now passes onApplyAndRerun to TornadoChart.',
        'This tripwire from Brief 5 follow-up P1-3 expected the wire to stay',
        'dormant until PLoT factor_sensitivity bounds ship (commit 2492fb15).',
        'If bounds are now in place, update this test to assert the wired shape.',
        'If not, this regression needs investigation.',
      ].join(' '),
    ).toBe(false)
  })
})

/**
 * Both-directions mutation proof for the blankNonCode strip (#386/#403).
 * A live prop in the tag is still seen; a commented-out one is not.
 */
describe('TornadoChart dormancy — detector contract', () => {
  const tagHasProp = (src: string, prop: string): boolean => {
    const b = blankNonCode(src)
    const openIdx = b.indexOf('<TornadoChart')
    if (openIdx < 0) return false
    const opener = b.slice(openIdx).match(/<TornadoChart[\s\S]*?\/?>/)
    return !!opener && opener[0].includes(prop)
  }

  it('STILL sees a live onApplyAndRerun prop in the tag', () => {
    expect(tagHasProp('<TornadoChart data={d} onApplyAndRerun={rerun} />', 'onApplyAndRerun=')).toBe(true)
  })

  it('does NOT see a prop commented out inside a JSX {/* … */}', () => {
    expect(
      tagHasProp('<TornadoChart data={d} {/* onApplyAndRerun={rerun} */} />', 'onApplyAndRerun='),
    ).toBe(false)
  })

  it('does NOT see a prop on a //-commented line inside the tag', () => {
    expect(
      tagHasProp('<TornadoChart\n  data={d}\n  // onApplyAndRerun={rerun}\n/>', 'onApplyAndRerun='),
    ).toBe(false)
  })
})
