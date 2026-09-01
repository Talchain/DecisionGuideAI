/**
 * ⭐⭐ THE SPLIT IS DERIVED FROM THE SCHEMAS — and this is what keeps it derived.
 *
 * `VALUE_FIELDS_BY_KIND` names, per node kind, the field(s) that kind's OWN Zod
 * data schema declares as a value carrier. Written down, it is a
 * hand-maintained mirror, and a hand-maintained mirror drifts silently reading
 * green (CLAUDE.md trap 12). So this file reads the Zod SHAPES themselves and
 * checks the list in BOTH directions:
 *
 *   (a) AGREEMENT — every field the list names is really declared by that
 *       kind's schema, and really comes from the kind's own `.extend(...)`
 *       rather than from the shared `NodeDataSchema` base. A renamed or deleted
 *       field REDs here instead of silently making a valued kind structural
 *       (which would delete the value vocabulary from the product).
 *
 *   (b) COMPLETENESS — a kind the list gives NO value fields has no own-schema
 *       key that intersects the estate's value vocabulary. A kind that GAINS a
 *       value field REDs here instead of silently keeping the structural claim
 *       and understating what it knows.
 *
 * ⚠ (b) IS THE HALF DERIVATION CANNOT PROVIDE, AND IT IS WHY IT IS HAND-WRITTEN.
 * A guard derived from a list can only prove the list's CONSUMERS agree with it;
 * it can never prove the list is not SHORT (trap 12d — `thousand` was missing
 * from a canonical magnitude map and every derived guard was structurally blind
 * to it). `VALUE_VOCABULARY` below is the outside reference that notices a
 * short list. It is deliberately WIDER than what `VALUE_FIELDS_BY_KIND` uses.
 *
 * ⚠ THE BASE FIELDS ARE SUBTRACTED, AND THAT IS LOAD-BEARING. `NodeDataSchema`
 * declares `prior` and `utility` on EVERY kind. Without the subtraction, (b)
 * would fire for all eight kinds and (a) would accept a base field as a per-kind
 * value carrier — every kind would look valued and the whole split would
 * collapse into "always say the value words", i.e. exactly the defect.
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  NodeTypeEnum,
  NodeDataSchema,
  GoalNodeDataSchema,
  DecisionNodeDataSchema,
  OptionNodeDataSchema,
  FactorNodeDataSchema,
  RiskNodeDataSchema,
  OutcomeNodeDataSchema,
  ActionNodeDataSchema,
  ConstraintNodeDataSchema,
  type NodeType,
} from '../nodes'
import { VALUE_FIELDS_BY_KIND } from '../nodeProvenanceClaim'

const SCHEMA_BY_KIND: Record<NodeType, z.ZodObject<z.ZodRawShape>> = {
  goal: GoalNodeDataSchema as unknown as z.ZodObject<z.ZodRawShape>,
  decision: DecisionNodeDataSchema as unknown as z.ZodObject<z.ZodRawShape>,
  option: OptionNodeDataSchema as unknown as z.ZodObject<z.ZodRawShape>,
  factor: FactorNodeDataSchema as unknown as z.ZodObject<z.ZodRawShape>,
  risk: RiskNodeDataSchema as unknown as z.ZodObject<z.ZodRawShape>,
  outcome: OutcomeNodeDataSchema as unknown as z.ZodObject<z.ZodRawShape>,
  action: ActionNodeDataSchema as unknown as z.ZodObject<z.ZodRawShape>,
  constraint: ConstraintNodeDataSchema as unknown as z.ZodObject<z.ZodRawShape>,
}

/** Keys the shared base contributes to every kind — subtracted, see header. */
const BASE_KEYS = new Set(Object.keys(NodeDataSchema.shape))

const ownKeys = (kind: NodeType): string[] =>
  Object.keys(SCHEMA_BY_KIND[kind].shape).filter((k) => !BASE_KEYS.has(k))

/**
 * The estate's vocabulary for "this field holds a modelled number", written
 * from OUTSIDE `VALUE_FIELDS_BY_KIND` so it can notice that list being short.
 * Wider than what the list uses, on purpose.
 */
const VALUE_VOCABULARY = [
  'observedState',
  'observed_state',
  'display_value',
  'displayValue',
  'probability',
  'thresholdValue',
  'threshold_value',
  'value',
  'estimate',
  'magnitude',
] as const

const looksLikeValueField = (key: string) =>
  VALUE_VOCABULARY.some((v) => v.toLowerCase() === key.toLowerCase())

describe('(a) AGREEMENT — every named value field is really declared by that kind', () => {
  it('the map covers exactly the kinds the enum admits', () => {
    expect(Object.keys(VALUE_FIELDS_BY_KIND).sort()).toEqual([...NodeTypeEnum.options].sort())
    expect(Object.keys(SCHEMA_BY_KIND).sort()).toEqual([...NodeTypeEnum.options].sort())
  })

  it.each(NodeTypeEnum.options)('%s — each named field is in its OWN schema shape', (kind) => {
    const own = ownKeys(kind)
    for (const field of VALUE_FIELDS_BY_KIND[kind]) {
      expect(own, `${kind}.${field} is not declared by ${kind}'s own schema`).toContain(field)
    }
  })

  it('and the map is not simply empty — the value claim still exists somewhere', () => {
    // A map emptied of every field would satisfy (a) vacuously while making
    // every card structural: the value vocabulary would vanish from the product
    // and no assertion above would notice.
    const valued = NodeTypeEnum.options.filter((k) => VALUE_FIELDS_BY_KIND[k].length > 0)
    expect(valued.sort()).toEqual(['constraint', 'factor', 'risk'])
  })
})

describe('(b) COMPLETENESS — a kind with no named field really carries no value', () => {
  it.each(NodeTypeEnum.options)('%s', (kind) => {
    if (VALUE_FIELDS_BY_KIND[kind].length > 0) return
    const leaked = ownKeys(kind).filter(looksLikeValueField)
    expect(
      leaked,
      `${kind} declares ${leaked.join(', ')} but is treated as having no value`,
    ).toEqual([])
  })

  /**
   * ⚠ THE POSITIVE CONTROL. An absence check with no demonstrated presence is
   * vacuous (trap 13): if `looksLikeValueField` matched nothing at all, every
   * assertion above would pass by testing nothing. This proves the detector
   * FIRES on a real schema in this repo — and its magnitude is checked, not
   * merely its sign (trap 13e).
   */
  it('the detector actually detects — it fires on the factor and the risk', () => {
    expect(ownKeys('factor').filter(looksLikeValueField)).toEqual(
      expect.arrayContaining(['observedState', 'display_value']),
    )
    expect(ownKeys('risk').filter(looksLikeValueField)).toEqual(['probability'])
  })

  /**
   * ⚠ THE CONTRAST CONTROL for the base subtraction. `prior` and `utility` are
   * base fields; if the subtraction ever stopped working they would appear as
   * own keys on every kind and the split would collapse.
   */
  it('the base subtraction holds — no kind claims prior/utility as its own', () => {
    expect(BASE_KEYS.has('prior')).toBe(true)
    expect(BASE_KEYS.has('utility')).toBe(true)
    for (const kind of NodeTypeEnum.options) {
      expect(ownKeys(kind)).not.toContain('prior')
      expect(ownKeys(kind)).not.toContain('utility')
    }
  })
})
