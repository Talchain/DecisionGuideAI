/**
 * CSV/JSON Exporters
 * Evidence exports for stakeholders with currency labels and versioning
 */

import { getRunReport } from './run-registry.js';

const VERSION = 'v0.1.0';
const CURRENCY_LABEL = 'USD';

/**
 * Generate CSV filename with seed and version
 */
function generateFilename(type: string, runId?: string, seed?: number, left?: string, right?: string): string {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const seedPart = seed ? `_seed-${seed}` : '';
  const leftRightPart = left && right ? `_${left}-vs-${right}` : (left ? `_${left}` : '');
  const runPart = runId ? `_${runId}` : '';

  return `${type}${runPart}${leftRightPart}${seedPart}_${VERSION}_${timestamp}.csv`;
}

/**
 * Escape CSV field value
 */
function escapeCsvField(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert Report v1 to CSV format
 */
function reportToCsv(report: any, runId: string): string {
  const rows = [];

  // Header
  rows.push([
    'run_id',
    'scenario_id',
    'seed',
    'title',
    'option_id',
    'option_name',
    'option_score',
    'option_description',
    'primary_recommendation',
    'confidence',
    'currency',
    'timestamp',
    'version'
  ].join(','));

  // Data rows - one per option
  if (report.decision && report.decision.options && report.decision.options.length > 0) {
    for (const option of report.decision.options) {
      rows.push([
        escapeCsvField(runId),
        escapeCsvField(report.meta?.scenarioId || ''),
        escapeCsvField(report.meta?.seed || ''),
        escapeCsvField(report.decision.title || ''),
        escapeCsvField(option.id || ''),
        escapeCsvField(option.name || ''),
        escapeCsvField(option.score || ''),
        escapeCsvField(option.description || ''),
        escapeCsvField(report.recommendation?.primary || ''),
        escapeCsvField(report.analysis?.confidence || ''),
        escapeCsvField(CURRENCY_LABEL),
        escapeCsvField(report.meta?.timestamp || new Date().toISOString()),
        escapeCsvField(VERSION)
      ].join(','));
    }
  } else {
    // Fallback row if no options
    rows.push([
      escapeCsvField(runId),
      escapeCsvField(report.meta?.scenarioId || ''),
      escapeCsvField(report.meta?.seed || ''),
      escapeCsvField(report.decision?.title || ''),
      '', '', '', '',
      escapeCsvField(report.recommendation?.primary || ''),
      escapeCsvField(report.analysis?.confidence || ''),
      escapeCsvField(CURRENCY_LABEL),
      escapeCsvField(report.meta?.timestamp || new Date().toISOString()),
      escapeCsvField(VERSION)
    ].join(','));
  }

  return rows.join('\n');
}

/**
 * Convert compare result to CSV format
 */
function compareToCsv(compareResult: any, leftRunId: string, rightRunId: string): string {
  const rows = [];

  // Header
  rows.push([
    'metric',
    'left_run_id',
    'left_scenario_id',
    'left_value',
    'right_run_id',
    'right_scenario_id',
    'right_value',
    'difference',
    'percentage_change',
    'confidence_shift',
    'currency',
    'headline',
    'timestamp',
    'version'
  ].join(','));

  const left = compareResult.left || {};
  const right = compareResult.right || {};
  const delta = compareResult.delta || {};

  // Extract most likely values from reports
  const leftValue = left.report?.analysis?.most_likely_outcome || 0;
  const rightValue = right.report?.analysis?.most_likely_outcome || 0;

  // Main comparison row
  rows.push([
    'most_likely_outcome',
    escapeCsvField(leftRunId),
    escapeCsvField(left.scenarioId || ''),
    escapeCsvField(leftValue),
    escapeCsvField(rightRunId),
    escapeCsvField(right.scenarioId || ''),
    escapeCsvField(rightValue),
    escapeCsvField(delta.most_likely_diff || 0),
    escapeCsvField((delta.most_likely_pct || 0) * 100),
    escapeCsvField(delta.confidence_shift || 'NONE'),
    escapeCsvField(CURRENCY_LABEL),
    escapeCsvField(compareResult.headline || ''),
    escapeCsvField(new Date().toISOString()),
    escapeCsvField(VERSION)
  ].join(','));

  return rows.join('\n');
}

/**
 * Convert batch result to CSV format
 */
function batchToCsv(batchResult: any, baseline: string): string {
  const rows = [];

  // Header
  rows.push([
    'rank',
    'scenario_id',
    'most_likely',
    'delta_vs_baseline_pct',
    'confidence',
    'baseline_scenario',
    'currency',
    'timestamp',
    'version'
  ].join(','));

  // Data rows
  if (batchResult.ranked) {
    batchResult.ranked.forEach((item: any, index: number) => {
      rows.push([
        escapeCsvField(index + 1),
        escapeCsvField(item.scenarioId || ''),
        escapeCsvField(item.most_likely || ''),
        escapeCsvField(item.delta_vs_baseline_pct || ''),
        escapeCsvField(item.confidence || ''),
        escapeCsvField(baseline),
        escapeCsvField(CURRENCY_LABEL),
        escapeCsvField(new Date().toISOString()),
        escapeCsvField(VERSION)
      ].join(','));
    });
  }

  return rows.join('\n');
}

/**
 * Handle GET /export/report.csv request
 */
export async function handleReportCsvRequest(query: any): Promise<any> {
  const { runId } = query || {};

  if (!runId) {
    return {
      status: 400,
      body: {
        type: 'BAD_INPUT',
        message: 'runId parameter required',
        timestamp: new Date().toISOString()
      }
    };
  }

  try {
    const report = getRunReport(runId);

    if (!report) {
      return {
        status: 404,
        body: {
          type: 'BAD_INPUT',
          message: `Run ${runId} not found`,
          timestamp: new Date().toISOString()
        }
      };
    }

    const csv = reportToCsv(report, runId);
    const filename = generateFilename('report', runId, report.meta?.seed);

    return {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store'
      },
      body: csv
    };

  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to generate report CSV',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Handle GET /export/compare.csv request
 */
export async function handleCompareCsvRequest(query: any): Promise<any> {
  const { left, right } = query || {};

  if (!left || !right) {
    return {
      status: 400,
      body: {
        type: 'BAD_INPUT',
        message: 'left and right runId parameters required',
        timestamp: new Date().toISOString()
      }
    };
  }

  try {
    const leftReport = getRunReport(left);
    const rightReport = getRunReport(right);

    if (!leftReport || !rightReport) {
      return {
        status: 404,
        body: {
          type: 'BAD_INPUT',
          message: 'One or both runs not found',
          timestamp: new Date().toISOString()
        }
      };
    }

    // Generate mock compare result
    const compareResult = {
      schema: 'compare.v1',
      left: {
        scenarioId: leftReport.meta?.scenarioId || '',
        runId: left,
        report: leftReport
      },
      right: {
        scenarioId: rightReport.meta?.scenarioId || '',
        runId: right,
        report: rightReport
      },
      delta: {
        most_likely_diff: 1200,
        most_likely_pct: 0.012,
        confidence_shift: 'DOWN'
      },
      headline: 'Moderate improvement: up ~1.2% in Right vs Left'
    };

    const csv = compareToCsv(compareResult, left, right);
    const filename = generateFilename(
      'compare',
      undefined,
      leftReport.meta?.seed,
      leftReport.meta?.scenarioId,
      rightReport.meta?.scenarioId
    );

    return {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store'
      },
      body: csv
    };

  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to generate compare CSV',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Handle GET /export/batch.csv request
 */
export async function handleBatchCsvRequest(query: any): Promise<any> {
  const { baseline, items } = query || {};

  if (!baseline || items === undefined || items === null) {
    return {
      status: 400,
      body: {
        type: 'BAD_INPUT',
        message: 'baseline and items parameters required',
        timestamp: new Date().toISOString()
      }
    };
  }

  try {
    // Parse items (comma-separated scenario IDs)
    const itemList = items.split(',').map((item: string) => item.trim()).filter((item: string) => item.length > 0);

    if (itemList.length === 0) {
      return {
        status: 400,
        body: {
          type: 'BAD_INPUT',
          message: 'At least one item required',
          timestamp: new Date().toISOString()
        }
      };
    }

    // Generate mock batch result
    const batchResult = {
      schema: 'compare-batch.v1',
      ranked: itemList.map((scenarioId, index) => ({
        scenarioId,
        most_likely: 1000000 - (index * 10000), // Decreasing values
        delta_vs_baseline_pct: index === 0 ? 0 : -(index * 1.5),
        confidence: ['HIGH', 'MEDIUM', 'LOW'][Math.min(index, 2)]
      })),
      baseline,
      notes: ['Mock batch data', `Currency: ${CURRENCY_LABEL}`]
    };

    const csv = batchToCsv(batchResult, baseline);
    const filename = generateFilename('batch', undefined, 42, baseline);

    return {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store'
      },
      body: csv
    };

  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to generate batch CSV',
        timestamp: new Date().toISOString()
      }
    };
  }
}