/**
 * ROADMAP 2.490 slice 2 — the adapter half of the DSK protocol badge.
 *
 * The adapter is the UI's fail-closed boundary. The contract makes the triple
 * ATOMIC (schemas 0.37.0: one strict object, all three members required), and
 * this spec pins that the UI enforces the same rule INDEPENDENTLY rather than
 * trusting the producer. That is not belt-and-braces: the UI parses the raw
 * wire payload, not the Zod schema (`nonEmptyString` etc.), so nothing else
 * stands between a malformed triple and a badge asserting canonical science.
 *
 * CEE #830 is the defect this closes at the reader end: an id validated as
 * EXISTING while the text under it was the model's own prose. A partial triple
 * arriving here must therefore yield NO badge, never a badge with a blank.
 */
import { describe, it, expect } from 'vitest'

import { adaptTypedExerciseBlock } from '../phase3TypedBlocks'

const RAW_BASE = {
  type: 'exercise',
  block_id: 'blk-dsk-1',
  exercise_kind: 'consider_opposite',
  freshness: 'fresh',
  target_refs: [],
  counter_case: 'Take the opposite view for a moment.',
}

const GOOD = {
  protocol_id: 'DSK-P-003',
  protocol_title: 'Disconfirmation exercise',
  evidence_strength: 'medium',
}

describe('adaptTypedExerciseBlock — dsk_provenance', () => {
  it('carries a complete triple through verbatim', () => {
    const block = adaptTypedExerciseBlock({ ...RAW_BASE, dsk_provenance: GOOD })
    expect(block).not.toBeNull()
    expect(block!.dsk_provenance).toEqual(GOOD)
  })

  it('drops the PROVENANCE, not the card, when the triple is incomplete', () => {
    for (const partial of [
      { protocol_id: 'DSK-P-003' },
      { protocol_id: 'DSK-P-003', protocol_title: 'Disconfirmation exercise' },
      { protocol_title: 'Disconfirmation exercise', evidence_strength: 'medium' },
      { ...GOOD, protocol_title: '' },
    ]) {
      const block = adaptTypedExerciseBlock({ ...RAW_BASE, dsk_provenance: partial })
      // The card still renders — losing an attribution must never cost the user
      // the exercise itself.
      expect(block, `partial ${JSON.stringify(partial)} must not drop the card`).not.toBeNull()
      expect(
        block!.dsk_provenance,
        `partial ${JSON.stringify(partial)} must yield NO provenance`,
      ).toBeUndefined()
    }
  })

  it('refuses an id that does not name a PROTOCOL — a claim or trigger id cannot badge as one', () => {
    for (const wrong of ['DSK-T-003', 'DSK-TR-003', 'DSK-B-001', 'P-003', 'DSK-P-3']) {
      const block = adaptTypedExerciseBlock({
        ...RAW_BASE,
        dsk_provenance: { ...GOOD, protocol_id: wrong },
      })
      expect(block!.dsk_provenance, `id '${wrong}' must be refused`).toBeUndefined()
    }
  })

  it('refuses an evidence_strength outside the bundle’s declared domain', () => {
    for (const bad of ['high', 'STRONG', 'unknown', '']) {
      const block = adaptTypedExerciseBlock({
        ...RAW_BASE,
        dsk_provenance: { ...GOOD, evidence_strength: bad },
      })
      expect(block!.dsk_provenance, `strength '${bad}' must be refused`).toBeUndefined()
    }
    // Positive control in the same test: the four DECLARED values all survive,
    // so the loop above is rejecting the right things rather than everything.
    for (const ok of ['strong', 'medium', 'weak', 'mixed']) {
      const block = adaptTypedExerciseBlock({
        ...RAW_BASE,
        dsk_provenance: { ...GOOD, evidence_strength: ok },
      })
      expect(block!.dsk_provenance?.evidence_strength, `strength '${ok}' must survive`).toBe(ok)
    }
  })

  it('a block with no dsk_provenance at all is unchanged (absence is not an error)', () => {
    const block = adaptTypedExerciseBlock(RAW_BASE)
    expect(block).not.toBeNull()
    expect(block!.dsk_provenance).toBeUndefined()
    expect(block!.counter_case).toBe('Take the opposite view for a moment.')
  })
})
