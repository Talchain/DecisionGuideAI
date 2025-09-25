#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, basename, dirname } from 'path';
import { execSync } from 'child_process';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { glob } from 'glob';

interface ExperimentGrid {
  name: string;
  description: string;
  scenarios: string[];
  grid: Record<string, any[]>;
  baseline: Record<string, any>;
  settings: {
    seeds: Record<string, number>;
    mode: 'simulation' | 'live';
    output: {
      include_diffs: boolean;
      max_comparisons: number;
      sort_by: string;
    };
  };
}

interface ExperimentVariant {
  id: string;
  scenario: string;
  params: Record<string, any>;
  isBaseline: boolean;
  outputPath: string;
}

interface ExperimentResult {
  variant: ExperimentVariant;
  success: boolean;
  error?: string;
  metadata?: {
    tokens: number;
    duration: number;
    cost: number;
    steps: number;
  };
}

class ExperimentRunner {
  private projectRoot = process.cwd();

  log(message: string): void {
    console.log(message);
  }

  error(message: string): void {
    console.error(`❌ ${message}`);
  }

  /**
   * Load experiment grid configuration
   */
  loadGrid(gridPath: string): ExperimentGrid {
    if (!existsSync(gridPath)) {
      throw new Error(`Grid file not found: ${gridPath}`);
    }

    try {
      const content = readFileSync(gridPath, 'utf8');
      const grid = parseYaml(content) as ExperimentGrid;

      // Validate required fields
      if (!grid.name || !grid.scenarios || !grid.grid || !grid.baseline) {
        throw new Error('Grid file missing required fields: name, scenarios, grid, baseline');
      }

      return grid;
    } catch (error) {
      throw new Error(`Failed to load grid: ${error}`);
    }
  }

  /**
   * Find scenario files in directory
   */
  async findScenarios(scenariosDir: string, scenarioList: string[]): Promise<string[]> {
    const scenarioFiles: string[] = [];

    for (const scenarioPattern of scenarioList) {
      const fullPath = resolve(scenariosDir, scenarioPattern);

      if (existsSync(fullPath)) {
        scenarioFiles.push(fullPath);
      } else {
        // Try glob pattern
        const matches = await glob(scenarioPattern, { cwd: scenariosDir, absolute: true });
        scenarioFiles.push(...matches);
      }
    }

    if (scenarioFiles.length === 0) {
      throw new Error(`No scenario files found in ${scenariosDir}`);
    }

    return scenarioFiles;
  }

  /**
   * Print experiment plan (dry run)
   */
  printPlan(grid: ExperimentGrid, scenarios: string[], outputDir: string): void {
    this.log(`🧪 Experiment Plan: ${grid.name}`);
    this.log(`📄 Description: ${grid.description}`);
    this.log(`📁 Output: ${outputDir}`);
    this.log(`🎯 Scenarios: ${scenarios.length} files`);

    scenarios.forEach(scenario => {
      this.log(`   - ${basename(scenario)}`);
    });

    this.log(`🔬 Grid dimensions:`);
    Object.entries(grid.grid).forEach(([key, values]) => {
      this.log(`   ${key}: ${values.join(', ')}`);
    });

    const totalVariants = this.calculateTotalVariants(grid);
    const totalRuns = scenarios.length * totalVariants;

    this.log(`📊 Total variants: ${totalVariants}`);
    this.log(`🚀 Total runs: ${totalRuns}`);
    this.log(`⚖️ Baseline: ${JSON.stringify(grid.baseline)}`);
  }

  /**
   * Calculate total number of variants
   */
  calculateTotalVariants(grid: ExperimentGrid): number {
    return Object.values(grid.grid).reduce((total, values) => total * values.length, 1);
  }

  /**
   * Generate all experiment variants from grid
   */
  generateVariants(grid: ExperimentGrid, scenarios: string[], outputDir: string): ExperimentVariant[] {
    const variants: ExperimentVariant[] = [];

    // Get grid dimensions and values
    const dimensions = Object.keys(grid.grid);
    const values = Object.values(grid.grid);

    // Generate cartesian product of all dimension values
    const combinations = this.cartesianProduct(values);

    // Create variants for each scenario
    scenarios.forEach(scenarioPath => {
      const scenarioName = basename(scenarioPath, '.yaml');

      combinations.forEach((combination, combIndex) => {
        // Build parameter object for this combination
        const params: Record<string, any> = {};
        dimensions.forEach((dim, dimIndex) => {
          params[dim] = combination[dimIndex];
        });

        // Check if this is the baseline variant
        const isBaseline = this.isBaselineVariant(params, grid.baseline);

        // Generate variant ID
        const variantId = this.generateVariantId(params, isBaseline);

        // Generate output path
        const outputPath = resolve(outputDir, scenarioName, `${variantId}.sarb.zip`);

        variants.push({
          id: variantId,
          scenario: scenarioPath,
          params,
          isBaseline,
          outputPath
        });
      });
    });

    return variants;
  }

  /**
   * Generate cartesian product of arrays
   */
  cartesianProduct(arrays: any[][]): any[][] {
    return arrays.reduce((acc, curr) =>
      acc.flatMap(a => curr.map(c => [...a, c])),
      [[]] as any[][]
    );
  }

  /**
   * Check if parameters match baseline configuration
   */
  isBaselineVariant(params: Record<string, any>, baseline: Record<string, any>): boolean {
    return Object.keys(baseline).every(key => params[key] === baseline[key]);
  }

  /**
   * Generate a unique variant ID from parameters
   */
  generateVariantId(params: Record<string, any>, isBaseline: boolean): string {
    if (isBaseline) {
      return 'baseline';
    }

    const parts = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}${value}`)
      .join('-');

    return parts.replace(/\./g, '');
  }

  /**
   * Create modified scenario file with variant parameters
   */
  createVariantScenario(variant: ExperimentVariant, grid: ExperimentGrid): string {
    // Read original scenario
    const originalContent = readFileSync(variant.scenario, 'utf8');
    const scenario = parseYaml(originalContent);

    // Apply variant parameters
    if (!scenario.params) {
      scenario.params = {};
    }

    // Override with grid parameters
    Object.entries(variant.params).forEach(([key, value]) => {
      scenario.params[key] = value;
    });

    // Apply seed if specified for this scenario
    const scenarioName = basename(variant.scenario);
    if (grid.settings.seeds && grid.settings.seeds[scenarioName]) {
      scenario.params.seed = grid.settings.seeds[scenarioName];
    }

    // Create temp scenario file
    const tempDir = resolve('tmp', 'experiments');
    mkdirSync(tempDir, { recursive: true });

    const tempScenario = resolve(tempDir, `${variant.id}-${basename(variant.scenario)}`);
    writeFileSync(tempScenario, stringifyYaml(scenario));

    return tempScenario;
  }

  /**
   * Execute a single experiment variant
   */
  async runVariant(variant: ExperimentVariant, grid: ExperimentGrid): Promise<ExperimentResult> {
    try {
      this.log(`🧪 Running ${basename(variant.scenario, '.yaml')} → ${variant.id}`);

      // Create variant scenario file
      const tempScenario = this.createVariantScenario(variant, grid);

      // Ensure output directory exists
      mkdirSync(dirname(variant.outputPath), { recursive: true });

      // Run SARB pack (simulation mode)
      const packCommand = `npx tsx ./tools/sarb-pack.ts "${tempScenario}" -o "${variant.outputPath}"`;
      execSync(packCommand, { stdio: 'pipe', cwd: this.projectRoot });

      // Extract metadata from the bundle
      const metadata = this.extractBundleMetadata(variant.outputPath);

      return {
        variant,
        success: true,
        metadata
      };

    } catch (error) {
      return {
        variant,
        success: false,
        error: error.toString()
      };
    }
  }

  /**
   * Extract metadata from SARB bundle
   */
  extractBundleMetadata(bundlePath: string): ExperimentResult['metadata'] {
    try {
      // Use existing SARB tools to extract metadata
      const tempDir = resolve('tmp', `extract-${Date.now()}`);
      const jsonFile = basename(bundlePath).replace('.sarb.zip', '.sarb.json');

      mkdirSync(tempDir, { recursive: true });
      execSync(`cd "${tempDir}" && unzip -q "${bundlePath}"`, { stdio: 'pipe' });

      const jsonPath = resolve(tempDir, jsonFile);
      const bundleData = JSON.parse(readFileSync(jsonPath, 'utf8'));

      // Clean up temp directory
      execSync(`rm -rf "${tempDir}"`, { stdio: 'pipe' });

      return {
        tokens: bundleData.results.tokensGenerated || 0,
        duration: Math.round(bundleData.results.duration / 1000) || 0,
        cost: bundleData.results.cost || 0,
        steps: bundleData.results.steps?.length || 0
      };

    } catch (error) {
      return { tokens: 0, duration: 0, cost: 0, steps: 0 };
    }
  }

  /**
   * Run all experiment variants
   */
  async runExperiments(variants: ExperimentVariant[], grid: ExperimentGrid): Promise<ExperimentResult[]> {
    const results: ExperimentResult[] = [];

    this.log(`\n🚀 Starting experiment execution (${variants.length} variants)`);

    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];
      this.log(`\n[${i + 1}/${variants.length}] ${variant.id}`);

      const result = await this.runVariant(variant, grid);
      results.push(result);

      if (result.success && result.metadata) {
        this.log(`   ✅ ${result.metadata.tokens} tokens, ${result.metadata.duration}s, ${result.metadata.steps} steps`);
      } else {
        this.log(`   ❌ ${result.error}`);
      }
    }

    const successCount = results.filter(r => r.success).length;
    this.log(`\n📊 Experiment complete: ${successCount}/${results.length} successful`);

    return results;
  }

  /**
   * Generate markdown scoreboard
   */
  generateMarkdownScoreboard(grid: ExperimentGrid, results: ExperimentResult[], outputDir: string): string {
    const lines: string[] = [];

    lines.push(`# Experiment Scoreboard: ${grid.name}`);
    lines.push(`*Generated: ${new Date().toLocaleString()}*`);
    lines.push('');
    lines.push(`**Description:** ${grid.description}`);
    lines.push('');

    // Summary statistics
    const successResults = results.filter(r => r.success && r.metadata);
    const failureCount = results.length - successResults.length;

    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Total Runs:** ${results.length}`);
    lines.push(`- **Successful:** ${successResults.length}`);
    if (failureCount > 0) {
      lines.push(`- **Failed:** ${failureCount}`);
    }
    lines.push('');

    if (successResults.length === 0) {
      lines.push('❌ No successful results to display');
      return lines.join('\n');
    }

    // Results table
    lines.push('## Results');
    lines.push('');
    lines.push('| Scenario | Variant | Tokens | Duration | Steps | Cost | vs Baseline |');
    lines.push('|----------|---------|--------|----------|-------|------|-------------|');

    // Group results by scenario for better organization
    const resultsByScenario = this.groupResultsByScenario(successResults);

    Object.entries(resultsByScenario).forEach(([scenarioName, scenarioResults]) => {
      const baseline = scenarioResults.find(r => r.variant.isBaseline);

      scenarioResults
        .sort((a, b) => a.variant.id.localeCompare(b.variant.id))
        .forEach(result => {
          const { variant, metadata } = result;
          if (!metadata) return;

          let comparison = '';
          if (baseline && baseline.metadata && !variant.isBaseline) {
            const tokenDiff = metadata.tokens - baseline.metadata.tokens;
            const durationDiff = metadata.duration - baseline.metadata.duration;

            const tokenSymbol = tokenDiff > 0 ? '📈' : tokenDiff < 0 ? '📉' : '➡️';
            const durationSymbol = durationDiff > 0 ? '🐌' : durationDiff < 0 ? '⚡' : '➡️';

            comparison = `${tokenSymbol} ${tokenDiff > 0 ? '+' : ''}${tokenDiff} tokens, ${durationSymbol} ${durationDiff > 0 ? '+' : ''}${durationDiff}s`;
          } else if (variant.isBaseline) {
            comparison = '⚖️ **Baseline**';
          }

          const cost = metadata.cost ? `$${metadata.cost.toFixed(4)}` : '$0.0000';

          lines.push(`| ${scenarioName} | \`${variant.id}\` | ${metadata.tokens} | ${metadata.duration}s | ${metadata.steps} | ${cost} | ${comparison} |`);
        });
    });

    lines.push('');
    lines.push('## Grid Configuration');
    lines.push('');
    Object.entries(grid.grid).forEach(([key, values]) => {
      lines.push(`- **${key}:** ${values.join(', ')}`);
    });

    lines.push('');
    lines.push('---');
    lines.push('*Generated by SARB Experiment Runner*');

    return lines.join('\n');
  }

  /**
   * Generate HTML scoreboard with sortable table
   */
  generateHTMLScoreboard(grid: ExperimentGrid, results: ExperimentResult[], outputDir: string): string {
    const successResults = results.filter(r => r.success && r.metadata);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Experiment Scoreboard: ${grid.name}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
            background: #f8f9fa;
        }
        .header {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            margin-bottom: 2rem;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h1 { color: #2c3e50; margin-bottom: 0.5rem; }
        .subtitle { color: #6c757d; margin-bottom: 1rem; }
        .summary {
            background: #e8f5e8;
            padding: 1rem;
            border-radius: 6px;
            margin-bottom: 2rem;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e9ecef;
        }
        th {
            background: #495057;
            color: white;
            cursor: pointer;
            user-select: none;
        }
        th:hover { background: #343a40; }
        .baseline-row { background: #fff3cd; }
        .variant-id { font-family: monospace; font-size: 0.9em; }
        .comparison { font-size: 0.9em; }
        .better { color: #28a745; }
        .worse { color: #dc3545; }
        .same { color: #6c757d; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 ${grid.name}</h1>
        <div class="subtitle">Generated: ${new Date().toLocaleString()}</div>
        <p>${grid.description}</p>
    </div>

    <div class="summary">
        <strong>Summary:</strong> ${successResults.length}/${results.length} successful runs
    </div>

    <table id="resultsTable">
        <thead>
            <tr>
                <th onclick="sortTable(0)">Scenario</th>
                <th onclick="sortTable(1)">Variant</th>
                <th onclick="sortTable(2)">Tokens</th>
                <th onclick="sortTable(3)">Duration</th>
                <th onclick="sortTable(4)">Steps</th>
                <th onclick="sortTable(5)">Cost</th>
                <th onclick="sortTable(6)">vs Baseline</th>
            </tr>
        </thead>
        <tbody>
            ${this.generateHTMLTableRows(successResults)}
        </tbody>
    </table>

    <script>
        function sortTable(n) {
            const table = document.getElementById("resultsTable");
            const rows = Array.from(table.getElementsByTagName("tr")).slice(1);

            rows.sort((a, b) => {
                const aVal = a.getElementsByTagName("td")[n].innerText;
                const bVal = b.getElementsByTagName("td")[n].innerText;

                // Try numeric sort first
                const aNum = parseFloat(aVal.replace(/[^0-9.-]/g, ''));
                const bNum = parseFloat(bVal.replace(/[^0-9.-]/g, ''));

                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return aNum - bNum;
                }

                return aVal.localeCompare(bVal);
            });

            const tbody = table.getElementsByTagName("tbody")[0];
            rows.forEach(row => tbody.appendChild(row));
        }
    </script>
</body>
</html>`;

    return html;
  }

  /**
   * Generate HTML table rows for results
   */
  generateHTMLTableRows(results: ExperimentResult[]): string {
    const resultsByScenario = this.groupResultsByScenario(results);
    const rows: string[] = [];

    Object.entries(resultsByScenario).forEach(([scenarioName, scenarioResults]) => {
      const baseline = scenarioResults.find(r => r.variant.isBaseline);

      scenarioResults
        .sort((a, b) => a.variant.id.localeCompare(b.variant.id))
        .forEach(result => {
          const { variant, metadata } = result;
          if (!metadata) return;

          let comparison = '';
          let rowClass = '';

          if (baseline && baseline.metadata && !variant.isBaseline) {
            const tokenDiff = metadata.tokens - baseline.metadata.tokens;
            const durationDiff = metadata.duration - baseline.metadata.duration;

            const tokenSymbol = tokenDiff > 0 ? '📈' : tokenDiff < 0 ? '📉' : '➡️';
            const durationSymbol = durationDiff > 0 ? '🐌' : durationDiff < 0 ? '⚡' : '➡️';

            comparison = `${tokenSymbol} ${tokenDiff > 0 ? '+' : ''}${tokenDiff}, ${durationSymbol} ${durationDiff > 0 ? '+' : ''}${durationDiff}s`;
          } else if (variant.isBaseline) {
            comparison = '⚖️ Baseline';
            rowClass = 'baseline-row';
          }

          const cost = metadata.cost ? `$${metadata.cost.toFixed(4)}` : '$0.0000';

          rows.push(`
            <tr class="${rowClass}">
                <td>${scenarioName}</td>
                <td class="variant-id">${variant.id}</td>
                <td>${metadata.tokens}</td>
                <td>${metadata.duration}s</td>
                <td>${metadata.steps}</td>
                <td>${cost}</td>
                <td class="comparison">${comparison}</td>
            </tr>
          `);
        });
    });

    return rows.join('');
  }

  /**
   * Group results by scenario name
   */
  groupResultsByScenario(results: ExperimentResult[]): Record<string, ExperimentResult[]> {
    const grouped: Record<string, ExperimentResult[]> = {};

    results.forEach(result => {
      const scenarioName = basename(result.variant.scenario, '.yaml');

      if (!grouped[scenarioName]) {
        grouped[scenarioName] = [];
      }

      grouped[scenarioName].push(result);
    });

    return grouped;
  }

  /**
   * Generate scoreboards and save to files
   */
  generateScoreboards(grid: ExperimentGrid, results: ExperimentResult[], outputDir: string): void {
    this.log('\n📊 Generating scoreboards...');

    // Generate markdown scoreboard
    const markdownContent = this.generateMarkdownScoreboard(grid, results, outputDir);
    const markdownPath = resolve(outputDir, 'scoreboard.md');
    writeFileSync(markdownPath, markdownContent);
    this.log(`📝 Markdown: ${markdownPath}`);

    // Generate HTML scoreboard
    const htmlContent = this.generateHTMLScoreboard(grid, results, outputDir);
    const htmlPath = resolve(outputDir, 'scoreboard.html');
    writeFileSync(htmlPath, htmlContent);
    this.log(`🌐 HTML: ${htmlPath}`);
  }

  /**
   * Main CLI entry point
   */
  async run(args: string[]): Promise<void> {
    // Handle help
    if (args.includes('--help') || args.includes('-h')) {
      console.log('Experiment Runner - Run scenario grids and generate scoreboards');
      console.log('');
      console.log('USAGE:');
      console.log('  npm run exp:run -- --scenarios <dir> --grid <yaml> --out <dir> [OPTIONS]');
      console.log('');
      console.log('OPTIONS:');
      console.log('  --scenarios DIR      Directory containing scenario files');
      console.log('  --grid YAML          Experiment grid configuration file');
      console.log('  --out DIR            Output directory for results');
      console.log('  --dry-run           Show plan without executing');
      console.log('  -h, --help          Show this help message');
      console.log('');
      console.log('EXAMPLES:');
      console.log('  npm run exp:run -- --scenarios artifacts/scenarios --grid artifacts/exp-grid.yaml --out artifacts/experiments/test');
      console.log('  npm run exp:run -- --scenarios scenarios --grid grid.yaml --out results --dry-run');
      return;
    }

    // Parse arguments
    const scenariosIndex = args.indexOf('--scenarios');
    const gridIndex = args.indexOf('--grid');
    const outIndex = args.indexOf('--out');
    const isDryRun = args.includes('--dry-run');

    if (scenariosIndex === -1 || gridIndex === -1 || outIndex === -1) {
      console.error('Usage: npm run exp:run -- --scenarios <dir> --grid <yaml> --out <dir>');
      process.exit(1);
    }

    const scenariosDir = resolve(args[scenariosIndex + 1]);
    const gridPath = resolve(args[gridIndex + 1]);
    const outputDir = resolve(args[outIndex + 1]);

    try {
      // Load experiment grid
      const grid = this.loadGrid(gridPath);

      // Find scenario files
      const scenarios = await this.findScenarios(scenariosDir, grid.scenarios);

      // Print plan
      this.printPlan(grid, scenarios, outputDir);

      // Generate variants
      const variants = this.generateVariants(grid, scenarios, outputDir);

      if (isDryRun) {
        this.log(`\n🔬 Generated variants (showing first 5):`);
        variants.slice(0, 5).forEach(variant => {
          const marker = variant.isBaseline ? '⚖️ ' : '🧪 ';
          this.log(`   ${marker}${basename(variant.scenario, '.yaml')} → ${variant.id}`);
          this.log(`      Params: ${JSON.stringify(variant.params)}`);
          this.log(`      Output: ${variant.outputPath}`);
        });

        if (variants.length > 5) {
          this.log(`   ... and ${variants.length - 5} more variants`);
        }

        this.log('\n🏃 Dry run complete - no experiments executed');
        return;
      }

      // Run experiments
      const results = await this.runExperiments(variants, grid);

      // Create timestamped results directory
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const resultsDir = resolve(outputDir, `exp-${timestamp}`);
      mkdirSync(resultsDir, { recursive: true });

      // Generate scoreboards
      this.generateScoreboards(grid, results, resultsDir);

      // Save detailed results JSON
      const summaryPath = resolve(resultsDir, 'results.json');
      writeFileSync(summaryPath, JSON.stringify({ grid, results, timestamp }, null, 2));

      this.log(`\n📁 Results saved to: ${resultsDir}`);
      this.log(`📋 Summary: ${summaryPath}`);

    } catch (error) {
      this.error(`Experiment failed: ${error}`);
      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new ExperimentRunner();
  runner.run(process.argv.slice(2)).catch(error => {
    console.error(`❌ Failed: ${error}`);
    process.exit(1);
  });
}

export { ExperimentRunner };