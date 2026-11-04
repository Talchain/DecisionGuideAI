/**
 * THE LANE'S KEY IS CORE'S (DL 4 Nov): on the olumi-core lane "How to read this" draws `model.key` from core's View (the page's KEY as
 * data), every glyph and its words in core's order, and never the legacy key of legacy marks. Asserted from core's goldens, never from
 * words written here, so the rows prove the key is View-fed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } } }))
import pricing from '../golden/pricing.view.json'
import type { View } from '../client'
import { CanvasViewportControls } from '../../components/layout/CanvasViewportControls'
import { useViewStore } from '../store'

afterEach(() => { cleanup(); vi.unstubAllEnvs(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }) })

const openKey = (view: View | null) => {
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: 's_0123456789ab', view, error: null, status: view ? 'ready' : 'loading', stale: false })
  render(<ReactFlowProvider><CanvasViewportControls onZoomIn={vi.fn()} onZoomOut={vi.fn()} onZoomReset={vi.fn()} onFitView={vi.fn()} onAutoArrange={vi.fn()} /></ReactFlowProvider>)
  fireEvent.click(screen.getByTestId('viewport-more'))
  fireEvent.click(screen.getByTestId('viewport-legend'))
}

describe('the lane\'s key is core\'s, from the View', () => {
  it('every item of model.key, glyph and words, in core\'s order; not the legacy key', () => {
    const v = pricing as unknown as View, key = v.model!.key
    expect(key.length).toBeGreaterThan(20)
    openKey(v)
    const dialog = screen.getByTestId('view-legend')
    const rows = within(dialog).getAllByRole('listitem')
    expect(rows.map((r) => r.textContent)).toEqual(key.map((k) => `${k.glyph}${k.text}`))
    expect(screen.queryByTestId('canvas-legend-popover')).toBeNull()
  })

  it('Escape closes it', () => {
    openKey(pricing as unknown as View)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('view-legend')).toBeNull()
  })

  it('no model in the View yet: no key drawn, rather than an empty or a legacy one', () => {
    openKey(null)
    expect(screen.queryByTestId('view-legend')).toBeNull()
    expect(screen.queryByTestId('canvas-legend-popover')).toBeNull()
  })
})
