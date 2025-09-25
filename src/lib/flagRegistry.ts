/**
 * Flag Registry for Scenario Sandbox PoC
 * Central registry of all feature flags with metadata and management
 */

export interface FlagDefinition {
  key: string;
  name: string;
  description: string;
  defaultValue: boolean | string | number;
  type: 'boolean' | 'string' | 'number';
  category: 'feature' | 'security' | 'performance' | 'demo' | 'advanced';
  environment?: 'client' | 'server' | 'both';
  toggleMethod: 'env' | 'localStorage' | 'both';
  observableBehavior: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  introducedIn?: string;
  deprecatedIn?: string;
  replacedBy?: string;
}

// Central flag registry - single source of truth
export const FLAG_REGISTRY: Record<string, FlagDefinition> = {
  // Core features
  'VITE_FEATURE_SSE': {
    key: 'VITE_FEATURE_SSE',
    name: 'Server-Sent Events Streaming',
    description: 'Enable real-time streaming of analysis results via SSE',
    defaultValue: false,
    type: 'boolean',
    category: 'feature',
    environment: 'client',
    toggleMethod: 'both',
    observableBehavior: 'Stream panel shows real-time token updates; "Start" button initiates streaming',
    riskLevel: 'medium',
    introducedIn: '0.1.0'
  },

  'VITE_FEATURE_JOBS_PROGRESS': {
    key: 'VITE_FEATURE_JOBS_PROGRESS',
    name: 'Job Progress Tracking',
    description: 'Display progress bars and status for background jobs',
    defaultValue: false,
    type: 'boolean',
    category: 'feature',
    environment: 'client',
    toggleMethod: 'both',
    observableBehavior: 'Progress panel appears with job status indicators and completion percentages',
    riskLevel: 'low',
    introducedIn: '0.2.0'
  },

  'VITE_FEATURE_RUN_REPORT': {
    key: 'VITE_FEATURE_RUN_REPORT',
    name: 'Run Reports',
    description: 'Show detailed reports after analysis completion',
    defaultValue: false,
    type: 'boolean',
    category: 'feature',
    environment: 'client',
    toggleMethod: 'both',
    observableBehavior: 'View Report button appears after stream completion; opens drawer with analysis metrics',
    riskLevel: 'low',
    introducedIn: '0.2.0'
  },

  'VITE_USE_REAL_REPORT': {
    key: 'VITE_USE_REAL_REPORT',
    name: 'Real Report Data',
    description: 'Use actual report data from backend instead of mocked samples',
    defaultValue: false,
    type: 'boolean',
    category: 'advanced',
    environment: 'client',
    toggleMethod: 'both',
    observableBehavior: 'Report drawer shows live backend data instead of static mock data',
    riskLevel: 'medium',
    introducedIn: '0.2.0'
  },

  'VITE_FEATURE_TELEMETRY': {
    key: 'VITE_FEATURE_TELEMETRY',
    name: 'Anonymous Telemetry',
    description: 'Collect anonymous usage counters for analytics (no PII)',
    defaultValue: false,
    type: 'boolean',
    category: 'performance',
    environment: 'client',
    toggleMethod: 'both',
    observableBehavior: 'Console shows [TLM] prefixed events; no user data included',
    riskLevel: 'low',
    introducedIn: '0.2.0'
  },

  'VITE_FEATURE_HINTS': {
    key: 'VITE_FEATURE_HINTS',
    name: 'UI Hints & Tips',
    description: 'Show contextual tooltips and helpful hints in the interface',
    defaultValue: false,
    type: 'boolean',
    category: 'feature',
    environment: 'client',
    toggleMethod: 'both',
    observableBehavior: 'Terminal shows chip titles and budget limit tips; idle hints appear',
    riskLevel: 'low',
    introducedIn: '0.2.0'
  },

  'VITE_STREAM_BUFFER': {
    key: 'VITE_STREAM_BUFFER',
    name: 'Stream Token Buffering',
    description: 'Buffer tokens within animation frames for smoother rendering',
    defaultValue: true,
    type: 'boolean',
    category: 'performance',
    environment: 'client',
    toggleMethod: 'both',
    observableBehavior: 'Smoother token updates when ON; immediate updates when OFF',
    riskLevel: 'low',
    introducedIn: '0.2.0'
  },

  'VITE_FEATURE_PARAMS': {
    key: 'VITE_FEATURE_PARAMS',
    name: 'Scenario Parameters',
    description: 'Allow customization of seed, budget, and model parameters',
    defaultValue: false,
    type: 'boolean',
    category: 'feature',
    environment: 'client',
    toggleMethod: 'both',
    observableBehavior: 'Parameter controls appear above stream panel; URL includes params',
    riskLevel: 'low',
    introducedIn: '0.2.0'
  },

  'VITE_FEATURE_MD_PREVIEW': {
    key: 'VITE_FEATURE_MD_PREVIEW',
    name: 'Markdown Preview',
    description: 'Render markdown content with preview formatting',
    defaultValue: false,
    type: 'boolean',
    category: 'feature',
    environment: 'client',
    toggleMethod: 'both',
    observableBehavior: 'Stream output renders with markdown formatting; links are sanitized',
    riskLevel: 'low',
    introducedIn: '0.2.0'
  },

  'VITE_FEATURE_COPY_CODE': {
    key: 'VITE_FEATURE_COPY_CODE',
    name: 'Copy Code Buttons',
    description: 'Add copy buttons to code blocks in stream output',
    defaultValue: false,
    type: 'boolean',
    category: 'feature',
    environment: 'client',
    toggleMethod: 'both',
    observableBehavior: 'Hover over code blocks shows copy button; clicking copies to clipboard',
    riskLevel: 'low',
    introducedIn: '0.2.0'
  },

  // Simulation & Demo Features
  'VITE_SIM_MODE': {
    key: 'VITE_SIM_MODE',
    name: 'Simulation Mode',
    description: 'Use deterministic offline simulation instead of real services',
    defaultValue: false,
    type: 'boolean',
    category: 'demo',
    environment: 'client',
    toggleMethod: 'both',
    observableBehavior: 'Predictable token streams; no external service calls; safe for demos',
    riskLevel: 'low',
    introducedIn: '0.3.0'
  },

  'VITE_FAST_CANCEL': {
    key: 'VITE_FAST_CANCEL',
    name: 'Fast Cancel (≤150ms)',
    description: 'Enable fast-cancel handshake for immediate stream termination',
    defaultValue: false,
    type: 'boolean',
    category: 'performance',
    environment: 'client',
    toggleMethod: 'both',
    observableBehavior: 'Cancel operations complete in under 150ms; metrics tracked',
    riskLevel: 'low',
    introducedIn: '0.3.0'
  },

  // Security & Analysis Features
  'SECRET_HYGIENE_ENABLED': {
    key: 'SECRET_HYGIENE_ENABLED',
    name: 'Secret Hygiene Scanner',
    description: 'Scan code and logs for accidentally exposed secrets',
    defaultValue: false,
    type: 'boolean',
    category: 'security',
    environment: 'server',
    toggleMethod: 'env',
    observableBehavior: 'Server logs show hygiene scan results; blocks deployments with exposed secrets',
    riskLevel: 'critical',
    introducedIn: '0.1.0'
  },

  'ALERT_ONLY': {
    key: 'ALERT_ONLY',
    name: 'Alert-Only Mode',
    description: 'Security scanners log warnings but do not block operations',
    defaultValue: true,
    type: 'boolean',
    category: 'security',
    environment: 'server',
    toggleMethod: 'env',
    observableBehavior: 'Security violations logged as warnings; operations continue normally',
    riskLevel: 'medium',
    introducedIn: '0.1.0'
  },

  'OPENAPI_ENFORCE': {
    key: 'OPENAPI_ENFORCE',
    name: 'OpenAPI Contract Enforcement',
    description: 'Strictly validate API requests/responses against OpenAPI schema',
    defaultValue: false,
    type: 'boolean',
    category: 'security',
    environment: 'server',
    toggleMethod: 'env',
    observableBehavior: 'API calls rejected if they violate OpenAPI specification',
    riskLevel: 'high',
    introducedIn: '0.1.0'
  },

  'LOG_GUARDRAIL_ENABLED': {
    key: 'LOG_GUARDRAIL_ENABLED',
    name: 'Log Guardrails',
    description: 'Prevent logging of PII and raw request/response bodies',
    defaultValue: false,
    type: 'boolean',
    category: 'security',
    environment: 'server',
    toggleMethod: 'env',
    observableBehavior: 'Logs are sanitized; raw payloads blocked; structured logging only',
    riskLevel: 'critical',
    introducedIn: '0.1.0'
  },

  // Advanced Service Features
  'SIM_MODE': {
    key: 'SIM_MODE',
    name: 'Backend Simulation Mode',
    description: 'Run backend services in simulation mode for testing',
    defaultValue: false,
    type: 'boolean',
    category: 'advanced',
    environment: 'server',
    toggleMethod: 'env',
    observableBehavior: 'Backend returns predictable responses; no external API calls made',
    riskLevel: 'low',
    introducedIn: '0.3.0'
  },

  'FAST_CANCEL': {
    key: 'FAST_CANCEL',
    name: 'Backend Fast Cancel',
    description: 'Enable fast-cancel support in backend services',
    defaultValue: false,
    type: 'boolean',
    category: 'performance',
    environment: 'server',
    toggleMethod: 'env',
    observableBehavior: 'Backend processes cancellation requests with <150ms latency',
    riskLevel: 'low',
    introducedIn: '0.3.0'
  },

  'PROGRESS_ENABLED': {
    key: 'PROGRESS_ENABLED',
    name: 'Backend Progress Tracking',
    description: 'Enable detailed progress reporting from backend jobs',
    defaultValue: false,
    type: 'boolean',
    category: 'feature',
    environment: 'server',
    toggleMethod: 'env',
    observableBehavior: 'Backend emits progress events with step completion percentages',
    riskLevel: 'low',
    introducedIn: '0.2.0'
  },

  'METER_ENABLED': {
    key: 'METER_ENABLED',
    name: 'Usage Meter',
    description: 'Track and report resource usage metrics',
    defaultValue: false,
    type: 'boolean',
    category: 'performance',
    environment: 'server',
    toggleMethod: 'env',
    observableBehavior: 'Usage metrics collected and available via /metrics endpoint',
    riskLevel: 'low',
    introducedIn: '0.2.0'
  }
};

// Get current effective value of a flag
export function getFlagValue(key: string): any {
  const flag = FLAG_REGISTRY[key];
  if (!flag) {
    console.warn(`[FlagRegistry] Unknown flag: ${key}`);
    return undefined;
  }

  // Check environment variable first
  const envValue = import.meta.env[key];
  if (envValue !== undefined) {
    return coerceValue(envValue, flag.type);
  }

  // Check localStorage for client-side flags
  if (flag.environment === 'client' || flag.environment === 'both') {
    const lsKey = key.replace('VITE_', '').toLowerCase().replace(/_/g, '.');
    const lsValue = localStorage.getItem(`feature.${lsKey}`);
    if (lsValue !== null) {
      return coerceValue(lsValue, flag.type);
    }
  }

  // Return default value
  return flag.defaultValue;
}

// Coerce string values to proper types
function coerceValue(value: string, type: 'boolean' | 'string' | 'number'): any {
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

// Get all flags with their current values (for CLI)
export function getAllFlags(includeSecrets: boolean = false): Record<string, {
  definition: FlagDefinition;
  currentValue: any;
  source: 'env' | 'localStorage' | 'default';
}> {
  const result: Record<string, any> = {};

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

    let currentValue = definition.defaultValue;
    let source: 'env' | 'localStorage' | 'default' = 'default';

    // Check environment
    const envValue = import.meta.env[key];
    if (envValue !== undefined) {
      currentValue = coerceValue(envValue, definition.type);
      source = 'env';
    }

    // Check localStorage (client-side only)
    if (definition.environment === 'client' || definition.environment === 'both') {
      const lsKey = key.replace('VITE_', '').toLowerCase().replace(/_/g, '.');
      const lsValue = localStorage.getItem(`feature.${lsKey}`);
      if (lsValue !== null) {
        currentValue = coerceValue(lsValue, definition.type);
        source = 'localStorage';
      }
    }

    result[key] = {
      definition,
      currentValue,
      source
    };
  }

  return result;
}

// Generate markdown documentation
export function generateFlagDocumentation(): string {
  const categories = {
    feature: 'Feature Flags',
    security: 'Security & Analysis',
    performance: 'Performance & Optimization',
    demo: 'Demo & Simulation',
    advanced: 'Advanced Configuration'
  };

  let markdown = '# Flag Registry\n\n';
  markdown += 'Central registry of all feature flags and configuration options for the Scenario Sandbox PoC.\n\n';
  markdown += '**Safety First**: All powerful features are OFF by default. Enable only what you need for testing.\n\n';

  for (const [categoryKey, categoryName] of Object.entries(categories)) {
    const categoryFlags = Object.entries(FLAG_REGISTRY)
      .filter(([_, flag]) => flag.category === categoryKey)
      .sort(([a], [b]) => a.localeCompare(b));

    if (categoryFlags.length === 0) continue;

    markdown += `## ${categoryName}\n\n`;

    for (const [key, flag] of categoryFlags) {
      const riskBadge = {
        low: '🟢',
        medium: '🟡',
        high: '🟠',
        critical: '🔴'
      }[flag.riskLevel];

      markdown += `### ${flag.name} ${riskBadge}\n\n`;
      markdown += `- **Key**: \`${flag.key}\`\n`;
      markdown += `- **Default**: \`${flag.defaultValue}\`\n`;
      markdown += `- **Type**: ${flag.type}\n`;
      markdown += `- **Environment**: ${flag.environment}\n`;
      markdown += `- **Toggle**: ${flag.toggleMethod === 'both' ? 'Environment variable or localStorage' : flag.toggleMethod}\n`;
      markdown += `- **Risk Level**: ${flag.riskLevel}\n\n`;
      markdown += `${flag.description}\n\n`;
      markdown += `**Observable Behavior**: ${flag.observableBehavior}\n\n`;

      if (flag.toggleMethod === 'both' || flag.toggleMethod === 'env') {
        markdown += `**Environment Variable**:\n\`\`\`bash\n${flag.key}=1\n\`\`\`\n\n`;
      }

      if (flag.toggleMethod === 'both' || flag.toggleMethod === 'localStorage') {
        const lsKey = flag.key.replace('VITE_', '').toLowerCase().replace(/_/g, '.');
        markdown += `**localStorage**:\n\`\`\`javascript\nlocalStorage.setItem('feature.${lsKey}', '1')\n\`\`\`\n\n`;
      }

      if (flag.deprecatedIn) {
        markdown += `**⚠️ Deprecated**: Since ${flag.deprecatedIn}`;
        if (flag.replacedBy) {
          markdown += ` (replaced by \`${flag.replacedBy}\`)`;
        }
        markdown += '\n\n';
      }

      markdown += '---\n\n';
    }
  }

  markdown += '## Usage Notes\n\n';
  markdown += '- **Environment variables** take precedence over localStorage\n';
  markdown += '- **Boolean flags**: Use `1` or `true` to enable, `0` or `false` to disable\n';
  markdown += '- **Client-side flags** (VITE_*) can be toggled via localStorage in DevTools\n';
  markdown += '- **Server-side flags** require environment variables and service restart\n';
  markdown += '- **Security flags** should only be enabled by administrators\n\n';

  markdown += '## Safety Guidelines\n\n';
  markdown += '- 🔴 **Critical Risk**: Only enable with full understanding of security implications\n';
  markdown += '- 🟠 **High Risk**: May affect system stability or security\n';
  markdown += '- 🟡 **Medium Risk**: Could impact performance or user experience\n';
  markdown += '- 🟢 **Low Risk**: Safe to enable for testing and development\n\n';

  return markdown;
}

// Check if all flags are in their default (safe) state
export function validateSafeDefaults(): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  const flags = getAllFlags(true); // Include secrets for validation

  for (const [key, { definition, currentValue, source }] of Object.entries(flags)) {
    // Skip redacted flags
    if (source === 'redacted') continue;

    // Check if high-risk flags are enabled
    if ((definition.riskLevel === 'high' || definition.riskLevel === 'critical') &&
        currentValue !== definition.defaultValue) {
      violations.push(`${key}: ${definition.riskLevel} risk flag is enabled (${currentValue})`);
    }

    // Check if security flags are enabled in production-like environments
    if (definition.category === 'security' &&
        currentValue !== definition.defaultValue &&
        (import.meta.env.NODE_ENV === 'production' || import.meta.env.CI === '1')) {
      violations.push(`${key}: Security flag enabled in production environment (${currentValue})`);
    }
  }

  return {
    safe: violations.length === 0,
    violations
  };
}