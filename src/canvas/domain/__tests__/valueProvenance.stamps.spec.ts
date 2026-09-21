/**
 * The WRITE vocabulary must agree with the predicates that READ it.
 *
 * `USER_VALUE_STAMP` and `USER_CONFIRMATION_STAMP` are the two literals a
 * surface writes to claim that a person authored a number. Three independent
 * authorities interpret them afterwards, and a stamp that falls out of any one
 * of them degrades SILENTLY — the value is still there, the pill just stops
 * saying who put it there, which is the exact failure `valueProvenance`'s own
 * header records as having shipped on four surfaces at once (trap 12).
 *
 * So membership is DERIVED here rather than asserted in a docblock:
 *
 *   1. `classifyValueProvenance` — the kind the pill renders from.
 *   2. `isReviewedSource` — the predicate that paints "checked by you" and
 *      feeds every reviewed-factor counter.
 *   3. `isUserOwnedKind` — the claim that a PERSON owns it.
 *
 * ⚠ AND A CONTRAST CONTROL, because a membership test that only ever asks
 * about members cannot tell you the predicate discriminates. `cee_inference`
 * is asserted to fail all three — without it, a `isReviewedSource` that
 * returned `true` for everything would pass every assertion above.
 */

import { describe, it, expect } from 'vitest'
import {
  USER_VALUE_STAMP,
  USER_CONFIRMATION_STAMP,
  classifyValueProvenance,
  isUserOwnedKind,
  EDITED_SOURCES,
  CONFIRMED_SOURCES,
} from '../valueProvenance'
import { isReviewedSource } from '../../components/pre-analysis/utils/isReviewedByUser'

describe('the user-authorship stamps are members of every set that reads them', () => {
  it('USER_VALUE_STAMP classifies as an EDIT — the human supplied the number', () => {
    const klass = classifyValueProvenance(USER_VALUE_STAMP.source)
    expect(klass?.kind).toBe('edited')
    expect(EDITED_SOURCES).toContain(USER_VALUE_STAMP.source)
  })

  it('USER_CONFIRMATION_STAMP classifies as a CONFIRMATION — a different, more expensive claim', () => {
    const klass = classifyValueProvenance(USER_CONFIRMATION_STAMP.source)
    expect(klass?.kind).toBe('confirmed')
    expect(CONFIRMED_SOURCES).toContain(USER_CONFIRMATION_STAMP.source)
  })

  it('both are REVIEWED sources — the "checked by you" badge and its counters see them', () => {
    expect(isReviewedSource(USER_VALUE_STAMP.source)).toBe(true)
    expect(isReviewedSource(USER_CONFIRMATION_STAMP.source)).toBe(true)
  })

  it('both classify as USER-OWNED kinds', () => {
    expect(isUserOwnedKind(classifyValueProvenance(USER_VALUE_STAMP.source)!.kind)).toBe(true)
    expect(isUserOwnedKind(classifyValueProvenance(USER_CONFIRMATION_STAMP.source)!.kind)).toBe(true)
  })

  it('CONTRAST CONTROL — the producer’s own stamp fails all three, so the predicates discriminate', () => {
    expect(classifyValueProvenance('cee_inference')?.kind).not.toBe('edited')
    expect(classifyValueProvenance('cee_inference')?.kind).not.toBe('confirmed')
    expect(isReviewedSource('cee_inference')).toBe(false)
    expect(EDITED_SOURCES).not.toContain('cee_inference')
    expect(CONFIRMED_SOURCES).not.toContain('cee_inference')
  })

  it('the two stamps are DIFFERENT acts — collapsing them is the defect 2.638 S2 exists to stop', () => {
    expect(USER_VALUE_STAMP.source).not.toBe(USER_CONFIRMATION_STAMP.source)
    expect(classifyValueProvenance(USER_VALUE_STAMP.source)?.kind).not.toBe(
      classifyValueProvenance(USER_CONFIRMATION_STAMP.source)?.kind,
    )
  })
})
