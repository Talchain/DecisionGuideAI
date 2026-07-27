/**
 * readinessStore — CEE pre-analysis readiness VOCABULARY boundary.
 *
 * THE DEFECT THIS PINS (live on every graph CEE scored >= 70):
 *
 *   CEE emits  `readiness_level: "ready" | "fair" | "needs_work"`
 *   The UI accepted `['needs_work', 'fair', 'strong']`
 *
 * — the POST-analysis `EnrichmentConfidenceTier` member list applied to the
 * PRE-analysis readiness field. The two sets overlap on `fair` and `needs_work`
 * and differ on exactly one member, so the mistranslation was invisible on two
 * thirds of all inputs and bit only at the top band: `"ready"` fell through the
 * allowlist to the `: 'fair'` default, and `canRunAnalysis` then attached
 * "Analysis available - consider improvements for better results" to the Run
 * button of a model the producer had just called ready.
 *
 * ⚠ ANTI-TAUTOLOGY PIN. The fixture below is CEE's ACTUAL response shape, read
 * at the bytes from olumi-assistants-service `staging`
 * `b35d09debc0c6843dbcbf7f28a4676810d77c278` — NOT from this repo's own types.
 * A control whose reference is the consumer's own type cannot detect this
 * defect class; it IS the defect. Sources:
 *   - `src/cee/graph-readiness/types.ts:8`
 *       `export type ReadinessLevel = "ready" | "fair" | "needs_work";`
 *   - `src/routes/assist.v1.graph-readiness.ts:29` (V1) / `:169` (V3) response
 *       types, both `readiness_level: "ready" | "fair" | "needs_work";`
 *   - `src/cee/graph-readiness/index.ts:198-201`
 *       `if (score >= READINESS_THRESHOLDS.ready) return "ready";`
 *   - `src/cee/graph-readiness/constants.ts:30-31` — `ready: 70`
 * `"strong"` is emitted by NO CEE code path for this field.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useReadinessStore } from '../readinessStore'
import { useCanvasStore } from '../../store'
import {
  clearInflightCache,
  CEE_READINESS_LEVELS,
} from '../../hooks/useGraphReadiness'
import { canRunAnalysis, getRunButtonTooltip } from '../../utils/canRunAnalysis'

// ── Mock fetch ──────────────────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

/**
 * CEE's `/assist/v1/graph-readiness` 200 body for a well-formed graph, verbatim
 * in shape from `CEEGraphReadinessResponseV1` at the SHA recorded above.
 * The score is 85 — comfortably over CEE's `ready` threshold of 70.
 */
const CEE_READY_RESPONSE = {
  readiness_score: 85,
  readiness_level: 'ready',
  confidence_level: 'high',
  confidence_explanation: 'Your model has good structure and connections',
  quality_factors: {},
  can_run_analysis: true,
  improvements: [],
} as const

function mockCeeResponse(body: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function seedCanvasWithNodes(count: number) {
  const nodes = Array.from({ length: count }, (_, i) => ({
    id: `node-${i}`,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: `Factor ${i}`, kind: 'factor' },
  }))
  const edges =
    count > 1
      ? [
          {
            id: 'edge-0-1',
            source: 'node-0',
            target: 'node-1',
            data: { weight: 0.5, direction: 'positive' },
          },
        ]
      : []
  useCanvasStore.setState({ nodes: nodes as any, edges: edges as any })
}

/** Drive one full fetch cycle and hand back what the store settled on. */
async function readinessAfterCeeSays(body: Record<string, unknown>) {
  mockFetch.mockResolvedValue(mockCeeResponse(body))
  seedCanvasWithNodes(4)
  useReadinessStore.getState().startListening()
  await vi.runAllTimersAsync()
  const { readiness } = useReadinessStore.getState()
  expect(readiness).not.toBeNull()
  return readiness!
}

beforeEach(() => {
  vi.useFakeTimers()
  mockFetch.mockReset()
  useReadinessStore.getState().reset()
  clearInflightCache()
})

afterEach(() => {
  useReadinessStore.getState().reset()
  vi.useRealTimers()
})

// ── The RED-first pin ───────────────────────────────────────────────

describe("CEE's top band survives the UI's front door", () => {
  it('preserves readiness_level "ready" instead of coercing it to "fair"', async () => {
    const readiness = await readinessAfterCeeSays({ ...CEE_READY_RESPONSE })

    // Pre-fix this read 'fair' — the producer's best-case answer caught by a
    // fall-through default written to catch malformed input.
    expect(readiness.readiness_level).toBe('ready')
    expect(readiness.readiness_score).toBe(85)
  })

  it('does NOT tell a model CEE called ready to go and improve itself', async () => {
    const readiness = await readinessAfterCeeSays({ ...CEE_READY_RESPONSE })

    // The one live consumer of the normalised level: OutputsDock:834 →
    // canRunAnalysis:243 → getRunButtonTooltip → the Run button's title.
    const gate = canRunAnalysis({
      graphHealth: null,
      readiness,
      hasBlockers: false,
      nodeCount: 4,
    })

    expect(gate.allowed).toBe(true)
    expect(gate.warning).toBeUndefined()
    expect(getRunButtonTooltip(gate)).toBeUndefined()
    // The exact string the user was shown pre-fix.
    expect(getRunButtonTooltip(gate) ?? '').not.toContain('consider improvements')
  })
})

// ── Positive controls ───────────────────────────────────────────────
//
// The fix must be a WIDENING, not a swap: every level accepted before must
// still flow through byte-identically, and the guard's safety purpose must
// survive intact.

describe('positive controls — the rest of the vocabulary is unchanged', () => {
  it.each([
    ['fair', 55],
    ['needs_work', 20],
    // Not a CEE value — emitted only by the UI's own CEE-down fallback. Kept
    // accepted so the fallback path (divergence 2, out of scope here) is not
    // disturbed by this change.
    ['strong', 85],
  ])('passes %s through unchanged', async (level, score) => {
    const readiness = await readinessAfterCeeSays({
      ...CEE_READY_RESPONSE,
      readiness_level: level,
      readiness_score: score,
    })

    expect(readiness.readiness_level).toBe(level)
    expect(readiness.readiness_score).toBe(score)
  })

  it('still warns on "fair" — the branch that was misfiring is intact, not deleted', async () => {
    const readiness = await readinessAfterCeeSays({
      ...CEE_READY_RESPONSE,
      readiness_level: 'fair',
      readiness_score: 55,
    })

    const gate = canRunAnalysis({
      graphHealth: null,
      readiness,
      hasBlockers: false,
      nodeCount: 4,
    })

    expect(gate.allowed).toBe(true)
    expect(gate.warning).toBe('Analysis available - consider improvements for better results')
  })

  it.each([
    ['an unknown vocabulary member', 'excellent'],
    ['a value from a different lifecycle', 'close_call'],
    ['garbage', '<script>'],
    ['a non-string', 42],
    ['null', null],
    ['undefined', undefined],
  ])('degrades %s safely to "fair"', async (_label, level) => {
    const readiness = await readinessAfterCeeSays({
      ...CEE_READY_RESPONSE,
      readiness_level: level,
    })

    // The guard is being re-pointed at the right vocabulary, NOT removed.
    expect(readiness.readiness_level).toBe('fair')
  })
})

// ── The producer mirror, asserted rather than assumed ────────────────

describe('the accepted set is the producer vocabulary', () => {
  it('accepts exactly the three levels CEE emits for readiness_level', () => {
    // Pinned to the CEE SHA in this file's header, not to the UI's own type.
    expect([...CEE_READINESS_LEVELS].sort()).toEqual(['fair', 'needs_work', 'ready'])
  })

  it('does not treat "strong" as a producer value', () => {
    expect(CEE_READINESS_LEVELS as readonly string[]).not.toContain('strong')
  })
})
