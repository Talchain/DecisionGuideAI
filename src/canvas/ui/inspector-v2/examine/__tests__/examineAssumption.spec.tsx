/**
 * ⭐ EXAMINE THIS ASSUMPTION (slice 1, 52f8cd) — the view's bases, the sound-figure control, and the mounted section's
 * one action: it PREFILLS the composer and sends nothing (plan F1/F2/F7).
 *
 * The mounted rows go through the deployed chain (`InspectorModal` → `InspectorRouter`), not the component alone: a
 * green row on an unmounted component says nothing about what the inspector shows (#2380's lesson).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, within, fireEvent } from '@testing-library/react'

import { InspectorModal } from '../../../../components/InspectorModal'
import { useCanvasStore } from '../../../../store'
import { useGuidanceStore } from '../../../../stores/guidanceStore'
import { factorDisplayText } from '../../../../../utils/formatFactorDisplayValue'
import { VALUE_PROVENANCE_LABEL } from '../../../../domain/valueProvenance'
import type { AttentionReason } from '../../../../nodes/shared/nodeAttention'
import { buildExamineAssumptionView, EXAMINE_WHY } from '../examineAssumptionView'

vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

const AT = '2026-10-01T00:00:00.000Z'
const OLUMIS = { value: 0.3, raw_value: 30, unit: '%', source: 'cee_inference' }
const ACCEPTED = { value: 0.3, raw_value: 30, unit: '%', source: 'user_assumption', reviewed_by_user: { intent: 'confirm', at: AT } }
const USERS_OWN = { value: 0.3, raw_value: 30, unit: '%', source: 'user_assumption' }
const TYPED = { value: 0.3, raw_value: 30, unit: '%', source: 'user_override' }
const TOP_DRIVER: AttentionReason = { kind: 'top_driver', order: 2, label: 'This is one of the biggest drivers. Is it right?' }
const GAP: AttentionReason = { kind: 'evidence_gap', order: 3, label: 'No evidence yet.' }

const view = (observed: unknown, reasons: readonly AttentionReason[] = [], valueText: string | null = '30%') =>
  buildExamineAssumptionView({ label: 'Warm introductions', valueText, observed, reasons })

describe('the view: an explicit basis, or nothing', () => {
  it('Olumi’s own figure is worth examining because it is Olumi’s', () => {
    const v = view(OLUMIS)!
    expect(v.basis).toBe('olumi_estimate')
    expect(v.why).toBe(EXAMINE_WHY.ai)
    expect(v.origin).toBe(VALUE_PROVENANCE_LABEL.ai)
  })

  it('Olumi’s figure the user ACCEPTED is still Olumi’s estimate (origin ≠ acceptance)', () => {
    const v = view(ACCEPTED)!
    expect(v.basis).toBe('olumi_estimate')
    expect(v.why).toBe(EXAMINE_WHY.accepted)
    expect(v.origin).toBe(VALUE_PROVENANCE_LABEL.accepted)
  })

  it('⛔ SOUND CONTROL: the user’s own figure with nothing flagged gets no challenge (bare assumption, typed figure)', () => {
    expect(view(USERS_OWN)).toBeNull()
    expect(view(TYPED)).toBeNull()
    expect(view(TYPED, [GAP]), 'an evidence gap is not the analysis flagging the figure').toBeNull()
  })

  it('the user’s own figure the last Run flags is worth examining on the analysis basis', () => {
    const v = view(TYPED, [TOP_DRIVER])!
    expect(v.basis).toBe('analysis')
    expect(v.why).toBe(EXAMINE_WHY.analysis)
    expect(v.origin).toBe(VALUE_PROVENANCE_LABEL.edited)
  })

  it('no figure → nothing to examine', () => {
    expect(view(OLUMIS, [TOP_DRIVER], null)).toBeNull()
    expect(view(OLUMIS, [TOP_DRIVER], '  ')).toBeNull()
  })

  it('the prepared message names the factor and its figure, and asks for a proposal to approve', () => {
    const t = view(OLUMIS)!.prepare.text
    expect(t).toContain('"Warm introductions"')
    expect(t).toContain('30%')
    expect(t).toMatch(/propose it for my approval/)
  })
})

const FACTOR_ID = 'fac_warm'
const LABEL = 'Warm introductions'

function seed(observedState: Record<string, unknown>) {
  useCanvasStore.setState({
    nodes: [
      { id: FACTOR_ID, type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: LABEL, category: 'controllable', observedState } },
    ] as never[],
    edges: [] as never[],
    results: { status: 'idle', report: null },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: { x: 0, y: 0 } },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

function open(): HTMLElement {
  const utils = render(<InspectorModal nodeId={FACTOR_ID} edgeId={null} onClose={vi.fn()} />)
  const dialog = utils.container.querySelector('div[role="dialog"][aria-label="Node inspector"]')
  expect(dialog, 'PRECONDITION: the node inspector is mounted').not.toBeNull()
  return dialog as HTMLElement
}

describe('the mounted section (InspectorModal → InspectorRouter)', () => {
  const prefill = vi.fn()
  const send = vi.fn()
  const dispatch = vi.fn()
  beforeEach(() => {
    vi.clearAllMocks()
    useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: send, _dispatchAction: dispatch } as never)
  })

  it('RED: Olumi’s figure shows the section with the card’s own reading of the figure and its origin', () => {
    seed(OLUMIS)
    const s = within(open()).getByTestId('inspector-examine')
    expect(s.getAttribute('data-basis')).toBe('olumi_estimate')
    const cardReading = factorDisplayText({ kind: 'factor', label: LABEL, observedState: OLUMIS })
    expect(cardReading, 'PRECONDITION: the card reads a figure').toBeTruthy()
    expect(within(s).getByTestId('inspector-examine-value').textContent).toBe(cardReading)
    expect(within(s).getByTestId('inspector-examine-origin').textContent).toBe(VALUE_PROVENANCE_LABEL.ai)
  })

  it('RED: the action PREFILLS the composer with the prepared message and sends nothing', () => {
    seed(ACCEPTED)
    const s = within(open()).getByTestId('inspector-examine')
    fireEvent.click(within(s).getByTestId('inspector-examine-prepare'))
    expect(prefill).toHaveBeenCalledTimes(1)
    expect(String(prefill.mock.calls[0]![0])).toContain(`"${LABEL}"`)
    expect(send).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('⛔ SOUND CONTROL on the mount: the user’s own figure → no section, no warning chrome', () => {
    seed(TYPED)
    const dialog = open()
    expect(within(dialog).queryByTestId('inspector-examine')).toBeNull()
    expect(within(dialog).getAllByText(LABEL).length, 'PRECONDITION: the inspector opened on the factor').toBeGreaterThan(0)
  })

  it('nothing can receive an ask → the section is hidden, not disabled', () => {
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as never)
    seed(OLUMIS)
    expect(within(open()).queryByTestId('inspector-examine')).toBeNull()
  })
})
