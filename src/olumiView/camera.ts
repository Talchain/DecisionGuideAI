/**
 * The camera on the olumi-core lane. A real first model is wider and taller than the canvas at the product's legibility floor (0.5), so
 * the landing fit cropped it (live olumi-core-v3, 4 Nov: cards cut off on the left). On this lane the product fit may go lower, so the
 * whole of core's model is in view on first open and after each new version; the person zooms in from there.
 */
export const CORE_LANE_FIT_FLOOR = 0.25

/** The floor a product fit uses: the lane's, never above the product's own. */
export const productFitFloor = (coreLane: boolean, legible: number): number => (coreLane ? Math.min(CORE_LANE_FIT_FLOOR, legible) : legible)
