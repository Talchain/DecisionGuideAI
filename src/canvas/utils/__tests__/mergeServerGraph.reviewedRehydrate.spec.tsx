/**
 * "Checked by you" must survive a reload — the boot-merge half (L66, final-walk
 * defect 0, P1).
 *
 * THE WITNESSED DEFECT (journey-witness-final-2026-08-04-raw/runE, build
 * 610ed5f7, positive-control-backed): the user typed "pretty likely" on
 * `fac_pricing_level` ("Paid Tier Price Point"), accepted the 0.7 suggestion,
 * and the row read `0.7 · checked by you` with `data-reviewed=true`
 * (E-02-marks-pre-reload.json). ~3 s later the page reloaded. The VALUE
 * survived byte-identical — CEE holds it — but the row regressed to
 * `0.7 · Olumi estimate · check first` (E-03-marks-post-reload.json,
 * E-04 verdict `survived: false`). The user is re-prompted to redo a check
 * they made.
 *
 * WHY: the reload restored an autosave written BEFORE the receipt stamp
 * landed (the stamp is receipt-gated and nothing persists it at stamp time —
 * see optimisticFactorEdit.autosaveFlush.spec.ts for that half), and the
 * server graph cannot re-earn the badge through `observed_state.source`:
 * CEE's ObservedStateV3 types it as z.enum(['brief_extraction',
 * 'cee_inference']) — no user-owned member exists (rowed 2.396(b)). What the
 * server graph DOES carry — witnessed on the runE wire — is the node-level
 * claim `provenance: "user_set"`, which CEE writes when it applies the user's
 * edit. The UI ignored it; the 3 Aug rewalk filed the same inversion as N1
 * ("CEE emits provenance:'user_set' correctly — the UI reads the stale
 * observed_state.source").
 *
 * THE RULE UNDER TEST: `isReviewedByUser` treats the server's own
 * `provenance === 'user_set'` as a reviewed claim, so a boot merge over a
 * stale autosave re-earns the badge from the wire. Identity binding
 * (CLAUDE.md trap 19): every assertion binds to `fac_pricing_level` /
 * "Paid Tier Price Point" — the exact runE node — never to a value predicate
 * another node could satisfy.
 *
 * Controls, each stopping a cheaper wrong fix:
 *  - the stamped-autosave path (variant A) must STILL work — the rung must not
 *    replace the hydrateProvenance capture/restore machinery;
 *  - a server node WITHOUT a user provenance claim must NOT paint — the rung
 *    fires on 'user_set' only, never on 'ai_inferred'/'from_brief' (the
 *    over-claim direction is the serious one: a badge on a number the user
 *    never chose is the #570-A1 orphan-stamp class).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../../store'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'
import { isReviewedByUser } from '../../components/pre-analysis/utils/isReviewedByUser'
import { buildEstimateRows } from '../../components/pre-analysis-v3/selectors/buildEstimateRows'
import { EstimateRow } from '../../components/pre-analysis-v3/model/EstimateRow'

const NODE_ID = 'fac_pricing_level'
const LABEL = 'Paid Tier Price Point'

/** The server node as witnessed on the runE wire (post-merge sensitivity body). */
function serverGraph(overrides: Record<string, unknown> = {}) {
  return {
    nodes: [
      {
        id: NODE_ID,
        kind: 'factor',
        label: LABEL,
        provenance: 'user_set',
        display_value: '0.7',
        category: 'controllable',
        observed_state: {
          value: 0.7,
          source: 'cee_inference',
          raw_value: 0.7,
          factor_type: 'price',
          extractionType: 'inferred',
          std: 0.006999999999999999,
          baseline: 0.7,
        },
        ...overrides,
      },
    ],
    edges: [],
  }
}

/** A restored-autosave local node. */
function localNode(observedState: Record<string, unknown>): Node {
  return {
    id: NODE_ID,
    type: 'factor',
    position: { x: 100, y: 200 },
    data: {
      label: LABEL,
      kind: 'factor',
      provenance: 'ai_inferred',
      category: 'controllable',
      observedState,
    },
  } as Node
}

function mergedNode(): Node {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === NODE_ID)
  expect(node, `node ${NODE_ID} must survive the merge`).toBeDefined()
  return node as Node
}

beforeEach(() => {
  useCanvasStore.setState({ nodes: [], edges: [] } as never)
})

describe('boot merge re-earns "checked by you" from the server provenance claim (runE shape)', () => {
  it('autosave written INSIDE the receipt window (0.7 optimistic, source still cee_inference) — the witnessed runE loss', () => {
    useCanvasStore.setState({
      nodes: [
        localNode({ value: 0.7, raw_value: 0.7, source: 'cee_inference', std: 0, baseline: 0 }),
      ],
      edges: [],
    } as never)

    const result = mergeServerGraphOnHydrate(serverGraph())
    expect(result.accepted).toBe(true)

    const node = mergedNode()
    // Value survives via the server — the witnessed half that already worked.
    expect((node.data as { observedState?: { value?: number } }).observedState?.value).toBe(0.7)
    // The mark survives via the server's own provenance claim — the fix.
    expect(isReviewedByUser(node)).toBe(true)
  })

  it('autosave predating the edit entirely (value 0) — value moves to the server 0.7 AND the mark is re-earned', () => {
    useCanvasStore.setState({
      nodes: [localNode({ value: 0, source: 'cee_inference', std: 0, baseline: 0 })],
      edges: [],
    } as never)

    const result = mergeServerGraphOnHydrate(serverGraph())
    expect(result.accepted).toBe(true)

    const node = mergedNode()
    expect((node.data as { observedState?: { value?: number } }).observedState?.value).toBe(0.7)
    expect(isReviewedByUser(node)).toBe(true)
  })

  it('renders the witnessed row shape: "checked by you" with data-reviewed, on the runE row testid', () => {
    useCanvasStore.setState({
      nodes: [
        localNode({ value: 0.7, raw_value: 0.7, source: 'cee_inference', std: 0, baseline: 0 }),
      ],
      edges: [],
    } as never)
    mergeServerGraphOnHydrate(serverGraph())

    const node = mergedNode()
    const rows = buildEstimateRows(
      [node],
      { source: 'sensitivity', ordered: [NODE_ID], weights: { [NODE_ID]: 1 } },
      null,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]!.nodeId).toBe(NODE_ID)
    expect(rows[0]!.reviewed).toBe(true)

    render(<EstimateRow row={rows[0]!} expanded={false} onToggle={() => {}} />)
    const row = screen.getByTestId(`pre-analysis-v3-estimate-${NODE_ID}`)
    expect(row.getAttribute('data-reviewed')).toBe('true')
    expect(row.textContent).toContain('checked by you')
    // The regression the walk witnessed: the row must NOT re-prompt the check.
    expect(row.textContent).not.toContain('Olumi estimate')
    expect(row.textContent).not.toContain('check first')
  })
})

describe('controls — what the fix must NOT do', () => {
  it('CONTROL (stamped autosave, variant A): the existing capture/restore path still carries the stamp and the badge', () => {
    const stampedBag = {
      value: 0.7,
      raw_value: 0.7,
      source: 'user_override',
      std: 0.006999999999999999,
      baseline: 0.7,
    }
    const node = localNode(stampedBag)
    ;(node.data as Record<string, unknown>).observed_state = { ...stampedBag }
    useCanvasStore.setState({ nodes: [node], edges: [] } as never)

    mergeServerGraphOnHydrate(serverGraph())

    const after = mergedNode()
    const data = after.data as Record<string, unknown>
    expect((data.observed_state as { source?: string }).source).toBe('user_override')
    expect((data.observedState as { source?: string }).source).toBe('user_override')
    expect(isReviewedByUser(after)).toBe(true)
  })

  it('OVER-CLAIM GUARD: a server node with provenance ai_inferred does NOT paint the badge', () => {
    useCanvasStore.setState({
      nodes: [localNode({ value: 0.7, source: 'cee_inference', std: 0, baseline: 0 })],
      edges: [],
    } as never)

    mergeServerGraphOnHydrate(serverGraph({ provenance: 'ai_inferred' }))

    expect(isReviewedByUser(mergedNode())).toBe(false)
  })

  it('OVER-CLAIM GUARD: from_brief provenance (AI-extracted from the brief, not user-confirmed) does not paint either', () => {
    useCanvasStore.setState({
      nodes: [localNode({ value: 0.7, source: 'cee_inference', std: 0, baseline: 0 })],
      edges: [],
    } as never)

    mergeServerGraphOnHydrate(serverGraph({ provenance: 'from_brief' }))

    expect(isReviewedByUser(mergedNode())).toBe(false)
  })
})
