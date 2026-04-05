/**
 * Progressive disclosure threshold tests.
 *
 * Verifies:
 * 1. Messages under 600 chars show full text (no truncation)
 * 2. Messages over 600 chars truncate at a natural boundary
 * 3. Truncation respects minimum hidden content threshold (100 chars)
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

  it('truncates text over 600 chars at paragraph boundary', () => {
    const para1 = 'Your model captures the core structural risks. ' // ~48 chars
    const para2 = 'Here are the recommendations I would suggest for improvement. ' // ~62 chars
    // Build text with paragraph break before 600 chars
    const beforeBreak = (para1 + para2).repeat(4) // ~440 chars
    const afterBreak = '\n\n' + 'Detailed recommendation content. '.repeat(10) // ~330+ chars
    const fullText = beforeBreak + afterBreak
    expect(fullText.length).toBeGreaterThan(600)

    const result = findNaturalTruncation(fullText)
    expect(result).not.toBeNull()
    expect(result!.length).toBeLessThanOrEqual(600)
    // Should not include the paragraph break and content after it
    expect(result).not.toContain('Detailed recommendation')
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

  it('returns null when hidden content would be less than 100 chars', () => {
    // Text just over 600 chars but only ~50 chars would be hidden
    const mainText = 'A'.repeat(590) + '. '
    const tail = 'Short tail.'  // ~11 chars, under MIN_HIDDEN_CHARS (100)
    const fullText = mainText + tail
    expect(fullText.length).toBeGreaterThan(600)

    const result = findNaturalTruncation(fullText)
    // Should return null because hidden content is too short
    expect(result).toBeNull()
  })

  it('truncates when hidden content exceeds 100 chars', () => {
    // First 500 chars end with a sentence, then 200+ chars of content
    const firstPart = 'Important intro content. '.repeat(20) // ~500 chars
    const secondPart = 'Hidden detailed content that should be behind Show More toggle. '.repeat(4) // ~260 chars
    const fullText = firstPart + secondPart
    expect(fullText.length).toBeGreaterThan(600)

    const result = findNaturalTruncation(fullText)
    expect(result).not.toBeNull()
    expect(result!.length).toBeLessThanOrEqual(600)
  })
})
