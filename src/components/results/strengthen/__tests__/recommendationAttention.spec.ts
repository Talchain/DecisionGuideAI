/**
 * A recommendation, expressed as something Olumi can hold attention on.
 *
 * The point of these cases is that NOTHING here is composed by the UI. Every
 * visible string in the resulting card is the engine's own, and the move is
 * the engine's `helpType` re-presented — so the assertions are mostly identity
 * assertions rather than shape assertions.
 */
import { describe, it, expect } from 'vitest'
import { attentionNoteForRecommendation } from '../recommendationAttention'
import type { HelpType, Recommendation } from '../strengthenTypes'

function rec(over: Partial<Recommendation> = {}): Recommendation {
  return {
    id: 'strengthen:flip:edge_9',
    helpType: 'challenge',
    title: 'This link is doing a lot of work',
    signal: 'The ranking flips if this weakens.',
    whyNow: 'It is the smallest change that reverses the result.',
    tryThis: 'Check the evidence behind this link.',
    sourceLine: 'Source: robustness analysis (flip threshold).',
    action: {
      kind: 'ai-dialogue',
      label: 'Ask Olumi',
      prompt: 'Why is this link so influential?',
    },
    targetId: 'edge_9',
    priority: 1,
    ...over,
  } as Recommendation
}

describe('attentionNoteForRecommendation', () => {
  // The move is the ENGINE's classification, not the UI's reading of the copy.
  const CASES: Array<[HelpType, string | null]> = [
    ['clarify', 'calibrate'],
    ['broaden', 'expand'],
    ['challenge', 'challenge'],
    ['evaluate', 'calibrate'],
    ['commit', null],
  ]

  it.each(CASES)('maps helpType %s to move %s', (helpType, expected) => {
    const note = attentionNoteForRecommendation(rec({ helpType }))
    expect(note?.move ?? null).toBe(expected)
  })

  // ⭐ FAIL-CLOSED. None of the four moves honestly describes "record the
  // decision", so no card is raised at all rather than one carrying a verb the
  // engine never chose. The caller still focuses the element.
  it('returns null for commit rather than inventing the nearest move', () => {
    expect(attentionNoteForRecommendation(rec({ helpType: 'commit' }))).toBeNull()
  })

  it('carries the engine title, source line and prompt VERBATIM', () => {
    const r = rec()
    const note = attentionNoteForRecommendation(r)
    expect(note?.title).toBe(r.title)
    expect(note?.sourceLine).toBe(r.sourceLine)
    expect(note?.actions?.[0]?.prompt).toBe(r.action.prompt)
    expect(note?.actions?.[0]?.label).toBe(r.action.label)
  })

  // The body is the same line the panel renders, from the same helper, so the
  // canvas and the panel cannot drift into two accounts of one finding.
  it('composes the body with the panel’s own why-line', () => {
    const note = attentionNoteForRecommendation(rec())
    expect(note?.body).toBe(
      'The ranking flips if this weakens. It is the smallest change that reverses the result.',
    )
  })

  it('does not repeat the signal when whyNow is identical to it', () => {
    const note = attentionNoteForRecommendation(
      rec({ signal: 'Same sentence.', whyNow: 'Same sentence.' }),
    )
    expect(note?.body).toBe('Same sentence.')
  })

  it('omits sourceLine entirely rather than emitting an empty one', () => {
    const note = attentionNoteForRecommendation(rec({ sourceLine: '' }))
    expect(note).not.toBeNull()
    expect(note?.sourceLine).toBeUndefined()
  })

  it('omits the action when the engine gave no label', () => {
    const note = attentionNoteForRecommendation(
      rec({ action: { kind: 'canvas-focus', label: '' } }),
    )
    expect(note?.actions).toBeUndefined()
  })

  // A heading with no explanation is a label, not a reason to look at something.
  it('returns null when there is no why to show', () => {
    expect(attentionNoteForRecommendation(rec({ signal: '', whyNow: '' }))).toBeNull()
  })
})
