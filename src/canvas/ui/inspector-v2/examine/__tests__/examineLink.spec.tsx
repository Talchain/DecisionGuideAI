/**
 * ⭐ EXAMINE THIS LINK (slice 1, 52f8cd) — the view's bases, the sound-link control, and the mounted section's one
 * action: it PREFILLS the composer and sends nothing. The mounted rows go through the deployed chain
 * (`InspectorModal` → `InspectorRouter`'s edge branch), never the component alone (#2380's lesson).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, within, fireEvent } from '@testing-library/react'

import { InspectorModal } from '../../../../components/InspectorModal'
import { useCanvasStore } from '../../../../store'
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

  it('the prepared message names both ends and the band, asks what it rests on — never for Olumi to choose', () => {
    const t = view(OLUMIS)!.prepare.text
    expect(t).toContain('"Warm hours"')
    expect(t).toContain('"Qualified conversations"')
    expect(t).toContain(SLIGHT.toLowerCase())
    expect(t).toMatch(/What is it based on/)
    expect(t).not.toMatch(/suggest|propose|\bmy\b/i)
  })
})

function seed(edgeData: Record<string, unknown>) {
  useCanvasStore.setState({
    nodes: [
      { id: 'f_warm', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Warm hours', category: 'controllable' } },
      { id: 'o_conv', type: 'outcome', position: { x: 200, y: 0 }, data: { kind: 'outcome', label: 'Qualified conversations' } },
    ] as never[],
    edges: [{ id: 'e1', source: 'f_warm', target: 'o_conv', data: edgeData }] as never[],
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

describe('the mounted section (InspectorModal → InspectorRouter edge branch)', () => {
  const prefill = vi.fn()
  const send = vi.fn()
  const dispatch = vi.fn()
  beforeEach(() => {
    vi.clearAllMocks()
    useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: send, _dispatchAction: dispatch } as never)
  })

  it('RED: Olumi’s link shows the section with the band and the basis', () => {
    seed(OLUMIS)
    const s = within(open()).getByTestId('inspector-examine-link')
    expect(s.getAttribute('data-basis')).toBe('olumi_estimate')
    expect(within(s).getByTestId('inspector-examine-link-value').textContent).toBe(SLIGHT)
  })

  it('RED: the action PREFILLS the composer with the prepared message and sends nothing', () => {
    seed(PLACEHOLDER)
    const s = within(open()).getByTestId('inspector-examine-link')
    fireEvent.click(within(s).getByTestId('inspector-examine-link-prepare'))
    expect(prefill).toHaveBeenCalledTimes(1)
    expect(String(prefill.mock.calls[0]![0])).toContain('"Qualified conversations"')
    expect(send).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
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
