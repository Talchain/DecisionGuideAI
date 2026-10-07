/**
 * ⭐ EXAMINE THIS LINK (slice 1, 52f8cd) — the view's bases, the sound-link control, and the mounted section's one
 * action: it PREFILLS the composer and sends nothing. The mounted rows go through the deployed chain
 * (`InspectorModal` → `InspectorRouter`'s edge branch), never the component alone (#2380's lesson).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, within, fireEvent } from '@testing-library/react'

import { InspectorModal } from '../../../../components/InspectorModal'
import { useCanvasStore } from '../../../../store'
import { buildV5Payload } from '../../../../../v5/buildPayload'
import { useGuidanceStore } from '../../../../stores/guidanceStore'
import { getStrengthLabel } from '../../../../domain/vocabulary'
import { buildExamineLinkView, EXAMINE_LINK_WHY } from '../examineLinkView'

vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

const OLUMIS = { weight: 0.2, weightSource: 'cee' }
const PLACEHOLDER = { weight: 0.2, weightSource: 'cee', strengthPlaceholder: 0.2 }
const USERS = { weight: 0.55, weightSource: 'user' }
const SLIGHT = getStrengthLabel(0.2)

const view = (data: Record<string, unknown> | undefined, opts: { structural?: boolean; fragile?: boolean } = {}) =>
  buildExamineLinkView({ sourceLabel: 'Warm hours', targetLabel: 'Qualified conversations', data, structural: opts.structural ?? false, fragile: opts.fragile ?? false })

describe('the view: an explicit basis, or nothing', () => {
  it('Olumi’s strength is worth examining because it is Olumi’s — said as a band word, never a number', () => {
    const v = view(OLUMIS)!
    expect(v.basis).toBe('olumi_estimate')
    expect(v.why).toBe(EXAMINE_LINK_WHY.olumi_estimate)
    expect(v.value).toBe(SLIGHT)
    expect(`${v.value} ${v.why} ${v.prepare.text}`).not.toMatch(/0\.\d|\d%/)
  })

  it('a starting strength Olumi has not sized says so (the canvas’s own placeholder predicate)', () => {
    const v = view(PLACEHOLDER)!
    expect(v.basis).toBe('placeholder')
    expect(v.why).toBe(EXAMINE_LINK_WHY.placeholder)
  })

  it('the user’s own link the last Run found fragile is worth examining on the analysis basis', () => {
    const v = view(USERS, { fragile: true })!
    expect(v.basis).toBe('analysis')
    expect(v.why).toBe(EXAMINE_LINK_WHY.analysis)
  })

  it('⛔ SOUND CONTROL: the user’s own link with nothing flagged, a structural link, or no strength → no section', () => {
    expect(view(USERS)).toBeNull()
    expect(view(OLUMIS, { structural: true }), 'organisational wiring is not a belief to examine').toBeNull()
    expect(view({}), 'no stated strength: the panel’s own notice covers it').toBeNull()
    expect(view(undefined)).toBeNull()
  })

  it('⛔ the why line never claims the user has not confirmed it (the UI holds no link review marker)', () => {
    for (const w of Object.values(EXAMINE_LINK_WHY)) expect(w).not.toMatch(/haven.t confirmed|not confirmed/i)
  })

  it('the question on the wire names its target, asks about its basis, and carries no model figure', () => {
    seed(OLUMIS)
    const sent = captureWire()
    const dialog = open()
    fireEvent.click(within(dialog).getByTestId('inspector-examine-link-prepare'))
    const payload = sent()[0]
    expect(payload.message).toBe('Why would ‘Warm hours’ change ‘Qualified conversations’, and how sure are we?')
    expect(payload.message).not.toMatch(/currently|30%|0\.\d|suggest|propose|\bmy assumption\b/i)
    expect(payload.selected_elements).toEqual([expect.objectContaining({ id: 'f_warm→o_conv', kind: 'edge' })])
    expect(payload.source).toBe('chip')
  })
})

function seed(edgeData: Record<string, unknown>) {
  useCanvasStore.setState({
    nodes: [
      { id: 'f_warm', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Warm hours', category: 'controllable' } },
      { id: 'o_conv', type: 'outcome', position: { x: 200, y: 0 }, data: { kind: 'outcome', label: 'Qualified conversations' } },
    ] as never[],
    edges: [{ id: 'e1', source: 'f_warm', target: 'o_conv', data: edgeData }] as never[],
    hasCompletedFirstRun: false, v5AnalysisFact: null,
    results: { status: 'idle', report: null },
    selection: { nodeIds: new Set(), edgeIds: new Set(['e1']), anchorPosition: { x: 0, y: 0 } },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

function open(): HTMLElement {
  const utils = render(<InspectorModal nodeId={null} edgeId="e1" onClose={vi.fn()} />)
  const dialog = utils.container.querySelector('div[role="dialog"]')
  expect(dialog, 'PRECONDITION: the inspector is mounted').not.toBeNull()
  return dialog as HTMLElement
}

function captureWire() {
  const payloads: Array<{ message: string; source?: string; selected_elements?: unknown }> = []
  useGuidanceStore.setState({ _isConversationBusy: () => false, _dispatchAction: opts => {
    const built = buildV5Payload({ turnId: '11111111-1111-4111-8111-111111111111', scenarioId: '22222222-2222-4222-8222-222222222222', stage: 'analyse', turnClass: 'clarify', mode: 'user', message: opts.message, source: 'chip', chipMeta: { id: opts.id! } })
    expect(built.ok).toBe(true)
    if (built.ok && built.payload.kind === 'message') payloads.push(built.payload)
  } })
  return () => payloads
}

describe('the mounted section (InspectorModal → InspectorRouter edge branch)', () => {
  const prefill = vi.fn()
  const send = vi.fn()
  const dispatch = vi.fn()
  beforeEach(() => {
    vi.clearAllMocks()
    useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: send, _dispatchAction: dispatch, _isConversationBusy: () => false } as never)
  })

  it('RED: Olumi’s link shows the section with the band and the basis', () => {
    seed(OLUMIS)
    const s = within(open()).getByTestId('inspector-examine-link')
    expect(s.getAttribute('data-basis')).toBe('olumi_estimate')
    expect(within(s).getByTestId('inspector-examine-link-value').textContent).toBe(SLIGHT)
  })

  it('RED: the action sends one bound chip with the label and no model figure', () => {
    seed(PLACEHOLDER)
    const s = within(open()).getByTestId('inspector-examine-link')
    fireEvent.click(within(s).getByTestId('inspector-examine-link-prepare'))
    expect(prefill).not.toHaveBeenCalled()
    expect(String(dispatch.mock.calls[0]![0].message)).toBe('Why would ‘Warm hours’ change ‘Qualified conversations’, and how sure are we?')
    expect(dispatch.mock.calls[0][0].message).not.toContain('currently')
    expect(send).not.toHaveBeenCalled()
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch.mock.calls[0][0]).toMatchObject({ source: 'chip' })
  })

  it('⛔ SOUND CONTROL on the mount: the user’s own link → no section, and the inspector still opened on the link', () => {
    seed(USERS)
    const dialog = open()
    expect(within(dialog).queryByTestId('inspector-examine-link')).toBeNull()
    expect(within(dialog).getAllByText(/Warm hours/).length, 'PRECONDITION: the inspector opened on the link').toBeGreaterThan(0)
  })

  it('nothing can receive an ask → the section is hidden, not disabled', () => {
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as never)
    seed(OLUMIS)
    expect(within(open()).queryByTestId('inspector-examine-link')).toBeNull()
  })
})

/**
 * ⭐ ONE OLUMI ACTION PER LINK (gate 5 item 3c, DL 0df0e1, 5 Oct 2026): where "Examine with Olumi" stands, the generic
 * "Explore with Olumi" is left out; where it does not, Explore stays. Bound by the two buttons' own test ids, on the
 * deployed chain (InspectorModal → InspectorRouter).
 */
describe('gate 5 item 3c — Examine replaces the generic Explore on a link', () => {
  beforeEach(() => {
    useGuidanceStore.setState({ _prefillChat: vi.fn(), _sendMessage: vi.fn(), _dispatchAction: vi.fn() } as never)
  })

  it.each([['Olumi’s estimate', OLUMIS], ['a starting strength', PLACEHOLDER]])('%s: Examine is shown and Explore is not', (_n, data) => {
    seed(data)
    const dialog = open()
    expect(within(dialog).getByTestId('inspector-examine-link-prepare').textContent).toBe('Examine with Olumi')
    expect(within(dialog).queryByTestId('inspector-quick-ask')).toBeNull()
    expect(within(dialog).getByTestId('inspector-back-to-conversation'), 'the row itself is still there').toBeTruthy()
  })

  it('CONTROL: the user’s own link (no Examine) keeps "Explore with Olumi"', () => {
    seed(USERS)
    const dialog = open()
    expect(within(dialog).queryByTestId('inspector-examine-link')).toBeNull()
    expect(within(dialog).getByTestId('inspector-quick-ask').textContent).toBe('Explore with Olumi')
  })
})
