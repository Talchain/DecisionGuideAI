#!/usr/bin/env tsx

import { readFile, writeFile } from 'fs/promises';
import { basename, dirname, join } from 'path';

interface ExperimentResult {
  variant: {
    id: string;
    scenario: string;
    params: Record<string, any>;
    isBaseline: boolean;
  };
  success: boolean;
  metadata: {
    tokens: number;
    duration: number;
    cost: number;
    steps: number;
  };
}

interface ExperimentData {
  grid: {
    name: string;
    description: string;
    scenarios: string[];
    grid: Record<string, any[]>;
    baseline: Record<string, any>;
  };
  results: ExperimentResult[];
  timestamp: string;
}

interface TuningRecommendation {
  scenario: string;
  current: {
    params: Record<string, any>;
    metrics: {
      tokens: number;
      duration: number;
      cost: number;
    };
  };
  recommended: {
    params: Record<string, any>;
    expectedChange: {
      tokens: string; // e.g., "-18%"
      duration: string;
      cost: string;
      quality: string; // e.g., "same", "better", "slightly worse"
    };
    reasoning: string;
  };
  confidence: 'high' | 'medium' | 'low';
  tradeoffs: string[];
}

interface TuningReport {
  experiment: {
    name: string;
    timestamp: string;
    scenarios: string[];
  };
  summary: {
    totalRecommendations: number;
    averageImprovement: string;
    topRecommendation: string;
  };
  recommendations: TuningRecommendation[];
  methodology: string;
}

function calculatePercentageChange(baseline: number, variant: number): string {
  if (baseline === 0) return '0%';
  const change = ((variant - baseline) / baseline) * 100;
  const sign = change > 0 ? '+' : '';
  return `${sign}${Math.round(change)}%`;
}

function analyzeParameterEffects(results: ExperimentResult[]): Map<string, Map<any, { tokens: number; duration: number; cost: number; count: number }>> {
  const paramEffects = new Map();

  for (const result of results) {
    if (!result.success) continue;

    for (const [param, value] of Object.entries(result.variant.params)) {
      if (!paramEffects.has(param)) {
        paramEffects.set(param, new Map());
      }

      const paramMap = paramEffects.get(param);
      if (!paramMap.has(value)) {
        paramMap.set(value, { tokens: 0, duration: 0, cost: 0, count: 0 });
      }

      const stats = paramMap.get(value);
      stats.tokens += result.metadata.tokens;
      stats.duration += result.metadata.duration;
      stats.cost += result.metadata.cost;
      stats.count++;
    }
  }

  // Convert to averages
  for (const [param, valueMap] of paramEffects) {
    for (const [value, stats] of valueMap) {
      stats.tokens = Math.round(stats.tokens / stats.count);
      stats.duration = Math.round(stats.duration / stats.count);
      stats.cost = parseFloat((stats.cost / stats.count).toFixed(4));
    }
  }

  return paramEffects;
}

function findOptimalSettings(paramEffects: Map<string, Map<any, any>>, baseline: Record<string, any>): Record<string, any> {
  const optimal: Record<string, any> = { ...baseline };

  for (const [param, valueMap] of paramEffects) {
    let bestValue = baseline[param];
    let bestScore = Infinity;

    for (const [value, stats] of valueMap) {
      // Score based on tokens (primary) and cost (secondary)
      // Lower is better
      const score = stats.tokens * 0.7 + stats.cost * 1000 * 0.3;

      if (score < bestScore) {
        bestScore = score;
        bestValue = value;
      }
    }

    optimal[param] = bestValue;
  }

  return optimal;
}

function generateRecommendation(
  scenario: string,
  baseline: ExperimentResult,
  optimal: Record<string, any>,
  paramEffects: Map<string, Map<any, any>>
): TuningRecommendation {
  // Calculate expected metrics with optimal settings
  let expectedTokens = baseline.metadata.tokens;
  let expectedDuration = baseline.metadata.duration;
  let expectedCost = baseline.metadata.cost;

  const reasoning: string[] = [];

  for (const [param, value] of Object.entries(optimal)) {
    const baselineValue = baseline.variant.params[param];
    if (value !== baselineValue) {
      const paramMap = paramEffects.get(param);
      if (paramMap?.has(value)) {
        const stats = paramMap.get(value);
        const baselineStats = paramMap.get(baselineValue);

        if (baselineStats) {
          const tokenRatio = stats.tokens / baselineStats.tokens;
          const durationRatio = stats.duration / baselineStats.duration;
          const costRatio = stats.cost / baselineStats.cost;

          expectedTokens = Math.round(expectedTokens * tokenRatio);
          expectedDuration = Math.round(expectedDuration * durationRatio);
          expectedCost = parseFloat((expectedCost * costRatio).toFixed(4));

          // Add reasoning
          if (param === 'temperature') {
            if (value < baselineValue) {
              reasoning.push(`Lower temperature (${value}) reduces variability and token usage`);
            } else {
              reasoning.push(`Higher temperature (${value}) increases creativity but may use more tokens`);
            }
          } else if (param === 'maxTokens') {
            if (value < baselineValue) {
              reasoning.push(`Lower maxTokens (${value}) constrains output length and cost`);
            } else {
              reasoning.push(`Higher maxTokens (${value}) allows more comprehensive responses`);
            }
          } else {
            reasoning.push(`Optimal ${param} value (${value}) based on token efficiency`);
          }
        }
      }
    }
  }

  // Determine quality impact
  let quality = 'same';
  const tokenChange = Math.abs((expectedTokens - baseline.metadata.tokens) / baseline.metadata.tokens);

  if (tokenChange > 0.2) {
    quality = 'may vary'; // Significant change in output length
  } else if (tokenChange > 0.1) {
    quality = 'similar';
  }

  // Determine confidence
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  const paramsChanged = Object.entries(optimal).filter(([k, v]) => v !== baseline.variant.params[k]).length;

  if (paramsChanged === 0) {
    confidence = 'high'; // No changes needed
  } else if (paramsChanged <= 2) {
    confidence = 'high';
  } else {
    confidence = 'low';
  }

  // Generate tradeoffs
  const tradeoffs: string[] = [];
  if (expectedTokens < baseline.metadata.tokens) {
    tradeoffs.push('Shorter responses may lose detail');
  }
  if (expectedDuration > baseline.metadata.duration) {
    tradeoffs.push('Longer processing time');
  }
  if (optimal.temperature < baseline.variant.params.temperature) {
    tradeoffs.push('Less creative/varied outputs');
  }

  return {
    scenario: basename(scenario, '.yaml'),
    current: {
      params: baseline.variant.params,
      metrics: {
        tokens: baseline.metadata.tokens,
        duration: baseline.metadata.duration,
        cost: baseline.metadata.cost
      }
    },
    recommended: {
      params: optimal,
      expectedChange: {
        tokens: calculatePercentageChange(baseline.metadata.tokens, expectedTokens),
        duration: calculatePercentageChange(baseline.metadata.duration, expectedDuration),
        cost: calculatePercentageChange(baseline.metadata.cost, expectedCost),
        quality
      },
      reasoning: reasoning.join('; ')
    },
    confidence,
    tradeoffs
  };
}

async function generateTuningReport(inputFile: string, outputFile: string): Promise<void> {
  console.log(`📊 Analyzing experiment results: ${inputFile}`);

  // Load experiment data
  const data: ExperimentData = JSON.parse(await readFile(inputFile, 'utf-8'));

  // Group results by scenario
  const scenarioResults = new Map<string, ExperimentResult[]>();

  for (const result of data.results) {
    const scenario = result.variant.scenario;
    if (!scenarioResults.has(scenario)) {
      scenarioResults.set(scenario, []);
    }
    scenarioResults.get(scenario)!.push(result);
  }

  const recommendations: TuningRecommendation[] = [];

  // Generate recommendations for each scenario
  for (const [scenario, results] of scenarioResults) {
    const baseline = results.find(r => r.variant.isBaseline);
    if (!baseline || !baseline.success) {
      console.warn(`⚠️  No successful baseline found for scenario: ${basename(scenario, '.yaml')}`);
      continue;
    }

    // Analyze parameter effects
    const paramEffects = analyzeParameterEffects(results);

    // Find optimal settings
    const optimal = findOptimalSettings(paramEffects, data.grid.baseline);

    // Generate recommendation
    const recommendation = generateRecommendation(scenario, baseline, optimal, paramEffects);
    recommendations.push(recommendation);

    console.log(`✅ Generated recommendation for ${recommendation.scenario}`);
  }

  // Calculate summary statistics
  let totalImprovement = 0;
  let validImprovements = 0;
  let topRecommendation = '';
  let bestImprovement = 0;

  for (const rec of recommendations) {
    const tokenImprovement = parseInt(rec.recommended.expectedChange.tokens.replace(/[^-\d]/g, ''));
    if (!isNaN(tokenImprovement) && tokenImprovement < 0) { // Negative is better (fewer tokens)
      totalImprovement += Math.abs(tokenImprovement);
      validImprovements++;

      if (Math.abs(tokenImprovement) > bestImprovement) {
        bestImprovement = Math.abs(tokenImprovement);
        topRecommendation = `${rec.scenario}: ${rec.recommended.expectedChange.tokens} tokens`;
      }
    }
  }

  const averageImprovement = validImprovements > 0 ?
    Math.round(totalImprovement / validImprovements) : 0;

  // Create tuning report
  const report: TuningReport = {
    experiment: {
      name: data.grid.name,
      timestamp: data.timestamp,
      scenarios: data.grid.scenarios.map(s => basename(s, '.yaml'))
    },
    summary: {
      totalRecommendations: recommendations.length,
      averageImprovement: averageImprovement > 0 ? `-${averageImprovement}%` : '0%',
      topRecommendation: topRecommendation || 'No significant improvements found'
    },
    recommendations,
    methodology: 'Recommendations based on token efficiency analysis across parameter variations. Optimal settings minimize tokens while maintaining output quality.'
  };

  // Generate markdown report
  const markdown = await generateMarkdownReport(report, inputFile);

  await writeFile(outputFile, markdown);
  console.log(`📝 Tuning report saved to: ${outputFile}`);
}

async function generateMarkdownReport(report: TuningReport, sourceFile: string): Promise<string> {
  const md = `# Scenario Auto-Tuning Report

**Experiment:** ${report.experiment.name}
**Generated:** ${new Date().toLocaleString()}
**Source:** \`${sourceFile}\`

## Summary

- **Total Scenarios:** ${report.recommendations.length}
- **Average Improvement:** ${report.summary.averageImprovement} tokens
- **Top Recommendation:** ${report.summary.topRecommendation}

## Recommendations

${report.recommendations.map(rec => `
### ${rec.scenario}

**Current Settings:**
\`\`\`json
${JSON.stringify(rec.current.params, null, 2)}
\`\`\`

**Current Metrics:**
- Tokens: ${rec.current.metrics.tokens}
- Duration: ${rec.current.metrics.duration}s
- Cost: $${rec.current.metrics.cost.toFixed(4)}

**Recommended Settings:**
\`\`\`json
${JSON.stringify(rec.recommended.params, null, 2)}
\`\`\`

**Expected Changes:**
- Tokens: ${rec.recommended.expectedChange.tokens}
- Duration: ${rec.recommended.expectedChange.duration}
- Cost: ${rec.recommended.expectedChange.cost}
- Quality: ${rec.recommended.expectedChange.quality}

**Reasoning:** ${rec.recommended.reasoning}

**Confidence:** ${rec.confidence.toUpperCase()}

${rec.tradeoffs.length > 0 ? `**Potential Tradeoffs:**
${rec.tradeoffs.map(t => `- ${t}`).join('\n')}` : ''}
`).join('\n')}

## Methodology

${report.methodology}

## Next Steps

1. Apply recommended settings to scenarios with high confidence
2. Test recommended parameters in a controlled environment
3. Monitor quality metrics to validate improvements
4. Consider tradeoffs when implementing suggestions

---
*Generated by SARB Experiment Auto-Tuner*
`;

  return md;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📊 Scenario Auto-Tuner - Advisory parameter optimization

Usage:
  npm run exp:tune -- --input <results.json> --out <tuning.md>

Options:
  --input <path>    Path to experiment results.json file (required)
  --out <path>      Output path for tuning report (required)
  -h, --help        Show this help

Examples:
  npm run exp:tune -- --input artifacts/experiments/latest/results.json --out artifacts/experiments/latest/tuning.md
  npm run exp:tune -- --input experiments/exp-001/results.json --out tuning-report.md

The auto-tuner analyzes experiment results to suggest optimal parameter settings
for each scenario based on token efficiency and cost optimization.
    `);
    process.exit(0);
  }

  let inputFile = '';
  let outputFile = '';

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
        inputFile = args[++i];
        break;
      case '--out':
        outputFile = args[++i];
        break;
    }
  }

  if (!inputFile) {
    console.error('❌ Error: --input parameter is required');
    process.exit(1);
  }

  if (!outputFile) {
    console.error('❌ Error: --out parameter is required');
    process.exit(1);
  }

  try {
    await generateTuningReport(inputFile, outputFile);
    console.log('🎯 Auto-tuning analysis complete');
  } catch (error) {
    console.error('❌ Tuning failed:', (error as Error).message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}