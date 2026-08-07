/**
 * TESTER-SAFE ROUTING — the developer scaffolding is behind one condition.
 *
 * Layout guard for the developer-surface routes in `src/poc/AppPoC.tsx`.
 * `/plot`, `/plot-legacy`, `/plc`, `/sandbox-v1` and `/dev/hero-gallery` are
 * developer surfaces, not product. They shipped reachable-by-URL and outside
 * both `AuthGuard` and any flag (UI-SURFACE-CENSUS-2026-07-30, finding R1);
 * `/dev/hero-gallery` alone self-gated inside its component. This guard puts
 * all of them — plus `/test` and the catch-all, which render the same POC
 * sandbox — behind the single declared `devRoutes` flag, which is OFF in every
 * deployed build.
 *
 * ⚠ IT IS A PATHLESS LAYOUT ROUTE, NOT A PER-ROUTE WRAPPER, AND THAT IS THE
 * POINT. The gating is declared ONCE, in one `<Route element={<DevRoutesGuard/>}>`
 * whose children are the gated routes — the same shape as `AuthGuard` eight
 * lines above it. The wrapper form it replaced required every author of every
 * future dev route to REMEMBER to wrap it, which is the per-route memory burden
 * that let these surfaces ship ungated in the first place.
 *
 * ⚠ THE REDIRECT TARGET IS `/`, NOT `/canvas`, AND THAT IS DELIBERATE.
 * `/` is the scenario list; `/canvas` opens a blank "Untitled decision". Two
 * reasons, in order of weight:
 *   1. `/canvas` is a SIDE-EFFECT-PRODUCING landing. An open canvas tab is a
 *      live writer — it is the known staging hazard where an open canvas
 *      recreates deleted scenario rows. A mistyped URL must not start writing.
 *   2. It matches the one in-repo precedent for this shape, which this gate is
 *      modelled on: `HeroGallery.tsx:30` → `<Navigate to="/" replace />`.
 * `AppPoC.routing.spec.tsx` pins the destination as `/` and asserts the canvas
 * is NOT rendered, so a drift back to `/canvas` reds.
 *
 * The scaffolds are NOT deleted and NOT unmounted from the bundle: each is a
 * `React.lazy` chunk, and building the element does not fetch it — only
 * rendering does. Flag on, each route mounts exactly what it always mounted.
 *
 * Reach them in your own browser, on any environment:
 *   localStorage.setItem('feature.devRoutes', '1')   // then reload
 */

import { Navigate, Outlet } from 'react-router-dom'
import { isDevRoutesEnabled } from '../../flags'

export default function DevRoutesGuard() {
  // Read at RENDER time, not module load, so the localStorage override and the
  // test suite both take effect without a module reset.
  return isDevRoutesEnabled() ? <Outlet /> : <Navigate to="/" replace />
}
