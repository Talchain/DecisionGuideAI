/**
 * ⭐ S-B ACTION SYSTEM, slice 1 — ONE ACTION BAR, ON EVERY SURFACE.
 *
 * Paul, 7 Oct 2026: the same action system must serve chat AND the Reasoning
 * tab, and a press must genuinely work. This is the one renderer of CEE's
 * `action_bar` (`actionBarContract.ts`); a surface chooses only its type tokens.
 *
 *   [pill] [pill]   [icon] [icon] [icon] [icon]   [⋯]
 *
 *  · Pills: at most two, the reason this state is worth acting on. Narrow: one.
 *  · Icons: CEE's fixed-position standards, so a reader learns their places.
 *    Narrow: three inline, the rest in ⋯.
 *  · ⋯: everything else that is relevant, grouped, each with why it is offered.
 * That layout is the MAXIMUM (DL §E): only what CEE sends is drawn.
 *
 * ⚠ NOTHING HERE KNOWS AN ACTION. Label, icon name, press id and the reason all
 * ride the wire. One press path (`pressOffer`); a disabled offer says why on
 * hover, focus AND press, and sends no turn.
 *
 * ⚠ NO LOCAL TYPE SCALE (DL §E). Labels are the host's body token; the second
 * line of a menu row is the host's label token.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MoreHorizontal, X } from 'lucide-react'

import Tooltip from '../../../components/Tooltip'
import { ACTION_FOCUS, icon } from '../../../components/results/analysisNew/panelSurfaces'
import { typography } from '../../../styles/typography'
import { useMeasuredPanelWidth } from '../../components/workspaceShell/usePanelWidth'
import { actionGlyph, type ActionGlyph } from './actionBarIcons'
import type { ActionBarV1, ActionOffer } from './actionBarContract'
import { useActionBarStore } from './actionBarStore'
import { pressOffer } from './pressOffer'

export type ActionBarSurface = 'chat' | 'reasoning'

/** Below this many pixels the bar shows one pill and three icons (Paul's approved narrow layout). */
export const ACTION_BAR_COMPACT_BELOW = 380
const COMPACT_ICONS = 3

export const ACTION_BAR_COPY = {
  group: 'What you can do next',
  more: 'More actions',
  menu: 'More actions',
  groups: { gap: 'Gaps', method: 'Methods', review: 'Review' },
  hide: (label: string) => `Hide ‘${label}’ for now`,
  noConversation: 'Open the Olumi tab to use this.',
} as const

/**
 * The chat's text tokens. A host outside the chat column (the Reasoning tab) passes its own `typeScale`, so its 11px
 * meta never enters this file — the chat column's type census pins 12 / 13 / 14 (Paul, 28 Sep).
 */
const CHAT_TYPE = { body: typography.chatBody, meta: typography.chatMeta } as const

const GROUP_ORDER = ['gap', 'method', 'review'] as const

/** The offer's one line of explanation: why now, or what stops it. */
function offerReason(offer: ActionOffer): string {
  return (offer.enabled ? offer.why_now : offer.disabled_reason) ?? ''
}

function offerName(offer: ActionOffer): string {
  const reason = offerReason(offer)
  return reason ? `${offer.label} — ${reason}` : offer.label
}

/** A control the HOST adds to the ⋯ menu: it is the surface's own, never one of CEE's actions. */
export interface ActionBarHostItem {
  id: string
  label: string
  Icon: ActionGlyph
  onSelect: () => void
}

export interface ActionBarProps {
  bar: ActionBarV1
  surface: ActionBarSurface
  /** Text tokens for a host outside the chat column; absent = the chat's. */
  typeScale?: { body: string; meta: string }
  /** The surface's own controls, listed last in the ⋯ menu under their own label. */
  hostMenu?: { label: string; items: readonly ActionBarHostItem[] }
  /** Force the narrow layout. Default: measured from the bar's own width. */
  compact?: boolean
  testId?: string
}

export function ActionBar({ bar, surface, typeScale, hostMenu, compact: compactProp, testId = 'action-bar' }: ActionBarProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const overflowRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const moreRef = useRef<HTMLButtonElement | null>(null)
  const { width } = useMeasuredPanelWidth(rootRef)
  const compact = compactProp ?? width < ACTION_BAR_COMPACT_BELOW
  const dismissed = useActionBarStore((s) => s.dismissed)
  const dismiss = useActionBarStore((s) => s.dismiss)
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const type = typeScale ?? CHAT_TYPE

  const { pills, icons, menu } = useMemo(() => {
    const live = bar.priority.filter((offer) => !dismissed.includes(offer.offer_key))
    const hidden = bar.priority.filter((offer) => dismissed.includes(offer.offer_key))
    const pillCount = compact ? 1 : 2
    const iconCount = compact ? COMPACT_ICONS : bar.standard.length
    return {
      pills: live.slice(0, pillCount),
      icons: bar.standard.slice(0, iconCount),
      // Nothing CEE offered is lost to the layout: what does not fit, or was hidden, is in the menu.
      menu: [...live.slice(pillCount), ...hidden, ...bar.standard.slice(iconCount), ...bar.more],
    }
  }, [bar, compact, dismissed])

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (restoreFocus) moreRef.current?.focus()
  }, [])

  // The bar belongs to one state: a new bar starts with no notice and a closed menu.
  useEffect(() => {
    setNotice(null)
    setOpen(false)
  }, [bar.state_key])

  /* The keyboard model the method strip's menu already ships: first item focused
     on open, Arrow/Home/End rove, Escape closes and restores focus, Tab closes
     without trapping, a press outside closes. */
  useEffect(() => {
    if (!open) return
    const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
    items()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') return close(false)
      if (e.key === 'Escape') return close(true)
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
      const list = items()
      if (list.length === 0) return
      e.preventDefault()
      const current = list.indexOf(document.activeElement as HTMLButtonElement)
      const next =
        e.key === 'Home' ? 0
        : e.key === 'End' ? list.length - 1
        : e.key === 'ArrowDown' ? (current + 1 + list.length) % list.length
        : (current - 1 + list.length) % list.length
      list[next]?.focus()
    }
    const onPointerDown = (e: MouseEvent) => {
      if (!overflowRef.current?.contains(e.target as Node)) close(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open, close])

  const press = (offer: ActionOffer) => {
    const result = pressOffer(offer, bar.revision)
    // Never a dead press: a control that sends nothing says why.
    if (result === 'disabled') setNotice(`${offer.label}: ${offer.disabled_reason ?? ''}`)
    else if (result === 'none') setNotice(ACTION_BAR_COPY.noConversation)
    else setNotice(null)
  }

  const hostItems = hostMenu?.items ?? []
  if (pills.length === 0 && icons.length === 0 && menu.length === 0 && hostItems.length === 0) return null

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={ACTION_BAR_COPY.group}
      data-testid={testId}
      data-surface={surface}
      data-compact={compact ? 'true' : 'false'}
      data-state-key={bar.state_key}
      className="min-w-0"
    >
      <div className={`flex min-w-0 items-center ${compact ? 'gap-1' : 'gap-2'}`}>
        {pills.map((offer) => {
          const Glyph = actionGlyph(offer.icon)
          return (
            <span
              key={offer.offer_key}
              className="inline-flex min-w-0 shrink items-stretch rounded-full border border-field bg-panel"
              data-testid={`${testId}-pill-${offer.action_id}`}
            >
              <Tooltip asChild content={offerName(offer)}>
                <button
                  type="button"
                  aria-label={offerName(offer)}
                  aria-disabled={offer.enabled ? undefined : 'true'}
                  onClick={() => press(offer)}
                  data-testid={`${testId}-pill-${offer.action_id}-press`}
                  className={`inline-flex h-6 min-w-0 items-center gap-1 whitespace-nowrap rounded-l-full pl-2 pr-1 ${type.body} ${
                    offer.enabled ? 'text-text-body' : 'text-text-light'
                  } hover:bg-panel-hover [@media(pointer:coarse)]:h-11 ${ACTION_FOCUS}`}
                >
                  <Glyph className={`${icon('row')} shrink-0`} aria-hidden={true} />
                  <span className="truncate">{offer.label}</span>
                </button>
              </Tooltip>
              <button
                type="button"
                aria-label={ACTION_BAR_COPY.hide(offer.label)}
                onClick={() => dismiss(offer.offer_key)}
                data-testid={`${testId}-pill-${offer.action_id}-hide`}
                className={`inline-flex h-6 w-5 shrink-0 items-center justify-center rounded-r-full text-text-light hover:bg-panel-hover hover:text-text-body [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-9 ${ACTION_FOCUS}`}
              >
                <X className={icon('inline')} aria-hidden={true} />
              </button>
            </span>
          )
        })}
        {icons.map((offer) => {
          const Glyph = actionGlyph(offer.icon)
          return (
            <Tooltip key={offer.offer_key} asChild content={offerName(offer)}>
              <button
                type="button"
                aria-label={offerName(offer)}
                aria-disabled={offer.enabled ? undefined : 'true'}
                onClick={() => press(offer)}
                data-testid={`${testId}-icon-${offer.action_id}`}
                className={`relative inline-flex size-7 min-h-[24px] min-w-[24px] shrink-0 items-center justify-center rounded-full ${
                  offer.enabled ? 'text-text-light' : 'text-text-light opacity-40'
                } hover:ring-1 hover:ring-inset hover:ring-border-emphasis [@media(pointer:coarse)]:size-11 ${ACTION_FOCUS}`}
              >
                <Glyph className={icon('section')} aria-hidden={true} />
              </button>
            </Tooltip>
          )
        })}
        {menu.length > 0 || hostItems.length > 0 ? (
          <div ref={overflowRef} className="relative ml-auto shrink-0">
            <Tooltip asChild content={ACTION_BAR_COPY.more}>
              <button
                ref={moreRef}
                type="button"
                aria-label={ACTION_BAR_COPY.more}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => (open ? close(true) : setOpen(true))}
                data-testid={`${testId}-more`}
                className={`inline-flex size-7 min-h-[24px] min-w-[24px] items-center justify-center rounded-full text-text-light hover:ring-1 hover:ring-inset hover:ring-border-emphasis [@media(pointer:coarse)]:size-11 ${ACTION_FOCUS}`}
              >
                <MoreHorizontal className={icon('section')} aria-hidden={true} />
              </button>
            </Tooltip>
            {open ? (
              <div
                ref={menuRef}
                role="menu"
                aria-label={ACTION_BAR_COPY.menu}
                data-testid={`${testId}-menu`}
                className="absolute right-0 top-full z-20 mt-2 w-[272px] max-w-[calc(100vw-20px)] rounded-md border border-border-emphasis bg-panel p-2 shadow-2"
              >
                {GROUP_ORDER.map((group) => {
                  const rows = menu.filter((offer) => offer.group === group)
                  if (rows.length === 0) return null
                  return (
                    <div key={group} role="none" data-testid={`${testId}-menu-group-${group}`}>
                      <span className={`${type.meta} block px-2 py-1 text-text-light`}>{ACTION_BAR_COPY.groups[group]}</span>
                      {rows.map((offer) => {
                        const Glyph = actionGlyph(offer.icon)
                        return (
                          <button
                            key={offer.offer_key}
                            type="button"
                            role="menuitem"
                            aria-disabled={offer.enabled ? undefined : 'true'}
                            onClick={() => {
                              close(true)
                              press(offer)
                            }}
                            data-testid={`${testId}-menu-${offer.action_id}`}
                            className={`flex w-full min-h-[34px] items-start gap-2 rounded-sm px-2 py-2 text-left hover:bg-panel-hover focus-visible:bg-panel-hover ${ACTION_FOCUS}`}
                          >
                            <Glyph className={`${icon('row')} mt-0.5 shrink-0 text-text-light`} aria-hidden={true} />
                            <span className="min-w-0">
                              <span className={`${type.body} block ${offer.enabled ? 'text-text-body' : 'text-text-light'}`}>{offer.label}</span>
                              <span className={`${type.meta} block text-text-light`}>{offerReason(offer)}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
                {hostMenu && hostItems.length > 0 ? (
                  <div role="none" data-testid={`${testId}-menu-group-host`}>
                    {menu.length > 0 ? <div role="separator" className="-mx-2 my-1 border-b border-panel-border" /> : null}
                    <span className={`${type.meta} block px-2 py-1 text-text-light`}>{hostMenu.label}</span>
                    {hostItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          close(true)
                          item.onSelect()
                        }}
                        data-testid={`${testId}-menu-host-${item.id}`}
                        className={`flex w-full min-h-[34px] items-center gap-2 rounded-sm px-2 py-2 text-left ${type.body} text-text-body hover:bg-panel-hover focus-visible:bg-panel-hover ${ACTION_FOCUS}`}
                      >
                        <item.Icon className={`${icon('row')} shrink-0 text-text-light`} aria-hidden={true} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {/* Always mounted, so a screen reader hears the reason the moment it appears. */}
      <p role="status" aria-live="polite" data-testid={`${testId}-notice`} className={notice ? `${type.meta} mt-1 text-text-light` : 'sr-only'}>
        {notice ?? ''}
      </p>
    </div>
  )
}
