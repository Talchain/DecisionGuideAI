/**
 * ⭐ THE CANVAS NEVER CITES A COMPARISON IT DOES NOT SHOW (post-run DIFF item 7,
 * 27 Sep 2026; contract v3.1: the fragile cue appears only alongside a shown
 * comparison — "This model comparison was sensitive to this connection").
 *
 * ── THE DEFECT, ON PAUL'S REAL BOARD ────────────────────────────────────────
 *
 * `mrr-17d1cd3a` is a run whose comparison is WITHHELD: the block carries no
 * `win_probabilities`, `leader_claim.withheld_reason` is
 * `unrequested_analysis_withheld`, and every option card correctly shows NO
 * share. Yet the canvas painted the fragile-edge cue on Pro plan price → MRR —
 * "If this connection's strength changes, the current model comparison could
 * change (64% flip risk)" — and 3 of 5 factors carried an attention mark led by
 * "The comparison depends on a link from here". Both cite a comparison the
 * canvas never shows.
 *
 * ── THE GATE IS THE OPTION CARDS' OWN, NOT A NEW ONE ────────────────────────
 *
 * The option card shows a share when ITS node resolves one
 * (`useNodeDisplayMetadata(id, 'option').winRate !== null`); whether that is
 * false for EVERY option card is `useSupportShareRunWideAbsent`, the predicate
 * the option cards and the Question node already read. The cue and the
 * comparison-dependent attention reasons (the flip artefacts: a fragile link and
 * a turning point) now read that same answer.
 *
 * CLAIM TYPE: jsdom, the REAL store seeded the way
 * `e2e/geometry/boardStatesGeometry.measure.ts` seeds it — `applyDraftResult`
 * on the fixture's draft, then the fixture's real `analysis_result` envelope
 * through `applyV5State`, and `markAnalysisFreshnessDirty()` for STALE. The one
 * PLANTED case (a single share added to 17d1) is named as planted: it isolates
 * the mechanism, because 17d1 and 90b8 differ in more than their shares.
 * No model calls, no network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Position } from '@xyflow/react'

// ReactFlow: the edge reads the graph through `useReactFlow`; here it reads
// the REAL store the run was seeded into (assigned in `beforeEach`).
const rf = vi.hoisted(() => ({
  getNodes: (() => []) as () => unknown[],
  getEdges: (() => []) as () => unknown[],
}))
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react')
  return {
    ...actual,
    BaseEdge: () => <path data-testid="base-edge" />,
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({
      getNode: (id: string) => (rf.getNodes() as Array<{ id: string }>).find((n) => n.id === id) ?? null,
      getEdges: () => rf.getEdges(),
      getNodes: () => rf.getNodes(),
    }),
    useStore: (selector: (s: unknown) => unknown) => selector({ nodes: [] }),
  }
})
// The same leaf mocks every fragile-cue spec uses (`StyledEdge.fragileCueLastRun.spec.tsx`);
// the store and the freshness hooks are REAL here.
vi.mock('../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../hooks/useFirstTimeHints', () => ({ useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }) }))
vi.mock('../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../flags')>()),
  isGraphLensEnabled: () => false,
}))

import { useCanvasStore } from '../store'
import { applyDraftResult } from '../utils/applyDraftResult'
import { applyV5State } from '../../v5/applyV5State'
import { StyledEdge } from '../edges/StyledEdge'
import { useNodeAttention } from '../nodes/shared/useNodeAttention'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { LAST_RUN_PREFIX } from '../nodes/shared/metricVocabulary'
import { FRAGILE_CUE_SENTENCE } from '../edges/connectorCopy'

type Json = Record<string, unknown>
interface MrrFixture {
  draft: Json
  analysis_ready: Json
  analysis_state: Json
  graph_hash: string
  analysis_block: Json
}

const HERE = path.dirname(fileURLToPath(import.meta.url))
const readMrr = (id: string): MrrFixture =>
  JSON.parse(readFileSync(path.join(HERE, '..', '..', '..', 'e2e', 'geometry', 'fixtures', `mrr-${id}.fixture.json`), 'utf8'))
const WITHHELD = readMrr('17d1cd3a')
const SHOWN = readMrr('90b8f080')

const INITIAL = useCanvasStore.getState()

/** The measure harness's envelope, verbatim in shape (`boardStatesGeometry.measure.ts` `envelopeOf`). */
function envelopeOf(f: MrrFixture): Json {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [f.analysis_block],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    analysis_ready: f.analysis_ready,
    analysis_state: f.analysis_state,
    graph_hash: f.graph_hash,
  }
}

function seed(f: MrrFixture): void {
  applyDraftResult(JSON.parse(JSON.stringify(f.draft)) as never, { skipHistory: true, skipAutosave: true })
  const snap = useCanvasStore.getState()
  const out = applyV5State(
    JSON.parse(JSON.stringify(envelopeOf(f))) as never,
    { ...snap, currentResultsHash: (snap.results as { hash?: string } | null)?.hash ?? null, backfillGoalThreshold: () => {} } as never,
    { turnClientId: 'spec', currentClientTurnId: 'spec' },
  )
  // PINNED: a refused or deduped turn leaves a pre-run board that reads clean.
  expect(out.applied, 'the run did not hydrate results').toContain('analysis_result:results_hydrated')
  expect(useCanvasStore.getState().results.status).toBe('complete')
}

const markStale = () => useCanvasStore.getState().markAnalysisFreshnessDirty()

/** The one fragile edge both boards rank top: Pro plan price → MRR. */
function renderTopFragileEdge() {
  const e = (useCanvasStore.getState().edges as Array<{ id: string; source: string; target: string; data?: unknown }>)
    .find((x) => x.source === 'pro_plan_price' && x.target === 'mrr')
  expect(e, 'the draft lost Pro plan price → MRR').toBeDefined()
  return render(
    <StyledEdge
      {...({
        id: e!.id, source: e!.source, target: e!.target, data: e!.data,
        sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
        sourcePosition: Position.Right, targetPosition: Position.Left, selected: false,
      } as unknown as ComponentProps<typeof StyledEdge>)}
    />,
  )
}

const OPTION_IDS = (f: MrrFixture) =>
  ((f.draft as { nodes: Array<{ id: string; kind?: string; type?: string }> }).nodes)
    .filter((n) => (n.kind ?? n.type) === 'option').map((n) => n.id)
const NODE_IDS = (f: MrrFixture) => ((f.draft as { nodes: Array<{ id: string }> }).nodes).map((n) => n.id)

/** Each option card's OWN share read — the condition the card shows a share on. */
function ShareProbe({ id }: { id: string }) {
  const m = useNodeDisplayMetadata(id, 'option')
  return <span data-testid={`share-${id}`}>{m.isResultsMode && m.winRate !== null ? String(m.winRate) : 'none'}</span>
}
const shownShares = (f: MrrFixture): string[] => {
  const { unmount } = render(<>{OPTION_IDS(f).map((id) => <ShareProbe key={id} id={id} />)}</>)
  const out = OPTION_IDS(f).map((id) => screen.getByTestId(`share-${id}`).textContent ?? '').filter((t) => t !== 'none')
  unmount()
  return out
}

function AttentionProbe({ id }: { id: string }) {
  const a = useNodeAttention(id)
  return (
    <span
      data-testid={`attn-${id}`}
      data-kinds={a.reasons.map((r) => r.kind).join(',')}
      data-first={a.reasons[0]?.label ?? ''}
      data-marked={String(a.marked)}
      data-last-kinds={a.fromLastRun ? a.fromLastRun.reasons.map((r) => r.kind).join(',') : ''}
      data-last-first={a.fromLastRun?.reasons[0]?.label ?? ''}
      data-last-marked={String(a.fromLastRun?.marked ?? false)}
    />
  )
}
function attention(f: MrrFixture) {
  const ids = NODE_IDS(f)
  const { unmount } = render(<>{ids.map((id) => <AttentionProbe key={id} id={id} />)}</>)
  const rows = ids.map((id) => {
    const el = screen.getByTestId(`attn-${id}`)
    const at = (k: string) => el.getAttribute(k) ?? ''
    return {
      id,
      kinds: at('data-kinds').split(',').filter(Boolean),
      first: at('data-first'),
      marked: at('data-marked') === 'true',
      lastKinds: at('data-last-kinds').split(',').filter(Boolean),
      lastFirst: at('data-last-first'),
      lastMarked: at('data-last-marked') === 'true',
    }
  })
  unmount()
  return rows
}

/** The reasons that cite the comparison through a flip artefact. */
const COMPARISON_FLIP_KINDS = ['fragile_link', 'turning_point']
const DEPENDS_ON_A_LINK = 'The comparison depends on a link from here'

beforeEach(() => {
  useCanvasStore.setState(INITIAL, true)
  rf.getNodes = () => useCanvasStore.getState().nodes as unknown[]
  rf.getEdges = () => useCanvasStore.getState().edges as unknown[]
})
afterEach(() => {
  cleanup()
})

describe('PRECONDITIONS — the two real boards differ in whether the canvas shows the comparison', () => {
  it('17d1: the run carries a fragile edge at 0.638, and NO option card shows a share', () => {
    seed(WITHHELD)
    const fe = ((useCanvasStore.getState().results.report as { robustness?: { fragile_edges?: Array<{ edge_id?: string; switch_probability?: number }> } })
      .robustness?.fragile_edges ?? []).find((x) => x.edge_id === 'pro_plan_price->mrr')
    expect(fe?.switch_probability).toBe(0.638)
    expect(OPTION_IDS(WITHHELD)).toHaveLength(3)
    expect(shownShares(WITHHELD)).toEqual([])
  })

  it('90b8 (contrast): option cards DO show shares — 5 of 6 (one option was left out of the run)', () => {
    seed(SHOWN)
    expect(shownShares(SHOWN)).toHaveLength(5)
  })
})

describe('⭐ the fragile-edge cue appears only alongside a shown comparison', () => {
  it('17d1 (comparison withheld): Pro plan price → MRR carries NO fragile cue and no fragility line', () => {
    seed(WITHHELD)
    const { container } = renderTopFragileEdge()
    // PRESENT control from the same render: the edge itself drew.
    expect(screen.getByTestId('base-edge')).toBeInTheDocument()
    expect(screen.queryByTestId('edge-fragile-tag')).toBeNull()
    expect(container.textContent ?? '').not.toContain('flip risk')
    expect(container.innerHTML).not.toContain(FRAGILE_CUE_SENTENCE.replace(/'/g, '&#x27;'))
    expect(container.innerHTML).not.toContain('64% flip risk')
  })

  it('90b8 (contrast — comparison shown): the SAME edge carries the cue with its own figure', () => {
    seed(SHOWN)
    renderTopFragileEdge()
    const cue = screen.getByTestId('edge-fragile-tag')
    expect(cue.getAttribute('aria-label')).toBe(`${FRAGILE_CUE_SENTENCE} (70% flip risk)`)
  })

  it('17d1 STALE: still no cue — a model change does not manufacture a comparison', () => {
    seed(WITHHELD)
    markStale()
    renderTopFragileEdge()
    expect(screen.getByTestId('base-edge')).toBeInTheDocument()
    expect(screen.queryByTestId('edge-fragile-tag')).toBeNull()
  })

  it('90b8 STALE (contrast): the cue stays, labelled "Last run" like the share it sits beside', () => {
    seed(SHOWN)
    markStale()
    renderTopFragileEdge()
    expect(screen.getByTestId('edge-fragile-tag').getAttribute('aria-label')).toBe(
      `${LAST_RUN_PREFIX}${FRAGILE_CUE_SENTENCE} (70% flip risk)`,
    )
  })

  it('PLANTED (isolates the mechanism): 17d1 with ONE option given a share gets the cue back', () => {
    seed(WITHHELD)
    const s = useCanvasStore.getState()
    const report = s.results.report as unknown as { option_probabilities?: Record<string, Json> }
    const probs = { ...(report.option_probabilities ?? {}) }
    probs.keep_current_49_price = { ...(probs.keep_current_49_price ?? {}), win_probability: 0.4 }
    useCanvasStore.setState({ results: { ...s.results, report: { ...report, option_probabilities: probs } } } as never)
    expect(shownShares(WITHHELD)).toEqual(['0.4'])
    renderTopFragileEdge()
    expect(screen.getByTestId('edge-fragile-tag').getAttribute('aria-label')).toBe(`${FRAGILE_CUE_SENTENCE} (64% flip risk)`)
  })
})

describe('⭐ the comparison-dependent attention reasons follow the same gate', () => {
  it('17d1: no element carries a fragile-link or turning-point reason, and no mark is led by "depends on a link"', () => {
    seed(WITHHELD)
    const rows = attention(WITHHELD)
    for (const r of rows) {
      expect(r.kinds.filter((k) => COMPARISON_FLIP_KINDS.includes(k)), r.id).toEqual([])
      expect(r.first, r.id).not.toContain(DEPENDS_ON_A_LINK)
    }
  })

  it('90b8 (contrast): Pro plan price keeps its fragile link AND its found turning point; Monthly churn its fragile link', () => {
    seed(SHOWN)
    const rows = attention(SHOWN)
    const by = (id: string) => rows.find((r) => r.id === id)!
    expect(by('pro_plan_price').kinds).toEqual(expect.arrayContaining(['turning_point', 'fragile_link']))
    expect(by('monthly_churn').kinds).toContain('fragile_link')
  })

  it('17d1 STALE: the last run\'s focus carries no fragile-link or turning-point reason either', () => {
    seed(WITHHELD)
    markStale()
    const rows = attention(WITHHELD)
    for (const r of rows) {
      expect(r.lastKinds.filter((k) => COMPARISON_FLIP_KINDS.includes(k)), r.id).toEqual([])
      expect(r.lastFirst, r.id).not.toContain(DEPENDS_ON_A_LINK)
    }
  })

  it('90b8 STALE (contrast): the last run\'s focus keeps the fragile link on Pro plan price', () => {
    seed(SHOWN)
    markStale()
    const rows = attention(SHOWN)
    expect(rows.find((r) => r.id === 'pro_plan_price')!.lastKinds).toContain('fragile_link')
  })
})
