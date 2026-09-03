/**
 * ⭐⭐⭐ THE CHIP MAY NOT PROMISE A REPAIR THE DESTINATION CANNOT PERFORM.
 *
 * ⚠⚠ THIS FILE EXISTS BECAUSE THREE ROUNDS OF GUARDS COULD NOT SEE THE DEFECT,
 * AND THE REASON IS THE MOUNT, NOT THE ASSERTIONS.
 *
 *   round 1  the editor was ABSENT on the divergent arm      → fixed
 *   round 2  the editor is PRESENT on the divergent arm      → still does not ANSWER
 *
 * `GoalPanel.capturePromiseAnswers.spec.tsx` imports and mounts `GoalPanel`
 * DIRECTLY, so `InspectorRouter`'s `<fieldset disabled data-authority="disabled">`
 * — the thing that inerts every form control in the panel — NEVER EXISTS IN THAT
 * TEST. Its completion case then drives the field with `fireEvent`, which
 * dispatches straight at the node and bypasses actionability entirely. Both of
 * its claims are true and neither can observe inertness. A test bound to a mount
 * the product does not produce is not a test of the journey (CLAUDE.md trap 3b,
 * at surface grain).
 *
 * So this file mounts THE REAL ROUTER, and asks about ACTIONABILITY rather than
 * presence.
 *
 * ── WHAT THE PRODUCT ACTUALLY DOES ────────────────────────────────────────
 * `InspectorRouter.tsx` wraps the whole panel body in an unconditional
 * `<fieldset disabled>`, beneath `INSPECTOR_READ_ONLY_REASON` — "The other
 * fields here are read-only for now because those changes can't yet be saved."
 * `GoalThresholdEditor` renders `<input id="goal-threshold" type="number">`, a
 * form-associated element, which that fieldset inerts. The chip's route is live
 * and lands exactly there.
 *
 * ── AND WHY THE COPY MOVED RATHER THAN THE BOUNDARY (#1172 round 3) ───────
 * The obvious remedy — carve `GoalThresholdEditor` out of the boundary, as
 * `inspector-rename-trigger` already is — FAILS ITS OWN PRECONDITION. The
 * rename is carved out because it SAVES TO THE SHARED MODEL: `updateNodeLabel`
 * records a durable `structural_rename` intent that `useStructuralRenameEvents`
 * puts on the wire, and CEE classifies that member 'mutating'.
 * `setGoalThresholdAndUpdateNode` has no such carrier. `WIRE_SYSTEM_EVENT_TYPES`
 * (`conversation/types.ts`) is the single source for the whole UI→CEE
 * vocabulary and holds ELEVEN members, none of which carries a goal threshold —
 * so a threshold write reaches CEE only as a `direct_graph_edit` NOTIFICATION,
 * which that file records CEE classifying 'ack_and_commit': a turn row and NO
 * graph write. It survives a reload locally (autosave hashes
 * `success_threshold` by default — #457) and it does not reach the shared model.
 * Carving it out would put a control that writes only to this browser inside a
 * region whose notice says these changes cannot be saved, and would stamp
 * `threshold_source: 'user'` on the node that drives the PLoT request. That is a
 * worse lie than the one being fixed, so the promise moved instead.
 *
 * ── THE RULE, AND IT IS A CONDITIONAL, NOT A BAN ──────────────────────────
 * The copy is not banned from ever naming a repair. It is banned from naming
 * one WHILE THE DESTINATION CANNOT PERFORM IT. Both halves are asserted here,
 * in that order, so the day someone makes the editor answer, the FIRST
 * assertion REDs and sends them back to this file to restore the promise
 * deliberately. A guard that only banned the phrase would go quietly stale the
 * moment the boundary moved (CLAUDE.md trap 12b — a control pinned to a
 * premise nobody re-checks).
 *
 * ── PROOF SHAPE ───────────────────────────────────────────────────────────
 * RED-first at pristine `9e843093`: the inertness derivation, its control and
 * the predicate's own positive control all PASS, and the promise assertions
 * FAIL — which is the finding, measured rather than reasoned.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'
import { useAuth } from '../../../../contexts/AuthContext'
import { canCaptureGoalTarget } from '../../../domain/goalTarget'
import { goalNoTargetChannels } from '../../../nodes/GoalNode'

vi.mock('@xyflow/react', () => ({
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

vi.mock('../../../../contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../contexts/AuthContext')>()
  return { ...actual, useAuth: vi.fn() }
})

const REAL_AUTH = { authenticated: true, user: { id: 'u-123', email: 'real@user.io' } }

const GOAL_ID = 'goal1'

/**
 * DIVERGENCE ARM A, the state this whole PR is about: the run pipeline holds a
 * number and the goal node holds no captured target. `setCeeAnalysisReady`
 * writes the store scalar and never touches the node, so this is not a
 * contrived shape — `store.ts` records it having shipped ("Inspector v2
 * rendered `≥ 0.8 £`").
 */
function seedDivergentArm() {
  useCanvasStore.setState({
    nodes: [
      {
        id: GOAL_ID,
        type: 'goal',
        position: { x: 0, y: 0 },
        data: { label: 'Reach £30k MRR within 18 months', kind: 'goal', goal_threshold_unit: '£' },
      },
    ] as never[],
    edges: [] as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    goalThreshold: 0.8,
    goalThresholdRepresentation: 'normalised',
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

function goalData(): Record<string, unknown> {
  return (useCanvasStore.getState().nodes.find(n => n.id === GOAL_ID)?.data ?? {}) as Record<
    string,
    unknown
  >
}

/**
 * ACTIONABILITY, not the `.disabled` PROPERTY.
 *
 * jsdom does not propagate `<fieldset disabled>` down to a descendant's own
 * `disabled` property — a trap `inspectorAuthorityBinding.spec.tsx` records
 * having hit while being written. So walk the ancestors, which is what the
 * HTML spec says decides whether the control can be interacted with at all.
 */
function effectivelyDisabled(el: Element | null): boolean {
  if (!el) return false
  if ((el as HTMLInputElement).disabled === true) return true
  let cur: Element | null = el.parentElement
  while (cur) {
    if (cur.tagName === 'FIELDSET' && (cur as HTMLFieldSetElement).disabled) return true
    cur = cur.parentElement
  }
  return false
}

function renderInspector() {
  return render(<InspectorRouter nodeId={GOAL_ID} edgeId={null} onClose={vi.fn()} />)
}

/**
 * The repair phrasings this rule bans while the destination is inert.
 *
 * ⚠ HAS ITS OWN POSITIVE CONTROL BELOW. An absence assertion over a predicate
 * nobody proved can FIRE is vacuous (CLAUDE.md trap 13), and a predicate is
 * exactly the kind of thing that silently stops matching after a refactor.
 */
const REPAIR_PROMISE = /\b(add|set|enter|type)\s+(one|a target|it)\b/i

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAuth).mockReturnValue(REAL_AUTH as unknown as ReturnType<typeof useAuth>)
  seedDivergentArm()
})
afterEach(cleanup)

describe('the destination the goal chip routes to — measured through the REAL router', () => {
  it('PRECONDITION PIN — this is the arm the chip fires on', () => {
    // Without this the whole file could be measuring a goal that HAS a target,
    // where the editor legitimately never renders and every assertion below
    // would pass for the wrong reason.
    expect(canCaptureGoalTarget(goalData())).toBe(true)
  })

  it('the editor IS present through the router — round 2’s claim, re-derived at the real mount', () => {
    const { container } = renderInspector()
    expect(container.querySelector('#goal-threshold')).not.toBeNull()
  })

  it('⭐ THE FINDING — and it is present AND INERT, so the route cannot accept a target', () => {
    const { container } = renderInspector()
    const editor = container.querySelector('#goal-threshold')
    expect(editor).not.toBeNull()

    // The boundary exists and this control is inside it. Pinned separately from
    // the disabled-ness so a future edit that deletes the fieldset REDs here
    // rather than silently turning the assertion below into a vacuous truth.
    const boundary = container.querySelector('fieldset[data-authority="disabled"]')
    expect(boundary).not.toBeNull()
    expect(boundary!.contains(editor!)).toBe(true)

    expect(effectivelyDisabled(editor)).toBe(true)
  })

  it('CONTROL — the walk DISCRIMINATES: the one control deliberately outside the boundary is live', () => {
    // ⛔ Without this, `effectivelyDisabled` returning true everywhere would be
    // indistinguishable from a walk that returns true unconditionally
    // (CLAUDE.md trap 20 — sameness across inputs that ought to differ is
    // evidence about the instrument).
    const { container } = renderInspector()
    const rename = container.querySelector('[data-testid="inspector-rename-trigger"]')
    expect(rename).not.toBeNull()
    expect(effectivelyDisabled(rename)).toBe(false)
  })
})

describe('so the chip states the fact and promises no repair it cannot keep', () => {
  it('CONTROL — the ban predicate can FIRE, on the exact sentence that was withdrawn', () => {
    expect(REPAIR_PROMISE.test('Target not captured — add one')).toBe(true)
    expect(REPAIR_PROMISE.test("Open its details to add one — a metric, a threshold or a deadline.")).toBe(true)
    // …and does not fire on the fact alone, or the ban would be unsatisfiable.
    expect(REPAIR_PROMISE.test('Target not captured')).toBe(false)
  })

  it.each([false, true])(
    '⭐ no channel a reader can reach promises a repair (diagnostic arm: %s)',
    (diagnostic) => {
      const channels = goalNoTargetChannels({ diagnostic })
      // Bound by identity to each named channel, so a failure says WHICH one.
      for (const [name, text] of Object.entries(channels)) {
        expect(
          { channel: name, promises: REPAIR_PROMISE.test(text) },
          `channel "${name}" reads: ${text}`,
        ).toEqual({ channel: name, promises: false })
      }
    },
  )

  it('and still states the fact — the ban must not be satisfied by saying nothing', () => {
    for (const diagnostic of [false, true]) {
      const channels = goalNoTargetChannels({ diagnostic })
      for (const text of Object.values(channels)) {
        expect(text.length).toBeGreaterThan(0)
        expect(text.toLowerCase()).toContain('target')
      }
    }
  })
})
