/**
 * ⭐ ONE FIELD, TWO QUESTIONS — and the card must ask the one its kind answers.
 *
 * `data.provenance` means "who owns this VALUE" on a valued factor and "who put
 * this ELEMENT here" on an option. `NodeProvenanceMark` rendered the VALUE
 * vocabulary on every kind, so on the 21 of 25 captured non-factor nodes that
 * carry no value it asserted an estimate of a number that does not exist.
 *
 * ⛔ AND THE FIX IS NOT SUPPRESSION. A predicate that returned `'none'`
 * throughout would satisfy every "no false estimate" assertion in this file
 * while deleting the mark from the whole canvas — destroying the signal the
 * founder specifically valued ("9 of 14 elements were Olumi's") to fix a
 * sentence. **Every case below therefore has its opposite-direction twin**: a
 * value-bearing card must still make the VALUE claim, and a structural card must
 * make the STRUCTURAL one — not nothing.
 *
 * ⚠ THIS FILE GUARDS THE PREDICATE, NOT THE CARD.
 * `BaseNode.provenanceClaimMount.spec.tsx` guards that the mount consults it —
 * a correct predicate nothing calls is this estate's signature defect — and
 * `nodeProvenanceClaim.schemaDerivation.spec.ts` guards that the split still
 * agrees with the Zod schemas it claims to be derived from.
 */
import { describe, it, expect } from 'vitest'
import { NodeTypeEnum } from '../nodes'
import {
  nodeProvenanceClaim,
  provenanceClaimLabel,
  STRUCTURAL_PROVENANCE_LABEL,
} from '../nodeProvenanceClaim'
import { VALUE_PROVENANCE_LABEL } from '../valueProvenance'
import { hasAnyStatedValue } from '../../utils/observedStateHelpers'
import {
  GOAL_LABEL_FROM_BRIEF_COPY,
  goalLabelIsUnconfirmedBriefExtract,
} from '../goalLabelProvenance'

/** A node's data as the canvas holds it — the object the predicate takes. */
const dataFor = (type: string, over: Record<string, unknown> = {}) => ({
  label: `a ${type}`,
  type,
  provenance: 'ai_inferred',
  ...over,
})

describe('a card without a number never makes a claim about one', () => {
  it.each(['option', 'outcome', 'decision', 'action'] as const)(
    '%s — its schema declares NO value field, so the claim is structural',
    (kind) => {
      expect(nodeProvenanceClaim(kind, dataFor(kind))).toBe('structural')
    },
  )

  it('risk WITHOUT a probability — structural, because nothing was estimated', () => {
    expect(nodeProvenanceClaim('risk', dataFor('risk'))).toBe('structural')
  })

  it('factor WITHOUT an observed value — structural, and the rule is uniform', () => {
    // The factor's `observedState` is `.optional()` in the schema exactly as the
    // risk's `probability` is. Exempting the factor by kind would be a hand-made
    // exception to a derived rule, and it would put "AI estimate" back on the
    // 2 of 10 captured factors that arrived with no value.
    expect(nodeProvenanceClaim('factor', dataFor('factor'))).toBe('structural')
  })
})

describe('⛔ THE TWIN — a card WITH a number still says so', () => {
  /**
   * The harm the fix above must not cause. A change that made every card
   * structural would pass every assertion in the block above while silently
   * deleting the value vocabulary from the product. These are load-bearing.
   */
  it('factor with an observed value — the VALUE claim', () => {
    expect(
      nodeProvenanceClaim('factor', dataFor('factor', { observedState: { value: 0.7 } })),
    ).toBe('value')
  })

  it('factor with only CEE’s top-level display_value — still the VALUE claim', () => {
    expect(nodeProvenanceClaim('factor', dataFor('factor', { display_value: '£26,000' }))).toBe(
      'value',
    )
  })

  it('factor with the WIRE spelling observed_state — the VALUE claim', () => {
    // Canvas stores `observedState`; the CEE/PLoT wire uses `observed_state`,
    // and real graphs carry both. Reading one under-counts.
    expect(
      nodeProvenanceClaim('factor', dataFor('factor', { observed_state: { value: 0.7 } })),
    ).toBe('value')
  })

  it('risk WITH a probability — the VALUE claim', () => {
    expect(nodeProvenanceClaim('risk', dataFor('risk', { probability: 0.3 }))).toBe('value')
  })

  it('an empty display_value does not buy a value claim', () => {
    expect(nodeProvenanceClaim('factor', dataFor('factor', { display_value: '   ' }))).toBe(
      'structural',
    )
  })

  /**
   * ⛔ A VALUELESS `observedState` IS NOT A VALUE — the PR's own defect class,
   * caught by an independent review surviving inside the fix, on the one kind
   * the fix was written for.
   *
   * A generic `typeof v === 'object'` check reads `{}`, `{ unit, source }` and
   * `{ value: null }` as "carries a value". Such a card renders the amber
   * "needs your judgement" border (`isIncomplete` via `isFactorNeedsInput`)
   * while the mark beside it says "AI estimate" about a number nobody stated —
   * the border and the mark disagreeing about the same card. The factor arm
   * therefore asks `hasAnyStatedValue`, the estate's declared single owner of
   * this question, which `isFactorNeedsInput` also asks.
   */
  it.each([
    ['empty observedState', {}],
    ['observedState with no number', { unit: '£', source: 'cee_inference' }],
    ['observedState with a null value', { value: null }],
  ])('factor with an %s — structural, and it agrees with the amber border', (_label, obs) => {
    expect(nodeProvenanceClaim('factor', dataFor('factor', { observedState: obs }))).toBe(
      'structural',
    )
  })

  it('the two authorities now AGREE on every one of those shapes', () => {
    // Pin the convergence itself, not just the outcome: if `hasAnyStatedValue`
    // ever moves, this reads the move rather than agreeing with a stale copy.
    for (const obs of [{}, { unit: '£' }, { value: null }, { value: 0.7 }, { raw_value: 26000 }]) {
      const data = dataFor('factor', { observedState: obs })
      expect(nodeProvenanceClaim('factor', data) === 'value').toBe(hasAnyStatedValue(data))
    }
  })

  it('but a factor with ONLY CEE’s top-level display_value keeps its value claim', () => {
    // ⛔ THE TWIN, and it REFUTED the review's suggested fix by execution.
    // `hasAnyStatedValue` reads the triple INSIDE `observedState`;
    // `FactorNodeDataSchema` declares `display_value` at the TOP level too.
    // Delegating wholesale dropped this card's value claim — the opposite-
    // direction harm of the defect being fixed.
    expect(nodeProvenanceClaim('factor', dataFor('factor', { display_value: '£26,000' }))).toBe(
      'value',
    )
    expect(hasAnyStatedValue(dataFor('factor', { display_value: '£26,000' }))).toBe(false)
  })
})

describe('the goal is silent ONLY where its own card is already speaking', () => {
  it('goal / from_brief — suppressed, because GoalNode renders its own pill', () => {
    expect(nodeProvenanceClaim('goal', dataFor('goal', { provenance: 'from_brief' }))).toBe('none')
  })

  /**
   * ⛔ THE TWIN, AND IT CAUGHT A REAL DEFECT IN THIS MODULE'S FIRST VERSION.
   *
   * `goalLabelIsUnconfirmedBriefExtract` fires for `kind === 'brief'` ONLY, so
   * `GoalNode`'s pill renders for `from_brief` and NOTHING ELSE. Suppressing on
   * the KIND therefore DELETED the fact on a goal carrying `user_set` (which
   * `provenanceAfterHumanAuthoredLabel` stamps the moment a human authors the
   * label) or `ai_inferred` — the same over-suppression this module rejects,
   * committed inside the module that rejects it.
   */
  it.each(['user_set', 'ai_inferred'] as const)(
    'goal / %s — NOT suppressed: nothing else on the card says it',
    (provenance) => {
      expect(nodeProvenanceClaim('goal', dataFor('goal', { provenance }))).toBe('structural')
    },
  )

  it('the gate is the goal surface’s OWN predicate, so the two cannot drift', () => {
    // Pin the precondition in-test: the suppression is granted exactly where
    // `GoalNode` renders its pill. If that predicate's domain ever changes, this
    // reads the change rather than agreeing with a stale copy of it.
    for (const provenance of ['from_brief', 'user_set', 'ai_inferred', 'nonsense']) {
      const data = dataFor('goal', { provenance })
      const goalCardSpeaks = goalLabelIsUnconfirmedBriefExtract(data)
      expect(nodeProvenanceClaim('goal', data) === 'none').toBe(goalCardSpeaks)
    }
  })

  it('and the goal card’s OWN surface still carries the same fact', () => {
    // Pin the PRECONDITION for the suppression in-test. If this copy ever left
    // the goal card, suppressing the mark would delete the fact from the card
    // entirely rather than de-duplicating it — the suppression would silently
    // become the destructive change this whole design rejects.
    expect(GOAL_LABEL_FROM_BRIEF_COPY.pill.length).toBeGreaterThan(0)
  })

  it('decision is NOT suppressed — it has no competing surface', () => {
    expect(nodeProvenanceClaim('decision', dataFor('decision'))).toBe('structural')
  })

  it('the suppression is a SCOPE, not a removal — nothing else is ever silent', () => {
    // Derived from the enum itself, never hand-listed (trap 12). `dataFor`
    // supplies `ai_inferred`, for which NO kind — including the goal — has a
    // competing surface, so the honest answer here is that nothing is silent.
    const silent = NodeTypeEnum.options.filter(
      (k) => nodeProvenanceClaim(k, dataFor(k)) === 'none',
    )
    expect(silent).toEqual([])
  })

  it('answers for EVERY kind the enum admits', () => {
    for (const kind of NodeTypeEnum.options) {
      expect(
        ['value', 'structural', 'none'],
        `${kind} is unclassified`,
      ).toContain(nodeProvenanceClaim(kind, dataFor(kind)))
    }
  })
})

describe('the words themselves — a structural card may never say "estimate"', () => {
  it('the structural register states no number, for any kind', () => {
    for (const [kind, label] of Object.entries(STRUCTURAL_PROVENANCE_LABEL)) {
      expect(label.toLowerCase(), `${kind} leaks value vocabulary`).not.toContain('estimate')
    }
  })

  it('ai — "Olumi suggested this", not "AI estimate"', () => {
    expect(provenanceClaimLabel('structural', 'ai')).toBe('Olumi suggested this')
    // The twin: the value claim is untouched by this change.
    expect(provenanceClaimLabel('value', 'ai')).toBe(VALUE_PROVENANCE_LABEL.ai)
  })

  it('human — "You added this", not "Set by you"', () => {
    expect(provenanceClaimLabel('structural', 'human')).toBe('You added this')
    expect(provenanceClaimLabel('value', 'human')).toBe(VALUE_PROVENANCE_LABEL.human)
  })

  it('brief REUSES the goal card’s existing spelling rather than authoring a second', () => {
    // The defect being fixed was ONE wire literal wearing TWO spellings. A
    // freshly authored "From your brief" here would rebuild it in the same
    // commit that removes it — so this binds to the shared constant.
    expect(provenanceClaimLabel('structural', 'brief')).toBe(GOAL_LABEL_FROM_BRIEF_COPY.pill)
  })

  it('and the two vocabularies genuinely DIFFER — this is not one register twice', () => {
    const kinds = Object.keys(STRUCTURAL_PROVENANCE_LABEL) as Array<
      keyof typeof STRUCTURAL_PROVENANCE_LABEL
    >
    const differing = kinds.filter(
      (k) => STRUCTURAL_PROVENANCE_LABEL[k] !== VALUE_PROVENANCE_LABEL[k],
    )
    // The three canvas-reachable kinds at minimum.
    expect(differing).toEqual(expect.arrayContaining(['ai', 'brief', 'human']))
  })
})
