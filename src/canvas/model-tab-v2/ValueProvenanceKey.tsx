/**
 * ⭐⭐ THE KEY THAT STOPS THE ROW MARKS BEING A PRIVATE CODE.
 *
 * `CanvasLegendPopover` states the rule this follows: *"Replacing words with
 * pictures is only an improvement if the pictures are legible to someone who
 * has never seen them."* That legend keys the canvas's STRUCTURAL provenance
 * (who authored the NODE, three literals). The Model row's marks answer a
 * different question — who authored the VALUE, twelve literals over seven kinds
 * — so they need their own key rather than a row bolted onto that one.
 *
 * ⚠ GROUPED INTO THE THREE ANSWERS A READER ACTUALLY WANTS, which is Paul's
 * framing: did this come from my brief, did Olumi estimate it, or do I own it.
 * The seven kinds are NOT flattened to three marks — each keeps its own glyph,
 * because `panel` is deliberately excluded from user-owned and collapsing it
 * would assert something false. The grouping is in the KEY, where it aids
 * reading; the register stays total, where it must.
 *
 * ⚠ DERIVED FROM THE REGISTER, NEVER RETYPED. Every row below is built by
 * iterating `ValueProvenanceKind` groups and reading the SAME icon and label
 * maps the row renders from, so a new kind or a renamed label cannot leave this
 * key describing something the product no longer does (trap 12).
 */
import { useEffect, useRef, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { typography } from '../../styles/typography'
import { VALUE_PROVENANCE_LABEL, type ValueProvenanceKind } from '../domain/valueProvenance'
import { VALUE_PROVENANCE_ICON } from '../domain/valueProvenanceIcon'

/** The three questions, and which kinds answer each. Total over the seven. */
const GROUPS: ReadonlyArray<{ heading: string; kinds: readonly ValueProvenanceKind[] }> = [
  { heading: 'From what you gave us', kinds: ['brief'] },
  { heading: "Olumi's own estimate", kinds: ['ai'] },
  { heading: 'You own this value', kinds: ['confirmed', 'edited', 'assumption', 'human'] },
  { heading: 'From your panel', kinds: ['panel'] },
]

export function ValueProvenanceKey() {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrap} className="relative inline-flex">
      {/* A real button, so it is reachable by keyboard and announced as one —
          the same shape as the canvas legend's control. */}
      <button
        type="button"
        aria-label="How to read these marks"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="model-tab-v2-provenance-key-toggle"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center justify-center p-1 rounded text-text-light hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
      >
        <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="How to read these marks"
          data-testid="model-tab-v2-provenance-key"
          className="absolute right-0 top-full mt-1 z-20 w-56 rounded border border-panel-border bg-panel p-3 shadow-lg space-y-2"
        >
          <p className={`${typography.panelMeta} text-text-header m-0`}>Where each value came from</p>
          {GROUPS.map(group => (
            <div key={group.heading} className="space-y-1">
              <p className={`${typography.panelMeta} text-text-light m-0`}>{group.heading}</p>
              {group.kinds.map(kind => {
                const Icon = VALUE_PROVENANCE_ICON[kind]
                return (
                  <div key={kind} className="flex items-center gap-2" data-provenance-kind={kind}>
                    <span className="w-4 flex items-center justify-center text-text-light">
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                    <span className={`${typography.panelMeta} text-text-body`}>
                      {VALUE_PROVENANCE_LABEL[kind]}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
          {/* ⚠ The ⚠ is NOT a provenance claim and must not be keyed as one —
              `vocabulary.ts` is explicit that a surface rendering it as a
              whose-value-is-this badge is reading it wrong. */}
          <p className={`${typography.panelMeta} text-text-light m-0 pt-1 border-t border-panel-border`}>
            ⚠ marks a value that still needs checking — a separate question from
            where it came from.
          </p>
        </div>
      )}
    </div>
  )
}

export default ValueProvenanceKey
