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
import { getTimeoutMs, TURN_WAIT_MS, SERVER_TURN_DEADLINE_MS, EXTENDED_TIMEOUT_MS } from '../getTimeoutMs'

describe('getTimeoutMs', () => {
  describe('extended timeout (175s) for draft-graph-triggering paths', () => {
    it('explicit_generate (Generate Model button) → 175s', () => {
      expect(getTimeoutMs('explicit_generate')).toBe(EXTENDED_TIMEOUT_MS)
    })

    it('run_analysis → 175s', () => {
      expect(getTimeoutMs('run_analysis')).toBe(EXTENDED_TIMEOUT_MS)
    })

    it('analyse_now trigger surface → 175s', () => {
      expect(getTimeoutMs('conversation', 'analyse_now')).toBe(EXTENDED_TIMEOUT_MS)
    })

    it('frame stage (composer first-turn on empty canvas) → 175s', () => {
      expect(getTimeoutMs('conversation', undefined, 'frame')).toBe(EXTENDED_TIMEOUT_MS)
    })

    it('frame stage with explicit_generate → 175s (both conditions match)', () => {
      expect(getTimeoutMs('explicit_generate', undefined, 'frame')).toBe(EXTENDED_TIMEOUT_MS)
    })
  })

  describe('ordinary turns get the same wait — ROADMAP 2.665', () => {
    /**
     * ⚠ CORRECTED AT SOURCE, NOT BASELINED. These six cases used to assert a
     * 60s budget, and that budget was the defect: CEE completes and COMMITS a
     * turn whether or not the browser is still listening, and this client has
     * no way to collect one afterwards (no status route; `v5_conversation_turns`
     * has zero readers here). Live-witnessed 2026-08-07 — an ordinary
     * `conversation` turn returned 200 at 123.1s while the client had given up
     * at 60.0s, so the reply was destroyed and the user was told the message
     * had not gone through.
     *
     * The turn-type list that used to select the longer budget was a mirror of
     * "which turns CEE runs slowly", maintained on the wrong side of the wire;
     * it drifted the moment CEE grew a second composition on a `conversation`
     * turn. The invariant that replaced it — every wait outlasts the server
     * deadline — is asserted over the whole input domain in
     * `turnWaitCoversServerDeadline.spec.ts`.
     */
    it('conversation turn with no special triggers → the full wait', () => {
      expect(getTimeoutMs('conversation')).toBe(TURN_WAIT_MS)
    })

    it('conversation turn at analyse stage → the full wait', () => {
      expect(getTimeoutMs('conversation', undefined, 'analyse')).toBe(TURN_WAIT_MS)
    })

    it('conversation turn at decide stage → the full wait', () => {
      expect(getTimeoutMs('conversation', undefined, 'decide')).toBe(TURN_WAIT_MS)
    })

    it('no arguments → the full wait', () => {
      expect(getTimeoutMs()).toBe(TURN_WAIT_MS)
    })

    it('explain turn type → the full wait', () => {
      expect(getTimeoutMs('explain')).toBe(TURN_WAIT_MS)
    })

    it('clarification_response → the full wait', () => {
      expect(getTimeoutMs('clarification_response')).toBe(TURN_WAIT_MS)
    })
  })

  describe('constant values', () => {
    it('TURN_WAIT_MS is 175s and clears the server deadline', () => {
      expect(TURN_WAIT_MS).toBe(175_000)
      expect(TURN_WAIT_MS).toBeGreaterThan(SERVER_TURN_DEADLINE_MS)
    })

    it('EXTENDED_TIMEOUT_MS is 175s', () => {
      expect(EXTENDED_TIMEOUT_MS).toBe(175_000)
    })

    // ⛔ THE DEADLINE THE SERVER ACTUALLY RUNS TO, not its code default (23 Sep 2026).
    // cee-staging sets BROWSER_PROXY_TIMEOUT_MS=170000 (Render env, read by the
    // OpenAI Connected PoC lane, #63 5797782532), overriding CEE's `.default(125_000)`.
    // First Agent builds measured 104.2 s and 124.4 s on served CEE `2aaf794`, and CEE
    // may legitimately answer up to 170 s — so a 130 s client wait destroyed turns
    // CEE had already COMMITTED (the user sees a timeout; a retry reports an unknown
    // outcome). A client wait above the code default but below the deployed deadline
    // is the same coin toss this module's header says the user loses silently.
    it('the server deadline covers the DEPLOYED staging proxy timeout (170 s), not only the code default', () => {
      const STAGING_BROWSER_PROXY_TIMEOUT_MS = 170_000
      expect(SERVER_TURN_DEADLINE_MS).toBeGreaterThanOrEqual(STAGING_BROWSER_PROXY_TIMEOUT_MS)
      expect(TURN_WAIT_MS).toBeGreaterThan(STAGING_BROWSER_PROXY_TIMEOUT_MS)
    })
  })
})
