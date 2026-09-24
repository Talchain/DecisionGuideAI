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
import { ANALYSIS_NEW_COPY as COPY, leaderWithholdCause } from '../analysisNewCopy'
import { ABOUT_COPY, AboutThisAnalysis } from '../sections/AboutThisAnalysis'
import type { AboutOutcomeFormat, AboutThisAnalysisProps } from '../sections/AboutThisAnalysis'
import { SCIENCE_LIMITATIONS_DISCLOSURE } from '../../analysisMethodCopy'
import { formatThreshold } from '../../RangeVisualization'
import { NOT_ANALYSED_BADGE } from '../../utils/notAnalysedCopy'
import { figureTallySubtitle } from '../../contextIntegrity/figureTallySubtitle'
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
describe('Most likely option — the leader check code, and the producer\'s cause from the view model', () => {
  it('permitted: identified, with no cause line', () => {
    renderAbout(build(genuineDecision()))
    open()
    expect(valueOf('leader')).toBe(ABOUT_COPY.leader.leader_present)
    expect(detailOf('leader')).toEqual([])
  })

  it('withheld with a nameable cause: "Not confirmed" + vm.checks.leaderWithholdCause, verbatim', () => {
    const vm = build(decisionWithLeaderWithheld(), { producerLeaderWithholdReason: 'separation_unavailable' })
    const cause = vm.checks.leaderWithholdCause
    expect(cause, 'precondition').not.toBeNull()
    expect(cause).toBe(leaderWithholdCause('separation_unavailable'))
    renderAbout(vm)
    open()
    expect(valueOf('leader')).toBe(ABOUT_COPY.leader.leader_not_assessed)
    expect(detailOf('leader')).toEqual([cause])
  })

  it('CONTRAST: withheld with no nameable cause says "Not confirmed" and invents none', () => {
    const vm = build(decisionWithLeaderWithheld())
    expect(vm.checks.leaderWithholdCause).toBeNull()
    renderAbout(vm)
    open()
    expect(valueOf('leader')).toBe(ABOUT_COPY.leader.leader_not_assessed)
    expect(detailOf('leader')).toEqual([])
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
describe('Values and ranges — the view model\'s range and share, formatted by the builder\'s own formatter', () => {
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

  it('each analysed option shows p10 / p50 / p90 in the run\'s unit and its share readout', () => {
    const vm = build(ranged())
    renderAbout(vm, { outcomeFormat: GBP })
    open()
    openDetail('values')
    const a = vm.optionsComparison.rows.find((r) => r.id === 'opt_a')
    if (a?.kind !== 'analysed') throw new Error('precondition: opt_a analysed')
    const cell = (id: string, k: string) => screen.getByTestId(`${TID}-values-${id}-${k}`).textContent
    expect(cell('opt_a', 'low')).toBe(formatThreshold(1200, 'currency', '£', false))
    expect(cell('opt_a', 'low')).toContain('£')
    expect(cell('opt_a', 'mid')).toBe(formatThreshold(1450, 'currency', '£', false))
    expect(cell('opt_a', 'high')).toBe(formatThreshold(1900, 'currency', '£', false))
    expect(cell('opt_a', 'share')).toBe(a.winReadout)
    // An absent p50 is said, never drawn as zero.
    expect(cell('opt_b', 'mid')).toBe(ABOUT_COPY.values.notReturned)
    // The share row is named neutrally.
    expect(within(screen.getByTestId(`${TID}-values-opt_a`)).getByText(ABOUT_COPY.values.share)).toBeInTheDocument()
    expect(screen.queryByTestId(`${TID}-values-normalised`)).toBeNull()
  })

  it('order is the view model\'s, never re-sorted by share', () => {
    const vm = build(ranged())
    renderAbout(vm, { outcomeFormat: GBP })
    open()
    openDetail('values')
    const ids = screen
      .getAllByTestId(/^analysis-new-about-values-opt_[a-z]+$/)
      .map((el) => el.getAttribute('data-testid')!.replace(`${TID}-values-`, ''))
    expect(ids).toEqual(vm.optionsComparison.rows.map((r) => r.id))
  })

  /* ⭐ THE SHARES CARRY THEIR SCOPE HERE TOO. V2 moved the share figures out of
     "How the options compare" into this section, and the "Goal only" line stayed
     behind: on the served withheld run (c3a39ae7, scenario 3d00c023) "Share of
     simulations where this option came out highest" printed with no word that
     the limits are not in it. Same constant, same flag as the comparison. */
  it('limits left out of the shares → the Goal only line sits above them; CONTRAST: limits in → no line', () => {
    const base = build(ranged())
    const withheld = { ...base, checks: { ...base.checks, sharesExcludeLimits: true } }
    const { unmount } = renderAbout(withheld, { outcomeFormat: GBP })
    open()
    openDetail('values')
    const line = screen.getByTestId(`${TID}-values-goal-only`)
    expect(line).toHaveTextContent(COPY.optionFigures.goalOnlyQualifier)
    const share = screen.getByTestId(`${TID}-values-opt_a-share`)
    expect(share.textContent, 'PRECONDITION: a share figure is on screen').toMatch(/\d/)
    expect(line.compareDocumentPosition(share) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    unmount()
    renderAbout({ ...base, checks: { ...base.checks, sharesExcludeLimits: false } }, { outcomeFormat: GBP })
    open()
    openDetail('values')
    expect(screen.getByTestId(`${TID}-values-opt_a-share`)).toBeInTheDocument()
    expect(screen.queryByTestId(`${TID}-values-goal-only`)).toBeNull()
  })

  it('CONTRAST: a normalised run says the values are relative scores, and formats them as such', () => {
    const vm = build(ranged())
    renderAbout(vm, { outcomeFormat: { unit: undefined, symbol: undefined, isNormalised: true } })
    open()
    openDetail('values')
    expect(screen.getByTestId(`${TID}-values-normalised`)).toHaveTextContent(ABOUT_COPY.values.normalised)
    expect(screen.getByTestId(`${TID}-values-opt_a-low`).textContent).toBe(formatThreshold(1200, undefined, undefined, true))
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe("Your inputs and Olumi's — the VM's provenance kind, and the register's own counts", () => {
  const seedManifest = (scenarioId: string) =>
    useContextIntegrityStore.getState().setContextIntegrity({
      scenarioId,
      briefText: 'We are raising 1.3 million.',
      manifest: {
        status: 'derived',
        unavailableReason: null,
        quantities: { total: 3, inModel: 2, proseOnly: 0, absent: 1, truncated: false, items: [] },
        declaredExclusions: { status: 'none_reported', items: [] },
        inferredFactors: {
          status: 'derived',
          items: [
            { nodeId: 'f_a', label: 'Churn' },
            { nodeId: 'f_b', label: 'Price' },
          ],
        },
        notTracked: [],
      },
    })

  it('value is the short word for vm.atAGlance.inputProvenance', () => {
    const vm = build(highUncertainty())
    const kind = vm.atAGlance.inputProvenance
    expect(kind, 'precondition: the fixture has a provenance kind').not.toBeNull()
    renderAbout(vm)
    open()
    expect(valueOf('inputs')).toBe(ABOUT_COPY.inputs[kind!])
  })

  it('the brief counts appear for THIS decision, through the register\'s own sentence', () => {
    seedManifest('scn_about')
    renderAbout(build(highUncertainty()))
    open()
    expect(detailOf('inputs')).toEqual([
      figureTallySubtitle({ total: 3, inModel: 2, proseOnly: 0, absent: 1 }, 'not_counted'),
      ABOUT_COPY.estimatedCount(2),
    ])
  })

  it('⛔ CONTRAST: another decision\'s manifest is never counted', () => {
    seedManifest('scn_someone_else')
    renderAbout(build(highUncertainty()))
    open()
    expect(detailOf('inputs')).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('Method — simulations and seed, the values the body already hands the view model', () => {
  it('both present', () => {
    renderAbout(build(genuineDecision()), { nSamples: 10000, seedUsed: 42 })
    open()
    expect(valueOf('method')).toBe(ABOUT_COPY.method((10000).toLocaleString('en-GB'), '42'))
  })
  it('CONTRAST: neither present ⇒ no row, never "0 simulations"', () => {
    renderAbout(build(genuineDecision()))
    open()
    expect(screen.queryByTestId(`${TID}-row-method`)).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('Limitations — the not-assessed meanings by code, plus the standing science disclosure', () => {
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
})

// ═════════════════════════════════════════════════════════════════════════════
describe('Run record — every vm.deeper group, with DeeperAnalysis\'s statement-row rule kept', () => {
  const TARGET = 'fac_carrier_cutoff'
  const WARNINGS = [
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

  it('renders every group the view model built, including the run reference', () => {
    const vm = build(genuineDecision(), { nSamples: 5000, seedUsed: 7 })
    renderAbout(vm)
    open()
    openDetail('record')
    const titles = screen.getAllByTestId(`${TID}-record-group`).map((g) => g.querySelector('h5')!.textContent)
    expect(titles).toEqual(vm.deeper.groups.map((g) => g.title))
    expect(screen.getByTestId(`${TID}-detail-record-body`)).toHaveTextContent('run_about_1')
  })

  it('⛔ a statement row keeps its code in the DOM but never prints it', () => {
    renderAbout(build(withWarnings()))
    open()
    openDetail('record')
    const body = screen.getByTestId(`${TID}-detail-record-body`)
    const coded = body.querySelector('[data-gap-code="ROOT_NODE_DEFAULT_VALUE"]')
    expect(coded, 'the statement row carries its code as data').not.toBeNull()
    const visibleTerms = Array.from(body.querySelectorAll('dt:not(.sr-only)')).map((d) => d.textContent)
    expect(visibleTerms).not.toContain('ROOT_NODE_DEFAULT_VALUE')
  })

  it('the value control is OPT-IN — contrast pair on the same run', () => {
    useCanvasStore.setState({
      nodes: [{ id: TARGET, type: 'factor', data: { label: 'Carrier cut-off', observedState: { cap: 20, unit: 'months' } } }],
    } as never)
    const vm = build(withWarnings())
    const { unmount } = renderAbout(vm)
    open()
    openDetail('record')
    expect(screen.queryAllByTestId(`${TID}-value-edit`)).toHaveLength(0)
    unmount()
    renderAbout(vm, { offerFactorValueControl: true })
    open()
    openDetail('record')
    const controls = screen.queryAllByTestId(`${TID}-value-edit`)
    expect(controls.length).toBeGreaterThan(0)
    expect(controls[0]).toHaveAttribute('data-node-id', TARGET)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe("Limitations never repeat the leader sentence the commitment block states (V2 census B2)", () => {
  it('a withheld-leader run lists no leader limitation; the leader row carries it', () => {
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

describe('the AI act — hands the rows as context, invents nothing', () => {
  it('calls onAsk once with the label, the draft and the rendered row values', () => {
    const onAsk = vi.fn()
    const vm = build(decisionWithLeaderWithheld(), { producerLeaderWithholdReason: 'separation_unavailable' })
    renderAbout(vm, { onAsk })
    open()
    fireEvent.click(screen.getByTestId(`${TID}-ask`))
    expect(onAsk).toHaveBeenCalledTimes(1)
    const payload = onAsk.mock.calls[0]![0]
    expect(payload.label).toBe(ABOUT_COPY.ask)
    expect(payload.draft).toBe(ABOUT_COPY.askDraft)
    expect(payload.context).toContain(`${ABOUT_COPY.rows.freshness}: ${ABOUT_COPY.freshness.noChangeDetected}`)
    expect(payload.context).toContain(`${ABOUT_COPY.rows.leader}: ${ABOUT_COPY.leader.leader_not_assessed}`)
    expect(payload.context).toContain(vm.checks.leaderWithholdCause!)
    expect(Object.keys(payload).sort()).toEqual(['context', 'draft', 'label'])
  })

  it('CONTRAST: no handler ⇒ no AI control, even open', () => {
    renderAbout(build(genuineDecision()))
    open()
    expect(screen.queryByTestId(`${TID}-ask`)).toBeNull()
  })
})
