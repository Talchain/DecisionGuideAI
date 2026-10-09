/**
 * Compare v3 input rows (handoff 4 Oct 2026 §1, §3; Paul 7 Oct "keep implementing and completing it"): a heading with the
 * recorded-change count; per row a kind icon, the input's name and context, a crosshair to the canvas, and its recorded
 * before → after (values, a four-step strength band position, or the estimate's origin); all recorded rows immediately;
 * incomplete coverage visible.
 *
 * Bound by IDENTITY: the producer's kind / change / field / band id / sizing literal, row ids into the canvas, and the
 * row's own sentence (`inputRowText`) verbatim. Every "absent" row has a present control. Reasoning's receipt is the
 * control surface: it keeps the sentence list, unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { RunDelta } from '@talchain/schemas/boundary'
import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'
import { useCanvasStore } from '../../store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { canvasLinkOfTarget, useCanvasLight } from '../../graphChanges/rowCanvasLink'
import { buildRunDeltaView, type RunDeltaInputRow } from '../../../components/results/analysisNew/runDeltaView'
import { INPUTS_PARTIAL_TEXT, WHATS_CHANGED_TESTID, WhatsChanged, inputRowText } from '../../../components/results/analysisNew/sections/WhatsChanged'
import {
  ACCEPTED_ESTIMATE_NOTE, inputRowContext, inputRowName, inputRowValues, sizingLabel, strengthBandIndex,
} from '../../../components/results/analysisNew/sections/inputChangeRowParts'
import { INPUT_CHANGE_ROWS_HEADING, inputChangeCount } from '../../../components/results/analysisNew/sections/InputChangeRows'
import { COMPARE_RUN_PAIR_TESTID, CompareRunPairBody } from '../CompareRunPairBody'
import { COMPARE_RUN_IN_PROGRESS_HEADING, COMPARE_RUN_IN_PROGRESS_TEXT } from '../ComparePairSections'
import { COMPARE_SUPPORT_AXIS, COMPARE_SUPPORT_HELP, COMPARE_SUPPORT_TESTID } from '../CompareSupportFigures'
import { RUN_CHANGE_LABELS, runChangeDelta } from './__fixtures__/runChangeArtefact'

vi.mock('../../graphChanges/rowCanvasLink', () => ({ canvasLinkOfTarget: vi.fn(), useCanvasLight: vi.fn() }))
const original = useCanvasStore.getState()
const T = WHATS_CHANGED_TESTID

const LABELS = new Map([...RUN_CHANGE_LABELS, ['fac_demand', 'Demand'], ['out_rev', 'Revenue'], ['fac_churn', 'Churn']])
const labelFor = (id: string) => LABELS.get(id) ?? null

// The producer's rows. `option_setting` first (the fixture's own), then a factor value, a strength band, a sizing +
// strength pair for one link (folded into ONE row), a link added and an option that left.
const ROWS = {
  setting: {
    entity_kind: 'option_setting', entity_id: 'fac_price', option_id: 'opt_60', field: 'value',
    label_before: 'Pro price', label_after: 'Pro price', before: { raw: 59, unit: '£' }, after: { raw: 60, unit: '£' }, change: 'changed',
  },
  factor: {
    entity_kind: 'factor_value', entity_id: 'fac_demand', field: 'value',
    label_before: 'Demand', label_after: 'Demand', before: { raw: 120 }, after: { raw: 150 }, change: 'changed',
  },
  strength: {
    entity_kind: 'link', entity_id: 'e_demand_rev', field: 'strength', link: { from: 'fac_demand', to: 'out_rev' },
    before: { raw: 'moderate' }, after: { raw: 'strong' }, change: 'changed',
  },
  sizing: {
    entity_kind: 'link', entity_id: 'e_churn_rev', field: 'sizing', link: { from: 'fac_churn', to: 'out_rev' },
    before: { raw: 'olumi_estimate' }, after: { raw: 'olumi_accepted' }, change: 'changed',
  },
  sizingStrength: {
    entity_kind: 'link', entity_id: 'e_churn_rev', field: 'strength', link: { from: 'fac_churn', to: 'out_rev' },
    before: { raw: 'slight' }, after: { raw: 'moderate' }, change: 'changed',
  },
  linkAdded: {
    entity_kind: 'link', entity_id: 'e_price_churn', field: 'presence', link: { from: 'fac_price', to: 'fac_churn' },
    before: null, after: { raw: true }, change: 'added',
  },
  optionLeft: {
    entity_kind: 'option', entity_id: 'opt_49', field: 'presence', label_before: 'Keep £49',
    before: { raw: true }, after: null, change: 'removed',
  },
} as const

const delta = (rows: readonly object[], coverage: 'complete' | 'partial' = 'complete') =>
  runChangeDelta({ input_changes: rows as RunDelta['input_changes'], input_coverage: coverage })
const viewRows = (rows: readonly object[]): readonly RunDeltaInputRow[] => buildRunDeltaView(delta(rows), labelFor, labelFor).inputs!.rows

function seed(d: RunDelta, { onCanvas = true, status = 'complete' }: { onCanvas?: boolean; status?: string } = {}): string {
  const report = mapV5AnalysisToReport({ type: 'analysis_result', summary: 'Options compared',
    leading_option_id: 'opt_49', win_probabilities: { opt_60: 0.44, opt_49: 0.56 } })
  report.producer_leader_permission = { permitted: true }
  const hash = report.model_card.response_hash
  const nodes = onCanvas ? [...LABELS.keys()].map((id) => ({ id, type: id.startsWith('opt') ? 'option' : 'factor', position: { x: 0, y: 0 }, data: { label: LABELS.get(id) } })) : []
  const edges = onCanvas ? [{ id: 'edge-dr', source: 'fac_demand', target: 'out_rev' }, { id: 'edge-cr', source: 'fac_churn', target: 'out_rev' }, { id: 'edge-pc', source: 'fac_price', target: 'fac_churn' }] : []
  useCanvasStore.setState({ currentScenarioId: 'scn-1', nodes, edges,
    results: { status, progress: 100, report, hash },
    runDelta: { delta: d, analysisHash: hash, scenarioId: 'scn-1' },
    analysisStateV1: AnalysisStateV1Schema.parse({
      run_state: { kind: 'complete_current', computed_at: '2026-09-30T13:09:00.000Z' }, readiness: { status: 'ready', blockers: [] },
      leader_claim: { permitted: true }, robustness: {}, usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
      requires_rerun: false, blocked_unusable: false, contradictions: [],
    }), analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' }, analysisFreshnessDirty: false,
    importPendingServerRegistration: false, hasCompletedFirstRun: true, ceeAnalysisReady: null,
  } as never)
  return hash
}
const inputsSection = () => document.querySelector('[data-compare-section="inputs"]') as HTMLElement
const rowEls = () => within(inputsSection()).getAllByTestId(`${T}-input-row`)

const focusSpy = vi.fn()
const lightOn = vi.fn()
const lightOff = vi.fn()
beforeEach(() => {
  useCanvasStore.setState(original, true)
  focusSpy.mockReset(); lightOn.mockReset(); lightOff.mockReset()
  vi.mocked(canvasLinkOfTarget).mockImplementation((target) => (target ? { target, focus: focusSpy, highlight: vi.fn() } : null) as never)
  vi.mocked(useCanvasLight).mockReturnValue({ on: lightOn, off: lightOff } as never)
})
afterEach(() => { cleanup(); useCanvasStore.setState(original, true) })

describe('the row parts are read from the producer\'s row by identity', () => {
  it('an option setting: its own name, its option as context, the recorded values', () => {
    const [row] = viewRows([ROWS.setting])
    expect(inputRowName(row)).toBe('Pro price')
    expect(inputRowContext(row)).toBe('Raise to £60')
    expect(inputRowValues(row)).toEqual({ kind: 'pair', before: '£59', after: '£60', beforeMissing: false, afterMissing: false })
    // The sentence (Reasoning's words) is unchanged by the split.
    expect(inputRowText(row)).toBe('Pro price, Raise to £60: £59 → £60')
  })

  it('a compound or money unit reads as the canvas card reads it (served witness 7 Oct: "39 £ per paying customer per month")', () => {
    const at = (before: number, after: number, unit: string) => viewRows([{ ...ROWS.setting, before: { raw: before, unit }, after: { raw: after, unit } }])[0]
    expect(inputRowValues(at(39, 49, '£ per paying customer per month'))).toMatchObject({ before: '£39 per paying customer / month', after: '£49 per paying customer / month' })
    expect(inputRowValues(at(49, 59, 'GBP per month'))).toMatchObject({ before: '£49 / month', after: '£59 / month' })
    expect(inputRowValues(at(1200, 1500, 'GBP'))).toMatchObject({ before: '£1,200', after: '£1,500' })
    // Controls: a unit neither owner recognises prints exactly as before, and the sentence carries the same reading.
    expect(inputRowValues(at(12, 14, 'hours/week'))).toMatchObject({ before: '12 hours/week', after: '14 hours/week' })
    expect(inputRowText(at(39, 49, '£ per paying customer per month'))).toBe('Pro price, Raise to £60: £39 per paying customer / month → £49 per paying customer / month')
  })

  it('a strength change: band words and each side\'s band position (control: an unknown band has no position)', () => {
    const [row] = viewRows([ROWS.strength])
    expect(inputRowName(row)).toBe('Demand → Revenue')
    expect(inputRowContext(row)).toBe('Relationship strength')
    const v = inputRowValues(row)
    expect(v).toMatchObject({ kind: 'strength', beforeBand: 1, afterBand: 2 })
    expect([strengthBandIndex('slight'), strengthBandIndex('very_strong'), strengthBandIndex('huge'), strengthBandIndex(null)]).toEqual([0, 3, null, null])
  })

  it('sizing + strength for one link are ONE row: origin labels, accepted, and the folded strength (RC one-sentence rule)', () => {
    const rows = viewRows([ROWS.sizing, ROWS.sizingStrength])
    expect(rows).toHaveLength(1)
    const v = inputRowValues(rows[0])
    expect(v).toMatchObject({ kind: 'sizing', before: "Olumi's estimate", after: "Olumi's estimate, accepted", accepted: true })
    expect(v.kind === 'sizing' && v.strength).toMatchObject({ beforeBand: 0, afterBand: 1 })
    expect(inputRowContext(rows[0])).toBe('Recorded origin of the estimate')
    // Control: the user's own estimate is not "accepted".
    expect(inputRowValues(viewRows([{ ...ROWS.sizing, after: { raw: 'user' } }])[0])).toMatchObject({ accepted: false, after: 'Your own estimate' })
    expect(sizingLabel('placeholder')).toBe('Not yet sized')
  })

  it('structure changes say what happened, not a value (control: a factor value added reads Not set → value)', () => {
    const [added, left] = viewRows([ROWS.linkAdded, ROWS.optionLeft])
    expect(inputRowValues(added)).toEqual({ kind: 'status', text: 'Added to the model' })
    expect(inputRowValues(left)).toEqual({ kind: 'status', text: 'Left the comparison' })
    const [fresh] = viewRows([{ ...ROWS.factor, before: null, change: 'added' }])
    expect(inputRowValues(fresh)).toEqual({ kind: 'pair', before: 'Not set', after: '150', beforeMissing: true, afterMissing: false })
  })
})

describe('Compare draws the rows (v3 anatomy)', () => {
  it('the heading counts the recorded changes; each row has its kind icon, name, context, values and the sentence for screen readers', () => {
    render(<CompareRunPairBody responseHash={seed(delta([ROWS.setting, ROWS.factor]))} />)
    const section = inputsSection()
    expect(within(section).getByRole('heading', { level: 3 })).toHaveTextContent(INPUT_CHANGE_ROWS_HEADING)
    expect(section).toHaveAccessibleName(INPUT_CHANGE_ROWS_HEADING)
    expect(within(section).getByTestId('compare-input-count')).toHaveTextContent('2 changes')
    const [setting, factor] = rowEls()
    expect(setting.querySelector('svg.lucide-lightbulb')).not.toBeNull()
    expect(factor.querySelector('svg.lucide-settings')).not.toBeNull()
    // The DRAWN parts, each on its own element (Codex r1 P2: the hidden sentence must not satisfy these).
    const drawn = (li: HTMLElement) => ['name', 'context', 'values'].map((k) => li.querySelector(`[data-testid="compare-input-row-${k}"]`)?.textContent ?? null)
    expect(drawn(setting)).toEqual(['Pro price', 'Raise to £60', '£59£60'])
    expect(drawn(factor)).toEqual(['Demand', 'Shared assumption', '120150'])
    expect(setting.querySelector('[data-testid="compare-input-row-values"] svg[class*="lucide-arrow-right"]')).not.toBeNull()
    expect(setting.querySelector('.sr-only')?.textContent).toBe('Pro price, Raise to £60: £59 → £60')
    expect(factor.querySelector('.sr-only')?.textContent).toBe('Demand: 120 → 150')
  })

  it('the crosshair focuses the row\'s own element and marks the row; hover and keyboard focus light it', () => {
    render(<CompareRunPairBody responseHash={seed(delta([ROWS.setting]))} />)
    const [row] = rowEls()
    const crosshair = within(row).getByRole('button', { name: 'Show on the canvas: Pro price, Raise to £60: £59 → £60' })
    expect(crosshair).toHaveAttribute('data-testid', `${T}-input-row-focus`)
    fireEvent.mouseEnter(row)
    expect(lightOn).toHaveBeenCalledTimes(1)
    fireEvent.mouseLeave(row)
    expect(lightOff).toHaveBeenCalledTimes(1)
    fireEvent.click(crosshair)
    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(row).toHaveAttribute('data-selected', 'true')
    expect(crosshair).toHaveAttribute('aria-pressed', 'true')
  })

  it('nothing on the canvas now: no crosshair, says so (control: a removed input says nothing more)', () => {
    render(<CompareRunPairBody responseHash={seed(delta([ROWS.setting, ROWS.optionLeft]), { onCanvas: false })} />)
    const [setting, left] = rowEls()
    expect(within(setting).queryByRole('button')).toBeNull()
    expect(within(setting).getByTestId(`${T}-input-row-off-canvas`)).toHaveTextContent('Not on the canvas now.')
    expect(within(left).queryByTestId(`${T}-input-row-off-canvas`)).toBeNull()
    expect(left).toHaveTextContent('Left the comparison')
  })

  it('each strength row draws its own ordered bands; sizing is a separate row', () => {
    render(<CompareRunPairBody responseHash={seed(delta([ROWS.strength, ROWS.sizing, ROWS.sizingStrength]))} />)
    const [strength, sizing] = rowEls()
    const steps = within(strength).getByTestId('compare-input-strength-steps').querySelectorAll('i')
    expect([...steps].map((s) => [s.getAttribute('data-band'), s.getAttribute('data-at')])).toEqual([
      ['slight', null], ['moderate', 'before'], ['strong', 'after'], ['very_strong', null],
    ])
    expect(strength.querySelector('svg[class*="lucide-link"]')).not.toBeNull()
    // (The contract refuses a "changed" strength with equal bands, so no real row reaches the "both" step.)
    expect(within(sizing).queryByTestId('compare-input-strength-steps')).toBeNull()
    const folded = within(rowEls()[2]).getByTestId('compare-input-strength-steps').querySelectorAll('i[data-at]')
    expect([...folded].map((s) => [s.getAttribute('data-band'), s.getAttribute('data-at')])).toEqual([['slight', 'before'], ['moderate', 'after']])
  })

  it('each recorded sizing and strength change has its own accessible row', () => {
    render(<CompareRunPairBody responseHash={seed(delta([ROWS.sizing, ROWS.sizingStrength]))} />)
    expect(rowEls()[0].querySelector('.sr-only')?.textContent).toBe("You accepted Olumi's estimate for how much Churn changes Revenue.")
    expect(rowEls()).toHaveLength(2)
    expect(rowEls()[1].querySelector('.sr-only')).toHaveTextContent('slight → moderate')
    expect(rowEls()[1].querySelector('[data-testid="compare-input-row-values"]')).toHaveTextContent('SlightModerate')
    cleanup()
    render(<CompareRunPairBody responseHash={seed(delta([{ ...ROWS.sizing, after: { raw: 'user' } }, ROWS.sizingStrength]))} />)
    expect(rowEls()[0].querySelector('.sr-only')?.textContent).toBe('You gave your own estimate for how much Churn changes Revenue.')
  })

  it('an accepted estimate shows its origin pills and keeps Olumi as the origin (control: the user\'s own estimate has no note)', () => {
    render(<CompareRunPairBody responseHash={seed(delta([ROWS.sizing]))} />)
    const origin = within(rowEls()[0]).getByTestId('compare-input-origin')
    expect(origin).toHaveTextContent("Olumi's estimate")
    expect(origin.querySelector('[data-accepted="true"]')).toHaveTextContent("Olumi's estimate, accepted")
    expect(rowEls()[0]).toHaveTextContent(ACCEPTED_ESTIMATE_NOTE)
    cleanup()
    render(<CompareRunPairBody responseHash={seed(delta([{ ...ROWS.sizing, after: { raw: 'user' } }]))} />)
    expect(rowEls()[0]).not.toHaveTextContent(ACCEPTED_ESTIMATE_NOTE)
    expect(rowEls()[0].querySelector('[data-accepted]')).toBeNull()
  })

  it('every input row is present immediately in producer order', () => {
    render(<CompareRunPairBody responseHash={seed(delta([ROWS.setting, ROWS.factor, ROWS.strength]))} />)
    expect(rowEls()).toHaveLength(3)
    expect(rowEls().map(el => el.getAttribute('data-entity-id'))).toEqual(['fac_price', 'fac_demand', 'e_demand_rev'])
    expect(screen.queryByTestId(`${T}-inputs-toggle`)).toBeNull()
  })

  it('partial coverage stays visible beside the rows and the count says "recorded" (control: complete coverage says neither)', () => {
    render(<CompareRunPairBody responseHash={seed(delta([ROWS.setting], 'partial'))} />)
    expect(screen.getByTestId('compare-input-count')).toHaveTextContent('1 recorded change')
    expect(screen.getByTestId(`${T}-inputs-partial`)).toHaveTextContent(INPUTS_PARTIAL_TEXT)
    cleanup()
    render(<CompareRunPairBody responseHash={seed(delta([ROWS.setting]))} />)
    expect(screen.getByTestId('compare-input-count')).toHaveTextContent('1 change')
    expect(screen.queryByTestId(`${T}-inputs-partial`)).toBeNull()
    expect(inputChangeCount(3, false)).toBe('3 changes')
  })

  it('no rows: the coverage sentence, no count (complete → same values; no input record → says so)', () => {
    render(<CompareRunPairBody responseHash={seed(delta([]))} />)
    expect(screen.getByTestId(`${T}-inputs-unchanged`)).toHaveTextContent('Both runs used the same input values.')
    expect(screen.queryByTestId('compare-input-count')).toBeNull()
    cleanup()
    render(<CompareRunPairBody responseHash={seed(runChangeDelta({ input_coverage: undefined, input_changes: undefined }))} />)
    expect(inputsSection()).toHaveTextContent('Input changes were not recorded for this pair.')
  })
})

describe('Compare draws the figures (v3 figure block)', () => {
  const S = COMPARE_SUPPORT_TESTID
  const unqualified = () => runChangeDelta({ win_probabilities: [
    { option_id: 'opt_60', prior: 0.41, current: 0.44, noise_verdict: 'not_noise_qualified' },
    { option_id: 'opt_49', prior: 0.59, current: 0.56, noise_verdict: 'not_noise_qualified' },
  ] })

  it('"How to read this" opens the share-not-chance note in place (closed by default)', () => {
    render(<CompareRunPairBody responseHash={seed(runChangeDelta())} />)
    const toggle = screen.getByRole('button', { name: 'How to read this comparison' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId(`${S}-help`)).toBeNull()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId(`${S}-help`)).toHaveTextContent(COMPARE_SUPPORT_HELP)
    expect(COMPARE_SUPPORT_HELP).toMatch(/supported/)
    expect(COMPARE_SUPPORT_HELP).not.toMatch(/recommend|best|winner|lead/i)
  })

  it('the legend emphasises one run and dims the other marker, never hides it; pressing again clears', () => {
    render(<CompareRunPairBody responseHash={seed(runChangeDelta())} />)
    const latest = screen.getByTestId(`${S}-legend-latest`)
    // A key, not a link (v3 artefact): no underline at rest; the underline is the hover affordance only.
    expect(latest.className.split(/\s+/)).toEqual(expect.arrayContaining(['no-underline', 'hover:underline']))
    fireEvent.click(latest)
    expect(latest).toHaveAttribute('aria-pressed', 'true')
    const fig = screen.getAllByTestId(`${S}-figure`)[0]
    expect(fig).toHaveAttribute('data-emphasis', 'latest')
    expect(fig.querySelector('[data-marker="previous"]')!.className).toContain('opacity-40')
    expect(fig.querySelector('[data-marker="latest"]')!.className).not.toContain('opacity-40')
    fireEvent.click(latest)
    expect(latest).toHaveAttribute('aria-pressed', 'false')
    expect(fig.querySelector('[data-marker="previous"]')!.className).not.toContain('opacity-40')
  })

  it('the axis and legend appear only where a figure is drawn; an unqualified row has a direction arrow and no track (controls both ways)', () => {
    render(<CompareRunPairBody responseHash={seed(runChangeDelta())} />)
    expect(screen.getByTestId(`${S}-axis`)).toHaveTextContent(COMPARE_SUPPORT_AXIS.join(''))
    expect(screen.queryAllByTestId(`${S}-direction`)).toHaveLength(0)
    cleanup()
    render(<CompareRunPairBody responseHash={seed(unqualified())} />)
    expect(screen.queryByTestId(`${S}-axis`)).toBeNull()
    expect(screen.queryByTestId(`${S}-legend-latest`)).toBeNull()
    expect(screen.queryAllByTestId(`${S}-figure`)).toHaveLength(0)
    const arrows = screen.getAllByTestId(`${S}-direction`)
    expect(arrows).toHaveLength(2)
    expect(arrows.map((a) => a.closest('[data-direction]')?.getAttribute('data-direction')).sort()).toEqual(['down', 'up'])
  })
})

describe('the v3 state notices', () => {
  it('nothing to compare: the centred empty state with the tab\'s two-way glyph (same words)', () => {
    seed(delta([ROWS.setting]))
    useCanvasStore.setState({ currentScenarioId: 'scn-2' } as never)
    render(<CompareRunPairBody responseHash="hash-of-another-scenario" />)
    const empty = screen.getByTestId(`${COMPARE_RUN_PAIR_TESTID}-empty`)
    expect(empty).toHaveAttribute('data-variant', 'empty')
    expect(empty.querySelector('svg[class*="lucide-arrow-left-right"]')).not.toBeNull()
    expect(empty).toHaveTextContent('No comparison yet')
  })

  it('a Run in flight: the info-rule notice with its heading, above the pair it keeps (control: not while complete)', () => {
    render(<CompareRunPairBody responseHash={seed(delta([ROWS.setting]), { status: 'streaming' })} />)
    const notice = screen.getByRole('status')
    expect(notice.className).toContain('border-info')
    expect(notice).toHaveTextContent(`${COMPARE_RUN_IN_PROGRESS_HEADING}${COMPARE_RUN_IN_PROGRESS_TEXT}`)
    expect(rowEls()).toHaveLength(1)
    cleanup()
    render(<CompareRunPairBody responseHash={seed(delta([ROWS.setting]))} />)
    expect(screen.queryByTestId('compare-run-in-progress')).toBeNull()
  })
})

describe('control surface: Reasoning\'s receipt keeps the sentence list', () => {
  it('no row layout, no count, the row is its sentence', () => {
    render(<WhatsChanged view={buildRunDeltaView(delta([ROWS.setting]), labelFor, labelFor)} />)
    expect(screen.queryByTestId('compare-input-count')).toBeNull()
    expect(document.querySelector('[data-layout="rows"]')).toBeNull()
    expect(screen.getByTestId(`${T}-input-row`)).toHaveTextContent('Pro price, Raise to £60: £59 → £60')
  })
})
