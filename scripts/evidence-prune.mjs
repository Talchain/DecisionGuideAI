#!/usr/bin/env node

/**
 * Evidence Bundle Pruner
 * Keeps the latest 2 evidence bundles and removes older ones to save disk space
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const KEEP_COUNT = 2; // Keep latest 2 evidence bundles
const ARTIFACTS_DIR = path.join(__dirname, '..', 'artifacts');

/**
 * Get file stats with error handling
 */
async function getFileStats(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return {
      path: filePath,
      mtime: stats.mtime,
      size: stats.size,
      exists: true
    };
  } catch (error) {
    return {
      path: filePath,
      exists: false,
      error: error.message
    };
  }
}

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Find evidence bundles in artifacts directory
 */
async function findEvidenceBundles() {
  try {
    const files = await fs.readdir(ARTIFACTS_DIR);

    // Find evidence pack files (both .zip and .manifest.json)
    const evidenceFiles = files.filter(file =>
      file.startsWith('evidence-pack-') &&
      (file.endsWith('.zip') || file.endsWith('.manifest.json'))
    );

    // Group by timestamp to keep related files together
    const bundles = new Map();

    for (const file of evidenceFiles) {
      // Extract timestamp from filename: evidence-pack-2025-09-28T11-32-43-820Z.zip
      const timestampMatch = file.match(/evidence-pack-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);

      if (timestampMatch) {
        const timestamp = timestampMatch[1];

        if (!bundles.has(timestamp)) {
          bundles.set(timestamp, {
            timestamp,
            files: [],
            totalSize: 0
          });
        }

        const filePath = path.join(ARTIFACTS_DIR, file);
        const stats = await getFileStats(filePath);

        if (stats.exists) {
          bundles.get(timestamp).files.push({
            name: file,
            path: filePath,
            size: stats.size,
            mtime: stats.mtime
          });
          bundles.get(timestamp).totalSize += stats.size;
        }
      }
    }

    return Array.from(bundles.values());
  } catch (error) {
    throw new Error(`Failed to scan artifacts directory: ${error.message}`);
  }
}

/**
 * Delete files safely
 */
async function deleteFiles(files) {
  const results = [];

  for (const file of files) {
    try {
      await fs.unlink(file.path);
      results.push({ file: file.name, success: true });
    } catch (error) {
      results.push({ file: file.name, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Main pruning function
 */
async function pruneEvidenceBundles() {
  console.log('🧹 Evidence Bundle Pruner');
  console.log('========================\n');

  console.log(`📁 Scanning: ${ARTIFACTS_DIR}`);
  console.log(`🔢 Keep count: ${KEEP_COUNT} latest bundles\n`);

  try {
    // Find all evidence bundles
    const bundles = await findEvidenceBundles();

    if (bundles.length === 0) {
      console.log('📄 No evidence bundles found');
      return;
    }

    // Sort by timestamp (newest first)
    bundles.sort((a, b) => new Date(b.timestamp.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, 'T$1:$2:$3.$4Z')) -
                        new Date(a.timestamp.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, 'T$1:$2:$3.$4Z')));

    console.log(`📊 Found ${bundles.length} evidence bundles:`);

    bundles.forEach((bundle, index) => {
      const status = index < KEEP_COUNT ? '✅ Keep' : '🗑️  Remove';
      const timestamp = bundle.timestamp.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, 'T$1:$2:$3.$4Z');
      console.log(`   ${status} ${timestamp} (${bundle.files.length} files, ${formatFileSize(bundle.totalSize)})`);
    });

    // Determine which bundles to remove
    const bundlesToRemove = bundles.slice(KEEP_COUNT);

    if (bundlesToRemove.length === 0) {
      console.log('\n✅ No pruning needed - within keep limit');
      return;
    }

    console.log(`\n🗑️  Removing ${bundlesToRemove.length} old bundles:`);

    let totalFilesRemoved = 0;
    let totalSizeFreed = 0;
    const allResults = [];

    for (const bundle of bundlesToRemove) {
      console.log(`\n   📦 Removing bundle ${bundle.timestamp}:`);

      const results = await deleteFiles(bundle.files);
      allResults.push(...results);

      for (const result of results) {
        if (result.success) {
          console.log(`      ✅ ${result.file}`);
          totalFilesRemoved++;
        } else {
          console.log(`      ❌ ${result.file}: ${result.error}`);
        }
      }

      totalSizeFreed += bundle.totalSize;
    }

    // Summary
    console.log('\n📊 Pruning Summary');
    console.log('=================');
    console.log(`🗑️  Files removed: ${totalFilesRemoved}`);
    console.log(`💾 Space freed: ${formatFileSize(totalSizeFreed)}`);
    console.log(`📦 Bundles kept: ${bundles.length - bundlesToRemove.length}`);

    const failedCount = allResults.filter(r => !r.success).length;
    if (failedCount > 0) {
      console.log(`⚠️  Failed deletions: ${failedCount}`);
    }

    console.log('\n✅ Evidence bundle pruning completed');

  } catch (error) {
    console.error(`❌ Pruning failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
Evidence Bundle Pruner

Usage:
  node scripts/evidence-prune.mjs [--help] [--dry-run]

Description:
  Removes old evidence bundles, keeping only the latest ${KEEP_COUNT} bundles.
  Scans artifacts/ directory for evidence-pack-* files.

Options:
  --help      Show this help message
  --dry-run   Show what would be removed without actually deleting

Examples:
  node scripts/evidence-prune.mjs
  node scripts/evidence-prune.mjs --dry-run

Files managed:
  • evidence-pack-YYYY-MM-DDTHH-MM-SS-sssZ.zip
  • evidence-pack-YYYY-MM-DDTHH-MM-SS-sssZ.manifest.json
`);
}

/**
 * Dry run mode
 */
async function dryRun() {
  console.log('🧹 Evidence Bundle Pruner (DRY RUN)');
  console.log('==================================\n');

  try {
    const bundles = await findEvidenceBundles();

    if (bundles.length === 0) {
      console.log('📄 No evidence bundles found');
      return;
    }

    bundles.sort((a, b) => new Date(b.timestamp.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, 'T$1:$2:$3.$4Z')) -
                        new Date(a.timestamp.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, 'T$1:$2:$3.$4Z')));

    const bundlesToRemove = bundles.slice(KEEP_COUNT);

    console.log(`📊 Would remove ${bundlesToRemove.length} old bundles:`);

    let totalSize = 0;
    let totalFiles = 0;

    bundlesToRemove.forEach(bundle => {
      console.log(`\n   🗑️  ${bundle.timestamp}:`);
      bundle.files.forEach(file => {
        console.log(`      - ${file.name} (${formatFileSize(file.size)})`);
        totalFiles++;
      });
      totalSize += bundle.totalSize;
    });

    console.log(`\n📊 Summary (dry run):`);
    console.log(`🗑️  Files that would be removed: ${totalFiles}`);
    console.log(`💾 Space that would be freed: ${formatFileSize(totalSize)}`);
    console.log(`📦 Bundles that would be kept: ${bundles.length - bundlesToRemove.length}`);

  } catch (error) {
    console.error(`❌ Dry run failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  if (args.includes('--dry-run')) {
    await dryRun();
    return;
  }

  await pruneEvidenceBundles();
}

main().catch(console.error);