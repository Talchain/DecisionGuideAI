/**
 * ROADMAP 2.638 S2 — the canonical value-provenance classification.
 *
 * TRAP 12d, both halves, because neither supersedes the other:
 *   · the DERIVED guard (the union assertion below) proves the consumers agree
 *     with the canonical list — it can never prove the list is complete;
 *   · the HAND-WRITTEN CORPUS proves the list is not SHORT. It is written from
 *     the producers' own bytes, not from this module, which is the only way it
 *     can notice a literal the module forgot.
 * Ship both. The `thousand` defect is what happens when only the first exists.
 */

import { describe, it, expect } from 'vitest'
import {
  classifyValueProvenance,
  classifyNodeProvenance,
  isUserOwnedKind,
  VALUE_PROVENANCE_SOURCES,
  CONFIRMED_SOURCES,
  EDITED_SOURCES,
  type ValueProvenanceKind,
} from '../valueProvenance'
import { REVIEWED_SOURCES_LIST } from '../../components/pre-analysis/utils/isReviewedByUser'

describe('2.638 S2 · classification', () => {
  it('classifies the human-confirmation literal as confirmed, not edited', () => {
    const c = classifyValueProvenance('user_confirmed')
    expect(c).not.toBeNull()
    expect(c!.kind).toBe('confirmed')
    expect(c!.userOwned).toBe(true)
  })

  it('classifies every typed-value literal as edited, and the two sets are disjoint', () => {
    expect(EDITED_SOURCES.length).toBeGreaterThan(0)
    for (const s of EDITED_SOURCES) {
      expect(classifyValueProvenance(s)!.kind).toBe('edited')
    }
    expect(CONFIRMED_SOURCES).toEqual(['user_confirmed'])
    for (const s of CONFIRMED_SOURCES) {
      expect(EDITED_SOURCES).not.toContain(s)
    }
  })

  it('classifies the producer literals, and returns null rather than guessing', () => {
    expect(classifyValueProvenance('brief_extraction')!.kind).toBe('brief')
    expect(classifyValueProvenance('cee_inference')!.kind).toBe('ai')
    expect(classifyValueProvenance('brief_extraction')!.userOwned).toBe(false)
    expect(classifyValueProvenance('a_source_nobody_writes')).toBeNull()
    expect(classifyValueProvenance(undefined)).toBeNull()
    expect(classifyValueProvenance(null)).toBeNull()
  })

  /**
   * `user_set` is the WIRE-carried node-level stamp CEE writes on every applied
   * `set_factor_value`, for a typed value and a confirm alike. Reading it as
   * "confirmed" would manufacture the very distinction the wire destroyed.
   */
  it('maps the node-level user_set to "human" — an act it cannot name', () => {
    expect(classifyNodeProvenance('user_set')).toEqual({ kind: 'human', userOwned: true })
    expect(classifyNodeProvenance('from_brief')!.kind).toBe('brief')
    expect(classifyNodeProvenance('ai_inferred')!.kind).toBe('ai')
    expect(classifyNodeProvenance('user_confirmed')).toBeNull()
    expect(classifyNodeProvenance(undefined)).toBeNull()
  })

  it('agrees with itself about which kinds a person owns', () => {
    const owned: ValueProvenanceKind[] = ['confirmed', 'edited', 'assumption', 'human']
    const notOwned: ValueProvenanceKind[] = ['brief', 'ai']
    for (const k of owned) expect(isUserOwnedKind(k)).toBe(true)
    for (const k of notOwned) expect(isUserOwnedKind(k)).toBe(false)
  })
})

describe('2.638 S2 · completeness (trap 12d)', () => {
  /**
   * DERIVED guard. `REVIEWED_SOURCES` is the predicate that decides whether the
   * "checked by you" claim is painted at all; it is imported, not copied, so
   * this cannot drift. A literal that earns the badge but carries no class
   * would render an unlabelled or falsely-AI pill — which is defect D2.
   */
  it('every source isReviewedByUser treats as user-owned carries a user-owned class', () => {
    expect(REVIEWED_SOURCES_LIST.length).toBeGreaterThan(0)
    for (const s of REVIEWED_SOURCES_LIST) {
      const c = classifyValueProvenance(s)
      expect(c, `REVIEWED_SOURCES member '${s}' has no provenance class`).not.toBeNull()
      expect(c!.userOwned, `'${s}' earns the reviewed badge but is not classed user-owned`).toBe(
        true,
      )
    }
  })

  /**
   * HAND-WRITTEN CORPUS — deliberately NOT derived from the module. Each entry
   * is a literal read at the site that writes it, named in the comment so a
   * later reader can re-derive rather than trust this list.
   */
  it('the canonical list covers every literal a producer is known to write', () => {
    const writtenByProducers = [
      'user_confirmed', // CalibrateDrillIn.tsx:126 · PreAnalysisPanel.tsx:1154 · OutputsDock.tsx:1280
      'user_override', // CalibrateDrillIn.tsx:125 · PreAnalysisPanel.tsx:1193 · OutputsDock.tsx:1296
      //                  AND CEE canonicalise-value-ops.ts:280 (USER_EDIT_SOURCE), for BOTH acts
      'user', // model-tab FactorsSection factor-value edits
      'user_edited', // OutputsDock transition bridge
      'user_calibration', // inspector calibration (inspectorStrings.ts:77,90)
      'user_assumption', // reserved "mark as assumption" (recognised by REVIEWED_SOURCES)
      'brief_extraction', // CEE ObservedStateV3
      'cee_inference', // CEE ObservedStateV3
      'cee_repair', // CEE validation repair (inspectorStrings.ts:74)
    ]
    for (const s of writtenByProducers) {
      expect(
        VALUE_PROVENANCE_SOURCES,
        `'${s}' is written by a producer but is unclassified`,
      ).toContain(s)
    }
  })
})
