#!/usr/bin/env tsx

/**
 * Flags Snapshot Tool
 * Captures current state of all feature flags and safety controls
 * Advisory mode: warns if powerful features are ON, but does not block
 */

import * as fs from 'fs';
import * as path from 'path';

interface FlagSnapshot {
  timestamp: string;
  branch: string;
  commit: string;
  flags: Record<string, any>;
  violations: string[];
  advisory: string[];
}

// Expected safe defaults for pilot mode
const SAFE_DEFAULTS = {
  ENABLE_RATE_LIMITING: false,
  ENABLE_CACHE: false,
  ENABLE_USAGE_TRACKING: false,
  ENABLE_MONITORING: false,
  ENABLE_SECRET_HYGIENE_BLOCKING: false,
  ENABLE_SLOS: false,
  USE_MOCK_DATA: true,
  ENABLE_SEED_ECHO: true,
};

async function getCurrentBranch(): Promise<string> {
  try {
    const { execSync } = await import('child_process');
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

async function getCurrentCommit(): Promise<string> {
  try {
    const { execSync } = await import('child_process');
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim().substring(0, 8);
  } catch {
    return 'unknown';
  }
}

async function scanForFlags(directory: string): Promise<Record<string, any>> {
  const flags: Record<string, any> = {};

  // Search for configuration patterns in source files
  const searchPaths = [
    'src/**/*.ts',
    'tools/**/*.ts',
    '*.config.js',
    'package.json'
  ];

  try {
    const { glob } = await import('glob');

    for (const pattern of searchPaths) {
      const files = glob.sync(pattern, { cwd: directory });

      for (const file of files) {
        const fullPath = path.join(directory, file);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');

          // Look for config objects and flag patterns
          const configMatches = content.match(/(?:config|Config|FLAGS)\s*[=:]\s*\{[^}]*\}/gs);
          if (configMatches) {
            for (const match of configMatches) {
              // Extract flag-like properties
              const flagMatches = match.match(/(\w+):\s*(true|false|'[^']*'|"[^"]*"|\d+)/g);
              if (flagMatches) {
                for (const flagMatch of flagMatches) {
                  const [key, value] = flagMatch.split(':').map(s => s.trim());
                  if (key.toUpperCase().includes('ENABLE') || key.toUpperCase().includes('USE_') || key.toUpperCase().includes('DISABLE')) {
                    flags[key] = value === 'true' ? true : value === 'false' ? false : value.replace(/['"]/g, '');
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('Warning: Could not scan all files for flags');
  }

  return flags;
}

function analyzeFlags(flags: Record<string, any>): { violations: string[], advisory: string[] } {
  const violations: string[] = [];
  const advisory: string[] = [];

  // Check against safe defaults
  for (const [key, expectedValue] of Object.entries(SAFE_DEFAULTS)) {
    const actualValue = flags[key];

    if (actualValue !== undefined && actualValue !== expectedValue) {
      if (expectedValue === false && actualValue === true) {
        violations.push(`DANGER: ${key} is ON (should be OFF for pilot mode)`);
      } else if (expectedValue === true && actualValue === false) {
        advisory.push(`Notice: ${key} is OFF (expected ON for simulation mode)`);
      } else {
        advisory.push(`Notice: ${key} = ${actualValue} (expected ${expectedValue})`);
      }
    }
  }

  // Look for potentially dangerous flags
  for (const [key, value] of Object.entries(flags)) {
    if (value === true) {
      if (key.includes('PRODUCTION') || key.includes('LIVE') || key.includes('REAL')) {
        violations.push(`DANGER: ${key} is enabled (production-like flag)`);
      }
      if (key.includes('DELETE') || key.includes('DESTROY') || key.includes('PURGE')) {
        violations.push(`DANGER: ${key} is enabled (destructive operation)`);
      }
      if (key.includes('TRACKING') || key.includes('ANALYTICS') || key.includes('TELEMETRY')) {
        advisory.push(`Advisory: ${key} is enabled (data collection flag)`);
      }
    }
  }

  return { violations, advisory };
}

async function generateSnapshot(): Promise<FlagSnapshot> {
  const timestamp = new Date().toISOString();
  const branch = await getCurrentBranch();
  const commit = await getCurrentCommit();
  const flags = await scanForFlags(process.cwd());
  const { violations, advisory } = analyzeFlags(flags);

  return {
    timestamp,
    branch,
    commit,
    flags,
    violations,
    advisory
  };
}

function formatOutput(snapshot: FlagSnapshot): string {
  let output = `# Flags Snapshot Report\n\n`;
  output += `**Generated**: ${snapshot.timestamp}\n`;
  output += `**Branch**: ${snapshot.branch}\n`;
  output += `**Commit**: ${snapshot.commit}\n\n`;

  if (snapshot.violations.length > 0) {
    output += `## 🚨 VIOLATIONS (Action Required)\n\n`;
    for (const violation of snapshot.violations) {
      output += `- ❌ ${violation}\n`;
    }
    output += `\n`;
  }

  if (snapshot.advisory.length > 0) {
    output += `## ⚠️ ADVISORY NOTICES\n\n`;
    for (const notice of snapshot.advisory) {
      output += `- ⚠️ ${notice}\n`;
    }
    output += `\n`;
  }

  if (snapshot.violations.length === 0 && snapshot.advisory.length === 0) {
    output += `## ✅ ALL CLEAR\n\nNo flag violations detected. System appears to be in safe pilot mode.\n\n`;
  }

  output += `## 📊 All Detected Flags\n\n`;
  const sortedFlags = Object.entries(snapshot.flags).sort();
  for (const [key, value] of sortedFlags) {
    const icon = value === true ? '🟢' : value === false ? '🔴' : '📝';
    output += `- ${icon} **${key}**: \`${value}\`\n`;
  }

  if (sortedFlags.length === 0) {
    output += `*No configuration flags detected in codebase.*\n`;
  }

  output += `\n---\n\n`;
  output += `**Advisory Mode**: This tool warns about potentially unsafe configurations but does not block operations.\n`;
  output += `**Safe Defaults**: All powerful features should be OFF by default in pilot mode.\n`;

  return output;
}

async function main() {
  try {
    console.log('🔍 Scanning for feature flags and safety controls...');

    const snapshot = await generateSnapshot();
    const output = formatOutput(snapshot);

    // Write to artifacts directory
    const outputPath = path.join(process.cwd(), 'artifacts', 'flags-snapshot.md');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, output);

    // Also save JSON for CI tools
    const jsonPath = path.join(process.cwd(), 'artifacts', 'flags-snapshot.json');
    fs.writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2));

    console.log(`📄 Report saved to: ${outputPath}`);
    console.log(`📄 JSON data saved to: ${jsonPath}`);

    // Exit codes for CI
    if (snapshot.violations.length > 0) {
      console.log(`\n🚨 ${snapshot.violations.length} VIOLATION(S) DETECTED`);
      console.log('Advisory mode: continuing anyway (set EXIT_ON_VIOLATIONS=true to block)');

      if (process.env.EXIT_ON_VIOLATIONS === 'true') {
        process.exit(1);
      }
    }

    if (snapshot.advisory.length > 0) {
      console.log(`\n⚠️ ${snapshot.advisory.length} advisory notice(s)`);
    }

    if (snapshot.violations.length === 0 && snapshot.advisory.length === 0) {
      console.log('\n✅ All clear - no flag violations detected');
    }

  } catch (error) {
    console.error('❌ Error generating flags snapshot:', error);
    process.exit(1);
  }
}

// ES module entry point check
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateSnapshot, analyzeFlags, SAFE_DEFAULTS };