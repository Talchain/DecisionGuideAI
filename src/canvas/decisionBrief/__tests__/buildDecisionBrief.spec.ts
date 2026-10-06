/**
 * The decision brief builder, driven by SERVED scenario-graph reads (byte-for-byte captures already in this repo,
 * `canvas/hydrate/__tests__/fixtures/`), parsed by the REAL `fetchScenarioGraph` — never a hand-built read.
 *
 *   · served-520aab46-cold  — signed-in MRR, `complete_current` with its result, goal target stamped from the brief,
 *                             two factor levels CEE inferred (`cee_inference`).
 *   · served-c96fc4bb       — `complete_current`; two options' 0/1 goal figures UNEARNED (goal certainty `say`).
 *   · served-6b2b94dd-stale — `complete_stale` (`graph_changed`), no result block.
 *   · served-0c238873       — `complete_current`; every goal figure withheld for the Run (PLoT #416 identity warning).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

import currentRead from '../../hydrate/__tests__/fixtures/served-520aab46-cold.read.json'
import unearnedRead from '../../hydrate/__tests__/fixtures/served-c96fc4bb-eb5e9781.read.json'
import staleRead from '../../hydrate/__tests__/fixtures/served-6b2b94dd-stale.read.json'
import identityWithheldRead from '../../hydrate/__tests__/fixtures/served-0c238873-7f1be5d8.read.json'
import { fetchScenarioGraph } from '../../../adapters/cee/scenarioGraph'
import { buildDecisionBrief, decisionBriefToText, DECISION_BRIEF_COPY, type SavedScenarioRead } from '../buildDecisionBrief'
import { decisionBriefToHtml } from '../decisionBriefHtml'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import recordedRead from '../../hydrate/__tests__/fixtures/served-4f211b13-d1-recorded.read.json'
import type { DecisionRecord } from '../../../components/results/modals'
import { ANALYSIS_NEW_COPY } from '../../../components/results/analysisNew/analysisNewCopy'

const SCENARIO = '00000000-0000-4000-8000-000000000001'

async function readOf(body: unknown): Promise<SavedScenarioRead> {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true, status: 200, headers: new Headers(), json: async () => JSON.parse(JSON.stringify(body)),
  }) as unknown as Response))
  const result = await fetchScenarioGraph(SCENARIO, { retryDelayMs: 0 })
  if (result.status !== 'graph') throw new Error(`served fixture did not parse as a graph read: ${result.status}`)
  return result
}

/** Every figure-bearing string the brief could show as a Run result. */
function runFigureStrings(brief: ReturnType<typeof buildDecisionBrief>): string[] {
  return [
    ...brief.chances.flatMap((c) => [c.chanceText ?? '']),
    ...brief.drivers.map((d) => d.label),
  ].filter((s) => s !== '')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buildDecisionBrief — a current Run (served 520aab46)', () => {
  it('states the decision, every option, the Run time and the saved version', async () => {
    const read = await readOf(currentRead)
    const brief = buildDecisionBrief(read)

    expect(brief.decision.nodeId).toBe('should_we_raise_our_pro_plan_price_from_49_to_59_a_month')
    expect(brief.options.map((o) => o.nodeId)).toEqual(['raise_to_59', 'keep_49_price', 'raise_to_54'])
    expect(brief.run.status).toBe('current')
    expect(brief.run.computedAt).toBe('2026-09-30T02:25:02.683Z')
    expect(brief.run.computedAtText).toBe('30 Sept 2026, 02:25 UTC')
    expect(brief.version.graphHash).toBe('45019418c5b12b05')
    expect(brief.version.shortVersion).toBe('45019418')
  })

  it('gives each option its Run figure as a share of model runs, bound by option id', async () => {
    const brief = buildDecisionBrief(await readOf(currentRead))

    expect(brief.chances.map((c) => c.optionId)).toEqual(['raise_to_59', 'keep_49_price', 'raise_to_54'])
    for (const c of brief.chances) {
      if (c.chanceText !== null) expect(c.chanceText).toMatch(/^Reaches your target in (about|fewer than|more than) \d+(\.\d+)?% of model runs$/)
      else expect(c.withheldText).toBeTruthy()
    }
    expect(brief.chances.some((c) => c.chanceText !== null)).toBe(true)
    expect(brief.drivers.length).toBeGreaterThan(0)
  })

  it('labels the goal target as the brief’s only on CEE’s own stamp', async () => {
    const brief = buildDecisionBrief(await readOf(currentRead))
    expect(brief.goal?.nodeId).toBe('mrr')
    expect(brief.goal?.targetText).toContain('85,000')
    expect(brief.goal?.targetSource).toEqual({ kind: 'brief', label: 'From your brief' })
  })

  it('labels an Olumi-sourced level as Olumi’s estimate, and a brief-stated one as the brief’s', async () => {
    const brief = buildDecisionBrief(await readOf(currentRead))
    const byId = new Map(brief.figures.map((f) => [f.nodeId, f]))

    // `monthly_churn`: observed_state.source 'cee_inference', extractionType 'inferred' — Olumi's.
    expect(byId.get('monthly_churn')?.source).toEqual({ kind: 'olumi', label: 'Olumi’s estimate' })
    expect(byId.get('monthly_new_paying_subscribers')?.source.kind).toBe('olumi')
    // Contrast, same body: `pro_plan_price` and `paying_subscribers` are 'brief_extraction'.
    expect(byId.get('pro_plan_price')?.source).toEqual({ kind: 'brief', label: 'From your brief' })
    expect(byId.get('paying_subscribers')?.source.kind).toBe('brief')
    // The figure is the level in its own unit, never the normalised 0-1 value.
    expect(byId.get('pro_plan_price')?.valueText).toContain('49')
    expect(byId.get('pro_plan_price')?.valueText).not.toContain('0.245')
  })

  it('says what the Run could not check about a limit, bound to the limited factor', async () => {
    const brief = buildDecisionBrief(await readOf(currentRead))
    const limit = brief.limits.find((l) => l.id === 'agent-lane:monthly_churn:<=')
    expect(limit?.nodeId).toBe('monthly_churn')
    // provenance 'explicit' with no source_quote: nothing records it came from the brief — unknown stays unknown.
    expect(limit?.source.kind).toBe('unknown')
    const row = brief.withheld.find((w) => w.id === 'limit:agent-lane:monthly_churn:<=')
    expect(row?.nodeId).toBe('monthly_churn')
    expect(row?.text).toContain('Checked only against an assumed figure')
  })
})

describe('buildDecisionBrief — a Run that is not current shows no figure as current', () => {
  it('served stale read (complete_stale, no result): no chances, no drivers, and it says what it needs', async () => {
    const brief = buildDecisionBrief(await readOf(staleRead))
    expect(brief.run.status).toBe('not_current')
    expect(brief.run.statement).toBe(DECISION_BRIEF_COPY.runStale)
    expect(brief.chances).toEqual([])
    expect(brief.drivers).toEqual([])
    expect(brief.withheld.map((w) => w.text)).toContain(DECISION_BRIEF_COPY.runStaleNeed)
    expect(decisionBriefToText(brief)).not.toMatch(/% of model runs/)
    // The model itself is still described: options and goal survive a stale Run.
    expect(brief.options.length).toBeGreaterThan(0)
  })

  it('MUTANT CONTROL: the current body with only its verdict flipped to stale shows no figures, though the result block is still there', async () => {
    const current = await readOf(currentRead)
    expect(runFigureStrings(buildDecisionBrief(current)).length).toBeGreaterThan(0) // the same body DOES carry figures
    const flipped: SavedScenarioRead = {
      ...current,
      analysisState: {
        ...current.analysisState!,
        run_state: { kind: 'complete_stale', computed_at: '2026-09-30T02:25:02.683Z', cause: 'graph_changed' },
      },
    }
    const brief = buildDecisionBrief(flipped)
    expect(brief.run.status).toBe('not_current')
    expect(runFigureStrings(brief)).toEqual([])
    expect(brief.withheld.filter((w) => w.id.startsWith('limit:'))).toEqual([])
  })

  it('a current verdict that asks for a rerun, or no verdict at all, shows no figures', async () => {
    const current = await readOf(currentRead)
    const rerun = buildDecisionBrief({ ...current, analysisState: { ...current.analysisState!, requires_rerun: true } })
    expect(rerun.run.status).toBe('not_current')
    expect(runFigureStrings(rerun)).toEqual([])

    const silent = buildDecisionBrief({ ...current, analysisState: null })
    expect(silent.run.status).toBe('unknown')
    expect(runFigureStrings(silent)).toEqual([])
  })
})

describe('buildDecisionBrief — a withheld goal figure is a reason, not a number (served c96fc4bb)', () => {
  it('each option whose 0/1 figure is unearned gives the producer’s sentence as a reason, bound to the option', async () => {
    const brief = buildDecisionBrief(await readOf(unearnedRead))
    expect(brief.run.status).toBe('current')

    for (const id of ['raise_price_to_59', 'raise_price_to_54']) {
      const why = brief.withheld.find((w) => w.id === `goal:certainty:${id}`)
      expect(why?.text).toMatch(/^Olumi can’t yet say how likely/)
      expect(why?.text).not.toMatch(/\d+%/)
      expect(why?.nodeId).toBe(id)
    }
    // ⛔ THE COMPLETE-FIELD RULE (the Reasoning tab's): the EARNED option's figure is held back too, never shown alone,
    // and with no option carrying a figure the brief says so ONCE, not a row per option.
    expect(brief.chances).toEqual([])
    expect(brief.chancesNote).toBe(DECISION_BRIEF_COPY.noChances)
    expect(decisionBriefToText(brief)).not.toMatch(/of model runs/)
  })

  it('CONTRAST: the same Run with the two withheld options taken out (not in the Run) → the earned figure is shown', async () => {
    const body = JSON.parse(JSON.stringify(unearnedRead))
    const out = new Set(['raise_price_to_59', 'raise_price_to_54'])
    const enrichment = body.analysis_result.enrichment
    enrichment.option_comparison = enrichment.option_comparison.filter((o: { option_id: string }) => !out.has(o.option_id))
    body.analysis_result.win_probabilities = { 'Keep current price': body.analysis_result.win_probabilities['Keep current price'] }
    body.analysis_goal_certainty = body.analysis_goal_certainty.filter((g: { option_id: string }) => !out.has(g.option_id))
    const brief = buildDecisionBrief(await readOf(body))
    expect(brief.run.status).toBe('current')
    expect(brief.chances.find((c) => c.optionId === 'keep_current_price')?.chanceText).toMatch(/of model runs$/)
    for (const id of out) expect(brief.chances.find((c) => c.optionId === id)?.withheldText).toBe(DECISION_BRIEF_COPY.noFigure)
    expect(brief.chancesNote).toBeNull()
  })
})

describe('buildDecisionBrief — goal figures withheld for the whole Run (served 0c238873)', () => {
  it('no option carries a figure; the producer’s reason is said once, bound to the goal', async () => {
    const brief = buildDecisionBrief(await readOf(identityWithheldRead))
    expect(brief.run.status).toBe('current')
    // ONE line, not three "No figure for this option" rows over the reason below (served D1 witness 5947614047).
    expect(brief.chances).toEqual([])
    expect(brief.chancesNote).toBe(DECISION_BRIEF_COPY.noChances)
    expect(decisionBriefToText(brief).match(new RegExp(DECISION_BRIEF_COPY.noFigure, 'g'))).toBeNull()
    const reasons = brief.withheld.filter((w) => w.id === 'goal:identity')
    expect(reasons).toHaveLength(1)
    expect(reasons[0].text).toMatch(/^Not shown\./)
    expect(reasons[0].text).not.toMatch(/\d+%/)
    expect(reasons[0].nodeId).toBe(brief.goal?.nodeId)
    expect(decisionBriefToText(brief)).not.toMatch(/% of model runs/)
  })
})

// ─── The decision on record (MG 5948544303) ──────────────────────────────────

/** A record as the capture modal writes it (`DecisionRecordModal` → `decisionRecordStore`); a guest's has no `remote`. */
function recordOf(over: Record<string, unknown> = {}): DecisionRecord {
  return {
    position: 'option', optionId: 'keep_49_price', optionLabel: 'Keep the £49 price', optionNumber: null, confidence: 70,
    rationale: 'Churn risk outweighs the MRR gain', assumptionToWatch: 'Churn stays below 5%',
    revisitTrigger: 'If monthly churn passes 4%', analysisHash: null, savedAt: Date.UTC(2026, 9, 2, 8, 0), remote: null,
    ...over,
  } as unknown as DecisionRecord
}

describe('buildDecisionBrief — the decision on record', () => {
  it('⛔ SERVED (D1, UI 919ba207): a record made in session is shown after reload, though its hash is NOT the read’s', async () => {
    // The record exactly as the served capture modal stored it, and the saved read of the SAME Run (record-diag 09:3xZ).
    const record = recordOf({
      optionId: 'integration_bug_fix_sprint', optionLabel: 'Integration Bug Fix Sprint', optionNumber: 2,
      expectation: 'Trial completion recovers within a month', rationale: 'The integration bug costs trial signups every week',
      assumptionToWatch: 'Engineering can only do one properly', revisitTrigger: 'If the enterprise prospect signs elsewhere',
      analysisHash: 'v5:6b6d9a458c867c64', savedAt: 1790933585060,
    })
    const read = await readOf(recordedRead)
    // The divergence that made a hash filter hide every in-session record: same Run, different block bytes.
    expect(mapV5AnalysisToReport(read.analysisResult as never).model_card.response_hash).not.toBe(record.analysisHash)
    const brief = buildDecisionBrief(read, record)
    expect(brief.record?.position).toBe('Option 2: Integration Bug Fix Sprint')
    expect(brief.record?.rows.map((r) => r.label)).toContain(ANALYSIS_NEW_COPY.decisionRecord.expectationLabel)
  })

  it('a record is said in the card’s own words', async () => {
    const read = await readOf(currentRead)
    const brief = buildDecisionBrief(read, recordOf({ analysisHash: 'v5:0000000000000001' }))
    const copy = ANALYSIS_NEW_COPY.decisionRecord
    expect(brief.record?.heading).toBe(copy.recorded)
    expect(brief.record?.position).toBe('Keep the £49 price')
    expect(brief.record?.rows).toEqual([
      { label: copy.confidenceLabel, text: `70 ${copy.confidenceSuffix}` },
      { label: copy.rationaleLabel, text: 'Churn risk outweighs the MRR gain' },
      { label: copy.assumptionLabel, text: 'Churn stays below 5%' },
      { label: copy.revisitLabel, text: 'If monthly churn passes 4%' },
    ])
    expect(brief.record?.recordedOn).toBe(`${copy.recordedOnPrefix} 2 Oct 2026`)
    // A guest's record is said to be on this device, in the card's own sentence.
    expect(brief.record?.storage).toBe(copy.storedLocal)
    const text = decisionBriefToText(brief)
    expect(text).toContain(copy.recorded)
    expect(text).toContain('Keep the £49 price')
    expect(decisionBriefToHtml(brief)).toContain('Keep the £49 price')
  })

  it('no Run result, or no hash on the record → still shown, with the date it was recorded', async () => {
    const stale = buildDecisionBrief(await readOf(staleRead), recordOf({ analysisHash: 'fnv1a-64:some-run' }))
    expect(stale.record?.position).toBe('Keep the £49 price')
    const unhashed = buildDecisionBrief(await readOf(currentRead), recordOf({ analysisHash: null }))
    expect(unhashed.record?.recordedOn).toBe(`${ANALYSIS_NEW_COPY.decisionRecord.recordedOnPrefix} 2 Oct 2026`)
  })

  it('a signed-in record the server confirmed is NOT said to be on this device only; a not-ready record names no option', async () => {
    const read = await readOf(currentRead)
    const remote = { recordId: 'dr_1', reviewDate: '2026-11-02', reviewDateSource: 'user_set', storedTextFields: [] }
    expect(buildDecisionBrief(read, recordOf({ remote })).record?.storage).not.toBe(ANALYSIS_NEW_COPY.decisionRecord.storedLocal)
    const notReady = recordOf({ position: 'not_ready', optionId: undefined, optionLabel: undefined, optionNumber: undefined, confidence: undefined })
    const brief = buildDecisionBrief(read, notReady)
    expect(brief.record?.position).toBe('Not ready to choose')
    expect(brief.record?.rows.map((r) => r.label)).not.toContain(ANALYSIS_NEW_COPY.decisionRecord.confidenceLabel)
  })

  it('no record → no section', async () => {
    expect(buildDecisionBrief(await readOf(currentRead)).record).toBeNull()
  })
})

/**
 * SD-1 (domain 2, github-07; DL 0df0e1 6 Oct): the brief says the side the goal holds, from its own `goal_direction`
 * (the one source, `heldTargetBoundWords`) — Codex #2544 r1 found it printed a ceiling as a bare figure.
 */
describe('buildDecisionBrief: a goal that holds a ceiling says "at most"', () => {
  function withGoalDirection(direction: string | undefined) {
    const body = JSON.parse(JSON.stringify(currentRead)) as { graph: { goal_node_id?: string; nodes: Array<Record<string, unknown>> } }
    const goal = body.graph.nodes.find((n) => n.id === body.graph.goal_node_id || n.kind === 'goal')!
    if (direction === undefined) delete goal.goal_direction
    else goal.goal_direction = direction
    return body
  }
  it('held "<=" → "at most …"; CONTRAST: unheld and a held floor say the bare figure', async () => {
    const ceiling = buildDecisionBrief(await readOf(withGoalDirection('<=')))
    expect(ceiling.goal?.targetText).toMatch(/^at most /)
    for (const d of [undefined, '>=']) {
      const other = buildDecisionBrief(await readOf(withGoalDirection(d)))
      expect(other.goal?.targetText).toBeTruthy()
      expect(other.goal?.targetText).not.toMatch(/at most|at least/)
    }
  })
})

