/**
 * Flag default + rollback parity for aiPanelV2.
 *
 * As of this PR the aiPanelV2 flag's in-code default is ON — the
 * floating-first AI Panel v2 is the primary composer surface. The
 * legacy DraftChat path stays reachable via explicit FF-off override
 * (`localStorage.setItem('feature.aiPanelV2', 'false')` or
 * `VITE_FEATURE_AI_PANEL_V2=false`) so emergency rollback works.
 *
 * Tests assert:
 *  - Flag defaults to TRUE when no env/localStorage override is set.
 *  - localStorage="false" forces the flag OFF (rollback escape hatch).
 *  - localStorage="true" keeps it ON.
 *  - When flag is OFF, OUTPUT_TABS contains no 'olumi' tab (legacy path).
 *  - When flag is ON (default), OUTPUT_TABS contains 'olumi'.
 *  - Surfaces that should be invisible without an active selection /
 *    stale analysis (SelectionPill, StaleAnalysisBadge) still render
 *    nothing in the default state.
 *
 * We do NOT mount full OutputsDock here — the surrounding canvas store
 * setup is too heavy and the supabase/threadService dependency chain
 * breaks in test. Targeted unit-level coverage is sufficient.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'

// Importing OutputsDock pulls in services/threadService → src/lib/supabase
// which throws at import time when SUPABASE_URL/KEY are missing in test env.
// Stub the supabase module to a benign no-op shape so the parity tests can
// import the dock without spinning up real infrastructure.
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))

// dompurify is a transitive import via canvas/utils/markdown that the test
// environment does not have installed — same as the known typecheck failure.
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('../../utils/markdown', () => ({
  renderMarkdown: (s: string) => s,
  sanitiseMarkdown: (s: string) => s,
}))

import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import { SelectionPill } from '../SelectionPill'
import { StaleAnalysisBadge } from '../StaleAnalysisBadge'

// SelectionPill reads from canvas store; mock the selection context to null.
vi.mock('../../hooks/useSelectionContext', () => ({
  useSelectionContext: () => null,
}))
// StaleAnalysisBadge reads useStaleGuard; mock to not-stale.
vi.mock('../../ui/inspector-v2/useStaleGuard', () => ({
  useStaleGuard: () => ({ analysisState: 'none', isStale: false }),
}))
// useV2Run pulls in heavy deps — mock minimal shape used by StaleAnalysisBadge.
vi.mock('../../hooks/useV2Run', () => ({
  useV2Run: () => ({ runV2Analysis: () => Promise.resolve() }),
}))

describe('aiPanelV2 default (round-12: default-ON, rollback via localStorage="false")', () => {
  beforeEach(() => {
    try {
      window.localStorage.removeItem('feature.aiPanelV2')
    } catch {}
    useFloatingPanelState.getState().reset()
  })

  it('flag defaults to TRUE when no env/localStorage override is set', async () => {
    const flags = await import('../../../flags')
    expect(flags.isAiPanelV2Enabled()).toBe(true)
  })

  it('localStorage="true" keeps the flag on (idempotent with default)', async () => {
    window.localStorage.setItem('feature.aiPanelV2', 'true')
    const flags = await import('../../../flags')
    expect(flags.isAiPanelV2Enabled()).toBe(true)
  })

  it('localStorage="false" forces the flag OFF (rollback escape hatch)', async () => {
    window.localStorage.setItem('feature.aiPanelV2', 'false')
    const flags = await import('../../../flags')
    expect(flags.isAiPanelV2Enabled()).toBe(false)
  })

  it('SelectionPill renders nothing when no element is selected', () => {
    const { container } = render(<SelectionPill />)
    expect(container.firstChild).toBeNull()
  })

  it('StaleAnalysisBadge renders nothing when analysis is not stale', () => {
    const { container } = render(<StaleAnalysisBadge />)
    expect(container.firstChild).toBeNull()
  })

  it('FloatingPanelState defaults to closed (panel does not auto-mount)', () => {
    expect(useFloatingPanelState.getState().isOpen).toBe(false)
  })

  describe('OUTPUT_TABS gating (render-level)', () => {
    beforeEach(() => {
      vi.resetModules()
    })

    it('OUTPUT_TABS list does NOT include "olumi" when flag is explicitly disabled (rollback)', async () => {
      // Round-12: default is ON, so the FF-off path is only entered with
      // an explicit localStorage="false" override (or env=false). This
      // test exercises that rollback escape hatch.
      window.localStorage.setItem('feature.aiPanelV2', 'false')
      const { getOutputTabsForParity } = await import('../OutputsDock')
      const ids = getOutputTabsForParity().map((t) => t.id)
      expect(ids).not.toContain('olumi')
      // 'results' + 'diagnostics' are unconditional on staging. 'compare'
      // and 'journey' are independently flag-gated and may or may not be
      // present here — not asserted.
      expect(ids).toEqual(expect.arrayContaining(['results', 'diagnostics']))
    })

    it('OUTPUT_TABS list DOES include "olumi" by default (flag default-ON)', async () => {
      // Round-12: no override needed — default is ON.
      window.localStorage.removeItem('feature.aiPanelV2')
      const { getOutputTabsForParity } = await import('../OutputsDock')
      const ids = getOutputTabsForParity().map((t) => t.id)
      expect(ids).toContain('olumi')
      // Olumi appears at the start (first position).
      expect(ids[0]).toBe('olumi')
    })
  })
})
