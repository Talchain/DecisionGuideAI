/**
 * v10 on the mounted core-lane canvas (Codex review dgai-v10 00002 #2): ViewCanvas itself draws every View card through v10's wrapper
 * (its Olumi corner and driver badge) and carries v10's rulings attribute while it is up. The dock and the attention card are left out
 * (they are not v10's and need the whole app), so this binds the canvas's own wiring, not what lives beside it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, render } from '@testing-library/react'
import type { View } from '../client'
import { currentModel } from '../store'
import { useCanvasStore } from '../../canvas/store'
import { drawViewCanvas } from '../canvas'
import { ViewCanvas } from '../ViewCanvas'

vi.mock('../../canvas/components/OutputsDock', () => ({ OutputsDock: () => null }))
vi.mock('../../canvas/components/OlumiAttentionCard', () => ({ OlumiAttentionCard: () => null }))
vi.mock('../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => true }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

const golden = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8'))
afterEach(() => { useCanvasStore.setState({ nodes: [], edges: [] }) })

describe('the mounted core-lane canvas', () => {
  it('draws every View card through v10\'s wrapper, with the driver badge where core gives one, and carries v10\'s rulings while it is up', async () => {
    const model = currentModel({ view: golden('bakery'), error: null, stale: false })!
    act(() => { drawViewCanvas(model) })
    const { container, unmount } = render(<div style={{ width: 1440, height: 900 }}><ViewCanvas /></div>)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(document.documentElement.dataset['presentation']).toBe('v10')
    const wrapped = [...container.querySelectorAll('[data-testid="view-card-v10"]')]
    expect(wrapped.length).toBe(model.cards.length)
    const withDriver = model.cards.filter((c) => c.driver !== null).map((c) => c.id).sort()
    expect([...container.querySelectorAll('[data-testid^="view-driver-"]')].map((e) => e.getAttribute('data-testid')!.slice('view-driver-'.length)).sort()).toEqual(withDriver)
    unmount()
    expect(document.documentElement.dataset['presentation']).toBeUndefined()
  })
})
