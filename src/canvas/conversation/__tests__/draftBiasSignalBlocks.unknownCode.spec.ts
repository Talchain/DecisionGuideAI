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
