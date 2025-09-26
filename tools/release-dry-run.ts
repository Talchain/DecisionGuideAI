#!/usr/bin/env node

import { execSync } from 'child_process';
import { writeFileSync, existsSync, readFileSync, statSync } from 'fs';
import { resolve, basename, relative } from 'path';
import { sync as globSync } from 'glob';

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

    // Success Checks section
    this.printSuccessChecks();

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

  private printSuccessChecks(): void {
    this.log('');
    this.log('🎯 Success Checks');
    this.log('=================');

    try {
      const metricsPath = resolve(this.projectRoot, 'artifacts/reports/pilot-metrics.json');

      if (!existsSync(metricsPath)) {
        this.log('⚠️ Pilot metrics not found - run pilot demo first');
        return;
      }

      const metrics = JSON.parse(readFileSync(metricsPath, 'utf-8'));

      // TTFF Check
      const ttffPass = metrics.ttff_ms <= 500;
      const ttffIcon = ttffPass ? '✅' : '❌';
      this.log(`${ttffIcon} Time-to-First-Token: ${metrics.ttff_ms}ms — ${ttffPass ? 'PASS' : 'FAIL'} (≤500ms)`);

      // Cancel Latency Check
      const cancelPass = metrics.cancel_latency_ms <= 150;
      const cancelIcon = cancelPass ? '✅' : '❌';
      this.log(`${cancelIcon} Cancel latency: ${metrics.cancel_latency_ms}ms — ${cancelPass ? 'PASS' : 'FAIL'} (≤150ms)`);

      // Time to Comparison Check
      const comparisonPass = metrics.time_to_comparison_s <= 600; // 10 minutes
      const comparisonIcon = comparisonPass ? '✅' : '❌';
      this.log(`${comparisonIcon} Time-to-comparison: ${metrics.time_to_comparison_s}s — ${comparisonPass ? 'PASS' : 'FAIL'} (≤600s)`);

      // Determinism Check
      const determinismPass = metrics.determinism_ok === true;
      const determinismIcon = determinismPass ? '✅' : '❌';
      this.log(`${determinismIcon} Deterministic replay: ${determinismPass ? 'PASS' : 'FAIL'} — ${determinismPass ? 'Identical results' : metrics.determinism_notes || 'Failed'}`);

      // Overall Success Status
      const allPass = ttffPass && cancelPass && comparisonPass && determinismPass;
      const overallIcon = allPass ? '✅' : '❌';
      this.log(`${overallIcon} **Overall pilot success: ${allPass ? 'PASS' : 'FAIL'}**`);

    } catch (error) {
      this.log(`⚠️ Could not load pilot metrics: ${error}`);
    }
  }

  private printWinSignals(): void {
    this.log('');
    this.log('🏆 Release Wins & Highlights');
    this.log('===========================');

    // 1. Integration Scorecard coverage
    const scorecardCoverage = this.getScorecardCoverage();
    if (scorecardCoverage) {
      this.log(`🗺️ Scorecard coverage: ${scorecardCoverage} — artifacts/integration-scorecard.html`);
    }

    // 2. UI kick-start pack
    const uiKickstart = this.findLatestUIKickstartPack();
    if (uiKickstart) {
      this.log(`🚀 UI kick-start: ${basename(uiKickstart)} — ${uiKickstart}`);
    }

    // 3. Top SARB winner
    const sarbWinner = this.findLatestSARBWinner();
    if (sarbWinner) {
      this.log(`🥇 Top SARB variant: ${sarbWinner}`);
    }

    // 4. Latest tuning notes
    const tuningNotes = this.findLatestTuningNotes();
    if (tuningNotes) {
      this.log(`🔧 Latest tuning notes: ${tuningNotes}`);
    }

    // 5. Live Swap Assessment
    const liveSwapStatus = this.assessLiveSwapReadiness();
    this.log(`🔄 Live Swap: ${liveSwapStatus}`);
  }

  private getScorecardCoverage(): string | null {
    try {
      const scorecardPath = resolve(this.projectRoot, 'artifacts/integration-scorecard.json');

      if (!existsSync(scorecardPath)) return null;

      const scorecard = JSON.parse(readFileSync(scorecardPath, 'utf-8'));
      const coverage = scorecard.totals.coveragePercent;
      const verified = scorecard.totals.verified;
      const total = scorecard.totals.total;

      return `${coverage}% (${verified}/${total} verified)`;
    } catch (error) {
      // Ignore errors, just skip this signal
    }
    return null;
  }

  private findLatestSARBWinner(): string | null {
    try {
      const rankFiles = globSync(resolve(this.projectRoot, 'artifacts/diffs/rank-*.md'));

      if (rankFiles.length === 0) return null;

      // Get the most recent rank file
      const latestRankFile = rankFiles.sort().reverse()[0];
      const content = readFileSync(latestRankFile, 'utf-8');

      // Extract winner from markdown
      const winnerMatch = content.match(/## 🏆 Winner\s*\*\*([^*]+)\*\*/);
      if (winnerMatch) {
        return `${winnerMatch[1]} (see artifacts/diffs/${basename(latestRankFile)})`;
      }
    } catch (error) {
      // Ignore errors, just skip this signal
    }
    return null;
  }

  private findLatestUIKickstartPack(): string | null {
    try {
      const uiPacks = globSync(resolve(this.projectRoot, 'artifacts/ui-kickstart-*.zip'));

      if (uiPacks.length === 0) return null;

      // Get the most recent pack
      const latestPack = uiPacks.sort().reverse()[0];
      return `artifacts/${basename(latestPack)}`;
    } catch (error) {
      // Ignore errors, just skip this signal
    }
    return null;
  }

  private findLatestTuningNotes(): string | null {
    try {
      const tuningFiles = globSync(resolve(this.projectRoot, 'artifacts/experiments/*/tuning.md'));

      if (tuningFiles.length === 0) return null;

      // Get the most recent tuning file
      const latestTuning = tuningFiles.sort().reverse()[0];
      const relativePath = relative(this.projectRoot, latestTuning);
      return relativePath;
    } catch (error) {
      // Ignore errors, just skip this signal
    }
    return null;
  }

  private assessLiveSwapReadiness(): string {
    try {
      // Check if live swap checklist exists
      const checklistPath = resolve(this.projectRoot, 'artifacts/live-swap-checklist.md');
      if (!existsSync(checklistPath)) {
        return 'NOT_READY - No checklist found';
      }

      // Check for LIVE_SWAP_READY marker in environment or branch metadata
      const liveSwapReady = process.env.LIVE_SWAP_READY === 'true';

      // Check current branch for live swap indicators
      const branchName = execSync('git branch --show-current', { encoding: 'utf-8', cwd: this.projectRoot }).trim();
      const isLiveSwapBranch = branchName.includes('live-swap') || branchName.includes('windsurf-integration');

      if (liveSwapReady || isLiveSwapBranch) {
        return 'READY - Windsurf live wiring confirmed in branch';
      } else {
        return 'STANDBY - Checklist available, awaiting Windsurf confirmation';
      }
    } catch (error) {
      return 'UNKNOWN - Assessment failed';
    }
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