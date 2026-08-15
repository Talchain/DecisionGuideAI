/**
 * ⭐ ACCEPTANCE: THE BUTTON, NOT A FIXTURE. Click "Use Grace's 0.85" and assert
 * the WIRE payload carries `applied_from`.
 *
 * ── WHY THIS EXISTS, AND WHY IT IS SHAPED LIKE THIS ───────────────────────
 * The 14 Aug deploy witness for #689 PASSED on the deployed build — both pills
 * visually confirmed, identity binding proven — and still missed that the whole
 * feature was unreachable through the product's own click path, because
 * `adaptFactorValueEdit` dropped `applied_from` on the way to the wire. **Every
 * capture in that witness was of a payload the witness itself constructed.** A
 * hand-built payload proves the server honours a claim; it cannot prove the
 * client ever makes one.
 *
 * So this spec is built from the REAL parts, end to end, with nothing
 * hand-assembled at the seam under test:
 *
 *   RevealBody's real button  (the component the deployed page renders)
 *     → the real `rememberPendingApply` handoff  (localStorage)
 *       → the real `usePanelApplyDrain`
 *         → the real `buildFactorValueEditEvent`
 *           → the real `buildV5Payload` / `adaptFactorValueEdit`
 *             → the payload asserted here
 *
 * The test supplies only what a user or a server supplies: a reveal fixture, a
 * node's data, and a click. **If any link in that chain drops the attribution,
 * this REDs** — which is the property the witness could not have, and the reason
 * a green component test and a green deploy witness coexisted with a dark
 * capability.
 *
 * ⚠ NOT A BROWSER TEST, STATED PLAINLY. It runs in jsdom, so it proves the
 * DATA reaches the wire and cannot prove the button is visible or clickable at
 * a real viewport (jsdom cannot settle layout). The deploy witness covers the
 * visual half; this covers the half the witness structurally could not.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { RevealBody } from '../../../pages/ParticipantPacketPage'
// RevealView lives on the SERVICE, not the page — the page re-exports the type it
// consumes. Importing it from its owner keeps this fixture bound to the wire
// shape rather than to a component's local view of it.
import type { RevealView } from '../../../collab/collabService'
import { rememberPendingApply, forgetPendingApply } from '../../../collab/panelApplyHandoff'
import { usePanelApplyDrain } from '../usePanelApplyDrain'
import { buildV5Payload } from '../../../v5/buildPayload'

const SCENARIO_ID = '22222222-3333-4444-8555-666677778888'
const TURN_ID = '11111111-2222-4333-8444-555566667777'
const ROUND_ID = 'c3d4e5f6-a7b8-4901-9234-56789abcdef0'
const GRACE_ID = '9f1c7d2e-4b3a-4c11-8e6f-0a2b5c8d7e10'
const NADIA_ID = 'e1e1e1e1-2222-4333-8444-555566667777'
const TARGET_ID = 'factor-churn-risk'

/** Grace is deliberately row 0 — see the identity-binding case below. */
const REVEAL: RevealView = {
  round_id: ROUND_ID,
  status: 'closed',
  graph_version_ref: 'mv-1',
  per_target: [
    {
      target: { kind: 'factor', id: TARGET_ID },
      label: 'Churn risk',
      model_value_at_version: 0.5,
      responses: [
        {
          participant_id: GRACE_ID,
          display_label: 'Grace',
          value: 0.85,
          expression_raw: 'pretty likely',
          confidence: 0.7,
          kind: 'belief_submitted',
        },
        {
          participant_id: NADIA_ID,
          display_label: 'Nadia',
          value: 0.4,
          expression_raw: 'not very likely',
          confidence: 0.6,
          kind: 'belief_submitted',
        },
      ],
    },
  ],
} as unknown as RevealView

/** A plain model-scale factor: no cap, no unit, so the builder stays model-scale. */
const NODE_DATA = { label: 'Churn risk', observedState: { value: 0.5 } }

/**
 * The canvas half. Mounts the REAL drain and pushes whatever the real builder
 * produced through the REAL payload builder, capturing the wire event.
 */
function CanvasHarness({ onWire }: { onWire: (event: unknown) => void }): JSX.Element {
  usePanelApplyDrain({
    scenarioId: SCENARIO_ID,
    graphReady: true,
    graphRevision: NODE_DATA,
    lookupNodeData: (id) => (id === TARGET_ID ? NODE_DATA : undefined),
    sendSystemEvent: async (event) => {
      // THE LAST REAL HOP — the one that was dropping the field. The event here
      // is exactly what the conversation context would hand `sendTurn`.
      const result = buildV5Payload({
        turnId: TURN_ID,
        scenarioId: SCENARIO_ID,
        stage: 'frame' as never,
        turnClass: 'system' as never,
        mode: 'system',
        systemEvent: event as never,
      })
      if (!result.ok) throw new Error(`payload refused: ${JSON.stringify(result)}`)
      onWire((result.payload as unknown as { event: unknown }).event)
      return undefined
    },
  })
  return <div data-testid="canvas" />
}

/** The panel half: the real button, wired to the real handoff, as the owner page wires it. */
function PanelHarness(): JSX.Element {
  return (
    <RevealBody
      reveal={REVEAL}
      apply={{
        // Mirrors PanelSetupPage's handler at its load-bearing line: record the
        // intent. The page's extra work (read-back assertion, confirmation copy)
        // is not on the wire path and has its own specs.
        onApply: (args) =>
          rememberPendingApply({
            scenarioId: SCENARIO_ID,
            roundId: REVEAL.round_id,
            participantId: args.participantId,
            targetId: args.targetId,
            value: args.value,
          }),
        applyingKey: null,
        appliedKey: null,
        applyError: null,
      }}
    />
  )
}

/** Click the REAL button by the label a user reads, then drain on the canvas. */
async function clickApplyThenDrain(buttonLabel: string): Promise<unknown> {
  render(<PanelHarness />)
  const button = screen.getByText(buttonLabel)
  await act(async () => {
    button.click()
  })

  let wire: unknown = null
  render(<CanvasHarness onWire={(e) => { wire = e }} />)
  await act(async () => {
    await Promise.resolve()
  })
  return wire
}

describe('panel apply — click to wire', () => {
  beforeEach(() => {
    forgetPendingApply(SCENARIO_ID)
    vi.restoreAllMocks()
  })

  afterEach(() => {
    forgetPendingApply(SCENARIO_ID)
  })

  it('POSITIVE CONTROL — the real button exists with the label a user reads', () => {
    // If the label or the component changes, this fails FIRST and by name,
    // rather than the wire assertions failing for an unrelated reason and
    // sending a reader to look at the adapter.
    render(<PanelHarness />)
    expect(screen.getByText('Use Grace’s 0.85')).toBeTruthy()
    expect(screen.getByText('Use Nadia’s 0.4')).toBeTruthy()
    // Both rows keep their button — the minority position is never retired.
    expect(screen.getByTestId(`reveal-apply-${TARGET_ID}-${NADIA_ID}`)).toBeTruthy()
  })

  it('⭐ clicking "Use Grace’s 0.85" puts applied_from ON THE WIRE', async () => {
    const wire = (await clickApplyThenDrain('Use Grace’s 0.85')) as Record<string, unknown>

    expect(wire, 'no turn reached the wire at all').not.toBeNull()
    expect(wire.kind).toBe('factor_value_edit')
    expect(wire.target_id).toBe(TARGET_ID)
    expect(wire.value).toBe(0.85)

    // THE ASSERTION THIS FILE EXISTS FOR. Without it CEE stamps
    // `source: 'user_override'` with no `elicited_from`, and the owner who
    // clicked "Use Grace's 0.85" is told "Set by you".
    expect(wire.applied_from).toEqual({
      round_id: ROUND_ID,
      participant_id: GRACE_ID,
    })
  })

  it('⭐ IDENTITY BINDING — clicking Nadia’s row claims NADIA, not row 0', async () => {
    // Grace is row 0 in the fixture on purpose. A chain that carried a
    // participant id but resolved it from the first response would pass the
    // previous test and fail this one — the same confound the deploy witness
    // had to plant Grace at index 0 to expose.
    const wire = (await clickApplyThenDrain('Use Nadia’s 0.4')) as Record<string, unknown>

    expect(wire.value).toBe(0.4)
    expect(wire.applied_from).toEqual({
      round_id: ROUND_ID,
      participant_id: NADIA_ID,
    })
  })

  it('sends NO applied_from when no panel intent was recorded', async () => {
    // The discriminating negative: the drain must not invent an attribution for
    // an ordinary visit. Proves the field above came from the click.
    let wire: unknown = null
    render(<CanvasHarness onWire={(e) => { wire = e }} />)
    await act(async () => {
      await Promise.resolve()
    })
    expect(wire).toBeNull()
  })

  it('carries the value VERBATIM as the reveal served it', async () => {
    // CEE compares the applied value to its own record with `Object.is` and
    // refuses on any difference, so a re-rounded number anywhere in this chain
    // would refuse every apply server-side while looking right on screen.
    const wire = (await clickApplyThenDrain('Use Grace’s 0.85')) as Record<string, unknown>
    expect(Object.is(wire.value, 0.85)).toBe(true)
  })
})
