#!/usr/bin/env node

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, basename } from 'path';
import { execSync } from 'child_process';
import type { SARBBundle } from './sarb-pack.js';

interface DiffResult {
  section: string;
  status: 'better' | 'worse' | 'same';
  reason: string;
  details?: string;
}

interface SARBDiff {
  timestamp: string;
  bundleA: {
    path: string;
    title: string;
    created: string;
  };
  bundleB: {
    path: string;
    title: string;
    created: string;
  };
  comparison: {
    performance: DiffResult;
    cost: DiffResult;
    content: DiffResult;
    timing: DiffResult;
    overall: DiffResult;
  };
  metrics: {
    tokensDelta: number;
    costDelta: number;
    timeDelta: number;
    contentSimilarity: number;
  };
}

class SARBDiffTool {
  private projectRoot = process.cwd();

  log(message: string): void {
    console.log(message);
  }

  loadBundle(zipPath: string): SARBBundle {
    if (!existsSync(zipPath)) {
      throw new Error(`Bundle not found: ${zipPath}`);
    }

    const tempDir = resolve('tmp', `sarb-diff-${Date.now()}`);
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
      throw new Error(`Failed to load bundle: ${error}`);
    }
  }

  calculateContentSimilarity(textA: string, textB: string): number {
    // Simple similarity based on common words
    const wordsA = textA.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const wordsB = textB.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    const setA = new Set(wordsA);
    const setB = new Set(wordsB);

    const intersection = new Set([...setA].filter(w => setB.has(w)));
    const union = new Set([...setA, ...setB]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  comparePerformance(bundleA: SARBBundle, bundleB: SARBBundle): DiffResult {
    const tokensA = bundleA.results.tokensGenerated;
    const tokensB = bundleB.results.tokensGenerated;
    const timeA = bundleA.results.duration;
    const timeB = bundleB.results.duration;

    const tokensDelta = tokensB - tokensA;
    const timeDelta = timeB - timeA;

    if (tokensB > tokensA * 1.1 || timeB > timeA * 1.1) {
      return {
        section: 'Performance',
        status: 'worse',
        reason: `B uses ${Math.abs(tokensDelta)} more tokens and takes ${Math.round(Math.abs(timeDelta)/1000)}s longer`,
        details: `A: ${tokensA} tokens in ${Math.round(timeA/1000)}s | B: ${tokensB} tokens in ${Math.round(timeB/1000)}s`
      };
    } else if (tokensB < tokensA * 0.9 || timeB < timeA * 0.9) {
      return {
        section: 'Performance',
        status: 'better',
        reason: `B uses ${Math.abs(tokensDelta)} fewer tokens and is ${Math.round(Math.abs(timeDelta)/1000)}s faster`,
        details: `A: ${tokensA} tokens in ${Math.round(timeA/1000)}s | B: ${tokensB} tokens in ${Math.round(timeB/1000)}s`
      };
    } else {
      return {
        section: 'Performance',
        status: 'same',
        reason: 'Similar performance metrics',
        details: `Both use ~${tokensA} tokens in ~${Math.round(timeA/1000)}s`
      };
    }
  }

  compareCost(bundleA: SARBBundle, bundleB: SARBBundle): DiffResult {
    const costA = bundleA.results.cost || 0;
    const costB = bundleB.results.cost || 0;
    const costDelta = costB - costA;

    if (Math.abs(costDelta) < 0.001) {
      return {
        section: 'Cost',
        status: 'same',
        reason: 'Negligible cost difference',
        details: `Both ~$${costA.toFixed(4)}`
      };
    } else if (costB > costA) {
      return {
        section: 'Cost',
        status: 'worse',
        reason: `B costs $${costDelta.toFixed(4)} more`,
        details: `A: $${costA.toFixed(4)} | B: $${costB.toFixed(4)}`
      };
    } else {
      return {
        section: 'Cost',
        status: 'better',
        reason: `B costs $${Math.abs(costDelta).toFixed(4)} less`,
        details: `A: $${costA.toFixed(4)} | B: $${costB.toFixed(4)}`
      };
    }
  }

  compareContent(bundleA: SARBBundle, bundleB: SARBBundle): DiffResult {
    const similarity = this.calculateContentSimilarity(
      bundleA.transcript.markdown,
      bundleB.transcript.markdown
    );

    if (similarity > 0.8) {
      return {
        section: 'Content',
        status: 'same',
        reason: 'Highly similar content',
        details: `${Math.round(similarity * 100)}% similarity`
      };
    } else if (similarity > 0.5) {
      return {
        section: 'Content',
        status: 'same',
        reason: 'Moderately similar content',
        details: `${Math.round(similarity * 100)}% similarity - some variation expected`
      };
    } else {
      return {
        section: 'Content',
        status: 'worse',
        reason: 'Significantly different content',
        details: `Only ${Math.round(similarity * 100)}% similarity - may indicate non-deterministic behavior`
      };
    }
  }

  compareTiming(bundleA: SARBBundle, bundleB: SARBBundle): DiffResult {
    const stepsA = bundleA.results.steps;
    const stepsB = bundleB.results.steps;

    if (stepsA.length !== stepsB.length) {
      return {
        section: 'Timing',
        status: 'worse',
        reason: 'Different number of steps',
        details: `A: ${stepsA.length} steps | B: ${stepsB.length} steps`
      };
    }

    const avgDeltaA = stepsA.reduce((sum, step) => sum + step.deltaTime, 0) / stepsA.length;
    const avgDeltaB = stepsB.reduce((sum, step) => sum + step.deltaTime, 0) / stepsB.length;
    const timingDiff = Math.abs(avgDeltaB - avgDeltaA);

    if (timingDiff < 500) {
      return {
        section: 'Timing',
        status: 'same',
        reason: 'Consistent step timing',
        details: `Average step time: A=${Math.round(avgDeltaA)}ms | B=${Math.round(avgDeltaB)}ms`
      };
    } else {
      return {
        section: 'Timing',
        status: avgDeltaB < avgDeltaA ? 'better' : 'worse',
        reason: `B has ${avgDeltaB < avgDeltaA ? 'faster' : 'slower'} step timing`,
        details: `Average step time: A=${Math.round(avgDeltaA)}ms | B=${Math.round(avgDeltaB)}ms`
      };
    }
  }

  calculateOverall(comparison: SARBDiff['comparison']): DiffResult {
    const results = [comparison.performance, comparison.cost, comparison.content, comparison.timing];

    const better = results.filter(r => r.status === 'better').length;
    const worse = results.filter(r => r.status === 'worse').length;
    const same = results.filter(r => r.status === 'same').length;

    if (better > worse) {
      return {
        section: 'Overall',
        status: 'better',
        reason: `B is better in ${better} areas, worse in ${worse}`,
        details: `Better: ${better}, Same: ${same}, Worse: ${worse}`
      };
    } else if (worse > better) {
      return {
        section: 'Overall',
        status: 'worse',
        reason: `B is worse in ${worse} areas, better in ${better}`,
        details: `Better: ${better}, Same: ${same}, Worse: ${worse}`
      };
    } else {
      return {
        section: 'Overall',
        status: 'same',
        reason: 'Comparable results overall',
        details: `Better: ${better}, Same: ${same}, Worse: ${worse}`
      };
    }
  }

  createDiff(bundlePathA: string, bundlePathB: string): SARBDiff {
    this.log(`📊 Comparing scenario bundles...`);

    const bundleA = this.loadBundle(bundlePathA);
    const bundleB = this.loadBundle(bundlePathB);

    this.log(`   A: ${bundleA.scenario.title}`);
    this.log(`   B: ${bundleB.scenario.title}`);

    const performance = this.comparePerformance(bundleA, bundleB);
    const cost = this.compareCost(bundleA, bundleB);
    const content = this.compareContent(bundleA, bundleB);
    const timing = this.compareTiming(bundleA, bundleB);

    const comparison = { performance, cost, content, timing, overall: { section: '', status: 'same' as const, reason: '' } };
    comparison.overall = this.calculateOverall(comparison);

    const metrics = {
      tokensDelta: bundleB.results.tokensGenerated - bundleA.results.tokensGenerated,
      costDelta: (bundleB.results.cost || 0) - (bundleA.results.cost || 0),
      timeDelta: bundleB.results.duration - bundleA.results.duration,
      contentSimilarity: this.calculateContentSimilarity(bundleA.transcript.markdown, bundleB.transcript.markdown)
    };

    return {
      timestamp: new Date().toISOString(),
      bundleA: {
        path: bundlePathA,
        title: bundleA.scenario.title,
        created: bundleA.created
      },
      bundleB: {
        path: bundlePathB,
        title: bundleB.scenario.title,
        created: bundleB.created
      },
      comparison,
      metrics
    };
  }

  generateHTML(diff: SARBDiff): string {
    const timestamp = new Date(diff.timestamp).toLocaleString();

    return `<!DOCTYPE html>
<html>
<head>
    <title>SARB Diff Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 2rem; line-height: 1.6; }
        .header { background: #f8f9fa; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; }
        .comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin: 2rem 0; }
        .bundle { background: #fff; border: 1px solid #e9ecef; border-radius: 8px; padding: 1.5rem; }
        .metrics { background: #f8f9fa; padding: 1rem; border-radius: 6px; margin: 1rem 0; }
        .result { padding: 0.5rem 1rem; border-radius: 6px; margin: 0.5rem 0; }
        .better { background: #d4edda; border-left: 4px solid #28a745; }
        .worse { background: #f8d7da; border-left: 4px solid #dc3545; }
        .same { background: #e2e3e5; border-left: 4px solid #6c757d; }
        .verdict { font-size: 1.25rem; font-weight: bold; text-align: center; padding: 1rem; border-radius: 8px; }
        .transcript { background: #f8f9fa; padding: 1rem; border-radius: 6px; font-family: monospace; font-size: 0.9rem; max-height: 400px; overflow-y: auto; white-space: pre-wrap; }
        .side-by-side { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .side-by-side h3 { margin-top: 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 SARB Diff Report</h1>
        <p><strong>Generated:</strong> ${timestamp}</p>
    </div>

    <div class="comparison">
        <div class="bundle">
            <h2>📦 Bundle A</h2>
            <p><strong>Title:</strong> ${diff.bundleA.title}</p>
            <p><strong>Created:</strong> ${new Date(diff.bundleA.created).toLocaleString()}</p>
            <p><strong>Path:</strong> <code>${diff.bundleA.path}</code></p>
        </div>
        <div class="bundle">
            <h2>📦 Bundle B</h2>
            <p><strong>Title:</strong> ${diff.bundleB.title}</p>
            <p><strong>Created:</strong> ${new Date(diff.bundleB.created).toLocaleString()}</p>
            <p><strong>Path:</strong> <code>${diff.bundleB.path}</code></p>
        </div>
    </div>

    <div class="metrics">
        <h2>📈 Key Metrics</h2>
        <ul>
            <li><strong>Token Delta:</strong> ${diff.metrics.tokensDelta > 0 ? '+' : ''}${diff.metrics.tokensDelta} tokens</li>
            <li><strong>Cost Delta:</strong> ${diff.metrics.costDelta > 0 ? '+' : ''}$${diff.metrics.costDelta.toFixed(4)}</li>
            <li><strong>Time Delta:</strong> ${diff.metrics.timeDelta > 0 ? '+' : ''}${Math.round(diff.metrics.timeDelta/1000)}s</li>
            <li><strong>Content Similarity:</strong> ${Math.round(diff.metrics.contentSimilarity * 100)}%</li>
        </ul>
    </div>

    <h2>🔍 Detailed Comparison</h2>
    ${Object.values(diff.comparison).map(result => `
    <div class="result ${result.status}">
        <h3>${result.section}</h3>
        <p><strong>Status:</strong> ${result.status.toUpperCase()}</p>
        <p><strong>Reason:</strong> ${result.reason}</p>
        ${result.details ? `<p><strong>Details:</strong> ${result.details}</p>` : ''}
    </div>
    `).join('')}

    <div class="verdict ${diff.comparison.overall.status}">
        <h2>🎯 Overall Verdict</h2>
        <p>${diff.comparison.overall.reason}</p>
        <p><small>${diff.comparison.overall.details}</small></p>
    </div>

    <h2>📝 Side-by-Side Transcripts</h2>
    <div class="side-by-side">
        <div>
            <h3>Bundle A</h3>
            <div class="transcript" id="transcriptA">Loading...</div>
        </div>
        <div>
            <h3>Bundle B</h3>
            <div class="transcript" id="transcriptB">Loading...</div>
        </div>
    </div>

    <script>
        // This would load full transcripts in a real implementation
        document.getElementById('transcriptA').textContent = 'Transcript A content would be here...';
        document.getElementById('transcriptB').textContent = 'Transcript B content would be here...';
    </script>
</body>
</html>`;
  }

  generateMarkdown(diff: SARBDiff): string {
    const timestamp = new Date(diff.timestamp).toLocaleString();

    return `# SARB Diff Report

**Generated:** ${timestamp}

## Bundle Comparison

| | Bundle A | Bundle B |
|---|----------|----------|
| **Title** | ${diff.bundleA.title} | ${diff.bundleB.title} |
| **Created** | ${new Date(diff.bundleA.created).toLocaleString()} | ${new Date(diff.bundleB.created).toLocaleString()} |
| **Path** | \`${diff.bundleA.path}\` | \`${diff.bundleB.path}\` |

## Key Metrics

- **Token Delta:** ${diff.metrics.tokensDelta > 0 ? '+' : ''}${diff.metrics.tokensDelta} tokens
- **Cost Delta:** ${diff.metrics.costDelta > 0 ? '+' : ''}$${diff.metrics.costDelta.toFixed(4)}
- **Time Delta:** ${diff.metrics.timeDelta > 0 ? '+' : ''}${Math.round(diff.metrics.timeDelta/1000)}s
- **Content Similarity:** ${Math.round(diff.metrics.contentSimilarity * 100)}%

## Comparison Results

${Object.values(diff.comparison).map(result => `
### ${result.section}

**Status:** ${result.status.toUpperCase()}
**Reason:** ${result.reason}
${result.details ? `**Details:** ${result.details}` : ''}
`).join('')}

## Verdict

**${diff.comparison.overall.status.toUpperCase()}:** ${diff.comparison.overall.reason}

*${diff.comparison.overall.details}*

---

*Generated by SARB Diff Tool*`;
  }

  saveDiffResults(diff: SARBDiff): { htmlPath: string; markdownPath: string } {
    const timestamp = new Date(diff.timestamp).toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const htmlPath = resolve('artifacts/diffs', `${timestamp}-diff.html`);
    const markdownPath = resolve('artifacts/diffs', `${timestamp}-diff.md`);

    const html = this.generateHTML(diff);
    const markdown = this.generateMarkdown(diff);

    writeFileSync(htmlPath, html);
    writeFileSync(markdownPath, markdown);

    return { htmlPath, markdownPath };
  }

  run(args: string[]): void {
    if (args.length < 2) {
      console.error('Usage: npm run sarb:diff -- <a.sarb.zip> <b.sarb.zip>');
      console.error('Example: npm run sarb:diff -- artifacts/runs/v1.sarb.zip artifacts/runs/v2.sarb.zip');
      process.exit(1);
    }

    const bundlePathA = resolve(args[0]);
    const bundlePathB = resolve(args[1]);

    try {
      const diff = this.createDiff(bundlePathA, bundlePathB);
      const { htmlPath, markdownPath } = this.saveDiffResults(diff);

      this.log('');
      this.log('📊 Diff Results:');
      Object.values(diff.comparison).forEach(result => {
        const icon = result.status === 'better' ? '✅' : result.status === 'worse' ? '❌' : '➖';
        this.log(`   ${icon} ${result.section}: ${result.reason}`);
      });

      this.log('');
      this.log(`💾 Reports saved:`);
      this.log(`   HTML: ${htmlPath}`);
      this.log(`   Markdown: ${markdownPath}`);

      this.log('');
      this.log(`🎯 **Verdict:** ${diff.comparison.overall.reason}`);

    } catch (error) {
      console.error(`❌ Failed to create diff: ${error}`);
      process.exit(1);
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const diffTool = new SARBDiffTool();
  diffTool.run(process.argv.slice(2));
}

export { SARBDiffTool };