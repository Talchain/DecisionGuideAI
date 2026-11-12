/**
 * THE CONVERSATION, DRIVEN WITHOUT A SCREEN (DL, 12 Nov: whatever the screen looks like, the layer must carry it). Through ONLY the journey
 * layer (olumiView/journey.ts) and the modules a drawing would import (the View store, the page person, the call itself). No component, no
 * DOM, no browser.
 *
 * Approved funding model -> Olumi's question answered in the person's own words -> waiting, typed -> Olumi's reply, typed, with the proposal
 * it brings -> that proposal approved -> where the model still cannot support a chance, with the View's own question -> server stopped and
 * started on the same store -> reopened cold, by id. Then, on a pending first draft: a correction told to Olumi before approval, and what
 * the layer reports when that turn does not finish. A step the layer cannot drive FAILS here with core's own words: it is a finding about
 * the layer or core, never patched around in this file.
 *
 * Runs only against a disposable zero-call core (the build operator's replay server: every AI job answered by a saved reply, no provider
 * key) on COPIES of saved stores. Nothing from those stores is in this repo: every id and word is read from the served View at run time,
 * except the person's own words (TALK_SAID), passed in. Env (all required, else the file is skipped):
 *   TALK_START   serves core on TALK_BASE for the store dir given as its argument and execs the server (a SIGTERM to its group stops it)
 *   TALK_STORE   the approved model's store copy   TALK_SID  its scenario   TALK_SAID  the person's answer to Olumi's question
 *   TALK_ASKS    a word Olumi's question to answer contains (e.g. "success")
 *   TALK_PENDING_STORE / TALK_PENDING_SID / TALK_TELL   a pending first draft's store copy, its scenario, and the correction told
 *   TALK_BASE    e.g. http://127.0.0.1:4051   TALK_ADMIN  the admin key file (reissues person 1's private link: the cookie a browser holds)
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { setTeamFetch, setPagePerson } from '../team/api'
import { useMe } from '../me'
import { useViewStore } from '../../olumiView/store'
import type { View } from '../../olumiView/client'
import { answer, approveAll, awaitTurn, converse, noChanceOf, openScenario, questionsOf, recordIdsOf, turnStateOf, type TurnState } from '../../olumiView/journey'

const env = process.env
const ready = ['TALK_START', 'TALK_STORE', 'TALK_SID', 'TALK_SAID', 'TALK_ASKS', 'TALK_PENDING_STORE', 'TALK_PENDING_SID', 'TALK_TELL', 'TALK_BASE', 'TALK_ADMIN'].every((k) => (env[k] ?? '') !== '')
const BASE = env['TALK_BASE'] ?? ''
const nodeFetch = globalThis.fetch.bind(globalThis)
let server: ChildProcess | null = null
let cookie = ''
const results: Record<string, string> = {}
const note = (k: string, v: unknown) => { results[k] = typeof v === 'string' ? v : JSON.stringify(v) }

const healthy = async () => { try { return (await nodeFetch(`${BASE}/healthz`)).ok } catch { return false } }
async function start(store: string): Promise<void> {
  server = spawn(env['TALK_START']!, [store], { stdio: ['ignore', 'ignore', 'inherit'], detached: true })
  for (let i = 0; i < 90; i++) { if (await healthy()) break; await new Promise((r) => setTimeout(r, 1000)) }
  if (!(await healthy())) throw new Error('core did not answer /healthz in 90 s')
  const r = await nodeFetch(`${BASE}/api/admin/people/1/reissue`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-olumi-admin': readFileSync(env['TALK_ADMIN']!, 'utf8').trim() }, body: '{}' })
  cookie = `olumi=${((await r.json()) as { link: string }).link.split('/k/')[1]!.split('?')[0]}`
}
/** Stops only the server this file started: its own process group (never a process found by name or by another port). */
async function stop(): Promise<void> {
  const s = server; server = null
  if (s === null || s.exitCode !== null) return
  await new Promise<void>((done) => { s.once('exit', () => done()); process.kill(-s.pid!, 'SIGTERM') })
  for (let i = 0; i < 30 && (await healthy()); i++) await new Promise((r) => setTimeout(r, 500))
}
function wire(): void {
  setTeamFetch((async (path: string, init?: RequestInit) => nodeFetch(`${BASE}${path}`, { method: init?.method, body: init?.body, headers: { ...(init?.headers as Record<string, string> | undefined), cookie } })) as unknown as typeof fetch)
}
function coldPage(): void {
  useViewStore.setState({ uuid: null, sid: null, view: null, opened: { open: new Map(), all: false }, status: 'none', error: null, stale: false, at: null })
  useMe.setState({ me: null, status: 'none' }); setPagePerson(null)
}
async function open(sid: string): Promise<View> {
  await openScenario(sid)
  await useViewStore.getState().setOpened({ open: new Map(), all: true }) // every badge open: a folded card is not a missing one
  const s = useViewStore.getState()
  expect(s.error, 'the View read').toBeNull()
  return s.view!
}
const view = (): View => useViewStore.getState().view!
const ids = (v: View) => [...recordIdsOf(v)].sort()
const text = (segs: readonly ({ text: string } | { cite: string })[] | undefined) => (segs ?? []).map((x) => ('text' in x ? x.text : '')).join('')

let before: { version: number; records: string[]; questions: string[] } | null = null
let reply: { turn: number; said: string; answer: string; proposal: number } | null = null
let after: { version: number; records: string[] } | null = null

describe.skipIf(!ready).sequential('the layer drives the conversation: answer Olumi -> waiting -> reply and proposal -> approve -> cold', () => {
  beforeAll(async () => { await start(env['TALK_STORE']!); wire(); coldPage() }, 120_000)
  afterAll(async () => { await stop() }, 60_000)

  it('C1 open the approved model: no proposal, Olumi\'s questions answerable', async () => {
    const v = await open(env['TALK_SID']!)
    before = { version: v.version!.n, records: ids(v), questions: v.model?.coaching_questions ?? [] }
    note('C1', { version: before.version, records: before.records.length, questions: before.questions, state: turnStateOf(v).kind, no_chance: noChanceOf(v).length })
    expect(v.proposal).toBeNull()
    expect(questionsOf(v).length).toBeGreaterThan(0)
  })

  it('C2+C3 answer Olumi\'s question in the person\'s words; while Olumi answers the layer says so, typed', async () => {
    const q = questionsOf(view()).find((x) => x.text.toLowerCase().includes(env['TALK_ASKS']!.toLowerCase()))
    expect(q, `Olumi asks a question containing "${env['TALK_ASKS']}"`).toBeDefined()
    await answer(q!, env['TALK_SAID']!)
    await useViewStore.getState().refresh()
    const waiting = turnStateOf(view())
    note('C3', waiting)
    // The replay returns each saved reply after the time the provider took for it (REPLAY_PACE=1), so the turn is still running here.
    expect(waiting).toMatchObject({ kind: 'waiting', said: env['TALK_SAID'] })
    expect(waiting.kind === 'waiting' && waiting.words).toBeTruthy()
  }, 60_000)

  it('C4 Olumi\'s reply, typed as an answer (not held, not failed), with the proposal it brings', async () => {
    const ended = await awaitTurn({ timeoutMs: 180_000, everyMs: 1_000 })
    const st: TurnState = turnStateOf(view())
    const p = view().proposal
    note('C4', { ended, kind: st.kind, said: 'said' in st ? st.said : null, answer: st.kind === 'answered' ? text(st.answer.answer).slice(0, 200) : null, proposal: p ? { id: p.id, heading: p.heading, lines: p.changes.length } : null })
    expect(ended).toBe('idle')
    expect(st.kind).toBe('answered')
    if (st.kind !== 'answered') return
    expect(st.said).toBe(env['TALK_SAID'])
    expect(text(st.answer.answer).length).toBeGreaterThan(0)
    expect(st.proposal).not.toBeNull()
    expect(st.proposal).toBe(p!.id)
    reply = { turn: st.turn, said: st.said, answer: text(st.answer.answer), proposal: st.proposal! }
  }, 200_000)

  it('C5 the proposal approved, by id: every record line new in it is now a record, the questions moved', async () => {
    const p = view().proposal!, had = new Set(before!.records)
    const rec = p.changes.flatMap((c) => (c.top ? [] : [c.id])), fresh = rec.filter((id) => !had.has(id)), top = p.changes.flatMap((c) => (c.top ? [c.id] : []))
    const out = await approveAll()
    const v = view(), now = new Set(ids(v))
    after = { version: v.version!.n, records: ids(v) }
    note('C5', { shown: out.shown, version: `${before!.version}->${after.version}`, fresh, missing: fresh.filter((id) => !now.has(id)), on_existing: rec.filter((id) => had.has(id)).map((id) => `${id} ${now.has(id) ? 'changed' : 'removed'}`), top })
    expect(out.shown).toBe(true)
    expect(v.proposal).toBeNull()
    expect(after.version).toBeGreaterThan(before!.version)
    expect(fresh.length).toBeGreaterThan(0)
    expect(fresh.filter((id) => !now.has(id))).toEqual([])
    if (top.includes('coaching_questions')) expect(v.model?.coaching_questions ?? []).not.toEqual(before!.questions)
  }, 60_000)

  it('C6 where the model still cannot support a chance: each option\'s words and the View\'s own question for what it waits on', () => {
    const nc = noChanceOf(view())
    note('C6', nc)
    // Not a pass condition that every option has a chance: the layer must say, per option, what the chance waits on, in core's words.
    for (const x of nc) { expect(x.text.length).toBeGreaterThan(0); expect(x.waits.length).toBeGreaterThan(0) }
  })

  it('C9 server stopped and started on the same store, reopened cold: the conversation and the approval, by id', async () => {
    await stop(); await start(env['TALK_STORE']!); wire(); coldPage()
    const v = await open(env['TALK_SID']!)
    const t = v.chat.find((x) => x.id === reply!.turn)
    note('C9', { version: v.version?.n, records_same: JSON.stringify(ids(v)) === JSON.stringify(after!.records), reply_same: text(t?.answer?.answer) === reply!.answer, state: turnStateOf(v).kind })
    expect(v.version?.n).toBe(after!.version)
    expect(ids(v)).toEqual(after!.records)
    expect(v.proposal).toBeNull()
    expect(t?.said).toBe(reply!.said)
    expect(text(t?.answer?.answer)).toBe(reply!.answer)
  }, 200_000)
})

describe.skipIf(!ready).sequential('a correction told to Olumi before approval (pending first draft)', () => {
  let pid = 0
  beforeAll(async () => { await start(env['TALK_PENDING_STORE']!); wire(); coldPage() }, 120_000)
  afterAll(async () => { await stop(); setTeamFetch(null); console.log(`CONVERSATION-LAYER RESULTS ${JSON.stringify(results)}`) }, 60_000)

  it('C7 the layer sends it and reports where it ends, typed, in core\'s words; the pending proposal is untouched unless Olumi answers', async () => {
    const v0 = await open(env['TALK_PENDING_SID']!)
    pid = v0.proposal!.id
    const { ended, state } = await converse(env['TALK_TELL']!, null, { timeoutMs: 180_000, everyMs: 1_000 })
    const v = view()
    note('C7', { ended, state, proposal: `${pid} -> ${v.proposal?.id ?? null}` })
    // What a person would need here: Olumi's answer and a new proposal that supersedes this one. Asserted as such, so a turn that does not
    // finish FAILS this row with core's words (recorded above) rather than passing as "the layer reported it".
    expect(state.kind, `the turn's end, in core's words: ${'words' in state ? state.words : ''}`).toBe('answered')
    expect(v.proposal?.id).not.toBe(pid)
  }, 200_000)

  it('F a turn that does not finish: the layer types it failed (or lost) with core\'s words, and the proposal is as it was', () => {
    const st = turnStateOf(view())
    if (st.kind !== 'failed' && st.kind !== 'lost') return // C7 answered: nothing to check here
    expect(st.words).toBeTruthy()
    expect(st.said).toBe(env['TALK_TELL'])
    expect(view().proposal?.id).toBe(pid)
  })
})
