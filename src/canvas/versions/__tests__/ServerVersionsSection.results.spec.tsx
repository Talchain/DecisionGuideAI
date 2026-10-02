/**
 * RECORDED RESULTS FOR TWO SAVED VERSIONS (schemas 0.74 `result_comparison`; DL #85 5947565590; CANVAS lease 5949719017).
 *
 * Driven through the REAL section, the REAL `compareModelVersions` and the REAL contract parse
 * (`ModelVersionDiffV2Schema` / `ModelVersionDiffV1Schema`); only `fetch` is stubbed. Every body is a published 0.74
 * fixture VERBATIM, so no wire shape is self-authored.
 *
 * Rows:
 *   VR1  paired_runs: the request carries the opt-in; the block names both versions with their OWN recorded dates and
 *        reads the delta through the Compare tab's reader in the `versions` frame (its comparability sentence is the
 *        reader's, and the block says nothing rerun-shaped: "earlier", "previous", "last time").
 *   VR2  shared_run: said ONCE, as one shared recorded result; no comparison is drawn.
 *   VR3  unavailable: the typed reason's sentence, and no figure.
 *   VR4  an OLDER CEE (422 VERSION_COMPARE_SERVER_AUTHORITY_REQUIRED on the opt-in) → retried ONCE without it → the v1
 *        diff shows and no results block. CONTRAST: any other 422 is never retried (VR6).
 *   VR5  a v2 body whose `result_comparison` breaks the contract → no diff at all (the honest "try again" line).
 *   VR6  422 VERSION_GRAPH_INCOMPATIBLE on the opt-in → ONE call, "cannot be compared safely".
 *   VR8  (U4) FROM holds the LATER Run: the block keeps the user's FROM → TO order with each Run's own date, never re-sorted
 *        and never "earlier".
 *   VR7  the reader's `versions` frame, every attribution case: a sentence of its own, none rerun-shaped, no
 *        "Compared with the earlier run"; the default (`rerun`) is unchanged. Direction-only movement says
 *        "than in the version compared from", never "than last time".
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import {
  maximalModelVersionDiffV1 as V1,
  maximalModelVersionDiffV2 as PAIRED,
  maximalModelVersionDiffV2SharedRun as SHARED,
  maximalModelVersionDiffV2Unavailable as UNAVAILABLE,
} from '@talchain/schemas/fixtures'
import { ModelVersionDiffV2Schema, type RunDelta } from '@talchain/schemas/boundary'

const USER = '0f8a1b2c-3d4e-4f50-9a6b-7c8d9e0f1a2b'
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: USER } }) }))
vi.mock('../../../lib/supabase', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSessionIdentity: async () => ({ userId: USER, accessToken: 'token-for-USER' }),
}))

import { ServerVersionsSection, SERVER_VERSION_COMPARE_TESTID, COMPARE_UNAVAILABLE, COMPARE_NOT_COMPARABLE } from '../ServerVersionsSection'
import { SERVER_VERSION_DIFF_TESTID, formatTimestamp } from '../ServerVersionDiff'
import { VERSION_RESULT_DIFF_TESTID, VERSION_RESULTS_UNAVAILABLE_COPY } from '../VersionResultDiff'
import { buildRunDeltaView } from '../../../components/results/analysisNew/runDeltaView'
import {
  movementText,
  emptyInputsText,
  noPairsText,
  INPUTS_NOT_RECORDED_TEXT,
  INPUTS_NOT_RECORDED_TEXT_VERSIONS,
  WHATS_CHANGED_FIRST_COMPARISON,
  WHATS_CHANGED_FROM_VERSION_WITHHELD,
} from '../../../components/results/analysisNew/sections/WhatsChanged'
import { useCanvasStore } from '../../store'

const SCENARIO = V1.scenario_id
const V_FROM = V1.from_version_id
const V_TO = V1.to_version_id
const C = SERVER_VERSION_COMPARE_TESTID
const R = VERSION_RESULT_DIFF_TESTID
const RERUN_SHAPED = /earlier|previous|last time|for the first time/i

function row(id: string, sequence: number, label: string) {
  return {
    version_id: id, scenario_id: SCENARIO, sequence, label, created_at: `2026-10-01T1${sequence}:00:00.000Z`,
    full_hash: String(sequence).repeat(64), creation: { kind: 'committed_mutation' },
  }
}

type Reply = { status: number; body: unknown }
let compareReplies: Reply[] = []
const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
  const reply = ({ status, body }: Reply) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  if (url.endsWith('/versions')) {
    return reply({ status: 200, body: {
      schema: 'model_versions_list.v2', request_id: 'req-list', scenario_id: SCENARIO,
      current_version_id: V_TO, versions: [row(V_TO, 6, 'After'), row(V_FROM, 1, 'Before')], next_cursor: null,
    } })
  }
  if (url.endsWith('/versions/compare')) {
    const next = compareReplies.shift()
    if (next === undefined) throw new Error('unexpected compare call')
    return reply(next)
  }
  throw new Error(`unexpected fetch ${url} ${String(init?.method)}`)
})
const compareBodies = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/versions/compare')).map(([, init]) => JSON.parse(String((init as RequestInit).body)))

async function compare(replies: Reply[]) {
  compareReplies = replies
  render(<ServerVersionsSection />)
  await screen.findAllByTestId('server-version-row')
  fireEvent.click(screen.getByTestId(`${C}-go`))
}

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  useCanvasStore.setState({ currentScenarioId: SCENARIO, nodes: [] } as never)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('VR1 · paired_runs: both versions, their own dates, the Compare tab\'s reader in the versions frame', () => {
  it('asks for results, and says the producer\'s verdict with no rerun-shaped words', async () => {
    expect(ModelVersionDiffV2Schema.safeParse(PAIRED).success).toBe(true)
    if (PAIRED.result_comparison.status !== 'available' || PAIRED.result_comparison.kind !== 'paired_runs') throw new Error('fixture')
    const rc = PAIRED.result_comparison
    await compare([{ status: 200, body: PAIRED }])
    const block = await screen.findByTestId(R)

    expect(compareBodies()).toEqual([{ user_id: USER, from_version_id: V_FROM, to_version_id: V_TO, response_schema: 'model_version_diff.v2' }])
    expect(screen.getByTestId(SERVER_VERSION_DIFF_TESTID)).toBeInTheDocument()
    expect(block).toHaveAttribute('data-kind', 'paired_runs')
    expect(within(block).getByTestId(`${R}-pair`)).toHaveTextContent(
      `v1 · Before: recorded ${formatTimestamp(rc.prior_run.computed_at)} → v6 · After: recorded ${formatTimestamp(rc.current_run.computed_at)}`,
    )
    const view = buildRunDeltaView(rc.run_delta as RunDelta, () => null, () => null, 'versions')
    expect(block).toHaveTextContent(view.comparability)
    expect(block.textContent).not.toMatch(RERUN_SHAPED)
  })
})

describe('VR8 · FROM holds the LATER Run: orientation is the user\'s, never re-sorted by date', () => {
  it('FROM → TO with each Run\'s own date, the later one first; nothing rerun-shaped', async () => {
    if (PAIRED.result_comparison.status !== 'available' || PAIRED.result_comparison.kind !== 'paired_runs') throw new Error('fixture')
    const rc = PAIRED.result_comparison
    const LATE = '2026-09-30T18:45:00.000Z'
    const EARLY = '2026-09-30T08:15:00.000Z'
    const reversed = {
      ...PAIRED,
      result_comparison: {
        ...rc,
        prior_run: { ...rc.prior_run, computed_at: LATE },
        current_run: { ...rc.current_run, computed_at: EARLY },
        run_delta: {
          ...rc.run_delta,
          endpoints: {
            prior: { ...rc.run_delta.endpoints!.prior, computed_at: LATE },
            current: { ...rc.run_delta.endpoints!.current, computed_at: EARLY },
          },
        },
      },
    }
    expect(ModelVersionDiffV2Schema.safeParse(reversed).success).toBe(true)
    await compare([{ status: 200, body: reversed }])
    const block = await screen.findByTestId(R)
    expect(within(block).getByTestId(`${R}-pair`)).toHaveTextContent(
      `v1 · Before: recorded ${formatTimestamp(LATE)} → v6 · After: recorded ${formatTimestamp(EARLY)}`,
    )
    expect(block.textContent).not.toMatch(RERUN_SHAPED)
  })
})

describe('VR2 · shared_run is said once', () => {
  it('one shared recorded result, and no comparison drawn', async () => {
    if (SHARED.result_comparison.status !== 'available' || SHARED.result_comparison.kind !== 'shared_run') throw new Error('fixture')
    await compare([{ status: 200, body: SHARED }])
    const block = await screen.findByTestId(R)
    expect(within(block).getByTestId(`${R}-shared`)).toHaveTextContent(
      `share one recorded result (${formatTimestamp(SHARED.result_comparison.recorded_run.computed_at)})`,
    )
    expect(within(block).queryByTestId(`${R}-pair`)).toBeNull()
    expect(block.querySelector('[data-testid^="analysis-new-whats-changed"]')).toBeNull()
  })
})

describe('VR3 · unavailable: the typed reason, no figure', () => {
  it('missing_run → its sentence, and no percentage anywhere in the block', async () => {
    if (UNAVAILABLE.result_comparison.status !== 'unavailable') throw new Error('fixture')
    await compare([{ status: 200, body: UNAVAILABLE }])
    const block = await screen.findByTestId(R)
    expect(within(block).getByTestId(`${R}-unavailable`)).toHaveTextContent(
      VERSION_RESULTS_UNAVAILABLE_COPY[UNAVAILABLE.result_comparison.reason as keyof typeof VERSION_RESULTS_UNAVAILABLE_COPY],
    )
    expect(block.textContent).not.toMatch(/\d\s?%/)
  })
})

describe('VR4 · an older CEE refuses the opt-in → ONE plain retry, the v1 diff, no results block', () => {
  it('two calls: with the opt-in, then without; the structural diff shows alone', async () => {
    await compare([
      // CEE's own refusal shape: `buildErrorV1('BAD_INPUT', message, { code }, request_id)` (scenario-versions route).
      { status: 422, body: { code: 'BAD_INPUT', message: 'Compare accepts version IDs only; graph and hash truth are loaded by the server.', details: { code: 'VERSION_COMPARE_SERVER_AUTHORITY_REQUIRED' }, request_id: 'req-old' } },
      { status: 200, body: V1 },
    ])
    await screen.findByTestId(SERVER_VERSION_DIFF_TESTID)
    expect(compareBodies()).toEqual([
      { user_id: USER, from_version_id: V_FROM, to_version_id: V_TO, response_schema: 'model_version_diff.v2' },
      { user_id: USER, from_version_id: V_FROM, to_version_id: V_TO },
    ])
    expect(screen.queryByTestId(R)).toBeNull()
  })
})

describe('VR5 · a v2 body that breaks the contract is refused whole', () => {
  it('no diff, no results, the honest line', async () => {
    const broken = { ...PAIRED, result_comparison: { status: 'available', kind: 'paired_runs' } }
    expect(ModelVersionDiffV2Schema.safeParse(broken).success).toBe(false)
    await compare([{ status: 200, body: broken }])
    expect(await screen.findByText(COMPARE_UNAVAILABLE)).toBeInTheDocument()
    expect(screen.queryByTestId(SERVER_VERSION_DIFF_TESTID)).toBeNull()
    expect(screen.queryByTestId(R)).toBeNull()
  })
})

describe('VR6 · CONTRAST: any other 422 is never retried', () => {
  it('VERSION_GRAPH_INCOMPATIBLE → one call, "cannot be compared safely"', async () => {
    await compare([{ status: 422, body: { details: { code: 'VERSION_GRAPH_INCOMPATIBLE' } } }])
    expect(await screen.findByText(COMPARE_NOT_COMPARABLE)).toBeInTheDocument()
    expect(compareBodies()).toHaveLength(1)
  })
})

describe('VR7 · the reader\'s versions frame', () => {
  // The fixture's static type is wider than the union arm; the runtime shape is asserted by VR1's parse.
  const base = (PAIRED.result_comparison as unknown as { run_delta: RunDelta }).run_delta
  const cases: RunDelta['attribution_case'][] = ['C0_identical', 'C1_attributable', 'C2_unpaired', 'C3_engine_drift', 'C4_budget_drift', 'C5_unattributed']
  it.each(cases)('%s: its own sentence, none rerun-shaped; no "earlier run" line; rerun unchanged', (attribution_case) => {
    const delta = { ...base, attribution_case } as RunDelta
    const versions = buildRunDeltaView(delta, () => null, () => null, 'versions')
    const rerun = buildRunDeltaView(delta, () => null)
    expect(versions.comparability).not.toMatch(RERUN_SHAPED)
    expect(versions.comparability).not.toBe(rerun.comparability)
    expect(versions.comparedWith).toBeNull()
    expect(versions.frame).toBe('versions')
    expect(rerun.frame).toBeUndefined()
  })
  it('direction-only movement: "than in the version compared from"; the default still says "than last time"', () => {
    const m = { optionId: 'o', label: 'Option A', prior: 0.4, current: 0.5, direction: 'up' as const, noiseVerdict: 'not_noise_qualified' as const, mayShowMagnitude: false }
    expect(movementText(m, 'versions')).toBe('Option A: scored higher than in the version compared from')
    expect(movementText(m)).toBe('Option A: scored higher than last time')
  })
  it('not_recorded inputs and a withheld FROM result: versions words, never "earlier" / "for the first time"', () => {
    const notRecorded = { coverage: 'not_recorded' as const, rows: [] }
    expect(emptyInputsText(notRecorded, 'versions')).toBe(INPUTS_NOT_RECORDED_TEXT_VERSIONS)
    expect(emptyInputsText(notRecorded)).toBe(INPUTS_NOT_RECORDED_TEXT)
    expect(INPUTS_NOT_RECORDED_TEXT_VERSIONS).not.toMatch(RERUN_SHAPED)
    expect(noPairsText({ winProbabilitiesUnavailable: 'prior_withheld', frame: 'versions' })).toBe(WHATS_CHANGED_FROM_VERSION_WITHHELD)
    expect(noPairsText({ winProbabilitiesUnavailable: 'prior_withheld' })).toBe(WHATS_CHANGED_FIRST_COMPARISON)
    expect(WHATS_CHANGED_FROM_VERSION_WITHHELD).not.toMatch(RERUN_SHAPED)
  })
})
