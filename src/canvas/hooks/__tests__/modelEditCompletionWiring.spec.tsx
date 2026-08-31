/**
 * THE WIRING — pinned, because a comment asserting it is one refactor from
 * being false, and in this case it was already false.
 *
 * ⚠ WHY THIS FILE EXISTS. The first cut of the completion ledger shipped three
 * mutants that all bit (`M1` trust-the-receipt, `M2` never-commit, `M3`
 * last-edit-flag) and every one of them mutated the ADJUDICATOR. The claim they
 * were offered in support of was *"wired at `serverGraphHydration.ts` … so the
 * interface is not dark"* — and **no mutant tested that claim**. Deleting the
 * single wiring line left 55/55 green, and it survived estate-wide by
 * construction: the only spec that imported the ledger never drove the caller.
 *
 * Worse, the wiring that did exist could not settle an ordinary edit at all
 * (F1): `hydrateCanvasFromServer` runs once per scenario at BOOT, before any
 * attempt exists. So this file pins BOTH wires, and the second one is the whole
 * success path:
 *
 *   M-W1 — delete the settle in `serverGraphHydration.ts` → the boot test REDs.
 *   M-W2 — delete the read in `useModelEditCanonicalConfirm` → the ORDINARY
 *          EDIT JOURNEY test REDs.
 *
 * ⚠ THE JOURNEY TEST CALLS NEITHER `settleModelEditAttemptsFromCanonicalGraph`
 * NOR `hydrateCanvasFromServer`. It drives the real authority, hands the real
 * dispatcher's receipt, and asserts the phase the user's row would render. A
 * spec that called the settle directly would prove the adjudicator works and
 * say nothing about whether anything ever asks it.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn().mockResolvedValue({}) }),
  }
})
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))
vi.mock('../../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getSessionIdentity: async () => ({ userId: 'user-1', accessToken: 'token-1' }),
  }
})

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { useModelEditAuthority } from '../useModelEditAuthority'
import { useModelEditCanonicalConfirm } from '../useModelEditCanonicalConfirm'
import {
  __resetModelEditCompletionLedger,
  beginModelEditAttempt,
  getModelEditAttempt,
  recordModelEditReceipt,
} from '../modelEditCompletion'
import {
  captureOptimisticFactorEdit,
  mergeOptimisticFactorEdit,
  supersededAttemptId,
} from '../../conversation/optimisticFactorEdit'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'
const FACTOR = 'factor-1'
const CEE_TOKEN = 'a'.repeat(63) + '7'

/** The WIRE shape — `observed_state` at the top level, no `data` key. */
function serverBody(value: number, rawValue: number, source: string) {
  return {
    schema: 'scenario_graph.v1',
    scenario_id: SCENARIO_ID,
    graph: {
      nodes: [
        {
          id: FACTOR,
          kind: 'factor',
          label: 'Delivery time',
          observed_state: { value, raw_value: rawValue, source },
        },
      ],
      edges: [],
    },
    graph_present: true,
    brief_text: null,
    graph_identity_hash: {
      kind: 'graph_identity_hash',
      value: CEE_TOKEN,
      algorithm: 'sha256',
      projection_version: 'identity.v1',
      graph_schema_version: 'graph_v3',
      normaliser_version: '1',
    },
    layout_present: false,
    request_id: 'req-1',
  }
}

function stubFetch(body: unknown) {
  const fetchSpy = vi.fn(
    async () =>
      ({ ok: true, status: 200, json: async () => body }) as unknown as Response,
  )
  vi.stubGlobal('fetch', fetchSpy)
  return fetchSpy
}

function seedCanvas() {
  useCanvasStore.setState(
    {
      currentScenarioId: SCENARIO_ID,
      nodes: [
        {
          id: FACTOR,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: {
            label: 'Delivery time',
            kind: 'factor',
            observedState: { value: 0.5, raw_value: 15000, cap: 30000, source: 'cee_inference' },
          },
        },
      ],
      edges: [],
      lastAuthoritativeGraph: null,
      serverGraphIdentity: null,
    } as never,
    false,
  )
}

beforeEach(() => {
  __resetModelEditCompletionLedger()
  seedCanvas()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

// ─────────────────────────────────────────────────────────────────────────────
describe('M-W1 — the boot hydration settles outstanding attempts', () => {
  it('an attempt receipted before a boot read is adjudicated by that read', async () => {
    const attempt = beginModelEditAttempt({
      nodeId: FACTOR,
      scenarioId: SCENARIO_ID,
      attemptedValue: 0.7,
      attemptedRawValue: 21000,
    })
    recordModelEditReceipt(attempt)
    stubFetch(serverBody(0.7, 21000, 'user_override'))

    // Drives the REAL caller end to end. Deleting the settle line inside it
    // leaves this attempt `receipted` and REDs here.
    await hydrateCanvasFromServer(SCENARIO_ID, {})

    expect(getModelEditAttempt(attempt)?.completion).toEqual({
      phase: 'committed',
      canonical: { value: 0.7, rawValue: 21000, source: 'user_override' },
    })
  })

  it('and the same read refuses an attempt the server did not take', async () => {
    const attempt = beginModelEditAttempt({
      nodeId: FACTOR,
      scenarioId: SCENARIO_ID,
      attemptedValue: 0.7,
      attemptedRawValue: 21000,
    })
    recordModelEditReceipt(attempt)
    stubFetch(serverBody(0.5, 15000, 'cee_inference'))

    await hydrateCanvasFromServer(SCENARIO_ID, {})

    expect(getModelEditAttempt(attempt)?.completion).toMatchObject({
      phase: 'refused',
      evidence: 'canonical',
      canonical: { value: 0.5, rawValue: 15000, source: 'cee_inference' },
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('⭐ M-W2 — the ORDINARY EDIT JOURNEY reaches `committed`', () => {
  /**
   * The journey, with nothing simulated but the network:
   *   authority.proposeFactorValue  → the real write seam mints the attempt
   *   recordModelEditReceipt        → exactly what the dispatcher calls on a
   *                                   receipt (`useConversation`'s applied arm)
   *   useModelEditCanonicalConfirm  → must ASK for canonical evidence
   *   → committed
   *
   * ⚠ Nothing here calls the settle function or the hydration. If nothing asks,
   * this test REDs at `receipted` — which is exactly what the shipped code did
   * before the confirm hook existed.
   */
  it('edit → receipt → the confirm hook asks → committed, with no other trigger', async () => {
    const fetchSpy = stubFetch(serverBody(0.7, 21000, 'user_override'))

    const view = renderHook(() => {
      useModelEditCanonicalConfirm(SCENARIO_ID)
      return useModelEditAuthority(FACTOR)
    })

    let attemptId: string | null = null
    act(() => {
      attemptId = view.result.current.proposeFactorValue(21000).attemptId
    })
    expect(attemptId).toBeTruthy()

    // No cold read is warranted yet — the receipt channel has not answered.
    expect(fetchSpy).not.toHaveBeenCalled()

    await act(async () => {
      recordModelEditReceipt(attemptId)
    })

    await vi.waitFor(() => {
      expect(view.result.current.completionFor(attemptId)?.completion).toEqual({
        phase: 'committed',
        canonical: { value: 0.7, rawValue: 21000, source: 'user_override' },
      })
    })

    // The evidence was FETCHED, not assumed.
    expect(fetchSpy).toHaveBeenCalled()
    const url = String((fetchSpy.mock.calls[0] as unknown[])[0])
    expect(url).toContain(`/bff/cee/scenarios/${SCENARIO_ID}/graph`)
    view.unmount()
  })

  it('the same journey reports a false success as REFUSED', async () => {
    // CEE receipts the edit; the persisted store never moved. This is the
    // measured `edit-graph.ts:2986-2992` class, driven end to end.
    stubFetch(serverBody(0.5, 15000, 'cee_inference'))

    const view = renderHook(() => {
      useModelEditCanonicalConfirm(SCENARIO_ID)
      return useModelEditAuthority(FACTOR)
    })
    let attemptId: string | null = null
    act(() => {
      attemptId = view.result.current.proposeFactorValue(21000).attemptId
    })
    await act(async () => {
      recordModelEditReceipt(attemptId)
    })

    await vi.waitFor(() => {
      expect(view.result.current.completionFor(attemptId)?.completion).toMatchObject({
        phase: 'refused',
        evidence: 'canonical',
      })
    })
    view.unmount()
  })

  it('spends no request when nothing is outstanding', async () => {
    const fetchSpy = stubFetch(serverBody(0.7, 21000, 'user_override'))
    const view = renderHook(() => useModelEditCanonicalConfirm(SCENARIO_ID))
    await act(async () => {})
    expect(fetchSpy).not.toHaveBeenCalled()
    view.unmount()
  })

  /**
   * ⚠ A SOURCE SCAN, AND IT IS DELIBERATELY STATIC. The two tests above prove
   * the hook works; nothing else in the suite proves anything MOUNTS it, and an
   * unmounted hook is precisely the dark-wiring defect this file exists for.
   * Driving `CanvasMVP` in jsdom is not a proportionate way to learn one fact.
   */
  it('CanvasMVP mounts the confirm hook', () => {
    const source = readFileSync(
      resolve(__dirname, '../../../routes/CanvasMVP.tsx'),
      'utf8',
    )
    expect(source).toContain("import { useModelEditCanonicalConfirm }")
    expect(source).toMatch(/useModelEditCanonicalConfirm\(\s*scenarioIdFromRoute\s*\)/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('F6 — the supersede guard keys on the QUEUED attempt alone', () => {
  const nodeData = { observedState: { value: 0.5, raw_value: 15000, cap: 30000 } }

  it('an INSPECTOR edit (which mints no attempt) still strands the queued one', () => {
    // The reviewer's exact reproduction: the merge writes `incoming.attemptId`
    // unconditionally, so the queued attempt's id leaves the carrier entirely.
    const queued = captureOptimisticFactorEdit(FACTOR, 0.7, nodeData, undefined, 'mea_1_abc')
    const incoming = captureOptimisticFactorEdit(FACTOR, 0.8, nodeData) // inspector
    expect(mergeOptimisticFactorEdit(queued!, incoming!)!.attemptId).toBeUndefined()

    // ⭐ A guard requiring BOTH ids returns null here and the attempt is
    // stranded `pending` for the session. Keyed on the queued one, it is named.
    expect(supersededAttemptId(queued!, incoming!)).toBe('mea_1_abc')
  })

  it('names the queued attempt when a later Model-tab edit supersedes it', () => {
    const queued = captureOptimisticFactorEdit(FACTOR, 0.7, nodeData, undefined, 'mea_1_abc')
    const incoming = captureOptimisticFactorEdit(FACTOR, 0.8, nodeData, undefined, 'mea_2_def')
    expect(supersededAttemptId(queued!, incoming!)).toBe('mea_1_abc')
  })

  it('names nothing when the carrier keeps the same attempt', () => {
    const queued = captureOptimisticFactorEdit(FACTOR, 0.7, nodeData, undefined, 'mea_1_abc')
    const incoming = captureOptimisticFactorEdit(FACTOR, 0.8, nodeData, undefined, 'mea_1_abc')
    expect(supersededAttemptId(queued!, incoming!)).toBeNull()
  })

  it('names nothing when the queued edit never had an attempt', () => {
    const queued = captureOptimisticFactorEdit(FACTOR, 0.7, nodeData)
    const incoming = captureOptimisticFactorEdit(FACTOR, 0.8, nodeData, undefined, 'mea_2_def')
    expect(supersededAttemptId(queued!, incoming!)).toBeNull()
  })
})
