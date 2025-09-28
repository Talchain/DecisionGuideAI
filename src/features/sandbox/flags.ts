// Sandbox feature flags

/**
 * Live Gateway integration (OFF by default)
 * When enabled, connects to real Gateway using frozen SSE events
 */
export function isLiveGatewayEnabled(): boolean {
  try {
    const env = (import.meta as any)?.env?.VITE_FEATURE_LIVE_GATEWAY;
    if (env === '1' || env === 1 || env === true) return true;
  } catch (_e) {}
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('feature.liveGateway');
      if (raw && raw !== '0' && raw !== 'false') return true;
    }
  } catch (_e) {}
  return false;
}

/**
 * Mobile mode detection for responsive layout
 */
export function isMobileViewport(): boolean {
  try {
    if (typeof window !== 'undefined') {
      return window.innerWidth <= 480;
    }
  } catch (_e) {}
  return false;
}

/**
 * Reduced motion preference detection
 */
export function prefersReducedMotion(): boolean {
  try {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  } catch (_e) {}
  return false;
}