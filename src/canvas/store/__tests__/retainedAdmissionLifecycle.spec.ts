/**
 * `retainedAnalysisAdmission` — ITS WHOLE LIFECYCLE, AND THE GUARD THAT COVERS
 * THE SITES NO BEHAVIOURAL TEST REACHES.
 *
 * The field exists so that two different absences of `analysis_admission` stop
 * sharing one answer:
 *
 *   the producer never spoke (an older CEE) -> absence means NO AUTHORITY
 *   the producer spoke and WE nulled it     -> the last thing it said governs
 *
 * WITNESSED on staging 9eb30b54 (2026-09-10): a `quantified_provisional` run
 * rendered "What this run may not conclude", and 59ms after one factor value was
 * edited the same slot rendered "Most likely to serve your goal / Double Down on
 * SMB". The user-visible consequence is pinned by ARM A2 in
 * `useResultsSectionData.admissionGatesLeader.spec.ts`; this file pins the STORE
 * contract the fix rests on, plus the two hazards the fix itself introduces.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useCanvasStore } from '../../store'
import type { AnalysisAdmissionV1 } from '../../../adapters/cee/types'

const REFUSAL: AnalysisAdmissionV1 = {
  permitted_analysis_mode: 'quantified_provisional',
  reasons: [{ field: 'semantic_quality_sufficient', message: 'Every estimate here is Olumi’s.' }],
}

const FACTOR = {
  id: 'fac_churn',
  type: 'factor',
  position: { x: 0, y: 0 },
  data: { kind: 'factor', label: 'Churn rate', observedState: { value: 0.2 } },
}

function seedReadyWithRefusal() {
  useCanvasStore.setState({
    nodes: [FACTOR],
    edges: [],
    ceeAnalysisReady: {
      status: 'ready', options: [], goal_node_id: 'goal_1', analysis_admission: REFUSAL,
    },
    retainedAnalysisAdmission: null,
  } as never)
}

describe('retainedAnalysisAdmission lifecycle', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [], edges: [], ceeAnalysisReady: null, retainedAnalysisAdmission: null,
    } as never)
  })

  it('a local analytical edit RETAINS the producer’s refusal while nulling readiness', () => {
    seedReadyWithRefusal()
    // Precondition: nothing retained yet, so what we observe is this edit's doing.
    expect(useCanvasStore.getState().retainedAnalysisAdmission).toBeNull()

    useCanvasStore.getState().updateNode('fac_churn', {
      data: { observedState: { value: 0.41 } },
    } as never)

    const s = useCanvasStore.getState()
    expect(s.ceeAnalysisReady, 'the edit must still invalidate readiness — this is not a fresh flag').toBeNull()
    expect(
      s.retainedAnalysisAdmission?.permitted_analysis_mode,
      'the refusal must survive the edit, or absence is read as licence again',
    ).toBe('quantified_provisional')
  })

  it('a NON-analytical edit changes nothing — the retention is not a blanket edit hook', () => {
    seedReadyWithRefusal()
    useCanvasStore.getState().updateNode('fac_churn', { data: { label: 'Churn %' } } as never)
    const s = useCanvasStore.getState()
    expect(s.ceeAnalysisReady, 'a label change is not an analytical change').not.toBeNull()
    expect(s.retainedAnalysisAdmission).toBeNull()
  })

  /**
   * ⭐ THE HAZARD THE FIX INTRODUCES, and it must be guarded or the fix trades one
   * cross-boundary lie for another. The retained admission is scoped to ONE
   * decision. If it survived a full-context replacement, the PREVIOUS decision's
   * refusal (or licence) would govern edits made to the NEXT one — the same class
   * of leak `DECISION_CONTEXT_CLEAR` already exists to stop for `goalThreshold`.
   */
  it('a decision-context replacement CLEARS it — a previous decision may not govern the next', () => {
    seedReadyWithRefusal()
    useCanvasStore.getState().updateNode('fac_churn', {
      data: { observedState: { value: 0.41 } },
    } as never)
    expect(
      useCanvasStore.getState().retainedAnalysisAdmission,
      'precondition: something must be retained, or this asserts nothing',
    ).not.toBeNull()

    useCanvasStore.getState().resetCanvas()

    expect(
      useCanvasStore.getState().retainedAnalysisAdmission,
      'the previous decision’s admission must not ride into the next decision',
    ).toBeNull()
  })

  /**
   * ⭐⭐ THE DERIVED GUARD — it covers the clear sites no behavioural test reaches.
   *
   * Retention is captured at the CLEAR sites, and there are five of them
   * (`invalidateAnalysisReady`, undo, redo, `undoDraft`, `setCeeAnalysisReady(null)`).
   * ARM A2 exercises one. Writing four more behavioural arms would be four fixtures
   * to keep in step; worse, a SIXTH clear site added later would be covered by none
   * of them and the suite would stay green — which is precisely how this defect
   * shipped in the first place.
   *
   * So this asserts the property structurally, against the source: every spread of
   * the raw constant must go through `readinessClearFields`, which is the only thing
   * that records the admission. The ONE permitted raw use is inside that helper.
   *
   * ⚠ IT PINS ITS OWN PRECONDITION. A guard that greps a file it failed to read, or
   * whose pattern has stopped matching anything, agrees with every build — so the
   * helper's own line and a non-zero call count are asserted first. Without that,
   * a renamed helper would make this pass by matching nothing.
   */
  it('every readiness-clear site routes through readinessClearFields (derived from source)', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/canvas/store.ts'), 'utf8')

    // Precondition 1: we really read the store, not an empty or wrong file.
    expect(src.length, 'the guard did not read store.ts — it would agree with anything').toBeGreaterThan(10_000)
    // Precondition 2: the helper still exists under this name, and is actually used.
    expect(src).toContain('function readinessClearFields(')
    const callSites = src.match(/readinessClearFields\(get\)/g) ?? []
    expect(
      callSites.length,
      'zero call sites means the helper was renamed or removed and this guard has stopped discriminating',
    ).toBeGreaterThanOrEqual(5)

    // The claim: the raw constant is spread in exactly ONE place — inside the helper.
    const rawUses = src.match(/\.\.\.READINESS_CLEAR_FIELDS|set\(READINESS_CLEAR_FIELDS\)/g) ?? []
    expect(
      rawUses.length,
      `found ${rawUses.length} raw READINESS_CLEAR_FIELDS spreads; only the one inside ` +
      `readinessClearFields is permitted. A clear site that bypasses the helper does not record the ` +
      `producer's admission, so an edit reaching it reopens "absence read as licence".`,
    ).toBe(1)
  })
})
