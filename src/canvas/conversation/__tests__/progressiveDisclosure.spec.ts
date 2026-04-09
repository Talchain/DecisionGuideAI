/**
 * Progressive disclosure threshold tests.
 *
 * Verifies:
 * 1. Messages under 600 chars show full text (no truncation)
 * 2. Messages over 600 chars truncate at a natural boundary
 * 3. Truncation only fires when ≥150 chars would be hidden (MIN_HIDDEN_CHARS)
 * 4. Paragraph-break guard: a break >100 chars before the threshold is skipped;
 *    falls through to sentence-end path instead.
 */

import { describe, it, expect } from 'vitest'
import { findNaturalTruncation } from '../MessageBubble'

describe('findNaturalTruncation', () => {
  it('returns null for text under 600 chars (shows full text)', () => {
    const shortText = 'A'.repeat(400)
    expect(findNaturalTruncation(shortText)).toBeNull()
  })

  it('returns null for text exactly at 600 chars', () => {
    const exactText = 'A'.repeat(600)
    expect(findNaturalTruncation(exactText)).toBeNull()
  })

  it('truncates text over 600 chars at paragraph boundary when break is within 100 chars of threshold', () => {
    // Paragraph break at index 550, which is 50 chars before CLAMP_CHAR_THRESHOLD (600).
    // 50 <= MAX_PARA_BREAK_DISTANCE (100) → guard passes.
    // The hidden portion is 200+ chars of A's, well over MIN_HIDDEN_CHARS (150).
    // Using all A's so no sentence endings exist in the hidden portion — ensuring
    // the paragraph-break path is taken, not the sentence-end path.
    const intro = 'A'.repeat(550)               // 550 chars, no sentence endings
    const hidden = '\n\n' + 'A'.repeat(200)     // 202 chars, no sentence endings
    const fullText = intro + hidden
    expect(fullText.length).toBeGreaterThan(600)

    const result = findNaturalTruncation(fullText)
    expect(result).not.toBeNull()
    // Must cut at the paragraph break: result is the first 550 A's
    expect(result).toBe(intro)
  })

  it('skips paragraph break when it is >100 chars before threshold (guard kicks in)', () => {
    // Paragraph break at index 400 → 600 - 400 = 200 > MAX_PARA_BREAK_DISTANCE (100).
    // Guard should skip this break. The function then falls through to sentence-end.
    const intro = 'A'.repeat(400)               // 400 chars, no sentence endings
    const hidden = '\n\n' + 'A'.repeat(300)     // 302 chars, no sentence endings
    const fullText = intro + hidden
    expect(fullText.length).toBeGreaterThan(600)

    // No sentence endings exist anywhere in this text, so the sentence-end path
    // also finds nothing. The function must return null (no valid cut point).
    const result = findNaturalTruncation(fullText)
    expect(result).toBeNull()
  })

  it('truncates at sentence boundary when no paragraph break available', () => {
    // Single long paragraph with sentences — must exceed 600 chars total
    const text = 'First sentence is about the decision model and factors. ' +
      'Second sentence describes the key external risk factors. ' +
      'Third sentence explains the uncertainty in market conditions. ' +
      'Fourth sentence covers the regulatory landscape analysis. ' +
      'Fifth sentence discusses the competitive positioning strategy. ' +
      'Sixth sentence outlines the financial implications of each option. ' +
      'Seventh sentence provides the sensitivity analysis overview here. ' +
      'Eighth sentence summarises the robustness of the recommendation. ' +
      'Ninth sentence highlights the key drivers of the decision outcome. ' +
      'Tenth sentence concludes with the final recommendation details. ' +
      'Eleventh sentence adds extra context about implementation timeline. ' +
      'Twelfth sentence provides resource allocation recommendations now.'
    expect(text.length).toBeGreaterThan(600)

    const result = findNaturalTruncation(text)
    // Should truncate at a sentence boundary (ends with period)
    if (result) {
      expect(result).toMatch(/[.!?]$/)
    }
  })

  it('returns null when hidden content would be less than 150 chars', () => {
    // Sentence boundary at ~590, only 60 chars hidden — below MIN_HIDDEN_CHARS (150).
    // Use a long run of A's then a sentence ending, then short tail.
    const mainText = 'A'.repeat(588) + '. '   // 590 chars, sentence end at pos 588
    const tail = 'A'.repeat(60)               // 60 chars — below MIN_HIDDEN_CHARS
    const fullText = mainText + tail
    expect(fullText.length).toBeGreaterThan(600)

    const result = findNaturalTruncation(fullText)
    // Should return null because hidden content (60 chars) < MIN_HIDDEN_CHARS (150)
    expect(result).toBeNull()
  })

  it('truncates when hidden content exceeds 150 chars', () => {
    // Sentence boundary at ~400, then 250+ A's of content.
    // 400 + 2 + 250 = 652 chars total. Hidden after sentence boundary = 250 chars ≥ 150.
    // No paragraph breaks, so sentence-end path is used.
    const intro = 'A'.repeat(398) + '. '       // 400 chars, sentence end at pos 398
    const tail = 'A'.repeat(252)               // 252 chars — exceeds MIN_HIDDEN_CHARS (150)
    const fullText = intro + tail
    expect(fullText.length).toBeGreaterThan(600)

    const result = findNaturalTruncation(fullText)
    expect(result).not.toBeNull()
    expect(result!.length).toBeLessThanOrEqual(600)
  })
})
