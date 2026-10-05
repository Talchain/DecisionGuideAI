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
 * Required (deterministic under frozen replay): J0 J1 J2(+a,b) J3 J3r J5(+a) J6 J8 J9,
 * and gate 3's J10 J11 J12 J13 (no LLM call; advisory J11a brief, J11b name).
 * Advisory, item 3c (panel after a cold load): J5r (CL-3) and J8c (CL-1/CL-2).
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
  analysisResultOf, assertBoundaryClean, browserStorage, captureTurns, CEE_URL, duplicateAs, edgeKey, evidenceDir,
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
]
// analysis-result-headline.ts:297-298 @ a4977d9d
const ASSUMED_DIRECTION = 'The analysis was not told which way your goal points, so it assumed a higher value is better'
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
const EXPECT: { goal_direction_assumed?: boolean; enrichment_keys?: string[] } =
  fs.existsSync(EXPECT_FILE) ? JSON.parse(fs.readFileSync(EXPECT_FILE, 'utf8')) : {}

type Edge = { from: string; to: string; provenance?: Record<string, any>; strength?: { mean?: number } }
interface Graph { nodes: { id: string; kind?: string; label?: string }[]; edges: Edge[] }
interface Fragile { from_id: string; to_id: string; from_label: string; to_label: string; switch_probability: number; visible?: boolean }

const J: {
  A?: MintedSession; S?: string
  G1?: Graph; H1?: string; H1id?: string
  AR1?: Record<string, any>; A1?: string; R1?: string | null
  autoPassAt?: string | null; R1at?: string | null; R2at?: string | null
  fragile1?: Fragile[]; edited?: Fragile
  G2?: Graph; H2?: string; H2id?: string
  AR2?: Record<string, any>; R2?: string; fragile2?: Fragile[]
  cardS?: string; C?: string
} = {}
const advisory: Record<string, unknown> = {}

let ctxA: BrowserContext
let pageA: Page
let turns: CapturedTurn[]

const nodesOf = (g: Graph) => g.nodes.map((n) => n.id).sort()
const edgesOf = (g: Graph) => g.edges.map(edgeKey).sort()
const labelOf = (g: Graph, id: string) => g.nodes.find((n) => n.id === id)?.label ?? id

async function read(label: string) {
  const r = await storedRead(J.S!, J.A!.user)
  expect(r.status, `[${label}] CEE's stored read for S=${J.S} returned ${r.status}`).toBe(200)
  return r.body!
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

test.describe.serial('J1 · whole PoC', () => {
  test.beforeAll(async ({ browser }) => {
    ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    pageA = await ctxA.newPage()
    turns = captureTurns(pageA)
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

  test('J5 · approved typed edit on the fragile link: H2 ≠ H1, provenance user_specified (+J5a staleness)', async () => {
    const top = [...J.fragile1!].sort((a, b) => b.switch_probability - a.switch_probability)[0]
    J.edited = top
    const edge = pageA.locator(`[data-testid^="rf__edge-"][aria-label^="Connection from ${top.from_label} to ${top.to_label}."]`).first()
    await expect(edge, `[J5] the canvas has no edge "${top.from_label} → ${top.to_label}"`).toBeVisible()

    // A double-click at the path midpoint opens the inspector (journey4 s6, 11b-edge-dbl).
    const pt = await edge.evaluate((el) => {
      const p = el.querySelector('path') as SVGPathElement | null
      if (p?.getTotalLength) {
        const m = p.getPointAtLength(p.getTotalLength() / 2); const c = p.getScreenCTM()!
        return { x: c.a * m.x + c.c * m.y + c.e, y: c.b * m.x + c.d * m.y + c.f }
      }
      const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })
    await pageA.mouse.dblclick(pt.x, pt.y)
    await expect(pageA.getByRole('dialog', { name: 'Edge inspector' }), '[J5] the edge inspector did not open').toBeVisible({ timeout: 15_000 })

    const before = J.G1!.edges.find((e) => e.from === top.from_id && e.to === top.to_id)!
    const band = (await pageA.getByTestId('strength-band-very-strong').getAttribute('aria-pressed')) === 'true'
      ? 'strength-band-slight' : 'strength-band-very-strong'
    const since = Date.now()
    await pageA.getByTestId(band).click()
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
    // Only that edge changed provenance to user_specified.
    const newlyUser = J.G2.edges.filter((e) => e.provenance?.source === 'user_specified' &&
      J.G1!.edges.find((o) => edgeKey(o) === edgeKey(e))?.provenance?.source !== 'user_specified').map(edgeKey)
    expect(newlyUser, '[J5] the edit stamped other edges as the user\'s').toEqual([edgeKey({ from: top.from_id, to: top.to_id })])

    // J5a: staleness is derived at read: R1 is now out of date for H2, and the UI says so.
    expect(body.analysis_state?.run_state?.kind, '[J5a] the stored read does not call R1 stale').toBe('complete_stale')
    expect(body.analysis_state?.run_state?.cause, '[J5a] staleness has the wrong cause').toBe('graph_changed')
    const notice = pageA.getByTestId('analysis-freshness-notice')
    await expect(notice, '[J5a] the UI shows no stale notice').toHaveAttribute('data-freshness', 'stale', { timeout: 30_000 })
    await expect(notice, '[J5a] the stale notice has the wrong words').toContainText('Model changed since this analysis. Re-run to update.')
    writeEvidence('J5-edit.json', { edited: edgeKey({ from: top.from_id, to: top.to_id }), band, H2: J.H2, H2id: J.H2id, mean_before: before.strength?.mean, mean_after: after!.strength?.mean })
  })

  test('J5r · CL-3 (advisory): after the edit, a fresh browser reads R1 as out of date and says so in the live tab\'s words', async ({ browser }) => {
    // Read-only on pageA: J6 continues in that tab, with the inspector still open.
    const liveNotice = pageA.getByTestId('analysis-freshness-notice')
    const live = { freshness: await liveNotice.getAttribute('data-freshness'), text: (await liveNotice.innerText()).trim() }
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    try {
      await runAdvisory('J5r_CL3_fresh_says_stale', async () => {
        await injectSession(page, J.A!.storageKey, J.A!.raw)
        const readS = graphRead(page, J.S!)
        await page.goto(`${ORIGIN}/#/scenario/${J.S}`, { waitUntil: 'load' })
        const res = await readS
        if (!res || res.status() !== 200) throw new Error(`COULD NOT MEASURE: the fresh read of S answered ${res?.status() ?? 'nothing'}`)
        const served = await res.json().catch(() => null)
        const kind = served?.analysis_state?.run_state?.kind
        if (kind !== 'complete_stale') throw new Error(`COULD NOT MEASURE: the fresh read calls R1 ${kind}, not complete_stale`)
        await openDockTab(page, 'Analysis')
        await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined)
        // Evidence first, whatever the verdict: what the server sent and what the page shows.
        await page.screenshot({ path: path.join(evidenceDir(), 'J5r-fresh.png'), fullPage: true })
        writeEvidence('J5r-CL3-served.json', {
          live, run_state: served?.analysis_state?.run_state ?? null, analysis_result_present: served?.analysis_result != null,
          current_read_keys: Object.keys(served?.current_read ?? {}), surfaces: await surfacesOf(page),
        })
        await expect(page.getByTestId('analysis-freshness-notice'), 'the fresh browser shows no stale notice')
          .toHaveAttribute('data-freshness', 'stale', { timeout: 60_000 })
        const fresh = await panelSnapshot(page)
        writeEvidence('J5r-CL3.json', { live, fresh })
        if (fresh.notice?.text !== live.text) throw new Error(`the fresh browser says "${fresh.notice?.text}", the live tab "${live.text}"`)
        if (fresh.freshness_confirmed !== 'false') throw new Error(`the fresh panel presents R1 as confirmed fresh (data-freshness-confirmed=${fresh.freshness_confirmed})`)
        return { live, fresh: { run_status: fresh.run_status, freshness_confirmed: fresh.freshness_confirmed, notice: fresh.notice } }
      })
      assertBoundaryClean('J5r')
    } finally {
      await ctx.close()
    }
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
      const touched = changes.filter((c) => c?.link?.from === J.edited!.from_id && c?.link?.to === J.edited!.to_id)
      if (!touched.length) throw new Error(`run_delta.input_changes does not name the edited link (${changes.length} rows)`)
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
      const e = (r.body!.graph as Graph).edges.find((x) => x.from === J.edited!.from_id && x.to === J.edited!.to_id)
      expect(e?.provenance?.source, '[J8] the edit\'s provenance did not survive the fresh browser').toBe('user_specified')

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

  test('J8c · CL-1/CL-2 (advisory): the panel says the same before a reload, after a same-tab reload, and in a fresh browser', async ({ browser }) => {
    await runAdvisory('J8c_CL1_CL2_panel_agrees', async () => {
      // J7 left the tab on Compare (the dock tab lives in ?tab=, the scenario in the hash).
      if (new URL(pageA.url()).hash !== `#/scenario/${J.S}`) throw new Error(`COULD NOT MEASURE: A's tab is on ${new URL(pageA.url()).hash}, not S`)
      await openDockTab(pageA, 'Analysis')
      await expect(pageA.getByTestId('results-body-stale-wrapper'), 'COULD NOT MEASURE: A\'s tab has no complete result before the reload')
        .toHaveAttribute('data-run-status', 'complete', { timeout: 60_000 })
      const before = await panelSnapshot(pageA, 'J8c-before.png')

      const readS = graphRead(pageA, J.S!)
      await pageA.reload({ waitUntil: 'load' })
      const res = await readS
      if (!res || res.status() !== 200) throw new Error(`COULD NOT MEASURE: the reload read S as ${res?.status() ?? 'nothing'}`)
      await expect(pageA.getByTestId('results-body-stale-wrapper'), 'the reloaded tab never restored a complete result')
        .toHaveAttribute('data-run-status', 'complete', { timeout: 120_000 })
      const reloaded = await panelSnapshot(pageA, 'J8c-reloaded.png')

      const fresh: PanelSnapshot = await (async () => {
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
        try {
          const page = await ctx.newPage()
          await injectSession(page, J.A!.storageKey, J.A!.raw)
          await page.goto(`${ORIGIN}/#/scenario/${J.S}`, { waitUntil: 'load' })
          await openDockTab(page, 'Analysis')
          await expect(page.getByTestId('results-body-stale-wrapper'), 'the fresh browser never restored a complete result')
            .toHaveAttribute('data-run-status', 'complete', { timeout: 120_000 })
          return await panelSnapshot(page, 'J8c-fresh.png')
        } finally {
          await ctx.close()
        }
      })()
      writeEvidence('J8c-CL1-CL2.json', { before, reloaded, fresh })
      // The two sources: R2's live turn block (what the tab rendered before the reload) and the
      // stored read's block (what a cold load renders). Both run ids are recorded: a diff
      // between two different Runs would say nothing about the reload.
      const storedBody = await read('J8c')
      const stored = storedBody.analysis_result
      writeEvidence('J8c-sources.json', {
        live_run_id: J.R2, stored_run_id: storedBody.current_read?.run_delta?.endpoints?.current?.run_id ?? null,
        stored_keys: Object.keys(stored ?? {}), live_keys: Object.keys(J.AR2 ?? {}),
        diff: blockDiff(J.AR2, stored),
      })
      // Run 37386112834: the two analysis_result blocks are identical, so the panel's difference
      // comes from OUTSIDE the block. Record what else each path carries: R2's live turn (bound by
      // its block's computed_against_hash) against the cold read's top level and current_read.
      const r2Turn = [...turns].reverse().find((t) => {
        const ar = analysisResultOf(t.body)
        return ar != null && ar.computed_against_hash === J.AR2?.computed_against_hash
      })
      const shape = (v: unknown) => (Array.isArray(v) ? `array(${v.length})` : v === null ? 'null' : typeof v === 'object' ? `object{${Object.keys(v as object).join(',')}}` : typeof v)
      writeEvidence('J8c-turn-vs-read.json', {
        live_turn_found: r2Turn != null,
        live_turn_top: Object.fromEntries(Object.entries(r2Turn?.body ?? {}).map(([k, v]) => [k, shape(v)])),
        live_turn_blocks: (r2Turn?.body?.blocks ?? []).map((b: any) => ({ type: b?.type, keys: Object.keys(b ?? {}) })),
        read_top: Object.fromEntries(Object.entries(storedBody).map(([k, v]) => [k, shape(v)])),
        read_current_read: Object.fromEntries(Object.entries(storedBody.current_read ?? {}).map(([k, v]) => [k, shape(v)])),
      })
      const differ = ([['reloaded', reloaded], ['fresh', fresh]] as const)
        .filter(([, p]) => panelKey(p) !== panelKey(before)).map(([name]) => name)
      if (differ.length) throw new Error(`the panel differs from before the reload in: ${differ.join(', ')} (texts in J8c-CL1-CL2.json)`)
      return { equal: true, time_matches: { before: before.matches, reloaded: reloaded.matches, fresh: fresh.matches } }
    })
    assertBoundaryClean('J8c')
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

  // ── Item 3c: the panel after a cold load (CL rows; Core Platform github-c0, DL lease 5 Oct 22:5xZ) ──
  // There are no per-figure test ids, so the panel is compared as text. Relative times are the only
  // thing normalised, and every match is written to the evidence: the rows stay ADVISORY until the
  // matches have been read against the raw texts (a normaliser once erased £120000 and every float).
  const PANEL_TIME = [/\b(?:\d+|an?|one) (?:second|minute|hour|day)s? ago\b/gi, /\bjust now\b/gi, /\b\d{1,2}:\d{2}(?::\d{2})?\b/g]
  function normalisePanel(text: string): { normalised: string; matches: string[] } {
    const matches: string[] = []
    let normalised = text
    for (const re of PANEL_TIME) normalised = normalised.replace(re, (m) => { matches.push(m); return '<time>' })
    return { normalised, matches }
  }

  /** What the Analysis panel says, read once its own state has settled. */
  async function panelSnapshot(page: Page, shot?: string) {
    await openDockTab(page, 'Analysis')
    const body = page.getByTestId('results-body-stale-wrapper')
    await expect(body, '[CL] the Analysis panel never rendered a result').toBeVisible({ timeout: 120_000 })
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined)
    if (shot) await page.screenshot({ path: path.join(evidenceDir(), shot), fullPage: true })
    const notice = page.getByTestId('analysis-freshness-notice')
    const text = (await body.innerText()).trim()
    return {
      run_status: await body.getAttribute('data-run-status'),
      freshness_confirmed: await body.getAttribute('data-freshness-confirmed'),
      notice: (await notice.count())
        ? { freshness: await notice.first().getAttribute('data-freshness'), text: (await notice.first().innerText()).trim() }
        : null,
      text,
      ...normalisePanel(text),
    }
  }
  type PanelSnapshot = Awaited<ReturnType<typeof panelSnapshot>>

  /** Which panel surfaces a page is showing, by test id count. */
  const CL_SURFACES = ['results-body-stale-wrapper', 'analysis-freshness-notice', 'stale-results-banner', 'outputs-analysis-empty', 'outputs-pre-run-v3', 'outputs-pre-run']
  const surfacesOf = async (page: Page) =>
    Object.fromEntries(await Promise.all(CL_SURFACES.map(async (id) => [id, await page.getByTestId(id).count()] as const)))

  /**
   * Where two analysis_result blocks differ, by path (values reduced to a type and a short
   * prefix). The live tab renders the turn's block; a cold load renders the stored read's.
   */
  function blockDiff(live: unknown, stored: unknown, depth = 5) {
    const leaves = (v: unknown, at: string, out: Map<string, string>, d: number) => {
      if (v !== null && typeof v === 'object' && d > 0) {
        for (const [k, x] of Object.entries(v as Record<string, unknown>)) leaves(x, at ? `${at}.${k}` : k, out, d - 1)
      } else {
        out.set(at, `${Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v}:${JSON.stringify(v)?.slice(0, 80)}`)
      }
      return out
    }
    const a = leaves(live, '', new Map(), depth), b = leaves(stored, '', new Map(), depth)
    return {
      only_live: [...a.keys()].filter((k) => !b.has(k)),
      only_stored: [...b.keys()].filter((k) => !a.has(k)),
      differ: [...a.keys()].filter((k) => b.has(k) && a.get(k) !== b.get(k)).map((k) => ({ path: k, live: a.get(k), stored: b.get(k) })),
    }
  }
  const panelKey = (p: PanelSnapshot) =>
    JSON.stringify({ run_status: p.run_status, freshness_confirmed: p.freshness_confirmed, notice: p.notice, text: p.normalised })

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
