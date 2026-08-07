/**
 * Leg 3 (bias-coaching rendering slice) — builder pins for
 * buildDraftBiasSignalBlocks: draft-turn `coaching.bias_signals` →
 * typed `v5_coaching` conversation blocks with
 * `coaching_kind: 'bias_signal'` (the 0.15.0 boundary enum value).
 *
 * Fixture provenance: the CANONICAL deployed wire shape is
 * `BiasSignalSchema = z.object({ type, detail }).strict()`
 * (@talchain/schemas dist/coaching.js) — real signals carry ONLY
 * `{ type, detail }` and NEVER a `target`. `CEEDraftCoachingWire.bias_signals`
 * declares an OPTIONAL `target?` (a UI-adapter widening), but the strict wire
 * never sends it, so requiring it skipped every real signal. Grounding is
 * therefore OPTIONAL here — mirroring CEE #541: a known-type, non-blank-detail
 * signal emits whether or not it names a resolvable node; when a target IS
 * present and resolves it rides as a target_ref, otherwise the card is
 * ungrounded (renderer guards pills on target_refs.length > 0). Labels and ids
 * here are synthetic.
 *
 * Pinned behaviour (ratified: cards capped at 2):
 *   1. A real-wire signal ({ type, detail }, no target) → one ungrounded card
 *      (target_refs []). Grounded signals ride the resolved ref.
 *   2. Three or more signals → exactly two (wire order, post-dedupe).
 *   3. Not a draft turn → nothing.
 *   4. Absent coaching / empty array → nothing.
 *   5. Unknown bias code → that signal renders nothing (others unaffected).
 *   6. Malformed entry (blank detail / blank type / wrong types) → nothing
 *      for that entry, never a crash.
 *   7. Ungrounded (missing / unresolvable / blank-label target) → STILL emits,
 *      ungrounded (target_refs []) — grounding is optional.
 *   8. No raw code string ever becomes visible copy (sweep across the
 *      known-code allowlist).
 *   9. Producer-typed bias coaching already on the turn → builder yields
 *      nothing (producer blocks win; no doubled cards).
 *  10. Dedupe by canonical humanised TITLE only — the same bias is one card
 *      regardless of which node(s) it names (CEE #541 parity).
 */
import { describe, it, expect } from 'vitest'

import {
  DRAFT_BIAS_SIGNAL_CARD_CAP,
  buildDraftBiasSignalBlocks,
} from '../draftBiasSignalBlocks'
import { BIAS_SIGNAL_REGISTRY } from '../../shared/biasSignalTitles'
import type { ConversationBlock, V5CoachingBlock } from '../types'

// ─── Fixtures ────────────────────────────────────────────────────────────

/** Canvas nodes the grounded targets resolve against. */
const NODES = [
  { id: 'fac_current_supplier', type: 'factor', data: { label: 'Current supplier terms' } },
  { id: 'fac_initial_quote', type: 'factor', data: { label: 'Initial quote' } },
  { id: 'opt_switch', type: 'option', data: { label: 'Switch supplier' } },
  { id: 'fac_blank_label', type: 'factor', data: { label: '   ' } },
]

/** Wire-shaped signals, post-adapter (CEEDraftCoaching.biasSignals). */
const SIGNAL_STATUS_QUO = {
  type: 'status_quo_bias',
  detail: 'The model leans on keeping the current supplier without weighing the switch on equal terms.',
  target: 'fac_current_supplier',
}
const SIGNAL_ANCHORING = {
  type: 'anchoring',
  detail: 'Estimates cluster tightly around the initial quote rather than an independent range.',
  target: 'fac_initial_quote',
}
const SIGNAL_SUNK_COST = {
  type: 'sunk_cost',
  detail: 'Past spend on the current contract is treated as a reason to continue.',
  target: 'opt_switch',
}

function makeStore(
  biasSignals: Array<{ type: string; detail: string; target?: string }> | null,
) {
  return {
    draftCoaching:
      biasSignals === null
        ? null
        : { summary: null, strengthenItems: [], wideningLog: [], biasSignals },
    nodes: NODES,
  }
}

function build(
  biasSignals: Array<{ type: string; detail: string; target?: string }> | null,
  overrides: Partial<{ isDraftTurn: boolean; existingBlocks: readonly ConversationBlock[] }> = {},
): V5CoachingBlock[] {
  return buildDraftBiasSignalBlocks({
    isDraftTurn: overrides.isDraftTurn ?? true,
    store: makeStore(biasSignals),
    existingBlocks: overrides.existingBlocks ?? [],
  })
}

// ─── Pins ────────────────────────────────────────────────────────────────

describe('buildDraftBiasSignalBlocks — happy path', () => {
  it('two grounded signals → two typed v5_coaching blocks with coaching_kind bias_signal', () => {
    const blocks = build([SIGNAL_STATUS_QUO, SIGNAL_ANCHORING])
    expect(blocks).toHaveLength(2)
    for (const b of blocks) {
      expect(b.type).toBe('v5_coaching')
      expect(b.coaching_kind).toBe('bias_signal')
      expect(b.source).toBe('draft_graph')
    }
  })

  it('humanises the bias code into the title and keeps the detail verbatim as the body', () => {
    const blocks = build([SIGNAL_STATUS_QUO, SIGNAL_ANCHORING])
    expect(blocks[0].title).toBe('Status quo bias')
    expect(blocks[0].body).toBe(SIGNAL_STATUS_QUO.detail)
    expect(blocks[1].title).toBe('Anchoring')
    expect(blocks[1].body).toBe(SIGNAL_ANCHORING.detail)
  })

  it('carries the grounded reference as a target ref resolved against the graph', () => {
    const blocks = build([SIGNAL_STATUS_QUO])
    expect(blocks[0].target_refs).toEqual([
      { id: 'fac_current_supplier', label: 'Current supplier terms', kind: 'factor' },
    ])
  })

  it('assigns stable distinct block ids and FABRICATES no producer-owned fields', () => {
    const blocks = build([SIGNAL_STATUS_QUO, SIGNAL_ANCHORING])
    expect(blocks[0].block_id).not.toBe(blocks[1].block_id)
    // priority_rank / freshness are producer-owned Phase 3 fields the wire
    // bias_signals never carry — the bridge must not invent them
    // (review-folds 2026-07-17 Conv1; verified zero consumers).
    for (const b of blocks) {
      expect(b).not.toHaveProperty('priority_rank')
      expect(b).not.toHaveProperty('freshness')
    }
  })
})

describe('buildDraftBiasSignalBlocks — ungrounded emit (the REAL deployed wire shape)', () => {
  // The canonical deployed schema is z.object({ type, detail }).strict()
  // (@talchain/schemas dist/coaching.js) — real signals carry ONLY
  // { type, detail }, never a target. The prior `if (!ref) continue` skipped
  // every such signal, so the fallback emitted zero cards. Grounding is now
  // OPTIONAL (CEE #541 parity).
  it('a signal of exactly { type, detail } (NO target) → one card with target_refs []', () => {
    const blocks = build([
      { type: 'anchoring', detail: 'Estimates cluster tightly around the initial quote.' },
    ])
    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('v5_coaching')
    expect(blocks[0].coaching_kind).toBe('bias_signal')
    expect(blocks[0].source).toBe('draft_graph')
    expect(blocks[0].title).toBe('Anchoring')
    expect(blocks[0].body).toBe('Estimates cluster tightly around the initial quote.')
    expect(blocks[0].target_refs).toEqual([])
  })

  it('distinct ungrounded signals each emit (up to the cap), all with target_refs []', () => {
    const blocks = build([
      { type: 'anchoring', detail: 'Anchoring prose, no target.' },
      { type: 'status_quo_bias', detail: 'Status quo prose, no target.' },
    ])
    expect(blocks).toHaveLength(2)
    expect(blocks.map((b) => b.title)).toEqual(['Anchoring', 'Status quo bias'])
    for (const b of blocks) expect(b.target_refs).toEqual([])
  })

  it('an unresolvable / off-canvas / blank-label / whitespace target does NOT suppress the card — it emits ungrounded', () => {
    // None of these targets resolves to a ref, but each is a known-type,
    // non-blank-detail signal, so each still emits with target_refs []. (Same
    // bias type would dedupe by title, so each case is asserted on its own.)
    expect(build([{ type: 'anchoring', detail: 'No target at all.' }])[0].target_refs).toEqual([])
    expect(
      build([{ type: 'anchoring', detail: 'Off-canvas target.', target: 'fac_ghost' }])[0].target_refs,
    ).toEqual([])
    expect(
      build([{ type: 'anchoring', detail: 'Blank-label target.', target: 'fac_blank_label' }])[0]
        .target_refs,
    ).toEqual([])
    expect(
      build([{ type: 'anchoring', detail: 'Whitespace target.', target: '   ' }])[0].target_refs,
    ).toEqual([])
  })

  it('when a target IS present and resolves, it rides as the target_ref (grounded path retained)', () => {
    const blocks = build([SIGNAL_STATUS_QUO])
    expect(blocks[0].target_refs).toEqual([
      { id: 'fac_current_supplier', label: 'Current supplier terms', kind: 'factor' },
    ])
  })
})

describe('buildDraftBiasSignalBlocks — the ratified cap (≤2 cards)', () => {
  it('pins the cap constant at 2', () => {
    expect(DRAFT_BIAS_SIGNAL_CARD_CAP).toBe(2)
  })

  it('three grounded signals → exactly two blocks, first two in wire order', () => {
    const blocks = build([SIGNAL_STATUS_QUO, SIGNAL_ANCHORING, SIGNAL_SUNK_COST])
    expect(blocks).toHaveLength(2)
    expect(blocks.map((b) => b.title)).toEqual(['Status quo bias', 'Anchoring'])
  })

  it('the cap counts rendered cards, not raw entries — dropped entries do not consume slots', () => {
    const blocks = build([
      { type: 'made_up_bias', detail: 'Unknown code → dropped.', target: 'fac_initial_quote' }, // unknown → dropped
      SIGNAL_ANCHORING,
      SIGNAL_SUNK_COST,
    ])
    expect(blocks).toHaveLength(2)
    expect(blocks.map((b) => b.title)).toEqual(['Anchoring', 'Sunk cost'])
  })
})

describe('buildDraftBiasSignalBlocks — fail closed', () => {
  it('not a draft turn → nothing', () => {
    expect(build([SIGNAL_STATUS_QUO], { isDraftTurn: false })).toEqual([])
  })

  it('absent coaching (null) → nothing', () => {
    expect(build(null)).toEqual([])
  })

  it('empty bias_signals array → nothing', () => {
    expect(build([])).toEqual([])
  })

  it('unknown bias code → nothing for that signal; known ones still render', () => {
    const blocks = build([
      { type: 'made_up_bias', detail: 'Some plausible prose.', target: 'fac_initial_quote' },
      SIGNAL_ANCHORING,
    ])
    expect(blocks).toHaveLength(1)
    expect(blocks[0].title).toBe('Anchoring')
  })

  it('entity-id-shaped code → nothing for that signal (never sentence-cased into copy)', () => {
    const blocks = build([
      { type: 'fac_current_supplier', detail: 'Prose.', target: 'fac_initial_quote' },
    ])
    expect(blocks).toEqual([])
  })

  it('malformed entries → nothing for each, never a crash', () => {
    const malformed = [
      { type: 'anchoring', detail: '   ', target: 'fac_initial_quote' }, // blank detail
      { type: '', detail: 'Prose.', target: 'fac_initial_quote' }, // blank type
      { type: 42, detail: 'Prose.', target: 'fac_initial_quote' }, // wrong type type
      { type: 'anchoring', detail: 7, target: 'fac_initial_quote' }, // wrong detail type
      null, // not an object
      'anchoring', // not an object
    ] as unknown as Array<{ type: string; detail: string; target?: string }>
    expect(build(malformed)).toEqual([])
  })

  it('ungrounded signals still emit (grounding optional) — see the ungrounded-emit suite for target_refs []', () => {
    // Grounding is NOT a fail-closed condition: a known-type, non-blank-detail
    // signal with an unresolvable target still emits (ungrounded). The four
    // cases here are all `anchoring`, so dedupe-by-title collapses them to a
    // SINGLE ungrounded card — the inverse of the old "→ nothing" pin.
    const blocks = build([
      { type: 'anchoring', detail: 'No target at all.' },
      { type: 'anchoring', detail: 'Target not on the canvas.', target: 'fac_ghost' },
      { type: 'anchoring', detail: 'Target label is blank.', target: 'fac_blank_label' },
      { type: 'anchoring', detail: 'Whitespace target.', target: '   ' },
    ])
    expect(blocks).toHaveLength(1)
    expect(blocks[0].title).toBe('Anchoring')
    expect(blocks[0].target_refs).toEqual([])
  })

  it('producer-typed bias coaching already on the turn → builder yields nothing', () => {
    const producerBlock: ConversationBlock = {
      type: 'v5_coaching',
      block_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c02',
      title: 'Possible anchoring on the first option',
      body: 'You have only explored variations of Option A so far.',
      coaching_kind: 'bias_signal',
      source: 'draft_graph',
      target_refs: [],
      priority_rank: 1,
      freshness: 'fresh',
    }
    expect(build([SIGNAL_STATUS_QUO], { existingBlocks: [producerBlock] })).toEqual([])
    // A non-bias coaching block does NOT suppress the bridge.
    const otherKind: ConversationBlock = {
      ...producerBlock,
      block_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c03',
      coaching_kind: 'strengthen',
    }
    expect(build([SIGNAL_STATUS_QUO], { existingBlocks: [otherKind] })).toHaveLength(1)
  })
})

describe('bias-signal titles — prototype-chain escapes (hostile wire codes)', () => {
  // A bare object-literal index walks the prototype chain: '__proto__'
  // yields Object.prototype (a truthy object — React throws "Objects are
  // not valid as a React child", crashing the assistant-message subtree)
  // and 'constructor' yields the Object function (blank title + console
  // error). Both must fail closed like any other unknown code.
  //
  // The direct resolver-level assertions that used to sit here are covered
  // (with more cases) by biasSignalTitles.parity.spec.ts C7. What this
  // spec uniquely owns is the INTEGRATION below: hostile codes arriving as
  // grounded signals must produce no cards.
  it('grounded signals carrying hostile codes render no cards (case-insensitive path included)', () => {
    const blocks = build([
      { type: '__proto__', detail: 'Hostile wire code.', target: 'fac_initial_quote' },
      { type: 'CONSTRUCTOR', detail: 'Hostile wire code.', target: 'fac_initial_quote' },
    ])
    expect(blocks).toEqual([])
  })
})

describe('buildDraftBiasSignalBlocks — no raw code string in visible copy (sweep)', () => {
  it('every allowlisted code humanises to a title that is not the raw code and carries no snake_case', () => {
    const codes = Object.keys(BIAS_SIGNAL_REGISTRY)
    expect(codes.length).toBeGreaterThan(0)
    for (const code of codes) {
      const blocks = build([
        { type: code, detail: 'Grounded prose for the sweep.', target: 'fac_initial_quote' },
      ])
      expect(blocks, `code ${code} should render`).toHaveLength(1)
      const title = blocks[0].title
      expect(title, `title for ${code}`).not.toBe(code)
      expect(title, `title for ${code} must not contain underscores`).not.toMatch(/_/)
      // Humanised copy starts with a capital letter and is not SHOUTED.
      expect(title).toMatch(/^[A-Z]/)
      expect(title).not.toMatch(/^[A-Z_]+$/)
    }
  })

  it('uppercase code variants humanise through the same allowlist (case-insensitive)', () => {
    const blocks = build([
      { type: 'STATUS_QUO_BIAS', detail: 'Uppercase wire convention.', target: 'fac_initial_quote' },
    ])
    expect(blocks).toHaveLength(1)
    expect(blocks[0].title).toBe('Status quo bias')
  })
})

// ─── Dedupe by canonical TITLE only (CEE #541 parity) ────────────────────

describe('buildDraftBiasSignalBlocks — dedupe by canonical title (CEE #541 parity)', () => {
  it('an identical duplicate cannot displace a distinct third signal', () => {
    const blocks = build([
      SIGNAL_ANCHORING,
      { ...SIGNAL_ANCHORING, detail: 'Same anchoring signal, reworded by the producer.' },
      SIGNAL_STATUS_QUO,
    ])
    expect(blocks).toHaveLength(2)
    expect(blocks.map((b) => b.title)).toEqual(['Anchoring', 'Status quo bias'])
    // First occurrence wins — its detail is the rendered body.
    expect(blocks[0].body).toBe(SIGNAL_ANCHORING.detail)
  })

  it('dedupes on canonical bias identity: alias codes for the same bias', () => {
    const blocks = build([
      SIGNAL_ANCHORING,
      { ...SIGNAL_ANCHORING, type: 'anchoring_bias' },
      SIGNAL_SUNK_COST,
    ])
    expect(blocks).toHaveLength(2)
    expect(blocks.map((b) => b.title)).toEqual(['Anchoring', 'Sunk cost'])
  })

  it('the same bias on DIFFERENT targets dedupes to ONE card (title-only identity)', () => {
    // The old identity was `${title}|${ref.id}`, which let the same bias on two
    // nodes render twice. CEE #541 dedupes by canonical title ONLY, so the same
    // bias is one card regardless of which node it names — first occurrence wins.
    const blocks = build([
      SIGNAL_ANCHORING,
      { ...SIGNAL_ANCHORING, target: 'fac_current_supplier', detail: 'Same bias, other node.' },
    ])
    expect(blocks).toHaveLength(1)
    expect(blocks[0].title).toBe('Anchoring')
    expect(blocks[0].body).toBe(SIGNAL_ANCHORING.detail)
    expect(blocks[0].target_refs).toEqual([
      { id: 'fac_initial_quote', label: 'Initial quote', kind: 'factor' },
    ])
  })
})
