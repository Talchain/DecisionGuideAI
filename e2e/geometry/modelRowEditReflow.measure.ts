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
  /**
   * ⭐ THE VALUE LINE'S HORIZONTAL BOX, AGAINST THE OUTLINE'S.
   *
   * ⚠ ADDED BECAUSE A HEIGHT-ONLY MEASURE CANNOT SEE A HORIZONTAL ESCAPE, and
   * one was sitting here unobserved: grid track 3 is 88px and the edit input is
   * `w-24` (96px) plus padding and border, so the editing value line is wider
   * than its own track BY CONSTRUCTION. Whether that escapes the panel is a
   * question nobody had asked. Reported by both arms so the answer is on the
   * record for the factor row too, not inferred from the relationship row.
   */
  readonly valueLeft: number
  readonly valueRight: number
  readonly outlineLeft: number
  readonly outlineRight: number
}

async function readGeometry(page: Page, rowId: string): Promise<Geom | null> {
  return page.evaluate((id) => {
    const row = document.querySelector(`[data-testid="model-row-v2-${id}"]`)
    if (!(row instanceof HTMLElement)) return null
    const outline = document.querySelector('[data-testid="model-outline-v2"]')
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
      valueLeft: value instanceof HTMLElement
        ? Math.round(value.getBoundingClientRect().left * 100) / 100
        : -1,
      valueRight: value instanceof HTMLElement
        ? Math.round(value.getBoundingClientRect().right * 100) / 100
        : -1,
      outlineLeft: outline instanceof HTMLElement
        ? Math.round(outline.getBoundingClientRect().left * 100) / 100
        : -1,
      outlineRight: outline instanceof HTMLElement
        ? Math.round(outline.getBoundingClientRect().right * 100) / 100
        : -1,
    }
  }, rowId)
}

/**
 * ⭐ THE QUICK-SET BAND PILLS' OWN GEOMETRY — and the one question a row height
 * cannot answer.
 *
 * `distinctTops` is the number of distinct y-positions the three pills occupy.
 * `flex-wrap` in a column too narrow for them stacks them, and THREE pills on
 * THREE lines is the defect: Paul ruled this affordance "really simple, quick,
 * and easy clickable", and a vertical stack of three nearly-full-width chips is
 * not that.
 *
 * `textLineRects` is the count of client rects of each button's OWN text
 * content — 1 is one line, >= 2 means the label wrapped INSIDE its own border.
 * That is a DIFFERENT defect from the row growing, and the two must be read
 * apart: #1401's "Review change" wrapped inside its ring at 52px while the row
 * also grew, and a height-only assertion cannot tell which of the two it is
 * measuring.
 */
async function readBands(page: Page, rowId: string) {
  return page.evaluate((id) => {
    const bands = document.querySelector(`[data-testid="model-row-v2-${id}-value-bands"]`)
    if (!(bands instanceof HTMLElement)) return null
    const outline = document.querySelector('[data-testid="model-outline-v2"]')
    if (!(outline instanceof HTMLElement)) return null
    const r = (n: number) => Math.round(n * 100) / 100
    const outlineBox = outline.getBoundingClientRect()
    const buttons = Array.from(bands.querySelectorAll('button'))
    return {
      containerHeight: r(bands.getBoundingClientRect().height),
      containerWidth: r(bands.getBoundingClientRect().width),
      /**
       * ⭐ THE WHOLE FULL-WIDTH LINE'S HEIGHT, which is what the bound is spent
       * on — the pills' own container is only part of it, and the readback beside
       * them is the taller atom.
       */
      bandLineHeight: (() => {
        const line = document.querySelector(`[data-testid="model-row-v2-${id}-band-line"]`)
        return line instanceof HTMLElement ? r(line.getBoundingClientRect().height) : -1
      })(),
      bandLineWidth: (() => {
        const line = document.querySelector(`[data-testid="model-row-v2-${id}-band-line"]`)
        return line instanceof HTMLElement ? r(line.getBoundingClientRect().width) : -1
      })(),
      /** Distinct y-positions of the pills. 1 = one line; 3 = stacked. */
      distinctTops: [...new Set(buttons.map((b) => Math.round(b.getBoundingClientRect().top)))].length,
      /**
       * ⭐ THE STRUCTURAL DISCRIMINATOR, AND THE ONE A FUTURE EDIT WOULD HAVE TO
       * UNDO. `col-span-4` only spans the row's tracks on a DIRECT child of the
       * row's grid container; a block nested one level deeper adopts its
       * parent's box however many classes it carries. So the question is
       * parentage, not class membership — which is also why the vitest
       * companion spec can pin this and cannot pin the pixels.
       */
      isRowGridItem: (() => {
        const line = document.querySelector(`[data-testid="model-row-v2-${id}-band-line"]`)
        const rowEl = document.querySelector(`[data-testid="model-row-v2-${id}"]`)
        // ⚠ THE LINE's parentage, not the pills' — the pills are nested INSIDE
        // the line by design, and asking the wrong element would make this read
        // false on a correct build and true on nothing.
        return line !== null && rowEl !== null && line.parentElement === rowEl && line.contains(bands)
      })(),
      outlineLeft: r(outlineBox.left),
      outlineRight: r(outlineBox.right),
      /**
       * ⚠ THE INPUT LINE'S OWN HORIZONTAL BOX. Grid track 3 is 88px; the edit
       * input is `w-24` (96px) plus border and padding, and the band readback
       * sits beside it with `ml-2 whitespace-nowrap`. So this line is WIDER than
       * its own track by construction, and whether that escapes the outline is a
       * separate question from the row's height — measured, not assumed.
       */
      valueLine: (() => {
        const v = document.querySelector(`[data-testid="model-row-v2-${id}-value"]`)
        if (!(v instanceof HTMLElement)) return null
        const box = v.getBoundingClientRect()
        return { left: r(box.left), right: r(box.right), width: r(box.width) }
      })(),
      readback: (() => {
        const rb = document.querySelector(`[data-testid="model-row-v2-${id}-value-band-readback"]`)
        if (!(rb instanceof HTMLElement)) return null
        const box = rb.getBoundingClientRect()
        return { left: r(box.left), right: r(box.right), width: r(box.width), text: (rb.textContent ?? '').trim() }
      })(),
      buttons: buttons.map((b) => {
        const box = b.getBoundingClientRect()
        const range = document.createRange()
        range.selectNodeContents(b)
        return {
          testid: b.getAttribute('data-testid') ?? '',
          label: (b.textContent ?? '').trim(),
          width: r(box.width),
          height: r(box.height),
          left: r(box.left),
          right: r(box.right),
          /** 1 = the label holds one line inside its own ring. */
          textLineRects: range.getClientRects().length,
          /**
           * ⭐⭐ THE HARM A LINE COUNT CANNOT SEE FOR A SINGLE-WORD LABEL, and the
           * reason this field exists: "Moderate" has NO soft break opportunity, so
           * a box too narrow for it does not wrap — it OVERFLOWS. Demonstrated:
           * `max-w-[24px]` on every pill left `textLineRects` at 1 on all three
           * and the arm stayed GREEN. `scrollWidth - clientWidth` is what moves.
           */
          overflowX: Math.max(0, b.scrollWidth - b.clientWidth),
          lineHeightPx: parseFloat(getComputedStyle(b).lineHeight) || -1,
          fontPx: parseFloat(getComputedStyle(b).fontSize),
        }
      }),
    }
  }, rowId)
}

/**
 * ⭐⭐ THE DISCLOSURE'S OWN PARTS, READ SEPARATELY — because the row's TOTAL
 * cannot tell the two defects apart, and they need opposite repairs.
 *
 * #1401 shipped the route forward INSIDE grid track 3 (`fit-content(5.5rem)`,
 * measured at 48.5px at the dock floor). 36 characters of prose in a 48.5px
 * column became six line boxes and a 213px row. #1410 moved it to a
 * `col-span-4` full-width line.
 *
 * A wrap in a 48px track and a wrap at the end of a 220px line are BOTH
 * "heightDelta went up", and the row total says which only by how much. These
 * are the numbers that say which:
 *
 *   refusalWidth ≈ 48px    -> the sentence is still in a narrow track: LAYOUT
 *   refusalWidth ≈ rowWidth -> the sentence has the row: ordinary TEXT REFLOW
 *
 * and `refusalMaxContentWidth` vs `rowContentWidth` says whether reflow was
 * inevitable at this width on this platform's metrics, rather than leaving that
 * to be inferred from a line count. ⚠ THE REFERENCE IS THE **ROW's** WIDTH, NOT
 * THE ACTION LINE's — the action line is the thing that was in the narrow track,
 * so its own width shrank with the defect and a comparison against it would have
 * agreed with what it was supposed to catch.
 *
 * ⚠ LINE COUNT IS `height / lineHeight`, NOT `getClientRects().length`. The
 * refusal is a flex item, so it is BLOCKIFIED and its own `getClientRects()`
 * returns ONE rect for the whole box however many lines it holds — a line-count
 * probe built on it reads 1 forever and would certify any wrap. A `Range` over
 * the text content is captured too, as a second reading that must agree.
 */
interface Disclosure {
  readonly actionsPresent: boolean
  readonly actionsWidth: number
  readonly actionsHeight: number
  /** The control line's own box — a button that wraps inside its border shows up here, not in the total. */
  readonly controlsHeight: number
  readonly controlsWidth: number
  readonly refusalPresent: boolean
  readonly refusalText: string
  readonly refusalHeight: number
  readonly refusalWidth: number
  readonly refusalLineHeightPx: number
  readonly refusalLines: number
  readonly refusalRangeRects: number
  /** The sentence's single-line width on THIS platform's metrics. */
  readonly refusalMaxContentWidth: number
  /** Break opportunities in the rendered string. Zero means it can only OVERFLOW, never wrap. */
  readonly refusalBreakOpportunities: number
  /** px past the outline's right edge. > 0 is overflow, which is a different defect from a wrap. */
  readonly refusalOverflowRightPx: number
  readonly refusalInsideValueCell: boolean
  readonly rowContentWidth: number
  readonly fontFamily: string
}

async function readDisclosure(page: Page, rowId: string): Promise<Disclosure> {
  return page.evaluate((id) => {
    const row = document.querySelector(`[data-testid="model-row-v2-${id}"]`)
    const actions = document.querySelector(`[data-testid="model-row-v2-${id}-edit-actions"]`)
    const refusal = document.querySelector(`[data-testid="model-row-v2-${id}-value-blocked"]`)
    const review = document.querySelector(`[data-testid="model-row-v2-${id}-review"]`)
    const valueCell = document.querySelector(`[data-testid="model-row-v2-${id}-value"]`)
    const outline = document.querySelector('[data-testid="model-outline-v2"]')
    const r2 = (n: number) => Math.round(n * 100) / 100

    // The control LINE is the review button's flex parent, not the button.
    const controls = review instanceof HTMLElement ? review.parentElement : null

    let maxContent = -1
    let rangeRects = -1
    let lineHeight = -1
    if (refusal instanceof HTMLElement) {
      lineHeight = parseFloat(getComputedStyle(refusal).lineHeight)
      const probe = refusal.cloneNode(true) as HTMLElement
      probe.style.position = 'absolute'
      probe.style.left = '-99999px'
      probe.style.top = '0'
      probe.style.width = 'max-content'
      probe.style.maxWidth = 'none'
      probe.style.whiteSpace = 'nowrap'
      probe.style.visibility = 'hidden'
      refusal.parentElement?.appendChild(probe)
      maxContent = r2(probe.getBoundingClientRect().width)
      probe.remove()
      const range = document.createRange()
      range.selectNodeContents(refusal)
      rangeRects = range.getClientRects().length
    }

    const refusalText = refusal instanceof HTMLElement ? (refusal.textContent ?? '') : ''
    const refusalBox = refusal instanceof HTMLElement ? refusal.getBoundingClientRect() : null
    const outlineBox = outline instanceof HTMLElement ? outline.getBoundingClientRect() : null

    return {
      actionsPresent: actions instanceof HTMLElement,
      actionsWidth: actions instanceof HTMLElement ? r2(actions.getBoundingClientRect().width) : -1,
      actionsHeight: actions instanceof HTMLElement ? r2(actions.getBoundingClientRect().height) : -1,
      controlsHeight: controls instanceof HTMLElement ? r2(controls.getBoundingClientRect().height) : -1,
      controlsWidth: controls instanceof HTMLElement ? r2(controls.getBoundingClientRect().width) : -1,
      refusalPresent: refusal instanceof HTMLElement,
      refusalText,
      refusalHeight: refusalBox ? r2(refusalBox.height) : -1,
      refusalWidth: refusalBox ? r2(refusalBox.width) : -1,
      refusalLineHeightPx: lineHeight,
      refusalLines: refusalBox && lineHeight > 0 ? Math.round(refusalBox.height / lineHeight) : -1,
      refusalRangeRects: rangeRects,
      refusalMaxContentWidth: maxContent,
      // The product's own string, not a fixture's: count the places it may break.
      refusalBreakOpportunities: (refusalText.match(/[-\s]/g) ?? []).length,
      refusalOverflowRightPx:
        refusalBox && outlineBox ? r2(refusalBox.right - outlineBox.right) : -1,
      refusalInsideValueCell:
        valueCell instanceof HTMLElement && refusal instanceof HTMLElement
          ? valueCell.contains(refusal)
          : false,
      rowContentWidth:
        row instanceof HTMLElement
          ? r2(row.clientWidth -
              parseFloat(getComputedStyle(row).paddingLeft) -
              parseFloat(getComputedStyle(row).paddingRight))
          : -1,
      fontFamily: refusal instanceof HTMLElement ? getComputedStyle(refusal).fontFamily : '',
    }
  }, rowId)
}

/*
 * ⭐⭐ THE DISCLOSURE BOX, DERIVED ONCE AND SHARED BY EVERY ARM IN THIS FILE.
 *
 * ⚠ HOISTED TO MODULE SCOPE, NOT COPIED. These were local to the factor arm; a
 * second arm needing the same box would have had to restate them, and a second
 * copy of a hand-maintained constant is the defect `valueCellMetrics.ts` already
 * records about itself (CLAUDE.md trap 12). One derivation, three readers.
 *
 * ⚠⚠ AND THE MEASUREMENT THAT JUSTIFIES THE NUMBER, not an estimate.
 * #1401 first shipped these controls INSIDE grid track 3, which measures
 * **48.5px** at a 280px dock. Run 34386746547 read the result:
 *
 *     +177px @280   +138px @416      <- WIDTH-DEPENDENT
 *
 * A DOM probe attributed it: 23px input box (correct) + 52px of buttons in
 * which "Review change" wrapped inside its own border + **117px of refusal
 * sentence**, 36 characters of prose in a 48.5px column. Moving that line
 * out to a `col-span-4` grid item of the row measures:
 *
 *     +49.5px @280  +49.5px @416     <- IDENTICAL
 */
const ROW_GAP = 8 // the row's own `gap-2`, between its grid lines
const CONTROLS = 18 // buttonSmall 12px `leading-none` + py-0.5 (4) + border (2)
const LINE_GAP = 4 // the action line's own `gap-1`
const REFUSAL = 19.5 // panelBody 12px x `leading-relaxed` (1.625)

/**
 * One control line and `refusalLines` sentence lines. The +1 is sub-pixel
 * rounding headroom and nothing else.
 *
 * ⭐⭐ AND THE SENTENCE'S LINE COUNT IS PER WIDTH — #1410's ubuntu re-derivation,
 * HOISTED WITH THE BOX RATHER THAN LEFT LOCAL TO ONE ARM. `49.5 at both widths`
 * is a **darwin** reading. On `ubuntu-latest`, the platform this gate runs on,
 * the same two arms read `+69px @280 / +49.5px @416` (job 102661748098,
 * `heightDelta`): 69 - 49.5 = 19.5 = EXACTLY ONE MORE `REFUSAL` LINE. `Enter a
 * number to review this change` needs 227.08px on ubuntu's system face against
 * 210.31px on darwin's, and the row offers 220px at a 280px dock — so it takes
 * TWO line boxes there and ONE at 416. Attributed at the bytes by
 * `readDisclosure`, not inferred from the total.
 *
 * ⚠ SO THE BOX IS A FUNCTION OF WIDTH, NOT A CONSTANT — which is why this is a
 * function. A module-scope number cannot express a quantity that differs per
 * dock, and the relationship arm needs the SAME box the factor arm uses: a
 * second copy of it would be the hand-maintained mirror the hoist above exists
 * to prevent (CLAUDE.md trap 12). One derivation, three readers; each reader
 * passes its own width's line budget in.
 *
 * ⚠ IF THIS GOES RED, THE BOX HAS CHANGED — RE-DERIVE IT, DO NOT RAISE IT.
 * That is `valueCellMetrics.ts`'s standing instruction about its own
 * hand-maintained constant and it applies here for the same reason: a
 * tolerance raised to make a run green stops being a measurement of
 * anything.
 */
const REFUSAL_LINES_MAX: Record<number, number> = { 280: 2, 416: 1 }
function editDisclosureMaxPx(refusalLines: number): number {
  return ROW_GAP + CONTROLS + LINE_GAP + REFUSAL * refusalLines + 1
}

/**
 * ⭐ THE BAND LINE'S OWN HEIGHT, derived the same way and added to the same box.
 *
 * The line holds the readback and the three pills:
 *
 *   pill     `typography.buttonSmall` 12px `leading-none` + `px-1.5` + a 1px
 *            border and NO vertical padding -> 12 + 1 + 1 = **14px**
 *            (measured at every width, on darwin AND ubuntu)
 *   readback `typography.panelMeta` = `text-[11px] leading-snug`
 *            -> 11 x 1.375 = **15.125px**
 *
 * ⚠⚠ AND IT IS **TWO LINES AT THE DOCK FLOOR ON ubuntu**, which the first version
 * of this constant got wrong: it assumed ONE line of 15.13px, and the arm PASSED
 * FOR THE WRONG REASON — the unspent refusal allowance in the shared box above
 * happened to cover the extra line, so a relationship draft that DID refuse would
 * have gone ~21px over. MEASURED, darwin vs ubuntu, same commit:
 *
 *            bandLineHeight @280   bandLineHeight @416
 *   darwin           15.13                15.13
 *   ubuntu         **37.13**              15.13
 *
 * ubuntu's font metrics are wider (pills 51.03/78.81/59.69 against darwin's
 * 46.3/70.47/53.83), so readback 28.88 + `gap-2` 8 + pills 197.53 = **234.41px**
 * against the 220px the line gets at a 280px dock, and `flex-wrap` puts the
 * readback on its own line: 15.13 + 8 + 14 = **37.13px**, exactly as measured.
 *
 * ⭐ THAT WRAP IS GRACEFUL AND IS NOT THE DEFECT. The defect was three pills
 * stacked THREE deep inside an 80px column with the readback rendering off-panel.
 * The pills still share ONE line on ubuntu at both widths (`distinctTops: 1`,
 * measured) and nothing escapes the outline. One line for the whole block is not
 * reachable at 280px without shrinking the controls — the deficit is 14.41px and
 * the only ways to find it are smaller padding or a smaller chip — and shrinking
 * the controls is the one repair this lane is forbidden.
 *
 * ⚠ SO THE BUDGET IS DERIVED FROM THE TWO-LINE CASE, AND THE CONSEQUENCE IS
 * STATED RATHER THAN HIDDEN: at 95.63px this ceiling NO LONGER DISCRIMINATES the
 * original +80px defect. `distinctTops === 1` does, and so does the band line's
 * own height, asserted tightly at the site. A ceiling wide enough to fund the
 * honest worst case is not the load-bearing guard here, and saying otherwise is
 * how a bound that passes for the wrong reason survives a second time.
 *
 * ⚠ THE FACTOR ARM'S 50.5 IS UNTOUCHED. It is the shared box; this adds to it.
 */
const READBACK_LINE = 15.13 // panelMeta 11px x leading-snug 1.375
const BAND_CHIP = 14 // buttonSmall 12px leading-none + 1px border x2
/** The honest worst case: the readback wrapped above one row of pills. */
const BAND_LINE_MAX = READBACK_LINE + ROW_GAP + BAND_CHIP
/**
 * ⚠ PER WIDTH, FOR THE SAME REASON THE BOX IT ADDS TO IS: the refusal allowance
 * inside `editDisclosureMaxPx` is ONE line at 416 and TWO at 280 on ubuntu
 * (#1410's re-derivation). The band line's own worst case is the same at both.
 */
function relationshipDisclosureMaxPx(refusalLines: number): number {
  return editDisclosureMaxPx(refusalLines) + ROW_GAP + BAND_LINE_MAX
}

/**
 * Mount the Model tab with the dock pinned to `width`, every group open, and
 * the page quiescent. Returns the dock width the browser actually resolved.
 *
 * ⚠ EXTRACTED, NOT COPIED, when the relationship arms were added. Forty lines
 * of seeding restated in a second arm is a hand-maintained mirror of the
 * harness, and the first fix to the mounting sequence would have silently
 * reached only one of the two arms.
 */
async function mountModelTab(page: Page, width: number): Promise<number> {
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
  return dockW
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
    const dockW = await mountModelTab(page, width)

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
    const disc = await readDisclosure(page, rowId as string)

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
      valueLeftAfter: a.valueLeft, valueRightAfter: a.valueRight,
      outlineLeft: a.outlineLeft, outlineRight: a.outlineRight,
      valueOverflowRightPx: Math.round((a.valueRight - a.outlineRight) * 100) / 100,
    }))
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ measure: 'modelRowEditDisclosure', dockWidth: width, rowId, platform: process.platform, ...disc }))

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
     *
     * ⚠⚠ "WIDTH-INDEPENDENT THEREFORE NOT WRAPPING" WAS WRITTEN HERE AND IS
     * REFUTED — MEASURED AT `9574b5c4` ON THE RELATIONSHIP ROW BELOW. Its three
     * quick-set pills wrap onto THREE lines and the cost is +80.0px at 280 AND
     * at 416 — identical, and unmistakably wrapping (`distinctTops: 3`,
     * measured). The reason is that track 3 is `fit-content(5.5rem)`, which
     * resolves to **88px at both widths** (templates measured:
     * `22.875px 113.125px 88px 12px` @280, `22.875px 249.125px 88px 12px` @416
     * — only track 2 moves). Wrapping inside a track whose width does not
     * follow the dock costs the same at every dock.
     *
     * ⭐ SO WIDTH-INDEPENDENCE IS NOT EVIDENCE OF DISCLOSURE. What it separates
     * is "wrapping against a width that moves with the dock" from everything
     * else, and "everything else" contains a wrapping defect. The honest
     * discriminator is to measure the WRAP DIRECTLY — which is what
     * `readBands().distinctTops` does for the relationship arms, and why that
     * assertion is not redundant beside their height bound. The original
     * sentence is left refuted rather than deleted: it is the inference that
     * would otherwise be drawn again from the factor arm's own 49.5/49.5.
     *
     * ⭐⭐⭐ CORRECTED, AND THE CORRECTION IS THE POINT: **THE BOUND ABOVE WAS
     * DERIVED ON DARWIN AND THIS GATE RUNS ON UBUNTU.** The three paragraphs
     * above say `+49.5px @280 +49.5px @416 <- IDENTICAL: that is DISCLOSURE`.
     * That pair of numbers is a **darwin** reading. On `ubuntu-latest`, at this
     * PR's own head `9574b5c4`, the same two arms read:
     *
     *     +69px @280    +49.5px @416     (job 102661748098, `heightDelta`)
     *
     * 69 - 49.5 = 19.5 = EXACTLY ONE MORE `refusal` LINE, and the @416 arm is
     * identical to darwin's to the decimal. So ubuntu's metrics change nothing
     * about the disclosure's COST; they change only whether the refusal SENTENCE
     * fits on one line at the 280px dock floor. Attributed at the bytes by
     * `readDisclosure` rather than inferred from the total.
     *
     * ⚠⚠ SO THE `width-independence` SENTENCE ABOVE IS TRUE OF THE CONTROL LINE
     * AND FALSE OF THE SENTENCE. A fixed disclosure does cost the same at every
     * width — but `Enter a number to review this change` is 36 characters of
     * PROSE, and prose reflows when the line runs out. The #1410 fix gave it the
     * whole row; it did not, and could not, make it unwrappable.
     *
     * ⭐ THE TWO DEFECTS ARE NAMED APART HERE, because they need opposite repairs
     * (CLAUDE.md trap 21):
     *
     *   the sentence is crushed into grid track 3 (48.5px)  -> LAYOUT defect
     *   the sentence fills the row and runs to a 2nd line   -> ordinary REFLOW
     *
     * `heightDelta` alone cannot tell them apart — both read "bigger". The
     * structural assertions below can, and they are what keeps this bound from
     * being a raised tolerance: the track-3 defect is now caught BY NAME, on the
     * refusal element's own WIDTH, at every dock width and on every platform,
     * instead of being inferred from a pixel total that a font change can move.
     *
     * ⚠ THIS IS NOT "RAISE IT UNTIL IT IS GREEN" — `valueCellMetrics.ts`'s
     * instruction is RE-DERIVE, and the re-derivation is per width because the
     * quantity being bounded is per width: one control line plus however many
     * line boxes a sentence of this length takes in the room that dock leaves.
     * Derived on ubuntu, the platform that decides this check:
     *
     *     @280  room 220px, sentence needs 227.08px -> 2 lines -> 8+18+4+39+1 = 70
     *     @416  room 356px, sentence needs 227.08px -> 1 line  -> 8+18+4+19.5+1 = 50.5
     *
     * ⭐ THE WHOLE DIVERGENCE IS THOSE TWO NUMBERS, and it is 7.08px wide. Measured
     * at `readDisclosure` on both platforms, same commit, same fixture, same row:
     *
     *                          darwin      ubuntu-latest
     *   sentence max-content   210.31px    227.08px      <- 8% wider face
     *   room at a 280px dock   220px       220px
     *   line boxes @280        1           2
     *   line boxes @416        1           1
     *
     * Inter is declared first in both stacks and is installed on NEITHER runner's
     * Chromium here, so each falls through to its own system face. darwin's fits
     * 220px with 9.69px to spare; ubuntu's misses it by 7.08px. A bound derived on
     * the Mac therefore passes locally and REDs in CI, which is exactly what
     * happened — and why both bounds below admit the WIDER platform. @416 is
     * UNCHANGED at 50.5.
     *
     * ⚠ AND IT STILL BITES. The #1401 regression was 117px of refusal in track 3
     * (six line boxes) with a 52px wrapped control line: 8 + 52 + 4 + 117 = 181px
     * against a 70px bound, and the width-assertion below REDs on it first, by
     * name. A third refusal line (89.5px) also exceeds 70.
     *
     * ⚠ AND #1415 ADDS NOTHING TO THIS BOX. The relationship arm takes the box
     * WHOLE and adds its own measured band line on top (`BAND_LINE_MAX`,
     * `relationshipDisclosureMaxPx`); the factor arm's budget is whatever this
     * derivation says at each width and nothing in the relationship lane moves
     * it. ⚠ The sentence this replaced said "unchanged and still 49.5 at both" —
     * true when it was written against `9574b5c4`, and FALSE once the line count
     * was re-derived on ubuntu. A number restated in a second place went stale in
     * one rebase; the claim is now about the DERIVATION, which cannot.
     */
    const refusalLinesMax = REFUSAL_LINES_MAX[width]
    expect(refusalLinesMax, `no refusal line budget is derived for a ${width}px dock`).toBeGreaterThan(0)
    const EDIT_DISCLOSURE_MAX_PX = editDisclosureMaxPx(refusalLinesMax)

    /*
     * ── THE DISCLOSURE'S PRECONDITIONS, ASSERTED BEFORE ITS BUDGET ────────────
     *
     * ⚠⚠ A HEIGHT BOUND ON A DISCLOSURE THAT RENDERED NO REFUSAL PASSES FOR THE
     * WRONG REASON, and a sibling lane has already been caught by exactly that:
     * its arm went green because the draft it measured had no refusal at all, so
     * the sentence whose line count the bound is about was not on screen. The
     * factor row seeds its draft from `resolveValueInputSeed`, which is
     * `undefined` for this fixture's factors — `draft: ''`, `parseFloat('')` is
     * NaN, so `unproposableDraftReason` returns a sentence. That is the case this
     * arm measures, and it is asserted, not assumed.
     */
    expect(disc.actionsPresent, 'the edit action line did not render — there is no disclosure to bound').toBe(true)
    expect(disc.refusalPresent, 'no refusal rendered: this arm would bound a one-line disclosure and call it two').toBe(true)
    expect(disc.refusalText.trim().length, 'the refusal element is empty — its line count is about nothing').toBeGreaterThan(0)
    /*
     * ⚠ AN ASSERTION ABOUT WRAPPING IS WORTHLESS AGAINST A STRING THAT CANNOT
     * WRAP. A sibling lane measured `max-w-[24px]` on a single-word label and
     * read ONE line: "Moderate" has no break opportunity, so it OVERFLOWS rather
     * than wrapping. Check the product's real string can do the thing being
     * bounded.
     */
    expect(
      disc.refusalBreakOpportunities,
      `the refusal "${disc.refusalText}" has no break opportunity — it can only overflow, so a line-count bound on it proves nothing`,
    ).toBeGreaterThan(0)

    /*
     * ── THE #1410 CONTRACT: THE SENTENCE HAS THE ROW, NOT A 48px TRACK ────────
     *
     * ⭐ THIS, NOT THE PIXEL TOTAL, IS THE GUARD ON #1410's ACTUAL SUBJECT. The
     * refusal must be given every pixel the row could give it: its own
     * max-content width if that fits, or the row's whole content width if it
     * does not. In track 3 it measured 48.5px while the row offered ~220px, so
     * this REDs on the original defect at any width and on any platform.
     *
     * ⚠ THE COMPARISON IS AGAINST THE **ROW's** CONTENT WIDTH, NOT THE ACTION
     * LINE's. The action line is the thing that was in the narrow track, so its
     * own width shrank with it — a bound against it would have agreed with the
     * defect (CLAUDE.md trap 13b: a guard whose reference moves with the thing it
     * is guarding).
     */
    expect(disc.rowContentWidth, 'the row content width is unreadable').toBeGreaterThan(0)
    expect(disc.refusalMaxContentWidth, "the refusal's single-line width is unreadable").toBeGreaterThan(0)
    expect(disc.refusalInsideValueCell, 'the refusal is back inside the value cell — grid track 3 is ~48px wide').toBe(false)
    const roomTheRowCouldGive = Math.min(disc.refusalMaxContentWidth, disc.rowContentWidth)
    expect(
      disc.refusalWidth,
      `the refusal got ${disc.refusalWidth}px while the row could give it ${roomTheRowCouldGive}px ` +
        `(sentence needs ${disc.refusalMaxContentWidth}px, row content ${disc.rowContentWidth}px) — it is in a narrow column again`,
    ).toBeGreaterThanOrEqual(roomTheRowCouldGive - 1)
    // A wrap and an OVERFLOW are different defects; `min-w-0` is what makes this
    // one a wrap, and without this assertion its removal would read as fine.
    expect(
      disc.refusalOverflowRightPx,
      `the refusal runs ${disc.refusalOverflowRightPx}px past the outline's right edge at a ${width}px dock`,
    ).toBeLessThanOrEqual(1)

    // The control line is ONE line. #1401's 52px came from "Review change"
    // wrapping INSIDE its own border; `whitespace-nowrap` is what stops it, and
    // a total-only bound would absorb its return silently.
    expect(
      disc.controlsHeight,
      `the control line measured ${disc.controlsHeight}px at a ${width}px dock — a button is wrapping inside its own border`,
    ).toBeLessThanOrEqual(CONTROLS + 1)

    // And the line count the budget above is built from — asserted against the
    // STATED per-width maximum, never read and accepted. Two independent
    // readings: the box's own height, and a Range over its text.
    expect(
      disc.refusalLines,
      `the refusal took ${disc.refusalLines} line(s) at a ${width}px dock (budget ${refusalLinesMax}); ` +
        `it needs ${disc.refusalMaxContentWidth}px and the row offers ${disc.rowContentWidth}px`,
    ).toBeLessThanOrEqual(refusalLinesMax)
    expect(
      disc.refusalRangeRects,
      `the refusal's text occupied ${disc.refusalRangeRects} line box(es) at a ${width}px dock (budget ${refusalLinesMax})`,
    ).toBeLessThanOrEqual(refusalLinesMax)

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
     * ⚠ THE GOAL ARM HAS NEVER RUN AT A 280px DOCK ON UBUNTU. The factor
     * assertion above aborted the test at `4ab92e84` and again at `9574b5c4`, so
     * everything from here down executed at 416px only — the concealment this
     * file's own comment below records. Its disclosure is logged for the same
     * attribution reason as the factor's: if this arm reds, the numbers that say
     * WHY are already in the log rather than a cycle away.
     */
    const goalDisc = await readDisclosure(page, goalId)
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ measure: 'modelGoalEditDisclosure', dockWidth: width, goalId, ...goalDisc }))
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

  /**
   * ⭐⭐ THE RELATIONSHIP ROW'S QUICK-SET BANDS — THE THIRD EDITOR, AND THE ONE
   * NO ARM OF THIS GATE COULD SEE.
   *
   * ⚠ A SEPARATE TEST, NOT A THIRD SECTION OF THE ARM ABOVE, AND THAT IS
   * DELIBERATE. This file already records the cost of the alternative: at
   * `4ab92e84` the factor assertion aborted the test, so the goal breach
   * (129.63px against 88px) sat in the same run completely invisible. Three
   * editors under one `test()` means the first red conceals the other two. The
   * relationship editor is its own subject and gets its own arm.
   *
   * ⚠⚠ AND THE BLINDNESS WAS NAMED IN THE PRODUCT SOURCE BEFORE IT WAS CLOSED
   * HERE. `ModelRowView.tsx` says of this measure: "it takes `buttons[0]`, and
   * four node groups render before `relationships` — so it measured a row where
   * this control never appears, and asserts height only." That was exactly true:
   * derived at `9574b5c4`, `relationship` appears in **0 files** under
   * `e2e/geometry/` while the contrast control `factor` appears in 12, so the
   * absence was real and not a blind probe.
   *
   * MEASURED AT `9574b5c4`, BEFORE THE FIX (row `e-4`, 19 editable
   * relationship rows in this fixture):
   *
   *     +80.0px @280   +80.0px @416     distinctTops: 3   bands container 80px
   *
   * against the factor arm's 50.5px bound — a 29.5px breach, and 54px of the 80
   * is three 14px pills stacked onto three lines inside an 80px-wide container
   * because three pills at 46.3 + 70.47 + 53.83 + two 4px gaps need 178.6px.
   * No pill's label wrapped inside its own ring (`textLineRects: 1` on all
   * three) — that is a DIFFERENT defect from this one and is asserted apart
   * below, because a height bound alone cannot tell them from each other.
   */
  test(`MODEL RELATIONSHIP BAND REFLOW @dock ${width}px`, { tag: GATE_TAG }, async ({ page }) => {
    const dockW = await mountModelTab(page, width)

    /*
     * ⚠ THE BOUND IS DERIVED PER WIDTH, FROM THE SHARED BOX — not restated here.
     * #1410 re-derived the refusal allowance inside that box on ubuntu (two
     * sentence lines at a 280px dock, one at 416); this arm adds its own measured
     * band line on top of whatever the box says at this width. A second copy of
     * the box expression is exactly the hand-maintained mirror the module-scope
     * hoist exists to prevent (CLAUDE.md trap 12).
     *
     * ⚠⚠ AND THE CONSEQUENCE, STATED RATHER THAN LEFT TO BE DISCOVERED: taking the
     * box per width WIDENS this ceiling at the dock floor.
     *
     *            @280      @416
     *   before   95.63     95.63     (one refusal line, derived on darwin)
     *   now     115.13     95.63     (#1410's ubuntu count: two lines at 280)
     *
     * That is the RIGHT allowance, not a relaxation: if a relationship draft ever
     * does refuse it refuses with the SAME sentence, which takes two line boxes at
     * a 280px dock on ubuntu's metrics — so the one-line version would have gone
     * over for the very case the allowance exists to fund. But it is a ceiling
     * moving upward, and this file has already recorded once that this ceiling is
     * NOT the load-bearing guard for this lane. The guards that bite the original
     * +80px defect are `distinctTops === 1` and the band line's own height against
     * `BAND_LINE_MAX + 1` (38.13px) — both asserted below, both unchanged by this,
     * and neither of them funded by a refusal allowance.
     */
    const refusalLinesMax = REFUSAL_LINES_MAX[width]
    expect(refusalLinesMax, `no refusal line budget is derived for a ${width}px dock`).toBeGreaterThan(0)
    const RELATIONSHIP_DISCLOSURE_MAX_PX = relationshipDisclosureMaxPx(refusalLinesMax)

    const rowId = await page.evaluate(() => {
      const first = document.querySelector('[data-kind="relationship"] button[data-testid^="model-row-v2-"][data-testid$="-value"]')
      if (!(first instanceof HTMLElement)) return null
      return (first.getAttribute('data-testid') ?? '').replace(/^model-row-v2-/, '').replace(/-value$/, '')
    })
    expect(rowId, 'no EDITABLE relationship row found — the measure would assert about nothing').not.toBeNull()

    await page.getByTestId(`model-row-v2-${rowId}-value`).scrollIntoViewIfNeeded()
    await waitForVisualQuiescence(page)
    const before = await readGeometry(page, rowId as string)
    expect(before, 'row geometry unreadable before edit').not.toBeNull()
    expect(before!.nextRowTop, 'the relationship and its neighbour must be in view before measuring movement').toBeGreaterThan(0)

    await page.click(`[data-testid="model-row-v2-${rowId}-value"]`)

    // ── POSITIVE CONTROL ──────────────────────────────────────────────────
    // Prove the edit HAPPENED before asserting anything about the layout. An
    // absence probe that never entered edit mode reports a perfectly still
    // layout for the excellent reason that nothing changed (trap 13).
    const input = page.locator(`[data-testid="model-row-v2-${rowId}-value-input"]`)
    await expect(input, 'the click did not open an editor — a still layout here would prove nothing').toBeVisible({ timeout: 10_000 })
    await waitForVisualQuiescence(page)

    const after = await readGeometry(page, rowId as string)
    expect(after, 'row geometry unreadable during edit').not.toBeNull()
    const bands = await readBands(page, rowId as string)
    expect(bands, 'the quick-set band block is absent — the relationship editor has lost its simple route').not.toBeNull()

    const b = before as Geom, a = after as Geom
    const heightDelta = Math.round((a.rowHeight - b.rowHeight) * 100) / 100
    const pushDelta = b.nextRowTop < 0 || a.nextRowTop < 0 ? 0
      : Math.round((a.nextRowTop - b.nextRowTop) * 100) / 100
    const textDelta = b.valueTop < 0 || a.valueTop < 0 ? 0
      : Math.round((a.valueTop - b.valueTop) * 100) / 100

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      measure: 'modelRelationshipBandReflow', dockWidth: width, measuredDockW: dockW, rowId,
      idleFontPx: b.valueFontPx, editFontPx: a.valueFontPx,
      rowHeightBefore: b.rowHeight, rowHeightAfter: a.rowHeight, heightDelta,
      bound: RELATIONSHIP_DISCLOSURE_MAX_PX,
      nextRowTopBefore: b.nextRowTop, nextRowTopAfter: a.nextRowTop, pushDelta,
      valueTopBefore: b.valueTop, valueTopAfter: a.valueTop, textDelta,
      valueBoxBefore: b.valueBoxHeight, valueBoxAfter: a.valueBoxHeight,
      valueLeftAfter: a.valueLeft, valueRightAfter: a.valueRight,
      outlineLeft: a.outlineLeft, outlineRight: a.outlineRight,
      valueOverflowRightPx: Math.round((a.valueRight - a.outlineRight) * 100) / 100,
      bands,
    }))

    // The transition actually occurred, or the arm measures a still layout that
    // was never disturbed.
    expect(a.valueFontPx, 'the edit input is not 14px — F1 has regressed').toBeCloseTo(14, 1)
    expect(b.valueFontPx, 'the idle value is not 12px — the panel-scale migration has regressed').toBeCloseTo(12, 1)

    // ── THE #1179 CONTRACT, ON THIS ROW TOO ──────────────────────────────────
    // The relationship editor adds a readback span beside the input; the value
    // atom's reserved box must still not change, and the text must not jump.
    expect(b.valueBoxHeight, 'the idle value box is unreadable').toBeGreaterThan(0)
    expect(
      a.valueBoxHeight,
      `the value atom's own box changed from ${b.valueBoxHeight}px to ${a.valueBoxHeight}px — EDIT_RESERVED_HEIGHT_CLASS has regressed on the relationship row`,
    ).toBeCloseTo(b.valueBoxHeight, 1)
    expect(Math.abs(textDelta), `entering edit moved the value itself by ${textDelta}px at a ${width}px dock`).toBeLessThanOrEqual(1)

    /*
     * ── THE CAPABILITY IS PRESENT, BOUND BY IDENTITY ────────────────────────
     * ⚠ THIS IS THE FLOOR, AND IT IS WHY THE HEIGHT BOUND BELOW CANNOT BE MET
     * BY DELETING THE PILLS. Three named testids, not "three buttons somewhere
     * in the row" — a value predicate another object could satisfy is how a
     * test passes on the wrong object (CLAUDE.md trap 19). The cheapest way to
     * make any height bound green is to remove the controls, and the controls
     * ARE the capability Paul asked for.
     */
    for (const band of ['weak', 'moderate', 'strong'] as const) {
      await expect(
        page.getByTestId(`model-row-v2-${rowId}-value-band-${band}`),
        `the ${band} quick-set pill is gone — the relationship editor's simple route has been removed, not fixed`,
      ).toBeVisible()
    }
    await expect(
      page.getByTestId(`model-row-v2-${rowId}-value-band-readback`),
      'the live band readback is gone — the number is abstract again',
    ).toBeVisible()
    expect(bands!.buttons, 'the band set is not three pills').toHaveLength(3)

    /*
     * ── THE DEFECT ITSELF, MEASURED DIRECTLY ────────────────────────────────
     * ⭐ ONE LINE. Not "the row is short enough" — that is the consequence, and
     * a consequence can be produced by something other than the cause. Three
     * pills at three y-positions IS the defect, so it is asserted as itself.
     */
    /*
     * ⚠ AND THE STRUCTURE THAT PRODUCES IT, asserted here as well as in vitest.
     * `col-span-4` grants the row's full width ONLY to a direct child of the
     * row's grid container; nested one level deeper the class is inert and the
     * block silently returns to the 88px track. The vitest companion
     * (`rowAtomsDoNotWrap.spec.tsx`) pins the parentage and CANNOT pin what
     * follows from it, because jsdom performs no layout — so the two assertions
     * are not redundant: this one would still fail if the grid mechanism changed
     * underneath a structurally-correct tree.
     */
    /*
     * ⭐⭐ THE BAND LINE'S OWN HEIGHT, BOUNDED TIGHTLY — and this is the guard the
     * row-total ceiling above can no longer be. 37.13px is the measured honest
     * worst case (the readback wrapped above the pills at a 280px dock on ubuntu's
     * wider metrics); anything beyond it means something has begun stacking again,
     * and that REDs here even on a build whose row total happens to fit because
     * something else shrank. A row's total and the atom that moved it are two
     * different questions (CLAUDE.md trap 21).
     */
    expect(
      bands!.bandLineHeight,
      'the quick-set line has no height — it is not rendering',
    ).toBeGreaterThan(0)
    expect(
      bands!.bandLineHeight,
      `the quick-set line measured ${bands!.bandLineHeight}px at a ${width}px dock (honest worst case ${BAND_LINE_MAX}px — the readback wrapped above ONE row of pills) — something is stacking`,
    ).toBeLessThanOrEqual(BAND_LINE_MAX + 1)
    expect(
      bands!.isRowGridItem,
      'the quick-set line is not a direct child of the row — `col-span-4` is inert and the pills are back in the 88px track',
    ).toBe(true)
    expect(
      bands!.distinctTops,
      `the three quick-set pills occupy ${bands!.distinctTops} lines in a ${bands!.containerWidth}px block at a ${width}px dock — they are stacked, not a quick row of chips`,
    ).toBe(1)
    /*
     * ⚠ AND THE OTHER HARM, WHICH A LINE COUNT CANNOT SEE. Three pills can sit on
     * one line while each label is mangled inside its own border — that is what
     * #1401's "Review change" did at 52px. Two harms, two parameters
     * (CLAUDE.md trap 22b).
     *
     * ⚠⚠ BUT THE TWO ASSERTIONS BELOW ARE NOT EQUALLY EXERCISED, AND SAYING SO IS
     * THE POINT. A mutant kit measured it: `max-w-[24px]` on every pill left
     * `textLineRects` at 1 on all three and the arm went GREEN — because
     * "Moderate" is ONE WORD with no soft break opportunity, so a box too narrow
     * for it OVERFLOWS rather than wrapping. `textLineRects` is therefore a guard
     * that CANNOT FIRE against the current single-word band vocabulary; it is kept
     * because the line's `flex-wrap` comment anticipates a longer one, and a
     * two-word band would wrap exactly as "Review change" did. `overflowX` is the
     * assertion that actually bites this content, and the same mutant REDs it.
     *
     * Recorded rather than quietly dropped: an assertion nobody has shown to fail
     * reads as coverage, and this file already carries one such confession about
     * `valueCellMetrics.ts`.
     */
    for (const pill of bands!.buttons) {
      expect(
        pill.textLineRects,
        `the "${pill.label}" pill's label wraps inside its own border at a ${width}px dock (${pill.width}x${pill.height}px)`,
      ).toBe(1)
      expect(
        pill.overflowX,
        `the "${pill.label}" pill's label overflows its own border by ${pill.overflowX}px at a ${width}px dock (box ${pill.width}x${pill.height}px) — the chip is mangled, not merely small`,
      ).toBeLessThanOrEqual(1)
    }
    /*
     * ⚠ AND THE PILLS STAY INSIDE THE OUTLINE. A block moved to full width can
     * close a height defect by escaping horizontally instead, which is the same
     * trade one level along; the goal arm above already asserts this for its two
     * fields and the reason is identical.
     */
    for (const pill of bands!.buttons) {
      expect(pill.left, `the "${pill.label}" pill starts left of the outline`).toBeGreaterThanOrEqual(bands!.outlineLeft)
      expect(pill.right, `the "${pill.label}" pill escapes the outline's right edge`).toBeLessThanOrEqual(bands!.outlineRight + 1)
    }

    // ── THE BOUNDED DISCLOSURE, IN BOTH DIRECTIONS ───────────────────────────
    expect(
      heightDelta,
      `entering edit disclosed NOTHING at a ${width}px dock — the row's route forward is missing again`,
    ).toBeGreaterThan(0)
    expect(
      heightDelta,
      `the relationship editor changed the row's own height by ${heightDelta}px at a ${width}px dock (bound ${RELATIONSHIP_DISCLOSURE_MAX_PX}px)`,
    ).toBeLessThanOrEqual(RELATIONSHIP_DISCLOSURE_MAX_PX)
    /*
     * Everything the row gains is passed to its neighbour: equal deltas mean the
     * disclosure is laid out, not clipped inside a container that swallows it.
     *
     * ⚠ `toBeCloseTo(_, 1)` RATHER THAN `toBe`, AND THIS IS NOT A RAISED
     * TOLERANCE — it is the correction of an assertion that was never sound over
     * non-integer heights. MEASURED: the row grew 49.13px and the row below moved
     * 49.12px, a 0.01px disagreement between two independently rounded
     * `getBoundingClientRect()` reads of a line whose height is 15.125px. The
     * factor arm gets away with `toBe` only because its 49.5 happens to land
     * exactly. 0.01px is not clipping, and the bound here is 0.05px — two orders
     * of magnitude tighter than the 1px this file already accepts for
     * `textDelta`, so the discrimination is untouched: real clipping shows up as
     * a pushDelta near zero, not near the growth.
     */
    expect(
      pushDelta,
      `the row grew ${heightDelta}px but moved the row below by ${pushDelta}px at a ${width}px dock — the growth is being clipped`,
    ).toBeCloseTo(heightDelta, 1)

    await input.press('Escape')
    await expect(input).toHaveCount(0)
  })
}
})
