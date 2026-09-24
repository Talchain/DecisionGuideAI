/**
 * Outcome + Risk cards — BOUNDED ANATOMY (height fit).
 *
 * Experience Design, #63 5809278282 (24 Sep 2026): "Landing / quiet: repeated
 * cards may reduce to **title + one primary line** inside the fixed fit-safe
 * box … Outcome/Risk = state … The fuller S3 reasoning detail … can move to the
 * existing hover/focus popover and inspector rather than expanding layout
 * geometry … Truth does not become progressive-disclosure debt … This is a fit
 * implementation of the locked anatomy, not a new design gate."
 *
 * WHY (measured by the lead): at 1280×800 with the dock open the landing zoom is
 * the 0.5 floor, `--canvas-label-scale` = 2, ~19 characters a line in a 260-unit
 * card, and the layout reserves each card's height AT that bound — so every
 * body line costs 28 flow units of whole-graph height. The allowance is
 * padding + a title of ≤2 lines + EXACTLY ONE line.
 *
 * What is pinned here, each by IDENTITY (testid, exact text, exact class):
 *  1. ONE body line in Standard view, at every rung, in both phases, for every
 *     state the data admits — the primary line is the body's only element child
 *     (the absolutely-positioned reduced line at the `line` rung excepted).
 *  2. The line is ONE visual line (`whitespace-nowrap overflow-hidden`); a text
 *     state shows a short form that fits the landing measure, with the full
 *     sentence on `title` AND in `sr-only` text; a recorded value leads its row
 *     and is never the thing cut (`shrink-0`, never `truncate`).
 *  3. MOVE, DON'T DELETE — what left the body (the full state sentence, the
 *     `Entered estimate` qualifier, the authored context) is in the REAL popover
 *     (opened by hover, not a mock), in BOTH phases.
 *  4. Detailed keeps its inline detail (contrast).
 *  5. Height safety — the body at Normal (`full`) is the same DOM as at landing
 *     (`quiet`), so a Normal card can never be the taller one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OutcomeNode, OUTCOME_UNQUANTIFIED_LINE } from '../OutcomeNode'
import { RiskNode, RISK_EXPOSURE_UNSET_LINE } from '../RiskNode'
import { METRIC_UNSET } from '../shared/metricVocabulary'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

type Phase = 'idle' | 'complete'
type Rung = 'quiet' | 'full' | 'line'

const NODES = [
  { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Renewal price' } },
  { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Customer retention' } },
  { id: 'risk-1', type: 'risk', data: { type: 'risk', label: 'Customer loss after a price rise' } },
  { id: 'goal-1', type: 'goal', data: { type: 'goal', label: 'Grow' } },
]
// One inbound factor on each card, so BOTH phases carry layer-2 content that
// could compete for the body (pre: "Driven by"; post: "Depends on").
const EDGES = [
  { id: 'fo', source: 'factor-1', target: 'outcome-1', data: { weight: 0.6, direction: 'positive', weightSource: 'user' } },
  { id: 'fr', source: 'factor-1', target: 'risk-1', data: { weight: 0.6, direction: 'positive', weightSource: 'user' } },
]

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  edges: EDGES,
  nodes: NODES,
  viewMode: 'standard',
  editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  hoveredOptionId: null,
  ceeAnalysisReady: null,
  lodRung: 'full',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
    achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

import { useCanvasStore } from '../../store'
import { NODE_REGISTRY } from '../../domain/nodes'

const applyStore = (overrides: Record<string, unknown> = {}) =>
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState(overrides) as never))

const baseProps = {
  position: { x: 0, y: 0 }, selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
}

const CONTEXT = 'Two enterprise accounts are up for renewal this quarter'

/** The real risk payload from `golden-path-staging-2026-04-05.json`. */
const TWELVE_MONTHS_FROM_BRIEF = {
  value: 0.5, unit: 'months', source: 'brief_extraction',
  raw_value: 12, cap: 24, extractionType: 'explicit', factor_type: 'time',
}

type Kind = 'outcome' | 'risk'
interface Fixture { kind: Kind; state: string; data: Record<string, unknown>; lineTestId: string }

const FIXTURES: Fixture[] = [
  { kind: 'outcome', state: 'unquantified', data: { description: CONTEXT }, lineTestId: 'outcome-unquantified' },
  { kind: 'outcome', state: 'recorded', data: { description: CONTEXT, observedState: TWELVE_MONTHS_FROM_BRIEF }, lineTestId: 'outcome-recorded-value' },
  { kind: 'risk', state: 'unset', data: { description: CONTEXT }, lineTestId: 'risk-exposure-unset' },
  { kind: 'risk', state: 'entered', data: { description: CONTEXT, probability: 0.9, impact: 'high' }, lineTestId: 'risk-exposure-line' },
  { kind: 'risk', state: 'recorded, exposure unset', data: { description: CONTEXT, observedState: TWELVE_MONTHS_FROM_BRIEF }, lineTestId: 'risk-recorded-value' },
  { kind: 'risk', state: 'recorded, exposure entered', data: { description: CONTEXT, observedState: TWELVE_MONTHS_FROM_BRIEF, probability: 0.9, impact: 'high' }, lineTestId: 'risk-recorded-value' },
]

const draw = (kind: Kind, data: Record<string, unknown>) => {
  const id = `${kind}-1`
  const label = kind === 'outcome' ? 'Customer retention' : 'Customer loss after a price rise'
  const Card = kind === 'outcome' ? OutcomeNode : RiskNode
  return render(
    <ReactFlowProvider>
      <Card {...(baseProps as any)} id={id} type={kind} data={{ label, type: kind, ...data }} />
    </ReactFlowProvider>,
  )
}

/**
 * The card itself (BaseNode's `role="group"`), excluding the popover beside it.
 *
 * ⛔ UPDATED 24 Sep 2026 (GAP-36, DESIGN-GAP-AUDIT-20260924.md row 36;
 * contract §01): the accessible name changed from "<code id> node: …" to
 * "<Kind>: … Open details.", where Kind is the user-facing word
 * (`NODE_REGISTRY[kind].label` — "Outcome"/"Risk" for this file's two kinds),
 * not the lower-case code id this helper used to spell directly.
 */
const cardFace = (kind: Kind) => screen.getByRole('group', { name: new RegExp(`^${NODE_REGISTRY[kind].label}:`, 'i') })

/** Element children of the body that take height — the reduced line is absolute. */
const flowChildren = (body: Element) =>
  Array.from(body.children).filter(c => c.getAttribute('data-testid') !== 'node-lod-line')

/** What a sighted reader sees on an element: its text minus `sr-only` carriers. */
const visibleText = (el: Element) => {
  const clone = el.cloneNode(true) as Element
  clone.querySelectorAll('.sr-only').forEach(n => n.remove())
  return clone.textContent ?? ''
}

/** The lead's measure at the landing scale (--canvas-label-scale 2, 260-unit card). */
const LANDING_CHARS_PER_LINE = 19

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  applyStore()
})

describe('ED 5809278282 — ONE body line in Standard view, at every rung, in both phases', () => {
  const PHASES: Phase[] = ['idle', 'complete']
  const RUNGS: Rung[] = ['quiet', 'full', 'line']
  const cases = FIXTURES.flatMap(f => PHASES.flatMap(p => RUNGS.map(r => [f.kind, f.state, p, r, f] as const)))

  it.each(cases)('%s (%s) · %s · %s: the primary line is the body’s only line', (kind, _state, phase, rung, f) => {
    applyStore({ results: { status: phase, report: null }, lodRung: rung })
    draw(kind, f.data)
    const line = screen.getByTestId(f.lineTestId)
    // Identity: THIS element is the card's primary line, and it is on the face.
    expect(line.getAttribute('data-card-primary-line')).toBe(kind)
    expect(cardFace(kind).contains(line)).toBe(true)
    // …and nothing else in the body takes a row.
    const body = line.parentElement!
    expect(flowChildren(body).map(c => c.getAttribute('data-testid'))).toEqual([f.lineTestId])
    // The authored context left the face (it is in the popover — see below).
    expect(cardFace(kind).textContent).not.toContain(CONTEXT)
  })
})

describe('the primary line is ONE visual line; a value leads and is never the thing cut', () => {
  const TEXT_STATES = [
    ['outcome', 'unquantified', {}, 'outcome-unquantified', 'Not quantified', OUTCOME_UNQUANTIFIED_LINE],
    ['risk', 'unset', {}, 'risk-exposure-unset', METRIC_UNSET.standalone, RISK_EXPOSURE_UNSET_LINE],
    ['risk', 'entered (both halves)', { probability: 0.9, impact: 'high' }, 'risk-exposure-line', '90% likely · High impact', 'Entered estimate · 90% likely · High impact'],
    ['risk', 'entered (likelihood only)', { probability: 0.4 }, 'risk-exposure-line', '40% likely', 'Entered estimate · 40% likely'],
    ['risk', 'entered (impact only)', { impact: 'high' }, 'risk-exposure-line', 'High impact', 'Entered estimate · High impact'],
  ] as const

  it.each(TEXT_STATES)('%s %s: short form visible, full sentence on title AND in sr-only', (kind, _s, data, testId, short, full) => {
    draw(kind, data)
    const line = screen.getByTestId(testId)
    if (testId === 'risk-exposure-line') {
      // ⚠ The entered pair keeps its provenance ON the card (ED 5809278282:
      // never tooltip-only) — `· entered` after the figures — and may wrap
      // rather than cut a figure or its qualifier.
      expect(Array.from(line.classList)).toContain('break-words')
      expect(Array.from(line.classList)).not.toContain('text-ellipsis')
      expect(screen.getByTestId('risk-exposure-provenance').textContent).toBe(' · entered')
    } else {
      expect(Array.from(line.classList)).toEqual(expect.arrayContaining(['whitespace-nowrap', 'overflow-hidden', 'text-ellipsis']))
    }
    const visible = line.querySelector('[aria-hidden="true"]')
    const announced = line.querySelector('.sr-only')
    expect(visible?.textContent).toBe(short)
    expect(announced?.textContent).toBe(full)
    expect(line.getAttribute('title')).toBe(full)
    // The short form IS the tail of the sentence it stands in for — the state
    // (or the figures) — so the words that moved off are the leading label.
    expect(full.toLowerCase().endsWith(short.toLowerCase())).toBe(true)
  })

  it('the two absence forms fit the landing measure — the STATE is never what an ellipsis eats', () => {
    for (const short of ['Not quantified', METRIC_UNSET.standalone]) {
      expect(short.length).toBeLessThanOrEqual(LANDING_CHARS_PER_LINE)
    }
    // CONTRAST: the sentences they stand in for do not, which is why they moved.
    expect(RISK_EXPOSURE_UNSET_LINE.length).toBeGreaterThan(LANDING_CHARS_PER_LINE)
    expect(OUTCOME_UNQUANTIFIED_LINE.length).toBeGreaterThan(LANDING_CHARS_PER_LINE)
  })

  it.each([
    ['outcome', 'outcome-recorded-value', 'outcome-recorded-readout', 'outcome-value-source-outcome-1'],
    ['risk', 'risk-recorded-value', 'risk-recorded-readout', 'risk-value-source-risk-1'],
  ] as const)('%s recorded value: one row, value + mark first, the value never truncates', (kind, rowId, readoutId, markId) => {
    draw(kind, { observedState: TWELVE_MONTHS_FROM_BRIEF })
    const row = screen.getByTestId(rowId)
    expect(Array.from(row.classList)).toEqual(expect.arrayContaining(['whitespace-nowrap', 'overflow-hidden']))
    expect(Array.from(row.classList)).not.toContain('flex-wrap')
    const readout = screen.getByTestId(readoutId)
    expect(readout.textContent).toBe('12 months')
    expect(Array.from(readout.classList)).toContain('shrink-0')
    expect(Array.from(readout.classList)).not.toEqual(expect.arrayContaining(['truncate']))
    expect(Array.from(readout.classList)).not.toContain('text-ellipsis')
    const mark = screen.getByTestId(markId)
    expect(row.contains(mark)).toBe(true)
    expect(row.firstElementChild).toBe(readout)
  })

  it('⛔ a risk holding its own size never shows "not set" beside it — the sentence rides sr-only, title and popover', () => {
    draw('risk', { observedState: TWELVE_MONTHS_FROM_BRIEF })
    const row = screen.getByTestId('risk-recorded-value')
    expect(visibleText(row)).not.toMatch(/not set/i)
    // CONTRAST, same row: the fact is still carried, in full, for assistive tech.
    expect(screen.getByTestId('risk-primary-line-full').textContent).toBe(RISK_EXPOSURE_UNSET_LINE)
    expect(row.contains(screen.getByTestId('risk-primary-line-full'))).toBe(true)
    expect(row.getAttribute('title')).toBe(`12 months · ${RISK_EXPOSURE_UNSET_LINE}`)
  })
})

describe('MOVE, DON’T DELETE — the real popover carries what left the body, in BOTH phases', () => {
  const hoverCard = (container: HTMLElement) => fireEvent.mouseEnter(container.firstElementChild as Element)
  const inPopover = (el: Element) => el.closest('[data-node-popover]') != null

  it.each(['idle', 'complete'] as const)('outcome, unquantified, %s: the full state sentence and the authored context', async (phase) => {
    applyStore({ results: { status: phase, report: null } })
    const { container } = draw('outcome', { description: CONTEXT })
    hoverCard(container)
    const state = await screen.findByTestId('outcome-popover-state')
    expect(state.textContent).toBe(OUTCOME_UNQUANTIFIED_LINE)
    expect(inPopover(state)).toBe(true)
    const context = screen.getByTestId('outcome-popover-context')
    expect(context.textContent).toBe(CONTEXT)
    expect(inPopover(context)).toBe(true)
    expect(cardFace('outcome').contains(context)).toBe(false)
    // POSITIVE CONTROL: the popover's existing phase content still renders beside it.
    if (phase === 'idle') expect(screen.getByText(/Driven by 1 factor\./)).toBeTruthy()
    else expect(screen.getByText('Depends on:')).toBeTruthy()
  })

  it('outcome, recorded: no state sentence is restated (nothing left the face) — the context still moves', async () => {
    const { container } = draw('outcome', { description: CONTEXT, observedState: TWELVE_MONTHS_FROM_BRIEF })
    hoverCard(container)
    expect(await screen.findByTestId('outcome-popover-context')).toBeTruthy()
    expect(screen.queryByTestId('outcome-popover-state')).toBeNull()
  })

  it.each([
    ['unset', 'idle', {}, RISK_EXPOSURE_UNSET_LINE],
    ['unset', 'complete', {}, RISK_EXPOSURE_UNSET_LINE],
    ['entered', 'idle', { probability: 0.9, impact: 'high' }, 'Entered estimate · 90% likely · High impact'],
    ['entered', 'complete', { probability: 0.9, impact: 'high' }, 'Entered estimate · 90% likely · High impact'],
    ['recorded, exposure unset', 'idle', { observedState: TWELVE_MONTHS_FROM_BRIEF }, RISK_EXPOSURE_UNSET_LINE],
    ['recorded, exposure unset', 'complete', { observedState: TWELVE_MONTHS_FROM_BRIEF }, RISK_EXPOSURE_UNSET_LINE],
  ] as const)('risk, %s, %s: the full exposure sentence and the authored context', async (_s, phase, data, full) => {
    applyStore({ results: { status: phase, report: null } })
    const { container } = draw('risk', { description: CONTEXT, ...data })
    hoverCard(container)
    const state = await screen.findByTestId('risk-popover-state')
    expect(state.textContent).toBe(full)
    expect(inPopover(state)).toBe(true)
    const context = screen.getByTestId('risk-popover-context')
    expect(context.textContent).toBe(CONTEXT)
    expect(inPopover(context)).toBe(true)
    expect(cardFace('risk').contains(context)).toBe(false)
    if (phase === 'idle') expect(screen.getByText(/Driven by 1 factor\./)).toBeTruthy()
    else expect(screen.getByText('Depends on:')).toBeTruthy()
  })
})

describe('Detailed view keeps its inline detail (contrast — the fit is a Standard-view fit)', () => {
  beforeEach(() => { applyStore({ viewMode: 'expert' }) })

  it('outcome: full state sentence and the authored context stay on the card', () => {
    draw('outcome', { description: CONTEXT })
    expect(screen.getByTestId('outcome-unquantified').textContent).toBe(OUTCOME_UNQUANTIFIED_LINE)
    expect(screen.getByTestId('outcome-context-preview').textContent).toBe(CONTEXT)
  })

  it('risk: the full unset sentence, the entered line with its qualifier, and the context stay on the card', () => {
    draw('risk', { description: CONTEXT })
    expect(screen.getByTestId('risk-exposure-unset').textContent).toBe(RISK_EXPOSURE_UNSET_LINE)
    expect(screen.getByTestId('risk-context-preview').textContent).toBe(CONTEXT)
    cleanup()
    draw('risk', { probability: 0.9, impact: 'high' })
    expect(screen.getByTestId('risk-exposure-line').textContent).toBe('Entered estimate · 90% likely · High impact')
  })
})

describe('HEIGHT SAFETY — a Normal-zoom card is never taller than the same card at landing', () => {
  const cases = FIXTURES.flatMap(f => (['idle', 'complete'] as Phase[]).map(p => [f.kind, f.state, p, f] as const))

  it.each(cases)('%s (%s) · %s: the body at `full` is the same DOM as at `quiet`', (kind, _state, phase, f) => {
    applyStore({ results: { status: phase, report: null }, lodRung: 'quiet' })
    draw(kind, f.data)
    const atLanding = screen.getByTestId(f.lineTestId).parentElement!.outerHTML
    cleanup()
    applyStore({ results: { status: phase, report: null }, lodRung: 'full' })
    draw(kind, f.data)
    const atNormal = screen.getByTestId(f.lineTestId).parentElement!.outerHTML
    expect(atNormal).toBe(atLanding)
  })
})
