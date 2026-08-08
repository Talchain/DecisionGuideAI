/**
 * ROADMAP 2.950 — THE LABEL'S STRENGTH ADJECTIVE MUST COME FROM THE RESOLVER,
 * NOT FROM A RAW `weight` THE UI DEFAULTS FABRICATE.
 *
 * THE DEFECT, IN THE PRODUCT'S OWN WORDS
 * --------------------------------------
 * #627 (ROADMAP 2.935) gated the label's DIRECTION word: an unstated direction
 * now renders "…, direction not stated" instead of "boost". But the SAME string's
 * other clause still read a band adjective off `edgeData?.weight ?? 0.5` — a
 * number `DEFAULT_EDGE_DATA.weight = 0.5` / `USER_EDGE_DEFAULTS.weight = 0.3`
 * define on every edge whether anyone set it or not. So an edge whose strength
 * NOBODY characterised rendered **"Moderate effect, direction not stated"**:
 * the direction half refuses to claim while the strength half asserts a band
 * derived from a UI constant. Same fabrication class, other clause.
 *
 * THE SHAPE OF THE FIX (parallel to #627, deliberately)
 * -----------------------------------------------------
 * `describeEdge` now takes a required `EdgeValueDisplay` resolved by
 * `resolveEdgeSignedStrengthDisplay` — the SAME resolver that already gates this
 * component's stroke width — so "0.5, source unknown" is not expressible at the
 * type level, exactly as `EdgeDirectionDisplay` made "positive, source unknown"
 * inexpressible.
 *
 * COPY (ratified in the row's brief): when NEITHER strength nor direction is
 * set, the label reuses the hover popover's existing vocabulary —
 * "Strength and likelihood not set" (`edge-hover-popover-unset`) — no new copy.
 * When exactly one half has provenance, that half speaks and the other half
 * says only that it was not set.
 *
 * FIXTURES — real capture bytes through the real exported ingestion mapper
 * -----------------------------------------------------------------------
 * As in the 2935 template: no hand-authored `data`. Every fixture starts from a
 * REAL edge in a committed CEE draft capture and goes through
 * `mapDraftEdgeToCanvas`. The unset variants delete wire KEYS from the real
 * edge (the template's own technique for `effect_direction: 'unknown'`), so
 * every remaining byte is the producer's. Derived and pinned below: all five
 * committed captures carry `strength` + a stated `effect_direction` on every
 * edge, so the unset-strength states arise from the mapper's DEFAULT arm — the
 * exact arm the defect fabricated from.
 *
 * ⚠ WHAT MAKES THE NO-STRENGTH FIXTURE SHARP: the mapper's fallback weight is
 * `DEFAULT_EDGE_DATA.weight = 0.5`, which lands in the "Moderate" band — so an
 * implementation still reading the raw number prints "Moderate" here and the
 * band assertions RED. A fallback that landed outside every band could not
 * discriminate. The preconditions block pins this, so the fixture cannot
 * silently stop discriminating (CLAUDE.md trap 13b, third face).
 *
 * CLAIM TYPES — nothing here claims more than one of these:
 *   1. Pure-function return values (`mapDraftEdgeToCanvas`, the resolvers).
 *   2. Rendered text content and attribute values read off the DOM.
 *   3. Arguments captured by a store-boundary spy (`updateEdgeData`).
 * jsdom cannot prove VISIBILITY or layout (platform trap 3).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Position } from '@xyflow/react'
import { StyledEdge } from '../StyledEdge'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import {
  resolveEdgeDirectionDisplay,
  resolveEdgeSignedStrengthDisplay,
} from '../../domain/edgeValueProvenance'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'
import { useEdgeLabelMode } from '../../store/edgeLabelMode'

const nodeKinds: Record<string, string> = {}

// Stable spy — the store mock must NOT mint a fresh vi.fn per selector call, or
// the popover-stamp assertions below would capture nothing.
const { updateEdgeDataSpy } = vi.hoisted(() => ({ updateEdgeDataSpy: vi.fn() }))

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: ({ style }: any) => <path data-testid="base-edge" style={style} />,
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

// `showLabel` needs `isResultsMode` (results.status === 'complete') and a
// non-standard view with the edge selected — see edgeLabelVisibility.ts.
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: updateEdgeDataSpy,
      runMeta: { ceeReview: null },
      results: { status: 'complete', report: null },
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
      viewMode: 'detailed',
      lens: {
        active: 'full',
        _dimmedEdgeIds: new Set<string>(),
        _sensitivityWeights: new Map<string, number>(),
        _sensitivityQuartiles: null,
        _fragileEdgeIds: new Set<string>(),
        _lensFragileLabels: new Map<string, string>(),
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
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))
vi.mock('../../utils/fragileEdgeMatch', () => ({
  isEdgeFragile: () => false,
  getFragileEdgeSwitchProbability: () => null,
  isTopFragileEdge: () => false,
}))
// ⛔ importOriginal-SPREAD, never a hand-listed replacement (CLAUDE.md trap 12).
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  existenceCertaintyToLineStyle: () => undefined,
  calculateEdgeImportance: () => 0.5,
  importanceToStrokeWidth: () => 7,
  weightMagnitudeToStrokeWidth: () => 2,
}))
vi.mock('../../theme/edges', () => ({ applyEdgeVisualProps: (_: any, props: any) => props }))

const baseProps = {
  id: 'e-under-test', source: 'src', target: 'tgt',
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Right, targetPosition: Position.Left,
  selected: true,
}

// ── Fixtures: real capture edges, through the real ingestion mapper ──────────

type WireEdge = Record<string, unknown>

/** Read a committed CEE draft capture and return its edge list. */
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

/** The PRODUCER. Whatever ingestion writes is what the component sees. */
function ingest(wire: WireEdge): Record<string, unknown> {
  return mapDraftEdgeToCanvas(wire, 0).data as Record<string, unknown>
}

/** Same real negative edge the 2935 template pinned: mean −0.35, stated negative. */
const SET_WIRE = findEdge('pricing-model.draft.json', 'fac_adoption_friction', 'out_bottom_up_growth')

/**
 * STRENGTH UNSET, direction still stated: the real edge with its ONE
 * strength-bearing key deleted. (Pinned below: this wire edge carries no
 * `strength_mean` / `weight` spellings, so deleting `strength` deletes the
 * whole strength claim and the mapper takes its DEFAULT arm.)
 */
const NO_STRENGTH_WIRE: WireEdge = (() => {
  const { strength: _s, ...rest } = SET_WIRE as Record<string, unknown> & { strength?: unknown }
  return rest
})()

/** NEITHER set: strength key AND the stated direction both deleted. */
const NEITHER_WIRE: WireEdge = (() => {
  const { effect_direction: _d, ...rest } = NO_STRENGTH_WIRE as Record<string, unknown> & { effect_direction?: unknown }
  return rest
})()

const SET_DATA = ingest(SET_WIRE)
const NO_STRENGTH_DATA = ingest(NO_STRENGTH_WIRE)
const NEITHER_DATA = ingest(NEITHER_WIRE)

// ── DOM readers, bound by identity (CLAUDE.md trap 19) ──────────────────────

function labelEl(container: HTMLElement): HTMLElement {
  const el = container.querySelector('[data-testid="edge-influence-label"]') as HTMLElement | null
  expect(el, 'the edge influence label did not render').not.toBeNull()
  return el as HTMLElement
}

const labelText = (c: HTMLElement) => labelEl(c).textContent ?? ''
const labelTooltip = (c: HTMLElement) => labelEl(c).getAttribute('title') ?? ''
const labelAria = (c: HTMLElement) => labelEl(c).getAttribute('aria-label') ?? ''

/** Words that assert a strength BAND for the edge. */
const BAND_WORDS = ['strong', 'moderate', 'weak']

const hasAny = (s: string, words: string[]) =>
  words.some(w => s.toLowerCase().includes(w))

function renderEdge(data: Record<string, unknown>) {
  return render(<StyledEdge {...(baseProps as any)} data={data} />)
}

/** The ratified copy, byte-for-byte the popover's `edge-hover-popover-unset` text. */
const RATIFIED_UNSET_COPY = 'Strength and likelihood not set'

describe('StyledEdge edge label — strength words (ROADMAP 2.950, #627 lineage)', () => {
  beforeEach(() => {
    for (const k of Object.keys(nodeKinds)) delete nodeKinds[k]
    nodeKinds.src = 'factor'
    nodeKinds.tgt = 'outcome'
    updateEdgeDataSpy.mockClear()
    vi.mocked(useEdgeLabelMode).mockImplementation((selector: any) => selector({ mode: 'human' }))
  })

  // ── PRECONDITIONS. Pin the fixtures in-test so a discriminator can never
  //    silently stop discriminating (trap 13b). If ingestion changes shape,
  //    THIS block REDs — not a downstream assertion passing for the wrong
  //    reason.
  describe('fixture preconditions (derived from the producer, not assumed)', () => {
    it('the SET fixture has a producer-sourced strength in the Moderate band, direction stated', () => {
      expect((SET_WIRE as any).strength.mean).toBeLessThan(0)
      expect(SET_DATA.weightSource).toBe('cee')
      expect(resolveEdgeSignedStrengthDisplay(SET_DATA)).toEqual(
        expect.objectContaining({ show: true, source: 'cee' }),
      )
      expect(SET_DATA.weight as number).toBeGreaterThanOrEqual(0.3)
      expect(SET_DATA.weight as number).toBeLessThan(0.7)
      expect(resolveEdgeDirectionDisplay(SET_DATA)).toEqual(
        expect.objectContaining({ show: true, direction: 'negative' }),
      )
    })

    it('the wire edge spells its strength ONLY as `strength`, so deleting that key deletes the claim', () => {
      // Guards the fixture-construction technique itself: if the capture ever
      // gains a `strength_mean` / `weight` spelling, NO_STRENGTH_WIRE would
      // silently stop being strength-free and every assertion on it would test
      // the wrong state.
      expect(SET_WIRE).not.toHaveProperty('strength_mean')
      expect(SET_WIRE).not.toHaveProperty('weight')
      expect(NO_STRENGTH_WIRE).not.toHaveProperty('strength')
    })

    it('the NO-STRENGTH fixture lands on the UI default, unstamped — and in the Moderate band', () => {
      // The defect's mechanism, asserted rather than described: the mapper's
      // fallback IS the fabricated constant, and it falls in a band, so a raw
      // read renders a band word. That is what makes this fixture discriminate.
      expect(NO_STRENGTH_DATA.weight).toBe(DEFAULT_EDGE_DATA.weight)
      expect(NO_STRENGTH_DATA.weight as number).toBeGreaterThanOrEqual(0.3)
      expect(NO_STRENGTH_DATA.weight as number).toBeLessThan(0.7)
      expect(NO_STRENGTH_DATA.weightSource).toBeUndefined()
      expect(NO_STRENGTH_DATA).not.toHaveProperty('strength_mean')
      expect(resolveEdgeSignedStrengthDisplay(NO_STRENGTH_DATA)).toEqual({
        show: false,
        reason: 'not_set',
      })
      // …while the direction is still the producer's, stamped.
      expect(resolveEdgeDirectionDisplay(NO_STRENGTH_DATA)).toEqual(
        expect.objectContaining({ show: true, direction: 'negative', source: 'cee' }),
      )
    })

    it('the NEITHER fixture is unset on BOTH halves — including a fabricated direction value', () => {
      // The mapper writes `direction: 'positive'` even here (its own fallback),
      // unstamped — the same trap shape the 2935 fixture pinned. A raw read of
      // either field would look plausible; only resolver-bound rendering passes.
      expect(NEITHER_DATA.weight).toBe(DEFAULT_EDGE_DATA.weight)
      expect(NEITHER_DATA.weightSource).toBeUndefined()
      expect(NEITHER_DATA.direction).toBe('positive')
      expect(NEITHER_DATA.directionSource).toBeUndefined()
      expect(resolveEdgeSignedStrengthDisplay(NEITHER_DATA)).toEqual({
        show: false,
        reason: 'not_set',
      })
      expect(resolveEdgeDirectionDisplay(NEITHER_DATA)).toEqual({ show: false, reason: 'not_set' })
    })

    it('NO_STRENGTH and NEITHER differ ONLY in the direction keys', () => {
      const keys = new Set([...Object.keys(NO_STRENGTH_DATA), ...Object.keys(NEITHER_DATA)])
      const differing = [...keys].filter(
        (k) => JSON.stringify(NO_STRENGTH_DATA[k]) !== JSON.stringify(NEITHER_DATA[k]),
      ).sort()
      expect(differing).toEqual(['direction', 'directionSource'])
    })
  })

  // ── THE NAMED DEFECT ──────────────────────────────────────────────────────

  it('does NOT assert a strength band for a strength nobody set [ROADMAP 2.950]', () => {
    const { container } = renderEdge(NO_STRENGTH_DATA)
    const text = labelText(container)
    expect(hasAny(text, BAND_WORDS), `label read "${text}"`).toBe(false)
  })

  it('says the strength was not set, in the popover\'s vocabulary', () => {
    const { container } = renderEdge(NO_STRENGTH_DATA)
    expect(labelText(container).toLowerCase()).toContain('strength not set')
  })

  it('still names the stated direction when only the strength is unset', () => {
    // The half with provenance still speaks: this edge's producer said
    // "negative" (pinned above), and deleting the strength must not silence it.
    const { container } = renderEdge(NO_STRENGTH_DATA)
    const text = labelText(container)
    expect(hasAny(text, ['drag']), `label read "${text}"`).toBe(true)
    expect(hasAny(text, ['boost']), `label read "${text}"`).toBe(false)
  })

  it('the TOOLTIP does not print the fabricated number, and says not set', () => {
    const { container } = renderEdge(NO_STRENGTH_DATA)
    const tip = labelTooltip(container)
    expect(tip, `tooltip read "${tip}"`).toContain('Weight: not set')
    expect(tip, `tooltip read "${tip}"`).not.toContain('0.50')
  })

  it('the ACCESSIBLE NAME agrees with the visible text (no sighted/AT divergence)', () => {
    const { container } = renderEdge(NO_STRENGTH_DATA)
    const aria = labelAria(container)
    expect(hasAny(aria, BAND_WORDS), `accessible name read "${aria}"`).toBe(false)
    expect(hasAny(aria, ['drag']), `accessible name read "${aria}"`).toBe(true)
  })

  it('NEITHER set → the ratified popover copy, exactly', () => {
    const { container } = renderEdge(NEITHER_DATA)
    expect(labelText(container)).toBe(RATIFIED_UNSET_COPY)
  })

  it('the NUMERIC channel does not print the fabricated number either', () => {
    vi.mocked(useEdgeLabelMode).mockImplementation((selector: any) => selector({ mode: 'numeric' }))
    const { container } = renderEdge(NO_STRENGTH_DATA)
    const text = labelText(container)
    expect(text, `numeric label read "${text}"`).toContain('w not set')
    expect(text, `numeric label read "${text}"`).not.toContain('0.50')
  })

  // ── THE LICENSED CLAIM STILL RENDERS (regression pins, green at pristine) ─

  it('still renders the full claim for a producer-sourced strength', () => {
    const { container } = renderEdge(SET_DATA)
    // Byte-exact: the same string this edge rendered before this change. The
    // capture carries no `belief`, so the (uncertain) qualifier applies.
    expect(labelText(container)).toBe('Moderate drag (uncertain)')
  })

  it('the numeric channel still prints a sourced strength, signed by the stated direction', () => {
    vi.mocked(useEdgeLabelMode).mockImplementation((selector: any) => selector({ mode: 'numeric' }))
    const { container } = renderEdge(SET_DATA)
    expect(labelText(container)).toContain('w −0.35')
  })

  // ── THE TRIPLE: differ where they must ────────────────────────────────────

  describe('set / strength-unset / neither render differently where they should', () => {
    const TRIPLE = [
      { name: 'strength set, direction stated', data: SET_DATA },
      { name: 'strength unset, direction stated', data: NO_STRENGTH_DATA },
      { name: 'neither set', data: NEITHER_DATA },
    ] as const

    it('the three labels are pairwise DISTINCT', () => {
      const texts = TRIPLE.map(({ data }) => labelText(renderEdge(data).container))
      expect(new Set(texts).size, `labels were ${JSON.stringify(texts)}`).toBe(3)
    })

    it('a band word appears exactly when the resolver licenses one', () => {
      // The biconditional, derived per row from the ONE owner the stroke width
      // already reads — so a row added to TRIPLE extends coverage with no list
      // to maintain.
      for (const { name, data } of TRIPLE) {
        const { container } = renderEdge(data)
        const licensed = resolveEdgeSignedStrengthDisplay(data).show
        const bandAsserted = hasAny(labelText(container), BAND_WORDS)
        expect(bandAsserted, `${name}: band word`).toBe(licensed)
      }
    })

    it('the table is NOT vacuous — it produces both a licensed and an unlicensed row', () => {
      const shown = TRIPLE.map(({ data }) => resolveEdgeSignedStrengthDisplay(data).show)
      expect(shown).toContain(true)
      expect(shown).toContain(false)
    })
  })

  // ── IDENTITY BINDING (trap 19) ────────────────────────────────────────────
  //
  // The DISCRIMINATING MUTANT PAIR this block supports:
  //   · loosen the strength gate for ALL edges (make `describeEdge` fabricate a
  //     value when `show: false`) → the band/tooltip/copy assertions above RED.
  //   · loosen it for a DIFFERENT edge only (fabricate only when the id is not
  //     'e-under-test') → this file stays GREEN.
  // Neither alone proves binding; the RED/GREEN pair does.

  it('reads the label off THE EDGE UNDER TEST, not whichever label rendered first', () => {
    const { container } = renderEdge(NO_STRENGTH_DATA)
    expect(baseProps.id).toBe('e-under-test')
    expect(container.querySelectorAll('[data-testid="edge-influence-label"]').length).toBe(1)
    expect(labelText(container).toLowerCase()).toContain('strength not set')
  })

  // ── THE EDIT POPOVER SEAM: a user edit must become visible to the gate ────
  //
  // `EdgeEditPopover` live-previews on a 120 ms debounce, INCLUDING an initial
  // fire with the SEED values the moment it opens. So the stamp has to be
  // conditional on the value actually moving:
  //   · stamp on every fire  → opening the popover launders the 0.5 default
  //     into a user claim (the exact failure edgeValueProvenance.ts exists to
  //     prevent) — the first test below REDs.
  //   · never stamp          → the label says "not set" about a strength the
  //     user just chose — the second test REDs.

  describe('edge edit popover → weightSource stamp', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    function openPopover(container: HTMLElement) {
      fireEvent.doubleClick(labelEl(container))
    }

    it('does NOT stamp on the popover\'s untouched initial fire (no laundering on open)', () => {
      const { container } = renderEdge(NO_STRENGTH_DATA)
      openPopover(container)
      act(() => {
        vi.advanceTimersByTime(200)
      })
      // POSITIVE CONTROL for the absence: the initial fire itself happened.
      expect(updateEdgeDataSpy).toHaveBeenCalled()
      for (const [, data] of updateEdgeDataSpy.mock.calls) {
        expect(data).not.toHaveProperty('weightSource')
      }
    })

    it('stamps weightSource: "user" (and clears strength_mean) when the user moves the weight', () => {
      const { container, getByLabelText } = renderEdge(NO_STRENGTH_DATA)
      openPopover(container)
      fireEvent.change(getByLabelText('Weight slider'), { target: { value: '0.9' } })
      act(() => {
        vi.advanceTimersByTime(200)
      })
      const stamped = updateEdgeDataSpy.mock.calls.filter(([, data]) => data?.weightSource === 'user')
      expect(stamped.length, 'no stamped write reached the store').toBeGreaterThan(0)
      const [edgeId, data] = stamped[stamped.length - 1]
      // Bound by identity: the stamp lands on the edge under test.
      expect(edgeId).toBe('e-under-test')
      expect(data.weight).toBeCloseTo(0.9)
      // A stale producer mean would keep speaking over the user's number —
      // the resolver prefers it — so the write clears it (PreAnalysisPanel
      // precedent, :1216).
      expect(data).toHaveProperty('strength_mean', undefined)
    })
  })
})
