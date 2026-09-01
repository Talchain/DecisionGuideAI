/**
 * THE DOCK KEEPS THE WORDS IT PAINTS — a dock-wide clipping scan over a
 * POPULATED Results state, at every dock width the shell can produce.
 *
 * ── WHY THIS EXISTS: A DEFECT CLASS, NOT A DEFECT ─────────────────────────
 * Two real clipping defects were found on 1 Sep 2026 by a human looking at the
 * screen, while 54 automated visual cases were green:
 *
 *   1. `NodeMetricRow` — a caption painting ~17px ON TOP OF the bar beside it
 *      (#1124). A CANVAS node; `e2e/visual/nodeTextClipping.visual.spec.ts`
 *      covers that surface and did eventually red on it.
 *   2. The amber "Dominant factor" nudge — "has an i…", 684px of content in a
 *      317px box, the influence number the warning exists to convey never
 *      painted at any dock width below 480px (#1127). NOTHING covered that
 *      surface, at any width, in any state.
 *
 * Three independent reasons the existing clipping guard could not see (2),
 * all verified at the bytes in `nodeTextClipping.visual.spec.ts`:
 *   - LEAVES ONLY — `if ([...he.children].some(...)) continue`
 *   - a 4px FLOOR — `if (r.width < 4 …) continue`, and the evicted span was 0px
 *   - `.react-flow__node` SCOPE — but `TriageActionCardsBody` mounts through
 *     `ResultsBody`, which is a DOCK panel.
 *
 * ⚠ AND THE CORRECTION THAT MATTERS MORE THAN THE ORIGINAL CLAIM. The tidy
 * framing "every leaf measures clean, so only a parent-level guard can see it"
 * is OVER-GENERAL, and a reviewer measured it: in the SHORT-LABEL case at dock
 * 416 the metric leaf reads 132 / 162px — a text leaf, 30px lost, well above
 * the 4px floor. Grounds 1 and 2 would NOT have saved it there. **Only ground
 * 3, the scope, is unconditional.** That is the load-bearing gap, and it is
 * what this file closes.
 *
 * ── WHAT WAS ALREADY BUILT, AND WHAT THIS ADDS ────────────────────────────
 * Almost all of this already existed; it had simply never been pointed at a
 * populated dock.
 *
 *   - `e2e/visual/analysisNewLayout.visual.spec.ts` already scans the WHOLE
 *     `outputs-dock` at 280 / 416 / 480 with a clipping predicate. It pins the
 *     PRE-RUN state and the Analysis (New) tab, so neither defect is in frame.
 *   - `e2e/geometry/analysisAnswerFirst.measure.ts` already reaches POPULATED
 *     results, through a real captured CEE turn replayed by `applyV5State`.
 *   - `e2e/geometry/dominantNudgeNumber.measure.ts` (#1127) already measures a
 *     PAINTED `Range` rect against every clipping ancestor.
 *
 * This file is those three joined, and nothing else invented. The scan is the
 * `analysisNewLayout` predicate, carried verbatim; the replay is the
 * `dominantNudgeNumber` replay, carried verbatim; the painted-run walk is that
 * file's `numberSurvives`, generalised from one hard-coded `NN%` run to every
 * text run in the dock.
 *
 * ── ⭐ WHY THERE ARE TWO CHANNELS AND NEITHER IS REDUNDANT ─────────────────
 * This is the whole design, and it is derived from the two measured shapes
 * rather than chosen:
 *
 *   CHANNEL A — LEAF OVERFLOW (`scrollWidth > clientWidth` on a text leaf).
 *     The existing predicate, unchanged. Catches the SHORT-LABEL case: the
 *     metric leaf at 132 / 162px. It CANNOT catch the eviction — a 0px-wide
 *     span is below its own 4px floor.
 *
 *   CHANNEL B — PAINTED RUN vs CLIPPING ANCESTORS (`Range` rect).
 *     No floor, no leaves-only skip. Catches the EVICTION: the span painted
 *     zero area, so the sentence's ending — the number — reached no pixel.
 *     It classifies an ellipsis-signalled truncation SEPARATELY (see below),
 *     so it does NOT re-catch the short-label case: pre-fix that span carried
 *     `truncate`, i.e. the loss was signalled.
 *
 * So each channel catches exactly one of the two shapes and misses the other.
 * A guard with only one of them is a guard that would have shipped one of the
 * two defects again. Both controls below assert precisely this: the eviction
 * control must be caught by B **and missed by A** (a discriminating pair —
 * CLAUDE.md trap 19), or B has quietly become a duplicate of A and the file is
 * back to one channel without anything going red.
 *
 * ── WHERE THE LINE IS DRAWN, AND WHY ──────────────────────────────────────
 *   - `auto` / `scroll` ancestors END the walk. Text below the fold in the
 *     dock body is RECOVERABLE by scrolling. Same line `nodeTextClipping` and
 *     `dominantNudgeNumber` already draw; enforcing containment on `auto`
 *     produced a false positive against the scroll container on a
 *     correctly-fixed tree, twice, and is not repeated here.
 *   - `text-overflow: ellipsis` is REPORTED, NOT GATED. An ellipsis tells the
 *     user text was cut; a hard `overflow: hidden` cut mid-word does not. The
 *     deployed witness was the second kind. Gating the first would fail on
 *     every deliberate `truncate` in the dock and the scan would be turned off
 *     within a week — so those land in `ellipsis[]`, printed every run.
 *   - `sr-only` elements (1x1 clipped boxes) are SKIPPED. They are supposed to
 *     paint nothing. An evicted span is 0px WIDE but keeps its line height, so
 *     the skip is `width <= 1 && height <= 1` — it cannot swallow the defect.
 *
 * ── STATE CLASS, STATED HONESTLY (the fixture rule) ────────────────────────
 * FRESH session, real starter draft (`build-vs-buy`, through the product's own
 * `applyDraftResult`), plus a REAL captured CEE analysis turn replayed
 * UNMODIFIED through `applyV5State` — the same applicator `useConversation`
 * calls on a real turn. Nothing here is hand-authored. This is a REPLAY, not
 * the deployed journey.
 *
 * ⚠ RUN IT DELIBERATELY, it is not in any gate:
 *     pnpm exec playwright test -c playwright.geometry.config.ts
 * `*.measure.ts`, never `*.spec.ts`, so the main e2e config cannot collect it
 * into a run with no dev server on its port.
 *
 * ⚠⚠ A STALE DEV SERVER SERVES A TREE YOU ARE NOT MEASURING. One outlives
 * `playwright test` and keeps the port; `reuseExistingServer: false` means
 * Playwright will not adopt it, but the browser still reaches it and it serves
 * the module graph it had when it started. On an already-fixed tree it served
 * the PRISTINE component for run after run. Check with
 * `lsof -nP -iTCP:<port> -sTCP:LISTEN` — plain `lsof -ti tcp:<port>` also lists
 * browser CLIENT connections and reads as "the port will not free".
 * This file therefore FINGERPRINTS THE SERVED TREE in-page (below) rather than
 * trusting the port, and `DOCKCLIP_ARM` turns that into an assertion.
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { repoRoot } from '../visual/repoRoot'
import {
  openCanvas, preparePage, seedStarterDraft, clearNotifications,
  minimiseFloatingOlumiPanel, freezeMotion, waitForVisualQuiescence,
} from '../visual/harness'

/** The same real captured CEE analysis turn `dominantNudgeNumber` replays. */
const CAPTURE = join(repoRoot(), 'src/v5/__tests__/fixtures/live-analysis-turn-walkA-2026-08-04.json')
const STARTER = 'build-vs-buy' as const
const VP = { width: 1280, height: 800 }

/**
 * DERIVED from `src/canvas/components/dockWidth.ts`, not chosen:
 * `DOCK_MIN_WIDTH` 280, `DOCK_RESPONSIVE_MAX_WIDTH` 416, and the drag ceiling
 * `min(480, 40% of viewport)` = 480 at 1280px wide.
 */
const DOCK_WIDTHS = [280, 416, 480] as const

/**
 * ⭐ WHAT THIS SCAN ALREADY FINDS ON `staging` @ `f585969d`, PINNED BY NAME.
 * (Measured identically at `365ea603` and again after #1128 rebased it onto
 * `f585969d` — that commit's `typography.ts` edit is comment-only, verified
 * by diffing out every comment line, so none of these numbers moved.)
 *
 * The scan went red on its first run against a populated dock — which is the
 * point of writing it, and the reason it could not be shipped as a plain green
 * assertion. Every one of these is REPORTED, NOT FIXED: this PR is one scan,
 * and fixing five surfaces inside the PR that adds the instrument would make
 * the instrument unreviewable.
 *
 * ⚠ THIS IS NOT A REGENERATED BASELINE AND MUST NEVER BECOME ONE. There is no
 * `--update` path, no file on disk, and no blessing step. Each entry is typed
 * out by hand with the reason it is here, and the assertion is EXACT EQUALITY
 * in both directions: a NEW clipping defect REDs, and a FIXED one REDs too, so
 * whoever fixes it must delete its line. That is the estate's own
 * KNOWN-DROPPED-set discipline (CLAUDE.md trap 22f) rather than a ratchet — a
 * ratchet only ever notices growth, and would let these five rot.
 *
 * ⚠ AND THE HONEST WARNING ABOUT THE ALTERNATIVE: shipping this file
 * permanently RED would have created a broken alarm on arrival — a red nobody
 * can act on teaches every later lane to stop reading it, which is exactly how
 * `nodeTextClipping.visual.spec.ts` sat red from 1 Sep ~01:07Z through the
 * #1124 defect. Green FOR A STATED REASON, red on any change, is the posture
 * that stays useful.
 *
 * CLASSIFICATION — which of these are defects and which need a product ruling:
 *
 *  REAL, and the same class as the witnessed defect (hard cut, no ellipsis,
 *  nothing to scroll). Both are dock-280 ONLY, i.e. invisible at the default:
 *   - `hero-row-label` — the option name wraps to 54px of text in a 39px
 *     `overflow-hidden` box. The last line is cut mid-word.
 *   - `hero-act-on-it-row-reason` — the reason sentence needs 74px in a 39px
 *     box: roughly half the sentence never paints. It is the sentence that
 *     explains the recommended action.
 *
 *  REAL, but SIGNALLED — needs a product judgement, not a bug fix:
 *   - the two `win-gauge` option-name spans, clipped at ALL THREE widths
 *     (145/187, 160/187 and 160/187px, and the comparative block is 120px at
 *     every width — it never grows). They carry an ellipsis, so the user is
 *     told the label was cut; whether a 187px option name should be truncated
 *     to 120px in the gauge is a design call. Flagged, not decided.
 *
 *  NEEDS A LOOK, mechanism not yet established:
 *   - `winner-by-control` "Optimistic" escapes the dock's RIGHT EDGE at dock
 *     280 only. This is the existing `analysisNewLayout` predicate firing, not
 *     a new one.
 *
 * Not pinned, because they are not defects: 16 `collapsed` findings (one shut
 * accordion, `accordion-drivers`, whose box is Nx0) and the 2 `ellipsis`
 * advisories, all printed in the `DOCKCLIP` line every run.
 */
const KNOWN_UNFIXED: Readonly<Record<number, ReadonlyArray<readonly [string, string, string]>>> = {
  280: [
    ['leaf-overflow', 'div>div>div[win-gauge-goal-block]>div>div[goal-row-opt_status_quo]>span', 'Delay Billing Migration (Status Quo)'],
    ['leaf-overflow', 'div>div>div[win-gauge-comparative-block]>div>span>span', 'Delay Billing Migration (Status Quo)'],
    ['clipped-vertical', 'div>div[hero-chart-rows]>div[hero-option-row-2]>button>span>span[hero-row-label]', 'Delay Billing Migration (Status Quo)'],
    ['clipped-vertical', 'section[hero-act-on-it]>div>article[hero-act-on-it-row-risk]>div>div>p[hero-act-on-it-row-reason]', 'If the estimate changes for Self-Serve Product Tier, the leading optio'],
    ['escapes-dock', 'div[outputs-results-redesign]>div[assessment-current-view-group]>div>div[winner-by-control]>div>button', 'Optimistic'],
  ],
  416: [
    ['leaf-overflow', 'div>div>div[win-gauge-goal-block]>div>div[goal-row-opt_status_quo]>span', 'Delay Billing Migration (Status Quo)'],
    ['leaf-overflow', 'div>div>div[win-gauge-comparative-block]>div>span>span', 'Delay Billing Migration (Status Quo)'],
  ],
  480: [
    ['leaf-overflow', 'div>div>div[win-gauge-goal-block]>div>div[goal-row-opt_status_quo]>span', 'Delay Billing Migration (Status Quo)'],
    ['leaf-overflow', 'div>div>div[win-gauge-comparative-block]>div>span>span', 'Delay Billing Migration (Status Quo)'],
  ],
}

const findingKey = (f: { kind: string; path: string; text: string }) => `${f.kind}|${f.path}|${f.text}`

/** The component whose defect this file was written from — a served-tree contrast control. */
const SERVED_MODULE = '/src/components/results/TriageActionCardsBody.tsx'
/** Present only AFTER #1127. Absent on a reverted tree. */
const POST_FIX_MARKER = 't1-dominant-nudge-metric'

interface Finding {
  kind: string
  tag: string
  testid: string
  path: string
  text: string
  visible: number
  needed: number
  detail: string
}

/** Cold start: the first test can outlast `openCanvas` while Vite compiles the canvas chunk. */
async function openCanvasWarm(page: Page): Promise<void> {
  let last: unknown
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try { await openCanvas(page); return } catch (e) {
      last = e
      console.log(`OPENCANVAS_ATTEMPT_${attempt} ` + String(e).slice(0, 300))
      if (page.isClosed()) break
      await page.waitForTimeout(5_000)
      await page.goto('/#/canvas', { waitUntil: 'domcontentloaded' }).catch(() => {})
    }
  }
  throw last
}

const report = (rows: Finding[]) =>
  rows.map(r => `    [${r.kind}] ${r.visible}/${r.needed}px  <${r.tag} ${r.testid}>  ${r.path}\n        "${r.text}"  ${r.detail}`).join('\n')

async function scanDock(page: Page) {
  return page.evaluate(() => {
    const dock = document.querySelector('[data-testid="outputs-dock"]') as HTMLElement | null
    if (!dock) {
      return {
        dockFound: false, controlA: false, controlB: false, controlBKind: 'NOT CAUGHT', controlBMissedByA: false,
        leaf: [] as Finding[], wider: [] as Finding[], painted: [] as Finding[],
        vertical: [] as Finding[], ellipsis: [] as Finding[], collapsed: [] as Finding[],
      }
    }
    const dockRight = dock.getBoundingClientRect().right

    /** A short DOM path, so a finding can be located without a testid. */
    const pathOf = (el: HTMLElement): string => {
      const parts: string[] = []
      for (let e: HTMLElement | null = el; e && e !== dock && parts.length < 6; e = e.parentElement) {
        const id = e.getAttribute('data-testid')
        parts.unshift(id ? `${e.tagName.toLowerCase()}[${id}]` : e.tagName.toLowerCase())
      }
      return parts.join('>')
    }

    const rec = (he: HTMLElement, kind: string, detail: string, visible: number, needed: number): Finding => ({
      kind, tag: he.tagName.toLowerCase(),
      testid: he.getAttribute('data-testid') ?? '',
      path: pathOf(he),
      text: (he.textContent ?? '').trim().slice(0, 70),
      visible: Math.round(visible), needed: Math.round(needed), detail,
    })

    /** `sr-only`: a 1x1 clipped box that is SUPPOSED to paint nothing. An evicted
     *  span is 0px WIDE but keeps its line height, so this cannot swallow it. */
    const isSrOnly = (r: DOMRect) => r.width <= 1 && r.height <= 1

    const hiddenSubtree = (he: HTMLElement): boolean => {
      for (let e: HTMLElement | null = he; e && e !== dock.parentElement; e = e.parentElement) {
        const cs = getComputedStyle(e)
        if (cs.display === 'none' || cs.visibility === 'hidden') return true
        if (isSrOnly(e.getBoundingClientRect())) return true
      }
      return false
    }

    /**
     * CHANNEL B, generalised from `dominantNudgeNumber.measure.ts`'s
     * `numberSurvives`: does this PAINTED text run survive every clipping
     * ancestor on its way out? Returns null when it does.
     */
    const runSurvives = (owner: HTMLElement, node: Text) => {
      const raw = node.textContent ?? ''
      const start = raw.search(/\S/)
      if (start < 0) return null
      const end = raw.length - (raw.length - raw.replace(/\s+$/, '').length)
      const r = document.createRange()
      r.setStart(node, start); r.setEnd(node, Math.max(start + 1, end))
      const rect = r.getBoundingClientRect()
      const runText = raw.trim().slice(0, 70)

      if (rect.width < 1 || rect.height < 1) {
        // NOTHING PAINTED. This is the eviction shape: the run reached no pixel
        // at all, so no amount of scrolling or hovering recovers it.
        return { cls: 'evicted' as const, detail: `run painted ${rect.width.toFixed(1)}x${rect.height.toFixed(1)}px`, runText, w: rect.width, need: rect.width }
      }
      for (let el = owner as HTMLElement | null; el; el = el.parentElement) {
        const cs = getComputedStyle(el)
        // A SCROLL PORT ends the walk: from here outwards it is the fold, not
        // hiding, and the text is recoverable.
        if (/auto|scroll/.test(cs.overflowX + ' ' + cs.overflowY)) return null
        if (!/hidden|clip/.test(cs.overflowX + ' ' + cs.overflowY)) continue
        const b = el.getBoundingClientRect()
        const hEsc = rect.left < b.left - 0.5 || rect.right > b.right + 0.5
        const vEsc = rect.top < b.top - 0.5 || rect.bottom > b.bottom + 0.5
        if (!hEsc && !vEsc) continue
        // SIGNALLED vs SILENT. An ellipsis tells the user the text was cut.
        const signalled = getComputedStyle(el).textOverflow === 'ellipsis'
        const box = `box[${b.left.toFixed(0)},${b.top.toFixed(0)},${b.right.toFixed(0)},${b.bottom.toFixed(0)} ${b.width.toFixed(0)}x${b.height.toFixed(0)}]`
        const run = `run[${rect.left.toFixed(0)},${rect.top.toFixed(0)},${rect.right.toFixed(0)},${rect.bottom.toFixed(0)} ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}]`
        // A CLOSED DISCLOSURE is not clipping. A zero-height `overflow:hidden`
        // box is how an accordion holds its content shut; the text is
        // RECOVERABLE by opening it, which is the same line the `auto`/`scroll`
        // break already draws. Classified, counted and printed — never silently
        // dropped — and the test is `height <= 1 AND the escape is not
        // horizontal`, so a zero-WIDTH clipping parent (the eviction shape at
        // parent level) can never land in this bucket.
        const collapsed = b.height <= 1 && !hEsc
        return {
          cls: collapsed ? ('collapsed' as const)
            : signalled ? ('ellipsis' as const)
            : (hEsc ? ('clipped' as const) : ('clipped-vertical' as const)),
          detail: `${hEsc ? 'H' : ''}${vEsc ? 'V' : ''} escapes ${el.tagName.toLowerCase()}${el.getAttribute('data-testid') ? `[${el.getAttribute('data-testid')}]` : ''} ` +
                  `${box} ${run}`,
          runText, w: b.width, need: rect.width,
        }
      }
      return null
    }

    const scan = () => {
      const leaf: Finding[] = []
      const wider: Finding[] = []
      const painted: Finding[] = []
      const vertical: Finding[] = []
      const ellipsis: Finding[] = []
      const collapsed: Finding[] = []

      for (const el of dock.querySelectorAll('*')) {
        const he = el as HTMLElement
        const r = he.getBoundingClientRect()
        const cs = getComputedStyle(he)

        // ── CHANNEL B — every painted text run, NO floor, NO leaves-only skip.
        // This is the half that sees a parent-level eviction.
        if (!hiddenSubtree(he)) {
          for (const n of he.childNodes) {
            if (n.nodeType !== 3) continue
            if (!((n.textContent ?? '').trim())) continue
            const v = runSurvives(he, n as Text)
            if (!v) continue
            const f = rec(he, v.cls, v.detail, v.w, v.need)
            f.text = v.runText
            if (v.cls === 'collapsed') collapsed.push(f)
            else if (v.cls === 'ellipsis') ellipsis.push(f)
            else if (v.cls === 'clipped-vertical') vertical.push(f)
            else painted.push(f)
          }
        }

        // ── CHANNEL A — the EXISTING predicate, carried verbatim from
        // `e2e/visual/analysisNewLayout.visual.spec.ts`. Its 4px floor and its
        // leaves-only skip are deliberately preserved: this channel is not the
        // one that sees an eviction, and widening it here would make the two
        // channels the same channel.
        if (r.width < 4 || r.height < 4) continue
        if (cs.visibility === 'hidden' || cs.display === 'none') continue
        const a = rec(he, 'leaf-overflow', `clientWidth ${Math.round(he.clientWidth)} scrollWidth ${Math.round(he.scrollWidth)}`,
          he.clientWidth, he.scrollWidth)
        // escapes the dock's right edge — 1px for sub-pixel rounding
        if (r.right > dockRight + 1) {
          wider.push({ ...a, kind: 'escapes-dock',
            detail: `right ${r.right.toFixed(0)}px vs dock right ${dockRight.toFixed(0)}px (over by ${(r.right - dockRight).toFixed(0)}px), rect ${r.width.toFixed(0)}x${r.height.toFixed(0)}` })
        }
        if (/auto|scroll/.test(cs.overflowX + cs.overflowY)) continue
        const txt = (he.textContent ?? '').trim()
        if (!txt) continue
        if ([...he.children].some(c => (c.textContent ?? '').trim())) continue
        if (he.scrollWidth - he.clientWidth > 1) leaf.push(a)
      }
      return { leaf, wider, painted, vertical, ellipsis, collapsed }
    }

    // ── POSITIVE CONTROLS. Without them, a scan that matched nothing — a
    // renamed testid, a surface that stopped mounting, a predicate that quietly
    // stopped discriminating — reports a clean pass at every width, which is a
    // guard agreeing with itself (CLAUDE.md trap 13).
    //
    // CONTROL A: a long string in a 24px box. Channel A must see it.
    const probeA = document.createElement('div')
    probeA.textContent = 'ZZZ_DOCK_CLIP_CONTROL_THIS_STRING_IS_FAR_TOO_LONG_TO_FIT'
    probeA.style.cssText = 'width:24px;height:16px;overflow:hidden;white-space:nowrap'
    dock.appendChild(probeA)
    const controlA = scan().leaf.some(c => c.text.includes('ZZZ_DOCK_CLIP_CONTROL'))
    probeA.remove()

    // CONTROL B: the DEPLOYED MECHANISM of the amber nudge, reproduced —
    // an unshrinkable `nowrap` sibling ahead of a `flex:1 1 0%` span, in an
    // `overflow:hidden` row. The span is evicted to 0px.
    // ⭐ IT MUST BE CAUGHT BY B **AND MISSED BY A**. Caught-by-B alone would
    // still pass if B had silently become a duplicate of A; the PAIR is what
    // proves B is measuring something A structurally cannot see.
    const probeB = document.createElement('div')
    probeB.style.cssText = 'display:flex;flex-wrap:nowrap;overflow:hidden;width:120px;height:20px'
    const bFixed = document.createElement('span')
    bFixed.style.cssText = 'white-space:nowrap'
    bFixed.textContent = 'ZZZ_EVICTION_CONTROL_UNSHRINKABLE_SIBLING'
    const bEvicted = document.createElement('span')
    bEvicted.style.cssText = 'flex:1 1 0%;min-width:0;overflow:hidden;white-space:nowrap'
    bEvicted.textContent = 'ZZZ_EVICTED_RUN_100%'
    probeB.append(bFixed, bEvicted)
    dock.appendChild(probeB)
    const bScan = scan()
    const controlB = bScan.painted.some(c => c.text.includes('ZZZ_EVICTED_RUN') && (c.kind === 'evicted' || c.kind === 'clipped'))
    const controlBKind = bScan.painted.find(c => c.text.includes('ZZZ_EVICTED_RUN'))?.kind ?? 'NOT CAUGHT'
    const controlBMissedByA = !bScan.leaf.some(c => c.text.includes('ZZZ_EVICTED_RUN'))
    probeB.remove()

    return { dockFound: true, controlA, controlB, controlBKind, controlBMissedByA, ...scan() }
  })
}

for (const width of DOCK_WIDTHS) {
  test(`DOCK CLIPPING (populated results) @dock ${width}px`, async ({ page }) => {
    await preparePage(page, VP)
    await openCanvasWarm(page)

    // ── THE TREE YOU ARE MEASURING. A stale dev server on the port serves the
    // module graph it had when it started, so the port is not evidence. Fetch
    // the component through the dev server and fingerprint it.
    const served = await page.evaluate(async (m) => {
      try {
        const res = await fetch(m)
        const text = await res.text()
        return { ok: res.ok, len: text.length, hasComponent: text.includes('T1DominantNudge'), hasPostFix: text.includes('t1-dominant-nudge-metric') }
      } catch (e) { return { ok: false, len: 0, hasComponent: false, hasPostFix: false, err: String(e) } }
    }, SERVED_MODULE)
    console.log(`SERVED_TREE ${JSON.stringify({ module: SERVED_MODULE, ...served, postFixMarker: POST_FIX_MARKER })}`)
    expect(served.hasComponent,
      `the dev server did not serve ${SERVED_MODULE} — the tree under measurement is not this one`).toBe(true)
    // Optional ARM assertion, used by the revert-proof runs to make it
    // impossible to report a "before" number taken from an "after" tree.
    const arm = process.env.DOCKCLIP_ARM
    if (arm === 'before') expect(served.hasPostFix, 'DOCKCLIP_ARM=before but the served tree carries the FIX').toBe(false)
    if (arm === 'after') expect(served.hasPostFix, 'DOCKCLIP_ARM=after but the served tree does NOT carry the fix').toBe(true)

    const seeded = await seedStarterDraft(page, STARTER)
    expect(seeded.nodeCount, 'build-vs-buy is 19 nodes; a different count means the fixture drifted').toBe(19)
    await clearNotifications(page)
    await minimiseFloatingOlumiPanel(page).catch(() => {})

    // ── THE REPLAY. Unmodified, exactly as `dominantNudgeNumber.measure.ts`.
    const envelope = JSON.parse(readFileSync(CAPTURE, 'utf8'))
    // Pin what makes the nudge mount, so a capture that drifted cannot leave
    // this file reporting a comfortable number about a component that never
    // rendered (CLAUDE.md trap 3b).
    const td = envelope.blocks[0].enrichment.decision_brief.top_drivers
    expect(td[0].sensitivity, 'top driver must clear the 0.8 dominance floor').toBeGreaterThanOrEqual(0.8)
    expect(td[0].sensitivity - td[1].sensitivity, 'dominance is COMPARATIVE — a tie must not mount it').toBeGreaterThan(0.01)

    const applied = await page.evaluate(async (env) => {
      const modulePath = '/src/v5/applyV5State.ts'
      const mod = (await import(/* @vite-ignore */ modulePath)) as {
        applyV5State: (r: unknown, s: unknown, o: unknown) => { applied: string[] }
      }
      const w = window as unknown as { useCanvasStore: { getState: () => Record<string, unknown> } }
      const snap = w.useCanvasStore.getState()
      return mod.applyV5State(
        env,
        { ...snap, currentResultsHash: (snap.results as { hash?: string } | null)?.hash ?? null, backfillGoalThreshold: () => {} },
        { turnClientId: 'measure', currentClientTurnId: 'measure' },
      )
    }, envelope)
    expect(applied.applied.length, 'applyV5State applied nothing — the turn did not land').toBeGreaterThan(0)

    const resultsTab = page.getByTestId('outputs-dock-tab-results')
    if (await resultsTab.count()) await resultsTab.click().catch(() => {})

    // ── SET THE DOCK WIDTH THROUGH THE PATH THE PRODUCT ACTUALLY READS.
    // ⚠ `analysisNewLayout.visual.spec.ts` calls `useUIStore.getState().setDockWidth(w)`
    // through two optional chains. `setDockWidth` EXISTS NOWHERE IN `src`
    // (contrast control: `setActiveOutputTab`, 3 hits in the same store) and
    // `useUIStore` is never put on `window` (only `useCanvasStore` is), so both
    // links are `undefined` and the call is a silent no-op — that spec measures
    // the SAME default width three times. The real path is the persisted key
    // `panel.results.width`, re-read by an effect on `resize`.
    // The assertion below is what makes that impossible to repeat here.
    await page.evaluate((w) => {
      try { localStorage.setItem('panel.results.width', String(w)) } catch { /* asserted below */ }
      window.dispatchEvent(new Event('resize'))
    }, width)
    await page.waitForTimeout(300)

    // ── PRECONDITIONS, PINNED IN-TEST (trap 13b) ──────────────────────────
    // 1. The width actually moved. Without this the three cases are one case.
    const dockW = await page.evaluate(() => {
      const d = document.querySelector('[data-testid="outputs-dock"]') as HTMLElement | null
      return d ? +d.getBoundingClientRect().width.toFixed(1) : -1
    })
    expect(Math.abs(dockW - width),
      `the dock measured ${dockW}px, not ${width}px — the width never moved, so this case is not the case it claims to be`)
      .toBeLessThanOrEqual(2)

    // 2. The POPULATED state class. `analysisNewLayout` pins `pre-run`; this
    //    file pins its opposite, so neither can ever be read as the other.
    await expect(page.getByTestId('decision-overview'),
      'no analysis on screen — this file makes no claim about the pre-run surface').toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('hero-headline'), 'the verdict did not mount').toBeVisible({ timeout: 20_000 })
    // 3. The component both witnessed defects lived in is actually rendered.
    await expect(page.getByTestId('t1-dominant-nudge'),
      'the dominant-factor nudge did not mount — the surface this file exists for is absent').toBeVisible({ timeout: 20_000 })

    await freezeMotion(page)
    await waitForVisualQuiescence(page)

    // 4. rAF IS TICKING. A hidden pane never fires `requestAnimationFrame`
    //    (measured: 0 ticks in 1s), and every number below is painted geometry.
    const ticks = await page.evaluate(() => new Promise<number>((resolve) => {
      let n = 0
      const t0 = performance.now()
      const step = () => { n += 1; if (performance.now() - t0 < 250) requestAnimationFrame(step); else resolve(n) }
      requestAnimationFrame(step)
    }))
    expect(ticks, 'requestAnimationFrame did not tick — nothing is being painted, so no geometry here is evidence').toBeGreaterThan(1)

    // ⚠ SETTLED READING, NEVER A FIRST READ. Two scans that must agree on the
    // finding counts, or the layout had not settled and neither is evidence.
    const first = await scanDock(page)
    await page.waitForTimeout(400)
    const res = await scanDock(page)

    console.log(`DOCKCLIP ${JSON.stringify({
      dock: width, dockMeasured: dockW, rafTicks: ticks,
      controls: { A: res.controlA, B: res.controlB, B_kind: res.controlBKind, B_missed_by_A: res.controlBMissedByA },
      counts: {
        leaf: res.leaf.length, painted: res.painted.length, wider: res.wider.length,
        vertical: res.vertical.length, ellipsis: res.ellipsis.length, collapsed: res.collapsed.length,
      },
      leaf: res.leaf, painted: res.painted, wider: res.wider,
      vertical: res.vertical, ellipsis: res.ellipsis, collapsed: res.collapsed,
    })}`)

    expect(res.dockFound, 'no outputs dock in the DOM').toBe(true)
    expect(
      first.leaf.length === res.leaf.length && first.painted.length === res.painted.length &&
        first.wider.length === res.wider.length && first.vertical.length === res.vertical.length,
      `the two readings disagree (leaf ${first.leaf.length}/${res.leaf.length}, painted ${first.painted.length}/${res.painted.length}, ` +
      `wider ${first.wider.length}/${res.wider.length}, vertical ${first.vertical.length}/${res.vertical.length}) — ` +
      `the layout had not settled, so neither is evidence`,
    ).toBe(true)

    // ── THE CONTROLS ARE ASSERTED BEFORE THE FINDINGS ARE BELIEVED.
    expect(res.controlA,
      'CHANNEL A did not catch its control — the leaf-overflow scan cannot see a clipped leaf, so a clean result from it means nothing').toBe(true)
    expect(res.controlB,
      'CHANNEL B did not catch its control — the painted-run scan cannot see an evicted run, so a clean result from it means nothing').toBe(true)
    expect(res.controlBMissedByA,
      'CHANNEL A caught the eviction control. The two channels are no longer discriminating: B has become a duplicate of A, ' +
      'and the eviction shape is no longer independently covered').toBe(true)

    // ── THE FINDINGS, AGAINST THE HAND-WRITTEN KNOWN SET. Exact equality in
    // BOTH directions (see `KNOWN_UNFIXED`): a new clipping defect REDs, and so
    // does a fixed one, so nobody can quietly leave these five to rot.
    const found = [...res.painted, ...res.vertical, ...res.leaf, ...res.wider]
    const known = KNOWN_UNFIXED[width] ?? []
    const knownKeys = new Set(known.map(([kind, path, text]) => `${kind}|${path}|${text}`))
    const foundKeys = new Set(found.map(findingKey))

    const appeared = found.filter(f => !knownKeys.has(findingKey(f)))
    expect(
      appeared,
      `NEW clipping in the dock at ${width}px — text the user cannot read, and nothing else in this repo is looking:\n` +
      `${report(appeared)}\n` +
      `(If this is a deliberate, signalled truncation, say so and add it to KNOWN_UNFIXED with the reason. ` +
      `Do NOT widen the predicate to make it go away.)`,
    ).toEqual([])

    const disappeared = known.filter(k => !foundKeys.has(`${k[0]}|${k[1]}|${k[2]}`))
    expect(
      disappeared,
      `a KNOWN clipping finding at ${width}px is no longer detected:\n` +
      `${disappeared.map(k => `    [${k[0]}] ${k[1]}\n        "${k[2]}"`).join('\n')}\n` +
      `If you FIXED it: delete its entry from KNOWN_UNFIXED in this file — that is the point of pinning them. ` +
      `If you did not, the scan has stopped seeing it and the guard has quietly narrowed.`,
    ).toEqual([])
  })
}
