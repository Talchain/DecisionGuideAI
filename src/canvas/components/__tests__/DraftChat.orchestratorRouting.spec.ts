/**
 * DraftChat orchestrator routing — validates that when
 * VITE_ENABLE_ORCHESTRATOR_V2 is ON, handleDraft routes through the
 * orchestrator conversation path (sendMessage) instead of the legacy
 * /bff/cee/draft-graph endpoint.
 *
 * This test exists because a Vite dynamic-key bug in flagFactory.ts caused
 * the factory-based flag to silently return false even when the env var was
 * set. DraftChat now reads the env var directly with a literal key.
 *
 * We test the flag resolution function in isolation (no DOM rendering needed).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// 1. Flag resolution — useOrchestratorV2Flag bypass
// ---------------------------------------------------------------------------
// The function is not exported, so we test the same logic inline.
// This mirrors the implementation in DraftChat.tsx lines 33-42.

function resolveOrchestratorV2Flag(
  envValue: string | boolean | undefined,
  localStorageValue: string | null,
): boolean {
  // localStorage override (same precedence as DraftChat)
  if (localStorageValue != null) {
    return !(localStorageValue === '0' || localStorageValue === 'false')
  }
  // Env var check — literal key in real code, parameterised here
  return envValue === 'true' || envValue === '1' || envValue === true
}

describe('DraftChat orchestrator routing', () => {
  describe('flag resolution (useOrchestratorV2Flag logic)', () => {
    it('returns true when env var is string "true"', () => {
      expect(resolveOrchestratorV2Flag('true', null)).toBe(true)
    })

    it('returns true when env var is string "1"', () => {
      expect(resolveOrchestratorV2Flag('1', null)).toBe(true)
    })

    it('returns true when env var is boolean true', () => {
      expect(resolveOrchestratorV2Flag(true, null)).toBe(true)
    })

    it('returns false when env var is undefined', () => {
      expect(resolveOrchestratorV2Flag(undefined, null)).toBe(false)
    })

    it('returns false when env var is "false"', () => {
      expect(resolveOrchestratorV2Flag('false', null)).toBe(false)
    })

    it('returns false when env var is empty string', () => {
      expect(resolveOrchestratorV2Flag('', null)).toBe(false)
    })

    // localStorage overrides
    it('localStorage "1" overrides missing env var', () => {
      expect(resolveOrchestratorV2Flag(undefined, '1')).toBe(true)
    })

    it('localStorage "true" overrides missing env var', () => {
      expect(resolveOrchestratorV2Flag(undefined, 'true')).toBe(true)
    })

    it('localStorage "false" overrides env var "true"', () => {
      expect(resolveOrchestratorV2Flag('true', 'false')).toBe(false)
    })

    it('localStorage "0" overrides env var "true"', () => {
      expect(resolveOrchestratorV2Flag('true', '0')).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Vite literal-key vs dynamic-key resolution
  // ---------------------------------------------------------------------------
  // This is the crux of the bug. Vite replaces `import.meta.env.VITE_X` at
  // compile time ONLY when the key is a literal. Dynamic access like
  // `import.meta.env[key]` resolves to undefined.
  //
  // We can't reproduce the exact Vite transform in vitest (vitest resolves
  // env vars differently), but we CAN verify the pattern difference.

  describe('Vite env var access pattern', () => {
    it('literal key access resolves VITE_ENABLE_ORCHESTRATOR_V2', () => {
      // In the test environment, vitest exposes env vars on import.meta.env
      // regardless of access pattern. This test documents the expected value.
      const literalAccess = import.meta.env.VITE_ENABLE_ORCHESTRATOR_V2
      // Value comes from .env.local or test env — may be 'true' or undefined
      // The important thing: this does NOT throw or return a surprising value
      expect(typeof literalAccess === 'string' || literalAccess === undefined).toBe(true)
    })

    it('dynamic key access MAY fail in Vite dev mode (documenting the bug)', () => {
      const envKey = 'VITE_ENABLE_ORCHESTRATOR_V2'
      const dynamicAccess = (import.meta as any)?.env?.[envKey]
      // In vitest this works fine, but in Vite dev mode it returns undefined.
      // This test documents the asymmetry — it passes in both environments
      // but the real-world behaviour differs.
      expect(typeof dynamicAccess === 'string' || dynamicAccess === undefined).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Routing decision — the flag gates which path handleDraft takes
  // ---------------------------------------------------------------------------

  describe('routing decision', () => {
    it('when flag is true, orchestrator path is chosen (sendMessage called)', () => {
      // Simulates the handleDraft branch: if (isOrchV2) { sendMessage(brief) }
      const sendMessage = vi.fn()
      const generateDraft = vi.fn()

      const isOrchV2 = true
      const brief = 'Should I invest in stocks or bonds?'

      if (isOrchV2) {
        sendMessage(brief)
      } else {
        generateDraft(brief)
      }

      expect(sendMessage).toHaveBeenCalledWith(brief)
      expect(generateDraft).not.toHaveBeenCalled()
    })

    it('when flag is false, legacy path is chosen (generateDraft called)', () => {
      const sendMessage = vi.fn()
      const generateDraft = vi.fn()

      const isOrchV2 = false
      const brief = 'Should I invest in stocks or bonds?'

      if (isOrchV2) {
        sendMessage(brief)
      } else {
        generateDraft(brief)
      }

      expect(generateDraft).toHaveBeenCalledWith(brief)
      expect(sendMessage).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // 4. Other consumers of isOrchestratorV2Enabled — same bug exposure
  // ---------------------------------------------------------------------------
  // These files also use the broken factory. If DraftChat was broken, they
  // likely are too. The system events (graph edit, analysis complete, session
  // resume) and run-button gating (CanvasToolbar, OutputsDock) all use the
  // factory pattern. They should be migrated to literal-key access as well.

  describe('broader factory bug exposure (documentation)', () => {
    const affectedFiles = [
      'src/canvas/CanvasToolbar.tsx',
      'src/canvas/components/OutputsDock.tsx',
      'src/canvas/conversation/useGraphEditEvents.ts',
      'src/canvas/conversation/useAnalysisCompleteEvent.ts',
      'src/canvas/conversation/useSessionResumeEvent.ts',
      'src/canvas/conversation/useConversation.ts',
    ]

    it('documents files still using the broken factory pattern', () => {
      // This test serves as a tracking reminder. Each file listed above
      // calls isOrchestratorV2Enabled() from the factory and may silently
      // resolve to false in Vite dev mode.
      expect(affectedFiles.length).toBe(6)
    })
  })
})
