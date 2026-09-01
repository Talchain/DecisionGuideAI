/**
 * Two ways the frontier's sentence could describe a model that is not on screen.
 *
 * The prompt a door sends is not internal text. It lands in the user's own
 * transcript, attributed to the user, so every noun and every count in it is a
 * statement the product makes on the user's behalf. Both defects pinned here
 * are of that class: the sentence was well-formed, specific and wrong.
 *
 *   1. IT COULD NAME AN OPTION THAT IS NOT THERE. The canvas deduplicates nodes
 *      by id before it renders (`ReactFlowGraph.tsx`, "CEE may return duplicate
 *      node IDs"), and the prompt was composed from the set BEFORE that filter.
 *      So a payload carrying one option twice produced "My model has 3 options:
 *      Segment, RudderStack, Segment" beside a canvas showing two.
 *
 *   2. IT CALLED A GOAL A DECISION. `readSubject` resolves decision-then-goal,
 *      and the clause was hardcoded "The decision is: X". On a goal-only model
 *      the user was told their goal was a decision — and on a decision model it
 *      used a word the product retired on 31 Aug (`DECISION_NODE_LABEL`).
 *
 * ⚠ EVERY ASSERTION BELOW HAS ITS OPPOSITE-DIRECTION TWIN, and the twins fail on
 * DIFFERENT assertions. This estate has repeatedly shipped a fix and its exact
 * inverse — over-deduplicating (dropping a real option that merely shares a
 * name) is as false as under-deduplicating, and a fix that made every subject a
 * "goal" would be as wrong as one that made every subject a "decision". A
 * corpus that tests one direction is a guard watching one door.
 */
import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { ghostOptionPrompt } from '../ghostTiers'
// The product's own words, never re-typed here. A spec that spells its own
// copy passes while the product says something else — and the decision node's
// word changed on 31 Aug, which is precisely how this defect got its second
// half.
import { DECISION_NODE_LABEL, GOAL_NODE_LABEL } from '../../domain/vocabulary'

const n = (id: string, type: string, label: string): Node =>
  ({ id, type, position: { x: 0, y: 0 }, data: { label, type } }) as Node

const SUBJECT = 'Replace our customer data platform before the March renewal'

/** A clean model: three distinct options, a decision subject. */
const CLEAN: Node[] = [
  n('d1', 'decision', SUBJECT),
  n('o1', 'option', 'Segment'),
  n('o2', 'option', 'RudderStack'),
  n('o3', 'option', 'Stay on the current CDP'),
]

/**
 * The only input that discriminates: `o1` arrives TWICE, same id.
 *
 * This is not a contrived shape — it is the one the mount's own dedup comment
 * says the producer emits. The canvas renders two options from it; the sentence
 * used to claim three.
 */
const DUPLICATE_ID: Node[] = [
  n('d1', 'decision', SUBJECT),
  n('o1', 'option', 'Segment'),
  n('o2', 'option', 'RudderStack'),
  n('o1', 'option', 'Segment'),
]

/**
 * The OPPOSITE harm's fixture: two GENUINELY DIFFERENT options that happen to
 * share a label. Both are on screen and both must be counted.
 */
const SHARED_LABEL: Node[] = [
  n('d1', 'decision', SUBJECT),
  n('o1', 'option', 'Segment'),
  n('o5', 'option', 'Segment'),
]

/** A model whose subject is a GOAL — no decision node anywhere. */
const GOAL_ONLY: Node[] = [
  n('g1', 'goal', 'Grow recurring revenue to £40m'),
  n('o1', 'option', 'Segment'),
  n('o2', 'option', 'RudderStack'),
]

/**
 * BOTH kinds present. Added because a mutant survived without it: swapping the
 * resolver's `??` order to goal-then-decision REDDED NOTHING, since every other
 * fixture here carries exactly one of the two. A corpus that omits a shape the
 * code admits cannot certify the code over that shape.
 */
const BOTH_KINDS: Node[] = [
  n('g1', 'goal', 'Grow recurring revenue to £40m'),
  n('d1', 'decision', SUBJECT),
  n('o1', 'option', 'Segment'),
  n('o2', 'option', 'RudderStack'),
]

/** A decision node with no usable name, beside a named goal. */
const UNNAMED_DECISION: Node[] = [
  n('d1', 'decision', '   '),
  n('g1', 'goal', 'Grow recurring revenue to £40m'),
  n('o1', 'option', 'Segment'),
  n('o2', 'option', 'RudderStack'),
]

const occurrences = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1

describe('the sentence describes the model the canvas renders, not the payload it received', () => {
  it('a duplicate node id is counted ONCE — the count matches what is on screen', () => {
    const p = ghostOptionPrompt(DUPLICATE_ID)
    expect(p).toContain('My model has 2 options')
  })

  it('a duplicate node id is NAMED once — the list does not repeat an option back to the user', () => {
    // Separate from the count deliberately: a fix that corrected the number and
    // left the list alone would produce "My model has 2 options: Segment,
    // RudderStack, Segment", which is a different lie in the same sentence.
    expect(occurrences(ghostOptionPrompt(DUPLICATE_ID), 'Segment')).toBe(1)
  })

  it('OPPOSITE-DIRECTION TWIN: two distinct options sharing a label are BOTH kept — dedup is by id, never by name', () => {
    // The inverse harm. Collapsing these would under-report the model, which is
    // the same class of false sentence pointing the other way. This assertion
    // is what stops the fix over-reaching, and it is the one a label-based
    // dedup REDs on while every assertion above stays green.
    const p = ghostOptionPrompt(SHARED_LABEL)
    expect(p).toContain('My model has 2 options')
    expect(occurrences(p, 'Segment')).toBe(2)
  })

  it('NO SILENT CHANGE ON THE NORMAL PATH: a model with no duplicate ids gets the inventory clause it always got', () => {
    // Green before the fix and green after, on purpose — it is the guard that
    // the repair is confined to the duplicate case. It REDs if the dedup drops,
    // reorders or re-labels anything on a clean model.
    expect(ghostOptionPrompt(CLEAN)).toContain(
      'My model has 3 options: Segment, RudderStack, Stay on the current CDP.',
    )
  })

  it('DISCRIMINATION: the three models do not all get the same sentence', () => {
    // Without this, every assertion above is compatible with a composer that
    // returns a constant. Three inputs that must produce three different
    // inventory clauses.
    const sentences = [
      ghostOptionPrompt(CLEAN),
      ghostOptionPrompt(DUPLICATE_ID),
      ghostOptionPrompt(SHARED_LABEL),
    ]
    expect(new Set(sentences).size).toBe(3)
  })
})

describe('the subject is called what the product calls that node', () => {
  it('a goal-only model has its subject named as a GOAL', () => {
    const p = ghostOptionPrompt(GOAL_ONLY)
    expect(p).toContain(`The ${GOAL_NODE_LABEL.toLowerCase()} is: Grow recurring revenue to £40m`)
  })

  it('OPPOSITE-DIRECTION TWIN: a decision-bearing model still uses the product word for THAT node', () => {
    // Fails on a different assertion than its twin, and would RED on a fix that
    // simply renamed every subject a "goal" — the inverse defect.
    const p = ghostOptionPrompt(CLEAN)
    expect(p).toContain(`The ${DECISION_NODE_LABEL.toLowerCase()} is: ${SUBJECT}`)
  })

  it('the two nouns are not the same word — the distinction is real, not decorative', () => {
    // A guard against the neutral-word escape: resolving both kinds to one
    // noun would satisfy neither user and would pass a pair of `toContain`
    // assertions written against that word.
    expect(GOAL_NODE_LABEL.toLowerCase()).not.toBe(DECISION_NODE_LABEL.toLowerCase())
    expect(ghostOptionPrompt(GOAL_ONLY)).not.toContain(
      `The ${DECISION_NODE_LABEL.toLowerCase()} is:`,
    )
    expect(ghostOptionPrompt(CLEAN)).not.toContain(`The ${GOAL_NODE_LABEL.toLowerCase()} is:`)
  })

  it('PRECEDENCE UNCHANGED: a model carrying BOTH kinds names the DECISION, not the goal', () => {
    // The noun was the defect; the resolution order was not, and this change
    // claims not to have touched it. Nothing pinned that claim until a mutant
    // that reversed the order survived the whole file.
    const p = ghostOptionPrompt(BOTH_KINDS)
    expect(p).toContain(`The ${DECISION_NODE_LABEL.toLowerCase()} is: ${SUBJECT}`)
    expect(p).not.toContain(`The ${GOAL_NODE_LABEL.toLowerCase()} is:`)
  })

  it('PRECEDENCE UNCHANGED, OTHER DIRECTION: an UNNAMED decision suppresses the clause rather than falling through to the goal', () => {
    // The existing behaviour of the `??` chain, preserved deliberately. Widening
    // the resolution while fixing the noun would be a second, unasked change
    // hiding inside the first — and it would be invisible to every assertion
    // above, all of which carry at most one nameable subject.
    const p = ghostOptionPrompt(UNNAMED_DECISION)
    expect(p).not.toContain(`The ${GOAL_NODE_LABEL.toLowerCase()} is:`)
    expect(p).not.toContain(`The ${DECISION_NODE_LABEL.toLowerCase()} is:`)
    // POSITIVE CONTROL: the same probe DOES see a clause when one is emitted,
    // so the two absences above are not passing by looking at nothing.
    expect(ghostOptionPrompt(GOAL_ONLY)).toContain(`The ${GOAL_NODE_LABEL.toLowerCase()} is:`)
  })

  it('RETIRED VOCABULARY: neither sentence says "decision", the word the product dropped on 31 Aug', () => {
    // `DECISION_NODE_LABEL` is 'Question'. A hardcoded "The decision is:" was
    // internal vocabulary reaching the user's transcript — the same class of
    // drift as the nine bare 'Decision' literals `vocabulary.ts` exists to end.
    expect(ghostOptionPrompt(CLEAN)).not.toMatch(/\bdecision\b/i)
    expect(ghostOptionPrompt(GOAL_ONLY)).not.toMatch(/\bdecision\b/i)
  })
})
