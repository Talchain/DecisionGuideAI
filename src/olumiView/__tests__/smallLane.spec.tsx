/**
 * S4 lane "small" (19 Nov 2026). Green actions: the figure editor's filled press is the lane's green (VIEW_CHIP_PRIMARY_CLASS), never the
 * older look's blue (`bg-primary`). Talk-first icon: the composer's "Talk it through first" keeps MessageSquare; Reasoning's fill-the-box
 * press has its own registry id (`fill-box`) and glyph.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { ViewReasoningBlock } from '../ViewReasoning'
import { ICONS } from '../look/icons'
import { useMe } from '../../olumiCore/me'

beforeEach(() => { vi.stubEnv('VITE_OLUMI_CORE', '0') })
afterEach(() => { cleanup(); vi.unstubAllEnvs(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }); useMe.setState({ me: null, status: 'none' }) })

const classes = (e: Element) => e.className.toString().split(/\s+/)

describe('the figure editor\'s filled press is green', () => {
  const SID = 's_0123456789ab'
  const view: View = { ...JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'european-22cards.view3.json'), 'utf8')), id: SID }
  const card = view.model!.cards.find((c) => c.figure?.edit)!
  const open = () => {
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view, status: 'ready', error: null, stale: false })
    useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
    render(<ViewCard card={card} />)
    fireEvent.click(screen.getByTestId(`view-figure-edit-${card.id}`))
    fireEvent.change(screen.getByTestId(`view-figure-typed-${card.id}`), { target: { value: '150 to 400' } })
  }
  it('SM1 catch: Set figure is bg-success, never bg-primary', () => {
    open()
    const set = classes(screen.getByTestId(`view-figure-set-${card.id}`))
    expect(set).toContain('bg-success')
    expect(set).not.toContain('bg-primary')
  })
  it('SM1 CONTRAST: the other presses in the editor are not filled (one filled control)', () => {
    open()
    for (const id of ['try', 'set']) {
      const cls = classes(screen.getByTestId(`view-figure-${id}-${card.id}`))
      expect(cls.includes('bg-success'), id).toBe(id === 'set')
    }
    expect(classes(screen.getByTestId(`view-figure-try-${card.id}`))).not.toContain('bg-primary')
  })
})

describe('Reasoning\'s fill-the-box press has its own icon', () => {
  const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'app-launch.view.json'), 'utf8'))
  it('SM4 catch: the registry gives fill-box a glyph of its own, not talk-first\'s', () => {
    expect(ICONS['fill-box'].Icon).not.toBe(ICONS['talk-first'].Icon)
    expect(ICONS['fill-box'].hover).toBe('Put this in the message box')
  })
  it('SM4 the question rows draw the fill-box glyph; CONTRAST: none draws the message-square (talk-first) glyph', () => {
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false } as never)
    useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
    const { container } = render(<ViewReasoningBlock />)
    const more = document.querySelector('[data-check-more="examine"]'); if (more !== null) fireEvent.click(more)
    const rows = document.querySelectorAll('[data-check-item^="q:"]')
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      fireEvent.click(r)
      const action = screen.getByRole('button', { name: 'Put this in the message box' })
      expect(action.querySelector('svg')!.getAttribute('class')).toContain('lucide-text-cursor-input')
    }
    expect(container.querySelector('svg.lucide-message-square')).toBeNull()
  })
})
