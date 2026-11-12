/**
 * THE ACTION LAYER, DRIVEN WITHOUT A SCREEN (DL, 12 Nov: the redesign's slice must stand on it). One journey on actual saved data, through
 * ONLY the modules a new drawing would import: the core client and its writes (olumiView/client.ts), the View store (olumiView/store.ts),
 * the page person (olumiCore/me.ts), the scenario id (olumiCore/team/sid.ts), the write settler (olumiCore/team/writes.ts) and the call
 * itself (olumiCore/team/api.ts). No component, no DOM, no browser.
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
import { derivedUuidOf } from '../team/sid'
import { runWrite } from '../team/writes'
import { useViewStore } from '../../olumiView/store'
import { writes, type View } from '../../olumiView/client'

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
  await useMe.getState().load()
  await useViewStore.getState().use(derivedUuidOf(SID))
  // Every figure opened (the layer's own read, `setOpened`): a closed badge folds cards away, and a folded card is not a missing one.
  await useViewStore.getState().setOpened({ open: new Map(), all: true })
  const s = useViewStore.getState()
  expect(s.error, 'the View read').toBeNull()
  return s.view!
}
const view = (): View => useViewStore.getState().view!
const cardOf = (v: View, id: string) => v.model?.cards.find((c) => c.id === id) ?? null
/** The approved model's records by id, as core serves them (`collab.records`). A record need not be a card of its own: core folds one into
 *  a card's badge, a premise or the question's badge (seen on this store), and `all` does not unfold badges. */
const recordIds = (v: View): Set<string> => new Set(v.collab.records.map((r) => r.id))
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
    for (const id of REFUSE) expect(v.proposal!.changes.some((c) => c.id === id && c.together == null), `${id} is offered on its own`).toBe(true)
    // Nothing else in the proposal needs a refused line (core refuses a pick that leaves out a partner).
    expect(v.proposal!.changes.filter((c) => (c.together?.ids ?? []).some((x) => REFUSE.includes(x))).map((c) => c.id)).toEqual([])
    results['1 open'] = 'PASS'
  })

  it('2 correct one figure on the pending draft (their own figure, before approving)', async () => {
    const v = view()
    const base = v.model?.edit_base ?? null
    results['2 correct before approval'] = `FAIL: edit_base ${String(base)}`
    expect(base, 'the layer has a base to correct against while the first draft is pending').not.toBeNull()
    await runWrite(`${SID}:edit:${FIGURE}`, { op: true }, { base, quantity: FIGURE, typed: TYPED }, (op) => writes.edit(SID, base!, FIGURE, TYPED, op!))
    results['2 correct before approval'] = 'PASS'
  })

  it('3 approve some changes and refuse others', async () => {
    const p = view().proposal!
    const only = p.changes.filter((c) => !c.top && !REFUSE.includes(c.id)).map((c) => c.id)
    const only_top = p.changes.filter((c) => c.top && !REFUSE.includes(c.id)).map((c) => c.id)
    try { await writes.approve(p.id, p.base, { only, only_top }) } catch (e) { results['3 approve selected'] = `FAIL: ${words(e)}`; throw e }
    expect(await useViewStore.getState().modelChanged()).toBe(true)
    const v = view()
    expect(v.proposal, 'the proposal is settled').toBeNull()
    expect(v.version?.n).toBe(1)
    const ids = recordIds(v)
    expect(only.filter((id) => !ids.has(id)), 'every approved line is a record of the model').toEqual([])
    expect(REFUSE.filter((id) => ids.has(id) || cardOf(v, id) !== null), 'no refused line is').toEqual([])
    results['3 approve selected'] = 'PASS'
  })

  it('3b the refusal is a record of its own (who refused what), not only an absence', () => {
    const served = JSON.stringify(view())
    const named = REFUSE.filter((id) => served.includes(id))
    results['3b refusal recorded'] = named.length === REFUSE.length ? 'PASS' : `FAIL: the View names ${named.length} of ${REFUSE.length} refused lines`
    expect(named, 'each refused line is still named in what core serves').toEqual(REFUSE)
  })

  it('4 correct one figure (after approval, the layer\'s only way)', async () => {
    const base = view().model!.edit_base!
    try { await runWrite(`${SID}:edit:${FIGURE}`, { op: true }, { base, quantity: FIGURE, typed: TYPED }, (op) => writes.edit(SID, base, FIGURE, TYPED, op!)) } catch (e) { results['4 correct figure'] = `FAIL: ${words(e)}`; throw e }
    expect(await useViewStore.getState().modelChanged()).toBe(true)
    expect(JSON.stringify(cardOf(view(), FIGURE)?.figure ?? null)).toContain(SHOWN)
    results['4 correct figure'] = 'PASS'
  })

  it('5 edit one card (their own name for it)', async () => {
    const base = view().model!.edit_base!
    try { await runWrite(`${SID}:rename:${RENAMED}`, { op: true }, { base, record: RENAMED, label: LABEL }, (op) => writes.rename(SID, base, RENAMED, LABEL, op!)) } catch (e) { results['5 edit card'] = `FAIL: ${words(e)}`; throw e }
    expect(await useViewStore.getState().modelChanged()).toBe(true)
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
    expect(approved.filter((id) => !recordIds(v).has(id)), 'every approved line still in').toEqual([])
    expect(REFUSE.filter((id) => recordIds(v).has(id) || cardOf(v, id) !== null), 'no refused line in').toEqual([])
    expect(JSON.stringify(cardOf(v, FIGURE)?.figure ?? null), 'the correction').toContain(SHOWN)
    expect(cardOf(v, RENAMED)?.heading, 'the edit').toBe(LABEL)
    // Authorship: every card the pending draft showed, other than the two the person changed, says who wrote it exactly as it did then.
    const changed = new Set([FIGURE, RENAMED])
    const drifted = pending!.model!.cards.filter((c) => !changed.has(c.id) && cardOf(v, c.id) !== null && JSON.stringify(cardOf(v, c.id)!.author) !== JSON.stringify(c.author)).map((c) => c.id)
    const compared = pending!.model!.cards.filter((c) => !changed.has(c.id) && cardOf(v, c.id) !== null).length
    results['6 authors compared'] = `${compared} of ${pending!.model!.cards.length - changed.size} untouched pending cards (others folded into badges after approval)`
    expect(compared).toBeGreaterThan(0)
    expect(drifted, 'authors unchanged').toEqual([])
    results['6 cold reopen'] = 'PASS'
    results['6 authors of the two changed cards'] = JSON.stringify([FIGURE, RENAMED].map((id) => [id, pending!.model!.cards.find((c) => c.id === id)?.author?.by, cardOf(v, id)?.author?.by]))
  }, 180_000)
})
