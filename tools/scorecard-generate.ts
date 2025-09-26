#!/usr/bin/env tsx
/**
 * Integration Scorecard Generator for DecisionGuide AI
 *
 * Chunk 1/4: Imports, interfaces, and basic setup
 *
 * Evaluates integration readiness across Windsurf ↔ Gateway ↔ Warp layers
 * Usage: npm run scorecard:generate
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);
const ARTIFACTS_DIR = join(PROJECT_ROOT, 'artifacts');
const SCORECARD_DIR = join(ARTIFACTS_DIR, 'scorecard');

// Data model interfaces
interface StatusDefinition {
  color: string;
  description: string;
  priority: number;
}

interface OwnerDefinition {
  [key: string]: string;
}

interface LayerMap {
  ui: boolean;
  gateway: boolean;
  warp: boolean;
  jobs?: boolean;
  usage?: boolean;
}

interface DetectionRules {
  ui?: string[];
  gateway?: string[];
  warp?: string[];
  jobs?: string[];
  usage?: string[];
  tests?: string[];
}

interface Integration {
  id: string;
  name: string;
  layer_map: LayerMap;
  detection: DetectionRules;
  owner: string;
  priority: string;
  acceptance: string;
}

interface Evidence {
  ui: string[];
  gateway: string[];
  warp: string[];
  jobs: string[];
  usage: string[];
  tests: string[];
}

interface ScorecardItem {
  id: string;
  name: string;
  owner: string;
  ownerName: string;
  priority: string;
  status: string;
  layer_map: LayerMap;
  evidence: Evidence;
  missing: string[];
  acceptance: string;
  links: string[];
  howToFinish?: string;
}

interface ScorecardTotals {
  byStatus: { [status: string]: number };
  coveragePercent: number;
  total: number;
  verified: number;
}

interface ScorecardData {
  generatedAt: string;
  totals: ScorecardTotals;
  items: ScorecardItem[];
}

class ScorecardGenerator {
  private statuses: { [key: string]: StatusDefinition } = {};
  private owners: OwnerDefinition = {};
  private integrations: Integration[] = [];

  constructor() {
    this.loadRegistries();
  }

  private loadRegistries(): void {
    console.log('📋 Loading scorecard registries...');

    // Load statuses
    const statusesPath = join(SCORECARD_DIR, 'statuses.yaml');
    if (existsSync(statusesPath)) {
      const statusData = yaml.parse(readFileSync(statusesPath, 'utf-8'));
      this.statuses = statusData.statuses;
    }

    // Load owners
    const ownersPath = join(SCORECARD_DIR, 'owners.yaml');
    if (existsSync(ownersPath)) {
      const ownerData = yaml.parse(readFileSync(ownersPath, 'utf-8'));
      this.owners = ownerData.owners;
    }

    // Load integrations
    const integrationsPath = join(SCORECARD_DIR, 'integrations.yaml');
    if (existsSync(integrationsPath)) {
      const integrationData = yaml.parse(readFileSync(integrationsPath, 'utf-8'));
      this.integrations = integrationData.integrations;
    }

    console.log(`✅ Loaded ${Object.keys(this.statuses).length} statuses, ${Object.keys(this.owners).length} owners, ${this.integrations.length} integrations`);
  }

  /**
   * Chunk 2/4: Detection logic and evidence gathering
   */

  async generateScorecard(): Promise<ScorecardData> {
    console.log('🔍 Integration Scorecard Generator');
    console.log('=' .repeat(40));

    const items: ScorecardItem[] = [];

    for (const integration of this.integrations) {
      console.log(`📊 Evaluating: ${integration.name}`);
      const item = await this.evaluateIntegration(integration);
      items.push(item);
    }

    const totals = this.calculateTotals(items);

    const scorecard: ScorecardData = {
      generatedAt: new Date().toISOString(),
      totals,
      items
    };

    await this.saveScorecard(scorecard);
    await this.generateHTML(scorecard);
    this.updateArtifactsIndex();

    console.log(`\n✅ Integration Scorecard generated: ${items.length} items, ${totals.coveragePercent}% coverage`);
    return scorecard;
  }

  private async evaluateIntegration(integration: Integration): Promise<ScorecardItem> {
    const evidence = await this.gatherEvidence(integration);
    const missing = this.identifyMissing(integration, evidence);
    const status = this.computeStatus(integration, evidence, missing);
    const howToFinish = this.generateHowToFinish(integration, missing, status);

    return {
      id: integration.id,
      name: integration.name,
      owner: integration.owner,
      ownerName: this.owners[integration.owner] || integration.owner,
      priority: integration.priority,
      status,
      layer_map: integration.layer_map,
      evidence,
      missing,
      acceptance: integration.acceptance,
      links: this.generateLinks(evidence),
      howToFinish
    };
  }

  private async gatherEvidence(integration: Integration): Promise<Evidence> {
    const evidence: Evidence = {
      ui: [],
      gateway: [],
      warp: [],
      jobs: [],
      usage: [],
      tests: []
    };

    // Gather UI evidence (files and artefacts)
    if (integration.detection.ui) {
      for (const pattern of integration.detection.ui) {
        try {
          const matches = await glob(pattern, { cwd: PROJECT_ROOT });
          evidence.ui.push(...matches.filter(existsSync));
        } catch (error) {
          // Skip patterns that don't resolve
        }
      }
    }

    // Gather test evidence
    if (integration.detection.tests) {
      for (const pattern of integration.detection.tests) {
        try {
          if (pattern.startsWith('npm run ')) {
            // Check if npm script exists
            const packageJson = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8'));
            const scriptName = pattern.replace('npm run ', '');
            if (packageJson.scripts?.[scriptName]) {
              evidence.tests.push(`script:${scriptName}`);
            }
          } else {
            // File pattern
            const matches = await glob(pattern, { cwd: PROJECT_ROOT });
            evidence.tests.push(...matches.filter(existsSync));
          }
        } catch (error) {
          // Skip patterns that don't resolve
        }
      }
    }

    // Gather Gateway evidence (OpenAPI routes)
    if (integration.detection.gateway) {
      evidence.gateway = await this.findOpenAPIRoutes(integration.detection.gateway);
    }

    // Gather Warp evidence (OpenAPI routes or markers)
    if (integration.detection.warp) {
      evidence.warp = await this.findWarpEvidence(integration.detection.warp);
    }

    // Gather Jobs evidence
    if (integration.detection.jobs) {
      evidence.jobs = await this.findOpenAPIRoutes(integration.detection.jobs);
    }

    return evidence;
  }

  private async findOpenAPIRoutes(routes: string[]): Promise<string[]> {
    const found: string[] = [];

    try {
      // Look for OpenAPI specs (future-proofing)
      const openApiFiles = await glob('openapi/**/*.{json,yaml,yml}', { cwd: PROJECT_ROOT });

      for (const file of openApiFiles) {
        try {
          const content = readFileSync(join(PROJECT_ROOT, file), 'utf-8');
          const isYaml = file.endsWith('.yaml') || file.endsWith('.yml');
          const spec = isYaml ? yaml.parse(content) : JSON.parse(content);

          if (spec.paths) {
            for (const route of routes) {
              if (this.routeExistsInSpec(route, spec)) {
                found.push(`${file}:${route}`);
              }
            }
          }
        } catch (error) {
          // Skip malformed spec files
        }
      }

      // Also check existing contract examples as fallback
      const contractExamples = await glob('artifacts/contracts/examples/*.json', { cwd: PROJECT_ROOT });

      for (const file of contractExamples) {
        try {
          const content = readFileSync(join(PROJECT_ROOT, file), 'utf-8');
          for (const route of routes) {
            if (content.includes(route) || this.matchesRoutePattern(route, content)) {
              found.push(`${file}:${route}`);
            }
          }
        } catch (error) {
          // Skip unreadable files
        }
      }

    } catch (error) {
      // No OpenAPI specs found, continue
    }

    return found;
  }

  private routeExistsInSpec(route: string, spec: any): boolean {
    if (!spec.paths) return false;

    // Parse route like "GET /stream" or "/api/analysis/{id}/events"
    const parts = route.split(' ');
    const method = parts.length > 1 ? parts[0].toLowerCase() : 'get';
    const path = parts.length > 1 ? parts[1] : parts[0];

    // Check exact path
    if (spec.paths[path]?.[method]) {
      return true;
    }

    // Check path patterns with parameters
    for (const specPath of Object.keys(spec.paths)) {
      if (this.pathsMatch(path, specPath) && spec.paths[specPath][method]) {
        return true;
      }
    }

    return false;
  }

  private pathsMatch(routePath: string, specPath: string): boolean {
    // Convert both paths to comparable format
    const routeRegex = routePath.replace(/\{[^}]+\}/g, '[^/]+');
    const specRegex = specPath.replace(/\{[^}]+\}/g, '[^/]+');

    return routeRegex === specRegex ||
           new RegExp(`^${routeRegex}$`).test(specPath) ||
           new RegExp(`^${specRegex}$`).test(routePath);
  }

  private matchesRoutePattern(route: string, content: string): boolean {
    // Check for route mentions in contract examples
    const routeWords = route.toLowerCase().split(/[\/\s-]+/).filter(w => w.length > 2);
    return routeWords.some(word => content.toLowerCase().includes(word));
  }

  private async findWarpEvidence(markers: string[]): Promise<string[]> {
    const found: string[] = [];

    for (const marker of markers) {
      // Check in various locations
      const searchPaths = [
        'artifacts/contracts/**/*.json',
        'artifacts/samples/**/*.json',
        'artifacts/types/**/*.ts',
        'src/**/*.ts'
      ];

      for (const searchPath of searchPaths) {
        try {
          const files = await glob(searchPath, { cwd: PROJECT_ROOT });
          for (const file of files) {
            try {
              const content = readFileSync(join(PROJECT_ROOT, file), 'utf-8');
              if (content.toLowerCase().includes(marker.toLowerCase())) {
                found.push(`${file}:${marker}`);
                break; // Don't duplicate the same marker
              }
            } catch (error) {
              // Skip unreadable files
            }
          }
        } catch (error) {
          // Skip glob patterns that don't resolve
        }
      }
    }

    return found;
  }

  /**
   * Chunk 3/4: Status computation and totals calculation
   */

  private identifyMissing(integration: Integration, evidence: Evidence): string[] {
    const missing: string[] = [];

    // Check required layers
    if (integration.layer_map.ui && evidence.ui.length === 0) {
      missing.push('UI fixtures/view-models');
    }
    if (integration.layer_map.gateway && evidence.gateway.length === 0) {
      missing.push('Gateway routes');
    }
    if (integration.layer_map.warp && evidence.warp.length === 0) {
      missing.push('Warp implementation');
    }
    if (integration.layer_map.jobs && evidence.jobs.length === 0) {
      missing.push('Jobs layer');
    }
    if (integration.layer_map.usage && evidence.usage.length === 0) {
      missing.push('Usage tracking');
    }

    // Check tests
    if (evidence.tests.length === 0) {
      missing.push('Tests/integration harness');
    }

    return missing;
  }

  private computeStatus(integration: Integration, evidence: Evidence, missing: string[]): string {
    // Check for explicit blocks
    if (this.isExplicitlyBlocked(integration, evidence)) {
      return 'BLOCKED';
    }

    // No evidence at all
    if (this.hasNoEvidence(evidence)) {
      return 'NOT_STARTED';
    }

    // Check for E2E verification
    if (this.hasE2EVerification(evidence)) {
      return 'VERIFIED_E2E';
    }

    // All required routes exist but no E2E proof
    if (missing.length === 0 || this.allRoutesExist(integration, evidence)) {
      return 'WIRED_LIVE';
    }

    // Has fixtures/artefacts and test coverage but missing routes
    if (evidence.ui.length > 0 && evidence.tests.length > 0) {
      return 'WIRED_SIM';
    }

    // Some files exist but incomplete
    if (evidence.ui.length > 0 || evidence.gateway.length > 0 || evidence.warp.length > 0) {
      return 'SCAFFOLDING';
    }

    return 'NOT_STARTED';
  }

  private isExplicitlyBlocked(integration: Integration, evidence: Evidence): boolean {
    // Check for explicit status: "BLOCKED" in YAML
    if ((integration as any).status === 'BLOCKED') {
      return true;
    }
    // Check for failing contract wall (future)
    // Check for explicit blocking markers (future)
    return false;
  }

  private hasNoEvidence(evidence: Evidence): boolean {
    return Object.values(evidence).every(arr => arr.length === 0);
  }

  private hasE2EVerification(evidence: Evidence): boolean {
    // Look for ACCEPTANCE markers in test files
    for (const testFile of evidence.tests) {
      if (testFile.startsWith('script:')) continue;

      try {
        const content = readFileSync(join(PROJECT_ROOT, testFile), 'utf-8');
        if (content.includes('ACCEPTANCE') || content.includes('green') || content.includes('✅')) {
          return true;
        }
      } catch (error) {
        // Skip unreadable files
      }
    }

    // Check for recent integration status artifacts
    try {
      const integrationStatus = join(ARTIFACTS_DIR, 'integration-status.html');
      if (existsSync(integrationStatus)) {
        const content = readFileSync(integrationStatus, 'utf-8');
        if (content.includes('green') || content.includes('✅') || content.includes('PASS')) {
          return true;
        }
      }
    } catch (error) {
      // Skip if can't read
    }

    return false;
  }

  private allRoutesExist(integration: Integration, evidence: Evidence): boolean {
    let requiredLayers = 0;
    let coveredLayers = 0;

    if (integration.layer_map.ui) {
      requiredLayers++;
      if (evidence.ui.length > 0) coveredLayers++;
    }
    if (integration.layer_map.gateway) {
      requiredLayers++;
      if (evidence.gateway.length > 0) coveredLayers++;
    }
    if (integration.layer_map.warp) {
      requiredLayers++;
      if (evidence.warp.length > 0) coveredLayers++;
    }
    if (integration.layer_map.jobs) {
      requiredLayers++;
      if (evidence.jobs.length > 0) coveredLayers++;
    }
    if (integration.layer_map.usage) {
      requiredLayers++;
      if (evidence.usage.length > 0) coveredLayers++;
    }

    return requiredLayers > 0 && coveredLayers >= requiredLayers * 0.8; // 80% threshold
  }

  private generateHowToFinish(integration: Integration, missing: string[], status: string): string {
    if (status === 'VERIFIED_E2E') {
      return '✅ Complete - integration verified end-to-end';
    }

    if (status === 'BLOCKED') {
      return '🚫 Blocked - resolve blocking issues first';
    }

    if (missing.length === 0) {
      return '🧪 Add E2E tests with ACCEPTANCE markers to verify integration';
    }

    const hints: string[] = [];

    if (missing.includes('UI fixtures/view-models')) {
      hints.push('Add UI fixtures under artifacts/ui-fixtures/ and view-models');
    }
    if (missing.includes('Gateway routes')) {
      hints.push('Add OpenAPI spec under openapi/ or contract examples');
    }
    if (missing.includes('Warp implementation')) {
      hints.push('Implement engine routes and add to contract examples');
    }
    if (missing.includes('Jobs layer')) {
      hints.push('Add jobs endpoints to OpenAPI spec');
    }
    if (missing.includes('Tests/integration harness')) {
      hints.push('Add integration tests or npm scripts');
    }

    return hints.slice(0, 2).join('; '); // Keep concise
  }

  private generateLinks(evidence: Evidence): string[] {
    const links: string[] = [];

    // Add top evidence files as quick links
    [...evidence.ui.slice(0, 2), ...evidence.tests.slice(0, 2), ...evidence.gateway.slice(0, 1)]
      .forEach(item => {
        if (item && !item.startsWith('script:')) {
          links.push(relative(ARTIFACTS_DIR, join(PROJECT_ROOT, item)));
        }
      });

    return links;
  }

  private calculateTotals(items: ScorecardItem[]): ScorecardTotals {
    const byStatus: { [status: string]: number } = {};

    // Initialize all statuses to 0
    for (const status of Object.keys(this.statuses)) {
      byStatus[status] = 0;
    }

    // Count items by status
    for (const item of items) {
      byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    }

    const verified = byStatus['VERIFIED_E2E'] || 0;
    const total = items.length;
    const coveragePercent = total > 0 ? Math.round((verified / total) * 100) : 0;

    return {
      byStatus,
      coveragePercent,
      total,
      verified
    };
  }

  private async saveScorecard(scorecard: ScorecardData): Promise<void> {
    const jsonPath = join(ARTIFACTS_DIR, 'integration-scorecard.json');
    writeFileSync(jsonPath, JSON.stringify(scorecard, null, 2));
    console.log(`💾 Saved scorecard JSON: ${relative(PROJECT_ROOT, jsonPath)}`);
  }

  /**
   * Chunk 4/4: HTML generation, index updates, and CLI interface
   */

  private async generateHTML(scorecard: ScorecardData): Promise<void> {
    const htmlPath = join(ARTIFACTS_DIR, 'integration-scorecard.html');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Integration Scorecard - DecisionGuide AI</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #2c3e50; background: #f8f9fa; }
        .container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
        .header { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 2rem; }
        .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .header .meta { color: #6c757d; font-size: 0.9rem; }

        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
        .summary-card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
        .summary-card h3 { font-size: 2rem; margin-bottom: 0.5rem; }
        .summary-card p { color: #6c757d; }
        .coverage { font-size: 3rem; font-weight: bold; color: #28a745; }

        .filters { background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 2rem; }
        .filter-group { display: inline-block; margin-right: 2rem; }
        .filter-group label { font-weight: 500; margin-right: 0.5rem; }
        select, input { padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; }

        .items { display: grid; gap: 1.5rem; }
        .item { background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
        .item-header { padding: 1.5rem; border-left: 4px solid #ddd; }
        .item-title { font-size: 1.2rem; font-weight: 600; margin-bottom: 0.5rem; }
        .item-meta { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
        .badge { padding: 0.25rem 0.75rem; border-radius: 15px; font-size: 0.8rem; font-weight: 500; color: white; }
        .owner-chip { background: #6c757d; color: white; padding: 0.25rem 0.75rem; border-radius: 15px; font-size: 0.8rem; }
        .priority { font-weight: bold; }
        .how-to-finish { background: #f8f9fa; padding: 1rem 1.5rem; border-top: 1px solid #eee; font-style: italic; color: #495057; }
        .evidence { padding: 1rem 1.5rem; border-top: 1px solid #eee; }
        .evidence-section { margin-bottom: 0.5rem; }
        .evidence-section strong { color: #495057; }
        .evidence-list { margin-left: 1rem; color: #6c757d; font-size: 0.9rem; }
        .links { margin-top: 0.5rem; }
        .links a { color: #007bff; text-decoration: none; margin-right: 1rem; font-size: 0.9rem; }
        .links a:hover { text-decoration: underline; }

        .status-NOT_STARTED { border-left-color: #6c757d !important; }
        .status-SCAFFOLDING { border-left-color: #ffc107 !important; }
        .status-WIRED_SIM { border-left-color: #17a2b8 !important; }
        .status-WIRED_LIVE { border-left-color: #6f42c1 !important; }
        .status-VERIFIED_E2E { border-left-color: #28a745 !important; }
        .status-BLOCKED { border-left-color: #dc3545 !important; }

        .badge.NOT_STARTED { background: #6c757d; }
        .badge.SCAFFOLDING { background: #ffc107; color: #212529; }
        .badge.WIRED_SIM { background: #17a2b8; }
        .badge.WIRED_LIVE { background: #6f42c1; }
        .badge.VERIFIED_E2E { background: #28a745; }
        .badge.BLOCKED { background: #dc3545; }

        .hidden { display: none; }
        footer { text-align: center; padding: 2rem; color: #6c757d; font-size: 0.9rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🗺️ Integration Scorecard</h1>
            <div class="meta">
                Generated: ${new Date(scorecard.generatedAt).toLocaleString()} •
                Coverage: ${scorecard.totals.coveragePercent}% •
                Items: ${scorecard.totals.total}
            </div>
        </div>

        <div class="summary">
            <div class="summary-card">
                <div class="coverage">${scorecard.totals.coveragePercent}%</div>
                <p>Coverage</p>
            </div>
            <div class="summary-card">
                <h3>${scorecard.totals.verified}</h3>
                <p>Verified E2E</p>
            </div>
            <div class="summary-card">
                <h3>${scorecard.totals.total}</h3>
                <p>Total Integrations</p>
            </div>
            <div class="summary-card">
                <h3>${Object.keys(this.owners).length}</h3>
                <p>Teams</p>
            </div>
        </div>

        <div class="filters">
            <div class="filter-group">
                <label for="team-filter">Team:</label>
                <select id="team-filter" onchange="filterItems()">
                    <option value="">All Teams</option>
                    ${Object.keys(this.owners).map(owner =>
                        `<option value="${owner}">${this.owners[owner]}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="filter-group">
                <label for="status-filter">Status:</label>
                <select id="status-filter" onchange="filterItems()">
                    <option value="">All Statuses</option>
                    ${Object.keys(this.statuses).map(status =>
                        `<option value="${status}">${status.replace('_', ' ')}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="filter-group">
                <label for="priority-filter">Priority:</label>
                <select id="priority-filter" onchange="filterItems()">
                    <option value="">All Priorities</option>
                    <option value="P0">P0</option>
                    <option value="P1">P1</option>
                    <option value="P2">P2</option>
                </select>
            </div>
        </div>

        <div class="items">
            ${scorecard.items.map(item => `
                <div class="item status-${item.status}" data-owner="${item.owner}" data-status="${item.status}" data-priority="${item.priority}">
                    <div class="item-header">
                        <div class="item-title">${item.name}</div>
                        <div class="item-meta">
                            <span class="badge ${item.status}">${item.status.replace('_', ' ')}</span>
                            <span class="owner-chip">${item.ownerName}</span>
                            <span class="priority">${item.priority}</span>
                        </div>
                        <p>${item.acceptance}</p>
                        ${item.links.length > 0 ? `
                            <div class="links">
                                ${item.links.map(link => `<a href="./${link}" target="_blank">${link.split('/').pop()}</a>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="how-to-finish">${item.howToFinish}</div>
                    <div class="evidence">
                        ${Object.entries(item.evidence).map(([layer, files]) =>
                            files.length > 0 ? `
                                <div class="evidence-section">
                                    <strong>${layer.toUpperCase()}:</strong>
                                    <div class="evidence-list">
                                        ${files.slice(0, 3).map(file =>
                                            file.startsWith('script:') ?
                                                `• ${file.replace('script:', 'npm run ')}` :
                                                `• ${file.split(':')[0]}`
                                        ).join('<br>')}
                                        ${files.length > 3 ? `<br>• ... and ${files.length - 3} more` : ''}
                                    </div>
                                </div>
                            ` : ''
                        ).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>

    <footer>
        Integration Scorecard • DecisionGuide AI • No servers required
    </footer>

    <script>
        function filterItems() {
            const teamFilter = document.getElementById('team-filter').value;
            const statusFilter = document.getElementById('status-filter').value;
            const priorityFilter = document.getElementById('priority-filter').value;

            const items = document.querySelectorAll('.item');

            items.forEach(item => {
                const owner = item.dataset.owner;
                const status = item.dataset.status;
                const priority = item.dataset.priority;

                const matchesTeam = !teamFilter || owner === teamFilter;
                const matchesStatus = !statusFilter || status === statusFilter;
                const matchesPriority = !priorityFilter || priority === priorityFilter;

                if (matchesTeam && matchesStatus && matchesPriority) {
                    item.classList.remove('hidden');
                } else {
                    item.classList.add('hidden');
                }
            });
        }

        // URL query param filtering
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('team')) document.getElementById('team-filter').value = urlParams.get('team');
        if (urlParams.get('status')) document.getElementById('status-filter').value = urlParams.get('status');
        if (urlParams.get('priority')) document.getElementById('priority-filter').value = urlParams.get('priority');
        filterItems();
    </script>
</body>
</html>`;

    writeFileSync(htmlPath, html);
    console.log(`🎨 Generated HTML scorecard: ${relative(PROJECT_ROOT, htmlPath)}`);
  }

  private updateArtifactsIndex(): void {
    const indexPath = join(ARTIFACTS_DIR, 'index.html');

    if (!existsSync(indexPath)) return;

    try {
      let content = readFileSync(indexPath, 'utf-8');

      // Add scorecard link if not present
      if (!content.includes('integration-scorecard.html')) {
        // Find a good place to insert (after existing links)
        const insertPoint = content.indexOf('</ul>');
        if (insertPoint !== -1) {
          const linkHtml = '                    <li><a href="./integration-scorecard.html" target="_blank">Integration Scorecard</a></li>\n';
          content = content.slice(0, insertPoint) + linkHtml + content.slice(insertPoint);
          writeFileSync(indexPath, content);
          console.log('🔗 Added scorecard link to artifacts index');
        }
      }
    } catch (error) {
      console.log('⚠️  Could not update artifacts index');
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const generator = new ScorecardGenerator();
  generator.generateScorecard().catch(error => {
    console.error('Scorecard generation failed:', error);
    process.exit(1);
  });
}

export { ScorecardGenerator };