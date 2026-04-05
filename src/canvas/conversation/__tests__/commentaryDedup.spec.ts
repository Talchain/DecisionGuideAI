/**
 * Commentary block deduplication tests.
 *
 * Verifies that assistant_text duplicating a commentary block's narrative
 * is suppressed, while non-duplicate content is preserved.
 */

import { describe, it, expect } from 'vitest'
import { deduplicateAgainstCommentary } from '../useConversation'

describe('deduplicateAgainstCommentary', () => {
  // -------------------------------------------------------------------
  // 1. Message with commentary block and duplicate assistant_text
  // -------------------------------------------------------------------

  it('suppresses assistant_text when first sentence appears in commentary', () => {
    const assistantText = 'Acquire Smaller Competitor leads at 44% win probability.'
    const commentary = 'Acquire Smaller Competitor leads at 44% win probability. ' +
      'The model shows moderate sensitivity to market conditions, with the key driver ' +
      'being competitive positioning.'
    expect(deduplicateAgainstCommentary(assistantText, commentary)).toBe('')
  })

  it('suppresses when the entire assistant_text is a substring of commentary', () => {
    const assistantText = 'Option A is the recommended choice.'
    const commentary = 'Option A is the recommended choice. It has the highest expected value ' +
      'and is robust to parameter variation.'
    expect(deduplicateAgainstCommentary(assistantText, commentary)).toBe('')
  })

  it('is case-insensitive when matching', () => {
    const assistantText = 'The analysis shows strong support for Option B.'
    const commentary = 'the analysis shows strong support for option b. Additional details...'
    expect(deduplicateAgainstCommentary(assistantText, commentary)).toBe('')
  })

  // -------------------------------------------------------------------
  // 2. Message with commentary block and additional context
  // -------------------------------------------------------------------

  it('preserves non-duplicate remainder after first sentence', () => {
    const assistantText = 'Acquire Smaller Competitor leads at 44%. Would you like to explore sensitivity to market size?'
    const commentary = 'Acquire Smaller Competitor leads at 44%. The model shows moderate sensitivity...'
    const result = deduplicateAgainstCommentary(assistantText, commentary)
    expect(result).toBe('Would you like to explore sensitivity to market size?')
  })

  it('preserves follow-up question when first sentence is duplicated', () => {
    const assistantText = 'Option A wins with 65% probability. Do you want me to run a pre-mortem analysis?'
    const commentary = 'Option A wins with 65% probability. Detailed breakdown of drivers...'
    const result = deduplicateAgainstCommentary(assistantText, commentary)
    expect(result).toBe('Do you want me to run a pre-mortem analysis?')
  })

  // -------------------------------------------------------------------
  // 3. Message without duplication — assistant_text preserved
  // -------------------------------------------------------------------

  it('preserves assistant_text when first sentence is NOT in commentary', () => {
    const assistantText = 'Here is an overview of the key drivers in your model.'
    const commentary = 'Option A leads with 44% win probability. The main sensitivity is to cost factors.'
    expect(deduplicateAgainstCommentary(assistantText, commentary)).toBe(assistantText)
  })

  it('returns assistant_text unchanged when commentary is empty', () => {
    const assistantText = 'Some explanation text.'
    expect(deduplicateAgainstCommentary(assistantText, '')).toBe(assistantText)
  })

  it('returns assistant_text unchanged when it is empty', () => {
    expect(deduplicateAgainstCommentary('', 'some commentary')).toBe('')
  })

  it('returns empty string when both are empty', () => {
    expect(deduplicateAgainstCommentary('', '')).toBe('')
  })

  // -------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------

  it('handles assistant_text with no sentence boundary as full match', () => {
    const assistantText = 'Acquire Smaller Competitor leads'
    const commentary = 'Acquire Smaller Competitor leads at 44% probability. Details follow.'
    // No sentence-ending punctuation — falls back to full-text substring check
    expect(deduplicateAgainstCommentary(assistantText, commentary)).toBe('')
  })

  it('preserves text when no sentence boundary and no substring match', () => {
    const assistantText = 'Unique text without punctuation'
    const commentary = 'Completely different commentary content here.'
    expect(deduplicateAgainstCommentary(assistantText, commentary)).toBe(assistantText)
  })

  it('matches despite extra whitespace in commentary', () => {
    const assistantText = 'Option A wins with 65% probability.'
    const commentary = 'Option A  wins  with  65%  probability.  The drivers are...'
    expect(deduplicateAgainstCommentary(assistantText, commentary)).toBe('')
  })

  it('matches despite newlines in commentary', () => {
    const assistantText = 'The analysis shows strong support.'
    const commentary = 'The analysis\nshows strong\nsupport. Additional context follows.'
    expect(deduplicateAgainstCommentary(assistantText, commentary)).toBe('')
  })
})
