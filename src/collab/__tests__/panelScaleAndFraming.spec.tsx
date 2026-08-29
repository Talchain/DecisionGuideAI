/**
 * COLLAB — HOW MANY PEOPLE, HOW MANY FACTORS, AND WHOSE PRODUCT THIS IS.
 *
 * ── WHAT WAS WRONG, AND IT WAS NOT THE WIRE ───────────────────────────────
 * `mintRound` has always taken `targets[]` and `participants[]`; CEE stores a
 * target MANIFEST and a three-target round has been minted and revealed. The
 * FORM was the only limit: it built a single-element `targets` array and
 * exactly two name fields, so the product capped a session at one question and
 * two colleagues while every layer beneath it was general.
 *
 * ── AND THE FRAMING ───────────────────────────────────────────────────────
 * The three collaboration surfaces carried ZERO occurrences of the product
 * name — measured at `04c7c8c4` with a contrast control ("panel": 22 / 63 / 4
 * hits in the same run, so the probe was demonstrably not blind). Two of them
 * are reached by people who have never seen this product: an invitee opens a
 * bare link from a chat client and lands on an unbranded form asking for a
 * number.
 *
 * ── THE BINDING ───────────────────────────────────────────────────────────
 * The mint assertions read the REQUEST BODY, not the form — a form that
 * rendered five rows and still posted one would satisfy every DOM assertion.
 * Rows are bound by the id typed into them, never by position, so a builder
 * that dropped a row and left the count right still fails.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'

vi.mock('../../canvas/hooks/useBeliefElicitation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../canvas/hooks/useBeliefElicitation')>()
  return {
    ...actual,
    useBeliefElicitation: vi.fn(() => ({
      suggestion: null,
      loading: false,
      error: null,
      request: vi.fn(),
      reset: vi.fn(),
    })),
  }
})

// The owner's identity seam, mocked the way the sibling setup specs do it:
// `importOriginal`-spread rather than hand-listed, so a new export cannot go
// silently missing from the factory (trap 12).
vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase')>()
  return { ...actual, getSessionIdentity: vi.fn() }
})

import { getSessionIdentity } from '../../lib/supabase'
import PanelSetupPage from '../../pages/PanelSetupPage'
import ParticipantPacketPage from '../../pages/ParticipantPacketPage'
import { COLLAB_PRODUCT_NAME } from '../branding'
import type { OpenPacket } from '../collabService'
import { __resetParticipantTokenForTests, setParticipantToken } from '../participantToken'

const SCENARIO = 'scn-11111111-1111-4111-8111-111111111111'
const ROUND = 'rnd-22222222-2222-4222-8222-222222222222'

type StubResponse = Pick<Response, 'ok' | 'status' | 'json'>
let fetchMock: Mock<[input: RequestInfo | URL, init?: RequestInit], Promise<StubResponse>>

function jsonResponse(body: unknown, status = 200): StubResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

beforeEach(() => {
  fetchMock = vi.fn(async () =>
    jsonResponse({ round_id: ROUND, participants: [], graph_version_ref: 'gv-1' }, 201),
  )
  vi.stubGlobal('fetch', fetchMock)
  vi.mocked(getSessionIdentity).mockResolvedValue({
    userId: 'user-abc',
    accessToken: 'owner-jwt-for-tests',
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

function renderSetup(): void {
  render(
    <MemoryRouter initialEntries={[`/scenario/${SCENARIO}/panel`]}>
      <Routes>
        <Route path="/scenario/:id/panel" element={<PanelSetupPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** The body of the mint POST, parsed. Null when no mint was sent. */
function mintBody(): Record<string, unknown> | null {
  const call = fetchMock.mock.calls.find(([, init]) => {
    const body = init?.body
    return typeof body === 'string' && body.includes('targets')
  })
  if (call === undefined) return null
  return JSON.parse(String(call[1]?.body)) as Record<string, unknown>
}

describe('the setup form takes N factors and N people', () => {
  it('⭐ a THIRD participant reaches the wire', async () => {
    renderSetup()

    fireEvent.change(screen.getByTestId('panel-target-id'), {
      target: { value: 'factor-churn' },
    })
    fireEvent.change(screen.getByTestId('panel-name-a'), { target: { value: 'Ada' } })
    fireEvent.change(screen.getByTestId('panel-name-b'), { target: { value: 'Grace' } })

    // The affordance that did not exist.
    fireEvent.click(screen.getByTestId('panel-add-name'))
    fireEvent.change(screen.getByTestId('panel-name-2'), { target: { value: 'Priya' } })
    fireEvent.click(screen.getByTestId('panel-mint'))

    await waitFor(() => expect(mintBody()).not.toBeNull())
    const body = mintBody()
    expect(body?.participants).toEqual([
      { display_name: 'Ada' },
      { display_name: 'Grace' },
      { display_name: 'Priya' },
    ])
  })

  it('⭐ a SECOND factor reaches the wire, with its own label', async () => {
    renderSetup()

    fireEvent.change(screen.getByTestId('panel-target-id'), {
      target: { value: 'factor-churn' },
    })
    fireEvent.change(screen.getByTestId('panel-target-label'), {
      target: { value: 'Churn risk after a price rise' },
    })
    fireEvent.click(screen.getByTestId('panel-add-target'))
    fireEvent.change(screen.getByTestId('panel-target-id-1'), {
      target: { value: 'factor-price-sensitivity' },
    })
    fireEvent.change(screen.getByTestId('panel-target-label-1'), {
      target: { value: 'Price sensitivity' },
    })
    fireEvent.change(screen.getByTestId('panel-name-a'), { target: { value: 'Ada' } })
    fireEvent.click(screen.getByTestId('panel-mint'))

    await waitFor(() => expect(mintBody()).not.toBeNull())
    // BY ID, not by count: a builder that dropped a row and duplicated another
    // would keep the length right.
    expect(mintBody()?.targets).toEqual([
      {
        target: { kind: 'factor', id: 'factor-churn' },
        label: 'Churn risk after a price rise',
        description: null,
        unit: null,
      },
      {
        target: { kind: 'factor', id: 'factor-price-sensitivity' },
        label: 'Price sensitivity',
        description: null,
        unit: null,
      },
    ])
  })

  it('an added-then-abandoned row is DROPPED, never minted empty', async () => {
    renderSetup()

    fireEvent.change(screen.getByTestId('panel-target-id'), {
      target: { value: 'factor-churn' },
    })
    fireEvent.click(screen.getByTestId('panel-add-target'))
    // ...and the owner changes their mind, leaving it blank.
    fireEvent.change(screen.getByTestId('panel-name-a'), { target: { value: 'Ada' } })
    fireEvent.click(screen.getByTestId('panel-add-name'))
    fireEvent.click(screen.getByTestId('panel-mint'))

    await waitFor(() => expect(mintBody()).not.toBeNull())
    const body = mintBody()
    expect(body?.targets).toHaveLength(1)
    expect(body?.participants).toEqual([{ display_name: 'Ada' }])
  })

  it('an added row can be removed again', () => {
    renderSetup()

    fireEvent.click(screen.getByTestId('panel-add-target'))
    expect(screen.getByTestId('panel-target-id-1')).toBeTruthy()
    fireEvent.click(screen.getByTestId('panel-target-remove-1'))
    expect(screen.queryByTestId('panel-target-id-1')).toBeNull()
    // The first row is the round's reason for existing and offers no removal.
    expect(screen.queryByTestId('panel-target-remove-0')).toBeNull()
  })

  it('the mint gate still requires at least one named factor', () => {
    renderSetup()

    expect(screen.getByTestId('panel-mint')).toBeDisabled()
    fireEvent.click(screen.getByTestId('panel-add-target'))
    // A row added but not named is still nothing to ask about.
    expect(screen.getByTestId('panel-mint')).toBeDisabled()
    fireEvent.change(screen.getByTestId('panel-target-id-1'), {
      target: { value: 'factor-churn' },
    })
    expect(screen.getByTestId('panel-mint')).not.toBeDisabled()
  })
})

describe('the product names itself on the surfaces an outsider reaches', () => {
  it("the owner's setup page carries the product name", () => {
    renderSetup()
    expect(document.body.textContent).toContain(COLLAB_PRODUCT_NAME)
  })
})

describe("the participant's first screen says what it is and what it is about", () => {
  const PACKET_URL = `/bff/collab/packet/${ROUND}`
  const TARGET_A = 'factor-churn'
  const TARGET_B = 'factor-price'

  function openPacket(targets: OpenPacket['targets']): OpenPacket {
    return {
      round_id: ROUND,
      status: 'open',
      context_note: null,
      graph_version_ref: 'gv-1',
      targets,
      self: { participant_id: 'p-1', display_name: 'Grace', completed_target_ids: [] },
    }
  }

  function renderPacket(packet: OpenPacket): void {
    fetchMock.mockImplementation(async (input) => {
      if (String(input).includes(PACKET_URL)) return jsonResponse(packet)
      return jsonResponse({}, 404)
    })
    setParticipantToken('ptoken-for-tests')
    render(
      <MemoryRouter initialEntries={[`/panel/${ROUND}`]}>
        <Routes>
          <Route path="/panel/:round_id" element={<ParticipantPacketPage />} />
        </Routes>
      </MemoryRouter>,
    )
  }

  afterEach(() => {
    __resetParticipantTokenForTests()
  })

  it('⭐ carries the product name — it was an unbranded page before', async () => {
    renderPacket(
      openPacket([
        { target: { kind: 'factor', id: TARGET_A }, label: 'Churn risk', description: null, unit: null },
      ]),
    )

    await screen.findByTestId('participant-packet-page')
    expect(document.body.textContent).toContain(COLLAB_PRODUCT_NAME)
  })

  it('names what the panel was asked about, from the wire', async () => {
    renderPacket(
      openPacket([
        { target: { kind: 'factor', id: TARGET_A }, label: 'Churn risk', description: null, unit: null },
        { target: { kind: 'factor', id: TARGET_B }, label: 'Price sensitivity', description: null, unit: null },
      ]),
    )

    const asked = await screen.findByTestId('packet-asked-about')
    expect(asked.textContent).toContain('Churn risk')
    expect(asked.textContent).toContain('Price sensitivity')
  })

  it('⚠ invents no sender: the packet carries none, so none is claimed', async () => {
    renderPacket(
      openPacket([
        { target: { kind: 'factor', id: TARGET_A }, label: 'Churn risk', description: null, unit: null },
      ]),
    )

    await screen.findByTestId('participant-packet-page')
    const text = document.body.textContent ?? ''
    // `OPEN_PACKET_ALLOWED_KEYS` is a CLOSED key set with no owner name and no
    // decision title on it. A "someone has asked you" phrasing here would be a
    // fabricated provenance claim on the one screen whose entire promise is
    // provenance.
    expect(text).not.toContain('has asked for your view on')
    expect(text).toContain('You have been asked for your view')
  })

  it("the participant's input is the page's own tap-target size, not the panel's", async () => {
    renderPacket(
      openPacket([
        { target: { kind: 'factor', id: TARGET_A }, label: 'Churn risk', description: null, unit: null },
      ]),
    )

    const field = await screen.findByTestId(`packet-belief-${TARGET_A}`)
    const input = field.querySelector('input')
    expect(input?.getAttribute('data-size')).toBe('comfortable')
    // 28px tall and 224px wide was the dense-canvas size, on a page whose every
    // other input is 44px and whose reader is on a phone.
    expect(input?.className).toContain('min-h-[44px]')
    expect(input?.className).not.toContain('h-7')
    expect(input?.className).not.toContain('w-56')
  })
})
