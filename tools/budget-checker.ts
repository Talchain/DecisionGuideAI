#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, basename } from 'path';
import { execSync } from 'child_process';
import { parse as parseYaml } from 'yaml';
import type { SARBBundle } from './sarb-pack.js';

interface BudgetLimits {
  daily?: number;
  weekly?: number;
  monthly?: number;
  tokens?: number;
  cost?: number;
  requests?: number;
}

interface QuotaUsage {
  tokens: number;
  cost: number;
  requests: number;
  resetDate: string;
  period: 'daily' | 'weekly' | 'monthly';
}

interface BudgetConfig {
  enabled: boolean;
  limits: BudgetLimits;
  warnings: {
    thresholds: number[]; // e.g., [0.8, 0.9, 0.95] for 80%, 90%, 95%
  };
  quotaFile?: string; // Path to usage tracking file
}

interface PriceModel {
  input: number;  // $ per 1K tokens
  output: number; // $ per 1K tokens
}

interface PricesConfig {
  models: Record<string, PriceModel>;
  estimations: {
    typical_scenario: { tokens: number; steps: number; duration_ms: number };
    complex_scenario: { tokens: number; steps: number; duration_ms: number };
  };
  advisory_thresholds: {
    tokens: number;
    cost: number;
    duration_ms: number;
  };
}

interface ScenarioYAML {
  title: string;
  description?: string;
  context?: any;
  options?: any[];
  constraints?: string[];
  params?: {
    maxTokens?: number;
    steps?: number;
    model?: string;
    seed?: number;
  };
}

class BudgetChecker {
  private config: BudgetConfig;
  private projectRoot = process.cwd();

  constructor() {
    this.config = this.loadConfig();
  }

  log(message: string): void {
    console.log(message);
  }

  warn(message: string): void {
    console.warn(`⚠️  ${message}`);
  }

  error(message: string): void {
    console.error(`❌ ${message}`);
  }

  /**
   * Load budget configuration (defaults to OFF)
   */
  loadConfig(): BudgetConfig {
    const configPath = resolve('.budget-config.yaml');

    // Default config (OFF by default as required)
    const defaultConfig: BudgetConfig = {
      enabled: false,
      limits: {
        daily: 100,      // $100/day
        tokens: 1000000, // 1M tokens
        requests: 10000  // 10k requests
      },
      warnings: {
        thresholds: [0.8, 0.9, 0.95]
      },
      quotaFile: '.quota-usage.json'
    };

    if (!existsSync(configPath)) {
      return defaultConfig;
    }

    try {
      const content = readFileSync(configPath, 'utf8');
      const userConfig = parseYaml(content) as Partial<BudgetConfig>;

      return {
        ...defaultConfig,
        ...userConfig,
        limits: { ...defaultConfig.limits, ...userConfig.limits },
        warnings: { ...defaultConfig.warnings, ...userConfig.warnings }
      };
    } catch (error) {
      this.warn(`Failed to load budget config: ${error}`);
      return defaultConfig;
    }
  }

  /**
   * Load current quota usage
   */
  loadQuotaUsage(): QuotaUsage | null {
    if (!this.config.quotaFile) return null;

    const quotaPath = resolve(this.config.quotaFile);
    if (!existsSync(quotaPath)) return null;

    try {
      const content = readFileSync(quotaPath, 'utf8');
      const usage = JSON.parse(content) as QuotaUsage;

      // Check if usage data is stale (reset period passed)
      const resetDate = new Date(usage.resetDate);
      const now = new Date();

      if (now > resetDate) {
        // Usage data is stale, return clean slate
        return null;
      }

      return usage;
    } catch (error) {
      this.warn(`Failed to load quota usage: ${error}`);
      return null;
    }
  }

  /**
   * Load pricing configuration
   */
  loadPrices(pricesPath?: string): PricesConfig | null {
    const defaultPath = resolve('artifacts/prices.dev.json');
    const configPath = pricesPath || defaultPath;

    if (!existsSync(configPath)) {
      this.warn(`Prices file not found: ${configPath}`);
      return null;
    }

    try {
      const content = readFileSync(configPath, 'utf8');
      return JSON.parse(content) as PricesConfig;
    } catch (error) {
      this.warn(`Failed to load prices: ${error}`);
      return null;
    }
  }

  /**
   * Load SARB bundle for estimation
   */
  loadBundle(zipPath: string): SARBBundle | null {
    if (!existsSync(zipPath)) {
      return null;
    }

    const tempDir = resolve('tmp', `budget-check-${Date.now()}`);
    const jsonFile = basename(zipPath).replace('.sarb.zip', '.sarb.json');

    try {
      execSync(`mkdir -p "${tempDir}"`, { stdio: 'pipe' });
      execSync(`cd "${tempDir}" && unzip -q "${zipPath}"`, { stdio: 'pipe' });

      const jsonPath = resolve(tempDir, jsonFile);
      const content = readFileSync(jsonPath, 'utf8');
      const bundle = JSON.parse(content) as SARBBundle;

      execSync(`rm -rf "${tempDir}"`, { stdio: 'pipe' });
      return bundle;

    } catch (error) {
      try { execSync(`rm -rf "${tempDir}"`, { stdio: 'pipe' }); } catch {}
      return null;
    }
  }

  /**
   * Load scenario YAML for estimation
   */
  loadScenario(yamlPath: string): ScenarioYAML | null {
    if (!existsSync(yamlPath)) {
      return null;
    }

    try {
      const content = readFileSync(yamlPath, 'utf8');
      return parseYaml(content) as ScenarioYAML;
    } catch (error) {
      this.warn(`Failed to load scenario: ${error}`);
      return null;
    }
  }

  /**
   * Estimate cost and tokens for a scenario or bundle
   */
  estimateUsage(input: SARBBundle | ScenarioYAML, prices: PricesConfig): {
    tokens: number;
    cost: number;
    duration_ms: number;
    model: string;
  } {
    let tokens: number;
    let model: string;
    let duration_ms: number;

    if ('results' in input) {
      // SARB bundle - use actual results
      tokens = input.results.tokensGenerated;
      model = input.execution.params.model;
      duration_ms = input.results.duration;
    } else {
      // Scenario YAML - estimate based on complexity
      const optionCount = input.options?.length || 1;
      const constraintCount = input.constraints?.length || 0;
      const hasContext = Boolean(input.context);

      // Simple heuristic for estimation
      const complexity = optionCount + constraintCount + (hasContext ? 1 : 0);

      if (complexity >= 5) {
        tokens = prices.estimations.complex_scenario.tokens;
        duration_ms = prices.estimations.complex_scenario.duration_ms;
      } else {
        tokens = prices.estimations.typical_scenario.tokens;
        duration_ms = prices.estimations.typical_scenario.duration_ms;
      }

      // Override with scenario params if provided
      if (input.params?.maxTokens) {
        tokens = input.params.maxTokens;
      }

      model = input.params?.model || 'gpt-4-turbo';
    }

    // Calculate cost based on model pricing
    const modelPricing = prices.models[model] || prices.models['gpt-4-turbo'];
    const cost = (tokens / 1000) * modelPricing.output; // Assume mostly output tokens

    return { tokens, cost, duration_ms, model };
  }

  /**
   * Perform preflight check with advisory warnings
   */
  preflightAdvice(inputPath: string, pricesPath?: string): boolean {
    const enabled = process.env.BUDGET_PREFLIGHT_ENABLED === '1';
    const alertOnly = process.env.ALERT_ONLY !== '0'; // Default ON for PoC

    if (!enabled) {
      this.log(`💰 Budget preflight: OFF (set BUDGET_PREFLIGHT_ENABLED=1 to enable)`);
      return true;
    }

    this.log(`💰 Budget preflight check: ${basename(inputPath)}`);

    const prices = this.loadPrices(pricesPath);
    if (!prices) {
      this.log(`   ⚠️  No pricing data available - skipping estimation`);
      return true;
    }

    // Load input (bundle or scenario)
    let input: SARBBundle | ScenarioYAML | null = null;

    if (inputPath.endsWith('.sarb.zip')) {
      input = this.loadBundle(inputPath);
    } else if (inputPath.endsWith('.yaml') || inputPath.endsWith('.yml')) {
      input = this.loadScenario(inputPath);
    }

    if (!input) {
      this.warn(`Could not load input: ${inputPath}`);
      return alertOnly;
    }

    const estimation = this.estimateUsage(input, prices);
    const thresholds = prices.advisory_thresholds;

    this.log(`   📊 Estimation: ${estimation.tokens.toLocaleString()} tokens, $${estimation.cost.toFixed(4)}, ${Math.round(estimation.duration_ms/1000)}s`);
    this.log(`   🤖 Model: ${estimation.model}`);

    let hasAdvisories = false;

    // Check against advisory thresholds
    if (estimation.tokens > thresholds.tokens) {
      hasAdvisories = true;
      this.warn(`High token usage: ${estimation.tokens.toLocaleString()} > ${thresholds.tokens.toLocaleString()}`);

      const suggestedCap = Math.floor(thresholds.tokens * 0.8);
      this.log(`   💡 Suggestion: Consider capping maxTokens to ${suggestedCap.toLocaleString()}`);
    }

    if (estimation.cost > thresholds.cost) {
      hasAdvisories = true;
      this.warn(`High estimated cost: $${estimation.cost.toFixed(4)} > $${thresholds.cost.toFixed(4)}`);

      this.log(`   💡 Suggestion: Consider using a more cost-effective model or reducing scope`);
    }

    if (estimation.duration_ms > thresholds.duration_ms) {
      hasAdvisories = true;
      this.warn(`Long estimated duration: ${Math.round(estimation.duration_ms/1000)}s > ${Math.round(thresholds.duration_ms/1000)}s`);

      this.log(`   💡 Suggestion: Consider reducing steps or complexity for faster results`);
    }

    if (!hasAdvisories) {
      this.log(`   ✅ Estimation within advisory thresholds`);
    }

    return true; // Always allow in advisory mode
  }

  /**
   * Update quota usage with new consumption
   */
  updateQuotaUsage(tokens: number, cost: number, requests: number = 1): void {
    if (!this.config.enabled || !this.config.quotaFile) return;

    const currentUsage = this.loadQuotaUsage() || {
      tokens: 0,
      cost: 0,
      requests: 0,
      resetDate: this.getNextResetDate().toISOString(),
      period: 'daily' as const
    };

    currentUsage.tokens += tokens;
    currentUsage.cost += cost;
    currentUsage.requests += requests;

    try {
      const quotaPath = resolve(this.config.quotaFile);
      writeFileSync(quotaPath, JSON.stringify(currentUsage, null, 2));
    } catch (error) {
      this.warn(`Failed to update quota usage: ${error}`);
    }
  }

  /**
   * Get next reset date (daily by default)
   */
  getNextResetDate(): Date {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Calculate usage percentage against limits
   */
  calculateUsagePercentage(current: number, limit: number): number {
    if (limit === 0) return 0;
    return Math.min(current / limit, 1.0);
  }

  /**
   * Check if usage exceeds warning thresholds
   */
  checkThresholds(percentage: number): string | null {
    const thresholds = this.config.warnings.thresholds.sort((a, b) => b - a);

    for (const threshold of thresholds) {
      if (percentage >= threshold) {
        return `${Math.round(threshold * 100)}%`;
      }
    }

    return null;
  }

  /**
   * Pre-flight budget check before running scenario
   */
  preflightCheck(estimatedTokens?: number, estimatedCost?: number): boolean {
    if (!this.config.enabled) {
      this.log(`💰 Budget checker: OFF (enable in .budget-config.yaml)`);
      return true;
    }

    this.log(`💰 Pre-flight budget check...`);

    const usage = this.loadQuotaUsage();
    const limits = this.config.limits;

    if (!usage) {
      this.log(`   ✅ No usage data - clean slate`);
      return true;
    }

    let hasWarnings = false;

    // Check current usage against limits
    if (limits.cost && usage.cost > 0) {
      const costPercent = this.calculateUsagePercentage(usage.cost, limits.cost);
      const threshold = this.checkThresholds(costPercent);

      if (threshold) {
        this.warn(`Cost usage at ${threshold} ($${usage.cost.toFixed(4)}/$${limits.cost})`);
        hasWarnings = true;
      }
    }

    if (limits.tokens && usage.tokens > 0) {
      const tokenPercent = this.calculateUsagePercentage(usage.tokens, limits.tokens);
      const threshold = this.checkThresholds(tokenPercent);

      if (threshold) {
        this.warn(`Token usage at ${threshold} (${usage.tokens.toLocaleString()}/${limits.tokens.toLocaleString()})`);
        hasWarnings = true;
      }
    }

    if (limits.requests && usage.requests > 0) {
      const requestPercent = this.calculateUsagePercentage(usage.requests, limits.requests);
      const threshold = this.checkThresholds(requestPercent);

      if (threshold) {
        this.warn(`Request usage at ${threshold} (${usage.requests}/${limits.requests})`);
        hasWarnings = true;
      }
    }

    // Check if estimated usage would exceed limits
    if (estimatedCost && limits.cost) {
      const projectedCost = usage.cost + estimatedCost;
      if (projectedCost > limits.cost) {
        this.error(`Estimated cost $${estimatedCost.toFixed(4)} would exceed limit (current: $${usage.cost.toFixed(4)}, limit: $${limits.cost})`);
        return false;
      }
    }

    if (estimatedTokens && limits.tokens) {
      const projectedTokens = usage.tokens + estimatedTokens;
      if (projectedTokens > limits.tokens) {
        this.error(`Estimated ${estimatedTokens.toLocaleString()} tokens would exceed limit (current: ${usage.tokens.toLocaleString()}, limit: ${limits.tokens.toLocaleString()})`);
        return false;
      }
    }

    if (!hasWarnings) {
      this.log(`   ✅ Usage within acceptable limits`);
    }

    // Show reset info
    this.log(`   Reset: ${usage.resetDate}`);

    return true;
  }

  /**
   * Generate budget status report
   */
  generateStatusReport(): void {
    if (!this.config.enabled) {
      this.log(`📊 Budget Status: DISABLED`);
      this.log(`   Enable in .budget-config.yaml to track usage`);
      return;
    }

    this.log(`📊 Budget Status Report`);

    const usage = this.loadQuotaUsage();
    const limits = this.config.limits;

    if (!usage) {
      this.log(`   No usage data available`);
      this.log(`   Next reset: ${this.getNextResetDate().toISOString()}`);
      return;
    }

    // Cost status
    if (limits.cost) {
      const percent = this.calculateUsagePercentage(usage.cost, limits.cost);
      const bar = this.generateProgressBar(percent);
      this.log(`   💳 Cost: ${bar} $${usage.cost.toFixed(4)}/$${limits.cost} (${Math.round(percent * 100)}%)`);
    }

    // Token status
    if (limits.tokens) {
      const percent = this.calculateUsagePercentage(usage.tokens, limits.tokens);
      const bar = this.generateProgressBar(percent);
      this.log(`   🪙 Tokens: ${bar} ${usage.tokens.toLocaleString()}/${limits.tokens.toLocaleString()} (${Math.round(percent * 100)}%)`);
    }

    // Request status
    if (limits.requests) {
      const percent = this.calculateUsagePercentage(usage.requests, limits.requests);
      const bar = this.generateProgressBar(percent);
      this.log(`   📞 Requests: ${bar} ${usage.requests}/${limits.requests} (${Math.round(percent * 100)}%)`);
    }

    this.log(`   🔄 Reset: ${usage.resetDate}`);
  }

  /**
   * Generate visual progress bar
   */
  generateProgressBar(percentage: number, width: number = 20): string {
    const filled = Math.round(percentage * width);
    const empty = width - filled;

    let color = '█'; // Green
    if (percentage > 0.9) color = '█'; // Red
    else if (percentage > 0.8) color = '█'; // Yellow

    return '[' + color.repeat(filled) + '░'.repeat(empty) + ']';
  }

  /**
   * Initialize budget config file
   */
  initConfig(): void {
    const configPath = resolve('.budget-config.yaml');

    if (existsSync(configPath)) {
      this.log(`💰 Budget config already exists: ${configPath}`);
      return;
    }

    const defaultConfig = `# Budget & Quota Configuration
# OFF by default - set enabled: true to activate

enabled: false

limits:
  # Daily cost limit in USD
  daily: 100
  # Token limit per period
  tokens: 1000000
  # Request limit per period
  requests: 10000

warnings:
  # Warning thresholds (as percentages)
  thresholds: [0.8, 0.9, 0.95]

# Usage tracking file
quotaFile: '.quota-usage.json'
`;

    writeFileSync(configPath, defaultConfig);
    this.log(`💰 Created budget config: ${configPath}`);
    this.log(`   Edit file and set enabled: true to activate`);
  }

  /**
   * Main CLI entry point
   */
  run(command: string, args: string[]): void {
    switch (command) {
      case 'init':
        this.initConfig();
        break;

      case 'status':
        this.generateStatusReport();
        break;

      case 'check':
        // Handle both old API (tokens, cost) and new preflight API (file path)
        if (args.length >= 1 && (args[0].endsWith('.sarb.zip') || args[0].endsWith('.yaml') || args[0].endsWith('.yml'))) {
          // New preflight API
          const inputPath = args[0];
          const pricesIndex = args.findIndex(arg => arg === '--prices');
          const pricesPath = pricesIndex >= 0 ? args[pricesIndex + 1] : undefined;

          const canProceed = this.preflightAdvice(inputPath, pricesPath);
          process.exit(canProceed ? 0 : 1);
        } else {
          // Old API - manual token/cost estimation
          const estimatedTokens = args[0] ? parseInt(args[0]) : undefined;
          const estimatedCost = args[1] ? parseFloat(args[1]) : undefined;

          const canProceed = this.preflightCheck(estimatedTokens, estimatedCost);
          process.exit(canProceed ? 0 : 1);
        }
        break;

      case 'update':
        if (args.length < 3) {
          console.error('Usage: npm run budget:update -- <tokens> <cost> [requests]');
          process.exit(1);
        }

        const tokens = parseInt(args[0]);
        const cost = parseFloat(args[1]);
        const requests = args[2] ? parseInt(args[2]) : 1;

        this.updateQuotaUsage(tokens, cost, requests);
        this.log(`💰 Updated usage: ${tokens} tokens, $${cost.toFixed(4)}, ${requests} requests`);
        break;

      default:
        console.error('Unknown command. Available: init, status, check, update');
        process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const budgetChecker = new BudgetChecker();
  const command = process.argv[2];
  const args = process.argv.slice(3);

  if (!command) {
    console.error('Usage: npm run budget:<command> -- [args]');
    console.error('Commands: init, status, check, update');
    process.exit(1);
  }

  budgetChecker.run(command, args);
}

export { BudgetChecker };