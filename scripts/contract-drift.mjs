#!/usr/bin/env node

/**
 * contract-drift.mjs
 * Diff current OpenAPI and schema stamps against last release artifacts
 * Exit non-zero on breaking changes (additive is OK)
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/**
 * Read JSON file safely
 */
async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Find all schema files in project
 */
async function findSchemaFiles(dir, extensions = ['.json', '.yaml', '.yml']) {
  const files = [];

  async function scan(currentDir) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          // Skip node_modules and hidden directories
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scan(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.includes(ext)) {
            // Look for schema-related files
            const fileName = entry.name.toLowerCase();
            if (fileName.includes('schema') || fileName.includes('openapi') ||
                fileName.includes('api') || fileName.includes('contract')) {
              files.push({
                path: fullPath,
                relative: path.relative(projectRoot, fullPath),
                name: entry.name
              });
            }
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  await scan(dir);
  return files;
}

/**
 * Extract schema stamps from code files
 */
async function extractSchemaStamps() {
  const stamps = new Set();

  // Common patterns for schema stamps
  const patterns = [
    /"schema":\s*"([^"]+)"/g,
    /schema:\s*['"]([^'"]+)['"]/g,
    /\.v\d+['"]?/g
  ];

  async function scanFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          if (match[1]) {
            stamps.add(match[1]);
          } else if (match[0]) {
            stamps.add(match[0].replace(/['"]?$/, ''));
          }
        }
      }
    } catch (error) {
      // Skip files we can't read
    }
  }

  // Scan TypeScript and JavaScript files
  const codeExtensions = ['.ts', '.js', '.tsx', '.jsx'];
  const codeFiles = await findSchemaFiles(path.join(projectRoot, 'src'), codeExtensions);

  for (const file of codeFiles) {
    await scanFile(file.path);
  }

  return Array.from(stamps).sort();
}

/**
 * Compare two objects deeply and categorize changes
 */
function categorizeChanges(oldObj, newObj, path = '') {
  const changes = {
    breaking: [],
    additive: [],
    modifications: []
  };

  if (typeof oldObj !== typeof newObj) {
    changes.breaking.push({
      type: 'type_change',
      path: path,
      old: typeof oldObj,
      new: typeof newObj
    });
    return changes;
  }

  if (oldObj === null || newObj === null) {
    if (oldObj !== newObj) {
      if (oldObj !== null && newObj === null) {
        changes.breaking.push({
          type: 'removed',
          path: path,
          old: oldObj
        });
      } else {
        changes.additive.push({
          type: 'added',
          path: path,
          new: newObj
        });
      }
    }
    return changes;
  }

  if (typeof oldObj !== 'object') {
    if (oldObj !== newObj) {
      changes.modifications.push({
        type: 'value_change',
        path: path,
        old: oldObj,
        new: newObj
      });
    }
    return changes;
  }

  if (Array.isArray(oldObj) !== Array.isArray(newObj)) {
    changes.breaking.push({
      type: 'structure_change',
      path: path,
      old: Array.isArray(oldObj) ? 'array' : 'object',
      new: Array.isArray(newObj) ? 'array' : 'object'
    });
    return changes;
  }

  if (Array.isArray(oldObj)) {
    // For arrays, check if items were removed (breaking) or added (additive)
    if (oldObj.length > newObj.length) {
      changes.breaking.push({
        type: 'array_items_removed',
        path: path,
        old: oldObj.length,
        new: newObj.length
      });
    } else if (newObj.length > oldObj.length) {
      changes.additive.push({
        type: 'array_items_added',
        path: path,
        old: oldObj.length,
        new: newObj.length
      });
    }

    // Compare existing items
    const minLength = Math.min(oldObj.length, newObj.length);
    for (let i = 0; i < minLength; i++) {
      const itemChanges = categorizeChanges(oldObj[i], newObj[i], `${path}[${i}]`);
      changes.breaking.push(...itemChanges.breaking);
      changes.additive.push(...itemChanges.additive);
      changes.modifications.push(...itemChanges.modifications);
    }
  } else {
    // For objects, check properties
    const oldKeys = Object.keys(oldObj);
    const newKeys = Object.keys(newObj);

    // Removed properties are breaking
    for (const key of oldKeys) {
      if (!(key in newObj)) {
        changes.breaking.push({
          type: 'property_removed',
          path: path ? `${path}.${key}` : key,
          old: oldObj[key]
        });
      }
    }

    // Added properties are additive
    for (const key of newKeys) {
      if (!(key in oldObj)) {
        changes.additive.push({
          type: 'property_added',
          path: path ? `${path}.${key}` : key,
          new: newObj[key]
        });
      }
    }

    // Modified properties
    for (const key of oldKeys) {
      if (key in newObj) {
        const propChanges = categorizeChanges(oldObj[key], newObj[key], path ? `${path}.${key}` : key);
        changes.breaking.push(...propChanges.breaking);
        changes.additive.push(...propChanges.additive);
        changes.modifications.push(...propChanges.modifications);
      }
    }
  }

  return changes;
}

/**
 * Check OpenAPI contract changes
 */
async function checkOpenApiChanges() {
  const currentOpenApiPath = path.join(projectRoot, 'artifacts', 'openapi.yaml');
  const lastReleaseOpenApiPath = path.join(projectRoot, 'artifacts', 'release', 'openapi.yaml');

  const [currentApi, lastReleaseApi] = await Promise.all([
    readJsonFile(currentOpenApiPath),
    readJsonFile(lastReleaseOpenApiPath)
  ]);

  if (!currentApi) {
    return {
      error: 'Current OpenAPI file not found',
      changes: { breaking: [], additive: [], modifications: [] }
    };
  }

  if (!lastReleaseApi) {
    return {
      info: 'No baseline OpenAPI found - this may be the first release',
      changes: { breaking: [], additive: [], modifications: [] }
    };
  }

  const changes = categorizeChanges(lastReleaseApi, currentApi);

  return {
    info: 'OpenAPI comparison completed',
    changes: changes
  };
}

/**
 * Check schema stamp changes
 */
async function checkSchemaStampChanges() {
  const currentStamps = await extractSchemaStamps();

  const lastReleaseStampsPath = path.join(projectRoot, 'artifacts', 'release', 'schema-stamps.json');
  const lastReleaseStampsData = await readJsonFile(lastReleaseStampsPath);
  const lastReleaseStamps = lastReleaseStampsData?.stamps || [];

  const changes = {
    breaking: [],
    additive: [],
    modifications: []
  };

  // Check for removed schema stamps (breaking)
  for (const stamp of lastReleaseStamps) {
    if (!currentStamps.includes(stamp)) {
      changes.breaking.push({
        type: 'schema_removed',
        path: 'schema_stamps',
        old: stamp
      });
    }
  }

  // Check for added schema stamps (additive)
  for (const stamp of currentStamps) {
    if (!lastReleaseStamps.includes(stamp)) {
      changes.additive.push({
        type: 'schema_added',
        path: 'schema_stamps',
        new: stamp
      });
    }
  }

  return {
    info: `Found ${currentStamps.length} schema stamps (baseline: ${lastReleaseStamps.length})`,
    changes: changes,
    currentStamps: currentStamps
  };
}

/**
 * Generate human-readable drift report
 */
function generateDriftReport(openApiResult, schemaResult) {
  const allChanges = {
    breaking: [...openApiResult.changes.breaking, ...schemaResult.changes.breaking],
    additive: [...openApiResult.changes.additive, ...schemaResult.changes.additive],
    modifications: [...openApiResult.changes.modifications, ...schemaResult.changes.modifications]
  };

  const hasBreaking = allChanges.breaking.length > 0;
  const hasChanges = allChanges.breaking.length + allChanges.additive.length + allChanges.modifications.length > 0;

  let report = `# Contract Drift Report

**Generated:** ${new Date().toISOString()}
**Status:** ${hasBreaking ? '❌ BREAKING CHANGES DETECTED' : hasChanges ? '✅ SAFE CHANGES DETECTED' : '✅ NO CHANGES'}

## Summary

- **Breaking Changes:** ${allChanges.breaking.length}
- **Additive Changes:** ${allChanges.additive.length}
- **Modifications:** ${allChanges.modifications.length}

`;

  if (openApiResult.error) {
    report += `## OpenAPI Analysis

❌ **Error:** ${openApiResult.error}

`;
  } else if (openApiResult.info) {
    report += `## OpenAPI Analysis

ℹ️  ${openApiResult.info}

`;
  }

  if (schemaResult.info) {
    report += `## Schema Stamps Analysis

ℹ️  ${schemaResult.info}

`;
  }

  if (allChanges.breaking.length > 0) {
    report += `## ❌ Breaking Changes

These changes may break existing clients and require careful review:

`;
    for (const change of allChanges.breaking) {
      report += `- **${change.type}** at \`${change.path}\``;
      if (change.old !== undefined) report += ` (was: ${JSON.stringify(change.old)})`;
      if (change.new !== undefined) report += ` (now: ${JSON.stringify(change.new)})`;
      report += '\n';
    }
    report += '\n';
  }

  if (allChanges.additive.length > 0) {
    report += `## ✅ Additive Changes

These are safe additions that should not break existing clients:

`;
    for (const change of allChanges.additive) {
      report += `- **${change.type}** at \`${change.path}\``;
      if (change.new !== undefined) report += ` (added: ${JSON.stringify(change.new)})`;
      report += '\n';
    }
    report += '\n';
  }

  if (allChanges.modifications.length > 0) {
    report += `## ⚠️  Modifications

These changes modify existing values and should be reviewed:

`;
    for (const change of allChanges.modifications) {
      report += `- **${change.type}** at \`${change.path}\``;
      if (change.old !== undefined && change.new !== undefined) {
        report += ` (${JSON.stringify(change.old)} → ${JSON.stringify(change.new)})`;
      }
      report += '\n';
    }
    report += '\n';
  }

  if (!hasChanges) {
    report += `## No Changes Detected

The contracts appear to be stable since the last release.

`;
  }

  report += `## Recommendations

`;

  if (hasBreaking) {
    report += `**Breaking changes detected!** Before proceeding:

1. Review all breaking changes listed above
2. Ensure proper versioning strategy (major version bump)
3. Communicate changes to API consumers
4. Consider backwards compatibility options
5. Update migration guides and documentation

`;
  } else if (hasChanges) {
    report += `**Safe changes detected.** These appear to be additive or non-breaking:

1. Review additive changes for completeness
2. Update API documentation if needed
3. Consider minor version bump for new features
4. Test with existing clients to verify compatibility

`;
  } else {
    report += `**No changes detected.** The contracts are stable:

1. No action required for contract compatibility
2. Consider patch version bump if other changes exist
3. Contracts remain stable for existing clients

`;
  }

  return report;
}

/**
 * Save current state as baseline for future comparisons
 */
async function saveCurrentBaseline(schemaResult) {
  const baselineDir = path.join(projectRoot, 'artifacts', 'contract-baseline');
  await fs.mkdir(baselineDir, { recursive: true });

  // Save schema stamps
  const schemaStampsData = {
    timestamp: new Date().toISOString(),
    stamps: schemaResult.currentStamps
  };

  await fs.writeFile(
    path.join(baselineDir, 'schema-stamps.json'),
    JSON.stringify(schemaStampsData, null, 2)
  );

  // Copy current OpenAPI as baseline
  try {
    const currentOpenApiPath = path.join(projectRoot, 'artifacts', 'openapi.yaml');
    const baselineOpenApiPath = path.join(baselineDir, 'openapi.yaml');

    const openApiContent = await fs.readFile(currentOpenApiPath);
    await fs.writeFile(baselineOpenApiPath, openApiContent);
  } catch (error) {
    // OpenAPI file might not exist
  }

  console.log(`📁 Baseline saved to artifacts/contract-baseline/`);
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Checking Contract Drift...');

  try {
    // Run checks in parallel
    const [openApiResult, schemaResult] = await Promise.all([
      checkOpenApiChanges(),
      checkSchemaStampChanges()
    ]);

    // Generate report
    const report = generateDriftReport(openApiResult, schemaResult);

    // Save reports
    const reportsDir = path.join(projectRoot, 'artifacts', 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const reportPath = path.join(reportsDir, 'contract-drift.md');
    await fs.writeFile(reportPath, report);

    // Print summary
    const breaking = openApiResult.changes.breaking.length + schemaResult.changes.breaking.length;
    const additive = openApiResult.changes.additive.length + schemaResult.changes.additive.length;
    const modifications = openApiResult.changes.modifications.length + schemaResult.changes.modifications.length;

    console.log(`\n📊 CONTRACT DRIFT ANALYSIS COMPLETE`);
    console.log(`❌ Breaking changes: ${breaking}`);
    console.log(`✅ Additive changes: ${additive}`);
    console.log(`⚠️  Modifications: ${modifications}`);
    console.log(`📄 Report: ${reportPath}`);

    // Save baseline for next comparison
    await saveCurrentBaseline(schemaResult);

    // Exit with appropriate code
    if (breaking > 0) {
      console.log(`\n💥 BREAKING CHANGES DETECTED - Review required before release!`);
      process.exit(1);
    } else if (additive + modifications > 0) {
      console.log(`\n✅ Safe changes detected - Ready for release`);
      process.exit(0);
    } else {
      console.log(`\n🎯 No contract changes - Stable for release`);
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Contract drift check failed:', error.message);
    process.exit(2);
  }
}

main();