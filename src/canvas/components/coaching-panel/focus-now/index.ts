/**
 * Focus Now — public entry.
 *
 * Render-only coaching surface. The future mount PR can `lazy(() => import(...))`
 * `FocusNowPanel` and wire it with `useFocusNow` from the Analysis tab. The
 * presentational component and pure helpers carry no heavy deps; `useFocusNow`
 * (the container) is the only store-aware export.
 */
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
