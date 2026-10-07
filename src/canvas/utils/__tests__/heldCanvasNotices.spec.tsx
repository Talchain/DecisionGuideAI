/**
 * S5 P1 containment (DL, 7 Oct): a rename interrupted because the user LEFT the model must still be SEEN.
 *
 * Witnessed on staging 6291467e: rename, then "My decisions" within ~2.6 s → the rename's turn is aborted, the drain
 * dispatches its notice after the canvas (the only `topbar:show-toast` listener) has unmounted, and nobody shows it.
 * Rows: the hold (shown vs held, by whether a bridge showed it), the bridge (marks shown; shows held on mount), and the
 * rename drain end to end with and without a mounted bridge.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { Node } from '@xyflow/react'

import {
  CANVAS_TOAST_EVENT,
  __resetHeldCanvasNoticesForTests,
  showCanvasNoticeOrHold,
  takeHeldCanvasNotices,
} from '../heldCanvasNotices'
import { useCanvasNoticeBridge } from '../../hooks/useCanvasNoticeBridge'
import { useCanvasStore } from '../../store'
import { useStructuralRenameEvents } from '../../conversation/useStructuralRenameEvents'
import {
  STRUCTURAL_RENAME_UNCONFIRMED_REMEDY,
  STRUCTURAL_RENAME_UNCONFIRMED_TOAST,
  structuralRenameUnconfirmedHeldNotice,
  type StructuralRenameIntent,
} from '../../mutations/structuralRename'

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return { ...actual, isOrchestratorV2Enabled: () => true }
})

const NOW = { message: 'now words', level: 'warning' as const }
const LATER = { message: 'later words', level: 'warning' as const }

beforeEach(() => __resetHeldCanvasNoticesForTests())
afterEach(() => { vi.clearAllMocks() })

describe('the hold: a notice no canvas showed is kept for the next canvas', () => {
  it('a bridge that SHOWS it (preventDefault) ⇒ shown, nothing held', () => {
    const bridge = (e: Event) => e.preventDefault()
    window.addEventListener(CANVAS_TOAST_EVENT, bridge)
    try {
      expect(showCanvasNoticeOrHold(NOW, LATER)).toBe('shown')
    } finally {
      window.removeEventListener(CANVAS_TOAST_EVENT, bridge)
    }
    expect(takeHeldCanvasNotices()).toEqual([])
  })

  it('CONTRAST: no listener at all (the user left the canvas) ⇒ held, and the LATER words are what is held, once', () => {
    expect(showCanvasNoticeOrHold(NOW, LATER)).toBe('held')
    expect(takeHeldCanvasNotices()).toEqual([LATER])
    expect(takeHeldCanvasNotices()).toEqual([])
  })

  it('an observer that does not show it does not count as shown', () => {
    const observer = vi.fn()
    window.addEventListener(CANVAS_TOAST_EVENT, observer)
    try {
      expect(showCanvasNoticeOrHold(NOW, LATER)).toBe('held')
    } finally {
      window.removeEventListener(CANVAS_TOAST_EVENT, observer)
    }
    expect(observer).toHaveBeenCalledTimes(1)
  })

  it('a notice older than 10 minutes is dropped, not shown; at most the 3 newest are kept', () => {
    showCanvasNoticeOrHold(NOW, LATER)
    expect(takeHeldCanvasNotices(Date.now() + 10 * 60 * 1000 + 1)).toEqual([])
    for (const n of ['1', '2', '3', '4']) showCanvasNoticeOrHold(NOW, { message: n, level: 'info' })
    expect(takeHeldCanvasNotices().map((n) => n.message)).toEqual(['2', '3', '4'])
  })
})

describe('the canvas bridge', () => {
  it('shows a raised notice and marks it shown, so it is not also held', () => {
    const showToast = vi.fn()
    const { unmount } = renderHook(() => useCanvasNoticeBridge(showToast))
    expect(showCanvasNoticeOrHold(NOW, LATER)).toBe('shown')
    expect(showToast).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith('now words', 'warning')
    unmount()
    expect(takeHeldCanvasNotices()).toEqual([])
  })

  it('on mount, shows what was held while no canvas was mounted, then nothing twice', () => {
    expect(showCanvasNoticeOrHold(NOW, LATER)).toBe('held')
    const showToast = vi.fn()
    renderHook(() => useCanvasNoticeBridge(showToast))
    expect(showToast).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith('later words', 'warning')
    expect(takeHeldCanvasNotices()).toEqual([])
  })

  it('after unmount, a raised notice is held again (the canvas is gone)', () => {
    const showToast = vi.fn()
    const { unmount } = renderHook(() => useCanvasNoticeBridge(showToast))
    unmount()
    expect(showCanvasNoticeOrHold(NOW, LATER)).toBe('held')
    expect(showToast).not.toHaveBeenCalled()
  })
})

describe('the interrupted rename, end to end', () => {
  const SCENARIO_ID = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
  const HASH = 'cfded3af0aa14ebd'
  const intent: StructuralRenameIntent = {
    id: 'sr-1',
    nodeId: 'fac_price',
    label: 'List price',
    expectedLabel: 'Price',
    baseGraphHash: HASH,
    restore: { label: 'Price', provenanceWasPresent: false },
  }
  const seed = () =>
    useCanvasStore.setState({
      currentScenarioId: SCENARIO_ID,
      lastServerGraphHash: HASH,
      pendingStructuralRenames: [intent],
      structuralRenameLifecycle: [],
      _externalMutationActive: 0,
      nodes: [
        { id: 'fac_price', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'List price', kind: 'factor' } },
      ] as unknown as Node[],
      edges: [],
    } as never)
  const aborted = () => Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
  const statusOf = () => useCanvasStore.getState().structuralRenameLifecycle.find((r) => r.intent.id === 'sr-1')?.status

  it('the held words name the rename, say why, and keep the one remedy', () => {
    expect(structuralRenameUnconfirmedHeldNotice(intent)).toBe(
      'Your rename of ‘Price’ to ‘List price’ was interrupted when you left that model, so I can\'t tell you whether it saved. ' +
        STRUCTURAL_RENAME_UNCONFIRMED_REMEDY,
    )
  })

  it('no canvas mounted (the user left) ⇒ the notice is HELD and the next canvas shows the held words', async () => {
    seed()
    renderHook(() => useStructuralRenameEvents(vi.fn(aborted)))
    await waitFor(() => expect(statusOf()).toBe('unconfirmed'))
    const showToast = vi.fn()
    renderHook(() => useCanvasNoticeBridge(showToast))
    expect(showToast).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith(structuralRenameUnconfirmedHeldNotice(intent), 'warning')
  })

  it('CONTRAST: the canvas still mounted ⇒ shown at once with the existing words, nothing held', async () => {
    const showToast = vi.fn()
    renderHook(() => useCanvasNoticeBridge(showToast))
    seed()
    renderHook(() => useStructuralRenameEvents(vi.fn(aborted)))
    await waitFor(() => expect(statusOf()).toBe('unconfirmed'))
    expect(showToast).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith(STRUCTURAL_RENAME_UNCONFIRMED_TOAST, 'warning')
    expect(takeHeldCanvasNotices()).toEqual([])
  })
})
