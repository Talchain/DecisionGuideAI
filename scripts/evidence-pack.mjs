#!/usr/bin/env node
/**
 * Evidence Pack Generator
 * One-click evidence zip aggregating key artifacts for releases
 */

import { readFileSync, writeFileSync, existsSync, createReadStream, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use a simple zip implementation since we're avoiding external dependencies
class SimpleZip {
  constructor() {
    this.files = [];
    this.totalBytes = 0;
  }

  addFile(filePath, content) {
    if (typeof content === 'string') {
      content = Buffer.from(content, 'utf8');
    }
    this.files.push({
      path: filePath,
      content: content,
      size: content.length
    });
    this.totalBytes += content.length;
  }

  addFileFromDisk(diskPath, zipPath) {
    if (existsSync(diskPath)) {
      try {
        const content = readFileSync(diskPath);
        this.addFile(zipPath, content);
        return true;
      } catch (error) {
        console.warn(`Warning: Failed to read ${diskPath}: ${error.message}`);
        return false;
      }
    }
    return false;
  }

  // Simple zip creation (minimal implementation)
  async writeToFile(outputPath) {
    // For now, create a tar-like format since implementing full ZIP is complex
    // In a real implementation, you'd use a proper zip library
    const manifest = {
      created: new Date().toISOString(),
      total_files: this.files.length,
      total_bytes: this.totalBytes,
      files: this.files.map(f => ({
        path: f.path,
        size: f.size
      }))
    };

    // Create output directory if needed
    mkdirSync(dirname(outputPath), { recursive: true });

    // Write manifest
    writeFileSync(outputPath.replace('.zip', '.manifest.json'), JSON.stringify(manifest, null, 2));

    // Write a simple archive format (JSON-based for simplicity)
    const archive = {
      manifest,
      files: Object.fromEntries(
        this.files.map(f => [f.path, f.content.toString('base64')])
      )
    };

    writeFileSync(outputPath, JSON.stringify(archive, null, 2));
    console.log(`📦 Evidence pack created: ${outputPath}`);
    console.log(`   Files: ${this.files.length}`);
    console.log(`   Size: ${Math.round(this.totalBytes / 1024)}KB`);
  }
}

/**
 * Get current git information
 */
function getGitInfo() {
  try {
    const gitDir = join(process.cwd(), '.git');
    if (!existsSync(gitDir)) {
      return { error: 'Not a git repository' };
    }

    // Try to get current commit
    const headPath = join(gitDir, 'HEAD');
    if (existsSync(headPath)) {
      const headContent = readFileSync(headPath, 'utf8').trim();

      if (headContent.startsWith('ref: ')) {
        const refPath = headContent.substring(5);
        const refFile = join(gitDir, refPath);
        if (existsSync(refFile)) {
          const commit = readFileSync(refFile, 'utf8').trim();
          const branch = basename(refPath);
          return { branch, commit };
        }
      } else {
        // Detached HEAD
        return { branch: 'HEAD', commit: headContent };
      }
    }

    return { error: 'Could not determine git state' };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Get package.json information
 */
function getPackageInfo() {
  try {
    const packagePath = join(process.cwd(), 'package.json');
    if (existsSync(packagePath)) {
      const packageContent = JSON.parse(readFileSync(packagePath, 'utf8'));
      return {
        name: packageContent.name,
        version: packageContent.version,
        description: packageContent.description
      };
    }
    return { error: 'package.json not found' };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Collect pilot metrics if available
 */
function collectPilotMetrics() {
  const metricsPath = join(process.cwd(), 'artifacts', 'pilot-metrics.json');
  if (existsSync(metricsPath)) {
    try {
      return JSON.parse(readFileSync(metricsPath, 'utf8'));
    } catch (error) {
      return { error: `Failed to parse pilot metrics: ${error.message}` };
    }
  }
  return { error: 'Pilot metrics not available' };
}

/**
 * Collect recent snapshots summary
 */
function collectSnapshotsSummary() {
  const snapshotsDir = join(process.cwd(), 'artifacts', 'snapshots');
  if (!existsSync(snapshotsDir)) {
    return { error: 'Snapshots directory not found' };
  }

  try {
    const files = readdirSync(snapshotsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const filePath = join(snapshotsDir, f);
        const stats = statSync(filePath);
        return {
          filename: f,
          size: stats.size,
          modified: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())
      .slice(0, 10); // Last 10 snapshots

    return {
      total_snapshots: files.length,
      recent_snapshots: files,
      last_modified: files.length > 0 ? files[0].modified : null
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Collect synthetic monitoring results
 */
function collectSynthResults() {
  const synthPaths = [
    join(process.cwd(), 'artifacts', 'synth', 'synth-latest.json'),
    join(process.cwd(), 'artifacts', 'monitoring', 'latest.json')
  ];

  for (const synthPath of synthPaths) {
    if (existsSync(synthPath)) {
      try {
        return JSON.parse(readFileSync(synthPath, 'utf8'));
      } catch (error) {
        continue;
      }
    }
  }

  return { error: 'Synthetic monitoring results not available' };
}

/**
 * Collect system information
 */
function collectSystemInfo() {
  return {
    node_version: process.version,
    platform: process.platform,
    arch: process.arch,
    memory_usage: process.memoryUsage(),
    uptime: process.uptime(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      OPS_CONSOLE_ENABLE: process.env.OPS_CONSOLE_ENABLE,
      SCHEMA_VALIDATION_DISABLE: process.env.SCHEMA_VALIDATION_DISABLE
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate evidence manifest
 */
function generateEvidenceManifest() {
  const gitInfo = getGitInfo();
  const packageInfo = getPackageInfo();
  const pilotMetrics = collectPilotMetrics();
  const snapshotsSummary = collectSnapshotsSummary();
  const synthResults = collectSynthResults();
  const systemInfo = collectSystemInfo();

  return {
    schema: 'evidence-pack.v1',
    generated: new Date().toISOString(),
    generator: 'scripts/evidence-pack.mjs',

    project: packageInfo,
    git: gitInfo,
    system: systemInfo,

    components: {
      pilot_metrics: pilotMetrics,
      snapshots_summary: snapshotsSummary,
      synthetic_monitoring: synthResults
    },

    included_files: [
      'artifacts/config-lint.json',
      'artifacts/config-lint.md',
      'artifacts/determinism-check.json',
      'artifacts/integration-scorecard.json',
      'artifacts/integration-scorecard.html',
      'artifacts/reports/artefact-scan.md',
      'package.json',
      'README.md',
      'docs/OPERATOR_HANDBOOK.md'
    ]
  };
}

/**
 * Main evidence pack generation
 */
async function generateEvidencePack() {
  console.log('📋 Generating evidence pack...');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = join(process.cwd(), 'artifacts', `evidence-pack-${timestamp}.zip`);

  const zip = new SimpleZip();
  const manifest = generateEvidenceManifest();

  // Add manifest
  zip.addFile('evidence-manifest.json', JSON.stringify(manifest, null, 2));

  // Add key files from artifacts
  const artifactFiles = [
    'config-lint.json',
    'config-lint.md',
    'determinism-check.json',
    'integration-scorecard.json',
    'integration-scorecard.html',
    'integration-scorecard.md',
    'reports/artefact-scan.md',
    'start-here.html'
  ];

  for (const file of artifactFiles) {
    const fullPath = join(process.cwd(), 'artifacts', file);
    zip.addFileFromDisk(fullPath, `artifacts/${file}`);
  }

  // Add root files
  const rootFiles = [
    'package.json',
    'README.md'
  ];

  for (const file of rootFiles) {
    const fullPath = join(process.cwd(), file);
    zip.addFileFromDisk(fullPath, file);
  }

  // Add documentation
  const docFiles = [
    'docs/OPERATOR_HANDBOOK.md',
    'docs/GO-NO-GO.md'
  ];

  for (const file of docFiles) {
    const fullPath = join(process.cwd(), file);
    zip.addFileFromDisk(fullPath, file);
  }

  // Add ops console documentation if available
  zip.addFileFromDisk(
    join(process.cwd(), 'artifacts', 'ops', 'ops-console.md'),
    'artifacts/ops/ops-console.md'
  );

  // Add pilot metrics if available
  zip.addFileFromDisk(
    join(process.cwd(), 'artifacts', 'pilot-metrics.json'),
    'artifacts/pilot-metrics.json'
  );

  // Add latest synthetic results if available
  const synthPaths = [
    'artifacts/synth/synth-latest.json',
    'artifacts/monitoring/latest.json'
  ];

  for (const synthPath of synthPaths) {
    const fullPath = join(process.cwd(), synthPath);
    if (zip.addFileFromDisk(fullPath, synthPath)) {
      break; // Only add the first one found
    }
  }

  // Add recent snapshots (up to 5)
  const snapshotsDir = join(process.cwd(), 'artifacts', 'snapshots');
  if (existsSync(snapshotsDir)) {
    try {
      const snapshotFiles = readdirSync(snapshotsDir)
        .filter(f => f.endsWith('.json'))
        .sort()
        .slice(-5); // Last 5 snapshots

      for (const snapshot of snapshotFiles) {
        const fullPath = join(snapshotsDir, snapshot);
        zip.addFileFromDisk(fullPath, `artifacts/snapshots/${snapshot}`);
      }
    } catch (error) {
      console.warn(`Warning: Could not read snapshots directory: ${error.message}`);
    }
  }

  // Write the evidence pack
  await zip.writeToFile(outputFile);

  // Also create a summary report
  const summaryPath = join(process.cwd(), 'artifacts', `evidence-summary-${timestamp}.md`);
  const summary = generateSummaryReport(manifest);
  writeFileSync(summaryPath, summary);

  console.log(`📄 Evidence summary: ${summaryPath}`);
  console.log('✅ Evidence pack generation complete');

  return {
    evidence_pack: outputFile,
    evidence_summary: summaryPath,
    manifest
  };
}

/**
 * Generate markdown summary report
 */
function generateSummaryReport(manifest) {
  const git = manifest.git;
  const pkg = manifest.project;
  const sys = manifest.system;
  const pilot = manifest.components.pilot_metrics;
  const snapshots = manifest.components.snapshots_summary;
  const synth = manifest.components.synthetic_monitoring;

  return `# Evidence Pack Summary

Generated: ${manifest.generated}

## Project Information

- **Name**: ${pkg.name || 'Unknown'}
- **Version**: ${pkg.version || 'Unknown'}
- **Description**: ${pkg.description || 'No description'}

## Git Information

- **Branch**: ${git.branch || 'Unknown'}
- **Commit**: ${git.commit || 'Unknown'}
- **Status**: ${git.error ? `Error: ${git.error}` : 'Clean'}

## System Information

- **Node.js**: ${sys.node_version}
- **Platform**: ${sys.platform} (${sys.arch})
- **Environment**: ${sys.env.NODE_ENV || 'development'}
- **Memory Usage**: ${Math.round(sys.memory_usage.heapUsed / 1024 / 1024)}MB heap used

## Components Status

### Pilot Metrics
${pilot.error ? `❌ ${pilot.error}` : '✅ Available'}

### Snapshots
${snapshots.error ? `❌ ${snapshots.error}` : `✅ ${snapshots.total_snapshots} snapshots available`}

### Synthetic Monitoring
${synth.error ? `❌ ${synth.error}` : `✅ Status: ${synth.status} (${synth.checks_passed}/${synth.checks_total} checks passed)`}

## Included Files

${manifest.included_files.map(f => `- ${f}`).join('\n')}

## Feature Status

- **Ops Console**: ${sys.env.OPS_CONSOLE_ENABLE === '1' ? '✅ Enabled' : '❌ Disabled'}
- **Schema Validation**: ${sys.env.SCHEMA_VALIDATION_DISABLE === '1' ? '❌ Disabled' : '✅ Enabled'}

---

*This evidence pack was generated automatically by \`scripts/evidence-pack.mjs\`*
`;
}

/**
 * Main execution
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  generateEvidencePack().catch(error => {
    console.error('❌ Evidence pack generation failed:', error);
    process.exit(1);
  });
}