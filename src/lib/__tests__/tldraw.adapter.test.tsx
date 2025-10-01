import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import React from 'react'
import { mockFlags } from '../../tests/__helpers__/mockFlags'
import type { CanvasAPI } from '../../components/CanvasDrawer'

function clearLS() { try { localStorage.clear() } catch {} }

describe('TLdraw adapter (flag-gated)', () => {
  beforeEach(() => {
    vi.resetModules()
    clearLS()
  })
  afterEach(() => {
    cleanup()
  })

  it('Adapter present: addNote updates DOM and autosave persists', async () => {
    mockFlags({ isTldrawEnabled: () => true })
    vi.doMock('../../lib/tldrawAdapter', () => ({
      createTldrawCanvas: async (surface: HTMLDivElement) => {
        const host = surface
        const list = document.createElement('ul')
        list.setAttribute('data-testid', 'tldraw-notes')
        host.appendChild(list)
        let notes: string[] = []
        const render = () => {
          list.innerHTML = ''
          for (const n of notes) {
            const li = document.createElement('li')
            li.textContent = n
            li.setAttribute('data-testid', 'tldraw-note')
            list.appendChild(li)
          }
        }
        const api: CanvasAPI = {
          addNote: (text: string) => { notes.push(String(text)); localStorage.setItem('canvas.snapshot', JSON.stringify({ notes })); render() },
          clear: () => { notes = []; localStorage.setItem('canvas.snapshot', JSON.stringify({ notes })); render() },
          exportSnapshot: () => JSON.stringify({ notes }),
          importSnapshot: (json: string) => { try { const d = JSON.parse(json); if (Array.isArray(d?.notes)) { notes = d.notes.map(String); render() } } catch {} },
        }
        render()
        return api
      }
    }))
    const { default: CanvasDrawer } = await import('../../components/CanvasDrawer')

    let apiRef: CanvasAPI | null = null
    render(<CanvasDrawer open={true} onClose={() => {}} onReady={(api) => { apiRef = api }} />)

    await screen.findByTestId('canvas-surface')
    await screen.findByTestId('tldraw-notes')

    expect(apiRef).toBeTruthy()
    await act(async () => { apiRef!.addNote('Hello') })

    // Adapter DOM updated
    const items = await screen.findAllByTestId('tldraw-note')
    expect(items.length).toBe(1)
    expect(items[0].textContent).toBe('Hello')

    // Autosave wrote snapshot
    expect(localStorage.getItem('canvas.snapshot') || '').toContain('Hello')
  })

  it('Adapter missing: falls back to shim and addNote renders canvas-note', async () => {
    mockFlags({ isTldrawEnabled: () => true })
    vi.doMock('../../lib/tldrawAdapter', () => ({
      createTldrawCanvas: async () => { throw new Error('TLDRAW_MISSING') }
    }))
    const { default: CanvasDrawer } = await import('../../components/CanvasDrawer')

    let apiRef: CanvasAPI | null = null
    render(<CanvasDrawer open={true} onClose={() => {}} onReady={(api) => { apiRef = api }} />)

    await screen.findByTestId('canvas-surface')
    // Shim placeholder should appear (no adapter list)
    expect(screen.getByText(/Canvas \(dev\)/)).toBeTruthy()

    expect(apiRef).toBeTruthy()
    await act(async () => { apiRef!.addNote('Shim note') })

    const items = await screen.findAllByTestId('canvas-note')
    expect(items.length).toBe(1)
    expect(items[0].textContent).toBe('Shim note')
  })
})
