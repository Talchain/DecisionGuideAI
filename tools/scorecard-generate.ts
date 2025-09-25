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

  // Continue to Chunk 3...
}