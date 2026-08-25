/**
 * readinessStore — THE PRECONDITION BEHIND THE BLOCKED-REASON REFUSAL.
 *
 * `composeBlockedReason`'s producer-authored rung renders readiness
 * `improvements[].action` to the user as THE PRODUCER NAMING WHAT IS MISSING.
 * That claim is only true while every action it renders came from the producer.
 * This store breaks that: an improvement arriving with neither `action` nor
 * `recommendation` is mapped to a SYNTHESISED line so the improvements LIST
 * still has a row.
 *
 * Measured before the refusal was written, the composer emitted:
 *
 *   'Choose the missing effect value for "rebuild our product" on "Cash runway
 *    consumed". Review this area'
 *
 * — a real producer remedy and a UI invention, joined seamlessly and
 * indistinguishable in the field. That is a worse failure than the generic copy
 * the rung replaced: generic copy is visibly generic.
 *
 * ── WHY THIS SPEC EXISTS SEPARATELY FROM THE COMPOSER'S ────────────────────
 * The composer spec builds its own fixture from `IMPROVEMENT_ACTION_PLACEHOLDER`
 * and asserts the refusal. It would therefore keep passing if THIS store stopped
 * fabricating that exact value — the refusal would be dead and nothing would go
 * red. A discriminator must pin its own precondition (CLAUDE.md trap 13b), and
 * the precondition is a fact about the STORE, so it is measured here, against the
 * real mapping, through the real fetch seam.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useReadinessStore } from '../readinessStore'
import { useCanvasStore } from '../../store'
import { clearInflightCache } from '../../hooks/useGraphReadiness'
import { IMPROVEMENT_ACTION_PLACEHOLDER } from '../../utils/improvementActionPlaceholder'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

const PRODUCER_ACTION = 'Choose the missing effect value for "rebuild our product".'

function ok(improvements: unknown[]) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () =>
      Promise.resolve({
        readiness_score: 62,
        readiness_level: 'fair',
        can_run_analysis: false,
        confidence_explanation: 'Not ready',
        improvements,
      }),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  }
}

function seedCanvasWithNodes(count: number) {
  const nodes = Array.from({ length: count }, (_, i) => ({
    id: `node-${i}`,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: `Factor ${i}`, kind: 'factor' },
  }))
  useCanvasStore.setState({ nodes: nodes as never, edges: [] as never })
}

async function drive(improvements: unknown[]) {
  mockFetch.mockResolvedValue(ok(improvements))
  seedCanvasWithNodes(3)
  useReadinessStore.getState().startListening()
  await vi.runAllTimersAsync()
  return useReadinessStore.getState().readiness?.improvements ?? []
}

beforeEach(() => {
  vi.useFakeTimers()
  mockFetch.mockReset()
  useReadinessStore.getState().reset()
  useCanvasStore.setState({ nodes: [] as never, edges: [] as never, graphHealth: null } as never)
  clearInflightCache()
})

afterEach(() => {
  useReadinessStore.getState().reset()
  vi.useRealTimers()
})

describe('readinessStore fabricates an improvement action, and it is THIS constant', () => {
  it('PRECONDITION — an improvement with no action and no recommendation arrives as the placeholder', async () => {
    const improvements = await drive([{ category: 'values' }])

    expect(improvements).toHaveLength(1)
    // Identity against the shared constant, not a copied literal: this is the
    // exact value `composeBlockedReason` refuses, so the two cannot drift apart
    // without one of them failing to compile.
    expect(improvements[0].action).toBe(IMPROVEMENT_ACTION_PLACEHOLDER)
  })

  it('PRECONDITION — an empty-string action is fabricated over too', async () => {
    const improvements = await drive([{ category: 'values', action: '' }])
    expect(improvements[0].action).toBe(IMPROVEMENT_ACTION_PLACEHOLDER)
  })

  // ── The discriminating half (trap 13b) ──────────────────────────────────
  // Without this the spec is satisfied by "fabricate everything", which would
  // make the composer's refusal swallow every real remedy and still be green.
  it('DISCRIMINATING — a producer-authored action survives byte-identically', async () => {
    const improvements = await drive([{ category: 'values', action: PRODUCER_ACTION }])
    expect(improvements[0].action).toBe(PRODUCER_ACTION)
    expect(improvements[0].action).not.toBe(IMPROVEMENT_ACTION_PLACEHOLDER)
  })

  it('DISCRIMINATING — the legacy `recommendation` spelling is producer prose, not a fabrication', async () => {
    const improvements = await drive([{ category: 'values', recommendation: PRODUCER_ACTION }])
    expect(improvements[0].action).toBe(PRODUCER_ACTION)
  })
})
