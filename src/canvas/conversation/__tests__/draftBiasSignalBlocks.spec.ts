/**
 * Leg 3 (bias-coaching rendering slice) — builder pins for
 * buildDraftBiasSignalBlocks: draft-turn `coaching.bias_signals` →
 * typed `v5_coaching` conversation blocks with
 * `coaching_kind: 'bias_signal'` (the 0.15.0 boundary enum value).
 *
 * Fixture provenance: shape mirrors the live-verified draft response on
 * CEE staging (build 57959b2c3, 16 Jul 2026) — a 15-node draft whose
 * `coaching.bias_signals` carried `status_quo_bias` + `anchoring`, both
 * grounded (target set to a real node id). Labels and ids here are
 * synthetic; the wire shape ({ type, detail, target? }) is the verified
 * one (CEEDraftCoachingWire.bias_signals, src/adapters/cee/types.ts).
 *
 * Pinned behaviour (ratified: cards capped at 2):
 *   1. Two grounded signals → two typed blocks, humanised titles.
 *   2. Three or more grounded signals → exactly two (wire order).
 *   3. Not a draft turn → nothing.
 *   4. Absent coaching / empty array → nothing.
 *   5. Unknown bias code → that signal renders nothing (others unaffected).
 *   6. Malformed entry (blank detail / blank type / wrong types) → nothing
 *      for that entry, never a crash.
 *   7. Ungrounded (missing / unresolvable target) → nothing for that entry.
 *   8. No raw code string ever becomes visible copy (sweep across the
 *      known-code allowlist).
 *   9. Producer-typed bias coaching already on the turn → builder yields
 *      nothing (producer blocks win; no doubled cards).
 */
import { describe, it, expect } from 'vitest'

import {
  BIAS_SIGNAL_TITLES,
  DRAFT_BIAS_SIGNAL_CARD_CAP,
  buildDraftBiasSignalBlocks,
  humaniseBiasSignalCode,
} from '../draftBiasSignalBlocks'
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

  it('assigns stable block ids and 1-based priority ranks in wire order', () => {
    const blocks = build([SIGNAL_STATUS_QUO, SIGNAL_ANCHORING])
    expect(blocks[0].block_id).not.toBe(blocks[1].block_id)
    expect(blocks[0].priority_rank).toBe(1)
    expect(blocks[1].priority_rank).toBe(2)
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
      { ...SIGNAL_STATUS_QUO, target: 'missing_node' }, // ungrounded → dropped
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

  it('ungrounded signals → nothing: missing target, unresolvable target, blank-label target', () => {
    const blocks = build([
      { type: 'anchoring', detail: 'No target at all.' },
      { type: 'anchoring', detail: 'Target not on the canvas.', target: 'fac_ghost' },
      { type: 'anchoring', detail: 'Target label is blank.', target: 'fac_blank_label' },
      { type: 'anchoring', detail: 'Whitespace target.', target: '   ' },
    ])
    expect(blocks).toEqual([])
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

describe('humaniseBiasSignalCode — prototype-chain escapes (hostile wire codes)', () => {
  // A bare object-literal index walks the prototype chain: '__proto__'
  // yields Object.prototype (a truthy object — React throws "Objects are
  // not valid as a React child", crashing the assistant-message subtree)
  // and 'constructor' yields the Object function (blank title + console
  // error). Both must fail closed like any other unknown code. Only these
  // two survive the toLowerCase() normalisation; 'toString' / 'valueOf' /
  // 'hasOwnProperty' miss the camelCase prototype properties already.
  it("'__proto__' fails closed — Object.prototype must never become a card title", () => {
    expect(humaniseBiasSignalCode('__proto__')).toBeNull()
  })

  it("'constructor' fails closed — a Function must never become a card title", () => {
    expect(humaniseBiasSignalCode('constructor')).toBeNull()
  })

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
    const codes = Object.keys(BIAS_SIGNAL_TITLES)
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

// ─── #356 fast-follow: (bias, target) dedupe ahead of the cap ────────────

describe('buildDraftBiasSignalBlocks — duplicate (type,target) dedupe (#356 fast-follow)', () => {
  it('an identical (type,target) duplicate cannot displace a distinct third signal', () => {
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

  it('dedupes on canonical bias identity: alias codes for the same bias on the same target', () => {
    const blocks = build([
      SIGNAL_ANCHORING,
      { ...SIGNAL_ANCHORING, type: 'anchoring_bias' },
      SIGNAL_SUNK_COST,
    ])
    expect(blocks).toHaveLength(2)
    expect(blocks.map((b) => b.title)).toEqual(['Anchoring', 'Sunk cost'])
  })

  it('the same bias on DIFFERENT targets is two distinct signals — both render', () => {
    const blocks = build([
      SIGNAL_ANCHORING,
      { ...SIGNAL_ANCHORING, target: 'fac_current_supplier' },
    ])
    expect(blocks).toHaveLength(2)
    expect(blocks.map((b) => b.target_refs[0].id)).toEqual([
      'fac_initial_quote',
      'fac_current_supplier',
    ])
  })
})
