#!/usr/bin/env tsx
/**
 * Config/Environment Linter for DecisionGuide AI
 * Validates: no secrets leaked, safe defaults, proper structure
 * Usage: npm run config:lint
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);
const ARTIFACTS_DIR = join(PROJECT_ROOT, 'artifacts');

// Ensure artifacts directory exists
try {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
} catch (err) {
  // Directory might already exist
}

interface ConfigIssue {
  file: string;
  line?: number;
  severity: 'error' | 'warning' | 'info';
  type: 'secret' | 'unsafe-default' | 'missing-required' | 'structure' | 'security';
  message: string;
  suggestion?: string;
}

interface LintResult {
  timestamp: string;
  totalFiles: number;
  totalIssues: number;
  errors: number;
  warnings: number;
  verdict: 'PASS' | 'FAIL';
  issues: ConfigIssue[];
  summary: string;
}

class ConfigLinter {
  private issues: ConfigIssue[] = [];

  // Patterns that indicate secrets or sensitive data
  private secretPatterns = [
    { pattern: /sk-[a-zA-Z0-9]{32,}/, type: 'OpenAI API Key' },
    { pattern: /xoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}/, type: 'Slack Bot Token' },
    { pattern: /ya29\.[a-zA-Z0-9_-]+/, type: 'Google OAuth Token' },
    { pattern: /AKIA[0-9A-Z]{16}/, type: 'AWS Access Key' },
    { pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/, type: 'UUID (possibly secret)' },
    { pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/, type: 'JWT Token' },
    { pattern: /-----BEGIN [A-Z ]+ KEY-----/, type: 'Private Key' },
    { pattern: /password\s*[=:]\s*[^;\s\n]+/i, type: 'Hardcoded Password' },
    { pattern: /secret\s*[=:]\s*[^;\s\n]+/i, type: 'Hardcoded Secret' }
  ];

  // Unsafe default values
  private unsafeDefaults = [
    { pattern: /password.*=.*"admin"|"password"|"123456"|"default"/i, message: 'Weak default password' },
    { pattern: /debug.*=.*true/i, message: 'Debug mode enabled by default' },
    { pattern: /cors.*=.*\*/i, message: 'CORS wildcard (*) in production config' },
    { pattern: /ssl.*=.*false/i, message: 'SSL disabled by default' },
    { pattern: /secure.*=.*false/i, message: 'Security feature disabled' }
  ];

  async lintAll(): Promise<LintResult> {
    console.log('🔍 Config/Environment Lint Check');
    console.log('=' .repeat(40));

    const configFiles = [
      '.env',
      '.env.local',
      '.env.example',
      '.env.production',
      '.env.development',
      'config.json',
      'config.js',
      'config.ts',
      'app.config.js',
      'next.config.js',
      'vite.config.ts',
      'package.json'
    ];

    let totalFiles = 0;

    for (const file of configFiles) {
      const filePath = join(PROJECT_ROOT, file);
      if (existsSync(filePath)) {
        console.log(`📄 Checking ${file}...`);
        await this.lintFile(filePath, file);
        totalFiles++;
      }
    }

    // Also check src/ for hardcoded configs
    await this.lintSourceFiles();

    const result = this.generateResult(totalFiles);
    await this.saveResults(result);
    this.printSummary(result);

    return result;
  }

  private async lintFile(filePath: string, filename: string): Promise<void> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const lineNumber = index + 1;

        // Check for secrets
        this.secretPatterns.forEach(({ pattern, type }) => {
          if (pattern.test(line)) {
            this.issues.push({
              file: filename,
              line: lineNumber,
              severity: 'error',
              type: 'secret',
              message: `Potential ${type} detected in config file`,
              suggestion: 'Move to secure environment variable or vault'
            });
          }
        });

        // Check for unsafe defaults
        this.unsafeDefaults.forEach(({ pattern, message }) => {
          if (pattern.test(line)) {
            this.issues.push({
              file: filename,
              line: lineNumber,
              severity: 'warning',
              type: 'unsafe-default',
              message: `Unsafe default: ${message}`,
              suggestion: 'Use secure defaults or require explicit configuration'
            });
          }
        });

        // Specific checks for .env files
        if (filename.startsWith('.env')) {
          this.lintEnvLine(line, lineNumber, filename);
        }

        // Specific checks for package.json
        if (filename === 'package.json') {
          this.lintPackageJson(content, filename);
        }
      });

    } catch (error) {
      this.issues.push({
        file: filename,
        severity: 'error',
        type: 'structure',
        message: `Failed to read file: ${error.message}`
      });
    }
  }

  private lintEnvLine(line: string, lineNumber: number, filename: string): void {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || line.trim() === '') return;

    // Check for proper structure (KEY=VALUE)
    if (!line.includes('=')) {
      this.issues.push({
        file: filename,
        line: lineNumber,
        severity: 'warning',
        type: 'structure',
        message: 'Line does not follow KEY=VALUE format',
        suggestion: 'Use proper environment variable format'
      });
      return;
    }

    const [key, value] = line.split('=', 2);

    // Check for empty values in non-example files
    if (!filename.includes('example') && (!value || value.trim() === '')) {
      this.issues.push({
        file: filename,
        line: lineNumber,
        severity: 'info',
        type: 'missing-required',
        message: `Environment variable ${key} has empty value`
      });
    }

    // Check for suspicious variable names
    const suspiciousKeys = ['SECRET', 'PASSWORD', 'TOKEN', 'KEY', 'API_KEY'];
    if (suspiciousKeys.some(sus => key.toUpperCase().includes(sus))) {
      if (value && value.length > 10 && !filename.includes('example')) {
        this.issues.push({
          file: filename,
          line: lineNumber,
          severity: 'error',
          type: 'secret',
          message: `Potentially sensitive value in ${key}`,
          suggestion: 'Use placeholder value or move to secure storage'
        });
      }
    }

    // Check for development URLs in production configs
    if (filename.includes('production') && value.includes('localhost')) {
      this.issues.push({
        file: filename,
        line: lineNumber,
        severity: 'warning',
        type: 'unsafe-default',
        message: 'Localhost URL in production configuration',
        suggestion: 'Use production-appropriate URLs'
      });
    }
  }

  private lintPackageJson(content: string, filename: string): void {
    try {
      const pkg = JSON.parse(content);

      // Check for security-related scripts
      if (pkg.scripts) {
        Object.entries(pkg.scripts).forEach(([scriptName, scriptValue]) => {
          if (typeof scriptValue === 'string') {
            // Check for potentially dangerous scripts
            if (scriptValue.includes('rm -rf') || scriptValue.includes('del /f')) {
              this.issues.push({
                file: filename,
                severity: 'warning',
                type: 'security',
                message: `Script "${scriptName}" contains potentially dangerous commands`,
                suggestion: 'Review script safety and add appropriate safeguards'
              });
            }

            // Check for hardcoded secrets in scripts
            this.secretPatterns.forEach(({ pattern, type }) => {
              if (pattern.test(scriptValue)) {
                this.issues.push({
                  file: filename,
                  severity: 'error',
                  type: 'secret',
                  message: `Potential ${type} in script "${scriptName}"`,
                  suggestion: 'Use environment variables instead'
                });
              }
            });
          }
        });
      }

      // Check for private repository leaks
      if (pkg.repository && typeof pkg.repository === 'object' && pkg.repository.url) {
        if (pkg.repository.url.includes('github.com') && !pkg.private) {
          this.issues.push({
            file: filename,
            severity: 'info',
            type: 'security',
            message: 'Repository URL exposed in public package.json',
            suggestion: 'Consider if this should be public'
          });
        }
      }

    } catch (error) {
      this.issues.push({
        file: filename,
        severity: 'error',
        type: 'structure',
        message: 'Invalid JSON format in package.json'
      });
    }
  }

  private async lintSourceFiles(): Promise<void> {
    console.log('📁 Checking source files for hardcoded configs...');

    const sourceFiles = [
      'src/lib/supabase.ts',
      'src/lib/openai.ts',
      'src/config.ts',
      'src/constants.ts'
    ];

    for (const file of sourceFiles) {
      const filePath = join(PROJECT_ROOT, file);
      if (existsSync(filePath)) {
        try {
          const content = readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');

          lines.forEach((line, index) => {
            const lineNumber = index + 1;

            // Look for hardcoded secrets in source code
            this.secretPatterns.forEach(({ pattern, type }) => {
              if (pattern.test(line) && !line.includes('process.env')) {
                this.issues.push({
                  file: file,
                  line: lineNumber,
                  severity: 'error',
                  type: 'secret',
                  message: `Hardcoded ${type} in source code`,
                  suggestion: 'Move to environment variables'
                });
              }
            });

            // Check for hardcoded URLs
            if (line.includes('http://') || line.includes('https://')) {
              if (!line.includes('process.env') && !line.includes('localhost') &&
                  !line.includes('example.com') && !line.includes('//')) {
                this.issues.push({
                  file: file,
                  line: lineNumber,
                  severity: 'warning',
                  type: 'unsafe-default',
                  message: 'Hardcoded URL in source code',
                  suggestion: 'Use environment variable or config file'
                });
              }
            }
          });
        } catch (error) {
          // File might not exist or be readable, skip silently
        }
      }
    }
  }

  private generateResult(totalFiles: number): LintResult {
    const errors = this.issues.filter(i => i.severity === 'error').length;
    const warnings = this.issues.filter(i => i.severity === 'warning').length;
    const verdict = errors === 0 ? 'PASS' : 'FAIL';

    let summary: string;
    if (errors === 0 && warnings === 0) {
      summary = '✅ No configuration issues detected';
    } else if (errors === 0) {
      summary = `⚠️ ${warnings} warnings found (no blocking errors)`;
    } else {
      summary = `❌ ${errors} errors found (${warnings} warnings)`;
    }

    return {
      timestamp: new Date().toISOString(),
      totalFiles,
      totalIssues: this.issues.length,
      errors,
      warnings,
      verdict,
      issues: this.issues,
      summary
    };
  }

  private async saveResults(result: LintResult): Promise<void> {
    const jsonPath = join(ARTIFACTS_DIR, 'config-lint.json');
    writeFileSync(jsonPath, JSON.stringify(result, null, 2));

    // Generate markdown report for easier reading
    const markdownReport = this.generateMarkdownReport(result);
    const mdPath = join(ARTIFACTS_DIR, 'config-lint.md');
    writeFileSync(mdPath, markdownReport);

    console.log(`\n📄 Reports saved:`);
    console.log(`   JSON: ${jsonPath}`);
    console.log(`   Markdown: ${mdPath}`);
  }

  private generateMarkdownReport(result: LintResult): string {
    const lines = [
      '# Configuration Lint Report',
      '',
      `**Generated**: ${result.timestamp}`,
      `**Verdict**: ${result.verdict}`,
      `**Files Checked**: ${result.totalFiles}`,
      `**Total Issues**: ${result.totalIssues}`,
      '',
      '## Summary',
      '',
      result.summary,
      ''
    ];

    if (result.issues.length > 0) {
      lines.push('## Issues Found', '');

      const errorIssues = result.issues.filter(i => i.severity === 'error');
      const warningIssues = result.issues.filter(i => i.severity === 'warning');
      const infoIssues = result.issues.filter(i => i.severity === 'info');

      if (errorIssues.length > 0) {
        lines.push('### ❌ Errors (Must Fix)');
        errorIssues.forEach(issue => {
          lines.push(`- **${issue.file}${issue.line ? `:${issue.line}` : ''}**: ${issue.message}`);
          if (issue.suggestion) {
            lines.push(`  - *Suggestion*: ${issue.suggestion}`);
          }
        });
        lines.push('');
      }

      if (warningIssues.length > 0) {
        lines.push('### ⚠️ Warnings (Should Fix)');
        warningIssues.forEach(issue => {
          lines.push(`- **${issue.file}${issue.line ? `:${issue.line}` : ''}**: ${issue.message}`);
          if (issue.suggestion) {
            lines.push(`  - *Suggestion*: ${issue.suggestion}`);
          }
        });
        lines.push('');
      }

      if (infoIssues.length > 0) {
        lines.push('### ℹ️ Info (Good to Know)');
        infoIssues.forEach(issue => {
          lines.push(`- **${issue.file}${issue.line ? `:${issue.line}` : ''}**: ${issue.message}`);
          if (issue.suggestion) {
            lines.push(`  - *Suggestion*: ${issue.suggestion}`);
          }
        });
      }
    }

    return lines.join('\n');
  }

  private printSummary(result: LintResult): void {
    console.log('\n📊 Configuration Lint Summary');
    console.log('=' .repeat(40));
    console.log(`Result: ${result.verdict}`);
    console.log(`Files: ${result.totalFiles} checked`);
    console.log(`Issues: ${result.errors} errors, ${result.warnings} warnings`);
    console.log(`Summary: ${result.summary}`);

    if (result.errors > 0) {
      console.log('\n🚨 Critical Issues:');
      result.issues
        .filter(i => i.severity === 'error')
        .slice(0, 5)
        .forEach(issue => {
          console.log(`   • ${issue.file}: ${issue.message}`);
        });
    }
  }
}

// Run the linter if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const linter = new ConfigLinter();
  linter.lintAll().catch(error => {
    console.error('Config lint failed:', error);
    process.exit(1);
  });
}