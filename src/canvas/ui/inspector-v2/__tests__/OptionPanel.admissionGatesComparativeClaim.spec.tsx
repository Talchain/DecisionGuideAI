/**
 * THE INSPECTOR MUST NOT NAME A LEADER THE MODEL DOES NOT LICENSE.
 *
 * A leader claim is governed by TWO questions, and the codebase says so in
 * terms (`useAnalysisReady.ts:100-116`):
 *
 *   Q1  does the MODEL license a comparative claim at all?  `permitted_analysis_mode`
 *   Q2  did THIS RESULT separate the arms?                  `verdict.hasLeadingOption`
 *
 * They are conjoined AT THE POINT OF USE, on their own lines, because their
 * ABSENCE ARMS ARE OPPOSITE: Q1 absent → `true` (the producer has not spoken,
 * so nothing changes); Q2 absent → `false` (no result, so no claim). A shared
 * default would blank every legacy payload or license every one.
 *
 * `OptionPanel` consulted Q2 alone at BOTH its comparative sites, so CEE could
 * withhold the designation while the inspector said "Came out ahead across
 * scenarios" and "Behind X by Npp". UI #1202 closed the same defect on the
 * canvas nodes; this is the inspector half, and it was outside that PR's diff.
 *
 * ⚠ MOUNTS `InspectorModal`, THE DEPLOYED PATH, never `OptionPanel` directly.
 * The chain is `ReactFlowGraph` → `InspectorModal` → v2 branch →
 * `InspectorRouter` → `OptionPanel`. A spec rendering the panel directly stays
 * green whatever the router does, and this estate has shipped that defect
 * twice (CLAUDE.md trap 3b).
 *
 * ⚠ EVERY ABSENCE ASSERTION IS PRECEDED BY THE POSITIVE IT DEPENDS ON. "The
 * claim is not on screen" is satisfied by an inspector that never opened, a
 * hero that never rendered, or a typo in the query — so each withheld arm is
 * paired with a permitted twin proving the same fixture DOES produce the claim
 * when Q1 allows it (trap 13).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

import { InspectorModal } from '../../../components/InspectorModal'
import { useCanvasStore } from '../../../store'
import type { AnalysisAdmissionV1, PermittedAnalysisMode } from '../../../../adapters/cee/types'

vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

const NODE_INSPECTOR = 'div[role="dialog"][aria-label="Node inspector"]'
const LEADER_ID = 'opt-phased'
const LEADER_LABEL = 'Phased migration'
const RIVAL_ID = 'opt-full'
const RIVAL_LABEL = 'Full switch'

/** The two comparative sentences this panel can author. */
// The SENTENCE form (`COMPARATIVE_COPY.sentence`), not the label form. A first
// draft matched 'came out ahead across scenarios' — the chart LABEL — which the
// panel never renders, so the withheld arm passed against a string that could
// not appear. Bound to the shape the panel actually authors.
const AHEAD_CLAIM = /came out ahead in .+ of simulated scenarios/i
const BEHIND_CLAIM = /behind .* by \d+pp|within \d+pp of the leading option/i

function optionNode(id: string, label: string) {
  return {
    id, type: 'option', position: { x: 0, y: 0 },
    data: { kind: 'option', label, provenance: 'ai_inferred', interventions: {} },
  }
}

/**
 * A completed run with a CLEAR leader, plus an admission arm.
 *
 * `mode` is the producer's `permitted_analysis_mode`; `null` seeds NO
 * `ceeAnalysisReady` at all, which is the legacy-producer arm and must behave
 * exactly as before.
 */
/**
 * ⚠ THE REFUSING MODES ARE THE REAL ENUM, NOT A LITERAL I INVENTED.
 *
 * A first draft passed `'single_option'`, which is NOT a `PermittedAnalysisMode`
 * at all — it is borrowed from `flipReasonVocabulary`, an ISL flip-reason enum.
 * It changed no behaviour (the gate is one equality against `comparative_leader`)
 * but it put a FALSE RECORD in a spec whose whole job is pinning an honesty
 * claim, and a local string-literal type plus an `as never` cast hid it from the
 * compiler. Typed against the contract now, so the compiler is the guard.
 *
 * ⭐ AND IT SWEEPS ALL THREE REFUSING MODES rather than one. The ladder is
 * `none < exploratory < quantified_provisional < comparative_leader`, and only
 * the last licenses naming a leader — so a spec that tested one literal bound to
 * that literal, where the property is about the ENUM.
 */
const REFUSING_MODES: readonly PermittedAnalysisMode[] = [
  'none',
  'exploratory',
  'quantified_provisional',
]

/** `reasons` is NEVER empty on a refusal, by contract (`AnalysisAdmissionReason`). */
const admission = (mode: PermittedAnalysisMode): AnalysisAdmissionV1 => ({
  permitted_analysis_mode: mode,
  reasons: mode === 'comparative_leader'
    ? []
    : [{
        field: 'semantic_quality_sufficient',
        message: 'Every confidence-bearing number in this model was estimated by Olumi, not stated by you.',
      }],
})

function seedRun(mode: PermittedAnalysisMode | null) {
  useCanvasStore.setState({
    nodes: [optionNode(LEADER_ID, LEADER_LABEL), optionNode(RIVAL_ID, RIVAL_LABEL)] as never[],
    edges: [],
    results: {
      status: 'complete',
      report: {
        option_probabilities: {
          [LEADER_ID]: { win_probability: 0.72, status: 'ok' },
          [RIVAL_ID]: { win_probability: 0.28, status: 'ok' },
        },
        option_comparison: [
          { option_id: LEADER_ID, win_probability: 0.72, label: LEADER_LABEL },
          { option_id: RIVAL_ID, win_probability: 0.28, label: RIVAL_LABEL },
        ],
        // ⚠ `top_option_id` IS REQUIRED, AND OMITTING IT SEEDS THE WITHHELD STATE.
        // `decisionVerdict.ts` reads a `near_tie` lacking its identity as
        // CONTRACT-INVALID — the signature of CEE stripping the block — so the
        // gate answers "did CEE withhold?" with YES. A first draft of this
        // fixture omitted it and BOTH permitted twins failed while both
        // withheld arms passed: the vacuity signature the twins exist to catch.
        robustness: {
          recommended_option_id: LEADER_ID,
          near_tie: { is_tie: false, top_option_id: LEADER_ID, gap: 0.44 },
        },
      },
    },
    ceeAnalysisReady: mode == null
      ? null
      : { status: 'ready', options: [], goal_node_id: 'goal_1', analysis_admission: admission(mode) },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: { x: 0, y: 0 } },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

function openInspector(nodeId: string): string {
  const utils = render(<InspectorModal nodeId={nodeId} edgeId={null} onClose={vi.fn()} />)
  const dialog = utils.container.querySelector(NODE_INSPECTOR)
  expect(dialog, 'PRECONDITION: the node inspector dialog must be mounted').not.toBeNull()
  return dialog!.textContent ?? ''
}

beforeEach(() => { document.body.innerHTML = '' })

describe('OptionPanel — the model admission gates the comparative claim', () => {
  it('PERMITTED TWIN: with comparative_leader, the leader IS named', () => {
    seedRun('comparative_leader')
    const text = openInspector(LEADER_ID)
    expect(text, 'the fixture must produce the claim, or the withheld arm below proves nothing')
      .toMatch(AHEAD_CLAIM)
  })

  it.each(REFUSING_MODES)('WITHHELD (%s): the leader is NOT named', mode => {
    seedRun(mode)
    const text = openInspector(LEADER_ID)
    expect(text).not.toMatch(AHEAD_CLAIM)
  })

  it('PERMITTED TWIN: a non-leader IS told how far behind', () => {
    seedRun('comparative_leader')
    const text = openInspector(RIVAL_ID)
    expect(text, 'the fixture must produce a behind-claim, or the withheld arm proves nothing')
      .toMatch(BEHIND_CLAIM)
  })

  it.each(REFUSING_MODES)('WITHHELD (%s): a non-leader is NOT told how far behind', mode => {
    seedRun(mode)
    const text = openInspector(RIVAL_ID)
    expect(text).not.toMatch(BEHIND_CLAIM)
  })

  it('ABSENCE ARM: no admission at all behaves exactly as before (Q1 absent → true)', () => {
    // An older producer must not be silenced. This is the arm a shared default
    // would break, and it is the reason Q1 and Q2 keep separate defaults.
    seedRun(null)
    const text = openInspector(LEADER_ID)
    expect(text).toMatch(AHEAD_CLAIM)
  })
})
