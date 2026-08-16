/**
 * Workstream 1 — code-review feedback P1.6.
 *
 * Proves that the four user-facing analysis states are surfaced as
 * DISTINCT affordances across the existing UI surfaces, given the
 * canonical freshness derivation:
 *
 *   model ready           ← structural readiness, independent of freshness
 *   analysis current      ← freshness = 'fresh'
 *   analysis out of date  ← freshness = 'stale'
 *   analysis not run yet  ← freshness = 'none'
 *   freshness unknown     ← freshness = 'unknown' (CEE could not decide)
 *
 * The pure derivation is already exhaustively unit-tested in
 * `src/lib/__tests__/analysisFreshnessState.test.ts` (17 cases). This
 * file is the DOM-level matrix proof: each verdict produces a
 * distinguishable visible affordance, so the receipt's stale hint
 * (V5GraphPatchBlock) and the Results freshness strip
 * (AnalysisFreshnessNotice) together form a coherent four-state
 * surface — not collapsing all states into a single pill.
 *
 * ⚠ SURFACE RE-POINT (dead-HeroQualifier carve-out). This matrix used to
 * read its second surface from `HeroQualifier`, which had ZERO non-test
 * importers and was ABSENT FROM THE DEPLOYED BUNDLE — a census of 128
 * staging chunks found its testid, its `data-qualifier-source` attribute
 * and all four of its exclusive copy strings at zero occurrences, while
 * `analysis-freshness-notice`, `freshness-dot`, `v5-change-freshness-hint`
 * and its exact hint copy all resolved. The invariant was therefore half
 * bound to a component no user could reach (trap 3b). It now reads
 * `AnalysisFreshnessNotice` — the strip `OutputsDock` actually mounts and
 * which the codebase names the sole freshness owner — and the mount path
 * itself is asserted below, so the binding fails LOUD if that mount moves.
 *
 * The re-point STRENGTHENS the invariant. On the dead surface three of the
 * four verdicts collapsed to "no qualifier"; on the live strip all four
 * carry distinct copy and a distinct `data-freshness`, so the matrix now
 * pins FOUR pairwise-distinct outcomes instead of one.
 *
 * Out of scope here: pre-analysis panel structural-readiness display.
 * That surface is owned by `usePreRunValidation` + `PreAnalysisPanel`
 * which have their own test suites; bundling those into this matrix
 * would multi-test the same logic without adding signal. This file
 * focuses on the freshness axis specifically — the contract change
 * that landed in this workstream.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

import { stripComments } from '../../../tests/helpers/stripSourceComments'
import {
  AnalysisFreshnessNotice,
  FRESHNESS_COPY,
} from '../../components/results/AnalysisFreshnessNotice'
import {
  deriveAnalysisFreshnessState,
  type AnalysisFreshnessInputs,
} from './helpers/legacyFreshnessDerivation'
import type { CEEAnalysisReady } from '../../adapters/cee/types'
import type { V5GraphPatchBlock as V5GraphPatchBlockType } from '../../canvas/conversation/types'

// ─── Mock the canvas store (CEE freshness slice) for V5GraphPatchBlock ────

vi.mock('../../canvas/store', () => {
  // The V5GraphPatchBlock hint derives from the CEE freshness slice via
  // classifyFreshnessForDisplay; mirror the controllable verdict into the
  // slice. AnalysisFreshnessNotice additionally reads `results`,
  // `currentScenarioId`, `v5AnalysisFact` (through useAnalysisStateSource)
  // and `importPendingServerRegistration`. Absent results ⇒ the source
  // classifier returns 'none' ⇒ NOT orphaned, so the strip renders exactly
  // the verdict it is handed rather than a synthesised cannot-confirm.
  const canvasState = () => ({
    nodes: [],
    edges: [],
    // `beforeEach` resets the mock, so an un-stubbed read returns undefined.
    // The strip describes below are PROP-driven and never stub it; only the
    // V5GraphPatchBlock cases care about this slice, and they always stub it
    // first. Default to 'unknown' so the store shape stays valid either way.
    analysisFreshness: { freshness: mockFreshnessState()?.freshness ?? 'unknown' },
    analysisFreshnessDirty: false,
    results: undefined,
    currentScenarioId: null,
    v5AnalysisFact: null,
    importPendingServerRegistration: false,
  })
  const useCanvasStore = (selector: (s: ReturnType<typeof canvasState>) => unknown) =>
    selector(canvasState())
  // AnalysisFreshnessNotice's completion-toast effect reads the store
  // imperatively; without this the strip throws on render.
  useCanvasStore.getState = canvasState
  return { useCanvasStore }
})

// Drives the CEE freshness slice the V5GraphPatchBlock describe reads
// (analysisFreshness.freshness, via the useCanvasStore mock above). The
// AnalysisFreshnessNotice describe passes `state` as a prop — the component's
// own documented test override, and the form its dedicated spec uses — and the
// legacy-derivation describe calls deriveAnalysisFreshnessState directly, so no
// component here consumes the useAnalysisFreshnessState hook and it is
// intentionally NOT mocked.
const mockFreshnessState = vi.fn<[], { freshness: 'unknown' | 'fresh' | 'stale' | 'none' }>(() => ({
  freshness: 'unknown',
}))

const { V5GraphPatchBlock } = await import('../blocks/V5GraphPatchBlock')

// ─── Fixtures ─────────────────────────────────────────────────────────────

function ceeAnalysisReady(
  freshness: 'fresh' | 'stale' | 'unknown' | 'none' | undefined,
  freshness_reason: string | null,
): CEEAnalysisReady {
  return {
    options: [
      { id: 'opt-a', label: 'A', status: 'ready', interventions: { 'fac-1': { value: 1, source: 'user_specified' } } },
      { id: 'opt-b', label: 'B', status: 'ready', interventions: { 'fac-1': { value: 0, source: 'user_specified' } } },
    ],
    goal_node_id: 'goal-1',
    status: 'ready',
    ...(freshness ? { freshness } : {}),
    ...(freshness_reason ? { freshness_reason } : {}),
  } as CEEAnalysisReady
}

function freshnessInputs(
  ar: CEEAnalysisReady | null,
  overrides: Partial<AnalysisFreshnessInputs> = {},
): AnalysisFreshnessInputs {
  return {
    ceeAnalysisReady: ar,
    graphEditedSinceLastRun: false,
    resultsStatus: 'complete',
    hasOptions: true,
    hasSuccessfulAnalysisResult: true,
    ...overrides,
  }
}

const APPLIED_PATCH: V5GraphPatchBlockType = {
  type: 'v5_graph_patch',
  status: 'applied',
  operation: 'set_factor_value',
  target_id: 'fac_team_morale',
  before: { value: 0.5, raw_value: 50, unit: '%', cap: 100 },
  after: { value: 0.7, raw_value: 70, unit: '%', cap: 100 },
}

beforeEach(() => {
  cleanup()
  mockFreshnessState.mockReset()
})

// ─── Pure-derivation matrix (sanity, in case the derivation drifts) ──────

describe('analysis freshness — derivation matrix (4 distinct verdicts)', () => {
  it('fresh → recommendedAction = view_results', () => {
    const r = deriveAnalysisFreshnessState(
      freshnessInputs(ceeAnalysisReady('fresh', 'graph_hash_match')),
    )
    expect(r.freshness).toBe('fresh')
    expect(r.recommendedAction).toBe('view_results')
  })

  it('stale → recommendedAction = rerun_analysis', () => {
    const r = deriveAnalysisFreshnessState(
      freshnessInputs(ceeAnalysisReady('stale', 'graph_hash_diverged')),
    )
    expect(r.freshness).toBe('stale')
    expect(r.recommendedAction).toBe('rerun_analysis')
  })

  it('none + no prior local result + ready model → recommendedAction = run_analysis', () => {
    const r = deriveAnalysisFreshnessState(
      freshnessInputs(ceeAnalysisReady('none', 'no_successful_run_analysis_fact'), {
        hasSuccessfulAnalysisResult: false,
      }),
    )
    expect(r.freshness).toBe('none')
    expect(r.recommendedAction).toBe('run_analysis')
  })

  it('unknown + no options → recommendedAction = add_options (model needs structural work)', () => {
    // Per analysisFreshnessState.ts:171–180, no options + unknown
    // freshness routes to "add_options" and the verdict stays
    // 'unknown' (the wire didn't tell us yes/no on freshness).
    const r = deriveAnalysisFreshnessState(
      freshnessInputs(ceeAnalysisReady('unknown', null), {
        hasSuccessfulAnalysisResult: false,
        hasOptions: false,
      }),
    )
    expect(r.freshness).toBe('unknown')
    expect(r.recommendedAction).toBe('add_options')
    expect(r.inputsMissing.length).toBeGreaterThan(0)
  })

  it('unknown + has options + no prior result → recommendedAction = run_analysis', () => {
    // Per analysisFreshnessState.ts:193–199, with options but no
    // local successful result, the recommended action is to run
    // analysis. Distinct from the 'add_options' branch above.
    const r = deriveAnalysisFreshnessState(
      freshnessInputs(ceeAnalysisReady('unknown', null), {
        hasSuccessfulAnalysisResult: false,
        hasOptions: true,
      }),
    )
    expect(r.freshness).toBe('unknown')
    expect(r.recommendedAction).toBe('run_analysis')
  })
})

// ─── DOM matrix — V5GraphPatchBlock receipt hint ─────────────────────────

describe('V5GraphPatchBlock — receipt hint surfaces ONLY the stale state distinctly', () => {
  type FreshnessVerdict = 'fresh' | 'stale' | 'none' | 'unknown'

  const expectations: Record<FreshnessVerdict, 'visible' | 'absent'> = {
    fresh: 'absent',
    stale: 'visible',
    none: 'absent',
    unknown: 'absent',
  }

  for (const [verdict, outcome] of Object.entries(expectations) as Array<
    [FreshnessVerdict, 'visible' | 'absent']
  >) {
    it(`freshness=${verdict} → receipt freshness hint ${outcome}`, () => {
      mockFreshnessState.mockReturnValue({ freshness: verdict })
      render(<V5GraphPatchBlock block={APPLIED_PATCH} />)
      const hint = screen.queryByTestId('v5-change-freshness-hint')
      if (outcome === 'visible') {
        expect(hint).not.toBeNull()
        expect(hint!.textContent).toBe('Latest analysis is now out of date.')
      } else {
        expect(hint).toBeNull()
      }
    })
  }
})

// ─── MOUNT PATH — the invariant's surface must be one the product mounts ──
//
// The whole point of the re-point: this matrix is only evidence about the
// product if the surface it renders is the surface a user loads. HeroQualifier
// passed every render assertion for months while being absent from the deployed
// bundle. So assert the mount itself, and assert it against COMMENT-STRIPPED
// source: OutputsDock.tsx names AnalysisFreshnessNotice eight times, seven of
// them in prose. A naive substring check would go green on a comment alone —
// a guard agreeing with itself rather than with the product.

describe('AnalysisFreshnessNotice — mount path (fails loud if the strip is unmounted)', () => {
  const MOUNT_OWNER = 'src/canvas/components/OutputsDock.tsx'

  const readStripped = (rel: string): string =>
    stripComments(readFileSync(join(process.cwd(), rel), 'utf8'), rel)

  it('OutputsDock imports AND renders the strip in real code, not in a comment', () => {
    const code = readStripped(MOUNT_OWNER)

    // Precondition pin (trap 13b): prove the stripper left real code behind,
    // so a green result below cannot come from an empty/over-stripped string.
    expect(code.length).toBeGreaterThan(1000)

    expect(code).toMatch(
      /import\s*\{[^}]*\bAnalysisFreshnessNotice\b[^}]*\}\s*from\s*['"][^'"]*AnalysisFreshnessNotice['"]/,
    )
    expect(code).toMatch(/<AnalysisFreshnessNotice\b/)
  })

  it('the stripper is what makes that assertion meaningful (control)', () => {
    const raw = readFileSync(join(process.cwd(), MOUNT_OWNER), 'utf8')
    const stripped = readStripped(MOUNT_OWNER)
    // Prose mentions vastly outnumber the single render site; if this ever
    // reads equal, comments are no longer being removed and the mount
    // assertion above has quietly become a substring search over prose.
    const count = (s: string): number => (s.match(/AnalysisFreshnessNotice/g) ?? []).length
    expect(count(raw)).toBeGreaterThan(count(stripped))
    expect(count(stripped)).toBeGreaterThan(0)
  })
})

// ─── DOM matrix — AnalysisFreshnessNotice (the mounted Results strip) ─────

describe('AnalysisFreshnessNotice — surfaces the four freshness states distinctly', () => {
  type FreshnessVerdict = 'fresh' | 'stale' | 'none' | 'unknown'
  const VERDICTS: readonly FreshnessVerdict[] = ['fresh', 'stale', 'none', 'unknown'] as const

  for (const verdict of VERDICTS) {
    it(`${verdict} → renders the strip with data-freshness="${verdict}" and its own copy`, () => {
      render(<AnalysisFreshnessNotice state={{ freshness: verdict }} dirty={false} />)
      const el = screen.getByTestId('analysis-freshness-notice')
      // Bind by IDENTITY (the verdict attribute), never by a value predicate
      // another verdict could satisfy.
      expect(el.getAttribute('data-freshness')).toBe(verdict)
      expect(el.textContent).toContain(FRESHNESS_COPY[verdict])
    })
  }

  it('every verdict carries DIFFERENT copy (the table itself cannot collapse)', () => {
    const copies = VERDICTS.map((v) => FRESHNESS_COPY[v])
    expect(new Set(copies).size).toBe(VERDICTS.length)
  })
})

// ─── Distinct outcomes invariant ─────────────────────────────────────────
//
// The four verdicts must produce different DOM outcomes (no collapsing
// states into one pill). This single test fails any future regression
// that treats two distinct states as identical at the surface.

describe('freshness verdicts produce distinct user-facing outcomes (no collapse)', () => {
  it('the four verdicts are pairwise distinguishable across receipt hint + freshness strip', () => {
    const outcomes: Record<string, string> = {}
    const verdicts: Array<'fresh' | 'stale' | 'none' | 'unknown'> = [
      'fresh',
      'stale',
      'none',
      'unknown',
    ]

    for (const v of verdicts) {
      cleanup()
      mockFreshnessState.mockReturnValue({ freshness: v })
      render(<V5GraphPatchBlock block={APPLIED_PATCH} />)
      const hint = screen.queryByTestId('v5-change-freshness-hint')
      const hintText = hint ? hint.textContent ?? '' : 'NO_HINT'

      cleanup()
      render(<AnalysisFreshnessNotice state={{ freshness: v }} dirty={false} />)
      const strip = screen.queryByTestId('analysis-freshness-notice')
      const stripText = strip
        ? `${strip.getAttribute('data-freshness')}|${strip.textContent ?? ''}`
        : 'NO_STRIP'

      // Combined outcome = (receipt hint visibility, strip verdict +
      // copy). Both halves are surfaces the deployed bundle carries —
      // this is the user-visible signature for the verdict.
      outcomes[v] = `${hintText}::${stripText}`
    }

    // ⚠ STRENGTHENED BY THE RE-POINT. The dead HeroQualifier rendered
    // nothing for fresh/none/unknown, so this invariant could only pin
    // "stale differs, the other three collapse". The mounted strip gives
    // every verdict its own copy and its own data-freshness, so all four
    // are now pinned pairwise-distinct. Any future change that makes two
    // verdicts read alike to a user REDs here.
    const seen = new Map<string, string>()
    for (const v of verdicts) {
      const prior = seen.get(outcomes[v]!)
      expect(
        prior,
        `verdicts "${prior}" and "${v}" produce an identical user-facing outcome: ${outcomes[v]}`,
      ).toBeUndefined()
      seen.set(outcomes[v]!, v)
    }
    expect(seen.size).toBe(verdicts.length)

    // Stale additionally owns the receipt hint — the highest-impact
    // warning is the only verdict that reaches the change receipt.
    expect(outcomes.stale!.startsWith('Latest analysis is now out of date.')).toBe(true)
    for (const v of ['fresh', 'none', 'unknown'] as const) {
      expect(outcomes[v]!.startsWith('NO_HINT')).toBe(true)
    }
  })
})
