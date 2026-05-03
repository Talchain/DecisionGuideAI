/**
 * getTimeoutMs unit tests — verifies that V5 turn timeout selection correctly
 * assigns extended timeout for draft-graph-triggering paths and default
 * timeout for ordinary conversation turns.
 *
 * Tests import directly from src/v5/getTimeoutMs.ts (the function is now
 * exported). useConversation.ts imports from the same module, so these tests
 * cover production behaviour rather than a manually-maintained copy.
 */
import { describe, it, expect } from 'vitest'
import { getTimeoutMs, DEFAULT_TIMEOUT_MS, EXTENDED_TIMEOUT_MS } from '../getTimeoutMs'

describe('getTimeoutMs', () => {
  describe('extended timeout (120s) for draft-graph-triggering paths', () => {
    it('explicit_generate (Generate Model button) → 120s', () => {
      expect(getTimeoutMs('explicit_generate')).toBe(EXTENDED_TIMEOUT_MS)
    })

    it('run_analysis → 120s', () => {
      expect(getTimeoutMs('run_analysis')).toBe(EXTENDED_TIMEOUT_MS)
    })

    it('analyse_now trigger surface → 120s', () => {
      expect(getTimeoutMs('conversation', 'analyse_now')).toBe(EXTENDED_TIMEOUT_MS)
    })

    it('frame stage (composer first-turn on empty canvas) → 120s', () => {
      expect(getTimeoutMs('conversation', undefined, 'frame')).toBe(EXTENDED_TIMEOUT_MS)
    })

    it('frame stage with explicit_generate → 120s (both conditions match)', () => {
      expect(getTimeoutMs('explicit_generate', undefined, 'frame')).toBe(EXTENDED_TIMEOUT_MS)
    })
  })

  describe('default timeout (60s) for ordinary turns', () => {
    it('conversation turn with no special triggers → 60s', () => {
      expect(getTimeoutMs('conversation')).toBe(DEFAULT_TIMEOUT_MS)
    })

    it('conversation turn at analyse stage → 60s', () => {
      expect(getTimeoutMs('conversation', undefined, 'analyse')).toBe(DEFAULT_TIMEOUT_MS)
    })

    it('conversation turn at decide stage → 60s', () => {
      expect(getTimeoutMs('conversation', undefined, 'decide')).toBe(DEFAULT_TIMEOUT_MS)
    })

    it('no arguments → 60s', () => {
      expect(getTimeoutMs()).toBe(DEFAULT_TIMEOUT_MS)
    })

    it('explain turn type → 60s', () => {
      expect(getTimeoutMs('explain')).toBe(DEFAULT_TIMEOUT_MS)
    })

    it('clarification_response → 60s', () => {
      expect(getTimeoutMs('clarification_response')).toBe(DEFAULT_TIMEOUT_MS)
    })
  })

  describe('constant values', () => {
    it('DEFAULT_TIMEOUT_MS is 60s', () => {
      expect(DEFAULT_TIMEOUT_MS).toBe(60_000)
    })

    it('EXTENDED_TIMEOUT_MS is 120s', () => {
      expect(EXTENDED_TIMEOUT_MS).toBe(120_000)
    })
  })
})
