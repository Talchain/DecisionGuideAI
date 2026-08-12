/**
 * COLLAB — FIRST-RUN FRICTION on the two PR4 panel surfaces.
 *
 * ── WHAT THIS FILE PINS AND WHY IT EXISTS ─────────────────────────────────
 * A live browser witness on deployed UI `3a4e3df2` drove both collaboration
 * pages as a first-time user and found the surfaces unusable before any
 * collaboration science got a chance to matter:
 *
 *   F1  both pages rendered with ZERO design-system classes (`main [class]`
 *       measured 0 in the live DOM). Tailwind preflight strips native styling
 *       and nothing restored it, so the h1 computed to 16px/400 — identical to
 *       body text — and inputs had `border: 0; padding: 0`.
 *   F2  a participant who mistyped their code was TRAPPED: the entry form
 *       rendered only when no token was held, and nothing could clear a bad
 *       one. Only a full reload escaped, and the page never said so.
 *   F3  "Continue" was dead on empty input, with no feedback at all.
 *   F4  the owner saw CEE's raw wire sentence after ~8 seconds with no busy
 *       indicator and no statement of what to do next.
 *   F5  a "Sign in again…" message with no sign-in affordance on the page.
 *   F7  participant links are one-shot and unrecoverable — and had no copy
 *       button.
 *
 * ── WHAT JSDOM CAN AND CANNOT SETTLE HERE, STATED PLAINLY ─────────────────
 * F2/F3/F4/F5/F7 are BEHAVIOUR and are settled here: each was written RED
 * against the pristine pages and named the missing affordance by test id.
 *
 * F1 IS NOT SETTLED HERE. jsdom computes no layout, so nothing below is
 * evidence about visual hierarchy, spacing, contrast or focus rings. What the
 * F1 block asserts is narrower and honest: the design-system tokens are
 * APPLIED to the surfaces the deployed app actually MOUNTS. Layout truth needs
 * the browser witness that follows the deploy — this suite cannot supply it
 * and does not claim to.
 *
 * ── BINDING ───────────────────────────────────────────────────────────────
 * Every assertion selects its object by IDENTITY (test id, or role + name),
 * never by a value predicate a neighbouring element could satisfy — the two
 * participant links in particular are deliberately distinct objects, and the
 * copy tests assert the OTHER one did not move.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('../../lib/supabase', async (importOriginal) => {
  // Spread the real module rather than hand-list its exports (trap 12: a
  // hand-listed factory REPLACES the module and every later export vanishes).
  // It also means this spec collects only when the Supabase env vars are set —
  // a deliberate tripwire, since without them whole spec files disappear from
  // the run while the total still prints green.
  const actual = await importOriginal<typeof import('../../lib/supabase')>()
  return { ...actual, getSessionIdentity: vi.fn() }
})

import { getSessionIdentity } from '../../lib/supabase'
import PanelSetupPage from '../../pages/PanelSetupPage'
import ParticipantPacketPage from '../../pages/ParticipantPacketPage'
import { participantLink, type OpenPacket } from '../collabService'
import {
  __resetParticipantTokenForTests,
  getParticipantToken,
  setParticipantToken,
} from '../participantToken'
import { typography } from '../../styles/typography'

const ROUND_ID = 'rnd-friction-1111-2222-3333'
const SCENARIO_ID = 'scn-friction-4444-5555-6666'
const PACKET_URL = `/bff/collab/packet/${ROUND_ID}`
const MINT_URL = '/bff/collab/rounds'

/** Distinctive on purpose: an assertion naming these cannot be met by chance. */
const GOOD_CODE = 'CODE-THAT-WORKS-a1b2c3'
const BAD_CODE = 'CODE-THAT-DOES-NOT-WORK-zzzz'
const OWNER_TOKEN = 'owner-access-token-friction-IDENTITY'

/** The exact sentence the collab seam mints for a credential refusal. Written
 *  here from the user's side, deliberately NOT imported from the product — a
 *  guard that imports its own expectation only proves the code agrees with
 *  itself. */
const SIGN_IN_COPY = 'Sign in again to open or close a round.'

type StubResponse = Pick<Response, 'ok' | 'status' | 'json'>

let fetchMock: Mock<[input: RequestInfo | URL, init?: RequestInit], Promise<StubResponse>>

function jsonResponse(body: unknown, status = 200): StubResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

const OPEN_PACKET: OpenPacket = {
  round_id: ROUND_ID,
  status: 'open',
  context_note: 'We are deciding whether to raise the price.',
  graph_version_ref: 'gv-1',
  targets: [
    {
      target: { kind: 'factor', id: 'factor-churn-risk' },
      label: 'Churn risk after a price rise',
      description: 'How likely is it that churn goes up?',
      unit: null,
    },
  ],
  self: { participant_id: 'p-a', display_name: 'Ada', completed_target_ids: [] },
}

function renderParticipant(): void {
  render(
    <MemoryRouter initialEntries={[`/panel/${ROUND_ID}`]}>
      <Routes>
        <Route path="/panel/:round_id" element={<ParticipantPacketPage />} />
      </Routes>
    </MemoryRouter>,
  )
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

async function mintARound(): Promise<void> {
  fireEvent.change(screen.getByTestId('panel-target-id'), { target: { value: 'factor-churn' } })
  fireEvent.change(screen.getByTestId('panel-name-a'), { target: { value: 'Ada' } })
  fireEvent.change(screen.getByTestId('panel-name-b'), { target: { value: 'Grace' } })
  fireEvent.click(screen.getByTestId('panel-mint'))
  await waitFor(() => expect(screen.getByTestId('panel-close')).toBeInTheDocument())
}

/** True only when EVERY class in a design-system token is applied. */
function carriesToken(el: Element, token: string): boolean {
  return token.split(/\s+/).filter(Boolean).every((c) => el.classList.contains(c))
}

beforeEach(() => {
  __resetParticipantTokenForTests()
  fetchMock = vi.fn(async (input: RequestInfo | URL) =>
    jsonResponse({ code: 'not_stubbed', message: String(input) }, 404),
  )
  vi.stubGlobal('fetch', fetchMock)
  vi.mocked(getSessionIdentity).mockResolvedValue({ userId: 'user-abc', accessToken: OWNER_TOKEN })
})

afterEach(() => {
  vi.unstubAllGlobals()
  __resetParticipantTokenForTests()
})

/* ══ F2 — a rejected code must be recoverable IN PLACE ═════════════════════ */

describe('F2: a participant who mistypes their code is not trapped', () => {
  beforeEach(() => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === PACKET_URL) {
        return jsonResponse(
          { code: 'collab_token_invalid', message: 'That token could not be verified.' },
          401,
        )
      }
      return jsonResponse({ code: 'not_stubbed', message: String(input) }, 404)
    })
  })

  it('offers a way back to the code entry form, and clearing actually drops the token', async () => {
    setParticipantToken(BAD_CODE)
    renderParticipant()

    await waitFor(() => expect(screen.getByTestId('packet-error')).toBeInTheDocument())

    // THE AFFORDANCE ITSELF. Before this lane there was none: the entry form
    // rendered only while no token was held, so a held-but-rejected token was
    // a dead end that only a full page reload escaped.
    fireEvent.click(screen.getByTestId('packet-reenter-code'))

    expect(screen.getByTestId('packet-manual-token')).toBeInTheDocument()
    // Not merely a re-rendered form: the rejected credential is GONE, so the
    // next request cannot re-send it.
    expect(getParticipantToken()).toBeNull()
  })

  it('the second, correct code is the one that goes on the wire', async () => {
    setParticipantToken(BAD_CODE)
    renderParticipant()
    await waitFor(() => expect(screen.getByTestId('packet-error')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('packet-reenter-code'))

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === PACKET_URL) return jsonResponse(OPEN_PACKET)
      return jsonResponse({ code: 'not_stubbed', message: String(input) }, 404)
    })
    fireEvent.change(screen.getByTestId('packet-manual-token'), { target: { value: GOOD_CODE } })
    fireEvent.click(screen.getByTestId('packet-manual-continue'))

    await waitFor(() => expect(screen.getByTestId('participant-packet-page')).toBeInTheDocument())

    const packetCalls = fetchMock.mock.calls.filter((c) => String(c[0]) === PACKET_URL)
    const last = packetCalls[packetCalls.length - 1]
    const header = new Headers((last[1] ?? {}).headers).get('x-collab-participant-token')
    // IDENTITY, both ways: the good code went, and the rejected one did not
    // survive as a stale header on the retry.
    expect(header).toBe(GOOD_CODE)
    expect(header).not.toBe(BAD_CODE)
  })

  it('the failure says what to do next rather than repeating the wire sentence alone', async () => {
    setParticipantToken(BAD_CODE)
    renderParticipant()
    await waitFor(() => expect(screen.getByTestId('packet-error')).toBeInTheDocument())

    expect(screen.getByTestId('packet-error-guidance')).toBeInTheDocument()
    expect(screen.getByTestId('packet-error')).toHaveTextContent(/access code/i)
  })
})

/* ══ F3 — "Continue" must not be a dead control ════════════════════════════ */

describe('F3: the code entry form gives feedback instead of doing nothing', () => {
  it('Continue is disabled until there is something to submit', () => {
    renderParticipant()
    const button = screen.getByTestId('packet-manual-continue')
    const field = screen.getByTestId('packet-manual-token')

    expect(button).toBeDisabled()
    fireEvent.change(field, { target: { value: '    ' } })
    expect(button).toBeDisabled()
    fireEvent.change(field, { target: { value: GOOD_CODE } })
    expect(button).toBeEnabled()
  })

  it('a pasted link that lost its code is refused HERE, with the reason, and nothing is sent', () => {
    renderParticipant()
    fireEvent.change(screen.getByTestId('packet-manual-token'), {
      target: { value: 'https://app.example.com/#/panel/rnd-abc' },
    })
    fireEvent.click(screen.getByTestId('packet-manual-continue'))

    expect(screen.getByTestId('packet-manual-token-error')).toHaveTextContent(/access code/i)
    // The whole URL must not be adopted AS the code — that is what turned a
    // trimmed link into an unexplained server refusal eight seconds later.
    expect(getParticipantToken()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('DIFFERENT OBJECT: a pasted link that DOES carry a code is accepted, code extracted', async () => {
    // The opposite-direction twin. Without it the refusal above could be a
    // predicate that rejects every link, which would be a worse defect than
    // the one it replaces.
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === PACKET_URL) return jsonResponse(OPEN_PACKET)
      return jsonResponse({ code: 'not_stubbed', message: String(input) }, 404)
    })
    renderParticipant()
    fireEvent.change(screen.getByTestId('packet-manual-token'), {
      target: { value: `https://app.example.com/?ct=${GOOD_CODE}#/panel/${ROUND_ID}` },
    })
    fireEvent.click(screen.getByTestId('packet-manual-continue'))

    await waitFor(() => expect(screen.getByTestId('participant-packet-page')).toBeInTheDocument())
    expect(getParticipantToken()).toBe(GOOD_CODE)
    expect(screen.queryByTestId('packet-manual-token-error')).toBeNull()
  })
})

/* ══ F4 / F5 — the owner is told what is happening, and what to do ═════════ */

describe('F4: the owner sees that the round is being opened', () => {
  it('a busy state is shown while the request is in flight, and cleared after', async () => {
    let release: (() => void) | null = null
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === MINT_URL) {
        await gate
        return jsonResponse({
          round_id: ROUND_ID,
          graph_version_ref: 'gv-1',
          participants: [
            { participant_id: 'p-a', display_name: 'Ada', token: 'tok-a' },
            { participant_id: 'p-b', display_name: 'Grace', token: 'tok-b' },
          ],
        })
      }
      return jsonResponse({ code: 'not_stubbed', message: String(input) }, 404)
    })

    renderOwnerPanel()
    fireEvent.change(screen.getByTestId('panel-target-id'), { target: { value: 'factor-churn' } })
    fireEvent.change(screen.getByTestId('panel-name-a'), { target: { value: 'Ada' } })
    fireEvent.click(screen.getByTestId('panel-mint'))

    // THE MISSING SIGNAL. Eight seconds of a page that looks broken is the
    // finding; this is the affordance that answers it.
    await waitFor(() => expect(screen.getByTestId('panel-busy')).toBeInTheDocument())
    expect(screen.getByTestId('panel-busy')).toHaveTextContent(/opening the round/i)
    expect(screen.getByTestId('panel-mint')).toBeDisabled()

    ;(release as unknown as () => void)()
    await waitFor(() => expect(screen.getByTestId('panel-close')).toBeInTheDocument())
    expect(screen.queryByTestId('panel-busy')).toBeNull()
  })
})

describe('F4/F5: a failure is translated into human copy with a next step', () => {
  it('a credential refusal keeps the sentence AND offers the way to act on it', async () => {
    vi.mocked(getSessionIdentity).mockResolvedValue({ userId: null, accessToken: null })
    renderOwnerPanel()
    fireEvent.change(screen.getByTestId('panel-target-id'), { target: { value: 'factor-churn' } })
    fireEvent.click(screen.getByTestId('panel-mint'))

    await waitFor(() => expect(screen.getByTestId('panel-error')).toBeInTheDocument())
    expect(screen.getByTestId('panel-error')).toHaveTextContent(SIGN_IN_COPY)
    expect(screen.getByTestId('panel-error-guidance')).toBeInTheDocument()

    // F5: the affordance the message presupposed but never provided.
    // ⚠ Matched by SUFFIX, not equality: the deployed app is a HashRouter, so
    // the real anchor reads `#/login` while MemoryRouter renders `/login`. An
    // equality assertion here would be a claim about the TEST's router.
    expect(screen.getByTestId('panel-sign-in').getAttribute('href')).toMatch(/\/login$/)
  })

  it("a 401 from the server is treated as a credential failure, not as CEE's raw sentence", async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === MINT_URL) {
        return jsonResponse(
          { code: 'collab_token_invalid', message: 'That token could not be verified.' },
          401,
        )
      }
      return jsonResponse({ code: 'not_stubbed', message: String(input) }, 404)
    })
    renderOwnerPanel()
    fireEvent.change(screen.getByTestId('panel-target-id'), { target: { value: 'factor-churn' } })
    fireEvent.click(screen.getByTestId('panel-mint'))

    await waitFor(() => expect(screen.getByTestId('panel-error')).toBeInTheDocument())
    expect(screen.getByTestId('panel-error')).toHaveTextContent(SIGN_IN_COPY)
    expect(screen.getByTestId('panel-sign-in')).toBeInTheDocument()
  })

  it('DIFFERENT OBJECT: an ordinary failure gets its own copy and NO sign-in link', async () => {
    // The opposite-direction twin: a predicate that routed every failure to
    // "sign in again" would pass the two tests above and be a lie on this one.
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === MINT_URL) {
        return jsonResponse(
          { code: 'collab_round_invalid', message: 'targets[0].id is not a known factor' },
          422,
        )
      }
      return jsonResponse({ code: 'not_stubbed', message: String(input) }, 404)
    })
    renderOwnerPanel()
    fireEvent.change(screen.getByTestId('panel-target-id'), { target: { value: 'factor-churn' } })
    fireEvent.click(screen.getByTestId('panel-mint'))

    await waitFor(() => expect(screen.getByTestId('panel-error')).toBeInTheDocument())
    expect(screen.getByTestId('panel-error')).toHaveTextContent(/could not open the round/i)
    expect(screen.getByTestId('panel-error-guidance')).toBeInTheDocument()
    expect(screen.queryByTestId('panel-sign-in')).toBeNull()
  })
})

/* ══ F7 — one-shot links need a copy button ════════════════════════════════ */

describe('F7: each one-shot link can be copied, and says it was', () => {
  let writeText: Mock<[text: string], Promise<void>>

  beforeEach(() => {
    writeText = vi.fn(async (text: string) => {
      // The write itself is not under test — WHICH link reaches it is.
      void text
    })
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    })
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === MINT_URL) {
        return jsonResponse({
          round_id: ROUND_ID,
          graph_version_ref: 'gv-1',
          participants: [
            { participant_id: 'p-a', display_name: 'Ada', token: 'tok-a' },
            { participant_id: 'p-b', display_name: 'Grace', token: 'tok-b' },
          ],
        })
      }
      return jsonResponse({ code: 'not_stubbed', message: String(input) }, 404)
    })
  })

  it("copies THAT participant's link — and leaves the other one alone", async () => {
    renderOwnerPanel()
    await mintARound()

    fireEvent.click(screen.getByTestId('panel-copy-p-b'))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    // Bound by identity to Grace's token, not to "a link was copied": the two
    // rows are deliberately different objects and either could satisfy a
    // looser predicate.
    expect(writeText).toHaveBeenCalledWith(participantLink(ROUND_ID, 'tok-b'))
    expect(writeText).not.toHaveBeenCalledWith(participantLink(ROUND_ID, 'tok-a'))

    await waitFor(() => expect(screen.getByTestId('panel-copied-p-b')).toBeInTheDocument())
    // DISCRIMINATION: the confirmation belongs to the row that was clicked.
    expect(screen.queryByTestId('panel-copied-p-a')).toBeNull()
  })
})

/* ══ F1 — the design system is applied, on the mounted surfaces ════════════ */

describe('F1: both surfaces carry the design system (NOT a claim about layout)', () => {
  /**
   * ⚠ SCOPE. jsdom computes no layout, so none of this is evidence about
   * hierarchy, spacing, contrast or focus rings — the very things the witness
   * measured. It asserts only that DS tokens are APPLIED, and that the surface
   * carrying them is the one the deployed app mounts. The layout claim belongs
   * to the browser witness that follows the deploy.
   */
  it('POSITIVE CONTROL: the token detector can tell applied from unapplied', () => {
    const el = document.createElement('div')
    el.className = 'bg-canvas min-h-screen'
    expect(carriesToken(el, 'bg-canvas')).toBe(true)
    expect(carriesToken(el, 'text-3xl font-semibold')).toBe(false)
  })

  it('the participant page root is a styled surface, not a bare <main>', async () => {
    setParticipantToken(GOOD_CODE)
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === PACKET_URL) return jsonResponse(OPEN_PACKET)
      return jsonResponse({ code: 'not_stubbed', message: String(input) }, 404)
    })
    renderParticipant()

    const root = await screen.findByTestId('participant-packet-page')
    expect(root.className.trim()).not.toBe('')
    expect(carriesToken(root, 'bg-canvas')).toBe(true)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(carriesToken(heading, typography.h2)).toBe(true)
  })

  it('the code entry form is styled too — it is the first thing a participant sees', () => {
    renderParticipant()
    const root = screen.getByTestId('packet-token-entry')
    expect(carriesToken(root, 'bg-canvas')).toBe(true)
    const field = screen.getByTestId('packet-manual-token')
    expect(carriesToken(field, 'border')).toBe(true)
    // The witness measured `border: 0; padding: 0` on this exact input.
    expect(field.className).toMatch(/\bpx-/)
  })

  it('the owner page root is a styled surface, not a bare <main>', () => {
    renderOwnerPanel()
    const root = screen.getByTestId('panel-setup-page')
    expect(root.className.trim()).not.toBe('')
    expect(carriesToken(root, 'bg-canvas')).toBe(true)

    const heading = screen.getByRole('heading', { level: 1 })
    expect(carriesToken(heading, typography.h2)).toBe(true)
  })

  it("the owner's five fields are labelled controls, not a run-on wall", () => {
    renderOwnerPanel()
    // Each field is reachable BY ITS OWN accessible name. A label that merely
    // wraps an input satisfies nothing here if the association is lost.
    for (const name of [
      /which factor should they estimate/i,
      /how should it be described to them/i,
      /anything they should know first/i,
      /first person/i,
      /second person/i,
    ]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument()
    }
  })

  it('MOUNT PATH: the deployed app mounts exactly these two components at these two paths', () => {
    // Trap 3b: a green suite says nothing about a component the deployment
    // does not render. This binds the styling claim above to the real routes.
    const appSrc = readFileSync(resolve(process.cwd(), 'src/poc/AppPoC.tsx'), 'utf8')
    expect(appSrc).toContain('path="/panel/:round_id" element={<ParticipantPacketPage />}')
    expect(appSrc).toContain('path="/scenario/:id/panel" element={<PanelSetupPage />}')
  })
})
