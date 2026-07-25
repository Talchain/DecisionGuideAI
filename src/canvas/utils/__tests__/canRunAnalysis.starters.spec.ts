/**
 * The honest-gate predicate must cover STARTER graphs, not just template inserts.
 *
 * WHY THIS EXISTS — this is the defect the P1-2 starter work would otherwise
 * introduce, and it is the silent-wrong-value class, not a cosmetic one.
 *
 * On the V5 canonical run path the turn body carries NO graph. Verified at the
 * bytes: `src/v5/buildPayload.ts` builds `{kind, turn_id, scenario_id, stage,
 * turn_class, message, source, chip?, retry_of?}` and the vendored
 * `MessageTurnPayloadSchema` is `.strict()` with no graph member. CEE resolves
 * the graph from its own persisted scenario row, which the UI writes
 * out-of-band via Supabase and flushes before dispatch
 * (`useScenario.ts::flushPendingGraphSave`) — and that flush RETURNS EARLY when
 * `!isPersistenceActive`, i.e. for every guest session. Staging runs
 * `VITE_AUTH_MODE = "guest"`.
 *
 * So a graph that was injected client-side and never persisted is INVISIBLE to
 * the analysis engine. Today `computeCeeCannotSeeModel` catches exactly one
 * such case — template inserts, sniffed via `data.templateId` — and refuses the
 * run honestly. A pre-drafted starter is the same situation with a different
 * stamp: without this coverage the Run button would go ENABLED and dispatch a
 * run against a scenario CEE has no graph for, turning today's honest refusal
 * into a silently-wrong analysis. That is strictly worse than the disabled
 * button it replaces.
 *
 * POSITIVE CONTROL FIRST: every absence assertion below is preceded by a
 * presence assertion on the same predicate, so a predicate that returned `false`
 * unconditionally could not make this file pass.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeCeeCannotSeeModel, canRunAnalysis, CEE_DRAFT_FIRST_REFUSAL } from '../canRunAnalysis'

const isV5CanonicalRunPathMock = vi.fn(() => true)
vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5CanonicalRunPath: () => isV5CanonicalRunPathMock() }
})

const starterNodes = [{ data: { starterId: 'market-entry', label: 'Germany First' } }, { data: {} }]
const templateNodes = [{ data: { templateId: 'hiring_strategy_tech_lead' } }, { data: {} }]
const ceeDraftedNodes = [{ data: { label: 'Germany First' } }, { data: {} }]

describe('computeCeeCannotSeeModel — starter provenance', () => {
  beforeEach(() => {
    isV5CanonicalRunPathMock.mockReturnValue(true)
  })

  it('POSITIVE CONTROL: still fires for template inserts (the predicate is alive)', () => {
    expect(computeCeeCannotSeeModel(templateNodes)).toBe(true)
  })

  it('fires for a starter graph — CEE has no persisted graph for a client-injected starter', () => {
    expect(computeCeeCannotSeeModel(starterNodes)).toBe(true)
  })

  it('does NOT fire for a genuine CEE-drafted graph (the gate stays narrow)', () => {
    expect(computeCeeCannotSeeModel(ceeDraftedNodes)).toBe(false)
  })

  it('does not fire off the V5 canonical path — a V2-direct run sends the graph itself', () => {
    isV5CanonicalRunPathMock.mockReturnValue(false)
    // Presence first: the same input is `true` on-path (asserted above), so a
    // `false` here is the flag doing work, not the predicate being dead.
    expect(computeCeeCannotSeeModel(starterNodes)).toBe(false)
    expect(computeCeeCannotSeeModel(templateNodes)).toBe(false)
  })

  it('a starter graph refuses the run with the same honest sentence as a template insert', () => {
    const result = canRunAnalysis({
      graphHealth: null,
      readiness: null,
      hasBlockers: false,
      nodeCount: 18,
      ceeCannotSeeModel: computeCeeCannotSeeModel(starterNodes),
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe(CEE_DRAFT_FIRST_REFUSAL)
  })
})
