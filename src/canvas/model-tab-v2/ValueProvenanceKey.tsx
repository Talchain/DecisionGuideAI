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

/**
 * The questions a reader asks, and which kinds answer each. TOTAL over the
 * seven kinds — `provenanceKeyIsTotal.spec` asserts that against the register,
 * so a new kind cannot ship unkeyed.
 *
 * ⚠ FOUR groups, not three. An earlier version of this comment said "three
 * questions" over a four-entry array: `panel` is deliberately NOT folded into
 * "you own this", because `isUserOwnedKind` excludes it and collapsing it would
 * assert something false about who authored the value.
 */
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
          {/* ⚠⚠ THIS LINE DESCRIBED A MARK THE PRODUCT NO LONGER DRAWS, AND
              NAMED THE WRONG MEANING FOR THE ONE IT RESEMBLES.

              It read "⚠ marks a value that still needs checking — a separate
              question from where it came from." Measured at `bdf4fb89`: that `⚠`
              was the ONLY renderable warning-sign glyph in this whole directory
              (1 occurrence with comments stripped; contrast control fires), and
              the rows do not draw it. They draw lucide COMPONENTS from
              `ATTENTION_MARK` — `CircleDashed`, `HelpCircle`, `Split`,
              `AlertTriangle`, `Target` — each already naming itself via
              `aria-label`/`title` from `ATTENTION_LABEL`. `ModelRowView.tsx`
              records why: the bare `⚠` was the deployed-`a9c2e050` defect, one
              glyph for all five reasons, and DS §9.9 names `'⚠'` explicitly as
              banned. So this legend was the last surviving render of the thing
              that change removed.

              It also named the wrong meaning. The only triangle drawn is
              `fragile`, whose label is 'Could flip the result' — a claim about
              the ANSWER changing, which is not "a value that still needs
              checking" (that is `unconfirmed-estimate`, drawn as `HelpCircle`).

              ⚠ THE DISTINCTION THE OLD LINE EXISTED TO MAKE IS KEPT: attention
              and provenance are different questions, and this key answers only
              the second. `vocabulary.ts` is explicit that a surface rendering an
              attention mark as a whose-value-is-this badge is reading it wrong.

              ⚠ "ON HOVER" AND NOT "ON FOCUS". The marks are `<span>`s with no
              `tabIndex`, so the pointer and assistive tech reach the name and a
              keyboard does not — `ModelRowView.tsx:876-879` states that
              limitation about `title` in this estate. Claiming focus here would
              replace one false promise with another. */}
          <p className={`${typography.panelMeta} text-text-light m-0 pt-1 border-t border-panel-border`}>
            The marks beside a row say what still needs attention — a separate
            question from where its value came from. Each one names itself on
            hover.
          </p>
        </div>
      )}
    </div>
  )
}

export default ValueProvenanceKey
