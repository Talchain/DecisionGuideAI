/**
 * Results copy — "the best option" retired from the fragile-edge disclosure
 * (ROADMAP 2.724).
 *
 * ── WHAT CHANGED AND WHY ──────────────────────────────────────────────────
 * Doctrine (Paul-ratified): the product recommends what to INVESTIGATE, never
 * what to CHOOSE. "…changed the best option in <N% of simulations" is an
 * ANALYSIS-DESCRIBING sentence wearing a crowning noun: what the simulation
 * actually changed is which option came out on top, not which one the user
 * ought to pick. The replacement says exactly that — "changed which option
 * ranks first" — and loses no information: the count, the threshold and the
 * simulation framing are all preserved. Ordering by measured goal-fit is
 * analysis and STAYS; only the verdict framing goes.
 *
 * ── HONEST SCOPE OF THIS PIN — READ BEFORE TRUSTING IT (traps 3b / 10) ────
 * This estate has shipped copy DARK twice by pinning it to something users do
 * not load, so the reachability of this string was derived rather than assumed,
 * and the result is NOT what the source audit recorded:
 *
 *   · `filteredFragileEdges.description` is a WRITE-ONLY FIELD. Complete
 *     reference manifest for `filteredFragileEdges` in `src/` at tip
 *     `a81121d1` — 10 references, all enumerated: produced here
 *     (`useResultsSectionData.ts` :2915/:2916/:2918, returned :2943), typed
 *     (`types.ts:878` → `FilteredItemsDisclosure`, `types.ts:755`), consumed by
 *     exactly ONE component (`ConfidenceSection.tsx` :451/:676/:677) which reads
 *     `filteredCount` ONLY and composes its own sentence, plus one spec fixture.
 *     `rg 'filteredFragileEdges\.description'` over `src/`: ZERO hits.
 *     (The hook surfaces it at `confidence.filteredFragileEdges`, not at the
 *     top level — see the precondition pin in the first test.)
 *   · The string IS compiled into the deployed staging bundle (tip `a81121d1`,
 *     `assets/ReactFlowGraph-IP33MDVH.js`) — so it is not dead code — but
 *     nothing renders it. A reader could be wired at any time, which is exactly
 *     why the copy is fixed rather than left as a loaded weapon.
 *
 * So: this is a PRODUCER-SIDE regression pin on a currently-unrendered field.
 * It is deliberately NOT described as protecting a live user-visible surface,
 * because at this tip it does not. The live user-visible verdict string in this
 * change set is the OptionNode leader chip — see
 * `src/canvas/nodes/__tests__/OptionNode.verdictLanguage.spec.tsx`, which
 * carries served-bundle mount evidence.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'
import { THRESHOLDS } from '../../../lib/mappers/constants'

/**
 * Two fragile edges BELOW the display threshold, so the hook's
 * `filteredFragileEdgesCount` is 2 and the disclosure object is produced.
 * Derived from the producer's own predicate (`switch_probability <= threshold`,
 * `useResultsSectionData.ts:2563-2566`), not from a guess about it.
 */
const BELOW_THRESHOLD = THRESHOLDS.FRAGILE_EDGE_FILTER - 0.05

function setStoreWithFilteredFragileEdges(count: number): void {
  useCanvasStore.setState({
    results: {
      status: 'complete',
      progress: 100,
      report: {
        run: { critique: [] },
        robustness: {
          fragile_edges: Array.from({ length: count }, (_, i) => ({
            edge_id: `edge-${i}`,
            alternative_winner_id: `option-${i}`,
            switch_probability: BELOW_THRESHOLD,
            from_label: `Factor ${i}`,
            to_label: `Outcome ${i}`,
          })),
        },
        option_comparison: [],
      },
    } as never,
    runMeta: {} as never,
    nodes: [],
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
  } as never)
}

describe('useResultsSectionData — fragile-edge disclosure carries no crowning noun (ROADMAP 2.724)', () => {
  beforeEach(() => {
    setStoreWithFilteredFragileEdges(0)
  })

  it('describes what the simulation changed (rank order), not what to choose', () => {
    setStoreWithFilteredFragileEdges(2)
    const { result } = renderHook(() => useResultsSectionData())

    // Precondition pin (trap 13b): prove the fixture actually reached the
    // producing branch, so the copy assertion below cannot pass vacuously on an
    // undefined disclosure. This EARNED its place — the first draft of this
    // spec read `result.current.filteredFragileEdges`, one level too high (the
    // disclosure hangs off the `confidence` section), and without this line the
    // banned-register test below would have passed GREEN against `undefined`
    // while proving nothing at all.
    expect(result.current.confidence.filteredFragileEdges).toBeDefined()
    expect(result.current.confidence.filteredFragileEdges?.filteredCount).toBe(2)

    expect(result.current.confidence.filteredFragileEdges?.description).toBe(
      `2 additional assumptions changed which option ranks first in <${Math.round(
        THRESHOLDS.FRAGILE_EDGE_FILTER * 100
      )}% of simulations`
    )
  })

  it('never emits the banned crowning register', () => {
    setStoreWithFilteredFragileEdges(1)
    const { result } = renderHook(() => useResultsSectionData())

    expect(result.current.confidence.filteredFragileEdges).toBeDefined()
    const description = result.current.confidence.filteredFragileEdges?.description ?? ''
    expect(description).not.toMatch(/best (option|choice|bet|pick)/i)
    expect(description).not.toMatch(/\brecommend/i)
    expect(description).not.toMatch(/\bwinner\b/i)

    // Information preserved, not merely removed: the count and the threshold
    // still reach the consumer. This is what stops a future "fix" from
    // resolving the doctrine by deleting the sentence.
    expect(description).toContain('1 additional assumption ')
    expect(description).toContain(`<${Math.round(THRESHOLDS.FRAGILE_EDGE_FILTER * 100)}% of simulations`)
  })
})
