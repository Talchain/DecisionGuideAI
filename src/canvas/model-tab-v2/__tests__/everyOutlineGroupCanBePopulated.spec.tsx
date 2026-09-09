/**
 * ⭐⭐ AN OUTLINE GROUP THAT NO PRODUCER CAN FILL IS AN ADVERTISED AFFORDANCE
 * TERMINATING IN NOTHING — measured on deployed `fa95cf65` / `9748b336`,
 * driven as a guest.
 *
 * The Model tab rendered SEVEN outline groups. Two of them could never contain
 * anything:
 *
 *   · `Assumptions & provenance` — count `0`, `GROUP_ACTIONS[...] = []`, so it
 *     did not even offer a discuss button. Open it and you got "Nothing in this
 *     group yet" and nothing else.
 *   · `Evidence & review state` — the same, plus one discuss action.
 *
 * The mechanism: `KIND_GROUP` (`adapters.ts:233`) is `Record<ModelElementKind,
 * ModelGroupId>` — TOTAL over all seven kinds — and its VALUE set has only FIVE
 * members. `toModelRows` sets `group` from `KIND_GROUP[kind]` at every node site
 * and hardcodes `'relationships'` for edges, so no code path anywhere can emit a
 * row into either of the other two. Their emptiness was not a data state the
 * user happened to be in; it was a property of the projection.
 *
 * ── WHY THIS GUARD IS DERIVED AND NOT A LIST ──────────────────────────────
 *
 * The tempting spec is `expect(MODEL_GROUP_IDS).toEqual([...five ids])`. That is
 * a hand-maintained mirror (CLAUDE.md trap 12): it pins today's answer and would
 * have to be edited by hand the day a producer legitimately starts emitting
 * evidence rows — at which point it fails for the wrong reason and gets
 * "corrected" by deletion.
 *
 * This asserts the RELATION instead: every group the outline RENDERS must be a
 * group the PRODUCER can fill. The producible set is derived by running the real
 * `toModelRows` over a corpus covering every `ModelElementKind`, so:
 *   · adding a group with no producer  → RED here;
 *   · teaching the producer to emit into a group → this guard goes quiet on its
 *     own, with no edit.
 *
 * ── AND WHY THE CORPUS IS EXHAUSTIVE BY THE TYPE SYSTEM ───────────────────
 *
 * A derived guard proves AGREEMENT and can never prove COMPLETENESS (trap 12d):
 * if the corpus omitted a kind, the producible set would be short and this guard
 * would condemn a group that is in fact reachable. `ModelElementKind` is a type
 * union with no runtime array to iterate, so the corpus below is hand-written —
 * and `_KIND_CORPUS_IS_EXHAUSTIVE` turns a missing kind into a COMPILE error
 * rather than a silently short corpus. That check is the completeness half; it
 * is not derived from the corpus it checks.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import type { EdgeData } from '../../domain/edges'
import { toModelRows, type ModelProjectionInput } from '../adapters'
import { ModelOutline } from '../ModelOutline'
import { MODEL_GROUP_IDS, type ModelElementKind, type ModelGroupId } from '../types'

afterEach(cleanup)

/**
 * One element of every kind the projection knows.
 *
 * ⚠ SHAPED LIKE THE PRODUCER, not like this file's idea of it: `nodeKind`
 * resolves `node.type` first (`adapters.ts`), which is what the canvas store
 * writes, so each node carries its kind there.
 */
const KIND_CORPUS = [
  'goal',
  'decision',
  'option',
  'factor',
  'risk',
  'outcome',
  'relationship',
] as const satisfies readonly ModelElementKind[]

/**
 * COMPILE-TIME COMPLETENESS. If a kind is added to `ModelElementKind` and not to
 * the corpus, `Exclude<…>` stops being `never`, the assignment stops
 * type-checking, and the typecheck gate says so BY NAME. A corpus that can go
 * short in silence would make the guard below condemn reachable groups.
 */
type MissingKinds = Exclude<ModelElementKind, (typeof KIND_CORPUS)[number]>
const _KIND_CORPUS_IS_EXHAUSTIVE: MissingKinds extends never ? true : MissingKinds = true
void _KIND_CORPUS_IS_EXHAUSTIVE

const nodeIdFor = (kind: ModelElementKind) => `node_${kind}`

/**
 * The corpus, BUILT FROM `KIND_CORPUS` rather than beside it.
 *
 * ⚠ THIS DERIVATION IS THE POINT, and the first draft got it wrong: the fixture
 * was a second hand-written list of the same kinds, so `KIND_CORPUS`'s
 * compile-time exhaustiveness guarded an array the fixture did not use — a
 * hand-maintained mirror inside the guard written to replace one (trap 12).
 * Now a kind added to `ModelElementKind` must be added to `KIND_CORPUS` to
 * compile, and adding it there puts it in the fixture automatically.
 *
 * `relationship` is the one kind the projection reads off an EDGE rather than a
 * node, so it becomes the causal edge instead of a node.
 */
function corpusInput(): ModelProjectionInput {
  const nodes: Node[] = KIND_CORPUS
    .filter(kind => kind !== 'relationship')
    .map(kind => ({
      id: nodeIdFor(kind),
      type: kind,
      position: { x: 0, y: 0 },
      data: { label: `A ${kind}`, type: kind },
    }))

  const edges: Edge<EdgeData>[] = KIND_CORPUS.includes('relationship')
    ? [{
        id: 'edge_relationship',
        source: nodeIdFor('factor'),
        target: nodeIdFor('goal'),
        data: { weight: 0.6 } as EdgeData,
      }]
    : []

  return { nodes, edges, goalThreshold: null }
}

/** The groups the REAL producer can actually put a row into. */
function producibleGroups(): Set<string> {
  return new Set(toModelRows(corpusInput()).map(r => r.group))
}

/**
 * The group ids the outline actually RENDERS, read from the DOM.
 *
 * `<section>` is the group wrapper and nothing else in this subtree uses one, so
 * this cannot pick up the `-toggle` button, the `-actions` div or the `-empty`
 * paragraph — a prefix match on `data-testid` alone would.
 */
function renderedGroupIds(): string[] {
  return Array.from(document.querySelectorAll('section[data-testid^="model-group-v2-"]'))
    .map(el => el.getAttribute('data-testid')!.replace('model-group-v2-', ''))
}

describe('⭐ every outline group is one a producer can fill', () => {
  it('renders no group heading that `toModelRows` can never put a row into', () => {
    const producible = producibleGroups()

    // ── Contrast controls, BEFORE the claim (trap 13). ──────────────────────
    // An absence assertion over a producible set that came back empty — a
    // broken fixture, a renamed field, a projection that threw — would condemn
    // EVERY group and read as a spectacular pass of the wrong test.
    expect(producible.size).toBeGreaterThan(0)
    expect(producible.has('factors')).toBe(true)
    expect(producible.has('relationships')).toBe(true)

    render(<ModelOutline rows={[]} tier="plain" />)
    const rendered = renderedGroupIds()
    // And the outline itself DID render, so a short list below is about the
    // groups and not about a failed render.
    expect(rendered.length).toBeGreaterThan(0)

    const unfillable = rendered.filter(id => !producible.has(id))
    expect(
      unfillable,
      `These outline groups render a heading no producer can ever fill. `
        + `Either stop rendering them, or give them a producer. `
        + `Producible: ${[...producible].sort().join(', ')}`,
    ).toEqual([])
  })

  it('the declared group set carries no id the projection cannot reach', () => {
    // The same claim one level up from the DOM: `MODEL_GROUP_IDS` is what
    // `ModelOutline` maps over AND what `outlineLayout` treats as "known" when
    // deciding a row's group is rogue. An id that is known-but-unrenderable
    // would let a row be swallowed with no entry in `unknownGroupRowIds`.
    const producible = producibleGroups()
    expect(producible.size).toBeGreaterThan(0) // contrast control
    expect(MODEL_GROUP_IDS.filter(id => !producible.has(id))).toEqual([])
  })

  it('and every producible group HAS a heading — the guard cannot pass by rendering nothing', () => {
    // The opposite-direction twin (trap 22b). Without it, deleting the outline
    // entirely would satisfy the assertions above.
    render(<ModelOutline rows={[]} tier="plain" />)
    const rendered = new Set(renderedGroupIds())
    const missing = [...producibleGroups()].filter(g => !rendered.has(g))
    expect(missing, 'a group the producer can fill has no heading to fill').toEqual([])
  })
})

describe('the removed groups are gone from every table that keyed on them', () => {
  it.each(['assumptions-provenance', 'evidence-review'])(
    '`%s` is not a ModelGroupId any more',
    dead => {
      expect((MODEL_GROUP_IDS as readonly string[]).includes(dead)).toBe(false)
    },
  )

  it('CONTRAST CONTROL: a group that IS live still reads as a ModelGroupId', () => {
    const live: ModelGroupId = 'outcomes-risks'
    expect((MODEL_GROUP_IDS as readonly string[]).includes(live)).toBe(true)
  })
})
