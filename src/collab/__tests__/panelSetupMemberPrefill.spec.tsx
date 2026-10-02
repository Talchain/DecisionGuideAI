/**
 * D2 S2 / R7 (ACCOUNTS-UI, DL GO; spec output/d2-team-reasoning/SPEC.md): "Ask your team" picks
 * panellists from the colleagues the owner already INVITED.
 *
 * `PanelSetupPage` seeds one participant row per active member that `listScenarioMembers` returns
 * (the owner-only `list_scenario_members` RPC). The display name is the email's local part, and it
 * stays editable. Rows stay removable, and typed names still work.
 *
 * ⚠ WHAT "ACTIVE" MEANS, MEASURED. The SQL filters `revoked_at IS NULL` server-side and returns only
 * `email, created_at` (#2448), so a revoked member NEVER reaches this page. The live harness row R1
 * (supabase/tests/scenario-members) proves that revoked → unlisted. These rows therefore bind to
 * EXACTLY the rows the RPC returns, by email. They never fake a revoked row the wire cannot carry.
 *
 * ⚠ NO ACCOUNT ORACLE. The mint carries `display_name` only. Neither the email nor any user id leaves
 * the page; links stay bearer tokens.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { readFileSync } from 'node:fs'

vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase')>()
  return { ...actual, getSessionIdentity: vi.fn() }
})
const sharing = vi.hoisted(() => ({ listScenarioMembers: vi.fn() }))
vi.mock('../../services/scenarioSharingService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/scenarioSharingService')>()
  return { ...actual, listScenarioMembers: sharing.listScenarioMembers }
})

import { getSessionIdentity } from '../../lib/supabase'
import PanelSetupPage from '../../pages/PanelSetupPage'

const SCENARIO_ID = 'scn-11111111-2222-3333-4444-555555555555'
const MINT_URL = '/bff/collab/rounds'
/** Distinctive emails: an assertion naming them cannot be met by chance. */
const ANA = 'ana.lee-D2S2@example.com'
const BO = 'bo_okafor-D2S2@example.org'

type StubResponse = Pick<Response, 'ok' | 'status' | 'json'>
let fetchMock: Mock<[input: RequestInfo | URL, init?: RequestInit], Promise<StubResponse>>

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={[`/scenario/${SCENARIO_ID}/panel`]}>
      <Routes>
        <Route path="/scenario/:id/panel" element={<PanelSetupPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Every participant input on the page, in order. */
function nameInputs(): HTMLInputElement[] {
  return screen.queryAllByTestId(/^panel-name-(a|b|\d+)$/) as HTMLInputElement[]
}

/** The member emails the prefilled rows are bound to, in order. */
function boundEmails(): string[] {
  return nameInputs()
    .map((el) => el.closest('[data-member-email]')?.getAttribute('data-member-email') ?? null)
    .filter((e): e is string => e !== null)
}

function mintBody(): Record<string, unknown> {
  const calls = fetchMock.mock.calls.filter((c) => String(c[0]) === MINT_URL)
  expect(calls.length, 'exactly one mint request').toBe(1)
  return JSON.parse(String((calls[0][1] ?? {}).body)) as Record<string, unknown>
}

beforeEach(() => {
  cleanup()
  sharing.listScenarioMembers.mockReset()
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === MINT_URL) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          round_id: 'rnd-d2s2',
          graph_version_ref: 'gv-1',
          participants: [
            { participant_id: 'p-1', display_name: 'ana.lee-D2S2', token: 'tok-1' },
            { participant_id: 'p-2', display_name: 'bo_okafor-D2S2', token: 'tok-2' },
          ],
        }),
      }
    }
    return { ok: false, status: 404, json: async () => ({ code: 'not_stubbed' }) }
  })
  vi.stubGlobal('fetch', fetchMock)
  vi.mocked(getSessionIdentity).mockResolvedValue({ userId: 'owner-1', accessToken: 'owner-token-d2s2' })
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('R7: Ask your team is prefilled from the invited colleagues', () => {
  it('2 active members (the RPC answer) → exactly those 2 rows, bound to their emails, named by local part', async () => {
    sharing.listScenarioMembers.mockResolvedValue({
      ok: true,
      members: [
        { email: ANA, createdAt: '2026-10-02T10:00:00Z' },
        { email: BO, createdAt: '2026-10-02T10:01:00Z' },
      ],
    })
    renderPage()
    await waitFor(() => expect(boundEmails()).toEqual([ANA, BO]))
    expect(sharing.listScenarioMembers).toHaveBeenCalledWith(SCENARIO_ID)
    expect(nameInputs().map((el) => el.value)).toEqual(['ana.lee-D2S2', 'bo_okafor-D2S2'])
  })

  it('a prefilled name stays editable, and the mint carries display_name ONLY (no email, no user id)', async () => {
    sharing.listScenarioMembers.mockResolvedValue({
      ok: true,
      members: [
        { email: ANA, createdAt: 'x' },
        { email: BO, createdAt: 'y' },
      ],
    })
    renderPage()
    await waitFor(() => expect(boundEmails()).toEqual([ANA, BO]))
    fireEvent.change(screen.getByTestId('panel-name-a'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByTestId('panel-target-id'), { target: { value: 'factor-x' } })
    fireEvent.click(screen.getByTestId('panel-mint'))
    await waitFor(() => expect(fetchMock.mock.calls.some((c) => String(c[0]) === MINT_URL)).toBe(true))
    const body = mintBody()
    expect(body.participants).toEqual([{ display_name: 'Ana' }, { display_name: 'bo_okafor-D2S2' }])
    const wire = JSON.stringify(body)
    expect(wire).not.toContain('@')
    expect(wire).not.toMatch(/supabase_user_id|user_id|email/)
  })

  it('3 members → 3 rows, and the third can be removed (rows stay removable)', async () => {
    sharing.listScenarioMembers.mockResolvedValue({
      ok: true,
      members: [
        { email: ANA, createdAt: 'x' },
        { email: BO, createdAt: 'y' },
        { email: 'cy-D2S2@example.net', createdAt: 'z' },
      ],
    })
    renderPage()
    await waitFor(() => expect(boundEmails()).toHaveLength(3))
    fireEvent.click(screen.getByTestId('panel-name-remove-2'))
    expect(boundEmails()).toEqual([ANA, BO])
  })

  it('1 member → that row plus one blank row (the two-person shape stays), and typed names still work', async () => {
    sharing.listScenarioMembers.mockResolvedValue({ ok: true, members: [{ email: ANA, createdAt: 'x' }] })
    renderPage()
    await waitFor(() => expect(boundEmails()).toEqual([ANA]))
    expect(nameInputs().map((el) => el.value)).toEqual(['ana.lee-D2S2', ''])
    fireEvent.change(screen.getByTestId('panel-name-b'), { target: { value: 'Grace' } })
    expect((screen.getByTestId('panel-name-b') as HTMLInputElement).value).toBe('Grace')
  })

  it.each([
    ['a failed list', { ok: false, failure: 'unavailable' }],
    ['an empty list', { ok: true, members: [] }],
  ])('%s → today\'s empty form (two blank rows), and no error wall', async (_l, answer) => {
    sharing.listScenarioMembers.mockResolvedValue(answer)
    renderPage()
    await waitFor(() => expect(sharing.listScenarioMembers).toHaveBeenCalled())
    await Promise.resolve()
    expect(nameInputs().map((el) => el.value)).toEqual(['', ''])
    expect(boundEmails()).toEqual([])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('NEVER STOMPS TYPING: a name typed before the member list answers is kept, and the list does not overwrite it', async () => {
    let answer!: (v: unknown) => void
    sharing.listScenarioMembers.mockImplementation(() => new Promise((r) => { answer = r }))
    renderPage()
    fireEvent.change(screen.getByTestId('panel-name-a'), { target: { value: 'Typed first' } })
    answer({ ok: true, members: [{ email: ANA, createdAt: 'x' }, { email: BO, createdAt: 'y' }] })
    await waitFor(() => expect(sharing.listScenarioMembers).toHaveBeenCalled())
    await Promise.resolve()
    await Promise.resolve()
    expect((screen.getByTestId('panel-name-a') as HTMLInputElement).value).toBe('Typed first')
    expect(boundEmails()).toEqual([])
  })
})

describe('R7 (viewer half): a viewer never reaches the page', () => {
  it('CanvasMVP hands the TopBar no panel scenario id for a viewer (the only entry to this page)', () => {
    const src = readFileSync('src/routes/CanvasMVP.tsx', 'utf8')
    expect(src).toContain('panelScenarioId={isPersistenceActive && currentScenarioId && !isViewer ? currentScenarioId : null}')
  })
})
