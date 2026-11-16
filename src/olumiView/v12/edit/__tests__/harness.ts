/** Shared by the V12 hand-editing specs: a View from a real fixture with a risk and links that carry core's size edits, and a stub for core. */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../../../client'
import { useViewStore } from '../../../store'
import { setTeamFetch } from '../../../../olumiCore/team/api'
import { resetWrites } from '../../../../olumiCore/team/writes'
import { useMe } from '../../../../olumiCore/me'
import { useModelNotice } from '../../../notice'

export const SID = 's_0123456789ab'
const fixture: View = { ...JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'european-22cards.view3.json'), 'utf8')), id: SID }

export const RISK_EDIT = { prompt: 'How likely is it?', ask: 'A percentage, or "1 in 5".', route: 'size' as const, record: 'slow_ramp', note: 'Your figures let the calculation draw this risk.',
  fields: [{ key: 'chance' as const, prompt: 'How likely is it?', ask: 'A percentage.' }, { key: 'change' as const, prompt: 'By how much does it change the figure?', ask: 'A change in customers.' }] }
export const LINK_SIZE = { record: 'i_speed', text: 'no strength yet', title: 'If speed goes up by 1, by how much does the figure change?',
  edit: { prompt: 'If speed goes up by 1, by how much?', ask: 'Your best figure.', route: 'size' as const, record: 'i_speed', note: 'Your figure turns this link into a calculation.', fields: [{ key: 'typed' as const, prompt: 'If speed goes up by 1, by how much?', ask: 'Your best figure.' }] } }

/** The fixture's View, plus a risk card with a size edit and its first link carrying a size edit and a removal. */
export function sizedView(over: Partial<View> = {}): View {
  const m = fixture.model!
  const risk = { ...m.cards.find((c) => c.family === 'quantity')!, id: 'slow_ramp', family: 'risk', heading: 'Slow ramp', figure: { text: 'no size yet', title: 'No one has sized it', edit: RISK_EDIT } }
  const links = m.links.map((l, i) => (i === 1 ? { ...l, size: LINK_SIZE, remove: { record: 'i_speed', part: null } } : l))
  return { ...fixture, ...over, model: { ...m, cards: [...m.cards, risk], links } } as View
}
export const approved = (): View => sizedView()
export const BASE = fixture.model!.edit_base!

export type Call = { method: string; path: string; body: unknown }
export type Stub = { calls: Call[]; posts: () => Call[]; answer: { status: number; body: unknown } }

/** Installs the page's stores and a stub for core. `answer` is what every POST answers. */
export function install(view: View = approved()): Stub {
  const stub: Stub = { calls: [], posts: () => stub.calls.filter((c) => c.method === 'POST'), answer: { status: 201, body: { version: 9, n: 3, receipt: 'x:9', record: 'new_card' } } }
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET', p = String(u)
    stub.calls.push({ method, path: p, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (method === 'GET' && p === '/api/me') return new Response(JSON.stringify({ me: { id: view.you_id, name: view.you } }), { status: 200 })
    if (method === 'GET') return new Response(JSON.stringify(useViewStore.getState().view ?? view), { status: 200 })
    return new Response(JSON.stringify(stub.answer.body), { status: stub.answer.status })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view, status: 'ready', error: null, stale: false, at: null })
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' } as never)
  return stub
}
export function uninstall(): void {
  setTeamFetch(null); resetWrites(); useModelNotice.setState({ notice: null })
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null }); useMe.setState({ me: null } as never)
}
