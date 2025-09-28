#!/usr/bin/env node

/**
 * stability-runner.mjs
 * Run stability tests across multiple seeds and compute confidence scores
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const STABILITY_SEEDS = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41];

/**
 * Make HTTP request
 */
async function makeRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return response;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error(`Unable to connect to API at ${BASE_URL}. Is the server running?`);
    }
    throw error;
  }
}

/**
 * Run scenario and get metrics
 */
async function runScenarioAndGetMetrics(seed) {
  const startTime = Date.now();

  try {
    // Default test scenario
    const scenario = {
      nodes: [
        { id: 'decision', label: 'Stability Test', weight: 1.0 },
        { id: 'factor1', label: 'Factor 1', weight: 0.7 },
        { id: 'factor2', label: 'Factor 2', weight: 0.6 },
        { id: 'factor3', label: 'Factor 3', weight: 0.8 }
      ],
      links: [
        { from: 'decision', to: 'factor1', weight: 0.7 },
        { from: 'decision', to: 'factor2', weight: 0.6 },
        { from: 'decision', to: 'factor3', weight: 0.8 }
      ]
    };

    // Start stream
    const streamResponse = await makeRequest('/stream', {
      method: 'POST',
      body: JSON.stringify({
        seed: seed,
        scenario: scenario,
        meta: {
          stabilityTest: true,
          timestamp: new Date().toISOString()
        }
      })
    });

    const streamData = await streamResponse.json();
    const runId = streamData.runId;

    // Wait for completion
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout

    while (attempts < maxAttempts) {
      try {
        const reportResponse = await makeRequest(`/report/${runId}`);
        if (reportResponse.ok) {
          const report = await reportResponse.json();
          const endTime = Date.now();

          // Extract key metrics
          const metrics = {
            seed: seed,
            runId: runId,
            status: report.status,
            duration: endTime - startTime,
            success: report.status === 'completed',
            error: report.status === 'error' ? report.error : null
          };

          // Extract numeric metrics from report
          if (report.summary) {
            metrics.summary = { ...report.summary };
          }

          if (report.decisions && report.decisions.length > 0) {
            metrics.decisionScore = report.decisions[0].score || 0;
          }

          if (report.factors) {
            metrics.factorCount = report.factors.length;
            metrics.avgFactorWeight = report.factors.reduce((sum, f) => sum + (f.weight || 0), 0) / report.factors.length;
          }

          return metrics;
        }
      } catch (error) {
        // Report not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    // Timeout
    return {
      seed: seed,
      status: 'timeout',
      duration: Date.now() - startTime,
      success: false,
      error: 'Timeout waiting for completion'
    };

  } catch (error) {
    return {
      seed: seed,
      status: 'error',
      duration: Date.now() - startTime,
      success: false,
      error: error.message
    };
  }
}

/**
 * Calculate statistics for an array of values
 */
function calculateStats(values) {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;

  let variance = 0;
  for (const value of values) {
    variance += Math.pow(value - mean, 2);
  }
  variance /= values.length;

  const stdDev = Math.sqrt(variance);

  return {
    count: values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Number(mean.toFixed(3)),
    median: sorted[Math.floor(sorted.length / 2)],
    stdDev: Number(stdDev.toFixed(3)),
    cv: mean > 0 ? Number((stdDev / mean).toFixed(3)) : 0 // Coefficient of variation
  };
}

/**
 * Calculate stability score
 */
function calculateStabilityScore(metrics) {
  const successfulRuns = metrics.filter(m => m.success);
  const successRate = successfulRuns.length / metrics.length;

  if (successfulRuns.length < 2) {
    return {
      score: 0,
      confidence: 'LOW',
      reason: 'Insufficient successful runs'
    };
  }

  // Calculate consistency scores for various metrics
  const scores = [];

  // Duration consistency (lower CV is better)
  const durations = successfulRuns.map(m => m.duration);
  const durationStats = calculateStats(durations);
  if (durationStats) {
    const durationScore = Math.max(0, 1 - durationStats.cv); // CV < 1 = good
    scores.push({ metric: 'duration', score: durationScore, weight: 0.3 });
  }

  // Decision score consistency
  const decisionScores = successfulRuns.map(m => m.decisionScore).filter(s => s !== undefined);
  if (decisionScores.length > 1) {
    const decisionStats = calculateStats(decisionScores);
    const decisionScore = Math.max(0, 1 - decisionStats.cv);
    scores.push({ metric: 'decisionScore', score: decisionScore, weight: 0.4 });
  }

  // Factor consistency
  const factorCounts = successfulRuns.map(m => m.factorCount).filter(c => c !== undefined);
  if (factorCounts.length > 1) {
    const factorStats = calculateStats(factorCounts);
    const factorScore = factorStats.stdDev === 0 ? 1 : Math.max(0, 1 - factorStats.cv);
    scores.push({ metric: 'factorCount', score: factorScore, weight: 0.3 });
  }

  // Calculate weighted average
  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
  const weightedScore = scores.reduce((sum, s) => sum + (s.score * s.weight), 0) / totalWeight;

  // Apply success rate penalty
  const finalScore = weightedScore * successRate;

  // Determine confidence level
  let confidence;
  if (successfulRuns.length >= 15 && successRate >= 0.9 && finalScore >= 0.8) {
    confidence = 'HIGH';
  } else if (successfulRuns.length >= 10 && successRate >= 0.7 && finalScore >= 0.6) {
    confidence = 'MEDIUM';
  } else {
    confidence = 'LOW';
  }

  return {
    score: Number(finalScore.toFixed(3)),
    confidence: confidence,
    successRate: Number(successRate.toFixed(3)),
    components: scores
  };
}

/**
 * Run stability test
 */
async function runStabilityTest() {
  console.log('📊 Starting Stability Test');
  console.log(`🎯 Testing ${STABILITY_SEEDS.length} seeds: ${STABILITY_SEEDS[0]}-${STABILITY_SEEDS[STABILITY_SEEDS.length - 1]}`);
  console.log(`🌐 API: ${BASE_URL}`);

  const startTime = Date.now();
  const metrics = [];

  try {
    // Run tests in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < STABILITY_SEEDS.length; i += batchSize) {
      const batch = STABILITY_SEEDS.slice(i, i + batchSize);
      console.log(`🔄 Running batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(STABILITY_SEEDS.length / batchSize)}: seeds ${batch.join(', ')}`);

      const batchResults = await Promise.all(
        batch.map(seed => runScenarioAndGetMetrics(seed))
      );

      metrics.push(...batchResults);

      // Show progress
      const successful = batchResults.filter(m => m.success).length;
      console.log(`✅ Batch complete: ${successful}/${batchResults.length} successful`);
    }

    const endTime = Date.now();
    const totalDuration = Math.round((endTime - startTime) / 1000);

    // Calculate stability metrics
    const stabilityScore = calculateStabilityScore(metrics);
    const successfulRuns = metrics.filter(m => m.success);

    // Generate statistics
    const durations = successfulRuns.map(m => m.duration);
    const durationStats = calculateStats(durations);

    const decisionScores = successfulRuns.map(m => m.decisionScore).filter(s => s !== undefined);
    const decisionStats = calculateStats(decisionScores);

    const summary = {
      timestamp: new Date().toISOString(),
      testDuration: totalDuration,
      seedsWhere: {
        total: STABILITY_SEEDS.length,
        successful: successfulRuns.length,
        failed: metrics.length - successfulRuns.length
      },
      stabilityScore: stabilityScore,
      statistics: {
        duration: durationStats,
        decisionScore: decisionStats
      },
      metrics: metrics
    };

    // Write report
    const reportsDir = path.join(projectRoot, 'artifacts', 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const briefPath = path.join(reportsDir, 'stability-brief.md');
    const briefContent = generateStabilityBrief(summary);
    await fs.writeFile(briefPath, briefContent);

    // Print summary
    console.log(`\n📊 STABILITY TEST COMPLETE`);
    console.log(`⏱️  Duration: ${totalDuration}s`);
    console.log(`🎯 Seeds tested: ${STABILITY_SEEDS.length}`);
    console.log(`✅ Successful: ${successfulRuns.length}`);
    console.log(`❌ Failed: ${metrics.length - successfulRuns.length}`);
    console.log(`🏆 Stability Score: ${stabilityScore.score} (${stabilityScore.confidence})`);
    console.log(`📁 Brief: ${briefPath}`);

    return summary;

  } catch (error) {
    console.error(`\n❌ Stability test failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Generate stability brief in plain English
 */
function generateStabilityBrief(summary) {
  const { timestamp, testDuration, seedsWhere, stabilityScore, statistics } = summary;

  const scoreEmoji = stabilityScore.score >= 0.8 ? '🟢' : stabilityScore.score >= 0.6 ? '🟡' : '🔴';
  const confidenceEmoji = stabilityScore.confidence === 'HIGH' ? '🔒' : stabilityScore.confidence === 'MEDIUM' ? '⚠️' : '❓';

  let brief = `# Platform Stability Brief

${scoreEmoji} **Overall Stability: ${(stabilityScore.score * 100).toFixed(1)}%** ${confidenceEmoji} **Confidence: ${stabilityScore.confidence}**

*Generated: ${timestamp}*

## Executive Summary

I tested the platform stability by running ${seedsWhere.total} different scenarios and measuring consistency across key metrics. Here's what I found:

### The Good News 📈
- **${seedsWhere.successful} out of ${seedsWhere.total} scenarios completed successfully** (${(seedsWhere.successful / seedsWhere.total * 100).toFixed(1)}% success rate)
- Platform responded consistently with ${stabilityScore.confidence.toLowerCase()} confidence in results

### Performance Characteristics 🚀
`;

  if (statistics.duration) {
    brief += `- **Response times:** Average ${statistics.duration.mean}ms (range: ${statistics.duration.min}-${statistics.duration.max}ms)
- **Consistency:** ${statistics.duration.cv < 0.3 ? 'Very consistent' : statistics.duration.cv < 0.6 ? 'Moderately consistent' : 'Variable'} timing (${(statistics.duration.cv * 100).toFixed(1)}% variation)
`;
  }

  if (statistics.decisionScore) {
    brief += `- **Decision scoring:** Average ${statistics.decisionScore.mean} (consistency: ${(100 - statistics.decisionScore.cv * 100).toFixed(1)}%)
`;
  }

  brief += `
### Stability Assessment 🎯

`;

  if (stabilityScore.score >= 0.8) {
    brief += `**Excellent stability** - The platform produces highly consistent results across different scenarios. This level of stability is suitable for:
- Production deployment
- User demonstrations
- Automated testing
- Critical decision support

`;
  } else if (stabilityScore.score >= 0.6) {
    brief += `**Good stability** - The platform shows consistent behaviour with minor variations. This is acceptable for:
- Development and testing
- Controlled demonstrations
- Beta deployments

Some optimisation may improve consistency further.

`;
  } else {
    brief += `**Needs attention** - The platform shows significant variation in behaviour. Consider investigating:
- Resource constraints
- Configuration issues
- Algorithmic consistency
- Error handling

`;
  }

  if (seedsWhere.failed > 0) {
    brief += `### Issues to Address ⚠️

${seedsWhere.failed} scenarios failed to complete. Common causes:
- Network timeouts
- Resource constraints
- Invalid configurations
- Service dependencies

`;
  }

  brief += `## Technical Details 🔧

**Test Parameters:**
- Seeds tested: ${seedsWhere.total}
- Test duration: ${testDuration} seconds
- Success rate: ${stabilityScore.successRate}
- Base URL: ${process.env.BASE_URL || 'http://localhost:3001'}

**Stability Components:**
`;

  if (stabilityScore.components) {
    stabilityScore.components.forEach(component => {
      brief += `- **${component.metric}:** ${(component.score * 100).toFixed(1)}% (weight: ${(component.weight * 100).toFixed(0)}%)
`;
    });
  }

  brief += `
## Confidence Bands 📊

- **HIGH (🔒):** 15+ successful runs, 90%+ success rate, 80%+ stability score
- **MEDIUM (⚠️):** 10+ successful runs, 70%+ success rate, 60%+ stability score
- **LOW (❓):** Below medium thresholds

Current result: **${stabilityScore.confidence}** confidence with **${(stabilityScore.score * 100).toFixed(1)}%** stability score.

## Recommendations 💡

`;

  if (stabilityScore.confidence === 'HIGH') {
    brief += `The platform is performing excellently. Continue current practices and consider this stability level as a baseline for monitoring.`;
  } else if (stabilityScore.confidence === 'MEDIUM') {
    brief += `The platform is stable enough for most use cases. Consider:
- Monitoring resource usage during peak loads
- Optimising slower operations
- Investigating occasional failures`;
  } else {
    brief += `Priority actions needed:
- Investigate and fix failed scenarios
- Check system resources and dependencies
- Review configuration for consistency
- Consider load balancing or scaling improvements`;
  }

  brief += `

---
*This brief was generated automatically. For detailed metrics and raw data, see the full stability test results.*`;

  return brief;
}

/**
 * Main function
 */
async function main() {
  await runStabilityTest();
}

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
  console.error('Unexpected error:', error.message);
  process.exit(1);
});

// Run main function
main().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});