#!/usr/bin/env node
/**
 * Detect Newly Skipped Tests Gate
 *
 * Scans test files for test.skip() calls and compares against main branch
 * to detect newly skipped tests. Fails CI if new skips are found without
 * explicit approval via SKIP_GATE_OVERRIDE env var.
 *
 * Usage:
 *   node scripts/detect-newly-skipped-tests.mjs
 *   SKIP_GATE_OVERRIDE=1 node scripts/detect-newly-skipped-tests.mjs  # Override
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';

const TEST_PATTERNS = [
  'src/**/*.test.ts',
  'src/**/*.test.tsx',
  'src/**/__tests__/**/*.ts',
  'src/**/__tests__/**/*.tsx',
  'e2e/**/*.spec.ts'
];

const SKIP_PATTERNS = [
  /test\.skip\s*\(/g,
  /it\.skip\s*\(/g,
  /describe\.skip\s*\(/g
];

/**
 * Count skipped tests in a file
 */
function countSkipsInFile(filePath) {
  if (!existsSync(filePath)) {
    return 0;
  }

  const content = readFileSync(filePath, 'utf-8');
  let count = 0;

  for (const pattern of SKIP_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }

  return count;
}

/**
 * Get all test files using find command
 */
function getTestFiles() {
  try {
    // Use find to locate test files
    const findCmd = `find src e2e -type f \\( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' \\) 2>/dev/null || true`;
    const output = execSync(findCmd, { encoding: 'utf-8' });

    return output
      .split('\n')
      .filter(line => line.trim().length > 0)
      .filter(line => !line.includes('node_modules'));
  } catch (error) {
    console.error('Error finding test files:', error.message);
    return [];
  }
}

/**
 * Get file content from main branch (if exists)
 */
function getFileFromMain(filePath) {
  try {
    return execSync(`git show main:${filePath}`, { encoding: 'utf-8' });
  } catch (error) {
    // File doesn't exist in main (new file)
    return null;
  }
}

/**
 * Count skips in main branch version of file
 */
function countSkipsInMain(filePath) {
  const content = getFileFromMain(filePath);
  if (!content) {
    return 0;
  }

  let count = 0;
  for (const pattern of SKIP_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }

  return count;
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Scanning for newly skipped tests...\n');

  // Check for override
  if (process.env.SKIP_GATE_OVERRIDE === '1') {
    console.log('⚠️  SKIP_GATE_OVERRIDE=1 detected - bypassing gate');
    console.log('✅ Gate check skipped by override\n');
    return;
  }

  // Get all test files
  const testFiles = getTestFiles();
  console.log(`📁 Found ${testFiles.length} test files\n`);

  const newlySkipped = [];
  let totalCurrentSkips = 0;
  let totalMainSkips = 0;

  // Check each file
  for (const file of testFiles) {
    const currentSkips = countSkipsInFile(file);
    const mainSkips = countSkipsInMain(file);

    totalCurrentSkips += currentSkips;
    totalMainSkips += mainSkips;

    if (currentSkips > mainSkips) {
      const newSkips = currentSkips - mainSkips;
      newlySkipped.push({
        file,
        newSkips,
        currentSkips,
        mainSkips
      });
    }
  }

  // Report results
  console.log('📊 Skip Test Summary:');
  console.log(`   Total skipped tests (current): ${totalCurrentSkips}`);
  console.log(`   Total skipped tests (main):    ${totalMainSkips}`);
  console.log(`   Net new skipped tests:         ${totalCurrentSkips - totalMainSkips}\n`);

  if (newlySkipped.length === 0) {
    console.log('✅ No newly skipped tests detected\n');
    return;
  }

  // Report newly skipped tests
  console.log('❌ Newly Skipped Tests Detected:\n');
  for (const { file, newSkips, currentSkips, mainSkips } of newlySkipped) {
    console.log(`   ${file}`);
    console.log(`     Current: ${currentSkips} skipped | Main: ${mainSkips} skipped | New: +${newSkips}`);
  }

  console.log('\n⛔ CI GATE FAILED: New test.skip() calls detected');
  console.log('\nTo proceed with newly skipped tests:');
  console.log('  1. Review each skipped test and ensure there is a valid reason');
  console.log('  2. Add a comment explaining why the test is skipped');
  console.log('  3. Create a follow-up issue to unskip the test');
  console.log('  4. If approved, set SKIP_GATE_OVERRIDE=1 in CI workflow\n');

  process.exit(1);
}

try {
  main();
} catch (error) {
  console.error('❌ Error detecting skipped tests:', error);
  process.exit(1);
}
