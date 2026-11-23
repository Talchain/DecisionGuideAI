import { useEffect, useRef, useState } from 'react'
import { OkIcon } from '../../look/icons'
import { typography } from '../../../styles/typography'
import { KeepIdea } from '../KeepIdea'

/** Page chrome beside a concise floor reply: the one visible way to keep an idea from it (Codex 008, 18 Nov). */
export const KEEP_AN_IDEA = 'Keep an idea'

/**
 * ONE visible control beside a concise reply, whatever its lead says: it opens a compact list of core's own prose entries for that reply
 * (`floor[].prose`), verbatim, each with the same Keep as anywhere else (same route, text, floor job). Which lead line corresponds to which entry
 * is never inferred, nothing is kept until pressed, and the composer is not touched. Escape or a press outside closes it.
 */
export function KeepChooser({ sid, turn, entries }: { sid: string; turn: number; entries: readonly string[] }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (e: MouseEvent) => { if (root.current !== null && !root.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [open])
  if (entries.length === 0) return null
  return (
    <div ref={root} data-testid="view-keep-chooser"
      onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); trigger.current?.focus() } }}>
      <button ref={trigger} type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="view-keep-choose"
        className={`${typography.viewPanelMeta} inline-flex min-h-[24px] items-center gap-1 rounded-md px-1.5 text-text-light hover:bg-panel-hover hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}>
        <OkIcon id="idea-keep" size={14} decorative /><span>{KEEP_AN_IDEA}</span>
      </button>
      {open ? (
        <ul className="m-0 mt-2 list-none space-y-3 p-0" data-testid="view-keep-choose-list">
          {entries.map((entry, i) => (
            <li key={`${i}:${entry}`} className="flex items-start gap-2">
              <span className="min-w-0 flex-1 text-text-body" data-keep-entry="">{entry}</span>
              <KeepIdea sid={sid} turn={turn} text={entry} floor />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
