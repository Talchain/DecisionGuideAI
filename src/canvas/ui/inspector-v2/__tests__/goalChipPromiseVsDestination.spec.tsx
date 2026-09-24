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
 *
 * ── ⭐⭐ 24 Sep 2026: THE DESTINATION NOW ANSWERS, AND THIS FILE REDDED AS IT
 * PROMISED TO ───────────────────────────────────────────────────────────────
 * `goal` joined `AUTHORITY_OWNING_PANELS`. On the mounted pane the store-only
 * `GoalThresholdEditor` is NOT carved out of the fence — the objection above
 * still stands, so it is not rendered there at all — and the Model tab's own
 * `SuccessTargetLine` stands in its place, committing through
 * `proposeGoalTarget` → a typed `add_constraint`. The two "present AND INERT"
 * cases were rewritten to measure THAT, through the same real Router.
 *
 * ⚠ THE CHIP COPY WAS NOT TOUCHED, AND THAT IS A SCOPE LINE, NOT AN OVERSIGHT.
 * `GoalNode.tsx` is another writer's file. Its channels still name the Model
 * tab as the live route and bind no repair verb to the details route, so every
 * assertion in the second block stays TRUE — it is now stricter than the
 * destination requires. Restoring a promise at the details route is the chip
 * owner's call, made deliberately, against `GoalPanel.targetReachesTheModel`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'
import { useAuth } from '../../../../contexts/AuthContext'
import { canCaptureGoalTarget } from '../../../domain/goalTarget'
import {
  goalNoTargetChannels,
  GOAL_NO_TARGET_STATE,
  GOAL_TARGET_LIVE_ROUTE,
  GOAL_TARGET_ROUTE_IS_LIVE,
} from '../../../nodes/GoalNode'
import {
  CANONICAL_EDIT_AUTHORITY,
  hasServerGraphAuthority,
} from '../../../mutations/mutationAuthority'

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
 * A SAMPLED FLOOR over repair phrasings — NOT a ban, and it must not be read as one.
 *
 * ⚠ IT DOES NOT CLOSE THE CLASS. This is a hand-written predicate over natural
 * language, so it can only ever prove that the phrasings it happens to spell are
 * absent. It requires BOTH a verb from {add,set,enter,type} AND an object from
 * {one, "a target", it}, so a sentence evades it by missing EITHER axis. Derived
 * here, on four ordinary repair phrasings — none matches:
 *
 *   "capture one"           verb ✗  object ✓
 *   "specify a target"      verb ✗  object ✓
 *   "tell us your target"   verb ✗  object ✗
 *   "define success"        verb ✗  object ✗
 *
 * ⚠ AN EARLIER DRAFT SAID "four of them using its own verbs". THAT IS FALSE —
 * none of the four reuses a verb; two reuse an OBJECT. It was relayed from a
 * review report rather than derived, and it misnames the axis the predicate is
 * short on, which defeats the point of this heading.
 *
 * A wider count (13 of 13 evading) has been reported by a reviewer; that corpus
 * is NOT recorded here, so treat it as RELAYED, not re-derivable from this file.
 * The four above are.
 *
 * A green run here means "none of the sampled phrasings is present", never
 * "no repair is promised".
 *
 * ⚠ HAS ITS OWN POSITIVE CONTROL BELOW. An absence assertion over a predicate
 * nobody proved can FIRE is vacuous (CLAUDE.md trap 13), and a predicate is
 * exactly the kind of thing that silently stops matching after a refactor.
 */
const REPAIR_PROMISE = /\b(add|set|enter|type)\s+(one|a target|it)\b/i

/**
 * ⭐ A REPAIR VERB BOUND TO THE INERT DESTINATION — asked PER CLAUSE, because a
 * whole-string regex cannot tell "set one in the Model tab, or open this goal's
 * details" from "open its details to add one".
 *
 * ⚠ THE FIRST VERSION OF THIS WAS `…\b[^.]*\bdetails\b`, and it flagged the
 * legitimate sentence: `[^.]*` ran straight through the comma and joined the
 * repair verb in one clause to `details` in the next. A predicate that cannot
 * see a clause boundary is answering a different question from the one its name
 * asks. Commas, semicolons and full stops are the boundaries; both controls
 * below sit either side of this distinction.
 */
function promisesRepairAtDetails(text: string): boolean {
  return text
    .split(/[.,;]/)
    .some(clause => REPAIR_PROMISE.test(clause) && /\bdetails\b/i.test(clause))
}

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

  it('a target control IS present through the router — and it is LIVE (24 Sep 2026)', () => {
    // Was: "the editor IS present" (`#goal-threshold`, inert). The destination
    // now carries the Model tab's control, and it can be operated.
    const { container } = renderInspector()
    const control = container.querySelector('[data-testid="goal-panel-target-edit"]')
    expect(control, 'the goal pane offers no target control').not.toBeNull()
    expect(effectivelyDisabled(control)).toBe(false)
  })

  it('⭐ THE OLD FINDING, INVERTED — the store-only editor is gone from the mounted pane, not carved out', () => {
    // Was: "present AND INERT, so the route cannot accept a target". The
    // objection recorded in this file's header — `setGoalThresholdAndUpdateNode`
    // has no carrier, so carving it out would be a worse lie — is honoured: the
    // store-only `#goal-threshold` is not rendered on the mounted pane at all.
    const { container } = renderInspector()
    expect(container.querySelector('#goal-threshold')).toBeNull()

    // And the pane no longer takes the Router's blanket; it fences its own
    // carrier-less writers instead. Pinned so that a regression back to the
    // blanket REDs here rather than passing as "still inert".
    expect(container.querySelector('fieldset[data-authority="disabled"]')).toBeNull()
    const description = container.querySelector('fieldset[data-writer-fence="description"]')
    expect(description, 'the description writer lost its fence').not.toBeNull()
    expect((description as HTMLFieldSetElement).disabled).toBe(true)
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

  /**
   * ⭐⭐⭐ THE BAN IS NARROWED TO WHAT IT PROTECTS, AND THE NARROWING IS THE
   * DELIBERATE RESTORATION THIS FILE INVITED — not a hollowing-out.
   *
   * `GoalNode`'s header wrote the invitation in terms: *"Naming a live route
   * instead (the Model tab's own goal section) is the better answer and is
   * deliberately NOT guessed at here: which of those surfaces is mounted under
   * the deployed flag posture is UNMEASURED."* The measurement is now taken —
   * deployed `7ec3fed2`, guest session, 20 Sep 2026: the Model tab's goal row
   * value cell is a live `<button>` reading "Not set" that opens three ENABLED
   * controls ("New value for <goal>", "Target bound for <goal>" = at least |
   * at most, "Target unit for <goal>"), committing through `proposeGoalTarget`
   * to a typed `add_constraint`.
   *
   * ⛔ WHAT STAYS BANNED IS UNCHANGED IN SUBSTANCE: a repair promise that names
   * NO live route. That is the withdrawn sentence — `Target not captured — add
   * one` — and the control below still REDs on it, on the exact string, so this
   * narrowing cannot be satisfied by a guard that stopped discriminating.
   *
   * ⚠ AND THE PROMISE MAY NOT BE ATTACHED TO THE DETAILS ROUTE. That was
   * because the destination was inert. ⚠ 24 Sep 2026: IT IS NOT ANY MORE —
   * `goal` joined `AUTHORITY_OWNING_PANELS` and the pane's target control is
   * the Model tab's `SuccessTargetLine` (re-derived above through the REAL
   * router). The ban below is kept, and is now STRICTER than the destination
   * requires: lifting it is the chip owner's deliberate call (`GoalNode.tsx` is
   * not this change's file), not something to infer from a green run here.
   *
   * ⭐ THE THREE ARMS FAIL ON DIFFERENT ASSERTIONS, which is what makes this a
   * narrowing rather than a deletion: a promise with no route, a promise
   * attached to the details, and a chip that says nothing at all are each caught
   * by a different line.
   */
  it.each([false, true])(
    '⭐ a repair promise must NAME A LIVE ROUTE, and never the inert one (diagnostic arm: %s)',
    (diagnostic) => {
      const channels = goalNoTargetChannels({ diagnostic })
      // Bound by identity to each named channel, so a failure says WHICH one.
      for (const [name, text] of Object.entries(channels)) {
        const promises = REPAIR_PROMISE.test(text)
        const namesLiveRoute = text.includes(GOAL_TARGET_LIVE_ROUTE)
        expect(
          { channel: name, unroutedPromise: promises && !namesLiveRoute },
          `channel "${name}" promises a repair but names no live route: ${text}`,
        ).toEqual({ channel: name, unroutedPromise: false })

        // The details route cannot accept a target, so no repair verb may be
        // bound to it. Asserted separately from the route clause precisely so a
        // sentence naming BOTH cannot smuggle the promise onto the wrong one.
        expect(
          { channel: name, promisesAtDetails: promisesRepairAtDetails(text) },
          `channel "${name}" attaches a repair promise to the inert details route: ${text}`,
        ).toEqual({ channel: name, promisesAtDetails: false })
      }
    },
  )

  it('CONTROL — the narrowed ban still REDs on the exact sentence that was withdrawn', () => {
    // Without this the narrowing is indistinguishable from removing the guard.
    const withdrawn = 'Target not captured — add one'
    expect(REPAIR_PROMISE.test(withdrawn)).toBe(true)
    expect(withdrawn.includes(GOAL_TARGET_LIVE_ROUTE)).toBe(false)
    // …so the predicate the arm above applies would flag it.
    expect(REPAIR_PROMISE.test(withdrawn) && !withdrawn.includes(GOAL_TARGET_LIVE_ROUTE)).toBe(true)
  })

  it('CONTROL — and REDs on a promise bound to the details route even when a live route is also named', () => {
    const smuggled = `Target not captured — set one in ${GOAL_TARGET_LIVE_ROUTE}, or open its details to add one`
    expect(promisesRepairAtDetails(smuggled)).toBe(true)
    // …and the legitimate sentence, which names BOTH routes, must NOT match —
    // otherwise this control passes by flagging everything.
    const legitimate = `Target not captured — set one in ${GOAL_TARGET_LIVE_ROUTE}, or open this goal's details`
    expect(promisesRepairAtDetails(legitimate)).toBe(false)
  })

  /**
   * ⚠⚠ THIS WAS AN `if (FLAG) … else …` AND A MUTANT WALKED THROUGH IT.
   * Flipping `modelGoalMinimumTarget` to `'disabled'` SURVIVED: the else-branch
   * simply ran and agreed with itself. A conditional assertion over the value it
   * is conditioning on cannot fail on that value — it is a tautology wearing a
   * control's clothes. Both branches are now driven BY EXECUTION.
   */
  it('⭐ the route clause is PRESENT when the route is live and ABSENT when it is not', () => {
    for (const diagnostic of [false, true]) {
      const live = goalNoTargetChannels({ diagnostic, routeIsLive: true })
      const dead = goalNoTargetChannels({ diagnostic, routeIsLive: false })
      for (const channel of ['aria-label', 'title'] as const) {
        expect(live[channel], `live ${channel}`).toContain(GOAL_TARGET_LIVE_ROUTE)
        expect(dead[channel], `dead ${channel}`).not.toContain(GOAL_TARGET_LIVE_ROUTE)
      }
      // And the dead arm must still state the fact and still say what the click
      // does — the ban must not be satisfiable by falling silent.
      expect(dead['aria-label']).toContain(GOAL_NO_TARGET_STATE)
      expect(dead['aria-label']).toContain('details')
      // The dead arm must also carry NO repair promise at all: with no live
      // route to name, any repair verb is the withdrawn sentence again.
      expect(REPAIR_PROMISE.test(dead['aria-label']), dead['aria-label']).toBe(false)
    }
  })

  it('⭐ the default IS the derivation — the constant is read, not written', () => {
    // Binds the exported constant to the authority. ⚠ This alone does NOT catch
    // a hardcoded `true`, because `modelGoalMinimumTarget` IS `'server_graph'`
    // today and the two agree — measured, not assumed: that mutant survived.
    // The discriminating case is the PAIR (hardcode the constant AND regress the
    // authority), which this assertion then fails. Stated because a mutant that
    // needs a partner is a real result, not a gap to paper over.
    expect(GOAL_TARGET_ROUTE_IS_LIVE).toBe(
      hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.modelGoalMinimumTarget),
    )
    // The production call takes the default, so the shipped copy tracks it.
    expect(goalNoTargetChannels({ diagnostic: false })).toEqual(
      goalNoTargetChannels({ diagnostic: false, routeIsLive: GOAL_TARGET_ROUTE_IS_LIVE }),
    )
  })

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
