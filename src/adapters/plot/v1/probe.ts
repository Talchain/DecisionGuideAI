/**
 * PLoT v1 Capability Probe
 *
 * Probes production endpoint to detect v1 route availability.
 * Falls back to mock adapter when v1 routes unavailable.
 */

const PROBE_CACHE_KEY = 'plot_v1_capability_probe';
const PROBE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface ProbeResult {
  available: boolean;
  timestamp: string;
  healthStatus: 'ok' | 'degraded' | 'down';
  endpoints: {
    health: boolean;
    run: boolean;
    stream: boolean;
  };
}

let cachedProbe: ProbeResult | null = null;

/**
 * Probe capability from sessionStorage cache
 */
function getCachedProbe(): ProbeResult | null {
  if (cachedProbe) return cachedProbe;

  // Guard for SSR/E2E environments without window
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return null;
  }

  try {
    const cached = sessionStorage.getItem(PROBE_CACHE_KEY);
    if (!cached) return null;

    const probe: ProbeResult = JSON.parse(cached);
    const age = Date.now() - new Date(probe.timestamp).getTime();

    if (age > PROBE_CACHE_TTL_MS) {
      sessionStorage.removeItem(PROBE_CACHE_KEY);
      return null;
    }

    cachedProbe = probe;
    return probe;
  } catch {
    return null;
  }
}

/**
 * Save probe result to cache
 */
function setCachedProbe(result: ProbeResult): void {
  cachedProbe = result;

  // Guard for SSR/E2E environments without window
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return;
  }

  try {
    sessionStorage.setItem(PROBE_CACHE_KEY, JSON.stringify(result));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear probe cache (for manual re-probe)
 */
export function clearProbeCache(): void {
  cachedProbe = null;

  // Guard for SSR/E2E environments without window
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return;
  }

  try {
    sessionStorage.removeItem(PROBE_CACHE_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Probe PLoT v1 endpoints
 *
 * Checks:
 * 1. GET /health (or /v1/health) - confirms host reachable
 * 2. HEAD /v1/run - confirms v1 routes available
 *
 * Returns cached result if available (5min TTL)
 */
export async function probeCapability(
  proxyBase: string = '/api/plot'
): Promise<ProbeResult> {
  // Check cache first
  const cached = getCachedProbe();
  if (cached) {
    if (import.meta.env.DEV) {
      console.log('[Probe] Using cached result:', cached);
    }
    return cached;
  }

  const result: ProbeResult = {
    available: false,
    timestamp: new Date().toISOString(),
    healthStatus: 'down',
    endpoints: {
      health: false,
      run: false,
      stream: false,
    },
  };

  try {
    // Step 1: Check health endpoint
    const healthResponse = await fetch(`${proxyBase}/v1/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (healthResponse.ok) {
      result.endpoints.health = true;
      const healthData = await healthResponse.json();
      result.healthStatus = healthData.status || 'ok';

      if (import.meta.env.DEV) {
        console.log('[Probe] Health check passed:', healthData);
      }
    } else {
      // Try fallback /health (non-versioned)
      const fallbackResponse = await fetch(`${proxyBase}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (fallbackResponse.ok) {
        result.endpoints.health = true;
        const healthData = await fallbackResponse.json();
        result.healthStatus = healthData.status || 'ok';

        if (import.meta.env.DEV) {
          console.log('[Probe] Health check passed (fallback):', healthData);
        }
      }
    }

    // Step 2: Check v1 run endpoint
    if (result.endpoints.health) {
      try {
        // Try HEAD first
        let runResponse = await fetch(`${proxyBase}/v1/run`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });

        // 200 OK, 401, 403, or 405 all mean route exists
        // (401/403 = auth issue, 405 = method not allowed, but route exists)
        if (
          runResponse.ok ||
          runResponse.status === 401 ||
          runResponse.status === 403 ||
          runResponse.status === 405
        ) {
          result.endpoints.run = true;
          result.endpoints.stream = true; // Assume stream available if run is
          result.available = true;

          if (import.meta.env.DEV) {
            console.log('[Probe] v1 routes available (status:', runResponse.status, ')');
          }
        } else if (runResponse.status === 404) {
          // Try OPTIONS as fallback (some gateways block HEAD)
          try {
            const optionsResponse = await fetch(`${proxyBase}/v1/run`, {
              method: 'OPTIONS',
              signal: AbortSignal.timeout(5000),
            });

            if (
              optionsResponse.ok ||
              optionsResponse.status === 401 ||
              optionsResponse.status === 403
            ) {
              result.endpoints.run = true;
              result.endpoints.stream = true;
              result.available = true;

              if (import.meta.env.DEV) {
                console.log('[Probe] v1 routes available via OPTIONS');
              }
            } else {
              if (import.meta.env.DEV) {
                console.warn('[Probe] v1 routes not available (404)');
              }
            }
          } catch (optErr) {
            if (import.meta.env.DEV) {
              console.warn('[Probe] OPTIONS fallback failed:', optErr);
            }
          }
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[Probe] Failed to check v1 routes:', err);
        }
      }
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('[Probe] Failed to probe capabilities:', err);
    }
    result.healthStatus = 'down';
  }

  // Cache result
  setCachedProbe(result);

  return result;
}

/**
 * Check if v1 endpoints are available (cached)
 */
export function isV1Available(): boolean {
  const cached = getCachedProbe();
  return cached?.available ?? false;
}
