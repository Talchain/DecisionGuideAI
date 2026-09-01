/**
 * The frontier's prompts read the model — and stop short of judging it.
 *
 * These were fixed sentences ("Suggest an additional option I haven't
 * considered for this decision") that would read identically in any product,
 * about any decision. The door already knows which siblings it stands beside,
 * so naming them costs a string join and turns a generic ask into one that
 * could only have been asked about THIS model.
 *
 * ⚠ THE LINE THIS FILE GUARDS. Specificity about STRUCTURE is free and needs no
 * producer. Assessment of QUALITY — "your options are too similar", "this
 * framing is weak" — is a reasoning judgement: it needs the science behind it,
 * it belongs to the producer, and a UI that mints one becomes a second
 * authority on what good reasoning looks like. Every assertion below is about
 * keeping the prompts on the free side of that line while making them specific.
 */
import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { GHOST_TIERS, withGhostTiers, listForPrompt } from '../ghostTiers'

const n = (id: string, type: string, label: string): Node =>
  ({ id, type, position: { x: 0, y: 0 }, data: { label, type } }) as Node

const MODEL: Node[] = [
  n('d1', 'decision', 'Replace our customer data platform before the March renewal'),
  n('o1', 'option', 'Segment'),
  n('o2', 'option', 'RudderStack'),
  n('o3', 'option', 'Stay on the current CDP'),
  n('f1', 'factor', 'Annual platform cost'),
  n('r1', 'risk', 'Budget overrun'),
  n('u1', 'outcome', 'Migration completed before renewal'),
]

const promptFor = (nodes: Node[], tier: string): string => {
  const out = withGhostTiers(nodes)
  const ghost = out.find(g => (g.data as { tier?: string })?.tier === tier)
  return String((ghost?.data as { prompt?: string })?.prompt ?? '')
}

describe('frontier prompts — built from the model', () => {
  it('names the options that exist', () => {
    const p = promptFor(MODEL, 'option')
    expect(p).toContain('Segment')
    expect(p).toContain('RudderStack')
    expect(p).toContain('Stay on the current CDP')
  })

  it('carries the subject, so the question is about THIS decision', () => {
    expect(promptFor(MODEL, 'option')).toContain('Replace our customer data platform')
  })

  it('omits the subject clause entirely when the graph carries none — never a guess', () => {
    const noSubject = MODEL.filter(x => x.type !== 'decision')
    const p = promptFor(noSubject, 'option')
    expect(p).toContain('Segment')
    expect(p).not.toMatch(/The decision is:/)
  })

  it('⛔ ASSERTS NOTHING ABOUT QUALITY — the producer owns that judgement', () => {
    // The whole reason this component needs no producer. If a prompt ever says
    // the options are similar, narrow, weak or insufficient, it has crossed
    // from stating what is there to assessing it.
    const JUDGEMENT = /\b(too similar|too narrow|weak|insufficient|poor|lacking|should have|missing a|need more)\b/i
    for (const tier of GHOST_TIERS) {
      const p = promptFor(MODEL, tier.siblingType)
      expect(p, `"${tier.label}" prompt makes an assessment: "${p}"`).not.toMatch(JUDGEMENT)
    }
  })

  it('every tier asks a QUESTION rather than instructing an insertion', () => {
    // A ghost that told Olumi to add something would make the AI the author.
    for (const tier of GHOST_TIERS) {
      const p = promptFor(MODEL, tier.siblingType)
      expect(p, `"${tier.label}" does not ask anything`).toContain('?')
      expect(p).not.toMatch(/^\s*(add|insert|create) /i)
    }
  })

  it('an unlabelled node never reaches the prompt as a placeholder', () => {
    // Describing a nameless node back to the user as "Untitled" would put a
    // thing in the prompt that is not in their model.
    const withBlank = [...MODEL, n('o4', 'option', '   ')]
    const p = promptFor(withBlank, 'option')
    expect(p).not.toMatch(/untitled|unnamed|\bnull\b|undefined/i)
    expect(p).toContain('Segment')
  })

  it('caps a long list and SAYS how many it left out', () => {
    // A list that stopped without saying so would misrepresent the model to
    // Olumi — the same honesty rule the canvas applies to the user.
    const many = Array.from({ length: 12 }, (_, i) => `Option ${i + 1}`)
    const joined = listForPrompt(many)
    expect(joined).toContain('Option 8')
    expect(joined).not.toContain('Option 9')
    expect(joined).toContain('and 4 more')
  })

  it('short lists carry no remainder clause', () => {
    expect(listForPrompt(['A', 'B'])).toBe('A, B')
  })

  it('still places no door on a tier with no members', () => {
    // Unchanged by this work, and re-pinned because the prompt builder now runs
    // per tier: a door on an empty tier would assert the tier OUGHT to have
    // members, which is the judgement line again.
    const noRisks = MODEL.filter(x => x.type !== 'risk')
    expect(promptFor(noRisks, 'risk')).toBe('')
  })
})

/**
 * ⭐ THE CASES AN INDEPENDENT REVIEW FOUND BY EXECUTING THE MODULE, after every
 * assertion above passed.
 *
 * The block above has a case for an unnamed node. It uses `'   '` — whitespace,
 * which is the representation I IMAGINED. The producers write the literal
 * `'Untitled'`: the CEE patch-apply path (`applyPatch.ts:82`, the primary draft
 * journey), `persist.ts:35/43`, `migrations.ts:121`, `store.ts:6112/6212`. So
 * the guard was correct, was pointed at the wrong bytes, and the spec agreed
 * with it — CLAUDE.md trap 16-inverse: a fixture you wrote yourself is not
 * evidence about the wire.
 *
 * Every fixture below uses the producers' own literal, imported from the
 * constant they all derive from rather than re-spelled here.
 */
describe('the prompt tells Olumi the truth about the model — the producer-derived cases', () => {
  const UNTITLED = 'Untitled' // === UNNAMED_ELEMENT_LABEL; see elementLabel.ts

  it('does not pass the producer\'s placeholder off as a name', () => {
    const allUnnamed = [
      n('d1', 'decision', 'Replace our CDP'),
      n('o1', 'option', UNTITLED),
      n('o2', 'option', UNTITLED),
      n('o3', 'option', UNTITLED),
    ]
    const p = promptFor(allUnnamed, 'option')
    expect(p).not.toMatch(/untitled|unnamed|\bnull\b|undefined/i)
  })

  it('says how many there are when it cannot say what they are called', () => {
    // The defect: labels were filtered AFTER the door gate, and the surviving
    // list was interpolated into "These are the options currently in my model:
    // {list}." With no names that rendered an EMPTY list — telling Olumi, in
    // the user's own transcript and under the user's own name, that a model
    // with three options had none.
    const allUnnamed = [
      n('d1', 'decision', 'Replace our CDP'),
      n('o1', 'option', UNTITLED),
      n('o2', 'option', UNTITLED),
      n('o3', 'option', UNTITLED),
    ]
    const p = promptFor(allUnnamed, 'option')
    expect(p).toContain('3 options')
    expect(p).not.toMatch(/model:\s*\./)
  })

  it('reports the whole tier when only some of it is named — not just the named part', () => {
    // Worse than the empty case because it is plausible: three options, one
    // named, and Olumi reasons about a one-option model without any signal
    // that it is looking at a third of the board.
    const partly = [
      n('d1', 'decision', 'Replace our CDP'),
      n('o1', 'option', 'Segment'),
      n('o2', 'option', UNTITLED),
      n('o3', 'option', UNTITLED),
    ]
    const p = promptFor(partly, 'option')
    expect(p).toContain('Segment')
    expect(p).toContain('3 options')
    expect(p).toContain('other 2')
  })

  it('DISCRIMINATION: two models that differ only in size do not produce identical copy', () => {
    // This is the assertion the whole feature rests on. The frontier exists
    // because "a generic prompt is a wasted click" — and on the unnamed path
    // the old copy was byte-identical for one risk and for three, degrading
    // into furniture on exactly the sparse early model it is meant to serve.
    const one = [n('d1', 'decision', 'Acquire Acme'), n('r1', 'risk', UNTITLED)]
    const three = [
      n('d1', 'decision', 'Acquire Acme'),
      n('r1', 'risk', UNTITLED),
      n('r2', 'risk', UNTITLED),
      n('r3', 'risk', UNTITLED),
    ]
    const a = promptFor(one, 'risk')
    const b = promptFor(three, 'risk')
    expect(a).not.toBe(b)
    expect(a).toContain('1 risk')
    expect(b).toContain('3 risks')
  })

  it('the honesty rule applies to the FILTER as well as to the cap', () => {
    // The cap says "(and N more)". The filter used to say nothing at all, and
    // both drop members from the same sentence for the same reason.
    const nine = Array.from({ length: 9 }, (_, i) =>
      n(`f${i}`, 'factor', i === 0 ? UNTITLED : `Factor ${i}`),
    )
    const p = promptFor([n('d1', 'decision', 'Acquire Acme'), ...nine], 'factor')
    expect(p).toContain('9 factors')
    expect(p).toContain('other 1 is not named')
  })

  it('a subject that ends in punctuation does not get a second terminator', () => {
    // Non-blocking, but this string lands in the user's own transcript:
    // "The decision is: Acquire Acme?." was visible to them.
    const p = promptFor([n('d1', 'decision', 'Acquire Acme?'), n('o1', 'option', 'Buy')], 'option')
    expect(p).toContain('Acquire Acme?')
    expect(p).not.toContain('Acme?.')
  })
})
