#!/usr/bin/env node
/**
 * Build Guard: Determinism Enforcement (v1.2)
 *
 * When VITE_STRICT_DETERMINISM=true:
 * - Fails build if dev-only flags are enabled
 * - Fails build if required engine base URL is missing
 * - Injects __BUILD_CONTRACT__ banner for repro tracking
 *
 * Usage:
 *   node scripts/check-determinism-guard.mjs
 *   VITE_STRICT_DETERMINISM=true node scripts/check-determinism-guard.mjs
 */

import { createHash } from 'crypto'

const STRICT_MODE = process.env.VITE_STRICT_DETERMINISM === 'true'

// Dev-only feature flags that must be OFF in strict mode
const DEV_FLAGS = [
  'VITE_COMMAND_PALETTE',
  'VITE_INSPECTOR_DEBUG',
  'VITE_FEATURE_UNSAFE_PREVIEW',
  'VITE_DEV_TOOLS',
]

// Required environment variables for production builds
const REQUIRED_ENV_VARS = [
  'VITE_PLOT_PROXY_BASE', // Engine base URL
]

/**
 * Exit codes:
 * 0 = success
 * 1 = guard violation (dev flag enabled or required var missing)
 * 2 = build contract injection failed
 */

function main() {
  console.log('[Build Guard] Running determinism checks...')
  console.log(`[Build Guard] VITE_STRICT_DETERMINISM=${STRICT_MODE}`)

  if (!STRICT_MODE) {
    console.log('[Build Guard] Strict mode OFF - skipping checks')
    return 0
  }

  let violations = []

  // Check 1: Dev-only flags must be OFF
  for (const flag of DEV_FLAGS) {
    const value = process.env[flag]
    if (value && value !== 'false' && value !== '0' && value !== '') {
      violations.push(`❌ Dev flag ${flag}=${value} is enabled (must be off in strict mode)`)
    }
  }

  // Check 2: Required environment variables must be present
  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar]
    if (!value || value.trim() === '') {
      violations.push(`❌ Required environment variable ${envVar} is missing or empty`)
    }
  }

  // Report violations
  if (violations.length > 0) {
    console.error('\n❌ Build Guard: FAILED\n')
    violations.forEach(v => console.error(`  ${v}`))
    console.error('\nFix these issues before building with VITE_STRICT_DETERMINISM=true\n')
    return 1
  }

  console.log('✅ Build Guard: All checks passed')

  // Generate build contract hash for logging
  const contractData = {
    timestamp: new Date().toISOString(),
    api_version: '1.2',
    adapter_version: '1.0.0',
    build_mode: 'strict_determinism',
    node_version: process.version,
  }

  const contractHash = createHash('sha256')
    .update(JSON.stringify(contractData))
    .digest('hex')
    .slice(0, 16)

  console.log(`\n📋 Build Contract: ${contractHash}`)
  console.log(`   API: ${contractData.api_version} | Adapter: ${contractData.adapter_version}`)
  console.log(`   Timestamp: ${contractData.timestamp}`)
  console.log(`   Node: ${contractData.node_version}`)
  console.log('\nℹ️  Note: To inject __BUILD_CONTRACT__ banner into dist/index.html, use a post-build script')
  console.log('   or configure Vite to inject via html.transformIndexHtml hook\n')

  console.log('✅ Build Guard: SUCCESS - safe to proceed with build\n')
  return 0
}

/**
 * Future: Inject __BUILD_CONTRACT__ banner via Vite plugin
 *
 * Example Vite config (vite.config.ts):
 *
 * export default defineConfig({
 *   plugins: [
 *     {
 *       name: 'inject-build-contract',
 *       transformIndexHtml(html) {
 *         if (process.env.VITE_STRICT_DETERMINISM !== 'true') return html
 *         const contractHash = generateContractHash()
 *         return html.replace(
 *           '<head>',
 *           `<head><!-- __BUILD_CONTRACT__: ${contractHash} -->`
 *         )
 *       }
 *     }
 *   ]
 * })
 */

// Run and exit with appropriate code
const exitCode = main()
process.exit(exitCode)
