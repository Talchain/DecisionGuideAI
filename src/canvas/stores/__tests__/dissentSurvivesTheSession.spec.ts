/**
 * ⭐⭐ A USER'S DISAGREEMENT OUTLIVES THE BROWSER SESSION — WITHOUT THE THREE
 * HARMS THE OBVIOUS VERSION WOULD SHIP.
 *
 * WITNESSED on deployed staging `811c93b1`: press "I disagree" on a coaching
 * finding, type why, press "Record this". It renders beside the finding, lands
 * in `sessionStorage`, and `localStorage` holds nothing. A tab-by-tab sweep
 * found the words on the Reasoning tab only. It survived nothing.
 *
 * Each harm below is pinned, because a design that only CLAIMS to avoid them is
 * a guard agreeing with itself:
 *
 *  1. FALSE ATTRIBUTION — the worst of the three. Recommendation ids carry NO
 *     scenario component: `strengthen:robustness`, `strengthen:broaden` and
 *     `strengthen:commit` are constant literals identical in EVERY decision.
 *     An unpartitioned durable store therefore shows a person their own words
 *     about a decision they never wrote them about.
 *  2. CROSS-TAB CLOBBER — PR #1272's review faulted a read-once/write-whole-map
 *     store. A `storage` listener cannot fix it (it fires in OTHER tabs, AFTER
 *     the loss); only read-modify-write can.
 *  3. A STALENESS LIE — the `disputed` history event carries no run identity at
 *     all, so a dissent read beside a later analysis is a claim never made.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

let scenarioId: string | null = 'scn_alpha'
vi.mock('../../store/scenarios', () => ({ getCurrentScenarioId: () => scenarioId }))

import {
  recordDissent, readDissent, dissentCurrency, clearDurableDissent,
} from '../dissentStore'

const PREFIX = 'olumi.dissent.v1.'
const keys = () => Object.keys(localStorage).filter((k) => k.startsWith(PREFIX))

beforeEach(() => {
  localStorage.clear()
  scenarioId = 'scn_alpha'
})

describe('the words outlive the tab', () => {
  it('⭐ a disagreement is written to a durable, scenario-keyed home', () => {
    expect(recordDissent('strengthen:robustness', 'Our team has spare capacity in Q1.', 'hash_1')).toBe(true)
    expect(keys()).toEqual([`${PREFIX}scn_alpha`])
    expect(readDissent()['strengthen:robustness'].reason).toBe('Our team has spare capacity in Q1.')
  })

  it('⛔ an empty reason is a no-op — silence in a different costume is still silence', () => {
    expect(recordDissent('r1', '   ', 'hash_1')).toBe(false)
    expect(keys()).toEqual([])
  })

  it('⛔ NO SCENARIO ID MEANS NO DURABLE HOME, and it says so rather than inventing one', () => {
    // A global bucket would mix unrelated boards and outlive what it describes.
    scenarioId = null
    expect(recordDissent('r1', 'a real objection', 'hash_1')).toBe(false)
    expect(keys()).toEqual([])
    expect(readDissent()).toEqual({})
  })
})

describe('⛔ HARM 1 — false attribution across decisions', () => {
  it('the SAME constant recommendation id does not leak between decisions', () => {
    // `strengthen:robustness` is a literal, identical in every decision. This is
    // the case an unpartitioned store gets wrong, and it is the worst harm
    // available here: not losing the user's words, but misattributing them.
    recordDissent('strengthen:robustness', 'ALPHA reasoning', 'hash_a')
    scenarioId = 'scn_beta'
    recordDissent('strengthen:robustness', 'BETA reasoning', 'hash_b')

    expect(readDissent()['strengthen:robustness'].reason).toBe('BETA reasoning')
    scenarioId = 'scn_alpha'
    expect(readDissent()['strengthen:robustness'].reason).toBe('ALPHA reasoning')
    // PRECONDITION for the two reads above: both really are stored, under
    // different keys — otherwise this passes by one of them being absent.
    expect(keys().sort()).toEqual([`${PREFIX}scn_alpha`, `${PREFIX}scn_beta`])
  })
})

describe('⛔ HARM 2 — the cross-tab clobber', () => {
  it('a write MERGES into live storage rather than overwriting a snapshot', () => {
    // Another tab wrote this while we were on screen. A read-once/write-whole
    // store — the shape #1272's review faulted — would erase it.
    localStorage.setItem(`${PREFIX}scn_alpha`, JSON.stringify({
      version: 1,
      records: { 'strengthen:broaden': { reason: 'WRITTEN BY THE OTHER TAB', at: 1 } },
    }))

    recordDissent('strengthen:commit', 'written by this tab', 'hash_1')

    const now = readDissent()
    expect(now['strengthen:commit'].reason).toBe('written by this tab')
    // The discriminating half: the other tab's entry SURVIVED.
    expect(now['strengthen:broaden'].reason).toBe('WRITTEN BY THE OTHER TAB')
  })

  it('re-recording the same finding replaces only that entry', () => {
    recordDissent('r1', 'first words', 'hash_1')
    recordDissent('r2', 'other finding', 'hash_1')
    recordDissent('r1', 'revised words', 'hash_1')
    const now = readDissent()
    expect(now.r1.reason).toBe('revised words')
    expect(now.r2.reason).toBe('other finding')
  })
})

describe('⛔ HARM 3 — the staleness lie', () => {
  it('⭐ NEVER asserts "changed" from an ABSENCE of a stamp', () => {
    // A record written before stamping existed, or on a run whose hash could
    // not be established, is UNKNOWN. Saying "an earlier analysis" about a
    // record we cannot place would invent a fact on the honesty surface.
    expect(dissentCurrency({ reason: 'x', at: 1 }, 'hash_now')).toBe('unknown')
    expect(dissentCurrency({ reason: 'x', at: 1, analysisHash: 'hash_a' }, undefined)).toBe('unknown')
    expect(dissentCurrency(undefined, 'hash_now')).toBe('unknown')
  })

  it('⭐ and it DOES discriminate when both are known — or the guard says nothing', () => {
    expect(dissentCurrency({ reason: 'x', at: 1, analysisHash: 'hash_a' }, 'hash_a')).toBe('current')
    expect(dissentCurrency({ reason: 'x', at: 1, analysisHash: 'hash_a' }, 'hash_b')).toBe('changed')
  })

  it('the run is stamped at the moment the words are composed', () => {
    recordDissent('r1', 'words', 'hash_at_compose_time')
    expect(readDissent().r1.analysisHash).toBe('hash_at_compose_time')
  })
})

describe('sign-out clears durable dissent', () => {
  it('⛔ SWEEPS BY PREFIX, so a scenario nobody listed is still cleared', () => {
    recordDissent('r1', 'alpha', 'h')
    scenarioId = 'scn_beta'; recordDissent('r1', 'beta', 'h')
    scenarioId = 'scn_never_listed'; recordDissent('r1', 'gamma', 'h')
    expect(keys()).toHaveLength(3)
    // CONTRAST CONTROL: an unrelated key must SURVIVE, or the sweep is just
    // localStorage.clear() wearing a prefix.
    localStorage.setItem('olumi-canvas-scenarios', 'must survive')

    clearDurableDissent()

    expect(keys()).toEqual([])
    expect(localStorage.getItem('olumi-canvas-scenarios')).toBe('must survive')
  })
})
