/**
 * `useOptionLeftOutOfRun` — THE HOOK'S OWN SPEC, WHICH IT DID NOT HAVE.
 *
 * ## ⛔ THIS FILE HAS NOT BEEN RUN. CI IS THE AUTHORITY.
 *
 * It was written under a hard no-execution constraint: no install, no vitest,
 * no typecheck, nothing driven. Every expectation here is derived by reading
 * the module and its three shared predicates at this tip, and a derivation is
 * not a measurement. Read the CI result before believing any line of it, and
 * treat a red as this file being wrong until proven otherwise.
 *
 * ## Why the hook needed one at all
 *
 * The fourth absence shipped covered only by two OptionNode RENDER specs. Both
 * seed options as `{ type: 'option', data: { type: 'option' } }` — every node
 * carrying BOTH spellings — so no case in the corpus could ever discriminate
 * which field the join reads. That corpus shares the code's blind spot exactly
 * as CLAUDE.md trap 13d describes: it cannot certify the predicate over the
 * class it omits, and the class it omits is the one the store actually
 * produces from `addNode` (`type`, no `data.kind`). So the kind seeding is
 * VARIED here, deliberately and by name.
 *
 * ## What is mocked, and what must not be
 *
 * The store module is replaced by a small zustand store — the idiom this
 * directory already uses (`useAnalysisDisplayState.orphanGate.spec.ts`) — so
 * the hook's inputs can be stated exactly. `resolveNodeTypeLiteral` and the
 * three `notAnalysedOptions` predicates are the SUBJECT and are imported for
 * real; mocking either would leave this file asserting its own fixtures.
 *
 * ## Every assertion binds by node id
 *
 * The hook returns a bare reason for one id, so a test that fed it the wrong
 * node would still get a plausible answer. Ids are distinct and stated.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { create, type StoreApi, type UseBoundStore } from 'zustand'

interface MockNode {
  id: string
  type?: string
  data?: Record<string, unknown>
}
interface MockEdge {
  id: string
  source: string
  target: string
}
interface MockCanvasState {
  nodes: MockNode[]
  edges: MockEdge[]
  results: { status: string; report: unknown }
  /**
   * ⭐ THE CURRENCY INPUTS, and they replaced `graphEditedSinceLastRun` here for
   * the reason `useAnalysisResultsAreCurrent`'s header measures: that flag is
   * reset to `false` by `resultsLoadHistorical` and `resultsHydrateFromSupabase`
   * in the same `set()` that installs a restored run, so a spec seeded with it
   * was pinning a gate that opens on every reload.
   *
   * These three are the real classifier's real inputs. `classifyFreshnessForDisplay`
   * is imported for real by the hook under test and is NOT mocked — mocking it
   * would leave this file asserting its own idea of freshness.
   */
  analysisFreshness: { freshness: string; freshnessReason?: string } | null
  analysisFreshnessDirty: boolean
  importPendingServerRegistration: boolean
}

let store: UseBoundStore<StoreApi<MockCanvasState>>

vi.mock('../../store', () => ({
  get useCanvasStore() {
    return store
  },
}))

import { useOptionLeftOutOfRun } from '../useOptionLeftOutOfRun'

/** The three seedings the store and the importers actually produce. */
const typeOnly = (id: string): MockNode => ({ id, type: 'option', data: { label: id } })
const kindOnly = (id: string): MockNode => ({ id, data: { label: id, kind: 'option' } })
const dataTypeOnly = (id: string): MockNode => ({ id, data: { label: id, type: 'option' } })
const bothSpellings = (id: string): MockNode => ({ id, type: 'option', data: { label: id, kind: 'option' } })
const factorNode = (id: string): MockNode => ({ id, type: 'factor', data: { label: id } })

/** The panel's predicate at `useResultsSectionData.ts:2024`, quoted verbatim. */
const panelSaysOption = (n: MockNode) => (n.data as { kind?: unknown } | undefined)?.kind === 'option'

function seed(partial: Partial<MockCanvasState> = {}) {
  store = create<MockCanvasState>(() => ({
    nodes: [],
    edges: [],
    results: { status: 'complete', report: { option_probabilities: {} } },
    // ⚠ THE DEFAULT IS AN AFFIRMATIVE CEE VERDICT, STATED RATHER THAN OMITTED.
    // The hook withholds `not_returned` unless the result is confirmably
    // current, and an omitted slice classifies as 'none' — so a default of
    // `null` here would make every `not_returned` expectation in this file pass
    // for the wrong reason, or fail for one. The currency describe below states
    // BOTH arms explicitly so neither is reached by accident.
    analysisFreshness: { freshness: 'fresh' },
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false,
    ...partial,
  }))
}

const ask = (id: string) => renderHook(() => useOptionLeftOutOfRun(id)).result.current

describe('useOptionLeftOutOfRun — the gates', () => {
  beforeEach(() => seed())

  it('answers null while the run is not complete, on a graph it would otherwise mark', () => {
    // PRECONDITION PINNED: the same graph with status 'complete' DOES mark, so
    // this null is the gate's doing and not the fixture failing to qualify.
    const nodes = [bothSpellings('scored'), bothSpellings('left-out')]
    const report = { option_probabilities: { scored: { status: 'computed' } } }
    seed({ nodes, results: { status: 'complete', report } })
    expect(ask('left-out')).toBe('no_interventions')

    seed({ nodes, results: { status: 'running', report } })
    expect(ask('left-out')).toBeNull()
  })

  it('answers null when the report is absent, on a graph it would otherwise mark', () => {
    const nodes = [bothSpellings('scored'), bothSpellings('left-out')]
    seed({
      nodes,
      results: { status: 'complete', report: { option_probabilities: { scored: {} } } },
    })
    expect(ask('left-out')).toBe('no_interventions')

    seed({ nodes, results: { status: 'complete', report: null } })
    expect(ask('left-out')).toBeNull()
  })

  it('answers null for a node that is not an option, beside an option it does mark', () => {
    // The discriminating pair: one run, two nodes, one marked and one not. A
    // bare null on the factor would also be produced by a hook that marks
    // nothing at all.
    seed({
      nodes: [bothSpellings('scored'), bothSpellings('left-out'), factorNode('a-factor')],
      results: { status: 'complete', report: { option_probabilities: { scored: {} } } },
    })
    expect(ask('a-factor')).toBeNull()
    expect(ask('left-out')).toBe('no_interventions')
  })

  it('answers null for every option when the run produced NO per-option output', () => {
    // The domain guard. "No entry" is true in three worlds and only one is
    // this ruling's; marking all three here would tell a user who configured
    // everything correctly that they configured nothing.
    const nodes = [bothSpellings('one'), bothSpellings('two'), bothSpellings('three')]
    seed({ nodes, results: { status: 'complete', report: { option_probabilities: {} } } })
    for (const n of nodes) expect(ask(n.id)).toBeNull()
  })

  it('answers null for an option the run DID return, beside one it left out', () => {
    seed({
      nodes: [bothSpellings('scored'), bothSpellings('left-out')],
      results: {
        status: 'complete',
        report: { option_probabilities: { scored: { status: 'computed', win_probability: 0.6 } } },
      },
    })
    expect(ask('scored')).toBeNull()
    expect(ask('left-out')).toBe('no_interventions')
  })
})

describe('useOptionLeftOutOfRun — the kind seeding is VARIED, because the store varies it', () => {
  // `addNode` writes `data: { label }` and no `kind`; `addNodeWithEdge` writes
  // `data: { label, kind: type }`; the draft mappers write both `type` and
  // `data.kind`. Reading one field answers correctly for some of those and
  // silently not for others. `resolveNodeTypeLiteral` is the declared owner of
  // the chain, and these are its three links.
  const seedings: Array<[string, (id: string) => MockNode]> = [
    ['node.type only (plain addNode)', typeOnly],
    ['data.kind only', kindOnly],
    ['data.type only', dataTypeOnly],
    ['both spellings (draft mapper)', bothSpellings],
  ]

  it.each(seedings)('marks an option declared by %s', (_label, make) => {
    seed({
      nodes: [bothSpellings('scored'), make('left-out')],
      results: { status: 'complete', report: { option_probabilities: { scored: {} } } },
    })
    expect(ask('left-out')).toBe('no_interventions')
  })

  it.each(seedings)('counts an option declared by %s toward the domain guard', (_label, make) => {
    // The left side of the join feeds the guard as well as the reason. An
    // option the join cannot see is an entry the guard cannot find, so a
    // narrow predicate silences the whole card rather than mis-labelling it —
    // a failure that leaves no trace on screen.
    seed({
      nodes: [make('scored'), bothSpellings('left-out')],
      results: { status: 'complete', report: { option_probabilities: { scored: {} } } },
    })
    expect(ask('left-out')).toBe('no_interventions')
  })
})

describe('useOptionLeftOutOfRun — F1: the intervention predicate reads the domain owner', () => {
  it('does not count an edge to a plain-added option as an intervention', () => {
    // ⭐ THE DIVERGENCE CASE, NAMED. `deriveNotAnalysedReason` calls an edge an
    // INTERVENTION when its target is not an option. So which nodes count as
    // options decides whether this option reads "you have not said what it
    // changes" or "the engine returned nothing" — two sentences with opposite
    // next steps, on one option, in one run.
    const target = typeOnly('sibling-option')
    const subject = bothSpellings('left-out')
    seed({
      nodes: [bothSpellings('scored'), subject, target],
      edges: [{ id: 'e1', source: 'left-out', target: 'sibling-option' }],
      results: { status: 'complete', report: { option_probabilities: { scored: {} } } },
    })

    // PRECONDITION PINNED, so this test cannot pass for the wrong reason: the
    // panel's own predicate genuinely does NOT see this target as an option,
    // which is the divergence under test. If the store ever starts writing
    // `data.kind` from `addNode`, this assertion fails and says so rather than
    // leaving the case below quietly vacuous (CLAUDE.md trap 13b).
    expect(panelSaysOption(target)).toBe(false)
    expect(target.type).toBe('option')

    // An option-to-option edge is not an intervention, so nothing was set.
    expect(ask('left-out')).toBe('no_interventions')
  })

  it('does count an edge to a factor as an intervention', () => {
    // The opposite-direction twin. Without it, a hook that called EVERY edge
    // a non-intervention would pass the case above.
    seed({
      nodes: [bothSpellings('scored'), bothSpellings('left-out'), factorNode('a-factor')],
      edges: [{ id: 'e1', source: 'left-out', target: 'a-factor' }],
      results: { status: 'complete', report: { option_probabilities: { scored: {} } } },
    })
    expect(ask('left-out')).toBe('not_returned')
  })
})

describe('useOptionLeftOutOfRun — F2: a result we cannot vouch for says nothing', () => {
  /**
   * ⛔⛔ THIS DESCRIBE REPLACES ONE GATED ON `graphEditedSinceLastRun`, AND THE
   * REPLACEMENT IS THE FINDING.
   *
   * The old version asserted that an edited graph swapped `not_returned` for a
   * fourth reason, `graph_edited_since_run`. Both the gate and the fourth reason
   * are withdrawn:
   *
   *   · the GATE, because `resultsLoadHistorical` (`canvas/store.ts:6026`) and
   *     `resultsHydrateFromSupabase` (`:6097`) set `graphEditedSinceLastRun:
   *     false` in the same `set()` as `results.status: 'complete'` — so after a
   *     reload or a scenario switch the false engine-blaming sentence returned;
   *   · the FOURTH REASON, because its copy asserted *"the graph has changed"*
   *     and the honest signal cannot say that. `useAnalysisResultsAreCurrent`
   *     returns `false` for 'changed' AND for 'cannot_confirm', and a restored
   *     run is cannot-confirm.
   *
   * So the arm WITHHOLDS. `null`, and the card falls back to the pooled
   * `option-result-unavailable` line.
   */
  const afterTheRun = (freshness: Partial<MockCanvasState>) => ({
    nodes: [bothSpellings('scored'), bothSpellings('added-later'), factorNode('a-factor')],
    edges: [{ id: 'e1', source: 'added-later', target: 'a-factor' }],
    results: { status: 'complete', report: { option_probabilities: { scored: {} } } },
    ...freshness,
  })

  it('withholds the engine-blaming reason once a local edit has dirtied the verdict', () => {
    // The traced journey: a run completes on the options that existed, the user
    // adds one and wires it to a factor (the ordinary connected-add). That path
    // runs `invalidateAnalysisReady` (`store.ts:3438` → `:2890`), which marks
    // the freshness overlay — so a retained CEE 'fresh' displays as 'unknown'
    // and the classifier answers 'changed'.
    //
    // BOTH ARMS ASSERTED, so the gate is shown to discriminate rather than
    // merely to return null.
    seed(afterTheRun({ analysisFreshness: { freshness: 'fresh' }, analysisFreshnessDirty: false }))
    expect(ask('added-later')).toBe('not_returned')

    seed(afterTheRun({ analysisFreshness: { freshness: 'fresh' }, analysisFreshnessDirty: true }))
    expect(ask('added-later')).toBeNull()
  })

  it('⭐ THE DEFECT THIS ROUND CLOSES: a RESTORED run withholds it too', () => {
    // This is the case the old gate got wrong and could not see. Both store
    // actions that install a restored run write exactly this slice —
    // `{ freshness: 'unknown', freshnessReason: 'hydrated_without_capture' }`
    // with the dirty overlay CLEARED — while resetting `graphEditedSinceLastRun`
    // to false. Under the old gate this graph yielded `not_returned`: "the
    // analysis returned no result for this option", about a run whose graph this
    // session has never seen.
    seed(
      afterTheRun({
        analysisFreshness: { freshness: 'unknown', freshnessReason: 'hydrated_without_capture' },
        analysisFreshnessDirty: false,
      }),
    )
    expect(ask('added-later')).toBeNull()
  })

  it('withholds it on a CEE-stated stale verdict as well', () => {
    // The third way the signal says "not current", and the only one the product
    // hears first-hand from the producer. Included so the arm is not pinned to a
    // single reachable state.
    seed(afterTheRun({ analysisFreshness: { freshness: 'stale' }, analysisFreshnessDirty: false }))
    expect(ask('added-later')).toBeNull()
  })

  it('withholds it under an import hold, which the affirmative gate outranks', () => {
    // `classifyFreshnessForDisplay` returns cannot-confirm for (fresh, hold)
    // before it returns 'current' — the ordering its own comment calls "the
    // whole design". Pinned here so this hook inherits that ordering rather
    // than relying on it silently.
    seed(
      afterTheRun({
        analysisFreshness: { freshness: 'fresh' },
        analysisFreshnessDirty: false,
        importPendingServerRegistration: true,
      }),
    )
    expect(ask('added-later')).toBeNull()
  })

  it('does NOT gate `no_interventions`', () => {
    // An option with nothing wired is not submittable, and that is a fact about
    // the graph AS IT IS NOW — it needs no licence from a verdict about the run.
    // Withholding it would delete the only arm that carries an action.
    seed({
      nodes: [bothSpellings('scored'), bothSpellings('bare-option')],
      edges: [],
      results: { status: 'complete', report: { option_probabilities: { scored: {} } } },
      analysisFreshness: { freshness: 'unknown', freshnessReason: 'hydrated_without_capture' },
      analysisFreshnessDirty: false,
    })
    expect(ask('bare-option')).toBe('no_interventions')
  })

  it('does NOT reach an option the run returned, however uncertain the verdict', () => {
    // The gate rides on top of the absence; it must not manufacture one. An
    // analysed option stays silent whatever the currency signal says.
    seed({
      nodes: [bothSpellings('scored')],
      results: {
        status: 'complete',
        report: { option_probabilities: { scored: { status: 'computed', win_probability: 0.6 } } },
      },
      analysisFreshnessDirty: true,
    })
    expect(ask('scored')).toBeNull()
  })

  it('does NOT defeat the domain guard', () => {
    // A confirmably-current result with no per-option output at all is still the
    // world where marking anything would be a lie about the user's setup. Seeded
    // CURRENT deliberately, so the null below is the guard's doing and not the
    // currency gate's — two gates returning the same value is how a test stops
    // discriminating (CLAUDE.md trap 13b).
    seed({
      nodes: [bothSpellings('one'), bothSpellings('two')],
      edges: [{ id: 'e1', source: 'one', target: 'a-factor' }],
      results: { status: 'complete', report: { option_probabilities: {} } },
      analysisFreshness: { freshness: 'fresh' },
      analysisFreshnessDirty: false,
    })
    expect(ask('one')).toBeNull()
    expect(ask('two')).toBeNull()
  })
})
