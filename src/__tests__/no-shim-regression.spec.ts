/**
 * Regression Prevention Test: React #185 (useSyncExternalStore shim)
 *
 * This test ensures the broken useSyncExternalStore shim is NEVER re-added.
 *
 * History:
 * - Commit 0f3e914: ROOT CAUSE fix - removed shim aliases, used real package
 * - Commit 78837ab: Mistakenly re-added shim with "fix" that still caused #185
 * - Commit c8380a9: Permanent fix with regression tests
 *
 * The shim causes React #185 infinite loops because:
 * - useCallback dependencies include `selector` which is a new function each render
 * - When selector changes → new getSelection → useSyncExternalStore re-subscribes → loop
 *
 * The CORRECT fix is:
 * - Use the real use-sync-external-store@1.2.0 package
 * - Use Vite's dedupe: ['react', 'react-dom', 'zustand', 'use-sync-external-store']
 * - NO custom shim or aliases of ANY kind for use-sync-external-store
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Get project root (works in both test and build contexts)
const projectRoot = path.resolve(__dirname, '../..')

describe('React #185 Regression Prevention', () => {
  it('vite.config.ts does NOT contain ANY use-sync-external-store alias', () => {
    const viteConfigPath = path.resolve(projectRoot, 'vite.config.ts')
    const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8')

    // STRICT: Fail if ANY alias mentions use-sync-external-store
    // This catches ALL attempts to redirect the package, not just shim-named ones
    const forbiddenPatterns = [
      // Any alias with find containing use-sync-external-store
      /find:.*['"]?use-sync-external-store/,
      /find:.*\/use-sync-external-store/,
      // Direct references to any shim implementation
      /useSyncExternalStoreShim/i,
      /syncExternalStoreShim/i,
      // Replacement pointing to shim
      /replacement:.*shim/i,
    ]

    for (const pattern of forbiddenPatterns) {
      const matches = viteConfig.match(pattern)
      expect(matches).toBeNull(
        `vite.config.ts contains forbidden pattern: ${pattern}\n` +
        `This will cause React #185 infinite loops!\n` +
        `The ONLY safe approach is: dedupe + real package, NO aliases.\n` +
        `See: commit 0f3e914 (ROOT CAUSE fix)`
      )
    }
  })

  it('shim directory does NOT exist', () => {
    const shimsDir = path.resolve(projectRoot, 'src/shims')
    const exists = fs.existsSync(shimsDir)

    expect(exists).toBe(false,
      `src/shims directory should NOT exist.\n` +
      `The shim was deleted to prevent future confusion.\n` +
      `If you need a shim for something else, use a different directory name.`
    )
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

  it('package.json has use-sync-external-store override', () => {
    const packageJsonPath = path.resolve(projectRoot, 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

    // Verify override exists to pin the version
    expect(packageJson.overrides?.['use-sync-external-store']).toBeDefined()
    expect(packageJson.overrides['use-sync-external-store']).toMatch(/^\^?1\.2\./)
  })
})
