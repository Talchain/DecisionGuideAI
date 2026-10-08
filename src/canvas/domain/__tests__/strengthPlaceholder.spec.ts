/**
 * POM-8 (27 Sep 2026) — a PLACEHOLDER strength survives every ingestion hop, a
 * save and a reload, and stops reading as a placeholder the moment it is not one.
 *
 * Corpus: Paul's own board, `e2e/geometry/fixtures/mrr-17d1cd3a.fixture.json`
 * (the served draft the finding was measured on) — not a hand-written wire edge.
 * Its three `olumi_placeholder` edges are "Pro plan price → MRR" (0.5, WITH a
 * natural effect), "Price sensitivity → Monthly churn" (0.0075) and "Pro paying
 * subscribers → MRR" (0.15) — the last two carry no natural effect, so before
 * this change the label was lost entirely at ingestion. Contrast: "Pro plan price
 * → Monthly new Pro subscribers", an `olumi_estimate` at −0.4.
 *
 * Bound by IDENTITY (the wire's from/to pair), never by list position.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import fixture from '../../../../e2e/geometry/fixtures/mrr-17d1cd3a.fixture.json'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { overlayEdge } from '../../utils/mergeAppliedGraph'
import { saveState, loadState } from '../../persist'
import {
  isStrengthPlaceholder,
  readWireStrengthIsPlaceholder,
  strengthPlaceholderPatch,
} from '../strengthPlaceholder'
import { EdgeDataSchema } from '../edges'
import { describeEdgeForSpeech } from '../edgeAccessibleName'

type WireEdge = Record<string, unknown> & { from: string; to: string }
const WIRE = (fixture as unknown as { draft: { edges: WireEdge[] } }).draft.edges
const wire = (from: string, to: string): WireEdge => {
  const e = WIRE.find((w) => w.from === from && w.to === to)
  expect(e, `${from} → ${to} is in the fixture`).toBeDefined()
  return e!
}
const PRICE_TO_MRR = wire('pro_plan_price', 'mrr')
const SENSITIVITY_TO_CHURN = wire('price_sensitivity', 'monthly_churn')
const SUBSCRIBERS_TO_MRR = wire('pro_paying_subscribers', 'mrr')
const PRICE_TO_NEW_SUBS = wire('pro_plan_price', 'monthly_new_pro_subscribers') // olumi_estimate, −0.4

// ── Hop 2 needs the store; driven through the public entry point, as
//    `edgeValidationMapperMirror.spec.ts` does. ──────────────────────────────
let storeNodes: any[] = []
let storeEdges: any[] = []
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(vi.fn(), {
    getState: () => ({
      nodes: storeNodes,
      edges: storeEdges,
      outcomeNodeId: null,
      ceeAnalysisReady: null,
      applyLayout: vi.fn(() => Promise.resolve()),
      setPendingLayout: vi.fn(),
      setOutcomeNode: vi.fn(),
      currentScenarioId: null,
    }),
    setState: vi.fn((update: any) => {
      if (update.nodes) storeNodes = update.nodes
      if (update.edges) storeEdges = update.edges
    }),
  }),
}))
vi.mock('../../store/scenarios', () => ({ saveAutosave: vi.fn() }))
const { applyAutoApplyPatch } = await import('../../conversation/utils/applyPatch')

function viaPatch(e: WireEdge) {
  storeNodes = [
    { id: e.from, type: 'factor', position: { x: 0, y: 0 }, data: { label: e.from } },
    { id: e.to, type: 'goal', position: { x: 0, y: 0 }, data: { label: e.to } },
  ]
  storeEdges = []
  applyAutoApplyPatch({
    block_type: 'graph_patch',
    auto_apply: true,
    operations: [{ op: 'add_edge', target_id: 'e1', data: { ...e } }],
  } as any)
  expect(storeEdges).toHaveLength(1)
  return storeEdges[0]
}

describe('the ONE wire reader', () => {
  it('reads olumi_placeholder, and nothing else, as a placeholder', () => {
    expect(readWireStrengthIsPlaceholder(PRICE_TO_MRR)).toBe(true)
    expect(readWireStrengthIsPlaceholder(SUBSCRIBERS_TO_MRR)).toBe(true)
    expect(readWireStrengthIsPlaceholder(PRICE_TO_NEW_SUBS)).toBe(false) // olumi_estimate
    expect(readWireStrengthIsPlaceholder({ from: 'a', to: 'b' })).toBe(false) // no provenance
  })

  it('a strength the person specified is never a placeholder, whatever the magnitude label says', () => {
    const userSaid = { ...PRICE_TO_MRR, provenance: { source: 'user_specified', magnitude: 'olumi_placeholder' } }
    expect(readWireStrengthIsPlaceholder(userSaid)).toBe(false)
  })

  it('a label on a strength the wire did not supply stores nothing', () => {
    expect(strengthPlaceholderPatch(PRICE_TO_MRR, 0.5, false)).toEqual({})
    expect(strengthPlaceholderPatch(PRICE_TO_MRR, 0.5, true)).toEqual({ strengthPlaceholder: 0.5 })
  })
})

describe('hop 1 (full draft) and hop 2 (patch receipt) carry the SAME placeholder', () => {
  beforeEach(() => {
    storeNodes = []
    storeEdges = []
  })

  it.each([
    ['Pro plan price → MRR (with a natural effect)', PRICE_TO_MRR, 0.5],
    ['Price sensitivity → Monthly churn (no natural effect)', SENSITIVITY_TO_CHURN, 0.0075],
    ['Pro paying subscribers → MRR (no natural effect)', SUBSCRIBERS_TO_MRR, 0.15],
  ])('%s', (_name, e, weight) => {
    const drafted = mapDraftEdgeToCanvas({ ...e }, 0)
    const patched = viaPatch(e)
    expect(drafted.data.strengthPlaceholder).toBe(weight)
    expect(patched.data.strengthPlaceholder).toBe(weight)
    expect(isStrengthPlaceholder(drafted.data)).toBe(true)
    expect(isStrengthPlaceholder(patched.data)).toBe(true)
    // The whole bag agrees across the two hops (the mirror rule).
    const keys = new Set([...Object.keys(drafted.data), ...Object.keys(patched.data)])
    const differing = [...keys].filter((k) => JSON.stringify(drafted.data[k]) !== JSON.stringify(patched.data[k]))
    expect(differing).toEqual([])
  })

  it('CONTRAST: an olumi_estimate edge carries no key at either hop', () => {
    const drafted = mapDraftEdgeToCanvas({ ...PRICE_TO_NEW_SUBS }, 0)
    const patched = viaPatch(PRICE_TO_NEW_SUBS)
    expect('strengthPlaceholder' in drafted.data).toBe(false)
    expect('strengthPlaceholder' in patched.data).toBe(false)
    expect(isStrengthPlaceholder(drafted.data)).toBe(false)
  })

  it('hop 3 (DraftChat) calls the same reader and keeps the key out of the wire remainder (source pin)', () => {
    // DraftChat's mapper is inline in the component; a render harness for it
    // would need a full draft turn. This pins the two lines that make it hop 3
    // of the one reader — stated as a source pin, not a behaviour witness.
    const src = readFileSync(path.resolve(__dirname, '../../components/DraftChat.tsx'), 'utf8')
    expect(src).toMatch(/\.\.\.strengthPlaceholderPatch\(e as Record<string, unknown>, weight, weightSource !== 'default'\)/)
    expect(src).toMatch(/strengthPlaceholder: _strengthPlaceholder,\s*\n\s*\.\.\.edgeRest/)
  })
})

describe('it retires itself — no writer clears it', () => {
  const drafted = () => mapDraftEdgeToCanvas({ ...PRICE_TO_MRR }, 0).data as Record<string, unknown>

  it('a person setting the strength ends it (weightSource: user)', () => {
    expect(isStrengthPlaceholder({ ...drafted(), weight: 0.5, weightSource: 'user' })).toBe(false)
  })

  it('a new producer figure ends it (the magnitude moved)', () => {
    expect(isStrengthPlaceholder({ ...drafted(), weight: 0.62 })).toBe(false)
  })

  it('CONTRAST: the untouched placeholder is still one', () => {
    expect(isStrengthPlaceholder(drafted())).toBe(true)
  })
})

describe('it survives a save and a reload', () => {
  it('local save → load keeps the key, and the loaded edge still reads as a placeholder', () => {
    const edge = { ...mapDraftEdgeToCanvas({ ...PRICE_TO_MRR }, 6), type: 'styled' }
    expect(saveState({ nodes: [], edges: [edge] as any })).toBe(true)
    const loaded = loadState()
    expect(loaded).not.toBeNull()
    const back = loaded!.edges.find((e) => e.id === edge.id)!
    expect((back.data as Record<string, unknown>).strengthPlaceholder).toBe(0.5)
    expect(isStrengthPlaceholder(back.data as Record<string, unknown>)).toBe(true)
  })

  it('the edge-data schema declares the key (a strict parse would keep it too)', () => {
    const parsed = EdgeDataSchema.parse(mapDraftEdgeToCanvas({ ...PRICE_TO_MRR }, 0).data)
    expect(parsed.strengthPlaceholder).toBe(0.5)
  })

  it('a server readback of the same edge keeps it; one that no longer labels it removes it', () => {
    const canvas = mapDraftEdgeToCanvas({ ...PRICE_TO_MRR }, 6)
    const same = overlayEdge(canvas, { ...PRICE_TO_MRR }, { acquireServerStrengthOnNoop: true })
    expect(same.data.strengthPlaceholder).toBe(0.5)
    const relabelled = { ...PRICE_TO_MRR, provenance: { source: 'cee_hypothesis', magnitude: 'olumi_estimate' } }
    const after = overlayEdge(canvas, relabelled, { acquireServerStrengthOnNoop: true })
    expect('strengthPlaceholder' in after.data).toBe(false)
    expect(isStrengthPlaceholder(after.data)).toBe(false)
  })

  // The "never an edit" half — no counted update, no history — is driven
  // through the real store in `utils/__tests__/mergeAppliedGraph.strengthPlaceholderAcquire.spec.ts`.
  it('a readback onto a canvas saved BEFORE the key existed acquires it, as a no-op (never an edit)', () => {
    const older = mapDraftEdgeToCanvas({ ...PRICE_TO_MRR }, 6)
    delete older.data.strengthPlaceholder
    const after = overlayEdge(older, { ...PRICE_TO_MRR }, { acquireServerStrengthOnNoop: true })
    expect(after.data.strengthPlaceholder).toBe(0.5)
  })
})

describe('the words agree with the thin grey line (Science 393023 LICENCE ruling 3)', () => {
  const drafted = () => mapDraftEdgeToCanvas({ ...PRICE_TO_MRR }, 0).data as Record<string, unknown>

  it('a placeholder link is NAMED "strength not set", never a band nobody chose', () => {
    expect(isStrengthPlaceholder(drafted())).toBe(true)
    const words = describeEdgeForSpeech(drafted(), 'human')
    expect(words).toMatch(/strength not set/)
    expect(words).not.toMatch(/^(Slight|Moderate|Strong|Very strong) (boost|drag)/)
  })

  it('CONTROL: the same link once a person sets it is named by its band', () => {
    const words = describeEdgeForSpeech({ ...drafted(), weight: 0.5, weightSource: 'user' }, 'human')
    expect(words).not.toMatch(/strength not set/)
    expect(words).toMatch(/(boost|drag)/)
  })

  it("CONTROL: an olumi_estimate link keeps its band (Olumi's estimate is a size)", () => {
    const words = describeEdgeForSpeech(mapDraftEdgeToCanvas({ ...PRICE_TO_NEW_SUBS }, 0).data, 'human')
    expect(words).not.toMatch(/strength not set/)
  })
})
