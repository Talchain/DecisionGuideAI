/**
 * V7GuidanceSection — V7 Lane L6 pins for "What to do next" (spec rows 8 + 9).
 *
 * Pins: nothing renders with no items; the category badge is an OUTLINED
 * complete-border pill (never a border-l accent); one item shows open and the
 * rest are counted behind a toggle; each action type renders its honest
 * affordance; an unknown action type renders NO affordance (fail closed);
 * ordering follows the canonical severity-major doctrine.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { V7GuidanceSection } from '../V7GuidanceSection'
import { useGuidanceStore, type GuidanceItem } from '../../../../canvas/stores/guidanceStore'
import { useAskOlumiStore } from '../../coaching/askOlumiStore'

function item(partial: Partial<GuidanceItem> & { item_id: string }): GuidanceItem {
  return {
    source: 'analysis',
    title: partial.item_id,
    primary_action: { type: 'discuss', prompt: 'Tell me more' },
    priority: 50,
    ...partial,
  } as GuidanceItem
}

beforeEach(() => {
  useGuidanceStore.getState().clearGuidanceItems()
  useAskOlumiStore.getState().close()
})

describe('V7GuidanceSection (V7 L6)', () => {
  it('renders nothing when there are no guidance items', () => {
    const { container } = render(<V7GuidanceSection />)
    expect(container.firstChild).toBeNull()
  })

  it('renders an OUTLINED category badge, never a one-sided border accent', () => {
    useGuidanceStore.getState().setGuidanceItems([
      item({ item_id: 'g1', category: 'must_fix', title: 'Fix the goal' }),
    ])
    render(<V7GuidanceSection />)
    const badge = screen.getByTestId('v7-guidance-badge')
    expect(badge).toHaveTextContent('Must fix')
    expect(badge.className).toContain('border-danger/30')
    expect(badge.className).not.toMatch(/border-[lrtb]-/)
  })

  it('suppresses the badge when the producer sent no category', () => {
    useGuidanceStore.getState().setGuidanceItems([item({ item_id: 'g1', title: 'No category' })])
    render(<V7GuidanceSection />)
    expect(screen.queryByTestId('v7-guidance-badge')).toBeNull()
  })

  it('shows one item open and counts the rest behind a toggle', () => {
    useGuidanceStore.getState().setGuidanceItems([
      item({ item_id: 'a', category: 'must_fix', title: 'First' }),
      item({ item_id: 'b', category: 'should_fix', title: 'Second' }),
      item({ item_id: 'c', category: 'could_fix', title: 'Third' }),
    ])
    render(<V7GuidanceSection />)
    // Top item visible; the other two hidden until the toggle is used.
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.queryByText('Second')).toBeNull()
    const toggle = screen.getByTestId('v7-guidance-toggle')
    expect(toggle).toHaveTextContent('Show 2 more')
    fireEvent.click(toggle)
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(screen.getByText('Third')).toBeInTheDocument()
  })

  it('orders by severity major (must_fix first) regardless of wire order', () => {
    useGuidanceStore.getState().setGuidanceItems([
      item({ item_id: 'tech', category: 'technique', title: 'Technique item' }),
      item({ item_id: 'must', category: 'must_fix', title: 'Must item' }),
    ])
    render(<V7GuidanceSection />)
    // must_fix is the single open item; the technique item is behind the toggle.
    expect(screen.getByText('Must item')).toBeInTheDocument()
    expect(screen.queryByText('Technique item')).toBeNull()
  })

  it('maps discuss → Work through it (opens the drawer)', () => {
    useGuidanceStore.getState().setGuidanceItems([
      item({ item_id: 'g1', primary_action: { type: 'discuss', prompt: 'What if demand drops?' } }),
    ])
    render(<V7GuidanceSection />)
    fireEvent.click(screen.getByTestId('v7-guidance-action-work-through'))
    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)
    expect(drawer.draft).toBe('What if demand drops?')
  })

  it('maps open_inspector → Focus and run_exercise → Try …', () => {
    const onFocusNode = vi.fn()
    const onSendMessage = vi.fn()
    useGuidanceStore.getState().setGuidanceItems([
      item({ item_id: 'g1', category: 'must_fix', primary_action: { type: 'open_inspector', node_id: 'node-9' } }),
      item({ item_id: 'g2', category: 'could_fix', primary_action: { type: 'run_exercise', exercise: 'pre_mortem' } }),
    ])
    render(<V7GuidanceSection onFocusNode={onFocusNode} onSendMessage={onSendMessage} />)
    fireEvent.click(screen.getByTestId('v7-guidance-action-focus'))
    expect(onFocusNode).toHaveBeenCalledWith('node-9')
    fireEvent.click(screen.getByTestId('v7-guidance-toggle'))
    fireEvent.click(screen.getByTestId('v7-guidance-action-run-exercise'))
    expect(onSendMessage).toHaveBeenCalledWith('/exercise pre_mortem')
  })

  it('renders NO affordance for an unknown action type (fail closed)', () => {
    const rogue = { type: 'delete_everything', target: 'x' } as unknown as GuidanceItem['primary_action']
    useGuidanceStore.getState().setGuidanceItems([item({ item_id: 'g1', title: 'Rogue', primary_action: rogue })])
    render(<V7GuidanceSection />)
    expect(screen.getByText('Rogue')).toBeInTheDocument()
    expect(screen.queryByTestId('v7-guidance-action-focus')).toBeNull()
    expect(screen.queryByTestId('v7-guidance-action-work-through')).toBeNull()
    expect(screen.queryByTestId('v7-guidance-action-run-exercise')).toBeNull()
  })
})
