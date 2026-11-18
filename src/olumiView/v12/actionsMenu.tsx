/**
 * V12 one action system, the menu (proposal 005 v2; Paul's chrome rule: small floating menus in discreet places). A ⋯ button in the composer's icon
 * row opens one small floating list: what the person came for (the caller's goal row), core's questions in core's order (actions.ts `menuOf`),
 * then the tools folded in from the Reasoning tab. It replaces the "More ways to think about this" disclosure; the composer's four method icons
 * stay beside it. Presses are the caller's (`onMethod`, `onTool`), so this file holds no write and imports nothing from ViewChat.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { typography } from '../../styles/typography'
import { OkIcon } from '../look/icons'
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

export function ActionsMenu({ menu, held, goal, onMethod, onTool, build }: { menu: Menu; held: boolean; goal: ReactNode; onMethod: (id: string) => void; onTool: (id: ToolId) => void; /** Core's offer to build a model from the reasoning so far, in core's words (`label`, its `title` as the hover); absent where core makes none. */ build?: { label: string; title: string; onPress: () => void } }) {
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
  // One gated sentence shared by two or more questions is said once (see the questions' head); a single gated question, or differing sentences, keep their own line.
  const gatedWords = [...new Set(menu.methods.flatMap((m) => (m.prerequisite === null ? [] : [m.prerequisite])))]
  const onceWords = gatedWords.length === 1 && menu.methods.filter((m) => m.prerequisite !== null).length > 1 ? gatedWords[0]! : null
  const item = 'flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:text-text-light disabled:cursor-not-allowed'
  return (
    <span ref={root} className="relative inline-flex" data-testid="view-actions">
      <button type="button" aria-label={MORE_ACTIONS} title={MORE_ACTIONS} aria-haspopup="true" aria-expanded={open} data-testid="view-actions-button" onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header">
        <OkIcon id="more" decorative inherit />
      </button>
      {!open ? null : (
        <div role="group" aria-label={ACTIONS_MENU_NAME} data-testid="view-actions-menu"
          style={place === null ? undefined : { left: place.left, right: 'auto', width: place.width, maxHeight: place.maxHeight }}
          className={`${typography.viewPanelBody} absolute bottom-full right-0 z-30 mb-2 max-h-[60vh] w-[min(320px,calc(100vw-32px))] space-y-2 overflow-y-auto rounded-lg border border-panel-border bg-panel p-2 shadow-lg`}>
          {/* Core's offer to build a model, first (pair v4 render, 08:3xZ: last in the tools it sat 776 px down an 813 px list, below the fold at 1232, 1.33
              and 2000): the one press that changes what the scenario is, in view on opening, above what the person came for and core's questions. */}
          {build === undefined ? null : (
            <div className="border-b border-panel-border pb-2" data-testid="view-build-model-row">
              <button type="button" disabled={held} title={build.title} onClick={() => { setOpen(false); build.onPress() }} className={item} data-testid="view-build-model">
                {/* The row shape every press below it has (DL, 08:5xZ): core's label, then core's own one line for it (`build_model.title`), quiet. */}
                <span className="font-medium text-text-header" data-testid="view-build-model-label">{build.label}</span>
                <span className={`${typography.viewPanelMeta} font-normal text-text-light`} data-testid="view-build-model-title">{build.title}</span>
              </button>
            </div>
          )}
          {goal}
          <div className="space-y-0.5" data-testid="view-session-menu">
            {/* The gated questions share one sentence (actions.ts NEEDS_ANALYSIS_WORDS): said once here, at the head of the questions, beside the mark each
                gated question carries (DL, 08:5xZ: on a words board it sat under six rows); the mark gives it again as its hover and name. */}
            {onceWords === null ? null : (
              <p className={`${typography.viewPanelMeta} flex items-start gap-1.5 px-2 pb-1 text-text-light`} data-testid="view-method-prerequisite-once">
                <OkIcon id="needs-analysis" size={14} decorative className="mt-0.5" />{onceWords}
              </p>
            )}
            {menu.methods.map((m) => (
              <button key={m.id} type="button" disabled={held} onClick={() => { setOpen(false); onMethod(m.id) }} title={m.first ? FIRST_FOR_YOUR_GOAL : undefined}
                className={`${item}${m.first ? ' font-medium' : ''}`} data-method={m.id} data-first={m.first ? '' : undefined} data-testid="view-session-method">
                <span className="flex items-start gap-1.5">
                  {m.first ? <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-info" aria-hidden="true" data-testid="view-session-method-first" /> : null}
                  <span data-view={`session.methods.${m.i}.text`}>{m.text}</span>
                  {m.prerequisite === null || onceWords === null ? null : (
                    <span role="img" aria-label={m.prerequisite} title={m.prerequisite} className="mt-0.5 inline-flex flex-none text-text-light" data-testid="view-method-prerequisite">
                      <OkIcon id="needs-analysis" size={14} decorative />
                    </span>
                  )}
                  {m.first ? <span className="sr-only"> ({FIRST_FOR_YOUR_GOAL})</span> : null}
                </span>
                {m.prerequisite === null || onceWords !== null ? null : <span className={`${typography.viewPanelMeta} font-normal text-text-light`} data-testid="view-method-prerequisite">{m.prerequisite}</span>}
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
