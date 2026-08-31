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
