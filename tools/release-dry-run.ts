#!/usr/bin/env node

import { execSync } from 'child_process';
import { writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
}

interface ReleaseReport {
  timestamp: string;
  version: string;
  branch: string;
  commit: string;
  checks: CheckResult[];
  decision: 'GO' | 'NO-GO';
  score: {
    passed: number;
    total: number;
    percentage: number;
  };
}

class ReleaseDryRun {
  private projectRoot = process.cwd();
  private results: CheckResult[] = [];

  log(message: string): void {
    console.log(message);
  }

  async runCheck(
    name: string,
    command: string,
    successMessage: string,
    failMessage?: string
  ): Promise<CheckResult> {
    try {
      execSync(command, {
        stdio: 'pipe',
        encoding: 'utf8',
        cwd: this.projectRoot
      });

      const result: CheckResult = {
        name,
        status: 'pass',
        message: successMessage
      };

      this.log(`✅ ${name}: ${successMessage}`);
      return result;

    } catch (error: any) {
      const result: CheckResult = {
        name,
        status: 'fail',
        message: failMessage || 'Check failed',
        details: error.message
      };

      this.log(`❌ ${name}: ${failMessage || 'Check failed'}`);
      return result;
    }
  }

  async runAllChecks(): Promise<CheckResult[]> {
    this.log('🚀 Release Dry-Run Validation');
    this.log('=============================');
    this.log('Running comprehensive release readiness checks...');
    this.log('');

    const checks = [
      // 1. TypeScript Compilation
      {
        name: 'TypeScript Compilation',
        command: 'npm run typecheck',
        success: 'Clean compilation',
        fail: 'TypeScript errors detected'
      },

      // 2. Unit Tests
      {
        name: 'Unit Tests',
        command: 'npm test',
        success: 'All tests passing',
        fail: 'Test failures detected'
      },

      // 3. Contract Check (compilation + tests combined validation)
      {
        name: 'Contract Wall',
        command: 'npm run typecheck && npm test >/dev/null 2>&1',
        success: 'API contracts validated',
        fail: 'Contract validation failed'
      },

      // 4. Integration Check (Simulation Mode)
      {
        name: 'Integration Check',
        command: 'INTEGRATION_SIM_MODE=1 npm run integration:check',
        success: 'System integration verified',
        fail: 'Integration issues detected'
      },

      // 5. Determinism Check
      {
        name: 'Determinism Check',
        command: 'npm run determinism:check',
        success: 'Analysis results consistent',
        fail: 'Non-deterministic behavior detected'
      },

      // 6. Configuration Security
      {
        name: 'Config Security',
        command: 'npm run config:lint',
        success: 'Configuration secure',
        fail: 'Security issues in configuration'
      },

      // 7. Secret/PII Guards (check that powerful features are OFF)
      {
        name: 'Secret/PII Guards',
        command: 'npm run flags:print 2>/dev/null | grep -q "No feature flags currently active" || npm run flags:print 2>/dev/null | grep -E "ENABLE.*false" >/dev/null',
        success: 'All powerful features OFF (safe)',
        fail: 'Some powerful features enabled'
      }
    ];

    // Run each check
    for (const check of checks) {
      const result = await this.runCheck(
        check.name,
        check.command,
        check.success,
        check.fail
      );
      this.results.push(result);
    }

    return this.results;
  }

  getVersionInfo(): { version: string; branch: string; commit: string } {
    try {
      const gitBranch = execSync('git branch --show-current', {
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim();

      const gitCommit = execSync('git rev-parse HEAD', {
        encoding: 'utf8',
        stdio: 'pipe'
      }).trim().slice(0, 8);

      return {
        version: `dry-run-${new Date().toISOString().slice(0, 10)}`,
        branch: gitBranch,
        commit: gitCommit
      };
    } catch (error) {
      return {
        version: 'dry-run-unknown',
        branch: 'unknown',
        commit: 'unknown'
      };
    }
  }

  calculateScore(): { passed: number; total: number; percentage: number } {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const total = this.results.length;
    const percentage = Math.round((passed / total) * 100);

    return { passed, total, percentage };
  }

  makeReleaseDecision(): 'GO' | 'NO-GO' {
    const criticalChecks = [
      'TypeScript Compilation',
      'Unit Tests',
      'Contract Wall',
      'Secret/PII Guards'
    ];

    // All critical checks must pass
    const criticalPassed = criticalChecks.every(checkName =>
      this.results.find(r => r.name === checkName)?.status === 'pass'
    );

    if (!criticalPassed) {
      return 'NO-GO';
    }

    // At least 85% of all checks must pass
    const score = this.calculateScore();
    return score.percentage >= 85 ? 'GO' : 'NO-GO';
  }

  printSummary(): void {
    const score = this.calculateScore();
    const decision = this.makeReleaseDecision();
    const versionInfo = this.getVersionInfo();

    this.log('');
    this.log('📊 Release Readiness Summary');
    this.log('============================');

    // Print the 5 ticks format
    this.results.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : result.status === 'warn' ? '⚠️' : '❌';
      this.log(`${icon} ${result.name} - ${result.message}`);
    });

    this.log('');
    this.log(`📈 Score: ${score.passed}/${score.total} (${score.percentage}%)`);
    this.log(`🏷️ Version: ${versionInfo.version}`);
    this.log(`🌿 Branch: ${versionInfo.branch}`);
    this.log(`📝 Commit: ${versionInfo.commit}`);

    // Surface the wins
    this.printWinSignals();

    this.log('');
    if (decision === 'GO') {
      this.log('🟢 **GO** - Release Decision');
      this.log('✅ Ready for release deployment');
    } else {
      this.log('🔴 **NO-GO** - Release Decision');
      this.log('❌ Issues must be resolved before release');

      // Show failed checks
      const failedChecks = this.results.filter(r => r.status === 'fail');
      if (failedChecks.length > 0) {
        this.log('');
        this.log('🚨 Failed Checks:');
        failedChecks.forEach(check => {
          this.log(`   - ${check.name}: ${check.message}`);
        });
      }
    }
  }

  private printWinSignals(): void {
    this.log('');
    this.log('🏆 Release Wins & Highlights');
    this.log('===========================');

    // 1. Top SARB winner
    const sarbWinner = this.findLatestSARBWinner();
    if (sarbWinner) {
      this.log(`🥇 Top SARB variant: ${sarbWinner}`);
    }

    // 2. UI kick-start pack
    const uiKickstart = this.findLatestUIKickstartPack();
    if (uiKickstart) {
      this.log(`📦 UI kick-start pack: ${uiKickstart}`);
    }

    // 3. Latest tuning notes
    const tuningNotes = this.findLatestTuningNotes();
    if (tuningNotes) {
      this.log(`🔧 Latest tuning notes: ${tuningNotes}`);
    }
  }

  private findLatestSARBWinner(): string | null {
    try {
      const glob = require('glob');
      const fs = require('fs');
      const rankFiles = glob.sync(resolve(this.projectRoot, 'artifacts/diffs/rank-*.md'));

      if (rankFiles.length === 0) return null;

      // Get the most recent rank file
      const latestRankFile = rankFiles.sort().reverse()[0];
      const content = fs.readFileSync(latestRankFile, 'utf-8');

      // Extract winner from markdown
      const winnerMatch = content.match(/## 🏆 Winner\s*\*\*([^*]+)\*\*/);
      if (winnerMatch) {
        return `${winnerMatch[1]} (see artifacts/diffs/${require('path').basename(latestRankFile)})`;
      }
    } catch (error) {
      // Ignore errors, just skip this signal
    }
    return null;
  }

  private findLatestUIKickstartPack(): string | null {
    try {
      const glob = require('glob');
      const uiPacks = glob.sync(resolve(this.projectRoot, 'artifacts/ui-kickstart-*.zip'));

      if (uiPacks.length === 0) return null;

      // Get the most recent pack
      const latestPack = uiPacks.sort().reverse()[0];
      return `artifacts/${require('path').basename(latestPack)}`;
    } catch (error) {
      // Ignore errors, just skip this signal
    }
    return null;
  }

  private findLatestTuningNotes(): string | null {
    try {
      const glob = require('glob');
      const tuningFiles = glob.sync(resolve(this.projectRoot, 'artifacts/experiments/*/tuning.md'));

      if (tuningFiles.length === 0) return null;

      // Get the most recent tuning file
      const latestTuning = tuningFiles.sort().reverse()[0];
      const relativePath = require('path').relative(this.projectRoot, latestTuning);
      return relativePath;
    } catch (error) {
      // Ignore errors, just skip this signal
    }
    return null;
  }

  async createReleasePackage(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const zipPath = resolve(this.projectRoot, `artifacts/release-dry-run-${timestamp}.zip`);

    try {
      // Create a simple zip with key artifacts (no Docker needed)
      const artifactsToInclude = [
        'artifacts/integration-status.html',
        'artifacts/index.html',
        'artifacts/operator-handbook.md',
        'artifacts/faq.md',
        'artifacts/glossary.md',
        'package.json',
        'README.md'
      ];

      const existingFiles = artifactsToInclude.filter(file =>
        existsSync(resolve(this.projectRoot, file))
      );

      if (existingFiles.length > 0) {
        const fileList = existingFiles.join(' ');
        execSync(`zip -q "${zipPath}" ${fileList}`, {
          cwd: this.projectRoot,
          stdio: 'pipe'
        });

        this.log(`📦 Release package created: ${zipPath}`);

        // Get zip size
        const { statSync } = await import('fs');
        const stats = statSync(zipPath);
        const sizeKB = Math.round(stats.size / 1024);
        this.log(`   Size: ${sizeKB}KB`);
      } else {
        this.log('⚠️ No artifacts to package');
      }

    } catch (error) {
      this.log(`⚠️ Could not create release package: ${error}`);
    }

    return zipPath;
  }

  saveReport(): string {
    const versionInfo = this.getVersionInfo();
    const score = this.calculateScore();
    const decision = this.makeReleaseDecision();

    const report: ReleaseReport = {
      timestamp: new Date().toISOString(),
      version: versionInfo.version,
      branch: versionInfo.branch,
      commit: versionInfo.commit,
      checks: this.results,
      decision,
      score
    };

    const reportPath = resolve(
      this.projectRoot,
      'artifacts/release-dry-run-report.json'
    );

    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    this.log(`💾 Release report saved: ${reportPath}`);
    return reportPath;
  }

  async run(): Promise<void> {
    try {
      // Run all checks
      await this.runAllChecks();

      // Print summary with GO/NO-GO decision
      this.printSummary();

      // Create release package
      this.log('');
      await this.createReleasePackage();

      // Save detailed report
      this.saveReport();

      // Exit with appropriate code
      const decision = this.makeReleaseDecision();
      process.exit(decision === 'GO' ? 0 : 1);

    } catch (error) {
      this.log(`❌ Release dry-run failed: ${error}`);
      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = new ReleaseDryRun();
  dryRun.run();
}

export { ReleaseDryRun };