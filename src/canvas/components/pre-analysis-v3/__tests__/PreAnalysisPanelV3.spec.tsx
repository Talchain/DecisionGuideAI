/**
 * PreAnalysisPanelV3 behavioural matrix (real canvas store, seeded):
 * - setup and basics-in-place states
 * - single-source-of-truth: one success commit updates bars, ladder and
 *   footer in the same pass
 * - render-if-live coaching (present, absent, swap-in-place without layout
 *   shift)
 * - signal resolution to quiet confirmations
 * - calibrate flow through the canonical observed-state writes
 * - spark dispatch via guidance-store callbacks with graceful degradation
 * - footer readiness copy (CEE explanation verbatim; gate authority external)
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { PreAnalysisPanelV3 } from '../PreAnalysisPanelV3'
import { SUCCESS_INPUT_ID } from '../hero/HeroSection'
import { ToastProvider } from '../../../ToastContext'
import { useCanvasStore } from '../../../store'
import { useReadinessStore } from '../../../stores/readinessStore'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { useSignalSessionStore } from '../signals/signalSessionStore'
import type { PreAnalysisSensitivity } from '../../../../adapters/cee/types'
import {
  BLOCKED_REASON_COPY,
  composeReadinessBlockedReason,
  selectOptionsNeedingValues,
} from '../../../utils/composeBlockedReason'
import type { GraphReadiness } from '../../../hooks/useGraphReadiness'

function node(
  id: string,
  kind: string,
  label: string,
  data: Record<string, unknown> = {},
): Node {
  return { id, type: kind, position: { x: 0, y: 0 }, data: { kind, label, ...data } } as Node
}

type StoreEdge = Parameters<typeof useCanvasStore.setState>[0] extends infer S
  ? S extends { edges?: Array<infer E> | undefined }
    ? E
    : never
  : never

function edge(source: string, target: string): StoreEdge {
  return { id: `${source}->${target}`, source, target, data: {} } as StoreEdge
}

const SENSITIVITY: PreAnalysisSensitivity = {
  factor_influence: { f1: 0.9, f2: 0.5, f3: 0.2 },
  edge_influence: {},
  method: 'linear',
}

function seedGraph(opts: { successSet?: boolean; reviewedAll?: boolean } = {}) {
  const goalData = opts.successSet
    ? { goal_threshold: 0.8, goal_threshold_raw: 20, goal_threshold_unit: '%' }
    : {}
  const factorSource = opts.reviewedAll ? 'user_confirmed' : 'cee_inference'
  const factor = (id: string, label: string, raw: number) =>
    node(id, 'factor', label, {
      provenance: 'ai_inferred',
      observedState: { raw_value: raw, value: raw / 100, unit: '%', source: factorSource },
    })
  useCanvasStore.setState({
    nodes: [
      node('d1', 'decision', 'Hire a tech lead or two developers?'),
      node('g1', 'goal', 'Increase delivery output', goalData),
      node('o1', 'option', 'Hire a tech lead'),
      node('o2', 'option', 'Hire two developers'),
      node('r1', 'risk', 'Onboarding drag', { provenance: 'ai_inferred' }),
      node('r2', 'risk', 'Hiring delay', { provenance: 'ai_inferred' }),
      factor('f1', 'Tech lead impact', 30),
      factor('f2', 'Ramp-up time', 60),
      factor('f3', 'Coordination overhead', 10),
    ],
    edges: [edge('f1', 'g1'), edge('f2', 'g1'), edge('f3', 'g1')],
    preAnalysisSensitivity: SENSITIVITY,
    ceeAnalysisReady: null,
    draftCoaching: null,
    currentBriefText: null,
    goalThreshold: null,
    goalConstraints: null,
  })
}

function seedReadiness(canRun = true, explanation = 'Looks consistent.') {
  useReadinessStore.setState({
    readiness: {
      readiness_score: 72,
      readiness_level: 'strong',
      can_run_analysis: canRun,
      confidence_explanation: explanation,
      improvements: [],
    },
    loading: false,
    error: null,
  })
}

function renderPanel(props: Partial<Parameters<typeof PreAnalysisPanelV3>[0]> = {}) {
  return render(
    <ToastProvider>
      <PreAnalysisPanelV3
        onAnalyse={props.onAnalyse ?? vi.fn()}
        isAnalysing={props.isAnalysing ?? false}
        canRun={props.canRun ?? true}
        blockedReason={props.blockedReason}
      />
    </ToastProvider>,
  )
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  )
})

beforeEach(() => {
  useSignalSessionStore.getState().reset()
  useGuidanceStore.setState({ _sendChip: null, _prefillChat: null })
  seedReadiness()
  seedGraph()
})

describe('setup state', () => {
  it('renders the decision title, goal and the four bars', () => {
    renderPanel()
    expect(screen.getByText('Hire a tech lead or two developers?')).toBeInTheDocument()
    expect(screen.getByLabelText('Goal')).toHaveValue('Increase delivery output')
    for (const key of ['frame', 'options', 'risks', 'estimates']) {
      expect(screen.getByTestId(`pre-analysis-v3-bar-${key}`)).toBeInTheDocument()
    }
    expect(screen.getByTestId('pre-analysis-v3-bar-estimates')).toHaveAccessibleName(
      'Estimates: low. 0 of 3 checked',
    )
  })

  it('ladder points at the success measure while it is unset', () => {
    renderPanel()
    expect(screen.getByTestId('pre-analysis-v3-next-step')).toHaveTextContent(
      'Define what success means here',
    )
  })

  it('shows the top two signals by default with the rest behind a reveal', () => {
    renderPanel()
    const sharpen = screen.getByTestId('pre-analysis-v3-sharpen')
    expect(sharpen).toHaveTextContent('You are comparing two options.')
    expect(sharpen).toHaveTextContent("2 risks captured, all Olumi's so far.")
    // The estimates signal sits behind the reveal.
    expect(sharpen).not.toHaveTextContent('Check Tech lead impact first')
    expect(screen.getAllByTestId(/pre-analysis-v3-signal-/)).toHaveLength(2)

    fireEvent.click(screen.getByTestId('pre-analysis-v3-sharpen-reveal'))
    expect(sharpen).toHaveTextContent('Check Tech lead impact first, it may matter most.')
    expect(screen.getAllByTestId(/pre-analysis-v3-signal-/)).toHaveLength(3)
    expect(screen.getByTestId('pre-analysis-v3-sharpen-reveal')).toHaveTextContent('Show fewer')
  })

  it('a live CEE row counts within the cap and never pushes the visible set beyond it', () => {
    useCanvasStore.setState({
      ceeAnalysisReady: {
        options: [],
        goal_node_id: 'g1',
        status: 'ready',
        bias_findings: [
          {
            id: 'b1',
            type: 'authority',
            severity: 'medium',
            description: 'x',
            affectedNodes: [],
            interventions: [],
            // Live wire shape carries `explanation` (typed shape lags the wire).
            explanation: 'A reflective check on how this model leans.',
          },
        ],
      } as unknown as import('../../../../adapters/cee/types').CEEAnalysisReady,
    })
    renderPanel()
    expect(screen.getAllByTestId(/pre-analysis-v3-signal-/)).toHaveLength(2)
    expect(screen.getByTestId('pre-analysis-v3-sharpen-reveal')).toHaveTextContent('Show 2 more')
    fireEvent.click(screen.getByTestId('pre-analysis-v3-sharpen-reveal'))
    const ids = screen
      .getAllByTestId(/pre-analysis-v3-signal-/)
      .map(el => el.getAttribute('data-testid'))
    expect(ids).toEqual([
      'pre-analysis-v3-signal-sig_option_breadth',
      'pre-analysis-v3-signal-sig_risk_count',
      'pre-analysis-v3-signal-sig_estimates',
      'pre-analysis-v3-signal-sig_cee_bias',
    ])
  })
})

describe('single source of truth — one success commit updates everything', () => {
  it('typing writes nothing; blur commits once and bars, ladder, footer move together', () => {
    renderPanel()
    const input = screen.getByLabelText('Success measure')

    fireEvent.change(input, { target: { value: '25' } })
    // Uncommitted: ladder and footer unchanged.
    expect(screen.getByTestId('pre-analysis-v3-next-step')).toHaveTextContent(
      'Define what success means here',
    )

    fireEvent.blur(input)

    expect(useCanvasStore.getState().goalThreshold).toBe(25)
    expect(screen.getByTestId('pre-analysis-v3-bar-frame')).toHaveAccessibleName(
      'Frame: good. Decision, goal and success measure set',
    )
    // The commit's invalidateAnalysisReady clears the seeded sensitivity, so
    // ranking legitimately degrades to the degree fallback here; the invariant
    // is that the ladder moved to a check-estimate rung in the same pass.
    expect(screen.getByTestId('pre-analysis-v3-next-step')).toHaveTextContent(
      /Check .+, it may matter most to the analysis\./,
    )
    expect(screen.getByTestId('pre-analysis-v3-footer')).toHaveTextContent(
      'Checking top estimates usually sharpens the result',
    )
  })

  it('basics in place: success set shows display-scale value with Olumi attribution', () => {
    seedGraph({ successSet: true })
    renderPanel()
    expect(screen.getByLabelText('Success measure')).toHaveValue('20%')
    expect(screen.getByTestId('pre-analysis-v3-hero')).toHaveTextContent('Olumi estimate')
  })

  it('an explicit-provenance stored goal constraint relabels the chip user-set (lane 35 fix 2)', () => {
    // The user STATED the target in their brief: CEE stored the goal
    // constraint with provenance 'explicit' and derived goal_threshold_raw
    // from it. "Olumi estimate" would misattribute the user's own number.
    seedGraph({ successSet: true })
    useCanvasStore.setState({
      goalConstraints: [
        {
          id: 'c1',
          label: 'Delivery output up 20%',
          operator: '>=',
          value: 20,
          provenance: 'explicit',
        } as never,
      ],
    })
    renderPanel()
    expect(screen.getByLabelText('Success measure')).toHaveValue('20%')
    const hero = screen.getByTestId('pre-analysis-v3-hero')
    expect(hero).toHaveTextContent('Your target')
    expect(hero).not.toHaveTextContent('Olumi estimate')
  })
})

describe('render-if-live coaching', () => {
  it('absent coaching renders the deterministic skeleton and no slot', () => {
    renderPanel()
    expect(screen.queryByTestId('pre-analysis-v3-coaching-slot')).not.toBeInTheDocument()
  })

  it('live summary renders verbatim with Olumi attribution', () => {
    useCanvasStore.setState({
      draftCoaching: {
        summary: 'The core tension is leadership against added delivery capacity.',
        strengthenItems: [],
        wideningLog: [],
        biasSignals: [],
      },
    })
    renderPanel()
    const slot = screen.getByTestId('pre-analysis-v3-coaching-slot')
    expect(slot).toHaveTextContent('Olumi:')
    expect(slot).toHaveTextContent('The core tension is leadership against added delivery capacity.')
  })

  it('narrow-framing swaps copy in place: same rows before and after, no layout shift', () => {
    const { unmount } = renderPanel()
    const before = screen
      .getAllByTestId(/pre-analysis-v3-signal-/)
      .map(el => el.getAttribute('data-testid'))
    unmount()

    useCanvasStore.setState({
      draftCoaching: {
        summary: null,
        strengthenItems: [],
        wideningLog: [],
        biasSignals: [
          { type: 'narrow_framing', detail: 'Both options are hiring routes.' },
        ],
      },
    })
    renderPanel()
    const after = screen
      .getAllByTestId(/pre-analysis-v3-signal-/)
      .map(el => el.getAttribute('data-testid'))
    expect(after).toEqual(before)

    const row = screen.getByTestId('pre-analysis-v3-signal-sig_option_breadth')
    expect(row).toHaveTextContent('Olumi noticed')
    expect(row).toHaveTextContent('Both options are hiring routes.')
  })
})

describe('signal resolution', () => {
  it('a seen estimates signal resolves to a quiet confirmation when all are reviewed', () => {
    useSignalSessionStore.getState().markSeen(['sig_estimates'], 1)
    seedGraph({ reviewedAll: true })
    renderPanel()
    fireEvent.click(screen.getByTestId('pre-analysis-v3-sharpen-reveal'))
    const row = screen.getByTestId('pre-analysis-v3-signal-sig_estimates')
    expect(row).toHaveAttribute('data-signal-status', 'resolved')
    expect(row).toHaveTextContent('Top estimates checked.')
  })

  it('never-seen cleared signals are absent, not confirmed', () => {
    seedGraph({ reviewedAll: true })
    renderPanel()
    expect(screen.queryByTestId('pre-analysis-v3-signal-sig_estimates')).not.toBeInTheDocument()
  })
})

describe('calibrate flow (canonical observed-state writes)', () => {
  it('saving a value writes raw_value + user_override and moves the estimates bar', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Your decision/ }))
    fireEvent.click(screen.getByRole('button', { name: /What this depends on/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Check Tech lead impact' }))

    const input = screen.getByLabelText('Your estimate for Tech lead impact')
    fireEvent.change(input, { target: { value: '40' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save estimate for Tech lead impact' }))

    const f1 = useCanvasStore.getState().nodes.find(n => n.id === 'f1')!
    const observed = (f1.data as { observedState?: Record<string, unknown> }).observedState!
    expect(observed.raw_value).toBe(40)
    expect(observed.source).toBe('user_override')

    expect(screen.getByTestId('pre-analysis-v3-bar-estimates')).toHaveAccessibleName(
      'Estimates: medium. 1 of 3 checked',
    )
  })

  it('confirm as is writes user_confirmed without touching the value', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Your decision/ }))
    fireEvent.click(screen.getByRole('button', { name: /What this depends on/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Check Tech lead impact' }))
    fireEvent.click(screen.getByTestId('pre-analysis-v3-confirm-as-is'))

    const f1 = useCanvasStore.getState().nodes.find(n => n.id === 'f1')!
    const observed = (f1.data as { observedState?: Record<string, unknown> }).observedState!
    expect(observed.source).toBe('user_confirmed')
    expect(observed.raw_value).toBe(30)
  })
})

describe('spark dispatch', () => {
  it('sends the prefilled prompt through _sendChip when registered', () => {
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip })
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Pressure-test the frame with Olumi' }))
    expect(sendChip).toHaveBeenCalledWith(
      'Pressure-test the frame',
      'Is this the right question to be asking, and does it fit my wider goals?',
    )
  })

  it('degrades to a toast when no conversation surface is registered (no dead end)', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Pressure-test the frame with Olumi' }))
    expect(
      screen.getByText('Olumi is unavailable right now. Open the Olumi panel and try again.'),
    ).toBeInTheDocument()
  })
})

describe('footer readiness', () => {
  it('mirrors the CEE explanation verbatim when analysis is unavailable', () => {
    seedReadiness(false, 'Two options need target values before analysis.')
    renderPanel()
    const footer = screen.getByTestId('pre-analysis-v3-footer')
    expect(footer).toHaveTextContent('Not ready for analysis yet')
    expect(footer).toHaveTextContent('Two options need target values before analysis.')
  })

  // UI-SEM-091: readiness reports not-runnable, but CEE will draft the
  // remaining options — the footer discloses the draft, never the not-ready
  // copy, so it agrees with the (enabled) run gate.
  it('discloses the scaffold draft instead of the not-ready copy when CEE will draft the options', () => {
    seedReadiness(false, 'Two options need target values before analysis.')
    useReadinessStore.setState({
      readiness: {
        ...useReadinessStore.getState().readiness!,
        scaffold_plan: { will_scaffold_options: true, option_count: 2 },
      },
    })
    // canRun mirrors the run gate (canRunAnalysis util), which ORs the scaffold.
    renderPanel({ canRun: true })
    const footer = screen.getByTestId('pre-analysis-v3-footer')
    expect(footer).toHaveTextContent('Olumi will draft the remaining 2 options')
    expect(footer).not.toHaveTextContent('Not ready for analysis yet')
    expect(footer).not.toHaveTextContent('Two options need target values before analysis.')
  })

  it('the analyse button obeys the external gate authority (canRun)', () => {
    const onAnalyse = vi.fn()
    renderPanel({ onAnalyse, canRun: false, blockedReason: 'Add a goal first' })
    expect(screen.getByTestId('pre-analysis-v3-analyse')).toBeDisabled()
  })

  it('an advisory tooltip never disables the button while the gate is open (footer diagnosis)', () => {
    renderPanel({ canRun: true, blockedReason: 'Analysis available - consider improvements for better results' })
    const button = screen.getByTestId('pre-analysis-v3-analyse')
    expect(button).toBeEnabled()
    const footer = screen.getByTestId('pre-analysis-v3-footer')
    expect(footer).toHaveTextContent('Analysis available')
    expect(footer).not.toHaveTextContent('Not ready for analysis yet')
  })

  it('runs the analysis through the provided callback when enabled', () => {
    const onAnalyse = vi.fn()
    renderPanel({ onAnalyse })
    fireEvent.click(screen.getByTestId('pre-analysis-v3-analyse'))
    expect(onAnalyse).toHaveBeenCalledTimes(1)
  })
})

describe('no silent failures (diagnose-and-fix pass)', () => {
  it('footer is coherent when the run gate is blocked: copy, dot and button agree', () => {
    renderPanel({ canRun: false, blockedReason: 'Add a goal before running the analysis' })
    const footer = screen.getByTestId('pre-analysis-v3-footer')
    expect(footer).toHaveTextContent('Not ready for analysis yet')
    expect(footer).toHaveTextContent('Add a goal before running the analysis')
    expect(footer).not.toHaveTextContent('Analysis available')
    expect(screen.getByTestId('pre-analysis-v3-analyse')).toBeDisabled()
  })

  it('unusable success input keeps the text and shows a format hint (no silent snap-back)', () => {
    renderPanel()
    const input = screen.getByLabelText('Success measure')
    fireEvent.change(input, { target: { value: 'better vibes' } })
    fireEvent.blur(input)
    expect(input).toHaveValue('better vibes')
    expect(screen.getByText('Enter a number, like 20 or 15%')).toBeInTheDocument()
    expect(useCanvasStore.getState().goalThreshold).toBeNull()
  })

  it('a dirty field shows a Save affordance; saving commits and confirms', () => {
    renderPanel()
    const input = screen.getByLabelText('Success measure')
    fireEvent.change(input, { target: { value: 'ship 25% faster' } })
    const save = screen.getByRole('button', { name: 'Save success' })
    fireEvent.click(save)
    expect(useCanvasStore.getState().goalThreshold).toBe(25)
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  // ROADMAP 1.1 fix (Gate 3 blocker, acceptance-evidence/6b-goal-capture):
  // the Hero's success-target commit above is a LOCAL-ONLY canvas-store
  // write — it never reached CEE, so a later "Analyse first pass" ran
  // against CEE's own server-side graph (no threshold) and Goal fit never
  // unlocked. Saving success must also sync the target to CEE via the same
  // add_constraint mechanism the working chat path already proves out
  // (6B evidence clause 3), silently (hidden: true — no chat bubble, since
  // the user already confirmed via the Hero's own Save button).
  it('saving a success target also syncs it to CEE via a hidden add_constraint dispatch', () => {
    const dispatchAction = vi.fn()
    useGuidanceStore.setState({ _dispatchAction: dispatchAction } as any)
    renderPanel()
    const input = screen.getByLabelText('Success measure')
    fireEvent.change(input, { target: { value: 'ship 25% faster' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save success' }))

    expect(dispatchAction).toHaveBeenCalledTimes(1)
    const call = dispatchAction.mock.calls[0][0]
    expect(call.action_type).toBe('add_constraint')
    expect(call.source).toBe('chip')
    expect(call.hidden).toBe(true)
    expect(typeof call.parameters?.description).toBe('string')
    expect(call.parameters.description.length).toBeGreaterThan(0)
    // The descriptive text the user typed should ride along verbatim so
    // Sonnet has the richest signal to interpret into a real constraint.
    expect(call.message).toContain('ship 25% faster')
  })

  // Dress-rehearsal 2026-07-20 regression: the digit-strip parser turned
  // "Reach £500k incremental ARR within 12 months of launch" into 50012
  // ("£500k" lost its k multiplier → 500; "12 months" concatenated on),
  // which rendered as "Target: 50,012" on the goal node and
  // "5,001,200% likelihood" in the Model tab. The commit must extract the
  // currency amount the user actually stated — never digit-concatenate.
  it('a descriptive sentence with a currency amount commits that amount, never digit-concatenation', () => {
    const dispatchAction = vi.fn()
    useGuidanceStore.setState({ _dispatchAction: dispatchAction } as never)
    renderPanel()
    const input = screen.getByLabelText('Success measure')
    fireEvent.change(input, {
      target: { value: 'Reach £500k incremental ARR within 12 months of launch' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save success' }))

    expect(useCanvasStore.getState().goalThreshold).toBe(500000)
    const goal = useCanvasStore.getState().nodes.find(n => n.id === 'g1')
    const goalData = goal?.data as { success_threshold?: number; goal_threshold_unit?: string }
    expect(goalData?.success_threshold).toBe(500000)
    expect(goalData?.goal_threshold_unit).toBe('£')
    // The committed value flows back down in the user's own unit.
    expect(input).toHaveValue('£500,000')
    // The verbatim sentence still rides to CEE.
    expect(dispatchAction.mock.calls[0][0].message).toContain('£500k')
  })

  it('a timeframe number is never fabricated into the target (fail closed with the hint)', () => {
    renderPanel()
    const input = screen.getByLabelText('Success measure')
    fireEvent.change(input, { target: { value: 'double revenue within 12 months' } })
    fireEvent.blur(input)
    expect(useCanvasStore.getState().goalThreshold).toBeNull()
    expect(screen.getByText('Enter a number, like 20 or 15%')).toBeInTheDocument()
  })

  it('does not throw when saving a success target with no _dispatchAction registered (graceful degradation)', () => {
    useGuidanceStore.setState({ _dispatchAction: null } as any)
    renderPanel()
    const input = screen.getByLabelText('Success measure')
    fireEvent.change(input, { target: { value: '25' } })
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Save success' }))).not.toThrow()
    expect(useCanvasStore.getState().goalThreshold).toBe(25)
  })

  it('rows without a value get an Add value affordance, no check tick, and the meta counts them', () => {
    useCanvasStore.setState({
      nodes: [
        ...useCanvasStore.getState().nodes,
        node('f4', 'factor', 'Team morale', {
          provenance: 'ai_inferred',
          observedState: { source: 'cee_inference' },
        }),
      ],
      preAnalysisSensitivity: null,
    })
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Your decision/ }))
    fireEvent.click(screen.getByRole('button', { name: /What this depends on/ }))
    expect(screen.getByTestId('pre-analysis-v3-add-value-f4')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check Team morale' })).not.toBeInTheDocument()
    expect(screen.getByTestId('pre-analysis-v3-your-decision')).toHaveTextContent(
      '0 of 3 checked · 1 needs a value',
    )
    // The Add value affordance opens the editor without a confirm-as-is action.
    fireEvent.click(screen.getByTestId('pre-analysis-v3-add-value-f4'))
    expect(screen.getByLabelText('Your estimate for Team morale')).toBeInTheDocument()
    expect(screen.queryByTestId('pre-analysis-v3-confirm-as-is')).not.toBeInTheDocument()
  })
})

describe('Your decision — per-group collapse', () => {
  it('groups are collapsed by default with counts visible; Expand all opens every group', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Your decision/ }))
    // Collapsed: group headers visible (with meta), bodies hidden.
    expect(screen.getByRole('button', { name: /What this depends on/ })).toBeInTheDocument()
    expect(screen.queryByTestId('pre-analysis-v3-estimate-f1')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Add another option')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('pre-analysis-v3-groups-toggle-all'))
    expect(screen.getByTestId('pre-analysis-v3-estimate-f1')).toBeInTheDocument()
    expect(screen.getByLabelText('Add another option')).toBeInTheDocument()
    expect(screen.getByTestId('pre-analysis-v3-groups-toggle-all')).toHaveTextContent('Collapse all')

    fireEvent.click(screen.getByTestId('pre-analysis-v3-groups-toggle-all'))
    expect(screen.queryByTestId('pre-analysis-v3-estimate-f1')).not.toBeInTheDocument()
  })

  it('a single group toggles independently', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Your decision/ }))
    fireEvent.click(screen.getByRole('button', { name: /Risks and upside/ }))
    expect(screen.getByLabelText('Add a risk')).toBeInTheDocument()
    expect(screen.queryByTestId('pre-analysis-v3-estimate-f1')).not.toBeInTheDocument()
  })
})

describe('CEE glossary guard at render time', () => {
  it('sanitises unsafe hero coaching in place, still attributed to Olumi', () => {
    useCanvasStore.setState({
      draftCoaching: {
        summary: 'One or more authority-labelled nodes are highly connected in the decision graph.',
        strengthenItems: [],
        wideningLog: [],
        biasSignals: [],
      },
    })
    renderPanel()
    const slot = screen.getByTestId('pre-analysis-v3-coaching-slot')
    expect(slot).toHaveTextContent('Olumi:')
    // In-place substitution keeps the meaning instead of discarding the whole line.
    expect(slot).toHaveTextContent('factors')
    expect(slot).toHaveTextContent('decision model')
    expect(slot).not.toHaveTextContent('nodes')
    expect(slot).not.toHaveTextContent('decision graph')
    // It did not need the generic fallback.
    expect(slot).not.toHaveTextContent('something in this set-up is worth a closer look')
  })

  it('falls back to a category-aware hero line when coaching cannot be sanitised', () => {
    useCanvasStore.setState({
      draftCoaching: {
        summary: 'High elasticity dominates the framing of both options.',
        strengthenItems: [],
        wideningLog: [],
        biasSignals: [],
      },
    })
    renderPanel()
    const slot = screen.getByTestId('pre-analysis-v3-coaching-slot')
    // "elasticity" has no safe substitute, so it degrades — to the framing line.
    expect(slot).toHaveTextContent('a framing pattern here is worth a closer look before analysis.')
    expect(slot).not.toHaveTextContent('elasticity')
  })

  it('an unsafe CEE bias row sanitises in place, never the raw term', () => {
    useCanvasStore.setState({
      ceeAnalysisReady: {
        options: [],
        goal_node_id: 'g1',
        status: 'ready',
        bias_findings: [
          {
            id: 'b1',
            type: 'authority',
            severity: 'medium',
            description: 'x',
            affectedNodes: [],
            interventions: [],
            // Live wire shape carries `explanation` (typed shape lags the wire).
            explanation:
              'One or more authority-labelled nodes are highly connected in the decision graph; this may overweight senior opinions.',
          },
        ],
      } as unknown as import('../../../../adapters/cee/types').CEEAnalysisReady,
    })
    renderPanel()
    fireEvent.click(screen.getByTestId('pre-analysis-v3-sharpen-reveal'))
    const row = screen.getByTestId('pre-analysis-v3-signal-sig_cee_bias')
    expect(row).toHaveTextContent('Olumi noticed')
    // Sanitised in place: the warning survives with safe vocabulary.
    expect(row).toHaveTextContent('factors')
    expect(row).toHaveTextContent('decision model')
    expect(row).toHaveTextContent('overweight senior opinions')
    expect(row).not.toHaveTextContent('nodes')
    expect(row).not.toHaveTextContent('decision graph')
  })

  it('an unsafe narrow-framing swap sanitises in place', () => {
    useCanvasStore.setState({
      draftCoaching: {
        summary: null,
        strengthenItems: [],
        wideningLog: [],
        biasSignals: [
          { type: 'narrow_framing', detail: 'Both options share one node in the graph.' },
        ],
      },
    })
    renderPanel()
    const row = screen.getByTestId('pre-analysis-v3-signal-sig_option_breadth')
    // Sanitised CEE detail renders (render-if-live), with safe vocabulary.
    expect(row).toHaveTextContent('Both options share one factor in the model.')
    expect(row).not.toHaveTextContent('node')
    expect(row).not.toHaveTextContent('graph')
  })

  it('safe CEE text still renders verbatim', () => {
    useCanvasStore.setState({
      draftCoaching: {
        summary: 'The core tension is leadership against added delivery capacity.',
        strengthenItems: [],
        wideningLog: [],
        biasSignals: [],
      },
    })
    renderPanel()
    expect(screen.getByTestId('pre-analysis-v3-coaching-slot')).toHaveTextContent(
      'The core tension is leadership against added delivery capacity.',
    )
  })
})

describe('assessment-pass regressions', () => {
  it('the footer says the analysis is running while it runs (not "not ready")', () => {
    renderPanel({ isAnalysing: true, canRun: false, blockedReason: 'Analysis is currently running' })
    const footer = screen.getByTestId('pre-analysis-v3-footer')
    expect(footer).toHaveTextContent('Analysis running')
    expect(footer).not.toHaveTextContent('Not ready for analysis yet')
    expect(screen.getByTestId('pre-analysis-v3-analyse')).toHaveTextContent('Analysing…')
  })

  it('an unsafe CEE string arriving via blockedReason is sanitised in the footer', () => {
    renderPanel({
      canRun: false,
      blockedReason: 'Two nodes in the decision graph need values',
    })
    const footer = screen.getByTestId('pre-analysis-v3-footer')
    expect(footer).not.toHaveTextContent('decision graph')
    expect(footer).not.toHaveTextContent('nodes')
    expect(footer).toHaveTextContent('Two factors in the decision model need values')
  })

  // ⚠ Paul's journey, 28 Jul — the surface he actually saw.
  //
  // He added an option by chat on a model with a decision, a goal and five
  // options. The footer read:
  //
  //     Not ready for analysis yet
  //     Add a decision, a goal and at least two options
  //
  // …two lines below the panel's own "5 options · 3 risks · 6 estimates". The
  // engine's reason contained the banned word "blocked", `guardCeeText` found no
  // substitution and degraded to that fallback — an honesty guard emitting a
  // false statement of fact. The gate now hands the footer COMPOSED copy
  // (utils/composeBlockedReason.ts), and the fallback claims nothing.
  it("the blocked footer names the real reason and never tells a five-option model to add options", () => {
    renderPanel({
      canRun: false,
      blockedReason: BLOCKED_REASON_COPY.oneOption(
        'Partner with a specialist consultancy',
        true,
      ),
    })
    const footer = screen.getByTestId('pre-analysis-v3-footer')
    expect(footer).toHaveTextContent('Not ready for analysis yet')
    expect(footer).toHaveTextContent(
      '"Partner with a specialist consultancy" has no effect values yet. Tell Olumi what it changes and the analysis can run.',
    )
    // The false claim, and the developer-facing string that preceded it.
    expect(footer).not.toHaveTextContent('Add a decision, a goal and at least two options')
    expect(footer).not.toHaveTextContent('V3 analysis not ready')
    expect(footer).not.toHaveTextContent('opt_')
  })

  it('the composed reason survives the guard verbatim (it is glossary-clean by construction)', () => {
    // If the composer ever emitted a banned term the guard would silently
    // replace the whole sentence with the fallback — the failure mode this
    // whole change exists to remove. Pinned here, at the render.
    for (const reason of [
      BLOCKED_REASON_COPY.oneOption('Buy a vendor platform', true),
      BLOCKED_REASON_COPY.oneOption('Buy a vendor platform', false),
      BLOCKED_REASON_COPY.twoOptions('Buy a vendor platform', 'Build in house', true),
      BLOCKED_REASON_COPY.manyOptions(3, true),
      BLOCKED_REASON_COPY.manyOptions(3, false),
      BLOCKED_REASON_COPY.goalMissing,
      BLOCKED_REASON_COPY.tooFewOptions,
      BLOCKED_REASON_COPY.unspecified,
    ]) {
      const { unmount } = renderPanel({ canRun: false, blockedReason: reason })
      expect(screen.getByTestId('pre-analysis-v3-footer')).toHaveTextContent(reason)
      unmount()
    }
  })

  // ══════════════════════════════════════════════════════════════════════
  // AMENDMENT A1 (adversarial review of #520, 28 Jul) — EXECUTED FINDING.
  //
  // The footer passed the COMPOSED sentence through `guardCeeText`, which
  // PREFERS IN-PLACE SUBSTITUTION and enforces terms the composer's own label
  // vet does not (node/nodes/edge/edges/graphs). Proven at the bytes: an option
  // the user named "Move billing to edge computing" rendered in the footer as
  // "Move billing to CONNECTION computing" — a label that exists on no canvas —
  // while the unguarded ⌘Enter toast and dock tooltip showed the real one.
  // Three surfaces, three stories: the very class this PR exists to remove.
  //
  // These two go through the REAL composer, not a hand-written string.
  // ══════════════════════════════════════════════════════════════════════
  describe('the blocked footer never rewrites the user’s own option label', () => {
    const verdict: GraphReadiness = {
      readiness_score: 90,
      readiness_level: 'ready',
      can_run_analysis: false,
      confidence_explanation: 'V3 analysis not ready: 1 option(s) blocked: opt_edge',
      improvements: [],
      scaffold_plan: { will_scaffold_options: false },
      options_ready: 1,
      options_total: 2,
      goal_node_valid: true,
    }

    const composedFor = (label: string) =>
      composeReadinessBlockedReason(
        verdict,
        selectOptionsNeedingValues({
          options: [
            { id: 'opt_keep', label: 'Keep billing where it is', status: 'ready' },
            { id: 'opt_edge', label, status: 'needs_encoding' },
          ],
        }),
      )

    it('renders the EXACT label the user typed, even when it carries "edge"', () => {
      const label = 'Move billing to edge computing'
      const reason = composedFor(label)
      expect(reason).toContain(label) // the composer quotes it verbatim…

      renderPanel({ canRun: false, blockedReason: reason })
      const footer = screen.getByTestId('pre-analysis-v3-footer')
      // …and so does the footer. This is the assertion that was RED.
      expect(footer).toHaveTextContent(`"${label}" has no effect values yet.`)
      expect(footer).not.toHaveTextContent('connection computing')
      expect(footer).not.toHaveTextContent('Olumi is not able to run this yet')
    })

    it('a long label whose truncation would expose a banned word degrades WHOLE', () => {
      // The review's second executed proof: 'graphite' passes the vet, the cut
      // lands after "graph", and the guard rewrote it to "… model…". The honest
      // answer is the count — never a mutated variant of the user's words.
      const label = `${'x'.repeat(41)} graphite dashboards consolidation`
      const reason = composedFor(label)

      renderPanel({ canRun: false, blockedReason: reason })
      const footer = screen.getByTestId('pre-analysis-v3-footer')
      const text = footer.textContent ?? ''
      expect(footer).toHaveTextContent('1 option has no effect values yet')
      expect(text).not.toContain('x'.repeat(41)) // no fragment of the label at all
      expect(text).not.toMatch(/\bgraph\b/i) // no banned fragment
      expect(text).not.toContain('model…') // the mutated variant the review proved
    })
  })

  it('the run rung explains itself instead of silently no-opping when the dock gate is closed', () => {
    // Readiness says runnable and everything is set, so the ladder reads
    // "run first" — but the dock gate is closed (e.g. a validation blocker).
    seedGraph({ successSet: true, reviewedAll: true })
    const onAnalyse = vi.fn()
    renderPanel({ onAnalyse, canRun: false, blockedReason: 'One option needs a target value' })
    expect(screen.getByTestId('pre-analysis-v3-next-step')).toHaveTextContent(
      'Run your first analysis',
    )
    const before = screen.getAllByText('One option needs a target value').length // footer subline
    fireEvent.click(screen.getByRole('button', { name: 'Act on best next step' }))
    expect(onAnalyse).not.toHaveBeenCalled()
    // The click adds a toast carrying the same explanation.
    expect(screen.getAllByText('One option needs a target value').length).toBe(before + 1)
  })

  it('the actions menu follows the menu keyboard contract', () => {
    renderPanel()
    const trigger = screen.getByTestId('pre-analysis-v3-actions')
    fireEvent.click(trigger)
    const items = screen.getAllByRole('menuitem')
    expect(items[0]).toHaveFocus()
    fireEvent.keyDown(items[0], { key: 'ArrowDown' })
    expect(items[1]).toHaveFocus()
    fireEvent.keyDown(items[1], { key: 'End' })
    expect(items[items.length - 1]).toHaveFocus()
    fireEvent.keyDown(items[items.length - 1], { key: 'ArrowDown' })
    expect(items[0]).toHaveFocus()
    fireEvent.keyDown(items[0], { key: 'Escape' })
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0)
    expect(trigger).toHaveFocus()
  })

  it('an empty estimates bar shows no cue word (caption cannot contradict the tooltip)', () => {
    useCanvasStore.setState({
      nodes: useCanvasStore.getState().nodes.filter(n => (n.data as { kind?: string }).kind !== 'factor'),
      preAnalysisSensitivity: null,
    })
    renderPanel()
    const bar = screen.getByTestId('pre-analysis-v3-bar-estimates')
    expect(bar).toHaveAccessibleName('Estimates: No estimates yet')
    expect(bar).not.toHaveTextContent('medium')
  })
})

describe('Success-target nudge (V3)', () => {
  it('renders the nudge when a drafted graph has a goal but no success target', () => {
    // beforeEach seeds seedGraph(): goal g1 present, no goal_threshold →
    // success unset. The V3 panel is the LIVE staging surface, so the nudge
    // must be present here (regression guard for the dark-nudge defect).
    renderPanel()
    expect(screen.getByTestId('goal-target-nudge')).toBeInTheDocument()
  })

  it('hides the nudge once a success target is set', () => {
    seedGraph({ successSet: true })
    renderPanel()
    expect(screen.queryByTestId('goal-target-nudge')).not.toBeInTheDocument()
  })

  it('does not render the nudge when there is no goal node', () => {
    useCanvasStore.setState({
      nodes: useCanvasStore
        .getState()
        .nodes.filter(n => (n.data as { kind?: string }).kind !== 'goal'),
    })
    renderPanel()
    expect(screen.queryByTestId('goal-target-nudge')).not.toBeInTheDocument()
  })

  it('CTA reaches the V3 setter seam (focuses the inline success field)', () => {
    // Same route handleLadderAct('set_success') / handleSignalAction(
    // 'focus_success_field') use — focus the inline success field by id. No
    // second editor.
    renderPanel()
    fireEvent.click(screen.getByTestId('goal-target-nudge-cta'))
    expect(document.getElementById(SUCCESS_INPUT_ID)).toHaveFocus()
  })
})
