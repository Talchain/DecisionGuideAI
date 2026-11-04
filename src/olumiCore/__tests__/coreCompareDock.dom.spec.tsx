/**
 * The real dock on the olumi-core lane, opened on Compare: its body is core's comparison (`olumiCore/compare.tsx`), never CEE's run
 * pair (`CompareRunPairBody`, which reads a run delta this lane never has). Harness as `canvas/components/__tests__/OutputsDock.dom.spec.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: vi.fn(() => vi.fn()) }))
vi.mock('../../flags', async (orig) => ({ ...(await orig<typeof import('../../flags')>()), isCompareTabEnabled: () => true, isAiPanelV2Enabled: () => true }))

import { OutputsDock, OUTPUTS_DOCK_STORAGE_KEY } from '../../canvas/components/OutputsDock'
import { ConversationProvider } from '../../canvas/conversation/ConversationContext'
import { ToastProvider } from '../../canvas/ToastContext'
import { useViewStore } from '../../olumiView/store'
import { setTeamFetch } from '../team/api'

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', { writable: true, value: (query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true }) })
}
afterEach(() => { cleanup(); setTeamFetch(null); vi.unstubAllEnvs(); sessionStorage.removeItem(OUTPUTS_DOCK_STORAGE_KEY) })

describe('the dock\'s Compare tab on the olumi-core lane', () => {
  it('opens on core\'s comparison, not CEE\'s run pair', async () => {
    vi.stubEnv('VITE_OLUMI_CORE', '1')
    setTeamFetch((async () => new Response(JSON.stringify({ versions: [], changes: [], results: [] }), { status: 200 })) as unknown as typeof fetch)
    useViewStore.setState({ sid: null, view: null, status: 'none', error: null, stale: false })
    sessionStorage.setItem(OUTPUTS_DOCK_STORAGE_KEY, JSON.stringify({ isOpen: true, activeTab: 'compare' }))
    render(<ToastProvider><ConversationProvider><OutputsDock /></ConversationProvider></ToastProvider>)
    expect(await screen.findByTestId('core-compare-tab')).toBeInTheDocument()
    expect(screen.getByTestId('outputs-dock-tab-compare')).toBeInTheDocument()
  }, 120_000)
})
