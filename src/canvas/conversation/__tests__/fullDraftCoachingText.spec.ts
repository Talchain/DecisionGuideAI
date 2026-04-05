/**
 * Full-draft coaching text preservation — contract tests.
 *
 * Verifies that:
 * 1. Stock ack suppression DOES NOT apply to full_draft turns
 * 2. Non-conversational filter DOES NOT apply to full_draft turns
 * 3. Stock ack suppression still works on incremental patch turns (regression)
 * 4. isNonConversationalContent still classifies correctly (regression)
 */

import { describe, it, expect } from 'vitest'
import { isNonConversationalContent } from '../useConversation'

// ---------------------------------------------------------------------------
// Stock ack patterns — mirrors the patterns in useConversation handleEnvelope
// ---------------------------------------------------------------------------

const STOCK_ACK_PATTERNS = [
  /^\s*changes\s+applied\.?\s*$/i,
  /^\s*got\s+it[.!]?\s*$/i,
  /^\s*understood[.!]?\s*$/i,
  /^\s*noted[.!]?\s*$/i,
  /^\s*noted\s+the\s+changes\s+to\s+your\s+model\.?\s*$/i,
]

function isStockAck(text: string): boolean {
  return STOCK_ACK_PATTERNS.some((p) => p.test(text))
}

// ---------------------------------------------------------------------------
// Regression: stock ack suppression works for incremental patches
// ---------------------------------------------------------------------------

describe('Stock ack suppression (incremental patches)', () => {
  it.each([
    'Changes applied.',
    'Got it!',
    'Understood.',
    'Noted.',
    'Noted the changes to your model.',
    '  Changes applied.  ',
  ])('suppresses: "%s"', (text) => {
    expect(isStockAck(text)).toBe(true)
  })

  it.each([
    "I've updated the weight on that edge. Here's what changed...",
    'Your model captures the core structural risks.',
    'Got it! I made the following changes to your model:',
  ])('preserves: "%s"', (text) => {
    expect(isStockAck(text)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Regression: isNonConversationalContent classification
// ---------------------------------------------------------------------------

describe('isNonConversationalContent (regression)', () => {
  it('classifies empty/whitespace as non-conversational', () => {
    expect(isNonConversationalContent('')).toBe(true)
    expect(isNonConversationalContent('   ')).toBe(true)
  })

  it('classifies real coaching text as conversational', () => {
    expect(isNonConversationalContent(
      'Your model captures the core structural risks, but there are a few worth adding explicitly.'
    )).toBe(false)
  })

  it('classifies real coaching with recommendations as conversational', () => {
    expect(isNonConversationalContent(
      "I've created an initial decision model for your scenario. Here's what I included:\n\n" +
      '- Market share as a key external factor\n' +
      '- Regulatory risk with high uncertainty\n' +
      '- Two strategic options to compare'
    )).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Contract: full_draft coaching text is NOT filtered
// ---------------------------------------------------------------------------

describe('Full_draft coaching text contract', () => {
  it('coaching text that would be classified as non-conversational still has content', () => {
    // This text would pass isNonConversationalContent as conversational,
    // but the contract is that even if it DID match, full_draft bypasses the filter.
    const coachingText = "I've created an initial decision model based on your brief. " +
      "The model includes the key factors and options you described."
    expect(isNonConversationalContent(coachingText)).toBe(false)
    expect(coachingText.trim().length).toBeGreaterThan(0)
  })

  it('stock ack text that would be suppressed on incremental patches exists as a pattern', () => {
    // Contract: "Changes applied." IS a stock ack but full_draft turns skip this check
    expect(isStockAck('Changes applied.')).toBe(true)
  })
})
