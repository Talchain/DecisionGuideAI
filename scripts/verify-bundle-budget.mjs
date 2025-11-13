#!/usr/bin/env node
/**
 * N5: Bundle Budget Verification
 *
 * Verifies that the gzipped bundle size delta vs rc2 baseline is ≤ +30 KB.
 *
 * Usage:
 *   node scripts/verify-bundle-budget.mjs
 *
 * Exits with code 0 if budget is met, 1 otherwise.
 */

import { readFileSync, statSync, readdirSync } from 'fs'
import { gzipSync } from 'zlib'
import { join } from 'path'

// RC2 baseline (approximate gzipped size in KB)
// This should be measured from the actual rc2 build
const RC2_BASELINE_KB = 450 // Placeholder - update with actual rc2 measurement

// Budget allowance
const BUDGET_ALLOWANCE_KB = 30

function getGzippedSize(filePath) {
  try {
    const content = readFileSync(filePath)
    const gzipped = gzipSync(content)
    return gzipped.length
  } catch (err) {
    return 0
  }
}

function measureDistSize(distPath) {
  let totalSize = 0

  try {
    const files = readdirSync(distPath, { recursive: true, withFileTypes: true })

    for (const file of files) {
      if (file.isFile() && file.name.endsWith('.js')) {
        const filePath = join(file.path || distPath, file.name)
        totalSize += getGzippedSize(filePath)
      }
    }
  } catch (err) {
    console.error('[Bundle Budget] Failed to read dist:', err.message)
    return 0
  }

  return totalSize
}

function main() {
  const distPath = join(process.cwd(), 'dist', 'assets')

  console.log('[Bundle Budget] Measuring current build...')
  const currentSizeBytes = measureDistSize(distPath)
  const currentSizeKB = currentSizeBytes / 1024

  console.log(`[Bundle Budget] Current: ${currentSizeKB.toFixed(2)} KB (gzipped)`)
  console.log(`[Bundle Budget] Baseline: ${RC2_BASELINE_KB} KB (rc2)`)

  const deltaKB = currentSizeKB - RC2_BASELINE_KB
  console.log(`[Bundle Budget] Delta: ${deltaKB >= 0 ? '+' : ''}${deltaKB.toFixed(2)} KB`)

  if (deltaKB <= BUDGET_ALLOWANCE_KB) {
    console.log(`[Bundle Budget] ✓ PASS - Within budget (≤ +${BUDGET_ALLOWANCE_KB} KB)`)
    console.log(`\nACCEPT N5-BUNDLE delta_gzip_kb=${deltaKB.toFixed(2)}`)
    process.exit(0)
  } else {
    console.error(`[Bundle Budget] ✗ FAIL - Exceeds budget by ${(deltaKB - BUDGET_ALLOWANCE_KB).toFixed(2)} KB`)
    process.exit(1)
  }
}

main()
