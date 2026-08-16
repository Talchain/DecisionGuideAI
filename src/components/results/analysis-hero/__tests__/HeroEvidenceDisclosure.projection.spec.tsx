/**
 * HeroEvidenceDisclosure — analysis-graph projection pins (P3 UI agency).
 *
 * ⭐ MIGRATED FROM `v7/__tests__/V7EvidenceDisclosure.projection.spec.tsx`,
 * declared here because silently moving a guard is how a guard stops biting
 * (CLAUDE.md 13b). The CLAIMS are the retired suite's, unchanged: viewing Flip
 * risks marks exactly the resolvable fragile edges; Drivers marks the driver
 * nodes; switching swaps; closing clears; unmounting clears; unresolvable ids
 * no-op; nothing-to-disclose produces zero marks. What moved is the HOST — onto
 * the disclosure a post-run user actually loads. That half is strictly stronger.
 *
 * ⚠ WHY THIS SUITE EXISTS AT ALL. `V7EvidenceDisclosure` was the ONLY caller of
 * `useAnalysisProjection` in the repo. With it deleted, the marking code in
 * `canvas/nodes/BaseNode.tsx` and `canvas/edges/StyledEdge.tsx` was permanently
 * inert — live, reachable, and unable to fire. A store-slice unit test cannot
 * see that: `canvas/store/__tests__/analysisHighlight.spec.ts` drives the slice
 * DIRECTLY and stays green with no caller anywhere. Only a spec that opens the
 * disclosure and reads the slice can tell "the projection works" from "the
 * projection has no trigger".
 *
 * ⚠ ONE STRUCTURAL DIVERGENCE FROM THE RETIRED SUITE, pinned rather than
 * papered over (§7). On the old host the flip-risk ROWS were the
 * `challengeFragileEdges` slice, so rows and projection input were one object.
 * This host builds its flip rows from `recommendation.flipThresholds` and
 * carries the fragile-edge references separately as `evidence.fragileEdgeRefs`.
 * The chip's PRESENCE is therefore driven by the display rows and the MARKING by
 * the references — so refs with no rows must mark nothing, because there is no
 * view for the user to open.
 *
 * CLAIM TYPE: store state after a real render + real click, in jsdom. NOT a
 * visibility claim — jsdom cannot prove that a marked edge is drawn differently,
 * and nothing here asserts one.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { HeroEvidenceDisclosure } from '../HeroEvidenceDisclosure'
import { useCanvasStore } from '@/canvas/store'
import { heroEvidenceModel as model, heroDriverRow } from '../__fixtures__/heroEvidenceModel'
import { openDisclosureHeader, switchEvidenceView } from './helpers/heroEvidenceView'

// A minimal canvas: two factors → one outcome, plus a SECOND outgoing edge from
// fac_price so that a bare from_id is genuinely ambiguous (§6 depends on it).
function seedCanvas() {
  useCanvasStore.setState({
    nodes: [
      { id: 'fac_price', position: { x: 0, y: 0 }, data: {}, type: 'factor' },
      { id: 'fac_demand', position: { x: 0, y: 0 }, data: {}, type: 'factor' },
      { id: 'out_mrr', position: { x: 0, y: 0 }, data: {}, type: 'outcome' },
      { id: 'out_cost', position: { x: 0, y: 0 }, data: {}, type: 'outcome' },
    ] as never,
    edges: [
      { id: 'e1', source: 'fac_price', target: 'out_mrr', data: {} },
      { id: 'e2', source: 'fac_price', target: 'out_cost', data: {} },
      { id: 'e3', source: 'fac_demand', target: 'out_mrr', data: {} },
    ] as never,
  })
}

const highlight = () => useCanvasStore.getState().analysisHighlight

/**
 * A flip-risk DISPLAY row. Its only job here is to make the Flip risks chip
 * exist — this host filters its chips by presence, so a projection assertion
 * that forgot the row would be asserting about a view that never rendered.
 */
const FLIP_DISPLAY_ROW = {
  text: 'If Price falls below 30, Upskill the team becomes the likely leader.',
  targetId: null,
  switchMeta: null,
  magnitude: null,
}

beforeEach(() => {
  cleanup()
  seedCanvas()
  useCanvasStore.getState().clearAnalysisHighlight()
})

describe('HeroEvidenceDisclosure — analysis-graph projection', () => {
  it('§1 viewing the Flip risks view marks EXACTLY the resolvable fragile edges', () => {
    render(
      <HeroEvidenceDisclosure
        evidence={model({
          // A driver row is present so the chip STRIP renders (this host hides
          // it at one view) AND so the flip-risks assertion below is
          // discriminating: a targetable driver exists, and `nodeIds` must
          // still be empty once Flip risks is the active view.
          drivers: [heroDriverRow('undetermined', { label: 'Price', targetId: 'fac_price' })],
          flipRisks: [FLIP_DISPLAY_ROW],
          fragileEdgeRefs: [
            { fromId: 'fac_price', toId: 'out_mrr' },
            { fromId: 'fac_demand', toId: 'out_mrr' },
          ],
        })}
      />,
    )
    openDisclosureHeader()
    switchEvidenceView('flipRisks')

    const h = highlight()
    expect(h.source).toBe('flip_risks')
    expect([...h.edgeIds].sort()).toEqual(['e1', 'e3'])
    expect(h.nodeIds.size).toBe(0)
  })

  it('§2 viewing the Drivers view marks the resolvable driver nodes', () => {
    render(
      <HeroEvidenceDisclosure
        evidence={model({
          drivers: [
            heroDriverRow('undetermined', { rank: 1, label: 'Price', targetId: 'fac_price' }),
            heroDriverRow('undetermined', { rank: 2, label: 'Demand', targetId: 'fac_demand' }),
          ],
        })}
      />,
    )
    // Drivers is the default view — opening projects immediately.
    openDisclosureHeader()

    const h = highlight()
    expect(h.source).toBe('drivers')
    expect([...h.nodeIds].sort()).toEqual(['fac_demand', 'fac_price'])
    expect(h.edgeIds.size).toBe(0)
  })

  it('§3 switching views SWAPS the marks (drivers → flip risks)', () => {
    render(
      <HeroEvidenceDisclosure
        evidence={model({
          drivers: [heroDriverRow('undetermined', { label: 'Price', targetId: 'fac_price' })],
          flipRisks: [FLIP_DISPLAY_ROW],
          fragileEdgeRefs: [{ fromId: 'fac_demand', toId: 'out_mrr' }],
        })}
      />,
    )
    openDisclosureHeader()
    expect(highlight().source).toBe('drivers')
    expect([...highlight().nodeIds]).toEqual(['fac_price'])

    switchEvidenceView('flipRisks')
    const h = highlight()
    expect(h.source).toBe('flip_risks')
    expect([...h.edgeIds]).toEqual(['e3'])
    expect(h.nodeIds.size).toBe(0)
  })

  it('§4 closing the disclosure CLEARS the marks', () => {
    render(
      <HeroEvidenceDisclosure
        evidence={model({
          drivers: [heroDriverRow('undetermined', { label: 'Price', targetId: 'fac_price' })],
        })}
      />,
    )
    openDisclosureHeader()
    expect(highlight().source).toBe('drivers')

    openDisclosureHeader() // the header is a toggle — this closes it
    const h = highlight()
    expect(h.source).toBeNull()
    expect(h.edgeIds.size).toBe(0)
    expect(h.nodeIds.size).toBe(0)
  })

  it('§5 switching to Trade-offs CLEARS the marks (only drivers/flip-risks project)', () => {
    render(
      <HeroEvidenceDisclosure
        evidence={model({
          drivers: [heroDriverRow('undetermined', { label: 'Price', targetId: 'fac_price' })],
          tradeOffs: [
            { option: 'Two developers', gain: 'Speed', giveUp: 'Cost', dependsOn: 'Hiring', watch: 'Morale' },
          ],
        })}
      />,
    )
    openDisclosureHeader()
    expect(highlight().source).toBe('drivers')

    switchEvidenceView('tradeOffs')
    expect(highlight().source).toBeNull()
  })

  it('§6 unresolvable references no-op: neither a ghost pair nor a bare from_id is guessed', () => {
    render(
      <HeroEvidenceDisclosure
        evidence={model({
          drivers: [heroDriverRow('undetermined', { label: 'Price', targetId: 'fac_price' })],
          flipRisks: [FLIP_DISPLAY_ROW],
          fragileEdgeRefs: [
            // ghost endpoints — no matching canvas edge
            { fromId: 'ghost_a', toId: 'ghost_b' },
            // bare from_id — ambiguous (fac_price has TWO outgoing edges), so
            // the resolver must decline rather than pick one.
            { fromId: 'fac_price' },
          ],
        })}
      />,
    )
    openDisclosureHeader()
    switchEvidenceView('flipRisks')

    const h = highlight()
    expect(h.source).toBe('flip_risks')
    expect(h.edgeIds.size).toBe(0)
  })

  it('§7 fragile references with NO flip display rows mark nothing (no view to open)', () => {
    // The divergence named in the header: refs and rows are separate fields on
    // this host. A resolvable ref whose view the user cannot reach must not
    // mark the canvas — the projection describes what is ON SCREEN.
    render(
      <HeroEvidenceDisclosure
        evidence={model({
          drivers: [heroDriverRow('undetermined', { label: 'Price', targetId: 'fac_price' })],
          flipRisks: [],
          fragileEdgeRefs: [{ fromId: 'fac_demand', toId: 'out_mrr' }],
        })}
      />,
    )
    openDisclosureHeader()
    // Drivers is the only present view, so that is what projects.
    expect(highlight().source).toBe('drivers')
    expect(highlight().edgeIds.size).toBe(0)
  })

  it('§8 nothing to disclose renders nothing and produces zero marks', () => {
    const { container } = render(<HeroEvidenceDisclosure evidence={model({})} />)
    expect(container.firstChild).toBeNull()
    const h = highlight()
    expect(h.source).toBeNull()
    expect(h.edgeIds.size).toBe(0)
    expect(h.nodeIds.size).toBe(0)
  })

  it('§9 unmounting clears the marks (no projection outlives the panel)', () => {
    const { unmount } = render(
      <HeroEvidenceDisclosure
        evidence={model({
          drivers: [heroDriverRow('undetermined', { label: 'Price', targetId: 'fac_price' })],
        })}
      />,
    )
    openDisclosureHeader()
    expect(highlight().source).toBe('drivers')
    unmount()
    expect(highlight().source).toBeNull()
  })

  it('§10 a driver with no canvas target is DROPPED, not guessed (fail-closed resolution)', () => {
    // Discriminating pair for §2: the same render, one row targetable and one
    // not. If the projection ever started falling back to a label or an index,
    // §2 alone would still pass — this is the case that would not.
    render(
      <HeroEvidenceDisclosure
        evidence={model({
          drivers: [
            heroDriverRow('undetermined', { rank: 1, label: 'Price', targetId: 'fac_price' }),
            heroDriverRow('undetermined', { rank: 2, label: 'Morale', targetId: null }),
            heroDriverRow('undetermined', { rank: 3, label: 'Ghost', targetId: 'not_on_canvas' }),
          ],
        })}
      />,
    )
    openDisclosureHeader()
    expect([...highlight().nodeIds]).toEqual(['fac_price'])
  })
})
