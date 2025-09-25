#!/usr/bin/env tsx
/**
 * SARB Compare-Many (Ranker) for DecisionGuide AI
 * Quick "which variant wins" across many bundles with ranking table
 * Usage: npm run sarb:rank -- artifacts/runs/*.sarb.zip --metric tokens|time --tie quality
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, basename, dirname, join } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = dirname(__dirname);
const ARTIFACTS_DIR = join(PROJECT_ROOT, 'artifacts');
const DIFFS_DIR = join(ARTIFACTS_DIR, 'diffs');

// Ensure diffs directory exists
try {
  mkdirSync(DIFFS_DIR, { recursive: true });
} catch (err) {
  // Directory might already exist
}

interface SARBBundle {
  title: string;
  created: string;
  prompt: string;
  completion: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  duration: number;
  model: string;
  options: Array<{
    name: string;
    description: string;
  }>;
  analysis: {
    reasoning: string;
    recommendation: {
      choice: string;
      confidence: number;
    };
  };
}

interface BundleMetrics {
  path: string;
  name: string;
  title: string;
  created: string;
  model: string;
  tokens: number;
  time: number; // in seconds
  cost: number;
  quality: number; // 0-100 based on analysis depth, reasoning quality, etc.
  choice: string;
  confidence: number;
}

interface RankingResult {
  timestamp: string;
  metric: 'tokens' | 'time' | 'cost' | 'quality';
  tieBreaker?: 'tokens' | 'time' | 'cost' | 'quality';
  totalBundles: number;
  rankings: BundleMetrics[];
  winner: BundleMetrics;
  insights: {
    averageTokens: number;
    averageTime: number;
    averageCost: number;
    averageQuality: number;
    modelBreakdown: Record<string, number>;
    choiceDistribution: Record<string, number>;
  };
  pairwiseDiffs: Array<{
    bundleA: string;
    bundleB: string;
    diffFile: string;
  }>;
}

class SARBRanker {
  private projectRoot = process.cwd();

  log(message: string): void {
    console.log(message);
  }

  async rankBundles(
    patterns: string[],
    metric: 'tokens' | 'time' | 'cost' | 'quality' = 'tokens',
    tieBreaker?: 'tokens' | 'time' | 'cost' | 'quality'
  ): Promise<RankingResult> {
    this.log('🏆 SARB Compare-Many (Ranker)');
    this.log('=' .repeat(35));

    // 1. Find all SARB bundles
    const bundlePaths = await this.findBundles(patterns);
    this.log(`📦 Found ${bundlePaths.length} SARB bundles`);

    if (bundlePaths.length < 2) {
      throw new Error('Need at least 2 bundles to rank');
    }

    // 2. Load and analyze each bundle
    const metrics = await Promise.all(
      bundlePaths.map(path => this.analyzeBundleMetrics(path))
    );

    // 3. Rank bundles by metric
    const rankings = this.rankByMetric(metrics, metric, tieBreaker);

    // 4. Generate pairwise diffs for top performers
    const pairwiseDiffs = await this.generateTopPairwiseDiffs(rankings.slice(0, 3));

    // 5. Calculate insights
    const insights = this.calculateInsights(rankings);

    const result: RankingResult = {
      timestamp: new Date().toISOString(),
      metric,
      tieBreaker,
      totalBundles: rankings.length,
      rankings,
      winner: rankings[0],
      insights,
      pairwiseDiffs
    };

    // 6. Save results
    await this.saveRankingReport(result);

    this.printRankingSummary(result);

    return result;
  }

  private async findBundles(patterns: string[]): Promise<string[]> {
    const allBundles = new Set<string>();

    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        // Glob pattern
        const matches = await glob(pattern);
        matches.forEach(match => allBundles.add(resolve(match)));
      } else if (existsSync(pattern)) {
        allBundles.add(resolve(pattern));
      }
    }

    return Array.from(allBundles).filter(path => path.endsWith('.sarb.zip'));
  }

  private async analyzeBundleMetrics(path: string): Promise<BundleMetrics> {
    const bundle = this.loadBundle(path);

    // Calculate quality score based on analysis depth
    const quality = this.calculateQualityScore(bundle);

    return {
      path,
      name: basename(path, '.sarb.zip'),
      title: bundle.title,
      created: bundle.created,
      model: bundle.model,
      tokens: bundle.totalTokens,
      time: bundle.duration / 1000, // convert ms to seconds
      cost: bundle.cost,
      quality,
      choice: bundle.analysis?.recommendation?.choice || 'unknown',
      confidence: bundle.analysis?.recommendation?.confidence || 0
    };
  }

  private loadBundle(zipPath: string): SARBBundle {
    if (!existsSync(zipPath)) {
      throw new Error(`Bundle not found: ${zipPath}`);
    }

    // Extract bundle metadata (simplified extraction)
    try {
      // Create a temp directory and extract
      const tempDir = `/tmp/claude/sarb-rank-${Date.now()}`;
      execSync(`mkdir -p ${tempDir}`);
      execSync(`cd ${tempDir} && unzip -q ${zipPath}`);

      // Find the main SARB JSON file
      const sarbFile = execSync(`find ${tempDir} -name "*.sarb.json" | head -1`, { encoding: 'utf-8' }).trim();
      if (sarbFile) {
        const data = JSON.parse(readFileSync(sarbFile, 'utf-8'));

        // Convert SARB format to internal bundle format
        const bundle: SARBBundle = {
          title: data.scenario?.decision?.title || data.scenario?.title || basename(zipPath, '.sarb.zip'),
          created: data.created || new Date().toISOString(),
          prompt: data.prompt || '',
          completion: data.completion || data.analysis?.content || '',
          totalTokens: data.metrics?.totalTokens || data.metrics?.tokens || data.totalTokens || 0,
          promptTokens: data.metrics?.promptTokens || Math.floor((data.totalTokens || 0) * 0.7),
          completionTokens: data.metrics?.completionTokens || Math.floor((data.totalTokens || 0) * 0.3),
          cost: data.metrics?.cost || data.cost || 0,
          duration: data.metrics?.duration || data.duration || 0,
          model: data.model || data.metrics?.model || 'unknown',
          options: data.scenario?.decision?.options || data.options || [],
          analysis: {
            reasoning: data.analysis?.reasoning || data.reasoning || '',
            recommendation: {
              choice: data.analysis?.choice || data.choice || 'unknown',
              confidence: data.analysis?.confidence || data.confidence || 0
            }
          }
        };

        // Clean up temp directory
        execSync(`rm -rf ${tempDir}`);

        return bundle;
      }

      // Clean up and throw
      execSync(`rm -rf ${tempDir}`);
      throw new Error('No SARB JSON file found in bundle');

    } catch (error) {
      throw new Error(`Failed to load bundle ${zipPath}: ${error.message}`);
    }
  }

  private calculateQualityScore(bundle: SARBBundle): number {
    let score = 0;

    // Analysis depth (0-40 points)
    const analysisLength = (bundle.analysis?.reasoning || '').length;
    score += Math.min(40, analysisLength / 50); // 1 point per 50 chars, max 40

    // Confidence level (0-30 points)
    score += (bundle.analysis?.recommendation?.confidence || 0) * 0.3;

    // Option coverage (0-20 points)
    const optionCount = bundle.options?.length || 0;
    score += Math.min(20, optionCount * 5); // 5 points per option, max 20

    // Reasoning quality indicators (0-10 points)
    const reasoning = bundle.analysis?.reasoning || '';
    let reasoningQuality = 0;

    if (reasoning.includes('pros') || reasoning.includes('advantages')) reasoningQuality += 2;
    if (reasoning.includes('cons') || reasoning.includes('disadvantages')) reasoningQuality += 2;
    if (reasoning.includes('risk') || reasoning.includes('challenge')) reasoningQuality += 2;
    if (reasoning.includes('recommend') || reasoning.includes('suggest')) reasoningQuality += 2;
    if (reasoning.includes('because') || reasoning.includes('since')) reasoningQuality += 2;

    score += reasoningQuality;

    return Math.min(100, Math.round(score));
  }

  private rankByMetric(
    metrics: BundleMetrics[],
    primaryMetric: 'tokens' | 'time' | 'cost' | 'quality',
    tieBreaker?: 'tokens' | 'time' | 'cost' | 'quality'
  ): BundleMetrics[] {
    return metrics.sort((a, b) => {
      // Primary metric comparison (lower is better for tokens, time, cost; higher is better for quality)
      const aValue = a[primaryMetric];
      const bValue = b[primaryMetric];

      let primaryComparison: number;
      if (primaryMetric === 'quality') {
        primaryComparison = bValue - aValue; // Higher quality is better
      } else {
        primaryComparison = aValue - bValue; // Lower tokens/time/cost is better
      }

      if (primaryComparison !== 0) {
        return primaryComparison;
      }

      // Tie breaker
      if (tieBreaker && tieBreaker !== primaryMetric) {
        const aTieValue = a[tieBreaker];
        const bTieValue = b[tieBreaker];

        if (tieBreaker === 'quality') {
          return bTieValue - aTieValue; // Higher quality is better
        } else {
          return aTieValue - bTieValue; // Lower tokens/time/cost is better
        }
      }

      // Final tie breaker: created date (newer first)
      return new Date(b.created).getTime() - new Date(a.created).getTime();
    });
  }

  private async generateTopPairwiseDiffs(topBundles: BundleMetrics[]): Promise<Array<{bundleA: string, bundleB: string, diffFile: string}>> {
    const diffs: Array<{bundleA: string, bundleB: string, diffFile: string}> = [];

    // Generate diffs between top 3 bundles
    for (let i = 0; i < topBundles.length; i++) {
      for (let j = i + 1; j < topBundles.length; j++) {
        const bundleA = topBundles[i];
        const bundleB = topBundles[j];

        try {
          const diffFile = await this.generatePairwiseDiff(bundleA.path, bundleB.path);
          diffs.push({
            bundleA: bundleA.name,
            bundleB: bundleB.name,
            diffFile
          });
        } catch (error) {
          this.log(`⚠️  Could not generate diff between ${bundleA.name} and ${bundleB.name}`);
        }
      }
    }

    return diffs;
  }

  private async generatePairwiseDiff(pathA: string, pathB: string): Promise<string> {
    // Use existing sarb-diff tool
    const nameA = basename(pathA, '.sarb.zip');
    const nameB = basename(pathB, '.sarb.zip');
    const diffFileName = `${nameA}-vs-${nameB}.md`;
    const diffPath = join(DIFFS_DIR, diffFileName);

    try {
      // Run sarb:diff command
      execSync(`npm run sarb:diff -- "${pathA}" "${pathB}"`, {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });

      return diffFileName;
    } catch (error) {
      // Fallback: create a simple diff
      const simpleDiff = this.createSimpleDiff(pathA, pathB);
      writeFileSync(diffPath, simpleDiff);
      return diffFileName;
    }
  }

  private createSimpleDiff(pathA: string, pathB: string): string {
    const nameA = basename(pathA, '.sarb.zip');
    const nameB = basename(pathB, '.sarb.zip');

    return `# SARB Comparison: ${nameA} vs ${nameB}

**Generated**: ${new Date().toISOString()}

## Bundle A: ${nameA}
- Path: ${pathA}
- File: ${basename(pathA)}

## Bundle B: ${nameB}
- Path: ${pathB}
- File: ${basename(pathB)}

## Summary
Quick comparison generated by SARB Ranker. For detailed analysis, use \`npm run sarb:diff\` directly.

---
*Generated by SARB Ranker Tool*`;
  }

  private calculateInsights(rankings: BundleMetrics[]) {
    const totalBundles = rankings.length;

    const averageTokens = Math.round(rankings.reduce((sum, r) => sum + r.tokens, 0) / totalBundles);
    const averageTime = Math.round(rankings.reduce((sum, r) => sum + r.time, 0) / totalBundles * 100) / 100;
    const averageCost = Math.round(rankings.reduce((sum, r) => sum + r.cost, 0) / totalBundles * 1000) / 1000;
    const averageQuality = Math.round(rankings.reduce((sum, r) => sum + r.quality, 0) / totalBundles);

    const modelBreakdown: Record<string, number> = {};
    const choiceDistribution: Record<string, number> = {};

    rankings.forEach(r => {
      modelBreakdown[r.model] = (modelBreakdown[r.model] || 0) + 1;
      choiceDistribution[r.choice] = (choiceDistribution[r.choice] || 0) + 1;
    });

    return {
      averageTokens,
      averageTime,
      averageCost,
      averageQuality,
      modelBreakdown,
      choiceDistribution
    };
  }

  private async saveRankingReport(result: RankingResult): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = join(DIFFS_DIR, `rank-${timestamp}.md`);

    const markdown = this.generateMarkdownReport(result);
    writeFileSync(reportPath, markdown);

    this.log(`\n📄 Ranking report saved: ${reportPath}`);
  }

  private generateMarkdownReport(result: RankingResult): string {
    const { rankings, winner, insights, metric, tieBreaker } = result;

    const lines = [
      '# SARB Bundle Rankings',
      '',
      `**Generated**: ${result.timestamp}`,
      `**Primary Metric**: ${metric}${tieBreaker ? ` (tie-breaker: ${tieBreaker})` : ''}`,
      `**Total Bundles**: ${result.totalBundles}`,
      '',
      '## 🏆 Winner',
      '',
      `**${winner.name}** (${winner.title})`,
      `- **Score**: ${winner[metric]} ${metric}`,
      `- **Quality**: ${winner.quality}/100`,
      `- **Choice**: ${winner.choice}`,
      `- **Model**: ${winner.model}`,
      `- **Created**: ${winner.created}`,
      '',
      '## 📊 Full Rankings',
      '',
      '| Rank | Bundle | Score | Quality | Choice | Model | Created |',
      '|------|---------|-------|---------|---------|--------|---------|'
    ];

    rankings.forEach((bundle, index) => {
      const score = bundle[metric];
      const formattedScore = typeof score === 'number' ?
        (metric === 'cost' ? `$${score.toFixed(3)}` :
         metric === 'time' ? `${score}s` :
         score.toString()) : score;

      lines.push(`| ${index + 1} | ${bundle.name} | ${formattedScore} | ${bundle.quality}/100 | ${bundle.choice} | ${bundle.model} | ${new Date(bundle.created).toLocaleDateString()} |`);
    });

    lines.push('', '## 📈 Insights', '');

    lines.push(
      `- **Average Tokens**: ${insights.averageTokens}`,
      `- **Average Time**: ${insights.averageTime}s`,
      `- **Average Cost**: $${insights.averageCost}`,
      `- **Average Quality**: ${insights.averageQuality}/100`,
      ''
    );

    // Model breakdown
    lines.push('### Model Distribution', '');
    Object.entries(insights.modelBreakdown).forEach(([model, count]) => {
      lines.push(`- **${model}**: ${count} bundles`);
    });

    // Choice distribution
    lines.push('', '### Choice Distribution', '');
    Object.entries(insights.choiceDistribution).forEach(([choice, count]) => {
      lines.push(`- **${choice}**: ${count} bundles`);
    });

    // Pairwise diffs
    if (result.pairwiseDiffs.length > 0) {
      lines.push('', '## 🔗 Top Pairwise Comparisons', '');
      result.pairwiseDiffs.forEach(diff => {
        lines.push(`- [${diff.bundleA} vs ${diff.bundleB}](./${diff.diffFile})`);
      });
    }

    lines.push('', '---', '*Generated by SARB Ranker Tool*');

    return lines.join('\n');
  }

  private printRankingSummary(result: RankingResult): void {
    console.log('\n🏆 SARB Ranking Summary');
    console.log('=' .repeat(30));
    console.log(`Winner: ${result.winner.name}`);
    console.log(`Metric: ${result.metric} = ${result.winner[result.metric]} ${result.metric}`);
    console.log(`Quality: ${result.winner.quality}/100`);
    console.log(`Bundles ranked: ${result.totalBundles}`);

    console.log('\n📊 Top 3:');
    result.rankings.slice(0, 3).forEach((bundle, index) => {
      const score = bundle[result.metric];
      const formattedScore = typeof score === 'number' ?
        (result.metric === 'cost' ? `$${score.toFixed(3)}` :
         result.metric === 'time' ? `${score}s` :
         score.toString()) : score;
      console.log(`   ${index + 1}. ${bundle.name} (${formattedScore})`);
    });
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  // Parse arguments
  let patterns: string[] = [];
  let metric: 'tokens' | 'time' | 'cost' | 'quality' = 'tokens';
  let tieBreaker: 'tokens' | 'time' | 'cost' | 'quality' | undefined;

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '--metric') {
      metric = args[++i] as any;
    } else if (arg === '--tie') {
      tieBreaker = args[++i] as any;
    } else if (!arg.startsWith('--')) {
      patterns.push(arg);
    }

    i++;
  }

  // Default pattern if none provided
  if (patterns.length === 0) {
    patterns = ['artifacts/runs/*.sarb.zip'];
  }

  const ranker = new SARBRanker();
  ranker.rankBundles(patterns, metric, tieBreaker).catch(error => {
    console.error('SARB ranking failed:', error);
    process.exit(1);
  });
}

export { SARBRanker };