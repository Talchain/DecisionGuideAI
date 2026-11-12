/**
 * THE ACTION LAYER, DRIVEN WITHOUT A SCREEN (DL, 12 Nov: the redesign's slice must stand on it). One journey on actual saved data, through
 * ONLY the modules a new drawing would import: the core client and its writes (olumiView/client.ts), the View store (olumiView/store.ts),
 * the page person (olumiCore/me.ts), the scenario id (olumiCore/team/sid.ts), the call itself (olumiCore/team/api.ts) and, for every act and
 * every judgement about what may be done, the journey layer (olumiView/journey.ts) ONLY. No component, no DOM, no browser.
 *
 * Open the pending first draft -> correct one figure -> approve some changes and refuse others -> edit one card -> stop the server and start
 * it again on the same store -> reopen cold, and read by id: the approved changes are in, the refused ones are not, the correction and the
 * edit persist, and each card's author is as it was. A step the layer alone cannot drive FAILS here with core's own words: it is a finding
 * about the layer, never patched around in this file.
 *
 * Runs only against a disposable zero-call core (the build operator's replay server: every AI job answered by a saved reply, no provider
 * key, no ledger) on a sqlite .backup COPY of a replay store that holds a pending first draft. Nothing from that store is in this repo:
 * every id is read from the served View at run time. Env (all required, else the file is skipped):
 *   ACTION_START   a script that serves core on ACTION_BASE for ACTION_STORE and execs the server (so a SIGTERM to it stops it)
 *   ACTION_STORE   the store copy's directory   ACTION_BASE  e.g. http://127.0.0.1:4051   ACTION_SID  the pending scenario (s_<12 hex>)
 *   ACTION_ADMIN   the copy's admin key file (to reissue person 1's private link: the cookie a browser would hold)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { setTeamFetch, setPagePerson, TeamApiError } from '../team/api'
import { useMe } from '../me'
import { useViewStore } from '../../olumiView/store'
import type { View } from '../../olumiView/client'
import { openScenario, approveSelected, authorshipOf, correctFigure, editGateOf, hasRecord, lineKey, picksOf, recordIdsOf, renameCard, setGroup, tickEvery, toggleLine, groupTicked, type Ticks } from '../../olumiView/journey'

const env = process.env
const ready = ['ACTION_START', 'ACTION_STORE', 'ACTION_BASE', 'ACTION_SID', 'ACTION_ADMIN'].every((k) => (env[k] ?? '') !== '')
const BASE = env['ACTION_BASE'] ?? '', SID = env['ACTION_SID'] ?? ''
const nodeFetch = globalThis.fetch.bind(globalThis)
let server: ChildProcess | null = null
let cookie = ''

const healthy = async () => { try { return (await nodeFetch(`${BASE}/healthz`)).ok } catch { return false } }
async function start(): Promise<void> {
  server = spawn(env['ACTION_START']!, [env['ACTION_STORE']!], { stdio: ['ignore', 'ignore', 'inherit'], detached: true })
  for (let i = 0; i < 90; i++) { if (await healthy()) return; await new Promise((r) => setTimeout(r, 1000)) }
  throw new Error('core did not answer /healthz in 90 s')
}
async function stop(): Promise<void> {
  const s = server; server = null
  if (s === null || s.exitCode !== null) return
  // The whole group: the start script execs tsx, which runs the server in a child process of its own.
  await new Promise<void>((done) => { s.once('exit', () => done()); process.kill(-s.pid!, 'SIGTERM') })
  for (let i = 0; i < 30 && (await healthy()); i++) await new Promise((r) => setTimeout(r, 500))
}
/** The browser's part only: same origin (the base), the private link's cookie. Every path, body and header otherwise is the layer's own. */
function wire(): void {
  setTeamFetch((async (path: string, init?: RequestInit) => {
    const headers = { ...(init?.headers as Record<string, string> | undefined), cookie }
    return nodeFetch(`${BASE}${path}`, { method: init?.method, body: init?.body, headers })
  }) as unknown as typeof fetch)
}
/** A page opened from nothing: no View, no person, no write memory beyond what core holds. */
function coldPage(): void {
  useViewStore.setState({ uuid: null, sid: null, view: null, opened: { open: new Map(), all: false }, status: 'none', error: null, stale: false, at: null })
  useMe.setState({ me: null, status: 'none' }); setPagePerson(null)
}
async function open(): Promise<View> {
  await openScenario(SID)
  // Every figure opened (the layer's own read, `setOpened`): a closed badge folds cards away, and a folded card is not a missing one.
  await useViewStore.getState().setOpened({ open: new Map(), all: true })
  const s = useViewStore.getState()
  expect(s.error, 'the View read').toBeNull()
  return s.view!
}
const view = (): View => useViewStore.getState().view!
const cardOf = (v: View, id: string) => v.model?.cards.find((c) => c.id === id) ?? null
const recordIds = (v: View): Set<string> => new Set(recordIdsOf(v))
const gate = () => editGateOf(useViewStore.getState(), useMe.getState().me)
const words = (e: unknown) => (e instanceof TeamApiError ? `${e.status} ${e.message}` : String(e))

// What the journey acts on, chosen from the pending View by shape at run time (nothing from the store is written here):
// - REFUSE: two of Olumi's risks offered on their own (no `together`, and no other line needs them);
// - FIGURE: a quantity card whose figure is the person's own, corrected to about 15% more than it was;
// - RENAMED: one option Olumi proposed, given the person's own name.
let REFUSE: string[] = [], FIGURE = '', TYPED = '', SHOWN = '', RENAMED = ''
const LABEL = 'Renamed by the action-layer test'
function choose(v: View): void {
  const p = v.proposal!, cards = v.model!.cards
  const needed = new Set(p.changes.flatMap((c) => c.together?.ids ?? []))
  REFUSE = p.changes.filter((c) => c.olumi != null && c.together == null && !needed.has(c.id) && cards.some((k) => k.id === c.id && k.family === 'risk')).slice(0, 2).map((c) => c.id)
  const mine = cards.find((k) => k.family === 'quantity' && k.author?.by === 'person' && /\d/.test(k.figure?.title ?? ''))!
  FIGURE = mine.id
  const was = Number((mine.figure!.title ?? '').replace(/[^0-9.]/g, ''))
  const now = Math.round(was * 1.15)
  TYPED = String(now); SHOWN = now.toLocaleString('en-GB')
  RENAMED = cards.find((k) => k.family === 'option' && k.author?.by === 'olumi')!.id
}
let pending: View | null = null
const results: Record<string, string> = {}

describe.skipIf(!ready).sequential('the action layer drives the slice: pending review -> correction -> approval -> edit -> cold reopen', () => {
  beforeAll(async () => {
    await start()
    const r = await nodeFetch(`${BASE}/api/admin/people/1/reissue`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-olumi-admin': readFileSync(env['ACTION_ADMIN']!, 'utf8').trim() }, body: '{}' })
    const link = ((await r.json()) as { link: string }).link
    cookie = `olumi=${link.split('/k/')[1]!.split('?')[0]}`
    wire(); coldPage()
  }, 120_000)
  afterAll(async () => { await stop(); setTeamFetch(null); console.log(`ACTION-LAYER RESULTS ${JSON.stringify(results)}`) }, 60_000)

  it('1 open: the pending first draft, as the person, with Olumi\'s changes held as a proposal', async () => {
    const v = await open()
    pending = v
    choose(v)
    expect(REFUSE, 'two of Olumi\'s risks to refuse').toHaveLength(2)
    results['chosen'] = JSON.stringify({ refuse: REFUSE.length, figure: FIGURE !== '', renamed: RENAMED !== '' })
    expect(v.you_id).toBe('1')
    expect(v.proposal, 'a proposal held').not.toBeNull()
    expect(v.version, 'no approved version yet').toBeNull()
    expect(recordIds(v).size, 'nothing approved yet').toBe(0)
    // Olumi's proposals read as proposals: every card the draft shows is held by the proposal, and Olumi's are provisional.
    const cards = v.model!.cards
    expect(cards.every((c) => authorshipOf(c).proposed), 'every card of the first draft is proposed').toBe(true)
    expect(cards.some((c) => authorshipOf(c).by === 'olumi') && cards.every((c) => authorshipOf(c).by !== 'olumi' || authorshipOf(c).provisional), "Olumi's cards are provisional").toBe(true)
    results['1 open'] = 'PASS'
  })

  it('2 correct one figure while the first draft is pending: the layer says "after approval", typed (DL ruling c)', () => {
    const g = gate()
    results['2 correct while pending'] = g.ok ? 'FAIL: the gate offers an edit core refuses' : `PASS: ${g.reason}`
    expect(g).toMatchObject({ ok: false, reason: 'after_approval', held: { id: view().proposal!.id } })
  })

  it('3 tick by group and by line, untick two of Olumi\'s risks, approve what is ticked', async () => {
    const p = view().proposal!, ch = p.changes
    let t: Ticks = tickEvery(ch)
    // By group: every group unticked and ticked again comes back whole (with its partners), where core groups the lines.
    for (const g of p.groups ?? []) { t = setGroup(ch, t, g.lines, false); expect(groupTicked(ch, t, g.lines)).toBe(false); t = setGroup(ch, t, g.lines, true) }
    expect(t.size, 'all ticked again').toBe(ch.length)
    // By line: a line with partners unticks with every one of them; ticked again, they come back together.
    const linked = ch.find((c) => (c.together?.ids.length ?? 0) > 0)!
    const off = toggleLine(ch, t, linked)
    expect(off.has(lineKey(linked))).toBe(false)
    for (const id of linked.together!.ids) expect([...off].some((k) => k === `rec:${id}`), `partner ${id} unticked with it`).toBe(false)
    t = toggleLine(ch, off, linked)
    expect(t.size).toBe(ch.length)
    for (const id of REFUSE) t = toggleLine(ch, t, ch.find((c) => c.id === id)!)
    const picks = picksOf(ch, t)
    expect(picks.left.map((c) => c.id), 'exactly the refused lines are left out').toEqual(REFUSE)
    let out
    try { out = await approveSelected(picks, {}, { lines: REFUSE }) } catch (e) { results['3 approve selected'] = `FAIL: ${words(e)}`; throw e }
    expect(out.shown).toBe(true)
    expect(out.unrecorded, 'the layer never claims a refusal core did not save').toEqual(REFUSE)
    const v = view()
    expect(v.proposal, 'the proposal is settled').toBeNull()
    expect(v.version?.n).toBe(1)
    expect(picks.only.filter((id) => !hasRecord(v, id)), 'every approved line is a record of the model').toEqual([])
    expect(REFUSE.filter((id) => hasRecord(v, id) || cardOf(v, id) !== null), 'no refused line is').toEqual([])
    results['3 approve selected'] = 'PASS'
  })

  it('3b the refusal is a record of its own (who refused what), not only an absence', () => {
    const served = JSON.stringify(view())
    const named = REFUSE.filter((id) => served.includes(id))
    results['3b refusal recorded'] = named.length === REFUSE.length ? 'PASS' : `FAIL: the View names ${named.length} of ${REFUSE.length} refused lines (core change, DL ruling b)`
    expect(named, 'each refused line is still named in what core serves').toEqual(REFUSE)
  })

  it('4 correct one figure, after approval, on the base the editor opened on', async () => {
    const g = gate()
    expect(g.ok, 'the gate opens once the proposal is approved').toBe(true)
    if (!g.ok) return
    try { expect((await correctFigure(g, FIGURE, TYPED)).shown).toBe(true) } catch (e) { results['4 correct figure'] = `FAIL: ${words(e)}`; throw e }
    expect(JSON.stringify(cardOf(view(), FIGURE)?.figure ?? null)).toContain(SHOWN)
    expect(authorshipOf(cardOf(view(), FIGURE)!).by, 'the corrected figure is the person\'s').toBe('person')
    results['4 correct figure'] = 'PASS'
  })

  it('5 edit one card (their own name for it)', async () => {
    const g = gate()
    if (!g.ok) throw new Error(`gate: ${g.reason}`)
    try { expect((await renameCard(g, RENAMED, LABEL)).shown).toBe(true) } catch (e) { results['5 edit card'] = `FAIL: ${words(e)}`; throw e }
    expect(cardOf(view(), RENAMED)?.heading).toBe(LABEL)
    results['5 edit card'] = 'PASS'
  })

  it('6 stop the server, start it on the same store, reopen cold: everything by id', async () => {
    const before = view()
    await stop(); await start()
    wire(); coldPage()
    const v = await open()
    expect(v.version?.n, 'the same latest version').toBe(before.version?.n)
    expect(v.proposal).toBeNull()
    for (const c of before.model!.cards) expect(cardOf(v, c.id), `kept ${c.id}`).not.toBeNull()
    expect([...recordIds(v)].sort(), 'the same records, by id').toEqual([...recordIds(before)].sort())
    const approved = pending!.proposal!.changes.map((c) => c.id).filter((id) => !REFUSE.includes(id))
    expect(approved.filter((id) => !hasRecord(v, id)), 'every approved line still in').toEqual([])
    expect(REFUSE.filter((id) => hasRecord(v, id) || cardOf(v, id) !== null), 'no refused line in').toEqual([])
    expect(JSON.stringify(cardOf(v, FIGURE)?.figure ?? null), 'the correction').toContain(SHOWN)
    expect(cardOf(v, RENAMED)?.heading, 'the edit').toBe(LABEL)
    // Authorship: every card the pending draft showed, other than the two the person changed, is by whom it was then.
    const changed = new Set([FIGURE, RENAMED])
    const kept = pending!.model!.cards.filter((c) => !changed.has(c.id) && cardOf(v, c.id) !== null)
    results['6 authors compared'] = `${kept.length} of ${pending!.model!.cards.length - changed.size} untouched pending cards (others folded into badges after approval)`
    expect(kept.length).toBeGreaterThan(0)
    expect(kept.filter((c) => authorshipOf(cardOf(v, c.id)!).by !== authorshipOf(c).by).map((c) => c.id), 'authors unchanged').toEqual([])
    expect(authorshipOf(cardOf(v, FIGURE)!).by, 'the correction stays the person\'s').toBe('person')
    results['6 cold reopen'] = 'PASS'
    results['6 renamed card author'] = `${authorshipOf(pending!.model!.cards.find((c) => c.id === RENAMED)!).by} -> ${authorshipOf(cardOf(v, RENAMED)!).by}`
  }, 180_000)

  // Olumi answers these in core, so they need a saved reply for THIS scenario's turn. The operator's saved Update reply
  // (bank-before-send-update/update-attempts.jsonl) answers another scenario's goal question: replaying it here would show an answer to a
  // different question. Skipped, with this reason, until a store with its own saved replies is available (DL, 12 Nov).
  it.skip('7 answer Olumi\'s question (journey.answer + awaitTurn): SKIPPED, no saved reply for this scenario\'s turn', () => {})
  it.skip('8 challenge a statement (journey.challenge + awaitTurn): SKIPPED, no saved reply for this scenario\'s turn', () => {})
})
