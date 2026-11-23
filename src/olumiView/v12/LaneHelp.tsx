import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { regionsOf } from '../regions'
import { HELP_EVENTS } from '../../components/layout/TopBar'
import { KeyboardLegend, useKeyboardLegend } from '../../canvas/help/KeyboardLegend'
import { InfluenceExplainer, useInfluenceExplainer } from '../../components/assistants/InfluenceExplainer'

/** Where the toast stands: below the head band (top bar, lens pill) and left of the dock, read from the page's own regions, again whenever the
 *  window or the dock changes size (the dock opens and closes without a window resize; v10 review). */
function useToastAnchor(active: boolean): { top: string; right: string } {
  const fallback = { top: 'calc(var(--topbar-h, 0px) + 1rem)', right: '1rem' }
  const [at, setAt] = useState(fallback)
  useEffect(() => {
    if (!active) return
    const place = () => {
      const { head, dock } = regionsOf(), W = window.innerWidth
      const next = { top: head.bottom > 0 ? `${Math.round(head.bottom + 12)}px` : fallback.top, right: `${Math.round(W - dock.left + 16)}px` }
      setAt((a) => (a.top === next.top && a.right === next.right ? a : next))
    }
    place()
    window.addEventListener('resize', place)
    const dock = document.querySelector('aside[aria-label="Outputs dock"]')
    const seen = typeof ResizeObserver === 'undefined' || dock === null ? null : new ResizeObserver(place)
    if (seen !== null && dock !== null) seen.observe(dock)
    return () => { window.removeEventListener('resize', place); seen?.disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
  return at
}

/**
 * The three-dot menu's Help on the V12 canvas (Paul's audit, 17 Nov: "Keyboard shortcuts" and "How influence works" did nothing there).
 * The top bar sends the same two events it always has; the previous canvas answered them and this one now does too, with the same two
 * panels: the legend lists only the keys that work on this canvas (KeyboardLegend's lane sections), and the explainer is the product's own.
 */
export function LaneHelp(): JSX.Element {
  const legend = useKeyboardLegend()
  const influence = useInfluenceExplainer()
  const { open } = legend, { show } = influence
  const anchor = useToastAnchor(influence.shouldShow)
  useEffect(() => {
    const keys = () => open(), how = () => show()
    window.addEventListener(HELP_EVENTS.SHOW_KEYBOARD_LEGEND, keys)
    window.addEventListener(HELP_EVENTS.SHOW_INFLUENCE_EXPLAINER, how)
    return () => {
      window.removeEventListener(HELP_EVENTS.SHOW_KEYBOARD_LEGEND, keys)
      window.removeEventListener(HELP_EVENTS.SHOW_INFLUENCE_EXPLAINER, how)
    }
  }, [open, show])
  return (
    <>
      {influence.shouldShow ? (
        <div className="fixed top-[var(--help-top)] right-[var(--help-right)] z-[1200] flex w-[min(20rem,calc(100vw-2rem))] flex-col items-end gap-3" style={{ '--help-top': anchor.top, '--help-right': anchor.right } as CSSProperties} data-testid="lane-influence-explainer">
          <InfluenceExplainer forceShow={influence.forceShow} onDismiss={influence.hide} compact variant="panel" />
        </div>
      ) : null}
      <KeyboardLegend isOpen={legend.isOpen} onClose={legend.close} />
    </>
  )
}
