/**
 * ⭐⭐ THE OPTION SHARE LINE AND THE LEFT-OUT OPTION, ON PAUL'S REAL RUN
 * (side-by-side DIFF 27 Sep, items 1 and 5; `mrr-90b8f080`).
 *
 * DATA: `e2e/geometry/fixtures/mrr-90b8f080.fixture.json` — Paul's £100k MRR
 * model and its served `analysis_result` block, mapped by the product's own
 * `mapV5AnalysisToReport`. Option ids, labels and shares are the run's. The
 * leader stamp is the run's `leader_claim` (`constraint_verdict_withheld`).
 * ⚠ TWO TRANSLATIONS, NAMED:
 *   · `analysis_ready.options` get `id` from `option_id`, the one mapping
 *     `applyV5State`'s (unexported) `normaliseV5AnalysisReady` documents;
 *   · the fixture dropped `analysis_ready.blockers`, so the option's
 *     missing-value blocker is taken from the same turn's
 *     `analysis_state.readiness.blockers` (`MISSING_OPTION_VALUE`, option
 *     146aa89d, factor "Existing customers grandfathered") and given the
 *     `analysis_ready` shape the card reads (`blocker_type: 'missing_value'`).
 *
 * ITEM 1, served: at landing every analysed option read a bare
 * `68% of runs · Goal only` — caption and bar wrapped onto the slot's clipped
 * second line — on a run where no option ever reaches the goal. Stale, the bar
 * was squeezed to a different width on every card and `Goal only` truncated.
 * ITEM 5, served: stale, the option the run left out switched from
 * `Not analysed` to "On the data so far, the model gave no share of runs for
 * this option" (a computed-looking zero, no `Last run ·`, +20.6px on the card).
 *
 * CLAIM SCOPE: jsdom has no layout. These pin WHICH part of the line may give
 * way (class tokens and element identity), never on-screen widths.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { formatWinProbability } from '../../utils/labelUtils'
import { notAnalysedReasonCopy } from '../../../components/results/utils/notAnalysedCopy'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

interface FxNode { id: string; kind: string; label: string }
interface FxEdge { from: string; to: string }
const fx = JSON.parse(
  readFileSync(resolve(process.cwd(), 'e2e/geometry/fixtures/mrr-90b8f080.fixture.json'), 'utf8'),
) as {
  draft: { nodes: FxNode[]; edges: FxEdge[] }
  analysis_ready: { options: unknown[] }
  analysis_block: unknown
  analysis_state: {
    leader_claim: { permitted: boolean; withheld_reason: string }
    readiness: { blockers: Array<{ code: string; option_id: string; factor_id: string; factor_label: string; message: string }> }
  }
}

const LEFT_OUT = '146aa89d'
const report = mapV5AnalysisToReport(fx.analysis_block as never) as unknown as {
  option_probabilities: Record<string, { win_probability?: number }>
}
const nodes = fx.draft.nodes.map(n => ({ id: n.id, type: n.kind, position: { x: 0, y: 0 }, data: { label: n.label, type: n.kind } }))
const edges = fx.draft.edges.map((e, i) => ({ id: `e${i}`, source: e.from, target: e.to }))
const OPTIONS = fx.draft.nodes.filter(n => n.kind === 'option')
const ANALYSED = OPTIONS.filter(o => typeof report.option_probabilities[o.id]?.win_probability === 'number')
const blocker = fx.analysis_state.readiness.blockers.find(b => b.code === 'MISSING_OPTION_VALUE' && b.option_id === LEFT_OUT)!
const ceeAnalysisReady = {
  ...fx.analysis_ready,
  options: (fx.analysis_ready.options as Array<Record<string, unknown>>).map((o): Record<string, unknown> => ({ ...o, id: o.id ?? o.option_id })),
  blockers: [{ factor_id: blocker.factor_id, factor_label: blocker.factor_label, option_id: blocker.option_id, reason: blocker.message, blocker_type: 'missing_value' }],
}
const RUN_STAMP = {
  permitted: fx.analysis_state.leader_claim.permitted,
  withheld_reason: 'leader_claim_withheld',
  producer_cause: fx.analysis_state.leader_claim.withheld_reason,
}

type Freshness = 'current' | 'changed' | 'cannot_confirm'
const seed = (freshness: Freshness, opts: { stamp?: boolean; phase?: 'pre' | 'post' } = {}) => {
  const post = opts.phase !== 'pre'
  useCanvasStore.setState({
    nodes, edges, ceeAnalysisReady, viewMode: 'standard', analysisStateV1: null,
    analysisFreshness: freshness === 'cannot_confirm'
      ? { freshness: 'unknown', freshnessReason: 'hydrated_without_capture' }
      : { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-09-27T09:41:42.494Z' },
    analysisFreshnessDirty: freshness === 'changed',
    importPendingServerRegistration: false, currentScenarioId: 'mrr-90b8f080',
    v5AnalysisFact: post ? { scenarioId: 'mrr-90b8f080', analysisHash: 'run-90b8', hasRunAnalysisFact: true } : null,
    hasCompletedFirstRun: post,
    results: post
      ? { status: 'complete', hash: 'run-90b8', report: { ...report, ...(opts.stamp === false ? {} : { producer_leader_permission: RUN_STAMP }) } }
      : { status: 'idle', report: null },
  } as never)
}

const renderCard = (id: string) => {
  const n = nodes.find(x => x.id === id)!
  return render(<ReactFlowProvider><OptionNode
    id={n.id} type="option" data={n.data as never} selected={false}
    isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
    dragging={false} zIndex={0} deletable selectable draggable
  /></ReactFlowProvider>)
}

const tokens = (el: Element | null) => new Set((el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))
const byId = (tid: string) => screen.queryByTestId(tid)
/** Every element between `el` and `stop` (exclusive), innermost first. */
const between = (el: Element, stop: Element): Element[] => {
  const out: Element[] = []
  for (let p = el.parentElement; p && p !== stop; p = p.parentElement) out.push(p)
  return out
}
/** A class that lets a box give way: a shrink weight, a wrap, or an ellipsis. */
const GIVES_WAY = (el: Element) => [...tokens(el)].some(c => /^shrink(-\[|$)/.test(c) || c === 'flex-wrap' || c === 'truncate' || c === 'min-w-0')

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false, ceeAnalysisReady: null,
    v5AnalysisFact: null, hasCompletedFirstRun: false, results: { status: 'idle', report: null },
  } as never)
})

describe('preconditions — the real run, read through the product mapper', () => {
  it('five options carry a share, the sixth (146aa89d) has no entry, and the share is goal-only', () => {
    expect(OPTIONS).toHaveLength(6)
    expect(ANALYSED.map(o => o.id).sort()).toEqual(OPTIONS.map(o => o.id).filter(id => id !== LEFT_OUT).sort())
    expect(formatWinProbability(report.option_probabilities.increase_price_to_59.win_probability!)).toBe('68%')
    expect(RUN_STAMP.producer_cause).toBe('constraint_verdict_withheld')
    expect(blocker.factor_label).toBe('Existing customers grandfathered')
    // The served card said the engine returned nothing for it (DIFF JSON), so the
    // option carries a value and an intervention edge: the reason is `not_returned`.
    expect(ceeAnalysisReady.options.find(o => o.id === LEFT_OUT)?.interventions).toEqual({ pro_plan_price: 0.295 })
    expect(edges.some(e => e.source === LEFT_OUT && e.target === 'pro_plan_price')).toBe(true)
  })
})

describe('DIFF item 1 — the model-relative anchor always paints with the figure; the bar always paints', () => {
  it.each(ANALYSED.map(o => [o.id] as const))('%s (current, goal-only): the anchor, the figure and `Goal only` never give way; only the unit does', (id) => {
    seed('current')
    renderCard(id)
    const row = byId(`option-analysis-currency-${id}`)!
    expect(row, 'precondition: the share row renders').not.toBeNull()
    const formatted = formatWinProbability(report.option_probabilities[id].win_probability!)

    // The anchor: whole, and no box between it and the row can squeeze it away.
    const anchor = byId(`option-win-anchor-${id}`)!
    expect(anchor.textContent).toBe('Current model')
    expect(tokens(anchor).has('shrink-0')).toBe(true)
    expect(GIVES_WAY(anchor)).toBe(false)
    expect(between(anchor, row).filter(GIVES_WAY), 'a yielding box wraps the anchor').toEqual([])

    // The narrow-width form of the anchor: `Model`, swapped in by the slot's own
    // width in em (so the counter-scale that squeezes the line also picks the form).
    const compact = byId(`option-win-anchor-compact-${id}`)!
    expect(compact, 'a compact anchor exists for the landing counter-scale').not.toBeNull()
    expect(compact.textContent).toBe('Model')
    expect(tokens(compact).has('shrink-0')).toBe(true)
    expect(tokens(compact).has('[@container(min-width:17.5em)]:hidden')).toBe(true)
    expect(tokens(anchor).has('hidden')).toBe(true)
    expect(tokens(anchor).has('[@container(min-width:17.5em)]:block')).toBe(true)
    expect(tokens(byId(`option-share-slot-${id}`)).has('[container-type:inline-size]')).toBe(true)

    // The figure never gives way; the unit `of runs` is the ONE part that may.
    const figure = byId(`option-win-figure-${id}`)!
    expect(figure.textContent).toBe(formatted)
    expect(tokens(figure).has('shrink-0')).toBe(true)
    expect(between(figure, row).filter(GIVES_WAY)).toEqual([])
    const unit = byId(`option-win-unit-${id}`)!
    expect(unit.textContent?.trim()).toBe('of runs')
    const yieldBox = unit.parentElement!
    expect([...tokens(yieldBox)]).toEqual(expect.arrayContaining(['flex-wrap', 'overflow-hidden', 'h-[1lh]', 'min-w-0', 'shrink-[1000000]']))
    expect(byId(`option-win-readout-${id}`)!.textContent).toBe(`${formatted} of runs`)

    // `Goal only` is whole: never an ellipsis, never squeezed.
    const goalOnly = byId(`option-share-goal-only-${id}`)!
    const qualifier = goalOnly.parentElement!
    expect(qualifier.textContent).toBe('· Goal only')
    expect(qualifier.parentElement).toBe(row)
    expect(tokens(qualifier).has('shrink-0')).toBe(true)
    expect(GIVES_WAY(qualifier)).toBe(false)

    // The bar: out of the text flow, under the line, in the strip the row reserves.
    const fill = row.querySelector('.h-full.rounded-full')!
    const track = fill.parentElement!
    expect([...tokens(track)]).toEqual(expect.arrayContaining(['absolute', 'bottom-0', 'left-0', 'w-[54px]', 'h-[3px]']))
    expect(GIVES_WAY(track)).toBe(false)
    expect(between(track, row).filter(GIVES_WAY)).toEqual([])
    expect([...tokens(row)]).toEqual(expect.arrayContaining(['relative', 'pb-[3px]', 'flex-nowrap']))
  })

  it('STALE (the model changed): `Last run` stays whole, the bar keeps one fixed width on every card, `Goal only` is whole', () => {
    seed('changed')
    for (const { id } of ANALYSED) {
      renderCard(id)
      const row = byId(`option-analysis-currency-${id}`)!
      const anchor = byId(`option-win-anchor-${id}`)!
      expect(anchor.textContent).toBe('Last run')
      expect(GIVES_WAY(anchor), `${id}: "Last run" may not truncate`).toBe(false)
      expect(between(anchor, row).filter(GIVES_WAY)).toEqual([])
      // `Last run` is already the short form: no second anchor.
      expect(byId(`option-win-anchor-compact-${id}`)).toBeNull()
      expect(tokens(anchor).has('hidden')).toBe(false)
      const track = row.querySelector('.h-full.rounded-full')!.parentElement!
      expect(tokens(track).has('w-[54px]')).toBe(true)
      expect(GIVES_WAY(track), `${id}: the stale bar may not shrink per card`).toBe(false)
      const qualifier = byId(`option-share-goal-only-${id}`)!.parentElement!
      expect(GIVES_WAY(qualifier), `${id}: "Goal only" may not truncate`).toBe(false)
      cleanup()
    }
  })

  it('CONTRAST — no qualifier on the line: the long anchor is the only anchor and is never hidden', () => {
    seed('current', { stamp: false })
    renderCard('increase_price_to_59')
    expect(byId('option-share-goal-only-increase_price_to_59')).toBeNull()
    expect(byId('option-win-anchor-compact-increase_price_to_59')).toBeNull()
    const anchor = byId('option-win-anchor-increase_price_to_59')!
    expect(anchor.textContent).toBe('Current model')
    expect(tokens(anchor).has('hidden')).toBe(false)
  })

  it('the accessible name still carries the whole line and its meaning, whatever the width shows', () => {
    seed('current')
    renderCard('increase_price_to_59')
    // R3 5903852225 / AIQ 5903874730: the share says "best in" (it is not a chance).
    expect(byId('option-analysis-currency-increase_price_to_59')!.getAttribute('aria-label')!
      .startsWith('Current model · best in 68% of runs · Goal only. This share compares the options on the goal alone.')).toBe(true)
  })
})

describe('DIFF item 5 — the option the run left out keeps saying so, in the reserved slot', () => {
  const slot = () => byId(`option-share-slot-${LEFT_OUT}`)!
  const line = () => byId(`option-not-analysed-${LEFT_OUT}`)

  it('pre-run: the slot is reserved and empty (the class the post-run slot must keep)', () => {
    seed('current', { phase: 'pre' })
    renderCard(LEFT_OUT)
    expect(slot().textContent).toBe('')
    expect(slot().getAttribute('aria-hidden')).toBe('true')
  })

  it('CURRENT: `Not analysed · needs a value` sits IN the reserved slot, and the reason names the factor', () => {
    seed('current', { phase: 'pre' })
    renderCard(LEFT_OUT)
    const preClass = slot().getAttribute('class')
    cleanup()
    seed('current')
    renderCard(LEFT_OUT)
    expect(line(), 'the not-analysed line renders').not.toBeNull()
    expect(slot().contains(line()), 'it sits in the slot, so the run adds no row').toBe(true)
    expect(slot().getAttribute('class')).toBe(preClass)
    expect(slot().getAttribute('aria-hidden')).toBeNull()
    expect(byId(`option-not-analysed-last-run-${LEFT_OUT}`)).toBeNull()
    expect(byId(`option-not-analysed-reason-${LEFT_OUT}`)!.textContent).toBe('· needs a value')
    const said = line()!.getAttribute('title')!
    expect(said).toContain(notAnalysedReasonCopy('not_returned'))
    expect(said).toContain('Existing customers grandfathered needs a value.')
    expect(byId(`option-result-unavailable-${LEFT_OUT}`)).toBeNull()
  })

  it('⭐ STALE: it still says `Not analysed`, labelled `Last run ·`, never a computed-looking "no share", and no row is added', () => {
    seed('current', { phase: 'pre' })
    renderCard(LEFT_OUT)
    const preClass = slot().getAttribute('class')
    cleanup()
    seed('changed')
    renderCard(LEFT_OUT)
    // The served defect: the pooled sentence replaced the state.
    expect(byId(`option-result-unavailable-${LEFT_OUT}`), 'the pooled "no share of runs" sentence').toBeNull()
    expect(line(), 'the not-analysed line renders on a stale run').not.toBeNull()
    expect(slot().contains(line())).toBe(true)
    expect(slot().getAttribute('class')).toBe(preClass)
    expect(byId(`option-not-analysed-last-run-${LEFT_OUT}`)!.textContent).toBe('Last run · ')
    expect(line()!.textContent!.startsWith('Last run · Not analysed')).toBe(true)
    // One line: it never wraps; the reason is the part that gives way, whole.
    expect([...tokens(line())]).toEqual(expect.arrayContaining(['flex-nowrap', 'whitespace-nowrap']))
    const reason = byId(`option-not-analysed-reason-${LEFT_OUT}`)!
    expect(reason.textContent).toBe('· needs a value')
    expect([...tokens(reason.parentElement)]).toEqual(expect.arrayContaining(['flex-wrap', 'overflow-hidden', 'h-[1lh]', 'shrink-[1000000]']))
    // The engine-blaming sentence is not licensed on a result we cannot vouch for;
    // what is said instead is true whether it was left out or added after the run.
    const said = line()!.getAttribute('title')!
    expect(said).not.toContain(notAnalysedReasonCopy('not_returned'))
    expect(said).not.toMatch(/returned/i)
    expect(said).toContain('The last analysis has no result for this option, so it has no rank and no probability.')
    expect(said).toContain('Existing customers grandfathered needs a value.')
  })

  it('CANNOT CONFIRM (a restored run): `Not analysed`, with no `Last run ·` claim and no engine blame', () => {
    seed('cannot_confirm')
    renderCard(LEFT_OUT)
    expect(line()).not.toBeNull()
    expect(byId(`option-not-analysed-last-run-${LEFT_OUT}`)).toBeNull()
    expect(line()!.textContent!.startsWith('Not analysed')).toBe(true)
    expect(line()!.getAttribute('title')).not.toMatch(/returned/i)
    expect(byId(`option-result-unavailable-${LEFT_OUT}`)).toBeNull()
  })
})
