#!/usr/bin/env node
/**
 * Sync Test Status section in docs from .tmp/test-summary.json
 *
 * Usage:
 *   node scripts/sync-test-status.cjs [--check]
 *
 * --check: Exit with error if docs don't match JSON (for CI)
 */

const fs = require('fs')
const path = require('path')

const DOCS_PATH = path.join(__dirname, '../docs/PLOT_V1_POLISH_FEATURES.md')
const JSON_PATH = path.join(__dirname, '../.tmp/test-summary.json')

function main() {
  const checkOnly = process.argv.includes('--check')

  // Read test summary JSON
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`Error: ${JSON_PATH} not found`)
    console.error('Run: npm test to generate test summary')
    process.exit(1)
  }

  const summary = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'))

  // Read docs
  if (!fs.existsSync(DOCS_PATH)) {
    console.error(`Error: ${DOCS_PATH} not found`)
    process.exit(1)
  }

  const docs = fs.readFileSync(DOCS_PATH, 'utf8')

  // Extract current date
  const today = new Date().toISOString().split('T')[0]

  // Build new Test Status section
  const newSection = `## Test Status

**Current Baseline** (from \`.tmp/test-summary.json\`):

| Metric | Passed | Failed | Skipped | Total |
|--------|--------|--------|---------|-------|
| **Test Files** | ${summary.test_files.passed} | ${summary.test_files.failed} | ${summary.test_files.skipped} | ${summary.test_files.total} |
| **Tests** | ${summary.tests.passed} | ${summary.tests.failed} | ${summary.tests.skipped} | ${summary.tests.total} |

**Duration**: ${summary.duration_seconds}s (from \`.tmp/test-summary.json\`)
**Environment**: ${summary.environment} (no rate limits, normalized env vars)
**Last Updated**: ${today}`

  // Find and replace Test Status section
  const pattern = /## Test Status\n\n[\s\S]*?\*\*Last Updated\*\*: \d{4}-\d{2}-\d{2}/

  if (!pattern.test(docs)) {
    console.error('Error: Could not find Test Status section in docs')
    process.exit(1)
  }

  const updatedDocs = docs.replace(pattern, newSection)

  if (checkOnly) {
    // Check mode: verify docs match JSON
    if (docs === updatedDocs) {
      console.log('✓ Test Status section matches .tmp/test-summary.json')
      process.exit(0)
    } else {
      console.error('✗ Test Status section does NOT match .tmp/test-summary.json')
      console.error('\nExpected:')
      console.error(newSection)
      console.error('\nTo fix, run: node scripts/sync-test-status.cjs')
      process.exit(1)
    }
  } else {
    // Write updated docs
    fs.writeFileSync(DOCS_PATH, updatedDocs, 'utf8')
    console.log(`✓ Updated Test Status section in ${DOCS_PATH}`)
    console.log(`  - Test Files: ${summary.test_files.passed}/${summary.test_files.total} passing`)
    console.log(`  - Tests: ${summary.tests.passed}/${summary.tests.total} passing`)
    console.log(`  - Duration: ${summary.duration_seconds}s`)
    process.exit(0)
  }
}

main()
