/**
 * COLLAB — the setup page READS the prefill, and the MINT is bound to it by
 * IDENTITY.
 *
 * Capability A's hop lands the owner here with `?factor=…&label=…&unit=…` in
 * the hash query. Today the owner hand-types factor ids (placeholder
 * "factor-churn-risk"); with a prefill the form arrives filled and the mint
 * payload's `targets[0].target.id` is the PREFILLED factor — not whatever
 * happens to be first anywhere.
 *
 * THE DISCRIMINATING CASES (trap 19 — bind by identity, never a predicate
 * another object could satisfy):
 *   • prefill factor A → the minted round targets A, byte-exact;
 *   • the owner RETARGETS by editing the id → the mint follows the EDIT, and
 *     the prefilled unit is DROPPED (it described A, not the new target — a
 *     unit that follows the owner to a different factor is a false claim about
 *     that factor).
 *
 * NOTE WHAT IS NOT ASSERTED: no value field anywhere in the mint body — the
 * blindness property is CEE-enforced at intake and the payload shape here has
 * nowhere to put a value; the no-value assertion pins that the prefill did not
 * smuggle one in.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../../lib/supabase', async (importOriginal) => {
  // Spread the real module (trap 12): a hand-listed factory REPLACES the
  // module and silently drops every export added later.
  const actual = await importOriginal<typeof import('../../lib/supabase')>()
  return { ...actual, getSessionIdentity: vi.fn() }
})

import { getSessionIdentity } from '../../lib/supabase'
import PanelSetupPage from '../../pages/PanelSetupPage'

const OWNER_ROUTE_PATH = '/scenario/:id/panel'
const SCENARIO_ID = 'scn-11111111-2222-3333-4444-555555555555'
const ROUND_ID = 'rnd-66666666-7777-8888-9999-aaaaaaaaaaaa'
const OWNER_TOKEN = 'owner-access-token-prefill-IDENTITY'
const MINT_URL = '/bff/collab/rounds'

/** Distinctive ids: an assertion naming them cannot be met by chance. */
const PREFILLED_FACTOR = 'factor-churn-risk-PREFILLED-A'
const RETARGETED_FACTOR = 'factor-retention-spend-EDITED-B'
const PREFILLED_LABEL = 'Churn risk after a price rise'
const PREFILLED_UNIT = 'percentage points'

type StubResponse = Pick<Response, 'ok' | 'status' | 'json'>
let fetchMock: Mock<[input: RequestInfo | URL, init?: RequestInit], Promise<StubResponse>>

function jsonResponse(body: unknown, status = 200): StubResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function renderAt(search: string): void {
  render(
    <MemoryRouter initialEntries={[`/scenario/${SCENARIO_ID}/panel${search}`]}>
      <Routes>
        <Route path={OWNER_ROUTE_PATH} element={<PanelSetupPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** The one mint request's parsed JSON body, selected by its own URL. */
function mintBody(): Record<string, unknown> {
  const calls = fetchMock.mock.calls.filter((c) => String(c[0]) === MINT_URL)
  expect(calls.length, 'exactly one mint request must have been issued').toBe(1)
  return JSON.parse(String((calls[0][1] ?? {}).body)) as Record<string, unknown>
}

async function mint(): Promise<void> {
  fireEvent.click(screen.getByTestId('panel-mint'))
  await waitFor(() => expect(screen.getByTestId('panel-close')).toBeInTheDocument())
}

const PREFILL_SEARCH = `?factor=${encodeURIComponent(PREFILLED_FACTOR)}&label=${encodeURIComponent(
  PREFILLED_LABEL,
)}&unit=${encodeURIComponent(PREFILLED_UNIT)}`

beforeEach(() => {
  cleanup()
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === MINT_URL) {
      return jsonResponse({
        round_id: ROUND_ID,
        graph_version_ref: 'gv-1',
        participants: [{ participant_id: 'p-a', display_name: 'Ada', token: 'tok-a' }],
      })
    }
    return jsonResponse({ code: 'not_stubbed', message: String(input) }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  vi.mocked(getSessionIdentity).mockResolvedValue({ userId: 'user-abc', accessToken: OWNER_TOKEN })
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the prefill lands in the form', () => {
  it('arriving with ?factor&label&unit pre-fills the target id and label inputs', () => {
    renderAt(PREFILL_SEARCH)
    expect(screen.getByTestId('panel-target-id')).toHaveValue(PREFILLED_FACTOR)
    expect(screen.getByTestId('panel-target-label')).toHaveValue(PREFILLED_LABEL)
  })

  it('says the form was pre-filled from the model (and the owner may change it)', () => {
    renderAt(PREFILL_SEARCH)
    expect(screen.getByTestId('panel-prefill-note')).toBeInTheDocument()
  })

  it('BARE HASH UNCHANGED: no query → empty inputs, no prefill note (every existing caller)', () => {
    renderAt('')
    expect(screen.getByTestId('panel-target-id')).toHaveValue('')
    expect(screen.getByTestId('panel-target-label')).toHaveValue('')
    expect(screen.queryByTestId('panel-prefill-note')).toBeNull()
  })
})

describe('the mint is bound to the prefill by IDENTITY', () => {
  it('DISCRIMINATING: prefill factor A → the minted round targets A, byte-exact, unit riding', async () => {
    renderAt(PREFILL_SEARCH)
    await mint()

    const body = mintBody()
    const targets = body.targets as Array<{
      target: { kind: string; id: string }
      label: string
      unit: string | null
    }>
    expect(targets).toHaveLength(1)
    expect(targets[0].target).toEqual({ kind: 'factor', id: PREFILLED_FACTOR })
    expect(targets[0].label).toBe(PREFILLED_LABEL)
    expect(targets[0].unit).toBe(PREFILLED_UNIT)
  })

  it('RETARGET: editing the id to factor B mints B (the edit wins) and DROPS the unit (it described A)', async () => {
    renderAt(PREFILL_SEARCH)
    fireEvent.change(screen.getByTestId('panel-target-id'), {
      target: { value: RETARGETED_FACTOR },
    })
    await mint()

    const body = mintBody()
    const targets = body.targets as Array<{
      target: { kind: string; id: string }
      unit: string | null
    }>
    expect(targets[0].target.id).toBe(RETARGETED_FACTOR)
    expect(targets[0].target.id).not.toBe(PREFILLED_FACTOR)
    expect(targets[0].unit).toBeNull()
  })

  it('NO VALUE ANYWHERE: the prefilled mint body carries no value-bearing field (blindness inherited, not re-implemented)', async () => {
    renderAt(PREFILL_SEARCH)
    await mint()

    const raw = JSON.stringify(mintBody())
    // POSITIVE CONTROL first: the serialised body really is the mint payload.
    expect(raw).toContain(PREFILLED_FACTOR)
    for (const forbidden of ['"value"', '"raw_value"', '"estimate"', '"model_value"']) {
      expect(raw, `mint body must not carry ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('HAND-TYPED PATH UNCHANGED: bare hash + typed id mints exactly the typed id with unit null', async () => {
    renderAt('')
    fireEvent.change(screen.getByTestId('panel-target-id'), {
      target: { value: RETARGETED_FACTOR },
    })
    await mint()

    const body = mintBody()
    const targets = body.targets as Array<{ target: { id: string }; unit: string | null }>
    expect(targets[0].target.id).toBe(RETARGETED_FACTOR)
    expect(targets[0].unit).toBeNull()
  })
})
