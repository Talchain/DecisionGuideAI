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
    const probe = await getProbeResult();

    if (probe.available) {
      try {
        if (import.meta.env.DEV) {
          console.log('[AutoDetect] Using httpV1 templates');
        }
        return await httpV1Adapter.templates();
      } catch (err) {
        // Network error or API failure - fall back to mock
        if (import.meta.env.DEV) {
          console.warn('[AutoDetect] httpV1 templates failed, falling back to mock:', err);
        }
        return mockAdapter.templates();
      }
    } else {
      if (import.meta.env.DEV) {
        console.log('[AutoDetect] v1 unavailable, using mock templates');
      }
      return mockAdapter.templates();
    }
  },

  async template(id: string): Promise<TemplateDetail> {
    const probe = await getProbeResult();

    if (probe.available) {
      try {
        if (import.meta.env.DEV) {
          console.log('[AutoDetect] Using httpV1 template detail');
        }
        return await httpV1Adapter.template(id);
      } catch (err) {
        // Network error or API failure - fall back to mock
        if (import.meta.env.DEV) {
          console.warn('[AutoDetect] httpV1 template failed, falling back to mock:', err);
        }
        return mockAdapter.template(id);
      }
    } else {
      if (import.meta.env.DEV) {
        console.log('[AutoDetect] v1 unavailable, using mock template detail');
      }
      return mockAdapter.template(id);
    }
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

  // SSE streaming: Feature flag gated (VITE_FEATURE_PLOT_STREAM=1)
  // Only available when httpV1Adapter.stream exists (behind feature flag)
  // Falls back to mock adapter if v1 unavailable
  ...(import.meta.env.VITE_FEATURE_PLOT_STREAM === '1' && (httpV1Adapter as any).stream ? {
    stream: {
      run(
        input: RunRequest,
        handlers: {
          onHello?: (data: { response_id: string }) => void
          onTick?: (data: { index: number }) => void
          onInterim?: (data: { findings: string[] }) => void
          onDone: (data: { response_id: string; report: ReportV1 }) => void
          onError: (error: ErrorV1) => void
        }
      ): () => void {
        // Track cancel function from actual adapter
        let actualCancel: (() => void) | null = null
        let cancelled = false

        // Return cancel function immediately (synchronous API)
        const cancel = () => {
          cancelled = true
          if (actualCancel) {
            actualCancel()
          }
        }

        // Async initialization: await probe before selecting adapter
        // This fixes the race condition where first call would default to mock
        ;(async () => {
          if (cancelled) return

          // Wait for probe to complete (cached or in-flight)
          const probe = await getProbeResult()
          if (cancelled) return

          const isV1Available = probe.available

          if (isV1Available && (httpV1Adapter as any).stream) {
            if (import.meta.env.DEV) {
              console.log('[AutoDetect] Using httpV1 streaming')
            }
            actualCancel = (httpV1Adapter as any).stream.run(input, handlers)
          } else {
            if (import.meta.env.DEV) {
              console.log('[AutoDetect] v1 unavailable, using mock streaming')
            }
            // Mock adapter already has streaming support
            actualCancel = (mockAdapter as any).stream.run(input, handlers)
          }
        })()

        return cancel
      },
    },
  } : {}),
};
