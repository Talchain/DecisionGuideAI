/**
 * The neutral-surface rollback must update fallback colours as well as tokens.
 * Reuse the existing census; do not duplicate its CSS or TypeScript parser.
 * This focused assertion reports the actual source sites, so a mismatch can
 * be repaired without relaxing the estate-wide fallback-drift guard.
 */
import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

interface SurfaceCensus {
  errors: string[]
  selfTest: { ok: boolean; failures: string[] }
  counts: { references: number }
  fallbackDrift: Array<{
    name: string
    fallback: string
    declared: string[]
    sites: string[]
  }>
}

function surfaceCensus(): SurfaceCensus {
  const script = resolve(__dirname, '../../scripts/css-var-census.mjs')
  let output: string
  try {
    output = execFileSync(process.execPath, [script, '--json'], {
      encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 60000,
    })
  } catch (error) {
    const result = error as { status?: number; stdout?: unknown }
    // Exit 1 is the census's documented findings result, not an execution error.
    if (result.status !== 1 || typeof result.stdout !== 'string') throw error
    output = result.stdout
  }
  return JSON.parse(output) as SurfaceCensus
}

describe('restored neutral-surface fallbacks', () => {
  it('reports no stale cream fallback for a restored near-white surface', () => {
    const census = surfaceCensus()
    expect(census.errors).toEqual([])
    expect(census.selfTest.ok).toBe(true)
    expect(census.selfTest.failures).toEqual([])
    expect(census.counts.references).toBeGreaterThan(100)
    expect(Array.isArray(census.fallbackDrift)).toBe(true)
    const stale = census.fallbackDrift.filter(({ name, fallback }) =>
      (name === '--bg-panel' || name === '--surface-card') &&
      fallback.toUpperCase() === '#FEF9F3',
    )
    expect(stale, 'Update these source fallbacks to the restored surface token; do not add drift exemptions.').toEqual([])
  }, 90000)
})
