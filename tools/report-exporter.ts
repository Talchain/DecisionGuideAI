#!/usr/bin/env tsx

import { readFile, writeFile } from 'fs/promises';
import { resolve, extname, basename, dirname } from 'path';
import { mkdirSync } from 'fs';
import type { ReportV1 } from '../src/lib/runReportV1.js';

interface ExportOptions {
  input: string;
  output?: string;
  format: 'csv' | 'json' | 'md' | 'txt';
  includeSteps: boolean;
  includeMeta: boolean;
  quiet: boolean;
}

interface ExportResult {
  format: string;
  outputPath: string;
  size: number;
  success: boolean;
}

async function loadReport(inputPath: string): Promise<ReportV1> {
  try {
    const content = await readFile(inputPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load report from ${inputPath}: ${(error as Error).message}`);
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toISOString();
}

async function exportToCsv(report: ReportV1, includeSteps: boolean): Promise<string> {
  let csv = '';

  // Header with meta information
  csv += 'Report Export,CSV Format\n';
  csv += `Generated,${new Date().toISOString()}\n`;
  csv += `Duration,${formatDuration(report.meta.duration)}\n`;
  csv += `Status,${report.meta.status}\n`;
  csv += `Model,${report.meta.model || 'Unknown'}\n`;
  csv += `Seed,${report.meta.seed}\n`;
  csv += `Total Tokens,${report.totals.totalTokens}\n`;
  csv += `Total Cost,${formatCost(report.totals.totalCost)}\n`;
  csv += `Total Steps,${report.totals.totalSteps}\n`;
  csv += '\n';

  if (includeSteps && report.steps.length > 0) {
    csv += 'Steps Data\n';
    csv += 'Step ID,Type,Start Time,End Time,Duration,Status,Tokens,Cost\n';

    for (const step of report.steps) {
      csv += [
        step.id,
        step.type,
        step.startTime,
        step.endTime,
        step.duration,
        step.status,
        step.tokens || 0,
        step.cost || 0
      ].map(val => `"${val}"`).join(',') + '\n';
    }
  }

  return csv;
}

async function exportToMarkdown(report: ReportV1, includeSteps: boolean): Promise<string> {
  let md = '';

  md += `# Report Export\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n\n`;

  // Meta section
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|---------|\n`;
  md += `| Duration | ${formatDuration(report.meta.duration)} |\n`;
  md += `| Status | ${report.meta.status} |\n`;
  md += `| Model | ${report.meta.model || 'Unknown'} |\n`;
  md += `| Seed | ${report.meta.seed} |\n`;
  md += `| Total Tokens | ${report.totals.totalTokens.toLocaleString()} |\n`;
  md += `| Total Cost | ${formatCost(report.totals.totalCost)} |\n`;
  md += `| Total Steps | ${report.totals.totalSteps} |\n`;
  md += `| Completed Steps | ${report.totals.completedSteps} |\n`;
  md += '\n';

  if (includeSteps && report.steps.length > 0) {
    md += `## Step Details\n\n`;
    md += `| ID | Type | Duration | Status | Tokens | Cost |\n`;
    md += `|----|------|----------|--------|--------|---------|\n`;

    for (const step of report.steps) {
      md += `| ${step.id} | ${step.type} | ${formatDuration(step.duration)} | ${step.status} | ${step.tokens || 0} | ${formatCost(step.cost || 0)} |\n`;
    }
    md += '\n';
  }

  return md;
}

async function exportToText(report: ReportV1, includeSteps: boolean): Promise<string> {
  let text = '';

  text += `REPORT EXPORT\n`;
  text += `=============\n\n`;
  text += `Generated: ${new Date().toISOString()}\n\n`;

  // Meta section
  text += `SUMMARY\n`;
  text += `-------\n`;
  text += `Duration:       ${formatDuration(report.meta.duration)}\n`;
  text += `Status:         ${report.meta.status}\n`;
  text += `Model:          ${report.meta.model || 'Unknown'}\n`;
  text += `Seed:           ${report.meta.seed}\n`;
  text += `Total Tokens:   ${report.totals.totalTokens.toLocaleString()}\n`;
  text += `Total Cost:     ${formatCost(report.totals.totalCost)}\n`;
  text += `Total Steps:    ${report.totals.totalSteps}\n`;
  text += `Completed:      ${report.totals.completedSteps}\n`;
  text += '\n';

  if (includeSteps && report.steps.length > 0) {
    text += `STEP DETAILS\n`;
    text += `------------\n`;

    for (const step of report.steps) {
      text += `Step ${step.id}:\n`;
      text += `  Type:     ${step.type}\n`;
      text += `  Duration: ${formatDuration(step.duration)}\n`;
      text += `  Status:   ${step.status}\n`;
      text += `  Tokens:   ${step.tokens || 0}\n`;
      text += `  Cost:     ${formatCost(step.cost || 0)}\n`;
      text += '\n';
    }
  }

  return text;
}

async function exportToJson(report: ReportV1, includeSteps: boolean, includeMeta: boolean): Promise<string> {
  const exportData: any = {
    exportedAt: new Date().toISOString(),
    format: 'json',
    version: report.version
  };

  if (includeMeta) {
    exportData.meta = report.meta;
  }

  exportData.totals = report.totals;

  if (includeSteps) {
    exportData.steps = report.steps;
  }

  return JSON.stringify(exportData, null, 2);
}

async function exportReport(report: ReportV1, options: ExportOptions): Promise<ExportResult> {
  let content: string;

  switch (options.format) {
    case 'csv':
      content = await exportToCsv(report, options.includeSteps);
      break;
    case 'md':
      content = await exportToMarkdown(report, options.includeSteps);
      break;
    case 'txt':
      content = await exportToText(report, options.includeSteps);
      break;
    case 'json':
      content = await exportToJson(report, options.includeSteps, options.includeMeta);
      break;
    default:
      throw new Error(`Unsupported format: ${options.format}`);
  }

  // Determine output path
  let outputPath = options.output;
  if (!outputPath) {
    const inputBase = basename(options.input, extname(options.input));
    outputPath = resolve(dirname(options.input), `${inputBase}.export.${options.format}`);
  }

  // Ensure output directory exists
  mkdirSync(dirname(outputPath), { recursive: true });

  // Write file
  await writeFile(outputPath, content, 'utf-8');

  return {
    format: options.format,
    outputPath,
    size: Buffer.byteLength(content, 'utf-8'),
    success: true
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📊 Report Exporter - Convert Report v1 to various formats

Usage:
  npm run report:export [options] <input-file>

Options:
  -f, --format <fmt>    Export format: csv | json | md | txt (default: csv)
  -o, --output <path>   Output file path (auto-generated if not specified)
  --no-steps           Exclude step-by-step data
  --no-meta            Exclude metadata (JSON format only)
  --quiet              Minimal output
  -h, --help           Show this help

Examples:
  npm run report:export report.json
  npm run report:export -f md -o summary.md report.json
  npm run report:export --no-steps --format csv report.json
  npm run report:export --quiet -f json report.json
    `);
    process.exit(0);
  }

  const options: ExportOptions = {
    input: '',
    format: 'csv' as const,
    includeSteps: true,
    includeMeta: true,
    quiet: false
  };

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-f':
      case '--format':
        options.format = args[++i] as 'csv' | 'json' | 'md' | 'txt';
        break;
      case '-o':
      case '--output':
        options.output = args[++i];
        break;
      case '--no-steps':
        options.includeSteps = false;
        break;
      case '--no-meta':
        options.includeMeta = false;
        break;
      case '--quiet':
        options.quiet = true;
        break;
      default:
        if (!arg.startsWith('-')) {
          options.input = arg;
        }
        break;
    }
  }

  if (!options.input) {
    console.error('❌ Error: Input file required');
    console.error('Run with --help for usage information');
    process.exit(1);
  }

  if (!['csv', 'json', 'md', 'txt'].includes(options.format)) {
    console.error('❌ Error: Invalid format. Supported: csv, json, md, txt');
    process.exit(1);
  }

  try {
    if (!options.quiet) {
      console.log(`📊 Exporting report to ${options.format.toUpperCase()}...`);
    }

    // Load report
    const report = await loadReport(options.input);

    // Export
    const result = await exportReport(report, options);

    if (!options.quiet) {
      console.log(`✅ Export complete:`);
      console.log(`   Format: ${result.format.toUpperCase()}`);
      console.log(`   Output: ${result.outputPath}`);
      console.log(`   Size: ${(result.size / 1024).toFixed(1)}KB`);
      console.log(`   Steps: ${options.includeSteps ? 'Included' : 'Excluded'}`);
      console.log(`   Meta: ${options.includeMeta ? 'Included' : 'Excluded'}`);
    } else {
      console.log(result.outputPath);
    }

  } catch (error) {
    console.error('❌ Export failed:', (error as Error).message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}