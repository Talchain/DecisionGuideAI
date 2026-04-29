// Project-wide global type augmentations. Lives in src/types/ rather than
// alongside any single component so removing or relocating an unrelated
// component does not break typing for all consumers.
//
// Brief 5.7 close-out follow-up — moved from `src/components/DebugPanel.tsx`
// (where it was previously the only declaration site) per reviewer feedback:
// `Window.__OLUMI_DEBUG` is read by DriversSection, lib/mappers/utils,
// SectionErrorBoundary, and DebugPanel itself. Co-locating the augmentation
// with one component creates a brittle dependency.

export {}

declare global {
  interface Window {
    /**
     * Runtime debug flag. Set via the browser console as `window.__OLUMI_DEBUG = true`
     * to enable diagnostic console output across the app (see DebugPanel,
     * DriversSection, SectionErrorBoundary, lib/mappers/utils).
     */
    __OLUMI_DEBUG?: boolean
  }
}
