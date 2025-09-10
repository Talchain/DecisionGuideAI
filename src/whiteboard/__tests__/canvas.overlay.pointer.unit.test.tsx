// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// Force local-only path by throwing on ensureCanvasForDecision
vi.doMock('@/whiteboard/persistence', () => ({
  ensureCanvasForDecision: async () => { throw new Error('PGRST204') },
  loadCanvasDoc: async () => ({}),
  saveCanvasDoc: async () => {},
}))

vi.doMock('@/whiteboard/seed', () => ({
  loadSeed: async (decisionId: string) => ({
    doc: { meta: { decision_id: decisionId, kind: 'sandbox' }, shapes: [], bindings: [] }
  })
}))

// Import after mocks
const { Canvas } = await import('@/whiteboard/Canvas')

describe('Canvas overlay does not block pointer events', () => {
  it('local-only banner is non-blocking (pointer-events:none)', async () => {
    render(<div style={{ width: 800, height: 400 }}><Canvas decisionId="ovl" /></div>)

    // Wait for the local-only banner to appear
    const banner = await waitFor(() => screen.getByText(/Working locally — cloud sync unavailable/i))

    // Should not block pointer events
    expect((banner as HTMLElement).className).toMatch(/pointer-events-none/)
  })
})
