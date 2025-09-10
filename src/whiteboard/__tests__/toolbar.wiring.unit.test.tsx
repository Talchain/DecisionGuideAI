// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

let lastEditor: any = null

vi.doMock('@/whiteboard/tldraw', () => ({
  Tldraw: ({ onMount }: any) => {
    const editor = {
      setCurrentTool: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      zoomIn: vi.fn(),
      zoomOut: vi.fn(),
      zoomToFit: vi.fn(),
      updateInstanceState: vi.fn(),
      store: { listen: vi.fn(() => () => {}), loadSnapshot: vi.fn(), getSnapshot: vi.fn(() => ({})) },
    }
    lastEditor = editor
    onMount?.(editor)
    return <div data-testid="tldraw-mock" />
  }
}))

const { Canvas } = await import('@/whiteboard/Canvas')

describe('Canvas toolbar wiring', () => {
  it('wires Select/Rect/Text to setCurrentTool and Undo/Redo to editor.undo/redo', async () => {
    render(<div style={{ width: 800, height: 400 }}><Canvas decisionId="tb" /></div>)

    // Ensure mocked Tldraw rendered
    expect(await screen.findByTestId('tldraw-mock')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('tb-select'))
    fireEvent.click(screen.getByTestId('tb-rect'))
    fireEvent.click(screen.getByTestId('tb-text'))
    fireEvent.click(screen.getByTestId('tb-undo'))
    fireEvent.click(screen.getByTestId('tb-redo'))

    expect(lastEditor.setCurrentTool).toHaveBeenCalledWith('select')
    expect(lastEditor.setCurrentTool).toHaveBeenCalledWith('geo')
    expect(lastEditor.setCurrentTool).toHaveBeenCalledWith('text')
    expect(lastEditor.undo).toHaveBeenCalled()
    expect(lastEditor.redo).toHaveBeenCalled()
  })

  it('wires zoom controls', async () => {
    render(<div style={{ width: 800, height: 400 }}><Canvas decisionId="tb2" /></div>)

    fireEvent.click(screen.getByTestId('tb-zoom-in'))
    fireEvent.click(screen.getByTestId('tb-zoom-out'))
    fireEvent.click(screen.getByTestId('tb-zoom-fit'))

    expect(lastEditor.zoomIn).toHaveBeenCalled()
    expect(lastEditor.zoomOut).toHaveBeenCalled()
    expect(lastEditor.zoomToFit).toHaveBeenCalled()
  })
})
