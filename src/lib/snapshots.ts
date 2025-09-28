/**
 * Scenario Snapshot & Evidence Packs
 * Generates ZIP bundles containing scenario execution evidence
 */

import { deflate } from 'pako';
import { createHash } from 'crypto';
import { ensureCorrelationId, addCorrelationHeader, createProvenanceInfo } from './correlation.js';
import { enforceTenantSession } from './tenant-sessions.js';
import { ensureReportV1Fields, ensureCompareV1Fields } from './snapshot-normaliser.js';
import { addSignedManifestToBundle } from './signed-snapshot-manifest.js';

export interface SnapshotBundle {
  'scenario.json': any;
  'seed.txt': string;
  'report.json': any;
  'stream.ndjson': string;
  'timings.json': any;
  'provenance.json': any;
}

export interface CompareSnapshotBundle extends SnapshotBundle {
  'compare.json': any;
  'delta.csv': string;
}

export interface RunSnapshot {
  runId: string;
  scenarioId: string;
  seed: number;
  scenario: any;
  report: any;
  sseEvents: any[];
  timings: {
    ttff_ms: number;
    total_duration_ms: number;
    cancel_latency_ms?: number;
  };
  timestamp: string;
}

// Mock data store for PoC - in production would be database
const snapshotStore = new Map<string, RunSnapshot>();

/**
 * Generate commit SHA hash for provenance
 */
function generateCommitSHA(): string {
  // Mock commit SHA for PoC
  return createHash('sha1')
    .update(`${Date.now()}-${Math.random()}`)
    .digest('hex')
    .substring(0, 8);
}

/**
 * Generate mock scenario for given ID and seed
 */
function generateMockScenario(scenarioId: string, seed: number): any {
  return {
    title: `Analysis for ${scenarioId}`,
    context: `Scenario ${scenarioId} with deterministic seed ${seed}`,
    options: [
      {
        id: `${scenarioId}_option_1`,
        name: `Primary option for ${scenarioId}`,
        pros: ['Strategic advantage', 'Market opportunity'],
        cons: ['Implementation complexity', 'Resource requirements']
      },
      {
        id: `${scenarioId}_option_2`,
        name: `Alternative option for ${scenarioId}`,
        pros: ['Lower risk', 'Faster implementation'],
        cons: ['Limited upside', 'Competitive disadvantage']
      }
    ],
    stakeholders: ['Product', 'Engineering', 'Finance'],
    constraints: {
      budget: '£500k',
      timeline: '6 months'
    },
    success_metrics: ['Revenue growth >10%', 'User satisfaction >4.5']
  };
}

/**
 * Generate mock Report v1 for given scenario and seed
 */
function generateMockReport(scenarioId: string, seed: number): any {
  // Use seed for deterministic generation
  const random = () => {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  const baseScore = 0.5 + random() * 0.4; // 0.5-0.9
  const confidence = ['low', 'medium', 'high', 'very high'][Math.floor(random() * 4)];

  return {
    schema: 'report.v1',
    decision: {
      title: `Analysis for ${scenarioId}`,
      options: [
        {
          id: `${scenarioId}_option_1`,
          name: `Primary option for ${scenarioId}`,
          score: Math.round(baseScore * 100) / 100,
          description: 'Recommended strategic approach'
        },
        {
          id: `${scenarioId}_option_2`,
          name: `Alternative option for ${scenarioId}`,
          score: Math.round((baseScore - 0.1) * 100) / 100,
          description: 'Conservative alternative'
        }
      ]
    },
    recommendation: {
      primary: `${scenarioId}_option_1`
    },
    analysis: {
      confidence
    },
    meta: {
      scenarioId,
      seed,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Generate mock SSE events for a scenario execution
 */
function generateMockSSEEvents(scenarioId: string, seed: number): any[] {
  const sessionId = `session_${scenarioId}_${seed}_${Date.now()}`;
  const events = [];

  // Start event
  events.push({
    type: 'start',
    data: {
      sessionId,
      seed,
      timestamp: new Date().toISOString()
    }
  });

  // Token events
  const tokens = [
    'Based', ' on', ' the', ' analysis', ' of', ' scenario', ` ${scenarioId}`,
    ',', ' the', ' recommended', ' approach', ' considers', ' multiple',
    ' factors', ' including', ' market', ' conditions', ' and', ' strategic', ' objectives.'
  ];

  tokens.forEach((token, index) => {
    events.push({
      type: 'token',
      data: {
        text: token,
        tokenIndex: index + 1,
        timestamp: new Date().toISOString(),
        model: 'claude-3-5-sonnet'
      }
    });
  });

  // Progress event
  events.push({
    type: 'progress',
    data: {
      percent: 75,
      message: 'Analysing options'
    }
  });

  // Done event
  events.push({
    type: 'done',
    data: {
      sessionId,
      totalTokens: tokens.length,
      seed
    }
  });

  return events;
}

/**
 * Store a run snapshot
 */
export function storeRunSnapshot(
  runId: string,
  scenarioId: string,
  seed: number,
  scenario?: any,
  report?: any,
  sseEvents?: any[],
  timings?: any
): void {
  const snapshot: RunSnapshot = {
    runId,
    scenarioId,
    seed,
    scenario: scenario || generateMockScenario(scenarioId, seed),
    report: report || generateMockReport(scenarioId, seed),
    sseEvents: sseEvents || generateMockSSEEvents(scenarioId, seed),
    timings: timings || {
      ttff_ms: 150 + Math.random() * 100,
      total_duration_ms: 2000 + Math.random() * 1000
    },
    timestamp: new Date().toISOString()
  };

  snapshotStore.set(runId, snapshot);
}

/**
 * Get a run snapshot by ID
 */
export function getRunSnapshot(runId: string): RunSnapshot | null {
  return snapshotStore.get(runId) || null;
}

/**
 * Create ZIP bundle for a single run snapshot
 */
export function createSnapshotBundle(snapshot: RunSnapshot, correlationId?: string): Buffer {
  const bundle: SnapshotBundle = {
    'scenario.json': snapshot.scenario,
    'seed.txt': snapshot.seed.toString(),
    'report.json': ensureReportV1Fields(snapshot.report),
    'stream.ndjson': snapshot.sseEvents.map(event => JSON.stringify(event)).join('\n'),
    'timings.json': snapshot.timings,
    'provenance.json': correlationId ? createProvenanceInfo(correlationId) : {
      commit_sha: generateCommitSHA(),
      version: 'v0.1.0-pilot',
      timestamp: snapshot.timestamp,
      engine: 'scenario-sandbox-poc'
    }
  };

  // Create ZIP buffer using pako deflate
  const files: { [key: string]: Buffer } = {};

  for (const [filename, content] of Object.entries(bundle)) {
    const jsonContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    files[filename] = Buffer.from(jsonContent, 'utf-8');
  }

  // Add signed manifest if signing is enabled
  const filesWithManifest = addSignedManifestToBundle(files, snapshot.runId);

  // Simple ZIP-like format using deflate
  // In production, would use proper ZIP library
  const zipData = JSON.stringify({
    files: Object.fromEntries(
      Object.entries(filesWithManifest).map(([name, buffer]) => [
        name,
        buffer.toString('base64')
      ])
    )
  });

  return Buffer.from(deflate(zipData));
}

/**
 * Create ZIP bundle for compare snapshot
 */
export function createCompareSnapshotBundle(
  leftSnapshot: RunSnapshot,
  rightSnapshot: RunSnapshot,
  compareResult: any
): Buffer {
  // Normalise reports to ensure required fields
  const leftReportNormalised = ensureReportV1Fields(leftSnapshot.report);
  const rightReportNormalised = ensureReportV1Fields(rightSnapshot.report);
  const compareNormalised = ensureCompareV1Fields(compareResult);

  // Generate delta CSV using normalised reports
  const deltaCsv = [
    'metric,left_value,right_value,difference,percentage_change',
    `most_likely,${compareNormalised.delta.most_likely_diff || 0},${compareNormalised.delta.most_likely_diff || 0},${compareNormalised.delta.most_likely_diff || 0},${(compareNormalised.delta.most_likely_pct || 0) * 100}`,
    `confidence,${leftReportNormalised.analysis.confidence},${rightReportNormalised.analysis.confidence},${compareNormalised.delta.confidence_shift || 'NONE'},`
  ].join('\n');

  const bundle = {
    // Left scenario files
    'left_scenario.json': leftSnapshot.scenario,
    'left_seed.txt': leftSnapshot.seed.toString(),
    'left_report.json': leftReportNormalised,
    'left_stream.ndjson': leftSnapshot.sseEvents.map(event => JSON.stringify(event)).join('\n'),
    'left_timings.json': leftSnapshot.timings,

    // Right scenario files
    'right_scenario.json': rightSnapshot.scenario,
    'right_seed.txt': rightSnapshot.seed.toString(),
    'right_report.json': rightReportNormalised,
    'right_stream.ndjson': rightSnapshot.sseEvents.map(event => JSON.stringify(event)).join('\n'),
    'right_timings.json': rightSnapshot.timings,

    // Compare files
    'compare.json': compareNormalised,
    'delta.csv': deltaCsv,
    'provenance.json': {
      commit_sha: generateCommitSHA(),
      version: 'v0.1.0-pilot',
      timestamp: new Date().toISOString(),
      engine: 'scenario-sandbox-poc'
    }
  };

  // Create ZIP buffer
  const files: { [key: string]: Buffer } = {};

  for (const [filename, content] of Object.entries(bundle)) {
    const jsonContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    files[filename] = Buffer.from(jsonContent, 'utf-8');
  }

  // Add signed manifest if signing is enabled
  // Use left snapshot's runId as the primary identifier for compare bundles
  const filesWithManifest = addSignedManifestToBundle(files, leftSnapshot.runId);

  const zipData = JSON.stringify({
    files: Object.fromEntries(
      Object.entries(filesWithManifest).map(([name, buffer]) => [
        name,
        buffer.toString('base64')
      ])
    )
  });

  return Buffer.from(deflate(zipData));
}

/**
 * Handle GET /runs/{runId}/snapshot request
 */
export async function handleSnapshotRequest(runId: string, headers: Record<string, any> = {}): Promise<any> {
  // Enforce tenant session if enabled
  const sessionCheck = enforceTenantSession(headers);
  if (sessionCheck) {
    return sessionCheck;
  }

  // Generate or extract correlation ID
  const correlationId = ensureCorrelationId(headers, `/runs/${runId}/snapshot`);

  const snapshot = getRunSnapshot(runId);

  if (!snapshot) {
    return {
      status: 404,
      body: {
        type: 'BAD_INPUT',
        message: `Run ${runId} not found`,
        timestamp: new Date().toISOString()
      }
    };
  }

  try {
    const zipBuffer = createSnapshotBundle(snapshot, correlationId);

    return {
      status: 200,
      headers: addCorrelationHeader({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="snapshot_${runId}_seed-${snapshot.seed}_v0.1.0.zip"`,
        'Cache-Control': 'no-store'
      }, correlationId),
      body: zipBuffer
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to generate snapshot bundle',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Handle POST /compare/snapshot request
 */
export async function handleCompareSnapshotRequest(requestBody: any, headers: Record<string, any> = {}): Promise<any> {
  // Enforce tenant session if enabled
  const sessionCheck = enforceTenantSession(headers);
  if (sessionCheck) {
    return sessionCheck;
  }

  // Generate or extract correlation ID
  const correlationId = ensureCorrelationId(headers, '/compare/snapshot');

  if (!requestBody || !requestBody.left || !requestBody.right) {
    return {
      status: 400,
      body: {
        type: 'BAD_INPUT',
        message: 'Both left and right scenarios required',
        timestamp: new Date().toISOString()
      }
    };
  }

  const { left, right } = requestBody;

  // Generate or retrieve snapshots
  const leftRunId = `run_${left.scenarioId}_${left.seed}_${Date.now()}`;
  const rightRunId = `run_${right.scenarioId}_${right.seed}_${Date.now()}`;

  // Store mock snapshots
  storeRunSnapshot(leftRunId, left.scenarioId, left.seed);
  storeRunSnapshot(rightRunId, right.scenarioId, right.seed);

  const leftSnapshot = getRunSnapshot(leftRunId);
  const rightSnapshot = getRunSnapshot(rightRunId);

  if (!leftSnapshot || !rightSnapshot) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to generate scenario snapshots',
        timestamp: new Date().toISOString()
      }
    };
  }

  // Generate compare result using existing logic
  const compareResult = {
    schema: 'compare.v1',
    left: {
      scenarioId: left.scenarioId,
      runId: leftRunId,
      report: leftSnapshot.report
    },
    right: {
      scenarioId: right.scenarioId,
      runId: rightRunId,
      report: rightSnapshot.report
    },
    delta: {
      most_likely_diff: 1200,
      most_likely_pct: 0.012,
      confidence_shift: 'DOWN',
      threshold_events: []
    },
    headline: 'Moderate improvement: up ~1.2% in Right vs Left',
    key_drivers: ['Higher risk tolerance', 'Lower confidence in analysis']
  };

  try {
    const zipBuffer = createCompareSnapshotBundle(leftSnapshot, rightSnapshot, compareResult);

    return {
      status: 200,
      headers: addCorrelationHeader({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="compare_${left.scenarioId}-vs-${right.scenarioId}_seed-${left.seed}_v0.1.0.zip"`,
        'Cache-Control': 'no-store'
      }, correlationId),
      body: zipBuffer
    };
  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to generate compare snapshot bundle',
        timestamp: new Date().toISOString()
      }
    };
  }
}