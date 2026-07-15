/**
 * Receipts stay honest through the PERSISTENCE ROUNDTRIP (T2b) — the headline pin.
 *
 * PR #326 made the Seed receipt fail closed on the live path and shipped as
 * "no fabricated Seed/Stable-edges values". This spec pins the property that
 * #326 did NOT actually deliver: that it survives a save + reload.
 *
 * The roundtrip, composed from the real production units (no mocks of the
 * units under test):
 *
 *   engine response  →  resolveSeedUsed()            [useV2Run WRITE path]
 *                    →  AnalysisProvenance.seed_used [what Supabase stores]
 *                    →  hydrateAnalysisFromV2Response() [READ path on reload]
 *                    →  AdvancedSection seedUsed prop [the receipt surface]
 *
 * Before this lane the write path fabricated a 0 (`parseInt(x,10) || 0`), and
 * because hydrateAnalysis PREFERS provenance (`provenance?.seed_used ?? ...`),
 * that 0 came back as a real-looking "Seed 0" row after reload — the exact
 * false receipt #326 was merged to kill, resurrected on the next page load.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { resolveSeedUsed } from '../../../canvas/hooks/useV2Run'
import { hydrateAnalysisFromV2Response } from '../../../hooks/hydrateAnalysis'
import { AdvancedSection } from '../AdvancedSection'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'
import type { AnalysisProvenance } from '../../../types/scenario'

vi.mock('../../../canvas/hooks/useRiskProfile', () => ({
  useRiskProfile: () => ({ profile: null, loading: false, selectPreset: vi.fn() }),
  RISK_PRESETS: {
    risk_averse: { label: 'Risk Averse', description: 'Prefer certainty', icon: '', score: 0.2 },
    neutral: { label: 'Neutral', description: 'Balance risk', icon: '', score: 0.5 },
    risk_seeking: { label: 'Risk Seeking', description: 'Accept higher risk', icon: '', score: 0.8 },
  },
}))

function makeV2Response(meta?: Record<string, unknown>): V2RunResponse {
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'unavailable',
    drivers_status: 'unavailable',
    option_comparison: [
      {
        option_id: 'opt-1',
        option_label: 'Option A',
        confidence_interval: [0.3, 0.7],
        expected_outcome: 0.5,
      },
    ],
    critiques: [],
    response_hash: 'abc123',
    ...(meta ? { meta } : {}),
  } as unknown as V2RunResponse
}

/**
 * Replays a full save→reload cycle and returns the seed the receipt surface
 * would be handed. `requestedSeed` is what useV2Run sent to the engine — it is
 * ALWAYS a real number in production (derived at useV2Run.ts:424-441), which
 * is why the old `: (seed ?? 0)` fallback silently recorded an unconfirmed
 * seed as if the engine had confirmed it.
 */
function roundtrip(engineMeta?: Record<string, unknown>) {
  const response = makeV2Response(engineMeta)

  // --- WRITE: what useV2Run persists as provenance.seed_used
  const persistedSeed = resolveSeedUsed((response as { meta?: { seed_used?: unknown } }).meta?.seed_used)

  const provenance: AnalysisProvenance = {
    graph_hash: 'graph-hash-1',
    seed_used: persistedSeed,
    response_hash: 'abc123',
    analysed_at: '2026-02-20T10:00:00Z',
  }

  // --- READ: what hydrateAnalysis derives on the next page load
  const hydrated = hydrateAnalysisFromV2Response(response, provenance)

  return { persistedSeed, hydratedSeed: hydrated?.results.report?.meta.seed ?? null }
}

function expand() {
  fireEvent.click(screen.getByText('Advanced and receipts'))
}

describe('Seed receipt survives the persistence roundtrip (T2b)', () => {
  it('NO echo → persists null → reload HIDES the Seed row (the #326 property, now surviving a save)', () => {
    const { persistedSeed, hydratedSeed } = roundtrip(undefined)

    // The write path must not invent a seed...
    expect(persistedSeed).toBeNull()
    // ...so nothing real-looking comes back on reload...
    expect(hydratedSeed).toBeNull()

    // ...and the receipt surface stays honest and hides the row.
    render(<AdvancedSection seedUsed={hydratedSeed} expertMode />)
    expand()
    expect(screen.queryByText('Seed')).not.toBeInTheDocument()
  })

  it('MALFORMED echo ("abc") → persists null → reload HIDES the Seed row (no "Seed 0")', () => {
    const { persistedSeed, hydratedSeed } = roundtrip({ seed_used: 'abc' })

    expect(persistedSeed).toBeNull()
    expect(persistedSeed).not.toBe(0)
    expect(hydratedSeed).toBeNull()

    render(<AdvancedSection seedUsed={hydratedSeed} expertMode />)
    expand()
    expect(screen.queryByText('Seed')).not.toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('a REAL engine seed of 0 → persists 0 → reload SHOWS "Seed 0" (0 stays distinguishable from unknown)', () => {
    const { persistedSeed, hydratedSeed } = roundtrip({ seed_used: '0' })

    expect(persistedSeed).toBe(0)
    expect(hydratedSeed).toBe(0)

    render(<AdvancedSection seedUsed={hydratedSeed} expertMode />)
    expand()
    expect(screen.getByText('Seed')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('a normal seed → persists and reloads unchanged', () => {
    const { persistedSeed, hydratedSeed } = roundtrip({ seed_used: '1337' })

    expect(persistedSeed).toBe(1337)
    expect(hydratedSeed).toBe(1337)

    render(<AdvancedSection seedUsed={hydratedSeed} expertMode />)
    expand()
    expect(screen.getByText('Seed')).toBeInTheDocument()
    expect(screen.getByText('1337')).toBeInTheDocument()
  })
})
