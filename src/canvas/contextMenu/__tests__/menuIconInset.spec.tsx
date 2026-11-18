/**
 * A context-menu row with no icon keeps the left inset of an iconed row (Paul, 18 Nov: icons "aligned properly"): the words line up down the menu.
 * The icon is the registry's (`iconId`), 16 px, and the submenu arrow is the registry's chevron.
 */
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { CanvasContextMenuBase } from '../CanvasContextMenu'
import type { MenuEntry, PaneTarget } from '../types'

vi.mock('../../ToastContext', () => ({ useShowToast: () => vi.fn(), useShowToastSafe: () => vi.fn() }))
vi.mock('../../store', () => {
  const mockState = { clipboard: null, nodes: [], edges: [], selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null }, results: { status: 'idle', report: null } }
  const mockStore = vi.fn((selector: any) => selector(mockState))
  ;(mockStore as any).getState = () => mockState
  ;(mockStore as any).setState = () => {}
  return { useCanvasStore: mockStore, selectResultsStatus: (s: any) => s.results.status, selectReport: (s: any) => s.results.report }
})
vi.mock('../../stores/guidanceStore', async (importOriginal) => ({ ...(await importOriginal<object>()), useGuidanceStore: { getState: () => ({ _sendMessage: null }) } }))

const target: PaneTarget = { kind: 'pane', screenPos: { x: 10, y: 10 } }
const row = (id: string, extra: Partial<Extract<MenuEntry, { id: string }>> = {}): MenuEntry => ({ id, label: id, tooltip: id, enabled: true, action: () => undefined, ...extra }) as MenuEntry

describe('lane context menu icons', () => {
  it('an iconless row has the 16 px inset an iconed row\'s icon takes, and the iconed row draws the registry icon at 16 with the one stroke', () => {
    const items: MenuEntry[] = [row('with-icon', { iconId: 'add' }), row('without-icon'), row('with-submenu', { iconId: 'olumi-mark', hasSubmenu: true, submenuItems: [] })]
    render(<CanvasContextMenuBase target={target} onClose={vi.fn()} screenToFlowPosition={(p: any) => p} useItems={() => ({ items, overlay: null }) as never} />)
    const labelOf = (id: string) => document.querySelector(`[data-menu-label="${id}"]`) as HTMLElement
    const lead = (id: string) => labelOf(id).previousElementSibling as HTMLElement
    expect(lead('with-icon').querySelector('svg')?.getAttribute('width')).toBe('16')
    expect(lead('with-icon').querySelector('svg')?.getAttribute('stroke-width')).toBe('1.75')
    expect(lead('without-icon')).toHaveClass('w-4', 'h-4', 'shrink-0')
    expect(lead('with-icon').getBoundingClientRect === undefined).toBe(false)
    expect(screen.getAllByRole('menuitem').length).toBe(3)
    const arrow = labelOf('with-submenu').closest('button')!.querySelector('svg.lucide-chevron-right')
    expect(arrow?.getAttribute('stroke-width')).toBe('1.75')
    expect(lead('with-submenu').querySelector('svg')?.getAttribute('data-icon')).toBe('olumi-ai')
  })
})
