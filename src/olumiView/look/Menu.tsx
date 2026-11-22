import {
  createContext, useContext, useId, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent, type MouseEventHandler, type ReactNode, type SyntheticEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { autoUpdate, flip, offset, shift, size, useFloating, type Placement, type VirtualElement } from '@floating-ui/react'
import { typography } from '../../styles/typography'
import { CANVAS_LAYER_CLASS } from '../../canvas/layers'
import { MenuTooltip } from '../../canvas/contextMenu/MenuTooltip'
import { OkIcon } from './icons'
import { menuLook } from './menu.ts'
import { registerMenu, type MenuDismissal } from './menuArbiter'
import { focusRing, rowTipOf, Tip, useTipDelay, useTipDismissOnMove } from './Tip'
import './menu.css'

type Point = { x: number; y: number }
interface MenuBoundary {
  rect: () => { x: number; y: number; width: number; height: number }
  elements: () => Iterable<Element>
}
type Look = 'lane' | 'older'
type Anchor = HTMLElement | VirtualElement | Point
type Surface = { element: HTMLElement; back?: () => void }

interface MenuProps {
  anchor: Anchor
  label: string
  onClose: (reason: MenuDismissal) => void
  opener?: HTMLElement | null
  request?: object
  boundary?: MenuBoundary
  placement?: Placement
  look?: Look
  iconColumn?: boolean
  children: ReactNode
}

interface Chain {
  look: Look
  boundary?: MenuBoundary
  surfaces: Set<Surface>
  dismiss: (reason: MenuDismissal) => void
  restoreAfterAction: () => void
}
const MenuChain = createContext<Chain>(null!)

interface Level {
  iconColumn: boolean
  nested: boolean
  current: string | null
  setCurrent: (id: string) => void
  enterRow: (id: string, row: HTMLButtonElement) => void
  child: string | null
  setChild: (id: string | null | ((current: string | null) => string | null)) => void
}
const MenuLevel = createContext<Level>(null!)
const rowsOf = (menu: HTMLElement) => Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"][data-menu-row]'))

export function Menu({ anchor, label, onClose, opener, request = anchor, boundary, placement = 'bottom-start', look = 'lane', iconColumn = true, children }: MenuProps) {
  const surfaces = useRef(new Set<Surface>()).current
  const returnTo = useRef<HTMLElement | null>(null)
  const [dismissed, setDismissed] = useState<object | null>(null)
  const closed = dismissed === request

  const restore = () => {
    if (returnTo.current?.isConnected) returnTo.current.focus({ preventScroll: true })
  }
  const chain: Chain = {
    look, boundary, surfaces,
    dismiss: (reason) => {
    if (reason === 'escape' || reason === 'tab' || reason === 'opener') restore()
      setDismissed(request)
      onClose(reason)
    },
    restoreAfterAction: () => {
      // An action can replace the menu with a form or move focus to the composer.
      queueMicrotask(() => { if (surfaces.size === 0 && document.activeElement === document.body) restore() })
    },
  }
  const latestChain = useRef(chain)
  latestChain.current = chain

  useLayoutEffect(() => {
    if (closed) return
    const focused = document.activeElement
    const contains = (target: Node) => [...surfaces].some(({ element }) => element.contains(target))
    const trigger = opener ?? (anchor instanceof HTMLElement ? anchor : null)
    returnTo.current = trigger ?? (focused instanceof HTMLElement && focused !== document.body && !focused.closest('[data-olumi-menu]')
      ? focused : returnTo.current)
    const unregister = registerMenu({
      opener: trigger,
      contains,
      dismiss: (reason) => latestChain.current.dismiss(reason),
      escape: () => {
        const panels = [...surfaces]
        const top = panels[panels.length - 1]
        if (top?.back) top.back()
        else latestChain.current.dismiss('escape')
      },
    })
    const root = [...surfaces][0]?.element
    if (root) (rowsOf(root)[0] ?? root).focus({ preventScroll: true })
    return unregister
  }, [anchor, closed, opener, request, surfaces])

  if (closed) return null
  return (
    <MenuChain.Provider value={chain}>
      <MenuSurface anchor={anchor} label={label} placement={placement} iconColumn={iconColumn} request={request}>
        {children}
      </MenuSurface>
    </MenuChain.Provider>
  )
}

interface SurfaceProps {
  anchor: Anchor
  label: string
  placement: Placement
  iconColumn: boolean
  request?: object
  id?: string
  back?: () => void
  takeFocus?: boolean
  onMouseEnter?: MouseEventHandler<HTMLDivElement>
  onMouseLeave?: MouseEventHandler<HTMLDivElement>
  children: ReactNode
}

function MenuSurface({ anchor, label, placement, iconColumn, request, id, back, takeFocus, onMouseEnter, onMouseLeave, children }: SurfaceProps) {
  const chain = useContext(MenuChain)
  const nested = back !== undefined
  const [current, setCurrent] = useState<string | null>(null)
  const [child, setChild] = useState<string | null>(null)
  const search = useRef({ text: '', time: 0 })
  const reference = useMemo(() => anchor instanceof HTMLElement || 'getBoundingClientRect' in anchor ? anchor : {
    getBoundingClientRect: () => new DOMRect(anchor.x, anchor.y, 0, 0),
  }, [anchor])
  const overflow = () => ({ boundary: chain.boundary?.rect() ?? 'clippingAncestors' as const, padding: 8 })
  const { refs, x, y, isPositioned } = useFloating({
    open: true, placement, strategy: 'fixed',
    whileElementsMounted: (ref, menu, update) => {
      const cleanup = autoUpdate(ref, menu, update, { animationFrame: true })
      if (!chain.boundary || typeof ResizeObserver === 'undefined') return cleanup
      const observer = new ResizeObserver(update)
      for (const edge of chain.boundary.elements()) observer.observe(edge)
      return () => { observer.disconnect(); cleanup() }
    },
    middleware: [
      offset(nested ? 4 : 0),
      flip(() => ({ ...overflow(), crossAxis: !nested })),
      shift(({ rects, placement: side }) => {
        if (!nested) return { ...overflow(), crossAxis: true }
        const bounds = chain.boundary?.rect()
        const left = bounds?.x ?? 0
        const right = bounds ? bounds.x + bounds.width : window.innerWidth
        const room = side.startsWith('left') ? rects.reference.x - left : right - rects.reference.x - rects.reference.width
        return { ...overflow(), crossAxis: room - 12 < rects.floating.width }
      }),
      size(() => ({
        ...overflow(),
        apply({ availableHeight, elements }) {
          elements.floating.style.maxHeight = `${Math.max(0, Math.min(window.innerHeight * 0.6, availableHeight))}px`
        },
      })),
    ],
  })
  useLayoutEffect(() => { refs.setPositionReference(reference) }, [refs, reference])
  const latestBack = useRef(back)
  latestBack.current = back

  useLayoutEffect(() => {
    const element = refs.floating.current
    if (!element) return
    const surface: Surface = { element, back: nested ? () => latestBack.current?.() : undefined }
    chain.surfaces.add(surface)
    return () => { chain.surfaces.delete(surface) }
  }, [chain.surfaces, nested, refs.floating])

  useLayoutEffect(() => {
    setChild(null)
    search.current = { text: '', time: 0 }
  }, [request])

  useLayoutEffect(() => {
    const menu = refs.floating.current
    if (!menu) return
    const rows = rowsOf(menu)
    if (!rows.some((row) => row.dataset.menuRow === current)) {
      setCurrent(rows[0]?.dataset.menuRow ?? null)
      if (document.activeElement === menu || (current !== null && document.activeElement === document.body)) {
        const fallback = rows[0] ?? menu
        fallback.focus({ preventScroll: true })
      }
    }
  })

  useLayoutEffect(() => {
    const menu = refs.floating.current
    if (takeFocus && menu) (rowsOf(menu)[0] ?? menu).focus({ preventScroll: true })
  }, [refs.floating, takeFocus])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || !event.currentTarget.contains(event.target as Node)) return
    const rows = rowsOf(event.currentTarget)
    const index = rows.indexOf(document.activeElement as HTMLButtonElement)
    let next: HTMLButtonElement | undefined
    // Portal events still bubble through React's tree. Leave Escape to the shared stack.
    if (event.key === 'Escape') return
    event.stopPropagation()
    switch (event.key) {
      case 'Tab':
        chain.dismiss('tab')
        return
      case 'ArrowLeft':
        if (!back) return
        back()
        break
      case 'ArrowDown':
        next = rows[(index + 1) % rows.length]
        break
      case 'ArrowUp':
        next = rows[index <= 0 ? rows.length - 1 : index - 1]
        break
      case 'Home':
        next = rows[0]
        break
      case 'End':
        next = rows[rows.length - 1]
        break
      case 'Enter':
      case ' ':
        rows[index]?.click()
        break
      default: {
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return
        const key = event.key.toLocaleLowerCase()
        const now = Date.now()
        const last = search.current
        const sequence = now - last.time < 500 ? last.text + key : key
        const prefix = [...sequence].every((char) => char === key) ? key : sequence
        search.current = { text: sequence, time: now }
        const start = prefix.length === 1 ? index + 1 : Math.max(index, 0)
        next = [...rows.slice(start), ...rows.slice(0, start)].find((row) =>
          row.querySelector('[data-menu-label]')?.textContent?.trim().toLocaleLowerCase().startsWith(prefix),
        )
      }
    }
    event.preventDefault()
    next?.focus()
  }

  const look = menuLook(chain.look === 'lane')
  const layer = nested ? CANVAS_LAYER_CLASS.submenu : CANVAS_LAYER_CLASS.contextMenu
  return createPortal(
    <MenuLevel.Provider value={{ iconColumn, nested, current, setCurrent: (id) => {
      setCurrent(id)
      setChild((active) => active === id ? active : null)
    }, enterRow: (id, row) => {
      if (child === null || child === id) return
      const menu = refs.floating.current
      const focusedMenu = document.activeElement?.closest('[data-olumi-menu]')
      if (focusedMenu && focusedMenu !== menu) row.focus({ preventScroll: true })
      setChild(null)
    }, child, setChild }}>
      <div
        ref={refs.setFloating} id={id} role="menu" aria-label={label} tabIndex={-1} data-olumi-menu=""
        className={`olumi-menu ${chain.look === 'older' ? 'olumi-menu-older w-max' : ''} ${nested ? 'olumi-menu-child' : ''} fixed overflow-y-auto overscroll-contain outline-none ${layer} ${look.shell} transition-opacity duration-fast motion-reduce:transition-none ${isPositioned ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        style={{ left: x, top: y }}
        onKeyDown={onKeyDown} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => { event.preventDefault(); event.stopPropagation() }}
      >
        {children}
      </div>
    </MenuLevel.Provider>,
    document.body,
  )
}

interface MenuItemProps {
  id: string
  icon?: ReactNode
  label: string
  trailing?: ReactNode
  danger?: boolean
  disabled?: boolean
  disabledReason?: string
  tip?: string
  onSelect?: () => void
  /** The caller owns a transition to another surface, or closes as part of the action. */
  closeOnSelect?: boolean
}

interface RowProps extends MenuItemProps {
  expanded?: boolean
  controls?: string
  onActivate?: (row: HTMLButtonElement, toggle: boolean) => void
  onMouseEnter?: (event: SyntheticEvent<HTMLButtonElement>, dismissTip: () => void) => void
  onMouseLeave?: MouseEventHandler<HTMLButtonElement>
}

export function MenuItem(props: MenuItemProps) {
  return <MenuRow {...props} />
}

function MenuRow({ id, icon, label, trailing, danger, disabled, disabledReason, tip, onSelect, closeOnSelect = true,
  expanded, controls, onActivate, onMouseEnter, onMouseLeave }: RowProps) {
  const { look, dismiss, restoreAfterAction } = useContext(MenuChain)
  const { iconColumn, nested, current, setCurrent, enterRow } = useContext(MenuLevel)
  const lane = look === 'lane'
  const tooltipId = useId()
  const { activeTooltip, showTooltip, hideTooltip } = useTipDelay(lane ? undefined : 300)
  useTipDismissOnMove(activeTooltip !== null, hideTooltip)

  const showTip = (event: SyntheticEvent<HTMLButtonElement>) => {
    if (expanded || (lane && expanded !== undefined && !disabled)) return
    const note = disabled ? disabledReason || tip : tip
    const words = lane ? rowTipOf(event.currentTarget, label, note) : note
    if (words) showTooltip(words, event.currentTarget)
  }

  const focused = current === id
  const ink = disabled ? 'cursor-not-allowed text-text-light opacity-50'
    : lane ? `cursor-pointer hover:bg-panel-hover ${danger ? 'text-danger' : 'text-text-body'}`
      : focused ? `cursor-pointer bg-panel-hover ${danger ? 'text-danger' : 'text-text-body'}`
        : 'cursor-pointer text-text-body hover:bg-panel-hover'
  const row = menuLook(lane).row
  const rowClass = lane
    ? `group flex w-full min-w-0 items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-text-header ${row} ${ink}`
    : `group flex ${row} w-full items-center ${nested ? 'gap-1.5' : 'justify-between gap-2'} outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset transition-colors ${ink}`
  const iconInk = lane ? 'text-text-light'
    : focused ? 'text-text-body' : 'text-text-light group-hover:text-text-body'
  const labelGroup = <>
    {icon || iconColumn ? <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center ${iconInk} ${lane ? 'size-3.5' : 'size-4'}`}>{icon}</span> : null}
    <span className={`min-w-0 truncate ${lane ? 'flex-1' : nested ? 'flex-1 text-left' : ''}`} data-menu-label={id}>{label}</span>
    {!lane && disabled && disabledReason ? <span className={`${typography.panelMeta} text-text-light`}>({disabledReason})</span> : null}
  </>
  return (
    <>
      <button
        type="button" role="menuitem" data-menu-row={id} tabIndex={current === id ? 0 : -1}
        aria-disabled={disabled || undefined} aria-describedby={activeTooltip ? tooltipId : undefined}
        aria-haspopup={expanded === undefined ? undefined : 'menu'} aria-expanded={expanded} aria-controls={controls}
        className={rowClass}
        onFocus={(event) => { setCurrent(id); if (focusRing(event)) showTip(event) }}
        onBlur={hideTooltip}
        onMouseEnter={(event) => {
          enterRow(id, event.currentTarget)
          showTip(event)
          onMouseEnter?.(event, hideTooltip)
        }}
        onMouseLeave={(event) => { hideTooltip(); onMouseLeave?.(event) }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowRight' || !onActivate || disabled || event.defaultPrevented) return
          event.preventDefault()
          event.stopPropagation()
          hideTooltip()
          onActivate(event.currentTarget, false)
        }}
        onClick={(event) => {
          if (disabled) return
          hideTooltip()
          if (onActivate) {
            onActivate(event.currentTarget, true)
            return
          }
          onSelect?.()
          if (closeOnSelect) dismiss('action')
          restoreAfterAction()
        }}
      >
        {lane || nested ? labelGroup : <span className="flex min-w-0 items-center gap-1.5">{labelGroup}</span>}
        {trailing ? <span className={`shrink-0 ${typography.viewPanelMeta} text-text-light`}>{trailing}</span> : null}
      </button>
      {activeTooltip && createPortal(lane
        ? <Tip id={tooltipId} text={activeTooltip.text} anchorRect={activeTooltip.rect} />
        : <MenuTooltip id={tooltipId} text={activeTooltip.text} anchorRect={activeTooltip.rect} visible />,
      document.body)}
    </>
  )
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className={`px-3 pb-2 ${typography.viewPanelMeta} font-medium text-text-light`} role="presentation">{children}</div>
}

export function MenuSeparator() {
  const { look } = useContext(MenuChain)
  return <div role="separator" className={menuLook(look === 'lane').separator} />
}

export function SubMenu({ children, iconColumn = true, ...row }: Omit<MenuItemProps, 'trailing' | 'onSelect'> & { children: ReactNode; iconColumn?: boolean }) {
  const { look } = useContext(MenuChain)
  const { child, setChild } = useContext(MenuLevel)
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const [takeFocus, setTakeFocus] = useState(false)
  const panelAnchor = useMemo<VirtualElement | null>(() => {
    if (anchor === null) return null
    return {
      contextElement: anchor,
      getBoundingClientRect: () => {
        const row = anchor.getBoundingClientRect()
        const panel = anchor.closest('[data-olumi-menu]')?.getBoundingClientRect() ?? row
        return new DOMRect(panel.left, row.top, panel.width, row.height)
      },
    }
  }, [anchor])
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const popup = useId()
  const open = child === row.id && anchor !== null && !row.disabled
  const cancel = () => clearTimeout(timer.current)
  useLayoutEffect(() => cancel, [])

  const show = (button: HTMLButtonElement, focus: boolean) => {
    cancel()
    setAnchor(button)
    setTakeFocus(focus)
    setChild(row.id)
  }
  const back = () => {
    cancel()
    setChild((current) => current === row.id ? null : current)
    anchor?.focus({ preventScroll: true })
  }
  const leave = () => {
    cancel()
    timer.current = setTimeout(() => {
      if (!document.getElementById(popup)?.contains(document.activeElement)) {
        setChild((current) => current === row.id ? null : current)
      }
    }, 200)
  }

  return (
    <>
      <MenuRow {...row}
        expanded={open} controls={open ? popup : undefined}
        trailing={<OkIcon id="fold-chevron" size={14} decorative inherit />}
        onActivate={(button, toggle) => {
          if (look === 'older' && toggle && open) back()
          else show(button, true)
        }}
        onMouseEnter={(event, dismissTip) => {
          cancel()
          if (row.disabled || open) return
          const button = event.currentTarget
          timer.current = setTimeout(() => {
            dismissTip()
            show(button, false)
          }, 150)
        }}
        onMouseLeave={leave}
      />
      {open && panelAnchor && <MenuSurface
        anchor={panelAnchor} label={row.label} placement="right-start" iconColumn={iconColumn}
        id={popup} back={back} takeFocus={takeFocus} onMouseEnter={cancel} onMouseLeave={leave}
      >{children}</MenuSurface>}
    </>
  )
}
