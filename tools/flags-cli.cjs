#!/usr/bin/env node
/**
 * Flags CLI - Print current effective configuration with secrets redacted
 * Usage: npm run flags:print [--include-secrets] [--format json|table|summary]
 */

const fs = require('fs');
const path = require('path');

// Mock environment for flag registry (since we can't import ES modules directly in Node.js)
const mockEnv = {
  // Load from actual .env files if they exist
  ...loadEnvFile('.env'),
  ...loadEnvFile('.env.local'),
  ...loadEnvFile('.env.poc'),
  // Override with process.env
  ...process.env
};

function loadEnvFile(filename) {
  const envPath = path.join(process.cwd(), filename);
  if (!fs.existsSync(envPath)) return {};

  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      env[key] = valueParts.join('=');
    }
  }

  return env;
}

// Simplified flag registry (Node.js compatible)
const FLAG_REGISTRY = {
  // Core features
  'VITE_FEATURE_SSE': {
    name: 'Server-Sent Events Streaming',
    defaultValue: false,
    type: 'boolean',
    category: 'feature',
    riskLevel: 'medium'
  },
  'VITE_FEATURE_JOBS_PROGRESS': {
    name: 'Job Progress Tracking',
    defaultValue: false,
    type: 'boolean',
    category: 'feature',
    riskLevel: 'low'
  },
  'VITE_FEATURE_RUN_REPORT': {
    name: 'Run Reports',
    defaultValue: false,
    type: 'boolean',
    category: 'feature',
    riskLevel: 'low'
  },
  'VITE_USE_REAL_REPORT': {
    name: 'Real Report Data',
    defaultValue: false,
    type: 'boolean',
    category: 'advanced',
    riskLevel: 'medium'
  },
  'VITE_FEATURE_TELEMETRY': {
    name: 'Anonymous Telemetry',
    defaultValue: false,
    type: 'boolean',
    category: 'performance',
    riskLevel: 'low'
  },
  'VITE_FEATURE_HINTS': {
    name: 'UI Hints & Tips',
    defaultValue: false,
    type: 'boolean',
    category: 'feature',
    riskLevel: 'low'
  },
  'VITE_STREAM_BUFFER': {
    name: 'Stream Token Buffering',
    defaultValue: true,
    type: 'boolean',
    category: 'performance',
    riskLevel: 'low'
  },
  'VITE_FEATURE_PARAMS': {
    name: 'Scenario Parameters',
    defaultValue: false,
    type: 'boolean',
    category: 'feature',
    riskLevel: 'low'
  },
  'VITE_FEATURE_MD_PREVIEW': {
    name: 'Markdown Preview',
    defaultValue: false,
    type: 'boolean',
    category: 'feature',
    riskLevel: 'low'
  },
  'VITE_FEATURE_COPY_CODE': {
    name: 'Copy Code Buttons',
    defaultValue: false,
    type: 'boolean',
    category: 'feature',
    riskLevel: 'low'
  },
  'VITE_SIM_MODE': {
    name: 'Simulation Mode',
    defaultValue: false,
    type: 'boolean',
    category: 'demo',
    riskLevel: 'low'
  },
  'VITE_FAST_CANCEL': {
    name: 'Fast Cancel (≤150ms)',
    defaultValue: false,
    type: 'boolean',
    category: 'performance',
    riskLevel: 'low'
  },

  // Security features
  'SECRET_HYGIENE_ENABLED': {
    name: 'Secret Hygiene Scanner',
    defaultValue: false,
    type: 'boolean',
    category: 'security',
    riskLevel: 'critical'
  },
  'ALERT_ONLY': {
    name: 'Alert-Only Mode',
    defaultValue: true,
    type: 'boolean',
    category: 'security',
    riskLevel: 'medium'
  },
  'OPENAPI_ENFORCE': {
    name: 'OpenAPI Contract Enforcement',
    defaultValue: false,
    type: 'boolean',
    category: 'security',
    riskLevel: 'high'
  },
  'LOG_GUARDRAIL_ENABLED': {
    name: 'Log Guardrails',
    defaultValue: false,
    type: 'boolean',
    category: 'security',
    riskLevel: 'critical'
  },

  // Advanced service features
  'SIM_MODE': {
    name: 'Backend Simulation Mode',
    defaultValue: false,
    type: 'boolean',
    category: 'advanced',
    riskLevel: 'low'
  },
  'FAST_CANCEL': {
    name: 'Backend Fast Cancel',
    defaultValue: false,
    type: 'boolean',
    category: 'performance',
    riskLevel: 'low'
  },
  'PROGRESS_ENABLED': {
    name: 'Backend Progress Tracking',
    defaultValue: false,
    type: 'boolean',
    category: 'feature',
    riskLevel: 'low'
  },
  'METER_ENABLED': {
    name: 'Usage Meter',
    defaultValue: false,
    type: 'boolean',
    category: 'performance',
    riskLevel: 'low'
  }
};

function coerceValue(value, type) {
  if (value === undefined || value === null) return undefined;

  switch (type) {
    case 'boolean':
      return value === '1' || value.toLowerCase() === 'true';
    case 'number':
      return parseInt(value, 10);
    case 'string':
      return value;
    default:
      return value;
  }
}

function getFlagValue(key, definition) {
  // Check environment variable
  const envValue = mockEnv[key];
  if (envValue !== undefined) {
    return {
      value: coerceValue(envValue, definition.type),
      source: 'env'
    };
  }

  // Return default
  return {
    value: definition.defaultValue,
    source: 'default'
  };
}

function getAllFlags(includeSecrets = false) {
  const result = {};

  for (const [key, definition] of Object.entries(FLAG_REGISTRY)) {
    // Skip secrets unless explicitly requested
    if (!includeSecrets && (
      definition.riskLevel === 'critical' ||
      definition.category === 'security' ||
      key.toLowerCase().includes('secret') ||
      key.toLowerCase().includes('key') ||
      key.toLowerCase().includes('token')
    )) {
      result[key] = {
        definition,
        currentValue: '***REDACTED***',
        source: 'redacted'
      };
      continue;
    }

    const { value, source } = getFlagValue(key, definition);
    result[key] = {
      definition,
      currentValue: value,
      source
    };
  }

  return result;
}

function printTable(flags) {
  console.log('🏴 Flag Registry - Current Configuration');
  console.log('='.repeat(80));

  const categories = {
    feature: '🚀 Feature Flags',
    security: '🔒 Security & Analysis',
    performance: '⚡ Performance & Optimization',
    demo: '🎭 Demo & Simulation',
    advanced: '⚙️  Advanced Configuration'
  };

  for (const [categoryKey, categoryName] of Object.entries(categories)) {
    const categoryFlags = Object.entries(flags)
      .filter(([_, flag]) => flag.definition.category === categoryKey)
      .sort(([a], [b]) => a.localeCompare(b));

    if (categoryFlags.length === 0) continue;

    console.log(`\n${categoryName}`);
    console.log('-'.repeat(categoryName.length));

    for (const [key, flag] of categoryFlags) {
      const { definition, currentValue, source } = flag;

      const riskIcon = {
        low: '🟢',
        medium: '🟡',
        high: '🟠',
        critical: '🔴'
      }[definition.riskLevel];

      const sourceIcon = {
        env: '🌍',
        localStorage: '💾',
        default: '📋',
        redacted: '🚫'
      }[source];

      const valueStr = source === 'redacted' ? currentValue : String(currentValue);
      const isChanged = currentValue !== definition.defaultValue;
      const changeIndicator = isChanged ? '📝' : '  ';

      console.log(`${changeIndicator} ${riskIcon} ${key}`);
      console.log(`    ${definition.name}`);
      console.log(`    Value: ${valueStr} ${sourceIcon} (${source})`);

      if (isChanged && source !== 'redacted') {
        console.log(`    Default: ${definition.defaultValue}`);
      }

      console.log('');
    }
  }
}

function printJson(flags) {
  const output = {
    timestamp: new Date().toISOString(),
    flags: {}
  };

  for (const [key, flag] of Object.entries(flags)) {
    output.flags[key] = {
      name: flag.definition.name,
      currentValue: flag.currentValue,
      defaultValue: flag.definition.defaultValue,
      source: flag.source,
      category: flag.definition.category,
      riskLevel: flag.definition.riskLevel,
      isChanged: flag.currentValue !== flag.definition.defaultValue
    };
  }

  console.log(JSON.stringify(output, null, 2));
}

function printSummary(flags) {
  const stats = {
    total: 0,
    changed: 0,
    byCategory: {},
    byRisk: {},
    bySource: {}
  };

  for (const [key, flag] of Object.entries(flags)) {
    stats.total++;

    if (flag.currentValue !== flag.definition.defaultValue && flag.source !== 'redacted') {
      stats.changed++;
    }

    // Count by category
    const category = flag.definition.category;
    stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

    // Count by risk
    const risk = flag.definition.riskLevel;
    stats.byRisk[risk] = (stats.byRisk[risk] || 0) + 1;

    // Count by source
    const source = flag.source;
    stats.bySource[source] = (stats.bySource[source] || 0) + 1;
  }

  console.log('📊 Flag Configuration Summary');
  console.log('='.repeat(40));
  console.log(`Total Flags: ${stats.total}`);
  console.log(`Changed from Default: ${stats.changed}`);
  console.log(`Using Defaults: ${stats.total - stats.changed - (stats.bySource.redacted || 0)}`);

  console.log('\n📂 By Category:');
  for (const [category, count] of Object.entries(stats.byCategory)) {
    console.log(`  ${category}: ${count}`);
  }

  console.log('\n⚠️  By Risk Level:');
  const riskIcons = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' };
  for (const [risk, count] of Object.entries(stats.byRisk)) {
    console.log(`  ${riskIcons[risk]} ${risk}: ${count}`);
  }

  console.log('\n📍 By Source:');
  const sourceIcons = { env: '🌍', localStorage: '💾', default: '📋', redacted: '🚫' };
  for (const [source, count] of Object.entries(stats.bySource)) {
    console.log(`  ${sourceIcons[source]} ${source}: ${count}`);
  }

  // Safety check
  const violations = [];
  for (const [key, flag] of Object.entries(flags)) {
    if (flag.source === 'redacted') continue;

    if ((flag.definition.riskLevel === 'high' || flag.definition.riskLevel === 'critical') &&
        flag.currentValue !== flag.definition.defaultValue) {
      violations.push(`${key}: ${flag.definition.riskLevel} risk flag enabled`);
    }
  }

  console.log('\n🔒 Safety Status:');
  if (violations.length === 0) {
    console.log('  ✅ All high-risk flags are in safe default state');
  } else {
    console.log('  ⚠️  High-risk flags enabled:');
    violations.forEach(v => console.log(`    - ${v}`));
  }
}

function main() {
  const args = process.argv.slice(2);
  const includeSecrets = args.includes('--include-secrets');
  const format = args.find(arg => arg.startsWith('--format='))?.split('=')[1] ||
                 (args.includes('--json') ? 'json' :
                  args.includes('--summary') ? 'summary' : 'table');

  const flags = getAllFlags(includeSecrets);

  switch (format) {
    case 'json':
      printJson(flags);
      break;
    case 'summary':
      printSummary(flags);
      break;
    case 'table':
    default:
      printTable(flags);
      break;
  }
}

if (require.main === module) {
  main();
}