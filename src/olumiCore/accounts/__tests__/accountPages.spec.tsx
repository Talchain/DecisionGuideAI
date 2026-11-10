/**
 * The PoC account pages on the olumi-core lane (src/olumiCore/accounts/), against core's own routes as core answers them
 * (`/api/account/*`, `/api/org/*`, core wip/accounts): what each page sends, what it shows from core's answer, and where it goes.
 * The fake core below answers in core's exact shapes; the real routes' rows are core's `src/server/__tests__/accounts.test.ts`.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { setPagePerson, setTeamFetch } from '../../team/api'
import { nav } from '../api'
import { useCanvasStore } from '../../../canvas/store'
import SignInPage from '../SignInPage'
import SignUpPage from '../SignUpPage'
import JoinPage from '../JoinPage'
import MyScenariosPage from '../MyScenariosPage'
import OrganisationPage from '../OrganisationPage'
import AccountPage from '../AccountPage'

type Reply = { status?: number; body: unknown }
type Asked = { method: string; path: string; body: unknown }
let asked: Asked[] = []
/** Core as this browser sees it: `answer` replies to each request, anything else is core's 404. */
const core = (answer: (method: string, path: string, body: unknown) => Reply | undefined) => setTeamFetch((async (input: RequestInfo | URL, init?: RequestInit) => {
  const path = String(input), method = init?.method ?? 'GET', body = init?.body ? JSON.parse(String(init.body)) : undefined
  asked.push({ method, path, body })
  const r = answer(method, path, body) ?? { status: 404, body: { error: 'not found' } }
  return new Response(JSON.stringify(r.body), { status: r.status ?? 200 })
}) as typeof fetch)
const posts = () => asked.filter((a) => a.method === 'POST')

const ANA = { id: '7', name: 'Ana' }, BO = { id: '9', name: 'Bo' }
const OWNER = { email: 'ana@example.com', org: { id: 'o_0123456789ab', name: 'Northwind', role: 'owner' } }
const SCENARIOS = [
  { id: 's_a00000000002', title: 'Office move', label: 'Office move', open: '/#/scenario/00000000-0000-4000-8000-a00000000002', version: 3, last_activity: '2026-11-07T14:02:00.000Z', your_last: '2026-11-07T13:00:00.000Z', members: [ANA, BO] },
  { id: 's_a00000000001', title: 'Hiring plan', label: 'Hiring plan', open: '/#/scenario/00000000-0000-4000-8000-a00000000001', version: null, last_activity: '2026-11-06T09:00:00.000Z', your_last: null, members: [ANA] },
]
const at = (path: string, page: JSX.Element, route = path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path={route} element={page} />
      <Route path="/signin" element={<div data-testid="at-signin" />} />
      <Route path="/canvas" element={<div data-testid="at-canvas" />} />
      <Route path="/scenario/:id" element={<div data-testid="at-scenario" />} />
    </Routes>
  </MemoryRouter>,
)
/** CLAUDE.md §3–4: Olumi proposes and the person decides; no page calls Olumi a decision tool or ranks anything for them. */
const NEVER = /\b(best|winner|recommend\w*|decision tool)\b/i

afterEach(() => { cleanup(); setTeamFetch(null); setPagePerson(null); asked = []; vi.restoreAllMocks(); localStorage.clear() })

describe('sign in', () => {
  it('sends exactly the email and password, shows core\'s refusal in its own words, and on success loads home afresh', async () => {
    let right = false
    core((m, p) => p === '/api/me' ? { body: { me: null } }
      : m === 'POST' && p === '/api/account/signin' ? (right ? { body: { me: ANA, account: OWNER } } : { status: 401, body: { error: 'That email and password do not match an Olumi account.' } }) : undefined)
    const land = vi.spyOn(nav, 'landSignedIn').mockImplementation(() => undefined)
    at('/signin', <SignInPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'not-the-one-1' } })
    await act(async () => { fireEvent.click(screen.getByTestId('account-signin-go')) })
    expect((await screen.findByTestId('account-signin-error')).textContent).toBe('That email and password do not match an Olumi account.')
    expect(land).not.toHaveBeenCalled()
    expect(posts()).toEqual([{ method: 'POST', path: '/api/account/signin', body: { email: 'ana@example.com', password: 'not-the-one-1' } }])
    right = true
    await act(async () => { fireEvent.click(screen.getByTestId('account-signin-go')) })
    await waitFor(() => expect(land).toHaveBeenCalledTimes(1))
    expect(document.body.textContent).not.toMatch(NEVER)
  })
})

describe('sign up', () => {
  it('a person signed in by a private link adds an email and password to that same person (attach), their name filled in', async () => {
    core((m, p) => p === '/api/me' ? { body: { me: { id: '3', name: 'Sam' }, account: null } }
      : m === 'POST' && p === '/api/account/signup' ? { status: 201, body: { me: { id: '3', name: 'Sam' }, account: OWNER } } : undefined)
    const land = vi.spyOn(nav, 'landSignedIn').mockImplementation(() => undefined)
    at('/signup', <SignUpPage />)
    expect(await screen.findByText(/This adds an email and password to Sam/)).toBeTruthy()
    await waitFor(() => expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Sam'))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sam@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'sam-password-1' } })
    await act(async () => { fireEvent.click(screen.getByTestId('account-signup-go')) })
    await waitFor(() => expect(land).toHaveBeenCalledTimes(1))
    expect(posts().at(-1)).toEqual({ method: 'POST', path: '/api/account/signup', body: { name: 'Sam', email: 'sam@example.com', password: 'sam-password-1', attach: true } })
    expect(document.body.textContent).not.toMatch(NEVER)
  })
})

describe('My scenarios (home)', () => {
  it('lists exactly the scenarios core lists, in its order, each opening its own scenario; New scenario starts one from a brief', async () => {
    core((_m, p) => p === '/api/me' ? { body: { me: ANA, account: OWNER } } : p === '/api/account/scenarios' ? { body: { you_id: '7', scenarios: SCENARIOS } } : undefined)
    at('/', <MyScenariosPage />)
    await screen.findByTestId('my-scenarios')
    expect(screen.getAllByRole('listitem').map((li) => li.getAttribute('data-testid'))).toEqual(['my-scenario-s_a00000000002', 'my-scenario-s_a00000000001'])
    const move = screen.getByTestId('my-scenario-s_a00000000002')
    expect(move.textContent).toContain('Version 3')
    expect(move.textContent).toContain('On it: Ana, Bo')
    expect(screen.getByTestId('my-scenario-s_a00000000001').textContent).toContain('No saved model yet')
    expect(screen.getByTestId('my-scenario-open-s_a00000000002').getAttribute('href')).toBe('/scenario/00000000-0000-4000-8000-a00000000002')
    expect(document.body.textContent).not.toMatch(NEVER)
    fireEvent.click(screen.getByTestId('my-scenario-open-s_a00000000002'))
    expect(screen.getByTestId('at-scenario')).toBeTruthy()
  })

  it('New scenario goes to the canvas on a blank brief: the scenario the canvas showed last is forgotten, not reopened', async () => {
    // Measured on a local core: without this, the canvas restored the last scenario opened from this browser.
    const last = '00000000-0000-4000-8000-a00000000002'
    localStorage.setItem('olumi-canvas-current-scenario-id', last)
    useCanvasStore.setState({ currentScenarioId: last })
    core((_m, p) => p === '/api/me' ? { body: { me: ANA, account: OWNER } } : p === '/api/account/scenarios' ? { body: { you_id: '7', scenarios: [] } } : undefined)
    at('/', <MyScenariosPage />)
    expect((await screen.findByTestId('my-scenarios-empty')).textContent).toContain('writing a brief')
    fireEvent.click(screen.getByTestId('my-scenarios-new'))
    expect(screen.getByTestId('at-canvas')).toBeTruthy()
    expect(localStorage.getItem('olumi-canvas-current-scenario-id')).toBeNull()
    expect(useCanvasStore.getState().currentScenarioId).toBeNull()
  })

  it('signed out, home goes to sign in and asks core for no scenario', async () => {
    core((_m, p) => p === '/api/me' ? { body: { me: null } } : undefined)
    at('/', <MyScenariosPage />)
    await screen.findByTestId('at-signin')
    expect(asked.map((a) => a.path)).toEqual(['/api/me'])
  })
})

describe('the organisation', () => {
  const ORG = { org: { id: 'o_0123456789ab', name: 'Northwind' }, you: { id: '7', role: 'owner' }, members: [{ id: '7', name: 'Ana', role: 'owner', joined: '2026-11-07T10:00:00.000Z', email: 'ana@example.com' }, { id: '9', name: 'Bo', role: 'member', joined: '2026-11-07T11:00:00.000Z', email: 'bo@example.com' }] }
  it('an owner makes a one-use link (shown once), and removes a member only after saying they are signed out at once', async () => {
    let members = ORG.members
    core((m, p) => p === '/api/me' ? { body: { me: ANA, account: OWNER } } : p === '/api/org' ? { body: { ...ORG, members } } : p === '/api/org/invites' && m === 'GET' ? { body: { you_id: '7', invites: [] } }
      : p === '/api/org/invites' ? { status: 201, body: { id: '41', link: '/#/join/abcdefghijklmnopqrstuvwxyz012345', expires: '2026-11-21T10:00:00.000Z' } }
      : p === '/api/org/members/9/remove' ? (members = members.filter((x) => x.id !== '9'), { body: { removed: '9' } }) : undefined)
    at('/organisation', <OrganisationPage />)
    await screen.findByTestId('org-member-9')
    expect(screen.getByTestId('org-member-9').textContent).toContain('bo@example.com')
    await act(async () => { fireEvent.click(screen.getByTestId('org-invite-go')) })
    expect((await screen.findByTestId('org-invite-link') as HTMLInputElement).value).toBe(`${window.location.origin}/#/join/abcdefghijklmnopqrstuvwxyz012345`)
    fireEvent.click(screen.getByTestId('org-remove-9'))
    expect(screen.getByTestId('org-remove-ask-9').textContent).toContain('Remove Bo? They are signed out at once.')
    expect(posts().map((x) => x.path)).toEqual(['/api/org/invites'])
    await act(async () => { fireEvent.click(screen.getByTestId('org-remove-yes-9')) })
    await waitFor(() => expect(screen.queryByTestId('org-member-9')).toBeNull())
    expect(posts().map((x) => x.path)).toEqual(['/api/org/invites', '/api/org/members/9/remove'])
    expect(document.body.textContent).not.toMatch(NEVER)
  })

  it('a member sees who is in it, with no emails and no invite, role or remove controls', async () => {
    const member = { ...ORG, you: { id: '9', role: 'member' }, members: ORG.members.map(({ email: _e, ...m }) => m) }
    core((_m, p) => p === '/api/me' ? { body: { me: BO, account: { ...OWNER, email: 'bo@example.com', org: { ...OWNER.org, role: 'member' } } } } : p === '/api/org' ? { body: member } : undefined)
    at('/organisation', <OrganisationPage />)
    await screen.findByTestId('org-member-7')
    for (const id of ['org-invite-go', 'org-remove-7', 'org-role-7']) expect(screen.queryByTestId(id)).toBeNull()
    expect(screen.getByText('Only an owner of Northwind can invite or remove people.')).toBeTruthy()
    expect(asked.map((a) => a.path)).not.toContain('/api/org/invites')
  })
})

describe('the account page', () => {
  it('saves a new name and changes the password with the current one, saying how many other browsers were signed out', async () => {
    core((m, p, b) => p === '/api/me' ? { body: { me: ANA, account: OWNER } } : p === '/api/account/name' ? { body: { name: (b as { name: string }).name } }
      : p === '/api/account/password' && m === 'POST' ? { body: { changed: true, signed_out_elsewhere: 2 } } : undefined)
    at('/account', <AccountPage />)
    await waitFor(() => expect((screen.getByTestId('account-name') as HTMLInputElement).value).toBe('Ana'))
    expect(screen.getByTestId('account-email').textContent).toBe('ana@example.com')
    fireEvent.change(screen.getByTestId('account-name'), { target: { value: 'Ana Diaz' } })
    await act(async () => { fireEvent.click(screen.getByTestId('account-name-go')) })
    expect((await screen.findByTestId('account-name-saved')).textContent).toBe('Saved. Your colleagues now see Ana Diaz.')
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'old-password-1' } })
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password-2' } })
    await act(async () => { fireEvent.click(screen.getByTestId('account-password-go')) })
    expect((await screen.findByTestId('account-password-said')).textContent).toBe('Password changed. Signed out of 2 other browsers.')
    expect(posts().map((x) => [x.path, x.body])).toEqual([['/api/account/name', { name: 'Ana Diaz' }], ['/api/account/password', { current: 'old-password-1', next: 'new-password-2' }]])
  })
})

/**
 * A read answered for someone else is dropped, never shown (Codex integrated review, 7 Nov: "MyScenariosPage.tsx:45 accept[s] reads
 * without checking page identity after a cookie switch"). Another tab signed this browser in as Bo after this page was opened for Ana:
 * core then answers Bo's list, naming him (`you_id`, `you.id`), and the page shows nothing of his.
 */
describe('a read for someone else after a cookie switch', () => {
  const SWITCHED = 'This browser is now signed in as someone else, so nothing of theirs is shown here. Reload this page to continue as the person signed in now.'
  it('My scenarios drops a list that names another person, and says why', async () => {
    core((_m, p) => p === '/api/me' ? { body: { me: ANA, account: OWNER } }
      : p === '/api/account/scenarios' ? { body: { you_id: BO.id, scenarios: [{ ...SCENARIOS[1], id: 's_b00000000001', title: 'Bo private', label: 'Bo private', members: [BO] }] } } : undefined)
    at('/', <MyScenariosPage />)
    expect((await screen.findByRole('alert')).textContent).toBe(SWITCHED)
    expect(screen.queryByText('Bo private')).toBeNull()
    expect(screen.queryByTestId('my-scenarios')).toBeNull()
  })

  it('My scenarios drops a list that names no one (it cannot say whose it is)', async () => {
    core((_m, p) => p === '/api/me' ? { body: { me: ANA, account: OWNER } } : p === '/api/account/scenarios' ? { body: { scenarios: SCENARIOS } } : undefined)
    at('/', <MyScenariosPage />)
    expect((await screen.findByRole('alert')).textContent).toBe(SWITCHED)
    expect(screen.queryByTestId('my-scenarios')).toBeNull()
  })

  it('the organisation page drops an organisation read for someone else, and the invitations read too', async () => {
    const theirs = { org: { id: 'o_bbbbbbbbbbbb', name: 'Contoso' }, you: { id: BO.id, role: 'owner' }, members: [{ id: BO.id, name: 'Bo', role: 'owner', joined: '2026-11-07T11:00:00.000Z', email: 'bo@contoso.example' }] }
    core((_m, p) => p === '/api/me' ? { body: { me: ANA, account: OWNER } } : p === '/api/org' ? { body: theirs } : p === '/api/org/invites' ? { body: { you_id: BO.id, invites: [] } } : undefined)
    at('/organisation', <OrganisationPage />)
    expect((await screen.findByRole('alert')).textContent).toBe(SWITCHED)
    expect(screen.queryByText('Contoso')).toBeNull()
    expect(screen.queryByText('bo@contoso.example')).toBeNull()
    expect(screen.queryByTestId('org-members')).toBeNull()
  })

  it('CONTROL: the organisation page shows an organisation read that names this page\'s person, and drops invitations that name another', async () => {
    const ours = { org: { id: 'o_0123456789ab', name: 'Northwind' }, you: { id: ANA.id, role: 'owner' }, members: [{ id: ANA.id, name: 'Ana', role: 'owner', joined: '2026-11-07T10:00:00.000Z', email: 'ana@example.com' }] }
    const late = { id: '41', by: 'Bo', made: '2026-11-07T10:00:00.000Z', expires: '2026-11-21T10:00:00.000Z', status: 'live', joined: null }
    core((_m, p) => p === '/api/me' ? { body: { me: ANA, account: OWNER } } : p === '/api/org' ? { body: ours } : p === '/api/org/invites' ? { body: { you_id: BO.id, invites: [late] } } : undefined)
    at('/organisation', <OrganisationPage />)
    await screen.findByTestId(`org-member-${ANA.id}`)
    expect((await screen.findByRole('alert')).textContent).toBe(SWITCHED)
    expect(screen.queryByTestId('org-invite-41')).toBeNull()
  })
})

describe('My scenarios: archive and restore', () => {
  it('Archive sends exactly that scenario, then lists it apart under Archived with Restore; Restore brings it back; the words say it is theirs only', async () => {
    let away = new Set<string>()
    core((m, p, b) => {
      if (p === '/api/me') return { body: { me: ANA, account: OWNER } }
      if (p === '/api/account/scenarios') return { body: { you_id: '7', scenarios: SCENARIOS.filter((s) => !away.has(s.id)), archived: SCENARIOS.filter((s) => away.has(s.id)) } }
      const hit = /^\/api\/account\/scenarios\/(s_[0-9a-f]+)\/archive$/.exec(p)
      if (m === 'POST' && hit) { const on = (b as { archived: boolean }).archived; away = new Set(on ? [...away, hit[1]!] : [...away].filter((x) => x !== hit[1])); return { body: { id: hit[1], archived: on } } }
      return undefined
    })
    at('/', <MyScenariosPage />)
    await screen.findByTestId('my-scenarios')
    expect(screen.queryByTestId('my-scenarios-archived')).toBeNull()
    fireEvent.click(screen.getByTestId('my-scenario-archive-s_a00000000002'))
    await screen.findByTestId('my-archived-s_a00000000002')
    expect(posts()).toEqual([{ method: 'POST', path: '/api/account/scenarios/s_a00000000002/archive', body: { archived: true } }])
    expect(screen.queryByTestId('my-scenario-s_a00000000002')).toBeNull()
    expect(screen.getByTestId('my-scenario-s_a00000000001')).toBeTruthy()
    const box = screen.getByTestId('my-scenarios-archived')
    expect(box.textContent).toContain('Archived (1)')
    expect(box.textContent).toContain('hidden from your list only. Everyone else on them still sees them')
    expect(document.body.textContent).not.toMatch(NEVER)
    fireEvent.click(screen.getByTestId('my-scenario-restore-s_a00000000002'))
    await screen.findByTestId('my-scenario-s_a00000000002')
    expect(posts().at(-1)).toEqual({ method: 'POST', path: '/api/account/scenarios/s_a00000000002/archive', body: { archived: false } })
    expect(screen.queryByTestId('my-scenarios-archived')).toBeNull()
  })

  it('a list after archiving that names another person is dropped, never shown, and nothing of the earlier list stays on screen', async () => {
    const BOS = [{ ...SCENARIOS[0]!, id: 's_f00000000001', title: 'Bo pricing', label: 'Bo pricing', open: '/#/scenario/00000000-0000-4000-8000-f00000000001', members: [BO] },
      { ...SCENARIOS[1]!, id: 's_f00000000002', title: 'Bo hiring', label: 'Bo hiring', open: '/#/scenario/00000000-0000-4000-8000-f00000000002', members: [BO] }]
    let n = 0
    core((m, p) => {
      if (p === '/api/me') return { body: { me: ANA, account: OWNER } }
      if (p === '/api/account/scenarios') return n++ === 0 ? { body: { you_id: '7', scenarios: SCENARIOS.slice(1), archived: SCENARIOS.slice(0, 1) } } : { body: { you_id: '9', scenarios: BOS.slice(0, 1), archived: BOS.slice(1) } }
      if (m === 'POST') return { body: { id: 's_a00000000001', archived: true } }
      return undefined
    })
    at('/', <MyScenariosPage />)
    await screen.findByTestId('my-scenarios-archived')
    fireEvent.click(screen.getByTestId('my-scenario-archive-s_a00000000001'))
    expect((await screen.findByRole('alert')).textContent).toMatch(/signed in as someone else/)
    expect(document.body.textContent).not.toMatch(/Bo pricing|Bo hiring/)
    expect(screen.queryByTestId('my-scenarios')).toBeNull()
    expect(screen.queryByTestId('my-scenarios-archived')).toBeNull() // the earlier archived list is not left showing either
  })
})

describe('My scenarios: rename (the person\'s own title)', () => {
  it('Rename opens the title to edit, Save sends exactly it, and the list shows the new title; the words say only they see it', async () => {
    const own = new Map<string, string>()
    core((m, p, b) => {
      if (p === '/api/me') return { body: { me: ANA, account: OWNER } }
      if (p === '/api/account/scenarios') return { body: { you_id: '7', scenarios: SCENARIOS.map((s) => own.has(s.id) ? { ...s, title: own.get(s.id)!, label: own.get(s.id)! } : s), archived: [] } }
      const hit = /^\/api\/account\/scenarios\/(s_[0-9a-f]+)\/title$/.exec(p)
      if (m === 'POST' && hit) { const t = (b as { title: string }).title.trim(); if (t) own.set(hit[1]!, t); else own.delete(hit[1]!); return { body: { id: hit[1], title: t || 'Office move' } } }
      return undefined
    })
    at('/', <MyScenariosPage />)
    await screen.findByTestId('my-scenarios')
    fireEvent.click(screen.getByTestId('my-scenario-rename-s_a00000000002'))
    const field = screen.getByLabelText('Your title for this scenario') as HTMLInputElement
    expect(field.value).toBe('Office move')
    expect(screen.getByTestId('my-scenario-title-form-s_a00000000002').textContent).toContain('Only you see this title')
    fireEvent.change(field, { target: { value: 'Move to Leeds' } })
    fireEvent.click(screen.getByTestId('my-scenario-title-save-s_a00000000002'))
    await waitFor(() => expect(screen.getByTestId('my-scenario-open-s_a00000000002').textContent).toBe('Move to Leeds'))
    expect(posts()).toEqual([{ method: 'POST', path: '/api/account/scenarios/s_a00000000002/title', body: { title: 'Move to Leeds' } }])
    expect(screen.queryByTestId('my-scenario-title-form-s_a00000000002')).toBeNull()
    expect(screen.getByTestId('my-scenario-open-s_a00000000001').textContent).toBe('Hiring plan')
    expect(document.body.textContent).not.toMatch(NEVER)
  })

  it('a save refused because this browser is now someone else\'s clears the list, the archived list and the title being edited', async () => {
    setPagePerson('7')
    let switched = false
    core((m, p) => {
      if (p === '/api/me') return { body: switched ? { me: BO, account: null } : { me: ANA, account: OWNER } }
      if (p === '/api/account/scenarios') return { body: switched ? { you_id: '9', scenarios: [], archived: [] } : { you_id: '7', scenarios: SCENARIOS.slice(0, 1), archived: SCENARIOS.slice(1) } }
      if (m === 'POST') return { body: { id: 's_a00000000002', title: 'x' } }
      return undefined
    })
    at('/', <MyScenariosPage />)
    await screen.findByTestId('my-scenarios-archived')
    fireEvent.click(screen.getByTestId('my-scenario-rename-s_a00000000002'))
    fireEvent.change(screen.getByLabelText('Your title for this scenario'), { target: { value: 'Draft title' } })
    switched = true
    fireEvent.click(screen.getByTestId('my-scenario-title-save-s_a00000000002'))
    await screen.findByRole('alert')
    await waitFor(() => expect(screen.queryByTestId('my-scenarios')).toBeNull())
    expect(screen.queryByTestId('my-scenarios-archived')).toBeNull()
    expect(screen.queryByLabelText('Your title for this scenario')).toBeNull()
    expect(document.body.textContent).not.toMatch(/Office move|Hiring plan|Draft title/)
    expect(posts()).toEqual([])
  })

  it('a refused title shows core\'s words, keeps what the person typed, and changes nothing on the list', async () => {
    core((m, p) => {
      if (p === '/api/me') return { body: { me: ANA, account: OWNER } }
      if (p === '/api/account/scenarios') return { body: { you_id: '7', scenarios: SCENARIOS, archived: [] } }
      if (m === 'POST') return { status: 400, body: { error: 'a title is at most 200 characters' } }
      return undefined
    })
    at('/', <MyScenariosPage />)
    await screen.findByTestId('my-scenarios')
    fireEvent.click(screen.getByTestId('my-scenario-rename-s_a00000000002'))
    fireEvent.change(screen.getByLabelText('Your title for this scenario'), { target: { value: 'Too long' } })
    fireEvent.click(screen.getByTestId('my-scenario-title-save-s_a00000000002'))
    expect((await screen.findByRole('alert')).textContent).toBe('a title is at most 200 characters')
    expect((screen.getByLabelText('Your title for this scenario') as HTMLInputElement).value).toBe('Too long')
    expect(screen.getByTestId('my-scenario-open-s_a00000000002').textContent).toBe('Office move')
  })
})

describe('joining an organisation by link', () => {
  const joinCore = (me: unknown) => core((m, p) => {
    if (p === '/api/me') return { body: { me, account: null } }
    if (p === '/api/org/join/tok-1') return { body: { org: { name: 'Northwind' }, by: 'Olu', expires: '2026-11-24T00:00:00.000Z' } }
    if (m === 'POST' && p === '/api/org/join') return { status: 201, body: { me: ANA, account: { email: 'ana@example.com', org: { id: 'o_1', name: 'Northwind', role: 'member' } } } }
    return undefined
  })
  it('someone signed in by a scenario\'s private link joins as that SAME person (attach), keeping their scenarios, and is told so', async () => {
    vi.spyOn(nav, 'landSignedIn').mockImplementation(() => {})
    joinCore(ANA)
    at('/join/tok-1', <JoinPage />, '/join/:token')
    await screen.findByText('Join Northwind on Olumi')
    expect((await screen.findByTestId('account-join-same-person')).textContent).toBe('You are signed in as Ana. Joining adds an email and password to you, and you keep your scenarios.')
    await waitFor(() => expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Ana'))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse battery' } })
    fireEvent.click(screen.getByTestId('account-join-go'))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]).toEqual({ method: 'POST', path: '/api/org/join', body: { token: 'tok-1', name: 'Ana', email: 'ana@example.com', password: 'correct horse battery', attach: true } })
  })
  it('CONTROL: signed out, joining makes a new person (no attach) and says nothing about being signed in', async () => {
    vi.spyOn(nav, 'landSignedIn').mockImplementation(() => {})
    joinCore(null)
    at('/join/tok-1', <JoinPage />, '/join/:token')
    await screen.findByText('Join Northwind on Olumi')
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Bo' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bo@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse battery' } })
    fireEvent.click(screen.getByTestId('account-join-go'))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]!.body).toEqual({ token: 'tok-1', name: 'Bo', email: 'bo@example.com', password: 'correct horse battery' })
    expect(screen.queryByTestId('account-join-same-person')).toBeNull()
  })

  it('PL: a slow identity read cannot create a second person while the organisation invitation is ready', async () => {
    vi.spyOn(nav, 'landSignedIn').mockImplementation(() => {})
    let deliverWho!: (response: Response) => void
    setTeamFetch((async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input), method = init?.method ?? 'GET'
      const body = init?.body ? JSON.parse(String(init.body)) : undefined
      asked.push({ method, path, body })
      if (path === '/api/me') return new Promise<Response>((resolve) => { deliverWho = resolve })
      if (path === '/api/org/join/tok-1') return new Response(JSON.stringify({ org: { name: 'Northwind' }, by: 'Olu' }))
      if (method === 'POST' && path === '/api/org/join') return new Response(JSON.stringify({ me: ANA, account: OWNER }), { status: 201 })
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
    }) as typeof fetch)
    at('/join/tok-1', <JoinPage />, '/join/:token')
    await screen.findByText('Join Northwind on Olumi')
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse battery' } })
    fireEvent.click(screen.getByTestId('account-join-go'))
    expect(posts(), 'identity is still unknown, so joining must wait').toHaveLength(0)
    await act(async () => { deliverWho(new Response(JSON.stringify({ me: ANA, account: null }))) })
    fireEvent.click(screen.getByTestId('account-join-go'))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]!.body).toMatchObject({ attach: true })
  })

  it('PL: while who is signed in is being read, the join button is off and one line says so; nothing is sent', async () => {
    vi.spyOn(nav, 'landSignedIn').mockImplementation(() => {})
    setTeamFetch((async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input), method = init?.method ?? 'GET'
      asked.push({ method, path, body: undefined })
      if (path === '/api/me') return new Promise<Response>(() => {})
      if (path === '/api/org/join/tok-1') return new Response(JSON.stringify({ org: { name: 'Northwind' }, by: 'Olu' }))
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
    }) as typeof fetch)
    at('/join/tok-1', <JoinPage />, '/join/:token')
    await screen.findByText('Join Northwind on Olumi')
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse battery' } })
    expect(screen.getByTestId('account-join-checking').textContent).toBe('Checking who is signed in…')
    expect((screen.getByTestId('account-join-go') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.submit(screen.getByTestId('account-join-go').closest('form')!)
    expect(posts()).toHaveLength(0)
  })
  it('PL: when who is signed in cannot be read, one plain sentence and Try again; no request is sent, and Try again reads it afresh then joins as the same person', async () => {
    vi.spyOn(nav, 'landSignedIn').mockImplementation(() => {})
    let meCalls = 0
    setTeamFetch((async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input), method = init?.method ?? 'GET'
      const body = init?.body ? JSON.parse(String(init.body)) : undefined
      asked.push({ method, path, body })
      if (path === '/api/me') return ++meCalls === 1 ? new Response(JSON.stringify({ error: 'down' }), { status: 500 }) : new Response(JSON.stringify({ me: ANA, account: null }))
      if (path === '/api/org/join/tok-1') return new Response(JSON.stringify({ org: { name: 'Northwind' }, by: 'Olu' }))
      if (method === 'POST' && path === '/api/org/join') return new Response(JSON.stringify({ me: ANA, account: OWNER }), { status: 201 })
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
    }) as typeof fetch)
    at('/join/tok-1', <JoinPage />, '/join/:token')
    await screen.findByText('Join Northwind on Olumi')
    const err = await screen.findByTestId('account-join-who-error')
    expect(err.textContent).toContain('Olumi could not check who is signed in just now, so nothing has been sent. Try again in a moment.')
    expect((screen.getByTestId('account-join-go') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.submit(screen.getByTestId('account-join-go').closest('form')!)
    expect(posts()).toHaveLength(0)
    fireEvent.click(screen.getByTestId('account-join-who-retry'))
    await screen.findByTestId('account-join-same-person')
    await waitFor(() => expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Ana'))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse battery' } })
    fireEvent.click(screen.getByTestId('account-join-go'))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]!.body).toMatchObject({ attach: true })
  })
  it('already has an account: joining sends no attach and says nothing about a scenario link', async () => {
    vi.spyOn(nav, 'landSignedIn').mockImplementation(() => {})
    core((m, p) => p === '/api/me' ? { body: { me: ANA, account: OWNER } }
      : p === '/api/org/join/tok-1' ? { body: { org: { name: 'Northwind' }, by: 'Olu' } }
      : m === 'POST' && p === '/api/org/join' ? { status: 201, body: { me: ANA, account: OWNER } } : undefined)
    at('/join/tok-1', <JoinPage />, '/join/:token')
    await screen.findByText('Join Northwind on Olumi')
    await waitFor(() => expect(screen.queryByTestId('account-join-checking')).toBeNull())
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct horse battery' } })
    fireEvent.click(screen.getByTestId('account-join-go'))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]!.body).toEqual({ token: 'tok-1', name: 'Ana', email: 'ana@example.com', password: 'correct horse battery' })
    expect(screen.queryByTestId('account-join-same-person')).toBeNull()
  })
})
