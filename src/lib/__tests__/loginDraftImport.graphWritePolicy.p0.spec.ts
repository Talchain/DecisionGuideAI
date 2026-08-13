/**
 * P0 (2026-08-13), round 2 — `importGuestDraft` must not write React Flow bytes
 * into `scenarios.graph` either.
 *
 * ⚠ WHY THIS FILE EXISTS: THE FIRST FIX MISSED THIS PATH, AND AN INDEPENDENT
 * REVIEW FOUND IT BY EXECUTION.
 *
 * Round 1 installed the suppression inside `useScenario.persistGraphNow`. That
 * function is **one of TWO callers** of `scenarioService.saveGraphViaGatedPath`.
 * The other is right here — `lib/loginDraftImport.importGuestDraft`, live via
 * `GuestDraftImportBanner.tsx:35` ← `ScenarioListPage.tsx:417` — and it calls the
 * write function DIRECTLY. With the policy shut, the reviewer measured it still
 * writing:
 *
 *     saveGraphViaGatedPath_calls : 1
 *     payloadNodeKeys             : ["id","type","position","data"]
 *     payloadEdgeKeys             : ["id","source","target","type","data","label"]
 *     ceeReadable                 : false
 *     missingRequiredFields       : 9
 *
 * …into a **brand-new scenario**, on the guest→signed-in onboarding path — the
 * one a first-time user is most likely to take, and one that cannot be excused by
 * "the row was already good", because the row is created poisoned. That scenario
 * 500s on its first analyse turn: the P0, reproduced, past the fix.
 *
 * ⭐ THE LESSON, WHICH IS THE POINT OF THIS FILE: round 1's own policy header
 * argued for *"one derived gate, no list of call sites to keep in step"* — and
 * then installed the gate AT A CALL SITE. A guard at one call site IS the
 * hand-maintained mirror of "all call sites" (trap 12), one level up from where
 * the argument was being made. The suppression now lives in
 * `saveGraphViaGatedPath` — the only place in any live path where `p_graph`
 * reaches `apply_patch_and_log` — so the number of call sites anyone has to
 * remember is zero, and THIS spec exists to prove that from the second caller.
 *
 * BINDING (trap 19): every assertion here is reached by calling the REAL
 * `importGuestDraft` **by name**, with the REAL, UNMOCKED policy module and the
 * REAL `scenarioService`, against a mocked supabase. Nothing binds to a value
 * predicate another object could satisfy, and nothing passes on "no error was
 * thrown".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// --- supabase (the boundary the whole claim is about) -----------------------
const mockRpc = vi.fn()
const mockInsert = vi.fn()

vi.mock('../supabase', () => ({
  supabase: {
    from: () => ({
      insert: () => ({
        select: () => ({ single: () => mockInsert() }),
      }),
    }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

// ⚠ The policy module is DELIBERATELY NOT MOCKED. This file is about what the
// real one does on this path; a lift here would test the lift.
import { importGuestDraft } from '../loginDraftImport'
import { clientCanWriteReadableGraph } from '../clientGraphWritePolicy'
// ⚠ SEEDED THROUGH THE PRODUCT'S OWN WRITER. The first version of this file
// hand-wrote the localStorage payload and got the shape wrong (`{state:…}`
// instead of `{version,timestamp,nodes,edges}`), so `loadState()` returned null,
// `importGuestDraft` threw "No guest draft to import", and the write it is
// supposed to suppress could not have happened for a reason that has nothing to
// do with the fix. Four tests went red and would otherwise have gone GREEN for
// the wrong reason once the throw was caught. Seeding via `saveState` — the
// exact function the guest canvas autosave uses — makes the fixture incapable of
// drifting from the reader (trap 16-inverse: a fixture you wrote yourself is not
// evidence about the wire; one written by the producer is).
import { saveState, loadState } from '../../canvas/persist'

// ---------------------------------------------------------------------------
// The guest draft, in the shape `canvas/persist.ts` actually stores.
// Key sets taken from the reviewer's executed capture of this exact path, which
// in turn matches the manifests of the REAL corrupt rows in DIAGNOSIS.md §1.
// ---------------------------------------------------------------------------

const NEW_SCENARIO_ID = '11111111-2222-4333-8444-555555555555'
const USER_ID = '550e8400-e29b-41d4-a716-446655440000'

const GUEST_DRAFT = {
  nodes: [
    { id: 'n1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Revenue' } },
    { id: 'n2', type: 'factor', position: { x: 0, y: 160 }, data: { kind: 'factor', label: 'Spend' } },
  ],
  edges: [
    { id: 'e1', source: 'n2', target: 'n1', type: 'influence', label: '', data: { beliefStrength: 0.4 } },
  ],
}

/** Everything `apply_patch_and_log` was called with, this run. */
function gatedGraphWrites() {
  return mockRpc.mock.calls.filter((c) => c[0] === 'apply_patch_and_log')
}

/**
 * CEE's REQUIRED fields — copied VERBATIM from the round-1 spec's oracle
 * (`hooks/__tests__/useScenario.reactFlowNeverPersisted.p0.spec.ts`), which is
 * itself derived from `cee-v3.ts` `NodeV3`:117 / `EdgeV3`:218. Deliberately the
 * same oracle so the two files cannot drift into disagreeing about what "CEE can
 * read this" means.
 */
function missingRequiredFields(graph: unknown): number {
  const g = graph as { nodes?: unknown[]; edges?: unknown[] } | null
  if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.edges)) return -1
  let missing = 0
  for (const n of g.nodes as Array<Record<string, unknown>>) {
    for (const f of ['id', 'kind', 'label'] as const) if (typeof n?.[f] !== 'string') missing++
  }
  for (const e of g.edges as Array<Record<string, unknown>>) {
    if (typeof e?.from !== 'string') missing++
    if (typeof e?.to !== 'string') missing++
    if (e?.strength == null || typeof e.strength !== 'object') missing++
    if (typeof e?.exists_probability !== 'number') missing++
    if (e?.effect_direction !== 'positive' && e?.effect_direction !== 'negative') missing++
  }
  return missing
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  // `loadState()` reads the guest canvas autosave. Written directly rather than
  // through a helper so the bytes under test are visible in this file.
  saveState(GUEST_DRAFT as never)
  mockInsert.mockResolvedValue({ data: { id: NEW_SCENARIO_ID }, error: null })
  mockRpc.mockResolvedValue({ data: {}, error: null })
})

afterEach(() => {
  localStorage.clear()
})

describe('P0 round 2 — importGuestDraft is covered by the same choke point', () => {
  it('CONTROL: the policy really is shut in this run, and the draft really is unreadable to CEE', () => {
    // Pins this file's own preconditions in-test (trap 13b). Without the first,
    // every assertion below could hold because the policy was open and the write
    // simply did not happen for some other reason; without the second, the draft
    // might be CEE-readable and there would be nothing to suppress.
    expect(clientCanWriteReadableGraph()).toBe(false)
    // The draft really is loadable — without this the suppression assertions
    // below could hold because there was nothing to import.
    const loaded = loadState()
    expect(loaded).not.toBeNull()
    expect(loaded!.nodes).toHaveLength(2)
    expect(loaded!.edges).toHaveLength(1)
    // …and the bytes that WOULD be written really are unreadable to CEE.
    // 2 nodes × 2 missing (`kind`/`label` live under `data`, not a declared key)
    // + 1 edge × 5 missing = 9 — the reviewer's measured figure on this path.
    expect(missingRequiredFields({ nodes: loaded!.nodes, edges: loaded!.edges })).toBe(9)
  })

  it('importGuestDraft still creates the scenario — the onboarding path is NOT broken', async () => {
    // The negative half matters as much as the positive one. Suppressing the
    // graph write must not turn "import my draft" into an error the user sees;
    // it degrades to "the row exists, the canvas has to be re-drafted", which is
    // exactly the pre-12-August behaviour (the RPC was `WHERE user_id =
    // auth.uid()` and threw for every guest, so this write never landed either).
    const id = await importGuestDraft(USER_ID)
    expect(id).toBe(NEW_SCENARIO_ID)
    expect(mockInsert).toHaveBeenCalledTimes(1)
  })

  it('…and writes NO graph — the bypass round 1 left open is closed', async () => {
    await importGuestDraft(USER_ID)
    expect(gatedGraphWrites()).toHaveLength(0)
  })

  it('the scenario_created event is still appended (the write path is suppressed, not the module)', async () => {
    // Discrimination: proves the suppression is scoped to the GRAPH write and has
    // not simply disabled the RPC surface. A mutation that stubbed out
    // `supabase.rpc` entirely would satisfy the assertion above and fail here.
    await importGuestDraft(USER_ID)
    const created = mockRpc.mock.calls.filter((c) => c[0] === 'append_scenario_event')
    expect(created).toHaveLength(1)
    expect((created[0][1] as { p_event_type: string }).p_event_type).toBe('scenario_created')
  })

  it('the marker is still set, so the banner does not re-offer an import that already happened', async () => {
    await importGuestDraft(USER_ID)
    expect(localStorage.getItem('login.draftImport.v1')).toBe('imported')
  })

  it('REGRESSION SHAPE: were the bypass ever re-opened, THESE are the bytes it would write', () => {
    // Not a behavioural assertion — a pin on the payload the reviewer captured, so
    // that if a future change re-opens this path the diff shows exactly which
    // shape is back. Read back through `loadState`, so it describes what the
    // write would ACTUALLY carry rather than what this file typed.
    const loaded = loadState()!
    expect(Object.keys(loaded.nodes[0]).sort()).toEqual(['data', 'id', 'position', 'type'])
    expect(Object.keys(loaded.edges[0]).sort()).toContain('source')
    expect(Object.keys(loaded.edges[0]).sort()).toContain('target')
    expect(Object.keys(loaded.edges[0]).sort()).not.toContain('from')
    expect(missingRequiredFields({ nodes: loaded.nodes, edges: loaded.edges })).toBe(9)
  })
})
