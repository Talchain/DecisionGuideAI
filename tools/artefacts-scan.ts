#!/usr/bin/env tsx
/**
 * Artefacts Scanner for DecisionGuide AI
 * Scans /artifacts directory for secrets and PII using existing patterns + light PII detection
 * Usage: npm run artefacts:scan
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);
const ARTIFACTS_DIR = join(PROJECT_ROOT, 'artifacts');
const REPORTS_DIR = join(ARTIFACTS_DIR, 'reports');

// Ensure reports directory exists
try {
  mkdirSync(REPORTS_DIR, { recursive: true });
} catch (err) {
  // Directory might already exist
}

interface ScanIssue {
  file: string;
  line?: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: 'secret' | 'pii' | 'credential' | 'token' | 'key';
  pattern: string;
  message: string;
  context?: string;
}

interface ScanResult {
  timestamp: string;
  scanDirectory: string;
  totalFilesScanned: number;
  totalIssuesFound: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  verdict: 'GREEN' | 'AMBER' | 'RED';
  issues: ScanIssue[];
  summary: string;
  cleanFiles: string[];
}

class ArtefactsScanner {
  private issues: ScanIssue[] = [];
  private scannedFiles = 0;
  private cleanFiles: string[] = [];

  // Secret patterns from existing config-lint.ts + additional
  private secretPatterns = [
    { pattern: /sk-[a-zA-Z0-9]{32,}/, severity: 'critical', category: 'secret', message: 'OpenAI API Key detected' },
    { pattern: /xoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}/, severity: 'critical', category: 'secret', message: 'Slack Bot Token detected' },
    { pattern: /ya29\.[a-zA-Z0-9_-]+/, severity: 'critical', category: 'secret', message: 'Google OAuth Token detected' },
    { pattern: /AKIA[0-9A-Z]{16}/, severity: 'critical', category: 'secret', message: 'AWS Access Key detected' },
    { pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/, severity: 'high', category: 'token', message: 'JWT Token detected' },
    { pattern: /-----BEGIN [A-Z ]+ KEY-----/, severity: 'critical', category: 'key', message: 'Private Key detected' },
    { pattern: /password\s*[=:]\s*[^;\s\n"']+/i, severity: 'high', category: 'credential', message: 'Hardcoded Password detected' },
    { pattern: /secret\s*[=:]\s*[^;\s\n"']+/i, severity: 'high', category: 'secret', message: 'Hardcoded Secret detected' },
    { pattern: /api_key\s*[=:]\s*[^;\s\n"']+/i, severity: 'high', category: 'key', message: 'API Key detected' },
    { pattern: /token\s*[=:]\s*[^;\s\n"']+/i, severity: 'high', category: 'token', message: 'Token detected' },

    // Additional patterns for common secrets
    { pattern: /ghp_[A-Za-z0-9_]{36}/, severity: 'critical', category: 'token', message: 'GitHub Personal Access Token detected' },
    { pattern: /ghs_[A-Za-z0-9_]{36}/, severity: 'critical', category: 'token', message: 'GitHub App Token detected' },
    { pattern: /facebook.*[0-9a-f]{32}/i, severity: 'high', category: 'token', message: 'Facebook Access Token detected' },
    { pattern: /twitter.*[0-9a-zA-Z]{50}/i, severity: 'high', category: 'token', message: 'Twitter API Key detected' },
    { pattern: /stripe.*[rs]k_[a-z]+_[a-zA-Z0-9]+/i, severity: 'critical', category: 'key', message: 'Stripe API Key detected' }
  ] as const;

  // Light PII patterns (basic detection, may have false positives)
  private piiPatterns = [
    { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, severity: 'medium', category: 'pii', message: 'Email address detected' },
    { pattern: /\b[A-Z]{2}[0-9]{6}[A-Z]\b/, severity: 'medium', category: 'pii', message: 'UK National Insurance Number pattern' },
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/, severity: 'medium', category: 'pii', message: 'US SSN pattern detected' },
    { pattern: /\b\+?1?[0-9]{3}[0-9]{3}[0-9]{4}\b/, severity: 'low', category: 'pii', message: 'Phone number pattern detected' },
    { pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, severity: 'medium', category: 'pii', message: 'Credit card number pattern detected' },
    { pattern: /\b[0-9]{1,5}\s+[a-zA-Z\s]+(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|way|court|ct)\b/i, severity: 'low', category: 'pii', message: 'Street address pattern detected' },
  ] as const;

  // File types to scan (exclude binary files)
  private scannableExtensions = [
    '.md', '.txt', '.json', '.html', '.js', '.ts', '.jsx', '.tsx',
    '.css', '.scss', '.less', '.yaml', '.yml', '.xml', '.csv',
    '.log', '.config', '.env', '.example', '.template'
  ];

  // Files/directories to skip
  private skipPatterns = [
    'node_modules',
    '.git',
    '*.zip',
    '*.tar.gz',
    '*.png', '*.jpg', '*.jpeg', '*.gif', '*.ico',
    '*.pdf', '*.doc', '*.docx',
    'package-lock.json', // Skip lock files (too noisy)
    '*.min.js', '*.min.css' // Skip minified files
  ];

  async scanArtifacts(): Promise<ScanResult> {
    console.log('🔍 Artefacts Security & PII Scanner');
    console.log('=' .repeat(50));
    console.log(`📁 Scanning: ${ARTIFACTS_DIR}`);

    if (!existsSync(ARTIFACTS_DIR)) {
      throw new Error(`Artifacts directory not found: ${ARTIFACTS_DIR}`);
    }

    // Find all scannable files
    const allFiles = await this.findScannableFiles();
    console.log(`📄 Found ${allFiles.length} files to scan`);

    // Scan each file
    for (const filePath of allFiles) {
      await this.scanFile(filePath);
    }

    const result = this.generateResult();
    await this.saveResults(result);
    this.printSummary(result);

    return result;
  }

  private async findScannableFiles(): Promise<string[]> {
    const pattern = join(ARTIFACTS_DIR, '**/*');
    const files = await glob(pattern, {
      nodir: true,
      ignore: this.skipPatterns.map(p => join(ARTIFACTS_DIR, '**', p))
    });

    return files.filter(file => {
      const ext = file.toLowerCase().substring(file.lastIndexOf('.'));
      return this.scannableExtensions.includes(ext) || ext === '';
    });
  }

  private async scanFile(filePath: string): Promise<void> {
    this.scannedFiles++;
    const relativePath = relative(PROJECT_ROOT, filePath);

    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      let hasIssues = false;

      lines.forEach((line, index) => {
        const lineNumber = index + 1;

        // Skip obviously safe lines
        if (line.trim() === '' || line.trim().startsWith('//') || line.trim().startsWith('#')) {
          return;
        }

        // Check for secrets
        this.secretPatterns.forEach(({ pattern, severity, category, message }) => {
          if (pattern.test(line)) {
            this.issues.push({
              file: relativePath,
              line: lineNumber,
              severity: severity as any,
              category: category as any,
              pattern: pattern.source,
              message,
              context: this.getContext(line)
            });
            hasIssues = true;
          }
        });

        // Check for PII (only if no secrets found in this line to reduce noise)
        if (!hasIssues) {
          this.piiPatterns.forEach(({ pattern, severity, category, message }) => {
            if (pattern.test(line)) {
              // Additional validation to reduce false positives
              if (this.isLikelyRealPII(line, pattern)) {
                this.issues.push({
                  file: relativePath,
                  line: lineNumber,
                  severity: severity as any,
                  category: category as any,
                  pattern: pattern.source,
                  message,
                  context: this.getContext(line)
                });
                hasIssues = true;
              }
            }
          });
        }
      });

      if (!hasIssues) {
        this.cleanFiles.push(relativePath);
      }

    } catch (error) {
      // File might be binary or unreadable, skip silently
      console.log(`⚠️  Skipped unreadable file: ${relativePath}`);
    }
  }

  private isLikelyRealPII(line: string, pattern: RegExp): boolean {
    const match = line.match(pattern);
    if (!match) return false;

    const matched = match[0];

    // Skip obvious examples/placeholders
    const placeholderPatterns = [
      /example\.com$/i,
      /test\.com$/i,
      /^user@/i,
      /^admin@/i,
      /^demo@/i,
      /sample/i,
      /placeholder/i,
      /xxxxx/i,
      /11111/i,
      /00000/i
    ];

    return !placeholderPatterns.some(p => p.test(matched));
  }

  private getContext(line: string): string {
    // Return first 50 chars of the line for context, masking potential sensitive data
    const context = line.substring(0, 50);
    // Mask anything that looks like a value after = or :
    return context.replace(/([=:])\s*[^\s]+/g, '$1 ***');
  }

  private generateResult(): ScanResult {
    const critical = this.issues.filter(i => i.severity === 'critical').length;
    const high = this.issues.filter(i => i.severity === 'high').length;
    const medium = this.issues.filter(i => i.severity === 'medium').length;
    const low = this.issues.filter(i => i.severity === 'low').length;
    const info = this.issues.filter(i => i.severity === 'info').length;

    let verdict: 'GREEN' | 'AMBER' | 'RED' = 'GREEN';
    let summary: string;

    if (critical > 0) {
      verdict = 'RED';
      summary = `🔴 CRITICAL: ${critical} critical issues found - immediate action required`;
    } else if (high > 0) {
      verdict = 'AMBER';
      summary = `🟡 HIGH RISK: ${high} high-severity issues found - review recommended`;
    } else if (medium > 0) {
      verdict = 'AMBER';
      summary = `🟡 MEDIUM RISK: ${medium} medium-severity issues found - consider reviewing`;
    } else if (low > 0 || info > 0) {
      verdict = 'GREEN';
      summary = `🟢 LOW RISK: ${low + info} advisory findings - mostly safe`;
    } else {
      verdict = 'GREEN';
      summary = '🟢 CLEAN: No security or PII issues detected';
    }

    return {
      timestamp: new Date().toISOString(),
      scanDirectory: relative(PROJECT_ROOT, ARTIFACTS_DIR),
      totalFilesScanned: this.scannedFiles,
      totalIssuesFound: this.issues.length,
      critical,
      high,
      medium,
      low,
      info,
      verdict,
      issues: this.issues,
      summary,
      cleanFiles: this.cleanFiles.slice(0, 10) // Show first 10 clean files
    };
  }

  private async saveResults(result: ScanResult): Promise<void> {
    // Generate markdown report
    const markdownReport = this.generateMarkdownReport(result);
    const mdPath = join(REPORTS_DIR, 'artefact-scan.md');
    writeFileSync(mdPath, markdownReport);

    console.log(`\n📄 Report saved: ${relative(PROJECT_ROOT, mdPath)}`);
  }

  private generateMarkdownReport(result: ScanResult): string {
    const lines = [
      '# Artefacts Security & PII Scan Report',
      '',
      `**Generated**: ${result.timestamp}`,
      `**Directory**: ${result.scanDirectory}`,
      `**Files Scanned**: ${result.totalFilesScanned}`,
      `**Total Issues**: ${result.totalIssuesFound}`,
      '',
      '## 🎯 Overall Verdict',
      '',
      result.summary,
      ''
    ];

    // Summary table
    lines.push(
      '| Severity | Count | Action Required |',
      '|----------|-------|----------------|',
      `| 🔴 Critical | ${result.critical} | Immediate |`,
      `| 🟠 High | ${result.high} | Soon |`,
      `| 🟡 Medium | ${result.medium} | Review |`,
      `| 🔵 Low | ${result.low} | Advisory |`,
      `| ℹ️ Info | ${result.info} | FYI |`,
      ''
    );

    if (result.issues.length > 0) {
      // Group issues by severity
      const criticalIssues = result.issues.filter(i => i.severity === 'critical');
      const highIssues = result.issues.filter(i => i.severity === 'high');
      const mediumIssues = result.issues.filter(i => i.severity === 'medium');
      const lowIssues = result.issues.filter(i => i.severity === 'low');
      const infoIssues = result.issues.filter(i => i.severity === 'info');

      if (criticalIssues.length > 0) {
        lines.push('## 🔴 Critical Issues (Fix Immediately)', '');
        criticalIssues.forEach(issue => {
          lines.push(`### ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
          lines.push(`**${issue.message}**`);
          lines.push(`- Category: ${issue.category}`);
          if (issue.context) lines.push(`- Context: \`${issue.context}\``);
          lines.push('');
        });
      }

      if (highIssues.length > 0) {
        lines.push('## 🟠 High Severity Issues (Review Soon)', '');
        highIssues.forEach(issue => {
          lines.push(`- **${issue.file}${issue.line ? `:${issue.line}` : ''}**: ${issue.message}`);
          if (issue.context) lines.push(`  - Context: \`${issue.context}\``);
        });
        lines.push('');
      }

      if (mediumIssues.length > 0) {
        lines.push('## 🟡 Medium Severity Issues (Consider Review)', '');
        mediumIssues.forEach(issue => {
          lines.push(`- **${issue.file}${issue.line ? `:${issue.line}` : ''}**: ${issue.message}`);
        });
        lines.push('');
      }

      if (lowIssues.length > 0) {
        lines.push('<details><summary>🔵 Low Severity Issues (Advisory)</summary>', '');
        lowIssues.forEach(issue => {
          lines.push(`- **${issue.file}${issue.line ? `:${issue.line}` : ''}**: ${issue.message}`);
        });
        lines.push('', '</details>', '');
      }
    }

    // Clean files sample
    if (result.cleanFiles.length > 0) {
      lines.push('## ✅ Sample Clean Files', '');
      result.cleanFiles.forEach(file => {
        lines.push(`- ${file}`);
      });
      if (result.totalFilesScanned > result.cleanFiles.length) {
        lines.push(`- ... and ${result.totalFilesScanned - result.issues.length} more clean files`);
      }
    }

    lines.push('', '---', '*Report generated by DecisionGuide AI Artefacts Scanner*');

    return lines.join('\n');
  }

  private printSummary(result: ScanResult): void {
    console.log('\n📊 Scan Summary');
    console.log('=' .repeat(30));
    console.log(`Verdict: ${result.verdict}`);
    console.log(`Files: ${result.totalFilesScanned} scanned`);
    console.log(`Issues: ${result.totalIssuesFound} found`);
    console.log(`Breakdown: ${result.critical}🔴 ${result.high}🟠 ${result.medium}🟡 ${result.low}🔵 ${result.info}ℹ️`);
    console.log(`Clean files: ${result.cleanFiles.length}`);
    console.log(result.summary);
  }
}

// Run the scanner if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const strictMode = process.env.SCAN_STRICT === '1';

  const scanner = new ArtefactsScanner();
  scanner.scanArtifacts().then(result => {
    // Exit with error code only in strict mode and critical issues found
    if (strictMode && result.critical > 0) {
      console.log('\n🚨 SCAN_STRICT=1: Failing due to critical issues');
      process.exit(1);
    }
  }).catch(error => {
    console.error('Artefacts scan failed:', error);
    process.exit(1);
  });
}

export { ArtefactsScanner };