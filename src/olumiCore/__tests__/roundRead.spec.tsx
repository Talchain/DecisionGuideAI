/**
 * B2, the UI half: Olumi's reading of the round (`collab.round_read`) on Codex's corrected contract (critique2/codex-b2.md). Built on core's
 * own TM-04 output: each comparison IS core's Difference for that {record, goal}, and each quote is a span of that person's revealed words.
 * The UI lead's condition: a wrong leader claim cannot be drawn. Only core's `status_text` for the comparison says what it does.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../../olumiView/client'
import { useViewStore } from '../../olumiView/store'
import { RoundRead } from '../../olumiView/v12/views/RoundRead'
import { WhereWeDiffer } from '../../olumiView/v12/views/WhereWeDiffer'
import { roundReadOf } from '../team/roundRead'
import { tipOf } from '../../olumiView/__tests__/tipHelpers'
import { setTeamFetch } from '../team/api'
import { resetWrites } from '../team/writes'
import { resetDifferences, type Difference, type Differences } from '../team/differences'

const FX = path.resolve('src/olumiView/fixtures/debate')
const base: View = JSON.parse(readFileSync(path.join(FX, 'tm04-cara.view3.json'), 'utf8'))
const core: Differences = JSON.parse(readFileSync(path.join(FX, 'tm04-differences.core.json'), 'utf8'))
const cmp = (record: string, goal: string): Difference => core.differences.find((d) => d.record === record && d.goal === goal)!
const AIM = 'generate_revenue_quickly', OTHER = 'enterprise_opportunities'
const FIG = cmp('diagnostic_time_to_contract', AIM), PAY = cmp('link:first_cash_timing:contract_to_cash', AIM), PAY2 = cmp('link:first_cash_timing:contract_to_cash', OTHER)
const said = (id: number) => base.collab.shared.find((s) => s.id === id)!
const quote = (id: string, view: number, text: string) => ({ id, view_id: view, holder_id: said(view).by_id, holder: said(view).by, text })
/** Each option's chance drawn for a comparison, by option and holder: [option, holder, text, bar?, withheld title]. */
const drawnChances = async (el: Element) => {
  const out: Array<Array<string | boolean | null>> = []
  for (const o of el.querySelectorAll('[data-difference-option]')) for (const c of o.querySelectorAll<HTMLElement>('[data-difference-chance]')) {
    // The withheld reason is on the one Tip (a cell with no reason has no Tip), never a native title.
    // A cell with a reason is a Hover (one focus stop); one without is plain, with no Tip to open.
    const h = c.matches('[tabindex]') ? c : c.querySelector<HTMLElement>('[tabindex]')
    const reason = h !== null ? await tipOf(h) : null
    out.push([o.getAttribute('data-difference-option'), c.getAttribute('data-difference-chance'), c.lastElementChild!.textContent, c.querySelector('svg[data-chance]') !== null, reason])
  }
  return out
}
const coreChances = (d: Difference) => d.options.flatMap((o) => o.chances.map((c) => [o.option, c.holder_id, c.text, c.chance !== null, c.withheld?.reason ?? null]))
const WRONG = 'This is the only difference that changes which option is most likely'

const estimate = { id: 'c1', kind: 'estimate', kind_text: 'A different estimate', quotes: [quote('q1', 19, 'take most of a year to sign anything'), quote('q2', 20, 'I think one would sign within a quarter')],
  comparisons: [FIG], settle_text: 'What would tell these apart: how long the two pilot customers take to sign.', question: { to: '12', text: 'Are your buyers the same kind as the pilots?' } }
const cause = { id: 'c2', kind: 'cause', kind_text: 'A different belief about cause and effect', quotes: [quote('q3', 47, 'I am not sure this link holds'), quote('q4', 49, 'This link holds as the model has it.')],
  comparisons: [PAY, PAY2], settle_text: null, question: null, leader_claim: WRONG, changes_leader: true }
const read = (over: Record<string, unknown> = {}) => ({ at_version: base.version!.id, snapshot: 's1', scope: 'revealed:7', source: 'olumi', provisional: true,
  provisional_text: "Olumi's reading, provisional: correct anything that's wrong", lead: 'Mainly how long the diagnostic takes to sign, and two links.', cruxes: [estimate, cause], also: WRONG, ...over })
const withRead = (r: unknown, over: Partial<View> = {}): View => ({ ...base, ...over, collab: { ...base.collab, round_read: r } } as unknown as View)

beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '1') })
afterEach(() => { cleanup(); setTeamFetch(null); resetDifferences(); resetWrites(); vi.unstubAllEnvs() })

describe('what is drawn, in core\'s words only', () => {
  it('core\'s provisional line and lead; per crux core\'s kind words, each person\'s own words under their name, and each comparison with core\'s sentence and chances', () => {
    render(<RoundRead sid={base.id} onWrote={async () => true} view={withRead(read())} headings={core.headings} />)
    expect(screen.getByTestId('round-read-provisional').textContent).toBe("Olumi's reading, provisional: correct anything that's wrong")
    expect(screen.getByTestId('round-read-lead').textContent).toBe('Mainly how long the diagnostic takes to sign, and two links.')
    const c1 = document.querySelector('[data-round-crux="c1"]') as HTMLElement
    expect(c1.querySelector('[data-round-kind]')!.textContent).toBe('A different estimate')
    expect([...c1.querySelectorAll('[data-round-quote]')].map((q) => [q.getAttribute('data-quote-holder'), q.textContent])).toEqual([
      ['12', 'PPriya: “take most of a year to sign anything”'], ['14', 'TTom: “I think one would sign within a quarter”']])
    const f = c1.querySelector(`[data-round-comparison="${FIG.record}|${AIM}"]`) as HTMLElement
    expect(f.querySelector('[data-round-status]')!.textContent).toBe(FIG.status_text)
    expect(f.querySelector(`[data-testid="round-c1-${FIG.record}-${AIM}-options"]`)).not.toBeNull()
    expect(c1.querySelector('[data-round-settle]')!.textContent).toBe(estimate.settle_text)
    // The crux's question is not drawn in this slice: the round's one question stays core's collab.next.
    expect(document.body.textContent).not.toContain('Are your buyers the same kind as the pilots?')
  })
})

describe('a wrong leader claim cannot be drawn (UI lead\'s condition)', () => {
  it('a crux on a comparison core says only MOVES the chances draws core\'s "moves" sentence; a claim in any field the contract does not name is never drawn; CONTRAST: the crux on a comparison core says CHANGES the leader draws core\'s changes sentence', async () => {
    expect(PAY.status, 'precondition').toBe('moves')
    expect(FIG.status, 'precondition').toBe('changes')
    render(<RoundRead sid={base.id} onWrote={async () => true} view={withRead(read())} headings={core.headings} />)
    const pay = document.querySelector(`[data-round-comparison="${PAY.record}|${AIM}"]`) as HTMLElement
    expect(pay.getAttribute('data-difference-status')).toBe('moves')
    expect(pay.querySelector('[data-round-status]')!.textContent).toBe(PAY.status_text)
    expect(document.body.textContent).not.toContain(WRONG)
    const fig = document.querySelector(`[data-round-comparison="${FIG.record}|${AIM}"]`) as HTMLElement
    expect(fig.getAttribute('data-difference-status')).toBe('changes')
    expect(fig.querySelector('[data-round-status]')!.textContent).toBe(FIG.status_text)
    // Each option's chance is core's, by option and holder, for each comparison (Codex B2 UI HOLD 3).
    expect(await drawnChances(pay)).toEqual(coreChances(PAY))
    expect(await drawnChances(fig)).toEqual(coreChances(FIG))
    expect(coreChances(FIG).length, 'precondition: chances to compare').toBeGreaterThan(2)
  })
  it('one link on two aims is two comparisons by {record, goal}, each with its own core status (one withheld)', async () => {
    render(<RoundRead sid={base.id} onWrote={async () => true} view={withRead(read())} headings={core.headings} />)
    const c2 = document.querySelector('[data-round-crux="c2"]') as HTMLElement
    expect([...c2.querySelectorAll('[data-round-comparison]')].map((e) => [e.getAttribute('data-round-comparison'), e.getAttribute('data-difference-status')])).toEqual([
      [`${PAY.record}|${AIM}`, 'moves'], [`${PAY.record}|${OTHER}`, 'withheld']])
    const [a, b] = [...c2.querySelectorAll('[data-round-comparison]')]
    expect(PAY.status_text, 'precondition: two sentences').not.toBe(PAY2.status_text)
    expect([a!.querySelector('[data-round-status]')!.textContent, b!.querySelector('[data-round-status]')!.textContent]).toEqual([PAY.status_text, PAY2.status_text])
    // Withheld: core's words and its reason on hover, and no bar for a chance core did not give.
    expect(await drawnChances(b!)).toEqual(coreChances(PAY2))
    expect(coreChances(PAY2).some((c) => c[3] === false), 'precondition: a withheld chance').toBe(true)
    expect(b!.querySelectorAll('[data-chance-withheld]').length).toBe(coreChances(PAY2).filter((c) => c[3] === false).length)
  })
  it('a person\'s own figure in their words is drawn verbatim, numbers and all; it is their words, never Olumi\'s', () => {
    const tom = { ...said(20), text: `${said(20).text} Say 1 to 3 months.` }
    const v = { ...withRead(read({ cruxes: [{ ...estimate, quotes: [quote('q1', 19, 'take most of a year to sign anything'), { ...quote('q9', 20, 'x'), text: 'Say 1 to 3 months.' }] }] })) }
    const view = { ...v, collab: { ...v.collab, shared: v.collab.shared.map((s) => (s.id === 20 ? tom : s)) } } as View
    render(<RoundRead sid={base.id} onWrote={async () => true} view={view} headings={core.headings} />)
    expect(document.querySelector('[data-round-quote="q9"]')!.textContent).toBe('TTom: “Say 1 to 3 months.”')
  })
})

describe('every reference is checked; an invalid crux is dropped whole', () => {
  const only = (crux: unknown) => roundReadOf(withRead(read({ cruxes: [crux, estimate] })))!.cruxes.map((c) => c.id)
  it('a quote under the wrong person, a quote not in their words, a view not revealed, or a comparison without core\'s sentence drops that crux; CONTRAST: the valid one stays', () => {
    expect(only({ ...cause, id: 'bad-holder', quotes: [{ ...quote('x', 19, 'take most of a year'), holder_id: '14' }] })).toEqual(['c1'])
    expect(only({ ...cause, id: 'bad-words', quotes: [quote('x', 19, 'procurement takes two years')] })).toEqual(['c1'])
    expect(only({ ...cause, id: 'bad-view', quotes: [{ ...quote('x', 19, 'take most of a year'), view_id: 999 }] })).toEqual(['c1'])
    expect(only({ ...cause, id: 'bad-cmp', comparisons: [{ ...PAY, status_text: '' }] })).toEqual(['c1'])
    expect(only({ ...cause, id: 'bad-kind', kind: 'values' })).toEqual(['c1'])
    expect(only({ ...cause, id: 'bad-name', quotes: [{ ...quote('x', 19, 'take most of a year'), holder: 'Tom' }] })).toEqual(['c1'])
    expect(only({ ...cause, id: 'mixed', quotes: [quote('ok', 47, 'I am not sure this link holds'), quote('x', 19, 'procurement takes two years')] })).toEqual(['c1'])
    const strayChance = { ...PAY, options: PAY.options.map((o, i) => (i === 0 ? { ...o, chances: [...o.chances, { holder_id: '999', chance: 0.5, text: 'about 50%' }] } : o)) }
    expect(only({ ...cause, id: 'bad-chance-holder', comparisons: [strayChance] })).toEqual(['c1'])
    expect(only({ ...cause, id: 'bad-option', comparisons: [{ ...PAY, options: [{ option: 'x' }] }] })).toEqual(['c1'])
    expect(only({ ...cause, id: 'bad-side', comparisons: [{ ...PAY, sides: [{ holder_id: '43' }] }] })).toEqual(['c1'])
    expect(only({ ...cause, id: 'mixed-cmp', comparisons: [PAY, { ...PAY2, status_text: '' }] })).toEqual(['c1'])
    expect(only({ ...cause, id: 'ok' })).toEqual(['ok', 'c1'])
  })
})

describe('nothing when core sends nothing usable', () => {
  it('absent (older core), null (withheld), gated, another version, not marked as Olumi\'s and provisional, or no valid crux: nothing is drawn; CONTRAST: the valid read is', () => {
    expect(roundReadOf(base)).toBeNull()
    expect(roundReadOf(withRead(null))).toBeNull()
    expect(roundReadOf(withRead(read(), { gated: true }))).toBeNull()
    expect(roundReadOf(withRead(read({ at_version: base.version!.id + 1 })))).toBeNull()
    expect(roundReadOf(withRead(read({ provisional: false })))).toBeNull()
    expect(roundReadOf(withRead(read({ source: 'person' })))).toBeNull()
    expect(roundReadOf(withRead(read({ cruxes: [{ ...cause, kind: 'values' }] })))).toBeNull()
    expect(roundReadOf(withRead(read()))?.cruxes.map((c) => c.id)).toEqual(['c1', 'c2'])
  })
})

describe('mounted in "Where you differ"', () => {
  const serve = (answer: Differences) => setTeamFetch((async (url: string) =>
    String(url).endsWith('/differences') ? new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } })
      : new Response(JSON.stringify({ error: 'not here' }), { status: 404, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch)
  it('after the reveal the reading leads the step and core\'s round question stays the one prompt, below it; a view update to another version or a gate removes it; CONTRAST: without core\'s field the step is as before', async () => {
    expect(base.collab.next?.text, 'precondition: core sends the round question').toBeTruthy()
    serve(core)
    const v = withRead(read())
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000000', sid: v.id, view: v, status: 'ready', error: null, stale: false, at: null })
    const { rerender } = render(<WhereWeDiffer sid={v.id} view={v} onWrote={async () => true} />)
    const r = await screen.findByTestId('round-read')
    const next = screen.getByTestId('team-views-next')
    expect(next.textContent).toBe(base.collab.next!.text)
    expect(screen.getAllByTestId('team-views-next')).toHaveLength(1)
    expect((r.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true)
    rerender(<WhereWeDiffer sid={v.id} view={withRead(read({ at_version: base.version!.id + 1 }))} onWrote={async () => true} />)
    expect(screen.queryByTestId('round-read')).toBeNull()
    rerender(<WhereWeDiffer sid={v.id} view={withRead(read(), { gated: true })} onWrote={async () => true} />)
    expect(screen.queryByTestId('round-read')).toBeNull()
    cleanup(); resetDifferences()
    useViewStore.setState({ view: base, sid: base.id })
    render(<WhereWeDiffer sid={base.id} view={base} onWrote={async () => true} />)
    await screen.findByTestId('differ-after')
    expect(screen.queryByTestId('round-read')).toBeNull()
  })
})

describe('asking for the reading (core A8: POST …/round-read, one counted call)', () => {
  type Sent = { method: string; url: string; body: unknown }
  const post = (answer: { status: number; body: unknown }) => {
    const sent: Sent[] = []
    setTeamFetch((async (url: string, init?: RequestInit) => {
      sent.push({ method: init?.method ?? 'GET', url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined })
      if (String(url).endsWith('/api/me')) return new Response(JSON.stringify({ me: { id: base.you_id } }), { status: 200, headers: { 'content-type': 'application/json' } })
      return new Response(JSON.stringify(answer.body), { status: answer.status, headers: { 'content-type': 'application/json' } })
    }) as unknown as typeof fetch)
    return sent
  }
  it('after two people\'s views are revealed and with no reading served, one press sends core\'s route once and reads the View again; a second press while it is on its way sends nothing more', async () => {
    let release: () => void = () => {}
    const sent: Sent[] = []
    setTeamFetch((async (url: string, init?: RequestInit) => {
      sent.push({ method: init?.method ?? 'GET', url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined })
      if (String(url).endsWith('/api/me')) return new Response(JSON.stringify({ me: { id: base.you_id } }), { status: 200, headers: { 'content-type': 'application/json' } })
      if ((init?.method ?? 'GET') !== 'POST') return new Response(JSON.stringify({ error: 'not here' }), { status: 404, headers: { 'content-type': 'application/json' } })
      await new Promise<void>((r) => { release = r })
      return new Response(JSON.stringify({ round_read: 'ready' }), { status: 201, headers: { 'content-type': 'application/json' } })
    }) as unknown as typeof fetch)
    let reread = 0
    render(<RoundRead sid={base.id} view={base} headings={core.headings} onWrote={async () => { reread++; return true }} />)
    const ask = screen.getByTestId('round-read-ask')
    expect(ask.textContent).toBe('Ask Olumi to read this round')
    fireEvent.click(ask)
    await waitFor(() => expect(sent.filter((s) => s.method === 'POST')).toHaveLength(1))
    expect(screen.getByTestId('round-read-said').textContent).toBe('Olumi is reading the round…')
    fireEvent.click(ask)
    release()
    await waitFor(() => expect(reread).toBe(1))
    expect(sent.filter((s) => s.method === 'POST').map((s) => [s.url, s.body])).toEqual([[`/api/scenarios/${base.id}/round-read`, {}]])
    // The View was read again and is current (onWrote true) and still serves no reading: said, never invented.
    await waitFor(() => expect(screen.getByTestId('round-read-said').textContent).toBe('Olumi has no reading of this round yet.'))
  })
  it('a re-read that failed or was overtaken never says "no reading" (Codex B2 trigger HOLD 1); CONTRAST: a current View that serves the reading draws it in place of the ask', async () => {
    const sent = post({ status: 201, body: { round_read: 'unchanged' } })
    render(<RoundRead sid={base.id} view={base} headings={core.headings} onWrote={async () => false} />)
    fireEvent.click(screen.getByTestId('round-read-ask'))
    await waitFor(() => expect(screen.getByTestId('round-read-said').textContent).toBe("Asked. Olumi's reading will appear here when the page catches up."))
    expect(sent.filter((s) => s.method === 'POST')).toHaveLength(1)
    expect(document.body.textContent).not.toContain('Olumi has no reading of this round yet.')
    cleanup(); resetWrites()
    post({ status: 201, body: { round_read: 'ready' } })
    const page = { view: base }
    const { rerender } = render(<RoundRead sid={base.id} view={page.view} headings={core.headings} onWrote={async () => { page.view = withRead(read()); return true }} />)
    fireEvent.click(screen.getByTestId('round-read-ask'))
    await waitFor(() => expect(page.view).not.toBe(base))
    rerender(<RoundRead sid={base.id} view={page.view} headings={core.headings} onWrote={async () => true} />)
    expect(screen.getByTestId('round-read-lead').textContent).toBe('Mainly how long the diagnostic takes to sign, and two links.')
    expect(screen.queryByTestId('round-read-ask')).toBeNull()
  })
  it('core refusing (409: not revealed to you) says core\'s words and nothing else; CONTRAST: no ask is offered with a reading served, while gated, or with fewer than two people revealed', async () => {
    const sent = post({ status: 409, body: { error: 'The round is not revealed to you.' } })
    let reread = 0
    render(<RoundRead sid={base.id} view={base} headings={core.headings} onWrote={async () => { reread++; return true }} />)
    fireEvent.click(screen.getByTestId('round-read-ask'))
    expect((await screen.findByTestId('round-read-error')).textContent).toBe('The round is not revealed to you.')
    expect(sent.filter((s) => s.method === 'POST').map((s) => s.url)).toEqual([`/api/scenarios/${base.id}/round-read`])
    expect(screen.getByTestId('round-read-said').textContent).toBe('')
    expect(reread).toBe(0)
    cleanup()
    render(<RoundRead sid={base.id} view={withRead(read())} headings={core.headings} onWrote={async () => true} />)
    expect(screen.queryByTestId('round-read-ask')).toBeNull()
    cleanup()
    render(<RoundRead sid={base.id} view={withRead(undefined, { gated: true })} headings={core.headings} onWrote={async () => true} />)
    expect(screen.queryByTestId('round-read-ask')).toBeNull()
    cleanup()
    const one = { ...base, collab: { ...base.collab, shared: base.collab.shared.filter((s) => s.by_id === base.collab.shared[0]!.by_id) } } as View
    render(<RoundRead sid={base.id} view={one} headings={core.headings} onWrote={async () => true} />)
    expect(screen.queryByTestId('round-read-ask')).toBeNull()
  })
})
