/**
 * THE PRODUCER'S COACHING ARRIVES AS `quality_factors`, AND NOTHING READ IT.
 *
 * ── THE DEFECT, MEASURED ON THE WIRE ────────────────────────────────────────
 * Deployed staging `515214b8`, guest, seeded model. The
 * `/bff/cee/graph-readiness` response carries NO `improvements` key at all. It
 * carries `quality_factors`, six deep, each with a `recommendation`, an
 * `impact` and a `potential_improvement`:
 *
 *   "Connect outcomes to goals so analysis can measure success against objectives"
 *   "Link risk nodes to the options they affect"
 *   "Add outcomes (positive and negative) for each option"
 *
 * `readinessStore` published `improvements: []` on every one of those
 * responses, because the read named only `data.improvements`.
 *
 * ── WHY THAT COST MORE THAN A COLLAPSED PANEL ───────────────────────────────
 * `composeBlockedReason.producerAuthoredImprovement` was ALREADY BUILT to
 * render these as the refusal the user sees, and its header says exactly what
 * the empty list produced: the panel *"discarded named, structured,
 * user-readable remedies and sent the user elsewhere for them"* — the
 * "ask in the chat and it will explain what is missing" dead end. Producer
 * built, two consumers built, one missing link between them.
 *
 * ── WHAT THESE CASES PIN ────────────────────────────────────────────────────
 * The per-item mapper already spoke this shape (`imp.recommendation`,
 * `imp.potential_improvement`, `imp.impact`); only the ARRAY was unwired. So
 * these bind to the FIELD NAMES a quality factor actually uses, because that is
 * the part that was broken — a case built from an `improvements`-shaped fixture
 * would have passed throughout the defect.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useReadinessStore } from '../readinessStore'
import { useCanvasStore } from '../../store'
import { clearInflightCache } from '../../hooks/useGraphReadiness'
import { IMPROVEMENT_ACTION_PLACEHOLDER } from '../../utils/improvementActionPlaceholder'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })

/** Verbatim from the staging capture — not a hand-written approximation. */
const WIRE_QUALITY_FACTORS = [
  {
    factor: 'goal_outcome_linkage',
    current_score: 80,
    impact: 'high',
    recommendation: 'Connect outcomes to goals so analysis can measure success against objectives',
    potential_improvement: 20,
  },
  {
    factor: 'risk_coverage',
    current_score: 50,
    impact: 'medium',
    recommendation: 'Link risk nodes to the options they affect',
    potential_improvement: 40,
  },
  {
    factor: 'option_diversity',
    current_score: 75,
    impact: 'low',
    recommendation: 'Consider adding more alternative options',
    potential_improvement: 25,
  },
]

function response(body: Record<string, unknown>) {
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
        ...body,
      }),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  }
}

function seedCanvas(count: number) {
  const nodes = Array.from({ length: count }, (_, i) => ({
    id: `node-${i}`,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: `Factor ${i}`, kind: 'factor' },
  }))
  useCanvasStore.setState({ nodes: nodes as never, edges: [] as never })
}

async function drive(body: Record<string, unknown>) {
  mockFetch.mockResolvedValue(response(body))
  seedCanvas(3)
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

describe("the producer's quality factors reach the user", () => {
  it('publishes a quality_factors-only response as improvements — the defect', async () => {
    // ⚠ NOTE THE FIXTURE: `improvements` is ABSENT, exactly as the real
    // response has it. That absence is the precondition; a fixture carrying
    // both fields could not observe this defect at all.
    const improvements = await drive({ quality_factors: WIRE_QUALITY_FACTORS })
    expect(improvements).toHaveLength(3)
  })

  it("renders the producer's own sentence, not a synthesised one", async () => {
    const improvements = await drive({ quality_factors: WIRE_QUALITY_FACTORS })

    // Bound by identity — the factor this row came from — never by position.
    const linkage = improvements.find(i => i.category === 'goal_outcome_linkage')
    expect(linkage).toBeDefined()
    expect(linkage!.action).toBe(
      'Connect outcomes to goals so analysis can measure success against objectives',
    )
    // ⛔ The store fabricates a placeholder when a producer supplies no remedy,
    // and `composeBlockedReason` REFUSES that value. If these rows arrived
    // fabricated they would be silently dropped from the refusal again.
    expect(improvements.every(i => i.action !== IMPROVEMENT_ACTION_PLACEHOLDER)).toBe(true)
  })

  it("maps the quality factor's own field names, which is the half that was broken", async () => {
    const improvements = await drive({ quality_factors: WIRE_QUALITY_FACTORS })
    const risk = improvements.find(i => i.category === 'risk_coverage')!

    expect(risk.priority).toBe('medium')        // from `impact`
    expect(risk.quality_impact).toBe(40)        // from `potential_improvement`
    expect(risk.current_score).toBe(50)         // from `current_score`
  })

  it('preserves priority ORDER as distinct values, so the tier can rank them', async () => {
    const improvements = await drive({ quality_factors: WIRE_QUALITY_FACTORS })
    // A mapping that collapsed every impact to the 'medium' default would
    // satisfy the single-row case above while destroying the ranking.
    expect(improvements.map(i => i.priority)).toEqual(['high', 'medium', 'low'])
  })

  it('⛔ PRECEDENCE — a real `improvements` array still wins', async () => {
    // It is the richer shape (it can name affected nodes and edges). This
    // change only stops an EMPTY list when the coaching is under the other
    // name; it must never override a producer that sends the real thing.
    const improvements = await drive({
      improvements: [{ category: 'values', action: 'The richer shape' }],
      quality_factors: WIRE_QUALITY_FACTORS,
    })
    expect(improvements).toHaveLength(1)
    expect(improvements[0].action).toBe('The richer shape')
  })

  it('an EMPTY improvements array does not beat a populated quality_factors', async () => {
    // Found by review of this PR. `Array.isArray([])` is true, so the first
    // arm would have won and published `[]` — the exact state this fix exists
    // to end, reached through the other door. Unreachable on today's producer
    // (it sends no `improvements` key at all), which is why this is a guard
    // rather than a repair: a producer that starts sending an empty array
    // would otherwise silently reinstate the defect.
    const improvements = await drive({ improvements: [], quality_factors: WIRE_QUALITY_FACTORS })
    expect(improvements).toHaveLength(3)
  })

  it('CONTROL — neither field present still publishes an empty list', async () => {
    // Anti-vacuity: the fetch DID settle (the store holds a verdict), and only
    // then is the empty list meaningful rather than a sign nothing ran.
    const improvements = await drive({})
    expect(useReadinessStore.getState().readiness).not.toBeNull()
    expect(improvements).toEqual([])
  })
})
