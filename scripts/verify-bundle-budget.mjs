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
 * Find the main JavaScript bundle file.
 *
 * Vite emits multiple `index-*.js` chunks per build (entry + lucide / debug-
 * state companions). The real entry chunk is whichever filename is
 * referenced from `dist/index.html` as `<script type="module" src=...>`.
 * Resolving via the HTML is the only authoritative answer; using
 * `readdirSync` + `Array.find` is filesystem-order-dependent (macOS APFS
 * returns lex order; Linux ext4 returns hash order) and silently picks
 * a non-entry companion on some platforms — masking budget breaches.
 *
 * Picker corrected 2026-05-13 (P0 deploy-unblocker). Previous behaviour
 * was `files.find(f => f.startsWith('index-') && ...)` which on macOS
 * was reporting the ~10 KB lucide companion instead of the ~50 KB
 * real entry, so local `build:ci` had been passing while Netlify
 * intermittently failed.
 */
function findMainBundle(distPath) {
  if (!existsSync(distPath)) {
    console.error('[Bundle Budget] ❌ dist/assets directory not found')
    console.error('[Bundle Budget]    Run `npm run build` first')
    return null
  }

  // Primary: resolve via dist/index.html's <script type="module" src=...>
  const distRoot = join(distPath, '..')
  const indexHtmlPath = join(distRoot, 'index.html')
  if (existsSync(indexHtmlPath)) {
    const html = readFileSync(indexHtmlPath, 'utf8')
    // Match <script type="module" ... src="/assets/index-XXXX.js">
    const match = html.match(/<script[^>]+type=["']module["'][^>]+src=["']\/?assets\/(index-[A-Za-z0-9_-]+\.js)["']/)
    if (match && match[1]) {
      const entryPath = join(distPath, match[1])
      if (existsSync(entryPath)) {
        return entryPath
      }
      console.error('[Bundle Budget] ⚠️  index.html references', match[1], 'but file missing from dist/assets; falling back to filesystem scan')
    }
  }

  // Fallback: pick the LARGEST `index-*.js` in dist/assets/. Deterministic
  // (size order, not FS order). Mirrors Netlify behaviour better than
  // Array.find but is still a fallback — primary path is the HTML lookup.
  const files = readdirSync(distPath)
    .filter(f => f.startsWith('index-') && f.endsWith('.js') && !f.endsWith('.map'))
  if (files.length === 0) {
    console.error('[Bundle Budget] ❌ Main bundle (index-*.js) not found')
    console.error('[Bundle Budget]    Available files:', readdirSync(distPath).join(', '))
    return null
  }
  const largest = files
    .map(f => ({ name: f, size: statSync(join(distPath, f)).size }))
    .sort((a, b) => b.size - a.size)[0]
  return join(distPath, largest.name)
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
