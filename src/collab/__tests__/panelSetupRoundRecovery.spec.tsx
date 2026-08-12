/**
 * COLLAB — owner ROUND RECOVERY on the panel setup page.
 *
 * ── THE RESIDUE THIS CLOSES (measured on the tip this branch left) ─────────
 * The mint response is the only place participant tokens ever exist, and the
 * page deliberately holds them in component state alone. But it also held the
 * ROUND ID nowhere else — so an owner who navigated away lost not only the
 * links (by design) but the round itself: no way to close it, no way to reach
 * the answers already given, and a blank form on return that never said a
 * round was open. "A lost link is re-minted" was the page's own recovery
 * story, with no affordance to act it out.
 *
 * ── WHAT RECOVERY IS, PRECISELY ────────────────────────────────────────────
 * A NON-SECRET record (round id, names — never tokens) written at mint,
 * surfaced on return as a banner ABOVE the form: close the recorded round and
 * read the answers, forget the reminder, or open a fresh round below (the
 * re-mint). Re-DISPLAY of a lost token stays impossible on purpose; re-mint
 * into the SAME round needs a CEE route that does not exist yet — this page
 * says so honestly by never promising either.
 *
 * ⚠ jsdom proves behaviour and presence, never visibility.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../../lib/supabase', async (importOriginal) => {
  // Spread the real module rather than hand-list its exports (trap 12).
  const actual = await importOriginal<typeof import('../../lib/supabase')>()
  return { ...actual, getSessionIdentity: vi.fn() }
})

import { getSessionIdentity } from '../../lib/supabase'
import PanelSetupPage from '../../pages/PanelSetupPage'
import { recallOpenRound, rememberOpenRound } from '../openRoundRecord'

const SCENARIO_ID = 'scn-recovery-1111'
const MINTED_ROUND_ID = 'rnd-minted-2222'
const RECORDED_ROUND_ID = 'rnd-RECORDED-99'
const OWNER_TOKEN = 'owner-access-token-recovery-IDENTITY'
const SECRET_TOKEN_A = 'tok-SECRET-ada-1a2b'
const SECRET_TOKEN_B = 'tok-SECRET-grace-3c4d'

type StubResponse = Pick<Response, 'ok' | 'status' | 'json'>

let fetchMock: Mock<[input: RequestInfo | URL, init?: RequestInit], Promise<StubResponse>>

function jsonResponse(body: unknown, status = 200): StubResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

const MINT_RESPONSE = {
  round_id: MINTED_ROUND_ID,
  graph_version_ref: 'gv-1',
  participants: [
    { participant_id: 'p-a', display_name: 'Ada', token: SECRET_TOKEN_A },
    { participant_id: 'p-b', display_name: 'Grace', token: SECRET_TOKEN_B },
  ],
}

const EMPTY_REVEAL = {
  round_id: RECORDED_ROUND_ID,
  status: 'closed',
  graph_version_ref: 'gv-1',
  per_target: [],
}

function renderOwnerPanel(): void {
  render(
    <MemoryRouter initialEntries={[`/scenario/${SCENARIO_ID}/panel`]}>
      <Routes>
        <Route path="/scenario/:id/panel" element={<PanelSetupPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function seedRecord(): void {
  rememberOpenRound({
    roundId: RECORDED_ROUND_ID,
    scenarioId: SCENARIO_ID,
    participants: [
      { participant_id: 'p-a', display_name: 'Ada' },
      { participant_id: 'p-b', display_name: 'Grace' },
    ],
  })
}

async function mintARound(): Promise<void> {
  fireEvent.change(screen.getByTestId('panel-target-id'), { target: { value: 'factor-churn' } })
  fireEvent.change(screen.getByTestId('panel-name-a'), { target: { value: 'Ada' } })
  fireEvent.change(screen.getByTestId('panel-name-b'), { target: { value: 'Grace' } })
  fireEvent.click(screen.getByTestId('panel-mint'))
  await waitFor(() => expect(screen.getByTestId('panel-close')).toBeInTheDocument())
}

/** Calls whose URL touches the collab seam — the wire the forget test pins shut. */
function collabCalls(): string[] {
  return fetchMock.mock.calls.map(([input]) => String(input)).filter((u) => u.includes('/bff/collab'))
}

beforeEach(() => {
  localStorage.clear()
  fetchMock = vi.fn(async (input: RequestInfo | URL) =>
    jsonResponse({ code: 'not_stubbed', message: String(input) }, 404),
  )
  vi.stubGlobal('fetch', fetchMock)
  vi.mocked(getSessionIdentity).mockResolvedValue({ userId: 'user-abc', accessToken: OWNER_TOKEN })
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

/* ══ Minting leaves a record the owner can come back to ═══════════════════ */

describe('minting writes a non-secret open-round record', () => {
  it('records round id and names for THIS scenario — and never a token', async () => {
    fetchMock.mockImplementation(async (input) => {
      if (String(input) === '/bff/collab/rounds') return jsonResponse(MINT_RESPONSE, 201)
      return jsonResponse({ code: 'not_stubbed', message: String(input) }, 404)
    })
    renderOwnerPanel()
    await mintARound()

    const record = recallOpenRound(SCENARIO_ID)
    expect(record?.round_id).toBe(MINTED_ROUND_ID)
    expect(record?.participants).toEqual([
      { participant_id: 'p-a', display_name: 'Ada' },
      { participant_id: 'p-b', display_name: 'Grace' },
    ])

    // POSITIVE CONTROL first: the mint response really carried the secrets…
    expect(JSON.stringify(MINT_RESPONSE)).toContain(SECRET_TOKEN_A)
    // …and none of them reached ANY storage key.
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) as string
      const value = localStorage.getItem(key) ?? ''
      expect(`${key}${value}`).not.toContain(SECRET_TOKEN_A)
      expect(`${key}${value}`).not.toContain(SECRET_TOKEN_B)
    }
  })
})

/* ══ Returning to the page with an open round on record ═══════════════════ */

describe('the recovery banner', () => {
  it('shows the recorded round — names on the banner, and the form still below it (the re-mint path)', () => {
    seedRecord()
    renderOwnerPanel()

    const banner = screen.getByTestId('panel-resume')
    expect(within(banner).getByText(/Ada/)).toBeInTheDocument()
    expect(within(banner).getByText(/Grace/)).toBeInTheDocument()
    // The form is NOT replaced: opening a fresh round is the documented
    // recovery for a lost link, so it must stay reachable.
    expect(screen.getByTestId('panel-target-id')).toBeInTheDocument()
    expect(screen.getByTestId('panel-mint')).toBeInTheDocument()
  })

  it('is honest that the old links cannot be shown again', () => {
    seedRecord()
    renderOwnerPanel()
    expect(screen.getByTestId('panel-resume')).toHaveTextContent(/cannot be shown again/i)
  })

  it('does not render without a record — the form is the positive control', () => {
    renderOwnerPanel()
    expect(screen.queryByTestId('panel-resume')).toBeNull()
    expect(screen.getByTestId('panel-target-id')).toBeInTheDocument()
  })

  it('DIFFERENT OBJECT: a record for ANOTHER scenario does not raise this page’s banner', () => {
    rememberOpenRound({
      roundId: 'rnd-elsewhere-42',
      scenarioId: 'scn-some-other-scenario',
      participants: [{ participant_id: 'p-z', display_name: 'Zed' }],
    })
    renderOwnerPanel()
    expect(screen.queryByTestId('panel-resume')).toBeNull()
  })
})

/* ══ Closing the RECORDED round from the banner ════════════════════════════ */

describe('closing the recorded round', () => {
  it('closes THE RECORDED round id with the owner bearer, shows the reveal, clears the record', async () => {
    seedRecord()
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      if (url === `/bff/collab/rounds/${RECORDED_ROUND_ID}/close` && init?.method === 'POST') {
        return jsonResponse({ round_id: RECORDED_ROUND_ID, status: 'closed' })
      }
      if (url === `/bff/collab/rounds/${RECORDED_ROUND_ID}/reveal`) {
        return jsonResponse(EMPTY_REVEAL)
      }
      return jsonResponse({ code: 'not_stubbed', message: url }, 404)
    })

    renderOwnerPanel()
    fireEvent.click(screen.getByTestId('panel-resume-close'))

    await waitFor(() => expect(screen.getByTestId('collab-reveal')).toBeInTheDocument())

    // IDENTITY: the close went to the RECORDED round, carrying the owner token.
    const closeCall = fetchMock.mock.calls.find(
      ([input]) => String(input) === `/bff/collab/rounds/${RECORDED_ROUND_ID}/close`,
    )
    expect(closeCall).toBeDefined()
    expect(
      new Headers(closeCall?.[1]?.headers as HeadersInit).get('authorization'),
    ).toBe(`Bearer ${OWNER_TOKEN}`)

    expect(recallOpenRound(SCENARIO_ID)).toBeNull()
  })

  it('a round already closed elsewhere is NOT a dead end — the reveal is fetched anyway', async () => {
    seedRecord()
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      if (url === `/bff/collab/rounds/${RECORDED_ROUND_ID}/close` && init?.method === 'POST') {
        return jsonResponse({ code: 'collab_round_closed', message: 'That round is already closed.' }, 409)
      }
      if (url === `/bff/collab/rounds/${RECORDED_ROUND_ID}/reveal`) {
        return jsonResponse(EMPTY_REVEAL)
      }
      return jsonResponse({ code: 'not_stubbed', message: url }, 404)
    })

    renderOwnerPanel()
    fireEvent.click(screen.getByTestId('panel-resume-close'))

    await waitFor(() => expect(screen.getByTestId('collab-reveal')).toBeInTheDocument())
    expect(recallOpenRound(SCENARIO_ID)).toBeNull()
  })

  it('DIFFERENT OBJECT: any other close failure keeps the banner and the record, and shows the failure', async () => {
    seedRecord()
    // ⚠ The reveal is stubbed to SUCCEED here on purpose. Only
    // `collab_round_closed` may fall through to it — a predicate widened to
    // swallow every close failure would sail on to this healthy reveal and
    // paint success over a round that is still open. With the reveal healthy,
    // the ONLY way this test passes is the close failure actually stopping
    // the flow.
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      if (url === `/bff/collab/rounds/${RECORDED_ROUND_ID}/close` && init?.method === 'POST') {
        return jsonResponse({ code: 'collab_store_unavailable', message: 'Store fell over.' }, 503)
      }
      if (url === `/bff/collab/rounds/${RECORDED_ROUND_ID}/reveal`) {
        return jsonResponse(EMPTY_REVEAL)
      }
      return jsonResponse({ code: 'not_stubbed', message: url }, 404)
    })

    renderOwnerPanel()
    fireEvent.click(screen.getByTestId('panel-resume-close'))

    await waitFor(() => expect(screen.getByTestId('panel-error')).toBeInTheDocument())
    expect(screen.queryByTestId('collab-reveal')).toBeNull()
    expect(screen.getByTestId('panel-resume')).toBeInTheDocument()
    expect(recallOpenRound(SCENARIO_ID)?.round_id).toBe(RECORDED_ROUND_ID)
  })
})

/* ══ Forgetting the reminder ═══════════════════════════════════════════════ */

describe('forgetting the recorded round', () => {
  it('clears the reminder locally and sends NOTHING on the collab wire', async () => {
    seedRecord()
    renderOwnerPanel()

    fireEvent.click(screen.getByTestId('panel-resume-forget'))

    await waitFor(() => expect(screen.queryByTestId('panel-resume')).toBeNull())
    expect(recallOpenRound(SCENARIO_ID)).toBeNull()
    expect(collabCalls()).toEqual([])
    // The form remains — forgetting is not an exit from the page.
    expect(screen.getByTestId('panel-target-id')).toBeInTheDocument()
  })
})

/* ══ The fresh-mint path keeps the record honest too ═══════════════════════ */

describe('closing from the fresh-mint state', () => {
  it('clears the record once the reveal is on screen', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input)
      if (url === '/bff/collab/rounds') return jsonResponse(MINT_RESPONSE, 201)
      if (url === `/bff/collab/rounds/${MINTED_ROUND_ID}/close` && init?.method === 'POST') {
        return jsonResponse({ round_id: MINTED_ROUND_ID, status: 'closed' })
      }
      if (url === `/bff/collab/rounds/${MINTED_ROUND_ID}/reveal`) {
        return jsonResponse({ ...EMPTY_REVEAL, round_id: MINTED_ROUND_ID })
      }
      return jsonResponse({ code: 'not_stubbed', message: url }, 404)
    })

    renderOwnerPanel()
    await mintARound()
    expect(recallOpenRound(SCENARIO_ID)?.round_id).toBe(MINTED_ROUND_ID)

    fireEvent.click(screen.getByTestId('panel-close'))
    await waitFor(() => expect(screen.getByTestId('collab-reveal')).toBeInTheDocument())
    expect(recallOpenRound(SCENARIO_ID)).toBeNull()
  })
})
