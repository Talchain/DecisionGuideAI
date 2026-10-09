/**
 * Accel P24 / SCI-10, DGAI half: the `_method_result` v:1 reader, the card under a probe's reply, the tested-link
 * marks, and the transcript round trip.
 *
 * Fixtures are CEE's own words: row text from the composers at e80586d8 and the expected reply in CEE's own test
 * (see each fixture's `_source`), never written for this spec. Rows are bound by IDENTITY (row ids, item refs, run
 * stamps); every "absent" case has a present control.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import testLink from './fixtures/method-result-v1-test-link.json'
import whatChanges from './fixtures/method-result-v1-what-changes.json'
import {
  displayableMethodResult, readMethodResult, sameMethodRun, type MethodResultV1,
} from '../../../v5/readMethodResult'
import {
  METHOD_RESULT_CARD_TESTID, MethodResultCard, TESTED_LINK_HEADING_UNNAMED, WHAT_CHANGES_HEADING, testedLinkHeading,
} from '../MethodResultCard'
import { TESTED_LINK_MARK_LABEL, testedLinkKey, testedLinkMarks } from '../testedLinkMark'
import { __resetTranscriptTombstonesForTests, loadTranscript, saveTranscript } from '../utils/transcriptStore'
import type { ConversationMessage } from '../types'
import { findBannedTerm } from '../../../test/glossaryBannedTerms'

type Fixture = typeof testLink | typeof whatChanges
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T
const envelopeOf = (f: Fixture) => clone(f.response.__additive__._method_result) as Record<string, unknown>
const responseWith = (envelope: unknown) => ({ assistant_text: 'x', __additive__: { _method_result: envelope } })
const read = (f: Fixture): MethodResultV1 => {
  const r = readMethodResult(f.response)
  if (r.status !== 'available') throw new Error(`fixture unreadable: ${r.reason}`)
  return r.methodResult
}
const labelOf = (f: Fixture) => (id: string) => (f.labels as Record<string, string>)[id] ?? null
// The contest words the canvas guard bans (noContestFraming.canvas.spec.ts), for the rendered card.
const CONTEST = /\b(best|winners?|winning|recommend\w*|ahead|beats?|leaders?|leads?)\b/i

beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => {}) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('the v:1 reader', () => {
  it('reads both probes from the additive sidecar (control: an absent key is absent, not invalid)', () => {
    expect(read(testLink)).toMatchObject({ v: 1, action_id: 'test_link', outcome: 'completed' })
    expect(read(whatChanges)).toMatchObject({ v: 1, action_id: 'what_changes', outcome: 'measured' })
    expect(readMethodResult({ assistant_text: 'x' })).toEqual({ status: 'unavailable', reason: 'absent' })
  })

  it('another version renders nothing and says so (M4: accepting v:2 turns this RED)', () => {
    const v2 = { ...envelopeOf(testLink), v: 2 }
    expect(readMethodResult(responseWith(v2))).toEqual({ status: 'unavailable', reason: 'unknown_version' })
    expect(console.info).toHaveBeenCalledWith('[v5] _method_result: unknown version, not shown', { v: 2 })
  })

  it('a figure its own row does not say, an unknown outcome, or an inner result off its contract: invalid', () => {
    const e1 = envelopeOf(testLink) as { rows: Array<{ figures?: string[] }> }
    e1.rows[3].figures = ['about 47%']
    const e2 = { ...envelopeOf(testLink), outcome: 'decided' }
    const e3 = { ...envelopeOf(testLink), result: { status: 'completed' } }
    const e4 = { ...envelopeOf(whatChanges), result: [{ from_id: 'a' }] }
    for (const e of [e1, e2, e3, e4]) expect(readMethodResult(responseWith(e))).toEqual({ status: 'unavailable', reason: 'invalid' })
    // Control: the untouched envelopes read.
    expect(readMethodResult(responseWith(envelopeOf(testLink))).status).toBe('available')
  })
})

describe('the card shows only what the reply says', () => {
  it('every row is in the reply: shown; one row the reply does not say: nothing at all', () => {
    const m = read(testLink)
    expect(displayableMethodResult(m, testLink.assistant_text)).toBe(m)
    const drifted = clone(m)
    drifted.rows[1].text = drifted.rows[1].text.replace('about 52%', 'about 53%')
    expect(displayableMethodResult(drifted, testLink.assistant_text)).toBeNull()
  })

  it('a stale or refused answer, an empty answer and an unknown action show no card (control: completed shows)', () => {
    const m = read(testLink)
    for (const outcome of ['stale', 'honest_limit', 'refused', 'timed_out', 'withheld'] as const) {
      expect(displayableMethodResult({ ...m, outcome }, testLink.assistant_text)).toBeNull()
    }
    expect(displayableMethodResult({ ...m, rows: [] }, testLink.assistant_text)).toBeNull()
    expect(displayableMethodResult({ ...m, action_id: 'outside_view' }, testLink.assistant_text)).toBeNull()
    expect(displayableMethodResult(m, testLink.assistant_text)).not.toBeNull()
  })
})

describe('the card', () => {
  it('"Test without this link": the link named from the canvas, then the reply\'s own lines, verbatim and in order', () => {
    const m = read(testLink)
    render(<MethodResultCard methodResult={m} labelOf={labelOf(testLink)} />)
    const card = screen.getByTestId(METHOD_RESULT_CARD_TESTID)
    expect(within(card).getByTestId(`${METHOD_RESULT_CARD_TESTID}-heading`)).toHaveTextContent(
      testedLinkHeading('Price rise', 'Customers lost from price rise'))
    const items = within(card).getAllByRole('listitem')
    expect(items.map(li => li.getAttribute('data-row-id'))).toEqual(m.rows.map(r => r.row_id))
    expect(items.map(li => li.textContent)).toEqual(m.rows.map(r => r.text))
    // Bound to the tested link by id, never another.
    expect(items[0]).toHaveAttribute('data-item-refs', 'link:fac_price_rise->out_customers_lost')
    for (const never of testLink.never_on_card) expect(card.textContent).not.toContain(never)
    expect(card.textContent).not.toMatch(CONTEST)
  })

  it('a link the canvas cannot name keeps a heading without names (control: named when both ends resolve)', () => {
    render(<MethodResultCard methodResult={read(testLink)} labelOf={() => null} />)
    expect(screen.getByTestId(`${METHOD_RESULT_CARD_TESTID}-heading`)).toHaveTextContent(TESTED_LINK_HEADING_UNNAMED)
  })

  it('"What would change this?": the comparison heading, the measured line, and never the line naming who stays ahead', () => {
    render(<MethodResultCard methodResult={read(whatChanges)} labelOf={labelOf(whatChanges)} />)
    const card = screen.getByTestId(METHOD_RESULT_CARD_TESTID)
    expect(within(card).getByTestId(`${METHOD_RESULT_CARD_TESTID}-heading`)).toHaveTextContent(WHAT_CHANGES_HEADING)
    expect(within(card).getAllByRole('listitem').map(li => li.textContent)).toEqual([read(whatChanges).rows[0].text])
    for (const never of whatChanges.never_on_card) expect(card.textContent).not.toContain(never)
    // The heading names the comparison, never a chance.
    expect(WHAT_CHANGES_HEADING).not.toMatch(/chance/i)
  })
})

describe('the tested-link marks', () => {
  const current = { graphHashAtRun: '3f9a1c2b7d4e8f60', runId: 'run_7c1e' }
  const message = (m: MethodResultV1, id = 'a1', content = testLink.assistant_text) => ({ id, content, methodResult: m })

  it('identity pair: a result about L1 marks L1 and not L2; the same result re-bound to L2 marks L2 and not L1', () => {
    const l1 = read(testLink)
    const l2 = clone(l1)
    for (const row of l2.rows) row.item_refs = row.item_refs.map(r => (r.kind === 'link' ? { kind: 'link' as const, from_id: 'fac_price_rise', to_id: 'out_mrr' } : r))
    const k1 = testedLinkKey('fac_price_rise', 'out_customers_lost')
    const k2 = testedLinkKey('fac_price_rise', 'out_mrr')
    expect([...testedLinkMarks([message(l1)], current).keys()]).toEqual([k1])
    expect([...testedLinkMarks([message(l2)], current).keys()]).toEqual([k2])
    expect(testedLinkMarks([message(l1)], current).get(k1)).toMatchObject({ actionId: 'test_link', label: TESTED_LINK_MARK_LABEL.test_link, messageId: 'a1' })
  })

  it('control pair: the Run on screen keeps the mark; another Run, a stale answer or a reply that drifted hides it (M7)', () => {
    const m = read(testLink)
    expect(testedLinkMarks([message(m)], current).size).toBe(1)
    expect(testedLinkMarks([message(m)], { graphHashAtRun: '0000000000000000', runId: 'run_7c1e' }).size).toBe(0)
    expect(testedLinkMarks([message(m)], { graphHashAtRun: current.graphHashAtRun, runId: 'run_other' }).size).toBe(0)
    expect(testedLinkMarks([message(m)], null).size).toBe(0)
    expect(testedLinkMarks([message({ ...m, outcome: 'stale' })], current).size).toBe(0)
    expect(testedLinkMarks([message(m, 'a1', 'a different reply')], current).size).toBe(0)
    expect(sameMethodRun(m, { graphHashAtRun: current.graphHashAtRun })).toBe(true)
  })

  it('"What would change this?" marks the measured link only, never the link whose line says nothing would change', () => {
    const m = read(whatChanges)
    const marks = testedLinkMarks([message(m, 'w1', whatChanges.assistant_text)], { graphHashAtRun: 'a1b2c3d4e5f60718', runId: 'run_d3' })
    expect([...marks.keys()]).toEqual([testedLinkKey('monthly_cloud_savings', 'monthly_spend')])
    expect(marks.has(testedLinkKey('monthly_cloud_overspend_during_migration', 'monthly_spend'))).toBe(false)
  })
})

describe('reload', () => {
  const SID = '7d1f0c55-3a1e-4f1b-9a59-2b6f0d7c9e11'
  beforeEach(() => { localStorage.clear(); __resetTranscriptTombstonesForTests() })
  const assistant = (over: Partial<ConversationMessage>): ConversationMessage => ({
    id: 'm-1', role: 'assistant', content: testLink.assistant_text, timestamp: new Date('2026-10-07T21:04:00.000Z'), ...over,
  })

  it('the card comes back the same after a reload (M6: a store that omits it turns this RED)', () => {
    const m = read(testLink)
    saveTranscript(SID, [assistant({ methodResult: m })])
    const restored = loadTranscript(SID)?.messages[0]
    expect(restored?.methodResult).toEqual(m)
    expect(displayableMethodResult(restored?.methodResult, restored?.content ?? '')).toEqual(m)
  })

  it('a stored copy that no longer passes the contract restores no card, and the reply itself still restores', () => {
    saveTranscript(SID, [assistant({ methodResult: { ...read(testLink), v: 2 } as unknown as MethodResultV1 })])
    const restored = loadTranscript(SID)?.messages[0]
    expect(restored?.content).toBe(testLink.assistant_text)
    expect(restored?.methodResult).toBeUndefined()
  })
})

describe('copy guard: the three card headings (ruled by the DL in AIQ\'s absence, 7 Oct)', () => {
  // One row per approved string: model-relative, no glossary-banned term, no contest frame.
  it.each([
    ['test_link, named', testedLinkHeading('Price rise', 'Customers lost from price rise')],
    ['test_link, unnamed fallback', TESTED_LINK_HEADING_UNNAMED],
    ['what_changes', WHAT_CHANGES_HEADING],
  ])('%s', (_name, heading) => {
    expect(heading).toMatch(/\bin this model\b/)
    expect(findBannedTerm(heading)).toBeNull()
    expect(heading).not.toMatch(CONTEST)
    expect(heading).not.toMatch(/chance|probabilit|likel/i)
  })
})
