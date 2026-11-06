/**
 * "Delete my data" and the notices on the olumi-core lane (core batch R15: `GET /terms`, `GET /privacy`, `POST /api/me/delete`).
 *
 * The account menu links to the terms and the privacy notice, and offers "Delete my data". Its dialog first asks core what deleting
 * would do (`{"confirm":null}`) and shows core's sentences verbatim, one per line, in core's order: the UI formats no value and never
 * rebuilds a sentence from the counts (DL 5 Nov). Only then is the destructive button offered; it sends exactly
 * `{"confirm":"delete my data"}`. Cancel and Escape close it with nothing more sent. A refusal shows core's own message.
 *
 * Every row binds by identity: the exact button label, the exact request bodies on the wire and core's exact sentences.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../../lib/supabase', () => ({ supabase: {}, getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'guest', email: 'guest@poc' }, profile: null, signOut: vi.fn(async () => ({ error: null })) }),
}))

import { UserAvatarMenu } from '../../components/layout/UserAvatarMenu'
import { useMe } from '../me'
import { SignedOut } from '../SignedOut'
import { setPagePerson, setTeamFetch } from '../team/api'
import { useViewStore } from '../../olumiView/store'

/** Core's preview sentences, as core's eraseWords writes them (curly quotes and all), in core's order. */
const WORDS = [
  '“Hiring plan”: deleted completely, because only you are in it.',
  '“Pricing review” (shared): you leave it; your 2 views are removed; your 1 proposed change stays for the others, shown as “a former member”.',
  'Your sign-in link stops working.',
]
/** Core's own refusal for a confirm it does not accept (app.ts, POST /api/me/delete). */
const CORE_REFUSAL = 'send {"confirm":"delete my data"} to delete your data, or {"confirm":null} to see what it would remove'

/** Every request the page made, in order, with the raw body it sent. */
let wire: { method: string; path: string; body: string | undefined }[] = []
const deleteBodies = () => wire.filter((r) => r.method === 'POST' && r.path === '/api/me/delete').map((r) => r.body)

/**
 * Core as this browser sees it, Ada signed in. `confirm` answers the real delete: 'ok' (200, signs out) or 'refuse' (400, core's words).
 * `preview` answers the preview: 'ok' (200 with WORDS) or 'signed-out' (401, core's words).
 */
const core = ({ confirm = 'ok', preview = 'ok' }: { confirm?: 'ok' | 'refuse'; preview?: 'ok' | 'signed-out' } = {}) => {
  let signedIn = true
  setTeamFetch((async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input), method = init?.method ?? 'GET'
    const body = typeof init?.body === 'string' ? init.body : undefined
    wire.push({ method, path, body })
    if (path === '/api/me') return new Response(JSON.stringify({ me: signedIn ? { id: 'p_1', name: 'Ada' } : null }), { status: 200 })
    if (method === 'POST' && path === '/api/me/delete') {
      const c = (JSON.parse(body ?? '{}') as { confirm?: unknown }).confirm
      if (c === null) {
        if (preview === 'signed-out') return new Response(JSON.stringify({ error: 'open your private link first' }), { status: 401 })
        return new Response(JSON.stringify({ preview: true, scenarios: [], sign_in: 1, words: WORDS }), { status: 200 })
      }
      if (c === 'delete my data' && confirm === 'ok') {
        signedIn = false
        return new Response(JSON.stringify({ deleted: true, removed: 9, anonymised: 1, scenarios: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({ error: CORE_REFUSAL }), { status: 400 })
    }
    return new Response('{}', { status: 404 })
  }) as typeof fetch)
}

/** The lane's canvas route with the menu in its top bar, and the signed-out route. */
const lanePage = () => render(
  <MemoryRouter initialEntries={['/canvas']}>
    <Routes>
      <Route path="/canvas" element={<div data-testid="canvas-page"><UserAvatarMenu size="compact" /></div>} />
      <Route path="/signed-out" element={<SignedOut />} />
    </Routes>
  </MemoryRouter>,
)

/** Signed in as Ada, on the canvas, with the dialog open and core's preview answered. */
async function openDialog(opts?: Parameters<typeof core>[0]) {
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  core(opts)
  await act(async () => { await useMe.getState().load() })
  wire = []
  lanePage()
  fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
  await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Delete my data' })) })
  return screen.getByRole('dialog', { name: 'Delete your data?' })
}

afterEach(() => {
  cleanup(); vi.unstubAllEnvs(); useMe.setState({ me: null, status: 'none' }); setTeamFetch(null); setPagePerson(null); wire = []
  useViewStore.setState(useViewStore.getInitialState(), true)
})

describe('the notices on the olumi-core lane', () => {
  it('the account menu links to the terms and the privacy notice, each in a new tab', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    useMe.setState({ me: { id: 'p_1', name: 'Ada' }, status: 'ready' })
    lanePage()
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    for (const [name, href] of [['Terms', '/terms'], ['Privacy', '/privacy']] as const) {
      const link = screen.getByRole('menuitem', { name })
      expect(link.tagName).toBe('A')
      expect(link.getAttribute('href')).toBe(href)
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    }
  })

  it('the signed-out screen links to them too', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    render(<MemoryRouter initialEntries={['/signed-out']}><Routes><Route path="/signed-out" element={<SignedOut />} /></Routes></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms')
    expect(screen.getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('/privacy')
  })
})

describe('Delete my data on the olumi-core lane', () => {
  it('opening it asks core for the preview only, and shows core\'s sentences verbatim, one per line, in core\'s order', async () => {
    const dialog = await openDialog()
    expect(wire.map((r) => `${r.method} ${r.path}`)).toEqual(['GET /api/me', 'POST /api/me/delete'])
    expect(deleteBodies()).toEqual(['{"confirm":null}'])
    expect(within(dialog).getAllByRole('listitem').map((li) => li.textContent)).toEqual(WORDS)
    expect(within(dialog).getByRole('button', { name: 'Delete my data' })).toBeTruthy()
  })

  it('the destructive button sends exactly {"confirm":"delete my data"}, then lands signed out with nothing of Ada\'s kept', async () => {
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: 's_0123456789ab', status: 'ready' } as never)
    const dialog = await openDialog()
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Delete my data' })) })
    expect(deleteBodies()).toEqual(['{"confirm":null}', '{"confirm":"delete my data"}'])
    expect(wire.map((r) => `${r.method} ${r.path}`)).toEqual(['GET /api/me', 'POST /api/me/delete', 'GET /api/me', 'POST /api/me/delete'])
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByTestId('canvas-page')).toBeNull()
    expect(screen.getByTestId('olumi-core-signed-out').textContent).toBe('Your data is deleted' + 'Your private link no longer works. To use Olumi again, ask the person who invited you for a new link.' + 'Terms' + 'Privacy')
    expect(useMe.getState().me).toBeNull()
    expect(useViewStore.getState().sid).toBeNull()
  })

  it('Cancel after the preview closes it with nothing more sent, and gives the focus back to the account menu', async () => {
    const dialog = await openDialog()
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' })) })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(deleteBodies()).toEqual(['{"confirm":null}'])
    expect(wire).toHaveLength(2)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Account menu' }))
    expect(screen.getByTestId('canvas-page')).toBeTruthy()
    expect(useMe.getState().me).toEqual({ id: 'p_1', name: 'Ada' })
  })

  it('Escape cancels the same way: nothing more sent', async () => {
    const dialog = await openDialog()
    await act(async () => { fireEvent.keyDown(within(dialog).getByRole('button', { name: 'Cancel' }), { key: 'Escape' }) })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(deleteBodies()).toEqual(['{"confirm":null}'])
  })

  it('a refused delete shows core\'s own message, and Ada stays signed in on the canvas', async () => {
    const dialog = await openDialog({ confirm: 'refuse' })
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Delete my data' })) })
    expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toBe(CORE_REFUSAL)
    expect(screen.getByTestId('canvas-page')).toBeTruthy()
    expect(useMe.getState().me).toEqual({ id: 'p_1', name: 'Ada' })
  })

  it('a preview core refuses shows core\'s message and offers no destructive button: nothing can be deleted unread', async () => {
    const dialog = await openDialog({ preview: 'signed-out' })
    expect(within(dialog).getByRole('alert').textContent).toBe('open your private link first')
    expect(within(dialog).queryByRole('button', { name: 'Delete my data' })).toBeNull()
    expect(deleteBodies()).toEqual(['{"confirm":null}'])
  })

  it('keyboard: the focus starts on Cancel and Tab and Shift+Tab stay inside the dialog', async () => {
    const dialog = await openDialog()
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' })
    const destroy = within(dialog).getByRole('button', { name: 'Delete my data' })
    expect(document.activeElement).toBe(cancel)
    destroy.focus()
    fireEvent.keyDown(destroy, { key: 'Tab' })
    expect(document.activeElement).toBe(cancel)
    fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(destroy)
  })
})
