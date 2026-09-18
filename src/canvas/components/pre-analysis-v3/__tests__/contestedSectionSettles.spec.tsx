/**
 * SETTLING A CONTESTED CONNECTION — the act, end to end, on the real panel mount.
 *
 * WHAT WAS BROKEN. CEE tells the user, unprompted, that two drafting passes disagreed about a
 * link and that "it hasn't been settled". Measured at UI staging `3b7e5d4c` with a contrast
 * control: `buildEdgeAdjudicationEvent` had ZERO product callers (its only non-test references
 * were the adapter that RECEIVES the event and a sibling's docblock), while the same-family
 * `edgeStrengthEdit` had TEN non-test consumer files. The wire was open the whole time —
 * `edge_adjudication` is in `WIRE_SYSTEM_EVENT_TYPES` and CEE dispatches it `'fact_and_commit'`
 * — and the one surface that ever adjudicated is folded away by
 * `LEGACY_DETAILED_EDITOR_MOUNTED = false`. So the user could be told a disagreement mattered
 * and had no way to answer, and because `judgement-signals.ts` derives `contestedUnadjudicated`
 * by joining against exactly these facts, the product could never stop asking.
 *
 * WHY THE FULL PANEL AND NOT THE COMPONENT (trap 3b). A green suite says nothing about a
 * component the deployment does not render. These tests drive `PreAnalysisPanelV3`, the surface
 * deployed staging actually mounts, so the affordance is asserted where a user meets it.
 *
 * EVERY ASSERTION IS A MUTANT'S TOMBSTONE:
 *  · WIRE      — the verdict leaves the browser as a typed `edge_adjudication` event bound to
 *                the edge by from+to NODE ids, and carries the endorsed pass's mean.
 *  · IDENTITY  — pins name the SPECIFIC edge and the SPECIFIC verdict (trap 19). Never a
 *                length assertion another row could satisfy.
 *  · RETIRE    — the settled row leaves through `selectSurfacedContestedEdges`'s own
 *                `user_action` gate, and the acknowledgement survives the last row leaving.
 *  · NO VALUE  — no effect-strength value is written and no number reaches the screen. This is
 *                a judgement, not a value edit, and the copy may claim only what the fact does.
 *  · FAIL-CLOSED — no send ⇒ no button and a stated reason, never a dead control.
 *
 * jsdom proves PRESENCE, never visibility (trap 3).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'

const sendSystemEvent = vi.fn(async () => 'sent')

/**
 * The context the panel sees. A MUTABLE hoisted handle rather than a second `vi.mock` in the
 * offline test: re-mocking mid-file needs `vi.resetModules()`, which re-instantiates the whole
 * panel tree's module graph and lands it in its own error boundary — the test then "passes or
 * fails" on a crashed canvas rather than on the affordance. One mock, one switch.
 */
let conversationContext: { sendSystemEvent: typeof sendSystemEvent } | null = null

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  // ⚠ SPREAD THE ORIGINAL (trap 12). A bare factory REPLACES the module, so every other export
  // this panel's tree imports would silently vanish at collection.
  const actual = await importOriginal<typeof import('../../../conversation/ConversationContext')>()
  return {
    ...actual,
    useOptionalConversationContext: () => conversationContext,
  }
})

import { PreAnalysisPanelV3 } from '../PreAnalysisPanelV3'
import { ToastProvider } from '../../../ToastContext'
import { useCanvasStore } from '../../../store'
import { useReadinessStore } from '../../../stores/readinessStore'
import { useUIStore } from '../../../../stores/uiStore'
import { makeContestedEdge, makeContestedValidation } from '../../../../__fixtures__/contestedEdge'
import { CONTESTED_COPY } from '../constants'
import { contestedVerdictOptions } from '../contested/contestedVerdict'
import type { EdgeData } from '../../../domain/edges'
import type { ValidationMetadata } from '../../../domain/validation'

function node(id: string, kind: string, label: string, data: Record<string, unknown> = {}): Node {
  return { id, type: kind, position: { x: 0, y: 0 }, data: { kind, label, ...data } } as Node
}

const BASE_NODES: Node[] = [
  node('d1', 'decision', 'Hire a tech lead or two developers?'),
  node('g1', 'goal', 'Increase delivery output', { goal_threshold: 0.8 }),
  node('o1', 'option', 'Hire a tech lead'),
  node('f_lead', 'factor', 'Tech lead impact'),
  node('f_speed', 'factor', 'Delivery speed'),
  node('f_cost', 'factor', 'Salary cost'),
  node('f_morale', 'factor', 'Team morale'),
]

function setGraph(edges: Edge[]) {
  useCanvasStore.setState({
    nodes: BASE_NODES,
    edges: edges as Edge<EdgeData>[],
    preAnalysisSensitivity: null,
    draftCoaching: null,
    currentBriefText: null,
    goalThreshold: 0.8,
  })
}

beforeEach(() => {
  sendSystemEvent.mockClear()
  conversationContext = { sendSystemEvent }
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })))
  useReadinessStore.setState({
    readiness: {
      readiness_score: 72,
      readiness_level: 'ready',
      can_run_analysis: true,
      confidence_explanation: 'Looks consistent.',
      improvements: [],
    },
    loading: false,
    error: null,
  })
  useUIStore.setState({ activeOutputTab: 'results', pendingModelTabSection: null })
  setGraph([])
})

function renderPanel() {
  return render(
    <ToastProvider>
      <PreAnalysisPanelV3 onAnalyse={vi.fn()} isAnalysing={false} canRun blockedReason={undefined} />
    </ToastProvider>,
  )
}

const EDGE = 'e_lead_speed'
const settleBtn = (verdict: string, edgeId = EDGE) =>
  `pre-analysis-v3-contested-settle-${verdict}-${edgeId}`

/** The graph under test: ONE contested connection between two named factors. */
function oneContested(validation?: Partial<ValidationMetadata>) {
  setGraph([
    makeContestedEdge(EDGE, 'f_lead', 'f_speed', makeContestedValidation(validation)),
  ])
}

/** The edge as the store holds it now — the retire assertions read through this. */
function storedValidation(edgeId = EDGE): ValidationMetadata | undefined {
  const edge = useCanvasStore.getState().edges.find(e => e.id === edgeId)
  return (edge?.data as { validation?: ValidationMetadata } | undefined)?.validation
}

describe('settling a contested connection — the verdict reaches the wire', () => {
  it('sends a typed edge_adjudication event bound to the edge by from+to node ids', () => {
    oneContested()
    renderPanel()

    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass2')))

    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    const [event] = sendSystemEvent.mock.calls[0] as unknown as [
      { type: string; payload: Record<string, unknown> },
    ]
    // IDENTITY: the contract's rule is from+to NODE ids, not the client edge id.
    expect(event.type).toBe('edge_adjudication')
    expect(event.payload.from).toBe('f_lead')
    expect(event.payload.to).toBe('f_speed')
    expect(event.payload.edge_id).toBe(EDGE)
    expect(event.payload.verdict).toBe('accepted_pass2')
  })

  it('carries the endorsed pass mean — pass2 for the review, pass1 for the original', () => {
    // The two verdicts must not collapse onto one number. The fixture's passes differ
    // (0.35 vs 0.6), so a builder that always sent one of them goes RED on the other arm.
    oneContested()
    renderPanel()

    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass2')))
    const pass2Event = sendSystemEvent.mock.calls[0]![0] as unknown as {
      payload: Record<string, unknown>
    }
    expect(pass2Event.payload.resolved_strength_mean).toBe(0.35)

    // ⚠ UNMOUNT FIRST. A second `render` into the same container leaves BOTH panels in the
    // document and `getByTestId` then throws on the duplicate — which reads exactly like the
    // affordance being missing.
    cleanup()
    sendSystemEvent.mockClear()
    oneContested()
    renderPanel()
    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass1')))
    const pass1Event = sendSystemEvent.mock.calls[0]![0] as unknown as {
      payload: Record<string, unknown>
    }
    expect(pass1Event.payload.resolved_strength_mean).toBe(0.6)
  })

  it('records "can\'t say yet" as a real verdict that asserts no value', () => {
    oneContested()
    renderPanel()

    fireEvent.click(screen.getByTestId(settleBtn('dismissed')))

    const event = sendSystemEvent.mock.calls[0]![0] as unknown as {
      payload: Record<string, unknown>
    }
    expect(event.payload.verdict).toBe('dismissed')
    // A dismissal asserts NO value — the contract's own rule, applied by the builder.
    expect(event.payload).not.toHaveProperty('resolved_strength_mean')
    expect(storedValidation()?.resolved_value).toBeNull()
  })
})

describe('settling a contested connection — the row retires and says so', () => {
  it('stamps the verdict as the USER\'s judgement on the edge', () => {
    oneContested()
    renderPanel()
    expect(storedValidation()?.user_action).toBe('pending')

    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass2')))

    const after = storedValidation()
    expect(after?.user_action).toBe('accepted_pass2')
    // The USER made the choice, so `resolved_by` is theirs...
    expect(after?.resolved_by).toBe('user')
    // ...and the VALUE remains the producer's. `resolved_value` records which number the
    // endorsed pass stated; nothing here claims the human authored it.
    expect(after?.resolved_value).toEqual({ strength_mean: 0.35 })
  })

  it('retires the settled row and keeps the acknowledgement after the last one goes', () => {
    oneContested()
    renderPanel()
    expect(screen.getByTestId(`pre-analysis-v3-contested-row-${EDGE}`)).toBeInTheDocument()
    expect(screen.queryByTestId('pre-analysis-v3-contested-settled-ack')).toBeNull()

    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass1')))

    // The row leaves through `selectSurfacedContestedEdges`'s own `user_action` gate.
    expect(screen.queryByTestId(`pre-analysis-v3-contested-row-${EDGE}`)).toBeNull()
    // EMPTY MEANS ABSENT must not eat the confirmation the click just earned.
    expect(screen.getByTestId('pre-analysis-v3-contested-settled-ack')).toHaveTextContent(
      CONTESTED_COPY.settledAck,
    )
    // The count, the lead and the navigation CTA describe a list that is now empty.
    expect(screen.queryByTestId('pre-analysis-v3-contested-review')).toBeNull()
    expect(screen.queryByText(CONTESTED_COPY.lead)).toBeNull()
  })

  it('leaves a DIFFERENT contested connection untouched', () => {
    // Trap 19 at the section level: settling one row must not retire its neighbour.
    setGraph([
      makeContestedEdge(EDGE, 'f_lead', 'f_speed', makeContestedValidation()),
      makeContestedEdge('e_cost_morale', 'f_cost', 'f_morale', makeContestedValidation()),
    ])
    renderPanel()

    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass1')))

    expect(screen.queryByTestId(`pre-analysis-v3-contested-row-${EDGE}`)).toBeNull()
    expect(
      screen.getByTestId('pre-analysis-v3-contested-row-e_cost_morale'),
    ).toBeInTheDocument()
    expect(storedValidation('e_cost_morale')?.user_action).toBe('pending')
  })
})

describe('settling a contested connection — what it must NOT do', () => {
  it('writes no effect-strength value and puts no number on the screen', () => {
    oneContested()
    const before = useCanvasStore.getState().edges.find(e => e.id === EDGE)!.data
    renderPanel()

    // The section's own text, BEFORE the click — this is where a number would leak.
    const section = screen.getByTestId('pre-analysis-v3-contested')
    const text = section.textContent ?? ''
    expect(text).not.toContain('0.35')
    expect(text).not.toContain('0.6')

    fireEvent.click(screen.getByTestId(settleBtn('accepted_pass2')))

    const after = useCanvasStore.getState().edges.find(e => e.id === EDGE)!.data as Record<
      string,
      unknown
    >
    // `edge_adjudication` is `fact_and_commit`: it writes NO graph. The local write is
    // validation METADATA only, so no value the analysis reads may move.
    expect(after.weight).toEqual((before as Record<string, unknown>).weight)
    expect(after.weightSource).toEqual((before as Record<string, unknown>).weightSource)
    expect(after.direction).toEqual((before as Record<string, unknown>).direction)
  })

  it('offers no button and states the reason when no send is available', () => {
    // FAIL-CLOSED. A verdict that cannot leave the browser must not be offered as if it could.
    conversationContext = null
    oneContested()
    renderPanel()

    expect(screen.queryByTestId(settleBtn('accepted_pass1'))).toBeNull()
    expect(screen.queryByTestId(settleBtn('accepted_pass2'))).toBeNull()
    expect(screen.queryByTestId(settleBtn('dismissed'))).toBeNull()
    expect(
      screen.getByTestId(`pre-analysis-v3-contested-settle-unavailable-${EDGE}`),
    ).toHaveTextContent(CONTESTED_COPY.settleUnavailable)
    // POSITIVE CONTROL: the row itself is still on screen, so the three absences above are the
    // affordance being withheld — not the section having failed to render at all.
    expect(screen.getByTestId(`pre-analysis-v3-contested-row-${EDGE}`)).toBeInTheDocument()
  })
})

describe('contestedVerdictOptions — fail-closed on a pass that states nothing', () => {
  it('drops the verdict for a non-finite pass mean and keeps the escape hatch', () => {
    expect(contestedVerdictOptions({ pass1Mean: 0.6, pass2Mean: 0.35 }).map(o => o.verdict)).toEqual(
      ['accepted_pass1', 'accepted_pass2', 'dismissed'],
    )
    // A pass with nothing finite to endorse cannot be endorsed self-containedly.
    expect(contestedVerdictOptions({ pass1Mean: null, pass2Mean: 0.35 }).map(o => o.verdict)).toEqual(
      ['accepted_pass2', 'dismissed'],
    )
    expect(
      contestedVerdictOptions({ pass1Mean: Number.NaN, pass2Mean: Number.POSITIVE_INFINITY }).map(
        o => o.verdict,
      ),
    ).toEqual(['dismissed'])
    // `dismissed` never carries a value, by contract.
    expect(
      contestedVerdictOptions({ pass1Mean: 0.6, pass2Mean: 0.35 }).find(
        o => o.verdict === 'dismissed',
      )?.resolvedMean,
    ).toBeNull()
  })
})
