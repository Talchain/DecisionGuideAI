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
  it('each option whose 0/1 figure is unearned carries the producer’s sentence and no figure', async () => {
    const brief = buildDecisionBrief(await readOf(unearnedRead))
    expect(brief.run.status).toBe('current')

    for (const id of ['raise_price_to_59', 'raise_price_to_54']) {
      const row = brief.chances.find((c) => c.optionId === id)
      expect(row?.chanceText).toBeNull()
      expect(row?.withheldText).toMatch(/^Olumi can’t yet say how likely/)
      expect(row?.withheldText).not.toMatch(/\d+%/)
      const why = brief.withheld.find((w) => w.id === `goal:certainty:${id}`)
      expect(why?.nodeId).toBe(id)
    }
    // Contrast, same body: the EARNED option keeps its figure.
    const earned = brief.chances.find((c) => c.optionId === 'keep_current_price')
    expect(earned?.chanceText).toMatch(/of model runs$/)
    expect(earned?.withheldText).toBeNull()
  })
})

describe('buildDecisionBrief — goal figures withheld for the whole Run (served 0c238873)', () => {
  it('no option carries a figure; the producer’s reason is said once, bound to the goal', async () => {
    const brief = buildDecisionBrief(await readOf(identityWithheldRead))
    expect(brief.run.status).toBe('current')
    expect(brief.chances.length).toBe(3)
    for (const c of brief.chances) {
      expect(c.chanceText).toBeNull()
      expect(c.withheldText).toBe(DECISION_BRIEF_COPY.noFigure)
    }
    const reasons = brief.withheld.filter((w) => w.id === 'goal:identity')
    expect(reasons).toHaveLength(1)
    expect(reasons[0].text).toMatch(/^Not shown\./)
    expect(reasons[0].text).not.toMatch(/\d+%/)
    expect(reasons[0].nodeId).toBe(brief.goal?.nodeId)
    expect(decisionBriefToText(brief)).not.toMatch(/% of model runs/)
  })
})
