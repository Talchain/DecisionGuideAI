/**
 * BOARD GEOMETRY ACROSS THE FOUR STATES A USER ACTUALLY MEETS — landing,
 * post-run, stale ("Last run ·") and reload — in a real browser.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS ARM EXISTS (D-2; DL register R7)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Paul tested his own £100k MRR model (served `e8ba18e6`, 27 Sep 2026) and hit
 * three layout defects no automated check could see:
 *   1. an UPWARD same-band link — "Monthly new Pro subscribers" dealt into the
 *      factor band's SECOND row while "Pro paying subscribers", which it drives,
 *      sat in the first, so the link ran up into the bottom of its target;
 *   2. a caption cut mid-glyph, "Last run · Driver 1 of 6 analysec" — the
 *      in-slot driver <button> sized to its content, so its `truncate` caption
 *      never truncated and the slot's `overflow-hidden` cut it;
 *   3. a card's "…" menu drawing UNDER that card's own floating inspector
 *      (menu z-951, `InspectorModal` z-5000).
 * jsdom has no layout (every rect is 0), and every other arm of this gate
 * measures a PRE-RUN board. Root cause R7: nothing checked post-run, stale or
 * reload geometry in a real browser. This arm is that check. It changes no
 * product code, makes no network call (the harness's hermetic routes) and no
 * model call.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE BOARDS (`BOARD_STATES_BOARDS`, owned by the gate registry)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   · the five starters, each with a PLANTED run built from its own draft and
 *     the real MRR block's row shapes (`starterRun`) — named as planted;
 *   · Paul's model in the TWO states his screenshots came from, each with its
 *     REAL `analysis_result` block (`fixtures/mrr-<id>.fixture.json`, `_source`
 *     says what was copied and what was dropped):
 *       `mrr-17d1cd3a` — 5 factors wrapping 3+2: carries defect 1. ⚠ The
 *         brief named only 90b8f080, and that state CANNOT show defect 1 — its 6
 *         factors wrap 3+3 and put both cards in row 2 (measured: no upward
 *         link at any state). 17d1cd3a is the export the parked fix names.
 *       `mrr-90b8f080` — 6 factors, 6 options: the "of 6" caption and defect 3.
 * All at 1280x800, the product's own landing fit.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE STATES, per board, in ONE page
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   LANDING   `applyDraftResult` + the product's own landing fit.
 *   POST-RUN  the run replayed UNMODIFIED through `applyV5State` — the
 *             applicator `useConversation` calls for a real turn (the path
 *             `dockClippingPopulated` / `dominantNudgeNumber` use).
 *   STALE     the store's own `markAnalysisFreshnessDirty()` — the one action
 *             every analysis-affecting edit calls — so the composed run
 *             currency reads `'changed'` and run cues carry `Last run · `.
 *   RELOAD    a real document reload with the page's own `localStorage`
 *             carried across (the harness wipes storage per navigation; the
 *             carry `ghostDoorVisibility`'s RESTORED arm uses), then the same
 *             turn re-delivered. ⚠ MEASURED, NOT ASSUMED: a guest's run does
 *             NOT survive a reload in this build (`results.status: 'idle'`, and
 *             no turn is requested), so RELOAD is "the restored board with the
 *             run delivered again"; `runSurvivedReload` and `movedOnReload`
 *             (cards the restore put somewhere else) are recorded per board.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FIVE PROBES, AND WHICH ARE ASSERTED
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  (a) RUN GROWTH — a card taller (layout px, `offsetHeight`) than at LANDING
 *      by more than 1px, compared AT THE LANDING ZOOM (counter-scale and LOD
 *      rung move height with the camera). REPORTED, NOT ASSERTED (lead's
 *      instruction: "report what the base measures, don't force a verdict").
 *  (b) CLIPPED TEXT — ASSERTED ZERO. One reader, two readings:
 *      b1  an element whose OWN text overflows its own clipping box
 *          (`overflow-x: hidden|clip`, `scrollWidth > clientWidth + 1`) with no
 *          `text-overflow: ellipsis`;
 *      b2  a text run whose glyph box (a `Range` over its text nodes) crosses a
 *          clipping ANCESTOR without an ellipsis, walked from the text up to
 *          the card: an ellipsis clipper whose content is inline clamps the run
 *          to its own box (the "…" is shown); a run WHOLLY outside a clipper is
 *          HIDDEN (a designed whole-or-nothing wrap — counted, not flagged).
 *      ⭐ PLUS THE LONG-CAPTION STRESS at STALE (`stressDriverCaptions`): in
 *      the hermetic gate there is no Inter, and in the fallback font the
 *      natural captions FIT (measured: "… Driver 1 of 6 analysed" 217px in a
 *      223px slot). So every real in-slot caption is also read lengthened past
 *      its slot, in place: a line that can truncate ends in "…", the broken one
 *      is cut by the slot. Font-independent; red on exactly the mechanism.
 *  (c) OVERLAY OCCLUSION — ASSERTED ZERO. A card is clicked (which opens its
 *      inspector), its REACHABLE "…" (`node-action-menu-<id>`) is clicked, and
 *      at the centre of every menu item `document.elementFromPoint` must land
 *      inside that item. Only a card whose menu rect INTERSECTS its inspector is
 *      a case, so cards are tried in order until one is; none is VACUOUS and
 *      fails.
 *  (d) UPWARD SAME-BAND LINK — ASSERTED ZERO. For every store edge whose ends
 *      share a band (`TIER_BY_KIND`, the layout's own map), the target's top
 *      must not sit above the source's top by more than `ROW_TOLERANCE` of the
 *      shorter card. ⚠ The brief said "by more than a row"; read literally that
 *      PASSES Paul's defect (the target is exactly one sub-row up), so the
 *      tolerance is half a card: ELK's intra-row jitter is a few px, a sub-row
 *      is not.
 *  (e) FIT — REPORTED, NOT ASSERTED. After the real "Fit to view": the board's
 *      box (every rendered node) against the FREE pane (the `.react-flow` box
 *      inset by the product's own `computeFitPadding()`), centred within 10% of
 *      its width, and the zoom at or above `LABEL_LEGIBLE_ZOOM` WHERE the board
 *      fits at that zoom — else `NOT_FITTABLE`, not failed. The same centring
 *      against the whole `.react-flow` box is recorded beside it.
 *      ⚠ "Fit to view" CLAIMS THE CAMERA and is unfloored, so the zoom is put
 *      back to LANDING's afterwards (from above: the LOD rung has hysteresis),
 *      and POST-RUN/STALE are asserted to be read on LANDING's rung.
 *
 * ⚠ BUDGET: (c) and (e) drive the UI (~1-4s a state) and their mechanisms do not
 *   depend on the board, so they run in all four states on Paul's two boards
 *   only (`interactionsOn`); (a), (b), (d) are DOM reads and run everywhere.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POSITIVE CONTROLS — IN THE SAME RUN, THROUGH THE SAME READERS (trap 13)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  (a) a 40px block planted into a real card at POST-RUN; the growth reader
 *      must flag exactly that card (a wrapper whose height is pinned by inline
 *      style could never "grow").
 *  (b) three spans planted into a real card: a self-clipping no-ellipsis span
 *      (b1 AND b2 must flag it), the driver MECHANISM as `FactorNode` builds it
 *      (block slot that clips > `display:flex` <button> with no width >
 *      `truncate` caption; b2 must flag it), and an ellipsised span that
 *      truncates (must NOT be flagged — the fix relies on the ellipsis).
 *  (c) a max-z block planted over the first menu item at POST-RUN; the reader
 *      must report that item occluded.
 *  (d) a VIRTUAL edge from a lower card to a higher one in the same band, in
 *      every state that has a multi-row band; the reader must flag it. Paul's
 *      two boards are REQUIRED to have one.
 *  (e) the camera dragged a quarter-pane (middle button) before LANDING's Fit;
 *      the centring reader must call it OFF-CENTRE.
 *
 * ⚠ THE READINGS ARE EMITTED AS `BSGJSON` / `BSGCTRL` / `BSGRELOAD` / `BSGTIME`
 *   LINES for a human; the verdict is the asserted counts, never a margin.
 */
import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BOARD_STATES_BOARDS, GATE_TAG } from './canvasGateSet'
import {
  openCanvas,
  preparePage,
  clearNotifications,
  minimiseFloatingOlumiPanel,
  waitForVisualQuiescence,
  readStarterDraft,
  FROZEN_TIME,
  type StarterId,
} from '../visual/harness'
import { repoRoot } from '../visual/repoRoot'
import { TIER_BY_KIND } from '../../src/canvas/utils/nodeLayoutConstants'
import { LABEL_LEGIBLE_ZOOM } from '../../src/canvas/utils/zoomLegibility'
import { GHOST_ID_PREFIX } from '../../src/canvas/utils/fitTargets'

const VIEWPORT = { width: 1280, height: 800 }

/** Tolerances. Layout px unless named. */
const GROWTH_TOLERANCE_PX = 1
const CLIP_TOLERANCE_PX = 1
/** Fraction of the SHORTER card's model height a same-band target may sit above its source. */
const ROW_TOLERANCE = 0.5
/** Board centre may sit this fraction of the free pane's width off the pane centre. */
const CENTRE_TOLERANCE = 0.1
/** Cards tried for (c) before the board is declared VACUOUS. */
const OCCLUSION_ATTEMPTS = 6

/* ── fixtures ───────────────────────────────────────────────────────────── */

type Json = Record<string, unknown>

interface MrrFixture {
  draft: { nodes: Json[]; edges: Json[]; goal_constraints: Json[] }
  analysis_ready: Json
  analysis_state: Json
  graph_hash: string
  analysis_block: { enrichment: { factor_sensitivity: Json[]; option_comparison: Json[]; flip_thresholds: Json[]; robustness: Json } & Json } & Json
}

const readMrr = (id: string): MrrFixture =>
  JSON.parse(readFileSync(join(repoRoot(), 'e2e', 'geometry', 'fixtures', `mrr-${id}.fixture.json`), 'utf8'))
/**
 * Paul's model in the TWO states his screenshots came from (see each file's
 * `_source.why`): 17d1cd3a carries the upward same-band link, 90b8f080 the
 * "of 6" driver caption and the menu-under-inspector. 90b8f080 is also the
 * shape template for the starters' planted runs.
 */
const MRR: MrrFixture = readMrr('90b8f080')

interface Board {
  name: string
  draft: Json
  envelope: Json
}

function envelopeOf(block: Json, analysisReady: Json, graphHash: string, analysisState?: Json): Json {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [block],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    analysis_ready: analysisReady,
    ...(analysisState ? { analysis_state: analysisState } : {}),
    graph_hash: graphHash,
  }
}

/**
 * ⚠ A PLANTED RUN for a starter, named as one. Built from the starter's OWN
 * draft (its factor and option ids) with the REAL MRR block's rows as the shape
 * template, so every field a card reads is present in the shape the wire sends:
 * every factor ranked (distinct, non-zero sensitivities — the rank licence
 * withholds ties and zeros), one FOUND turning point on the top factor.
 */
function starterRun(id: StarterId, draft: Json): Json {
  const nodes = draft.nodes as Json[]
  // Every node ISL can score is ranked — factors first, then outcomes and
  // risks — so `M` in "Driver N of M analysed" is the analysed count a real run
  // over this graph could report. On the 13-node starters that makes M two
  // digits: the LONG driver caption the D-2 brief names.
  const SCORED = ['factor', 'outcome', 'risk']
  const factors = nodes
    .filter((n) => SCORED.includes(String(n.kind)))
    .sort((a, b) => SCORED.indexOf(String(a.kind)) - SCORED.indexOf(String(b.kind)))
  const ar = draft.analysis_ready as Json
  const options = (ar.options as Json[]).map((o) => ({ id: String(o.id ?? o.option_id), label: String(o.label) }))
  const enr = MRR.analysis_block.enrichment
  const factorTemplate = enr.factor_sensitivity.find((r) => r.factor_id === 'other_mrr_growth') ?? enr.factor_sensitivity[0]
  const optionTemplate = enr.option_comparison[0]
  const flipTemplate = enr.flip_thresholds.find((r) => r.flip_reason === 'found')!
  const hash = `d2-${id}`

  const factor_sensitivity = factors.map((f, i) => {
    const s = Math.round((0.95 - 0.06 * i) * 1000) / 1000
    return {
      ...factorTemplate,
      factor_id: f.id,
      factor_label: f.label,
      influence_rank: i + 1,
      importance_rank: i + 1,
      influence_score: s,
      sensitivity_score: s,
      elasticity: s,
    }
  })
  const share = (i: number) => (i === 0 ? 0.46 : Math.round((0.54 / Math.max(1, options.length - 1)) * 1000) / 1000)
  const option_comparison = options.map((o, i) => ({
    ...optionTemplate,
    id: o.id,
    option_id: o.id,
    label: o.label,
    option_label: o.label,
    win_probability: share(i),
  }))
  const top = factors[0]
  const topState = (top?.observed_state ?? {}) as Json
  const current = typeof topState.raw_value === 'number' ? topState.raw_value : typeof topState.value === 'number' ? topState.value : 0.5
  const unit = typeof topState.unit === 'string' ? topState.unit : String(flipTemplate.unit)
  const flip = Math.round(current * 1.3 * 100) / 100 || 0.65
  const flip_thresholds = top
    ? [{
        ...flipTemplate,
        factor_id: top.id,
        factor_label: top.label,
        unit,
        current_value: current,
        flip_value: flip,
        current_display: `${current} ${unit}`,
        flip_display: `${flip} ${unit}`,
        alternative_winner_id: options[1]?.id ?? null,
        alternative_winner_label: options[1]?.label ?? null,
      }]
    : []

  const block = {
    type: 'analysis_result',
    summary: `Planted run for the D-2 geometry gate (${id}); not a captured analysis.`,
    leading_option_id: null,
    win_probabilities: Object.fromEntries(option_comparison.map((o) => [o.label, o.win_probability])),
    computed_against_hash: hash,
    enrichment: {
      option_comparison,
      factor_sensitivity,
      robustness: { ...enr.robustness, robust_edges: [], fragile_edges: [] },
      option_comparison_status: enr.option_comparison_status,
      confidence_tier: enr.confidence_tier,
      flip_thresholds,
    },
  }
  const analysisReady = {
    ...ar,
    freshness: 'fresh',
    freshness_reason: 'computed_against_current_graph',
    graph_hash_at_run: hash,
    current_graph_hash: hash,
    computed_at: FROZEN_TIME.toISOString(),
  }
  return envelopeOf(block, analysisReady, hash)
}

/** The board set is the GATE's (`BOARD_STATES_BOARDS`), so tests and registry cannot drift. */
function boards(): Board[] {
  return BOARD_STATES_BOARDS.map((name): Board => {
    if (name.startsWith('mrr-')) {
      const f = readMrr(name.slice('mrr-'.length))
      return { name, draft: f.draft as unknown as Json, envelope: envelopeOf(f.analysis_block, f.analysis_ready, f.graph_hash, f.analysis_state) }
    }
    const id = name as StarterId
    const draft = readStarterDraft(id) as Json // throws on a name that is not a starter
    return { name, draft, envelope: starterRun(id, draft) }
  })
}

/* ── in-page drivers ────────────────────────────────────────────────────── */

async function seedDraft(page: Page, draft: Json): Promise<number> {
  const r = await page.evaluate(async (d) => {
    // Held in a variable: the path exists only as a dev-server URL (TS2307 as a literal).
    const modulePath = '/src/canvas/utils/applyDraftResult.ts'
    const mod = (await import(/* @vite-ignore */ modulePath)) as { applyDraftResult: (p: unknown) => { nodeCount: number } }
    const applied = mod.applyDraftResult(d)
    const w = window as unknown as { useCanvasStore: { getState: () => { pendingLayout: boolean; layoutInProgress: boolean; layoutVersion: number } } }
    const deadline = Date.now() + 15_000
    while (Date.now() < deadline) {
      const s = w.useCanvasStore.getState()
      if (!s.pendingLayout && !s.layoutInProgress && s.layoutVersion > 0) break
      await new Promise((res) => setTimeout(res, 25))
    }
    const s = w.useCanvasStore.getState()
    return { nodeCount: applied.nodeCount, layoutVersion: s.layoutVersion, pending: s.pendingLayout || s.layoutInProgress }
  }, draft)
  expect(r.nodeCount, 'the draft seeded no nodes — applyDraftResult no-ops silently on an empty payload').toBeGreaterThan(0)
  expect(r.layoutVersion, 'layout never committed — the landing reading would be of a stacked graph').toBeGreaterThan(0)
  expect(r.pending, 'layout still pending at measure time').toBe(false)
  return r.nodeCount
}

async function deliverRun(page: Page, envelope: Json): Promise<void> {
  const r = await page.evaluate(async (env) => {
    const modulePath = '/src/v5/applyV5State.ts'
    const mod = (await import(/* @vite-ignore */ modulePath)) as {
      applyV5State: (r: unknown, s: unknown, o: unknown) => { applied: string[] }
    }
    const w = window as unknown as { useCanvasStore: { getState: () => Record<string, unknown> } }
    const snap = w.useCanvasStore.getState()
    const out = mod.applyV5State(
      env,
      { ...snap, currentResultsHash: (snap.results as { hash?: string } | null)?.hash ?? null, backfillGoalThreshold: () => {} },
      { turnClientId: 'measure', currentClientTurnId: 'measure' },
    )
    return { applied: out.applied, status: (w.useCanvasStore.getState().results as { status?: string }).status }
  }, envelope)
  // PINNED: a refused or deduped turn leaves a pre-run board that reads clean.
  expect(r.applied, 'the run did not hydrate results — POST-RUN would measure a pre-run board').toContain('analysis_result:results_hydrated')
  expect(r.status).toBe('complete')
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts?.ready)
  await clearNotifications(page)
  await minimiseFloatingOlumiPanel(page)
  await waitForVisualQuiescence(page)
}

/* ── the readers (serialised into the page; everything they use is inside) ── */

interface CardReading {
  id: string
  kind: string
  /** Store position (model px) — for "did the reload move it". */
  x: number
  y: number
  h: number
  w: number
  top: number
  left: number
  sh: number
  sw: number
  text: string
}
interface ClipHit { card: string; reading: 'b1' | 'b2'; el: string; clipper: string; overflowPx: number; text: string }
interface BoardReading {
  zoom: number
  cards: CardReading[]
  edges: Array<{ source: string; target: string }>
  clipped: ClipHit[]
  hiddenLines: number
  lastRunCues: number
  driverLines: number
  resultsStatus: string | null
  lodRung: string | null
  /** Every in-slot driver caption: its text, its glyph width and its slot's width (layout px). */
  driverCaptions: Array<{ card: string; text: string; textPx: number; slotPx: number }>
}

/** One reader for (a), (b) and (d)'s inputs. `scope` restricts (b) to elements inside it. */
function READ_BOARD(arg: { clipTol: number; scope: string | null }): BoardReading {
  const w = window as unknown as { useCanvasStore: { getState: () => Record<string, unknown> } }
  const s = w.useCanvasStore.getState()
  const vp = document.querySelector('.react-flow__viewport') as HTMLElement | null
  const zoom = vp ? new DOMMatrixReadOnly(getComputedStyle(vp).transform).a : 1
  const storeNodes = (s.nodes as Array<{ id: string; type?: string; position?: { x: number; y: number } }>) ?? []
  const kindOf = new Map(storeNodes.map((n) => [n.id, String(n.type ?? '')]))
  const posOf = new Map(storeNodes.map((n) => [n.id, n.position ?? { x: NaN, y: NaN }]))
  const els = [...document.querySelectorAll('.react-flow__node[data-id]')] as HTMLElement[]

  // A short, stable name: the test id where there is one (it names the slot),
  // else the first two classes — enough to find it, short enough to read.
  const describe = (el: Element): string => {
    const tid = el.getAttribute('data-testid')
    if (tid) return `${el.tagName.toLowerCase()}[${tid}]`
    const cls = (el.getAttribute('class') ?? '').split(/\s+/).filter((c) => c && !c.includes('[')).slice(0, 2).join('.')
    return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`
  }
  const clips = (v: string) => v === 'hidden' || v === 'clip'
  const isSrOnly = (el: HTMLElement, cs: CSSStyleDeclaration) =>
    (cs.clip && cs.clip !== 'auto') || (cs.clipPath && cs.clipPath !== 'none') || (el.clientWidth <= 1 && el.clientHeight <= 1)

  const clipped: ClipHit[] = []
  let hiddenLines = 0
  for (const card of els) {
    const cardId = card.dataset.id ?? '?'
    const scale = card.offsetWidth > 0 ? card.getBoundingClientRect().width / card.offsetWidth : 1
    const all = [...card.querySelectorAll('*')] as HTMLElement[]
    for (const el of all) {
      if (!(el instanceof HTMLElement)) continue
      if (arg.scope && !el.closest(arg.scope)) continue
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || isSrOnly(el, cs)) continue
      const text = (el.textContent ?? '').trim()
      const runs = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim())
      if (!runs.length) continue
      // b1 — its OWN text overflows its own clipping box with no ellipsis.
      // (Own text only: a container whose overflowing CHILD wraps whole onto a
      // clipped line — the option share line's designed whole-or-nothing
      // caption — hides a part, it does not cut a glyph; b2 judges children.)
      if (clips(cs.overflowX) && el.scrollWidth > el.clientWidth + arg.clipTol && cs.textOverflow !== 'ellipsis') {
        clipped.push({ card: cardId, reading: 'b1', el: describe(el), clipper: describe(el), overflowPx: el.scrollWidth - el.clientWidth, text: text.slice(0, 60) })
      }
      // b2 — the same runs, walked from the text up to the card.
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity
      for (const n of runs) {
        const range = document.createRange()
        range.selectNodeContents(n)
        for (const q of range.getClientRects()) {
          if (q.width === 0 && q.height === 0) continue
          l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom)
        }
      }
      if (!Number.isFinite(l)) continue
      // `inlineChain`: every element from `el` up to (not including) `n` is
      // display:inline — i.e. the run is in `n`'s own inline flow, the only case
      // where `n`'s text-overflow ellipsis actually ends the visible text.
      let inlineChain = true
      for (let n: HTMLElement | null = el; n && n !== card.parentElement; n = n.parentElement) {
        const ncs = n === el ? cs : getComputedStyle(n)
        const cx = clips(ncs.overflowX)
        const cy = clips(ncs.overflowY)
        if (cx || cy) {
          const nr = n.getBoundingClientRect()
          const bl = nr.left + parseFloat(ncs.borderLeftWidth) * scale
          const br = nr.right - parseFloat(ncs.borderRightWidth) * scale
          const bt = nr.top + parseFloat(ncs.borderTopWidth) * scale
          const bb = nr.bottom - parseFloat(ncs.borderBottomWidth) * scale
          const tol = arg.clipTol * scale
          // Wholly outside a clipper (either axis) = HIDDEN, not cut: counted
          // and reported, never flagged — a designed whole-or-nothing wrap.
          if ((cx && (l >= br || r <= bl)) || (cy && (t >= bb || b <= bt))) { hiddenLines++; break }
          if (cx && (r > br + tol || l < bl - tol)) {
            if (ncs.textOverflow === 'ellipsis' && inlineChain) {
              l = Math.max(l, bl); r = Math.min(r, br)
            } else {
              clipped.push({ card: cardId, reading: 'b2', el: describe(el), clipper: describe(n), overflowPx: Math.round((Math.max(r - br, bl - l) / scale) * 10) / 10, text: text.slice(0, 60) })
              break
            }
          }
          // Vertically a glyph's content box legitimately overhangs a tight line
          // box (`leading-none` + `truncate`) by a fraction of its font size;
          // a line cut through is more than that.
          const tolY = Math.max(tol, 0.4 * parseFloat(cs.fontSize) * scale)
          if (cy && (b > bb + tolY || t < bt - tolY)) {
            const clamp = ncs.getPropertyValue('-webkit-line-clamp')
            if (clamp && clamp !== 'none') {
              t = Math.max(t, bt); b = Math.min(b, bb)
            } else {
              clipped.push({ card: cardId, reading: 'b2', el: describe(el), clipper: describe(n), overflowPx: Math.round((Math.max(b - bb, bt - t) / scale) * 10) / 10, text: text.slice(0, 60) })
              break
            }
          }
        }
        inlineChain = inlineChain && ncs.display === 'inline'
      }
    }
  }

  const cards: CardReading[] = els.map((el) => {
    const rr = el.getBoundingClientRect()
    return {
      id: el.dataset.id ?? '?',
      kind: kindOf.get(el.dataset.id ?? '') ?? '',
      x: Math.round(posOf.get(el.dataset.id ?? '')?.x ?? NaN),
      y: Math.round(posOf.get(el.dataset.id ?? '')?.y ?? NaN),
      h: el.offsetHeight,
      w: el.offsetWidth,
      top: rr.top,
      left: rr.left,
      sh: rr.height,
      sw: rr.width,
      text: (el.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 140),
    }
  })
  const texts = els.map((e) => e.innerText ?? '')
  return {
    zoom,
    cards,
    edges: ((s.edges as Array<{ source: string; target: string }>) ?? []).map((e) => ({ source: e.source, target: e.target })),
    clipped,
    hiddenLines,
    lastRunCues: texts.filter((t) => t.includes('Last run')).length,
    driverLines: texts.filter((t) => /Driver \d+ of \d+/.test(t)).length,
    resultsStatus: ((s.results as { status?: string } | null)?.status) ?? null,
    lodRung: typeof s.lodRung === 'string' ? s.lodRung : null,
    driverCaptions: [...document.querySelectorAll('[data-testid^="factor-driver-slot-"]')].flatMap((slot) => {
      const cap = slot.querySelector('[data-testid$="-caption"]')
      const card = slot.closest('.react-flow__node') as HTMLElement | null
      if (!cap || !card) return []
      const k = card.getBoundingClientRect().width / Math.max(1, card.offsetWidth)
      const range = document.createRange()
      range.selectNodeContents(cap)
      return [{
        card: card.dataset.id ?? '?',
        text: (cap.textContent ?? '').trim(),
        textPx: Math.round(range.getBoundingClientRect().width / k),
        slotPx: (slot as HTMLElement).clientWidth,
      }]
    }),
  }
}

/* ── pure verdicts (Node side) ──────────────────────────────────────────── */

function growth(landing: Map<string, number>, now: CardReading[]): Array<{ id: string; from: number; to: number }> {
  return now
    .filter((c) => landing.has(c.id) && c.h > (landing.get(c.id) as number) + GROWTH_TOLERANCE_PX)
    .map((c) => ({ id: c.id, from: landing.get(c.id) as number, to: c.h }))
}

interface UpwardLink { source: string; target: string; band: number; upModelPx: number; tolModelPx: number }

function bandOf(kind: string): number {
  return TIER_BY_KIND[kind] ?? 2
}

function upwardSameBand(reading: BoardReading, edges = reading.edges): UpwardLink[] {
  const byId = new Map(reading.cards.map((c) => [c.id, c]))
  const out: UpwardLink[] = []
  for (const e of edges) {
    const s = byId.get(e.source)
    const t = byId.get(e.target)
    if (!s || !t || !s.kind || !t.kind) continue
    if (bandOf(s.kind) !== bandOf(t.kind)) continue
    const up = (s.top - t.top) / reading.zoom
    const tol = (ROW_TOLERANCE * Math.min(s.sh, t.sh)) / reading.zoom
    if (up > tol) out.push({ source: e.source, target: e.target, band: bandOf(s.kind), upModelPx: Math.round(up), tolModelPx: Math.round(tol) })
  }
  return out
}

/** (d)'s positive control: a same-band pair whose second card sits a row above the first. */
function plantedUpwardPair(reading: BoardReading): { source: string; target: string } | null {
  const real = reading.cards.filter((c) => c.kind && !c.id.startsWith(GHOST_ID_PREFIX))
  for (const s of real) {
    for (const t of real) {
      if (s === t || bandOf(s.kind) !== bandOf(t.kind)) continue
      if ((s.top - t.top) / reading.zoom > (ROW_TOLERANCE * Math.min(s.sh, t.sh)) / reading.zoom) return { source: s.id, target: t.id }
    }
  }
  return null
}

/* ── (a) and (b) positive controls ──────────────────────────────────────── */

async function plantHeightControl(page: Page, cardId: string, remove = false): Promise<void> {
  await page.evaluate(({ id, rm }) => {
    const card = document.querySelector(`.react-flow__node[data-id="${id}"]`)
    const host = card?.firstElementChild ?? card
    if (!host) throw new Error(`[d2] no card ${id} to plant the growth control in`)
    if (rm) { host.querySelector('[data-d2-grow]')?.remove(); return }
    const d = document.createElement('div')
    d.setAttribute('data-d2-grow', '')
    d.style.height = '40px'
    host.appendChild(d)
  }, { id: cardId, rm: remove })
  await page.waitForTimeout(50)
}

async function plantClipControls(page: Page, cardId: string, remove = false): Promise<void> {
  await page.evaluate(({ id, rm }) => {
    // Into the node WRAPPER, not its first child: a card's first child can be a
    // zero-width static wrapper, and the controls must not depend on it.
    const host = document.querySelector(`.react-flow__node[data-id="${id}"]`)
    if (!host) throw new Error(`[d2] no card ${id} to plant the clip controls in`)
    if (rm) { host.querySelectorAll('[data-d2-planted]').forEach((e) => e.remove()); return }
    const long = 'Last run · Driver 1 of 6 analysed — planted control'
    const wrap = document.createElement('div')
    wrap.setAttribute('data-d2-planted', '')
    wrap.style.cssText = 'position:absolute;left:4px;top:4px;width:60px;font-size:12px;line-height:16px;pointer-events:none;z-index:1;'
    // 1. clips itself, no ellipsis → b1 AND b2
    const self = document.createElement('span')
    self.setAttribute('data-testid', 'd2-plant-selfclip')
    self.style.cssText = 'display:block;width:60px;overflow:hidden;white-space:nowrap;'
    self.textContent = long
    // 2. the driver MECHANISM, as `FactorNode` + `FactorDriverLine` (inSlot) build
    //    it: a BLOCK slot that clips, holding a `display:flex` <button> with no
    //    width — a button sizes to fit its content, so the `truncate` caption
    //    is never narrower than its text and the SLOT cuts it → b2
    const slot = document.createElement('div')
    slot.setAttribute('data-testid', 'd2-plant-slot')
    slot.style.cssText = 'display:block;width:60px;height:16px;min-width:0;overflow:hidden;'
    const btn = document.createElement('button')
    btn.style.cssText = 'display:flex;height:100%;min-width:0;flex-wrap:nowrap;align-items:center;white-space:nowrap;padding:0;border:0;background:none;font:inherit;'
    const cap = document.createElement('span')
    cap.setAttribute('data-testid', 'd2-plant-caption')
    cap.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
    cap.textContent = long
    btn.appendChild(cap)
    slot.appendChild(btn)
    // 3. NEGATIVE control: an ellipsis that truncates → must NOT be flagged
    const ell = document.createElement('span')
    ell.setAttribute('data-testid', 'd2-plant-ellipsis')
    ell.style.cssText = 'display:block;width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
    ell.textContent = long
    wrap.append(self, slot, ell)
    host.appendChild(wrap)
  }, { id: cardId, rm: remove })
}

/* ── (c) overlay occlusion ──────────────────────────────────────────────── */

interface OcclusionReading {
  card: string | null
  tried: string[]
  overlapPx: number
  items: number
  occluded: Array<{ label: string; top: string }>
  control: { plantedDetected: boolean } | null
}

function READ_MENU(): { menu: boolean; overlap: number; items: Array<{ label: string; ok: boolean; top: string }> } {
  const menu = document.querySelector('[role="menu"][aria-label="Canvas context menu"]')
  const insp = document.querySelector('[role="dialog"][aria-label="Node inspector"]')
  if (!menu) return { menu: false, overlap: 0, items: [] }
  const mr = menu.getBoundingClientRect()
  const ir = insp?.getBoundingClientRect()
  const overlap = ir
    ? Math.max(0, Math.min(mr.right, ir.right) - Math.max(mr.left, ir.left)) * Math.max(0, Math.min(mr.bottom, ir.bottom) - Math.max(mr.top, ir.top))
    : 0
  const items = [...menu.querySelectorAll('[role="menuitem"]')].map((it) => {
    const r = it.getBoundingClientRect()
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    const owner = top?.closest('[role="dialog"]')?.getAttribute('aria-label')
    return {
      label: (it.textContent ?? '').trim().slice(0, 40),
      ok: !!top && it.contains(top),
      top: top ? `${owner ? `${owner} > ` : ''}${top.tagName.toLowerCase()}${top.getAttribute('data-d2-occluder') !== null ? '[d2-occluder]' : ''}` : 'null',
    }
  })
  return { menu: true, overlap: Math.round(overlap), items }
}

async function closeOverlays(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const open = await page.evaluate(() => !!document.querySelector('[role="menu"][aria-label="Canvas context menu"], [role="dialog"][aria-label="Node inspector"]'))
    if (!open) break
    await page.keyboard.press('Escape')
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  }
  await page.evaluate(() => {
    const w = window as unknown as { useCanvasStore: { getState: () => { clearSelection?: () => void } } }
    w.useCanvasStore.getState().clearSelection?.()
  })
}

async function probeOcclusion(page: Page, reading: BoardReading, withControl: boolean, preferred: string | null): Promise<OcclusionReading> {
  const order = ['factor', 'option', 'risk', 'outcome']
  // The card that gave a case in an earlier state is tried first (cost: one
  // attempt per state instead of up to OCCLUSION_ATTEMPTS); then by kind, then
  // LEFTMOST first — the inspector opens to a card's right, so a card with room
  // there keeps its own "…" reachable (measured: centre-column cards had theirs
  // covered and cost ~2s each to rule out).
  const rank = (id: string, kind: string) => (id === preferred ? -1 : order.indexOf(kind))
  const candidates = reading.cards
    .filter((c) => !c.id.startsWith(GHOST_ID_PREFIX) && order.includes(c.kind))
    .sort((a, b) => rank(a.id, a.kind) - rank(b.id, b.kind) || a.left - b.left)
    .slice(0, OCCLUSION_ATTEMPTS)
  const tried: string[] = []
  for (const c of candidates) {
    tried.push(c.id)
    const node = page.locator(`.react-flow__node[data-id="${c.id}"]`)
    const ok = await node.click({ position: { x: 16, y: 12 }, timeout: 1_500 }).then(() => true, () => false)
    if (!ok) { await closeOverlays(page); continue }
    const inspector = await page.locator('[role="dialog"][aria-label="Node inspector"]').waitFor({ state: 'visible', timeout: 3_000 }).then(() => true, () => false)
    if (!inspector) { await closeOverlays(page); continue }
    const box = await node.boundingBox()
    if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    // ⚠ Only a "…" the user can actually reach is clicked. If the inspector
    // already covers it, a click would land on the inspector: that card is not
    // a case (skipped, never counted as a pass), and no time is spent waiting.
    const reachable = await page.evaluate((id) => {
      const b = document.querySelector(`[data-testid="node-action-menu-${id}"]`)
      if (!b) return false
      const r = b.getBoundingClientRect()
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return r.width > 0 && !!top && b.contains(top)
    }, c.id)
    if (!reachable) { await closeOverlays(page); continue }
    await page.getByTestId(`node-action-menu-${c.id}`).click({ timeout: 2_000 }).catch(() => undefined)
    await page.locator('[role="menu"][aria-label="Canvas context menu"]').waitFor({ state: 'visible', timeout: 2_000 }).catch(() => undefined)
    const m = await page.evaluate(READ_MENU)
    if (!m.menu || m.overlap === 0) { await closeOverlays(page); continue }

    let control: OcclusionReading['control'] = null
    if (withControl) {
      await page.evaluate(() => {
        const it = document.querySelector('[role="menu"][aria-label="Canvas context menu"] [role="menuitem"]')
        if (!it) return
        const r = it.getBoundingClientRect()
        const d = document.createElement('div')
        d.setAttribute('data-d2-occluder', '')
        d.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:2147483647;pointer-events:auto;`
        document.body.appendChild(d)
      })
      const planted = await page.evaluate(READ_MENU)
      await page.evaluate(() => document.querySelector('[data-d2-occluder]')?.remove())
      control = { plantedDetected: planted.items.length > 0 && !planted.items[0].ok && planted.items[0].top.includes('d2-occluder') }
    }
    const real = await page.evaluate(READ_MENU)
    await closeOverlays(page)
    return {
      card: c.id,
      tried,
      overlapPx: real.overlap,
      items: real.items.length,
      occluded: real.items.filter((i) => !i.ok).map((i) => ({ label: i.label, top: i.top })),
      control,
    }
  }
  return { card: null, tried, overlapPx: 0, items: 0, occluded: [], control: null }
}

/* ── (e) fit ────────────────────────────────────────────────────────────── */

interface FitReading {
  zoom: number
  /** |board centre − free-pane centre| / free-pane width. The verdict's reading. */
  offCentreFrac: number
  /** The same against the whole `.react-flow` box (which runs under the dock). */
  offCentreOfCanvasFrac: number
  fittableAtFloor: boolean
  centring: 'CENTRED' | 'OFF_CENTRE'
  /** NOT_FITTABLE: the board cannot fit the free pane at the floor, so a Fit below it is not a defect. */
  floor: 'AT_OR_ABOVE_FLOOR' | 'BELOW_FLOOR' | 'NOT_FITTABLE'
  boardModel: { w: number; h: number }
  freePane: { l: number; r: number; w: number; h: number }
}

async function readFit(page: Page): Promise<Omit<FitReading, 'centring' | 'floor' | 'fittableAtFloor'> & { fitsAt: (z: number) => boolean }> {
  const r = await page.evaluate(async () => {
    const modulePath = '/src/canvas/utils/computeFitPadding.ts'
    const mod = (await import(/* @vite-ignore */ modulePath)) as { computeFitPadding: () => { top: string; right: string; bottom: string; left: string } }
    // The product's OWN padding — what "Fit to view" passes to fitView — so the
    // free pane is the area the product itself means to fit into (dock, tools
    // rail, top bar and overlay bands excluded), not a second definition of it.
    const pad = mod.computeFitPadding()
    const px = (v: string) => parseFloat(v) || 0
    const rf = (document.querySelector('.react-flow') as HTMLElement).getBoundingClientRect()
    const free = { l: rf.left + px(pad.left), r: rf.right - px(pad.right), t: rf.top + px(pad.top), b: rf.bottom - px(pad.bottom) }
    const vp = document.querySelector('.react-flow__viewport') as HTMLElement
    const zoom = new DOMMatrixReadOnly(getComputedStyle(vp).transform).a
    let l = Infinity, t = Infinity, rr = -Infinity, b = -Infinity
    for (const n of document.querySelectorAll('.react-flow__node[data-id]')) {
      const q = n.getBoundingClientRect()
      l = Math.min(l, q.left); t = Math.min(t, q.top); rr = Math.max(rr, q.right); b = Math.max(b, q.bottom)
    }
    return { zoom, free, rf: { l: rf.left, r: rf.right }, box: { l, t, r: rr, b } }
  })
  const freeW = r.free.r - r.free.l
  const freeH = r.free.b - r.free.t
  const boardW = (r.box.r - r.box.l) / r.zoom
  const boardH = (r.box.b - r.box.t) / r.zoom
  const centre = (r.box.l + r.box.r) / 2
  const round = (v: number) => Math.round(v * 1000) / 1000
  return {
    zoom: round(r.zoom),
    offCentreFrac: round(Math.abs(centre - (r.free.l + r.free.r) / 2) / freeW),
    offCentreOfCanvasFrac: round(Math.abs(centre - (r.rf.l + r.rf.r) / 2) / (r.rf.r - r.rf.l)),
    boardModel: { w: Math.round(boardW), h: Math.round(boardH) },
    freePane: { l: Math.round(r.free.l), r: Math.round(r.free.r), w: Math.round(freeW), h: Math.round(freeH) },
    fitsAt: (z: number) => boardW * z <= freeW + 1 && boardH * z <= freeH + 1,
  }
}

/** A point on EMPTY pane (hit-tested), for the camera moves below. */
async function emptyPanePoint(page: Page): Promise<{ x: number; y: number; w: number } | null> {
  return page.evaluate(() => {
    const rf = (document.querySelector('.react-flow') as HTMLElement).getBoundingClientRect()
    for (let fy = 0.2; fy < 0.95; fy += 0.1) {
      for (let fx = 0.15; fx < 0.7; fx += 0.05) {
        const x = rf.left + rf.width * fx
        const y = rf.top + rf.height * fy
        if (document.elementFromPoint(x, y)?.classList.contains('react-flow__pane')) return { x, y, w: rf.width }
      }
    }
    return null
  })
}

/**
 * ⚠ "Fit to view" CLAIMS THE CAMERA and is unfloored, so on a board that cannot
 * fit at `LABEL_LEGIBLE_ZOOM` it drops below it — where the LOD rung and the
 * label counter-scale change every card's content. Left alone, that would move
 * the ZOOM under every later state's (a)/(b) reading and confound "the run grew
 * this card" with "the camera changed its rung". So the zoom is put back with
 * the product's own wheel zoom (d3: k·2^(−Δy·0.002)) and RE-READ; the achieved
 * zoom is recorded with every state, never assumed.
 */
async function restoreZoom(page: Page, target: number): Promise<number> {
  const zoomNow = () => page.evaluate(() => new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.react-flow__viewport') as HTMLElement).transform).a)
  const wheelTo = async (goal: number) => {
    for (let i = 0; i < 3; i++) {
      const k = await zoomNow()
      if (Math.abs(k - goal) < 1e-3) return
      const at = await emptyPanePoint(page)
      if (!at) return
      await page.mouse.move(at.x, at.y)
      await page.mouse.wheel(0, -Math.log2(goal / k) / 0.002)
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    }
  }
  if (Math.abs((await zoomNow()) - target) < 1e-3) return zoomNow()
  // ⚠ THE LOD RUNG HAS HYSTERESIS (`resolveLodRung`, re-entry margin 1.08): a
  // Fit that dipped below `LABEL_LEGIBLE_ZOOM` leaves the rung at `quiet`, and
  // wheeling back to 0.4999 keeps it there — measured, every card 48px short.
  // So the zoom is approached FROM ABOVE, as the landing fit approached it.
  await wheelTo(target * 1.2)
  await wheelTo(target)
  return zoomNow()
}

async function probeFit(page: Page, restoreTo: number, withControl: boolean): Promise<{ fit: FitReading; control: { draggedOffCentreFrac: number } | null; zoomRestoredTo: number }> {
  // POSITIVE CONTROL (once a board): pan a quarter-pane with the MIDDLE button
  // (select mode pans on button 1 only — `SELECT_MODE_PAN_BUTTONS`), then read
  // the centring. The Fit below then has a camera to move.
  let dragged = -1
  const at = withControl ? await emptyPanePoint(page) : null
  if (at) {
    await page.mouse.move(at.x, at.y)
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(at.x + at.w * 0.25, at.y, { steps: 8 })
    await page.mouse.up({ button: 'middle' })
    await page.waitForTimeout(120)
    dragged = (await readFit(page)).offCentreFrac
  }
  await page.getByRole('button', { name: 'Fit to view' }).click()
  await waitForVisualQuiescence(page)
  const m = await readFit(page)
  const fittable = m.fitsAt(LABEL_LEGIBLE_ZOOM)
  const centring: FitReading['centring'] = m.offCentreFrac > CENTRE_TOLERANCE ? 'OFF_CENTRE' : 'CENTRED'
  const floor: FitReading['floor'] = !fittable ? 'NOT_FITTABLE' : m.zoom + 1e-3 < LABEL_LEGIBLE_ZOOM ? 'BELOW_FLOOR' : 'AT_OR_ABOVE_FLOOR'
  // No settle here: every caller settles before its next reading.
  const zoomRestoredTo = Math.round((await restoreZoom(page, restoreTo)) * 1000) / 1000
  return {
    fit: { zoom: m.zoom, offCentreFrac: m.offCentreFrac, offCentreOfCanvasFrac: m.offCentreOfCanvasFrac, fittableAtFloor: fittable, centring, floor, boardModel: m.boardModel, freePane: m.freePane },
    control: withControl ? { draggedOffCentreFrac: dragged } : null,
    zoomRestoredTo,
  }
}

/* ── (b) the long-caption stress ────────────────────────────────────────── */

/**
 * ⭐ "Last run · Driver 1 of 6 analysec" DEPENDS ON THE FONT, AND THIS GATE HAS
 * NOT GOT PAUL'S. The hermetic network aborts Google Fonts, so every card here
 * renders in the platform fallback, not Inter — and in the fallback the natural
 * captions FIT: measured at `02422c39`, "Last run · Driver 1 of 6 analysed"
 * 217px in a 223px slot, "… 3 of 13 analysed" 224px (1px over, inside the
 * tolerance). So a reading of the natural caption is a reading of the font.
 *
 * The defect is not the font; it is that the in-slot line CANNOT truncate (a
 * shrink-to-fit <button> never makes its `truncate` caption narrower than its
 * text). So the STALE state also reads every real in-slot caption LENGTHENED IN
 * PLACE — its own text node's data, restored straight after, so React's node is
 * never replaced — past any slot: a correct line ends in "…", a broken one is
 * cut by the slot. Font-independent, and it goes red on exactly the mechanism.
 */
const LONG_CAPTION_SUFFIX = ' — long-caption stress, well past any slot'

async function stressDriverCaptions(page: Page, on: boolean): Promise<number> {
  return page.evaluate(({ on, suffix }) => {
    let n = 0
    for (const slot of document.querySelectorAll('[data-testid^="factor-driver-slot-"]')) {
      const cap = slot.querySelector('[data-testid$="-caption"]')
      const t = cap?.firstChild
      if (!cap || !t || t.nodeType !== Node.TEXT_NODE) continue
      const node = t as Text & { __d2Original?: string }
      if (on) {
        node.__d2Original = node.data
        node.data = node.data + suffix
        slot.setAttribute('data-d2-stressed', '')
        n++
      } else if (node.__d2Original !== undefined) {
        node.data = node.__d2Original
        delete node.__d2Original
        slot.removeAttribute('data-d2-stressed')
        n++
      }
    }
    return n
  }, { on, suffix: LONG_CAPTION_SUFFIX })
}

/* ── one state ──────────────────────────────────────────────────────────── */

type StateName = 'LANDING' | 'POST-RUN' | 'STALE' | 'RELOAD'

interface StateResult {
  state: StateName
  zoom: number
  lodRung: string | null
  growth: Array<{ id: string; from: number; to: number }>
  growthZoom: number
  clipped: ClipHit[]
  longCaption: { stressed: number; clipped: ClipHit[] } | null
  hiddenLines: number
  occlusion: OcclusionReading | null
  upward: UpwardLink[]
  dControl: { probeable: boolean; detected: boolean }
  fit: FitReading | null
  fitControl: { draggedOffCentreFrac: number } | null
  zoomRestoredTo: number | null
  cues: { lastRun: number; driverLines: number; resultsStatus: string | null }
  driverCaptions: BoardReading['driverCaptions']
  ms: { read: number; c: number; e: number }
}

interface StateOptions {
  landing: { heights: Map<string, number>; zoom: number } | null
  /** (c) and (e) — the two probes that drive the UI. */
  interactions: boolean
  preferredOcclusionCard: string | null
  occlusionControl: boolean
  fitControl: boolean
}

async function measureState(page: Page, board: string, state: StateName, o: StateOptions): Promise<{ result: StateResult; reading: BoardReading }> {
  const tRead = Date.now()
  const reading = await page.evaluate(READ_BOARD, { clipTol: CLIP_TOLERANCE_PX, scope: null })
  expect(reading.cards.filter((c) => !c.id.startsWith(GHOST_ID_PREFIX)).length, `${board} ${state}: no cards rendered — every zero below would be about nothing`).toBeGreaterThan(0)

  // (b) the long-caption stress, where the model is known changed ("Last run ·")
  let longCaption: StateResult['longCaption'] = null
  if (state === 'STALE') {
    const stressed = await stressDriverCaptions(page, true)
    const r = await page.evaluate(READ_BOARD, { clipTol: CLIP_TOLERANCE_PX, scope: '[data-d2-stressed]' })
    await stressDriverCaptions(page, false)
    longCaption = { stressed, clipped: r.clipped }
  }
  const msRead = Date.now() - tRead

  // (d) with its control
  const upward = upwardSameBand(reading)
  const pair = plantedUpwardPair(reading)
  const dControl = { probeable: pair !== null, detected: pair ? upwardSameBand(reading, [pair]).length === 1 : false }

  let occlusion: OcclusionReading | null = null
  let fit: FitReading | null = null
  let fitControl: StateResult['fitControl'] = null
  let zoomRestoredTo: number | null = null
  const tC = Date.now()
  if (o.interactions) occlusion = await probeOcclusion(page, reading, o.occlusionControl, o.preferredOcclusionCard)
  const msC = Date.now() - tC
  const tE = Date.now()
  if (o.interactions) {
    // (e) last: it moves the camera. The zoom goes back to THE LANDING ZOOM, so
    // every later state is read at the zoom LANDING was read at (the card click
    // in (c) can move the camera too — measured, 0.569 → 0.554).
    const e = await probeFit(page, o.landing?.zoom ?? reading.zoom, o.fitControl)
    fit = e.fit
    fitControl = e.control
    zoomRestoredTo = e.zoomRestoredTo
  }
  const msE = Date.now() - tE

  // (a) is only a statement about the RUN when both readings share a zoom: the
  // label counter-scale and the LOD rung move card height with the camera. A
  // state read at another zoom (RELOAD lands on its own restore fit) is read
  // AGAIN at the landing zoom for (a); both zooms are recorded.
  let growthReading = reading
  if (o.landing && Math.abs(reading.zoom - o.landing.zoom) >= 1e-3) {
    const k = await restoreZoom(page, o.landing.zoom)
    await waitForVisualQuiescence(page)
    if (Math.abs(k - o.landing.zoom) < 1e-3) growthReading = await page.evaluate(READ_BOARD, { clipTol: CLIP_TOLERANCE_PX, scope: '[data-d2-none]' })
  }

  const result: StateResult = {
    state,
    zoom: Math.round(reading.zoom * 1000) / 1000,
    lodRung: reading.lodRung,
    growth: o.landing ? growth(o.landing.heights, growthReading.cards) : [],
    growthZoom: Math.round(growthReading.zoom * 1000) / 1000,
    clipped: reading.clipped,
    longCaption,
    hiddenLines: reading.hiddenLines,
    occlusion,
    upward,
    dControl,
    fit,
    fitControl,
    zoomRestoredTo,
    cues: { lastRun: reading.lastRunCues, driverLines: reading.driverLines, resultsStatus: reading.resultsStatus },
    driverCaptions: reading.driverCaptions,
    ms: { read: msRead, c: msC, e: msE },
  }
  // eslint-disable-next-line no-console
  console.log(`BSGJSON ${JSON.stringify({ board, ...result, cards: reading.cards.map((c) => [c.id, c.h, c.x, c.y]) })}`)
  return { result, reading }
}

/* ── the arms ───────────────────────────────────────────────────────────── */

/**
 * ⚠ THE BUDGET SHAPED THIS, AND IT IS STATED RATHER THAN HIDDEN. (c) and (e)
 * DRIVE THE UI — a card click, a menu, a camera drag, the real "Fit to view",
 * a zoom restore — at ~1-4s a state, and their mechanisms do not depend on the
 * board (a menu's layer against the inspector's; the Fit's padding maths). So
 * they run in all four states on Paul's two boards, where both were reported,
 * and not on the five starters. (a), (b) and (d) are DOM reads (~10ms) and run
 * everywhere. Measured on this lane before the trim, every starter in every
 * state: (c) occluded 6-9 of 9 menu items on all of them, and (e) read
 * OFF_CENTRE 0.13-0.15 and NOT_FITTABLE on all five — the same answers the two
 * MRR boards give, so the trim loses coverage of no distinct behaviour.
 */
const interactionsOn = (board: string) => board.startsWith('mrr-')

test.describe('board states geometry', () => {
  for (const board of boards()) {
    test(`BOARD STATES @${board.name} 1280x800`, { tag: GATE_TAG }, async ({ page }) => {
      const t0 = Date.now()
      const time: Record<string, number> = {}
      const lap = (k: string) => { time[k] = Date.now() - t0 - Object.values(time).reduce((a, b) => a + b, 0) }
      const interactions = interactionsOn(board.name)

      await preparePage(page, VIEWPORT)
      await openCanvas(page)
      lap('open')
      const nodeCount = await seedDraft(page, board.draft)
      lap('seedDraft')
      await settle(page)
      lap('seed')

      const results: StateResult[] = []

      // ── LANDING
      const L = await measureState(page, board.name, 'LANDING', {
        landing: null, interactions, preferredOcclusionCard: null, occlusionControl: false, fitControl: true,
      })
      results.push(L.result)
      const landing = { heights: new Map(L.reading.cards.map((c) => [c.id, c.h])), zoom: L.reading.zoom }
      lap('landing')

      // ── POST-RUN
      await deliverRun(page, board.envelope)
      await settle(page)
      const P = await measureState(page, board.name, 'POST-RUN', {
        landing, interactions, preferredOcclusionCard: L.result.occlusion?.card ?? null, occlusionControl: true, fitControl: false,
      })
      results.push(P.result)
      // PRECONDITION: the run reached the cards, or POST-RUN is a second LANDING.
      expect(P.reading.driverLines, `${board.name} POST-RUN: no card shows "Driver N of M" — the run never reached the cards`).toBeGreaterThan(0)

      // (a) positive control, through the same reader
      await waitForVisualQuiescence(page)
      const base = await page.evaluate(READ_BOARD, { clipTol: CLIP_TOLERANCE_PX, scope: '[data-d2-none]' })
      const target = base.cards.find((c) => c.kind === 'factor') ?? base.cards[0]
      await plantHeightControl(page, target.id)
      const grown = await page.evaluate(READ_BOARD, { clipTol: CLIP_TOLERANCE_PX, scope: '[data-d2-none]' })
      await plantHeightControl(page, target.id, true)
      const aControl = growth(new Map(base.cards.map((c) => [c.id, c.h])), grown.cards).map((g) => g.id)

      // (b) positive + negative controls, through the same reader
      await plantClipControls(page, target.id)
      const planted = await page.evaluate(READ_BOARD, { clipTol: CLIP_TOLERANCE_PX, scope: '[data-d2-planted]' })
      await plantClipControls(page, target.id, true)
      const hit = (tid: string, reading: 'b1' | 'b2') => planted.clipped.some((c) => c.reading === reading && c.el.includes(tid))
      const bControl = {
        selfB1: hit('d2-plant-selfclip', 'b1'),
        selfB2: hit('d2-plant-selfclip', 'b2'),
        mechanismB2: hit('d2-plant-caption', 'b2'),
        ellipsisFlagged: planted.clipped.some((c) => c.el.includes('d2-plant-ellipsis')),
      }
      lap('postRun')

      // ── STALE
      await page.evaluate(() => {
        const w = window as unknown as { useCanvasStore: { getState: () => { markAnalysisFreshnessDirty: () => void } } }
        w.useCanvasStore.getState().markAnalysisFreshnessDirty()
      })
      await settle(page)
      const S = await measureState(page, board.name, 'STALE', {
        landing, interactions, preferredOcclusionCard: P.result.occlusion?.card ?? null, occlusionControl: false, fitControl: false,
      })
      results.push(S.result)
      expect(S.reading.lastRunCues, `${board.name} STALE: no card carries "Last run" — the model was not marked changed`).toBeGreaterThan(0)
      expect(S.result.longCaption?.stressed ?? 0, `${board.name} STALE: no in-slot driver caption to stress — the long-caption reading is about nothing`).toBeGreaterThan(0)
      lap('stale')

      // ── RELOAD
      const carried = await page.evaluate(() => {
        const out: Record<string, string> = {}
        for (const k of Object.keys(localStorage)) out[k] = localStorage.getItem(k) ?? ''
        return out
      })
      expect(Object.keys(carried).some((k) => k.startsWith('olumi-canvas-autosave') || k === 'canvas-storage'), 'nothing persisted — a reload would restore nothing').toBe(true)
      await page.addInitScript((c: Record<string, string>) => {
        try { for (const [k, v] of Object.entries(c)) localStorage.setItem(k, v) } catch { /* the node-count pin below catches it */ }
        ;(window as unknown as { __D2_POST_RELOAD__?: boolean }).__D2_POST_RELOAD__ = true
      }, carried)
      lap('preReload')
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.locator('.react-flow')).toBeVisible({ timeout: 30_000 })
      await page.waitForFunction(
        () => ((window as unknown as { useCanvasStore?: { getState: () => { nodes: unknown[] } } }).useCanvasStore?.getState?.().nodes.length ?? 0) > 0,
        undefined,
        { timeout: 30_000 },
      )
      await settle(page)
      const restored = await page.evaluate(() => {
        const w = window as unknown as { __D2_POST_RELOAD__?: boolean; useCanvasStore: { getState: () => { nodes: unknown[]; results?: { status?: string }; layoutVersion: number } } }
        const st = w.useCanvasStore.getState()
        return { post: w.__D2_POST_RELOAD__ === true, nodes: st.nodes.length, status: st.results?.status ?? null, layoutVersion: st.layoutVersion }
      })
      expect(restored.post, 'this document is not the reloaded one').toBe(true)
      expect(restored.nodes, `${board.name} RELOAD: the reload restored a different model`).toBe(nodeCount)
      lap('reloadBoot')
      const runSurvivedReload = restored.status === 'complete'
      if (!runSurvivedReload) {
        await deliverRun(page, board.envelope)
        await settle(page)
      }
      const R = await measureState(page, board.name, 'RELOAD', {
        landing, interactions, preferredOcclusionCard: S.result.occlusion?.card ?? null, occlusionControl: false, fitControl: false,
      })
      results.push(R.result)
      lap('reload')
      // REPORTED: did the reload put the cards back where the user left them?
      const before = new Map(S.reading.cards.map((c) => [c.id, c]))
      const movedOnReload = R.reading.cards
        .filter((c) => { const b = before.get(c.id); return b && (Math.abs(b.x - c.x) > 1 || Math.abs(b.y - c.y) > 1) })
        .map((c) => { const b = before.get(c.id) as CardReading; return { id: c.id, from: [b.x, b.y], to: [c.x, c.y] } })

      // eslint-disable-next-line no-console
      console.log(`BSGCTRL ${JSON.stringify({ board: board.name, a: aControl, b: bControl, c: P.result.occlusion?.control ?? null, d: results.map((r) => r.dControl), e: L.result.fitControl })}`)
      // eslint-disable-next-line no-console
      console.log(`BSGRELOAD ${JSON.stringify({ board: board.name, runSurvivedReload, layoutVersionAfterReload: restored.layoutVersion, movedOnReload })}`)
      // eslint-disable-next-line no-console
      console.log(`BSGTIME ${JSON.stringify({ board: board.name, ...time, totalMs: Date.now() - t0 })}`)

      // ── POSITIVE CONTROLS (asserted after the readings are logged, so a red
      // control still leaves the numbers on the page)
      expect(aControl, `${board.name}: the growth reader did not see a planted 40px block — it cannot see a card grow`).toEqual([target.id])
      expect(bControl.selfB1, 'b1 missed a planted self-clipping span').toBe(true)
      expect(bControl.selfB2, 'b2 missed a planted self-clipping span').toBe(true)
      expect(bControl.mechanismB2, 'b2 missed the planted driver mechanism (block slot > shrink-to-fit button > truncate caption)').toBe(true)
      expect(bControl.ellipsisFlagged, 'the clip reader flagged a planted ELLIPSIS — it would stay red on the fix').toBe(false)
      if (board.name.startsWith('mrr-')) {
        // Paul's factor band wraps into two rows in both states, so (d) must be probeable here.
        expect(P.result.dControl.probeable, `${board.name} has no multi-row band — the fixture no longer exercises (d)`).toBe(true)
      }
      for (const r of results) {
        if (r.dControl.probeable) expect(r.dControl.detected, `${board.name} ${r.state}: (d) missed a planted upward same-band pair`).toBe(true)
      }
      if (interactions) {
        expect(P.result.occlusion?.control?.plantedDetected ?? false, `${board.name}: the occlusion reader missed a planted max-z block over a menu item (or no card gave an overlapping menu at POST-RUN)`).toBe(true)
        expect(L.result.fitControl?.draggedOffCentreFrac ?? -1, `${board.name}: (e) the centring reader called a camera dragged 25% off-centre CENTRED`).toBeGreaterThan(CENTRE_TOLERANCE)
      }
      // HARNESS SANITY: POST-RUN and STALE were read on LANDING's rung, or
      // (a)/(b) there compare two different card anatomies.
      for (const r of [P.result, S.result]) {
        expect(r.lodRung, `${board.name} ${r.state}: read on LOD rung ${r.lodRung}, LANDING on ${L.result.lodRung} — the camera restore failed`).toBe(L.result.lodRung)
      }

      // ── THE ASSERTED VERDICTS: (b), (c), (d). (a) and (e) are REPORTED above.
      const failures: string[] = []
      for (const r of results) {
        for (const c of r.clipped) failures.push(`(b) ${r.state} ${c.reading} card=${c.card} el=${c.el} clipper=${c.clipper} +${c.overflowPx}px "${c.text}"`)
        for (const c of r.longCaption?.clipped ?? []) failures.push(`(b) ${r.state} long-caption ${c.reading} card=${c.card} el=${c.el} clipper=${c.clipper} +${c.overflowPx}px`)
        if (r.occlusion && r.occlusion.card === null) failures.push(`(c) ${r.state} VACUOUS — no card of [${r.occlusion.tried.join(', ')}] opened a menu overlapping its inspector`)
        for (const oc of r.occlusion?.occluded ?? []) failures.push(`(c) ${r.state} card=${r.occlusion?.card} item="${oc.label}" top=${oc.top}`)
        for (const u of r.upward) failures.push(`(d) ${r.state} ${u.source} -> ${u.target} band=${u.band} up=${u.upModelPx}px (tol ${u.tolModelPx}px)`)
      }
      expect(failures, `${board.name}: geometry defects across LANDING / POST-RUN / STALE / RELOAD`).toEqual([])
    })
  }
})
