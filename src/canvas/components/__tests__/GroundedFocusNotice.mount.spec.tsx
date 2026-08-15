/**
 * GroundedFocusNotice — mounted canvas surface.
 *
 * Rendering the leaf component alone does not prove that the product mounts
 * it. This drives the real canvas route and the real store action, then
 * observes the notice through ReactFlowGraph's production render tree.
 */
import { act, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { cleanupCanvas, renderCanvas } from '../../__tests__/__helpers__/renderCanvas'
import { useCanvasStore } from '../../store'

function ensureResizeObserver() {
  if (typeof globalThis.ResizeObserver !== 'function') {
    globalThis.ResizeObserver = class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
}

describe('GroundedFocusNotice — mounted canvas surface', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test_anon_key')
    ensureResizeObserver()
  })

  afterEach(() => {
    cleanupCanvas()
    vi.unstubAllEnvs()
  })

  it('renders through CanvasMVP → ReactFlowGraph when the model could not be checked', async () => {
    const { default: CanvasMVP } = await import('../../../routes/CanvasMVP')
    renderCanvas(<CanvasMVP />)

    // Positive control: this is the real product route and its real canvas,
    // not a second leaf-component mount hidden in the harness.
    expect(screen.getByTestId('rf-root')).toBeInTheDocument()

    act(() => {
      useCanvasStore.getState().setGroundedFocus({
        nodeIds: [],
        unresolved: 'could_not_check',
      })
    })

    expect(await screen.findByTestId('grounded-focus-could-not-check')).toHaveTextContent(
      'I couldn’t read your model to check what you selected, so I can’t show it on the canvas.',
    )
  }, 30_000)
})
