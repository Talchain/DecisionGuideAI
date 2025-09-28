/**
 * Chaos / Resilience Drills
 * Dev-only fault injection for testing robustness (TEST_ROUTES=1 only)
 */

export interface FaultState {
  networkBlipOnce: boolean;
  slowFirstTokenMs: number;
  lastActivated: number;
}

// Global fault state (resets on restart)
let faultState: FaultState = {
  networkBlipOnce: false,
  slowFirstTokenMs: 0,
  lastActivated: 0
};

/**
 * Check if test routes are enabled
 */
export function areTestRoutesEnabled(): boolean {
  return process.env.TEST_ROUTES === '1';
}

/**
 * Check if chaos endpoints should be available
 */
export function areChaosEndpointsEnabled(): boolean {
  // Only available in development with TEST_ROUTES=1
  return areTestRoutesEnabled() && process.env.NODE_ENV !== 'production';
}

/**
 * Reset all fault states
 */
export function resetFaultState(): void {
  faultState = {
    networkBlipOnce: false,
    slowFirstTokenMs: 0,
    lastActivated: 0
  };
}

/**
 * Get current fault state (for debugging)
 */
export function getFaultState(): FaultState {
  return { ...faultState };
}

/**
 * Handle POST /_faults/network-blip-once request
 */
export async function handleNetworkBlipRequest(): Promise<any> {
  if (!areChaosEndpointsEnabled()) {
    return {
      status: 404,
      body: {
        type: 'BAD_INPUT',
        message: 'Chaos endpoints not available (requires TEST_ROUTES=1 and non-production)',
        timestamp: new Date().toISOString()
      }
    };
  }

  try {
    faultState.networkBlipOnce = true;
    faultState.lastActivated = Date.now();

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: {
        status: 'armed',
        fault: 'network-blip-once',
        message: 'Next new stream connection will drop once before resuming',
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to arm network blip fault',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Handle POST /_faults/slow-first-token request
 */
export async function handleSlowFirstTokenRequest(query: any): Promise<any> {
  if (!areChaosEndpointsEnabled()) {
    return {
      status: 404,
      body: {
        type: 'BAD_INPUT',
        message: 'Chaos endpoints not available (requires TEST_ROUTES=1 and non-production)',
        timestamp: new Date().toISOString()
      }
    };
  }

  const { ms } = query;
  const delayMs = parseInt(ms) || 300;

  if (delayMs < 0 || delayMs > 10000) {
    return {
      status: 400,
      body: {
        type: 'BAD_INPUT',
        message: 'Delay must be between 0 and 10000 milliseconds',
        timestamp: new Date().toISOString()
      }
    };
  }

  try {
    faultState.slowFirstTokenMs = delayMs;
    faultState.lastActivated = Date.now();

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      },
      body: {
        status: 'armed',
        fault: 'slow-first-token',
        delay_ms: delayMs,
        message: `Next stream will delay ${delayMs}ms before first token`,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    return {
      status: 500,
      body: {
        type: 'INTERNAL_ERROR',
        message: 'Failed to arm slow first token fault',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Check if network blip should trigger (one-time use)
 */
export function shouldTriggerNetworkBlip(): boolean {
  if (faultState.networkBlipOnce) {
    faultState.networkBlipOnce = false; // One-time use
    return true;
  }
  return false;
}

/**
 * Get slow first token delay (one-time use)
 */
export function getSlowFirstTokenDelay(): number {
  if (faultState.slowFirstTokenMs > 0) {
    const delay = faultState.slowFirstTokenMs;
    faultState.slowFirstTokenMs = 0; // One-time use
    return delay;
  }
  return 0;
}

/**
 * Simulate network connection drop
 */
export function simulateConnectionDrop(): Promise<void> {
  return new Promise(resolve => {
    // Simulate brief network interruption
    setTimeout(resolve, 100 + Math.random() * 200);
  });
}

/**
 * Simulate slow first token delay
 */
export function simulateSlowFirstToken(delayMs: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, delayMs);
  });
}

/**
 * Get fault injection status for health checks
 */
export function getFaultStatus(): any {
  return {
    chaos_endpoints_enabled: areChaosEndpointsEnabled(),
    test_routes_enabled: areTestRoutesEnabled(),
    active_faults: {
      network_blip_armed: faultState.networkBlipOnce,
      slow_first_token_ms: faultState.slowFirstTokenMs,
      last_activated: faultState.lastActivated
    }
  };
}