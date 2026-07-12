/**
 * cameraMotion — graph-visuals F1 (Paul's 2026-07-11 verdict): honour the OS
 * "reduce motion" setting on programmatic camera moves.
 *
 * ReactFlow's setCenter/fitView/zoomTo animate for a hardcoded duration
 * (300ms focus/fit, 200ms zoom). CSS transitions already respect
 * prefers-reduced-motion, but these imperative camera moves do not — a
 * motion-sensitive user still gets every focus/fit/zoom animated. This is
 * the single guard every camera call site routes its duration through, so a
 * duration of 0 (an instant jump) is used whenever reduced motion is set.
 *
 * Pure and side-effect-free: the caller supplies the live reduced-motion
 * flag (from usePrefersReducedMotion, mirrored to a ref at the imperative
 * sites) so this stays trivially testable and never reads matchMedia itself.
 */
export function cameraDuration(baseMs: number, prefersReducedMotion: boolean): number {
  return prefersReducedMotion ? 0 : baseMs
}
