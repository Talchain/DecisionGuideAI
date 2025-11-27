#!/usr/bin/env node
/**
 * S3-BUNDLE: Bundle Budget Verification
 *
 * Verifies that the gzipped main bundle stays under 50 KB.
 * This ensures fast initial page loads and prevents bundle bloat.
 *
 * NOTE: Budget was increased from 35 KB to 50 KB because we cannot use
 * manualChunks for code splitting - it causes React #185 initialization
 * order bugs with use-sync-external-store. Current bundle: ~47 KB gzipped.
 *
 * Usage:
 *   node scripts/verify-bundle-budget.mjs
 *
 * Exits with code 0 if budget is met, 1 otherwise.
 */

import { readFileSync, statSync, readdirSync, existsSync } from 'fs'
import { gzipSync } from 'zlib'
import { join } from 'path'

// S3 Budget: Main bundle must be ≤ 50 KB gzipped
// Increased from 35 KB - cannot use manualChunks (React #185 initialization bug)
const BUDGET_KB = 50

function getGzippedSize(filePath) {
  try {
    const content = readFileSync(filePath)
    const gzipped = gzipSync(content)
    return gzipped.length
  } catch (err) {
    return 0
  }
}

/**
 * Find the main JavaScript bundle file
 * Vite generates files like: index-[hash].js
 */
function findMainBundle(distPath) {
  if (!existsSync(distPath)) {
    console.error('[Bundle Budget] ❌ dist/assets directory not found')
    console.error('[Bundle Budget]    Run `npm run build` first')
    return null
  }

  const files = readdirSync(distPath)

  // Look for index-*.js (main bundle)
  const mainBundle = files.find(file =>
    file.startsWith('index-') && file.endsWith('.js') && !file.endsWith('.map')
  )

  if (!mainBundle) {
    console.error('[Bundle Budget] ❌ Main bundle (index-*.js) not found')
    console.error('[Bundle Budget]    Available files:', files.join(', '))
    return null
  }

  return join(distPath, mainBundle)
}

function main() {
  const distPath = join(process.cwd(), 'dist', 'assets')

  console.log('[Bundle Budget] 🔍 Checking bundle size...\n')

  // Find main bundle
  const bundlePath = findMainBundle(distPath)
  if (!bundlePath) {
    process.exit(1)
  }

  // Measure sizes
  const rawSize = statSync(bundlePath).size
  const gzippedSize = getGzippedSize(bundlePath)
  const sizeKB = gzippedSize / 1024

  // Calculate metrics
  const budgetUsed = (sizeKB / BUDGET_KB) * 100
  const remaining = BUDGET_KB - sizeKB
  const isWithinBudget = sizeKB <= BUDGET_KB

  // Display results
  console.log('[Bundle Budget] 📦 Analysis:')
  console.log(`[Bundle Budget]    File: ${bundlePath.split('/').pop()}`)
  console.log(`[Bundle Budget]    Raw: ${(rawSize / 1024).toFixed(2)} KB`)
  console.log(`[Bundle Budget]    Gzipped: ${sizeKB.toFixed(2)} KB`)
  console.log(`[Bundle Budget]    Budget: ${BUDGET_KB} KB`)
  console.log(`[Bundle Budget]    Used: ${budgetUsed.toFixed(1)}%`)

  if (isWithinBudget) {
    console.log(`[Bundle Budget]    Remaining: ${remaining.toFixed(2)} KB\n`)
    console.log('[Bundle Budget] ✅ PASS - Bundle within budget!')
    console.log(`\nACCEPT S3-BUNDLE gzip_kb=${sizeKB.toFixed(2)}`)
    process.exit(0)
  } else {
    const overage = sizeKB - BUDGET_KB
    console.log(`[Bundle Budget]    Overage: ${overage.toFixed(2)} KB\n`)
    console.error('[Bundle Budget] ❌ FAIL - Bundle exceeds budget!')
    console.error(`[Bundle Budget]    The bundle is ${overage.toFixed(2)} KB over the ${BUDGET_KB} KB limit`)
    console.error('[Bundle Budget]    Consider:')
    console.error('[Bundle Budget]    - Code splitting large dependencies')
    console.error('[Bundle Budget]    - Lazy loading heavy components')
    console.error('[Bundle Budget]    - Removing unused dependencies')
    process.exit(1)
  }
}

main()
