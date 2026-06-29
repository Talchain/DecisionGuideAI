/**
 * Focus Now — public entry.
 *
 * Static / fail-closed coaching surface. `FocusNowContainer` is the authorised
 * live mount (wired by ResultsBody as the second Analysis-tab panel, the only
 * importer the inertness guard allow-lists). The presentational `FocusNowPanel` +
 * pure helpers carry no heavy deps; `useFocusNow` is the only store-aware export.
 */
export { FocusNowContainer } from './FocusNowContainer'
export { FocusNowPanel, default } from './FocusNowPanel'
export { FocusBanner } from './FocusBanner'
export { FocusRowCard } from './FocusRowCard'
export { FocusNowEmpty } from './FocusNowEmpty'
export { buildFocusRows, mapSignalToFocusRow, dropGatedRows } from './buildFocusRows'
export { freshnessToBanner } from './freshnessBanner'
export { useFocusNow } from './useFocusNow'
export { STATIC_HYGIENE_ROWS, FOCUS_COPY, FOCUS_DEFAULT_VISIBLE } from './focusConstants'
export type {
  FocusRow,
  FocusOwnership,
  FocusSource,
  FocusAction,
  FocusActionKind,
  FocusBannerState,
  FocusNowProps,
} from './focusTypes'
export type { BuildFocusRowsInput, FocusViewModel } from './buildFocusRows'
