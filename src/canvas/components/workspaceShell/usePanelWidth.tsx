/**
 * `usePanelWidth()` — how a child surface finds out how wide it actually is.
 *
 * ── THE DEFECT THIS CLOSES ────────────────────────────────────────────────
 * There were ZERO container queries across ~450 panel files. The dock's width
 * moved 416px → 280px — a 35% cut to the content budget — and not one child
 * component knew. Every one of them had been written against an assumed width,
 * so the degradation was silent and distributed, and the only instrument that
 * caught it was the founder's eyes.
 *
 * A `sm:`/`md:` viewport breakpoint cannot help: those describe the WINDOW, and
 * the panel's width has almost nothing to do with the window's. It is 416px at
 * 1280px wide and 416px at 3840px wide, and 280px on a drag at either.
 *
 * ── THE PATTERN, AND WHY IT IS THIS ONE ───────────────────────────────────
 * DERIVE, DO NOT DUPLICATE. The width published here is read from the dock
 * element's LIVE `getBoundingClientRect()`, the same approach as
 * `measureDockInset()` — the one place in this area that already derives
 * rather than mirroring, and the reason it has never drifted. Publishing
 * `resolveDockWidth(...)`'s return value instead would be a second copy of the
 * answer, correct until the first time something else moves the element.
 *
 * Two consumers, one measurement:
 *   - `--panel-width` (px) on the dock element, for CSS.
 *   - `usePanelWidth()`, for components that must branch in JS.
 *
 * The same element also carries `container-type: inline-size`, so a child can
 * use a real `@container` query. That is the mechanism that makes the original
 * defect impossible rather than merely fixed: a child written against the
 * container cannot be wrong about a width it never assumed.
 */

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { DOCK_RESPONSIVE_MAX_WIDTH } from '../dockWidth'
import { PANEL_WIDTH_CSS_VAR, shellContentBudget } from './shellContract'

export interface PanelWidthValue {
  /** The panel's live outer width in px, from its bounding rect. */
  readonly width: number
  /** Width available to content, after the shell's border and gutter. */
  readonly contentWidth: number
}

/**
 * Default for anything rendered outside the shell (tests, storybook, the
 * floating Olumi window). It is the shell's DEFAULT width rather than 0, so a
 * child that branches on width outside the dock behaves as it does at rest
 * instead of collapsing into a "we are tiny" arm nobody designed.
 */
const DEFAULT_VALUE: PanelWidthValue = {
  width: DOCK_RESPONSIVE_MAX_WIDTH,
  contentWidth: shellContentBudget(DOCK_RESPONSIVE_MAX_WIDTH),
}

const PanelWidthContext = createContext<PanelWidthValue>(DEFAULT_VALUE)

/** Read the panel's live width. Safe outside the shell — returns the default. */
export function usePanelWidth(): PanelWidthValue {
  return useContext(PanelWidthContext)
}

/**
 * Measures `ref`'s element and publishes the result both ways.
 *
 * Returns the value to feed `PanelWidthProvider`. Kept separate from the
 * provider so the shell can attach the ref to the element it already renders
 * rather than growing a wrapper div, which would change the layout it is
 * trying to describe.
 */
export function useMeasuredPanelWidth(
  ref: React.RefObject<HTMLElement | null>,
): PanelWidthValue {
  const [width, setWidth] = useState<number>(DEFAULT_VALUE.width)
  // Avoids a setState per observer callback when the value has not moved —
  // a drag fires these continuously.
  const lastRef = useRef<number>(DEFAULT_VALUE.width)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const publish = () => {
      const measured = Math.round(el.getBoundingClientRect().width)
      // A hidden dock measures 0 (`display:none` while an overlay panel is
      // active). Publishing 0 would tell every child it has no room and make
      // them re-lay-out on the way back in, so the last real width stands.
      if (!Number.isFinite(measured) || measured <= 0) return
      el.style.setProperty(PANEL_WIDTH_CSS_VAR, `${measured}px`)
      if (measured !== lastRef.current) {
        lastRef.current = measured
        setWidth(measured)
      }
    }

    publish()

    // `ResizeObserver` catches the drag, the responsive re-resolve and the
    // collapse/expand transition without any of them having to tell us.
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(publish)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return useMemo(() => ({ width, contentWidth: shellContentBudget(width) }), [width])
}

export function PanelWidthProvider({
  value,
  children,
}: {
  value: PanelWidthValue
  children: React.ReactNode
}) {
  return <PanelWidthContext.Provider value={value}>{children}</PanelWidthContext.Provider>
}
