// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
// Mock overrides store to avoid dependency on its implementation in this compare-focused test
vi.mock('@/sandbox/state/overridesStore', () => {
  const React = require('react')
  return {
    OverridesProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useOverrides: () => ({ focusOnNodeId: null, setFocusOn: () => {} }),
  }
})
// Mock Canvas to avoid FocusOverlay/WhatIfOverlay imports and TL side-effects
vi.mock('@/whiteboard/Canvas', () => {
  const React = require('react')
  return { Canvas: () => React.createElement('div', { 'data-testid': 'canvas-root' }) }
})
import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'
import { FlagsProvider } from '@/lib/flags'

// Hoisted TL mock to avoid tldraw side-effects
vi.mock('@/whiteboard/tldraw', () => ({
  Tldraw: ({ onMount }: any) => {
    const editor = { updateInstanceState: () => {} }
    React.useEffect(() => { onMount?.(editor) }, [])
    return null
  },
}))

beforeEach(() => { localStorage.clear() })
afterEach(() => { localStorage.clear() })

describe('compare legend + tooltips', () => {
  it('renders legend container and chip tooltips', async () => {
    render(
      <FlagsProvider value={{ sandbox: true, sandboxMapping: true, sandboxCompare: true }}>
        <MemoryRouter initialEntries={[`/decisions/demo/sandbox/combined`]}>
          <Routes>
            <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
          </Routes>
        </MemoryRouter>
      </FlagsProvider>
    )

    // Open compare
    const btnCompare = await screen.findByText('Compare')
    fireEvent.click(btnCompare)

    // Find legend container and chips with title tooltips
    await waitFor(() => {
      const legendAttr = document.querySelector('[data-dg-legend]') as HTMLElement | null
      if (!legendAttr) throw new Error('legend not visible yet')
    })

    // tooltips via title attributes
    const added = document.querySelector('[data-dg-legend] [title="Added"]')
    const removed = document.querySelector('[data-dg-legend] [title="Removed"]')
    const changed = document.querySelector('[data-dg-legend] [title="Changed"]')
    expect(added && removed && changed).toBeTruthy()
  })
})
