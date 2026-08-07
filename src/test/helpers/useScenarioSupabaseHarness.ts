/**
 * The shared Supabase / `useScenario` test harness — R-3.
 *
 * ⚠ WHY THIS EXISTS. `canvas/utils/__tests__/edgeValidationRebuildHops.spec.ts`
 * copied this harness line-for-line from
 * `hooks/__tests__/useScenario.goalConstraints.lifecycle.spec.ts` — the `NODES`
 * array byte-identical, the `scenarioRow` body identical, the same
 * `REAL_USER_ID` literal, the same `PGRST116` `mockSingle` implementation, ~135
 * lines. The copying spec's own header NAMED the file it was copying from and
 * copied anyway, because no shared home existed. This is that home.
 *
 * ⚠ AND THE COPY HAD ALREADY DIVERGED, IN THE DIRECTION THAT LOSES CAPABILITY:
 * the original takes `scenarioRow(id, graph)`; the copy took
 * `scenarioRow(id, edges)` with `graph: { nodes: NODES, edges }` hard-wired — so
 * the newer spec could not vary nodes or framing at all. The signature here is
 * the original's (`graph` in full), with a `scenarioRowWithEdges` convenience for
 * the common "these nodes plus these edges" case, so neither caller loses reach.
 *
 * ── ⚠ HOW THE `vi.mock` HALF WORKS, AND WHY IT IS SHAPED THIS WAY ────────────
 * `vi.mock` CALLS are hoisted above imports and their module specifiers are
 * resolved relative to the FILE THAT CALLS THEM. The two consumers sit at
 * different depths (`src/hooks/__tests__/` and `src/canvas/utils/__tests__/`), so
 * the specifiers genuinely cannot move here — each spec must keep its own
 * `vi.mock('<its own path>/lib/supabase', …)` line. What CAN move, and what is
 * the actual bulk and the actual drift risk, is the FACTORY BODY and the mock
 * state it closes over. Each spec therefore keeps a one-line registration and
 * hands the factory over:
 *
 *     import { supabaseMockModule, authMockModule } from '<...>/useScenarioSupabaseHarness'
 *     vi.mock('../../lib/supabase', () => supabaseMockModule())
 *     vi.mock('../../contexts/AuthContext', () => authMockModule())
 *
 * The factories are LAZY — vitest invokes them when the module under test first
 * requests the mocked module, which is after every static import in the spec has
 * been evaluated. So this module is initialised by then. ⚠ Keep the harness
 * import ABOVE the spec's import of the code under test: ESM evaluates static
 * imports in source order, and a factory that runs before this module initialises
 * would see `undefined` mocks.
 *
 * ⚠ THESE FACTORIES REPLACE THE MODULE, they do not spread it — which is correct
 * for `lib/supabase` and `contexts/AuthContext` (both consumers want the whole
 * boundary faked) but is exactly the trap-12 shape that once killed 51 tests
 * elsewhere. If a consumer ever needs a REAL export from either module, use
 * `importOriginal`-spread in that spec rather than widening this factory.
 */
import { vi } from 'vitest'

/** The gated-RPC spy. `apply_patch_and_log` calls land here. */
export const mockRpc = vi.fn()

/** The single-row read spy, keyed by scenario id. */
export const mockSingle = vi.fn()

/**
 * Rows the faked Supabase will serve, by id. Mutated by `setScenarioRow`;
 * cleared by `resetScenarioHarness`.
 *
 * Exposed through functions rather than as a mutable binding so a consumer
 * cannot hold a stale reference to a replaced object — the failure mode where a
 * spec's `beforeEach` reassigns the map and the harness keeps reading the old one.
 */
const rowsById: Record<string, Record<string, unknown>> = {}

/** A real UUID: the auth boundary rejects non-UUID ids, so a stub id hides bugs. */
export const REAL_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

/** The two canvas nodes both suites seed. */
export const HARNESS_NODES: ReadonlyArray<Record<string, unknown>> = [
  { id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Revenue' } },
  { id: 'factor-1', type: 'factor', position: { x: 0, y: 100 }, data: { kind: 'factor', label: 'Spend' } },
]

/** The module body for `vi.mock('<...>/lib/supabase', () => supabaseMockModule())`. */
export function supabaseMockModule() {
  return {
    supabase: {
      from: () => ({
        select: () => ({
          eq: (_col: string, id: string) => ({
            single: () => mockSingle(id),
          }),
        }),
        update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      }),
      rpc: (...args: unknown[]) => mockRpc(...args),
    },
  }
}

/** The module body for `vi.mock('<...>/contexts/AuthContext', () => authMockModule())`. */
export function authMockModule() {
  return {
    useAuth: () => ({ user: { id: REAL_USER_ID }, authenticated: true }),
  }
}

/** The module body for `vi.mock('react-router-dom', () => routerMockModule())`. */
export function routerMockModule() {
  return { useNavigate: () => vi.fn() }
}

/** Make the faked read serve this row for this id. */
export function setScenarioRow(id: string, row: Record<string, unknown>): void {
  rowsById[id] = row
}

/**
 * Reset the harness: clear the served rows and re-arm both spies.
 *
 * ⚠ THE `PGRST116` ARM IS THE POINT, not boilerplate. An unseeded id must read
 * back as Supabase's own "no rows" error rather than as a success with `null`
 * data, because `useScenario` branches on that code. Both copies of this harness
 * carried it; only one explained it.
 *
 * Call AFTER `vi.clearAllMocks()` — that call strips the implementations this
 * re-installs.
 */
export function resetScenarioHarness(): void {
  for (const key of Object.keys(rowsById)) delete rowsById[key]
  mockSingle.mockImplementation(async (id: string) =>
    rowsById[id]
      ? { data: rowsById[id], error: null }
      : { data: null, error: { code: 'PGRST116' } },
  )
  mockRpc.mockResolvedValue({ data: {}, error: null })
}

/**
 * A persisted scenario row as it sits in the `scenarios` table.
 *
 * Takes the WHOLE `graph`, as the original did — see the divergence note in the
 * header. `overrides` covers `framing`, `stage` and the analysis columns without
 * a caller having to restate the other nine.
 */
export function scenarioRow(
  id: string,
  graph: unknown,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    graph,
    framing: null,
    stage: 'analyse',
    updated_at: new Date().toISOString(),
    analysis_status: 'none',
    analysis: null,
    analysis_provenance: null,
    analysis_error: null,
    thread: null,
    events: null,
    ...overrides,
  }
}

/** `scenarioRow` for the common "the harness nodes plus these edges" case. */
export function scenarioRowWithEdges(
  id: string,
  edges: unknown[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return scenarioRow(id, { nodes: HARNESS_NODES, edges }, overrides)
}

/** The `p_graph` of the most recent gated write, or `null` if there was none. */
export function lastWrittenGraph(): Record<string, unknown> | null {
  const calls = mockRpc.mock.calls.filter((c) => c[0] === 'apply_patch_and_log')
  if (calls.length === 0) return null
  return (calls[calls.length - 1][1] as Record<string, unknown>)
    .p_graph as Record<string, unknown>
}
