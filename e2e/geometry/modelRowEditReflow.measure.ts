/**
 * MODEL ROW — ENTERING EDIT MUST NOT MOVE THE LAYOUT.
 *
 * ⚠ WHY THIS EXISTS, AND WHY IT IS A BROWSER TEST.
 *
 * PR #1179 migrated the Model tab onto the panel type scale. The row's IDLE
 * value moved 14px `tabular` -> 12px `panelTabular`; its EDIT input stayed at
 * 14px `tabular`, because DS v5 §2.1 makes 14px the minimum accessible size for
 * a text field and a 12px field at the 280px dock floor is a usability
 * regression (that was itself a blocking review finding, F1).
 *
 * Both decisions are right. Together they mean clicking a value swaps a 12px
 * line box for a 14px input — on the exact datum the PR exists to align into a
 * column. Whether that MOVES anything is a layout question, and:
 *
 *   - `rowAtomsDoNotWrap.spec.tsx:88` says outright "jsdom performs no layout";
 *   - every other spec on this PR asserts className MEMBERSHIP.
 *
 * So the whole existing suite is structurally incapable of observing it, and it
 * passed green while the reflow was live. A className assertion here would be
 * vacuous for the same reason — this measures RENDERED GEOMETRY or it measures
 * nothing.
 *
 * WHAT IS MEASURED, and why these two numbers rather than "the row looks fine":
 *   1. the edited row's own height, and
 *   2. the TOP of the row BELOW it.
 * (1) alone can hide the defect: a row that grows inside a fixed-height
 * container moves nothing. (2) alone can hide it too: a row can grow while the
 * next row is clipped rather than pushed. A reflow the user notices has to move
 * one of the two, so both are asserted.
 *
 * POSITIVE CONTROL, in-test: before asserting the absence of movement, we
 * assert the edit actually HAPPENED (the input exists and is focused). An
 * absence probe that never entered edit mode reports a perfectly still layout
 * for the excellent reason that nothing changed — CLAUDE.md trap 13.
 */
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { GATE_TAG } from './canvasGateSet'
import {
  openCanvas, preparePage, seedStarterDraft, clearNotifications,
  minimiseFloatingOlumiPanel, freezeMotion, waitForVisualQuiescence,
} from '../visual/harness'

const STARTER = 'build-vs-buy' as const
const VP = { width: 1280, height: 900 }

/** The dock floor, and a width a user would actually sit at. */
const WIDTHS = [280, 416] as const

interface Geom {
  readonly testid: string
  readonly rowHeight: number
  readonly nextRowTop: number
  readonly valueTop: number
  /**
   * ⭐ THE VALUE ATOM'S OWN BOX. `EDIT_RESERVED_HEIGHT_CLASS` (`min-h-[23px]`)
   * exists so the 12px idle glyph and the 14px edit input occupy the SAME box —
   * that is the question this measure was originally written to answer, and
   * until now it was answered only INDIRECTLY, by the row's total being zero.
   * Reading it directly is strictly stronger: a row total held at zero by some
   * unrelated compensation would have satisfied the old assertion.
   */
  readonly valueBoxHeight: number
  readonly valueFontPx: number
}

async function readGeometry(page: Page, rowId: string): Promise<Geom | null> {
  return page.evaluate((id) => {
    const row = document.querySelector(`[data-testid="model-row-v2-${id}"]`)
    if (!(row instanceof HTMLElement)) return null
    const value = document.querySelector(`[data-testid="model-row-v2-${id}-value"]`)
    // The next SIBLING row, whatever its id — the thing that would be pushed.
    let next: Element | null = row.nextElementSibling
    while (next && !(next instanceof HTMLElement)) next = next.nextElementSibling
    const sized = value instanceof HTMLElement
      ? (value.querySelector('input') ?? value)
      : null
    return {
      testid: `model-row-v2-${id}`,
      rowHeight: Math.round(row.getBoundingClientRect().height * 100) / 100,
      nextRowTop: next instanceof HTMLElement
        ? Math.round(next.getBoundingClientRect().top * 100) / 100
        : -1,
      // ⚠ WITHOUT THIS, "the row did not move" can hide "the text jumped inside
      // a row whose height happens to be reserved". The reserved-height fix is
      // exactly the change that could introduce that, so the assertion that
      // proves the fix must also be able to catch the fix's own failure mode.
      valueTop: value instanceof HTMLElement
        ? Math.round(value.getBoundingClientRect().top * 100) / 100
        : -1,
      valueBoxHeight: value instanceof HTMLElement
        ? Math.round(value.getBoundingClientRect().height * 100) / 100
        : -1,
      valueFontPx: sized
        ? parseFloat(getComputedStyle(sized).fontSize)
        : -1,
    }
  }, rowId)
}

test.describe('model row edit reflow', () => {
for (const width of WIDTHS) {
  /**
   * ⭐ GATED. `GATE_TAG` admits this to the Canvas Browser Gate, and
   * `canvasGateSet.ts` registers it BY NAME in both directions — tag without a
   * registry entry is UNEXPECTED-red, registry entry without a tag is
   * MISSING-red.
   *
   * ⚠ IT IS GATED BECAUSE `valueCellMetrics.ts` CLAIMS IT IS. That file says a
   * browser test "fails loudly" if anyone changes the edit input's font size,
   * line-height, border or padding. When this measure was first written it ran
   * in ZERO CI jobs — not in the gate registry, its config invoked by no
   * workflow, and `*.measure.ts` excluded by the default `testMatch` — so the
   * sentence promised a guard that did not exist, guarding a hand-maintained
   * constant, in a file whose own header calls itself a hand-maintained mirror.
   * A reviewer found it. Registering the file was the better of the two
   * closures because it makes the sentence TRUE rather than merely softening it.
   */
  test(`MODEL ROW EDIT REFLOW @dock ${width}px`, { tag: GATE_TAG }, async ({ page }) => {
    await preparePage(page, VP)
    await page.addInitScript((w) => {
      try { localStorage.setItem('panel.results.width', String(w)) } catch { /* asserted below */ }
    }, width)

    await openCanvas(page)
    const seeded = await seedStarterDraft(page, STARTER)
    expect(seeded.nodeCount, 'build-vs-buy is 19 nodes; a different count means the fixture drifted').toBe(19)

    await clearNotifications(page)
    await minimiseFloatingOlumiPanel(page)
    await freezeMotion(page)

    await page.click('[data-testid="outputs-dock-tab-diagnostics"]')
    await page.waitForSelector('[data-testid="model-outline-v2"]', { timeout: 20_000 })
    await waitForVisualQuiescence(page)

    // The dock width actually took. If it did not, every number below is about
    // a width nobody asked for.
    const dockW = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="outputs-dock-tablist"]')?.closest('[style*="width"], aside, section')
      return el instanceof HTMLElement ? Math.round(el.getBoundingClientRect().width) : -1
    })

    // ⚠ NAVIGATION, NOT A RELAXED MEASURE — and it is why this gate went RED.
    // The outline now opens CLOSED (`initiallyClosedGroups`), so NO row is
    // mounted until a group is opened. The `rowId` precondition below then
    // reads null and the measure asserts about nothing — which is exactly what
    // that precondition exists to catch, and it caught it.
    //
    // This performs the click a reader now performs. Not one assertion below
    // changes: the subject is still whether an editable row's geometry moves
    // when its editor opens.
    //
    // Playwright's `click` is used rather than an in-page `el.click()`: the
    // estate has already been caught reporting a control inert because a bare
    // `.click()` did not drive the full pointer sequence some controls need.
    // Iterating a fixed count, not re-querying a live `[aria-expanded="false"]`
    // list, so this cannot spin if a toggle refuses to open.
    const groupToggles = page.locator('[data-testid^="model-group-v2-"][data-testid$="-toggle"]')
    const groupCount = await groupToggles.count()
    expect(groupCount, 'no outline groups found — the model tab did not mount').toBeGreaterThan(0)
    for (let i = 0; i < groupCount; i++) {
      const toggle = groupToggles.nth(i)
      if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click()
    }
    await waitForVisualQuiescence(page)

    // Keep the original one-field FACTOR no-reflow subject explicit. Goal
    // editing now has two fields; it gets its own bounded proof below rather
    // than silently replacing this test's subject as the first editable row.
    const rowId = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('[data-kind="factor"] button[data-testid^="model-row-v2-"][data-testid$="-value"]'))
      const first = buttons[0]
      if (!(first instanceof HTMLElement)) return null
      const t = first.getAttribute('data-testid') ?? ''
      return t.replace(/^model-row-v2-/, '').replace(/-value$/, '')
    })
    expect(rowId, 'no EDITABLE row value found — the measure would assert about nothing').not.toBeNull()

    await page.getByTestId(`model-row-v2-${rowId}-value`).scrollIntoViewIfNeeded()
    await waitForVisualQuiescence(page)
    const before = await readGeometry(page, rowId as string)
    expect(before, 'row geometry unreadable before edit').not.toBeNull()
    expect(before!.nextRowTop, 'the factor and its neighbour must be in view before measuring movement').toBeGreaterThan(0)

    await page.click(`[data-testid="model-row-v2-${rowId}-value"]`)

    // ── POSITIVE CONTROL ──────────────────────────────────────────────────
    // Prove the edit HAPPENED before asserting that nothing moved.
    const input = page.locator(`[data-testid="model-row-v2-${rowId}-value-input"]`)
    await expect(input, 'the click did not open an editor — a still layout here would prove nothing').toBeVisible({ timeout: 10_000 })

    const after = await readGeometry(page, rowId as string)
    expect(after, 'row geometry unreadable during edit').not.toBeNull()

    const b = before as Geom, a = after as Geom

    // The control's own discrimination: the font size MUST have changed, or
    // this test is measuring a transition that did not occur.
    expect(a.valueFontPx, 'the edit input is not 14px — F1 has regressed').toBeCloseTo(14, 1)
    expect(b.valueFontPx, 'the idle value is not 12px — the panel-scale migration has regressed').toBeCloseTo(12, 1)

    const heightDelta = Math.round((a.rowHeight - b.rowHeight) * 100) / 100
    const pushDelta = b.nextRowTop < 0 || a.nextRowTop < 0
      ? 0
      : Math.round((a.nextRowTop - b.nextRowTop) * 100) / 100
    const textDelta = b.valueTop < 0 || a.valueTop < 0
      ? 0
      : Math.round((a.valueTop - b.valueTop) * 100) / 100

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      measure: 'modelRowEditReflow', dockWidth: width, measuredDockW: dockW, rowId,
      idleFontPx: b.valueFontPx, editFontPx: a.valueFontPx,
      rowHeightBefore: b.rowHeight, rowHeightAfter: a.rowHeight, heightDelta,
      nextRowTopBefore: b.nextRowTop, nextRowTopAfter: a.nextRowTop, pushDelta,
      valueTopBefore: b.valueTop, valueTopAfter: a.valueTop, textDelta,
      valueBoxBefore: b.valueBoxHeight, valueBoxAfter: a.valueBoxHeight,
    }))

    /*
     * ⭐⭐⭐ TWO QUESTIONS WERE LIVING UNDER ONE ASSERTION, AND SEPARATING THEM IS
     * THE POINT OF THIS BLOCK (CLAUDE.md trap 21).
     *
     * `heightDelta === 0` was written for #1179, where the editor gained NO
     * CONTENT — it swapped a 12px glyph for a 14px input on the same datum, and
     * the only honest answer was "nothing may move". `EDIT_RESERVED_HEIGHT_CLASS`
     * is the fix it guards.
     *
     * #1401 asks a DIFFERENT question: may the editor DISCLOSE a route forward?
     * The `editing` beat before it offered a naked input, no advance control and
     * nothing naming Enter — measured on deployed `9748b336`. A zero-delta
     * contract answers that question with "no", by construction: any visible
     * control in a 36px row costs height. Aligning the two would have meant
     * reverting the capability, so they are named apart instead.
     *
     * ⚠ THIS IS NOT A RAISED TOLERANCE ON THE #1179 CONTRACT — that contract is
     * asserted MORE tightly below than it was before, directly on the value
     * atom's own box (`valueBoxHeight`) instead of inferred from the row's
     * total, and `textDelta` is untouched. The precedent is this file's own goal
     * arm, which took a bounded height the day it gained a second field and
     * says in its comment that it "is not a relaxed tolerance on the factor's
     * unchanged zero above". The factor arm's zero is now the value BOX's.
     *
     * ⚠⚠ AND THE MEASUREMENT THAT JUSTIFIES THE NUMBER, not an estimate.
     * #1401 first shipped these controls INSIDE grid track 3, which measures
     * **48.5px** at a 280px dock. Run 34386746547 read the result:
     *
     *     +177px @280   +138px @416      <- WIDTH-DEPENDENT: that is WRAPPING
     *
     * A DOM probe attributed it: 23px input box (correct) + 52px of buttons in
     * which "Review change" wrapped inside its own border + **117px of refusal
     * sentence**, 36 characters of prose in a 48.5px column. Moving that line
     * out to a `col-span-4` grid item of the row measures:
     *
     *     +49.5px @280  +49.5px @416     <- IDENTICAL: that is DISCLOSURE
     *
     * ⭐ The width-independence is the real signal and it is why one bound can
     * serve both arms: a fixed disclosure costs the same at every width, and a
     * paragraph in a narrow track does not. 280px is the harsher arm, so a
     * re-wrap blows this bound there by a factor of three.
     */
    const rowGap = 8      // the row's own `gap-2`, between its two grid lines
    const controls = 18   // buttonSmall 12px `leading-none` + py-0.5 (4) + border (2)
    const lineGap = 4     // the action line's own `gap-1`
    const refusal = 19.5  // panelBody 12px x `leading-relaxed` (1.625)
    /**
     * One control line and one sentence: 8 + 18 + 4 + 19.5 = 49.5px, and 49.5px
     * is exactly what the browser measured at BOTH dock widths. The +1 is
     * sub-pixel rounding headroom and nothing else.
     *
     * ⚠ IF THIS GOES RED, THE BOX HAS CHANGED — RE-DERIVE IT, DO NOT RAISE IT.
     * That is `valueCellMetrics.ts`'s standing instruction about its own
     * hand-maintained constant and it applies here for the same reason: a
     * tolerance raised to make a run green stops being a measurement of
     * anything.
     */
    const EDIT_DISCLOSURE_MAX_PX = rowGap + controls + lineGap + refusal + 1

    // ── THE #1179 CONTRACT, ASSERTED DIRECTLY AND UNRELAXED ──────────────────
    expect(b.valueBoxHeight, 'the idle value box is unreadable').toBeGreaterThan(0)
    expect(
      a.valueBoxHeight,
      `the value atom's own box changed from ${b.valueBoxHeight}px to ${a.valueBoxHeight}px — EDIT_RESERVED_HEIGHT_CLASS has regressed`,
    ).toBeCloseTo(b.valueBoxHeight, 1)
    // A reserved-height fix trades a row jump for a possible text jump. Both are
    // movement the user sees, so both are asserted.
    expect(Math.abs(textDelta), `entering edit moved the value itself by ${textDelta}px at a ${width}px dock`).toBeLessThanOrEqual(1)

    // ── THE #1401 CONTRACT: A BOUNDED DISCLOSURE, IN BOTH DIRECTIONS ─────────
    // ⚠ THE LOWER BOUND IS NOT DECORATION. Without it `<= 52` passes perfectly
    // on a build where the route forward has been deleted again — which is the
    // defect #1401 exists to close, and the cheapest way to make this arm green.
    // A height contract with no floor applauds the regression it was written
    // against (CLAUDE.md trap 22b: two opposite harms need two parameters).
    expect(
      heightDelta,
      `entering edit disclosed NOTHING at a ${width}px dock — the row's route forward is missing again`,
    ).toBeGreaterThan(0)
    expect(
      heightDelta,
      `entering edit changed the row's own height by ${heightDelta}px at a ${width}px dock (bound ${EDIT_DISCLOSURE_MAX_PX}px)`,
    ).toBeLessThanOrEqual(EDIT_DISCLOSURE_MAX_PX)
    // Everything the row gains is passed to its neighbour: equal deltas mean the
    // disclosure is laid out, not clipped inside a container that swallows it.
    expect(
      pushDelta,
      `the row grew ${heightDelta}px but moved the row below by ${pushDelta}px at a ${width}px dock — the growth is being clipped`,
    ).toBe(heightDelta)

    await input.press('Escape')
    await expect(input).toHaveCount(0)
    const goalButton = page.locator('[data-kind="goal"] button[data-testid^="model-row-v2-"][data-testid$="-value"]').first()
    await expect(goalButton, 'goal target is not editable: the new form must actually be measured').toBeVisible()
    const goalId = (await goalButton.getAttribute('data-testid'))!.replace(/^model-row-v2-/, '').replace(/-value$/, '')
    const goalBefore = await readGeometry(page, goalId)
    expect(goalBefore).not.toBeNull()
    await goalButton.click()
    const goalInput = page.getByTestId(`model-row-v2-${goalId}-value-input`)
    const unitInput = page.locator(`[data-testid="model-row-v2-${goalId}"] input[aria-label^="Target unit for"]`)
    await expect(goalInput).toBeVisible()
    await expect(goalInput).toBeFocused()
    await expect(unitInput).toBeVisible()
    const goalAfter = await readGeometry(page, goalId)
    expect(goalAfter).not.toBeNull()
    /*
     * Two accessible 14px fields + a short unit label are intentional. The
     * original paragraph-filled candidate measured216.38px and fails this;
     * this is not a relaxed tolerance on the factor's unchanged zero above.
     *
     * ⭐⭐ THE GOAL FORM'S OWN BUDGET IS UNCHANGED AT 88px. What is added is the
     * SAME disclosure line the factor arm bounds above, because the goal editor
     * has the same defect and gets the same fix — so the two bounds share one
     * constant and a change to the disclosure moves both together rather than
     * leaving one of them silently stale.
     *
     * ⚠⚠ AND THIS BREACH WAS HIDDEN, WHICH IS THE FINDING WORTH KEEPING. At
     * `4ab92e84` the factor assertion above aborted the test, so NOTHING from
     * here down ever executed: the gate was red for the factor row while the
     * goal row was ALSO over budget (129.63px against 88px) and no one could
     * see it. A test that stops at its first failure reports one defect and
     * conceals the rest of its own subject — worth remembering before reading a
     * single red as a single problem.
     */
    const GOAL_FORM_MAX_PX = 88
    expect(goalAfter!.valueFontPx).toBeCloseTo(14, 1)
    expect(goalAfter!.rowHeight).toBeGreaterThan(goalBefore!.rowHeight)
    expect(
      goalAfter!.rowHeight,
      `the goal target form measured ${goalAfter!.rowHeight}px at a ${width}px dock (form budget ${GOAL_FORM_MAX_PX}px + disclosure ${EDIT_DISCLOSURE_MAX_PX}px)`,
    ).toBeLessThanOrEqual(GOAL_FORM_MAX_PX + EDIT_DISCLOSURE_MAX_PX)
    const formBoxes = await page.locator(`[data-testid="model-row-v2-${goalId}"] input`).evaluateAll(inputs => {
      const outline = document.querySelector('[data-testid="model-outline-v2"]')!.getBoundingClientRect()
      return inputs.map(input => { const box = input.getBoundingClientRect(); return {
        width: box.width, left: box.left, right: box.right, outlineLeft: outline.left, outlineRight: outline.right,
        font: parseFloat(getComputedStyle(input).fontSize),
      } })
    })
    expect(formBoxes).toHaveLength(2)
    for (const box of formBoxes) {
      expect(box.width).toBeGreaterThanOrEqual(90)
      expect(box.font).toBeCloseTo(14, 1)
      expect(box.left).toBeGreaterThanOrEqual(box.outlineLeft)
      expect(box.right).toBeLessThanOrEqual(box.outlineRight + 1)
    }
    await goalInput.fill('120000')
    await unitInput.fill('£')
    await unitInput.press('Enter')
    const proposed = page.getByTestId(`model-row-v2-${goalId}-value-to`)
    await expect(proposed).toHaveText('At least 120000 £ (absolute level)')
    await expect(page.getByTestId(`model-row-v2-${goalId}-confirm`)).toBeVisible()
    const proposalFits = await proposed.evaluate(el => {
      const box = el.getBoundingClientRect()
      const outline = document.querySelector('[data-testid="model-outline-v2"]')!.getBoundingClientRect()
      return box.right <= outline.right + 1 && box.left >= outline.left
    })
    expect(proposalFits, 'minimum/absolute-level consent must fit before Confirm').toBe(true)
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ measure: 'modelGoalTargetForm', dockWidth: width, goalId,
      rowHeightBefore: goalBefore!.rowHeight, rowHeightAfter: goalAfter!.rowHeight, formBoxes, proposalFits }))
    await page.getByTestId(`model-row-v2-${goalId}-discard`).click()
    await expect(unitInput).toHaveCount(0)
  })
}
})
