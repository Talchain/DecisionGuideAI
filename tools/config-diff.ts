#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

interface ConfigEntry {
  key: string;
  value: string;
  line: number;
}

interface ConfigDiff {
  key: string;
  fileA?: ConfigEntry;
  fileB?: ConfigEntry;
  risk: 'low' | 'medium' | 'high';
  reason: string;
}

class ConfigDiffTool {
  private powerfulFeatureKeys = new Set([
    'ENABLE_RATE_LIMITING',
    'ENABLE_CACHING',
    'ENABLE_USAGE_TRACKING',
    'ENABLE_TELEMETRY',
    'ENABLE_MONITORING',
    'ENABLE_SECRET_HYGIENE',
    'ENABLE_SLO_TRACKING',
    'ENABLE_SSE_EXTRAS',
    'ENABLE_ADVANCED_ANALYTICS',
    'ENABLE_BATCH_PROCESSING',
    'ENABLE_WEBHOOK_DELIVERY',
    'ENABLE_EMAIL_NOTIFICATIONS',
    'ENABLE_SLACK_INTEGRATION',
    'ENABLE_AUDIT_LOGGING',
    'ENABLE_PERFORMANCE_PROFILING',
    'ENABLE_DEBUG_MODE',
    'ENABLE_DATA_EXPORT',
    'ENABLE_BULK_OPERATIONS',
    'ENABLE_AUTO_SCALING',
    'ENABLE_BACKGROUND_JOBS',
    'ENABLE_HMAC_SIGNING',
    'ENABLE_API_KEY_ROTATION',
    'ENABLE_SESSION_PERSISTENCE',
    'ENABLE_CROSS_ORIGIN_REQUESTS'
  ]);

  private secretKeys = new Set([
    'API_KEY',
    'SECRET_KEY',
    'DATABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET',
    'WEBHOOK_SECRET',
    'ENCRYPTION_KEY'
  ]);

  parseEnvFile(filePath: string): Map<string, ConfigEntry> {
    const config = new Map<string, ConfigEntry>();

    if (!existsSync(filePath)) {
      return config;
    }

    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) return;

      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) return;

      const key = trimmed.substring(0, equalIndex).trim();
      const value = trimmed.substring(equalIndex + 1).trim();

      config.set(key, {
        key,
        value,
        line: index + 1
      });
    });

    return config;
  }

  assessRisk(key: string, valueA?: string, valueB?: string): { risk: 'low' | 'medium' | 'high', reason: string } {
    // High risk: Powerful features being enabled
    if (this.powerfulFeatureKeys.has(key)) {
      const aEnabled = valueA === 'true';
      const bEnabled = valueB === 'true';

      if (aEnabled && !bEnabled) {
        return { risk: 'high', reason: 'Powerful feature enabled in first file' };
      }
      if (!aEnabled && bEnabled) {
        return { risk: 'high', reason: 'Powerful feature enabled in second file' };
      }
      if (aEnabled && bEnabled) {
        return { risk: 'medium', reason: 'Powerful feature enabled in both files' };
      }
      return { risk: 'low', reason: 'Feature disabled in both files' };
    }

    // Medium risk: Secret keys present
    if (this.secretKeys.has(key) || key.includes('SECRET') || key.includes('KEY')) {
      if (valueA && !valueB) {
        return { risk: 'medium', reason: 'Secret present only in first file' };
      }
      if (!valueA && valueB) {
        return { risk: 'medium', reason: 'Secret present only in second file' };
      }
      if (valueA && valueB && valueA !== valueB) {
        return { risk: 'medium', reason: 'Different secret values' };
      }
      return { risk: 'low', reason: 'Secret configuration matches' };
    }

    // Low risk: Regular configuration differences
    if (valueA !== valueB) {
      return { risk: 'low', reason: 'Configuration value differs' };
    }

    return { risk: 'low', reason: 'No difference' };
  }

  compareConfigs(filePathA: string, filePathB: string): ConfigDiff[] {
    const configA = this.parseEnvFile(filePathA);
    const configB = this.parseEnvFile(filePathB);

    const allKeys = new Set([...configA.keys(), ...configB.keys()]);
    const diffs: ConfigDiff[] = [];

    allKeys.forEach(key => {
      const entryA = configA.get(key);
      const entryB = configB.get(key);

      const valueA = entryA?.value;
      const valueB = entryB?.value;

      // Only include if there's actually a difference or risk
      if (valueA !== valueB || this.powerfulFeatureKeys.has(key) || this.secretKeys.has(key)) {
        const { risk, reason } = this.assessRisk(key, valueA, valueB);

        diffs.push({
          key,
          fileA: entryA,
          fileB: entryB,
          risk,
          reason
        });
      }
    });

    // Sort by risk level, then by key name
    return diffs.sort((a, b) => {
      const riskOrder = { high: 3, medium: 2, low: 1 };
      const riskDiff = riskOrder[b.risk] - riskOrder[a.risk];
      return riskDiff !== 0 ? riskDiff : a.key.localeCompare(b.key);
    });
  }

  formatOutput(fileA: string, fileB: string, diffs: ConfigDiff[]): string {
    const output: string[] = [];

    output.push('Config Diff Report');
    output.push('='.repeat(50));
    output.push(`Comparing: ${fileA} ↔ ${fileB}`);
    output.push('');

    if (diffs.length === 0) {
      output.push('✅ No significant differences found');
      return output.join('\n');
    }

    // Group by risk level
    const riskGroups = {
      high: diffs.filter(d => d.risk === 'high'),
      medium: diffs.filter(d => d.risk === 'medium'),
      low: diffs.filter(d => d.risk === 'low')
    };

    ['high', 'medium', 'low'].forEach(riskLevel => {
      const group = riskGroups[riskLevel as keyof typeof riskGroups];
      if (group.length === 0) return;

      const icon = riskLevel === 'high' ? '🚨' : riskLevel === 'medium' ? '⚠️' : 'ℹ️';
      output.push(`${icon} ${riskLevel.toUpperCase()} RISK (${group.length} items)`);
      output.push('-'.repeat(30));

      group.forEach(diff => {
        output.push(`Key: ${diff.key}`);
        output.push(`Reason: ${diff.reason}`);

        if (diff.fileA && diff.fileB) {
          output.push(`  ${fileA} (line ${diff.fileA.line}): ${diff.fileA.value}`);
          output.push(`  ${fileB} (line ${diff.fileB.line}): ${diff.fileB.value}`);
        } else if (diff.fileA) {
          output.push(`  ${fileA} (line ${diff.fileA.line}): ${diff.fileA.value}`);
          output.push(`  ${fileB}: <not set>`);
        } else if (diff.fileB) {
          output.push(`  ${fileA}: <not set>`);
          output.push(`  ${fileB} (line ${diff.fileB.line}): ${diff.fileB.value}`);
        }
        output.push('');
      });
    });

    // Summary
    output.push('Summary:');
    output.push(`🚨 High Risk: ${riskGroups.high.length}`);
    output.push(`⚠️  Medium Risk: ${riskGroups.medium.length}`);
    output.push(`ℹ️  Low Risk: ${riskGroups.low.length}`);

    return output.join('\n');
  }

  run(args: string[]): void {
    if (args.length < 2) {
      console.error('Usage: npm run config:diff -- <file1> <file2>');
      console.error('Example: npm run config:diff -- .env.example .env.poc');
      process.exit(1);
    }

    const fileA = resolve(args[0]);
    const fileB = resolve(args[1]);

    if (!existsSync(fileA)) {
      console.error(`File not found: ${fileA}`);
      process.exit(1);
    }

    if (!existsSync(fileB)) {
      console.error(`File not found: ${fileB}`);
      process.exit(1);
    }

    const diffs = this.compareConfigs(fileA, fileB);
    const output = this.formatOutput(args[0], args[1], diffs);

    console.log(output);

    // Exit with error code if high-risk differences found
    const hasHighRisk = diffs.some(d => d.risk === 'high');
    process.exit(hasHighRisk ? 1 : 0);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tool = new ConfigDiffTool();
  tool.run(process.argv.slice(2));
}

export { ConfigDiffTool };