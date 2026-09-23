/**
 * NodeCoachingIcon — ONE coaching affordance per card, bound to the resolver.
 *
 * Locked Experience Design (Paul, 23 Sep 2026): the permanent coaching chip
 * rows on the card surface become ONE consistent icon. Its hover/focus tooltip
 * is the card's top coaching question, and its click opens the AI with THIS
 * node in context and that question pre-filled — through the EXISTING ask seam
 * (`requestAsk`), never a new AI path.
 *
 * What this file pins, each against a named seam rather than a copy of it:
 *
 *  · THE QUESTION IS THE RESOLVER'S FIRST CHIP, BY IDENTITY. The expectation is
 *    computed by calling the real `resolveNodeCoaching`, and the fixture is a
 *    TWO-chip resolution, so "the first" is discriminated from "any".
 *  · THE CLICK PRE-FILLS, IT NEVER SENDS. `requestAsk` is spied through a
 *    pass-through mock, so its real routing still runs and the drawer store is
 *    read back — while `_dispatchAction` is asserted NOT called.
 *  · THE NODE IS IN CONTEXT: selected BEFORE the ask (the NodeQuickActions
 *    ordering), and named as the drawer's `targetId`.
 *  · PRODUCER FIRST. A live guidance item naming THIS node silences the icon
 *    (its voice is BaseNode's `NodeCoachingMarker`); one naming ANOTHER node
 *    does not — the contrast that proves the yield is bound to identity.
 *  · NO SURFACE, NO AFFORDANCE — `askSemantic`'s own rule.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { NodeCoachingIcon, NODE_COACHING_ICON_TESTID_PREFIX } from '../NodeCoachingIcon'
import { resolveNodeCoaching } from '../../coaching/resolveNodeCoaching'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { useAskOlumiStore } from '../../../../components/results/coaching/askOlumiStore'
import { requestAsk } from '../../../ui/inspector-v2/askSemantic'

const hoisted = vi.hoisted(() => ({ select: vi.fn() }))

vi.mock('../../../store', () => ({
  useCanvasStore: Object.assign(vi.fn(), {
    getState: () => ({ selectNodeWithoutHistory: hoisted.select }),
  }),
}))

// Pass-through spy: the REAL routing runs, so the drawer state below is a real
// effect of the real seam — the spy only records that the seam was the one used.
vi.mock('../../../ui/inspector-v2/askSemantic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../ui/inspector-v2/askSemantic')>()
  return { ...actual, requestAsk: vi.fn(actual.requestAsk) }
})

const NODE_ID = 'risk-7'

/** A TWO-chip card resolution: an unsized risk asks two questions on its face. */
const TWO_CHIPS = resolveNodeCoaching({
  kind: 'risk',
  surface: 'card',
  state: { exposureUnstated: true },
  context: { label: 'Key person dependency', riskContext: '' },
})

const dispatch = vi.fn()

function resetStores() {
  useGuidanceStore.setState({
    guidanceItems: [],
    _dispatchAction: dispatch,
    _sendMessage: null,
    _prefillChat: null,
  } as never)
  useAskOlumiStore.setState({ isOpen: false, draft: '', targetId: null, parameters: undefined } as never)
}

const iconFor = (container: HTMLElement, nodeId = NODE_ID) =>
  container.querySelector(`[data-testid="${NODE_COACHING_ICON_TESTID_PREFIX}${nodeId}"]`)

describe('NodeCoachingIcon', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStores()
  })
  afterEach(() => cleanup())

  it('fixture precondition: the resolution really carries two DIFFERENT questions', () => {
    // Without this, "the first chip" and "any chip" are indistinguishable and
    // the identity assertions below could not fail on the wrong one.
    expect(TWO_CHIPS).not.toBeNull()
    expect(TWO_CHIPS!.length).toBe(2)
    expect(TWO_CHIPS![0].label).not.toBe(TWO_CHIPS![1].label)
  })

  it('renders nothing when the resolver chose silence', () => {
    const { container } = render(<NodeCoachingIcon nodeId={NODE_ID} chips={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('its accessible name is the FIRST chip of the resolution, by identity', () => {
    const { container } = render(<NodeCoachingIcon nodeId={NODE_ID} chips={TWO_CHIPS} />)
    const icon = iconFor(container) as HTMLElement
    expect(icon).not.toBeNull()
    expect(icon.tagName).toBe('BUTTON')
    expect(icon.getAttribute('aria-label')).toBe(TWO_CHIPS![0].label)
    expect(icon.getAttribute('data-coaching-chip-id')).toBe(TWO_CHIPS![0].id)
    // ⛔ And NOT the second — the discriminating half.
    expect(icon.getAttribute('aria-label')).not.toBe(TWO_CHIPS![1].label)
  })

  it('it is an ICON — a Lucide glyph, no painted text, no emoji', () => {
    const { container } = render(<NodeCoachingIcon nodeId={NODE_ID} chips={TWO_CHIPS} />)
    const icon = iconFor(container) as HTMLElement
    expect(icon.querySelector('svg')).not.toBeNull()
    expect((icon.textContent ?? '').trim()).toBe('')
    // Neither chip's label is painted anywhere at rest.
    for (const chip of TWO_CHIPS!) expect(screen.queryByText(chip.label)).toBeNull()
  })

  it('its tooltip, on focus, states the same question', () => {
    const { container } = render(<NodeCoachingIcon nodeId={NODE_ID} chips={TWO_CHIPS} />)
    const icon = iconFor(container) as HTMLElement
    act(() => { icon.focus() })
    expect(screen.getByRole('tooltip').textContent).toContain(TWO_CHIPS![0].label)
  })

  it('the node preview yields to its tooltip (the usePopoverHover action rule)', () => {
    const { container } = render(<NodeCoachingIcon nodeId={NODE_ID} chips={TWO_CHIPS} />)
    const icon = iconFor(container) as HTMLElement
    expect(icon.closest('[data-node-tooltip]')).not.toBeNull()
  })

  it('click: selects THIS node, then pre-fills the question through requestAsk — and sends nothing', () => {
    const { container } = render(<NodeCoachingIcon nodeId={NODE_ID} chips={TWO_CHIPS} />)
    fireEvent.click(iconFor(container) as HTMLElement)

    expect(requestAsk).toHaveBeenCalledTimes(1)
    expect(vi.mocked(requestAsk).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        text: TWO_CHIPS![0].message,
        label: TWO_CHIPS![0].label,
        targetId: NODE_ID,
        parameters: { chip_id: TWO_CHIPS![0].id },
      }),
    )
    // Node in context: selected, and selected FIRST.
    expect(hoisted.select).toHaveBeenCalledWith(NODE_ID)
    expect(hoisted.select.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(requestAsk).mock.invocationCallOrder[0],
    )
    // The real seam's real effect: an editable draft, targeted at this node.
    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)
    expect(drawer.draft).toBe(TWO_CHIPS![0].message)
    expect(drawer.targetId).toBe(NODE_ID)
    // ⛔ Prefill-and-confirm: nothing is dispatched on the user's behalf.
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('with NO ask surface registered the icon does not render — it must not pretend', () => {
    useGuidanceStore.setState({ _dispatchAction: null, _sendMessage: null, _prefillChat: null } as never)
    const { container } = render(<NodeCoachingIcon nodeId={NODE_ID} chips={TWO_CHIPS} />)
    expect(iconFor(container)).toBeNull()
  })

  it('PRODUCER FIRST: a live guidance item naming THIS node silences the local question', () => {
    useGuidanceStore.setState({
      guidanceItems: [{ item_id: 'g1', source: 'cee', title: 'Anchoring', target_object: { type: 'node', id: NODE_ID } }],
    } as never)
    const { container } = render(<NodeCoachingIcon nodeId={NODE_ID} chips={TWO_CHIPS} />)
    expect(iconFor(container)).toBeNull()
  })

  it('CONTRAST: guidance naming ANOTHER node leaves the icon in place', () => {
    useGuidanceStore.setState({
      guidanceItems: [{ item_id: 'g1', source: 'cee', title: 'Anchoring', target_object: { type: 'node', id: 'some-other-node' } }],
    } as never)
    const { container } = render(<NodeCoachingIcon nodeId={NODE_ID} chips={TWO_CHIPS} />)
    expect(iconFor(container)).not.toBeNull()
  })
})
