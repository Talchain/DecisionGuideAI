/**
 * ⭐⭐ THE REASONING FRONTIER ASKS SOMETHING — bound to the copy that reaches
 * the MOUNTED node, not to the table it was typed into.
 *
 * ── THE DEFECT ──
 *
 * Four dashed doors rendered on a real user's canvas reading "+ Explore another
 * option", "Another factor", "Another outcome", "Another risk". They ask
 * nothing. They are category labels wearing the costume of a prompt.
 *
 * That matters more than a wording nit. The standing criticism of this canvas
 * is that every element is a CONCLUSION and nothing is a QUESTION — and these
 * four doors ARE the answer to it: the only affordance on the board whose job
 * is to generate rather than to report. Shipped as generic nouns, the
 * product's whole critical-and-creative-thinking promise rendered as the word
 * "Another".
 *
 * ── WHY THE ASSERTIONS ARE SHAPED LIKE THIS ──
 *
 * `ghostTiersPrompt.spec.ts` already proves every `prompt` is a question. It
 * was green throughout, because the prompt was never the problem: the prompt is
 * the sentence sent to Olumi on click, and the LABEL is the only half a user
 * ever reads. One field of a two-field record was covered and the other was
 * not, and nothing said so. So this file covers the visible half, and it reads
 * it off `withGhostTiers` — the composer `ReactFlowGraph.tsx` actually calls —
 * rather than off `GHOST_TIERS`, so a table whose labels never reach a mounted
 * node cannot satisfy it (CLAUDE.md trap 16).
 *
 * ⚠ EXACT STRINGS, NOT A PREDICATE. Every door is pinned BY TIER IDENTITY to
 * the exact sentence it carries. A rule-only spec ("ends in ?") is satisfiable
 * by four copies of one sentence, which is the furniture defect the nouns had,
 * wearing punctuation.
 *
 * ⚠ AND THE RULES ARE HELD ANYWAY, with a DETECTOR-CONTRACT case proving they
 * can fail: the four retired nouns are run through the same rules and must be
 * rejected. Without that, "the copy passes the rules" is compatible with rules
 * that pass anything (CLAUDE.md trap 13).
 */
import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import {
  GHOST_TIERS,
  GHOST_OPTION_DOOR_LABEL,
  GHOST_OPTION_NODE_ID,
  withGhostTiers,
  isGhostNode,
} from '../ghostTiers'

/**
 * The copy, per tier, exactly as a user reads it. Changing a sentence here is
 * the point at which someone has to justify the new one.
 */
const DOOR_QUESTION: Readonly<Record<string, string>> = {
  option: 'What else could you do?',
  factor: 'What else drives this?',
  risk: 'What else could go wrong?',
  outcome: 'Where else could this lead?',
}

/** The four category nouns this work retired. Used as the detector contract. */
const RETIRED_NOUNS = ['Another option', 'Another factor', 'Another risk', 'Another outcome']

/**
 * A model with members on every tier, so `withGhostTiers` places every door.
 * A tier with no members deliberately gets none, so a thinner model would make
 * this file pass by placing nothing (CLAUDE.md trap 13).
 */
function model(): Node[] {
  const at = (id: string, type: string, label: string, x: number, y: number): Node =>
    ({ id, type, position: { x, y }, data: { label } }) as Node
  return [
    at('d1', 'decision', 'Replace our CDP', 0, 0),
    at('o1', 'option', 'Segment', 0, 100),
    at('f1', 'factor', 'Migration effort', 0, 200),
    at('r1', 'risk', 'Migration overruns', 0, 300),
    at('x1', 'outcome', 'Events land intact', 0, 400),
  ]
}

/** `data.label` of every door the composer actually produced, keyed by tier. */
function mountedDoorLabels(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const n of withGhostTiers(model())) {
    if (!isGhostNode(n.id)) continue
    const d = n.data as { tier?: string; label?: string }
    if (typeof d.tier === 'string' && typeof d.label === 'string') out[d.tier] = d.label
  }
  return out
}

/* ── the rules a frontier door's copy must satisfy ────────────────────────── */

/** Data-model vocabulary. The user's language, not ours. */
const MODEL_VOCABULARY = /\b(node|nodes|edge|edges|graph|tier|vertex|element|elements)\b/i
/** The openers a category label uses. A door that starts this way is a noun. */
const CATEGORY_OPENER = /^\s*(\+\s*)?(another|add|new|more|explore)\b/i

/** Why this string is not an acceptable door label, or null if it is fine. */
function rejectAsDoorLabel(s: string): string | null {
  if (!s.trim().endsWith('?')) return 'does not end in a question mark'
  if (CATEGORY_OPENER.test(s)) return 'opens like a category label, not a question'
  if (MODEL_VOCABULARY.test(s)) return 'uses data-model vocabulary'
  if (s.trim().split(/\s+/).length < 3) return 'too short to be a question'
  return null
}

describe('every frontier door asks a question, on the mount path', () => {
  it('places a door on all four tiers, so the assertions below have subjects', () => {
    expect(Object.keys(mountedDoorLabels()).sort()).toEqual(['factor', 'option', 'outcome', 'risk'])
  })

  it.each(Object.entries(DOOR_QUESTION))(
    'the %s door reads exactly "%s" on the node the canvas mounts',
    (tier, question) => {
      expect(mountedDoorLabels()[tier]).toBe(question)
    },
  )

  it.each(Object.entries(DOOR_QUESTION))(
    'the %s tier definition carries that same sentence',
    (tier, question) => {
      // By tier identity, never by position: a positional bind would silently
      // point at another tier's copy the first time the table is reordered.
      const def = GHOST_TIERS.find((t) => t.siblingType === tier)
      expect(def, `GHOST_TIERS carries no ${tier} tier`).toBeDefined()
      expect(def!.label).toBe(question)
    },
  )

  it('no two doors say the same thing — type-specific, not one clever sentence', () => {
    const said = Object.values(DOOR_QUESTION)
    expect(new Set(said).size).toBe(said.length)
  })

  it.each(Object.entries(DOOR_QUESTION))('the %s door obeys the copy rules', (_tier, question) => {
    expect(rejectAsDoorLabel(question)).toBeNull()
  })

  it('DETECTOR CONTRACT: the retired nouns are rejected by those same rules', () => {
    // Without this the rules could pass anything, and "the copy obeys them"
    // would be a guard agreeing with itself.
    for (const noun of RETIRED_NOUNS) {
      expect(rejectAsDoorLabel(noun), `"${noun}" was accepted as a door label`).not.toBeNull()
    }
    // And the shape the option door used to render, prefix and all.
    expect(rejectAsDoorLabel('+ Explore another option')).not.toBeNull()
  })

  it('none of the retired nouns survives anywhere in the tier table', () => {
    for (const tier of GHOST_TIERS) {
      expect(RETIRED_NOUNS, `tier "${tier.siblingType}" still reads as a category`).not.toContain(
        tier.label,
      )
    }
  })
})

describe('the option door has one owner for its question', () => {
  it('the exported label IS the option tier\'s label, not a second copy of it', () => {
    const optionTier = GHOST_TIERS.find((t) => t.id === GHOST_OPTION_NODE_ID)
    expect(optionTier).toBeDefined()
    expect(GHOST_OPTION_DOOR_LABEL).toBe(optionTier!.label)
    expect(GHOST_OPTION_DOOR_LABEL).toBe(DOOR_QUESTION.option)
  })
})
