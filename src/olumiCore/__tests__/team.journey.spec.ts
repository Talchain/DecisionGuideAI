/**
 * THE TWO-PERSON TEAM JOURNEY ON A JOINED CORE, HEADLESS (DL, 12 Nov: "which no current run proves"). Through the modules a drawing imports
 * (the team client olumiCore/team/api.ts, the View store, the journey layer), two people, each with their own cookie, on the integrator's join
 * head served by the zero-call replay core. Every write is recorded with core's response, so a failing step says the exact request and response.
 *
 *   T1 Paul (the scenario's member) invites a second member; T2 she joins by opening that link (the cookie the link sets);
 *   T3 each gives a private view with a figure on the SAME quantity, and neither sees the other's before the reveal;
 *   T4 reveal; T5 the card's mark ("… raised it" / "… differ") and Olumi's question for it; T6 one member records an action with an expectation;
 *   T7 the other's dissent kept in their own words; then on two separate copies, E1 erase the joiner and E2 erase the scenario's first member:
 *   their name leaves every row a remaining reader can read (View, Summary, invitations) while the approved version stays; then a restart and a
 *   cold reopen as the remaining reader, with the right names.
 * Nothing from the store is in this repo: ids and words are read at run time. A step that cannot be driven FAILS here with core's words.
 * Env (all required, else skipped): TEAM_START, TEAM_BASE, TEAM_ADMIN, TEAM_STORE_1 / TEAM_STORE_2 (two copies of one approved model),
 *   TEAM_SID, TEAM_JOINER (the second member's name), TEAM_OUT (results file).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import { setTeamFetch, setPagePerson } from '../team/api'
import { teamApi } from '../team/api'
import { useMe } from '../me'
import { useViewStore } from '../../olumiView/store'
import type { View } from '../../olumiView/client'
import { openScenario } from '../../olumiView/journey'

const env = process.env
const ready = ['TEAM_START', 'TEAM_BASE', 'TEAM_ADMIN', 'TEAM_STORE_1', 'TEAM_STORE_2', 'TEAM_SID', 'TEAM_JOINER'].every((k) => (env[k] ?? '') !== '')
const BASE = env['TEAM_BASE'] ?? '', SID = env['TEAM_SID'] ?? '', JOINER = env['TEAM_JOINER'] ?? '', OUT = env['TEAM_OUT'] ?? ''
const nodeFetch = globalThis.fetch.bind(globalThis)
let server: ChildProcess | null = null
const results: Record<string, unknown> = {}
const note = (k: string, v: unknown) => { results[k] = v; if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 1)) }
let writes: { who: string; method: string; path: string; body: unknown; status: number; response: unknown }[] = []
/** The two people's cookies, and who is acting now. */
const jar: Record<string, string> = {}
let acting = ''

const healthy = async () => { try { return (await nodeFetch(`${BASE}/healthz`)).ok } catch { return false } }
async function start(dir: string): Promise<void> {
  server = spawn(env['TEAM_START']!, [dir], { stdio: ['ignore', 'ignore', 'inherit'], detached: true })
  for (let i = 0; i < 90 && !(await healthy()); i++) await new Promise((r) => setTimeout(r, 1000))
  if (!(await healthy())) throw new Error('core did not answer /healthz in 90 s')
  wire()
}
async function stop(): Promise<void> {
  const s = server; server = null
  if (s === null || s.exitCode !== null) return
  await new Promise<void>((done) => { s.once('exit', () => done()); process.kill(-s.pid!, 'SIGTERM') })
  for (let i = 0; i < 30 && (await healthy()); i++) await new Promise((r) => setTimeout(r, 500))
}
function wire(): void {
  setTeamFetch((async (path: string, init?: RequestInit) => {
    const res = await nodeFetch(`${BASE}${path}`, { method: init?.method, body: init?.body, headers: { ...(init?.headers as Record<string, string> | undefined), cookie: jar[acting] ?? '' } })
    const method = init?.method ?? 'GET'
    if (method !== 'GET') {
      const copy = res.clone(); let body: unknown = null, response: unknown = null
      try { body = init?.body ? JSON.parse(String(init.body)) : null } catch { body = String(init?.body) }
      try { response = await copy.json() } catch { response = await copy.text().catch(() => null) }
      writes.push({ who: acting, method, path, body, status: res.status, response: redact(response) })
    }
    return res
  }) as unknown as typeof fetch)
}
/** A private link is never written to a results file. */
const redact = (x: unknown): unknown => JSON.parse(JSON.stringify(x ?? null).replace(/\/k\/[^"?\\]+/g, '/k/<link>'))
/** Paul's cookie: the admin reissues person 1's private link (the cookie a browser holds). */
async function paul(): Promise<void> {
  const r = await nodeFetch(`${BASE}/api/admin/people/1/reissue`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-olumi-admin': readFileSync(env['TEAM_ADMIN']!, 'utf8').trim() }, body: '{}' })
  jar['paul'] = `olumi=${((await r.json()) as { link: string }).link.split('/k/')[1]!.split('?')[0]}`
}
/** Opening a private link as a browser would: the cookie it sets (never the token read from the URL). */
async function openLink(link: string): Promise<{ status: number; cookie: string | null; location: string | null }> {
  const r = await nodeFetch(`${BASE}${link}`, { redirect: 'manual' })
  const set = r.headers.get('set-cookie')
  return { status: r.status, cookie: set ? set.split(';')[0]! : null, location: r.headers.get('location') }
}
/** Act as one person: a page opened from nothing as them. */
async function as(who: string): Promise<View> {
  acting = who
  useViewStore.setState({ uuid: null, sid: null, view: null, opened: { open: new Map(), all: false }, status: 'none', error: null, stale: false, at: null })
  useMe.setState({ me: null, status: 'none' }); setPagePerson(null)
  await openScenario(SID)
  await useViewStore.getState().setOpened({ open: new Map(), all: true })
  const s = useViewStore.getState()
  expect(s.error, `the View read as ${who}`).toBeNull()
  return s.view!
}
const get = async (path: string) => { const r = await nodeFetch(`${BASE}${path}`, { headers: { cookie: jar[acting] ?? '' } }); return { status: r.status, text: await r.text() } }
const words = (e: unknown) => ({ status: (e as { status?: number }).status ?? null, message: (e as Error).message })
type Loose = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const L = (x: unknown) => x as Loose
const lastWrite = () => writes.at(-1) ?? null

let paulId = '', joinerId = '', quantity = '', qLabel = '', version = 0, views: Record<string, number> = {}, commitment = 0, approvedId = 0

/** T1-T7 on one copy, shared by both erase branches. */
async function together(tag: string, dir: string): Promise<void> {
  writes = []; await start(dir); await paul()
  const v0 = await as('paul')
  paulId = v0.you_id!; version = v0.version!.n; approvedId = v0.version!.id
  const fig = (L(v0.model).view_figure_cards ?? []) as { id: string; label: string }[]
  quantity = fig[0]?.id ?? ''; qLabel = fig[0]?.label ?? ''
  note(`${tag}T0`, { you: v0.you, version, quantity, qLabel, view_figure_cards: fig.length, members: L(v0).team_presence ?? null })
  // T1 invite
  const inv = await teamApi.invite(SID, JOINER)
  joinerId = inv.id
  // T2 join by opening the link
  const opened = await openLink(inv.link)
  jar['joiner'] = opened.cookie ?? ''
  const vj = await as('joiner')
  note(`${tag}T1-2`, { invite: { id: inv.id, status: lastWrite()?.status }, open: { status: opened.status, cookie: opened.cookie !== null, location: opened.location?.replace(/\/k\/[^?]+/, '/k/<link>') ?? null }, joiner: { you: vj.you, you_id: vj.you_id, presence: L(vj).team_presence ?? null, gated: L(vj).gated ?? null } })
}

describe.skipIf(!ready).sequential('E1: two members, then the joiner erased; Paul reopens cold', () => {
  beforeAll(async () => { await together('E1.', env['TEAM_STORE_1']!) }, 180_000)
  afterAll(async () => { await stop() }, 60_000)

  it('T1+T2 a second member joins by the link a member made for her', async () => {
    const v = await as('joiner')
    expect(jar['joiner'], 'opening the link sets her cookie').toBeTruthy()
    expect(v.you).toBe(JOINER)
    expect(v.you_id).toBe(joinerId)
  })
  it('T3 each gives a private view with a figure on the same quantity; neither sees the other\'s before the reveal', async () => {
    expect(quantity, 'core offers a card a view\'s figure is for').not.toBe('')
    await as('paul')
    const a = await teamApi.giveView(SID, `Paul's view: ${qLabel} is lower than the model holds.`, [{ quantity, typed: '9' }], version)
    views['paul'] = a.contribution
    const vj = await as('joiner')
    const sawPaul = JSON.stringify(vj).includes("Paul's view:")
    const b = await teamApi.giveView(SID, `${JOINER}'s view: ${qLabel} is higher than the model holds.`, [{ quantity, typed: '15' }], version)
    views['joiner'] = b.contribution
    const vp = await as('paul')
    const sawJoiner = JSON.stringify(vp).includes(`${JOINER}'s view:`)
    note('E1.T3', { views, joiner_saw_paul_before: sawPaul, paul_saw_joiner_before: sawJoiner, can_reveal: L(vp.collab).can_reveal ?? null, waiting: L(vp.collab).waiting ?? null, writes: writes.slice(-2) })
    expect(sawPaul).toBe(false); expect(sawJoiner).toBe(false)
  })
  it('T4 reveal: both views shown to both', async () => {
    await as('paul')
    let r: unknown = null, err: unknown = null
    try { r = await teamApi.reveal(SID) } catch (e) { err = words(e) }
    const vp = await as('paul'), vj = await as('joiner')
    const shown = (v: View) => (L(v.collab).shared ?? []).map((s: Loose) => ({ id: s.id, by: s.by, kind: s.kind ?? null }))
    note('E1.T4', { revealed: r, error: err, paul_sees: shown(vp), joiner_sees: shown(vj), request: lastWrite() })
    expect(err).toBeNull()
    expect(shown(vp).map((s: Loose) => s.id).sort()).toEqual([views['paul'], views['joiner']].sort())
    expect(shown(vj).map((s: Loose) => s.id).sort()).toEqual([views['paul'], views['joiner']].sort())
  })
  it('T5 the card\'s mark says both raised it (or that they differ), with Olumi\'s question for it', async () => {
    const v = await as('paul')
    const m = ((L(v.collab).marks ?? []) as Loose[]).find((x) => x.card === quantity)
    note('E1.T5', { mark: m ?? null, next: L(v.collab).next ?? null, all_marks: (L(v.collab).marks ?? []).map((x: Loose) => ({ card: x.card, kind: x.kind, text: x.text })) })
    expect(m, `a mark on ${quantity}`).toBeDefined()
    expect(m!.views.sort()).toEqual([views['paul'], views['joiner']].sort())
    expect(m!.text).toMatch(/raised it|differ/)
    expect(m!.question).toBeTruthy()
  })
  it('T6 the joiner records an action with an expectation', async () => {
    await as('joiner')
    let r: unknown = null, err: unknown = null
    try { r = await teamApi.addCommitment(SID, { action: 'Hold the ask at 1.3 million and review runway monthly.', owner: joinerId, expect: 'Runway stays above 12 months through the next two quarters.', reconsider: 'Runway falls below 9 months.', keeps: [] }) } catch (e) { err = words(e) }
    const v = await as('paul'), c = ((L(v.collab).commitments ?? []) as Loose[]).at(-1)
    commitment = (r as { commitment?: number } | null)?.commitment ?? 0
    note('E1.T6', { result: r, error: err, seen_by_paul: c ? { id: c.id, by: c.by, owner: c.owner, expect: c.expect } : null, request: lastWrite() })
    expect(err).toBeNull()
    expect(c?.expect).toBe('Runway stays above 12 months through the next two quarters.')
    expect(c?.by).toBe(JOINER)
  })
  it('T7 Paul\'s dissent kept in his own words (a held dissent he confirms, or the difference kept as a disagreement)', async () => {
    const v = await as('paul')
    const held = ((L(v.collab).dissent ?? []) as Loose[]).filter((d) => d.holder_id === paulId)
    let via = '', r: unknown = null, err: unknown = null
    if (held.length > 0) {
      via = 'confirm'
      try { r = await teamApi.confirmDissent(SID, held[0]!.id, 'I still think the bigger raise is the faster route.', 'If runway stays above 12 months on the lean plan.') } catch (e) { err = words(e) }
    } else {
      via = 'difference step'
      const d = await get(`/api/scenarios/${SID}/differences`)
      let diffs: Loose = {}; try { diffs = JSON.parse(d.text) } catch { diffs = { raw: d.text.slice(0, 300) } }
      note('E1.T7.differences', { status: d.status, body: diffs })
      const rec = ((diffs['differences'] ?? diffs['items'] ?? []) as Loose[])[0]?.record ?? quantity
      const res = await nodeFetch(`${BASE}/api/scenarios/${SID}/differences/${encodeURIComponent(rec)}/steps`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: jar['paul']! }, body: JSON.stringify({ step: 'dissent' }) })
      const body = await res.text()
      writes.push({ who: 'paul', method: 'POST', path: `/api/scenarios/${SID}/differences/${rec}/steps`, body: { step: 'dissent' }, status: res.status, response: body.slice(0, 400) })
      if (res.ok) r = JSON.parse(body); else err = { status: res.status, message: body.slice(0, 300) }
    }
    const after = await as('joiner')
    const kept = JSON.stringify(after).includes('I still think the bigger raise is the faster route.') || JSON.stringify(L(after.collab).shared ?? []).includes("Paul's view:")
    note('E1.T7', { via, held: held.map((d) => ({ id: d.id, holder: d.holder })), result: r, error: err, kept_words_visible_to_joiner: kept, request: lastWrite() })
    expect(err, `${via}: ${JSON.stringify(err)}`).toBeNull()
  })
  it('E1 the joiner erases her data: her name leaves every row Paul reads; the approved version stays', async () => {
    await as('joiner')
    let err: unknown = null
    try { await nodeFetch(`${BASE}/api/me/delete`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: jar['joiner']! }, body: JSON.stringify({ confirm: null }) })
      const r = await nodeFetch(`${BASE}/api/me/delete`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: jar['joiner']! }, body: JSON.stringify({ confirm: 'delete my data' }) })
      writes.push({ who: 'joiner', method: 'POST', path: '/api/me/delete', body: { confirm: 'delete my data' }, status: r.status, response: await r.json().catch(() => null) })
      if (!r.ok) err = { status: r.status }
    } catch (e) { err = words(e) }
    const v = await as('paul')
    const summary = await get(`/api/scenarios/${SID}/summary`), invites = await get(`/api/scenarios/${SID}/invites`)
    const where = (t: string) => { const i = t.indexOf(JOINER); return i < 0 ? null : t.slice(Math.max(0, i - 80), i + 80) }
    const gone = await nodeFetch(`${BASE}/api/me`, { headers: { cookie: jar['joiner']! } })
    note('E1.erase', { error: err, request: lastWrite(), version: { id: v.version?.id, n: v.version?.n }, name_in_view: where(JSON.stringify(v)), name_in_summary: where(summary.text), name_in_invites: where(invites.text), former_member_in_view: JSON.stringify(v).includes('a former member'), erased_link_me: gone.status })
    expect(err).toBeNull()
    expect(v.version?.id).toBe(approvedId)
    expect(where(JSON.stringify(v)), 'her name in the View Paul reads').toBeNull()
    expect(where(summary.text), 'her name in the Summary').toBeNull()
    expect(where(invites.text), 'her name in the invitations list').toBeNull()
  })
  it('E1 cold: server restarted, Paul reopens: the approved version, his own name, a former member in hers', async () => {
    const dir = env['TEAM_STORE_1']!; await stop(); await start(dir); await paul()
    const v = await as('paul')
    const s = JSON.stringify(v)
    note('E1.cold', { version: v.version?.id, you: v.you, presence: L(v).team_presence ?? null, name_in_view: s.includes(JOINER), commitment_by: ((L(v.collab).commitments ?? []) as Loose[]).map((c) => ({ by: c.by, owner: c.owner })), shared_by: ((L(v.collab).shared ?? []) as Loose[]).map((x) => x.by) })
    expect(v.version?.id).toBe(approvedId); expect(v.you).toBe('Paul'); expect(s.includes(JOINER)).toBe(false)
  }, 200_000)
})

describe.skipIf(!ready).sequential('E2: two members, then the scenario\'s first member (Paul) erased; the joiner reopens cold', () => {
  beforeAll(async () => {
    await together('E2.', env['TEAM_STORE_2']!)
    await as('paul'); views['paul'] = (await teamApi.giveView(SID, `Paul's view: ${qLabel} is lower than the model holds.`, [{ quantity, typed: '9' }], version)).contribution
    await as('joiner'); views['joiner'] = (await teamApi.giveView(SID, `${JOINER}'s view: ${qLabel} is higher than the model holds.`, [{ quantity, typed: '15' }], version)).contribution
    await as('paul'); await teamApi.reveal(SID)
    commitment = (await teamApi.addCommitment(SID, { action: 'Raise more and hire two engineers.', owner: paulId, expect: 'Runway stays above 18 months.', reconsider: 'Runway falls below 12 months.', keeps: [] })).commitment
  }, 240_000)
  afterAll(async () => { await stop(); setTeamFetch(null); console.log(`TEAM-JOURNEY RESULTS ${JSON.stringify(results)}`) }, 60_000)

  it('E2 Paul erases his data: "Paul" leaves every row the joiner reads; the approved version (his) stays', async () => {
    const r = await nodeFetch(`${BASE}/api/me/delete`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: jar['paul']! }, body: JSON.stringify({ confirm: 'delete my data' }) })
    writes.push({ who: 'paul', method: 'POST', path: '/api/me/delete', body: { confirm: 'delete my data' }, status: r.status, response: await r.json().catch(() => null) })
    const v = await as('joiner')
    const summary = await get(`/api/scenarios/${SID}/summary`), invites = await get(`/api/scenarios/${SID}/invites`)
    // "Paul" as a whole word: where it is still said, by the row it sits in.
    const hits = (t: string) => [...t.matchAll(/.{0,70}\bPaul\b.{0,50}/g)].map((m) => m[0]).slice(0, 8)
    note('E2.erase', { status: r.status, commitment, version: { id: v.version?.id, n: v.version?.n }, paul_in_view: hits(JSON.stringify(v)), paul_in_summary: hits(summary.text), paul_in_invites: hits(invites.text), former_member_in_view: JSON.stringify(v).includes('a former member') })
    expect(r.status).toBe(200)
    expect(v.version?.id).toBe(approvedId)
    expect(hits(JSON.stringify(v)), 'Paul named in the View the joiner reads').toEqual([])
    expect(hits(summary.text), 'Paul named in the Summary').toEqual([])
  })
  it('E2 cold: server restarted, the joiner reopens: the approved version, her own name, a former member in his', async () => {
    const dir = env['TEAM_STORE_2']!; await stop(); await start(dir)
    const v = await as('joiner'), s = JSON.stringify(v)
    note('E2.cold', { version: v.version?.id, you: v.you, presence: L(v).team_presence ?? null, paul_named: /\bPaul\b/.test(s), commitment_by: ((L(v.collab).commitments ?? []) as Loose[]).map((c) => ({ by: c.by, owner: c.owner })), shared_by: ((L(v.collab).shared ?? []) as Loose[]).map((x) => x.by) })
    expect(v.version?.id).toBe(approvedId); expect(v.you).toBe(JOINER); expect(/\bPaul\b/.test(s)).toBe(false)
  }, 200_000)
})
