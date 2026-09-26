/**
 * About this analysis — the one collapsed audit utility (Reasoning V2).
 *
 * Every assertion binds by IDENTITY: a row's testid (`-row-<key>`), a copy
 * constant (`ABOUT_COPY`, `ANALYSIS_NEW_COPY`) or a view-model field read from
 * the same build the component was given. Each rule has a contrast case the
 * same run can distinguish.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

// The value control is offered only where Olumi can be reached — so a
// conversation exists, as it does on the mounted tab.
const conversation = { sendSystemEvent: () => Promise.resolve(undefined) }
vi.mock('../../../../canvas/conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => conversation,
  useConversationContext: () => conversation,
  ConversationProvider: ({ children }: { children: unknown }) => children,
}))
vi.mock('../../../../canvas/ToastContext', () => ({
  useShowToastSafe: () => vi.fn(),
  ToastProvider: ({ children }: { children: unknown }) => children,
}))

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import type { AnalysisNewViewModelInputs } from '../buildAnalysisNewViewModel'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { buildReviewQueue } from '../buildReviewQueue'
import type { Recommendation } from '../../strengthen/strengthenTypes'
import { formatModelScore, ABOUT_COPY, AboutThisAnalysis } from '../sections/AboutThisAnalysis'
import type { AboutOutcomeFormat, AboutThisAnalysisProps } from '../sections/AboutThisAnalysis'
import { SCIENCE_LIMITATIONS_DISCLOSURE } from '../../analysisMethodCopy'
import { formatThreshold } from '../../RangeVisualization'
import { NOT_ANALYSED_BADGE } from '../../utils/notAnalysedCopy'
import { useCanvasStore } from '@/canvas/store'
import { useContextIntegrityStore } from '@/canvas/stores/contextIntegrityStore'
import {
  decisionWithLeaderWithheld,
  decisionWithLeaderWithheldAndReason,
  genuineDecision,
  highUncertainty,
  makeData,
  makeOption,
  openStrategicChallenge,
} from './analysisNewFixtures'
import type { ConfidenceSectionData } from '../../types'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const TID = 'analysis-new-about'
const NO_UNIT: AboutOutcomeFormat = { unit: undefined, symbol: undefined, isNormalised: undefined }

const build = (data: ResultsSectionDataReturn, over: Partial<AnalysisNewViewModelInputs> = {}) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
    responseHash: 'run_about_1',
    ...over,
  })

const renderAbout = (
  vm: ReturnType<typeof build>,
  props: Partial<AboutThisAnalysisProps> = {},
) => render(<AboutThisAnalysis vm={vm} outcomeFormat={NO_UNIT} {...props} />)

const open = () => fireEvent.click(screen.getByTestId(`${TID}-toggle`))
const openDetail = (key: 'values' | 'limitations' | 'record') =>
  fireEvent.click(screen.getByTestId(`${TID}-detail-${key}-toggle`))
const valueOf = (key: string) => screen.getByTestId(`${TID}-row-${key}-value`).textContent
const detailOf = (key: string) =>
  screen.queryAllByTestId(`${TID}-row-${key}-detail`).map((el) => el.textContent)

beforeEach(() => {
  useContextIntegrityStore.getState().reset()
  useCanvasStore.setState({ currentScenarioId: 'scn_about', nodes: [] } as never)
})
afterEach(() => {
  useContextIntegrityStore.getState().reset()
  useCanvasStore.setState({ currentScenarioId: null, nodes: [] } as never)
  cleanup()
})

// ═════════════════════════════════════════════════════════════════════════════
describe('at rest: one collapsed row, and nothing at all pre-run', () => {
  it('pre-run renders NOTHING — contrast: the same data post-run renders the row', () => {
    const { unmount } = renderAbout(build(genuineDecision(), { isPreRun: true }))
    expect(screen.queryByTestId(TID)).toBeNull()
    unmount()
    renderAbout(build(genuineDecision()))
    expect(screen.getByTestId(TID)).toBeInTheDocument()
  })

  it('is collapsed at rest: the title and chevron only — no rows, no AI act', () => {
    renderAbout(build(genuineDecision()), { onAsk: vi.fn() })
    const toggle = screen.getByTestId(`${TID}-toggle`)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveTextContent(ABOUT_COPY.title)
    expect(screen.queryByTestId(`${TID}-region`)).toBeNull()
    expect(screen.queryByTestId(`${TID}-ask`)).toBeNull()
  })

  it('opens onto the status rows, and the one AI act appears in the open header', () => {
    renderAbout(build(genuineDecision()), { onAsk: vi.fn() })
    open()
    expect(screen.getByTestId(`${TID}-toggle`)).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId(`${TID}-rows`)).toBeInTheDocument()
    const ask = screen.getByTestId(`${TID}-ask`)
    expect(ask).toHaveAttribute('aria-label', ABOUT_COPY.ask)
    expect(ask).toHaveAttribute('data-ai', 'true')
    expect(screen.getAllByRole('button', { name: ABOUT_COPY.ask })).toHaveLength(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('Freshness — from vm.status.isStale and staleKind, never stronger than the authority', () => {
  const cases = [
    ['not stale', { isStale: false }, ABOUT_COPY.freshness.noChangeDetected],
    ['stale, changed', { isStale: true, staleReason: 'changed' as const }, ABOUT_COPY.freshness.changed],
    ['stale, unconfirmed', { isStale: true, staleReason: 'unconfirmed' as const }, ABOUT_COPY.freshness.unconfirmed],
    // Fail-closed: a stale flag with no reason is NOT a claim of change.
    ['stale, no reason', { isStale: true }, ABOUT_COPY.freshness.unconfirmed],
  ] as const
  it.each(cases)('%s', (_name, over, expected) => {
    renderAbout(build(genuineDecision(), over))
    open()
    expect(valueOf('freshness')).toBe(expected)
  })

  it('the three values are three different strings (the cases above can discriminate)', () => {
    expect(new Set(Object.values(ABOUT_COPY.freshness)).size).toBe(3)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('Robustness — ONLY the view model\'s gated word, otherwise "Not established"', () => {
  it('a licensed robust verdict reads the view model\'s word', () => {
    const vm = build(genuineDecision())
    expect(vm.atAGlance.verdict?.label, 'precondition: the fixture carries a gated word').toBe('Stable')
    renderAbout(vm)
    open()
    expect(valueOf('robustness')).toBe(vm.atAGlance.verdict!.label)
  })

  it('⛔ the SAME producer verdict under an admission that licenses no strength word reads "Not established"', () => {
    const data = decisionWithLeaderWithheldAndReason()
    expect(data.recommendation.robustnessVerdict, 'precondition: the producer did send a verdict').toBe('robust')
    const vm = build(data)
    expect(vm.atAGlance.verdict, 'precondition: the admission gate withheld the word').toBeNull()
    renderAbout(vm)
    open()
    expect(valueOf('robustness')).toBe(ABOUT_COPY.robustnessNotEstablished)
  })

  it('a fragile verdict reads the view model\'s own word for it', () => {
    const vm = build(openStrategicChallenge())
    expect(vm.atAGlance.verdict?.label).toBe('Sensitive')
    renderAbout(vm)
    open()
    expect(valueOf('robustness')).toBe('Sensitive')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('Evidence — assessed or not, and the count of GAP findings (not every open question)', () => {
  const twoGapsAndAnAssumption = () =>
    makeData({
      confidence: {
        evidenceGapsAssessed: true,
        evidenceGaps: [
          { factorId: 'f_churn', factorLabel: 'Churn rate', confidence: 0.3, voi: null, suggestion: 'Pull churn.' },
          { factorId: 'f_price', factorLabel: 'Price', confidence: 0.4, voi: null, suggestion: 'Check price.' },
        ],
        assumptions: [{ severity: 'medium', message: 'Hiring stays flat.', target: 'f_hiring' }],
      } as Partial<ConfidenceSectionData>,
    })

  it('assessed with gaps: the count equals the producer\'s gap list, NOT every uncertainty finding', () => {
    const data = twoGapsAndAnAssumption()
    const vm = build(data)
    const gaps = data.confidence.evidenceGaps!.length
    expect(gaps).toBe(2)
    expect(vm.uncertainty.findings.length, 'precondition: a non-gap finding sits in the same list').toBeGreaterThan(gaps)
    renderAbout(vm)
    open()
    expect(valueOf('evidence')).toBe(ABOUT_COPY.evidence.evidence_gaps(gaps))
  })

  it('assessed, none flagged', () => {
    renderAbout(build(openStrategicChallenge()))
    open()
    expect(valueOf('evidence')).toBe(ABOUT_COPY.evidence.evidence_none_flagged())
  })

  it('CONTRAST: not assessed is never an all-clear', () => {
    renderAbout(build(highUncertainty()))
    open()
    expect(valueOf('evidence')).toBe(ABOUT_COPY.evidence.evidence_not_assessed())
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('Compared — options analysed, and anything omitted, from vm.optionsComparison', () => {
  const withOmitted = () =>
    makeData({
      recommendation: {
        allOptions: [
          makeOption({ id: 'opt_a', label: 'Hire a lead', winProbability: 1 }),
          makeOption({ id: 'opt_b', label: 'Outsource', notAnalysed: true, notAnalysedReason: 'no_interventions' } as never),
        ],
      },
    })

  it('counts analysed of total and names the option left out, with the badge word', () => {
    const vm = build(withOmitted())
    expect(vm.optionsComparison.rows.map((r) => r.kind)).toEqual(['analysed', 'not_analysed'])
    renderAbout(vm)
    open()
    expect(valueOf('compared')).toBe(ABOUT_COPY.compared(1, 2))
    expect(detailOf('compared')).toEqual([`${NOT_ANALYSED_BADGE}: Outsource`])
  })

  it('CONTRAST: every option analysed names nothing omitted', () => {
    renderAbout(build(genuineDecision()))
    open()
    expect(valueOf('compared')).toBe(ABOUT_COPY.compared(2, 2))
    expect(detailOf('compared')).toEqual([])
  })

  it('no options at all: the row is absent rather than "0 of 0"', () => {
    renderAbout(build(openStrategicChallenge()))
    open()
    expect(screen.queryByTestId(`${TID}-row-compared`)).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
/* ⭐ V2 PROTOTYPE `aboutHTML()` (design pass, 26 Sep 2026): FIVE rows — Freshness
   (clock), Compared (chart), Evidence (link), Review topics (search), Robustness
   (info) — each with its OWN ✦. The icon is bound by lucide's own class
   (`lucide-<name>`), which is the glyph's identity, not a look-alike. */
describe('the five status rows, in the prototype\'s order, each with its icon and its own AI act', () => {
  const REVIEW = { interventions: [] as never[], excludeId: null }
  const ORDER = ['freshness', 'compared', 'evidence', 'review', 'robustness'] as const
  const ICON = {
    freshness: 'lucide-clock',
    compared: 'lucide-bar-chart3',
    evidence: 'lucide-link',
    review: 'lucide-search',
    robustness: 'lucide-info',
  } as const

  it('renders exactly the five rows, in order, with the prototype\'s labels and icons', () => {
    renderAbout(build(genuineDecision()), { onAsk: vi.fn(), reviewTopics: REVIEW })
    open()
    const keys = Array.from(screen.getByTestId(`${TID}-rows`).querySelectorAll('[data-testid^="analysis-new-about-row-"]'))
      .map((el) => el.getAttribute('data-testid')!)
      .filter((id) => /^analysis-new-about-row-[a-z]+$/.test(id))
      .map((id) => id.replace(`${TID}-row-`, ''))
    expect(keys).toEqual([...ORDER])
    for (const key of ORDER) {
      const row = screen.getByTestId(`${TID}-row-${key}`)
      expect(within(row).getByText(ABOUT_COPY.rows[key])).toBeInTheDocument()
      expect(row.querySelector(`svg.${ICON[key]}`), `${key} carries ${ICON[key]}`).not.toBeNull()
    }
    expect(ABOUT_COPY.rows).toEqual({
      freshness: 'Freshness',
      compared: 'Compared',
      evidence: 'Evidence',
      review: 'Review topics',
      robustness: 'Robustness',
    })
  })

  it('each row carries its own AI act, named for the row; CONTRAST: no handler ⇒ none', () => {
    const { unmount } = renderAbout(build(genuineDecision()), { onAsk: vi.fn(), reviewTopics: REVIEW })
    open()
    for (const key of ORDER) {
      const ask = screen.getByTestId(`${TID}-row-${key}-ask`)
      expect(ask).toHaveAttribute('aria-label', ABOUT_COPY.rowAsk(ABOUT_COPY.rows[key]))
      expect(ask).toHaveAttribute('data-ai', 'true')
    }
    expect(ABOUT_COPY.rowAsk('Review topics')).toBe('Discuss review topics with Olumi')
    unmount()
    renderAbout(build(genuineDecision()), { reviewTopics: REVIEW })
    open()
    expect(screen.queryAllByTestId(/^analysis-new-about-row-[a-z]+-ask$/)).toHaveLength(0)
  })

  it('a row\'s act hands THAT row as context, and nothing else', () => {
    const onAsk = vi.fn()
    renderAbout(build(genuineDecision(), { isStale: true, staleReason: 'changed' }), { onAsk })
    open()
    fireEvent.click(screen.getByTestId(`${TID}-row-freshness-ask`))
    expect(onAsk).toHaveBeenCalledTimes(1)
    const payload = onAsk.mock.calls[0]![0]
    expect(payload.label).toBe(ABOUT_COPY.rowAsk(ABOUT_COPY.rows.freshness))
    expect(payload.draft).toBe(ABOUT_COPY.rowAskDraft(ABOUT_COPY.rows.freshness))
    expect(payload.context).toBe(`${ABOUT_COPY.rows.freshness}: ${ABOUT_COPY.freshness.changed}`)
    expect(Object.keys(payload).sort()).toEqual(['context', 'draft', 'label'])
  })

  /* ⛔ THE ROWS THE PROTOTYPE LACKS ARE GONE. "Most likely option" repeated the
     commitment block's withheld sentence, "Your inputs and Olumi's" repeated the
     folded input register, and "Method" printed "Seed null" when the seed came
     back null (the audit's truth defect). Simulations and seed are still on the
     surface: the Run record's own rows. */
  it('no Most likely option / Your inputs / Method row — and never "Seed null"', () => {
    const vm = build(decisionWithLeaderWithheld(), { producerLeaderWithholdReason: 'separation_unavailable' })
    // The props the retired Method row read, passed as the body once passed them:
    // a null seed must reach no row at all.
    const legacy = { vm, outcomeFormat: NO_UNIT, nSamples: undefined, seedUsed: null } as unknown as AboutThisAnalysisProps
    render(<AboutThisAnalysis {...legacy} />)
    open()
    for (const gone of ['leader', 'inputs', 'method']) {
      expect(screen.queryByTestId(`${TID}-row-${gone}`), gone).toBeNull()
    }
    const about = screen.getByTestId(TID)
    expect(about.textContent).not.toMatch(/Seed null/)
    expect(about.textContent).not.toContain('Most likely option')
    expect(about.textContent).not.toContain("Your inputs and Olumi's")
    // CONTRAST: the rows that remain do render on this same run.
    expect(screen.getByTestId(`${TID}-row-freshness`)).toBeInTheDocument()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('Review topics — the length of the review tool\'s own queue', () => {
  const rec = (id: string): Recommendation =>
    ({
      id,
      helpType: 'challenge',
      title: `Finding ${id}`,
      signal: 'A signal.',
      whyNow: 'Why now.',
      tryThis: null,
      sourceLine: 'Source: test.',
      action: { kind: 'ai-dialogue', label: 'Challenge', prompt: 'p' },
      targetId: null,
      priority: 100,
    }) as Recommendation
  const RECS = [rec('strengthen:a'), rec('strengthen:b'), rec('strengthen:c')]
  const queueLength = (excludeId: string | null) =>
    buildReviewQueue({ interventions: RECS, excludeId, nodes: [], edgeIds: [] }).length

  it('"N open" is buildReviewQueue\'s length over the same inputs', () => {
    expect(queueLength(null), 'PRECONDITION').toBe(3)
    renderAbout(build(genuineDecision()), { reviewTopics: { interventions: RECS, excludeId: null } })
    open()
    expect(valueOf('review')).toBe(ABOUT_COPY.reviewOpen(3))
    expect(ABOUT_COPY.reviewOpen(3)).toBe('3 open')
  })

  it('CONTRAST: the promoted recommendation the tool excludes is not counted either', () => {
    expect(queueLength('strengthen:b'), 'PRECONDITION').toBe(2)
    renderAbout(build(genuineDecision()), { reviewTopics: { interventions: RECS, excludeId: 'strengthen:b' } })
    open()
    expect(valueOf('review')).toBe(ABOUT_COPY.reviewOpen(2))
  })

  it('no source ⇒ no row, never a guessed "0 open"', () => {
    renderAbout(build(genuineDecision()))
    open()
    expect(screen.queryByTestId(`${TID}-row-review`)).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('the three disclosures carry the prototype\'s names', () => {
  it('"Inspect values and units" / "Sources and limits" / "Run record", in that order, chevron right → down', () => {
    expect(ABOUT_COPY.details).toEqual({
      values: 'Inspect values and units',
      limitations: 'Sources and limits',
      record: 'Run record',
    })
    renderAbout(build(genuineDecision(), { nSamples: 5000 }))
    open()
    const toggles = screen.getAllByTestId(/^analysis-new-about-detail-[a-z]+-toggle$/)
    expect(toggles.map((t) => t.textContent)).toEqual([
      ABOUT_COPY.details.values,
      ABOUT_COPY.details.limitations,
      ABOUT_COPY.details.record,
    ])
    const values = screen.getByTestId(`${TID}-detail-values-toggle`)
    expect(values.querySelector('svg.lucide-chevron-right')).not.toBeNull()
    openDetail('values')
    expect(values.querySelector('svg.lucide-chevron-down')).not.toBeNull()
    expect(values.querySelector('svg.lucide-chevron-right')).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('Inspect values and units — a TABLE (Option · P10 · P50 · P90) in the builder\'s own format', () => {
  const ranged = () => {
    const a = makeOption({
      id: 'opt_a', label: 'Hold price', winProbability: 0.31,
      outcome: { mean: 1500, p10: 1200, p50: 1450, p90: 1900 },
    })
    const b = makeOption({
      id: 'opt_b', label: 'Raise price', winProbability: 0.69,
      outcome: { mean: 2100, p10: 900, p50: null, p90: 3300 },
    })
    const data = genuineDecision()
    return { ...data, recommendation: { ...data.recommendation, allOptions: [a, b] } } as ResultsSectionDataReturn
  }
  const GBP: AboutOutcomeFormat = { unit: 'currency', symbol: '£', isNormalised: false }
  const cell = (id: string, k: string) => screen.getByTestId(`${TID}-values-${id}-${k}`).textContent

  it('one table: the header row is Option · P10 · P50 · P90; each option one row, formatted by formatThreshold', () => {
    const vm = build(ranged())
    renderAbout(vm, { outcomeFormat: GBP })
    open()
    openDetail('values')
    const table = within(screen.getByTestId(`${TID}-detail-values-body`)).getByRole('table')
    const head = within(table).getAllByRole('columnheader').map((th) => th.textContent)
    expect(head).toEqual([ABOUT_COPY.values.option, ABOUT_COPY.values.low, ABOUT_COPY.values.mid, ABOUT_COPY.values.high])
    expect(head).toEqual(['Option', 'P10', 'P50', 'P90'])
    expect(cell('opt_a', 'low')).toBe(formatThreshold(1200, 'currency', '£', false))
    expect(cell('opt_a', 'mid')).toBe(formatThreshold(1450, 'currency', '£', false))
    expect(cell('opt_a', 'high')).toBe(formatThreshold(1900, 'currency', '£', false))
    // An absent p50 is said, never drawn as zero.
    expect(cell('opt_b', 'mid')).toBe(ABOUT_COPY.values.notReturned)
    expect(within(screen.getByTestId(`${TID}-values-opt_a`)).getByText('Hold price')).toBeInTheDocument()
    // ⚠ P50, NOT "Mean": the view model carries the median, and a median
    // labelled a mean would be a false statement about the number.
    expect(head).not.toContain('Mean')
  })

  it('order is the view model\'s, never re-sorted', () => {
    const vm = build(ranged())
    renderAbout(vm, { outcomeFormat: GBP })
    open()
    openDetail('values')
    const ids = screen
      .getAllByTestId(/^analysis-new-about-values-opt_[a-z]+$/)
      .map((el) => el.getAttribute('data-testid')!.replace(`${TID}-values-`, ''))
    expect(ids).toEqual(vm.optionsComparison.rows.map((r) => r.id))
  })

  /* ⛔ THE PROTOTYPE'S TABLE HAS NO SHARE COLUMN, and the per-option "Share of
     simulations where this option came out highest · Not returned" line was the
     audit's ✗. The share and its "Goal only" scope line go together: the scope
     line existed only to qualify a share on screen. */
  it('no share line and no Goal-only line — PRECONDITION: the run DID return shares', () => {
    const base = build(ranged())
    const a = base.optionsComparison.rows.find((r) => r.id === 'opt_a')
    if (a?.kind !== 'analysed') throw new Error('precondition: opt_a analysed')
    expect(a.winReadout, 'PRECONDITION: a share exists to be (not) shown').not.toBeNull()
    renderAbout({ ...base, checks: { ...base.checks, sharesExcludeLimits: true } }, { outcomeFormat: GBP })
    open()
    openDetail('values')
    const body = screen.getByTestId(`${TID}-detail-values-body`)
    expect(body.textContent).not.toContain('Share of simulations')
    expect(body.textContent).not.toContain(a.winReadout!)
    expect(screen.queryByTestId(`${TID}-values-goal-only`)).toBeNull()
  })

  it('a normalised run captions the table with the relative-scores sentence; CONTRAST: a unit run has no caption', () => {
    const vm = build(ranged())
    const { unmount } = renderAbout(vm, { outcomeFormat: { unit: undefined, symbol: undefined, isNormalised: true } })
    open()
    openDetail('values')
    const caption = screen.getByTestId(`${TID}-values-normalised`)
    expect(caption.tagName).toBe('CAPTION')
    expect(caption).toHaveTextContent(ABOUT_COPY.values.normalised)
    // ⚠ RE-POINTED (AI Quality, #70 5841808930): a normalised outcome is a
    // model score — the axis's three significant figures, NO `%` and NO `+`.
    // `formatThreshold(…, true)` printed "+120000%": a unit and a direction the
    // score does not have.
    expect(cell('opt_a', 'low')).toBe(formatModelScore(1200))
    for (const k of ['low', 'mid', 'high']) {
      expect(cell('opt_a', k) ?? '', `${k}: no unit, no sign on a model score`).not.toMatch(/%|^\+/)
    }
    unmount()
    renderAbout(vm, { outcomeFormat: GBP })
    open()
    openDetail('values')
    expect(screen.queryByTestId(`${TID}-values-normalised`)).toBeNull()
    expect(screen.getByTestId(`${TID}-detail-values-body`).querySelector('caption')).toBeNull()
  })

  it('"How should these ranges be interpreted?" with its own AI act, handing the rendered ranges; CONTRAST: no handler ⇒ no question', () => {
    const onAsk = vi.fn()
    const vm = build(ranged())
    const { unmount } = renderAbout(vm, { outcomeFormat: GBP, onAsk })
    open()
    openDetail('values')
    const q = screen.getByTestId(`${TID}-values-question`)
    expect(q).toHaveTextContent(ABOUT_COPY.values.question)
    const ask = within(q).getByTestId(`${TID}-values-ask`)
    expect(ask).toHaveAttribute('aria-label', ABOUT_COPY.values.questionAsk)
    expect(ask).toHaveAttribute('data-ai', 'true')
    fireEvent.click(ask)
    const payload = onAsk.mock.calls[0]![0]
    expect(payload.label).toBe(ABOUT_COPY.values.questionAsk)
    expect(payload.draft).toBe(ABOUT_COPY.values.question)
    expect(payload.context).toContain(`Hold price: ${formatThreshold(1200, 'currency', '£', false)}`)
    expect(payload.context).toContain(ABOUT_COPY.values.notReturned)
    unmount()
    renderAbout(vm, { outcomeFormat: GBP })
    open()
    openDetail('values')
    expect(screen.queryByTestId(`${TID}-values-question`)).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('Sources and limits — short bullets: engine caveats, gaps worked around, unassessed meanings, the science disclosure', () => {
  const TARGET = 'fac_carrier_cutoff'
  /** One WARNING (the strip's resting entry) and one INFO (a gap worked around). */
  const WARNINGS = [
    {
      code: 'CONSTRAINT_TARGET_UNRELIABLE',
      affected_nodes: [],
      message: "The target for 'out_margin' could not be reliably assessed.",
      severity: 'warning',
    },
    {
      code: 'ROOT_NODE_DEFAULT_VALUE',
      field: `nodes[${TARGET}].observed_state.value`,
      severity: 'info',
      affected_nodes: [],
      message: `No observed value provided for root node '${TARGET}'; defaulted to 0.0.`,
    },
  ]
  const withWarnings = () =>
    makeData({ confidence: { evidenceGapsAssessed: true, inferenceWarnings: WARNINGS } as Partial<ConfidenceSectionData> })

  it('an unassessed check contributes the copy deck\'s own meaning for its code', () => {
    const vm = build(highUncertainty())
    const evidence = vm.checks.items.find((i) => i.id === 'evidence')
    expect(evidence?.code).toBe('evidence_not_assessed')
    renderAbout(vm)
    open()
    openDetail('limitations')
    expect(screen.getByTestId(`${TID}-limitation-evidence`)).toHaveTextContent(
      COPY.checks.evidence_not_assessed.meaning,
    )
    expect(screen.getByTestId(`${TID}-science-limitations`)).toHaveTextContent(SCIENCE_LIMITATIONS_DISCLOSURE)
  })

  it('CONTRAST: a run whose checks all passed lists no meaning — only the science disclosure', () => {
    const vm = build(genuineDecision())
    expect(vm.checks.items.every((i) => i.state !== 'not_assessed'), 'precondition').toBe(true)
    renderAbout(vm)
    open()
    openDetail('limitations')
    expect(screen.queryAllByTestId(/^analysis-new-about-limitation-/)).toHaveLength(0)
    expect(screen.getByTestId(`${TID}-science-limitations`)).toBeInTheDocument()
  })

  it('every engine caveat is ONE bullet in one list — no amber strip, no alert icon, nothing held back', () => {
    const vm = build(withWarnings())
    expect(vm.deeper.caveats.length, 'PRECONDITION: a warning-severity caveat').toBe(1)
    renderAbout(vm)
    open()
    openDetail('limitations')
    const body = screen.getByTestId(`${TID}-detail-limitations-body`)
    expect(within(body).queryByTestId('inference-warning-strip')).toBeNull()
    expect(within(body).queryByTestId('critique-warning-strip')).toBeNull()
    expect(body.querySelector('svg.lucide-alert-triangle')).toBeNull()
    const list = within(body).getByTestId(`${TID}-limits`)
    expect(list.tagName).toBe('UL')
    const coded = Array.from(list.querySelectorAll(':scope > li[data-gap-code]')).map((li) => li.getAttribute('data-gap-code'))
    // Both entries, each once, in producer order — the warning AND the one worked around.
    expect(coded).toEqual(['CONSTRAINT_TARGET_UNRELIABLE', 'ROOT_NODE_DEFAULT_VALUE'])
  })

  it('⛔ the producer\'s CODE is never text — not visible, not screen-reader-only — only a data attribute', () => {
    renderAbout(build(withWarnings()))
    open()
    openDetail('limitations')
    openDetail('record')
    const about = screen.getByTestId(TID)
    expect(about.querySelector('[data-gap-code="ROOT_NODE_DEFAULT_VALUE"]'), 'the row keeps its handle').not.toBeNull()
    expect(about.textContent).not.toContain('ROOT_NODE_DEFAULT_VALUE')
    expect(about.textContent).not.toContain('CONSTRAINT_TARGET_UNRELIABLE')
    // CONTRAST: the humanised sentence for that same row IS on screen.
    const li = about.querySelector('[data-gap-code="ROOT_NODE_DEFAULT_VALUE"]')!
    expect(li.textContent!.trim().length).toBeGreaterThan(10)
  })

  it('the value control on a gap worked around is OPT-IN — contrast pair on the same run', () => {
    useCanvasStore.setState({
      nodes: [{ id: TARGET, type: 'factor', data: { label: 'Carrier cut-off', observedState: { cap: 20, unit: 'months' } } }],
    } as never)
    const vm = build(withWarnings())
    const { unmount } = renderAbout(vm)
    open()
    openDetail('limitations')
    expect(screen.queryAllByTestId(`${TID}-value-edit`)).toHaveLength(0)
    unmount()
    renderAbout(vm, { offerFactorValueControl: true })
    open()
    openDetail('limitations')
    const controls = screen.queryAllByTestId(`${TID}-value-edit`)
    expect(controls.length).toBeGreaterThan(0)
    expect(controls[0]).toHaveAttribute('data-node-id', TARGET)
    expect(within(screen.getByTestId(`${TID}-detail-limitations-body`)).getAllByTestId(`${TID}-value-edit`)).toHaveLength(controls.length)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('Run record — label/value rows, the builder\'s own, in its order', () => {
  // ⚠ RE-POINTED (#2069 review): the groups keep their TITLES. Flattened, the
  // coaching layer's "Robustness 40%" sat unlabelled under About's gated
  // Robustness verdict. Every non-statement row, in order, under its group.
  it('every non-statement row the view model built, in order, UNDER ITS GROUP\'S TITLE', () => {
    const vm = build(genuineDecision(), { nSamples: 5000, seedUsed: 7 })
    renderAbout(vm)
    open()
    openDetail('record')
    const expected = vm.deeper.groups
      .map((g) => ({ title: g.title, rows: g.rows.filter((r) => !r.statement).map((r) => [r.label, r.value]) }))
      .filter((g) => g.rows.length > 0)
    expect(expected.flatMap((g) => g.rows).length, 'PRECONDITION').toBeGreaterThan(2)
    const groups = screen.getAllByTestId(`${TID}-record-group`).map((el) => ({
      title: within(el).getByTestId(`${TID}-record-group-title`).textContent,
      rows: within(el).getAllByTestId(`${TID}-record-row`).map((row) => [
        row.querySelector('dt')!.textContent,
        row.querySelector('dd')!.textContent,
      ]),
    }))
    expect(groups).toEqual(expected)
    expect(screen.getByTestId(`${TID}-detail-record-body`)).toHaveTextContent('run_about_1')
  })

  it('⛔ (#2069 review) the coaching layer\'s "Robustness" percentage sits under "Readiness signals", never bare', () => {
    const dims = { evidence: 0.72, robustness: 0.4, clarity: 0.5 }
    const data = { ...genuineDecision(), recommendation: { ...genuineDecision().recommendation, coachingReadinessDimensions: dims } }
    const vm = build(data as never)
    const readiness = vm.deeper.groups.find((g) => g.rows.some((r) => r.label === 'Robustness' && /%/.test(String(r.value))))
    expect(readiness, 'PRECONDITION: the builder emits the coaching Robustness row').toBeDefined()
    renderAbout(vm)
    open()
    openDetail('record')
    const row = screen.getAllByTestId(`${TID}-record-row`).find((r) => r.querySelector('dt')!.textContent === 'Robustness')!
    const group = row.closest(`[data-testid="${TID}-record-group"]`) as HTMLElement
    expect(within(group).getByTestId(`${TID}-record-group-title`).textContent).toBe(readiness!.title)
  })

  it('Simulations and Seed are Run record rows; a null seed is NO row, never "null"', () => {
    const vm = build(genuineDecision(), { nSamples: 5000 })
    renderAbout(vm)
    open()
    openDetail('record')
    const labels = screen.getAllByTestId(`${TID}-record-row`).map((r) => r.querySelector('dt')!.textContent)
    expect(labels).toContain('Simulations')
    expect(labels).not.toContain('Seed')
    expect(screen.getByTestId(`${TID}-detail-record-body`).textContent).not.toMatch(/null/)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe("Limitations never repeat the leader sentence the commitment block states (V2 census B2)", () => {
  it('a withheld-leader run lists no leader limitation', () => {
    const vm = build(decisionWithLeaderWithheld())
    expect(vm.checks.leaderWithheld, 'PRECONDITION').toBe(true)
    renderAbout(vm)
    open()
    openDetail('limitations')
    expect(screen.queryByTestId(`${TID}-limitation-leader`)).toBeNull()
    expect(screen.queryByText(COPY.checks.leader_not_assessed.meaning)).toBeNull()
  })
})

describe('detail rows open independently', () => {
  it('opening a second detail row keeps the first one open (all three can be open at once)', () => {
    renderAbout(build(genuineDecision()))
    open()
    openDetail('values')
    openDetail('limitations')
    openDetail('record')
    for (const key of ['values', 'limitations', 'record'] as const) {
      expect(screen.getByTestId(`${TID}-detail-${key}-toggle`)).toHaveAttribute('aria-expanded', 'true')
    }
    // CONTRAST: toggling one closes only that one.
    openDetail('limitations')
    expect(screen.getByTestId(`${TID}-detail-limitations-toggle`)).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId(`${TID}-detail-values-toggle`)).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('the section AI act — hands the rows as context, invents nothing', () => {
  it('calls onAsk once with the label, the draft and the rendered row values', () => {
    const onAsk = vi.fn()
    const vm = build(decisionWithLeaderWithheld(), { producerLeaderWithholdReason: 'separation_unavailable' })
    renderAbout(vm, { onAsk })
    open()
    fireEvent.click(screen.getByTestId(`${TID}-ask`))
    expect(onAsk).toHaveBeenCalledTimes(1)
    const payload = onAsk.mock.calls[0]![0]
    expect(payload.label).toBe(ABOUT_COPY.ask)
    expect(payload.label).toBe('Ask Olumi about this analysis and its limitations')
    expect(payload.draft).toBe(ABOUT_COPY.askDraft)
    expect(payload.context).toContain(`${ABOUT_COPY.rows.freshness}: ${ABOUT_COPY.freshness.noChangeDetected}`)
    expect(payload.context).toContain(`${ABOUT_COPY.rows.robustness}: `)
    expect(Object.keys(payload).sort()).toEqual(['context', 'draft', 'label'])
  })

  it('CONTRAST: no handler ⇒ no AI control, even open', () => {
    renderAbout(build(genuineDecision()))
    open()
    expect(screen.queryByTestId(`${TID}-ask`)).toBeNull()
  })
})
