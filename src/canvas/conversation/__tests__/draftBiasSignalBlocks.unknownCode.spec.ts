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

const NODES = [{ id: 'opt_status_quo', type: 'option', data: { label: 'Delay Billing Migration' } }]

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

  it('⭐ AND A RECOGNISED CODE IS NEVER TESTED AGAINST THE PREFIX LIST', () => {
    // Registry first, prefix guard second — so a future registry key that
    // happened to collide with a prefix ('con_' vs a hypothetical
    // 'con_formation') resolves as the category it is. Proven by making the
    // collision real rather than by reading the order off the source.
    const collidingKey = Object.keys(BIAS_SIGNAL_REGISTRY).find((k) =>
      FORBIDDEN_TYPE_PREFIXES.some((p) => k.startsWith(p)),
    )
    expect(collidingKey, 'no registry key collides today — this arm is a standing guard').toBeUndefined()

    // The order is what makes that harmless, so assert the order itself: every
    // registry key still emits, whatever it is spelled.
    for (const key of Object.keys(BIAS_SIGNAL_REGISTRY)) {
      const [block] = build([{ type: key, detail: 'An observation.' }])
      expect(block, `registry key ${key} stopped emitting`).toBeDefined()
      expect(block.title).not.toBe(UNRECOGNISED_BIAS_SIGNAL_TITLE)
    }
  })
})
