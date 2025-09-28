/**
 * Synthetic Monitoring Status
 * Read-only endpoint to expose latest synthetic test results
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Load latest synthetic monitoring results
 */
function loadSynthLatest(): any {
  // Try multiple possible locations for synth data
  const possiblePaths = [
    join(process.cwd(), 'artifacts', 'synth', 'synth-latest.json'),
    join(process.cwd(), 'artifacts', 'monitoring', 'latest.json'),
    join(process.cwd(), 'synth-latest.json')
  ];

  for (const latestPath of possiblePaths) {
    if (existsSync(latestPath)) {
      try {
        const content = readFileSync(latestPath, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        // Continue to next path if this one fails to parse
        continue;
      }
    }
  }

  // No valid data found
  return {
    status: 'UNKNOWN',
    message: 'No synthetic monitoring data available',
    timestamp: new Date().toISOString(),
    checks_passed: 0,
    checks_total: 0,
    duration_ms: 0
  };
}

/**
 * Handle GET /_status/synth-latest request
 */
export async function handleSynthLatestRequest(): Promise<any> {
  try {
    const synthData = loadSynthLatest();

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: synthData
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to load synthetic monitoring status',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Load pilot metrics if available
 */
function loadPilotMetrics(): any {
  const metricsPath = join(process.cwd(), 'artifacts', 'reports', 'pilot-metrics.json');

  if (!existsSync(metricsPath)) {
    return null;
  }

  try {
    const content = readFileSync(metricsPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Handle GET /_status/pilot-metrics request
 */
export async function handlePilotMetricsRequest(): Promise<any> {
  try {
    const pilotData = loadPilotMetrics();

    if (!pilotData) {
      return {
        status: 404,
        body: {
          type: 'BAD_INPUT',
          message: 'Pilot metrics not available',
          timestamp: new Date().toISOString()
        }
      };
    }

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: pilotData
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to load pilot metrics',
        timestamp: new Date().toISOString()
      }
    };
  }
}