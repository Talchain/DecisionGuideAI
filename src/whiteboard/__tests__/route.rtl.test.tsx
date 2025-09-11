// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// Mock feature flags (enable both to allow route)
vi.mock('@/lib/config', () => ({
  cfg: { featureWhiteboard: true, featureScenarioSandbox: true, supabaseUrl: '', supabaseAnon: '', openaiKey: '' },
  hasSupabase: false,
  isWhiteboardEnabled: () => true,
  isSandboxEnabled: () => true,
  // Flags used by App.tsx FlagsProvider; return conservative defaults for this route test
  isStrategyBridgeEnabled: () => false,
  isSandboxRealtimeEnabled: () => false,
  isSandboxDeltaReapplyV2Enabled: () => false,
  isScenarioSnapshotsEnabled: () => false,
  isOptionHandlesEnabled: () => false,
  isSandboxVotingEnabled: () => false,
  isProjectionsEnabled: () => false,
  isDecisionCTAEnabled: () => false,
}))

// Mock auth context
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ authenticated: true, loading: false })
}))

// Mock access validation
vi.mock('@/lib/auth/accessValidation', () => ({
  checkAccessValidation: () => true
}))

// Mock ProtectedRoute to pass-through
vi.mock('@/components/auth/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: { children: any }) => children
}))

// Mock tldraw lib to avoid dependency requirement in tests
vi.mock('@/whiteboard/tldraw', () => ({
  Tldraw: () => null,
}))

// Mock supabase for any DB calls during initialization (define all inside factory)
vi.mock('@/lib/supabase', () => {
  const fromChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: { id: 'cv_test' }, error: null }),
    insert: vi.fn().mockResolvedValue({ data: { id: 'cv_test' }, error: null }),
    upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
  }
  return {
    supabase: {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) },
      from: (_: string) => fromChain,
      rpc: vi.fn(),
    },
    isSupabaseConfigured: true
  }
})

// Mock whiteboard persistence to avoid async delays and DB usage (hoisted)
const wbMocks = vi.hoisted(() => ({
  ensureCanvasForDecision: vi.fn().mockResolvedValue({ canvasId: 'cv_1' }),
  loadCanvasDoc: vi.fn().mockResolvedValue(null),
  saveCanvasDoc: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../persistence', () => ({
  ensureCanvasForDecision: wbMocks.ensureCanvasForDecision,
  loadCanvasDoc: wbMocks.loadCanvasDoc,
  saveCanvasDoc: wbMocks.saveCanvasDoc,
}))

// Mock seed to return a minimal doc immediately (hoisted)
const seedMocks = vi.hoisted(() => ({
  loadSeed: vi.fn().mockResolvedValue({ doc: { meta: { decision_id: 'abc123' }, shapes: [], bindings: [] } })
}))
vi.mock('../seed', () => ({
  loadSeed: seedMocks.loadSeed
}))

// Mock projection write (hoisted)
const projMocks = vi.hoisted(() => ({
  writeProjection: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('../projection', () => ({
  writeProjection: projMocks.writeProjection
}))

import App from '@/App'

describe('whiteboard route', () => {
  it('renders the whiteboard canvas when navigating to /decisions/:id/sandbox', async () => {
    render(
      <MemoryRouter initialEntries={["/decisions/abc123/sandbox"]}>
        <Routes>
          <Route path="/*" element={<App />} />
        </Routes>
      </MemoryRouter>
    )

    // First, Canvas shows a loading state
    expect(await screen.findByText(/Initializing canvas/i)).toBeInTheDocument()

    // Then overlay text appears once doc is ready
    expect(await screen.findByText(/Scenario Sandbox \(MVP\)/i, undefined, { timeout: 3000 })).toBeInTheDocument()
  })
})
