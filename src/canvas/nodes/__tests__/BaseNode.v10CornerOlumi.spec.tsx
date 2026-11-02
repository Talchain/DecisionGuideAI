/**
 * v10 (#/canvas2), Paul 24 Oct ruling 3: the Olumi icon sits in the BOTTOM-RIGHT CORNER of every card, as a badge over
 * the card edge, and no longer in the bottom rail. #/canvas (the current presentation) is unchanged: its rail keeps the
 * door and no corner badge mounts.
 *
 * Every assertion binds by IDENTITY (the card's own testids), and each block carries the CONTRAST case: the same card in
 * the other presentation, which must show the opposite.
 */
import type { ComponentProps } from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { MemoryRouter } from 'react-router-dom'
import { Circle } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseNode } from '../BaseNode'
import { useCanvasStore } from '../../store'
import { useGuidanceStore, type GuidanceItem } from '../../stores/guidanceStore'
import { PresentationProvider } from '../../../presentation/v10'
import type { AttentionReason } from '../shared/nodeAttention'

let attentionMarked = false
const REASON = { kind: 'fragile_link', order: 1, label: 'The comparison depends on a link from here. How sure are you of it?' } as unknown as AttentionReason
vi.mock('../shared/useNodeAttention', () => ({
  useNodeAttention: vi.fn(() =>
    attentionMarked
      ? { reasons: [REASON], marked: true, markedCount: 1, candidateCount: 1 }
      : { reasons: [], marked: false, markedCount: 0, candidateCount: 0 },
  ),
}))

type Kind = 'option' | 'factor' | 'goal' | 'risk' | 'outcome'
const KINDS: Kind[] = ['option', 'factor', 'goal', 'risk', 'outcome']

function renderCard(kind: Kind, opts: { v10: boolean; selected?: boolean; label?: string; onPointerDownOutside?: () => void }) {
  const label = opts.label ?? `The ${kind} card`
  const props = {
    id: `n-${kind}`,
    type: kind,
    position: { x: 0, y: 0 },
    selected: opts.selected ?? false,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    dragging: false,
    zIndex: 0,
    data: { type: kind, label },
  }
  useCanvasStore.setState({ nodes: [props] as never, edges: [] })
  const card = (
    <ReactFlowProvider>
      <div onPointerDown={opts.onPointerDownOutside}>
        <BaseNode {...(props as unknown as ComponentProps<typeof BaseNode>)} nodeType={kind} icon={Circle} />
      </div>
    </ReactFlowProvider>
  )
  const view = render(
    <MemoryRouter>{opts.v10 ? <PresentationProvider value="v10">{card}</PresentationProvider> : card}</MemoryRouter>,
  )
  const root = view.container.querySelector('[role="group"]') as HTMLElement
  expect(root, `card root for ${kind} must render`).not.toBeNull()
  return { root, id: props.id, label }
}

function guidance(targetId: string): GuidanceItem {
  return {
    item_id: `g-${targetId}`,
    category: 'should_fix',
    source: 'structural',
    title: 'Review this node',
    priority: 50,
    primary_action: { type: 'discuss', prompt: 'Let us discuss.' },
    target_object: { type: 'node', id: targetId },
  } as GuidanceItem
}

const prefill = vi.fn()
const tokens = (el: Element | null | undefined) => (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)

beforeEach(() => {
  attentionMarked = false
  prefill.mockReset()
  useGuidanceStore.getState().clearGuidanceItems()
  useGuidanceStore.setState({ _prefillChat: prefill, _sendMessage: () => {}, _dispatchAction: () => {} } as never)
  useCanvasStore.setState({ nodes: [], edges: [], lodRung: 'full' } as never)
})
afterEach(() => cleanup())

describe.each(KINDS)('v10 — the %s card has the Olumi icon in its bottom-right corner, not in the rail', (kind) => {
  it('is a badge on the card, over its bottom-right edge: white circle, 1px border, small shadow', () => {
    const { root, id } = renderCard(kind, { v10: true })
    const badge = within(root).getByTestId(`node-corner-olumi-${id}`)
    expect(root.contains(badge)).toBe(true)
    expect(badge.parentElement).toBe(root)
    expect(tokens(badge)).toEqual(expect.arrayContaining(['absolute', 'rounded-full', 'border', 'bg-panel', 'shadow-1']))
    // Hangs over the edge: a NEGATIVE right and bottom offset, counter-scaled with the glyphs.
    const { right, bottom } = (badge as HTMLElement).style
    expect(right).toMatch(/^calc\(-\d+px \* var\(--canvas-glyph-scale, 1\)\)$/)
    expect(bottom).toMatch(/^calc\(-\d+px \* var\(--canvas-glyph-scale, 1\)\)$/)
  })

  it('is not in the bottom rail, and the rail draws no second Olumi door', () => {
    const { root, id } = renderCard(kind, { v10: true })
    const rail = within(root).getByTestId(`node-card-rail-${id}`)
    expect(rail.contains(within(root).getByTestId(`node-corner-olumi-${id}`))).toBe(false)
    expect(within(rail).queryByTestId(`node-olumi-door-${id}`)).toBeNull()
    expect(within(rail).queryByTestId(`node-coaching-icon-${id}`)).toBeNull()
    expect(within(rail).queryByTestId(`node-action-ask-${id}`)).toBeNull()
    // The card carries exactly one Olumi ask.
    expect(root.querySelectorAll(`[data-testid="node-corner-olumi-${id}"], [data-testid="node-coaching-icon-${id}"], [data-testid="node-action-ask-${id}"]`)).toHaveLength(1)
  })

  it('CONTRAST — the current presentation keeps the door in the rail and mounts no corner badge', () => {
    const { root, id } = renderCard(kind, { v10: false })
    const rail = within(root).getByTestId(`node-card-rail-${id}`)
    expect(within(rail).getByTestId(`node-olumi-door-${id}`)).toBeTruthy()
    expect(within(rail).getByTestId(`node-coaching-icon-${id}`)).toBeTruthy()
    expect(within(root).queryByTestId(`node-corner-olumi-${id}`)).toBeNull()
  })
})

describe('v10 — when the corner icon shows', () => {
  it('at rest on a card with no note it is hidden (and cannot be hit), but appears on hover and keyboard focus', () => {
    const { root, id } = renderCard('factor', { v10: true })
    const badge = within(root).getByTestId(`node-corner-olumi-${id}`)
    expect(badge.getAttribute('data-corner-at-rest')).toBe('false')
    const t = tokens(badge)
    expect(t).toContain('opacity-0')
    expect(t).toContain('pointer-events-none')
    expect(t).toContain('group-hover:opacity-100')
    expect(t).toContain('group-hover:pointer-events-auto')
    expect(t).toContain('group-focus-within:opacity-100')
    expect(t).toContain('group-focus-within:pointer-events-auto')
    // The card is the `group` those variants key off.
    expect(tokens(root)).toContain('group')
  })

  it('stays visible while the card is selected', () => {
    const { root, id } = renderCard('factor', { v10: true, selected: true })
    const badge = within(root).getByTestId(`node-corner-olumi-${id}`)
    expect(badge.getAttribute('data-corner-at-rest')).toBe('true')
    expect(tokens(badge)).toContain('opacity-100')
    expect(tokens(badge)).not.toContain('opacity-0')
  })

  it('is visible at rest where a guidance item names this card', () => {
    useGuidanceStore.setState({ guidanceItems: [guidance('n-risk')] } as never)
    const { root, id } = renderCard('risk', { v10: true })
    const badge = within(root).getByTestId(`node-corner-olumi-${id}`)
    expect(badge.getAttribute('data-corner-at-rest')).toBe('true')
    expect(tokens(badge)).toContain('opacity-100')
  })

  it('is visible at rest where the board has an attention reason for this card', () => {
    attentionMarked = true
    const { root, id } = renderCard('option', { v10: true })
    expect(within(root).getByTestId(`node-corner-olumi-${id}`).getAttribute('data-corner-at-rest')).toBe('true')
  })

  it('CONTRAST — a guidance item for ANOTHER card does not light this one', () => {
    useGuidanceStore.setState({ guidanceItems: [guidance('some-other-node')] } as never)
    const { root, id } = renderCard('factor', { v10: true })
    expect(within(root).getByTestId(`node-corner-olumi-${id}`).getAttribute('data-corner-at-rest')).toBe('false')
  })
})

describe('v10 — the corner icon is a real control', () => {
  it('is named and tooltipped "Ask Olumi about <card>", keyboard reachable, with a visible focus ring', () => {
    const { root, id } = renderCard('option', { v10: true, label: 'Hire two engineers' })
    const badge = within(root).getByTestId(`node-corner-olumi-${id}`) as HTMLButtonElement
    expect(badge.tagName).toBe('BUTTON')
    expect(badge.getAttribute('aria-label')).toBe('Ask Olumi about Hire two engineers')
    expect(badge.tabIndex).toBeGreaterThanOrEqual(0)
    expect(tokens(badge)).toContain('focus-visible:ring-2')
    expect(tokens(badge)).toContain('focus-visible:ring-info')
    badge.focus()
    expect(document.activeElement).toBe(badge)
  })

  it('a click fills the composer with "About <card>: " and does not bubble to React Flow; a pointer-down does not either', () => {
    const outside = vi.fn()
    const { root, id } = renderCard('option', { v10: true, label: 'Hire two engineers', onPointerDownOutside: outside })
    const badge = within(root).getByTestId(`node-corner-olumi-${id}`)
    fireEvent.pointerDown(badge)
    expect(outside).not.toHaveBeenCalled()
    fireEvent.click(badge)
    expect(prefill).toHaveBeenCalledTimes(1)
    // `requestAsk` trims the draft, so the composer receives "About <card>:" (slice 1's click behaves the same way).
    expect(prefill).toHaveBeenCalledWith(expect.stringMatching(/^About Hire two engineers:\s*$/))
  })

  it('mounts nothing when no conversation can receive the prompt (never a dead control)', () => {
    useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as never)
    const { root, id } = renderCard('goal', { v10: true })
    expect(within(root).queryByTestId(`node-corner-olumi-${id}`)).toBeNull()
  })
})

// A rendered screen read, so the string is also what a person finds.
it('names the card in the accessible tree', () => {
  renderCard('goal', { v10: true, label: 'Reach 50 customers' })
  expect(screen.getByRole('button', { name: 'Ask Olumi about Reach 50 customers' })).toBeTruthy()
})
