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
 * ⚠ RUN IT DELIBERATELY, it is not in any gate:
 *     pnpm exec playwright test -c playwright.geometry.config.ts nodeKeyboardBleed
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
  /** Does React Flow's own `.nokey` opt-out apply to this target? */
  hasNokeyAncestor: boolean
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
          hasNokeyAncestor: !!el.closest('.nokey'),
        })
      }
    }
    return rows
  }, FOCUSABLE_SELECTOR)
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

/** Does React Flow's own opt-out apply to this control, at the moment of the press? */
async function isGated(page: Page, nodeId: string, controlName: string): Promise<boolean> {
  return page.evaluate(
    ({ nodeId: nid, controlName: cn, selector }) => {
      const node = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${nid}"]`)
      const el = Array.from(node?.querySelectorAll<HTMLElement>(selector) ?? []).find((c) => {
        const name =
          c.getAttribute('aria-label') ?? (c.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 80)
        return name === cn
      })
      if (!el) return false
      return !!el.closest('.nokey')
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
        const gated = r.isInputLike || r.hasNokeyAncestor
        if (!gated) ungated++
        lines.push(
          `   ${gated ? 'GATED  ' : 'UNGATED'} ${r.nodeType}/${r.nodeId} ${r.tag}` +
            `${r.role ? `[role=${r.role}]` : ''}${r.tabindex ? `[tabindex=${r.tabindex}]` : ''}` +
              ` focusableNow=${r.focusableNow ? 'Y' : 'N'} nodeVis=${r.nodeVisibility} testid=${r.testid ?? '-'} "${r.name}"`,
        )
      }
    }
    // eslint-disable-next-line no-console
    console.log(`\n=== FOCUSABLE CENSUS === total=${total} ungated=${ungated}${lines.join('\n')}\n`)

    // POSITIVE CONTROL: the probe must be able to SEE controls at all. A census
    // that finds nothing looks identical to a canvas with nothing to find, and
    // "0 ungated" would then be a perfect score on an empty exam.
    expect(total, 'the census found no focusable element in any node — the probe is blind, not the canvas clean').toBeGreaterThan(0)

    /*
     * ⭐ THE COMPLETENESS CLAIM, AND THE ONLY PLACE IT LIVES.
     *
     * Every focusable element inside every node, across all five starters, must
     * be one React Flow's `isInputDOMNode` short-circuits on: an input-like
     * element, or one with a `.nokey` ancestor. Measured at pristine: 390 rows,
     * 390 ungated. With the registry-level scope: 390 rows, 0 ungated.
     *
     * It is derived from the DOM rather than from a list of components, so a
     * node type or an in-node control added tomorrow is covered by this
     * assertion the day it renders — no one has to remember to extend anything
     * (CLAUDE.md trap 12).
     *
     * ⚠ SCOPE, STATED: this counts elements the browser can FOCUS AT ALL, not
     * elements visible right now. Several are `visibility: hidden` until their
     * node is hovered or selected — they are still part of the surface the gate
     * must cover, because they become tab stops the moment the node is revealed.
     * The `focusableNow` column records which is which.
     */
    expect(ungated, `${ungated} of ${total} focusable in-node elements are NOT gated — a keydown from any of them selects the node behind it`).toBe(0)
  })

  test('drive: Space/Enter at an in-node control, with a contrast control and an attribution control', async ({ page }) => {
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
          gated[kind] = await isGated(page, c.nodeId, c.name)
          read[key] = (await pressAt(page, c.nodeId, c.name, key)).selected
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
  test('opposite direction: Enter at the NODE still selects it, Escape still deselects', async ({ page }) => {
    test.setTimeout(900_000)
    await loadCanvas(page, 'vendor-selection')

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
