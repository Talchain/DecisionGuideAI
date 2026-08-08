/**
 * ROADMAP 2.954 — THE CAUSAL LENS MUST NOT SIGN OR SPEAK A STRENGTH NOBODY SET.
 *
 * THE DEFECT (found by #627's review, the LAST raw-signed channel in the
 * #625 → #627/2.935 → #629/2.950 family)
 * ---------------------------------------------------------------------------
 * The causal lens rendered `computeSignedMean(edgeData)` — a THIRD signing
 * function, absent from `resolveEdgeSignedStrengthDisplay`'s KNOWN SURVIVORS
 * list — through `useLensFilter`'s causal arm into three channels:
 *   · `causal-edge-label` printed `+0.50` — the `DEFAULT_EDGE_DATA.weight`
 *     constant, signed positive by the fallback `direction === 'negative' ?
 *     -1 : 1` — for edges whose strength and direction nobody stated;
 *   · the stroke colour claimed danger-red (a NEGATIVE-direction verdict) off
 *     the same fallback sign, on edges whose producer sent
 *     `effect_direction: 'unknown'` (ingestion strips the key, leaving an
 *     unstamped fallback `direction` that resolves `not_set`);
 *   · the stroke width reported a measured-looking thickness off the default.
 *
 * THE SHAPE OF THE FIX (parallel to #627/#629, deliberately)
 * ----------------------------------------------------------
 * `useLensFilter`'s causal arm now writes `resolveCausalLensEdgeParams(data)`
 * — a composition of the SAME resolver pair the main edge label uses
 * (`resolveEdgeSignedStrengthDisplay` / `resolveEdgeDirectionDisplay`), plus
 * `resolveEdgeValueDisplay` for the std / exists-probability channels. The
 * map's value shape carries `magnitude: number | null` and
 * `direction: 'positive' | 'negative' | null` — the legacy raw `mean` field is
 * GONE, so a stale consumer breaks loudly at the type level rather than
 * silently reading a fabricated sign.
 *
 * COPY (ratified in #629, reused byte-for-byte — no new copy): an unset
 * strength prints "not set" (the numeric channel's established form); an
 * unstated direction prints NO sign character and claims NO danger colour;
 * absent std / exists quantities keep this surface's existing absent forms
 * (label span omitted; table em dash).
 *
 * DEPLOYED FLAG POSTURE (derived 2026-08-08 at deployed tip bcee7479):
 * `netlify.toml` does NOT set `VITE_FEATURE_GRAPH_LENS`, but the SERVED
 * staging flags chunk (assets/flags-DBpusaUf.js, deploy of bcee7479) bakes
 * `VITE_FEATURE_GRAPH_LENS: "1"` (dashboard env — trap 18). Controls: known-ON
 * COMPARE_TAB reads "1", known-absent JOURNEY_TAB reads `void 0`, so the probe
 * discriminates. The lens surface is therefore MOUNTED on deployed staging;
 * this spec mocks the flag ON to match, and the mount-path block below asserts
 * the label mounts under exactly that posture (trap 3b).
 *
 * FIXTURES — real capture bytes through the real exported ingestion mapper
 * -----------------------------------------------------------------------
 * As in the #627/#629 templates: no hand-authored wire `data`. Every draft
 * fixture starts from a REAL edge in the committed `pricing-model.draft.json`
 * capture and goes through `mapDraftEdgeToCanvas`; unset variants delete wire
 * KEYS (or set the declared contract value `effect_direction: 'unknown'`).
 * The USER fixture is `{ ...USER_EDGE_DEFAULTS }` — byte-identical to the
 * store's own user-edge construction (`store.ts` onConnect, `data:
 * { ...USER_EDGE_DEFAULTS }`), which is the producer for user-drawn edges.
 *
 * CLAIM TYPES — nothing here claims more than one of these:
 *   1. Pure-function return values (`mapDraftEdgeToCanvas`, the resolvers,
 *      `resolveCausalLensEdgeParams`).
 *   2. Rendered text content and attribute values read off the DOM (the
 *      BaseEdge mock serialises the style props StyledEdge passes, so the
 *      stroke assertions bind to the component's output, not jsdom's CSS
 *      engine).
 * jsdom cannot prove VISIBILITY or layout (platform trap 3).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Position } from '@xyflow/react'
import { StyledEdge } from '../StyledEdge'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import {
  resolveEdgeDirectionDisplay,
  resolveEdgeSignedStrengthDisplay,
  resolveEdgeValueDisplay,
  resolveCausalLensEdgeParams,
} from '../../domain/edgeValueProvenance'
import { DEFAULT_EDGE_DATA, USER_EDGE_DEFAULTS } from '../../domain/edges'
import { UNSET_EDGE_STROKE_WIDTH, weightMagnitudeToStrokeWidth } from '../../utils/graphDisplayCalculations'
import { useEdgeLabelMode } from '../../store/edgeLabelMode'

const nodeKinds: Record<string, string> = {}

// Per-test lens state. The store mock reads THIS, so each test decides the
// lens mode and the exact params map entry the store carries — set via
// `renderCausal` below, which routes the data through the REAL producer.
const holder = vi.hoisted(() => ({
  lensActive: 'causal' as string,
  params: null as unknown,
  updateEdgeDataSpy: vi.fn(),
}))

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: ({ style }: any) => (
      <path
        data-testid="base-edge"
        data-stroke={String(style?.stroke)}
        data-stroke-width={String(style?.strokeWidth)}
      />
    ),
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({
      getNode: (id: string) =>
        nodeKinds[id]
          ? { id, type: nodeKinds[id], data: { label: id === 'src' ? 'Adoption friction' : 'Bottom-up growth' }, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 } }
          : null,
      getEdges: () => [],
      getNodes: () =>
        Object.entries(nodeKinds).map(([id, kind]) => ({
          id, type: kind, data: {}, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 },
        })),
    }),
    useStore: (selector: any) =>
      selector({
        nodes: Object.entries(nodeKinds).map(([id, kind]) => ({
          id, type: kind, data: {}, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 },
        })),
      }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: holder.updateEdgeDataSpy,
      runMeta: { ceeReview: null },
      results: { status: 'complete', report: null },
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
      viewMode: 'detailed',
      lens: {
        active: holder.lensActive,
        _dimmedEdgeIds: new Set<string>(),
        _sensitivityWeights: new Map<string, number>(),
        _sensitivityQuartiles: null,
        _fragileEdgeIds: new Set<string>(),
        _lensFragileLabels: new Map<string, string>(),
        _hiddenNodeIds: new Set<string>(),
        _hiddenEdgeIds: new Set<string>(),
        _causalEdgeParams: holder.params !== null
          ? new Map([['e-under-test', holder.params]])
          : new Map(),
        _evidenceNodeClass: new Map(),
        _evidenceEdgeClass: new Map(),
      },
    })
  ),
}))

vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })),
}))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
// DEPLOYED POSTURE: the served staging bundle bakes VITE_FEATURE_GRAPH_LENS "1"
// (derivation in the header). The lens surface is mounted; tests bind to it.
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => true }))
vi.mock('../../utils/fragileEdgeMatch', () => ({
  isEdgeFragile: () => false,
  getFragileEdgeSwitchProbability: () => null,
  isTopFragileEdge: () => false,
}))
// ⛔ importOriginal-SPREAD, never a hand-listed replacement (CLAUDE.md trap 12).
// `weightMagnitudeToStrokeWidth` and `UNSET_EDGE_STROKE_WIDTH` stay REAL — the
// width assertions below bind to the genuine band mapping.
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  existenceCertaintyToLineStyle: () => undefined,
  calculateEdgeImportance: () => 0.5,
  importanceToStrokeWidth: () => 7,
}))
vi.mock('../../theme/edges', () => ({ applyEdgeVisualProps: (_: any, props: any) => props }))

const baseProps = {
  id: 'e-under-test', source: 'src', target: 'tgt',
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Right, targetPosition: Position.Left,
  selected: false,
}

// ── Fixtures: real capture edges, through the real ingestion mapper ──────────

type WireEdge = Record<string, unknown>

function captureEdges(file: string): WireEdge[] {
  const p = resolve(__dirname, '../../starters/data', file)
  const j = JSON.parse(readFileSync(p, 'utf8'))
  const edges = (j.edges ?? j.graph?.edges ?? []) as WireEdge[]
  expect(edges.length, `${file} carried no edges`).toBeGreaterThan(0)
  return edges
}

function findEdge(file: string, from: string, to: string): WireEdge {
  const hit = captureEdges(file).find(e => e.from === from && e.to === to)
  expect(hit, `${file} no longer carries ${from} → ${to}`).toBeDefined()
  return hit as WireEdge
}

/** The PRODUCER. Whatever ingestion writes is what the lens sees. */
function ingest(wire: WireEdge): Record<string, unknown> {
  return mapDraftEdgeToCanvas(wire, 0).data as Record<string, unknown>
}

/** Same real negative edge the #627/#629 templates pinned: mean −0.3504, stated negative. */
const SET_WIRE = findEdge('pricing-model.draft.json', 'fac_adoption_friction', 'out_bottom_up_growth')

/** A stated edge whose |mean| (0.5) sits in the 2px band — width discrimination. */
const STRONG_WIRE = findEdge('pricing-model.draft.json', 'fac_enterprise_revenue_risk', 'out_nrr')

/**
 * The producer EXPLICITLY declined a direction — `effect_direction: 'unknown'`
 * is a declared 0.30.0 contract member (#627's own fixture technique).
 * Ingestion strips the key and falls back to an UNSTAMPED `direction` derived
 * from the mean's sign, so the resolver refuses (`not_set`) while the raw
 * signed value (−0.3504) sits right there to be leaked. THE defect input.
 */
const UNKNOWN_DIR_WIRE: WireEdge = { ...SET_WIRE, effect_direction: 'unknown' }

/** STRENGTH UNSET, direction still stated: the one strength-bearing key deleted. */
const NO_STRENGTH_WIRE: WireEdge = (() => {
  const { strength: _s, ...rest } = SET_WIRE as Record<string, unknown> & { strength?: unknown }
  return rest
})()

/** NEITHER half stated: strength AND the stated direction both deleted. */
const NEITHER_WIRE: WireEdge = (() => {
  const { effect_direction: _d, ...rest } = NO_STRENGTH_WIRE as Record<string, unknown> & { effect_direction?: unknown }
  return rest
})()

const SET_DATA = ingest(SET_WIRE)
const STRONG_DATA = ingest(STRONG_WIRE)
const UNKNOWN_DIR_DATA = ingest(UNKNOWN_DIR_WIRE)
const NO_STRENGTH_DATA = ingest(NO_STRENGTH_WIRE)
const NEITHER_DATA = ingest(NEITHER_WIRE)

/**
 * A user-drawn edge, byte-identical to the store's own construction site
 * (`store.ts` onConnect: `data: { ...USER_EDGE_DEFAULTS }`). Every channel is
 * an unstamped default: weight 0.3, direction 'positive', beliefExists 0.8,
 * strengthStd 0.15 — the lens previously printed ALL FOUR as measurements.
 */
const USER_DATA: Record<string, unknown> = { ...USER_EDGE_DEFAULTS }

// ── Render helpers, bound by identity (CLAUDE.md trap 19) ────────────────────

/** Route data through the REAL producer, then render under the causal lens. */
function renderCausal(data: Record<string, unknown>) {
  holder.lensActive = 'causal'
  holder.params = resolveCausalLensEdgeParams(data)
  return render(<StyledEdge {...(baseProps as any)} data={data} />)
}

function causalLabel(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-testid="causal-edge-label"]')
}

function causalLabelText(container: HTMLElement): string {
  const el = causalLabel(container)
  expect(el, 'the causal lens label did not render').not.toBeNull()
  return (el as HTMLElement).textContent ?? ''
}

function baseEdgeAttr(container: HTMLElement, attr: 'data-stroke' | 'data-stroke-width'): string {
  const el = container.querySelector('[data-testid="base-edge"]')
  expect(el, 'BaseEdge did not render').not.toBeNull()
  return (el as HTMLElement).getAttribute(attr) ?? ''
}

const DANGER_STROKE = 'var(--semantic-danger, #ef4444)'
const NEUTRAL_STROKE = 'var(--text-body, #3F3F3E)'
/** Any character that claims a sign: ASCII plus/minus or U+2212 MINUS SIGN. */
const SIGN_CHARS = /[+\-−]/

describe('StyledEdge causal lens — provenance-gated params (ROADMAP 2.954, #629 lineage)', () => {
  beforeEach(() => {
    for (const k of Object.keys(nodeKinds)) delete nodeKinds[k]
    nodeKinds.src = 'factor'
    nodeKinds.tgt = 'outcome'
    holder.lensActive = 'causal'
    holder.params = null
    holder.updateEdgeDataSpy.mockClear()
    vi.mocked(useEdgeLabelMode).mockImplementation((selector: any) => selector({ mode: 'human' }))
  })

  // ── PRECONDITIONS. Pin the fixtures in-test so a discriminator can never
  //    silently stop discriminating (trap 13b). If ingestion changes shape,
  //    THIS block REDs — not a downstream assertion passing for the wrong
  //    reason.
  describe('fixture preconditions (derived from the producer, not assumed)', () => {
    it('SET: producer-stamped strength (negative, Moderate band), direction, std and likelihood', () => {
      expect((SET_WIRE as any).strength.mean).toBeCloseTo(-0.3504, 3)
      expect((SET_WIRE as any).exists_probability).toBe(0.88)
      expect(resolveEdgeSignedStrengthDisplay(SET_DATA)).toEqual(
        expect.objectContaining({ show: true, source: 'cee' }),
      )
      expect(resolveEdgeDirectionDisplay(SET_DATA)).toEqual(
        expect.objectContaining({ show: true, direction: 'negative', source: 'cee' }),
      )
      expect(resolveEdgeValueDisplay(SET_DATA, 'strengthStd')).toEqual(
        expect.objectContaining({ show: true, source: 'cee' }),
      )
      expect(resolveEdgeValueDisplay(SET_DATA, 'beliefExists')).toEqual(
        expect.objectContaining({ show: true, value: 0.88, source: 'cee' }),
      )
    })

    it('STRONG: |mean| = 0.5 sits in the 2px width band — discriminating from the 1.5 unset floor', () => {
      expect((STRONG_WIRE as any).strength.mean).toBe(-0.5)
      expect((STRONG_WIRE as any).exists_probability).toBe(0.92)
      expect(weightMagnitudeToStrokeWidth(0.5)).toBe(2)
      expect(UNSET_EDGE_STROKE_WIDTH).toBe(1.5)
      expect(resolveEdgeDirectionDisplay(STRONG_DATA)).toEqual(
        expect.objectContaining({ show: true, direction: 'negative' }),
      )
    })

    it('UNKNOWN-direction: strength stamped, direction UNSTAMPED — and the resolved signed value is negative', () => {
      // The trap input, asserted rather than described: the resolver's value
      // carries a MINUS the direction resolver refuses to endorse. An
      // implementation leaking that sign renders "−"/danger here and the
      // defect assertions below RED.
      const strength = resolveEdgeSignedStrengthDisplay(UNKNOWN_DIR_DATA)
      expect(strength).toEqual(expect.objectContaining({ show: true, source: 'cee' }))
      expect((strength as { value: number }).value).toBeLessThan(0)
      expect(resolveEdgeDirectionDisplay(UNKNOWN_DIR_DATA)).toEqual({ show: false, reason: 'not_set' })
      // Ingestion strips the raw key but writes a plausible fallback — the trap.
      expect(UNKNOWN_DIR_DATA.direction).toBe('negative')
      expect(UNKNOWN_DIR_DATA.directionSource).toBeUndefined()
    })

    it('NO-STRENGTH: weight is the DEFAULT constant, unstamped — direction still stated', () => {
      expect(NO_STRENGTH_DATA.weight).toBe(DEFAULT_EDGE_DATA.weight)
      expect(NO_STRENGTH_DATA.weightSource).toBeUndefined()
      expect(resolveEdgeSignedStrengthDisplay(NO_STRENGTH_DATA)).toEqual({ show: false, reason: 'not_set' })
      expect(resolveEdgeDirectionDisplay(NO_STRENGTH_DATA)).toEqual(
        expect.objectContaining({ show: true, direction: 'negative', source: 'cee' }),
      )
    })

    it('NEITHER: both halves unset while the raw fields still look plausible', () => {
      expect(NEITHER_DATA.weight).toBe(DEFAULT_EDGE_DATA.weight)
      expect(NEITHER_DATA.direction).toBe('positive')
      expect(NEITHER_DATA.directionSource).toBeUndefined()
      expect(resolveEdgeSignedStrengthDisplay(NEITHER_DATA)).toEqual({ show: false, reason: 'not_set' })
      expect(resolveEdgeDirectionDisplay(NEITHER_DATA)).toEqual({ show: false, reason: 'not_set' })
      // The likelihood IS the producer's here (exists_probability survived).
      expect(resolveEdgeValueDisplay(NEITHER_DATA, 'beliefExists')).toEqual(
        expect.objectContaining({ show: true, value: 0.88 }),
      )
    })

    it('USER edge: all four channels are unstamped defaults — nothing may speak', () => {
      expect(USER_DATA.weight).toBe(0.3)
      expect(USER_DATA.direction).toBe('positive')
      expect(USER_DATA.beliefExists).toBe(0.8)
      expect(USER_DATA.strengthStd).toBe(0.15)
      expect(resolveEdgeSignedStrengthDisplay(USER_DATA)).toEqual({ show: false, reason: 'not_set' })
      expect(resolveEdgeDirectionDisplay(USER_DATA)).toEqual({ show: false, reason: 'not_set' })
      expect(resolveEdgeValueDisplay(USER_DATA, 'beliefExists')).toEqual({ show: false, reason: 'not_set' })
      expect(resolveEdgeValueDisplay(USER_DATA, 'strengthStd')).toEqual({ show: false, reason: 'not_set' })
    })

    it('wire spelling guard: `strength` is the only strength key, so deleting it deletes the claim', () => {
      expect(SET_WIRE).not.toHaveProperty('strength_mean')
      expect(SET_WIRE).not.toHaveProperty('weight')
      expect(NO_STRENGTH_WIRE).not.toHaveProperty('strength')
      expect(NEITHER_WIRE).not.toHaveProperty('strength')
      expect(NEITHER_WIRE).not.toHaveProperty('effect_direction')
    })
  })

  // ── THE PRODUCER (resolveCausalLensEdgeParams) ────────────────────────────

  describe('resolveCausalLensEdgeParams — the one owner of "may the lens speak?"', () => {
    it('SET: all four channels speak the producer values', () => {
      const p = resolveCausalLensEdgeParams(SET_DATA)
      expect(p.magnitude).toBeCloseTo(0.3504, 3)
      expect(p.direction).toBe('negative')
      expect(p.std).toBeCloseTo(0.109, 3)
      expect(p.existsProb).toBe(0.88)
    })

    it('UNKNOWN direction: the magnitude speaks UNSIGNED and the direction refuses', () => {
      const p = resolveCausalLensEdgeParams(UNKNOWN_DIR_DATA)
      expect(p.magnitude).toBeCloseTo(0.3504, 3)
      expect(p.magnitude).toBeGreaterThan(0) // no raw-sign leak into the magnitude
      expect(p.direction).toBeNull()
    })

    it('NO strength: the magnitude refuses while the stated direction still speaks', () => {
      const p = resolveCausalLensEdgeParams(NO_STRENGTH_DATA)
      expect(p.magnitude).toBeNull()
      expect(p.direction).toBe('negative')
      expect(p.std).toBeNull()
      expect(p.existsProb).toBe(0.88)
    })

    it('NEITHER: magnitude and direction both refuse', () => {
      const p = resolveCausalLensEdgeParams(NEITHER_DATA)
      expect(p.magnitude).toBeNull()
      expect(p.direction).toBeNull()
    })

    it('USER edge: every channel refuses — no default reaches the lens', () => {
      const p = resolveCausalLensEdgeParams(USER_DATA)
      expect(p).toEqual({ magnitude: null, direction: null, std: null, existsProb: null })
    })
  })

  // ── MOUNT PATH (trap 3b: bind to the surface the deployed flags mount) ────

  describe('mount path under the deployed posture (flag ON, causal lens active)', () => {
    it('the causal label MOUNTS for a stated edge under the causal lens', () => {
      const { container } = renderCausal(SET_DATA)
      expect(causalLabel(container)).not.toBeNull()
    })

    it('the causal label does NOT mount outside the causal lens (the mount switch is real)', () => {
      holder.lensActive = 'full'
      holder.params = resolveCausalLensEdgeParams(SET_DATA)
      const { container } = render(<StyledEdge {...(baseProps as any)} data={SET_DATA} />)
      expect(causalLabel(container)).toBeNull()
    })
  })

  // ── THE NAMED DEFECT, per channel ─────────────────────────────────────────

  describe('the label channel', () => {
    it('SET: prints the stated sign (U+2212), the magnitude and the producer likelihood', () => {
      const { container } = renderCausal(SET_DATA)
      expect(causalLabelText(container)).toBe('−0.35 (88%)')
    })

    it('UNKNOWN direction: prints the BARE magnitude — no sign character of any kind [ROADMAP 2.954]', () => {
      const { container } = renderCausal(UNKNOWN_DIR_DATA)
      const text = causalLabelText(container)
      expect(text).toBe('0.35 (88%)')
      expect(text).not.toMatch(SIGN_CHARS)
    })

    it('NO strength: says "not set", never the 0.50 constant [ROADMAP 2.954]', () => {
      const { container } = renderCausal(NO_STRENGTH_DATA)
      const text = causalLabelText(container)
      expect(text).toContain('not set')
      expect(text).not.toContain('0.50')
      expect(text).not.toContain('+')
      // The likelihood IS the producer's (exists_probability 0.88) — it may speak.
      expect(text).toBe('not set (88%)')
    })

    it('NEITHER: says "not set" — the fabricated "+0.50" is gone [ROADMAP 2.954]', () => {
      const { container } = renderCausal(NEITHER_DATA)
      const text = causalLabelText(container)
      expect(text).toBe('not set (88%)')
      expect(text).not.toContain('+0.50')
    })

    it('USER edge: "not set" alone — no fabricated likelihood "(80%)" either [ROADMAP 2.954]', () => {
      const { container } = renderCausal(USER_DATA)
      const text = causalLabelText(container)
      expect(text).toBe('not set')
      expect(text).not.toContain('(80')
      expect(text).not.toContain('0.30')
    })
  })

  describe('the stroke colour channel (danger = a NEGATIVE-direction claim)', () => {
    it('SET: a stated negative claims danger', () => {
      const { container } = renderCausal(SET_DATA)
      expect(baseEdgeAttr(container, 'data-stroke')).toBe(DANGER_STROKE)
    })

    it('UNKNOWN direction: the stroke does NOT claim danger off the raw sign [ROADMAP 2.954]', () => {
      const { container } = renderCausal(UNKNOWN_DIR_DATA)
      expect(baseEdgeAttr(container, 'data-stroke')).toBe(NEUTRAL_STROKE)
    })

    it('NO strength: the stroke keeps the STATED negative — refusing the number is not refusing the direction', () => {
      const { container } = renderCausal(NO_STRENGTH_DATA)
      expect(baseEdgeAttr(container, 'data-stroke')).toBe(DANGER_STROKE)
    })

    it('NEITHER: neutral — no claim from the fallback "positive" either', () => {
      const { container } = renderCausal(NEITHER_DATA)
      expect(baseEdgeAttr(container, 'data-stroke')).toBe(NEUTRAL_STROKE)
    })
  })

  describe('the stroke width channel (thickness = a strength measurement)', () => {
    it('STRONG (|mean| 0.5): width reads the magnitude band (2px), sign irrelevant', () => {
      const { container } = renderCausal(STRONG_DATA)
      expect(baseEdgeAttr(container, 'data-stroke-width')).toBe('2')
    })

    it('NO strength: width sits at the UNSET floor, never a band derived from the default [ROADMAP 2.954]', () => {
      const { container } = renderCausal(NO_STRENGTH_DATA)
      expect(baseEdgeAttr(container, 'data-stroke-width')).toBe(String(UNSET_EDGE_STROKE_WIDTH))
    })

    it('USER edge: width sits at the UNSET floor too', () => {
      const { container } = renderCausal(USER_DATA)
      expect(baseEdgeAttr(container, 'data-stroke-width')).toBe(String(UNSET_EDGE_STROKE_WIDTH))
    })
  })
})
