// e2e/utils/consoleGuard.ts
// Reusable console guard for E2E tests

import { Page } from '@playwright/test'

/**
 * Attach a console guard that captures disallowed console messages.
 * Returns a getter function to check for violations in assertions.
 * 
 * @example
 * const getHits = attachConsoleGuard(page, [/use-sync-external-store/, /POC_HTML_SAFE: showing/])
 * // ... test actions ...
 * expect(getHits()).toHaveLength(0)
 */
export function attachConsoleGuard(page: Page, disallow: RegExp[]): () => string[] {
  const hits: string[] = []
  
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const text = msg.text()
      if (disallow.some(regex => regex.test(text))) {
        hits.push(text)
      }
    }
  })
  
  return () => hits
}

/**
 * Common patterns for console guards
 */
export const CONSOLE_GUARDS = {
  /** Detects use-sync-external-store errors (React/Zustand coupling issues) */
  SYNC_EXTERNAL_STORE: /use-sync-external-store/,
  
  /** Detects safe screen showing on happy path (should only show on failure) */
  SAFE_SCREEN_EARLY: /POC_HTML_SAFE: showing \(early-error\)/,
  
  /** Detects safe screen showing on timeout (React failed to mount) */
  SAFE_SCREEN_TIMEOUT: /POC_HTML_SAFE: showing \(timeout\)/,
  
  /** Detects any React errors */
  REACT_ERROR: /React/i,
  
  /** Detects Zustand errors */
  ZUSTAND_ERROR: /zustand/i
}
