/**
 * V12 one action system, the menu (proposal 005 v2; Paul's chrome rule: small floating menus in discreet places). A ⋯ button in the composer's icon
 * row opens one small floating list: what the person came for (the caller's goal row), core's questions in core's order (actions.ts `menuOf`),
 * then the tools folded in from the Reasoning tab. It replaces the "More ways to think about this" disclosure; the composer's four method icons
 * stay beside it. Presses are the caller's (`onMethod`, `onTool`), so this file holds no write and imports nothing from ViewChat.
 */
import { Fragment, useRef, useState, type ReactNode } from 'react'
import { typography } from '../../styles/typography'
import { OkIcon, sessionMethodIcon } from '../look/icons'
import { HoverButton } from '../look/Hover'
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '../look/Menu.tsx'
import { dismissMenuFromOpener } from '../look/menuArbiter'
import { useViewStore } from '../store'
import { TOOL_WORDS, type Menu as ActionRows, type ToolId } from './actions'

/** The menu's name for assistive technology (the same words the question menu always had). */
export const ACTIONS_MENU_NAME = 'Questions to explore with Olumi'
/** The label for the leading run of questions suited to the goal. */
export const FIRST_FOR_YOUR_GOAL = 'Suits what you came here for'
/** The ⋯ button's name. */
export const MORE_ACTIONS = 'More ways to think about this'

const TOOL_ICONS = { edit_brief: 'brief', review_inputs: 'review-inputs' } as const
const CONVERSATION = '[data-testid="view-chat-float"], aside[aria-label="Outputs dock"], [data-testid="view-chat"]'

export function ActionsMenu({ menu, held, goal, onMethod, onTool, build }: {
  menu: ActionRows
  held: boolean
  goal: ReactNode
  onMethod: (id: string) => void
  onTool: (id: ToolId) => void
  /** Core's offer to build a model from the reasoning so far. */
  build?: { label: string; title: string; onPress: () => void }
}) {
  const previousVersion = useViewStore((state) => state.at !== null)
  const heldReason = previousVersion ? 'Return to the current version to use this action' : 'Wait for Olumi to finish'
  const heldTip = (description: string | null) => description ? `${heldReason}\n${description}` : heldReason
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const conversation = () => trigger.current?.closest(CONVERSATION)
  const boundary = {
    elements: () => { const panel = conversation(); return panel ? [panel] : [] },
    rect: () => {
      const panel = conversation()?.getBoundingClientRect()
      // Keep the actions above the opener so the composer remains reachable.
      const bottom = Math.min(panel?.bottom || window.innerHeight, trigger.current?.getBoundingClientRect().top || window.innerHeight)
      const y = Math.max(0, panel?.top ?? 0)
      const x = Math.max(0, panel?.left ?? 0)
      const right = Math.min(window.innerWidth, panel?.right || window.innerWidth)
      return { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) }
    },
  }

  // One gated sentence shared by two or more questions is shown at the questions' head.
  const gatedWords = [...new Set(menu.methods.flatMap((m) => (m.prerequisite === null ? [] : [m.prerequisite])))]
  const onceWords = gatedWords.length === 1 && menu.methods.filter((m) => m.prerequisite !== null).length > 1 ? gatedWords[0]! : null
  const firstMore = menu.methods.findIndex((m) => !m.first)
  const hasFirstRun = menu.methods[0]?.first === true
  return (
    <span className="relative inline-flex" data-testid="view-actions">
      <HoverButton ref={trigger} type="button" words={MORE_ACTIONS} aria-label={MORE_ACTIONS} aria-haspopup="menu"
        aria-expanded={open} data-testid="view-actions-button"
        onClick={(event) => { if (!dismissMenuFromOpener(event.currentTarget)) setOpen(true) }}
        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header">
        <OkIcon id="more" size={14} decorative inherit />
      </HoverButton>
      {open && trigger.current && (
        <Menu anchor={trigger.current} label={ACTIONS_MENU_NAME} testId="view-actions-menu"
          placement="top-end" boundary={boundary} repairHeldFocus onClose={() => setOpen(false)}>
          {build && (
            <div data-testid="view-build-model-row">
              <MenuItem id="build" label={build.label} content={<span className="font-medium text-text-header" data-testid="view-build-model-label">{build.label}</span>}
                tip={build.title} disabled={held} disabledReason={heldTip(build.title)}
                onSelect={build.onPress} meta={{ 'data-testid': 'view-build-model' }} />
              <MenuSeparator />
            </div>
          )}
          {goal && (
            <>
              <div role="group" aria-label="Session goal" data-testid="view-session-goal-section">{goal}</div>
              <MenuSeparator />
            </>
          )}
          <div role="group" aria-label="Ask Olumi" data-testid="view-session-menu">
            <MenuLabel as="p">Ask Olumi</MenuLabel>
            {onceWords !== null && (
              <p className={`${typography.viewPanelMeta} flex items-start gap-1.5 px-3 pb-2 text-text-light`} data-testid="view-method-prerequisite-once">
                <OkIcon id="needs-analysis" size={14} decorative className="mt-0.5" />{onceWords}
              </p>
            )}
            {menu.methods.map((method, index) => {
              const icon = sessionMethodIcon(method.id)
              return (
                <Fragment key={method.id}>
                  {hasFirstRun && index === 0 && <MenuLabel as="p">{FIRST_FOR_YOUR_GOAL}</MenuLabel>}
                  {hasFirstRun && index === firstMore && <><MenuSeparator /><MenuLabel as="p">More questions</MenuLabel></>}
                  <MenuItem id={`method-${method.id}`} label={method.text} disabled={held} disabledReason={heldTip(method.prerequisite)}
                    icon={<OkIcon id={icon} size={14} decorative testid={icon} />}
                    content={<>
                      <span data-view={`session.methods.${method.i}.text`}>{method.text}</span>
                      {method.first && <span className="sr-only" data-testid="view-session-method-first"> ({FIRST_FOR_YOUR_GOAL})</span>}
                    </>}
                    tip={method.prerequisite ?? undefined}
                    trailing={method.prerequisite === null ? undefined : (
                      <OkIcon id="needs-analysis" size={14} words={method.prerequisite} decorative={held || onceWords === null} focusable={false}
                        testid="view-method-prerequisite" className="text-text-light" />
                    )}
                    meta={{ 'data-method': method.id, 'data-first': method.first ? '' : undefined, 'data-testid': 'view-session-method' }}
                    onSelect={() => onMethod(method.id)} />
                </Fragment>
              )
            })}
          </div>
          {menu.tools.length > 0 && (
            <>
              <MenuSeparator />
              <div role="group" aria-label="Tools" data-testid="view-actions-tools">
                {menu.tools.map((tool) => (
                  <MenuItem key={tool} id={tool} label={TOOL_WORDS[tool]}
                    icon={<OkIcon id={TOOL_ICONS[tool]} size={14} decorative testid={TOOL_ICONS[tool]} />}
                    disabled={held} disabledReason={heldReason}
                    meta={{ 'data-tool': tool, 'data-testid': `view-tool-${tool}` }} onSelect={() => onTool(tool)} />
                ))}
              </div>
            </>
          )}
        </Menu>
      )}
    </span>
  )
}
