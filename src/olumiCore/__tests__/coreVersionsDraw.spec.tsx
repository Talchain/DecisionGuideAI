/**
 * A past version drawn on the canvas from the version history (DL, 4 Nov; olumi-core API v1.10 `view?at=n`): the View store reads that
 * version's own View, every read after it too, until the person goes back to the latest. A core that answers with another version is
 * never drawn as the one asked for, and nothing is written while a past version is on screen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))

import golden from '../../olumiView/golden/european.view.json'
import { VERSION_NOT_SERVED, type View } from '../../olumiView/client'
import { useViewStore } from '../../olumiView/store'
import { PAST_HELD, ViewComposer, useAnswersAsks, useViewChat } from '../../olumiView/ViewChat'
import { useGuidanceStore } from '../../canvas/stores/guidanceStore'
import { setTeamFetch } from '../team/api'
import { CoreVersions } from '../versions'
import { runWrite, resetWrites, TEAM_PAST_HELD } from '../team/writes'
import { TeamTab } from '../team/TeamTab'
import { useMe } from '../me'

const SID = 's_0123456789ab'
const base = golden as unknown as View
const withVersion = (n: number): View => ({ ...base, id: SID, version: { ...base.version!, id: 40 + n, n, label: `version ${n}` } })
const VERSIONS = { versions: [
  { id: 41, n: 1, at: '2026-11-04T08:00:00Z', by: 'Ada', proposal: 1, base: null, changes: { added: [], changed: [], removed: [], top: [] }, facts: [], form: {} },
  { id: 42, n: 2, at: '2026-11-04T09:00:00Z', by: 'Bea', proposal: 3, base: 41, changes: { added: [], changed: [], removed: [], top: [] }, facts: [], form: {} },
] }
const COMPARED = { versions: [{ n: 1, at: '2026-11-04T08:00:00Z', proposedBy: 'Olumi', briefBy: 'Ada', approvedBy: 'Ada' }], changes: [], results: [] }

let reads: string[] = [], posts: string[] = []
/** A scripted core: `/view?at=n` answers version n's View (or, `ignoresAt`, the latest, as a core older than API v1.10 does). */
const core = (ignoresAt = false) => setTeamFetch((async (u: unknown, init?: RequestInit) => {
  const p = String(u)
  if ((init?.method ?? 'GET') !== 'GET') { posts.push(p); return new Response('{}', { status: 201 }) }
  reads.push(p)
  if (p.includes('/view')) { const at = new URL(p, 'http://x').searchParams.get('at'); return new Response(JSON.stringify(at && !ignoresAt ? withVersion(Number(at)) : withVersion(2)), { status: 200 }) }
  return new Response(JSON.stringify(p.includes('/compare') ? COMPARED : VERSIONS), { status: 200 })
}) as unknown as typeof fetch)

beforeEach(() => {
  reads = []; posts = []
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  core()
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view: withVersion(2), status: 'ready', error: null, stale: false, at: null })
})
afterEach(() => { cleanup(); setTeamFetch(null); vi.unstubAllEnvs(); resetWrites(); useMe.setState({ me: null, status: 'none' }); useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null }) })

const drawOne = async () => {
  render(<CoreVersions />)
  fireEvent.click(await screen.findByTestId('core-version-open-1'))
  fireEvent.click(await screen.findByTestId('core-version-1-draw'))
}

describe('a past version on the canvas, by the person\'s choice', () => {
  it('Draw reads that version\'s own View and the store holds it; Back reads the latest again', async () => {
    await drawOne()
    await waitFor(() => expect(useViewStore.getState().view?.version?.n).toBe(1))
    expect(reads).toContain(`/api/scenarios/${SID}/view?schema=3&at=1`)
    expect(useViewStore.getState().at).toBe(1)
    await waitFor(() => expect(screen.getAllByTestId('core-version-row').find((r) => r.getAttribute('aria-current') === 'true')?.getAttribute('data-version')).toBe('1'))
    expect(screen.queryByTestId('core-version-1-draw')).toBeNull() // the version drawn offers no Draw
    expect(screen.getByTestId('core-versions-back').parentElement?.textContent).toBe('Back to the latest') // no version sentence the page composes (DL 7 Nov)
    fireEvent.click(screen.getByTestId('core-versions-back'))
    await waitFor(() => expect(useViewStore.getState().view?.version?.n).toBe(2))
    expect(useViewStore.getState().at).toBeNull()
    expect(reads.filter((p) => p.includes('/view')).at(-1)).toBe(`/api/scenarios/${SID}/view?schema=3`)
    expect(posts).toEqual([])
  })
  it('Draw on the latest version is the way back: the latest View, not that version as a past one', async () => {
    await drawOne()
    await waitFor(() => expect(useViewStore.getState().at).toBe(1))
    fireEvent.click(screen.getByTestId('core-version-open-2'))
    fireEvent.click(await screen.findByTestId('core-version-2-draw'))
    await waitFor(() => expect(useViewStore.getState().at).toBeNull())
    expect(reads.filter((p) => p.includes('/view')).at(-1)).toBe(`/api/scenarios/${SID}/view?schema=3`)
  })
  it('another scenario opens on its latest version', async () => {
    useViewStore.setState({ view: withVersion(1), at: 1 })
    await act(async () => { await useViewStore.getState().use('00000000-0000-4000-8000-0123456789cd') })
    expect(useViewStore.getState().at).toBeNull()
    expect(reads.filter((p) => p.includes('/view')).at(-1)).toBe('/api/scenarios/s_0123456789cd/view?schema=3')
  })
  it('a read after Draw (a badge opened, a refresh) stays on that version', async () => {
    await drawOne()
    await waitFor(() => expect(useViewStore.getState().at).toBe(1))
    await act(async () => { await useViewStore.getState().refresh() })
    expect(reads.filter((p) => p.includes('/view')).at(-1)).toBe(`/api/scenarios/${SID}/view?schema=3&at=1`)
    expect(useViewStore.getState().view?.version?.n).toBe(1)
  })
  it('fails closed: a core that answers with another version is never drawn as the one asked for', async () => {
    core(true)
    const before = useViewStore.getState().view
    await drawOne()
    expect((await screen.findByTestId('core-version-1-draw-error')).textContent).toBe(VERSION_NOT_SERVED)
    expect(useViewStore.getState().view).toBe(before)
    expect(useViewStore.getState().at).toBeNull()
    expect(useViewStore.getState().error).toBeNull()
  })
})

describe('nothing is written while a past version is drawn', () => {
  function Asks() { useAnswersAsks(); return null }
  it('the message box is held and says why, with the way back', () => {
    useViewStore.setState({ view: withVersion(1), at: 1 })
    render(<ViewComposer analysisAction={{ label: 'Run analysis', canRun: true, isRunning: false, onRun: () => {} } as never} />)
    expect((document.querySelector('#view-chat-text') as HTMLTextAreaElement).disabled).toBe(true)
    expect((screen.getByTestId('view-composer-analyse') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('view-composer-past').textContent).toBe(`${PAST_HELD}Back to the latest`) // no version sentence the page composes (DL 7 Nov)
    expect(screen.getByTestId('view-composer-back')).toBeTruthy()
  })
  it('an ask from the canvas is not sent: its words wait in the message box, and it says why', async () => {
    useViewStore.setState({ view: withVersion(1), at: 1 })
    render(<Asks />)
    await act(async () => { useGuidanceStore.getState()._sendMessage?.('Why does per specialist matter?') })
    await waitFor(() => expect(useViewChat.getState().said).toBe(PAST_HELD))
    expect(posts).toEqual([])
    expect(useViewChat.getState().text).toBe('Why does per specialist matter?')
  })
})

describe('R1 review 1: the Team tab writes nothing to the live scenario while a past version is drawn', () => {
  it('the shared Team writer refuses a view, evidence, commitment or outcome, and sends nothing; an invitation is not version-bound', async () => {
    useViewStore.setState({ view: withVersion(1), at: 1 })
    let sent = 0
    for (const key of [`${SID}:view`, `${SID}:evidence`, `${SID}:commitment`, `${SID}:outcome:9`]) {
      await expect(runWrite(key, { op: false }, null, async () => { sent += 1 })).rejects.toThrow(TEAM_PAST_HELD)
    }
    expect(sent).toBe(0)
    await runWrite(`${SID}:invite`, { op: false, anyVersion: true }, null, async () => { sent += 1 })
    expect(sent).toBe(1)
  })
  it('its forms are held and say why, with the way back', () => {
    useViewStore.setState({ view: withVersion(1), at: 1 })
    useMe.setState({ me: { id: base.you_id, name: base.you }, status: 'ready' })
    render(<TeamTab />)
    // Held by its fieldset, as a browser holds it (`:disabled`), the view box and every Team form button with it; invitations stay open.
    expect(screen.getByTestId('team-view-text').matches(':disabled')).toBe(true)
    expect(screen.getByTestId('team-commitment-open').matches(':disabled')).toBe(true)
    expect(screen.getByTestId('team-invite-name').matches(':disabled')).toBe(false)
    expect(screen.getByTestId('team-past').textContent).toBe(`${TEAM_PAST_HELD}Back to the latest`) // no version sentence the page composes (DL 7 Nov)
    fireEvent.click(screen.getByTestId('team-past-back'))
    expect(useViewStore.getState().at).toBe(1) // the read is on its way; the back goes through the store's look
  })
})
