// View level store — vNext-local, never the shared canvas viewMode.

import { describe, it, expect, beforeEach } from 'vitest'
import { useViewLevelStore, VIEW_LEVEL_STORAGE_KEY } from '../viewLevelStore'

beforeEach(() => {
  sessionStorage.clear()
  useViewLevelStore.setState({ level: 'simple' })
})

describe('viewLevelStore', () => {
  it('defaults to simple', () => {
    expect(useViewLevelStore.getState().level).toBe('simple')
  })

  it('persists the level to its own sessionStorage key', () => {
    useViewLevelStore.getState().setLevel('detailed')
    expect(useViewLevelStore.getState().level).toBe('detailed')
    expect(sessionStorage.getItem(VIEW_LEVEL_STORAGE_KEY)).toBe('detailed')
  })

  it("NEVER writes the shared canvas 'canvas.viewMode' preference", () => {
    useViewLevelStore.getState().setLevel('detailed')
    useViewLevelStore.getState().setLevel('simple')
    expect(sessionStorage.getItem('canvas.viewMode')).toBeNull()
  })

  it('uses a vNext-scoped storage key', () => {
    expect(VIEW_LEVEL_STORAGE_KEY).toBe('canvasVNext.viewLevel')
    expect(VIEW_LEVEL_STORAGE_KEY).not.toBe('canvas.viewMode')
  })
})
