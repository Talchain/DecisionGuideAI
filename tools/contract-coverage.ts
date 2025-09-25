#!/usr/bin/env tsx
/**
 * Contract Coverage Map for DecisionGuide AI
 * Shows what each OpenAPI route is covered by (examples, mocks, UI fixtures, tests)
 * Usage: npm run contract:coverage
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);
const ARTIFACTS_DIR = join(PROJECT_ROOT, 'artifacts');
const REPORTS_DIR = join(ARTIFACTS_DIR, 'reports');

// Ensure reports directory exists
try {
  mkdirSync(REPORTS_DIR, { recursive: true });
} catch (err) {
  // Directory might already exist
}

interface RouteInfo {
  method: string;
  path: string;
  description?: string;
}

interface CoverageItem {
  type: 'example' | 'mock' | 'ui-fixture' | 'test' | 'reference';
  file: string;
  description: string;
  details?: string;
}

interface RouteCoverage {
  route: RouteInfo;
  coverage: CoverageItem[];
  coverageScore: number; // 0-100
  gaps: string[];
}

interface CoverageReport {
  timestamp: string;
  totalRoutes: number;
  routesWithCoverage: number;
  averageCoverage: number;
  routes: RouteCoverage[];
  summary: {
    wellCovered: number; // 80%+
    partiallyCovered: number; // 50-79%
    poorlyCovered: number; // 1-49%
    noCoverage: number; // 0%
  };
}

class ContractCoverageAnalyzer {
  private routes: RouteInfo[] = [];

  async analyzeContractCoverage(): Promise<CoverageReport> {
    console.log('🗺️  Contract Coverage Map Generator');
    console.log('=' .repeat(45));

    // 1. Discover routes from examples and patterns
    await this.discoverRoutes();
    console.log(`📍 Found ${this.routes.length} API routes`);

    // 2. Analyze coverage for each route
    const routeCoverages = await Promise.all(
      this.routes.map(route => this.analyzeRouteCoverage(route))
    );

    // 3. Generate coverage report
    const report = this.generateCoverageReport(routeCoverages);

    // 4. Save HTML report
    await this.saveHTMLReport(report);

    this.printSummary(report);
    return report;
  }

  private async discoverRoutes(): Promise<void> {
    console.log('🔍 Discovering API routes...');

    // Routes from contract examples
    const contractExamples = await this.loadContractExamples();
    this.routes.push(...contractExamples);

    // Routes from fallback patterns (common REST API patterns)
    const fallbackRoutes = this.generateFallbackRoutes();
    this.routes.push(...fallbackRoutes);

    // Deduplicate routes
    const routeSet = new Set<string>();
    this.routes = this.routes.filter(route => {
      const key = `${route.method}:${route.path}`;
      if (routeSet.has(key)) return false;
      routeSet.add(key);
      return true;
    });
  }

  private async loadContractExamples(): Promise<RouteInfo[]> {
    const routes: RouteInfo[] = [];

    const examplesFile = join(ARTIFACTS_DIR, 'contracts/examples/api-examples.json');
    if (!existsSync(examplesFile)) return routes;

    try {
      const content = readFileSync(examplesFile, 'utf-8');
      const examples = JSON.parse(content);

      if (examples.examples) {
        Object.values(examples.examples).forEach((example: any) => {
          if (example.method && example.path) {
            routes.push({
              method: example.method,
              path: example.path,
              description: example.description || example.name
            });
          }
        });
      }
    } catch (error) {
      console.log('⚠️  Could not load contract examples');
    }

    return routes;
  }

  private generateFallbackRoutes(): RouteInfo[] {
    // Common REST API patterns for decision analysis
    return [
      { method: 'POST', path: '/api/analysis', description: 'Create new analysis request' },
      { method: 'GET', path: '/api/analysis/{id}', description: 'Get analysis by ID' },
      { method: 'GET', path: '/api/analysis/{id}/status', description: 'Get analysis status' },
      { method: 'POST', path: '/api/analysis/{id}/cancel', description: 'Cancel analysis' },
      { method: 'GET', path: '/api/analysis/{id}/report', description: 'Get analysis report' },
      { method: 'GET', path: '/api/analysis/{id}/events', description: 'SSE stream for analysis events' },
      { method: 'POST', path: '/api/jobs', description: 'Create background job' },
      { method: 'GET', path: '/api/jobs/{id}', description: 'Get job status' },
      { method: 'DELETE', path: '/api/jobs/{id}', description: 'Cancel job' },
      { method: 'GET', path: '/api/health', description: 'Health check endpoint' },
      { method: 'GET', path: '/api/version', description: 'API version information' }
    ];
  }

  private async analyzeRouteCoverage(route: RouteInfo): Promise<RouteCoverage> {
    const coverage: CoverageItem[] = [];

    // 1. Check for examples in contract artifacts
    const examples = await this.findExamples(route);
    coverage.push(...examples);

    // 2. Check for mock fixtures
    const mocks = await this.findMockFixtures(route);
    coverage.push(...mocks);

    // 3. Check for UI fixtures
    const uiFixtures = await this.findUIFixtures(route);
    coverage.push(...uiFixtures);

    // 4. Check for test references
    const testReferences = await this.findTestReferences(route);
    coverage.push(...testReferences);

    // 5. Check for code references
    const codeReferences = await this.findCodeReferences(route);
    coverage.push(...codeReferences);

    // Calculate coverage score
    const coverageScore = this.calculateCoverageScore(coverage);

    // Identify gaps
    const gaps = this.identifyGaps(coverage);

    return {
      route,
      coverage,
      coverageScore,
      gaps
    };
  }

  private async findExamples(route: RouteInfo): Promise<CoverageItem[]> {
    const examples: CoverageItem[] = [];

    // Check contract examples
    const contractFiles = await glob(join(ARTIFACTS_DIR, 'contracts/examples/*.json'));
    for (const file of contractFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const routePattern = route.path.replace(/\{[^}]+\}/g, '[^/]+');
        const regex = new RegExp(`"path":\\s*"${routePattern}"`);

        if (regex.test(content)) {
          examples.push({
            type: 'example',
            file: relative(PROJECT_ROOT, file),
            description: `Example payload in ${relative(ARTIFACTS_DIR, file)}`,
            details: `${route.method} ${route.path}`
          });
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return examples;
  }

  private async findMockFixtures(route: RouteInfo): Promise<CoverageItem[]> {
    const mocks: CoverageItem[] = [];

    // Check for mock data files
    const mockFiles = await glob(join(ARTIFACTS_DIR, '**/*mock*.json'));
    const pathKey = route.path.toLowerCase().replace(/[^a-z]/g, '');

    for (const file of mockFiles) {
      const filename = relative(ARTIFACTS_DIR, file).toLowerCase();
      if (filename.includes(pathKey) || filename.includes(route.method.toLowerCase())) {
        mocks.push({
          type: 'mock',
          file: relative(PROJECT_ROOT, file),
          description: `Mock data fixture`,
          details: `Potential mock for ${route.method} ${route.path}`
        });
      }
    }

    return mocks;
  }

  private async findUIFixtures(route: RouteInfo): Promise<CoverageItem[]> {
    const fixtures: CoverageItem[] = [];

    // Check UI fixtures and viewmodels
    const uiFiles = await glob(join(ARTIFACTS_DIR, 'ui-*/**/*.json'));
    const pathWords = route.path.split('/').filter(word => word && !word.startsWith('{'));

    for (const file of uiFiles) {
      try {
        const content = readFileSync(file, 'utf-8').toLowerCase();
        const hasRelevantContent = pathWords.some(word =>
          content.includes(word.toLowerCase()) && word.length > 3
        );

        if (hasRelevantContent) {
          fixtures.push({
            type: 'ui-fixture',
            file: relative(PROJECT_ROOT, file),
            description: `UI fixture referencing route concepts`,
            details: `May contain data for ${route.path}`
          });
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return fixtures;
  }

  private async findTestReferences(route: RouteInfo): Promise<CoverageItem[]> {
    const testRefs: CoverageItem[] = [];

    // Find test files
    const testFiles = await glob(join(PROJECT_ROOT, 'src/**/*.test.{ts,tsx,js,jsx}'));
    const pathPattern = route.path.replace(/\{[^}]+\}/g, '\\{[^}]+\\}');

    for (const file of testFiles) {
      try {
        const content = readFileSync(file, 'utf-8');

        // Check for route references
        const routeRegex = new RegExp(`['"\`]${pathPattern}['"\`]|${route.method}.*${pathPattern.replace(/\\\\/g, '')}`, 'i');
        if (routeRegex.test(content)) {
          testRefs.push({
            type: 'test',
            file: relative(PROJECT_ROOT, file),
            description: `Test file referencing this route`,
            details: `Tests ${route.method} ${route.path}`
          });
        }

        // Check for API method references
        const methodRegex = new RegExp(`(fetch|axios|http).*${route.method}`, 'i');
        if (methodRegex.test(content)) {
          const lines = content.split('\n');
          const matchingLines = lines.filter(line => methodRegex.test(line));
          if (matchingLines.length > 0) {
            testRefs.push({
              type: 'test',
              file: relative(PROJECT_ROOT, file),
              description: `Test with ${route.method} API calls`,
              details: `Contains ${matchingLines.length} ${route.method} calls`
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return testRefs;
  }

  private async findCodeReferences(route: RouteInfo): Promise<CoverageItem[]> {
    const codeRefs: CoverageItem[] = [];

    // Find source files
    const sourceFiles = await glob(join(PROJECT_ROOT, 'src/**/*.{ts,tsx,js,jsx}'));
    const pathWords = route.path.split('/').filter(word => word && !word.startsWith('{') && word.length > 3);

    for (const file of sourceFiles) {
      if (file.includes('.test.')) continue; // Skip test files

      try {
        const content = readFileSync(file, 'utf-8');

        // Check for path-related constants or references
        const hasPathReference = pathWords.some(word => {
          const regex = new RegExp(`['"\`][^'"\`]*${word}[^'"\`]*['"\`]`, 'i');
          return regex.test(content);
        });

        if (hasPathReference) {
          codeRefs.push({
            type: 'reference',
            file: relative(PROJECT_ROOT, file),
            description: `Source code referencing route concepts`,
            details: `May implement or reference ${route.path}`
          });
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return codeRefs;
  }

  private calculateCoverageScore(coverage: CoverageItem[]): number {
    if (coverage.length === 0) return 0;

    // Weight different types of coverage
    const weights = {
      example: 25,
      mock: 20,
      'ui-fixture': 15,
      test: 30,
      reference: 10
    };

    let totalWeight = 0;
    coverage.forEach(item => {
      totalWeight += weights[item.type] || 5;
    });

    // Cap at 100
    return Math.min(100, totalWeight);
  }

  private identifyGaps(coverage: CoverageItem[]): string[] {
    const gaps: string[] = [];
    const types = new Set(coverage.map(c => c.type));

    if (!types.has('example')) gaps.push('No example payload available');
    if (!types.has('test')) gaps.push('No test coverage found');
    if (!types.has('mock') && !types.has('ui-fixture')) gaps.push('No mock or UI fixtures');
    if (coverage.length === 0) gaps.push('No coverage of any type');

    return gaps;
  }

  private generateCoverageReport(routeCoverages: RouteCoverage[]): CoverageReport {
    const totalRoutes = routeCoverages.length;
    const routesWithCoverage = routeCoverages.filter(rc => rc.coverage.length > 0).length;
    const averageCoverage = routeCoverages.reduce((sum, rc) => sum + rc.coverageScore, 0) / totalRoutes;

    const summary = {
      wellCovered: routeCoverages.filter(rc => rc.coverageScore >= 80).length,
      partiallyCovered: routeCoverages.filter(rc => rc.coverageScore >= 50 && rc.coverageScore < 80).length,
      poorlyCovered: routeCoverages.filter(rc => rc.coverageScore > 0 && rc.coverageScore < 50).length,
      noCoverage: routeCoverages.filter(rc => rc.coverageScore === 0).length
    };

    return {
      timestamp: new Date().toISOString(),
      totalRoutes,
      routesWithCoverage,
      averageCoverage: Math.round(averageCoverage),
      routes: routeCoverages,
      summary
    };
  }

  private async saveHTMLReport(report: CoverageReport): Promise<void> {
    const html = this.generateHTMLReport(report);
    const htmlPath = join(REPORTS_DIR, 'contract-coverage.html');
    writeFileSync(htmlPath, html);

    console.log(`\n📄 Report saved: ${relative(PROJECT_ROOT, htmlPath)}`);
  }

  private generateHTMLReport(report: CoverageReport): string {
    const routes = report.routes.sort((a, b) => b.coverageScore - a.coverageScore);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contract Coverage Map</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; line-height: 1.6; }
        .header { border-bottom: 3px solid #0066cc; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { padding: 20px; border-radius: 8px; text-align: center; }
        .well-covered { background: #d4edda; border-left: 4px solid #28a745; }
        .partial-covered { background: #fff3cd; border-left: 4px solid #ffc107; }
        .poor-covered { background: #f8d7da; border-left: 4px solid #dc3545; }
        .no-coverage { background: #f1f3f4; border-left: 4px solid #6c757d; }
        .route { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .route-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .method { padding: 4px 8px; border-radius: 4px; color: white; font-weight: bold; font-size: 0.8em; }
        .method.GET { background: #28a745; }
        .method.POST { background: #007bff; }
        .method.PUT { background: #ffc107; color: black; }
        .method.DELETE { background: #dc3545; }
        .coverage-bar { height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; }
        .coverage-fill { height: 100%; transition: width 0.3s; }
        .coverage-items { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 10px; margin: 15px 0; }
        .coverage-item { padding: 10px; border-left: 3px solid #ccc; background: #f8f9fa; }
        .coverage-item.example { border-color: #007bff; }
        .coverage-item.mock { border-color: #28a745; }
        .coverage-item.ui-fixture { border-color: #ffc107; }
        .coverage-item.test { border-color: #17a2b8; }
        .coverage-item.reference { border-color: #6c757d; }
        .gaps { color: #dc3545; font-style: italic; }
        .score { font-weight: bold; font-size: 1.2em; }
        .timestamp { color: #6c757d; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🗺️ Contract Coverage Map</h1>
        <p class="timestamp">Generated: ${report.timestamp}</p>
        <p>Coverage analysis for ${report.totalRoutes} API routes</p>
    </div>

    <div class="summary">
        <div class="summary-card well-covered">
            <h3>${report.summary.wellCovered}</h3>
            <p>Well Covered<br><small>(80%+ coverage)</small></p>
        </div>
        <div class="summary-card partial-covered">
            <h3>${report.summary.partiallyCovered}</h3>
            <p>Partial Coverage<br><small>(50-79% coverage)</small></p>
        </div>
        <div class="summary-card poor-covered">
            <h3>${report.summary.poorlyCovered}</h3>
            <p>Poor Coverage<br><small>(1-49% coverage)</small></p>
        </div>
        <div class="summary-card no-coverage">
            <h3>${report.summary.noCoverage}</h3>
            <p>No Coverage<br><small>(0% coverage)</small></p>
        </div>
    </div>

    <p><strong>Average Coverage:</strong> ${report.averageCoverage}% | <strong>Routes with Coverage:</strong> ${report.routesWithCoverage}/${report.totalRoutes}</p>

    <h2>📋 Route Coverage Details</h2>

    ${routes.map(route => `
        <div class="route">
            <div class="route-header">
                <div>
                    <span class="method ${route.route.method}">${route.route.method}</span>
                    <strong>${route.route.path}</strong>
                    ${route.route.description ? `<br><small>${route.route.description}</small>` : ''}
                </div>
                <div class="score">${route.coverageScore}%</div>
            </div>

            <div class="coverage-bar">
                <div class="coverage-fill" style="width: ${route.coverageScore}%; background: ${
                    route.coverageScore >= 80 ? '#28a745' :
                    route.coverageScore >= 50 ? '#ffc107' :
                    route.coverageScore > 0 ? '#dc3545' : '#6c757d'
                }"></div>
            </div>

            ${route.coverage.length > 0 ? `
                <div class="coverage-items">
                    ${route.coverage.map(item => `
                        <div class="coverage-item ${item.type}">
                            <strong>${item.type}</strong>: ${item.description}<br>
                            <small>📁 ${item.file}</small>
                            ${item.details ? `<br><small>💡 ${item.details}</small>` : ''}
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            ${route.gaps.length > 0 ? `
                <div class="gaps">
                    <strong>Gaps:</strong> ${route.gaps.join(', ')}
                </div>
            ` : ''}
        </div>
    `).join('')}

    <hr style="margin: 40px 0;">
    <p style="text-align: center; color: #6c757d;">
        <small>Report generated by DecisionGuide AI Contract Coverage Analyzer</small>
    </p>
</body>
</html>`;
  }

  private printSummary(report: CoverageReport): void {
    console.log('\n📊 Contract Coverage Summary');
    console.log('=' .repeat(35));
    console.log(`Total Routes: ${report.totalRoutes}`);
    console.log(`Average Coverage: ${report.averageCoverage}%`);
    console.log(`Well Covered (80%+): ${report.summary.wellCovered}`);
    console.log(`Partial Coverage (50-79%): ${report.summary.partiallyCovered}`);
    console.log(`Poor Coverage (1-49%): ${report.summary.poorlyCovered}`);
    console.log(`No Coverage (0%): ${report.summary.noCoverage}`);

    if (report.summary.noCoverage > 0) {
      console.log('\n⚠️  Routes needing attention:');
      report.routes
        .filter(r => r.coverageScore === 0)
        .slice(0, 3)
        .forEach(route => {
          console.log(`   • ${route.route.method} ${route.route.path}`);
        });
    }
  }
}

// Run the analyzer if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const analyzer = new ContractCoverageAnalyzer();
  analyzer.analyzeContractCoverage().catch(error => {
    console.error('Contract coverage analysis failed:', error);
    process.exit(1);
  });
}

export { ContractCoverageAnalyzer };