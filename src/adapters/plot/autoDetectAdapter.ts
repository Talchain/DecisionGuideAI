/**
 * Auto-Detecting PLoT Adapter
 *
 * Probes for v1 endpoint availability.
 * Throws clear errors when backend is unavailable (no silent fallback to mock).
 */

import type {
  RunRequest,
  ReportV1,
  LimitsV1,
  TemplateListV1,
  TemplateDetail,
  LimitsFetch,
} from './types'
import { httpV1Adapter } from './httpV1Adapter'
import { probeCapability, clearProbeCache, type ProbeResult } from './v1/probe'

/**
 * Error thrown when backend services are unavailable
 */
export class BackendUnavailableError extends Error {
  constructor(
    message: string,
    public readonly probe: ProbeResult,
    public readonly operation: string
  ) {
    super(message)
    this.name = 'BackendUnavailableError'
  }
}

/**
 * Create a user-friendly error message for backend unavailability
 */
function createBackendErrorMessage(probe: ProbeResult, operation: string): string {
  const baseMsg = `Backend services unavailable for ${operation}.`
  const statusMsg = probe.healthStatus
    ? ` Health check returned: ${probe.healthStatus}`
    : ' Health check failed.'
  const hint = '\n\nPlease check:\n• Backend services are running\n• Network connectivity\n• VITE_PLOT_PROXY_BASE environment variable is correctly set'
  return baseMsg + statusMsg + hint
}

let probeResult: ProbeResult | null = null;
let probePromise: Promise<ProbeResult> | null = null;

/**
 * Get probe result (cached or trigger new probe)
 * Uses VITE_PLOT_PROXY_BASE environment variable to determine base URL
 */
async function getProbeResult(): Promise<ProbeResult> {
  if (probeResult) return probeResult;
  if (probePromise) return probePromise;

  // probeCapability() now reads from VITE_PLOT_PROXY_BASE env var
  probePromise = probeCapability().then((result) => {
    probeResult = result;
    probePromise = null;
    return result;
  });

  return probePromise;
}

/**
 * Force re-probe (for manual refresh)
 */
export async function reprobeCapability(): Promise<ProbeResult> {
  clearProbeCache();
  probeResult = null;
  probePromise = null;
  return getProbeResult();
}

/**
 * Get current adapter mode
 */
export async function getAdapterMode(): Promise<'httpv1' | 'unavailable'> {
  const probe = await getProbeResult();
  return probe.available ? 'httpv1' : 'unavailable';
}

/**
 * Get probe status (for UI display)
 */
export async function getProbeStatus(): Promise<ProbeResult> {
  return getProbeResult();
}

/**
 * Auto-detecting adapter
 * Throws BackendUnavailableError when backend is not accessible
 */
export const autoDetectAdapter = {
  async run(input: RunRequest): Promise<ReportV1> {
    const probe = await getProbeResult();

    if (probe.available) {
      return httpV1Adapter.run(input);
    }

    const errorMsg = createBackendErrorMessage(probe, 'run analysis')
    console.error('[AutoDetect]', errorMsg)
    throw new BackendUnavailableError(errorMsg, probe, 'run')
  },

  async templates(): Promise<TemplateListV1> {
    const probe = await getProbeResult();

    if (probe.available) {
      return httpV1Adapter.templates();
    }

    const errorMsg = createBackendErrorMessage(probe, 'fetch templates')
    console.error('[AutoDetect]', errorMsg)
    throw new BackendUnavailableError(errorMsg, probe, 'templates')
  },

  async template(id: string): Promise<TemplateDetail> {
    const probe = await getProbeResult();

    if (probe.available) {
      return httpV1Adapter.template(id);
    }

    const errorMsg = createBackendErrorMessage(probe, `fetch template "${id}"`)
    console.error('[AutoDetect]', errorMsg)
    throw new BackendUnavailableError(errorMsg, probe, 'template')
  },

  async limits(): Promise<LimitsFetch> {
    const probe = await getProbeResult();

    if (probe.available) {
      return httpV1Adapter.limits();
    }

    // For limits, return a "not available" response instead of throwing
    // This allows the app to continue with conservative defaults
    return {
      ok: false,
      source: 'error',
      data: {
        nodes: { max: 50 },  // Conservative fallback
        edges: { max: 100 },
      } as LimitsV1,
      fetchedAt: Date.now(),
      reason: 'Backend services unavailable. Using conservative limits.',
    };
  },

  async health() {
    const probe = await getProbeResult();
    if (probe.available && httpV1Adapter.health) {
      return httpV1Adapter.health();
    }
    return {
      status: probe.healthStatus || 'unavailable',
      timestamp: probe.timestamp,
      available: probe.available,
    };
  },
};
