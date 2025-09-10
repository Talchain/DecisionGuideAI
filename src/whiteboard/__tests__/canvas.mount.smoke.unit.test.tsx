// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Capture the editor passed to onMount
let lastEditor: any = null

vi.doMock('@/whiteboard/tldraw', () => ({
  Tldraw: ({ onMount }: any) => {
    const editor = {
      updateInstanceState: vi.fn(),
      setCurrentTool: vi.fn(),
      store: {
        listen: vi.fn(() => () => {}),
        loadSnapshot: vi.fn(),
        getSnapshot: vi.fn(() => ({ shapes: [], bindings: [] })),
      },
    }
    lastEditor = editor
    onMount?.(editor)
    return <div data-testid="tldraw-mock" />
  }
}))

// Import after mocks
const { Canvas } = await import('@/whiteboard/Canvas')

describe('Canvas mount smoke', () => {
  it('invokes onMount and configures editor to be interactive', async () => {
    render(<div style={{ width: 800, height: 400 }}><Canvas decisionId="mount-test" /></div>)

    // Ensure mocked Tldraw rendered
    expect(await screen.findByTestId('tldraw-mock')).toBeInTheDocument()

    // Editor should be configured for interaction
    expect(lastEditor?.updateInstanceState).toHaveBeenCalled()
    const args = lastEditor.updateInstanceState.mock.calls.at(-1)[0]
    expect(args).toMatchObject({ isReadonly: false })

    expect(lastEditor?.setCurrentTool).toHaveBeenCalledWith('geo')
  })
})
