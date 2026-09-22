/**
 * ⭐⭐⭐ THE LIVE GOAL PANEL SHOWED A CONSTANT AND CALLED IT THE TARGET.
 *
 * ⛔ AND THE FIX FOR THIS SHIPPED INTO A DEAD FILE FIRST. #1844 corrected
 * `NodeInspector.tsx`, whose BOTH mount sites are unreachable — `InspectorModal`
 * returns at `:160` under the module literal `const USE_INSPECTOR_V2 = true`,
 * above its `<NodeInspector>` at `:226`; and `PropertiesPanel` has zero non-test
 * importers. The surface a reader actually opens is this panel, via
 * `InspectorRouter`. Green tests on a component the deployment does not render
 * (CLAUDE.md: bind UI tests to the surface the DEPLOYED FLAGS mount).
 *
 * ## What CEE measured, 22 Sep 2026, answering this lane's own ask
 * `target_derived_headroom` takes the cap FROM THE TARGET (`raw * 1.25`), so
 * `raw / (raw * 1.25) === 0.8` for EVERY raw > 0. Measured: `goal_threshold` is
 * 0.8 in 42 of 54 boards carrying one, and `cap/raw === 1.25` in 18 of 18.
 * **A number that cannot vary carries no information.**
 *
 * `goal_threshold_raw` + `goal_threshold_unit` ship on **24 of 24**
 * goal-threshold-bearing nodes, and the `analysis_ready` schema's own comment
 * instructs this rendering: *"Render the user's figure from `goal_threshold_raw`
 * + `goal_threshold_unit`."*
 *
 * This panel read `thresholdRaw` at `:152` and passed it ONLY to the editor —
 * the readout got `goalThreshold` with the unit stripped. So the reader was
 * shown `≥ 0.8` while the panel held `20000` and `£` one line away.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { GoalPanel } from '../panels/GoalPanel'
import { useCanvasStore } from '../../../store'

function seed(nodeData: Record<string, unknown>, threshold: number, rep: string) {
  useCanvasStore.setState({
    nodes: [{ id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Reach MRR', ...nodeData } }],
    edges: [],
    goalThreshold: threshold,
    goalThresholdRepresentation: rep,
    goalConstraints: [],
    confirmedNodeIds: new Set(),
    touchedNodeIds: new Set(),
  } as never)
}

describe('GoalPanel — the target is the user\'s own figure', () => {
  beforeEach(() => cleanup())
  afterEach(() => cleanup())

  it("⭐ shows the RAW figure and its unit, not the normalised constant", () => {
    seed({ goal_threshold_raw: 20000, goal_threshold_unit: '£' }, 0.8, 'normalised')
    render(<GoalPanel nodeId="goal1" techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    const txt = document.body.innerText || document.body.textContent || ''
    expect(txt, 'the panel stated the 0.8 constant instead of the target').not.toMatch(/\b0\.8\b/)
    expect(txt, "the reader's own figure was withheld").toMatch(/20[,.]?000/)
  })

  /**
   * ⛔ CEE's 12 NRR boards: `goal_threshold` 1.1 against `raw 110`, `cap 140`,
   * from "Achieve NRR Above 110%". A percentage target above 100% normalised
   * against an implicit 0-100 scale. Showing the RAW rescues them — 110% is the
   * reader's real goal; only the normalised 1.1 is incoherent.
   */
  it('⛔ an out-of-range normalised value still yields the raw target', () => {
    seed({ goal_threshold_raw: 110, goal_threshold_unit: '%' }, 1.1, 'normalised')
    render(<GoalPanel nodeId="goal1" techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    const txt = document.body.innerText || document.body.textContent || ''
    expect(txt).toMatch(/110/)
    expect(txt, 'the incoherent normalised scalar was stated').not.toMatch(/\b1\.1\b/)
  })

  /**
   * ⭐ CONTROL. Without an anchor there is nothing to un-normalise against, so
   * the constant must still be WITHHELD — and this arm must pass both before
   * and after the change, or the two above are testing the renderer's existence
   * rather than its rule.
   */
  it('⭐ CONTROL: with no raw anchor the constant is withheld, not printed', () => {
    seed({}, 0.8, 'normalised')
    render(<GoalPanel nodeId="goal1" techMode={false} onClose={() => {}} onNavigate={() => {}} />)
    const txt = document.body.innerText || document.body.textContent || ''
    expect(txt).not.toMatch(/\b0\.8\b/)
  })
})
