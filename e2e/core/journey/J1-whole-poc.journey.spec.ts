/**
 * J1 · THE WHOLE-PoC JOURNEY, ONE USER, END TO END, ASSERTED BY IDENTITY.
 *
 * Spec: Integrator ruling (programme-docs integrator/github-26
 * output/integrator/J1-SPEC-RULING.md). Builder: Journey Builder github-f7.
 *
 * Every step captures ids, and every later step must see THOSE ids:
 *   S   scenario id                    (URL, stored read)
 *   H   graph_hash, the 16-hex write base, plus the 64-hex graph_identity_hash
 *   A   computed_against_hash, the analysis hash a run was computed on
 *   R   run ids, carried only in run_delta.endpoints
 *   edges are identified by from::to node ids (the stored graph has no edge id) and,
 *   on the canvas, by their exact "Connection from <A> to <B>" labels (canvas ids are local).
 * A value another object could satisfy ("a result appeared") is never enough.
 *
 * Required (deterministic under frozen replay): J0 J1 J2(+a,b,c) J2d J2e J3 J3r J5(+a) J6 J8 J9,
 * and gate 3's J10 J11 J12 J13 (no LLM call; advisory J11a brief, J11b name).
 * Advisory until 3 greens: J3p J7, and J6's prior = R1 binding where R1 is not
 * identifiable (UNBOUND). Advisory rows write a verdict to evidence/advisory.json and
 * never fail the run. Not built yet: J3b J4 J5b J5c.
 *
 * Every step also asserts the LLM boundary answered every call EXACTLY as frozen
 * (assertBoundaryClean): a drifted, missing, exhausted or reused recording is red.
 *
 * Serial on purpose. Account A's browser lives across steps (beforeAll), so the
 * edit, the staleness and the rerun happen in the same tab a user would use.
 */
import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type BrowserContext, type Locator, type Page, type Request } from '@playwright/test'
import {
  enterAuthenticated, installWireInterceptor, mintAndInject, openDockTab, ORIGIN, renderedNodeIds,
  submitBrief, waitForDraftTurnComplete, type MintedSession,
} from '../lib/harness'
import {
  analysisResultOf, assertBoundaryClean, browserStorage, captureTurns, CEE_URL, duplicateAs, edgeKey,
  frozenRecordings, handlerFactsVisibleTo, injectSession, ledger, nextTurn, scenarioIdFromUrl, scenarioRowVisibleTo, scenariosVisibleTo,
  storedRead, tuple, writeEvidence, type CapturedTurn,
} from './lib/journey'

// The brief states every figure the model needs, so construction has no unsized
// link into the goal (P5) and the frozen journey can be licensed.
const J1_BRIEF =
  'We are a B2B software company with £120,000 monthly recurring revenue from 400 customers paying £300 a month. ' +
  'Decision: raise prices by 10%, launch a starter tier at £49 a month, or keep pricing as it is. ' +
  'Goal: reach at least £150,000 monthly recurring revenue within 9 months. ' +
  'Facts: each 1% price rise adds £1,200 a month to monthly recurring revenue before churn. ' +
  'Each 1% price rise loses about 2 customers, between 1 and 4. ' +
  'Each lost customer removes £300 a month of monthly recurring revenue. ' +
  'The starter tier would win about 150 new subscribers, between 80 and 250. ' +
  'Each starter subscriber adds £49 a month to monthly recurring revenue. ' +
  'Each starter subscriber costs about £6 a month in support. Keeping pricing as it is adds nothing.'

// CEE's transport keep-list for analysis_result.enrichment (compose.ts:808-973 @ a4977d9d).
const ENRICHMENT_KEEP_LIST = [
  'option_comparison', 'factor_sensitivity', 'results', 'robustness', 'decision_review',
  'option_comparison_status', 'conditional_probabilities', 'edge_e_values', 'inference_warnings',
  'confidence_tier', 'flip_thresholds', 'decision_brief', 'factor_evppi', 'decision_evpi',
  'p_win_sensitivity', 'correlation_model', 'critiques', 'conditional_winners', 'run_provenance',
  // Registered in CEE's enrichment manifest (src/orchestrator-v5/context/enrichment-manifest.ts:131 'dominant_factor' R_UI_SCIENCE,
  // :134 'flip_thresholds_status' R_FLIP_SIDECAR, :135 its _reason @ b33222d4). DL 87114 ruling 9 Oct: manifest-registered keys only.
  'dominant_factor', 'flip_thresholds_status', 'flip_thresholds_status_reason',
]
// analysis-result-headline.ts:297-298 @ a4977d9d
const ASSUMED_DIRECTION = 'The analysis was not told which way your goal points, so it assumed a higher value is better'
// Served analysis text describes what the model implies; it never ranks or recommends the options (Paul 5 Oct; DL 0df0e1
// ruling (b) for record 4). The option labels are the user's own words, so they are removed before matching.
// "put forward" is still composed by 34 CEE code lines in 16 files (staging 4ef8778b,
// output/journey-builder/put-forward-class-4ef8778b.txt), WORDING c6's first post-cut-3 item. Until that sweep serves it is
// an ADVISORY row listing each hit; then PUT_FORWARD_REQUIRED flips to true.
const RANKING_WORDS = /\b(?:ahead|best|winners?|recommend\w*)\b/i
const PUT_FORWARD = /\bput forward\b/i
const PUT_FORWARD_REQUIRED = false
// Codex r5 MED: only whole occurrences of an OPTION label are removed (bounded by non-letters/digits), never a substring:
// label "B" must not turn "B is Best" into " is est". Callers pass `optionLabels()`, the user's own option names.
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const ownWordsRemoved = (text: string, labels: string[]): string =>
  labels.filter(Boolean).sort((a, b) => b.length - a.length)
    .reduce((t, l) => t.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(l)}(?![\\p{L}\\p{N}])`, 'gu'), ' '), text)
const rankingWord = (text: string, labels: string[]): string | null => ownWordsRemoved(text, labels).match(RANKING_WORDS)?.[0] ?? null
// StyledEdge paints the fragile cue only above this switch probability (constants.ts:23).
const FRAGILE_PAINT_THRESHOLD = 0.15
// Identity shapes: an analysis hash (16 or 64 hex) and a run id. A missing value never matches.
const HASH = /^[0-9a-f]{16}([0-9a-f]{48})?$/
const RUN_ID = /^[0-9a-f]{16,64}$/
// J6 promotion rule (Integrator, 5 Oct): true after 3 consecutive greens with J6 BOUND.
const J6_BOUND_REQUIRED = false
// The product's own words for a draft that ended before its values arrived
// (canRunAnalysis.ts:115, DraftLoadingAnimation.tsx:210 @ 410fa444). Seen on the first
// local record, 5 Oct 12:04Z, when the agent lane's last call failed: J1 must not pass then.
const DRAFT_ENDED_EARLY = /Drafting ended before (this|your) model.s values arrived/
// J3p ban-list (Integrator ruling §1(4)). Advisory until its base rate is measured.
const VERDICT_WORDS = [/clearly ahead/i, /with high confidence/i, /\brecommend/i, /\byou should\b/i, /\bbest (option|choice)\b(?![^.?]*\?)/i, /\bwinner\b/i]

// Pinned per frozen set, once a recording exists (written after the record run is reviewed).
const EXPECT_FILE = path.join(process.cwd(), 'e2e', 'core', 'journey', 'fixtures', 'j1', 'expect.json')
const EXPECT: { goal_direction_assumed?: boolean; enrichment_keys?: string[]; placeholder_links?: string[]; j2d_branch?: J2dBranch } =
  fs.existsSync(EXPECT_FILE) ? JSON.parse(fs.readFileSync(EXPECT_FILE, 'utf8')) : {}

type Edge = { from: string; to: string; provenance?: Record<string, any>; strength?: { mean?: number } }
interface Graph { nodes: { id: string; kind?: string; label?: string; nonlinear_identity?: { factor_ids?: string[]; addends?: string[] }; interventions?: Record<string, { value?: number; source?: string }> }[]; edges: Edge[] }
/**
 * J2d's two branches (DL 87114, 9 Oct, ruling c): J2d/J2e are J1's only pass through EDIT → commit door → re-Run →
 * reload, so they never skip. `placeholder`: R1 withholds for unsized Olumi links, and J2d sizes exactly those.
 * `option_intervention`: R1 withholds nothing, and J2d sets an option's intervention value in the option inspector, a write
 * through the same checked graph-write door (DL 87114, 9 Oct: in the re-recorded G1 every causal link is the user's own
 * stated figure or a definition, so no strength edit can land; J2f pins that refusal instead).
 */
type J2dBranch = 'placeholder' | 'option_intervention'
interface Fragile { from_id: string; to_id: string; from_label: string; to_label: string; switch_probability: number; visible?: boolean }

const J: {
  A?: MintedSession; S?: string
  G1?: Graph; H1?: string; H1id?: string
  AR1?: Record<string, any>; A1?: string; R1?: string | null
  autoPassAt?: string | null; R1at?: string | null; R2at?: string | null
  fragile1?: Fragile[]; edited?: Fragile
  G2?: Graph; H2?: string; H2id?: string
  AR2?: Record<string, any>; R2?: string; fragile2?: Fragile[]
  G0?: Graph; H0?: string; R0?: string | null; sized?: { from: string; to: string; target: number }[]; j2dBranch?: J2dBranch
  optionEdit?: { option: string; factor: string; value: number; factorLabel: string; typed: string; typedNumber: number; stored?: number }
  j5Branch?: 'fragile_link' | 'option_intervention'; j5Option?: { option: string; factor: string; value: number; factorLabel: string; typed: string; typedNumber: number; stored?: number }
  cardS?: string; C?: string
} = {}
const advisory: Record<string, unknown> = {}

let ctxA: BrowserContext
let pageA: Page
let turns: CapturedTurn[]
// Turn requests sent and not yet finished (Codex r5 MED: quiet() must not return while a narration is still in flight).
const pendingTurns = new Set<Request>()
const TURN_URL = /\/proxy\/v\d+\/turn(\/stream)?(\?|$)/

const nodesOf = (g: Graph) => g.nodes.map((n) => n.id).sort()
const edgesOf = (g: Graph) => g.edges.map(edgeKey).sort()
const labelOf = (g: Graph, id: string) => g.nodes.find((n) => n.id === id)?.label ?? id

/** The model's OPTION labels: the only words J2c/J6 exempt from the ranking-word check. */
const optionLabels = (): string[] => J.G1!.nodes.filter((n) => n.kind === 'option').map((n) => n.label ?? '')

async function read(label: string) {
  const r = await storedRead(J.S!, J.A!.user)
  expect(r.status, `[${label}] CEE's stored read for S=${J.S} returned ${r.status}`).toBe(200)
  return r.body!
}

/**
 * Wait until the journey is QUIET: no new turn response and no new LLM-boundary row for `ms`. A Run's auto-sent
 * "Explain this result" turn lands after the Run's own turn; an edit made before it settles changes that narration's
 * request (and `nextTurn` would bind the narration instead of the edit). Never a pass/fail: it only orders the steps.
 */
async function quiet(ms = 5_000, maxMs = 120_000): Promise<void> {
  const mark = () => `${turns.length}:${turns.filter((x) => x.body).length}:${ledger().length}:${pendingTurns.size}`
  const deadline = Date.now() + maxMs
  let last = mark(), since = Date.now()
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500))
    const now = mark()
    if (now !== last) { last = now; since = Date.now() } else if (pendingTurns.size === 0 && Date.now() - since >= ms) return
  }
  // Codex r6: never proceed while a turn is still in flight; a late narration would be bound as the next step's turn.
  throw new Error(`[j1] the journey never went quiet within ${Math.round(maxMs / 1000)}s (${pendingTurns.size} turn request(s) still in flight)`)
}

/** Clear the canvas selection: a selected link puts the canvas in focus mode, which hides every unrelated link. */
async function clearCanvasSelection(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  await page.locator('.react-flow__pane').first().dispatchEvent('click')
}

/** Open the edge inspector on the canvas link "from → to" by a double-click at its path midpoint (journey4 s6). */
async function openEdgeInspector(page: Page, fromLabel: string, toLabel: string, label: string): Promise<Locator> {
  await clearCanvasSelection(page)
  const edge = page.locator(`[data-testid^="rf__edge-"][aria-label^="Connection from ${fromLabel} to ${toLabel}."]`).first()
  // Attached with a drawn path, NOT toBeVisible: a horizontal link's <g> has a zero-height box, which Playwright calls
  // hidden although it is on screen and in the accessibility tree (record 4b fill 2: "Starter subscribers → Starter-tier MRR").
  await expect(edge, `[${label}] the canvas has no edge "${fromLabel} → ${toLabel}"`).toBeAttached({ timeout: 30_000 })
  const drawn = await edge.evaluate((el) => (el.querySelector('path') as SVGPathElement | null)?.getTotalLength?.() ?? 0)
  expect(drawn, `[${label}] the edge "${fromLabel} → ${toLabel}" has no drawn path`).toBeGreaterThan(0)
  const midpoint = () => edge.evaluate((el) => {
    const p = el.querySelector('path') as SVGPathElement | null
    let x: number, y: number
    if (p?.getTotalLength) {
      const m = p.getPointAtLength(p.getTotalLength() / 2); const c = p.getScreenCTM()!
      x = c.a * m.x + c.c * m.y + c.e; y = c.b * m.x + c.d * m.y + c.f
    } else {
      const r = el.getBoundingClientRect(); x = r.x + r.width / 2; y = r.y + r.height / 2
    }
    // Is the point on screen and on the canvas, not under a node card or the Outputs dock? (The edge's own cue, e.g. the
    // fragile tag drawn at its midpoint, sits in a separate layer, so "inside the edge element" is too strict: replay16.)
    const hit = document.elementFromPoint(x, y)
    const onEdge = !!hit && !!hit.closest('.react-flow') && !hit.closest('.react-flow__node') && !hit.closest('[data-testid="outputs-dock"]')
    return { x, y, onEdge }
  })
  let pt = await midpoint()
  if (!pt.onEdge) {
    // After a reload the viewport can leave the link off screen (J2f, replay15): the canvas's own "Fit to view" control.
    await page.getByRole('button', { name: 'Fit to view' }).click()
    await expect.poll(async () => (pt = await midpoint()).onEdge, { message: `[${label}] the edge "${fromLabel} → ${toLabel}" is not reachable on screen even after Fit to view`, timeout: 10_000 }).toBe(true)
  }
  await page.mouse.dblclick(pt.x, pt.y)
  const dialog = page.getByRole('dialog', { name: 'Edge inspector' })
  await expect(dialog, `[${label}] the edge inspector did not open`).toBeVisible({ timeout: 15_000 })
  return dialog
}

/**
 * A TYPED FIGURE edit: the inspector's fine-tune slider ("Effect on target", -1…1, step 0.01), never a band preset
 * (DL 0df0e1, 6 Oct: band edits drop the figure until WORDING c6's F1 fix). The value is set in ONE input event, as one
 * drag release would, so the 120 ms onChange debounce sends exactly one edit; blur commits it. The sign is the stored
 * link's own; the magnitude is 0.6, or 0.4 when the link already sits at 0.6 (an unchanged value is refused).
 */
async function typedFigureEdit(page: Page, dialog: Locator, storedMean: number | undefined, label: string): Promise<number> {
  const sign = (storedMean ?? 0) < 0 ? -1 : 1
  const target = sign * (Math.abs(Math.abs(storedMean ?? 0) - 0.6) < 0.005 ? 0.4 : 0.6)
  const fineTune = dialog.locator('summary', { hasText: 'Fine-tune' })
  await expect(fineTune, `[${label}] the inspector has no Fine-tune control`).toBeVisible()
  await fineTune.click()
  const slider = dialog.getByRole('slider', { name: 'Effect on target' })
  await expect(slider, `[${label}] the Fine-tune slider did not open`).toBeVisible()
  // A user's drag focuses the range first; the edit commits on release (blur), so an unfocused value set never sends.
  await slider.focus()
  await slider.evaluate((el, v) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    set.call(el, String(v))
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }, target)
  await page.waitForTimeout(400)
  await slider.blur()
  return target
}

/** The canvas edges carrying the fragile cue, as exact (from label, to label) pairs. */
async function fragileTaggedPairs(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const pairs: string[] = []
    for (const tag of document.querySelectorAll('[data-testid="edge-fragile-tag"]')) {
      const cue = tag.closest('[data-cue-edge-id]')?.getAttribute('data-cue-edge-id')
      const edgeEl = cue
        ? document.querySelector(`[data-testid="rf__edge-${CSS.escape(cue)}"]`)
        : tag.closest('[data-testid^="rf__edge-"]')
      const name = edgeEl?.getAttribute('aria-label') ?? ''
      const m = name.match(/^Connection from (.+?) to (.+?)\. /)
      pairs.push(m ? `${m[1]} → ${m[2]}` : `UNRESOLVED(${cue ?? 'no cue id'})`)
    }
    return [...new Set(pairs)].sort()
  })
}

/** Which fragile edges the canvas must mark: the top one, when it clears the paint threshold. */
function expectedTagged(fragile: Fragile[]): string[] {
  const top = [...fragile].sort((a, b) => b.switch_probability - a.switch_probability)[0]
  return top && top.switch_probability > FRAGILE_PAINT_THRESHOLD ? [`${top.from_label} → ${top.to_label}`] : []
}

async function runAdvisory(name: string, fn: () => Promise<unknown>): Promise<void> {
  try { advisory[name] = { verdict: 'PASS', detail: await fn() } }
  catch (e) { advisory[name] = { verdict: 'FAIL', detail: String(e).slice(0, 600) } }
  writeEvidence('advisory.json', advisory)
}

/** The "put forward" row: every surface checked, and each one that says it. Hard only once PUT_FORWARD_REQUIRED. */
function putForwardRow(where: string, text: string, labels: string[]): void {
  const row = (advisory['served-put-forward'] ?? { verdict: 'CLEAR', checked: [], hits: [] }) as { verdict: string; checked: string[]; hits: { where: string; sentence: string }[] }
  row.checked.push(where)
  const own = ownWordsRemoved(text, labels)
  const sentence = own.split(/(?<=[.!?])\s+/).find((s) => PUT_FORWARD.test(s))
  if (sentence) { row.hits.push({ where, sentence: sentence.trim().slice(0, 240) }); row.verdict = 'SAYS PUT FORWARD' }
  advisory['served-put-forward'] = row
  writeEvidence('advisory.json', advisory)
  if (PUT_FORWARD_REQUIRED) expect(sentence ?? null, `[${where}] served text says "put forward"`).toBeNull()
}

test.describe.serial('J1 · whole PoC', () => {
  test.beforeAll(async ({ browser }) => {
    ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    pageA = await ctxA.newPage()
    turns = captureTurns(pageA)
    pageA.on('request', (r) => { if (TURN_URL.test(r.url())) pendingTurns.add(r) })
    pageA.on('requestfinished', (r) => { pendingTurns.delete(r) })
    pageA.on('requestfailed', (r) => { pendingTurns.delete(r) })
    await installWireInterceptor(pageA)
  })
  test.afterAll(async () => {
    writeEvidence('turns.json', (turns ?? []).map((t) => ({ url: t.url, status: t.status, at: t.at, kinds: (t.body?.blocks ?? []).map((b: any) => b?.type) })))
    await ctxA?.close()
  })

  test('J0 · the tuple is the one CI checked out, and the boundary is armed', async ({ request }) => {
    const t = tuple()
    writeEvidence('J0-tuple.json', t)
    const v = await (await request.get(`${ORIGIN}/version.json`)).json()
    expect(v.commit, '[J0] the UI is not serving the DGAI checkout').toBe(t.ui)
    // The public /healthz names the build by its 7-char short SHA.
    const h = await (await request.get(`${CEE_URL}/healthz`)).json()
    expect(String(h.build ?? ''), '[J0] CEE /healthz names no build').toMatch(/^[0-9a-f]{7,}$/)
    expect(t.cee.startsWith(h.build), `[J0] CEE serves build ${h.build}, not the checkout ${t.cee}`).toBe(true)
    if (t.mode === 'replay') {
      expect(ledger().find((r) => r.outcome === 'index')?.recordings, '[J0] the LLM boundary did not index the frozen set').toBeDefined()
    }
  })

  test('J0b · a frozen recording exists for this journey (replay)', async () => {
    test.skip(process.env.J1_MODE !== 'replay', 'record mode makes the recording')
    expect(
      frozenRecordings().length,
      '[J0b] NO RECORDING: the frozen LLM set for J1 is empty, so every model step would run on a ' +
      'refusal. Could not measure. A local record run creates it.',
    ).toBeGreaterThan(0)
  })

  test('J1 · brief → model: scenario S, graph G1, hash H1, rendered by identity', async () => {
    J.A = await mintAndInject(pageA, 'j1-a')
    await enterAuthenticated(pageA)
    await submitBrief(pageA, J1_BRIEF)
    await waitForDraftTurnComplete(pageA, { timeoutMs: 420_000 })
    // Every call so far was answered exactly as frozen (no miss, drift, reuse, upstream error or 429).
    assertBoundaryClean('J1')
    await openDockTab(pageA, 'Analysis')
    // Control first: the footer that would carry the sentence has rendered, so its absence means something.
    await expect(pageA.getByTestId('pre-analysis-v3-footer').or(pageA.getByTestId('results-analysis-footer')).first(),
      '[J1] the Analysis footer never rendered, so the draft-ended-early check would be blind').toBeVisible({ timeout: 60_000 })
    await expect(pageA.locator('body'), '[J1] the product says the draft ended before its values arrived').not.toContainText(DRAFT_ENDED_EARLY, { timeout: 5_000 })

    await expect.poll(() => scenarioIdFromUrl(pageA.url()), {
      message: '[J1] the URL never named a scenario after the draft', timeout: 60_000,
    }).not.toBeNull()
    J.S = scenarioIdFromUrl(pageA.url())!

    const body = await read('J1')
    J.G1 = body.graph as Graph
    J.autoPassAt = body.analysis_state?.run_state?.computed_at ?? null
    J.H1 = body.graph_hash
    J.H1id = body.graph_identity_hash?.value
    expect(J.H1, '[J1] the stored read has no 16-hex graph_hash').toMatch(/^[0-9a-f]{16}$/)
    expect(J.H1id, '[J1] the stored read has no graph_identity_hash').toMatch(/^[0-9a-f]{64}$/)
    expect(J.G1.nodes.length, '[J1] the stored graph has no nodes').toBeGreaterThan(0)
    expect(J.G1.nodes.some((n) => n.kind === 'option'), '[J1] the stored graph has no option').toBe(true)

    // The canvas mounts EXACTLY the stored graph's node ids: none extra, none missing.
    await expect.poll(async () => (await renderedNodeIds(pageA)).sort(), {
      message: '[J1] the canvas does not render the stored graph G1 by id', timeout: 60_000,
    }).toEqual(nodesOf(J.G1))
    assertBoundaryClean('J1 end')
    writeEvidence('J1-model.json', { S: J.S, H1: J.H1, H1id: J.H1id, nodes: nodesOf(J.G1), edges: edgesOf(J.G1) })
  })

  test('J2 · Run: the analysis is computed on H1 and names G1\'s options (+J2a direction, +J2b keep-list)', async () => {
    // Before any result the run control is the V3 pre-analysis footer (`pre-analysis-v3-analyse`,
    // "Analyse first pass" / "Re-run analysis"; VITE_FEATURE_PRE_ANALYSIS_V3=1 on staging), or the
    // legacy StickyFooter (`sticky-footer-action`); after a result it is the results footer
    // ("Rerun"). Whichever shows is the user pressing Run.
    await openDockTab(pageA, 'Analysis')
    const run = pageA.getByTestId('results-analysis-footer-action')
      .or(pageA.getByTestId('pre-analysis-v3-analyse'))
      .or(pageA.getByTestId('sticky-footer-action')).first()
    await expect(run, '[J2] no run control on the Analysis tab after the draft').toBeVisible({ timeout: 180_000 })
    await expect(run, '[J2] the run control stayed disabled').toBeEnabled({ timeout: 180_000 })
    const runLabel = (await run.innerText()).trim()
    const since = Date.now()
    await run.click()
    const turn = await nextTurn(turns, since, 'J2 run')
    assertBoundaryClean('J2')
    J.AR1 = analysisResultOf(turn.body)!
    expect(J.AR1, '[J2] the run turn carries no analysis_result block').toBeTruthy()

    const body = await read('J2')
    expect(body.graph_hash, '[J2] running the analysis changed the graph').toBe(J.H1)
    expect(body.analysis_state?.run_state?.kind, '[J2] the stored run is not current').toBe('complete_current')
    J.A1 = body.current_read?.computed_against_hash
    expect(J.A1, '[J2] the stored read names no analysis hash the run was computed on').toMatch(HASH)
    expect(J.AR1.computed_against_hash, '[J2] the turn and the stored read disagree on what the run was computed on').toBe(J.A1)
    expect(body.current_read?.current_analysis_hash, '[J2] the run was not computed on the current model').toBe(J.A1)
    J.R1 = body.current_read?.run_delta?.endpoints?.current?.run_id ?? null
    J.R1at = body.analysis_state?.run_state?.computed_at ?? null
    expect(J.R1at, '[J2] the stored run has no computed_at').toBeTruthy()

    // The RESULTS surface (not the page: the canvas already shows the labels) names G1's
    // options by their exact labels, once it has settled on a complete result.
    const results = pageA.getByTestId('results-body-stale-wrapper')
    await expect(results, '[J2] the Analysis tab shows no complete result').toHaveAttribute('data-run-status', 'complete', { timeout: 120_000 })
    await expect(results, '[J2] the result is still marked busy').not.toHaveAttribute('aria-busy', 'true', { timeout: 60_000 })
    const options = J.G1!.nodes.filter((n) => n.kind === 'option')
    expect(options.length, '[J2] G1 has no option to look for').toBeGreaterThan(0)
    for (const o of options) await expect(results, `[J2] the result does not name option "${o.label}" (${o.id})`).toContainText(o.label!)
    // J2c: neither R1's served summary nor the Analysis tab the user reads ranks the options.
    const labels = optionLabels()
    const tabText = await results.innerText()
    expect(rankingWord(String(J.AR1.summary ?? ''), labels), '[J2c] R1\'s served summary ranks the options').toBeNull()
    expect(rankingWord(tabText, labels), '[J2c] the Analysis tab ranks the options').toBeNull()
    putForwardRow('J2c R1 summary', String(J.AR1.summary ?? ''), labels)
    putForwardRow('J2c Analysis tab', tabText, labels)

    // J2a: the assumed-direction sentence appears exactly when CEE says the direction was unattested.
    const unattested = (J.AR1.enrichment?.inference_warnings ?? []).some((w: any) => w?.code === 'GOAL_DIRECTION_UNATTESTED')
    expect(String(J.AR1.summary ?? '').includes(ASSUMED_DIRECTION), '[J2a] the summary and the direction warning disagree').toBe(unattested)
    if (EXPECT.goal_direction_assumed !== undefined) {
      expect(unattested, '[J2a] the frozen journey\'s goal-direction branch moved').toBe(EXPECT.goal_direction_assumed)
    }

    // J2b: the UI payload's enrichment keys come from the keep-list, and robustness is among them.
    const keys = Object.keys(J.AR1.enrichment ?? {}).sort()
    expect(keys.filter((k) => !ENRICHMENT_KEEP_LIST.includes(k)), '[J2b] enrichment carries keys the keep-list does not allow').toEqual([])
    expect(keys, '[J2b] the user-pressed run has no robustness').toContain('robustness')
    if (EXPECT.enrichment_keys) expect(keys, '[J2b] the enrichment key set moved for the frozen journey').toEqual([...EXPECT.enrichment_keys].sort())

    writeEvidence('J2-run.json', { run_control: runLabel, A1: J.A1, R1: J.R1, keys, unattested, summary: J.AR1.summary })
  })

  // ── J2d/J2e (Journey Builder; DL 0df0e1, 6 Oct): THE CORE LOOP. At cut 4 the draft leaves Olumi-supplied links unsized
  // on option paths, so the Run withholds those options' goal figures and, with them, the comparison science and
  // robustness (by design: CEE constraint-feasibility.ts withholdOptionGoalFigures, DL #75 5902570568). The user sizes
  // EXACTLY the links the withhold names, bound by their ENDS (never label text), with typed figures, and reruns.
  const PLACEHOLDER_CODE = 'GOAL_FIGURES_PLACEHOLDER_PATH'
  const placeholderWarning = (ar: Record<string, any> | undefined): Record<string, any> | null =>
    ((ar?.enrichment?.inference_warnings ?? []) as Record<string, any>[]).find((w) => w?.code === PLACEHOLDER_CODE) ?? null

  /**
   * Every G1 link's verdict for a canvas STRENGTH edit, mirroring the product's own refusals: structural (an option or
   * the decision at either end), definitional (CEE `definitional-links.ts` definitionalLinkOf: an identity's operand or
   * addend), definitional_label (`provenance.definitional`: the inspector offers no strength editor,
   * `strengthDefinitional.ts`), already_user, and user_figure_held (CEE `user-figure-held.ts` userFigureHeld: the link
   * holds the user's own stated figure, refused without an explicit replace). Replays 5, 7 and 8 (9 Oct) each hit one.
   */
  const strengthEditVerdict = (g: Graph, e: Edge): string => {
    const kind = new Map(g.nodes.map((n) => [n.id, n.kind]))
    if (['option', 'decision'].includes(kind.get(e.from) ?? '') || ['option', 'decision'].includes(kind.get(e.to) ?? '')) return 'structural'
    const id = g.nodes.find((n) => n.id === e.to)?.nonlinear_identity
    if (id && [...(id.factor_ids ?? []), ...(id.addends ?? [])].includes(e.from)) return 'definitional'
    if (e.provenance?.definitional === true) return 'definitional_label'
    if (e.provenance?.source === 'user_specified') return 'already_user'
    const ne = e.provenance?.natural_effect, mean = e.strength?.mean
    if (e.provenance?.magnitude === 'user_stated' && typeof ne?.strength_mean === 'number' && typeof mean === 'number' &&
      (Math.abs(ne.strength_mean - mean) <= 1e-9 || (e.provenance?.clamped_from === ne.strength_mean && Math.abs(mean) === 1))) return 'user_figure_held'
    return typeof mean === 'number' ? 'editable' : 'no_figure'
  }

  /**
   * The `option_intervention` target, BY TYPE (DL 87114, 9 Oct): an option's numeric intervention on a factor, first by
   * option id then factor id. Its write runs executeOptionInterventionBatch → commitDirectAnswer → appendCheckedGraphWrite,
   * the one checked graph-write door. Only an option whose card offers the targets door counts (the baseline option,
   * "Baseline · no changes", offers none: replay10). Deterministic: no LLM.
   */
  const optionInterventionCandidates = (g: Graph): { option: string; factor: string; value: number }[] => {
    const out: { option: string; factor: string; value: number }[] = []
    for (const o of g.nodes.filter((n) => n.kind === 'option').sort((a, b) => a.id.localeCompare(b.id))) {
      for (const f of Object.keys(o.interventions ?? {}).sort()) {
        const v = o.interventions![f]?.value
        if (typeof v === 'number' && labelOf(g, f) && o.label) out.push({ option: o.id, factor: f, value: v })
      }
    }
    return out
  }
  const TARGETS_DOOR = /factor targets?\. Open the inspector to change them\./
  /** The first candidate whose option card offers the targets door AND whose inspector offers a text field for it. */
  async function optionInterventionTarget(page: Page, g: Graph): Promise<{ t: { option: string; factor: string; value: number }; input: Locator } | null> {
    for (const c of optionInterventionCandidates(g)) {
      const input = await optionTargetInputIfAny(page, c.option, labelOf(g, c.factor))
      if (input) return { t: c, input }
    }
    return null
  }

  /**
   * Open the option's inspector through the card's own door ("N factor target(s). Open the inspector to change them.";
   * replay10: a double-click opens the rename, not the inspector), and return its target field for `factorLabel`.
   */
  async function optionTargetInput(page: Page, optionId: string, factorLabel: string, label: string): Promise<Locator> {
    await clearCanvasSelection(page)
    const node = page.locator(`.react-flow__node[data-id="${optionId}"]`)
    await expect(node, `[${label}] the canvas has no option card ${optionId}`).toBeVisible({ timeout: 30_000 })
    const door = node.getByRole('button', { name: TARGETS_DOOR })
    await expect(door, `[${label}] option card ${optionId} offers no "Open the inspector" door for its targets`).toHaveCount(1, { timeout: 15_000 })
    await pressDoor(door)
    const input = page.getByRole('textbox', { name: new RegExp(`^Target for ${factorLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`) })
    await expect(input, `[${label}] the option inspector has no target field for ${factorLabel}`).toBeVisible({ timeout: 15_000 })
    return input
  }
  /**
   * Activate the card's targets door from the keyboard: focus + Enter, a real user path. The door is revealed on hover and
   * the expanded Outputs dock can cover the card after a reload (fill2: the dock intercepted the pointer for 60 s).
   */
  async function pressDoor(door: Locator): Promise<void> {
    await door.focus()
    await door.press('Enter')
  }
  /** Close the node inspector by its own button (Escape leaves it open over the canvas: replay12's hover timeout). */
  async function closeNodeInspector(page: Page): Promise<void> {
    const dialog = page.getByRole('dialog', { name: 'Node inspector' })
    if (await dialog.count() === 0) return
    await dialog.getByRole('button', { name: 'Close inspector' }).click()
    await expect(dialog, 'the node inspector did not close').toHaveCount(0, { timeout: 15_000 })
  }
  /** The target's text field, if this option's inspector offers one (a yes/no factor has none: replay11). */
  async function optionTargetInputIfAny(page: Page, optionId: string, factorLabel: string): Promise<Locator | null> {
    const node = page.locator(`.react-flow__node[data-id="${optionId}"]`)
    if (await node.count() === 0) return null
    await clearCanvasSelection(page)
    const door = node.getByRole('button', { name: TARGETS_DOOR })
    if (await door.count() === 0) return null
    await pressDoor(door)
    const dialog = page.getByRole('dialog', { name: 'Node inspector' })
    await expect(dialog).toBeVisible({ timeout: 15_000 })
    const input = page.getByRole('textbox', { name: new RegExp(`^Target for ${factorLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`) })
    if (await input.count() > 0) return input.first()
    await closeNodeInspector(page)
    return null
  }
  const firstNumber = (s: string): number => Number((s.match(/-?\d+(?:\.\d+)?/) ?? ['NaN'])[0])

  type OptionEdit = { option: string; factor: string; value: number; factorLabel: string; typed: string; typedNumber: number; stored?: number }
  /**
   * The `option_intervention` edit, through the option inspector's target field (the checked graph-write door): the first
   * candidate by type with a text field, skipping `exclude` (J5 edits a DIFFERENT target from J2d). +20% in the field's own
   * precision. Asserts the edit turn, a clean boundary, and no refusal/unapplied marker on the row.
   */
  async function editOptionTarget(label: string, g: Graph, exclude: { option: string; factor: string } | null): Promise<OptionEdit> {
    let found: { t: { option: string; factor: string; value: number }; input: Locator } | null = null
    for (const c of optionInterventionCandidates(g)) {
      if (exclude && c.option === exclude.option && c.factor === exclude.factor) continue
      const input = await optionTargetInputIfAny(pageA, c.option, labelOf(g, c.factor))
      if (input) { found = { t: c, input }; break }
    }
    const t = found?.t
    console.log(`[${label}] option_intervention candidates: ${optionInterventionCandidates(g).map((c) => `${c.option}:${c.factor}=${c.value}`).join(' ') || 'none'}; excluding ${exclude ? `${exclude.option}:${exclude.factor}` : 'none'}; target: ${t ? `${t.option}:${t.factor}` : 'NONE'}`)
    expect(t, `[${label}] COULD NOT MEASURE: no option inspector offers a target field to edit`).toBeTruthy()
    const factorLabel = labelOf(g, t!.factor)
    const input = found!.input
    const seed = await input.inputValue()
    const shownBefore = firstNumber(seed)
    expect(Number.isFinite(shownBefore), `[${label}] the target field shows no number ("${seed}")`).toBe(true)
    // A visibly different value in the field's own precision: +20% (whole numbers stay whole), never the same number.
    const scaled = Number.isInteger(shownBefore) ? Math.round(shownBefore * 1.2) : Math.round(shownBefore * 1.2 * 100) / 100
    const typedNumber = shownBefore === 0 ? 1 : scaled === shownBefore ? shownBefore + 1 : scaled
    const typed = seed.replace(/-?\d+(?:\.\d+)?/, String(typedNumber))
    const since = Date.now()
    await input.fill(typed)
    await input.press('Enter')
    const turn = await nextTurn(turns, since, `${label} option intervention ${t!.option}:${t!.factor}`)
    expect(turn.status, `[${label}] the option-intervention edit turn failed`).toBe(200)
    assertBoundaryClean(label)
    await expect(pageA.getByTestId(`intervention-entry-refusal-${t!.factor}`), `[${label}] the field refused the typed value`).toHaveCount(0)
    await expect(pageA.getByTestId(`intervention-unapplied-${t!.factor}`), `[${label}] the typed value did not land`).toHaveCount(0)
    await closeNodeInspector(pageA)
    await quiet()
    return { ...t!, factorLabel, typed, typedNumber }
  }

  test('J2d · edit through the canvas door: size what Olumi supplied, or (no withhold) set an option\'s intervention value', async () => {
    const w = placeholderWarning(J.AR1)
    const branch: J2dBranch = w ? 'placeholder' : 'option_intervention'
    J.j2dBranch = branch
    // Never silent: the branch is in the log, the evidence, and (when frozen) bound to the journey.
    console.log(`[J2d] branch: ${branch}`)
    test.info().annotations.push({ type: 'J2d branch', description: branch })
    if (EXPECT.j2d_branch) expect(branch, '[J2d] the journey took a different J2d branch from the frozen one').toBe(EXPECT.j2d_branch)
    const sized: { from: string; to: string; target: number }[] = []
    await quiet()
    if (w) {
      const links = ((w.links ?? []) as { from: string; to: string }[])
      expect(links.length, '[J2d] the withhold names no link').toBeGreaterThan(0)
      if (EXPECT.placeholder_links) expect(links.map((l) => edgeKey(l)).sort(), '[J2d] the withhold names different links from the frozen journey').toEqual([...EXPECT.placeholder_links].sort())
      const byId = new Map(J.G1!.nodes.map((n) => [n.id, n]))
      for (const l of links) {
        const stored = J.G1!.edges.find((e) => e.from === l.from && e.to === l.to)
        expect(stored, `[J2d] the withhold names ${l.from}→${l.to}, which is not a link in G1`).toBeTruthy()
        const fromLabel = byId.get(l.from)?.label, toLabel = byId.get(l.to)?.label
        expect(fromLabel && toLabel, `[J2d] G1 has no labels for ${l.from}→${l.to}`).toBeTruthy()
        const dialog = await openEdgeInspector(pageA, fromLabel!, toLabel!, 'J2d')
        const since = Date.now()
        const target = await typedFigureEdit(pageA, dialog, stored!.strength?.mean, 'J2d')
        const turn = await nextTurn(turns, since, `J2d edit ${l.from}→${l.to}`)
        expect(turn.status, `[J2d] the edit turn for ${l.from}→${l.to} failed`).toBe(200)
        assertBoundaryClean('J2d')
        sized.push({ ...l, target })
        await quiet()
      }
    } else {
      J.optionEdit = await editOptionTarget('J2d', J.G1!, null)
    }
    await clearCanvasSelection(pageA)
    // By identity in the stored model: exactly what J2d edited is the user's, at what was typed, and nothing else changed hands.
    const body = await read('J2d')
    const G = body.graph as Graph
    for (const s of sized) {
      const e = G.edges.find((x) => x.from === s.from && x.to === s.to)
      expect(e?.provenance?.source, `[J2d] ${s.from}→${s.to} is not stamped as the user's`).toBe('user_specified')
      expect(Math.abs((e?.strength?.mean ?? Number.NaN) - s.target), `[J2d] ${s.from}→${s.to} does not carry the typed figure ${s.target} (stored ${e?.strength?.mean})`).toBeLessThan(0.011)
    }
    const newlyUser = G.edges.filter((e) => e.provenance?.source === 'user_specified' &&
      J.G1!.edges.find((o) => edgeKey(o) === edgeKey(e))?.provenance?.source !== 'user_specified').map(edgeKey).sort()
    expect(newlyUser, '[J2d] the edit stamped links J2d did not edit').toEqual(sized.map((s) => edgeKey(s)).sort())
    if (J.optionEdit) {
      const iv = G.nodes.find((n) => n.id === J.optionEdit!.option)?.interventions?.[J.optionEdit!.factor]
      expect(iv?.source, `[J2d] ${J.optionEdit.option}'s value for ${J.optionEdit.factor} is not stamped as the user's`).toBe('user_specified')
      expect(iv?.value, `[J2d] ${J.optionEdit.option}'s stored value for ${J.optionEdit.factor} did not change`).not.toBe(J.optionEdit.value)
      J.optionEdit.stored = iv!.value
    }
    // The revision bumps: the stored model's hash moves off H1.
    expect(body.graph_hash, '[J2d] the edit did not change the model').not.toBe(J.H1)
    expect(body.analysis_state?.run_state?.kind, '[J2d] R1 is not stale after the edit').toBe('complete_stale')
    J.G0 = J.G1; J.H0 = J.H1; J.R0 = J.R1; J.sized = sized
    J.G1 = G; J.H1 = body.graph_hash; J.H1id = body.graph_identity_hash?.value
    writeEvidence('J2d-edit.json', { branch, warning: w ? { code: w.code, option_ids: w.option_ids, links: w.links } : null, sized, option_edit: J.optionEdit ?? null, H0: J.H0, H1: J.H1 })
  })

  test('J2e · rerun on the edited model: no withhold, robustness present, and the edit survives the re-Run and a reload', async () => {
    await quiet()
    const footer = pageA.getByTestId('results-analysis-footer-action')
    await expect(footer, '[J2e] the footer does not offer the rerun').toBeVisible({ timeout: 60_000 })
    const since = Date.now()
    await footer.click()
    const turn = await nextTurn(turns, since, 'J2e rerun')
    assertBoundaryClean('J2e')
    const ar = analysisResultOf(turn.body)!
    expect(ar, '[J2e] the rerun carries no analysis_result').toBeTruthy()
    const body = await read('J2e')
    expect(body.graph_hash, '[J2e] the rerun is not on the edited model').toBe(J.H1)
    expect(body.analysis_state?.run_state?.kind, '[J2e] the rerun is not current').toBe('complete_current')
    const A = body.current_read?.computed_against_hash
    expect(A, '[J2e] the stored read names no analysis hash').toMatch(HASH)
    expect(ar.computed_against_hash, '[J2e] the turn and the stored read disagree on what the rerun was computed on').toBe(A)
    // Identity: THIS run, computed on the edited model, carries no placeholder withhold, and its robustness is not
    // the empty shape the withhold writes ({ fragile_edges: [], robust_edges: [] }).
    expect(placeholderWarning(ar), `[J2e] the edited run still withholds for Olumi-supplied links: ${JSON.stringify(placeholderWarning(ar)?.links ?? null)}`).toBeNull()
    const rob = ar.enrichment?.robustness
    const robEdges = [...(rob?.fragile_edges ?? []), ...(rob?.robust_edges ?? [])]
    expect(robEdges.length, '[J2e] the edited run\'s robustness is still the empty withheld shape').toBeGreaterThan(0)
    const labels = optionLabels()
    expect(rankingWord(String(ar.summary ?? ''), labels), '[J2e] the edited run\'s summary ranks the options').toBeNull()
    putForwardRow('J2e edited summary', String(ar.summary ?? ''), labels)
    J.AR1 = ar; J.A1 = A; J.R1 = body.current_read?.run_delta?.endpoints?.current?.run_id ?? null
    J.R1at = body.analysis_state?.run_state?.computed_at ?? null
    expect(J.R1at, '[J2e] the edited run has no computed_at').toBeTruthy()
    // The edit survives the re-Run (stored) and a real reload (stored AND on screen), by identity.
    const holdsEdits = (g: Graph, label: string) => {
      for (const s of J.sized!) {
        const e = g.edges.find((x) => x.from === s.from && x.to === s.to)
        expect(e?.provenance?.source, `[${label}] ${s.from}→${s.to} is no longer the user's`).toBe('user_specified')
        expect(Math.abs((e?.strength?.mean ?? Number.NaN) - s.target), `[${label}] ${s.from}→${s.to} lost the typed figure ${s.target} (stored ${e?.strength?.mean})`).toBeLessThan(0.011)
      }
      if (J.optionEdit) {
        const iv = g.nodes.find((n) => n.id === J.optionEdit!.option)?.interventions?.[J.optionEdit!.factor]
        expect(iv?.source, `[${label}] ${J.optionEdit.option}'s value for ${J.optionEdit.factor} is no longer the user's`).toBe('user_specified')
        expect(iv?.value, `[${label}] ${J.optionEdit.option}'s value for ${J.optionEdit.factor} moved after the edit`).toBe(J.optionEdit.stored)
      }
    }
    holdsEdits(body.graph as Graph, 'J2e')
    await quiet()
    await pageA.reload({ waitUntil: 'load' })
    await expect.poll(async () => (await renderedNodeIds(pageA)).sort(), { message: '[J2e] the reload does not render the edited model by id', timeout: 120_000 }).toEqual(nodesOf(J.G1!))
    const after = await read('J2e reload')
    expect(after.graph_hash, '[J2e] the reload reads a different model').toBe(J.H1)
    holdsEdits(after.graph as Graph, 'J2e reload')
    const shown: { what: string; shown: number }[] = []
    for (const s of J.sized!) {
      const dialog = await openEdgeInspector(pageA, labelOf(J.G1!, s.from), labelOf(J.G1!, s.to), 'J2e reload')
      await dialog.locator('summary', { hasText: 'Fine-tune' }).click()
      const v = Number(await dialog.getByRole('slider', { name: 'Effect on target' }).inputValue())
      expect(Math.abs(v - s.target), `[J2e reload] the inspector shows ${v} for ${s.from}→${s.to}, not the typed figure ${s.target}`).toBeLessThan(0.011)
      shown.push({ what: edgeKey(s), shown: v })
      await pageA.keyboard.press('Escape')
    }
    if (J.optionEdit) {
      const oe = J.optionEdit
      const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const optionLabel = labelOf(J.G1!, oe.option)
      // On screen after the reload, by identity: the "Since the last run" strip names THIS option's target and the typed
      // figure ("Starter-tier price, Launch £49 starter tier: £49 per subscriber / month → £59 per subscriber / month").
      const strip = pageA.getByRole('button', { name: new RegExp(`^${esc(oe.factorLabel)}, ${esc(optionLabel)}: .*→\\D*${esc(String(oe.typedNumber))}\\b`) })
      await expect(strip, `[J2e reload] the since-last-run strip does not show ${oe.factorLabel} under ${optionLabel} moving to ${oe.typedNumber}`).toHaveCount(1, { timeout: 30_000 })
      shown.push({ what: `${oe.option}:${oe.factor} (since-last-run strip)`, shown: oe.typedNumber })
      // ⛔ KNOWN DEFECT (S2, DL 87114 9 Oct, owners af + 02): after a real reload the option card and the inspector show
      // the user's typed figure as "Increases" with no number and no box (stored 0.295 is right; the £ frame is lost).
      // This advisory asserts the BROKEN state exactly, so it turns FAIL (loudly) the day the figure comes back:
      // then make it a hard row asserting the figure, and delete this one.
      await runAdvisory('J2e-KNOWN-DEFECT-figure-missing-after-reload', async () => {
        const card = pageA.locator(`.react-flow__node[data-id="${oe.option}"]`).getByRole('button', { name: `${oe.factorLabel}, as this option sets it — click to edit` })
        const cardText = (await card.innerText()).trim()
        if (/\d/.test(cardText)) throw new Error(`DEFECT MAY BE FIXED: the card now shows a figure for ${oe.factorLabel}: "${cardText}"`)
        const input = await optionTargetInputIfAny(pageA, oe.option, oe.factorLabel)
        if (input) throw new Error(`DEFECT MAY BE FIXED: the inspector offers a target box for ${oe.factorLabel} again ("${await input.inputValue()}")`)
        return { state: 'BROKEN as known: no figure on the card or in the inspector after reload', card: cardText }
      })
    }
    await clearCanvasSelection(pageA)
    writeEvidence('J2e-rerun.json', { branch: J.j2dBranch, R0: J.R0, R1: J.R1, A1: J.A1, H1: J.H1, robustness_edges: robEdges.length, shown_after_reload: shown, summary: ar.summary })
  })

  test('J2f · a link holding the user\'s own figure refuses a strength edit, and the stored model does not move', async () => {
    const verdicts = J.G1!.edges.map((e) => ({ e, v: strengthEditVerdict(J.G1!, e) }))
    console.log(`[J2f] verdicts: ${verdicts.map((x) => `${edgeKey(x.e)}=${x.v}`).sort().join(' ')}`)
    const held = verdicts.filter((x) => x.v === 'user_figure_held').map((x) => x.e).sort((a, b) => edgeKey(a).localeCompare(edgeKey(b)))[0]
    expect(held, '[J2f] COULD NOT MEASURE: no G1 link holds the user\'s own figure').toBeTruthy()
    await quiet()
    const dialog = await openEdgeInspector(pageA, labelOf(J.G1!, held!.from), labelOf(J.G1!, held!.to), 'J2f')
    const since = Date.now()
    await typedFigureEdit(pageA, dialog, held!.strength?.mean, 'J2f')
    const turn = await nextTurn(turns, since, `J2f edit ${edgeKey(held!)}`)
    assertBoundaryClean('J2f')
    expect(JSON.stringify(turn.body ?? ''), '[J2f] the refusal does not say the link holds the user\'s figure').toContain('This link holds your figure')
    await pageA.keyboard.press('Escape')
    await clearCanvasSelection(pageA)
    await quiet()
    const body = await read('J2f')
    expect(body.graph_hash, '[J2f] a refused edit changed the stored model').toBe(J.H1)
    const e = (body.graph as Graph).edges.find((x) => x.from === held!.from && x.to === held!.to)
    expect(e?.strength?.mean, '[J2f] a refused edit moved the user\'s figure').toBe(held!.strength?.mean)
    writeEvidence('J2f-held-refusal.json', { link: edgeKey(held!), mean: held!.strength?.mean, H1: J.H1 })
  })

  test('J3 · science finding: fragile edges are G1 edges, and the canvas marks exactly the ones it should', async () => {
    J.fragile1 = (J.AR1!.enrichment?.robustness?.fragile_edges ?? []) as Fragile[]
    expect(J.fragile1.length, '[J3] the run produced no fragile edge: J3 would be vacuous for this journey').toBeGreaterThan(0)
    const g1 = edgesOf(J.G1!)
    for (const f of J.fragile1) {
      expect(g1, `[J3] fragile edge ${f.from_id}→${f.to_id} is not an edge of G1`).toContain(edgeKey({ from: f.from_id, to: f.to_id }))
      expect(f.from_label, `[J3] fragile edge ${f.from_id} carries a label that is not G1's`).toBe(labelOf(J.G1!, f.from_id))
      expect(f.to_label, `[J3] fragile edge ${f.to_id} carries a label that is not G1's`).toBe(labelOf(J.G1!, f.to_id))
    }
    const want = expectedTagged(J.fragile1)
    expect(want.length, '[J3] no fragile edge clears the paint threshold: the canvas half would be vacuous').toBeGreaterThan(0)
    await expect.poll(() => fragileTaggedPairs(pageA), { message: '[J3] the canvas does not mark exactly the fragile edge(s)', timeout: 30_000 }).toEqual(want)
    writeEvidence('J3-fragile.json', { fragile: J.fragile1, tagged: want })

    await runAdvisory('J3p-verdict-words', async () => {
      const text = await pageA.locator('body').innerText()
      const hits = VERDICT_WORDS.flatMap((re) => (text.match(new RegExp(re.source, 'gi')) ?? []).map((m) => `${re.source}: ${m}`))
      if (hits.length) throw new Error(`served verdict words: ${hits.join(' | ')}`)
      return { scanned_chars: text.length }
    })
  })

  test('J3r · fresh browser, same account: R1\'s fragile mark is painted again from the server alone', async ({ browser }) => {
    // Before the edit, while R1 still has a fragile edge above the paint threshold, so
    // "the verdict's marks survive a fresh browser" is measured on a mark that exists.
    const want = expectedTagged(J.fragile1!)
    expect(want.length, '[J3r] no fragile mark to carry across: the check would be vacuous').toBeGreaterThan(0)
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    try {
      await injectSession(page, J.A!.storageKey, J.A!.raw)
      await page.goto(`${ORIGIN}/#/scenario/${J.S}`, { waitUntil: 'load' })
      await expect.poll(async () => (await renderedNodeIds(page)).sort(), {
        message: '[J3r] a fresh browser does not render G1 by id', timeout: 120_000,
      }).toEqual(nodesOf(J.G1!))
      await expect.poll(() => fragileTaggedPairs(page), { message: '[J3r] a fresh browser does not re-mark R1\'s fragile edge', timeout: 60_000 }).toEqual(want)
      writeEvidence('J3r-fresh-fragile.json', { tagged: want })
    } finally {
      await ctx.close()
    }
  })

  test('J5 · approved typed edit: the fragile link if its strength is editable, else another option target; H2 ≠ H1, user_specified (+J5a staleness)', async () => {
    const top = [...J.fragile1!].sort((a, b) => b.switch_probability - a.switch_probability)[0]
    J.edited = top
    const topEdge = J.G1!.edges.find((e) => e.from === top.from_id && e.to === top.to_id)!
    const verdict = strengthEditVerdict(J.G1!, topEdge)
    // BY TYPE (DL 87114, 9 Oct): a fragile link holding the user's own figure (or a definition) refuses a strength edit
    // (J2f pins that), so J5 then sets a DIFFERENT option target than J2d through the same checked door. Named, never silent.
    const branch = verdict === 'editable' ? 'fragile_link' : 'option_intervention'
    J.j5Branch = branch
    console.log(`[J5] branch: ${branch} (top fragile ${edgeKey(topEdge)} = ${verdict})`)
    test.info().annotations.push({ type: 'J5 branch', description: `${branch} (top fragile ${edgeKey(topEdge)} = ${verdict})` })
    await quiet()
    if (branch === 'option_intervention') {
      J.j5Option = await editOptionTarget('J5', J.G1!, J.optionEdit ?? null)
      const body = await read('J5')
      J.G2 = body.graph as Graph; J.H2 = body.graph_hash; J.H2id = body.graph_identity_hash?.value
      expect(J.H2, '[J5] the edit did not change the graph hash').not.toBe(J.H1)
      const iv = J.G2.nodes.find((n) => n.id === J.j5Option!.option)?.interventions?.[J.j5Option!.factor]
      expect(iv?.source, `[J5] ${J.j5Option.option}'s value for ${J.j5Option.factor} is not stamped as the user's`).toBe('user_specified')
      expect(iv?.value, `[J5] ${J.j5Option.option}'s stored value for ${J.j5Option.factor} did not change`).not.toBe(J.j5Option.value)
      J.j5Option.stored = iv!.value
      const newlyUser = J.G2.edges.filter((e) => e.provenance?.source === 'user_specified' &&
        J.G1!.edges.find((o) => edgeKey(o) === edgeKey(e))?.provenance?.source !== 'user_specified').map(edgeKey)
      expect(newlyUser, '[J5] the option edit stamped links as the user\'s').toEqual([])
      expect(body.analysis_state?.run_state?.kind, '[J5a] the stored read does not call R1 stale').toBe('complete_stale')
      expect(body.analysis_state?.run_state?.cause, '[J5a] staleness has the wrong cause').toBe('graph_changed')
      const notice = pageA.getByTestId('analysis-freshness-notice')
      await expect(notice, '[J5a] the UI shows no stale notice').toHaveAttribute('data-freshness', 'stale', { timeout: 30_000 })
      await expect(notice, '[J5a] the stale notice has the wrong words').toContainText('Model changed since this analysis. Re-run to update.')
      writeEvidence('J5-edit.json', { branch, top_fragile: edgeKey(topEdge), top_verdict: verdict, option_edit: J.j5Option, H2: J.H2, H2id: J.H2id })
      return
    }
    // A typed figure on the fragile link (never a band preset: DL 0df0e1, 6 Oct, F1), via the same inspector path.
    const dialog = await openEdgeInspector(pageA, top.from_label, top.to_label, 'J5')
    const before = J.G1!.edges.find((e) => e.from === top.from_id && e.to === top.to_id)!
    const since = Date.now()
    const target = await typedFigureEdit(pageA, dialog, before.strength?.mean, 'J5')
    const turn = await nextTurn(turns, since, 'J5 edit')
    expect(turn.status, '[J5] the edit turn failed').toBe(200)
    assertBoundaryClean('J5')

    const body = await read('J5')
    J.G2 = body.graph as Graph; J.H2 = body.graph_hash; J.H2id = body.graph_identity_hash?.value
    expect(J.H2, '[J5] the edit did not change the graph hash').not.toBe(J.H1)
    const after = J.G2.edges.find((e) => e.from === top.from_id && e.to === top.to_id)
    expect(after, `[J5] edge ${top.from_id}→${top.to_id} vanished after its edit`).toBeTruthy()
    expect(after!.provenance?.source, '[J5] the edited edge is not stamped as the user\'s').toBe('user_specified')
    expect(after!.strength?.mean, '[J5] the edited edge kept its old strength').not.toBe(before.strength?.mean)
    expect(Math.abs((after!.strength?.mean ?? Number.NaN) - target), `[J5] the edited edge does not carry the typed figure ${target}`).toBeLessThan(0.011)
    // Only that edge changed provenance to user_specified.
    const newlyUser = J.G2.edges.filter((e) => e.provenance?.source === 'user_specified' &&
      J.G1!.edges.find((o) => edgeKey(o) === edgeKey(e))?.provenance?.source !== 'user_specified').map(edgeKey)
    // Codex r5 MED: the edited link may already be the user's (J2d sized it), so bind the CLAIM, not a fresh stamp:
    // it is the user's (asserted above) and no OTHER link newly became the user's.
    expect(newlyUser.filter((k) => k !== edgeKey({ from: top.from_id, to: top.to_id })), '[J5] the edit stamped other edges as the user\'s').toEqual([])

    // J5a: staleness is derived at read: R1 is now out of date for H2, and the UI says so.
    expect(body.analysis_state?.run_state?.kind, '[J5a] the stored read does not call R1 stale').toBe('complete_stale')
    expect(body.analysis_state?.run_state?.cause, '[J5a] staleness has the wrong cause').toBe('graph_changed')
    const notice = pageA.getByTestId('analysis-freshness-notice')
    await expect(notice, '[J5a] the UI shows no stale notice').toHaveAttribute('data-freshness', 'stale', { timeout: 30_000 })
    await expect(notice, '[J5a] the stale notice has the wrong words').toContainText('Model changed since this analysis. Re-run to update.')
    writeEvidence('J5-edit.json', { branch, edited: edgeKey({ from: top.from_id, to: top.to_id }), target, H2: J.H2, H2id: J.H2id, mean_before: before.strength?.mean, mean_after: after!.strength?.mean })
  })

  test('J6 · rerun: R2 is computed on H2, its delta has a distinct prior, and the prior is R1 wherever R1 is identifiable (+J7 Compare, advisory)', async () => {
    await pageA.keyboard.press('Escape')
    const footer = pageA.getByTestId('results-analysis-footer-action')
    await expect(footer, '[J6] the footer does not offer the rerun').toBeVisible()
    const since = Date.now()
    await footer.click()
    const turn = await nextTurn(turns, since, 'J6 rerun')
    assertBoundaryClean('J6')
    J.AR2 = analysisResultOf(turn.body)!
    expect(J.AR2, '[J6] the rerun carries no analysis_result').toBeTruthy()
    expect(rankingWord(String(J.AR2.summary ?? ''), optionLabels()), '[J6] R2\'s served summary ranks the options').toBeNull()
    putForwardRow('J6 R2 summary', String(J.AR2.summary ?? ''), optionLabels())

    const body = await read('J6')
    expect(body.graph_hash, '[J6] the rerun is not on the edited graph').toBe(J.H2)
    expect(body.analysis_state?.run_state?.kind, '[J6] the rerun is not current').toBe('complete_current')
    // Every identity below is REQUIRED to be present: two missing values never compare equal here.
    const A2 = body.current_read?.computed_against_hash
    expect(A2, '[J6] the stored read names no analysis hash for the rerun').toMatch(HASH)
    expect(body.current_read?.current_analysis_hash, '[J6] the rerun was not computed on the current model').toBe(A2)
    expect(J.AR2.computed_against_hash, '[J6] the rerun turn and the stored read disagree on what R2 was computed on').toBe(A2)
    expect(A2, '[J6] the rerun reused R1\'s analysis hash').not.toBe(J.A1)
    const ends = body.current_read?.run_delta?.endpoints
    J.R2 = ends?.current?.run_id
    J.R2at = body.analysis_state?.run_state?.computed_at ?? null
    expect(J.R2, '[J6] the stored read has no current run id').toMatch(RUN_ID)
    expect(ends?.prior?.run_id, '[J6] the delta has no prior run id').toMatch(RUN_ID)
    expect(ends.prior.run_id, '[J6] the delta\'s prior run is the current one').not.toBe(J.R2)
    if (J.R1) expect(ends?.prior?.run_id, '[J6] the delta does not point back at R1').toBe(J.R1)
    // Bind the pair by computed_at (Integrator amendment @7cbd02f6): prior = R1, current = R2,
    // and the prior is NOT the automatic first pass (the C10a pair: the load-bearing contrast).
    // Absent endpoints = UNBOUND, advisory (the known X9 gap). PROMOTION RULE (Integrator,
    // 5 Oct): once this branch is BOUND in 3 consecutive greens, J6_BOUND_REQUIRED flips to
    // true and UNBOUND is red: absence is then a regression.
    // Present means a value: a null computed_at is UNBOUND, not a mismatch.
    if (ends?.prior?.computed_at && ends?.current?.computed_at) {
      expect(ends.current.computed_at, '[J6] the delta\'s current run is not R2').toBe(J.R2at)
      expect(ends.prior.computed_at, '[J6] the delta\'s prior run is not R1').toBe(J.R1at)
      if (J.autoPassAt) expect(ends.prior.computed_at, '[J6] the delta pairs R2 with the automatic first pass, not R1').not.toBe(J.autoPassAt)
      advisory['J6-endpoint-binding'] = { verdict: 'BOUND', detail: 'prior = R1 and current = R2 by computed_at; prior is not the automatic first pass' }
      writeEvidence('advisory.json', advisory)
    } else {
      expect(J6_BOUND_REQUIRED, '[J6] UNBOUND: run_delta.endpoints lacks computed_at after the bound branch was promoted').toBe(false)
      advisory['J6-endpoint-binding'] = { verdict: 'UNBOUND', detail: `run_delta.endpoints lacks computed_at (keys: ${Object.keys(ends ?? {}).join(',') || 'none'})` }
      writeEvidence('advisory.json', advisory)
    }
    J.fragile2 = (J.AR2.enrichment?.robustness?.fragile_edges ?? []) as Fragile[]
    writeEvidence('J6-rerun.json', { R1: J.R1, R2: J.R2, prior: ends?.prior?.run_id, prior_at: ends?.prior?.computed_at, current_at: ends?.current?.computed_at, R1at: J.R1at, R2at: J.R2at, autoPassAt: J.autoPassAt, fragile2: J.fragile2 })

    await runAdvisory('J7-compare-run-delta', async () => {
      await pageA.getByRole('tablist', { name: 'Outputs sections' }).getByRole('tab', { name: 'Compare' }).click()
      // The pair renders, or the body says why not (CompareRunPairBody: -empty carries data-absence-reason).
      const pair = pageA.getByTestId('compare-run-pair')
      const empty = pageA.getByTestId('compare-run-pair-empty').or(pageA.getByTestId('compare-run-pair-run-on-record'))
      await expect(pair.or(empty).first()).toBeVisible({ timeout: 30_000 })
      if (await empty.count()) throw new Error(`Compare shows no pair: ${await empty.first().getAttribute('data-absence-reason') ?? await empty.first().getAttribute('data-run-on-record') ?? 'no reason given'}`)
      // Identity: the edited link's input_changes rows, by entity_id, are the rows the tab lists.
      const changes = (body.current_read?.run_delta?.input_changes ?? []) as any[]
      const touched = J.j5Branch === 'option_intervention'
        ? changes.filter((c) => JSON.stringify(c).includes(J.j5Option!.option) && JSON.stringify(c).includes(J.j5Option!.factor))
        : changes.filter((c) => c?.link?.from === J.edited!.from_id && c?.link?.to === J.edited!.to_id)
      if (!touched.length) throw new Error(`run_delta.input_changes does not name J5's edit (${J.j5Branch}; ${changes.length} rows)`)
      const shown = await pair.locator('[data-testid$="-input-row"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-entity-id')))
      const missing = touched.map((c) => String(c.entity_id)).filter((id) => !shown.includes(id))
      if (missing.length) throw new Error(`Compare does not list the edited link's change row(s) ${missing.join(', ')} (shown: ${shown.join(', ')})`)
      // The run pair, when the headline carries the artefact (it does only under some verdict states).
      const art = pair.locator('[data-compare-section="headline"][data-current-run-id]')
      const runIds = (await art.count())
        ? { prior: await art.getAttribute('data-prior-run-id'), current: await art.getAttribute('data-current-run-id') } : null
      if (runIds && runIds.current !== J.R2) throw new Error(`Compare names current run ${runIds.current}, not R2 ${J.R2}`)
      return { rows: changes.length, edited_rows: touched.length, shown: shown.length, run_ids: runIds ?? 'artefact not rendered' }
    })
  })

  test('J8 · fresh browser, same account: the model AND the verdict survive, by identity', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    try {
      await injectSession(page, J.A!.storageKey, J.A!.raw)
      await page.goto(`${ORIGIN}/#/scenario/${J.S}`, { waitUntil: 'load' })
      await expect.poll(async () => (await renderedNodeIds(page)).sort(), {
        message: '[J8] a fresh browser does not render G2 by id', timeout: 120_000,
      }).toEqual(nodesOf(J.G2!))
      // The result must be RESTORED before its marks are read: an empty expected set
      // would otherwise pass on a page that has not restored anything yet.
      await openDockTab(page, 'Analysis')
      await expect(page.getByTestId('results-body-stale-wrapper'), '[J8] the fresh browser never restored a complete result')
        .toHaveAttribute('data-run-status', 'complete', { timeout: 120_000 })

      const r = await storedRead(J.S!, J.A!.user)
      expect(r.status).toBe(200)
      expect(r.body!.graph_hash, '[J8] the fresh browser reads a different graph').toBe(J.H2)
      expect(r.body!.analysis_state?.run_state?.kind, '[J8] the verdict did not survive as current').toBe('complete_current')
      expect(r.body!.current_read?.run_delta?.endpoints?.current?.run_id, '[J8] the fresh read names a different run').toBe(J.R2)
      if (J.j5Branch === 'option_intervention') {
        const iv = (r.body!.graph as Graph).nodes.find((n) => n.id === J.j5Option!.option)?.interventions?.[J.j5Option!.factor]
        expect(iv?.source, '[J8] the J5 option edit\'s provenance did not survive the fresh browser').toBe('user_specified')
        expect(iv?.value, '[J8] the J5 option edit\'s value did not survive the fresh browser').toBe(J.j5Option!.stored)
      } else {
        const e = (r.body!.graph as Graph).edges.find((x) => x.from === J.edited!.from_id && x.to === J.edited!.to_id)
        expect(e?.provenance?.source, '[J8] the edit\'s provenance did not survive the fresh browser').toBe('user_specified')
      }

      // The canvas marks exactly R2's own fragile edges, and not R1's (Integrator amendment
      // @7cbd02f6). J3r, earlier in this run, is the positive control: R1's mark did paint
      // after a reload, so its absence here is a measurement, not blindness.
      expect(J.AR2!.enrichment?.robustness, '[J8] COULD NOT MEASURE: R2 carries no robustness block').toBeTruthy()
      const want = expectedTagged(J.fragile2!)
      const r1Mark = `${J.edited!.from_label} → ${J.edited!.to_label}`
      await expect.poll(() => fragileTaggedPairs(page), { message: '[J8] the fresh browser does not mark exactly R2\'s fragile edge(s)', timeout: 60_000 }).toEqual(want)
      if (!want.includes(r1Mark)) expect(await fragileTaggedPairs(page), '[J8] R1\'s stale fragile mark is still painted').not.toContain(r1Mark)
      assertBoundaryClean('J8')
      writeEvidence('J8-fresh.json', { H2: J.H2, R2: J.R2, tagged: want })
    } finally {
      await ctx.close()
    }
  })

  test('J9 · account B, in a fresh browser, sees nothing of S', async ({ browser }) => {
    const S = J.S!
    const latest = nodesOf(J.G2 ?? J.G1!)

    // Positive controls, same run: account A CAN see S on both stores.
    const aRest = await scenariosVisibleTo(J.A!.user.accessToken)
    expect(aRest.ids, '[J9 control] account A cannot list its own scenario S via PostgREST').toContain(S)
    const aRead = await storedRead(S, J.A!.user)
    expect(aRead.status, '[J9 control] account A cannot read S from CEE').toBe(200)
    // The UI reads v5_handler_facts directly with the user's token: A sees S's facts.
    const aFacts = await handlerFactsVisibleTo(S, J.A!.user.accessToken)
    expect(aFacts, '[J9 control] A sees no v5_handler_facts for S, so B\'s zero would prove nothing').toBeGreaterThan(0)
    // The storage scan below can see S: A's own browser storage names it.
    const aStore = await browserStorage(pageA)
    expect(Object.entries(aStore).filter(([k, v]) => k.includes(S) || v.includes(S)).length,
      '[J9 control] A\'s browser storage does not name S, so a scan of B\'s would be blind').toBeGreaterThan(0)

    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    try {
      const B = await mintAndInject(page, 'j1-b')
      expect(B.user.userId, '[J9] account B is account A').not.toBe(J.A!.user.userId)

      const bRest = await scenariosVisibleTo(B.user.accessToken)
      expect(bRest.status, '[J9] PostgREST refused B outright (a probe that sees nothing proves nothing)').toBe(200)
      expect(bRest.ids, '[J9] account B can list account A\'s scenario S').not.toContain(S)
      expect(await handlerFactsVisibleTo(S, B.user.accessToken), '[J9] account B can read A\'s v5_handler_facts for S').toBe(0)

      const bRead = await storedRead(S, B.user)
      expect([403, 404], `[J9] CEE served S to account B (status ${bRead.status})`).toContain(bRead.status)
      expect(JSON.stringify(bRead.body ?? {}), '[J9] CEE\'s refusal to B carries A\'s graph').not.toContain(`"${latest[0]}"`)

      // Terminal state first: the UI's OWN read of S, under B's session, is refused. Only
      // then is "none of A's nodes mounted" a measurement rather than a page still loading.
      const uiRead = page.waitForResponse((r) => r.url().includes(`/bff/cee/scenarios/${S}/graph`) && r.request().method() === 'POST', { timeout: 90_000 })
        .catch(() => null)
      await page.goto(`${ORIGIN}/#/scenario/${S}`, { waitUntil: 'load' })
      const refused = await uiRead
      expect(refused, '[J9] COULD NOT MEASURE: B\'s browser never read S from CEE, so an empty canvas proves nothing').not.toBeNull()
      expect([403, 404], `[J9] CEE served S to B's browser (status ${refused!.status()})`).toContain(refused!.status())
      await expect(page.getByRole('button', { name: 'Account menu' }), '[J9] B\'s app shell never rendered signed in').toBeVisible({ timeout: 60_000 })
      const mounted = await renderedNodeIds(page)
      expect(mounted.filter((id) => latest.includes(id)), '[J9] A\'s model rendered in B\'s browser').toEqual([])

      const store = await browserStorage(page)
      const leaks = Object.entries(store).filter(([k, v]) => k.includes(S) || v.includes(S)).map(([k]) => k)
      expect(leaks, '[J9] B\'s browser storage names A\'s scenario').toEqual([])

      writeEvidence('J9-account-b.json', {
        S, a_rest_ids: aRest.ids.length, a_read: aRead.status, a_facts: aFacts, b_rest_status: bRest.status,
        b_rest_ids: bRest.ids.length, b_read: bRead.status, b_ui_read: refused!.status(), b_mounted: mounted.length, b_storage_keys: Object.keys(store).length,
      })
      assertBoundaryClean('J9')
    } finally {
      await ctx.close()
    }
  })

  // ── Gate 3: scenario management (Core Platform github-c0, lease 2g; DL GO 5 Oct 22:1xZ) ──
  // J1/J3r/J8/J9 already carry create, deep link, reload and account B. These add the two
  // steps never witnessed (select from Your scenarios, Duplicate) and the deep-link override
  // check across two scenarios A owns. No LLM call: every row asserts the boundary is clean.

  /** The UI's own POST read of one scenario's graph, as J9 waits for it. */
  const graphRead = (page: Page, id: string) =>
    page.waitForResponse((r) => r.url().includes(`/bff/cee/scenarios/${id}/graph`) && r.request().method() === 'POST', { timeout: 90_000 })
      .catch(() => null)

  /** A card's name, as the list shows it (its h4). */
  const cardName = async (card: Locator) => (await card.getByRole('heading', { level: 4 }).innerText()).trim()

  /**
   * Open a Your-scenarios card the way a user does, on its name. The card's centre is its
   * "Compare with another scenario" button (first run, 5 Oct: a centre click opened Compare),
   * and /scenario/<id>/compare also contains the id, so the route is asserted EXACTLY.
   */
  async function openCard(card: Locator, id: string, label: string) {
    const read = graphRead(pageA, id)
    await card.getByRole('heading', { level: 4 }).click()
    await expect.poll(() => new URL(pageA.url()).hash, { message: `[${label}] the card did not open #/scenario/${id}`, timeout: 30_000 })
      .toBe(`#/scenario/${id}`)
    const res = await read
    expect(res, `[${label}] COULD NOT MEASURE: opening the card never read ${id} from CEE`).not.toBeNull()
    expect(res!.status(), `[${label}] the card's read of ${id} was refused`).toBe(200)
  }

  test('J10 · select: Your scenarios lists S, and choosing its card opens S by identity', async () => {
    const S = J.S!
    const latest = nodesOf(J.G2 ?? J.G1!)
    // A is minted fresh for this run, so its only row is S: one card, and it can only be S.
    const rows = await scenariosVisibleTo(J.A!.user.accessToken)
    expect(rows.ids, '[J10] COULD NOT MEASURE: account A has rows other than S, so the card cannot be bound by elimination').toEqual([S])

    await pageA.goto(`${ORIGIN}/#/scenarios`, { waitUntil: 'load' })
    const cards = pageA.getByTestId('scenario-card')
    await expect(cards, '[J10] Your scenarios does not show exactly A\'s one row').toHaveCount(1, { timeout: 60_000 })
    J.cardS = await cardName(cards.first())
    await openCard(cards.first(), S, 'J10')
    await expect.poll(async () => (await renderedNodeIds(pageA)).sort(), {
      message: '[J10] the chosen scenario does not render S\'s model by id', timeout: 120_000,
    }).toEqual(latest)
    assertBoundaryClean('J10')
    writeEvidence('J10-select.json', { S, card_title: J.cardS })
  })

  test('J11 · copy: Duplicate makes C, owned by A, sourced from S, carrying S\'s model by identity (+J11a brief, +J11b name)', async () => {
    const S = J.S!
    const latest = J.G2 ?? J.G1!
    await pageA.goto(`${ORIGIN}/#/scenarios`, { waitUntil: 'load' })
    const cards = pageA.getByTestId('scenario-card')
    await expect(cards, '[J11] COULD NOT MEASURE: Your scenarios does not show S alone before the copy').toHaveCount(1, { timeout: 60_000 })
    const before = (await scenariosVisibleTo(J.A!.user.accessToken)).ids

    await cards.first().getByRole('button', { name: 'Actions' }).click()
    await pageA.getByRole('menuitem', { name: 'Duplicate' }).click()
    await expect(cards, '[J11] Your scenarios does not show the copy').toHaveCount(2, { timeout: 60_000 })
    const added = (await scenariosVisibleTo(J.A!.user.accessToken)).ids.filter((id) => !before.includes(id))
    expect(added, '[J11] Duplicate did not create exactly one new row for A').toHaveLength(1)
    const C: string = J.C = added[0]!
    expect(C, '[J11] the copy reuses S\'s id').not.toBe(S)

    const row = await scenarioRowVisibleTo(C, J.A!.user.accessToken)
    expect(row.user_id, '[J11] the copy is not owned by A').toBe(J.A!.user.userId)
    expect(row.source_scenario_id, '[J11] the copy does not name S as its source').toBe(S)

    const src = await read('J11 source')
    const copy = await storedRead(C, J.A!.user)
    expect(copy.status, `[J11] CEE's stored read of the copy C=${C} returned ${copy.status}`).toBe(200)
    const g = copy.body!.graph as Graph
    expect(g, '[J11] the copy opens with no model').toBeTruthy()
    expect(nodesOf(g), '[J11] the copy carries different nodes from S').toEqual(nodesOf(latest))
    expect(edgesOf(g), '[J11] the copy carries different links from S').toEqual(edgesOf(latest))
    // The identity hash is an object ({ algorithm, projection_version, value, ... }): S's value must be a
    // real sha256 first, so two absent hashes cannot agree, then the whole object must match.
    expect(src.graph_identity_hash?.value, '[J11] COULD NOT MEASURE: S carries no identity hash').toMatch(/^[0-9a-f]{64}$/)
    expect(copy.body!.graph_identity_hash, '[J11] the copy\'s model identity differs from S\'s').toEqual(src.graph_identity_hash)

    // Open the copy from its own card, found by elimination: the one card whose name is not
    // S's (the name is J11b's to judge). A card has no id: the binding is the exact route + read.
    const names = await cards.getByRole('heading', { level: 4 }).allInnerTexts()
    const others = names.flatMap((name, i) => (name.trim() === J.cardS ? [] : [i]))
    expect(others, `[J11] cannot tell the copy's card from S's: names ${JSON.stringify(names)}`).toHaveLength(1)
    const copyTitle = names[others[0]!]!.trim()
    await openCard(cards.nth(others[0]!), C, 'J11')
    await expect.poll(async () => (await renderedNodeIds(pageA)).sort(), {
      message: '[J11] the copy does not render S\'s model by id', timeout: 120_000,
    }).toEqual(nodesOf(latest))

    // Advisory: what the copy does not carry. duplicate_scenario copies graph + framing, not
    // brief_text, and CEE derives not_modelled from brief_text (a code read, 5 Oct).
    await runAdvisory('J11a_copy_keeps_brief', async () => {
      const got = { brief_present: !!copy.body!.brief_text, not_modelled: copy.body!.not_modelled?.status ?? null }
      const want = { brief_present: !!src.brief_text, not_modelled: src.not_modelled?.status ?? null }
      if (copy.body!.brief_text !== src.brief_text) throw new Error(`the copy opens without S's brief: ${JSON.stringify({ want, got })}`)
      return { want, got }
    })
    await runAdvisory('J11b_copy_keeps_name', async () => {
      if (copyTitle !== `${J.cardS} (copy)`) throw new Error(`S is listed as "${J.cardS}", its copy as "${copyTitle}"`)
      return { source: J.cardS, copy: copyTitle }
    })
    assertBoundaryClean('J11')
    writeEvidence('J11-copy.json', { S, C, source_scenario_id: row.source_scenario_id, nodes: nodesOf(g).length, edges: edgesOf(g).length, graph_identity_hash: copy.body!.graph_identity_hash, card_title: copyTitle })
  })

  test('J12 · account B, in a fresh browser, sees nothing of the copy and cannot copy S', async ({ browser }) => {
    const S = J.S!, C = J.C!
    const latest = nodesOf(J.G2 ?? J.G1!)
    // Positive controls: A can see C on both stores (J11 read it; re-read in this run).
    expect((await scenariosVisibleTo(J.A!.user.accessToken)).ids, '[J12 control] A cannot list its own copy').toContain(C)
    expect((await storedRead(C, J.A!.user)).status, '[J12 control] A cannot read its own copy from CEE').toBe(200)

    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    try {
      const B = await mintAndInject(page, 'j1-b-copy')
      expect(B.user.userId, '[J12] account B is account A').not.toBe(J.A!.user.userId)
      const bBefore = await scenariosVisibleTo(B.user.accessToken)
      expect(bBefore.ids, '[J12] account B can list A\'s copy').not.toContain(C)

      const bRead = await storedRead(C, B.user)
      expect([403, 404], `[J12] CEE served A's copy to account B (status ${bRead.status})`).toContain(bRead.status)
      expect(JSON.stringify(bRead.body ?? {}), '[J12] CEE\'s refusal to B carries A\'s graph').not.toContain(`"${latest[0]}"`)

      // The product's own Duplicate, under B's token, on A's scenario and on A's copy. Bound to
      // the function's OWN refusal (auth_hub_profiles.sql:96, its only definition): a missing
      // RPC (404 PGRST202) or a bad argument (400) is also "not 200" and proves nothing.
      for (const id of [S, C]) {
        const dup = await duplicateAs(id, B.user.accessToken)
        const err = (dup.body ?? {}) as { code?: string; message?: string }
        expect({ status: dup.status, code: err.code, owned: /not owned by user/.test(err.message ?? '') },
          `[J12] account B's copy of A's scenario ${id} was not refused by duplicate_scenario itself`)
          .toEqual({ status: 400, code: 'P0001', owned: true })
        expect(JSON.stringify(dup.body ?? {}), '[J12] B\'s refused copy carries A\'s graph').not.toContain(`"${latest[0]}"`)
      }
      const bAfter = await scenariosVisibleTo(B.user.accessToken)
      expect(bAfter.ids.sort(), '[J12] B\'s refused copies still added rows B can see').toEqual(bBefore.ids.sort())

      const uiRead = graphRead(page, C)
      await page.goto(`${ORIGIN}/#/scenario/${C}`, { waitUntil: 'load' })
      const refused = await uiRead
      expect(refused, '[J12] COULD NOT MEASURE: B\'s browser never read C from CEE, so an empty canvas proves nothing').not.toBeNull()
      expect([403, 404], `[J12] CEE served C to B's browser (status ${refused!.status()})`).toContain(refused!.status())
      await expect(page.getByRole('button', { name: 'Account menu' }), '[J12] B\'s app shell never rendered signed in').toBeVisible({ timeout: 60_000 })
      expect((await renderedNodeIds(page)).filter((id) => latest.includes(id)), '[J12] A\'s copied model rendered in B\'s browser').toEqual([])
      const leaks = Object.entries(await browserStorage(page)).filter(([k, v]) => k.includes(C) || v.includes(C)).map(([k]) => k)
      expect(leaks, '[J12] B\'s browser storage names A\'s copy').toEqual([])
      assertBoundaryClean('J12')
      writeEvidence('J12-account-b-copy.json', { C, b_rest_ids: bAfter.ids.length, b_read: bRead.status, b_ui_read: refused!.status() })
    } finally {
      await ctx.close()
    }
  })

  test('J13 · deep link: with two scenarios, a cold load opens the linked one and a reload keeps it, both ways', async () => {
    const S = J.S!, C = J.C!
    const latest = nodesOf(J.G2 ?? J.G1!)
    expect(new URL(pageA.url()).hash, '[J13] COULD NOT MEASURE: A is not on the copy, so nothing is remembered to override').toBe(`#/scenario/${C}`)
    const reads: string[] = []
    const onRequest = (r: Request) => {
      const m = r.url().match(/\/bff\/cee\/scenarios\/([0-9a-f-]{36})\/graph(\?|$)/i)
      if (m && r.method() === 'POST') reads.push(m[1])
    }
    pageA.on('request', onRequest)
    try {
      // One open, judged at its terminal state: the read of `target` answered, its model
      // rendered, the network settled (a remembered-scenario override would arrive late), and
      // then the route is still exactly `target` and nothing read `other` since the open began.
      const judge = async (target: string, other: string, how: string, open: () => Promise<unknown>) => {
        reads.length = 0
        const read = graphRead(pageA, target)
        await open()
        const res = await read
        expect(res, `[J13] COULD NOT MEASURE: the ${how} of ${target} never read it`).not.toBeNull()
        expect(res!.status(), `[J13] the ${how}'s read of ${target} was refused`).toBe(200)
        await expect.poll(async () => (await renderedNodeIds(pageA)).sort(), { message: `[J13] the ${how} of ${target} does not render`, timeout: 120_000 }).toEqual(latest)
        await pageA.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined)
        expect(new URL(pageA.url()).hash, `[J13] the ${how} of ${target} was overridden`).toBe(`#/scenario/${target}`)
        expect(reads, `[J13] the ${how} of ${target} also read ${other}`).not.toContain(other)
      }
      // Last opened is C, so the remembered scenario is C: the link to S must still open S.
      // Then S is remembered, and the link to C must open C. Each is a new document in the same
      // browser (about:blank first, so no in-app navigation is counted), then a reload.
      for (const [target, other] of [[S, C], [C, S]] as const) {
        await pageA.goto('about:blank')
        await judge(target, other, 'cold deep link', () => pageA.goto(`${ORIGIN}/#/scenario/${target}`, { waitUntil: 'load' }))
        await judge(target, other, 'reload', () => pageA.reload({ waitUntil: 'load' }))
      }
    } finally {
      pageA.off('request', onRequest)
    }
    assertBoundaryClean('J13')
    writeEvidence('J13-deep-link.json', { S, C })
  })
})
