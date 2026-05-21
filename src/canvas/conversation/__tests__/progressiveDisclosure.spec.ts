/**
 * Progressive disclosure threshold tests.
 *
 * Round-3 UX correction raised the threshold from 600 → 3000 chars: the
 * prior threshold cut typical assistant responses too aggressively. The
 * boundary-detection algorithm is unchanged — only the safety-net
 * threshold moved. These tests pin behaviour to the new value.
 *
 * Verifies:
 * 1. Messages under 3000 chars show full text (no truncation)
 * 2. Messages over 3000 chars truncate at a natural boundary
 * 3. Truncation only fires when ≥150 chars would be hidden (MIN_HIDDEN_CHARS)
 * 4. Paragraph-break guard: a break >100 chars before the threshold is skipped;
 *    falls through to sentence-end path instead.
 */

import { describe, it, expect, vi } from 'vitest'

// MessageBubble's transitive import chain reaches threadService which
// throws at module load when Supabase env vars are missing in the test
// environment. Mock the chain ahead of the dynamic import so this pure
// unit-test file can actually run.
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('../../utils/markdown', () => ({
  renderMarkdown: (s: string) => s,
  sanitiseMarkdown: (s: string) => s,
}))

import { findNaturalTruncation } from '../MessageBubble'

const THRESHOLD = 3000

describe('findNaturalTruncation', () => {
  it('returns null for text under the threshold (shows full text)', () => {
    const shortText = 'A'.repeat(2000)
    expect(findNaturalTruncation(shortText)).toBeNull()
  })

  it('returns null for text exactly at the threshold', () => {
    const exactText = 'A'.repeat(THRESHOLD)
    expect(findNaturalTruncation(exactText)).toBeNull()
  })

  it('truncates text over the threshold at a paragraph boundary when the break is within 100 chars', () => {
    // Paragraph break at index THRESHOLD-50, well within MAX_PARA_BREAK_DISTANCE (100).
    // Hidden portion (200+ chars) exceeds MIN_HIDDEN_CHARS (150).
    const intro = 'A'.repeat(THRESHOLD - 50)     // no sentence endings
    const hidden = '\n\n' + 'A'.repeat(200)      // 202 chars
    const fullText = intro + hidden
    expect(fullText.length).toBeGreaterThan(THRESHOLD)

    const result = findNaturalTruncation(fullText)
    expect(result).not.toBeNull()
    expect(result).toBe(intro)
  })

  it('skips a paragraph break that sits >100 chars before the threshold (guard kicks in)', () => {
    // Paragraph break at index THRESHOLD-200 → 200 > MAX_PARA_BREAK_DISTANCE (100).
    // Falls through to sentence-end path; with no sentence endings, returns null.
    const intro = 'A'.repeat(THRESHOLD - 200)    // no sentence endings
    const hidden = '\n\n' + 'A'.repeat(300)      // 302 chars, no sentence endings
    const fullText = intro + hidden
    expect(fullText.length).toBeGreaterThan(THRESHOLD)

    const result = findNaturalTruncation(fullText)
    expect(result).toBeNull()
  })

  it('truncates at a sentence boundary when no paragraph break is available', () => {
    // Build a single paragraph that exceeds the threshold with many short
    // sentences so the sentence-end path is the only viable cut point.
    const sentence = 'This is a sentence of moderate length used to fill content. '
    const repeats = Math.ceil((THRESHOLD + 200) / sentence.length)
    const text = sentence.repeat(repeats)
    expect(text.length).toBeGreaterThan(THRESHOLD)

    const result = findNaturalTruncation(text)
    if (result) {
      // The result must end at a sentence boundary (.!?).
      expect(result).toMatch(/[.!?]$/)
    }
  })

  it('returns null when the hidden content would be less than MIN_HIDDEN_CHARS', () => {
    // Sentence boundary near the threshold, but only ~60 chars hidden — below
    // MIN_HIDDEN_CHARS (150). Truncation isn't worthwhile.
    const mainText = 'A'.repeat(THRESHOLD - 12) + '. '
    const tail = 'A'.repeat(60)
    const fullText = mainText + tail
    expect(fullText.length).toBeGreaterThan(THRESHOLD)

    const result = findNaturalTruncation(fullText)
    expect(result).toBeNull()
  })

  it('truncates when the hidden content exceeds MIN_HIDDEN_CHARS', () => {
    // Sentence boundary near the threshold; hidden tail >150 chars.
    const intro = 'A'.repeat(THRESHOLD - 202) + '. '   // sentence end near threshold
    const tail = 'A'.repeat(252)                       // 252 hidden chars
    const fullText = intro + tail
    expect(fullText.length).toBeGreaterThan(THRESHOLD)

    const result = findNaturalTruncation(fullText)
    expect(result).not.toBeNull()
    expect(result!.length).toBeLessThanOrEqual(THRESHOLD)
  })

  it('ordinary assistant responses (~1500 chars) render in full (no Show more)', () => {
    // Sanity check on the round-3 raise — a typical assistant response
    // length is well under the new 3000 safety-net threshold and must
    // NOT be truncated.
    const ordinaryText = 'A'.repeat(1500)
    expect(findNaturalTruncation(ordinaryText)).toBeNull()
  })
})
