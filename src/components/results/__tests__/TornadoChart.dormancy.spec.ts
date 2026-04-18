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

const RESULTS_BODY = resolve(__dirname, '../ResultsBody.tsx')

describe('Brief 5 P1-3 — TornadoChart apply-rerun dormancy', () => {
  it('ResultsBody does NOT currently pass onApplyAndRerun to TornadoChart (dormant pending PLoT bounds)', () => {
    const src = readFileSync(RESULTS_BODY, 'utf-8')

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
