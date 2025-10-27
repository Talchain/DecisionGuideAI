/**
 * Auto-Detecting PLoT Adapter
 *
 * Probes for v1 endpoint availability and falls back to mock when unavailable.
 * Provides seamless transition when backend deploys v1 routes.
 */

import type {
  RunRequest,
  ReportV1,
  ErrorV1,
  LimitsV1,
  TemplateListV1,
  TemplateDetail,
} from './types'
import { plot as mockAdapter } from './mockAdapter'
import { httpV1Adapter } from './httpV1Adapter'
import { probeCapability, clearProbeCache, type ProbeResult } from './v1/probe'

let probeResult: ProbeResult | null = null;
let probePromise: Promise<ProbeResult> | null = null;

/**
 * Get probe result (cached or trigger new probe)
 */
async function getProbeResult(): Promise<ProbeResult> {
  if (probeResult) return probeResult;
  if (probePromise) return probePromise;

  probePromise = probeCapability('/api/plot').then((result) => {
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
export async function getAdapterMode(): Promise<'httpv1' | 'mock'> {
  const probe = await getProbeResult();
  return probe.available ? 'httpv1' : 'mock';
}

/**
 * Get probe status (for UI display)
 */
export async function getProbeStatus(): Promise<ProbeResult> {
  return getProbeResult();
}

/**
 * Auto-detecting adapter
 */
export const autoDetectAdapter = {
  async run(input: RunRequest): Promise<ReportV1> {
    const probe = await getProbeResult();

    if (probe.available) {
      if (import.meta.env.DEV) {
        console.log('[AutoDetect] Using httpV1 adapter');
      }
      return httpV1Adapter.run(input);
    } else {
      if (import.meta.env.DEV) {
        console.log('[AutoDetect] v1 unavailable, using mock adapter');
      }
      return mockAdapter.run(input);
    }
  },

  async templates(): Promise<TemplateListV1> {
    // Templates always use local blueprints (no v1 API yet)
    return mockAdapter.templates();
  },

  async template(id: string): Promise<TemplateDetail> {
    // Template details always use local blueprints (no v1 API yet)
    return mockAdapter.template(id);
  },

  async limits(): Promise<LimitsV1> {
    const probe = await getProbeResult();
    return probe.available
      ? httpV1Adapter.limits()
      : mockAdapter.limits?.() ?? {
          nodes: { max: 200 },
          edges: { max: 500 },
        };
  },

  async health() {
    const probe = await getProbeResult();
    if (probe.available && httpV1Adapter.health) {
      return httpV1Adapter.health();
    }
    return {
      status: probe.healthStatus,
      timestamp: probe.timestamp,
    };
  },

  stream: {
    run(
      input: RunRequest,
      handlers: {
        onTick?: (data: { index: number }) => void;
        onDone?: (data: { response_id: string; report: ReportV1 }) => void;
        onError?: (error: ErrorV1) => void;
      }
    ): () => void {
      let cancel: (() => void) | null = null;
      let cancelled = false;

      // Probe and delegate
      getProbeResult().then((probe) => {
        // Check if already cancelled during probe
        if (cancelled) {
          if (import.meta.env.DEV) {
            console.log('[AutoDetect] Stream cancelled before probe completed');
          }
          return;
        }

        if (probe.available) {
          if (import.meta.env.DEV) {
            console.log('[AutoDetect] Using httpV1 stream');
          }
          cancel = httpV1Adapter.stream.run(input, handlers);
        } else {
          if (import.meta.env.DEV) {
            console.log('[AutoDetect] v1 unavailable, using mock stream');
          }
          cancel = mockAdapter.stream.run(input, handlers);
        }

        // If cancelled during probe, call cancel now
        if (cancelled && cancel) {
          cancel();
        }
      });

      // Return cancel function that guards against race
      return () => {
        cancelled = true;
        cancel?.();
      };
    },
  },
};
