/**
 * THE FUNDING CONVERSATION ON A JOINED CORE, HEADLESS (DL, AUDIT-1856, 12 Nov): one usable funding conversation, driven through ONLY the journey
 * layer (olumiView/journey.ts) and the modules a drawing imports, against the integrator's join head served by the zero-call replay core.
 * Each branch starts from its own COPY of a saved store, because the steps the DL named are alternatives on the same first draft:
 *   A  pending first draft: open -> review -> correct it by message BEFORE approving (the case that failed at ac41)
 *   B  pending first draft: set it aside -> then a message (the case that gave 502)
 *   C  pending first draft: approve selected, refusing one line -> cold reopen, by id
 *   D  approved funding model: answer Olumi's goal question -> Olumi's reading of it: confirm / a different measure / unsure, each on its own
 *      copy (unsure must never write a refused reading) -> the honest "not calculated" with what each option waits on -> cold reopen
 * Every write the layer sends is recorded with core's response (status and body), so a failing step says the exact request and response.
 * A step that cannot be driven FAILS here, never patched around. Nothing from the stores is in this repo: ids and words are read at run time.
 * FUND_ATTEMPTS_PENDING / FUND_ATTEMPTS_APPROVED: the saved replies for each store's own turns.
 * Env (all required, else skipped): FUND_START (serves core on FUND_BASE for a store dir, execs the server), FUND_BASE, FUND_ADMIN,
 *   FUND_PENDING_A / _B / _C (store copies of the pending first draft), FUND_PENDING_SID,
 *   FUND_APPROVED_1 / _2 / _3 (store copies of the approved model), FUND_APPROVED_SID, FUND_SAID (the person's goal answer), FUND_ASKS,
 *   FUND_TELL (a correction told before approval), FUND_AFTER_ASIDE (a message after setting the draft aside), FUND_MEASURE (a different measure).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { setTeamFetch, setPagePerson } from '../team/api'
import { useMe } from '../me'
import { useViewStore } from '../../olumiView/store'
import type { View } from '../../olumiView/client'
import { answer, approveAll, approveSelected, awaitTurn, converse, noChanceOf, openScenario, picksOf, questionsOf, recordIdsOf, setAside, tickEvery, toggleLine, turnStateOf } from '../../olumiView/journey'

const env = process.env
const NEED = ['FUND_START', 'FUND_BASE', 'FUND_ADMIN', 'FUND_PENDING_A', 'FUND_PENDING_B', 'FUND_PENDING_C', 'FUND_PENDING_SID', 'FUND_APPROVED_1', 'FUND_APPROVED_2', 'FUND_APPROVED_3', 'FUND_APPROVED_SID', 'FUND_SAID', 'FUND_ASKS', 'FUND_TELL', 'FUND_AFTER_ASIDE', 'FUND_MEASURE', 'FUND_ATTEMPTS_PENDING', 'FUND_ATTEMPTS_APPROVED']
const ready = NEED.every((k) => (env[k] ?? '') !== '')
const BASE = env['FUND_BASE'] ?? '', OUT = env['FUND_OUT'] ?? ''
const nodeFetch = globalThis.fetch.bind(globalThis)
let server: ChildProcess | null = null, store = '', cookie = ''
const results: Record<string, unknown> = {}
/** Every write the layer sent, with core's answer: the exact request and response a failing step reports. */
let writes: { method: string; path: string; body: unknown; status: number; response: unknown }[] = []
const note = (k: string, v: unknown) => { results[k] = v; if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 1)) }

const healthy = async () => { try { return (await nodeFetch(`${BASE}/healthz`)).ok } catch { return false } }
/** `attempts`: the saved replies the replay core answers with, by job kind and order. A turn with no saved reply of its own gets none:
 *  the pending branches get the first-draft file (no Update replies), so a correction is never answered with another turn's saved reply. */
async function start(dir: string, attempts: string): Promise<void> {
  store = dir
  server = spawn(env['FUND_START']!, [dir], { stdio: ['ignore', 'ignore', 'inherit'], detached: true, env: { ...process.env, REPLAY_ATTEMPTS: attempts } })
  for (let i = 0; i < 90 && !(await healthy()); i++) await new Promise((r) => setTimeout(r, 1000))
  if (!(await healthy())) throw new Error('core did not answer /healthz in 90 s')
  const r = await nodeFetch(`${BASE}/api/admin/people/1/reissue`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-olumi-admin': readFileSync(env['FUND_ADMIN']!, 'utf8').trim() }, body: '{}' })
  cookie = `olumi=${((await r.json()) as { link: string }).link.split('/k/')[1]!.split('?')[0]}`
  wire(); cold()
}
/** Stops only the server this file started (its own process group). */
async function stop(): Promise<void> {
  const s = server; server = null
  if (s === null || s.exitCode !== null) return
  await new Promise<void>((done) => { s.once('exit', () => done()); process.kill(-s.pid!, 'SIGTERM') })
  for (let i = 0; i < 30 && (await healthy()); i++) await new Promise((r) => setTimeout(r, 500))
}
function wire(): void {
  writes = []
  setTeamFetch((async (path: string, init?: RequestInit) => {
    const res = await nodeFetch(`${BASE}${path}`, { method: init?.method, body: init?.body, headers: { ...(init?.headers as Record<string, string> | undefined), cookie } })
    const method = init?.method ?? 'GET'
    if (method !== 'GET') {
      const copy = res.clone(); let body: unknown = null, response: unknown = null
      try { body = init?.body ? JSON.parse(String(init.body)) : null } catch { body = String(init?.body) }
      try { response = await copy.json() } catch { response = await copy.text().catch(() => null) }
      writes.push({ method, path: path.replace(/\/k\/[^/?]+/, '/k/<link>'), body, status: res.status, response })
    }
    return res
  }) as unknown as typeof fetch)
}
function cold(): void {
  useViewStore.setState({ uuid: null, sid: null, view: null, opened: { open: new Map(), all: false }, status: 'none', error: null, stale: false, at: null })
  useMe.setState({ me: null, status: 'none' }); setPagePerson(null)
}
async function open(sid: string): Promise<View> {
  await openScenario(sid)
  await useViewStore.getState().setOpened({ open: new Map(), all: true })
  const s = useViewStore.getState()
  expect(s.error, 'the View read').toBeNull()
  return s.view!
}
const view = (): View => useViewStore.getState().view!
const ids = (v: View) => [...recordIdsOf(v)].sort()
const lastWrite = () => writes.at(-1) ?? null
/** The replay caller's own log for this store: each AI request it was asked, and whether a saved reply answered it (saved_n). */
const replayLog = (): { kind: string; nth: number; saved_n: number | null; first_item_same: boolean }[] =>
  existsSync(`${store}/replay-log.jsonl`) ? readFileSync(`${store}/replay-log.jsonl`, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []
/** The refusals of Olumi's readings saved in the store's versions (core keeps them in the version row; the View does not serve them). */
async function refusedReadings(): Promise<unknown[]> {
  const out = execFileSync('sqlite3', ['-json', `file:${store}/olumi.db?mode=ro`, "select body from rows where kind = 'version'"], { encoding: 'utf8' }).trim()
  return (out ? (JSON.parse(out) as { body: string }[]) : []).flatMap((r) => (JSON.parse(r.body) as { refused_readings?: unknown[] }).refused_readings ?? [])
}
const TURN = { timeoutMs: 180_000, everyMs: 1_000 }

describe.skipIf(!ready).sequential('A: the pending first draft corrected by message BEFORE approving', () => {
  beforeAll(async () => { await start(env['FUND_PENDING_A']!, env['FUND_ATTEMPTS_PENDING']!) }, 120_000)
  afterAll(async () => { await stop() }, 60_000)
  it('A1 open and review: Olumi\'s proposal, its lines and groups', async () => {
    const v = await open(env['FUND_PENDING_SID']!)
    note('A1', { proposal: v.proposal?.id, lines: v.proposal?.changes.length, groups: v.proposal?.groups?.length ?? null, version: v.version?.n ?? null, state: turnStateOf(v).kind })
    expect(v.proposal).not.toBeNull()
  })
  it('A2 tell Olumi a correction while it is pending: Olumi answers, and its new proposal supersedes the first', async () => {
    const was = view().proposal!.id
    const { ended, state } = await converse(env['FUND_TELL']!, null, TURN)
    const v = view()
    note('A2', { ended, state, newest: view().chat.at(-1) ?? null, turn: view().turn ?? null, proposal: `${was} -> ${v.proposal?.id ?? null}`, request: writes.find((w) => w.path.includes('/message')) ?? lastWrite(), replay: replayLog() })
    expect(state.kind, `turn end: ${'words' in state ? state.words : ''}; replay: ${JSON.stringify(replayLog())}`).toBe('answered')
    expect(v.proposal?.id).not.toBe(was)
  }, 200_000)
})

describe.skipIf(!ready).sequential('B: the pending first draft set aside, then a message', () => {
  beforeAll(async () => { await start(env['FUND_PENDING_B']!, env['FUND_ATTEMPTS_PENDING']!) }, 120_000)
  afterAll(async () => { await stop() }, 60_000)
  it('B1 set the first draft aside: nothing of it added, no proposal left', async () => {
    await open(env['FUND_PENDING_SID']!)
    const out = await setAside()
    const v = view()
    note('B1', { shown: out.shown, proposal: v.proposal?.id ?? null, records: ids(v).length, request: lastWrite() })
    expect(v.proposal).toBeNull()
  })
  it('B2 then a message: core takes it and says where it stands in its own words (never a bare 502)', async () => {
    let state: unknown = null, ended = '', error: unknown = null
    try { const r = await converse(env['FUND_AFTER_ASIDE']!, null, TURN); state = r.state; ended = r.ended } catch (e) { error = { name: (e as Error).name, message: (e as Error).message, status: (e as { status?: number }).status ?? null } }
    note('B2', { ended, state, error, newest: view().chat.at(-1) ?? null, request: writes.find((w) => w.path.includes('/message')) ?? lastWrite(), replay: replayLog() })
    const w = writes.find((x) => x.path.includes('/message'))
    expect(w?.status, `request ${JSON.stringify(w?.body)} -> ${w?.status} ${JSON.stringify(w?.response)}`).not.toBe(502)
    expect(error === null || (error as { status: number | null }).status !== 502).toBe(true)
  }, 200_000)
})

describe.skipIf(!ready).sequential('C: approve selected, refusing one line, then cold', () => {
  let refused = '', approved: string[] = [], after: string[] = [], n = 0
  beforeAll(async () => { await start(env['FUND_PENDING_C']!, env['FUND_ATTEMPTS_PENDING']!) }, 120_000)
  afterAll(async () => { await stop() }, 60_000)
  it('C1 untick one of Olumi\'s lines that stands alone and approve the rest: approved in, refused out, by id', async () => {
    const v = await open(env['FUND_PENDING_SID']!)
    const ch = v.proposal!.changes, needed = new Set(ch.flatMap((c) => c.together?.ids ?? []))
    const one = ch.find((c) => !c.top && c.olumi != null && c.together == null && !needed.has(c.id) && v.model!.cards.some((k) => k.id === c.id && k.family === 'risk'))!
    refused = one.id
    const picks = picksOf(ch, toggleLine(ch, tickEvery(ch), one))
    approved = picks.only
    const out = await approveSelected(picks, {}, { lines: picks.left.map((c) => c.id) })
    const w = view(), r = new Set(ids(w))
    after = ids(w); n = w.version!.n
    note('C1', { refused, left: picks.left.map((c) => c.id), approved: approved.length, shown: out.shown, missing: approved.filter((id) => !r.has(id)), refused_present: r.has(refused), version: n, request: lastWrite() })
    expect(approved.filter((id) => !r.has(id))).toEqual([])
    expect(r.has(refused)).toBe(false)
  })
  it('C2 server restarted on the same store, reopened cold: the same records by id', async () => {
    const dir = store; await stop(); await start(dir, env['FUND_ATTEMPTS_PENDING']!)
    const v = await open(env['FUND_PENDING_SID']!)
    note('C2', { version: v.version?.n, same: JSON.stringify(ids(v)) === JSON.stringify(after), refused_present: recordIdsOf(v).has(refused) })
    expect(v.version?.n).toBe(n); expect(ids(v)).toEqual(after); expect(recordIdsOf(v).has(refused)).toBe(false)
  }, 200_000)
})

/** D: the goal question answered on the approved model, then Olumi's reading of the goal answered three ways, each on its own copy. */
async function goalAnswered(dir: string, tag: string): Promise<View> {
  await start(dir, env['FUND_ATTEMPTS_APPROVED']!)
  const v0 = await open(env['FUND_APPROVED_SID']!)
  const q = questionsOf(v0).find((x) => x.text.toLowerCase().includes(env['FUND_ASKS']!.toLowerCase()))
  expect(q, `Olumi asks a question containing "${env['FUND_ASKS']}"`).toBeDefined()
  await answer(q!, env['FUND_SAID']!)
  const ended = await awaitTurn(TURN), v = view(), st = turnStateOf(v)
  const readings = ((v.proposal as unknown as { marks?: { what: string; reading?: { id: string } }[] } | null)?.marks ?? []).flatMap((m) => (m.reading ? [{ what: m.what, id: m.reading.id }] : []))
  note(`${tag}0`, { ended, state: st.kind, proposal: v.proposal ? { id: v.proposal.id, heading: v.proposal.heading, lines: v.proposal.changes.map((c) => c.id) } : null, readings, replay: replayLog() })
  expect(st.kind).toBe('answered')
  return v
}
const readingsOf = (v: View) => ((v.proposal as unknown as { marks?: { reading?: { id: string } }[] } | null)?.marks ?? []).flatMap((m) => (m.reading ? [m.reading.id] : []))

describe.skipIf(!ready).sequential('D1: goal answered, Olumi\'s reading CONFIRMED, then not calculated, then cold', () => {
  let after: string[] = [], n = 0
  beforeAll(async () => { await goalAnswered(env['FUND_APPROVED_1']!, 'D1.') }, 300_000)
  afterAll(async () => { await stop() }, 60_000)
  it('D1.1 confirm: approve with Olumi\'s reading(s) chosen by id (or the whole proposal where it carries none)', async () => {
    const v = view(), rs = readingsOf(v)
    const out = rs.length ? await approveSelected(picksOf(v.proposal!.changes, tickEvery(v.proposal!.changes)), { readings: rs }) : await approveAll()
    const w = view(); after = ids(w); n = w.version!.n
    note('D1.1', { readings: rs, shown: out.shown, version: n, refused: await refusedReadings(), request: lastWrite() })
    expect(w.proposal).toBeNull()
    expect(await refusedReadings()).toEqual([])
  })
  it('D1.2 where the model cannot support a chance: each option\'s words and what it waits on, in core\'s words', () => {
    const nc = noChanceOf(view())
    note('D1.2', nc)
    for (const x of nc) { expect(x.text).toBeTruthy(); expect(x.waits).toBeTruthy() }
  })
  it('D1.3 cold reopen: the same records by id', async () => {
    const dir = store; await stop(); await start(dir, env['FUND_ATTEMPTS_APPROVED']!)
    const v = await open(env['FUND_APPROVED_SID']!)
    note('D1.3', { version: v.version?.n, same: JSON.stringify(ids(v)) === JSON.stringify(after), no_chance: noChanceOf(v).length })
    expect(v.version?.n).toBe(n); expect(ids(v)).toEqual(after)
  }, 200_000)
})

describe.skipIf(!ready).sequential('D2: goal answered, then A DIFFERENT MEASURE told to Olumi before approving', () => {
  beforeAll(async () => { await goalAnswered(env['FUND_APPROVED_2']!, 'D2.') }, 300_000)
  afterAll(async () => { await stop() }, 60_000)
  it('D2.1 the different measure, told while Olumi\'s reading is pending: Olumi answers with a proposal that supersedes it', async () => {
    const was = view().proposal!.id
    const { ended, state } = await converse(env['FUND_MEASURE']!, null, TURN)
    note('D2.1', { ended, state, newest: view().chat.at(-1) ?? null, proposal: `${was} -> ${view().proposal?.id ?? null}`, refused: await refusedReadings(), request: writes.filter((w) => w.path.includes('/message')).at(-1) ?? lastWrite(), replay: replayLog() })
    expect(await refusedReadings(), 'a different measure is never a refusal written on its own').toEqual([])
    expect(state.kind, `turn end: ${'words' in state ? state.words : ''}`).toBe('answered')
    expect(view().proposal?.id).not.toBe(was)
  }, 200_000)
})

describe.skipIf(!ready).sequential('D3: goal answered, Olumi\'s reading left UNSURE (neither confirmed nor refused)', () => {
  beforeAll(async () => { await goalAnswered(env['FUND_APPROVED_3']!, 'D3.') }, 300_000)
  afterAll(async () => { await stop() }, 60_000)
  it('D3.1 unsure: approve without choosing or refusing the reading; no refused reading is written', async () => {
    const v = view(), rs = readingsOf(v)
    const out = await approveSelected(picksOf(v.proposal!.changes, tickEvery(v.proposal!.changes)), {}, {})
    const refused = await refusedReadings()
    note('D3.1', { readings_offered: rs, shown: out.shown, refused, request: lastWrite() })
    expect(refused, 'unsure must never write a refused reading').toEqual([])
    expect(JSON.stringify(lastWrite()?.body ?? {})).not.toContain('refuse_readings')
  })
  afterAll(() => { setTeamFetch(null); console.log(`FUNDING-JOURNEY RESULTS ${JSON.stringify(results)}`) })
})
