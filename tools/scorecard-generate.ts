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

  // Continue to Chunk 4...
}