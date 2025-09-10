// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

import { RealtimeProvider, useRealtimeDoc } from '@/realtime/provider'
import { useBoardState } from '@/sandbox/state/boardState'

function TestPeer({ decisionId, doAdd }: { decisionId: string; doAdd?: boolean }) {
  const doc = useRealtimeDoc()
  const { board, addNode, getBoard } = useBoardState(decisionId, doc)
  React.useEffect(() => {
    if (doAdd) {
      addNode({ type: 'decision', x: 10, y: 10, label: 'N' })
    }
  }, [doAdd, addNode])
  // Expose board nodes length on window for assertion
  React.useEffect(() => {
    ;(window as any)[`_peer_${doAdd ? 'A' : 'B'}`] = (getBoard?.() || board)
  }, [board, getBoard, doAdd])
  return null
}

describe('Realtime mock provider', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { try { vi.runOnlyPendingTimers() } catch {}; vi.useRealTimers(); vi.clearAllMocks() })

  it('flag off → local docs are isolated', async () => {
    vi.doMock('@/lib/config', async () => {
      const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config')
      return { ...actual, isSandboxRealtimeEnabled: () => false }
    })
    const ReactLib = await import('react')
    const RTL = await import('@testing-library/react')
    RTL.render(
      ReactLib.createElement(ReactLib.Fragment, null,
        ReactLib.createElement(TestPeer as any, { decisionId: 'rt-x', doAdd: true }),
        ReactLib.createElement(TestPeer as any, { decisionId: 'rt-x' }),
      )
    )

    await waitFor(() => {
      const A = (window as any)._peer_A
      const B = (window as any)._peer_B
      expect(A?.nodes?.length || 0).toBeGreaterThan(0)
      expect(B?.nodes?.length || 0).toBe(0)
    })
  })

  it('flag on (mock) → peers share the same Y.Doc updates; disconnect cleans up', async () => {
    vi.doMock('@/lib/config', async () => {
      const actual = await vi.importActual<typeof import('@/lib/config')>('@/lib/config')
      return { ...actual, isSandboxRealtimeEnabled: () => true }
    })

    const { render } = await import('@testing-library/react')
    const ReactLib2 = await import('react')
    const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => ReactLib2.createElement(RealtimeProvider as any, { decisionId: 'rt-y' }, children)
    const r = render(
      ReactLib2.createElement(Wrapper, null,
        ReactLib2.createElement(TestPeer as any, { decisionId: 'rt-y', doAdd: true }),
        ReactLib2.createElement(TestPeer as any, { decisionId: 'rt-y' }),
      )
    )

    await waitFor(() => {
      const A = (window as any)._peer_A
      const B = (window as any)._peer_B
      expect(A?.nodes?.length || 0).toBeGreaterThan(0)
      expect(B?.nodes?.length || 0).toBeGreaterThan(0)
    })

    // Unmount to ensure no errors and that disconnect doesn't throw
    r.unmount()
  })
})
