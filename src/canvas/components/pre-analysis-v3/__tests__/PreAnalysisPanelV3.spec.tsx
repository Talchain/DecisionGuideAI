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
import { ToastProvider } from '../../../ToastContext'
import { useCanvasStore } from '../../../store'
import { useReadinessStore } from '../../../stores/readinessStore'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { useSignalSessionStore } from '../signals/signalSessionStore'
import type { PreAnalysisSensitivity } from '../../../../adapters/cee/types'

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
    draftCoaching: null,
    currentBriefText: null,
    goalThreshold: null,
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
      <PreAnalysisPanelV3 onAnalyse={props.onAnalyse ?? vi.fn()} isAnalysing={props.isAnalysing ?? false} blockedReason={props.blockedReason} />
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
      'Estimates: 0 of 3 checked',
    )
  })

  it('ladder points at the success measure while it is unset', () => {
    renderPanel()
    expect(screen.getByTestId('pre-analysis-v3-next-step')).toHaveTextContent(
      'Define what success means here',
    )
  })

  it('shows the three deterministic signals with hedged estimate copy', () => {
    renderPanel()
    const sharpen = screen.getByTestId('pre-analysis-v3-sharpen')
    expect(sharpen).toHaveTextContent('You are comparing two options.')
    expect(sharpen).toHaveTextContent("2 risks captured, all Olumi's so far.")
    expect(sharpen).toHaveTextContent('Tech lead impact may matter most to the analysis')
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
      'Frame: Decision, goal and success measure set',
    )
    expect(screen.getByTestId('pre-analysis-v3-next-step')).toHaveTextContent('Tech lead impact')
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
    fireEvent.click(screen.getByRole('button', { name: 'Check Tech lead impact' }))

    const input = screen.getByLabelText('Your estimate for Tech lead impact')
    fireEvent.change(input, { target: { value: '40' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save estimate for Tech lead impact' }))

    const f1 = useCanvasStore.getState().nodes.find(n => n.id === 'f1')!
    const observed = (f1.data as { observedState?: Record<string, unknown> }).observedState!
    expect(observed.raw_value).toBe(40)
    expect(observed.source).toBe('user_override')

    expect(screen.getByTestId('pre-analysis-v3-bar-estimates')).toHaveAccessibleName(
      'Estimates: 1 of 3 checked',
    )
  })

  it('confirm as is writes user_confirmed without touching the value', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Your decision/ }))
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
    expect(screen.getByText('Open the Olumi panel to ask this')).toBeInTheDocument()
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

  it('the analyse button obeys the external gate authority (blockedReason)', () => {
    const onAnalyse = vi.fn()
    renderPanel({ onAnalyse, blockedReason: 'Add a goal first' })
    expect(screen.getByTestId('pre-analysis-v3-analyse')).toBeDisabled()
  })

  it('runs the analysis through the provided callback when enabled', () => {
    const onAnalyse = vi.fn()
    renderPanel({ onAnalyse })
    fireEvent.click(screen.getByTestId('pre-analysis-v3-analyse'))
    expect(onAnalyse).toHaveBeenCalledTimes(1)
  })
})
