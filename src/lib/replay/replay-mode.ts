/**
 * Edge Replay Mode
 * Serves recorded NDJSON and report.json from artifacts/snapshots/
 * Dev-only flag, preserves resume and cancel semantics without engine calls
 */

import fs from 'fs/promises';
import path from 'path';

export interface ReplaySession {
  runId: string;
  ndjsonPath: string;
  reportPath: string;
  events: string[];
  currentIndex: number;
  cancelled: boolean;
  resumed: boolean;
}

/**
 * Check if replay mode is enabled
 * Production guard: REPLAY_MODE is blocked in production environments
 */
function isReplayEnabled(): boolean {
  // Production safety: Never allow replay mode in production (case-insensitive)
  if (process.env.NODE_ENV?.toLowerCase() === 'production') {
    return false;
  }

  return process.env.REPLAY_MODE === '1';
}

/**
 * Read NDJSON file and parse events
 */
async function loadNdjsonEvents(filePath: string): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  } catch (error) {
    throw new Error(`Failed to load NDJSON from ${filePath}: ${error.message}`);
  }
}

/**
 * Load report JSON
 */
async function loadReport(filePath: string): Promise<any> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load report from ${filePath}: ${error.message}`);
  }
}

/**
 * Find snapshot files for a given run ID
 */
async function findSnapshotFiles(runId: string): Promise<{ ndjsonPath: string; reportPath: string } | null> {
  const snapshotsDir = path.join('artifacts', 'snapshots');

  try {
    // Look for files matching the runId pattern
    const entries = await fs.readdir(snapshotsDir, { withFileTypes: true });

    let ndjsonPath: string | null = null;
    let reportPath: string | null = null;

    for (const entry of entries) {
      if (entry.isFile()) {
        const fileName = entry.name;

        // Look for NDJSON files with the exact pattern: run-{runId}-stream.ndjson
        if (fileName === `run-${runId}-stream.ndjson` || fileName === `run-${runId}-stream.jsonl`) {
          ndjsonPath = path.join(snapshotsDir, fileName);
        }

        // Look for report files with the exact pattern: run-{runId}-report.json
        if (fileName === `run-${runId}-report.json`) {
          reportPath = path.join(snapshotsDir, fileName);
        }
      }
    }

    if (ndjsonPath && reportPath) {
      return { ndjsonPath, reportPath };
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Core replay mode logic
 */
export class ReplayModeApi {
  private sessions = new Map<string, ReplaySession>();

  /**
   * Check if replay mode is available
   */
  isEnabled(): boolean {
    return isReplayEnabled();
  }

  /**
   * Start a replay session
   */
  async startReplay(runId: string): Promise<{ success: boolean; data?: any; error?: string; status: number }> {
    if (!isReplayEnabled()) {
      return {
        success: false,
        error: 'Replay mode is not enabled.',
        status: 404
      };
    }

    // Check if session already exists
    if (this.sessions.has(runId)) {
      return {
        success: false,
        error: 'Replay session already exists for this run ID.',
        status: 409
      };
    }

    try {
      // Find snapshot files
      const files = await findSnapshotFiles(runId);
      if (!files) {
        return {
          success: false,
          error: 'No recorded snapshots found for the specified run ID.',
          status: 404
        };
      }

      // Load events
      const events = await loadNdjsonEvents(files.ndjsonPath);
      if (events.length === 0) {
        return {
          success: false,
          error: 'No events found in the recorded snapshot.',
          status: 404
        };
      }

      // Create session
      const session: ReplaySession = {
        runId: runId,
        ndjsonPath: files.ndjsonPath,
        reportPath: files.reportPath,
        events: events,
        currentIndex: 0,
        cancelled: false,
        resumed: false
      };

      this.sessions.set(runId, session);

      return {
        success: true,
        data: {
          runId: runId,
          totalEvents: events.length,
          snapshotFiles: {
            ndjson: files.ndjsonPath,
            report: files.reportPath
          }
        },
        status: 200
      };

    } catch (error) {
      return {
        success: false,
        error: 'Unable to start replay session.',
        status: 500
      };
    }
  }

  /**
   * Get next events from replay session
   */
  async getNextEvents(runId: string, count: number = 1, lastEventId?: string): Promise<{ success: boolean; data?: any; error?: string; status: number }> {
    if (!isReplayEnabled()) {
      return {
        success: false,
        error: 'Replay mode is not enabled.',
        status: 404
      };
    }

    const session = this.sessions.get(runId);
    if (!session) {
      return {
        success: false,
        error: 'Replay session not found.',
        status: 404
      };
    }

    try {
      // Handle resume from Last-Event-ID (one time only)
      if (lastEventId && !session.resumed) {
        // Find the event after lastEventId
        let resumeIndex = 0;
        for (let i = 0; i < session.events.length; i++) {
          try {
            const event = JSON.parse(session.events[i]);
            if (event.id === lastEventId) {
              resumeIndex = i + 1;
              break;
            }
          } catch (error) {
            // Skip malformed events
          }
        }
        session.currentIndex = resumeIndex;
        session.resumed = true;
      }

      // Check if cancelled
      if (session.cancelled) {
        return {
          success: true,
          data: {
            events: [],
            completed: true,
            cancelled: true
          },
          status: 200
        };
      }

      // Get next batch of events
      const events = [];
      const maxEvents = Math.min(count, session.events.length - session.currentIndex);

      for (let i = 0; i < maxEvents; i++) {
        const eventJson = session.events[session.currentIndex + i];
        try {
          const event = JSON.parse(eventJson);
          events.push(event);
        } catch (error) {
          // Skip malformed events
        }
      }

      session.currentIndex += maxEvents;

      // Check if completed
      const completed = session.currentIndex >= session.events.length;

      return {
        success: true,
        data: {
          events: events,
          completed: completed,
          cancelled: session.cancelled,
          progress: {
            current: session.currentIndex,
            total: session.events.length
          }
        },
        status: 200
      };

    } catch (error) {
      return {
        success: false,
        error: 'Unable to retrieve replay events.',
        status: 500
      };
    }
  }

  /**
   * Cancel replay session (idempotent)
   */
  async cancelReplay(runId: string): Promise<{ success: boolean; data?: any; error?: string; status: number }> {
    if (!isReplayEnabled()) {
      return {
        success: false,
        error: 'Replay mode is not enabled.',
        status: 404
      };
    }

    const session = this.sessions.get(runId);
    if (!session) {
      return {
        success: false,
        error: 'Replay session not found.',
        status: 404
      };
    }

    // Idempotent cancel
    session.cancelled = true;

    return {
      success: true,
      data: {
        runId: runId,
        cancelled: true,
        cancelledAt: new Date().toISOString()
      },
      status: 200
    };
  }

  /**
   * Get report for replayed run
   */
  async getReplayReport(runId: string): Promise<{ success: boolean; data?: any; error?: string; status: number }> {
    if (!isReplayEnabled()) {
      return {
        success: false,
        error: 'Replay mode is not enabled.',
        status: 404
      };
    }

    const session = this.sessions.get(runId);
    if (!session) {
      return {
        success: false,
        error: 'Replay session not found.',
        status: 404
      };
    }

    try {
      const report = await loadReport(session.reportPath);

      return {
        success: true,
        data: report,
        status: 200
      };

    } catch (error) {
      return {
        success: false,
        error: 'Unable to load replay report.',
        status: 500
      };
    }
  }

  /**
   * List available snapshots for replay
   */
  async listAvailableSnapshots(): Promise<{ success: boolean; data?: any; error?: string; status: number }> {
    if (!isReplayEnabled()) {
      return {
        success: false,
        error: 'Replay mode is not enabled.',
        status: 404
      };
    }

    try {
      const snapshotsDir = path.join('artifacts', 'snapshots');
      const entries = await fs.readdir(snapshotsDir, { withFileTypes: true });

      const snapshots = [];
      const seenRunIds = new Set<string>();

      for (const entry of entries) {
        if (entry.isFile() && (entry.name.endsWith('.ndjson') || entry.name.endsWith('.jsonl'))) {
          // Extract run ID from filename (format: run-{runId}-stream.ndjson)
          const fileName = entry.name;
          const runIdMatch = fileName.match(/run-(.+)-stream\.(ndjson|jsonl)$/);

          if (runIdMatch) {
            const runId = runIdMatch[1];
            if (!seenRunIds.has(runId)) {
              seenRunIds.add(runId);

              // Check if corresponding report exists (format: run-{runId}-report.json)
              const reportExists = entries.some(e =>
                e.name === `run-${runId}-report.json`
              );

              if (reportExists) {
                snapshots.push({
                  runId: runId,
                  ndjsonFile: fileName,
                  available: true
                });
              }
            }
          }
        }
      }

      return {
        success: true,
        data: {
          snapshots: snapshots,
          count: snapshots.length
        },
        status: 200
      };

    } catch (error) {
      return {
        success: false,
        error: 'Unable to list snapshots.',
        status: 500
      };
    }
  }

  /**
   * Clean up completed sessions
   */
  cleanupSessions(): void {
    for (const [runId, session] of this.sessions.entries()) {
      if (session.cancelled || session.currentIndex >= session.events.length) {
        this.sessions.delete(runId);
      }
    }
  }
}

export const replayModeApi = new ReplayModeApi();