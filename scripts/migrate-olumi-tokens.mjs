#!/usr/bin/env node
/**
 * Automated migration script for legacy --olumi-* tokens to Olumi v1.2
 *
 * Usage: node scripts/migrate-olumi-tokens.mjs
 *
 * This script performs bulk find-and-replace across all source files.
 * Review changes before committing!
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Token mapping from LEGACY_TOKEN_MIGRATION.md
const TOKEN_MAPPINGS = {
  // Primary/Interactive colors
  "var(--olumi-primary, #5B6CFF)": "var(--semantic-info, #63ADCF)",
  "var(--olumi-primary)": "var(--semantic-info)",
  "var(--olumi-primary-600, #4256F6)": "var(--info-hover, #73B5D9)",
  "var(--olumi-primary-600)": "var(--info-hover)",
  "var(--olumi-primary-700)": "var(--info-active)",

  // Status colors
  "var(--olumi-success, #4CAF50)": "var(--semantic-success, #67C89E)",
  "var(--olumi-success, #20C997)": "var(--semantic-success, #67C89E)",
  "var(--olumi-success)": "var(--semantic-success)",
  "var(--olumi-warning, #F7C948)": "var(--semantic-warning, #F5C433)",
  "var(--olumi-warning)": "var(--semantic-warning)",
  "var(--olumi-danger)": "var(--semantic-danger)",
  "var(--olumi-info)": "var(--semantic-info)",

  // Text colors
  "var(--olumi-text, #E8ECF5)": "var(--text-primary, #262626)",
  "var(--olumi-text)": "var(--text-primary)",
  "var(--olumi-text')": "var(--text-primary)",  // Malformed quote
  "var(--olumi-text-strong, #000)": "var(--text-primary, #262626)",
  "var(--olumi-text-muted)": "var(--text-secondary)",

  // Background colors
  "var(--olumi-bg, #0E1116)": "var(--surface-card, #FEF9F3)",
  "var(--olumi-bg)": "var(--surface-card)",
  "var(--olumi-bg')": "var(--surface-card)",  // Malformed quote
  "var(--olumi-surface)": "var(--surface-card)",

  // Other tokens
  "var(--olumi-border)": "var(--surface-border)",
  "var(--olumi-elev-1)": "var(--shadow-1)",
  "var(--olumi-shadow)": "var(--shadow-1)",
  "var(--olumi-radius)": "var(--radius-md)",
  "var(--olumi-hover)": "var(--info-hover)",
  "var(--olumi-focus)": "var(--focus-color)",

  // RGB fallbacks (match old primary blue)
  "rgba(91,108,255,0.1)": "rgba(99,173,207,0.1)",  // info with alpha
  "rgba(91, 108, 255, 0.1)": "rgba(99, 173, 207, 0.1)",

  // RGB fallbacks (match old success green)
  "rgba(76, 175, 80, 0.1)": "rgba(103, 200, 158, 0.1)",  // success with alpha

  // RGB fallbacks (match old warning yellow)
  "rgba(247, 201, 72, 0.1)": "rgba(245, 196, 51, 0.1)",  // warning with alpha
};

function getAllFiles(dir, fileList = []) {
  const files = readdirSync(dir);

  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules, dist, build
      if (!['node_modules', 'dist', 'build', '.git'].includes(file)) {
        getAllFiles(filePath, fileList);
      }
    } else if (file.match(/\.(tsx|ts|css)$/)) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

function migrateFile(filePath) {
  let content = readFileSync(filePath, 'utf8');
  let changesMade = 0;

  // Apply all token mappings
  for (const [oldToken, newToken] of Object.entries(TOKEN_MAPPINGS)) {
    const regex = new RegExp(oldToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = content.match(regex);
    if (matches) {
      changesMade += matches.length;
      content = content.replace(regex, newToken);
    }
  }

  if (changesMade > 0) {
    writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${filePath}: ${changesMade} tokens migrated`);
    return changesMade;
  }

  return 0;
}

// Main execution
console.log('🚀 Starting Olumi token migration...\n');

const srcFiles = getAllFiles('./src');
let totalChanges = 0;
let filesModified = 0;

for (const file of srcFiles) {
  const changes = migrateFile(file);
  if (changes > 0) {
    totalChanges += changes;
    filesModified++;
  }
}

console.log(`\n✨ Migration complete!`);
console.log(`📊 Files modified: ${filesModified}`);
console.log(`🔄 Total tokens migrated: ${totalChanges}`);
console.log(`\n⚠️  Please review changes before committing!`);
console.log(`Run: git diff src/`);
