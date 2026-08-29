/**
 * DERIVED MANIFEST of every bare-`setState` graph writer, and what each one does
 * about analysis freshness.
 *
 * ── WHY A GUARD AND NOT SIX MORE CALLS ───────────────────────────────────
 * `markAnalysisFreshnessDirty` has to be REMEMBERED at each raw-setState call
 * site. That is a hand-maintained mirror: a list a human must keep in sync with
 * reality, whose drift always reads as green. Three routes had forgotten it and
 * nothing failed. Adding three calls fixes those three and guarantees a fourth.
 *
 * So the call sites are DERIVED from source here, and the only hand-written part
 * is the DISPOSITION of each one. Note the direction this creates: converging a
 * writer onto `commitGraphMutation` REMOVES it from this registry, because it no
 * longer writes the graph itself. The registry is the list of routes that still
 * hold the raw write — it shrinks as the class is closed, and any regression
 * back to a bare `setState` reappears here as an unregistered writer. A new graph writer cannot be added silently:
 * it is either absent from the registry (red) or it changes a registered file's
 * site count (red). The mirror that remains can only drift in the direction of
 * someone consciously writing down a reason.
 *
 * ── WHAT THIS GUARD PROVES, AND WHAT IT DOES NOT ─────────────────────────
 * PROVES: every file that writes `nodes:`/`edges:` through `useCanvasStore.setState`
 * is registered, its site count is unchanged, and — for every non-exempt file —
 * that file still contains an invalidation call. Delete the invalidation from any
 * of them and this goes red.
 *
 * DOES NOT PROVE: that the invalidation sits on the SAME code path as the write.
 * That is a claim about execution, and a structural source scan cannot make it.
 * The runtime truth is pinned, for the routes that can be driven, by
 * `canvas/store/__tests__/graphWriteFreshnessInvalidation.spec.tsx`. Read the two
 * together; neither is sufficient alone.
 *
 * ── SCOPE OF THE SWEEP, STATED PRECISELY ─────────────────────────────────
 * `.ts`/`.tsx` under `src/`, excluding `__tests__/`, `*.spec.*`, `*.test.*`,
 * `*.stories.*` (this is `productionSources`, the repo's shared scanner).
 * The claim is about ONE syntax: `useCanvasStore.setState(`. That is not an
 * assumption — a contrast sweep for every other `.setState(` receiver in `src/`
 * found 22 (`this.setState`, `useGuidanceStore`, `useReadinessStore`,
 * `useEdgeLabelMode`), none of them a canvas-store graph write, and no
 * destructured or aliased `setState` binding exists. Store-INTERNAL `set()`
 * writes are a different class with a different owner: the store's own edit
 * chokepoints, which invalidate at 12 internal call sites.
 */

import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import {
  SRC,
  blankComments,
  productionSources,
  deriveParenCallSites,
} from '../../utils/__tests__/helpers/derivedCallSites'

const SET_STATE = /\buseCanvasStore\.setState\s*\(/g

/** Does this call's argument text write the graph itself? */
function writesGraph(args: string): boolean {
  return /(^|[{,\s])nodes\s*:/.test(args) || /(^|[{,\s])edges\s*:/.test(args)
}

const ALL_SITES = deriveParenCallSites(SET_STATE)
const GRAPH_SITES = ALL_SITES.filter((s) => writesGraph(s.args))
const NON_GRAPH_SITES = ALL_SITES.filter((s) => !writesGraph(s.args))

const siteCounts = new Map<string, number>()
for (const s of GRAPH_SITES) siteCounts.set(s.file, (siteCounts.get(s.file) ?? 0) + 1)

type Disposition = 'chokepoint' | 'invalidates' | 'exempt'

interface Entry {
  /** How many graph-writing `useCanvasStore.setState(` calls this file holds. */
  sites: number
  disposition: Disposition
  /** Mandatory. An exemption without a stated reason is how this class returns. */
  reason: string
}

/** Any of these, present in the file, counts as reaching invalidation. */
const INVALIDATION_MARKERS = [
  'markAnalysisFreshnessDirty',
  // The INLINE atomic form: a graph swap that sets the overlay in the SAME
  // `set()` as the write, so no frame exists in which the graph has moved and
  // the verdict still reads 'fresh'. The store documents this for undo/redo.
  'analysisFreshnessDirty: true',
  'markGraphStructurallyEdited',
  'commitGraphMutation',
  'commitValidatedMutation',
]

/**
 * ⚠ NOT A LIST TO EXTEND TO MAKE A RED GO AWAY.
 * A new `exempt` entry is a claim that a graph write CANNOT invalidate an
 * analysis. Three classes qualify and no others: a write that touches only
 * `selected` flags; a producer sync writing back values the analysis itself
 * produced; and a metadata stamp of fields outside the analytical field
 * registry (`canvas/domain/analyticalNodeFields.ts`). If a new writer is none
 * of those, it belongs on `commitGraphMutation`, not here.
 */
const REGISTRY: Record<string, Entry> = {
  'canvas/mutations/commitGraphMutation.ts': {
    sites: 1,
    disposition: 'chokepoint',
    reason: 'THE convergence point — applies the mutation and invalidates in one place.',
  },
  'canvas/mutations/commitValidatedMutation.ts': {
    sites: 1,
    disposition: 'chokepoint',
    reason: 'Referee-gated sibling of commitGraphMutation; invalidates after committing.',
  },

      'canvas/components/RecoveryBanner.tsx': {
    sites: 1,
    disposition: 'invalidates',
    reason:
      'Autosave restore swaps the whole graph while the freshness slice still describes the graph being replaced. Marks the overlay dirty explicitly (it cannot use commitGraphMutation: the restore writes nine fields in one set(), and the _externalMutationActive window must be raised in the SAME set() as the write).',
  },
  
  'canvas/components/DraftChat.tsx': {
    sites: 1,
    disposition: 'invalidates',
    reason: 'Accepted CEE graph patch; calls markAnalysisFreshnessDirty directly.',
  },
  'canvas/conversation/utils/applyPatch.ts': {
    sites: 2,
    disposition: 'invalidates',
    reason:
      'applyAutoApplyPatch and applyValidatedGraph — each ends its own function with markAnalysisFreshnessDirty.',
  },
  'canvas/contextMenu/actions.ts': {
    sites: 2,
    disposition: 'invalidates',
    reason:
      'One structural site (insert-node-on-edge) runs INSIDE a commitValidatedMutation callback; one writes only `selected` flags for the multi-target context menu.',
  },
  'canvas/utils/mergeServerGraph.ts': {
    sites: 1,
    disposition: 'invalidates',
    reason: 'Boot hydrate; calls markGraphStructurallyEdited (which sets the overlay).',
  },
  'canvas/utils/mergeAppliedGraph.ts': {
    sites: 1,
    disposition: 'invalidates',
    reason: 'Envelope apply; calls markGraphStructurallyEdited (which sets the overlay).',
  },

  'canvas/hooks/useFocusCamera.ts': {
    sites: 1,
    disposition: 'exempt',
    reason:
      'COSMETIC: writes only `selected` on edges to highlight a focus target. No analytical field moves, so invalidating would fabricate cannot-confirm on a user clicking an edge.',
  },
  'canvas/starters/loadStarter.ts': {
    sites: 1,
    disposition: 'exempt',
    reason:
      'METADATA STAMP: writes `starterId`/`starterTitle` provenance onto every node. Neither field is in the analytical registry, and the starter ingestion that precedes it already invalidates.',
  },
  'canvas/utils/applyDraftResult.ts': {
    sites: 1,
    disposition: 'exempt',
    reason:
      'PRODUCER SYNC: backfillGoalThresholdOntoGoalNode writes goal_threshold_* values that CEE sent ON the analysis_ready itself. Invalidating here would use an analysis to invalidate itself.',
  },
  'canvas/conversation/useConversation.ts': {
    sites: 1,
    disposition: 'exempt',
    reason:
      'PREVIEW WITHDRAWAL: discardStreamedPreview removes streamed preview nodes, returning the graph to its pre-preview state — the state any retained verdict was authored against. Owned by the V4-excision lane; unchanged here.',
  },
}

describe('the scanner can see what it claims to see', () => {
  it('POSITIVE CONTROL (magnitude, not just non-zero): the sweep reaches the whole source tree', () => {
    // A probe that fired on three files would agree with every claim below.
    expect(productionSources(SRC).length).toBeGreaterThan(1000)
    expect(ALL_SITES.length).toBeGreaterThan(30)
  })

  it('DISCRIMINATION CONTROL: the payload filter separates graph writes from the rest', () => {
    // If this were empty, `writesGraph` would be matching everything and the
    // manifest would be an accident rather than a classification.
    expect(NON_GRAPH_SITES.length).toBeGreaterThan(10)
    expect(GRAPH_SITES.length).toBeGreaterThan(10)
    expect(GRAPH_SITES.length).toBeLessThan(ALL_SITES.length)
  })

  it('NEGATIVE CONTROL: the classifier admits a graph write and rejects a non-graph one', () => {
    expect(writesGraph('{ nodes: next, edges: nextEdges }')).toBe(true)
    expect(writesGraph('(s) => ({ edges: s.edges.filter(keep) })')).toBe(true)
    expect(writesGraph('{ selection: { nodeIds: new Set() } }')).toBe(false)
    expect(writesGraph('{ ceeAnalysisReady: null }')).toBe(false)
  })

  it('COMMENT CONTROL: a graph write named in prose is not a call site', () => {
    const prose = '// useCanvasStore.setState({ nodes: [], edges: [] }) would bypass the chokepoint\n'
    expect(SET_STATE.test(blankComments(prose))).toBe(false)
    SET_STATE.lastIndex = 0
    // ...and the same text uncommented IS one, so the control is not passing by
    // being unable to match anything at all.
    expect(SET_STATE.test(blankComments(prose.replace('// ', '')))).toBe(true)
    SET_STATE.lastIndex = 0
  })
})

describe('every bare-setState graph writer is registered and accounted for', () => {
  it('BIDIRECTIONAL: the derived manifest and the registry are the same set', () => {
    const derived = [...siteCounts.keys()].sort()
    const registered = Object.keys(REGISTRY).sort()

    // Left red = a NEW graph writer nobody adjudicated. That is the drift this
    // guard exists to catch, and it is the whole point of the file.
    expect(derived.filter((f) => !registered.includes(f))).toEqual([])
    // Right red = a registry entry whose writer is gone. Delete the entry.
    expect(registered.filter((f) => !derived.includes(f))).toEqual([])
  })

  it('site counts are pinned, so a new writer inside a KNOWN file cannot hide', () => {
    const drifted = [...siteCounts.entries()]
      .filter(([file, n]) => REGISTRY[file] && REGISTRY[file].sites !== n)
      .map(([file, n]) => `${file}: registry says ${REGISTRY[file].sites}, source has ${n}`)
    expect(drifted).toEqual([])
  })

  it.each(
    Object.entries(REGISTRY)
      .filter(([, e]) => e.disposition !== 'exempt')
      .map(([file, e]) => [file, e] as const),
  )('%s still contains an invalidation call', (file) => {
    const text = blankComments(
      productionSources(SRC)
        .filter((f) => f.endsWith(file.split('/').join('/')))
        .map((f) => readFileSync(f, 'utf8'))
        .join('\n'),
    )
    expect(INVALIDATION_MARKERS.some((m) => text.includes(m))).toBe(true)
  })

  it('every exemption carries a stated reason', () => {
    const unreasoned = Object.entries(REGISTRY)
      .filter(([, e]) => e.reason.trim().length < 40)
      .map(([file]) => file)
    expect(unreasoned).toEqual([])
  })
})
