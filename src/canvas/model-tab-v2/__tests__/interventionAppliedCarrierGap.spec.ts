/**
 * ⭐⭐⭐ THE ACTIVATION GATE: A COMMITTED OPTION-EFFECT EDIT HAS NO WAY BACK INTO
 * THE CLIENT'S MODEL, AND THIS FILE IS WHERE THAT STOPS BEING INVISIBLE.
 *
 * The row's pending state ends in two ways. The REFUSED half is closed: the
 * sender's rejection is read, and a proven-no-write conflict, an unverified
 * failure and a transport failure each end it with their own sentence. The
 * APPLIED half is written and CANNOT FIRE, because nothing carries the
 * committed value back.
 *
 * ── DERIVED AT ALL THREE LAYERS, NOT INFERRED FROM ONE ─────────────────────
 *
 *  1. CONTRACT — `@talchain/schemas` 0.54.0, the PUBLISHED tarball this repo
 *     vendors (`dist/boundary/blocks.js:12`): `GraphEditOperationSchema` is
 *     `z.enum(['set_factor_value', 'add_constraint', 'adjust_edge_strength'])`.
 *     There is no operation that names an option's effect on a factor. The
 *     enum exists precisely so "semantic-garbage constructions fail at parse
 *     time", so this is a closed vocabulary, not an omission a producer can
 *     route around.
 *
 *  2. PRODUCER — CEE `origin/staging` `3ff6c8db`,
 *     `system-events/option-intervention-edit.ts:155,204`. The writer commits
 *     with `blocks: []`. It emits no patch of any kind; the committed arm's
 *     response adds only `graph_hash`.
 *
 *  3. CONSUMER — `src/v5/applyV5State.ts`. The `graph_patch` switch is
 *     exhaustive over those three (`const _exhaustive: never = block.operation`)
 *     and the file's own header states it: "`applyV5State` itself never adds
 *     nodes — its only graph_patch operators are `set_factor_value`,
 *     `adjust_edge_strength` and `add_constraint`". No whole-graph reconcile
 *     applies either: that path needs a `draft_graph` with nodes, which a
 *     system-event turn does not carry.
 *
 * ── WHAT THAT MEANS, STATED PLAINLY ────────────────────────────────────────
 * `graph_hash` DOES come back and `applyV5State` stamps `lastServerGraphHash`
 * from it, so a SECOND edit encodes against a fresh base without the user doing
 * anything — that half works. The VALUE does not come back. So a successful
 * commit leaves the row saying "sent, not saved yet" indefinitely.
 *
 * ⚠⚠ THIS IS THE ACTIVATION GATE, AND IT IS NOT A UI DEFECT.
 * `CANONICAL_EDIT_AUTHORITY.modelOptionIntervention` MUST STAY `'disabled'`
 * until a carrier exists. No amount of client work closes it: the client cannot
 * learn a value the wire does not carry, and the only honest client-side
 * alternative — settling on the hash MOVING — would be an inference ("something
 * committed") dressed as a fact ("your number landed"), which is the optimistic
 * receipt this whole surface was rebuilt to remove.
 *
 * The fix is producer-side and contract-shaped: a fourth
 * `GraphEditOperationSchema` member, emitted by the committed arm. That is a
 * schemas ALLOCATION decision and is deliberately not taken here.
 *
 * ── WHY A TEST AND NOT A COMMENT ───────────────────────────────────────────
 * A gap recorded in a comment is a gap nobody is told about again. Pinned as an
 * EXACT set, the suite goes RED the moment the vocabulary grows OR shrinks —
 * so the change that adds the carrier arrives with a failing test naming the
 * applicator that has to be written, instead of landing beside a settlement
 * nobody remembers is waiting for it.
 */
import { describe, it, expect } from 'vitest'
import type { OlumiResponse } from '@talchain/schemas/boundary'

type GraphPatchBlock = Extract<OlumiResponse['blocks'][number], { type: 'graph_patch' }>
type GraphPatchOperation = GraphPatchBlock['operation']

/** The vocabulary as it stands. Change this ONLY with the applicator. */
const PINNED_OPERATIONS = ['add_constraint', 'adjust_edge_strength', 'set_factor_value'] as const
type PinnedOperation = (typeof PINNED_OPERATIONS)[number]

/**
 * ⭐ THE PIN THAT ACTUALLY BITES, AND IT BITES AT TYPECHECK.
 *
 * Mutual assignability, both directions — one direction alone is half a pin. A
 * new contract member makes `GraphPatchOperation extends PinnedOperation` fail;
 * a removed one makes the reverse fail. Either way the gate above is re-read by
 * a human before the vocabulary moves.
 */
type MutuallyExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const OPERATION_VOCABULARY_IS_EXACT: MutuallyExact<GraphPatchOperation, PinnedOperation> = true

describe('the graph_patch vocabulary a committed option-effect edit would need', () => {
  it('is exactly three operations, and none of them is an option intervention', () => {
    expect(OPERATION_VOCABULARY_IS_EXACT).toBe(true)
    expect([...PINNED_OPERATIONS].sort()).toEqual([
      'add_constraint',
      'adjust_edge_strength',
      'set_factor_value',
    ])
  })

  it('⚠ no member carries an OPTION and a FACTOR together — the shape this edit needs', () => {
    // `set_factor_value` moves what a factor IS. `adjust_edge_strength` moves a
    // relationship's magnitude. `add_constraint` states a goal bound. An option
    // intervention is "what ONE option would make ONE factor become" — two
    // canonical ids and a model-scale value — and reusing `set_factor_value`
    // for it is the exact witnessed defect `option_intervention_edit` exists to
    // fix: on the captured journey a user answering an option-effect question
    // had a factor BASELINE written instead.
    const optionEffectShaped = PINNED_OPERATIONS.filter(op => op.includes('option'))
    expect(optionEffectShaped).toEqual([])
  })

  it('POSITIVE CONTROL: the filter above can find something', () => {
    // Without this, the assertion is satisfied by a filter pointed at nothing —
    // an absence probe with no proof it can see a presence.
    expect(PINNED_OPERATIONS.filter(op => op.includes('factor'))).toEqual(['set_factor_value'])
  })
})
