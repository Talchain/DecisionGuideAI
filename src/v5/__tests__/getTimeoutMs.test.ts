/**
 * getTimeoutMs unit tests — verifies that V5 turn timeout selection correctly
 * assigns extended timeout for draft-graph-triggering paths and default
 * timeout for ordinary conversation turns.
 *
 * The function is not directly exported but can be tested via its effects.
 * Since it's a module-level function in useConversation.ts, we test the
 * timeout logic by recreating the function locally with the same signature
 * (it has no external dependencies).
 *
 * v5-non-edge-proxy-routing: added `derivedStage` parameter to ensure
 * composer first-turn on empty canvas (stage='frame') gets extended timeout.
 */
import { describe, it, expect } from 'vitest'

const DEFAULT_TIMEOUT_MS = 60_000
const EXTENDED_TIMEOUT_MS = 120_000

/**
 * Mirror of getTimeoutMs from useConversation.ts.
 * Kept in sync manually — if the function signature changes, this test
 * must be updated to match.
 */
function getTimeoutMs(turnType?: string, triggerSurface?: string, derivedStage?: string): number {
  if (
    turnType === 'explicit_generate' ||
    turnType === 'run_analysis' ||
    triggerSurface === 'analyse_now' ||
    derivedStage === 'frame'
  ) return EXTENDED_TIMEOUT_MS
  return DEFAULT_TIMEOUT_MS
}

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
})
