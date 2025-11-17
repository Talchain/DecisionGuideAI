/**
 * S8-LAYOUT-RESERVE: ReactFlow layout offsets + dock CSS vars
 *
 * Proves:
 * - Flag OFF → ReactFlow wrapper uses left: 0, right: 0
 * - Flag ON  → wrapper uses CSS-var offsets for left/right
 * - Dock collapse/expand updates --dock-left-offset / --dock-right-offset
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderCanvas, cleanupCanvas, flushRAF } from './__helpers__/renderCanvas'
import { mockFlags } from '../../tests/__helpers__/mockFlags'

function ensureMatchMedia() {
  if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }),
    })
  }
}

function ensureResizeObserver() {
  if (typeof (globalThis as any).ResizeObserver !== 'function') {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(globalThis as any).ResizeObserver = ResizeObserverStub
  }
}

async function renderCanvasMVP() {
  ensureMatchMedia()
  ensureResizeObserver()
  const { default: CanvasMVP } = await import('../../routes/CanvasMVP')
  return renderCanvas(<CanvasMVP />)
}

async function getReactFlowWrapper(): Promise<HTMLDivElement> {
  const root = await screen.findByTestId('rf-root')

  // ReactFlow root has the .react-flow class; the layout wrapper is its parent
  const rfRoot = root.querySelector('.react-flow') as HTMLDivElement | null
  if (!rfRoot || !rfRoot.parentElement) {
    throw new Error('ReactFlow layout wrapper not found')
  }

  return rfRoot.parentElement as HTMLDivElement
}

function resetDockCssVars() {
  try {
    const root = document.documentElement
    root.style.removeProperty('--dock-left-offset')
    root.style.removeProperty('--dock-right-offset')
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('canvas.inputsDock.v1')
      sessionStorage.removeItem('canvas.outputsDock.v1')
    }
  } catch {
    // Ignore if document is not available
  }
}

describe('ReactFlowGraph layout - dock offsets (S8-LAYOUT-RESERVE)', () => {
  beforeEach(() => {
    vi.resetModules()
    ensureMatchMedia()
    ensureResizeObserver()
    resetDockCssVars()
  })

  afterEach(() => {
    cleanupCanvas()
    resetDockCssVars()
  })

  it('uses full-width ReactFlow wrapper when dock layout flag is OFF', async () => {
    mockFlags({
      isCanvasEnabled: () => true,
      isInputsOutputsEnabled: () => false,
    })

    await renderCanvasMVP()
    await flushRAF()

    const wrapper = await getReactFlowWrapper()

    // When dock layout is disabled, wrapper should span full width
    expect(['', '0', '0px']).toContain(wrapper.style.left)
    expect(['', '0', '0px']).toContain(wrapper.style.right)
  })

  it('reserves space for docks via CSS-var offsets when flag is ON', async () => {
    mockFlags({
      isCanvasEnabled: () => true,
      isInputsOutputsEnabled: () => true,
    })

    await renderCanvasMVP()
    await flushRAF()

    const wrapper = await getReactFlowWrapper()

    expect(wrapper.style.left).toContain('var(--dock-left-offset')
    expect(wrapper.style.right).toContain('var(--dock-right-offset')
  })

  it('updates dock CSS offsets when inputs/outputs docks collapse and expand', async () => {
    mockFlags({
      isCanvasEnabled: () => true,
      isInputsOutputsEnabled: () => true,
    })

    await renderCanvasMVP()
    await flushRAF()

    const root = document.documentElement

    // Initial state: both docks open → expanded offsets
    await waitFor(() => {
      expect(root.style.getPropertyValue('--dock-left-offset')).toContain('var(--dock-left-expanded')
      expect(root.style.getPropertyValue('--dock-right-offset')).toContain('var(--dock-right-expanded')
    })

    // Collapse Inputs dock
    const inputsToggle = (await screen.findByTestId('inputs-dock-toggle')) as HTMLButtonElement
    fireEvent.click(inputsToggle)
    await flushRAF()

    await waitFor(() => {
      expect(root.style.getPropertyValue('--dock-left-offset')).toContain('var(--dock-left-collapsed')
    })

    // Collapse Outputs dock
    const outputsToggle = screen.getByRole('button', { name: 'Collapse outputs dock' }) as HTMLButtonElement
    fireEvent.click(outputsToggle)
    await flushRAF()

    await waitFor(() => {
      expect(root.style.getPropertyValue('--dock-right-offset')).toContain('var(--dock-right-collapsed')
    })
  })
})

