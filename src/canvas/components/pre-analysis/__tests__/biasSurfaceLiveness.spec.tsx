/**
 * Bias-surface liveness gate — the UI surface leg of the deletion-resistance
 * gate (bias-coaching proposal 2026-07-16 §4.3).
 *
 * DERIVE-DON'T-MIRROR (rule-12). The expected-surface set is the design record:
 * amendment §1.5 names EXACTLY THREE bias-coaching surfaces, one per journey
 * beat, and this file carries one case per named surface, each bound to its
 * §1.5 clause below. The estate vanished three ways before — an undisclosed
 * code removal (the 30-Mar node-icon strip, `7259d089`, shipped under a "reuse
 * unchanged" commit message), a prompt that never asked, and a redesign that
 * did not name the feature. This gate makes the FIRST class RED regardless of
 * the commit message: unmount a named surface, or drop its bias feeder, and a
 * case here goes RED.
 *
 *   §1.5(1) FRAME        — pre-analysis panel bias cards (deterministic engine
 *                          + draft `bias_signals`); mounted as PreAnalysisPanel.
 *   §1.5(2) EXPLORE      — canvas node icons (the single useScienceIcons /
 *                          ScienceIcon system, max 2/node), with the popover +
 *                          "discuss with AI" affordance.
 *   §1.5(3) REALITY-TEST — decision_review bias cards (the primary LLM bias
 *                          surface). ⚠⚠ THE SURFACE MOVED — SEE BELOW. Now
 *                          mounted as the analysis hero's ACT-ON-IT REFLECT
 *                          ROWS (`analysis-hero/actOnIt/ActOnItSection`), whose
 *                          cases live in that module's own test tree with a
 *                          structural PIN to them at the bottom of this file.
 *
 * ⚠⚠ §1.5(3)'s SURFACE MOVED WITH THE V7 RETIREMENT, AND THIS BINDING WAS
 * UPDATED DELIBERATELY AND VISIBLY — the case was NOT deleted.
 *
 * The decision_review bias cards were rendered by `V7BiasSection`, whose only
 * production parent was `V7TopMatter` on the retired "Alt view" comparison tab.
 * Deleting the V7 group left the third named surface hostless, and the previous
 * revision of this header recorded exactly that — correctly, and deliberately
 * refusing to pre-bind to a replacement that was still being written in another
 * lane. THAT RE-HOME HAS NOW LANDED, so this case is restored against it.
 *
 * The §1.5(3) clause of the design amendment is unchanged, and so is this
 * gate's arithmetic: it carries one case per named surface, three of three.
 * Retiring the clause by quietly dropping its test would be the same class of
 * silent removal (a capability leaving under an unrelated commit message) that
 * this file exists to make RED.
 *
 * THE CASES LIVE IN THE HERO MODULE, PINNED FROM HERE. Rendering the reflect
 * rows means importing `analysis-hero/actOnIt`, and that module's
 * `__tests__/inertness.spec.ts` is a mount ALLOW-LIST permitting exactly two
 * importers outside its own tree — with no test carve-out, deliberately.
 * Authorising this spec would have weakened a live guard to satisfy a test, so
 * §1.5(3)'s cases moved to
 * `components/results/analysis-hero/actOnIt/__tests__/biasSurfaceLiveness.
 * realityTest.spec.tsx` and this file binds to them BY PATH (last case below).
 * Delete or gut that spec and THIS gate goes red naming it.
 *
 * THE PRODUCER PATH MOVED TOO, and the fixture moved with it. `V7BiasSection`
 * read `runMeta.ceeReviewV1.bias_findings` — the untyped CEE passthrough —
 * straight from the store, which is why the old case drove `mockRunMeta`. The
 * reflect rows read PLoT's `m1_review.bias_findings` through
 * `results/mapM2BiasFindings.ts` → `confidence.m2BiasFindings`, so the relocated
 * cases feed a raw finding through that REAL adapter and the REAL row builder
 * rather than through a store mock. The finding's own shape is unchanged.
 *
 * ⭐ AND THE CASE IS DELIBERATELY STRONGER THAN THE ONE IT REPLACES, because
 * the retirement did lose something real. `V7BiasSection` was the ONLY surface
 * in the product rendering a finding's `micro_intervention.steps` (the concrete
 * numbered steps) and its "About N min" estimate; the reflect rows showed the
 * bias type and description alone, and the drop was at the ADAPTER, which
 * projected five fields and discarded the rest. Both are re-homed, so §1.5(3)
 * now asserts them ON THE DOM. A gate that only checked "some bias text
 * renders" would have stayed green straight through the regression that
 * prompted this — which is the failure mode, one level up, that §4.3 is for.
 *
 * WHAT THIS GATE DOES NOT COVER (named in the PR body, CEE-owned): the §4
 * positive-control fixture, the wire leg (CEE `analysis_ready` / decision_review
 * emit non-empty bias findings), and the behavioural prompt leg. A UI test
 * cannot see PMS-served prompt content, so those legs live in CEE.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, renderHook, screen, within, fireEvent, cleanup } from '@testing-library/react'

// ── One mocked canvas store serves the surfaces below (module id is shared, so
//    every importer — PreAnalysisPanel, useScienceIcons, useNodeDisplayMetadata
//    — resolves to this mock). Mutable vars drive per-case state.
let mockNodes: any[] = []
let mockEdges: any[] = []
let mockCeeAnalysisReady: any = null
let mockDraftCoaching: any = null
let mockRunMeta: any = null

vi.mock('../../../store', () => {
  const makeState = () => ({
    ceeAnalysisReady: mockCeeAnalysisReady,
    draftCoaching: mockDraftCoaching,
    runMeta: mockRunMeta,
    nodes: mockNodes,
    edges: mockEdges,
    // useNodeDisplayMetadata reads results.status/report — never null here.
    results: { status: 'idle', report: null },
    lastDraftError: null,
    preAnalysisSensitivity: undefined,
    repairsApplied: null,
    setHighlightedNodes: vi.fn(),
    setHighlightedEdges: vi.fn(),
    selectNodeWithoutHistory: vi.fn(),
    selectEdgeWithoutHistory: vi.fn(),
    setShowDraftChat: vi.fn(),
    updateEdgeData: vi.fn(),
  })
  return {
    useCanvasStore: Object.assign(
      (selector: (state: any) => any) => selector(makeState()),
      {
        getState: () => ({
          ...makeState(),
          updateNode: vi.fn(),
          setGoalThreshold: vi.fn(),
          setGoalThresholdAndUpdateNode: vi.fn(),
          setCeeAnalysisReady: vi.fn(),
          setOutcomeNode: vi.fn(),
          addNode: vi.fn(),
          updateEdge: vi.fn(),
          addEdge: vi.fn(),
        }),
      },
    ),
  }
})

// Non-store dependencies of PreAnalysisPanel (mirrors the proven biasTriggerFilter
// harness — these need providers or throw otherwise).
vi.mock('../hooks/usePreAnalysisData', () => ({ usePreAnalysisData: vi.fn() }))
vi.mock('../../../stores/draftStore', () => ({
  useDraftStore: Object.assign(
    (selector: (state: any) => any) =>
      selector({
        lastDraftError: null,
        lastDraftDescription: '',
        selectedGenerationModel: null,
        selectedRepairModel: null,
        selectedEnrichmentModel: null,
        isGenerating: false,
        fullDraftAppliedAt: null,
      }),
    { getState: () => ({ lastDraftError: null, isGenerating: false, setLastDraftError: vi.fn() }) },
  ),
}))
vi.mock('../../../hooks/useRetryDraft', () => ({
  useRetryDraft: () => ({ retryDraft: vi.fn(), canRetry: true, isRetrying: false, retryError: null }),
}))
vi.mock('../../../hooks/usePreRunValidation', () => ({
  SOFT_BYPASS_STATUSES: new Set(['needs_user_mapping', 'needs_encoding']),
}))
vi.mock('../../../ToastContext', () => ({ useShowToast: () => vi.fn() }))
vi.mock('../../../../utils/clipboard', () => ({ copyTextToClipboard: vi.fn().mockResolvedValue(true) }))

import { PreAnalysisPanel } from '../PreAnalysisPanel'
import { ScienceIcon } from '../../../nodes/shared/ScienceIcon'
import { useScienceIcons } from '../../../hooks/useScienceIcons'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import * as usePreAnalysisDataModule from '../hooks/usePreAnalysisData'
import type { PreAnalysisData } from '../hooks/usePreAnalysisData'
// §1.5(3)'s structural pin reads its relocated spec from DISK rather than
// importing the hero — see the §1.5(3) block below for why importing it here is
// not available. `readFileSync`/`resolve`, same mechanism the sibling source
// guards (`analysis-hero/__tests__/hygiene.spec.ts`) use.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const mockUsePreAnalysisData = usePreAnalysisDataModule.usePreAnalysisData as ReturnType<typeof vi.fn>

const baseData = (): PreAnalysisData =>
  ({
    improvementsByCategory: { fix: [], verify: [], add_evidence: [], strengthen: [] },
    tiers: {
      mustAddress: { items: [], count: 0 },
      reviewAssumptions: { items: [], count: 0 },
      optional: { items: [], count: 0 },
    },
    totalImprovements: 0,
    topActions: [],
    evidenceQuality: { level: 'medium', ratio: 0.5, nonAiCount: 2, totalCount: 4 },
    isReady: true,
    hasBlockers: false,
    blockerCount: 0,
    nodesByKind: {
      goal: [{ id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } }],
      decision: [],
      option: [
        { id: 'o1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 1' } },
        { id: 'o2', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option 2' } },
      ],
      factor: [],
      risk: [],
      outcome: [],
    },
    edgeCount: 2,
    goalNode: { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } },
    successThreshold: null,
    isThresholdAutoDerived: false,
    isThresholdConfirmed: false,
    thresholdProvenance: null,
    isLoading: false,
    reviewedFactorsCount: 0,
    totalReviewableFactorsCount: 0,
    enrichedBlockers: [],
    informationalBlockers: [],
    modelAdjustments: [],
    preMortem: null,
    goalThresholdRaw: null,
    goalThresholdUnit: null,
    isGoalConfirmed: false,
    optionPreviews: [],
    qualityChecks: [],
    repairActions: [],
    ceeQuality: null,
    hasDefaultStrengths: false,
    defaultStrengthPercent: 0,
    contestedEdges: [],
    coachingSummary: null,
    thresholdSourceBadge: null,
    assumptionsLedger: null,
    triageActions: { top3: [], quickFix: [] },
  }) as unknown as PreAnalysisData

beforeEach(() => {
  vi.clearAllMocks()
  mockNodes = []
  mockEdges = []
  mockCeeAnalysisReady = null
  mockDraftCoaching = null
  mockRunMeta = null
  useGuidanceStore.setState({ _sendMessage: null })
})
afterEach(() => {
  cleanup()
  useGuidanceStore.setState({ _sendMessage: null })
})

describe('bias-surface liveness gate (§4.3 UI surface leg)', () => {
  // ── §1.5(1) FRAME — pre-analysis panel bias cards ────────────────────────
  it('§1.5(1) FRAME: a resolvable CEE bias finding renders a pre-analysis bias card', () => {
    mockNodes = [
      { id: 'fac-velocity', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Engineering velocity' } },
    ]
    mockCeeAnalysisReady = {
      goal_node_id: 'g1',
      options: [],
      bias_findings: [
        {
          id: 'bf1',
          code: 'CONFIRMATION_BIAS',
          severity: 'medium',
          explanation: 'Pattern of agreeable estimates.',
          target_factor_id: 'fac-velocity',
        },
      ],
    }
    mockUsePreAnalysisData.mockReturnValue(baseData())

    render(<PreAnalysisPanel onAnalyse={vi.fn()} />)

    const t1Card = screen.getByTestId('t1-decision-readiness-card')
    const nudges = within(t1Card).getAllByTestId(/^t1-bias-nudge-/)
    expect(nudges.length).toBeGreaterThanOrEqual(1)
    expect(nudges[0].textContent).toContain('Pattern of agreeable estimates')
  })

  // ── §1.5(2) EXPLORE — canvas node icons (useScienceIcons / ScienceIcon) ───
  it('§1.5(2) EXPLORE: a baseline option feeds a status-quo-bias node icon', () => {
    mockNodes = [
      { id: 'opt-1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Do nothing', is_baseline: true } },
    ]
    const { result } = renderHook(() => useScienceIcons('opt-1', 'option'))
    // Feeder alive: the deterministic system still emits the status-quo bias
    // trigger for a baseline option. Drop the trigger → this goes RED.
    expect(result.current.some((i) => i.id === 'status-quo-bias')).toBe(true)
  })

  it('§1.5(2) EXPLORE: the node-icon surface renders bias content + the discuss-with-AI turn', () => {
    mockNodes = [
      { id: 'opt-1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Do nothing', is_baseline: true } },
    ]
    const { result } = renderHook(() => useScienceIcons('opt-1', 'option'))
    const bias = result.current.find((i) => i.id === 'status-quo-bias')!
    expect(bias).toBeTruthy()

    const send = vi.fn()
    useGuidanceStore.setState({ _sendMessage: send })
    render(
      <ScienceIcon icon={bias.icon} tooltip={bias.tooltip} action={bias.action} colour={bias.colour} />,
    )

    // Surface alive: the icon opens a popover with the explicit AI affordance,
    // and the affordance forwards the trigger's action. Unmount the popover or
    // its discuss button → this goes RED.
    fireEvent.click(screen.getByLabelText(bias.tooltip))
    const discuss = screen.getByTestId('science-icon-discuss')
    expect(discuss.textContent).toMatch(/discuss with ai/i)
    fireEvent.click(discuss)
    expect(send).toHaveBeenCalledWith(bias.action)
  })

  // ── §1.5(3) REALITY-TEST — decision_review bias findings, re-homed onto the
  //    analysis hero's act-on-it REFLECT ROWS.
  //
  //    THE CASES THEMSELVES LIVE IN THE HERO MODULE, and this is the pin that
  //    keeps them findable and undeletable from here. Rendering the reflect rows
  //    requires importing `analysis-hero/actOnIt`, and
  //    `analysis-hero/__tests__/inertness.spec.ts` is a mount ALLOW-LIST naming
  //    exactly two importers outside that module (`ResultsBody.tsx`,
  //    `routes/HeroGallery.tsx`) with no test carve-out. Adding this spec to
  //    that allow-list would weaken a live guard to satisfy a test, so the
  //    §1.5(3) cases moved to where the import is legitimate — inside the
  //    module — and this gate binds to them BY PATH instead.
  //
  //    ⚠ WHAT THIS PIN DOES AND DOES NOT PROVE, stated plainly. It proves the
  //    relocated spec EXISTS and still carries the §1.5(3) binding and the two
  //    re-homed assertions; it does NOT execute them (that file does, in its own
  //    run). Delete the file, rename it, or gut those assertions and this goes
  //    RED naming the path. That is the property §4.3 needs from this file: a
  //    named surface cannot leave the design record unnoticed.

  const REALITY_TEST_SPEC = resolve(
    process.cwd(),
    'src/components/results/analysis-hero/actOnIt/__tests__/biasSurfaceLiveness.realityTest.spec.tsx',
  )

  it('§1.5(3) REALITY-TEST: the re-homed surface still has a live, bound spec', () => {
    let source: string
    try {
      source = readFileSync(REALITY_TEST_SPEC, 'utf8')
    } catch {
      throw new Error(
        `§1.5(3) REALITY-TEST has lost its spec. Expected it at:\n  ${REALITY_TEST_SPEC}\n` +
          'Design amendment §1.5 names THREE bias-coaching surfaces and this gate ' +
          'carries one case per surface. If the surface moved again, re-point this ' +
          'pin at its new spec — do not delete the case, which would retire a design ' +
          'commitment by way of a test edit.',
      )
    }

    // The binding, not merely the file: it must still drive the re-homed
    // surface and still assert the two fields the v7 retirement dropped.
    for (const required of [
      'ActOnItSection',                 // the re-homed host is rendered
      'mapM2BiasFindings',              // through the adapter that dropped the fields
      'hero-act-on-it-row-reflect',     // the reflect row is bound by identity
      'hero-act-on-it-row-steps',       // micro_intervention.steps render
      'hero-act-on-it-row-minutes',     // the "About N min" estimate renders
    ]) {
      expect(
        source.includes(required),
        `§1.5(3)'s spec no longer references "${required}" — the re-homed bias ` +
          'surface, or the micro-intervention half of it, has been gutted. See ' +
          `${REALITY_TEST_SPEC}`,
      ).toBe(true)
    }
  })
})
