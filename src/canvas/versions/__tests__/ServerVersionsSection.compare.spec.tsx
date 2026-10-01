/**
 * VERSION COMPARE (DL #85 5942533417, LOW): a signed-in user picks two shared versions and sees CEE's own account of
 * what changed between them.
 *
 * Driven through the REAL section, the REAL `compareModelVersions` / `listModelVersions` and the REAL contract parse
 * (`ModelVersionDiffV1Schema`); only `fetch` is stubbed. The diff is the published `maximalModelVersionDiffV1` fixture
 * VERBATIM (all 8 categories), and the scenario/version ids are the fixture's own, so no wire shape is self-authored.
 *
 * Rows:
 *   VC1  the default pair (the version before the head → the head) → Compare → ONE POST to the compare route carrying
 *        only the two ids (+ legacy user_id) and the bearer token → every category's rows render CEE's words verbatim;
 *        presentation is collapsed; the coverage notes show.
 *   VC2  a body that fails the published contract → no diff, the honest "try again" line. CONTRAST: VC1.
 *   VC3  an answer about a different pair → refused, no diff.
 *   VC4  ONE ANSWER PER QUESTION: the pair changes while a compare is in flight → the late answer (a refusal) is never
 *        shown; the next Compare shows its own answer.
 *   VC5  refusals keep their meaning: 404 VERSION_NOT_FOUND → "no longer available" + the list re-read;
 *        422 VERSION_GRAPH_INCOMPATIBLE → "cannot be compared safely".
 *   VC6  fewer than two versions → no compare block. CONTRAST: two → present.
 *   VC7  the same version on both sides → Compare disabled, nothing sent.
 *   VC8  identical relation → "These two versions are the same model."
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { maximalModelVersionDiffV1 as FIXTURE } from '@talchain/schemas/fixtures'
import { ModelVersionDiffV1Schema } from '@talchain/schemas/boundary'

const USER = '0f8a1b2c-3d4e-4f50-9a6b-7c8d9e0f1a2b'
const authState: { user: { id: string } | null } = { user: { id: USER } }
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: authState.user }) }))
vi.mock('../../../lib/supabase', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSessionIdentity: async () => ({ userId: USER, accessToken: 'token-for-USER' }),
}))

import {
  ServerVersionsSection,
  SERVER_VERSION_COMPARE_TESTID,
  COMPARE_UNAVAILABLE,
  COMPARE_VERSION_GONE,
  COMPARE_NOT_COMPARABLE,
} from '../ServerVersionsSection'
import { SERVER_VERSION_DIFF_TESTID, DIFF_CATEGORY_LABELS } from '../ServerVersionDiff'
import { useCanvasStore } from '../../store'

const SCENARIO = FIXTURE.scenario_id
const V_FROM = FIXTURE.from_version_id
const V_TO = FIXTURE.to_version_id
const V_MID = 'f1000000-0000-4000-8000-000000000003'
const C = SERVER_VERSION_COMPARE_TESTID
const D = SERVER_VERSION_DIFF_TESTID

function row(id: string, sequence: number, label: string) {
  return {
    version_id: id, scenario_id: SCENARIO, sequence, label, created_at: `2026-10-01T1${sequence}:00:00.000Z`,
    full_hash: String(sequence).repeat(64), creation: { kind: 'committed_mutation' },
  }
}
const ROWS = { from: row(V_FROM, 1, 'Before'), mid: row(V_MID, 3, 'Middle'), to: row(V_TO, 6, 'After') }

type Reply = { status: number; body: unknown }
let listRows: ReturnType<typeof row>[] = []
let compareReplies: Array<Reply | Promise<Reply>> = []
const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
  const reply = async (r: Reply | Promise<Reply>) => {
    const { status, body } = await r
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  }
  if (url.endsWith('/versions')) {
    return reply({ status: 200, body: {
      schema: 'model_versions_list.v2', request_id: 'req-list', scenario_id: SCENARIO,
      current_version_id: V_TO, versions: listRows, next_cursor: null,
    } })
  }
  if (url.endsWith('/versions/compare')) {
    const next = compareReplies.shift()
    if (next === undefined) throw new Error('unexpected compare call')
    return reply(next)
  }
  throw new Error(`unexpected fetch ${url} ${String(init?.method)}`)
})

const compareCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/versions/compare'))
const listCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/versions'))

async function mount() {
  render(<ServerVersionsSection />)
  await screen.findAllByTestId('server-version-row')
}

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  authState.user = { id: USER }
  listRows = [ROWS.to, ROWS.from]
  compareReplies = []
  useCanvasStore.setState({ currentScenarioId: SCENARIO } as never)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('VC1 · the default pair, compared through the real client, rendered verbatim', () => {
  it('sends only the two ids, and shows every category in CEE\'s words', async () => {
    expect(ModelVersionDiffV1Schema.safeParse(FIXTURE).success).toBe(true)
    compareReplies = [{ status: 200, body: FIXTURE }]
    await mount()
    expect((screen.getByTestId(`${C}-from`) as HTMLSelectElement).value).toBe(V_FROM)
    expect((screen.getByTestId(`${C}-to`) as HTMLSelectElement).value).toBe(V_TO)
    fireEvent.click(screen.getByTestId(`${C}-go`))
    const diff = await screen.findByTestId(D)

    expect(compareCalls()).toHaveLength(1)
    const [url, init] = compareCalls()[0] as [string, RequestInit]
    expect(url).toBe(`/bff/cee/scenarios/${SCENARIO}/versions/compare`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ user_id: USER, from_version_id: V_FROM, to_version_id: V_TO })
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-for-USER')

    expect(within(diff).getByText('v1 · Before → v6 · After')).toBeInTheDocument()
    for (const [category, items] of Object.entries(FIXTURE.categories)) {
      const section = diff.querySelector(`[data-diff-category="${category}"]`) as HTMLElement
      expect(section, category).not.toBeNull()
      if (category !== 'presentation') expect(within(section).getByRole('heading')).toHaveTextContent(DIFF_CATEGORY_LABELS[category as keyof typeof DIFF_CATEGORY_LABELS])
      for (const item of items) {
        const li = [...section.querySelectorAll(`[data-testid="${D}-item"]`)].find((e) => e.getAttribute('data-entity-id') === item.entity_id) as HTMLElement
        expect(li, `${category}:${item.entity_id}`).toBeDefined()
        expect(li).toHaveTextContent(item.summary)
        expect(li).toHaveTextContent(`${item.before_display} → ${item.after_display}`)
        expect(li).toHaveTextContent(item.why_it_matters)
      }
    }
    // Presentation-only changes are collapsed, never listed beside the model changes.
    const presentation = diff.querySelectorAll('[data-diff-category="presentation"]')
    expect(presentation).toHaveLength(1)
    expect(presentation[0].tagName).toBe('DETAILS')
    expect((presentation[0] as HTMLDetailsElement).open).toBe(false)
    expect(within(diff).getByTestId(`${D}-analysis`)).toHaveTextContent('Some of these changes affect the analysis')
    expect(within(diff).getByTestId(`${D}-undetectable`)).toHaveTextContent(FIXTURE.coverage.known_undetectable[0].replace(/_/g, ' '))
    expect(within(diff).getByTestId(`${D}-uninterpreted`)).toHaveTextContent(FIXTURE.coverage.known_uninterpreted_paths[0])
  })
})

describe('VC2 · a body that fails the published contract shows no diff', () => {
  it('missing why_it_matters → the honest try-again line', async () => {
    const broken = JSON.parse(JSON.stringify(FIXTURE))
    delete broken.categories.structure[0].why_it_matters
    compareReplies = [{ status: 200, body: broken }]
    await mount()
    fireEvent.click(screen.getByTestId(`${C}-go`))
    expect(await screen.findByTestId(`${C}-message`)).toHaveTextContent(COMPARE_UNAVAILABLE)
    expect(screen.queryByTestId(D)).toBeNull()
  })
})

describe('VC3 · an answer about a different pair is refused', () => {
  it('to_version_id ≠ the asked one → no diff', async () => {
    compareReplies = [{ status: 200, body: { ...FIXTURE, to_version_id: V_MID } }]
    await mount()
    fireEvent.click(screen.getByTestId(`${C}-go`))
    expect(await screen.findByTestId(`${C}-message`)).toHaveTextContent(COMPARE_UNAVAILABLE)
    expect(screen.queryByTestId(D)).toBeNull()
  })
})

describe('VC4 · one answer per question', () => {
  // The late answer is a REFUSAL: a late diff is also hidden by the pair-bound render, but a refusal line is not
  // pair-bound, so only the sequence guard keeps an old pair's refusal off the new pair.
  it('the pair changes mid-flight → the late answer never shows; the next Compare shows its own', async () => {
    listRows = [ROWS.to, ROWS.mid, ROWS.from]
    let release: (r: Reply) => void = () => {}
    const late = new Promise<Reply>((resolve) => { release = resolve })
    compareReplies = [late, { status: 200, body: FIXTURE }]
    await mount()
    expect((screen.getByTestId(`${C}-from`) as HTMLSelectElement).value).toBe(V_MID)
    fireEvent.click(screen.getByTestId(`${C}-go`))
    await waitFor(() => expect(compareCalls()).toHaveLength(1))
    fireEvent.change(screen.getByTestId(`${C}-from`), { target: { value: V_FROM } })
    expect(screen.getByTestId(`${C}-go`)).not.toBeDisabled()
    await act(async () => { release({ status: 422, body: { code: 'INVALID', details: { code: 'VERSION_GRAPH_INCOMPATIBLE' } } }); await late })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(screen.queryByTestId(D)).toBeNull()
    expect(screen.queryByTestId(`${C}-message`)).toBeNull()

    fireEvent.click(screen.getByTestId(`${C}-go`))
    const diff = await screen.findByTestId(D)
    expect(within(diff).getByText('v1 · Before → v6 · After')).toBeInTheDocument()
    expect(JSON.parse(String((compareCalls()[1] as [string, RequestInit])[1].body)).from_version_id).toBe(V_FROM)
  })
})

describe('VC5 · refusals keep their meaning', () => {
  it('404 VERSION_NOT_FOUND → no longer available, and the list is read again', async () => {
    compareReplies = [{ status: 404, body: { code: 'NOT_FOUND', details: { code: 'VERSION_NOT_FOUND' } } }]
    await mount()
    const before = listCalls().length
    fireEvent.click(screen.getByTestId(`${C}-go`))
    expect(await screen.findByTestId(`${C}-message`)).toHaveTextContent(COMPARE_VERSION_GONE)
    await waitFor(() => expect(listCalls().length).toBe(before + 1))
  })
  it('422 VERSION_GRAPH_INCOMPATIBLE → cannot be compared safely', async () => {
    compareReplies = [{ status: 422, body: { code: 'INVALID', details: { code: 'VERSION_GRAPH_INCOMPATIBLE' } } }]
    await mount()
    fireEvent.click(screen.getByTestId(`${C}-go`))
    expect(await screen.findByTestId(`${C}-message`)).toHaveTextContent(COMPARE_NOT_COMPARABLE)
  })
})

describe('VC6 · compare needs two versions', () => {
  it('one version → no compare block; CONTRAST: two → present', async () => {
    listRows = [ROWS.to]
    await mount()
    expect(screen.queryByTestId(C)).toBeNull()
    cleanup()
    listRows = [ROWS.to, ROWS.from]
    await mount()
    expect(screen.getByTestId(C)).toBeInTheDocument()
  })
})

describe('VC7 · the same version on both sides', () => {
  it('Compare is disabled and nothing is sent', async () => {
    await mount()
    fireEvent.change(screen.getByTestId(`${C}-from`), { target: { value: V_TO } })
    expect(screen.getByTestId(`${C}-go`)).toBeDisabled()
    fireEvent.click(screen.getByTestId(`${C}-go`))
    expect(compareCalls()).toHaveLength(0)
  })
})

describe('VC8 · identical versions', () => {
  it('says the two versions are the same model', async () => {
    const empty = Object.fromEntries(Object.keys(FIXTURE.categories).map((k) => [k, []]))
    compareReplies = [{ status: 200, body: {
      ...FIXTURE, relation: 'identical', to_full_hash: FIXTURE.from_full_hash, analysis_equivalent: true,
      categories: empty, coverage: { known_undetectable: [], known_uninterpreted_paths: [] },
    } }]
    await mount()
    fireEvent.click(screen.getByTestId(`${C}-go`))
    expect(await screen.findByTestId(`${D}-identical`)).toHaveTextContent('These two versions are the same model.')
  })
})
