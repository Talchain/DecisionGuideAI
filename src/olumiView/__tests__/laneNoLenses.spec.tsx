/**
 * Canvas A1, review 00057 #2 (lenses): a View card draws no lens, so on the olumi-core lane the lens bar is not offered (as the legend,
 * laneSwitchOffs.spec B8). Off the lane it is, as before.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, renderHook } from '@testing-library/react'

vi.mock('../../flags', async (real) => ({ ...(await real<object>()), isGraphLensEnabled: () => true }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))

import { LensBar } from '../../canvas/artefacts/LensBar'
import { useCanvasKeyboardShortcuts } from '../../canvas/hooks/useCanvasKeyboardShortcuts'
import { useCanvasStore } from '../../canvas/store'

afterEach(() => { cleanup(); vi.unstubAllEnvs() })
const bar = () => {
  useCanvasStore.setState({ nodes: [{ id: 'a', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'A' } }] as never, edges: [] })
  return render(<LensBar />).container
}

describe('the lens bar on the lane', () => {
  it('on the lane: not offered', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    expect(bar().innerHTML).toBe('')
  })
  it('off the lane: offered, as before', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    expect(bar().innerHTML).not.toBe('')
  })
})

describe('the "l" key on the lane (lane audit 33)', () => {
  const press = () => {
    useCanvasStore.setState({ lens: { ...useCanvasStore.getState().lens, active: null } } as never)
    const { unmount } = renderHook(() => useCanvasKeyboardShortcuts({}))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', bubbles: true }))
    unmount()
    return useCanvasStore.getState().lens.active
  }
  it('on the lane: turns to no lens', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    expect(press()).toBeNull()
  })
  it('off the lane: turns to the next lens, as before', () => {
    vi.stubEnv('VITE_OLUMI_CORE', '')
    expect(press()).not.toBeNull()
  })
})
