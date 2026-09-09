/**
 * ⭐⭐ AN OBSERVATION WE CANNOT CATEGORISE IS STILL AN OBSERVATION.
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────
 * `draftBiasSignalBlocks` resolved the wire's `type` through the bias registry
 * and, on a miss, ran `continue` — dropping the WHOLE signal, `detail` included.
 * So whenever the model named a bias in words the UI has no key for, the
 * coaching never reached the reader at all.
 *
 * It is live, not theoretical. The shipped `build-vs-buy` starter carries
 * `"type": "omission / status-quo bias"` — free text, matching no key — and a
 * real paragraph about the status-quo option that nobody using that starter has
 * ever seen. `type` is a free string on the wire, so this is the shape of every
 * code CEE mints before the UI learns it.
 *
 * **That inverts the feature.** Bias coaching is the product's critical-thinking
 * surface, and the design meant the LESS standard the insight, the more likely
 * it was binned.
 *
 * ── WHAT THE FIX MAY AND MAY NOT DO ─────────────────────────────────────────
 * The original guard's reasoning is still right in its own terms: a raw wire
 * token must never leak into copy as a bias NAME. What did not follow is that
 * the producer's paragraph should be thrown away with the name. So the NAME
 * fails closed — the card carries a heading that names no bias — and the
 * CONTENT survives.
 *
 * ⚠ AND IT STAYS A QUESTION, NOT A FINDING. The starter's own paragraph asserts
 * that a baseline with full factor connections carries "unwarranted analytical
 * weight", which does not follow from having connections. Rescuing an
 * observation from silence must not upgrade it into a diagnosis we have
 * validated — hence a heading that invites a check rather than announcing a
 * detected bias.
 */
import { describe, it, expect } from 'vitest'

import { buildDraftBiasSignalBlocks } from '../draftBiasSignalBlocks'
import {
  BIAS_SIGNAL_REGISTRY,
  FORBIDDEN_TYPE_PREFIXES,
  UNRECOGNISED_BIAS_SIGNAL_TITLE,
} from '../../shared/biasSignalTitles'

/**
 * ⚠ A SECOND NODE, ADDED BECAUSE MY OWN CHECK PASSED ON A FIXTURE THIS SPEC
 * DOES NOT HAVE. I validated the ref-merging arms below by executing the real
 * builder against a node list I wrote in the harness — which contained
 * `fac_initial_quote`. This spec's did not, so `resolveNodeForTarget` returned
 * null, there was no ref to merge, and both arms went red in CI having passed
 * locally. A fixture you wrote yourself is not evidence about the fixture the
 * test actually runs.
 *
 * Two nodes is also the minimum the merging property NEEDS: one observation
 * naming two different affected nodes cannot be expressed with one.
 */
const NODES = [
  { id: 'opt_status_quo', type: 'option', data: { label: 'Delay Billing Migration' } },
  { id: 'fac_initial_quote', type: 'factor', data: { label: 'Initial quote' } },
]

/** The starter's own free-text code, verbatim — not a code invented for a test. */
const STARTER_CODE = 'omission / status-quo bias'
const STARTER_DETAIL =
  'Delay Billing Migration (Status Quo) is modeled as a live option with full factor ' +
  'connections rather than as a dominated baseline.'

function build(signals: unknown[]) {
  return buildDraftBiasSignalBlocks({
    isDraftTurn: true,
    store: { draftCoaching: { biasSignals: signals } as never, nodes: NODES as never },
  })
}

describe('an unrecognised bias code keeps its observation', () => {
  it('emits the producer detail under a heading that names no bias', () => {
    const [block] = build([{ type: STARTER_CODE, detail: STARTER_DETAIL, target: 'opt_status_quo' }])

    expect(block, 'the signal was dropped — the observation is lost').toBeDefined()
    expect(block.body).toBe(STARTER_DETAIL)
    expect(block.title).toBe(UNRECOGNISED_BIAS_SIGNAL_TITLE)
  })

  it('never leaks the raw wire token, and never borrows a registry name', () => {
    const [block] = build([{ type: STARTER_CODE, detail: STARTER_DETAIL }])

    // The original guard's reasoning, preserved: a raw token must not become
    // copy. That is why the NAME still fails closed even though the body no
    // longer does.
    expect(block.title).not.toContain(STARTER_CODE)
    expect(block.title).not.toContain('omission')
    // …and it must not silently adopt a neighbouring bias's name either.
    const registryTitles = Object.values(BIAS_SIGNAL_REGISTRY).map(e => e.title)
    expect(registryTitles).not.toContain(block.title)
  })

  it('keeps the affected-node context', () => {
    const [block] = build([{ type: STARTER_CODE, detail: STARTER_DETAIL, target: 'opt_status_quo' }])
    expect(block.target_refs).toHaveLength(1)
  })

  it('CONTRAST — a RECOGNISED code still gets its own title', () => {
    // ⭐ Without this the change could have collapsed every card to the neutral
    // heading and still passed everything above — losing the categorisation we
    // DO have, which is the opposite defect.
    const [block] = build([{ type: 'anchoring', detail: 'An early number is steering the estimates.' }])
    expect(block.title).toBe(BIAS_SIGNAL_REGISTRY.anchoring.title)
    expect(block.title).not.toBe(UNRECOGNISED_BIAS_SIGNAL_TITLE)
  })

  it('still drops a signal with no observation at all', () => {
    // A heading with nothing under it is a card announcing only that something
    // was withheld. The fix preserves CONTENT; it does not manufacture cards.
    expect(build([{ type: STARTER_CODE, detail: '   ' }])).toHaveLength(0)
    expect(build([{ type: STARTER_CODE }])).toHaveLength(0)
  })
})

describe('the dedup key does not become a second way to lose content', () => {
  it('keeps two DIFFERENT unrecognised observations', () => {
    // ⚠ THE REGRESSION THIS FIX COULD HAVE INTRODUCED. Dedup keyed on the title,
    // which is right for resolved codes — two "Anchoring" cards say the same
    // thing — but every unrecognised signal now shares ONE heading, so a
    // title-only key would silently collapse unrelated observations into
    // whichever arrived first.
    const blocks = build([
      { type: 'first unknown category', detail: 'The status-quo option may be over-weighted.' },
      { type: 'second unknown category', detail: 'Competitor response timing is not modelled.' },
    ])

    expect(blocks).toHaveLength(2)
    expect(blocks.map(b => b.body)).toEqual([
      'The status-quo option may be over-weighted.',
      'Competitor response timing is not modelled.',
    ])
  })

  it('still collapses two IDENTICAL observations', () => {
    // The twin: dedup must not be disabled wholesale to satisfy the case above.
    const blocks = build([
      { type: 'unknown a', detail: STARTER_DETAIL },
      { type: 'unknown b', detail: STARTER_DETAIL },
    ])
    expect(blocks).toHaveLength(1)
  })
})

/**
 * ⭐⭐ THE RESCUE HAS A BOUNDARY, AND THIS IS WHERE IT IS DRAWN.
 *
 * My first version of the fix treated EVERY registry miss as "a category we
 * have no key for". Three ratified fail-closed arms went red and all three
 * were right. The resolver answers ONE question — "is this a code I hold?" —
 * and I read its miss as the answer to a different one. What sits between them
 * is entries the producer FAULTED: a `type` that is absent, non-string, or
 * holding a node reference. Those are not uncategorised observations; they are
 * entries whose category field does not contain a category, and content pulled
 * out of one has unknown provenance.
 *
 * ⚠ THE RISK THIS SUITE EXISTS TO CATCH IS THAT THE BOUNDARY MOVES ONE STEP
 * TOO FAR AND EATS THE THING THE PR RESCUES. The starter's own code is free
 * text; a guard drawn slightly wider — on "contains an underscore", say, or
 * "no space" — would drop it and every arm above would still pass, because
 * they are about what the rescue KEEPS and this is about what it REFUSES. So
 * the discriminating pair is asserted here, in one place: the refusals refuse
 * AND the starter's code survives them.
 */
describe('the rescue refuses a faulted entry, and only a faulted entry', () => {
  it('drops an entity-id in the category slot — a producer field error, not a category', () => {
    expect(build([{ type: 'fac_current_supplier', detail: 'Prose.', target: 'opt_status_quo' }])).toEqual([])
  })

  it.each(FORBIDDEN_TYPE_PREFIXES.map((prefix) => [prefix]))(
    'drops every canonical entity-id prefix — %s',
    (prefix) => {
      // Derived from the list itself, so a prefix added in lockstep with CEE's
      // pattern is covered the day it lands (trap 12 — derive, don't mirror).
      expect(build([{ type: `${prefix}whatever`, detail: 'Prose.' }])).toEqual([])
      expect(build([{ type: `${String(prefix).toUpperCase()}WHATEVER`, detail: 'Prose.' }])).toEqual([])
    },
  )

  it('drops an absent or non-string code — no category at all is not an unknown one', () => {
    expect(build([{ type: '', detail: 'Prose.' }])).toEqual([])
    expect(build([{ type: '   ', detail: 'Prose.' }])).toEqual([])
    expect(build([{ type: 42, detail: 'Prose.' }])).toEqual([])
    expect(build([{ detail: 'Prose.' }])).toEqual([])
  })

  it('drops a non-object entry without crashing', () => {
    expect(build([null, 'anchoring', 7, undefined])).toEqual([])
  })

  it('⭐ DISCRIMINATING TWIN — the starter code passes every refusal above', () => {
    // Without this the guards could be widened until they swallowed the whole
    // feature and nothing here would go red. It binds by the starter's exact
    // shipped string, not by a value predicate another code could satisfy.
    expect(
      FORBIDDEN_TYPE_PREFIXES.some((prefix) => STARTER_CODE.toLowerCase().startsWith(prefix)),
      'the entity-id guard now eats the very observation this change rescues',
    ).toBe(false)

    const [block] = build([{ type: STARTER_CODE, detail: STARTER_DETAIL, target: 'opt_status_quo' }])
    expect(block, 'the starter observation is being dropped again').toBeDefined()
    expect(block.body).toBe(STARTER_DETAIL)
  })

  it('⭐ REGISTRY FIRST — every recognised code emits its own title', () => {
    // ⚠ THE FIRST VERSION OF THIS ARM WAS MISLEADING AND REVIEW SAID SO. It
    // asserted that no current registry key starts with a forbidden prefix —
    // which is a fact about today's registry, NOT a proof that the registry is
    // consulted first. It would have passed just as happily on a builder that
    // ran the boundary check before the lookup.
    //
    // A real collision cannot be manufactured without adding a key to the
    // shared registry, so the claim is narrowed to what IS demonstrable: every
    // key the registry holds emits ITS OWN title and never the neutral one. A
    // builder that ran the boundary first would still pass on today's keys —
    // stated here rather than papered over, because a guard that overstates
    // what it proves is the thing being corrected.
    for (const key of Object.keys(BIAS_SIGNAL_REGISTRY)) {
      const [block] = build([{ type: key, detail: 'An observation.' }])
      expect(block, `registry key ${key} stopped emitting`).toBeDefined()
      expect(block.title).toBe(BIAS_SIGNAL_REGISTRY[key as keyof typeof BIAS_SIGNAL_REGISTRY].title)
      expect(block.title).not.toBe(UNRECOGNISED_BIAS_SIGNAL_TITLE)
    }
  })
})

/**
 * ⭐⭐ KEEPING THE OBSERVATION ONCE MUST NOT ERASE ITS SCOPE.
 *
 * The blocking finding from review, and the one my first two pushes missed
 * while I chased CI failures. Every unrecognised signal shares one heading, so
 * identity has to carry the detail — and that made two signals with the SAME
 * paragraph on DIFFERENT nodes look like a duplicate. The second entry was
 * `continue`d and its `target_ref` went with it.
 *
 * They are not a duplicate. They are ONE observation about TWO nodes, and the
 * scope is half the information: "evidence for this estimate is missing" is a
 * different prompt when it names one option than when it names two.
 */
describe('a repeated observation keeps every node it names', () => {
  const SHARED = 'Evidence for this estimate is missing.'

  it('merges distinct affected nodes into the single retained card', () => {
    const blocks = build([
      { type: 'unknown one', detail: SHARED, target: 'opt_status_quo' },
      { type: 'unknown two', detail: SHARED, target: 'fac_initial_quote' },
    ])

    expect(blocks, 'the observation should still be kept ONCE').toHaveLength(1)
    // ⭐ EXACT REFS, not a length — a length passes on the wrong node.
    expect(blocks[0].target_refs.map((r) => r.id)).toEqual(['opt_status_quo', 'fac_initial_quote'])
  })

  it('⛔ THE CAP BOUNDS CARDS, NOT THE SCAN — a duplicate past it still merges', () => {
    // ⚠ THE SUBSTANCE OF THE FIX. The loop condition used to carry
    // `out.length < CAP`, so scanning STOPPED once two cards existed and a
    // later entry naming a third node was never read. Two filler observations
    // fill the cap here; the fourth entry repeats the FIRST and names a node
    // it does not yet carry.
    const blocks = build([
      { type: 'unknown one', detail: SHARED, target: 'opt_status_quo' },
      { type: 'anchoring', detail: 'An early number is steering the estimates.' },
      { type: 'sunk_cost', detail: 'Past spend is treated as a reason to continue.' },
      { type: 'unknown three', detail: SHARED, target: 'fac_initial_quote' },
    ])

    expect(blocks, 'the display cap still holds at two cards').toHaveLength(2)
    expect(blocks[0].target_refs.map((r) => r.id)).toEqual(['opt_status_quo', 'fac_initial_quote'])
  })

  it('the same node twice adds nothing — merging is by node id', () => {
    const blocks = build([
      { type: 'unknown one', detail: SHARED, target: 'opt_status_quo' },
      { type: 'unknown two', detail: SHARED, target: 'opt_status_quo' },
    ])
    expect(blocks[0].target_refs.map((r) => r.id)).toEqual(['opt_status_quo'])
  })

  it('⭐ CONTRAST — a DIFFERENT observation still gets its own card', () => {
    // Without this, "merge duplicates" could have been implemented as "collapse
    // every unrecognised signal into one card", and every arm above would pass
    // while the feature lost exactly the content it exists to keep.
    const blocks = build([
      { type: 'unknown one', detail: SHARED, target: 'opt_status_quo' },
      { type: 'unknown two', detail: 'Competitor response timing is not modelled.' },
    ])
    expect(blocks).toHaveLength(2)
  })

  it('⛔ CONTRAST — recognised-code policy is UNCHANGED by this repair', () => {
    // Review was explicit that the recognised path stays as ratified: the same
    // bias on different targets is ONE card by title-only identity, and this
    // fix must not quietly extend ref-merging to it.
    const blocks = build([
      { type: 'anchoring', detail: 'First note.', target: 'opt_status_quo' },
      { type: 'anchoring_bias', detail: 'Second note.', target: 'fac_initial_quote' },
    ])
    expect(blocks).toHaveLength(1)
    expect(blocks[0].target_refs.map((r) => r.id)).toEqual(['opt_status_quo'])
  })
})
