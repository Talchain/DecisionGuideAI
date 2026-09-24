/**
 * NO GREEN "Analysis available" WHILE THE CANVAS SAYS `Needs input`.
 *
 * ── THE WITNESS (Paul's OpenAI test, 24 Sep 2026) ───────────────────────────
 * UI `a4434670`, `?ai=openai`, scenario `11014edf-b553-4089-a09c-484a3cf53010`,
 * export `olumi-debug-2f1b374e-20260924.json`, screenshots `7c43bdaf…` and
 * `0020bc3c…`. Four factor cards carried the orange `Needs input` pill; the
 * Olumi bar beside them said a GREEN "Analysis available / Analyse first pass";
 * the next Run was refused for exactly those four values.
 *
 * The fixture below is that export's `payloads.cee_response`, reduced to the
 * fields this surface reads and copied verbatim (ids, labels, observed_state):
 *   · `analysis_ready.status: "ready"`, `analysis_ready.may_run: true`
 *   · `analysis_state.readiness: { status: "unknown", blockers: [] }`
 *   · four `draft_graph.nodes[kind=factor].observed_state: null`
 * It is the producer's own contradiction — `may_run` true while the Run turn
 * declined for missing inputs — and this surface must not paper over it in
 * EITHER direction: it may not say the success headline, and it may not
 * invent a second gate. Both halves are pinned.
 *
 * RED proof: with `readinessDisplay.ts`'s new arm removed (or the prop not
 * passed) the headline assertions below read "Analysis available".
 */
import { describe, it, expect, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { AnalysisReadinessBar } from '../AnalysisReadinessBar'
import { PanelFooter } from '../../pre-analysis-v3/footer/PanelFooter'
import {
  valuesAwaitingInputBeforeRun,
  RESTING_AVAILABLE,
} from '../../pre-analysis-v3/footer/readinessDisplay'
import { FOOTER_COPY } from '../../pre-analysis-v3/constants'
import { canRunAnalysis } from '../../../utils/canRunAnalysis'
import { selectAnalysisReadinessAuthority } from '../../../state/analysisStateSelector'

afterEach(cleanup)

/** Verbatim from the export's `draft_graph.nodes` (kind=factor). */
const EVIDENCE_FACTORS = [
  { id: 'new_pro_plan_price', label: 'New Pro plan price', category: 'controllable', observed_state: { cap: 200, unit: 'GBP/month', value: 0.245, source: 'brief_extraction', raw_value: 49, declared_scale: 'unit_interval' } },
  { id: 'existing_pro_plan_price', label: 'Existing Pro plan price', category: 'controllable', observed_state: { cap: 200, unit: 'GBP/month', value: 0.245, raw_value: 49, declared_scale: 'unit_interval' } },
  { id: 'new_pro_conversion_rate', label: 'New Pro conversion rate', category: 'observable', observed_state: null },
  { id: 'monthly_churn', label: 'Monthly churn', category: 'observable', observed_state: null },
  { id: 'pro_subscriber_count', label: 'Pro subscriber count', category: 'observable', observed_state: null },
  { id: 'pro_feature_value_perception', label: 'Pro feature value perception', category: 'observable', observed_state: null },
] as const

/** Canvas nodes as the store holds them: React Flow `type`, CEE fields in `data`. */
const EVIDENCE_NODES = [
  { id: 'decision_mrr', type: 'decision', data: { label: 'Decision: MRR' } },
  { id: 'mrr', type: 'goal', data: { label: 'MRR' } },
  ...EVIDENCE_FACTORS.map((f) => ({
    id: f.id,
    type: 'factor',
    data: { label: f.label, category: f.category, observed_state: f.observed_state },
  })),
]

const EVIDENCE_AWAITING_IDS = [
  'new_pro_conversion_rate',
  'monthly_churn',
  'pro_subscriber_count',
  'pro_feature_value_perception',
]

/** The same model after the four starting assumptions were adopted (the later export). */
const EVERY_VALUE_SET = EVIDENCE_NODES.map((n) =>
  n.type === 'factor' && (n.data as { observed_state: unknown }).observed_state === null
    ? { ...n, data: { ...n.data, observed_state: { value: 0.05, raw_value: 5, unit: '%' } } }
    : n,
)

function renderBar(awaiting: ReturnType<typeof valuesAwaitingInputBeforeRun> | undefined, canRun = true) {
  return render(
    <AnalysisReadinessBar
      preRunWithModel
      canRun={canRun}
      isAnalysing={false}
      nothingHasAnswered={false}
      valuesAwaitingInput={awaiting}
      onAnalyse={() => {}}
    />,
  )
}

describe('the evidence state really is the contradiction (preconditions, not assumptions)', () => {
  it('the gate OPENS on the producer fields the export carried — so any "Needs input" here is not a gate refusal', () => {
    const analysisReadiness = selectAnalysisReadinessAuthority({
      run_state: { kind: 'never_run' },
      readiness: { status: 'unknown', blockers: [] },
    } as never)
    const gate = canRunAnalysis({
      graphHealth: { status: 'healthy', score: 100, issues: [] },
      readiness: null,
      analysisReadiness,
      mayRun: true,
      hasBlockers: false,
      nodeCount: EVIDENCE_NODES.length,
    } as never)
    expect(gate.allowed).toBe(true)
  })

  it('the canvas predicate names EXACTLY the four valueless factors, by id', () => {
    expect(valuesAwaitingInputBeforeRun(EVIDENCE_NODES).map((v) => v.id)).toEqual(EVIDENCE_AWAITING_IDS)
  })

  it('CONTRAST: once the four are set, nothing awaits input', () => {
    expect(valuesAwaitingInputBeforeRun(EVERY_VALUE_SET)).toEqual([])
  })

  it('an EXTERNAL factor never counts — the same exemption the node pill applies', () => {
    const external = [{ id: 'x', type: 'factor', data: { label: 'Market', category: 'external', observed_state: null } }]
    expect(valuesAwaitingInputBeforeRun(external)).toEqual([])
  })

  it('a value in the camelCase carrier counts as set (the shared carrier reader, not a re-typed one)', () => {
    const camel = [{ id: 'c', type: 'factor', data: { label: 'Churn', observedState: { value: 0.05 } } }]
    expect(valuesAwaitingInputBeforeRun(camel)).toEqual([])
  })

  it('a raw-id-shaped label is never offered as a name', () => {
    const idLabel = [{ id: 'fac_1', type: 'factor', data: { label: 'fac_1' } }]
    expect(valuesAwaitingInputBeforeRun(idLabel)).toEqual([{ id: 'fac_1', label: null }])
  })
})

describe('the Olumi bar — conservative headline, gate untouched', () => {
  it('EVIDENCE: says "Needs input before a run", NOT "Analysis available", and names the four', () => {
    renderBar(valuesAwaitingInputBeforeRun(EVIDENCE_NODES))
    const headline = screen.getByTestId('analysis-readiness-bar-headline')
    expect(headline).toHaveTextContent(FOOTER_COPY.needsInputBeforeRun)
    expect(headline).not.toHaveTextContent(FOOTER_COPY.ready)
    expect(screen.getByTestId('analysis-readiness-bar-reason')).toHaveTextContent(
      'No value yet for New Pro conversion rate, Monthly churn, Pro subscriber count and Pro feature value perception.',
    )
    // Not the success dot.
    const dot = screen.getByTestId('analysis-readiness-bar').querySelector('span[aria-hidden]')
    expect(dot).toHaveClass('bg-warning')
    expect(dot).not.toHaveClass('bg-success')
  })

  it('NOT A SECOND GATE: the Analyse control keeps the gate’s own enabled state', () => {
    renderBar(valuesAwaitingInputBeforeRun(EVIDENCE_NODES))
    expect(screen.getByTestId('analysis-readiness-bar')).toHaveAttribute('data-blocked', 'false')
    expect(screen.getByTestId('analysis-readiness-bar-analyse')).toBeEnabled()
  })

  it('CONTRAST: every value set → the success headline returns', () => {
    renderBar(valuesAwaitingInputBeforeRun(EVERY_VALUE_SET))
    expect(screen.getByTestId('analysis-readiness-bar-headline')).toHaveTextContent(FOOTER_COPY.ready)
  })

  it('CONTRAST: prop absent → today’s behaviour, byte for byte', () => {
    renderBar(undefined)
    expect(screen.getByTestId('analysis-readiness-bar-headline')).toHaveTextContent(FOOTER_COPY.ready)
  })

  it('PRECEDENCE: a shut gate still speaks with the producer’s own reason, not this arm', () => {
    render(
      <AnalysisReadinessBar
        preRunWithModel
        canRun={false}
        blockedReason='Set the observed value for "Monthly churn".'
        isAnalysing={false}
        nothingHasAnswered={false}
        valuesAwaitingInput={valuesAwaitingInputBeforeRun(EVIDENCE_NODES)}
        onAnalyse={() => {}}
      />,
    )
    expect(screen.getByTestId('analysis-readiness-bar-headline')).toHaveTextContent(FOOTER_COPY.notReady)
    expect(screen.getByTestId('analysis-readiness-bar-analyse')).toBeDisabled()
  })

  it('more than four, or an unlabelled one → counted, up to three named, never an id', () => {
    const many = [
      ...EVIDENCE_NODES,
      { id: 'fac_9', type: 'factor', data: { label: 'fac_9' } },
    ]
    renderBar(valuesAwaitingInputBeforeRun(many))
    const reason = screen.getByTestId('analysis-readiness-bar-reason')
    expect(reason).toHaveTextContent(
      'No value yet for 5 factors, including New Pro conversion rate, Monthly churn and Pro subscriber count.',
    )
    expect(reason).not.toHaveTextContent('fac_9')
  })
})

describe('the Analysis footer says the SAME headline for the same state', () => {
  it('EVIDENCE: footer headline equals the bar headline — "Needs input before a run"', () => {
    const awaiting = valuesAwaitingInputBeforeRun(EVIDENCE_NODES)
    render(
      <PanelFooter
        footer={{ ...RESTING_AVAILABLE, subline: FOOTER_COPY.readySubEstimates }}
        onAnalyse={() => {}}
        isAnalysing={false}
        canRun
        valuesAwaitingInput={awaiting}
      />,
    )
    const footerHeadline = screen.getByTestId('pre-analysis-v3-footer-headline').textContent
    cleanup()
    renderBar(awaiting)
    expect(screen.getByTestId('analysis-readiness-bar-headline').textContent).toBe(footerHeadline)
    expect(footerHeadline).toBe(FOOTER_COPY.needsInputBeforeRun)
  })

  it('CONTRAST: the footer keeps its own resting detail when nothing awaits input', () => {
    render(
      <PanelFooter
        footer={{ ...RESTING_AVAILABLE, subline: FOOTER_COPY.readySubEstimates }}
        onAnalyse={() => {}}
        isAnalysing={false}
        canRun
        valuesAwaitingInput={[]}
      />,
    )
    expect(screen.getByTestId('pre-analysis-v3-footer-headline')).toHaveTextContent(FOOTER_COPY.ready)
    expect(screen.getByTestId('pre-analysis-v3-footer-subline')).toHaveTextContent(FOOTER_COPY.readySubEstimates)
  })
})
