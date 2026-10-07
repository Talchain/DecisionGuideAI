/**
 * S-B slice 1 — DGAI's one reader of CEE's `action_bar` v1.
 *
 * The rows state the reader's RULES (what it keeps, trims, skips and reports).
 * `EXAMPLE_BAR` is the contract's own example, not a capture; the wire-bound rows
 * are the last block, on the bars CEE captured from its own routes.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { ADDITIVE_EXTENSIONS_KEY } from '../../../../v5/responseParser'
import { offerIdentity, parseActionBar, pressIdsOnBar, readActionBar, type ActionBarIssue } from '../actionBarContract'
import { ACTION_BAR_ICONS } from '../actionBarIcons'
import { EXAMPLE_BAR, MORE_OPTIONS, PRE_MORTEM, REVIEW, REVISION, SET_TARGET, TEST_LINK, WHAT_CHANGES } from './actionBarContractExample'

const read = (raw: unknown) => {
  const issues: ActionBarIssue[] = []
  return { bar: parseActionBar(raw, (issue) => issues.push(issue)), issues }
}
const ids = (offers: readonly { action_id: string }[]) => offers.map((o) => o.action_id)

describe('the bar as sent', () => {
  it('keeps every slot in CEE’s order, with the identity it was made for', () => {
    const { bar, issues } = read(EXAMPLE_BAR)
    expect(issues).toEqual([])
    expect(bar).not.toBeNull()
    expect(ids(bar!.priority)).toEqual(['set_target', 'more_options'])
    expect(ids(bar!.standard)).toEqual(['review', 'what_changes', 'strengthen', 'pre_mortem'])
    expect(ids(bar!.more)).toEqual(['test_link'])
    expect(bar!.state_key).toBe('0123456789abcdef')
    expect(bar!.revision).toEqual(REVISION)
    expect(bar!.standard[3]!.protocol).toEqual({ id: 'DSK-P-001', version: 'v1' })
    expect(bar!.more[0]!.target).toEqual({ kind: 'link', from_id: 'f1', to_id: 'g1' })
  })

  it('an action id and an icon name DGAI has never heard of are kept: the wire carries the label', () => {
    const unknown = { ...MORE_OPTIONS, action_id: 'a_new_action', icon: 'NotAnIconYet', offer_key: 'dddddddddddddddd' }
    const { bar, issues } = read({ ...EXAMPLE_BAR, more: [unknown] })
    expect(issues).toEqual([])
    expect(bar!.more[0]).toMatchObject({ action_id: 'a_new_action', icon: 'NotAnIconYet', label: 'More options' })
  })

  it('a field CEE adds later is dropped, not fatal (the reader is not strict)', () => {
    const { bar, issues } = read({ ...EXAMPLE_BAR, later: true, more: [{ ...TEST_LINK, later: 1 }] })
    expect(issues).toEqual([])
    expect(bar!.more[0]).not.toHaveProperty('later')
    expect(ids(bar!.more)).toEqual(['test_link'])
  })

  it('a bar made before a Run has a null run key; before a model exists, a null graph hash too', () => {
    expect(read({ ...EXAMPLE_BAR, revision: { graph_hash: 'abc', run_key: null } }).bar!.revision).toEqual({ graph_hash: 'abc', run_key: null })
    expect(read({ ...EXAMPLE_BAR, revision: { graph_hash: null, run_key: null } }).bar!.revision).toEqual({ graph_hash: null, run_key: null })
  })
})

describe('what is not drawn, and is reported', () => {
  it.each([
    ['a newer version', { ...EXAMPLE_BAR, v: 2 }, { kind: 'unknown_version', v: 2 }],
    ['no version', { ...EXAMPLE_BAR, v: undefined }, { kind: 'malformed_envelope' }],
    ['a string', 'action_bar', { kind: 'malformed_envelope' }],
    ['no state key', { ...EXAMPLE_BAR, state_key: 'short' }, { kind: 'malformed_envelope' }],
    ['no revision', { ...EXAMPLE_BAR, revision: undefined }, { kind: 'malformed_envelope' }],
    ['a slot that is not a list', { ...EXAMPLE_BAR, more: 'none' }, { kind: 'malformed_envelope' }],
  ] as const)('%s → no bar at all', (_name, raw, issue) => {
    const { bar, issues } = read(raw)
    expect(bar).toBeNull()
    expect(issues).toEqual([issue])
  })

  it('absent is not a fault: no bar, nothing reported', () => {
    expect(read(undefined)).toEqual({ bar: null, issues: [] })
    expect(read(null)).toEqual({ bar: null, issues: [] })
  })

  it.each([
    ['an enabled offer with no reason', { ...REVIEW, why_now: undefined }],
    ['a disabled offer that does not say what stops it', { ...WHAT_CHANGES, disabled_reason: undefined }],
    ['a label longer than 24 characters', { ...REVIEW, label: 'Review this whole decision now' }],
    ['a reason longer than 90 characters', { ...REVIEW, why_now: 'x'.repeat(91) }],
    ['no press id', { ...REVIEW, press_id: '' }],
    ['an offer key that is not 16 hex', { ...REVIEW, offer_key: 'nope' }],
    ['a group the menu does not have', { ...REVIEW, group: 'standard' }],
    ['a target of an unknown kind', { ...REVIEW, target: { kind: 'edge', id: 'e1' } }],
  ])('%s is skipped, and the rest of the bar survives', (_name, bad) => {
    const { bar, issues } = read({ ...EXAMPLE_BAR, standard: [bad, PRE_MORTEM] })
    expect(ids(bar!.standard)).toEqual(['pre_mortem'])
    expect(ids(bar!.priority)).toEqual(['set_target', 'more_options'])
    expect(issues).toEqual([{ kind: 'malformed_offer', slot: 'standard', index: 0 }])
  })

  it('⛔ CONTRAST: the same offer, well formed, is kept (the skip rows are not skipping everything)', () => {
    expect(ids(read({ ...EXAMPLE_BAR, standard: [REVIEW, PRE_MORTEM] }).bar!.standard)).toEqual(['review', 'pre_mortem'])
  })
})

describe('one place per action', () => {
  it('a pill never repeats one of the fixed icons', () => {
    const { bar, issues } = read({ ...EXAMPLE_BAR, priority: [{ ...PRE_MORTEM, offer_key: 'eeeeeeeeeeeeeeee' }, SET_TARGET] })
    expect(ids(bar!.priority)).toEqual(['set_target'])
    expect(ids(bar!.standard)).toContain('pre_mortem')
    expect(issues).toEqual([{ kind: 'duplicate_offer', slot: 'priority', action_id: 'pre_mortem' }])
  })

  it('the same action on the same target is one offer; on another target it is another', () => {
    const otherLink = { ...TEST_LINK, target: { kind: 'link', from_id: 'f2', to_id: 'g1' }, offer_key: 'ffffffffffffffff' }
    const { bar, issues } = read({ ...EXAMPLE_BAR, more: [TEST_LINK, { ...TEST_LINK }, otherLink] })
    expect(bar!.more.map(offerIdentity)).toEqual(['test_link|link:f1>g1', 'test_link|link:f2>g1'])
    expect(issues).toEqual([{ kind: 'duplicate_offer', slot: 'more', action_id: 'test_link' }])
  })

  it('more than the contract allows is trimmed to it: 2 pills, 4 icons, 20 in the menu', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ ...MORE_OPTIONS, action_id: `extra_${i}`, offer_key: i.toString(16).padStart(16, '0') }))
    const { bar } = read({ ...EXAMPLE_BAR, priority: many(5), standard: many(9).map((o) => ({ ...o, action_id: `std_${o.action_id}` })), more: many(30).map((o) => ({ ...o, action_id: `more_${o.action_id}` })) })
    expect([bar!.priority.length, bar!.standard.length, bar!.more.length]).toEqual([2, 4, 20])
  })
})

describe('where the bar is read from', () => {
  it('top level first, then the parser’s additive sidecar (an undeclared root key on a strict envelope)', () => {
    expect(readActionBar({ action_bar: EXAMPLE_BAR })?.state_key).toBe('0123456789abcdef')
    const viaSidecar = Object.defineProperty({ assistant_text: 'x' }, ADDITIVE_EXTENSIONS_KEY, { value: { action_bar: EXAMPLE_BAR }, enumerable: false })
    expect(readActionBar(viaSidecar)?.state_key).toBe('0123456789abcdef')
    expect(readActionBar({ assistant_text: 'x' })).toBeNull()
    expect(readActionBar(null)).toBeNull()
  })

  it('the press ids on a bar are exactly its offers’ ids (a suggested action with one is already on the bar)', () => {
    expect([...pressIdsOnBar(read(EXAMPLE_BAR).bar)].sort()).toEqual([
      'act:set_target', 'agent-next-pre-mortem', 'agent-next-review-decision', 'agent-next-strengthen',
      'agent-next-what-would-change', 'agent-next-widen', 'agent-test-without-link:["f1","g1"]',
    ])
    expect(pressIdsOnBar(null).size).toBe(0)
  })
})

/**
 * ⭐ BOUND TO THE WIRE. The three bars below were CAPTURED by CEE from its real routes (lane ACTION-BAR-CEE, CEE #2751,
 * `src/orchestrator-v5/agent-lane/actions/__tests__/fixtures/`, copied byte for byte from the SERVED CEE staging
 * c70ca365b2f31e435dc48495e4bc7e7131fe6996 — re-captured by CEE #2755 after #2751 8ce3b297's first capture; only
 * state keys, graph hashes, run keys and offer keys moved). They are evidence about what CEE sends; `EXAMPLE_BAR` above is not.
 * ⛔ Never edit or re-record them here: the digests pin the captured bytes, and a new capture comes from CEE.
 */
describe('the bars CEE captured from its routes', () => {
  const CAPTURED = [
    ['pre-run', '49e7f715e675c49c87101544bdbc3bf2132268f8c87b194f0258070281e7b91c'],
    ['withheld-run', '6d3b15f24e4e5b4f9ae6d28176ef3567aa241ec56461ca49e7e869e996d3282f'],
    ['licensed-run', 'db6761daf17eaf7ba32c71a99019d7289fcc62fe01097f74f9327c593c13b3ea'],
  ] as const
  const file = (name: string) => join(__dirname, 'fixtures', `action-bar-v1-${name}.json`)
  const bytes = (name: string) => readFileSync(file(name))
  const captured = (name: string) => JSON.parse(readFileSync(file(name), 'utf8')) as Record<'priority' | 'standard' | 'more', Record<string, unknown>[]> & Record<string, unknown>

  it.each(CAPTURED)('%s: the captured bytes are the ones CEE recorded', (name, digest) => {
    expect(createHash('sha256').update(bytes(name)).digest('hex')).toBe(digest)
  })

  it.each(CAPTURED)('%s: every offer CEE sent is read, in CEE’s order, with nothing reported', (name) => {
    const raw = captured(name)
    const { bar, issues } = read(raw)
    expect(issues).toEqual([])
    expect(bar).not.toBeNull()
    expect({ v: bar!.v, state_key: bar!.state_key, revision: bar!.revision }).toEqual({ v: raw.v, state_key: raw.state_key, revision: raw.revision })
    // Field for field: the reader keeps every member CEE sent on every offer (it drops only keys it does not know).
    expect(bar!.priority).toEqual(raw.priority)
    expect(bar!.standard).toEqual(raw.standard)
    expect(bar!.more).toEqual(raw.more)
    expect(raw.priority.length + raw.standard.length + raw.more.length, 'POSITIVE CONTROL: the capture holds offers').toBeGreaterThanOrEqual(5)
  })

  it('the three states differ where they should: no Run has no run key; a licensed Run has pills, one aimed at a link', () => {
    expect(read(captured('pre-run')).bar!.revision.run_key).toBeNull()
    expect(read(captured('withheld-run')).bar!.revision.run_key).toMatch(/^[0-9a-f]{16}$/)
    const licensed = read(captured('licensed-run')).bar!
    expect(ids(licensed.priority)).toEqual(['more_options', 'test_link'])
    expect(licensed.priority[1]!.target).toMatchObject({ kind: 'link' })
    expect(ids(read(captured('pre-run')).bar!.standard.filter((o) => !o.enabled))).toEqual(['review', 'what_changes', 'strengthen'])
  })

  it('every icon CEE names for these actions is one this build can draw (no generic glyph in slice 1)', () => {
    const names = CAPTURED.flatMap(([name]) => { const raw = captured(name); return [...raw.priority, ...raw.standard, ...raw.more].map((o) => String(o.icon)) })
    expect(names.length).toBeGreaterThanOrEqual(15)
    for (const name of new Set(names)) expect(Object.keys(ACTION_BAR_ICONS), name).toContain(name)
  })
})
