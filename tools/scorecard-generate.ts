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

  // More methods to follow in next chunks...
}