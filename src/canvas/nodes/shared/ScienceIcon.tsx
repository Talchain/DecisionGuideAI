/**
 * ScienceIcon — 12px guidance icon for node headers.
 *
 * Disclosure shape (bias-coaching slice, proposal 2026-07-16 §2 EXPLORE /
 * §1.5(2)): the single useScienceIcons/ScienceIcon system is the EXPLORE bias
 * channel, and its interaction is "icon -> popover -> discuss with AI turn".
 *
 * - Hover shows a glance tooltip (unchanged; suppressed while the popover open).
 * - Click opens a popover (the disclosure step) carrying the guidance text plus
 *   an explicit "Discuss with AI" affordance — restoring the one genuinely-lost
 *   affordance of the retired node-level BiasIcon generation (est. #2), which
 *   the bare click-to-send never offered. On touch (no hover) the popover is
 *   also the only way to read the guidance before acting.
 * - The discuss button fires the already-authored per-trigger `action` string;
 *   no wire field, no client-side bias inference (passthrough doctrine).
 *
 * Honest absence: with no conversation registered (`_sendMessage` null) the
 * popover still explains, but shows no button that would do nothing.
 */
import { useState, useRef, useEffect, useCallback, type ComponentType } from 'react'
import { Sparkles } from 'lucide-react'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { typography } from '../../../styles/typography'
import { CANVAS_GLYPH_SIZE_CLASSES } from './canvasGlyphScale'

interface ScienceIconProps {
  icon: ComponentType<{ size?: number; className?: string }>
  tooltip: string
  action: string
  colour?: string
}

export function ScienceIcon({ icon: Icon, tooltip, action, colour = 'text-text-light' }: ScienceIconProps) {
  const [showTip, setShowTip] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  // Primitive selector (safe): re-renders only when the callback reference
  // changes — never an inline-selector new-array landmine.
  const sendMessage = useGuidanceStore((s) => s._sendMessage)

  const close = useCallback(() => setOpen(false), [])

  // Dismiss the popover on outside-click or Esc — the exact idiom the sibling
  // CanvasLegendPopover uses (document mousedown outside wrapRef, or Escape).
  // Listeners attach only while open. The icon/discuss buttons live inside
  // wrapRef, so clicking them is never an "outside" click (the toggle and
  // discuss handlers own those paths).
  useEffect(() => {
    if (!open) return
    const onDocPointer = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDocPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setOpen((prev) => !prev)
  }, [])

  const handleDiscuss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    sendMessage?.(action)
    setOpen(false)
  }, [sendMessage, action])

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        /* ⚠ THE BOX IS EXPLICIT NOW, AND COUNTER-SCALED. This button had no size
           of its own — `p-0` on a 12px glyph made the glyph the box — so it was
           measured at **9.3px on the deployed board** and 6px at the 0.50 settle
           zoom. The class pins the DS's 12px and carries
           `--canvas-label-scale`, so 12px declared is 12px delivered.

           ⛔ AND WHAT IS DELIBERATELY *NOT* HERE: a `::before` hit slop taking
           this to WCAG 2.2 AA 2.5.8's 24px. The icons render into
           `<span className="inline-flex items-center gap-1">` in FactorNode,
           RiskNode, GoalNode, OptionNode and OutcomeNode — a **4px** gap. The
           separation invariant is `gap > 2 x slop`, so 4px admits at most a 1px
           expansion (a 14px target, not 24); a 6px expansion per side would
           overlap its neighbour by 8px and a near miss would open the WRONG
           bias popover. That is the same mis-target defect `NodeQuickActions`'
           own spec exists to prevent, and buying size with it would be a net
           loss. Reaching 24 needs the container gap, which lives in five node
           files this change does not own — pinned as a known shortfall in
           `__tests__/canvasGlyphTargetScale.spec.tsx` rather than left silent. */
        className={`nodrag nopan p-0 border-0 bg-transparent cursor-pointer inline-flex items-center justify-center ${CANVAS_GLYPH_SIZE_CLASSES[12]} ${colour}`}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        onClick={handleClick}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={tooltip}
        aria-expanded={open}
        /* Identity for the known-shortfall pin in
           `__tests__/canvasGlyphTargetScale.spec.tsx`. The pin must not bind to
           `aria-label`, which is fixture-supplied prose. */
        data-testid="science-icon-trigger"
      >
        <Icon size={12} className={CANVAS_GLYPH_SIZE_CLASSES[12]} />
      </button>

      {/* Glance tooltip on hover — suppressed while the popover is open. */}
      {showTip && !open && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-30 w-[180px] bg-panel border border-panel-border rounded-lg shadow-1 px-2 py-1.5 pointer-events-none"
          role="tooltip"
        >
          <p className={`${typography.edgeLabel} text-text-body m-0`}>{tooltip}</p>
        </div>
      )}

      {/* Click popover — the disclosure step + explicit "discuss with AI" turn.
          Complete four-sided border (DS v5); state is conveyed by the icon tint,
          never an edge accent. */}
      {open && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-30 w-[200px] bg-panel border border-panel-border rounded-lg shadow-1 p-2 space-y-1.5"
          role="dialog"
          aria-label="Guidance detail"
        >
          <p className={`${typography.edgeLabel} text-text-body m-0`}>{tooltip}</p>
          {sendMessage && (
            <button
              type="button"
              className={`nodrag nopan inline-flex items-center gap-1 border-0 bg-transparent p-0 cursor-pointer text-info ${typography.edgeLabel}`}
              onClick={handleDiscuss}
              onPointerDown={(e) => e.stopPropagation()}
              data-testid="science-icon-discuss"
            >
              <Sparkles size={11} aria-hidden="true" className={`flex-none ${CANVAS_GLYPH_SIZE_CLASSES[11]}`} />
              Discuss with AI
            </button>
          )}
        </div>
      )}
    </div>
  )
}
