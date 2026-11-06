/**
 * The olumi-core lane has no accounts behind it (the Supabase address is dead on purpose), so the account chrome that leads there
 * must not be offered: a person is who their private link says. What core does serve is Sign out (`POST /api/me/signout`: this
 * browser only), which lands on the signed-out screen (DL 4 Nov), the terms and the privacy notice, and Delete my data (core batch R15;
 * its own rows are in deleteMyData.spec.tsx). Off the lane nothing changes.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
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

/** Core as this browser sees it: Ada's link signed in until she signs out (`fail`: the sign-out answers 500). */
let asked: string[] = []
const core = (fail = false) => {
  let signedIn = true
  setTeamFetch((async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input), method = init?.method ?? 'GET'
    asked.push(`${method} ${path}`)
    if (path === '/api/me') return new Response(JSON.stringify({ me: signedIn ? { id: 'p_1', name: 'Ada' } : null }), { status: 200 })
    if (method === 'POST' && path === '/api/me/signout') {
      if (fail) return new Response(JSON.stringify({ error: 'Olumi could not do that this time.' }), { status: 500 })
      signedIn = false
      return new Response(JSON.stringify({ signedOut: true }), { status: 200 })
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

afterEach(() => { cleanup(); vi.unstubAllEnvs(); useMe.setState({ me: null, status: 'none' }); setTeamFetch(null); setPagePerson(null); asked = [] })

describe('the account menu on the olumi-core lane: what core serves, and nothing else', () => {
  it('says whose private link this page was opened with, and offers only what core serves: nothing that cannot work', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    useMe.setState({ me: { id: 'p_1', name: 'Ada' }, status: 'ready' })
    lanePage()
    const mark = screen.getByTestId('olumi-core-person-mark')
    expect(mark.getAttribute('title')).toBe('You are using Olumi through Ada’s private link')
    expect(mark.textContent).toBe('A')
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Terms', 'Privacy', 'Sign out', 'Delete my data'])
    for (const gone of [/Profile settings/, /My scenarios/, /Sign in/, /Delete account/]) expect(screen.queryByText(gone)).toBeNull()
  })

  it('Sign out asks core to sign this browser out, then lands on the signed-out screen with nothing of Ada\'s kept', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    core()
    await act(async () => { await useMe.getState().load() })
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: 's_0123456789ab', status: 'ready' } as never)
    lanePage()
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' })) })
    expect(screen.getByTestId('olumi-core-signed-out').textContent).toBe('You’re signed out' + 'Your private link opens it again.' + 'Terms' + 'Privacy')
    expect(screen.queryByTestId('canvas-page')).toBeNull()
    expect(useMe.getState().me).toBeNull()
    expect(useViewStore.getState().sid).toBeNull()
  })

  it('MUST NOT CHANGE: it signs out this browser only. Core is asked nothing else, no link is revoked, no other member is touched', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    core()
    await act(async () => { await useMe.getState().load() })
    asked = []
    lanePage()
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' })) })
    // The page's own same-person check before any write (api.ts stillThisPerson), then the one sign-out.
    expect(asked).toEqual(['GET /api/me', 'POST /api/me/signout'])
  })

  it('a sign-out that did not go through says so, in core\'s words, and leaves Ada where she was, still signed in', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    core(true)
    await act(async () => { await useMe.getState().load() })
    lanePage()
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' })) })
    expect(screen.getByTestId('olumi-core-sign-out-error').textContent).toBe('Olumi could not do that this time.')
    expect(screen.getByTestId('canvas-page')).toBeTruthy()
    expect(useMe.getState().me).toEqual({ id: 'p_1', name: 'Ada' })
  })

  it('CONTROL: off the lane there is no signed-out screen; its address goes home', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    render(<MemoryRouter initialEntries={['/signed-out']}><Routes><Route path="/" element={<div data-testid="home" />} /><Route path="/signed-out" element={<SignedOut />} /></Routes></MemoryRouter>)
    expect(screen.getByTestId('home')).toBeTruthy()
    expect(screen.queryByTestId('olumi-core-signed-out')).toBeNull()
  })

  it('CONTROL: off the lane the account menu is the menu it was (profile, scenarios, sign out)', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    render(<MemoryRouter><UserAvatarMenu /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(screen.getByRole('menuitem', { name: /Profile settings/ })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /My scenarios/ })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /Sign out/ })).toBeTruthy()
    expect(screen.queryByTestId('olumi-core-person-mark')).toBeNull()
  })
})
