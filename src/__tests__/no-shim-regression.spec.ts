/**
 * Regression Prevention Test: React #185 (useSyncExternalStore shim)
 *
 * This test ensures the broken useSyncExternalStore shim is NEVER re-added.
 *
 * History:
 * - Commit 0f3e914: ROOT CAUSE fix - removed shim aliases, used real package
 * - Commit 78837ab: Mistakenly re-added shim with "fix" that still caused #185
 * - Commit c8380a9: Permanent fix with regression tests
 * - Nov 2024: Root cause found - dual zustand versions (v4.5.7 in @xyflow, v5.0.8 in app)
 *   with incompatible useSyncExternalStore implementations
 *
 * The shim causes React #185 infinite loops because:
 * - useCallback dependencies include `selector` which is a new function each render
 * - When selector changes → new getSelection → useSyncExternalStore re-subscribes → loop
 *
 * The CORRECT fix is:
 * - Use the real use-sync-external-store@1.2.0 package
 * - Use Vite's dedupe: ['react', 'react-dom', 'zustand', 'use-sync-external-store']
 * - NO custom shim or aliases of ANY kind for use-sync-external-store
 * - manualChunks MUST check @xyflow BEFORE react to prevent pattern collision
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

    // Verify override exists to pin the version (must match zustand's peer dep)
    expect(packageJson.overrides?.['use-sync-external-store']).toBeDefined()
    expect(packageJson.overrides['use-sync-external-store']).toMatch(/^\^?1\.[26]\./)
  })

  it('package.json has zustand override to prevent dual-version bug', () => {
    const packageJsonPath = path.resolve(projectRoot, 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

    // @xyflow/react bundles zustand v4.5.7 which has different useSyncExternalStore
    // implementation than zustand v5.0.8. Without this override, both versions
    // get bundled, causing React #185 infinite loops.
    expect(packageJson.overrides?.zustand).toBeDefined(
      `package.json must have zustand override.\n` +
      `Without it, @xyflow/react uses zustand v4 while app uses v5,\n` +
      `causing React #185 due to incompatible useSyncExternalStore implementations.`
    )
    expect(packageJson.overrides.zustand).toMatch(/^\^?5\./)
  })

  it('vite.config.ts does NOT use manualChunks (causes initialization order bugs)', () => {
    const viteConfigPath = path.resolve(projectRoot, 'vite.config.ts')
    const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8')

    // manualChunks causes initialization order bugs:
    // - Putting React in a separate chunk from use-sync-external-store
    //   causes "Cannot read properties of undefined (reading 'useState')"
    // - The shim executes before React loads
    // Let Vite/Rollup handle chunk ordering automatically.
    expect(viteConfig).not.toMatch(/manualChunks\s*[:(]/,
      `vite.config.ts must NOT use manualChunks.\n` +
      `It causes initialization order bugs where use-sync-external-store\n` +
      `executes before React loads, causing useState undefined errors.`
    )
  })
})
