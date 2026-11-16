/**
 * V12 one action system, the menu (proposal 005 v2; Paul's chrome rule: small floating menus in discreet places). A ⋯ button in the composer's icon
 * row opens one small floating list: what the person came for (the caller's goal row), core's questions in core's order (actions.ts `menuOf`),
 * then the tools folded in from the Reasoning tab. It replaces the "More ways to think about this" disclosure; the composer's four method icons
 * stay beside it. Presses are the caller's (`onMethod`, `onTool`), so this file holds no write and imports nothing from ViewChat.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { typography } from '../../styles/typography'
import { TOOL_WORDS, type Menu, type ToolId } from './actions'

/** The menu's name for assistive technology (the same words the question menu always had). */
export const ACTIONS_MENU_NAME = 'Questions to explore with Olumi'
/** What the quiet emphasis on a question means, for its hover and for assistive technology. */
export const FIRST_FOR_YOUR_GOAL = 'Suits what you came here for'
/** The ⋯ button's name. */
export const MORE_ACTIONS = 'More ways to think about this'

/**
 * Where the open list sits: inside the panel it is opened from, never past its edges (Codex 006 #2: anchored to the small ⋯ button it ran
 * 153 px past the chat panel's left edge at 1232 x 704, and the panel cut it off there). `left` is the list's offset from the button's own
 * left edge (it is drawn in the button's box, above it), so the panel's clip never reaches it.
 */
export type MenuPlace = { left: number; width: number; maxHeight: number }
const EDGE = 8
export function placeMenu(button: { top: number; left: number; right: number }, panel: { left: number; right: number }, win: { width: number; height: number }): MenuPlace {
  const lo = Math.max(EDGE, panel.left + EDGE), hi = Math.min(win.width - EDGE, panel.right - EDGE)
  const width = Math.max(0, Math.min(320, hi - lo))
  const at = Math.min(Math.max(button.right - width, lo), hi - width)
  return { left: at - button.left, width, maxHeight: Math.max(160, Math.min(win.height * 0.6, button.top - 2 * EDGE)) }
}

export function ActionsMenu({ menu, held, goal, onMethod, onTool }: { menu: Menu; held: boolean; goal: ReactNode; onMethod: (id: string) => void; onTool: (id: ToolId) => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLSpanElement>(null)
  const [place, setPlace] = useState<MenuPlace | null>(null)
  useLayoutEffect(() => {
    if (!open) { setPlace(null); return undefined }
    const measure = () => {
      const button = root.current?.getBoundingClientRect()
      if (!button) return
      const panel = root.current?.closest('aside')?.getBoundingClientRect() ?? { left: 0, right: window.innerWidth }
      setPlace(placeMenu(button, panel, { width: window.innerWidth, height: window.innerHeight }))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])
  useEffect(() => {
    if (!open) return undefined
    const away = (e: MouseEvent) => { if (root.current !== null && !root.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); root.current?.querySelector<HTMLButtonElement>('[data-testid="view-actions-button"]')?.focus() } }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])
  const item = 'flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:text-text-light disabled:cursor-not-allowed'
  return (
    <span ref={root} className="relative inline-flex" data-testid="view-actions">
      <button type="button" aria-label={MORE_ACTIONS} title={MORE_ACTIONS} aria-haspopup="true" aria-expanded={open} data-testid="view-actions-button" onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header">
        <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
      </button>
      {!open ? null : (
        <div role="group" aria-label={ACTIONS_MENU_NAME} data-testid="view-actions-menu"
          style={place === null ? undefined : { left: place.left, right: 'auto', width: place.width, maxHeight: place.maxHeight }}
          className={`${typography.viewPanelBody} absolute bottom-full right-0 z-30 mb-2 max-h-[60vh] w-[min(320px,calc(100vw-32px))] space-y-2 overflow-y-auto rounded-lg border border-panel-border bg-panel p-2 shadow-lg`}>
          {goal}
          <div className="space-y-0.5" data-testid="view-session-menu">
            {menu.methods.map((m) => (
              <button key={m.id} type="button" disabled={held} onClick={() => { setOpen(false); onMethod(m.id) }} title={m.first ? FIRST_FOR_YOUR_GOAL : undefined}
                className={`${item}${m.first ? ' font-medium' : ''}`} data-method={m.id} data-first={m.first ? '' : undefined} data-testid="view-session-method">
                <span className="flex items-start gap-1.5">
                  {m.first ? <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-info" aria-hidden="true" data-testid="view-session-method-first" /> : null}
                  <span data-view={`session.methods.${m.i}.text`}>{m.text}</span>
                  {m.first ? <span className="sr-only"> ({FIRST_FOR_YOUR_GOAL})</span> : null}
                </span>
                {m.prerequisite === null ? null : <span className={`${typography.viewPanelMeta} font-normal text-text-light`} data-testid="view-method-prerequisite">{m.prerequisite}</span>}
              </button>
            ))}
          </div>
          {menu.tools.length === 0 ? null : (
            <div className="space-y-0.5 border-t border-panel-border pt-2" data-testid="view-actions-tools">
              {menu.tools.map((t) => (
                <button key={t} type="button" disabled={held} onClick={() => { setOpen(false); onTool(t) }} className={item} data-tool={t} data-testid={`view-tool-${t}`}>{TOOL_WORDS[t]}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </span>
  )
}
