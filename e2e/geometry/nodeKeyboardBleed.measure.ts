/**
 * DOES ACTIVATING A CONTROL INSIDE A NODE ALSO SELECT THE NODE BEHIND IT?
 *
 * React Flow attaches its own `onKeyDown` to EVERY focusable `.react-flow__node`
 * (`@xyflow/react@12.10.2` `dist/esm/index.mjs:2240`). That handler's only guard
 * is `isInputDOMNode` (`:2174`), which returns true only for `INPUT`/`TEXTAREA`/
 * `SELECT`, `[contenteditable]`, or a target with a `.nokey` ANCESTOR
 * (`@xyflow/system@0.0.76:846-854`). `elementSelectionKeys = ['Enter', ' ',
 * 'Escape']` (`:27`).
 *
 * So a `<button>` or `div[role="button"]` INSIDE a node is not an input, has no
 * `.nokey` ancestor, and its keydown bubbles to the node — which selects itself
 * and hands the right-hand dock to the Inspector. A keyboard user cannot press
 * any in-node affordance without also getting a selection they did not ask for.
 *
 * ⚠ CORRECTED — THIS FILE IS NOW PARTLY GATED. It previously read "it is not in
 * any gate", which was true when written and is no longer. THREE of its four
 * arms (drive, pointer, opposite-direction) carry `GATE_TAG` and run on every
 * push to `staging` and every PR into it, via the `Canvas Browser Gate
 * (advisory)` job. The CENSUS arm remains a measure and is deliberately not
 * gated. Which arms gate, and the shipped defect each one would have caught,
 * are declared in `e2e/geometry/canvasGateSet.ts` — the registry, not this
 * comment, is the authority, precisely so this sentence cannot go stale again.
 *
 *     pnpm run canvas:gate        # the three gated arms, as CI runs them
 *     pnpm run geometry nodeKeyboardBleed   # everything here, census included
 *
 * `*.measure.ts`, not `*.spec.ts`, so the main e2e config cannot collect it into
 * a run that has no dev server on its port — same convention as the sibling
 * measures in this directory.
 *
 * ── WHY IT HAS TO BE A REAL BROWSER ─────────────────────────────────────────
 *
 * NO TEST IN THIS REPO MOUNTS `<ReactFlow>` — which is exactly why this shipped.
 * The defect does not live in any node component: it lives in the ANCESTOR that
 * React Flow renders around it. A jsdom test on a standalone `EvidenceGapBadge`
 * cannot see it, and a green suite over `src/canvas/nodes` says nothing about
 * it. (CLAUDE.md trap 3b: a test bound to a component the mount path does not
 * render is not evidence about that mount path.)
 *
 * ── THE DISCRIMINATION ──────────────────────────────────────────────────────
 *
 * Every control is driven with THREE keys and the selected set is read after
 * each:
 *   ' '  (Space)  — in `elementSelectionKeys`, must not reach the node
 *   'Enter'       — in `elementSelectionKeys`, must not reach the node
 *   'q'           — CONTRAST CONTROL, not in `elementSelectionKeys`
 *
 * The `q` row is what makes this a discrimination rather than a probe that
 * reports "selected" for any keypress at all (CLAUDE.md trap 13e: an absence
 * claim needs a same-run contrast whose expected answer DIFFERS).
 *
 * And the OPPOSITE DIRECTION is measured in the same run: focusing the
 * `.react-flow__node` ELEMENT ITSELF and pressing Enter MUST still select it.
 * React Flow's keyboard node selection is a real a11y feature and may be the
 * only keyboard route to the Inspector; a fix that kills it trades one
 * accessibility defect for another. One direction alone is a guard watching one
 * door.
 *
 * ── ⭐⭐ "A PROBE THAT IS ONLY CORRECT WHEN THE PRODUCT IS" ──────────────────
 *
 * A DEFECT CLASS, not a one-off, and it was found TWICE IN THIS FILE IN ONE
 * NIGHT by two lanes unaware of each other:
 *   - the drive arm's `isGated` dispatched a real bubbling Enter BEFORE the key
 *     under test was pressed. `Enter` is in React Flow's `elementSelectionKeys`,
 *     so with the scope broken THE PROBE SELECTED THE NODE ITSELF;
 *   - the portalled arm (PR #1146) had the same shape: its gate probe's
 *     synthetic Enter landed before the selection was read, so with the fix
 *     removed the `q` contrast control fired for THE PROBE'S OWN SIDE EFFECT.
 *
 * Both were invisible at pristine PRECISELY BECAUSE THE FIX MAKES THE PROBE'S
 * ENTER HARMLESS. The probe is correct exactly when the product is correct, so
 * it can never witness the product being wrong — and every green run agrees.
 *
 * ⭐ THE SWEEP OF THIS FILE (2026-09-02), recorded so the next reader inherits it
 * rather than the anecdote. The question asked of every arm was: DOES ANYTHING
 * READ STATE AFTER A PROBE THAT CAN ITSELF MUTATE THAT STATE?
 *
 *   isGated (:628)            THE DEFECT. Fixed: it now runs AFTER `pressAt`,
 *                             reports `found` and `armed` separately, and only
 *                             the non-activating contrast key writes a verdict.
 *   censusFocusables (:249)   SAME SHAPE, currently inert: it dispatches the
 *                             identical bubbling Enter, but returns `armed`
 *                             alone and never reads selection — and it belongs
 *                             to the census arm, which is not gated. Left as
 *                             is, NAMED rather than silently passed over,
 *                             because it is one `selectedNodeIds` call away
 *                             from being the same bug.
 *   tryFocus / focusOnce      MUTATES (hover + `.focus()`, and `focusin`
 *     (:479, :504)            BUBBLES). Safe for the right reason, which is
 *                             worth stating: what follows it is the per-key
 *                             ASSERTED BASELINE `toEqual([])`, not a reading —
 *                             so a selection it caused REDs instead of being
 *                             absorbed into a number.
 *   pointer arm (:1142)       The control drag is separated from the
 *                             measurement by `resetSelection`, and both
 *                             readings are of the gesture under test.
 *   opposite direction        Explicit Shift/pointer hygiene, then a full
 *     (:1241)                 `loadCanvas`, then an asserted baseline, then its
 *                             own measurement. No probe between.
 *
 * ⚠ THE RULE THIS LEAVES: a probe may run before a reading only if it cannot
 * mutate what is read, or if an ASSERTION — never another reading — sits
 * between them. When in doubt, probe AFTER the measurement.
 *
 * Assertions bind by IDENTITY — the node's store id and the control's own
 * accessible name — never by "some node is selected", which another node could
 * satisfy (trap 19).
 */
import { test, expect, type Page } from '@playwright/test'
import {
  openCanvas,
  preparePage,
  seedStarterDraft,
  clearNotifications,
  waitForVisualQuiescence,
  type StarterId,
} from '../visual/harness'
/*
 * ⭐ `GATE_TAG` ADMITS A TEST TO THE MERGE GATE. A test carrying it is run by
 * `playwright.canvasgate.config.ts` on every push to `staging` and every PR into
 * it — and it must ALSO be listed in `e2e/geometry/canvasGateSet.ts`, which names
 * the shipped defect it would have caught. The two are asserted against each
 * other after every gate run, so tagging without registering (or renaming a
 * tagged test) is a RED, not a silent change of scope.
 *
 * Untagged tests in this file are still collected by the ordinary
 * `playwright.geometry.config.ts` run. The tag decides what GATES, not what runs.
 */
import { GATE_TAG } from './canvasGateSet'

const VIEWPORT = { width: 1440, height: 900 }

/**
 * All five starters are censused. The defect is a property of the CANVAS, not
 * of one model, and a single starter would leave the claim scoped to whatever
 * controls that model happens to render.
 */
const ALL: StarterId[] = ['vendor-selection', 'market-entry', 'build-vs-buy', 'headcount-allocation', 'pricing-model']

/**
 * ONE REPRESENTATIVE PER RENDER PATH — and the justification for a bounded set.
 *
 * The census below covers every focusable in every node across all five
 * starters (390 of them at pristine); that is where the COMPLETENESS claim
 * lives. This drive proves the MECHANISM, and it cannot be exhaustive: each
 * press ACTIVATES the control (sends a message, opens a menu, starts an
 * analysis), so every row needs a fresh page and a fresh seed, and 390 of those
 * is not an instrument anyone will run.
 *
 * These six are the distinct paths by which a focusable element gets inside a
 * `.react-flow__node`, not six examples of one path:
 *   1. the shared quick-action row (`NodeQuickActions`, via `BaseNode`) — this
 *      is also ask/challenge/inspect/menu, which are one component;
 *   2. a node-type's own call-to-action button (`DecisionNode`);
 *   3. a science/provenance badge rendered from `useScienceIcons`;
 *   4. a node-type's own chip outside the quick-action row (`GoalNode`);
 *   5. a GHOST node whose component ROOT *is* the control (`GhostOptionNode`) —
 *      it has no inner wrapper of its own, so it is the case a per-component fix
 *      would most easily get wrong;
 *   6. the same for `GhostTierNode`.
 */
const DRIVEN_KINDS: Array<{ kind: string; starter: StarterId; why: string }> = [
  { kind: 'node-action-ask', starter: 'vendor-selection', why: 'NodeQuickActions — the shared row on every node' },
  { kind: 'BUTTON:Explore more options', starter: 'vendor-selection', why: "DecisionNode's own call-to-action button" },
  { kind: 'BUTTON:Olumi estimated this', starter: 'vendor-selection', why: 'a science/provenance badge (useScienceIcons)' },
  { kind: 'goal-node-no-target-chip', starter: 'vendor-selection', why: "GoalNode's own chip, outside the quick-action row" },
  { kind: 'BUTTON:Status quo bias', starter: 'vendor-selection', why: 'NodeCoachingMarker — a coaching badge inside the card' },
]

/*
 * ⚠ THE GHOST DOORS ARE NOT DRIVEN, AND WHY — a finding, not an omission.
 *
 * `GhostOptionNode` ("Add another option") and `GhostTierNode` ("Another
 * factor/risk/outcome") are the most interesting cases in the brief: their
 * component ROOT *is* the focusable control, so a per-component fix has nowhere
 * obvious to put the gate. They are in the census on every starter — 4 of the
 * 390 rows — and they cannot be driven here, because under this harness's
 * pinned flag posture at 1440x900 they render with `visibility: hidden` on ALL
 * FIVE starters, on a freshly loaded page and after a re-seed alike. React Flow
 * renders a node hidden until it has measured dimensions
 * (`@xyflow/react` NodeWrapper), and these doors never acquire them. A
 * `focus()` on a hidden element is a silent no-op, so a press at one would have
 * measured the document rather than the door.
 *
 * They are covered instead by `nodes/__tests__/registry.keyboardScope.spec.tsx`,
 * which binds to them BY IDENTITY through the node-type registry — the seam the
 * fix is applied at — and by the census assertion here.
 *
 * ⭐ AND THE INVISIBILITY ITSELF IS A SEPARATE FINDING worth someone's time: if
 * it reproduces on deployed staging, the reasoning-frontier doors are dark. It
 * is NOT this lane's to fix, and this note is deliberately scoped to what was
 * measured — this harness, this posture, this viewport — not to the product.
 */

interface FocusableCensusRow {
  nodeId: string
  nodeType: string
  tag: string
  role: string | null
  name: string
  tabindex: string | null
  testid: string | null
  /**
   * Control CLASS, derived from the element itself — the testid with its node
   * id suffix removed, or the tag/role plus the first three words of the name.
   * Derived, never a hand-written list, so a control kind added tomorrow gets
   * driven without anyone remembering to add it (CLAUDE.md trap 12).
   */
  kind: string
  /**
   * Can the browser focus it AT REST? Several in-node controls are
   * `visibility: hidden` until the node is hovered or focused, and React Flow
   * renders a node hidden until it has measured dimensions. A hidden element is
   * not a tab stop — but it becomes one the moment its node is revealed, so it
   * is still part of the surface the gate must cover.
   */
  focusableNow: boolean
  nodeVisibility: string
  /** Would React Flow's `isInputDOMNode` short-circuit on this target? */
  isInputLike: boolean
  /**
   * ⭐ THE PROPERTY THAT ACTUALLY DECIDES THE DEFECT, measured by DOING IT: an
   * untrusted `keydown` is dispatched at this element, and a listener sitting
   * where React Flow's own node handler sits records whether
   * `target.closest('.nokey')` was non-null AT THAT MOMENT.
   *
   * ⚠ IT IS NOT `closest('.nokey')` AT REST, AND THAT DISTINCTION IS THE FIX.
   * The scope arms itself in the capture phase of a key dispatch and disarms in
   * a microtask, precisely so that React Flow's OTHER `.nokey` consumer —
   * `Pane.onPointerDownCapture`, which refuses to start a marquee over a
   * `.nokey` element — never sees one. A census that read the class at rest
   * would score the correct fix as ungated and the marquee-breaking one as
   * perfect.
   *
   * An untrusted `KeyboardEvent` is safe to fire at every one of the 390: the
   * browser synthesises a `click` from Enter/Space only for TRUSTED events, so
   * nothing is activated and the page is not mutated.
   */
  armedOnKeydown: boolean
}

/** The selector React Flow's own focus model implies: anything the browser can focus. */
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable]'

async function censusFocusables(page: Page): Promise<FocusableCensusRow[]> {
  return page.evaluate((selector) => {
    // The interface is a compile-time reference only (types are erased), so it
    // is legal inside the browser context and keeps the census honestly typed.
    const rows: FocusableCensusRow[] = []
    for (const node of Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node'))) {
      const nodeId = node.getAttribute('data-id') ?? ''
      const nodeType = (node.className.match(/react-flow__node-([a-z-]+)/)?.[1]) ?? ''
      for (const el of Array.from(node.querySelectorAll<HTMLElement>(selector))) {
        if (el === node) continue
        const name =
          el.getAttribute('aria-label') ??
          (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80)
        rows.push({
          nodeId,
          nodeType,
          tag: el.tagName,
          role: el.getAttribute('role'),
          name,
          tabindex: el.getAttribute('tabindex'),
          testid: el.getAttribute('data-testid'),
          kind: (() => {
            const t = el.getAttribute('data-testid')
            if (t) return nodeId && t.endsWith(`-${nodeId}`) ? t.slice(0, -(nodeId.length + 1)) : t
            const words = name.split(/\s+/).slice(0, 3).join(' ')
            return `${el.tagName}${el.getAttribute('role') ? `[${el.getAttribute('role')}]` : ''}:${words}`.replace(/[.,;:!?]+$/, '')
          })(),
          focusableNow: (() => {
            const active = document.activeElement
            el.focus()
            const ok = document.activeElement === el
            ;(active as HTMLElement | null)?.focus?.()
            return ok
          })(),
          nodeVisibility: getComputedStyle(node).visibility,
          isInputLike:
            ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.hasAttribute('contenteditable'),
          armedOnKeydown: (() => {
            let armed = false
            const probe = (ev: Event) => {
              armed = !!(ev.target as Element | null)?.closest('.nokey')
            }
            // The node element is where React Flow's own handler is bound, so a
            // native listener here reads what that handler reads. React 18
            // dispatches its whole synthetic capture phase from the root
            // container, so the scope has already armed by the time the event
            // reaches this element.
            node.addEventListener('keydown', probe, true)
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
            node.removeEventListener('keydown', probe, true)
            return armed
          })(),
        })
      }
    }
    return rows
  }, FOCUSABLE_SELECTOR)
}

/**
 * ⭐⭐ THE CLASS THE DOM CENSUS STRUCTURALLY CANNOT SEE — counted, never claimed.
 *
 * `NodePopover` (`src/canvas/nodes/shared/NodePopover.tsx:66`) renders node
 * content through `createPortal(…, document.body)`. React propagates events
 * through the REACT tree, so a keydown from a button in there STILL reaches
 * React Flow's node `onKeyDown`; `isInputDOMNode` walks the DOM tree, so
 * `closest('.nokey')` can never reach the scope, which lives inside
 * `.react-flow__node`. The bleed is therefore live for portalled content, at
 * this head, by this file's own definition.
 *
 * ⚠ AND THE REASON THIS FUNCTION EXISTS IS AN INSTRUMENT DEFECT, NOT A CODE
 * ONE. `censusFocusables` walks `node.querySelectorAll(...)`, i.e. DOM
 * DESCENDANTS. It returns a clean `0 ungated` for portalled controls because it
 * cannot reach them — an absence claim from a probe that is blind to the class
 * (CLAUDE.md trap 13e). The gap itself is legitimate scope for a follow-up; the
 * claim "every control inside a node" was not, and this counts what that claim
 * was silently excluding.
 *
 * The popovers render only while `visible`, so each node is hovered first.
 * Attribution is by the anchor node hovered, not by DOM ancestry — there is no
 * DOM ancestry to attribute by, which is the whole point.
 *
 * ⚠⚠ IT WAITS FOR THE POPOVER, IT DOES NOT SLEEP FOR IT — and the history is
 * the reason.
 *
 * v1 slept 60ms against a derived `ENTER_DELAY = 300`
 * (`hooks/usePopoverHover.ts:11`) and counted NOTHING: the instrument written
 * to expose the DOM census's blindness reproduced that blindness exactly.
 * v2 slept 450ms and worked — but a fixed sleep makes the count a race, which
 * is why two runs of one commit gave 56 and 59, and it earns no floor: a
 * timing-starved run and a genuinely empty canvas are indistinguishable.
 *
 * Waiting on the ELEMENT removes four problems at once: the blindness, the
 * run-dependence, the ~30s of dead sleeping, and — the one that matters — it
 * makes a MAGNITUDE FLOOR assertable, because a healthy run is no longer
 * allowed to be starved.
 *
 * Each node is parked-then-hovered: popovers are closed first (waiting for
 * DETACH, bounded) so a neighbour's popover left over from the previous
 * iteration cannot be attributed here, then the hover waits for ATTACH.
 */
/** 5x the derived `ENTER_DELAY`. A bound, not a sleep: it resolves on arrival. */
const POPOVER_WAIT_MS = 1_500

/*
 * ── THE FLOOR, CALIBRATED AGAINST MEASURED RUNS, NOT GUESSED ────────────────
 *
 * ⚠⚠ THIS EXISTS BECAUSE `toBeGreaterThan(0)` COULD NOT FAIL. The historical
 * defect — a 60ms poll against a 300ms `ENTER_DELAY` — was restored in an
 * isolated tree by an independent reviewer and the probe reported **3 controls
 * in 3 popovers**, a 95% collapse, AND THE CONTROL PASSED, because 3 > 0.
 *
 * It did not reproduce as the literal zero I had seen, so the guard I wrote
 * from that observation was aimed at the SYMPTOM rather than at the property.
 * The property is "did this probe see a plausible FRACTION of what is there",
 * and only a magnitude check answers it. A comfortable 3 is exactly the number
 * a reader quotes without a second look.
 *
 *   sample                                    controls   popovers
 *   independent reviewer, pristine                  55         57
 *   this lane, fixed 450ms sleep, run 1              56         61
 *   this lane, fixed 450ms sleep, run 2              59         65
 *   independent reviewer, pristine x2 (identical)    56         62
 *   this lane, event-driven wait                     58         63
 *   ─────────────────────────────────────────────────────────────
 *   BLINDED (the 60ms historical defect)              3          3
 *
 * The floor sits ~27% below the weakest healthy sample and ~13x above the
 * blinded one, so it discriminates the case it exists for without tripping on
 * legitimate variation. Same shape as this harness's `MIN_REFERENCE_BYTES`
 * block — floors written from intuition rather than measurement fail in
 * whichever direction you were not thinking about.
 *
 * ⚠ THE FLOOR IS ASSERTABLE; THE FIGURE IS NOT. The exact count stays a
 * run-scoped finding (healthy samples spread 55-59), and nothing below quotes
 * it as a property of the product. Two runs under the event-driven wait were
 * byte-identical (58/63), so the selector wait removed the variance the fixed
 * sleep created — but a floor is what makes the guard able to fail, and that is
 * a different claim from the figure being stable.
 *
 * ── PROVEN TO BITE, with the pair that matters ──────────────────────────────
 * Isolated worktree, pristine archive, applied-check on the named constant:
 *
 *   mutant                                   controls  popovers  floor  old `>0`
 *   the historical 60ms defect                      0         0    RED       RED
 *   coverage: every 20th node only                  1         4    RED  **PASS**
 *
 * The second row is the whole point. A plausible-but-partial read is the case
 * the sign check could not see, and it is the case that actually happens on a
 * loaded machine. (The historical defect read 0 here and 3 on the reviewer's
 * machine — its magnitude is machine-dependent, which is precisely why a sign
 * check is not enough.)
 */
const MIN_PORTALLED_CONTROLS = 40
const MIN_PORTALLED_POPOVERS = 40
async function censusPortalledControls(page: Page): Promise<{
  popovers: number
  controls: number
  nodesWithPopover: number
  sample: string[]
}> {
  const nodeIds = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.react-flow__node')).map((n) => n.getAttribute('data-id') ?? ''),
  )

  let popovers = 0
  let controls = 0
  let nodesWithPopover = 0
  const sample: string[] = []

  for (const id of nodeIds) {
    const box = await page.locator(`.react-flow__node[data-id="${id}"]`).boundingBox()
    if (!box) continue

    // PARK FIRST, and wait for every popover to CLOSE. Without this a popover
    // still open from the previous node (LEAVE_DELAY is 100ms) resolves the
    // attach-wait instantly and is counted against the wrong node.
    await page.mouse.move(4, 4)
    await page
      .waitForFunction(() => !document.querySelector('[data-node-popover]'), undefined, { timeout: POPOVER_WAIT_MS })
      .catch(() => undefined)

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    // Resolves the moment the popover exists; the timeout is the bound for
    // nodes that legitimately have none, and those are the only ones that pay it.
    await page
      .waitForFunction(() => !!document.querySelector('[data-node-popover]'), undefined, { timeout: POPOVER_WAIT_MS })
      .catch(() => undefined)

    const found = await page.evaluate(
      ({ selector }) => {
        const pops = Array.from(document.querySelectorAll<HTMLElement>('[data-node-popover]'))
        // Only those OUTSIDE the flow: the inline fallback branch renders in
        // place and is already covered by the DOM census.
        const portalled = pops.filter((p) => !p.closest('.react-flow'))
        const ctl: string[] = []
        for (const p of portalled) {
          for (const el of Array.from(p.querySelectorAll<HTMLElement>(selector))) {
            const name =
              el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60)
            ctl.push(name)
          }
        }
        return { popovers: portalled.length, controls: ctl }
      },
      { selector: FOCUSABLE_SELECTOR },
    )

    if (found.popovers > 0) nodesWithPopover++
    popovers += found.popovers
    controls += found.controls.length
    for (const c of found.controls) if (sample.length < 12 && !sample.includes(c)) sample.push(c)
  }

  return { popovers, controls, nodesWithPopover, sample }
}

/** Ids of every node React Flow currently considers selected. Sorted, so two reads compare. */
async function selectedNodeIds(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.react-flow__node.selected'))
      .map((n) => n.getAttribute('data-id') ?? '')
      .sort(),
  )
}

/**
 * Deselect everything by clicking bare canvas, and ASSERT the reset landed.
 *
 * ⚠ THE POINT IS DERIVED, NOT GUESSED. A fixed `(8, 8)` inside `.react-flow__pane`
 * is covered by the left-hand "Canvas tools" nav at 1440x900 (the same occlusion
 * `minimiseFloatingOlumiPanel` documents), so the click lands on the toolbar and
 * the selection never clears — which reads exactly like a product defect. The
 * pane point is found by hit-testing until `elementFromPoint` actually returns
 * the pane.
 */
async function resetSelection(page: Page): Promise<void> {
  // ⚠ THE PANE IS PICKED BY IDENTITY, NOT BY DOCUMENT ORDER. This page mounts
  // more than one React Flow instance, so the FIRST `.react-flow__pane` in the
  // document is not necessarily the graph's; the right one is the pane that
  // CONTAINS the nodes.
  //
  // ⚠ AND IT IS A REAL MOUSE CLICK, NOT `element.click()`. A synthetic click
  // dispatched on the pane took the app to `/` mid-run — a navigation that then
  // reads as "the canvas never mounted". A derived bare-canvas point is what a
  // user actually does, and it cannot reach anything the pane does not own.
  const pt = await page.evaluate(() => {
    const node = document.querySelector<HTMLElement>('.react-flow__node')
    const pane = node?.closest<HTMLElement>('.react-flow__pane')
    if (!pane) return null
    const r = pane.getBoundingClientRect()
    for (let fy = 0.06; fy < 0.96; fy += 0.04) {
      for (let fx = 0.06; fx < 0.96; fx += 0.04) {
        const x = Math.round(r.left + r.width * fx)
        const y = Math.round(r.top + r.height * fy)
        if (document.elementFromPoint(x, y) === pane) return { x, y }
      }
    }
    return null
  })
  expect(pt, 'no bare-canvas point hit-tests to the graph pane — selection cannot be reset the way a user would').not.toBeNull()
  await page.mouse.click(pt!.x, pt!.y)
  await expect
    .poll(async () => (await selectedNodeIds(page)).length, { timeout: 5_000 })
    .toBe(0)
}

/**
 * Focus one element, by IDENTITY (its node's store id + its exact accessible
 * name), and report whether the focus actually landed.
 *
 * ⚠ IT REPORTS RATHER THAN THROWS, because "not focusable right now" is a real
 * and recoverable state: several in-node controls are `visibility: hidden`
 * until the node is hovered, and the ghost nodes hide themselves once an
 * analysis has started — which an earlier row's key press can cause. A
 * `focus()` on a hidden element is a silent NO-OP, so a probe that pressed on
 * regardless would be measuring the document, not the control.
 */
async function tryFocus(
  page: Page,
  nodeId: string,
  controlName: string,
): Promise<{ ok: boolean; why: string }> {
  // Hover the node first: the quick-action row is hidden until the node is
  // hovered or focused. A keyboard user reveals it by tabbing (`:focus-within`);
  // hovering is the equivalent the driver can do without disturbing focus.
  const nodeBox = await page.locator(`.react-flow__node[data-id="${nodeId}"]`).boundingBox()
  if (nodeBox) await page.mouse.move(nodeBox.x + nodeBox.width / 2, nodeBox.y + 8)

  // React Flow renders a node `visibility: hidden` until it has MEASURED
  // dimensions, and a node added late (the ghost doors are appended after the
  // graph) can still be unmeasured when the layout store reports quiescence.
  // Poll rather than sample once: a single read here would report a real
  // affordance as unreachable.
  let last = { ok: false, why: 'not attempted' }
  for (let i = 0; i < 12; i++) {
    last = await focusOnce(page, nodeId, controlName)
    if (last.ok) return last
    await page.waitForTimeout(250)
  }
  return last
}

async function focusOnce(
  page: Page,
  nodeId: string,
  controlName: string,
): Promise<{ ok: boolean; why: string }> {
  return page.evaluate(
    ({ nodeId: nid, controlName: cn, selector }) => {
      const node = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${nid}"]`)
      if (!node) return { ok: false, why: 'node not found' }
      const el = Array.from(node.querySelectorAll<HTMLElement>(selector)).find((c) => {
        const name =
          c.getAttribute('aria-label') ?? (c.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80)
        return name === cn
      })
      if (!el) return { ok: false, why: 'control not found in node' }
      el.focus()
      if (document.activeElement === el) return { ok: true, why: '' }
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return {
        ok: false,
        why: `focus() no-op: visibility=${cs.visibility} display=${cs.display} opacity=${cs.opacity} rect=${Math.round(r.width)}x${Math.round(r.height)}`,
      }
    },
    { nodeId, controlName, selector: FOCUSABLE_SELECTOR },
  )
}

/** Focus the named control (asserted) and press one key; return what is selected after. */
async function pressAt(
  page: Page,
  nodeId: string,
  controlName: string,
  key: string,
): Promise<{ selected: string[] }> {
  const probe = await tryFocus(page, nodeId, controlName)
  // PRECONDITION PINNED IN-TEST (trap 13b): a key pressed at a control that
  // never took focus is a reading about the document, not about the control.
  expect(probe.ok, `control "${controlName}" in node ${nodeId} could not take focus — ${probe.why}`).toBe(true)

  await page.keyboard.press(key)
  await page.waitForTimeout(120)
  return { selected: await selectedNodeIds(page) }
}

/**
 * ⭐ THE CONTROL THAT SEPARATES A BLEED FROM A CORRECT ACTION: activate the same
 * control WITHOUT A KEY, and read the selection.
 *
 * ⚠ WITHOUT THIS ROW THE PROBE OVERCLAIMS, AND IT DID — this instrument first
 * reported 5 of 5 render paths bleeding, and two of those five were wrong.
 * `node-action-ask` and the goal's "No target set" chip both call
 * `openNodeInspector(id)`, whose first act is `selectNodeWithoutHistory(nodeId)`
 * (`nodes/shared/openNodeInspector.ts` — read at the bytes, not inferred). They
 * SELECT THE NODE ON PURPOSE. Reading "node selected after Enter" and calling
 * that a bleed blames the library for behaviour the product asked for, and a
 * fix judged against it would be judged against the wrong metric.
 *
 *     bleed  =  keyboard selects  AND  activation-without-a-key does NOT
 *
 * ⚠ AND IT IS `el.click()`, NOT A REAL MOUSE CLICK, DELIBERATELY. A real click
 * was tried first and is unsound here: React Flow nodes live inside a
 * transformed, pannable viewport, so a node can sit entirely OUTSIDE the visible
 * area — `elementFromPoint` at the goal chip's centre returned `null`, the click
 * went nowhere, and "the mouse did not select the node" was recorded for an
 * activation that never happened. That is a manufactured bleed, and it is what
 * this comparator existed to prevent. `el.click()` reaches the control wherever
 * it is.
 *
 * WHAT IT PROVES AND WHAT IT DOES NOT: it fires the control's own click path
 * with no key anywhere near React Flow's node handler, which is exactly the
 * attribution question. It does not fire pointer events, so it is not a claim
 * about the pointer path.
 *
 * The 'q' row answers a different question again — is the probe reporting
 * "selected" for any key at all? All three are needed: one guards against a
 * probe that cannot discriminate, one against a probe that discriminates and
 * attributes to the wrong cause, one against an activation that never landed.
 */
async function activateWithoutKey(page: Page, nodeId: string, controlName: string): Promise<string[]> {
  const clicked = await page.evaluate(
    ({ nodeId: nid, controlName: cn, selector }) => {
      const node = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${nid}"]`)
      const el = Array.from(node?.querySelectorAll<HTMLElement>(selector) ?? []).find((c) => {
        const name =
          c.getAttribute('aria-label') ?? (c.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80)
        return name === cn
      })
      if (!el) return false
      el.click()
      return true
    },
    { nodeId, controlName, selector: FOCUSABLE_SELECTOR },
  )
  // POSITIVE CONTROL for the comparator itself: an activation that never
  // happened would report "the control does not select the node" for every
  // control, i.e. it would agree with a bleed everywhere.
  expect(clicked, `control "${controlName}" in node ${nodeId} was not found to activate`).toBe(true)
  await page.waitForTimeout(150)
  return selectedNodeIds(page)
}

/**
 * Does React Flow's own opt-out apply to this control AT THE MOMENT OF A PRESS?
 *
 * ⚠ MEASURED BY DISPATCHING, NOT BY READING THE CLASS AT REST. The scope arms
 * itself only for the duration of a key dispatch — that is what keeps the
 * pointer consumer (`Pane.onPointerDownCapture`) from ever seeing a `.nokey`
 * element and refusing to start a marquee. Reading the class at rest would
 * report the correct fix as ungated.
 */
/**
 * ⚠ THREE OUTCOMES, NOT TWO — and the third is why this is not a boolean.
 *
 * This used to return `false` both for "the scope does not reach this control"
 * and for "I could not find the control". Those are different facts, and
 * collapsing them makes a MISSING TARGET indistinguishable from a REAL DEFECT
 * (CLAUDE.md trap 21 — two questions under one name). It did not bite while the
 * probe ran BEFORE the press; it becomes reachable the moment it runs after one,
 * because an activation key can take its own target out of the DOM. Reported
 * distinctly so a vanished control REDs as a vanished control.
 */
type GatedProbe = { readonly found: boolean; readonly armed: boolean }

async function isGated(page: Page, nodeId: string, controlName: string): Promise<GatedProbe> {
  return page.evaluate(
    ({ nodeId: nid, controlName: cn, selector }) => {
      const node = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${nid}"]`)
      const el = Array.from(node?.querySelectorAll<HTMLElement>(selector) ?? []).find((c) => {
        const name =
          c.getAttribute('aria-label') ?? (c.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80)
        return name === cn
      })
      if (!el || !node) return { found: false, armed: false }
      let armed = false
      const probe = (ev: Event) => {
        armed = !!(ev.target as Element | null)?.closest('.nokey')
      }
      node.addEventListener('keydown', probe, true)
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      node.removeEventListener('keydown', probe, true)
      return { found: true, armed }
    },
    { nodeId, controlName, selector: FOCUSABLE_SELECTOR },
  )
}

/**
 * Put the canvas back to the seeded state WITHOUT a page load.
 *
 * ⚠ AND A FULL RELOAD PER ROW IS WHAT THIS REPLACES, DELIBERATELY. Reloading
 * between every key press was the obvious design and it does not survive
 * contact: ~20 cold Vite dev loads in one run took the dev server out entirely
 * (`chrome-error://chromewebdata`, no error printed — an OOM kill), and the
 * rows already measured were lost with it. `applyDraftResult` re-applies the
 * whole graph through the product's own path, which restores any control an
 * earlier activation removed, and the pane click closes any menu an earlier
 * activation opened. Both postconditions are ASSERTED below rather than assumed.
 */
async function reseed(page: Page, starter: StarterId): Promise<void> {
  await seedStarterDraft(page, starter)
  await clearNotifications(page)
  await waitForVisualQuiescence(page)
  await resetSelection(page)
}

/** A genuinely fresh document, for the first seed and when the starter changes. */
async function loadCanvas(page: Page, starter: StarterId): Promise<void> {
  // ⚠ `page.goto('about:blank')` FIRST WAS TRIED AND IS WORSE: the second
  // about:blank -> /#/canvas cycle never remounts `.react-flow`. `reload()`
  // then `openCanvas()` is the sequence the sibling census loop already runs
  // five times per run without incident, so it is the one used here.
  await page.reload()
  await openCanvas(page)
  // `openCanvas` waits on `domcontentloaded`; the SPA can still commit a route
  // change after that, and a `page.evaluate` landing mid-navigation dies with
  // "Execution context was destroyed" — a flake that reads as a product failure.
  await page.waitForLoadState('load')
  await page.waitForTimeout(250)
  await reseed(page, starter)
}

test.describe('in-node keyboard bleed', () => {
  test.beforeEach(async ({ page }) => {
    await preparePage(page, VIEWPORT)
    await openCanvas(page)
  })

  test('census: focusable controls inside .react-flow__node, all five starters', async ({ page }) => {
    /*
     * ⚠⚠ THIS BUDGET IS LOAD-BEARING. DO NOT REMOVE IT.
     *
     * This was the only test in the file without one, and it hard-timed out on
     * a reviewer's cold run AFTER printing `390/390` and BEFORE every
     * assertion — i.e. it produced a headline number and then failed without
     * checking anything.
     *
     * ⚠ AND THE EVENT-DRIVEN WAITS DO NOT MAKE IT FIT. This comment used to say
     * they "reclaim most of that", which was true of the intent and FALSE OF
     * THE MEASUREMENT: an independent reviewer's run of this test with the
     * waits in place took **192s**, against a 180s default. It would still
     * hard-time-out. The budget is not headroom over a comfortable margin — it
     * is the only thing holding this test up, and a future reader who deletes
     * it as tidy-up gets a number with no verdict again.
     *
     * (Local runs measure ~200-210s wall for the whole file. Re-derive before
     * trusting any figure here, including this one.)
     */
    test.setTimeout(900_000)
    const perStarter: Record<string, FocusableCensusRow[]> = {}
    for (const id of ALL) {
      await page.reload()
      await openCanvas(page)
      await seedStarterDraft(page, id)
      await clearNotifications(page)
      await waitForVisualQuiescence(page)
      perStarter[id] = await censusFocusables(page)
    }

    const lines: string[] = []
    let total = 0
    let ungated = 0
    for (const id of ALL) {
      const rows = perStarter[id]
      total += rows.length
      lines.push(`\n── ${id}: ${rows.length} focusable elements inside .react-flow__node`)
      for (const r of rows) {
        const gated = r.isInputLike || r.armedOnKeydown
        if (!gated) ungated++
        lines.push(
          `   ${gated ? 'GATED  ' : 'UNGATED'} ${r.nodeType}/${r.nodeId} ${r.tag}` +
            `${r.role ? `[role=${r.role}]` : ''}${r.tabindex ? `[tabindex=${r.tabindex}]` : ''}` +
              ` focusableNow=${r.focusableNow ? 'Y' : 'N'} nodeVis=${r.nodeVisibility} testid=${r.testid ?? '-'} "${r.name}"`,
        )
      }
    }
    // eslint-disable-next-line no-console
    console.log(`\n=== FOCUSABLE CENSUS (DOM DESCENDANTS) === total=${total} ungated=${ungated}${lines.join('\n')}\n`)

    /*
     * AND THE CLASS THE ABOVE CANNOT REACH. Counted per starter, reported
     * alongside, and NOT folded into `total` — folding it in would make one
     * number stand for two different claims.
     */
    let portalPopovers = 0
    let portalControls = 0
    let portalNodes = 0
    const portalSample: string[] = []
    for (const id of ALL) {
      await loadCanvas(page, id)
      const p = await censusPortalledControls(page)
      portalPopovers += p.popovers
      portalControls += p.controls
      portalNodes += p.nodesWithPopover
      for (const c of p.sample) if (portalSample.length < 12 && !portalSample.includes(c)) portalSample.push(c)
    }
    // eslint-disable-next-line no-console
    console.log(
      `\n=== PORTALLED (BEYOND THE SCOPE, NOT GATED) === controls=${portalControls} in popovers=${portalPopovers} on nodes=${portalNodes}\n` +
        portalSample.map((c) => `   "${c}"`).join('\n') +
        '\n',
    )

    /*
     * ⭐ POSITIVE CONTROL ON THE PORTAL PROBE ITSELF, and it is the assertion
     * this whole section exists for.
     *
     * A count of zero here is indistinguishable from "the probe never opened a
     * popover" — which is precisely how the DOM census came to report a clean
     * `0 ungated` for a class it structurally could not reach. A probe reporting
     * a comfortable number about a gap must first prove it can see the gap.
     */
    expect(
      portalPopovers,
      `the portal probe opened only ${portalPopovers} popovers (floor ${MIN_PORTALLED_POPOVERS}, healthy 57-65) — ` +
        `it is starved or blind, and its control count means nothing`,
    ).toBeGreaterThanOrEqual(MIN_PORTALLED_POPOVERS)
    expect(
      portalControls,
      `the portal probe found only ${portalControls} controls (floor ${MIN_PORTALLED_CONTROLS}, healthy 55-59) — ` +
        `a partial read of this gap is worse than none, because the number reads as reassurance`,
    ).toBeGreaterThanOrEqual(MIN_PORTALLED_CONTROLS)

    // POSITIVE CONTROL: the probe must be able to SEE controls at all. A census
    // that finds nothing looks identical to a canvas with nothing to find, and
    // "0 ungated" would then be a perfect score on an empty exam.
    expect(total, 'the census found no focusable element in any node — the probe is blind, not the canvas clean').toBeGreaterThan(0)

    /*
     * ⭐ THE COMPLETENESS CLAIM, AND THE ONLY PLACE IT LIVES.
     *
     * For every focusable element inside every node, across all five starters, a
     * keydown must be one React Flow's `isInputDOMNode` short-circuits on: the
     * element is input-like, or the scope is ARMED at the moment the node's
     * handler reads it. Measured at pristine: 390 rows, 390 ungated. With the
     * registry-level scope: 390 rows, 0 ungated.
     *
     * It is derived from the DOM rather than from a list of components, so a
     * node type or an in-node control added tomorrow is covered by this
     * assertion the day it renders — no one has to remember to extend anything
     * (CLAUDE.md trap 12).
     *
     * ⚠⚠ TWO LIMITS ON THIS NUMBER, AND NEITHER IS SMALL. Read them before
     * quoting `390/390` as though it were the whole claim.
     *
     * (a) IT COVERS DOM DESCENDANTS ONLY. `NodePopover` portals node content to
     *     `document.body`, where React still routes the keydown to the node's
     *     handler but `closest('.nokey')` cannot reach the scope. Those controls
     *     are NOT gated at this head. They are counted separately below rather
     *     than left as a silent exclusion — a probe that cannot see a class
     *     returns a clean zero for it, which is indistinguishable from safety.
     *
     * (b) IT IS MEASURED BY A SYNTHETIC IN-PAGE `dispatchEvent`, which is the
     *     exact instrument that was proved BLIND to the microtask-disarm defect:
     *     calling `dispatchEvent` from script keeps the JS stack non-empty, so
     *     the whole dispatch completes before any microtask runs. A regression
     *     that re-introduced a microtask disarm would leave this census reading
     *     390/390 while the product bled on every real key press. Only the
     *     5-row drive below, which uses real trusted key presses, covers that
     *     intersection — and it is a measure, not a gate.
     *
     * ⚠ SCOPE, STATED: this counts elements the browser can FOCUS AT ALL, not
     * elements visible right now. Several are `visibility: hidden` until their
     * node is hovered or selected — they are still part of the surface the gate
     * must cover, because they become tab stops the moment the node is revealed.
     * The `focusableNow` column records which is which.
     */
    expect(
      ungated,
      `${ungated} of ${total} focusable in-node DOM DESCENDANTS are not gated — a keydown from any of them selects the node behind it. ` +
        `(This assertion is scoped to DOM descendants; portalled controls are counted, not gated — see the header.)`,
    ).toBe(0)
  })

  test(
    'drive: Space/Enter at an in-node control, with a contrast control and an attribution control',
    { tag: GATE_TAG },
    async ({ page }) => {
    test.setTimeout(900_000)

    let loaded: StarterId | null = null
    const censusByStarter = new Map<StarterId, FocusableCensusRow[]>()
    for (const starter of new Set(DRIVEN_KINDS.map((k) => k.starter))) {
      await loadCanvas(page, starter)
      loaded = starter
      const rows = await censusFocusables(page)
      expect(rows.length, `no focusable control found inside any node of "${starter}" — the probe is blind`).toBeGreaterThan(0)
      censusByStarter.set(starter, rows)
    }

    /*
     * ⚠ DRIVING ALL 67 CONTROLS ON ONE PAGE WAS TRIED FIRST AND IS NOT SOUND:
     * activating them SENDS MESSAGES, OPENS MENUS AND STARTS ANALYSES, so the
     * canvas the 60th control is measured on is not the canvas the census
     * described — that run died on a ghost node an earlier press had unmounted.
     * Every row therefore gets the graph re-applied first.
     *
     * COMPLETENESS IS THE CENSUS TEST'S JOB, NOT THIS ONE'S: the census asserts
     * the gate over every focusable in every node across all five starters. This
     * test proves the MECHANISM, on a representative of each render path, in
     * both directions.
     */
    const targets: Array<{ kind: string; starter: StarterId; row: FocusableCensusRow }> = []
    for (const { kind, starter } of DRIVEN_KINDS) {
      const hit = (censusByStarter.get(starter) ?? []).find(
        (r) => !r.isInputLike && r.name && (r.kind === kind || r.kind.startsWith(`${kind} `)),
      )
      // FAIL LOUD ON A MISSING RENDER PATH. A drive that silently skips one
      // reads exactly like a drive that covered it (trap 13: an absence probe
      // must be able to see a presence).
      expect(
        hit,
        `render path "${kind}" is not in the census for "${starter}" — coverage would silently shrink. ` +
          `Kinds present: ${[...new Set((censusByStarter.get(starter) ?? []).map((r) => r.kind))].join(' | ')}`,
      ).toBeTruthy()
      // Recorded under the kind ACTUALLY found, so the table names the element
      // driven rather than the pattern that selected it.
      targets.push({ kind: hit!.kind, starter, row: hit! })
    }
    expect(targets.length, 'no control kinds to drive').toBe(DRIVEN_KINDS.length)

    const table: string[] = []
    const gated: Record<string, boolean> = {}
    let bleeding = 0
    let contrastSelections = 0
    let selfSelecting = 0

    for (const { kind, starter, row: c } of targets) {
      const read: Record<string, string[]> = {}
      /*
       * ⚠ ONE FRESH SEED PER KEY, NOT PER CONTROL. Pressing Space on
       * "Challenge <factor>" ACTIVATES it and the button leaves the DOM, so the
       * Enter row that followed was measured against a control that no longer
       * existed. A probe whose own earlier press destroys its next target is
       * measuring its own side effects.
       */
      for (const key of ['FOCUS', ' ', 'Enter', 'q', 'CLICK']) {
        // eslint-disable-next-line no-console
        console.log(`[bleed] ${starter} ${kind} <- ${JSON.stringify(key)}`)
        if (starter !== loaded) {
          await loadCanvas(page, starter)
          loaded = starter
        } else {
          await reseed(page, starter)
          // ⚠ RE-APPLYING THE GRAPH DOES NOT UNDO EVERYTHING. An earlier press
          // can start an analysis, and the ghost nodes hide themselves
          // post-analysis — so the target can be present and unfocusable. When
          // that happens, take the cost of a real page load rather than pressing
          // at something the browser will not focus.
          if (!(await tryFocus(page, c.nodeId, c.name)).ok) {
            await loadCanvas(page, starter)
            loaded = starter
          }
        }
        // BASELINE PINNED IN-TEST. Without this, a row that starts with the node
        // already selected would report a "bleed" the key press never caused.
        expect(await selectedNodeIds(page), 'a node was already selected at baseline').toEqual([])
        if (key === 'CLICK') {
          read[key] = await activateWithoutKey(page, c.nodeId, c.name)
        } else if (key === 'FOCUS') {
          /*
           * ⚠ FOCUS ALONE, NO KEY. React attaches `onFocus` via `focusin`,
           * which BUBBLES, so focusing a control inside a node also reaches the
           * node's own focus handler. A selection that appears here was never
           * caused by a key press at all, and attributing it to the keydown
           * bleed would be a wrong diagnosis with a green-looking fix.
           */
          const probe = await tryFocus(page, c.nodeId, c.name)
          expect(probe.ok, `control "${c.name}" could not take focus — ${probe.why}`).toBe(true)
          await page.waitForTimeout(150)
          read[key] = await selectedNodeIds(page)
        } else {
          /*
           * ⭐⭐ ORDER IS LOAD-BEARING: MEASURE THE KEY UNDER TEST FIRST, THEN PROBE.
           *
           * `isGated` dispatches a REAL bubbling `Enter` keydown, and `Enter` is
           * in React Flow's `elementSelectionKeys`
           * (`@xyflow/react@12.10.2` `index.mjs:2177`). Running it BEFORE
           * `pressAt` — which is how this shipped — meant that whenever the
           * scope was broken THE PROBE SELECTED THE NODE ITSELF, before the key
           * under test was ever pressed.
           *
           * Proven by execution, both directions, on a tree with the scope class
           * renamed (i.e. reproducing #1129):
           *     probe first  -> q=["dec_cdp"] x5, and the CONTRAST CONTROL at
           *                     ':956' fires — "the probe is not discriminating"
           *     probe second -> q=[] x5, and the HEADLINE assertion at ':959'
           *                     fires — "an in-node control still selects the
           *                     node behind it"
           *
           * Two things followed from the wrong order, and both are the reason
           * this is not a cosmetic reorder: the headline assertion and the
           * per-path `gated` assertion had NEVER EXECUTED under any mutant, and
           * in the broken state the `space`/`enter` readings were contaminated
           * by the probe's own Enter — so the arm could not distinguish "the key
           * press bled" from "my probe bled", which is precisely the attribution
           * question its FOCUS/CLICK rows exist to answer.
           *
           * ⚠ AND THE HAZARD THE REORDER CREATES, closed rather than reasoned
           * away: an activation key can take its own target OUT OF THE DOM (see
           * the "ONE FRESH SEED PER KEY" note above), and a probe that cannot
           * find its element used to return the same `false` as a genuinely
           * ungated one — so measuring after a press could have manufactured a
           * FALSE `gated=N`. Two changes close it, and neither relies on this
           * comment staying true:
           *   - `isGated` now reports `found` and `armed` SEPARATELY, so a
           *     vanished target can never be read as a defect;
           *   - only the CONTRAST key 'q' writes the recorded verdict, and 'q'
           *     is not an activation key, so its target must survive its own
           *     press — asserted in-test, immediately below, rather than
           *     assumed.
           */
          read[key] = (await pressAt(page, c.nodeId, c.name, key)).selected
          const probe = await isGated(page, c.nodeId, c.name)
          // A vanished target is a HARD ERROR on the contrast key, never a
          // reading: 'q' does not activate anything, so its target must survive
          // its own press. On ' ' / 'Enter' a vanished target is EXPECTED (the
          // press activated the control), and the value is overwritten by the
          // 'q' pass that follows — so only 'q' may write the recorded verdict.
          if (key === 'q') {
            expect(
              probe.found,
              `the gated probe could not find "${c.name}" after the contrast key — a false ` +
                `gated=N would follow, so this REDs rather than reporting a number`,
            ).toBe(true)
            gated[kind] = probe.armed
          }
        }
      }

      const keyboardSelects = read[' '].includes(c.nodeId) || read.Enter.includes(c.nodeId)
      const mouseSelects = read.CLICK.includes(c.nodeId)
      const focusSelects = read.FOCUS.includes(c.nodeId)
      const bled = keyboardSelects && !mouseSelects && !focusSelects
      if (bled) bleeding++
      if (mouseSelects || focusSelects) selfSelecting++
      if (read.q.length > 0) contrastSelections++
      const verdict = bled ? 'BLEED     ' : focusSelects ? 'focus-sel ' : mouseSelects ? 'self-sel  ' : 'clean     '
      table.push(
        `${verdict} ${starter} ${kind}  gated=${gated[kind] ? 'Y' : 'N'}\n` +
          `        ${c.nodeType}/${c.nodeId} ${c.tag}${c.role ? `[role=${c.role}]` : ''} "${c.name}"\n` +
          `        focus=${JSON.stringify(read.FOCUS)} space=${JSON.stringify(read[' '])}` +
          ` enter=${JSON.stringify(read.Enter)} q=${JSON.stringify(read.q)} click=${JSON.stringify(read.CLICK)}`,
      )
    }

    // eslint-disable-next-line no-console
    console.log(
      `\n=== DRIVE === ${targets.length} render paths, ${bleeding} bleeding, ${selfSelecting} self-selecting\n${table.join('\n')}\n`,
    )

    /*
     * CONTRAST CONTROL, SAME RUN, EXPECTED ANSWER DIFFERENT (trap 13e). 'q' is
     * not in `elementSelectionKeys`, so it must never select a node. Without
     * this row, a probe that reported "selected" for any keypress at all would
     * be indistinguishable from a probe measuring the bleed — and after the fix
     * a probe that had stopped reading the DOM would agree with a clean result.
     */
    expect(contrastSelections, "contrast control failed: 'q' selected a node — the probe is not discriminating").toBe(0)

    // ── DIRECTION 1a: no in-node control may select the node behind it ─────
    expect(bleeding, 'an in-node control still selects the node behind it').toBe(0)

    /*
     * ── DIRECTION 1b: THE MECHANISM, for the controls whose own action selects
     * the node anyway.
     *
     * For "Ask Olumi" and the goal chip the selection assertion cannot decide
     * anything — they select the node deliberately. What CAN be decided is
     * whether React Flow's own opt-out reaches them, which is the thing the fix
     * changes. Asserted for EVERY driven path, so a fix that happened to work
     * on three components and miss two would still RED here.
     */
    for (const { kind } of targets) {
      expect(gated[kind], `render path "${kind}" has no .nokey ancestor — the scope does not reach it`).toBe(true)
    }

  })

  /*
   * ── THE OPPOSITE DIRECTION, AS ITS OWN TEST ────────────────────────────────
   *
   * A guard that only proves "the key no longer reaches the node" is a guard
   * watching one door: `disableKeyboardA11y`, or `nodesFocusable={false}`, or a
   * `nokey` placed one level too high would all satisfy it — by removing
   * keyboard node selection altogether, which is a REAL accessibility feature
   * and, for a keyboard user, the route to the Inspector.
   *
   * It is a SEPARATE test on purpose: as one long test it never ran, because
   * the bleed assertion above failed first and took the whole case with it. A
   * direction that only executes when the other direction already passes is not
   * really being measured.
   */
  /*
   * ── THE POINTER ARM ────────────────────────────────────────────────────────
   *
   * `.nokey` is a SHARED VOCABULARY with two consumers in the shipped library,
   * and the first version of this fix enumerated one. Besides `isInputDOMNode`,
   * `@xyflow/react@12.10.2` reads it in `Pane.onPointerDownCapture`
   * (`dist/esm/index.mjs:1455-1456`) — the handler that exists SPECIFICALLY so a
   * marquee can start over a node:
   *
   *     const isNoKeyEvent = !eventTargetIsContainer && !!event.target.closest('.nokey')
   *     if (isNoKeyEvent || !isSelecting || !isSelectionActive || ...) return
   *
   * Wrapping node content in a permanent `.nokey` opted the whole canvas out of
   * it: Shift-drag over a node stopped starting a marquee and DRAGGED THE NODE
   * instead — a worse defect than the one being fixed. This arm is what would
   * have caught it, and it runs in BOTH directions:
   *
   *   · a marquee must still start when the drag begins over a node, AND
   *   · the node must not move while it does.
   *
   * A drag that moves nothing satisfies "the node did not move" perfectly, so
   * neither assertion is worth anything without the other.
   */
  test(
    'pointer: Shift-drag over a node still starts a marquee, and does not move the node',
    { tag: GATE_TAG },
    async ({ page }) => {
    test.setTimeout(900_000)
    await loadCanvas(page, 'vendor-selection')

    /** The rect React Flow gives the node, read from the store's own position. */
    const nodeGeom = async (id: string) =>
      page.evaluate((nid) => {
        const el = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${nid}"]`)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), transform: el.style.transform }
      }, id)

    /** Is a user-selection rectangle on screen right now? */
    const marqueeVisible = () =>
      page.evaluate(() => !!document.querySelector('.react-flow__selection, .react-flow__nodesselection-rect'))

    // Pick a node that is fully on screen — a drag whose start point is outside
    // the viewport measures nothing (this bit the click comparator earlier).
    const target = await page.evaluate(() => {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('.react-flow__node'))) {
        const r = el.getBoundingClientRect()
        const onScreen =
          r.width > 40 && r.height > 40 && r.x > 60 && r.y > 60 &&
          r.x + r.width < window.innerWidth - 60 && r.y + r.height < window.innerHeight - 60
        // Start the drag on BARE CARD BODY, not on a control: a pointerdown on a
        // control is a different gesture and would prove nothing about the pane.
        if (!onScreen) continue
        const cx = Math.round(r.x + r.width / 2)
        const cy = Math.round(r.y + r.height - 6)
        const top = document.elementFromPoint(cx, cy)
        if (!top || top.closest('button, [role="button"], a, input, textarea, select')) continue
        return { id: el.getAttribute('data-id') ?? '', x: cx, y: cy }
      }
      return null
    })
    expect(target, 'no fully-on-screen node with bare card body to start a drag on').not.toBeNull()

    const before = await nodeGeom(target!.id)
    expect(before, 'the target node vanished before the drag').not.toBeNull()

    // ── CONTROL: a Shift-drag from BARE PANE must marquee. If this fails the
    // instrument is broken (Shift not reaching React Flow, selection disabled,
    // wrong selector) and every row below is void.
    const paneStart = await page.evaluate(() => {
      const node = document.querySelector<HTMLElement>('.react-flow__node')
      const pane = node?.closest<HTMLElement>('.react-flow__pane')
      if (!pane) return null
      const r = pane.getBoundingClientRect()
      for (let fy = 0.06; fy < 0.96; fy += 0.04) {
        for (let fx = 0.06; fx < 0.96; fx += 0.04) {
          const x = Math.round(r.left + r.width * fx)
          const y = Math.round(r.top + r.height * fy)
          if (document.elementFromPoint(x, y) === pane) return { x, y }
        }
      }
      return null
    })
    expect(paneStart, 'no bare-pane point to run the control drag from').not.toBeNull()

    await page.keyboard.down('Shift')
    await page.mouse.move(paneStart!.x, paneStart!.y)
    await page.mouse.down()
    await page.mouse.move(paneStart!.x + 90, paneStart!.y + 70, { steps: 6 })
    const controlMarquee = await marqueeVisible()
    await page.mouse.up()
    await page.keyboard.up('Shift')
    expect(
      controlMarquee,
      'CONTROL FAILED: a Shift-drag from bare pane did not start a marquee — the instrument, not the product',
    ).toBe(true)

    await resetSelection(page)

    // ── THE MEASUREMENT: same gesture, started over a NODE.
    await page.keyboard.down('Shift')
    await page.mouse.move(target!.x, target!.y)
    await page.mouse.down()
    await page.mouse.move(target!.x + 90, target!.y + 70, { steps: 6 })
    const overNodeMarquee = await marqueeVisible()
    await page.mouse.up()
    await page.keyboard.up('Shift')
    await page.waitForTimeout(200)

    const after = await nodeGeom(target!.id)

    // eslint-disable-next-line no-console
    console.log(
      `\n=== POINTER === node=${target!.id}\n` +
        `  control (drag from bare pane): marquee=${controlMarquee}\n` +
        `  over the node:                 marquee=${overNodeMarquee}\n` +
        `  node transform before=${before?.transform} after=${after?.transform}\n`,
    )

    // DIRECTION 1: the marquee must still start.
    expect(
      overNodeMarquee,
      'a Shift-drag starting over a node no longer starts a marquee — the pointer consumer of .nokey has been opted out',
    ).toBe(true)

    // DIRECTION 2: and the node must not have been dragged out of the layout.
    expect(
      after?.transform,
      'the node MOVED during a Shift-drag — the marquee gesture is dragging nodes instead of selecting a region',
    ).toBe(before?.transform)
  })

  test(
    'opposite direction: Enter at the NODE still selects it, Escape still deselects',
    { tag: GATE_TAG },
    async ({ page }) => {
    test.setTimeout(900_000)

    /*
     * ⚠⚠ THIS TEST IS FLAKY WHEN RUN AFTER THE POINTER TEST, AND THE HYGIENE
     * BELOW DID NOT FIX IT. Read this before spending an hour on a red here.
     *
     * MEASURED by an independent reviewer at this head: **7 paired runs, 1
     * failure; 8 isolated runs, 0 failures** — roughly a 14% rate in sequence.
     * An earlier version of this comment claimed the hygiene below made it
     * order-independent, on the strength of a single 4/4 green run. That was a
     * claim about intent, not a measurement, and it is withdrawn.
     *
     * ⭐ APPENDED (2026-09-02, the canvas-gate lane, at staging 8736a61a):
     * **12 further PAIRED runs, 0 failures** — pooling to 19 paired / 1 failure.
     * ⚠ READ THAT AS EVIDENCE ABOUT NOTHING MUCH: at a true 14% rate, twelve
     * consecutive passes occur about 16% of the time (0.86^12), so 12/12 is an
     * unremarkable draw and NOT a refutation — the same asymmetry this comment
     * already states about 8/8 at the merge base, now in the other direction.
     * That lane therefore did not reproduce it, did not root-cause it, and
     * CHANGED NOTHING HERE. Appended rather than rewritten: these are dated
     * measurements, and a record of what was measured is not a fixture to keep
     * current (CLAUDE.md trap 14b).
     *
     * ⚠ IT IS NONETHELESS IN THE MERGE-PATH GATE, and that is a decision with a
     * reason: dropping it would leave the gate watching one door. The job is
     * ADVISORY, which is what absorbs the flake — never a retry. Root-causing
     * this arm is the stated precondition for promoting that job to REQUIRED.
     * Full argument at `canvasGateSet.ts` § KNOWN_FLAKE_IN_GATE.
     *
     * ⭐ IT IS NOT CAUSED BY THE FIX THIS FILE TESTS, and the reasoning is
     * mechanical rather than statistical: `closest()` walks UP, the keyboard
     * scope is a DESCENDANT of `.react-flow__node`, so a keydown originating at
     * the node cannot reach it — and an instrumented run measured `anyNokey: 0`
     * at the moment of the press in 12/12 runs. 8/8 green at the merge base
     * cannot exclude the same ~14% rate either way, so it is recorded as
     * PRE-EXISTING rather than attributed in either direction.
     *
     * ⚠ WHY IT MATTERS DISPROPORTIONATELY: this is the guard that proves the
     * fix did NOT break keyboard node selection, and its failure message reads
     * `keyboard node selection is GONE`. A ~14% flake with that wording will
     * cost some future lane an hour proving it is not their fault. Rowed for a
     * proper root-cause, deliberately not papered over with a retry.
     *
     * The hygiene below stays because it is correct in itself — the starting
     * state should be a PRECONDITION rather than an inheritance — but it is not
     * a fix and must not be read as one.
     */
    await page.keyboard.up('Shift').catch(() => undefined)
    await page.mouse.up().catch(() => undefined)
    await page.mouse.move(4, 4)

    await loadCanvas(page, 'vendor-selection')

    // The starting state is asserted, not assumed.
    expect(await selectedNodeIds(page), 'a node was already selected before this test began').toEqual([])

    // ── DIRECTION 2: KEYBOARD NODE SELECTION MUST STILL WORK ───────────────
    // React Flow's element-selection keys are a real a11y feature, and the node
    // div is the tab stop a keyboard user reaches BEFORE its contents (it
    // precedes its descendants in DOM order). A fix that kills this has traded
    // one accessibility defect for another. Bound by identity to one named node.
    // Bound by IDENTITY to one named node from the seeded starter — never
    // "some node became selected", which any other node could satisfy.
    const targetNode = await page.evaluate(
      () => document.querySelector('.react-flow__node')?.getAttribute('data-id') ?? '',
    )
    expect(targetNode, 'no node on the canvas to select').not.toBe('')

    const focusedNode = await page.evaluate((nid) => {
      const node = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${nid}"]`)
      if (!node) return false
      node.focus()
      return document.activeElement === node
    }, targetNode)
    expect(focusedNode, `the .react-flow__node element for ${targetNode} could not take focus`).toBe(true)

    await page.keyboard.press('Enter')
    await page.waitForTimeout(150)
    expect(
      await selectedNodeIds(page),
      'keyboard node selection is GONE — the fix traded one accessibility defect for another',
    ).toEqual([targetNode])

    // And Escape AT THE NODE must still deselect it.
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
    expect(await selectedNodeIds(page), 'Escape at the node no longer deselects it').toEqual([])
  })
})
