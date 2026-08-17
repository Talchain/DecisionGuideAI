/**
 * COLLAB — THE FRONT DOOR MUST NOT ASSERT A SESSION THAT NEVER EXISTED.
 *
 * ── THE LIE THIS PINS, WIRE- AND BROWSER-WITNESSED ────────────────────────
 * Deployed staging `81b5c966`, 17 Aug 2026, fresh context / no storage / no
 * session (`olumi-docs/witness-collab-2026-08-17/dom/S4-owner-mint-refusal.txt`):
 * a visitor with NO ACCOUNT filled the whole owner panel form, clicked "Open
 * the round", and read
 *
 *     "Sign in again to open or close a round."
 *     "Your session has ended. Sign in again in the new tab, then come back
 *      here and try again — what you have typed on this page is kept."
 *
 * They had no session. Nothing ended. And this was NOT a 401 being described:
 * the capture's `S4.network.json` is `[]` — **ZERO `/bff/collab` requests** —
 * so no server ever spoke about any session. The client asserted a state it
 * had not observed.
 *
 * ── WHY IT SHIPPED: TWO QUESTIONS UNDER ONE NAME (trap 21) ────────────────
 * `describeOwnerFailure`'s own header named the two producers apart —
 * "`sign_in_required` (minted locally, before any request leaves) OR an HTTP
 * 401 (the server declining the bearer)" — and then answered them in ONE
 * branch, with copy true only of the second. Both arrived carrying the same
 * code and the same status, so nothing downstream could tell them apart.
 *
 * The two questions:
 *   • "does this browser hold a credential to send?"  — answered locally, by
 *     `requireOwnerAccessToken` / `ownerAuthorization`. No request is made, and
 *     the client learns NOTHING about whether a session ever existed.
 *   • "did the server accept the credential we sent?"  — answered by the wire.
 *     A 401 here means a non-empty bearer WAS sent and refused, so "your
 *     session has ended" is a statement the client observed.
 *
 * ── WHAT EACH TEST BINDS, AND WHY IT CANNOT PASS VACUOUSLY ────────────────
 * Every test PINS ITS OWN PRECONDITION (trap 13b): the never-signed-in tests
 * assert `/bff/collab` request count === 0 (the witnessed fact that makes the
 * claim about an unobserved session provable), and the wire twin asserts the
 * request count === 1 (the server DID speak). A guard that merely read copy
 * would pass on either branch once the strings happened to line up.
 *
 * Assertions bind to the rendered surface by identity — `panel-error`,
 * `panel-error-guidance`, `panel-sign-in` — never by "some text somewhere".
 * Expected copy is written here FROM THE USER'S SIDE, deliberately not
 * imported from the product: a guard that imports its own expectation only
 * proves the code agrees with itself.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../../lib/supabase', async (importOriginal) => {
  // Spread the real module rather than hand-list its exports (trap 12). It also
  // means this spec collects ONLY when the Supabase env vars are set — the
  // deliberate tripwire, since without them 24 spec files vanish from the run
  // while the total still prints green.
  const actual = await importOriginal<typeof import('../../lib/supabase')>()
  return { ...actual, getSessionIdentity: vi.fn() }
})

import { getSessionIdentity } from '../../lib/supabase'
import PanelSetupPage, { describeOwnerFailure } from '../../pages/PanelSetupPage'
import { CollabRequestError, ownerNotSignedIn, ownerSignInRequired } from '../collabService'

const SCENARIO_ID = 'scn-firstsession-9f2a'
const OWNER_TOKEN = 'owner-access-token-firstsession-IDENTITY'
const TYPED_FACTOR = 'factor-witness-probe-17aug'

/** The sentence a NEVER-SIGNED-IN visitor must NOT be told, in any form. */
const ENDED_CLAIMS = [/session has ended/i, /session has expired/i, /sign in again/i]

type StubResponse = Pick<Response, 'ok' | 'status' | 'json'>

let fetchMock: Mock<[input: RequestInfo | URL, init?: RequestInit], Promise<StubResponse>>

function jsonResponse(body: unknown, status = 200): StubResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
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

/** Exactly the witnessed interaction: fill the form, click "Open the round". */
function fillFormAndOpen(): void {
  fireEvent.change(screen.getByTestId('panel-target-id'), { target: { value: TYPED_FACTOR } })
  fireEvent.change(screen.getByTestId('panel-name-a'), { target: { value: 'Ada' } })
  fireEvent.change(screen.getByTestId('panel-name-b'), { target: { value: 'Grace' } })
  fireEvent.click(screen.getByTestId('panel-mint'))
}

function collabRequests(): Array<[RequestInfo | URL, RequestInit | undefined]> {
  return fetchMock.mock.calls.filter((c) => String(c[0]).startsWith('/bff/collab')) as Array<
    [RequestInfo | URL, RequestInit | undefined]
  >
}

beforeEach(() => {
  localStorage.clear()
  fetchMock = vi.fn(async (input: RequestInfo | URL) =>
    jsonResponse({ code: 'not_stubbed', message: String(input) }, 404),
  )
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('a visitor who never signed in is not told their session ended', () => {
  it('WITNESSED STATE: no session, form submitted → no request leaves, and the copy claims no session ever existed', async () => {
    // The witnessed state-class: fresh, never signed in. `getSessionIdentity`
    // returns nulls for "never signed in", for "the session is gone", and for
    // "getSession itself errored" alike — so the honest copy must be true of
    // all three, and may assert only what THIS CLIENT observed.
    vi.mocked(getSessionIdentity).mockResolvedValue({ userId: null, accessToken: null })

    renderOwnerPanel()
    fillFormAndOpen()

    await waitFor(() => expect(screen.getByTestId('panel-error')).toBeInTheDocument())

    // ⭐ THE PRECONDITION, PINNED IN-TEST. This is the witness's own decisive
    // measurement (`S4.network.json === []`). Without it the copy assertions
    // below would be a claim about strings; with it they are a claim about a
    // state the client provably never observed.
    expect(collabRequests()).toHaveLength(0)

    const guidance = screen.getByTestId('panel-error-guidance')
    for (const claim of ENDED_CLAIMS) {
      expect(guidance).not.toHaveTextContent(claim)
      // The headline carried the falsehood too — "Sign in AGAIN" asserts a
      // prior session just as much as the guidance does.
      expect(screen.getByTestId('panel-error')).not.toHaveTextContent(claim)
    }

    // POSITIVE HALF: an empty or vanished guidance would satisfy every
    // negative above. The copy must actually say the honest thing.
    expect(guidance).toHaveTextContent(/no signed-in session in this browser/i)
    expect(guidance).toHaveTextContent(/nothing was sent/i)
    expect(screen.getByTestId('panel-error')).toHaveTextContent(
      /sign in to open or close a round/i,
    )
  })

  it('the sign-in affordance is still rendered — this is an invitation, not a dead end', async () => {
    vi.mocked(getSessionIdentity).mockResolvedValue({ userId: null, accessToken: null })

    renderOwnerPanel()
    fillFormAndOpen()

    await waitFor(() => expect(screen.getByTestId('panel-error')).toBeInTheDocument())
    expect(screen.getByTestId('panel-sign-in')).toBeInTheDocument()
    // A credential refusal shows no server detail: there is no server sentence.
    expect(screen.queryByTestId('panel-error-detail')).toBeNull()
  })

  it('the promise the copy makes is kept: what was typed survives the refusal', async () => {
    vi.mocked(getSessionIdentity).mockResolvedValue({ userId: null, accessToken: null })

    renderOwnerPanel()
    fillFormAndOpen()

    await waitFor(() => expect(screen.getByTestId('panel-error')).toBeInTheDocument())
    // The guidance tells the visitor to come back and try again because their
    // typing is kept. A page that cleared the form would make it a second lie.
    expect(screen.getByTestId('panel-target-id')).toHaveValue(TYPED_FACTOR)
    expect(screen.getByTestId('panel-name-a')).toHaveValue('Ada')
  })
})

describe('DIFFERENT OBJECT: a wire 401 keeps the session-expired copy', () => {
  it('a bearer WAS sent and refused → "your session has ended" is a state the client observed', async () => {
    vi.mocked(getSessionIdentity).mockResolvedValue({
      userId: 'user-abc',
      accessToken: OWNER_TOKEN,
    })
    // CEE's own code for a refused owner bearer, measured on the deployed wire
    // (witness `probes/gate-probe.txt`, request A): 401 `sign_in_required`.
    fetchMock.mockImplementation(async (input) =>
      String(input) === '/bff/collab/rounds'
        ? jsonResponse(
            { code: 'sign_in_required', message: 'That token could not be verified.' },
            401,
          )
        : jsonResponse({ code: 'not_stubbed', message: String(input) }, 404),
    )

    renderOwnerPanel()
    fillFormAndOpen()

    await waitFor(() => expect(screen.getByTestId('panel-error')).toBeInTheDocument())

    // ⭐ THE MIRROR PRECONDITION: the request WAS issued with a real bearer, so
    // the server's refusal is an observation, not an inference. Bound to the
    // mint URL by identity, and to the exact token — "some call happened"
    // would be satisfied by the branch under test in the other describe.
    const sent = collabRequests()
    expect(sent).toHaveLength(1)
    expect(String(sent[0][0])).toBe('/bff/collab/rounds')
    expect(
      (sent[0][1]?.headers as Record<string, string> | undefined)?.Authorization,
    ).toBe(`Bearer ${OWNER_TOKEN}`)

    expect(screen.getByTestId('panel-error-guidance')).toHaveTextContent(
      /your session has ended\. sign in again/i,
    )
    expect(screen.getByTestId('panel-sign-in')).toBeInTheDocument()
  })
})

describe('THE PAIR: the two answers are not the same answer', () => {
  it('the never-signed-in copy and the wire-401 copy differ, in headline and in guidance', async () => {
    vi.mocked(getSessionIdentity).mockResolvedValue({ userId: null, accessToken: null })
    renderOwnerPanel()
    fillFormAndOpen()
    await waitFor(() => expect(screen.getByTestId('panel-error')).toBeInTheDocument())
    const localTitle = screen.getByTestId('panel-error').textContent ?? ''
    const localGuidance = screen.getByTestId('panel-error-guidance').textContent ?? ''

    // A second, independent mount for the wire branch: re-collapsing the two
    // branches makes these four strings equal, and THAT is what this asserts —
    // directly, rather than through either branch's own copy. `cleanup()`
    // unmounts the first tree properly; detaching the node by hand left React
    // committing into an orphan and threw inside the router.
    cleanup()
    vi.mocked(getSessionIdentity).mockResolvedValue({
      userId: 'user-abc',
      accessToken: OWNER_TOKEN,
    })
    fetchMock.mockImplementation(async (input) =>
      String(input) === '/bff/collab/rounds'
        ? jsonResponse(
            { code: 'sign_in_required', message: 'That token could not be verified.' },
            401,
          )
        : jsonResponse({ code: 'not_stubbed', message: String(input) }, 404),
    )
    renderOwnerPanel()
    fillFormAndOpen()
    await waitFor(() => expect(screen.getByTestId('panel-error')).toBeInTheDocument())
    const wireTitle = screen.getByTestId('panel-error').textContent ?? ''
    const wireGuidance = screen.getByTestId('panel-error-guidance').textContent ?? ''

    expect(localGuidance).not.toBe('')
    expect(wireGuidance).not.toBe('')
    expect(localGuidance).not.toBe(wireGuidance)
    expect(localTitle).not.toBe(wireTitle)
  })
})

/* ══ THE STRUCTURAL HALF ═══════════════════════════════════════════════════
 * P5 is structural, not advisory: the product may not assert a state it did not
 * observe, and a contradicting signal in the same payload must make the claim
 * IMPOSSIBLE. The three tests above bind the two branches a user reaches today.
 * They cannot stop a THIRD branch, added next month, retyping the sentence.
 *
 * This block can. It walks the predicate's WHOLE DOMAIN and asserts the rule as
 * a property: no failure that lacks a server answer may carry session-history
 * language. Because `observation` is a REQUIRED field, a new branch cannot dodge
 * it — declaring `nothing-was-sent` or `unknown` enrols it in this invariant
 * automatically, and declaring `server-answered` falsely is itself caught below
 * by comparing the declaration against the error's own provenance.
 *
 * ⚠ THE PREDICATE OVER LANGUAGE IS THE RISK HERE (trap 22), so it is bounded
 * three ways: the patterns match session-HISTORY PHRASES, never bare words
 * ("try again" is honest and appears in copy that must pass); the corpus comes
 * from outside this author — the two sentences the DEPLOYED build emitted, plus
 * the wire codes the estate's other specs and the live gate probe have actually
 * produced; and every case has its opposite-direction twin, since the detector
 * must both find the claim where it belongs and miss it where it does not.
 */

/** Phrases that CLAIM a session existed and has now ended. */
const SESSION_HISTORY_CLAIMS: ReadonlyArray<RegExp> = [
  /sign(?:ed|ing)?[- ]in again/i,
  /sign in again/i,
  /session (?:has |had |is )?(?:ended|expired|timed out|over|no longer valid)/i,
  /(?:signed|logged) out/i,
  /your session/i,
]

function claimsSessionHistory(text: string): boolean {
  return SESSION_HISTORY_CLAIMS.some((p) => p.test(text))
}

/** A wire failure exactly as `parseError` builds one from a real response. */
function wireError(code: string, status: number, message: string): CollabRequestError {
  return new CollabRequestError({ code, message, status })
}

/**
 * The domain, with each member's TRUE provenance stated independently of what
 * the product declares — that independence is what lets the declaration be
 * checked rather than trusted.
 *
 * The wire members are the codes this estate has actually observed: CEE's live
 * `sign_in_required` / `collab_token_invalid` (17 Aug gate probe, requests A and
 * C), `collab_owner_only` and the caller-key `FORBIDDEN` (403 spec),
 * `collab_round_open` / `collab_round_closed` (close-copy spec),
 * `collab_round_invalid` (friction spec), `expired_token`, `parseError`'s own
 * `collab_request_failed` default for a non-JSON body, and a code-less 502 from
 * the edge.
 */
const DOMAIN: ReadonlyArray<{
  name: string
  err: unknown
  /** What actually happened, derived from the producer — not read off the result. */
  truth: 'server-answered' | 'nothing-was-sent' | 'unknown'
}> = [
  // Minted by the seam itself, so this member cannot drift from the product.
  { name: 'local mint: ownerNotSignedIn()', err: ownerNotSignedIn(), truth: 'nothing-was-sent' },
  { name: 'wire 401 sign_in_required', err: ownerSignInRequired(), truth: 'server-answered' },
  {
    name: 'wire 401 collab_token_invalid',
    err: wireError('collab_token_invalid', 401, 'That token could not be verified.'),
    truth: 'server-answered',
  },
  {
    name: 'wire 401 expired_token',
    err: wireError('expired_token', 401, 'Your session has expired. Sign in again and retry.'),
    truth: 'server-answered',
  },
  {
    name: 'wire 403 collab_owner_only',
    err: wireError('collab_owner_only', 403, 'No round you own with that id.'),
    truth: 'server-answered',
  },
  {
    name: 'wire 403 FORBIDDEN (caller-key plugin)',
    err: wireError('FORBIDDEN', 403, 'Forbidden'),
    truth: 'server-answered',
  },
  {
    name: 'wire 409 collab_round_open',
    err: wireError('collab_round_open', 409, 'The round is still open.'),
    truth: 'server-answered',
  },
  {
    name: 'wire 409 collab_round_closed',
    err: wireError('collab_round_closed', 409, 'That round is closed.'),
    truth: 'server-answered',
  },
  {
    name: 'wire 422 collab_round_invalid',
    err: wireError('collab_round_invalid', 422, 'targets[0].id is not a known factor'),
    truth: 'server-answered',
  },
  {
    name: 'wire 500 collab_request_failed (parseError default, non-JSON body)',
    err: wireError('collab_request_failed', 500, 'Something went wrong. Please try again.'),
    truth: 'server-answered',
  },
  {
    name: 'wire 429 with an unknown code',
    err: wireError('rate_limited', 429, 'Too many requests.'),
    truth: 'server-answered',
  },
  {
    name: 'wire 502 code-less origin refusal',
    err: wireError('collab_request_failed', 502, 'Bad gateway'),
    truth: 'server-answered',
  },
  // Not a CollabRequestError at all: a rejected fetch (offline / CORS), and a
  // JSON parse failure. Neither tells the client whether anything was answered.
  { name: 'rejected fetch (TypeError)', err: new TypeError('Failed to fetch'), truth: 'unknown' },
  { name: 'JSON parse failure', err: new SyntaxError('Unexpected end of JSON input'), truth: 'unknown' },
  { name: 'a thrown non-Error', err: 'something odd', truth: 'unknown' },
]

describe('STRUCTURAL: no failure without a server answer may claim a session ended', () => {
  it('POSITIVE CONTROL: the detector finds the claim in the exact sentences the deployed build emitted', () => {
    // Without this, every negative assertion below could be passing because the
    // patterns match nothing at all. These two strings are the witness's own
    // capture from deployed `81b5c966`.
    expect(claimsSessionHistory('Sign in again to open or close a round.')).toBe(true)
    expect(
      claimsSessionHistory(
        'Your session has ended. Sign in again in the new tab, then come back here and try again — what you have typed on this page is kept.',
      ),
    ).toBe(true)
  })

  it('CONTRAST CONTROL: the detector does NOT fire on honest copy that merely says "try again"', () => {
    // The opposite direction, and the reason the patterns are phrases: a
    // detector that matched the bare word "again" would condemn every honest
    // retry sentence in this file, and a lane would then loosen it to nothing.
    expect(
      claimsSessionHistory(
        'We found no signed-in session in this browser, so nothing was sent. Sign in in the new tab, then come back here and try again — what you have typed on this page is kept.',
      ),
    ).toBe(false)
    expect(
      claimsSessionHistory(
        'Something went wrong before we heard back. Check your connection and try again — nothing has been sent to anyone.',
      ),
    ).toBe(false)
    expect(
      claimsSessionHistory(
        'The round is still open. Try again in a moment — nobody has seen anything they should not.',
      ),
    ).toBe(false)
  })

  it('the domain corpus is non-empty and covers both non-answered provenances', () => {
    // An empty or single-provenance corpus would make the property vacuous.
    expect(DOMAIN.length).toBeGreaterThanOrEqual(15)
    expect(DOMAIN.filter((d) => d.truth === 'nothing-was-sent').length).toBeGreaterThanOrEqual(1)
    expect(DOMAIN.filter((d) => d.truth === 'unknown').length).toBeGreaterThanOrEqual(3)
    expect(DOMAIN.filter((d) => d.truth === 'server-answered').length).toBeGreaterThanOrEqual(10)
  })

  it.each(['open', 'close'] as const)(
    'action=%s — every branch declares its provenance TRUTHFULLY, and only an answered one may name a session',
    (action) => {
      for (const member of DOMAIN) {
        const failure = describeOwnerFailure(member.err, action)

        // 1. THE DECLARATION IS CHECKED, NOT TRUSTED. Re-collapsing the two
        //    credential branches routes the local mint into the wire branch,
        //    which declares `server-answered` — and this comparison REDs on it
        //    even before any copy is read.
        expect(failure.observation, `${member.name} declared the wrong provenance`).toBe(
          member.truth,
        )

        // 2. Nothing may be empty: a blank title or guidance would satisfy
        //    every negative below by saying nothing at all.
        expect(failure.title.trim(), `${member.name} title`).not.toBe('')
        expect(failure.guidance.trim(), `${member.name} guidance`).not.toBe('')

        if (member.truth === 'server-answered') continue

        // 3. THE PROPERTY. No session-history claim anywhere a user can read it.
        expect(
          claimsSessionHistory(failure.title),
          `${member.name}: title claims a session ended without one being observed`,
        ).toBe(false)
        expect(
          claimsSessionHistory(failure.guidance),
          `${member.name}: guidance claims a session ended without one being observed`,
        ).toBe(false)
        expect(
          claimsSessionHistory(failure.detail ?? ''),
          `${member.name}: detail claims a session ended without one being observed`,
        ).toBe(false)

        // 4. A SERVER'S WORDS CANNOT BE QUOTED IF NO SERVER SPOKE.
        expect(failure.detail, `${member.name} must carry no server detail`).toBeNull()
      }
    },
  )

  it('DISCRIMINATION: the invariant is not vacuous — the answered branches DO name a session', () => {
    // If the property above held for every member, it would prove nothing about
    // the discrimination. The wire-401 branch must still say "again": that is
    // where the sentence is TRUE, and a fix that scrubbed it everywhere would
    // have traded a lie for a different lie.
    const wire = describeOwnerFailure(ownerSignInRequired(), 'open')
    expect(wire.observation).toBe('server-answered')
    expect(claimsSessionHistory(wire.title) || claimsSessionHistory(wire.guidance)).toBe(true)
  })
})
