/**
 * RT-12: Science 5993266380's PRE-SIZED example is nobody's estimate.
 *
 * Corpus is the byte-identical Science patch, kept separately from the shipped
 * writer so these reader rows can go RED before that writer changes. All seven
 * links are bound to their actual mapper ids and endpoints; none is invented.
 * Three have no natural_effect, so the example's admitted strength must still
 * carry the example words when the ordinary strength band supplies its size.
 * Rendered DOM here proves the readers; browser layout is a separate witness.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { CSSProperties, ReactNode } from 'react'
import { Position } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import example from './fixtures/d1.patched.rt12.json'
import served from './fixtures/servedLinkSizing.20261005.json'
import { mapDraftEdgeToCanvas, mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { applyAutoApplyPatch } from '../../conversation/utils/applyPatch'
import { overlayEdge } from '../../utils/mergeAppliedGraph'
import { edgeSizePhrase } from '../../edges/edgeSizePhrase'
import { LinkHoverCard } from '../../components/hoverCard/LinkHoverCard'
import { StyledEdge } from '../../edges/StyledEdge'
import { EdgePills } from '../../nodes/shared/EdgePills'
import {
  edgeValueSource,
  resolveEdgeDirectionDisplay,
  resolveEdgeSignedStrengthDisplay,
} from '../edgeValueProvenance'
import { NaturalEffectSchema, naturalEffectAuthorWords, naturalEffectPhraseParts, type NaturalEffect } from '../naturalEffect'
import { strengthIsHumanSettled } from '../edgeStrengthSettlement'
import { EdgeDataSchema } from '../edges'
import { buildExamineLinkView } from '../../ui/inspector-v2/examine/examineLinkView'
import { resolveEdgeValuesCoaching, resolveEdgeValuesProvenance } from '../../ui/inspector-v2/coachingConfig'
import { toModelRows, toRowDetail, type ModelProjectionInput } from '../../model-tab-v2/adapters'

type WireEdge = Record<string, unknown> & { from: string; to: string }
type CanvasEdge = { id: string; source: string; target: string; data: Record<string, unknown> }
const state = vi.hoisted(() => ({ nodes: [] as Node[], edges: [] as CanvasEdge[] }))

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: ({ style }: { style?: CSSProperties }) => <path data-testid="base-edge" style={style} />,
    EdgeLabelRenderer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({
      getNode: (id: string) => state.nodes.find(n => n.id === id) ?? null,
      getEdges: () => state.edges,
      getNodes: () => state.nodes,
    }),
    useStore: (selector: (value: unknown) => unknown) => selector({ nodes: state.nodes }),
  }
})
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(vi.fn((selector: (value: unknown) => unknown) => selector({
    ...state,
    updateEdgeData: vi.fn(),
    runMeta: { ceeReview: null },
    results: { status: 'complete', report: null },
    viewMode: 'detailed',
    hoveredOptionId: null,
    highlightedEdges: new Set<string>(),
    dimmedEdgeIds: new Set<string>(),
    lens: {
      active: 'full',
      _dimmedEdgeIds: new Set<string>(),
      _sensitivityWeights: new Map<string, number>(),
      _sensitivityQuartiles: null,
      _fragileEdgeIds: new Set<string>(),
      _lensFragileLabels: new Map<string, string>(),
    },
  })), {
    getState: () => ({
      ...state, outcomeNodeId: null, ceeAnalysisReady: null, currentScenarioId: null,
      setOutcomeNode: vi.fn(), setPendingLayout: vi.fn(),
    }),
    setState: vi.fn((update: { nodes?: Node[]; edges?: CanvasEdge[] }) => {
      if (update.nodes) state.nodes = update.nodes
      if (update.edges) state.edges = update.edges
    }),
  }),
}))
vi.mock('../../store/scenarios', () => ({ saveAutosave: vi.fn() }))
vi.mock('../../utils/appliedEditPulse', () => ({ pulseAppliedTargets: vi.fn() }))
vi.mock('../../hooks/useModelChangedSinceRun', () => ({
  useModelChangedSinceRunLight: () => false,
  useModelChangedSinceRun: () => false,
}))
vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: (value: unknown) => unknown) => selector({ mode: 'human' })),
}))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))

const LINKS = [
  { id: 'e-12', from: 'sprint_capacity_for_ai_reporting', to: 'ai_reporting_module_availability', natural: true },
  { id: 'e-13', from: 'ai_reporting_module_availability', to: 'enterprise_prospect_signing_likelihood', natural: true },
  { id: 'e-14', from: 'enterprise_prospect_signing_likelihood', to: 'quarterly_revenue', natural: false },
  { id: 'e-15', from: 'sprint_capacity_for_integration_fix', to: 'integration_step_bug_resolution', natural: true },
  { id: 'e-16', from: 'integration_step_bug_resolution', to: 'trial_profile_abandonment_rate', natural: true },
  { id: 'e-17', from: 'trial_profile_abandonment_rate', to: 'revenue_lost_to_trial_abandonment', natural: false },
  { id: 'e-18', from: 'revenue_lost_to_trial_abandonment', to: 'quarterly_revenue', natural: false },
] as const

function ingestExample(link: typeof LINKS[number]): CanvasEdge {
  const wires = example.edges as WireEdge[]
  const matches = wires.filter(e => e.from === link.from && e.to === link.to)
  expect(matches, `${link.id}: ${link.from} → ${link.to} fixture binding`).toHaveLength(1)
  const wire = matches[0]
  const mapped = mapDraftEdgeToCanvas(wire, wires.indexOf(wire)) as CanvasEdge
  expect(mapped.id).toBe(link.id)
  return mapped
}
const exampleWire = (link: typeof LINKS[number]) =>
  (example.edges as WireEdge[]).find(e => e.from === link.from && e.to === link.to)!
const exampleNodes = () => example.nodes.map(mapDraftNodeToCanvas) as Node[]
const label = (id: string) => example.nodes.find(n => n.id === id)?.label ?? id
const WRONG_AUTHOR = /Olumi[’']s estimate|from your brief|your figure|Confirmed by you/
const EXAMPLE_WHY = 'This is an example figure, not a figure about your situation. Change it to see how much it matters.'
const EXAMPLE_STRENGTH_COPY = 'Example figure. The example decision comes with this strength so you can see a Run; change it to see how much it matters.'

function renderHover(edge: CanvasEdge) {
  return render(<LinkHoverCard
    edgeId={edge.id}
    labelX={50}
    labelY={50}
    zoom={1}
    surfaceRef={{ current: null }}
    arrowSentence={`${label(edge.source)} → ${label(edge.target)}`}
    doubtSentence={null}
    direction={resolveEdgeDirectionDisplay(edge.data)}
    disputedSentence={null}
    strength={resolveEdgeSignedStrengthDisplay(edge.data)}
    strengthSettled={strengthIsHumanSettled(edge.data)}
    placeholderSentence={null}
    fragileSentence={null}
    size={edgeSizePhrase(edge.data)}
  />).container
}
const rowText = (container: HTMLElement, testId: string) =>
  container.querySelector(`[data-testid="${testId}"]`)?.textContent ?? null

function examine(edge: CanvasEdge) {
  return buildExamineLinkView({
    sourceLabel: label(edge.source), targetLabel: label(edge.target),
    data: edge.data, structural: false, fragile: false,
  })
}
function modelRow(edge: CanvasEdge) {
  const input: ModelProjectionInput = { nodes: exampleNodes(), edges: [edge] as never, goalThreshold: null }
  const row = toModelRows(input).find(r => r.id === edge.id && r.kind === 'relationship')
  expect(row, `relationship row ${edge.id} exists`).toBeDefined()
  return row!
}
function renderConnector(edge: CanvasEdge) {
  state.nodes = exampleNodes()
  state.edges = [edge]
  const props = {
    id: edge.id, source: edge.source, target: edge.target,
    sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
    sourcePosition: Position.Right, targetPosition: Position.Left,
    selected: true, data: edge.data,
  }
  // Same declared-EdgeProps boundary as the existing StyledEdge reader specs.
  return render(<StyledEdge {...(props as Parameters<typeof StyledEdge>[0])} />).container
}

beforeEach(() => { state.nodes = []; state.edges = [] })
afterEach(cleanup)

describe('RT-12 — seven explicitly bound example links through the real ingestion hop', () => {
  it('the fixture contains exactly the seven admitted example strengths, including three without a natural effect', () => {
    expect(example.edges.filter(e => e.provenance.magnitude === 'example_figure')).toHaveLength(7)
    for (const link of LINKS) {
      const edge = ingestExample(link)
      const wire = example.edges.find(e => e.from === link.from && e.to === link.to)!
      expect(wire.provenance.magnitude, edge.id).toBe('example_figure')
      expect('natural_effect' in wire.provenance, edge.id).toBe(link.natural)
    }
  })

  for (const link of LINKS) {
    describe(`${link.id}: ${link.from} → ${link.to}`, () => {
      it('reads the example author, never the user, and keeps the schema and natural-effect words', () => {
        const edge = ingestExample(link)
        const size = edgeSizePhrase(edge.data)
        expect(size, `${edge.id} size phrase`).not.toBeNull()
        expect(size?.exampleFigure).toBe(true)
        expect(size?.usersFigure).toBe(false)
        expect(size?.whose).toBe('example figure')
        expect(size?.sentence).toBe(`${size?.size} · example figure`)
        const wireMean = (exampleWire(link).strength as { mean: number }).mean
        expect(edge.data.strengthExampleFigure).toBe(wireMean)
        expect(EdgeDataSchema.parse(edge.data).strengthExampleFigure).toBe(wireMean)
        // A passthrough schema retaining an undeclared key is insufficient:
        // the persisted admission must validate its signed finite mean.
        for (const invalid of ['not a number', Number.NaN, Number.POSITIVE_INFINITY]) {
          expect(EdgeDataSchema.safeParse({ ...edge.data, strengthExampleFigure: invalid }).success).toBe(false)
        }
        if (link.natural) {
          const effect = edge.data.naturalEffect as NaturalEffect
          expect(effect?.author).toBe('example_figure')
          expect(NaturalEffectSchema.safeParse(effect).success).toBe(true)
          expect(naturalEffectAuthorWords(effect)).toBe('example figure')
          // Example authorship must win even if an older canvas copy has a
          // definitional flag: this size remains an example, never arithmetic.
          expect(naturalEffectPhraseParts(effect, wireMean, resolveEdgeDirectionDisplay(edge.data), true)?.whose).toBe('example figure')
        }
      })

      it('keeps the same example admission through the patch hop and authoritative readback', () => {
        const drafted = ingestExample(link)
        const wire = exampleWire(link)
        state.nodes = exampleNodes()
        state.edges = []
        const result = applyAutoApplyPatch({
          block_type: 'graph_patch', auto_apply: true,
          operations: [{ op: 'add_edge', target_id: link.id, data: wire }],
        } as never)
        expect(result.addedEdgeCount).toBe(1)
        expect(state.edges).toHaveLength(1)
        expect(state.edges[0].id).toBe(link.id)
        expect(state.edges[0].data).toEqual(drafted.data)
        expect(edgeSizePhrase(state.edges[0].data)?.exampleFigure).toBe(true)

        const older = { ...drafted, data: { ...drafted.data } }
        delete older.data.strengthExampleFigure
        const acquired = overlayEdge(older, wire, { acquireServerStrengthOnNoop: true }) as CanvasEdge
        expect(acquired.data.strengthExampleFigure).toBe(drafted.data.strengthExampleFigure)
        expect(edgeSizePhrase(acquired.data)?.exampleFigure).toBe(true)

        const noLongerExample = { ...wire, provenance: { source: 'cee_hypothesis', magnitude: 'olumi_estimate' } }
        const removed = overlayEdge(drafted, noLongerExample, { acquireServerStrengthOnNoop: true }) as CanvasEdge
        expect('strengthExampleFigure' in removed.data).toBe(false)
        expect(edgeSizePhrase(removed.data)?.exampleFigure === true).toBe(false)
      })

      it('renders exact example words on Size, Strength and Direction, with no wrong attribution', () => {
        const edge = ingestExample(link)
        const container = renderHover(edge)
        expect(rowText(container, 'edge-hover-size')).toBe(`Size${edgeSizePhrase(edge.data)?.sentence}`)
        expect(rowText(container, 'edge-hover-size')).toMatch(/ · example figure$/)
        expect(rowText(container, 'edge-hover-strength')).toBe(`Strength${Number(edge.data.weight).toFixed(2)} · example figure`)
        expect(rowText(container, 'edge-hover-direction')).toBe('Directionexample figure')
        expect(container.textContent).not.toMatch(WRONG_AUTHOR)
      })

      it('uses the example Examine basis and the exact reason', () => {
        const view = examine(ingestExample(link))
        expect(view?.basis).toBe('example')
        expect(view?.why).toBe(EXAMPLE_WHY)
      })

      it('keeps the Model row out of the unconfirmed-estimate attention', () => {
        const edge = ingestExample(link)
        const row = modelRow(edge)
        expect(row.primaryValue).toContain('example figure')
        expect(row.primaryValue).not.toMatch(WRONG_AUTHOR)
        expect(row.attention).not.toContain('unconfirmed-estimate')
        expect(row.provenanceSource).toBeUndefined()
        expect(toRowDetail({ nodes: exampleNodes(), edges: [edge] as never, goalThreshold: null }, edge.id)?.basis).toBe('Source: example figure')
        // The banked D1 bytes lack a display stamp. Keep this same admitted link
        // out of the queue even when server hydration supplies its CEE stamp;
        // otherwise the missing stamp would make the exclusion vacuously pass.
        const withCeeDisplay = { ...edge, data: { ...edge.data, provenanceDisplay: 'ai_inferred' } }
        expect(modelRow(withCeeDisplay).attention).not.toContain('unconfirmed-estimate')
      })

      it('does not render the connector estimate marker', () => {
        const container = renderConnector(ingestExample(link))
        expect(container.querySelector('[data-testid="edge-influence-label-text"]'), 'connector strength label is rendered').not.toBeNull()
        expect(container.querySelector('[data-testid="estimate-marker"]')).toBeNull()
      })

      it('says the exact example strength copy in both inspector resolvers', () => {
        const data = ingestExample(link).data
        const sources = {
          strength: edgeValueSource(data, 'weight'),
          existence: edgeValueSource(data, 'beliefExists'),
          strengthExampleFigure: edgeSizePhrase(data)?.exampleFigure === true,
        }
        expect(resolveEdgeValuesProvenance(sources)).toContain(EXAMPLE_STRENGTH_COPY)
        expect(resolveEdgeValuesCoaching(sources)).toContain(EXAMPLE_STRENGTH_COPY)
        expect(resolveEdgeValuesProvenance(sources)).not.toContain('Olumi estimated this strength')
      })

      it('does not count an example as human-settled, including leftover review fields', () => {
        const data = ingestExample(link).data
        expect(strengthIsHumanSettled(data)).toBe(false)
        expect(strengthIsHumanSettled({ ...data, userReviewedStrength: true })).toBe(false)
        expect(strengthIsHumanSettled({ ...data, validation: { resolved_by: 'user', user_action: 'accepted_pass1' } })).toBe(false)
      })

      it('retires the example after a user changes its strength, and the hover says Set by you', () => {
        const edge = ingestExample(link)
        const edited = { ...edge, data: { ...edge.data, weightSource: 'user', weight: Number(edge.data.weight) + 0.01 } }
        // The admission is keyed to the number itself: a move retires it even before the writer stamps its author.
        expect(edgeSizePhrase({ ...edge.data, weight: edited.data.weight })?.exampleFigure === true).toBe(false)
        expect(edgeSizePhrase(edited.data)?.exampleFigure === true).toBe(false)
        const container = renderHover(edited)
        expect(rowText(container, 'edge-hover-size')).toBeNull()
        expect(rowText(container, 'edge-hover-strength')).toBe(`Strength${Number(edited.data.weight).toFixed(2)} · Set by you`)
        expect(container.textContent).not.toContain('example figure')
        expect(strengthIsHumanSettled(edited.data)).toBe(true)
        expect(examine(edited)).toBeNull()
      })
    })
  }
})

describe('RT-12 — DraftChat third-hop source pin', () => {
  it('calls the same example reader and strips the canvas-internal key before taking the wire remainder', () => {
    // DraftChat's mapper is inline in its component. This is a source pin of
    // that hop, not a rendered behavior witness, as in strengthPlaceholder.spec.
    const src = readFileSync(path.resolve(__dirname, '../../components/DraftChat.tsx'), 'utf8')
    expect(src).toMatch(/\.\.\.strengthExampleFigurePatch\(e as Record<string, unknown>, rawWeight, weightSource !== 'default'\)/)
    expect(src).toMatch(/strengthExampleFigure: _strengthExampleFigure,[^}]*?\.\.\.edgeRest/)
    // The earlier source pin's ownership stays byte-identical at the boundary.
    expect(src).toMatch(/strengthPlaceholder: _strengthPlaceholder,\s*\.\.\.edgeRest/)
  })
})

describe('RT-12 — real served controls through the same ingestion hop', () => {
  it("the served olumi_estimate keeps Olumi's estimate words and estimate markers", () => {
    const edge = mapDraftEdgeToCanvas(served.olumi, 0) as CanvasEdge
    expect(edge.source).toBe('ai_reporting_module_availability')
    expect(edge.target).toBe('enterprise_prospect_signing_likelihood')
    const size = edgeSizePhrase(edge.data)
    expect(size?.exampleFigure).toBe(false)
    expect(size?.usersFigure).toBe(false)
    expect(size?.whose).toBe("Olumi's estimate")
    const hover = renderHover(edge)
    expect(rowText(hover, 'edge-hover-size')).toBe("SizeIncrease of about 60 percentage points · Olumi's estimate")
    expect(rowText(hover, 'edge-hover-strength')).toBe('Strength0.60 · Olumi’s estimate')
    expect(examine(edge)?.basis).toBe('olumi_estimate')
    expect(modelRow({ ...edge, data: { ...edge.data, provenanceDisplay: 'ai_inferred' } }).attention).toContain('unconfirmed-estimate')
    cleanup()
    expect(renderConnector(edge).querySelector('[data-testid="estimate-marker"]')).not.toBeNull()
  })

  it('the served user_stated keeps from your brief and remains the user’s figure', () => {
    const edge = mapDraftEdgeToCanvas(served.userStated, 0) as CanvasEdge
    expect(edge.source).toBe('existing_customers_lost_from_price_rise')
    expect(edge.target).toBe('monthly_recurring_revenue')
    const size = edgeSizePhrase(edge.data)
    expect(size?.exampleFigure).toBe(false)
    expect(size?.usersFigure).toBe(true)
    expect(size?.whose).toBe('from your brief')
    const hover = renderHover(edge)
    expect(rowText(hover, 'edge-hover-size')).toBe('SizeDecrease of about £300 / month per 1 customer · from your brief')
    expect(rowText(hover, 'edge-hover-strength')).toBe('Strength0.80 · from your figure')
    expect(hover.textContent).not.toContain('example figure')
    expect(examine(edge)).toBeNull()
  })
})

describe('RT-12 — the actual example link pill into the risk', () => {
  it('says example figure without an estimate or human-settlement claim', () => {
    const edge = ingestExample(LINKS[5])
    state.nodes = exampleNodes()
    state.edges = [edge]
    const { container } = render(<EdgePills nodeId={edge.source} />)
    const strength = container.querySelector(`[data-testid="edge-pill-strength-example-${edge.id}"]`)
    expect(strength).not.toBeNull()
    expect(strength?.getAttribute('title')).toBe('Link strength: 50%, example figure')
    expect(strength?.textContent).toContain('example figure')
    expect(container.innerHTML).not.toMatch(/est\.|Olumi[’']s estimate|set by a person|Confirmed by you|your figure/)
    expect(container.querySelector(`[data-testid="edge-pill-strength-estimate-${edge.id}"]`)).toBeNull()
  })
})
