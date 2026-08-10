/**
 * COLLAB — the OWNER'S BEARER, asserted ON THE WIRE.
 *
 * ── THE DEFECT THIS PINS ──────────────────────────────────────────────────
 * `PanelSetupPage` read its token as
 *
 *     const { session } = useAuth() as { session?: { access_token?: string } | null }
 *     const accessToken = session?.access_token ?? ''
 *
 * `AuthContext` has NO `session` member — `handleAuthStateChange` receives the
 * session and keeps only `session.user`. So `accessToken` was ALWAYS `''`, and
 * every owner call shipped `Authorization: "Bearer "`. CEE answers that with
 * HTTP 401 `sign_in_required`, byte-identical to sending no header at all, so
 * mint / close / reveal were unreachable for a signed-in owner: the whole
 * two-person panel journey could not start.
 *
 * The `as` cast is WHY TYPESCRIPT NEVER SAW IT. A cast asserts a shape onto a
 * value that does not have it, and `?? ''` then turned "absent" into a value
 * the type system is perfectly happy with.
 *
 * ── WHY THESE ASSERTIONS LOOK THE WAY THEY DO ─────────────────────────────
 * Every header assertion names the EXACT token the session seam returned.
 * `expect(auth).not.toBe('Bearer ')` would pass on a header carrying the WRONG
 * token, which is the same defect one step along — so the mutant that swaps in
 * a different non-empty token must RED, and it does.
 *
 * Each request is selected BY ITS OWN URL, never by "some call had the header":
 * the mint assertion cannot be satisfied by the close request and vice versa.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

vi.mock('../../lib/supabase', async (importOriginal) => {
  // Spread the real module rather than hand-listing its exports: a hand-listed
  // mock factory REPLACES the module, so every export added later goes silently
  // missing. (It also means this spec collects only when the Supabase env vars
  // are set — a deliberate tripwire, since without them 24 spec files vanish
  // from the run while the total still prints green.)
  const actual = await importOriginal<typeof import('../../lib/supabase')>()
  return { ...actual, getSessionIdentity: vi.fn() }
})

import { getSessionIdentity } from '../../lib/supabase'
import PanelSetupPage from '../../pages/PanelSetupPage'
import { CollabRequestError, closeRound, fetchOwnerReveal, mintRound } from '../collabService'

/**
 * The path the DEPLOYED app declares for the owner's page. Bound to
 * `AppPoC.tsx` by the mount-path test below, so a route rename fails loud here
 * rather than leaving these tests green about a surface nobody can reach.
 */
const OWNER_ROUTE_PATH = '/scenario/:id/panel'

/** Distinctive on purpose: an assertion that names it cannot be met by chance. */
const OWNER_TOKEN = 'owner-access-token-9d4f1c-IDENTITY'
const OTHER_TOKEN = 'participant-token-DIFFERENT-OBJECT'
const SCENARIO_ID = 'scn-11111111-2222-3333-4444-555555555555'
const ROUND_ID = 'rnd-66666666-7777-8888-9999-aaaaaaaaaaaa'

/** The exact sentence a signed-out owner must see. Written here from the
 *  user's side, deliberately NOT imported from the product — a guard that
 *  imports its own expectation only proves the code agrees with itself. */
const SIGN_IN_COPY = 'Sign in again to open or close a round.'

const MINT_URL = '/bff/collab/rounds'
const CLOSE_URL = `/bff/collab/rounds/${ROUND_ID}/close`
const REVEAL_URL = `/bff/collab/rounds/${ROUND_ID}/reveal`

/** Only the three members the collab seam touches; typed as such, so this stub
 *  never quietly claims to be a whole `Response` behind a cast — which is the
 *  very move that produced the defect this file pins. */
type StubResponse = Pick<Response, 'ok' | 'status' | 'json'>

let fetchMock: Mock<[input: RequestInfo | URL, init?: RequestInit], Promise<StubResponse>>

/* ── source-level helpers ─────────────────────────────────────────────────
 * These measure CODE, never the prose that explains the defect — this file's
 * own headers spell `useAuth()` and the cast, and an earlier version of the
 * detector below duly reported the explanation as a defect. Every test using
 * them carries a positive control, because a stripper that ate the file and a
 * walker that resolved nothing both look exactly like a clean result.
 */

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

/** Every TS/TSX file under src/, repo-relative. */
function srcFiles(): string[] {
  return readdirSync(resolve(process.cwd(), 'src'), { recursive: true, encoding: 'utf8' })
    .filter((p) => /\.(ts|tsx)$/.test(p))
    .map((p) => `src/${p}`)
}

/** `from '…'`, `import('…')` and `require('…')` alike — a guard that matched
 *  only the static form was proven evadable by both of the other two. */
const MODULE_SPEC =
  /(?:from\s*['"]([^'"]+)['"])|(?:\bimport\(\s*['"]([^'"]+)['"]\s*\))|(?:\brequire\(\s*['"]([^'"]+)['"]\s*\))/g

function resolveSpec(fromFile: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = join('src', spec.slice(2))
  else if (spec.startsWith('.')) base = join(dirname(fromFile), spec)
  else return null // a bare package specifier — not part of this repo's graph
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(c) && statSync(c).isFile()) return c
  }
  return null
}

/** Transitive closure over relative imports. Catches the re-export barrel that
 *  a single-file text match cannot see. NOT a statement about any bundle. */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>()
  const queue: string[] = [entry]
  while (queue.length > 0) {
    const file = queue.shift() as string
    if (seen.has(file)) continue
    seen.add(file)
    const code = stripComments(readFileSync(resolve(process.cwd(), file), 'utf8'))
    for (const m of code.matchAll(MODULE_SPEC)) {
      const spec = m[1] ?? m[2] ?? m[3]
      if (spec === undefined) continue
      const next = resolveSpec(file, spec)
      if (next !== null && !seen.has(next)) queue.push(next)
    }
  }
  return seen
}

function jsonResponse(body: unknown, status = 200): StubResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

function collabCalls(url: string): Array<[string, RequestInit]> {
  return fetchMock.mock.calls
    .filter((c) => String(c[0]) === url)
    .map((c): [string, RequestInit] => [String(c[0]), c[1] ?? {}])
}

function authorizationFor(url: string): string | null {
  const calls = collabCalls(url)
  expect(calls.length, `exactly one request to ${url} must have been issued`).toBe(1)
  return new Headers(calls[0][1].headers).get('authorization')
}

function renderOwnerPanel(): void {
  render(
    <MemoryRouter initialEntries={[`/scenario/${SCENARIO_ID}/panel`]}>
      <Routes>
        <Route path={OWNER_ROUTE_PATH} element={<PanelSetupPage />} />
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

beforeEach(() => {
  fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input)
    if (url === MINT_URL) {
      return jsonResponse({
        round_id: ROUND_ID,
        graph_version_ref: 'gv-1',
        participants: [
          { participant_id: 'p-a', display_name: 'Ada', token: 'tok-a' },
          { participant_id: 'p-b', display_name: 'Grace', token: 'tok-b' },
        ],
      })
    }
    if (url === CLOSE_URL) return jsonResponse({})
    if (url === REVEAL_URL) {
      return jsonResponse({
        round_id: ROUND_ID,
        status: 'closed',
        graph_version_ref: 'gv-1',
        per_target: [],
      })
    }
    return jsonResponse({ code: 'not_stubbed', message: url }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  vi.mocked(getSessionIdentity).mockResolvedValue({
    userId: 'user-abc',
    accessToken: OWNER_TOKEN,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("the owner's panel page authenticates — the request carries a real bearer", () => {
  it('mint sends the access token the session seam returned, not an empty bearer', async () => {
    renderOwnerPanel()
    await mintARound()

    // The positive outcome, named: the header carries THIS token. Not
    // "non-empty", not "defined" — the value a signed-in owner actually has.
    expect(authorizationFor(MINT_URL)).toBe(`Bearer ${OWNER_TOKEN}`)
  })

  it('close and reveal both send the same real access token', async () => {
    renderOwnerPanel()
    await mintARound()

    fireEvent.click(screen.getByTestId('panel-close'))
    await waitFor(() => expect(screen.getByTestId('collab-reveal')).toBeInTheDocument())

    expect(authorizationFor(CLOSE_URL)).toBe(`Bearer ${OWNER_TOKEN}`)
    expect(authorizationFor(REVEAL_URL)).toBe(`Bearer ${OWNER_TOKEN}`)
  })

  it('one getSession round-trip per user action, even though closing issues two requests', async () => {
    renderOwnerPanel()
    await mintARound()
    vi.mocked(getSessionIdentity).mockClear()

    fireEvent.click(screen.getByTestId('panel-close'))
    await waitFor(() => expect(screen.getByTestId('collab-reveal')).toBeInTheDocument())

    // The seam's own contract: "One call per turn; callers must never make a
    // second getSession() round-trip for the token."
    expect(collabCalls(CLOSE_URL).length + collabCalls(REVEAL_URL).length).toBe(2)
    expect(vi.mocked(getSessionIdentity)).toHaveBeenCalledTimes(1)
  })
})

describe('a signed-out owner is told so, and NO request is issued', () => {
  it('issues no collab request at all and shows the sign-in sentence', async () => {
    vi.mocked(getSessionIdentity).mockResolvedValue({ userId: null, accessToken: null })
    renderOwnerPanel()

    fireEvent.change(screen.getByTestId('panel-target-id'), { target: { value: 'factor-churn' } })
    fireEvent.click(screen.getByTestId('panel-mint'))

    await waitFor(() => expect(screen.getByTestId('panel-error')).toBeInTheDocument())
    expect(screen.getByTestId('panel-error')).toHaveTextContent(SIGN_IN_COPY)

    // An empty bearer is not merely useless — it is INDISTINGUISHABLE at CEE
    // from an unauthenticated call, so it must never leave the browser.
    const collabRequests = fetchMock.mock.calls.filter((c) =>
      String(c[0]).startsWith('/bff/collab'),
    )
    expect(collabRequests).toHaveLength(0)
  })
})

describe('the collab seam refuses to build an empty bearer — the choke point', () => {
  it('mintRound throws sign_in_required and issues no request', async () => {
    await expect(
      mintRound('', { scenarioId: SCENARIO_ID, contextNote: null, targets: [], participants: [] }),
    ).rejects.toMatchObject({ name: 'CollabRequestError', code: 'sign_in_required', status: 401 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('closeRound throws sign_in_required and issues no request', async () => {
    await expect(closeRound('', ROUND_ID)).rejects.toBeInstanceOf(CollabRequestError)
    await expect(closeRound('', ROUND_ID)).rejects.toMatchObject({ code: 'sign_in_required' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetchOwnerReveal throws sign_in_required and issues no request', async () => {
    await expect(fetchOwnerReveal('', ROUND_ID)).rejects.toMatchObject({
      code: 'sign_in_required',
      status: 401,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('DISCRIMINATION: a real token is not refused — the guard rejects emptiness, not owner calls', async () => {
    await expect(closeRound(OWNER_TOKEN, ROUND_ID)).resolves.toBeUndefined()
    expect(authorizationFor(CLOSE_URL)).toBe(`Bearer ${OWNER_TOKEN}`)
  })

  it('DIFFERENT OBJECT: the participant credential is untouched by the owner guard', async () => {
    // The owner assertions above must be bound to OWNER requests. A participant
    // token is a different credential on a different route; breaking it must
    // leave every owner assertion green, and this test is what makes that
    // pairing meaningful rather than asserted.
    const { setParticipantToken } = await import('../participantToken')
    setParticipantToken(OTHER_TOKEN)
    const { fetchOpenPacket } = await import('../collabService')
    await fetchOpenPacket(ROUND_ID).catch(() => undefined)
    const packetCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).startsWith('/bff/collab/packet/'),
    )
    expect(packetCalls).toHaveLength(1)
    expect(new Headers((packetCalls[0][1] ?? {}).headers).get('x-collab-participant-token')).toBe(
      OTHER_TOKEN,
    )
  })
})

describe('the surface these tests bind to is the one the deployed app mounts', () => {
  const appSrc = readFileSync(resolve(process.cwd(), 'src/poc/AppPoC.tsx'), 'utf8')
  const pageSrc = readFileSync(resolve(process.cwd(), 'src/pages/PanelSetupPage.tsx'), 'utf8')

  it('AppPoC declares exactly this path → this element (the constant these tests render)', () => {
    expect(appSrc).toContain(`path="${OWNER_ROUTE_PATH}" element={<PanelSetupPage />}`)
    // POSITIVE CONTROL: the detector fires on a route that really is declared,
    // so the assertion above is a finding rather than a lucky substring.
    expect(appSrc).toContain('path="/panel/:round_id" element={<ParticipantPacketPage />}')
  })

  it('the page takes its token from the session seam, with no cast over useAuth', () => {
    // ⚠ MEASURE THE CODE, NOT THE PROSE. The file's header explains the defect
    // and therefore SPELLS `useAuth()` and the cast; a bare substring check
    // fires on the explanation and reports a defect that is only a description
    // of one. (This spec caught itself doing exactly that.) Strip comments
    // first — the page has no string literal containing `//`, which is the one
    // input this deliberately simple stripper would mangle.
    const code = stripComments(pageSrc)

    // POSITIVE CONTROL: the stripper left real code behind. Without this every
    // `toBe(false)` below could be passing on an empty string.
    expect(code.length).toBeGreaterThan(500)
    expect(code).toContain('export default function PanelSetupPage')

    // The root cause was a CAST, so bind to the cast's absence AND to the
    // replacement's presence — a page that used neither would otherwise satisfy
    // a bare "no useAuth" check while being just as broken.
    expect(/\buseAuth\s*\(/.test(code), 'useAuth must not be called here').toBe(false)
    expect(/\bas\s*\{\s*session\?/.test(code), 'the session cast must be gone').toBe(false)
    expect(/import\s*\{[^}]*\brequireOwnerAccessToken\b[^}]*\}/.test(code)).toBe(true)
    expect(/\brequireOwnerAccessToken\s*\(/.test(code)).toBe(true)
  })

  it('NO MODULE REACHABLE FROM collabService imports the Supabase client (relative-import graph, not a bundle claim)', () => {
    // ⚠ WHAT THIS DOES AND DOES NOT CLAIM. It walks the RELATIVE-IMPORT GRAPH
    // under src/ from collabService and asserts lib/supabase is not reachable.
    // It says NOTHING about what any bundle contains — an earlier version of
    // this test was NAMED as though it did, and an adversarial review proved
    // the implied property false: the auth client is already in the eagerly
    // loaded app-shell chunk via AppPoC -> AuthContext -> lib/supabase.
    //
    // That earlier version also only matched the literal single-quoted static
    // form. Re-executed by the reviewer: a static import RED, `await
    // import('../lib/supabase')` GREEN, a one-line re-export barrel GREEN. A
    // guard that catches a SPELLING while its name asserts a PROPERTY reads
    // green forever. This walks the graph instead, so all three forms bite.
    const reachable = reachableFrom('src/collab/collabService.ts')

    // POSITIVE CONTROL, and the important one: the same walker, from the page
    // that legitimately DOES reach the client, must find it. Without this the
    // assertion below could be passing because the walker resolves nothing.
    const fromPage = reachableFrom('src/pages/PanelSetupPage.tsx')
    expect(fromPage.has('src/lib/supabase.ts'), 'the walker must find a known-present edge').toBe(
      true,
    )
    expect(reachable.size, 'the walker must have resolved a real graph').toBeGreaterThan(1)

    expect(reachable.has('src/lib/supabase.ts')).toBe(false)
  })
})

describe('the owner Bearer has exactly one builder — the ratchets behind that claim', () => {
  const files = srcFiles()

  it('POSITIVE CONTROL: the scanner sees a real source tree', () => {
    // Without this, both assertions below could pass on an empty file list.
    expect(files.length).toBeGreaterThan(1000)
    expect(files).toContain('src/collab/collabService.ts')
  })

  it('the collab seam base is referenced from collabService and nowhere else in src/', () => {
    // This is what makes "no other call site can build an owner header" TRUE
    // rather than merely stated: a new caller cannot reach /bff/collab without
    // coming through this file, and inside it the only way to build the header
    // is ownerAuthorization().
    const referencing = files.filter(
      (f) => !/__tests__|\.spec\.|\.test\./.test(f) && readFileSync(f, 'utf8').includes('/bff/collab'),
    )
    expect(referencing).toEqual(['src/collab/collabService.ts'])
  })

  it('collabService constructs exactly one Bearer value', () => {
    const code = stripComments(
      readFileSync(resolve(process.cwd(), 'src/collab/collabService.ts'), 'utf8'),
    )
    const built = code.match(/`Bearer \$\{/g) ?? []
    expect(built).toHaveLength(1)
  })
})
