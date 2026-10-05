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
 * Required (deterministic under frozen replay): J0 J1 J2(+a,b) J3 J3r J5(+a) J6 J8 J9.
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
import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import {
  enterAuthenticated, installWireInterceptor, mintAndInject, openDockTab, ORIGIN, renderedNodeIds,
  submitBrief, waitForDraftTurnComplete, type MintedSession,
} from '../lib/harness'
import {
  analysisResultOf, assertBoundaryClean, browserStorage, captureTurns, CEE_URL, edgeKey,
  frozenRecordings, handlerFactsVisibleTo, injectSession, ledger, nextTurn, scenarioIdFromUrl, scenariosVisibleTo,
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
})
