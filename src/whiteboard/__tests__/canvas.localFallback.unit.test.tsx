// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// Mock persistence to throw on ensureCanvasForDecision, and provide a simple seed
vi.doMock('@/whiteboard/persistence', () => ({
  ensureCanvasForDecision: async () => { const err: any = new Error('missing decision_id'); err.code = 'PGRST204'; throw err },
  loadCanvasDoc: async () => { throw new Error('should not be called in fallback') },
  saveCanvasDoc: async () => {},
}))

vi.doMock('@/whiteboard/seed', () => ({
  loadSeed: async (decisionId: string) => ({
    doc: { meta: { decision_id: decisionId, kind: 'sandbox' }, shapes: [], bindings: [] }
  })
}))

// Import after mocks
const { Canvas } = await import('@/whiteboard/Canvas')

describe('Canvas local-first fallback', () => {
  let errSpy: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    errSpy.mockRestore()
  })

  it('mounts with local doc and shows non-blocking banner when Supabase init fails', async () => {
    render(<div style={{ width: 800, height: 400 }}><Canvas decisionId="demo" /></div>)
    // Initially shows initializing text
    expect(screen.getByText(/Initializing canvas…/i)).toBeInTheDocument()

    // Then falls back to local mode and shows the banner
    await waitFor(() => expect(screen.getByText(/Working locally — cloud sync unavailable/i)).toBeInTheDocument())

    // Ensure the initializing text disappears
    await waitFor(() => expect(screen.queryByText(/Initializing canvas…/i)).toBeNull())

    // Ensure no maximum depth errors were logged
    const logs = (errSpy.mock.calls || []).flat().join(' ')
    expect(logs).not.toMatch(/Maximum update depth exceeded/i)
  })
})
