/**
 * Calibration R0 (UI half) — the "Record the decision" modal now writes a
 * DURABLE record.
 *
 * This file exercises the REAL `decisionRecordCommitService` against a mocked
 * `fetch`, so the assertions are about the WIRE — the exact path, the exact
 * header, the exact body — not about the modal calling something.
 *
 * Two things it deliberately proves that a runtime test alone cannot:
 *   1. the seam base is a LITERAL, DERIVED from `netlify.toml`'s cee-proxy
 *      binding rather than restated here (Vite inlines `import.meta.env` at
 *      transform time, so an env-resolved base reads correct in vitest and
 *      can still ship pointed at the wrong origin — how 2.387 and 2.710
 *      shipped dark);
 *   2. the confidence crosses the wire as the RAW 0–100 number, because the
 *      UI performs no arithmetic on probabilities.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Mock } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

import { DecisionRecordModal, DECISION_RECORD_COPY } from '../DecisionRecordModal'
import {
  openDecisionRecord,
  selectDecisionRecord,
  useDecisionRecordStore,
} from '../decisionRecordStore'
import { useCanvasStore } from '../../../../canvas/store'

type SessionIdentity = { userId: string | null; accessToken: string | null }

// The nullable (guest) shape is part of getSessionIdentity's real contract —
// declared here rather than inferred from the happy-path literal, so the guest
// case is expressible without a cast.
const mockGetSessionIdentity = vi.fn<[], Promise<SessionIdentity>>(async () => ({
  userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  accessToken: 'test-access-token',
}))

vi.mock('../../../../lib/supabase', () => ({
  supabase: {},
  getSessionIdentity: (...args: unknown[]) =>
    (mockGetSessionIdentity as unknown as (...a: unknown[]) => unknown)(...args),
}))

const SCENARIO_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const RECORD_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

function optionNode(id: string, label: string) {
  return { id, type: 'option', position: { x: 0, y: 0 }, data: { label } }
}

function seedAnalysedOptions() {
  useCanvasStore.setState({
    nodes: [
      optionNode('opt_b', 'Hire senior technical lead'),
      optionNode('opt_a', 'Bring on technical co-founder'),
    ] as never,
    results: { status: 'complete', progress: 100, hash: 'hash_run_1' } as never,
    optionNumbering: { opt_a: 1, opt_b: 2 },
    currentScenarioId: SCENARIO_ID,
  } as never)
}

function fillValid() {
  fireEvent.change(screen.getByTestId('decision-record-confidence'), {
    target: { value: '70' },
  })
  fireEvent.change(screen.getByTestId('decision-record-expectation'), {
    target: { value: 'Runway holds above 9 months through Q1.' },
  })
  fireEvent.change(screen.getByTestId('decision-record-revisit'), {
    target: { value: '2026-12-01' },
  })
  fireEvent.change(screen.getByTestId('decision-record-rationale'), {
    target: { value: 'Best current choice given hiring constraints.' },
  })
  fireEvent.change(screen.getByTestId('decision-record-assumption'), {
    target: { value: 'The hiring market stays open.' },
  })
}

function okResponse(body: Record<string, unknown>, status = 201): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

type FetchMock = Mock<Parameters<typeof fetch>, Promise<Response>>
let fetchMock: FetchMock

async function saveModal() {
  render(<DecisionRecordModal />)
  act(() => openDecisionRecord())
  fireEvent.change(screen.getByTestId('decision-record-option'), {
    target: { value: 'opt_b' },
  })
  fillValid()
  await act(async () => {
    fireEvent.click(screen.getByTestId('decision-record-save'))
  })
}

beforeEach(() => {
  sessionStorage.clear()
  useDecisionRecordStore.getState()._reset()
  seedAnalysedOptions()
  mockGetSessionIdentity.mockResolvedValue({
    userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    accessToken: 'test-access-token',
  })
  fetchMock = vi.fn<Parameters<typeof fetch>, Promise<Response>>(async () =>
    okResponse({
      record_id: RECORD_ID,
      review_date: '2026-12-01T00:00:00.000Z',
      review_date_source: 'user_set',
      deduped: false,
    }),
  )
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('durable commit — the wire', () => {
  it('POSTs to the cee-proxy seam with the user token, and the record becomes durable', async () => {
    await saveModal()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/bff/cee/decision-records/commit')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-access-token',
    )

    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body.scenario_id).toBe(SCENARIO_ID)
    expect(body.chosen_option_id).toBe('opt_b')
    expect(body.chosen_option_label).toBe('Hire senior technical lead')
    expect(body.expectation_statement).toBe('Runway holds above 9 months through Q1.')
    expect(body.revisit_trigger_or_date).toBe('2026-12-01')
    expect(typeof body.client_commit_id).toBe('string')
    expect((body.client_commit_id as string).length).toBeGreaterThan(0)

    // THE RAW 0–100 NUMBER. The server owns the /100; a UI that divides is a
    // second place the scale can drift.
    expect(body.confidence_0_100).toBe(70)
    expect(body.confidence_0_100).not.toBe(0.7)

    // The durable marker is the record id CEE returned — nothing claims
    // "saved to your account" without it.
    const record = selectDecisionRecord(useDecisionRecordStore.getState(), SCENARIO_ID)
    expect(record?.remote).toEqual({
      recordId: RECORD_ID,
      reviewDate: '2026-12-01T00:00:00.000Z',
      reviewDateSource: 'user_set',
    })
    expect(screen.getByTestId('decision-record-toast')).toHaveTextContent(
      DECISION_RECORD_COPY.toastSaved,
    )
  })

  it('NEVER sends the local analysisHash as an anchor — that is PLoT\'s response_hash', async () => {
    await saveModal()
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const raw = init.body as string
    // `results.hash` is annotated `// response_hash` in the canvas store; the
    // record's anchor is the aag_v1 analysis-affecting hash CEE derives from
    // its own run_analysis fact. Sending this value would anchor the record
    // to a regime no reviewer can re-derive against.
    expect(raw).not.toContain('hash_run_1')
    expect(raw).not.toContain('graph_hash')
  })

  it('a guest makes NO network call and is told the LOCAL story, never "saved to your account"', async () => {
    mockGetSessionIdentity.mockResolvedValue({ userId: null, accessToken: null })
    await saveModal()

    expect(fetchMock).not.toHaveBeenCalled()
    const record = selectDecisionRecord(useDecisionRecordStore.getState(), SCENARIO_ID)
    expect(record?.optionId).toBe('opt_b')
    expect(record?.remote ?? null).toBeNull()
    expect(screen.getByTestId('decision-record-toast')).toHaveTextContent(
      DECISION_RECORD_COPY.toastSavedLocal,
    )
  })

  it('a FAILED commit keeps the record locally and says the save failed — a distinct message from the guest one', async () => {
    fetchMock.mockResolvedValue(
      okResponse({ code: 'not_scenario_owner', message: 'nope' }, 403),
    )
    await saveModal()

    const record = selectDecisionRecord(useDecisionRecordStore.getState(), SCENARIO_ID)
    expect(record?.confidence).toBe(70)
    expect(record?.remote ?? null).toBeNull()
    const toast = screen.getByTestId('decision-record-toast')
    expect(toast).toHaveTextContent(DECISION_RECORD_COPY.toastSavedLocalAfterError)
    // The two local outcomes must not be merged: telling a signed-in user the
    // guest story would hide a real failure.
    expect(DECISION_RECORD_COPY.toastSavedLocalAfterError).not.toBe(
      DECISION_RECORD_COPY.toastSavedLocal,
    )
  })

  it.each([
    ['an unrecognised rung', 'some_future_rung'],
    ['a missing rung', undefined],
    ['a non-string rung', 42],
  ])(
    '%s is reported as a DEFAULT rung, NEVER as user_set',
    async (_label, rung) => {
      // Found by a surviving mutant, which is the only reason this test
      // exists: the fallback DIRECTION was uncovered. Claiming `user_set` for
      // a rung we did not recognise would tell the user they chose a review
      // date they never chose — the one direction of this error that misleads.
      fetchMock.mockResolvedValue(
        okResponse({
          record_id: RECORD_ID,
          review_date: '2026-11-04T00:00:00.000Z',
          review_date_source: rung,
          deduped: false,
        }),
      )
      await saveModal()
      const record = selectDecisionRecord(useDecisionRecordStore.getState(), SCENARIO_ID)
      expect(record?.remote?.reviewDateSource).toBe('default_horizon')
      expect(record?.remote?.reviewDateSource).not.toBe('user_set')
    },
  )

  it('a RECOGNISED user_set rung is still carried through (the fallback is not swallowing everything)', async () => {
    // The other half of the pair: without this, a mutant that hardcoded
    // 'default_horizon' for every response would survive the test above.
    fetchMock.mockResolvedValue(
      okResponse({
        record_id: RECORD_ID,
        review_date: '2026-12-01T00:00:00.000Z',
        review_date_source: 'user_set',
        deduped: false,
      }),
    )
    await saveModal()
    const record = selectDecisionRecord(useDecisionRecordStore.getState(), SCENARIO_ID)
    expect(record?.remote?.reviewDateSource).toBe('user_set')
  })

  it('a 2xx with no record_id is NOT reported as saved', async () => {
    fetchMock.mockResolvedValue(okResponse({ deduped: false }, 201))
    await saveModal()
    const record = selectDecisionRecord(useDecisionRecordStore.getState(), SCENARIO_ID)
    expect(record?.remote ?? null).toBeNull()
    expect(screen.getByTestId('decision-record-toast')).toHaveTextContent(
      DECISION_RECORD_COPY.toastSavedLocalAfterError,
    )
  })

  it('a network throw degrades to local, never to lost', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    await saveModal()
    const record = selectDecisionRecord(useDecisionRecordStore.getState(), SCENARIO_ID)
    expect(record?.expectation).toBe('Runway holds above 9 months through Q1.')
    expect(record?.remote ?? null).toBeNull()
  })
})

describe('durable commit — base binding (source-level, DERIVED)', () => {
  const HERE = path.dirname(fileURLToPath(import.meta.url))
  const REPO_ROOT = path.resolve(HERE, '../../../../..')
  const SERVICE = path.join(REPO_ROOT, 'src/services/decisionRecordCommitService.ts')

  it('uses the base netlify.toml actually binds cee-proxy to — derived, not restated', () => {
    const toml = readFileSync(path.join(REPO_ROOT, 'netlify.toml'), 'utf8')
    // Find the [[edge_functions]] block whose function is cee-proxy and take
    // ITS path. If the binding ever moves, this derives the new value and the
    // assertion below fails against the source — no hand-maintained mirror.
    const match = /function\s*=\s*"cee-proxy"[\s\S]{0,200}?path\s*=\s*"([^"]+)"/.exec(toml)
    expect(match).not.toBeNull()
    const boundPath = (match as RegExpExecArray)[1]
    expect(boundPath).toBe('/bff/cee/*')

    const expectedBase = boundPath.replace(/\/\*$/, '')
    const source = readFileSync(SERVICE, 'utf8')
    expect(source).toContain(`const CEE_BFF_BASE = '${expectedBase}'`)
  })

  it('reads NO import.meta.env in the commit service (Vite would inline it at build time)', () => {
    const source = readFileSync(SERVICE, 'utf8')
    const withoutComments = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(withoutComments).not.toMatch(/import\.meta\s*\.\s*env/)
    expect(withoutComments).not.toMatch(/VITE_/)
  })
})
