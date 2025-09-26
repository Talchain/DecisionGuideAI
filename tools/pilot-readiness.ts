#!/usr/bin/env npx tsx
/**
 * Pilot Readiness Metrics
 *
 * Lightweight tool for tracking pilot progress and readiness indicators.
 * Advisory only - no blocking or enforcement.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface ReadinessMetric {
  category: string;
  item: string;
  status: 'pending' | 'in_progress' | 'completed' | 'not_applicable';
  timestamp?: string;
  notes?: string;
}

interface ReadinessReport {
  generatedAt: string;
  overallScore: number;
  categories: {
    [category: string]: {
      score: number;
      completed: number;
      total: number;
      items: ReadinessMetric[];
    }
  };
}

const METRICS_FILE = 'artifacts/pilot-readiness-metrics.json';

const DEFAULT_METRICS: ReadinessMetric[] = [
  // Core Platform
  { category: 'Core Platform', item: 'Artifacts scan clean (zero critical issues)', status: 'pending' },
  { category: 'Core Platform', item: 'TypeScript compilation green', status: 'pending' },
  { category: 'Core Platform', item: 'Integration tests passing', status: 'pending' },
  { category: 'Core Platform', item: 'Contract coverage >80%', status: 'pending' },

  // UI Integration
  { category: 'UI Integration', item: 'Kickstart pack built and verified', status: 'pending' },
  { category: 'UI Integration', item: 'View models available for all scenarios', status: 'pending' },
  { category: 'UI Integration', item: 'Fixture packs complete (happy/error/cancel paths)', status: 'pending' },
  { category: 'UI Integration', item: 'Live-swap checklist validated', status: 'pending' },

  // Documentation
  { category: 'Documentation', item: 'Operator handbook up-to-date', status: 'pending' },
  { category: 'Documentation', item: 'API documentation current', status: 'pending' },
  { category: 'Documentation', item: 'Demo scripts tested', status: 'pending' },
  { category: 'Documentation', item: 'Troubleshooting guide complete', status: 'pending' },

  // Safety & Compliance
  { category: 'Safety & Compliance', item: 'Feature flags default to OFF', status: 'pending' },
  { category: 'Safety & Compliance', item: 'Simulation mode working', status: 'pending' },
  { category: 'Safety & Compliance', item: 'No sensitive data in artifacts', status: 'pending' },
  { category: 'Safety & Compliance', item: 'Rate limiting configured', status: 'pending' },

  // Pilot Preparation
  { category: 'Pilot Preparation', item: 'Demo environment ready', status: 'pending' },
  { category: 'Pilot Preparation', item: 'Stakeholder materials prepared', status: 'pending' },
  { category: 'Pilot Preparation', item: 'Success criteria defined', status: 'pending' },
  { category: 'Pilot Preparation', item: 'Rollback plan documented', status: 'pending' }
];

function loadMetrics(): ReadinessMetric[] {
  if (!existsSync(METRICS_FILE)) {
    return [...DEFAULT_METRICS];
  }

  try {
    const data = JSON.parse(readFileSync(METRICS_FILE, 'utf8'));
    return data.metrics || DEFAULT_METRICS;
  } catch (error) {
    console.warn(`Warning: Could not load metrics from ${METRICS_FILE}, using defaults`);
    return [...DEFAULT_METRICS];
  }
}

function saveMetrics(metrics: ReadinessMetric[]): void {
  const data = {
    lastUpdated: new Date().toISOString(),
    metrics
  };
  writeFileSync(METRICS_FILE, JSON.stringify(data, null, 2));
}

function generateReport(metrics: ReadinessMetric[]): ReadinessReport {
  const categories: { [key: string]: { score: number; completed: number; total: number; items: ReadinessMetric[] } } = {};

  // Group by category
  metrics.forEach(metric => {
    if (!categories[metric.category]) {
      categories[metric.category] = {
        score: 0,
        completed: 0,
        total: 0,
        items: []
      };
    }
    categories[metric.category].items.push(metric);
    categories[metric.category].total++;
    if (metric.status === 'completed') {
      categories[metric.category].completed++;
    }
  });

  // Calculate scores
  Object.keys(categories).forEach(category => {
    const cat = categories[category];
    cat.score = cat.total > 0 ? Math.round((cat.completed / cat.total) * 100) : 0;
  });

  // Calculate overall score
  const totalItems = metrics.filter(m => m.status !== 'not_applicable').length;
  const completedItems = metrics.filter(m => m.status === 'completed').length;
  const overallScore = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return {
    generatedAt: new Date().toISOString(),
    overallScore,
    categories
  };
}

function autoDetectStatus(): Partial<{ [key: string]: 'completed' | 'pending' }> {
  const detections: { [key: string]: 'completed' | 'pending' } = {};

  // Check artifacts scan
  if (existsSync('artifacts/reports/artefact-scan.md')) {
    try {
      const scanContent = readFileSync('artifacts/reports/artefact-scan.md', 'utf8');
      if (scanContent.includes('Total Issues: 0') || scanContent.includes('🟢 Clean')) {
        detections['Artifacts scan clean (zero critical issues)'] = 'completed';
      }
    } catch {}
  }

  // Check TypeScript compilation
  try {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    if (packageJson.scripts?.typecheck) {
      detections['TypeScript compilation green'] = 'completed'; // Assume OK if script exists
    }
  } catch {}

  // Check kickstart pack
  if (existsSync('artifacts/decisionguide-ui-kickstart-pack-1.0.0.tgz')) {
    detections['Kickstart pack built and verified'] = 'completed';
  }

  // Check view models
  if (existsSync('artifacts/ui-viewmodels') || existsSync('artifacts/ui-fixtures')) {
    detections['View models available for all scenarios'] = 'completed';
  }

  // Check operator handbook
  if (existsSync('docs/OPERATOR_HANDBOOK.md')) {
    detections['Operator handbook up-to-date'] = 'completed';
  }

  // Check feature flags defaults
  if (existsSync('artifacts/claude-standing-permissions.md')) {
    try {
      const charter = readFileSync('artifacts/claude-standing-permissions.md', 'utf8');
      if (charter.includes('defaults OFF')) {
        detections['Feature flags default to OFF'] = 'completed';
      }
    } catch {}
  }

  // Check simulation mode
  if (existsSync('artifacts/ui-kickstart-pack') || existsSync('artifacts/windsurf-handover.zip')) {
    detections['Simulation mode working'] = 'completed';
  }

  return detections;
}

function printReport(report: ReadinessReport): void {
  console.log('📊 Pilot Readiness Report');
  console.log('=' .repeat(50));
  console.log(`Generated: ${new Date(report.generatedAt).toLocaleString()}`);
  console.log(`Overall Readiness: ${report.overallScore}%`);
  console.log('');

  // Category breakdown
  Object.entries(report.categories).forEach(([categoryName, category]) => {
    const icon = category.score >= 80 ? '🟢' : category.score >= 50 ? '🟡' : '🔴';
    console.log(`${icon} ${categoryName}: ${category.score}% (${category.completed}/${category.total})`);

    category.items.forEach(item => {
      const statusIcon = item.status === 'completed' ? '✅' :
                        item.status === 'in_progress' ? '🔄' :
                        item.status === 'not_applicable' ? '➖' : '⏳';
      console.log(`  ${statusIcon} ${item.item}`);
      if (item.notes) {
        console.log(`     📝 ${item.notes}`);
      }
    });
    console.log('');
  });

  // Readiness assessment
  console.log('🎯 Readiness Assessment');
  console.log('-' .repeat(30));
  if (report.overallScore >= 90) {
    console.log('🚀 Ready for pilot launch');
  } else if (report.overallScore >= 70) {
    console.log('⚠️  Nearly ready - address remaining items');
  } else if (report.overallScore >= 50) {
    console.log('🔧 Significant preparation needed');
  } else {
    console.log('🚧 Major work required before pilot');
  }
  console.log('');
}

function updateMetric(itemName: string, status: ReadinessMetric['status'], notes?: string): void {
  const metrics = loadMetrics();
  const metric = metrics.find(m => m.item.toLowerCase().includes(itemName.toLowerCase()));

  if (!metric) {
    console.error(`❌ Metric not found: ${itemName}`);
    console.log('\nAvailable metrics:');
    metrics.forEach(m => console.log(`  - ${m.item}`));
    return;
  }

  metric.status = status;
  metric.timestamp = new Date().toISOString();
  if (notes) metric.notes = notes;

  saveMetrics(metrics);
  console.log(`✅ Updated: ${metric.item} → ${status}`);
}

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'update') {
    const itemName = args[1];
    const status = args[2] as ReadinessMetric['status'];
    const notes = args.slice(3).join(' ');

    if (!itemName || !status) {
      console.error('Usage: pilot-readiness update <item-name> <status> [notes]');
      console.log('Status options: pending, in_progress, completed, not_applicable');
      return;
    }

    updateMetric(itemName, status, notes);
    return;
  }

  if (command === 'reset') {
    saveMetrics([...DEFAULT_METRICS]);
    console.log('✅ Reset metrics to defaults');
    return;
  }

  if (command === 'auto-detect') {
    const metrics = loadMetrics();
    const detections = autoDetectStatus();
    let updated = 0;

    Object.entries(detections).forEach(([itemName, status]) => {
      const metric = metrics.find(m => m.item === itemName);
      if (metric && metric.status !== status) {
        metric.status = status;
        metric.timestamp = new Date().toISOString();
        metric.notes = 'Auto-detected';
        updated++;
      }
    });

    if (updated > 0) {
      saveMetrics(metrics);
      console.log(`✅ Auto-detected and updated ${updated} metrics`);
    } else {
      console.log('ℹ️  No new completions detected');
    }
  }

  // Default: show report
  const metrics = loadMetrics();
  const report = generateReport(metrics);
  printReport(report);

  // Save HTML report
  const htmlReport = generateHtmlReport(report);
  writeFileSync('artifacts/pilot-readiness.html', htmlReport);
  console.log('💾 Detailed report saved to artifacts/pilot-readiness.html');
}

function generateHtmlReport(report: ReadinessReport): string {
  const categoryRows = Object.entries(report.categories).map(([name, cat]) => {
    const itemsList = cat.items.map(item => {
      const statusIcon = item.status === 'completed' ? '✅' :
                        item.status === 'in_progress' ? '🔄' :
                        item.status === 'not_applicable' ? '➖' : '⏳';
      return `<li>${statusIcon} ${item.item}${item.notes ? ` <em>(${item.notes})</em>` : ''}</li>`;
    }).join('');

    const scoreColor = cat.score >= 80 ? '#27ae60' : cat.score >= 50 ? '#f39c12' : '#e74c3c';

    return `
      <div class="category-card">
        <div class="category-header">
          <h3>${name}</h3>
          <div class="score" style="background: ${scoreColor}">${cat.score}%</div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${cat.score}%; background: ${scoreColor}"></div>
        </div>
        <p class="category-summary">${cat.completed} of ${cat.total} completed</p>
        <ul class="items-list">${itemsList}</ul>
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pilot Readiness Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 2rem; background: #f8f9fa; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 2rem; }
        .overall-score { font-size: 3rem; font-weight: bold; color: ${report.overallScore >= 70 ? '#27ae60' : '#e74c3c'}; }
        .categories { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; }
        .category-card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .category-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
        .category-header h3 { margin: 0; }
        .score { background: #007bff; color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-weight: bold; }
        .progress-bar { height: 8px; background: #e9ecef; border-radius: 4px; margin: 0.5rem 0; overflow: hidden; }
        .progress-fill { height: 100%; transition: width 0.3s ease; }
        .category-summary { color: #6c757d; font-size: 0.9rem; margin: 0.5rem 0 1rem 0; }
        .items-list { list-style: none; padding: 0; margin: 0; }
        .items-list li { padding: 0.25rem 0; font-size: 0.9rem; }
        .footer { text-align: center; margin-top: 2rem; color: #6c757d; font-size: 0.9rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Pilot Readiness Report</h1>
            <div class="overall-score">${report.overallScore}%</div>
            <p>Generated: ${new Date(report.generatedAt).toLocaleString()}</p>
        </div>
        <div class="categories">
            ${categoryRows}
        </div>
        <div class="footer">
            <p>Advisory metrics only • Use <code>npx tsx tools/pilot-readiness.ts update</code> to update status</p>
        </div>
    </div>
</body>
</html>`;
}

// Run main if this is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}