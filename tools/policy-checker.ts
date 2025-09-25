#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { resolve, basename } from 'path';
import { execSync } from 'child_process';
import { parse as parseYaml } from 'yaml';
import type { SARBBundle } from './sarb-pack.js';

interface PolicyRule {
  name: string;
  description: string;
  patterns?: string[];
  case_sensitive?: boolean;
  severity: 'low' | 'medium' | 'high';
}

interface PolicyConfig {
  version: string;
  enabled: boolean;
  rules: {
    banned_terms?: PolicyRule[];
    hostname_rules?: {
      allow_list?: string[];
      deny_list?: string[];
      severity: 'low' | 'medium' | 'high';
    };
    resource_limits?: {
      max_tokens?: { limit: number; severity: string; description: string };
      max_steps?: { limit: number; severity: string; description: string };
      max_duration_minutes?: { limit: number; severity: string; description: string };
    };
  };
  compliance?: any;
  alerts?: {
    log_violations: boolean;
    fail_on_violation: boolean;
    notification_threshold: string;
  };
  exemptions?: {
    scenarios?: string[];
    users?: string[];
  };
}

interface PolicyViolation {
  rule: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  location: string;
  matched: string;
  context?: string;
}

class PolicyChecker {
  private config: PolicyConfig;
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
   * Load policy configuration
   */
  loadConfig(): PolicyConfig {
    const configPath = resolve('artifacts/policy.rules.yaml');

    // Default minimal config if file doesn't exist
    const defaultConfig: PolicyConfig = {
      version: '1.0',
      enabled: false,
      rules: {},
      alerts: {
        log_violations: true,
        fail_on_violation: false,
        notification_threshold: 'medium'
      }
    };

    if (!existsSync(configPath)) {
      return defaultConfig;
    }

    try {
      const content = readFileSync(configPath, 'utf8');
      const config = parseYaml(content) as PolicyConfig;
      return { ...defaultConfig, ...config };
    } catch (error) {
      this.warn(`Failed to load policy config: ${error}`);
      return defaultConfig;
    }
  }

  /**
   * Load SARB bundle for checking
   */
  loadBundle(zipPath: string): SARBBundle | null {
    if (!existsSync(zipPath)) {
      return null;
    }

    const tempDir = resolve('tmp', `policy-check-${Date.now()}`);
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
   * Check if scenario is exempted
   */
  isExempted(scenarioTitle: string): boolean {
    if (!this.config.exemptions?.scenarios) return false;

    return this.config.exemptions.scenarios.some(pattern => {
      // Simple glob pattern matching
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(scenarioTitle.toLowerCase());
    });
  }

  /**
   * Check for banned terms in content
   */
  checkBannedTerms(content: string, location: string): PolicyViolation[] {
    const violations: PolicyViolation[] = [];
    const bannedTerms = this.config.rules.banned_terms || [];

    for (const rule of bannedTerms) {
      if (!rule.patterns) continue;

      for (const pattern of rule.patterns) {
        const flags = rule.case_sensitive === false ? 'gi' : 'g';
        const regex = new RegExp(pattern, flags);
        const matches = content.match(regex);

        if (matches) {
          violations.push({
            rule: rule.name,
            severity: rule.severity,
            description: rule.description,
            location,
            matched: matches[0],
            context: this.extractContext(content, matches[0])
          });
        }
      }
    }

    return violations;
  }

  /**
   * Extract context around a matched term
   */
  extractContext(content: string, match: string): string {
    const index = content.indexOf(match);
    const start = Math.max(0, index - 20);
    const end = Math.min(content.length, index + match.length + 20);
    return content.substring(start, end).replace(/\n/g, ' ');
  }

  /**
   * Check resource limits
   */
  checkResourceLimits(bundle: SARBBundle): PolicyViolation[] {
    const violations: PolicyViolation[] = [];
    const limits = this.config.rules.resource_limits;

    if (!limits) return violations;

    // Check token limit
    if (limits.max_tokens && bundle.results.tokensGenerated > limits.max_tokens.limit) {
      violations.push({
        rule: 'resource_limits.max_tokens',
        severity: limits.max_tokens.severity as any,
        description: limits.max_tokens.description,
        location: 'bundle.results.tokensGenerated',
        matched: bundle.results.tokensGenerated.toString(),
        context: `Limit: ${limits.max_tokens.limit}, Actual: ${bundle.results.tokensGenerated}`
      });
    }

    // Check step limit
    if (limits.max_steps && bundle.results.steps.length > limits.max_steps.limit) {
      violations.push({
        rule: 'resource_limits.max_steps',
        severity: limits.max_steps.severity as any,
        description: limits.max_steps.description,
        location: 'bundle.results.steps',
        matched: bundle.results.steps.length.toString(),
        context: `Limit: ${limits.max_steps.limit}, Actual: ${bundle.results.steps.length}`
      });
    }

    // Check duration limit
    if (limits.max_duration_minutes) {
      const durationMinutes = bundle.results.duration / (1000 * 60);
      if (durationMinutes > limits.max_duration_minutes.limit) {
        violations.push({
          rule: 'resource_limits.max_duration_minutes',
          severity: limits.max_duration_minutes.severity as any,
          description: limits.max_duration_minutes.description,
          location: 'bundle.results.duration',
          matched: `${durationMinutes.toFixed(1)} minutes`,
          context: `Limit: ${limits.max_duration_minutes.limit} minutes, Actual: ${durationMinutes.toFixed(1)} minutes`
        });
      }
    }

    return violations;
  }

  /**
   * Run policy check on SARB bundle
   */
  checkBundle(bundlePath: string): PolicyViolation[] {
    const enabled = process.env.POLICY_CHECK_ENABLED === '1' || this.config.enabled;

    if (!enabled) {
      this.log(`🛡️  Policy checker: OFF (set POLICY_CHECK_ENABLED=1 to enable)`);
      return [];
    }

    this.log(`🛡️  Policy check: ${basename(bundlePath)}`);

    const bundle = this.loadBundle(bundlePath);
    if (!bundle) {
      this.warn(`Could not load bundle: ${bundlePath}`);
      return [];
    }

    // Check exemptions
    if (this.isExempted(bundle.scenario.title)) {
      this.log(`   ✅ Scenario exempted: ${bundle.scenario.title}`);
      return [];
    }

    const violations: PolicyViolation[] = [];

    // Check banned terms in transcript
    violations.push(...this.checkBannedTerms(bundle.transcript.markdown, 'transcript'));

    // Check banned terms in scenario title/description
    violations.push(...this.checkBannedTerms(bundle.scenario.title, 'scenario.title'));
    if (bundle.scenario.description) {
      violations.push(...this.checkBannedTerms(bundle.scenario.description, 'scenario.description'));
    }

    // Check resource limits
    violations.push(...this.checkResourceLimits(bundle));

    return violations;
  }

  /**
   * Generate advisory report
   */
  generateReport(violations: PolicyViolation[]): void {
    if (violations.length === 0) {
      this.log(`   ✅ No policy violations detected`);
      return;
    }

    this.log(`   📋 Policy Advisory Report (${violations.length} items)`);

    const violationsBySeverity = violations.reduce((acc, v) => {
      acc[v.severity] = acc[v.severity] || [];
      acc[v.severity].push(v);
      return acc;
    }, {} as Record<string, PolicyViolation[]>);

    // Report by severity
    for (const severity of ['high', 'medium', 'low']) {
      const severityViolations = violationsBySeverity[severity];
      if (!severityViolations) continue;

      this.log(`\n   🔸 ${severity.toUpperCase()} (${severityViolations.length})`);

      severityViolations.forEach(violation => {
        this.log(`      • ${violation.rule}: ${violation.description}`);
        this.log(`        Location: ${violation.location}`);
        this.log(`        Matched: "${violation.matched}"`);
        if (violation.context) {
          this.log(`        Context: ...${violation.context}...`);
        }
      });
    }

    this.log(`\n   💡 This is advisory only - execution not blocked`);
    this.log(`   📖 Review artifacts/policy.rules.yaml for rule details`);
  }

  /**
   * Main CLI entry point
   */
  run(args: string[]): void {
    if (args.length < 1) {
      console.error('Usage: npm run policy:check -- <bundle.sarb.zip> [--rules <rules.yaml>]');
      console.error('Example: npm run policy:check -- artifacts/runs/framework.sarb.zip');
      process.exit(1);
    }

    const bundlePath = resolve(args[0]);

    try {
      const violations = this.checkBundle(bundlePath);
      this.generateReport(violations);

      // Exit code 0 - advisory only, never fail
      process.exit(0);

    } catch (error) {
      console.error(`❌ Policy check failed: ${error}`);
      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const policyChecker = new PolicyChecker();
  policyChecker.run(process.argv.slice(2));
}

export { PolicyChecker };