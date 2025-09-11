// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.doMock('@/whiteboard/tldraw', () => ({
  Tldraw: ({ onMount }: any) => {
    const editor = {
      updateInstanceState: vi.fn(),
      setCurrentTool: vi.fn(),
      store: { listen: vi.fn(() => () => {}), loadSnapshot: vi.fn(), getSnapshot: vi.fn(() => ({})) },
    }
    onMount?.(editor)
    return <div data-testid="tldraw-mock" />
  }
}))

const { Canvas } = await import('@/whiteboard/Canvas')

describe('Canvas toolbar a11y', () => {
  it('has aria-label and title attributes on all buttons', async () => {
    localStorage.setItem('dgai:canvas:decision/demo', JSON.stringify({ shapes: [], bindings: [], meta: { decision_id: 'demo', kind: 'sandbox' } }))
    render(<div style={{ width: 800, height: 400 }}><Canvas decisionId="demo" /></div>)
    expect(await screen.findByTestId('tldraw-mock')).toBeInTheDocument()

    const buttons = [
      'tb-select', 'tb-rect', 'tb-text', 'tb-undo', 'tb-redo', 'tb-zoom-in', 'tb-zoom-out', 'tb-zoom-fit'
    ]

    for (const id of buttons) {
      const el = screen.getByTestId(id)
      expect(el).toHaveAttribute('aria-label')
      expect(el).toHaveAttribute('title')
    }
  })
})
