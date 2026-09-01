/**
 * ⭐ ONE FIELD, TWO QUESTIONS — and the mark shipped answering the wrong one on
 * two node kinds.
 *
 * `data.provenance` means "who owns this VALUE" on a factor and "who wrote this
 * LABEL" on a goal. `NodeProvenanceMark` renders the VALUE vocabulary, so on a
 * goal and a decision it was saying the wrong thing about the right field.
 *
 * Measured on deployed staging `be33648b`, both halves on one screen:
 *   · goal — "From brief" 18px above "From your brief", one wire literal in two
 *     spellings, one of them using value words for a label.
 *   · decision — "AI estimate" for a question Olumi FRAMED. Nothing estimated.
 *
 * ⚠ THIS FILE GUARDS THE PREDICATE, NOT THE PILL. `BaseNode.provenanceMarkKindScope`
 * guards that the mount actually consults it — a correct predicate nothing calls
 * is this estate's signature defect.
 */
import { describe, it, expect } from 'vitest'
import { NodeTypeEnum } from '../nodes'
import { valueProvenanceDescribesNodeKind } from '../valueProvenance'

describe('the value vocabulary is scoped to kinds that HAVE a value', () => {
  it.each(['goal', 'decision'] as const)(
    '%s renders nothing — the field is speaking about the label, not a number',
    (kind) => {
      expect(valueProvenanceDescribesNodeKind(kind)).toBe(false)
    },
  )

  it.each(['factor', 'risk', 'outcome', 'option'] as const)(
    '%s still answers — it carries a modelled number and the words fit it',
    (kind) => {
      expect(valueProvenanceDescribesNodeKind(kind)).toBe(true)
    },
  )

  it('answers for EVERY kind the enum admits, derived from the enum itself', () => {
    // ⚠ Derived, never hand-listed. A kind added to `NodeTypeEnum` and forgotten
    // here is exactly the hand-maintained mirror that goes stale reading green
    // (trap 12). The exhaustive switch makes the COMPILER the alarm; this makes
    // the SUITE one too, so the guard survives a `default:` being added.
    const kinds = NodeTypeEnum.options
    expect(kinds.length).toBeGreaterThan(0)
    for (const kind of kinds) {
      expect(typeof valueProvenanceDescribesNodeKind(kind), `${kind} is unclassified`).toBe('boolean')
    }
  })

  it('does not simply say no to everything — the change is a SCOPE, not a removal', () => {
    // A predicate that returned false throughout would pass every assertion
    // above about goal and decision while silently deleting the mark from the
    // whole canvas. Both directions, in one place.
    const kinds = NodeTypeEnum.options
    const yes = kinds.filter((k) => valueProvenanceDescribesNodeKind(k))
    const no = kinds.filter((k) => !valueProvenanceDescribesNodeKind(k))
    expect(yes.length).toBeGreaterThan(0)
    expect(no).toEqual(['goal', 'decision'])
  })
})
