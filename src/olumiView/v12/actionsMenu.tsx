/**
 * V12 one action system, the menu (proposal 005 v2; Paul's chrome rule: small floating menus in discreet places). A ⋯ button in the composer's icon
 * row opens one small floating list: what the person came for (the caller's goal row), core's questions in core's order (actions.ts `menuOf`),
 * then the tools folded in from the Reasoning tab. It replaces the "More ways to think about this" disclosure; the composer's four method icons
 * stay beside it. Presses are the caller's (`onMethod`, `onTool`), so this file holds no write and imports nothing from ViewChat.
 */
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { typography } from '../../styles/typography'
import { OkIcon, sessionMethodIcon } from '../look/icons'
import { HoverButton } from '../look/Hover'
import { TOOL_WORDS, type Menu, type ToolId } from './actions'

/** The menu's name for assistive technology (the same words the question menu always had). */
export const ACTIONS_MENU_NAME = 'Questions to explore with Olumi'
/** The label for the leading run of questions suited to the goal. */
export const FIRST_FOR_YOUR_GOAL = 'Suits what you came here for'
/** The ⋯ button's name. */
export const MORE_ACTIONS = 'More ways to think about this'

const ENABLED_ROW = 'button:not(:disabled):not([aria-disabled="true"])'
const SECTION = 'py-1.5 first:pt-0 last:pb-0'
const SECTION_LABEL = `${typography.viewPanelMeta} mb-2 px-2 text-text-light`
const ITEM = 'flex min-h-8 w-full items-start rounded-md px-2 py-2.5 text-left text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-text-header disabled:text-text-light disabled:cursor-not-allowed aria-disabled:text-text-light aria-disabled:cursor-not-allowed'
const ICON_ROW = `${ITEM} gap-2.5`
const TOOL_ICONS = { edit_brief: 'brief', review_inputs: 'review-inputs' } as const

function setTabStop(panel: HTMLElement, row?: HTMLButtonElement) {
  for (const button of panel.querySelectorAll<HTMLButtonElement>('button')) {
    button.tabIndex = button === row ? 0 : -1
  }
}

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
  const panel = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<MenuPlace | null>(null)
  const visible = open && place !== null
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
  useLayoutEffect(() => {
    const list = panel.current
    if (!visible || list === null) return undefined
    const first = list.querySelector<HTMLButtonElement>(ENABLED_ROW) ?? undefined
    setTabStop(list, first)
    first?.focus()

    // The goal chip can turn into tiles, and an in-flight turn can disable rows while the menu stays open.
    const observer = new MutationObserver(() => {
      const rows = [...list.querySelectorAll<HTMLButtonElement>(ENABLED_ROW)]
      const active = document.activeElement
      const row = rows.find((button) => button === active) ?? rows.find((button) => button.tabIndex === 0) ?? rows[0]
      setTabStop(list, row)
      if (row !== active && (list.contains(active) || active === document.body)) row?.focus()
    })
    observer.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-disabled', 'disabled'] })
    return () => observer.disconnect()
  }, [visible])
  useEffect(() => {
    if (!open) return undefined
    const away = (e: MouseEvent) => { if (root.current !== null && !root.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); root.current?.querySelector<HTMLButtonElement>('[data-testid="view-actions-button"]')?.focus() } }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [open])
  const moveFocus = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const { key, currentTarget } = e
    if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End') return
    const rows = [...currentTarget.querySelectorAll<HTMLButtonElement>(ENABLED_ROW)]
    if (rows.length === 0) return
    e.preventDefault()
    const current = rows.findIndex((row) => row === document.activeElement)
    let next = 0
    if (key === 'End') next = rows.length - 1
    if (key === 'ArrowDown') next = (current + 1) % rows.length
    if (key === 'ArrowUp') next = (Math.max(0, current) + rows.length - 1) % rows.length
    rows[next]?.focus()
  }

  // One gated sentence shared by two or more questions is said once (see the questions' head); a single gated question, or differing sentences, keep their own line.
  const gatedWords = [...new Set(menu.methods.flatMap((m) => (m.prerequisite === null ? [] : [m.prerequisite])))]
  const onceWords = gatedWords.length === 1 && menu.methods.filter((m) => m.prerequisite !== null).length > 1 ? gatedWords[0]! : null
  const firstMore = menu.methods.findIndex((m) => !m.first)
  const hasFirstRun = menu.methods[0]?.first === true
  return (
    <span ref={root} className="relative inline-flex" data-testid="view-actions">
      <HoverButton type="button" words={MORE_ACTIONS} aria-label={MORE_ACTIONS} aria-haspopup="true" aria-expanded={open} data-testid="view-actions-button" onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header">
        <OkIcon id="more" decorative inherit />
      </HoverButton>
      {!visible ? null : (
        <div ref={panel} role="group" aria-label={ACTIONS_MENU_NAME} data-testid="view-actions-menu"
          onKeyDown={moveFocus}
          onFocus={(e) => { if (e.target instanceof HTMLButtonElement && e.target.matches(ENABLED_ROW)) setTabStop(e.currentTarget, e.target) }}
          style={place}
          className={`${typography.viewPanelBody} absolute bottom-full z-30 mb-2 divide-y divide-panel-border overflow-y-auto rounded-md border border-panel-border bg-panel p-3 shadow-lg`}>
          {/* Core's offer to build a model, first (pair v4 render, 08:3xZ: last in the tools it sat 776 px down an 813 px list, below the fold at 1232, 1.33
              and 2000): the one press that changes what the scenario is, in view on opening, above what the person came for and core's questions. */}
          {build === undefined ? null : (
            <div className={SECTION} data-testid="view-build-model-row">
              <HoverButton type="button" words={build.title} disabled={held} onClick={() => { setOpen(false); build.onPress() }} className={`${ITEM} flex-col`} data-testid="view-build-model">
                {/* The row shape every press below it has (DL, 08:5xZ): core's label, then core's own one line for it (`build_model.title`), quiet. */}
                <span className="font-medium text-text-header" data-testid="view-build-model-label">{build.label}</span>
                <span className={`${typography.viewPanelMeta} font-normal text-text-light`} data-testid="view-build-model-title">{build.title}</span>
              </HoverButton>
            </div>
          )}
          {goal && <div className={SECTION}>{goal}</div>}
          <div className={SECTION} data-testid="view-session-menu">
            <p className={SECTION_LABEL}>Ask Olumi</p>
            {/* The gated questions share one sentence (actions.ts NEEDS_ANALYSIS_WORDS): said once here, at the head of the questions, beside the mark each
                gated question carries (DL, 08:5xZ: on a words board it sat under six rows); the mark gives it again as its hover and name. */}
            {onceWords === null ? null : (
              <p className={`${typography.viewPanelMeta} flex items-start gap-1.5 px-2 pb-1 text-text-light`} data-testid="view-method-prerequisite-once">
                <OkIcon id="needs-analysis" size={14} decorative className="mt-0.5" />{onceWords}
              </p>
            )}
            {menu.methods.map((m, index) => {
              const icon = sessionMethodIcon(m.id)
              return (
                <Fragment key={m.id}>
                  {hasFirstRun && index === 0 && <p className={SECTION_LABEL}>{FIRST_FOR_YOUR_GOAL}</p>}
                  {hasFirstRun && index === firstMore && <p className={`${SECTION_LABEL} mt-3`}>More questions</p>}
                  <HoverButton type="button" disabled={held} onClick={() => { setOpen(false); onMethod(m.id) }} words={undefined}
                    className={ICON_ROW} data-method={m.id} data-first={m.first ? '' : undefined} data-testid="view-session-method">
                    <OkIcon id={icon} size={14} decorative testid={icon} className="mt-0.5" />
                    <span className="min-w-0">
                      <span data-view={`session.methods.${m.i}.text`}>{m.text}</span>
                      {m.first ? <span className="sr-only" data-testid="view-session-method-first"> ({FIRST_FOR_YOUR_GOAL})</span> : null}
                      {m.prerequisite !== null && onceWords === null && (
                        <span className={`${typography.viewPanelMeta} block text-text-light`} data-testid="view-method-prerequisite">{m.prerequisite}</span>
                      )}
                    </span>
                    {m.prerequisite !== null && (
                      <OkIcon id="needs-analysis" size={14} words={m.prerequisite} decorative={onceWords === null} focusable={false}
                        testid={onceWords === null ? undefined : 'view-method-prerequisite'} className="ml-auto mt-0.5" />
                    )}
                  </HoverButton>
                </Fragment>
              )
            })}
          </div>
          {menu.tools.length === 0 ? null : (
            <div className={SECTION} data-testid="view-actions-tools">
              {menu.tools.map((t) => (
                <button key={t} type="button" disabled={held} onClick={() => { setOpen(false); onTool(t) }} className={ICON_ROW} data-tool={t} data-testid={`view-tool-${t}`}>
                  <OkIcon id={TOOL_ICONS[t]} size={14} decorative testid={TOOL_ICONS[t]} className="mt-0.5" />
                  <span>{TOOL_WORDS[t]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </span>
  )
}
