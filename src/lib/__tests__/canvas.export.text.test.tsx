import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import CanvasDrawer, { type CanvasAPI } from '../../components/CanvasDrawer'

function enableFlag() { try { localStorage.setItem('feature.canvasExportText', '1') } catch {} }
function clearLS() { try { localStorage.clear() } catch {} }

describe('CanvasDrawer Export text (flag-gated)', () => {
  const realCreate = document.createElement
  const realURL = { create: URL.createObjectURL, revoke: URL.revokeObjectURL }
  let clickedHref: string | null = null

  beforeEach(() => {
    clearLS()
    enableFlag()
    clickedHref = null
    // Mock anchor click
    // @ts-ignore
    document.createElement = (tag: string) => {
      const el = realCreate.call(document, tag)
      if (tag.toLowerCase() === 'a') {
        // @ts-ignore
        el.click = () => { clickedHref = (el as HTMLAnchorElement).href }
      }
      return el
    }
    // Mock URL
    // @ts-ignore
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock')
    // @ts-ignore
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    // @ts-ignore
    document.createElement = realCreate
    // @ts-ignore
    URL.createObjectURL = realURL.create
    // @ts-ignore
    URL.revokeObjectURL = realURL.revoke
  })

  it('exports concatenated notes as text and revokes blob URL', async () => {
    let api: CanvasAPI | null = null
    render(<CanvasDrawer open={true} onClose={() => {}} onReady={(a) => { api = a }} />)

    // Add a couple of notes via API
    await act(async () => { api!.addNote('First'); api!.addNote('Second') })

    const btn = await screen.findByTestId('canvas-export-text-btn')
    expect(btn).toBeTruthy()

    fireEvent.click(btn)

    // Clicked an anchor with blob href
    expect(clickedHref).toBe('blob:mock')
    // Toast appears and will auto-hide; we just assert it exists now
    expect(await screen.findByTestId('canvas-export-text-toast')).toBeTruthy()
    // Revoke called eventually
    await new Promise((r) => setTimeout(r, 0))
    expect((URL.revokeObjectURL as any).mock.calls.length).toBeGreaterThan(0)
  })
})
