/**
 * Regression Prevention Test: React #185 (useSyncExternalStore shim)
 *
 * This test ensures the broken useSyncExternalStore shim is NEVER re-added.
 *
 * History:
 * - Commit 0f3e914: ROOT CAUSE fix - removed shim aliases, used real package
 * - Commit 78837ab: Mistakenly re-added shim with "fix" that still caused #185
 *
 * The shim causes React #185 infinite loops because:
 * - useCallback dependencies include `selector` which is a new function each render
 * - When selector changes → new getSelection → useSyncExternalStore re-subscribes → loop
 *
 * The CORRECT fix is:
 * - Use the real use-sync-external-store@1.2.0 package
 * - Use Vite's dedupe: ['react', 'react-dom', 'zustand', 'use-sync-external-store']
 * - NO custom shim aliases
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Get project root (works in both test and build contexts)
const projectRoot = path.resolve(__dirname, '../..')

describe('React #185 Regression Prevention', () => {
  it('vite.config.ts does NOT contain use-sync-external-store shim aliases', () => {
    const viteConfigPath = path.resolve(projectRoot, 'vite.config.ts')
    const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8')

    // These patterns would indicate the broken shim is being aliased
    const forbiddenPatterns = [
      /find:.*use-sync-external-store.*replacement:.*shimPath/,
      /find:.*use-sync-external-store.*replacement:.*shim/,
      /useSyncExternalStoreShim/,
    ]

    for (const pattern of forbiddenPatterns) {
      const matches = viteConfig.match(pattern)
      expect(matches).toBeNull(
        `vite.config.ts contains forbidden pattern: ${pattern}\n` +
        `This will cause React #185 infinite loops!\n` +
        `See commit 0f3e914 for the correct approach: dedupe only, no shim aliases.`
      )
    }
  })

  it('vite.config.ts has critical warning comment', () => {
    const viteConfigPath = path.resolve(projectRoot, 'vite.config.ts')
    const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8')

    expect(viteConfig).toContain('CRITICAL: DO NOT ADD use-sync-external-store shim aliases')
  })

  it('dedupe array includes use-sync-external-store', () => {
    const viteConfigPath = path.resolve(projectRoot, 'vite.config.ts')
    const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8')

    // The dedupe array must include use-sync-external-store for the fix to work
    expect(viteConfig).toMatch(/dedupe:.*\[.*'use-sync-external-store'.*\]/)
  })
})
