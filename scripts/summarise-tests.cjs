#!/usr/bin/env node
/**
 * summarise-tests.js
 *
 * Parses test output log and generates JSON summary with accurate counts.
 * Reads from Vitest output format.
 *
 * Usage:
 *   node scripts/summarise-tests.js <log-file>
 *
 * Output:
 *   .tmp/test-summary.json
 *
 * Format:
 * {
 *   "timestamp": "2025-11-01T10:00:00Z",
 *   "environment": "baseline",
 *   "test_files": { "passed": N, "failed": N, "skipped": N, "total": N },
 *   "tests": { "passed": N, "failed": N, "skipped": N, "total": N },
 *   "duration_seconds": N.NN,
 *   "source_log": "path/to/log.log"
 * }
 */

const fs = require('fs')
const path = require('path')

function parseVitestOutput(logContent) {
  // Vitest outputs a line like:
  // " Test Files  27 failed | 132 passed | 1 skipped (160)"
  // " Tests  168 failed | 1031 passed | 6 skipped (1209)"
  // " Duration  30.24s"

  const testFilesMatch = logContent.match(/Test Files\s+(\d+)\s+failed\s+\|\s+(\d+)\s+passed(?:\s+\|\s+(\d+)\s+skipped)?\s+\((\d+)\)/)
  const testsMatch = logContent.match(/Tests\s+(\d+)\s+failed\s+\|\s+(\d+)\s+passed(?:\s+\|\s+(\d+)\s+skipped)?\s+\((\d+)\)/)
  const durationMatch = logContent.match(/Duration\s+([\d.]+)s/)

  if (!testFilesMatch || !testsMatch) {
    console.error('Error: Could not parse test results from log')
    console.error('Expected Vitest output format not found')
    return null
  }

  const testFiles = {
    failed: parseInt(testFilesMatch[1], 10),
    passed: parseInt(testFilesMatch[2], 10),
    skipped: parseInt(testFilesMatch[3] || '0', 10),
    total: parseInt(testFilesMatch[4], 10)
  }

  const tests = {
    failed: parseInt(testsMatch[1], 10),
    passed: parseInt(testsMatch[2], 10),
    skipped: parseInt(testsMatch[3] || '0', 10),
    total: parseInt(testsMatch[4], 10)
  }

  const durationSeconds = durationMatch ? parseFloat(durationMatch[1]) : 0

  return {
    test_files: testFiles,
    tests,
    duration_seconds: durationSeconds
  }
}

function extractEnvironment(logContent) {
  const envMatch = logContent.match(/Environment:\s+(\w+)/i)
  return envMatch ? envMatch[1] : 'unknown'
}

function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('Usage: node summarise-tests.js <log-file>')
    process.exit(1)
  }

  const logFile = args[0]

  if (!fs.existsSync(logFile)) {
    console.error(`Error: Log file not found: ${logFile}`)
    process.exit(1)
  }

  console.log(`Parsing test log: ${logFile}`)

  const logContent = fs.readFileSync(logFile, 'utf-8')
  const results = parseVitestOutput(logContent)

  if (!results) {
    console.error('Failed to parse test results')
    process.exit(1)
  }

  const environment = extractEnvironment(logContent)

  const summary = {
    timestamp: new Date().toISOString(),
    environment,
    test_files: results.test_files,
    tests: results.tests,
    duration_seconds: results.duration_seconds,
    source_log: path.basename(logFile)
  }

  const outputPath = '.tmp/test-summary.json'
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2))

  console.log(`\nTest Summary:`)
  console.log(`  Environment: ${summary.environment}`)
  console.log(`  Test Files: ${summary.test_files.passed} passed, ${summary.test_files.failed} failed, ${summary.test_files.skipped} skipped (${summary.test_files.total} total)`)
  console.log(`  Tests: ${summary.tests.passed} passed, ${summary.tests.failed} failed, ${summary.tests.skipped} skipped (${summary.tests.total} total)`)
  console.log(`  Duration: ${summary.duration_seconds}s`)
  console.log(`\nSaved to: ${outputPath}`)

  // Exit with error code if tests failed
  if (summary.test_files.failed > 0 || summary.tests.failed > 0) {
    process.exit(1)
  }
}

main()
