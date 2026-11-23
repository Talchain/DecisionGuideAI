import {
  createContext, useContext, useId, useLayoutEffect, useMemo, useRef, useState,
  type AriaAttributes, type FocusEvent, type KeyboardEvent, type MouseEvent, type MouseEventHandler, type ReactNode, type SyntheticEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { autoUpdate, flip, offset, shift, size, useFloating, type Placement, type VirtualElement } from '@floating-ui/react'
import { typography } from '../../styles/typography'
import { CANVAS_LAYER_CLASS } from '../../canvas/layers'
import { MenuTooltip } from '../../canvas/contextMenu/MenuTooltip'
import { OkIcon } from './icons'
import { menuLook } from './menu.ts'
import { escapeMenu, isMenuOpen, registerMenu, type MenuDismissal } from './menuArbiter'
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
  testId?: string
  gap?: number
  repairHeldFocus?: boolean
  children: ReactNode
}

interface Chain {
  look: Look
  boundary?: MenuBoundary
  repairHeldFocus: boolean
  gap: number
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
  enterRow: (id: string, row: HTMLElement) => void
  child: string | null
  setChild: (id: string | null | ((current: string | null) => string | null)) => void
}
const MenuLevel = createContext<Level>(null!)
const rowsOf = (menu: HTMLElement, skipHeld = false) => {
  const rows = Array.from(menu.querySelectorAll<HTMLElement>('[data-menu-row], [data-menu-controls] button:not(:disabled)'))
  const enabled = skipHeld ? rows.filter((row) => row.getAttribute('aria-disabled') !== 'true') : rows
  return enabled.length || !skipHeld ? enabled : rows
}

export function Menu({ anchor, label, onClose, opener, request = anchor, boundary, placement = 'bottom-start', look = 'lane', iconColumn = true, testId, gap = 0, repairHeldFocus = false, children }: MenuProps) {
  const surfaces = useRef(new Set<Surface>()).current
  const returnTo = useRef<HTMLElement | null>(null)
  const [dismissed, setDismissed] = useState<object | null>(null)
  const closed = dismissed === request

  const restore = () => {
    if (returnTo.current?.isConnected) returnTo.current.focus({ preventScroll: true })
  }
  const chain: Chain = {
    look, boundary, surfaces, gap, repairHeldFocus,
    dismiss: (reason) => {
      if (reason === 'escape' || reason === 'tab' || reason === 'opener') restore()
      setDismissed(request)
      onClose(reason)
    },
    restoreAfterAction: () => {
      // An action can replace the menu with a form or move focus to the composer.
      queueMicrotask(() => { if (!isMenuOpen() && document.activeElement === document.body) restore() })
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
      lane: look === 'lane',
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
    if (root) (rowsOf(root, latestChain.current.repairHeldFocus)[0] ?? root).focus({ preventScroll: true })
    return unregister
  }, [anchor, closed, look, opener, request, surfaces])

  if (closed) return null
  return (
    <MenuChain.Provider value={chain}>
      <MenuSurface anchor={anchor} label={label} placement={placement} iconColumn={iconColumn} request={request} testId={testId}>
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
  testId?: string
  back?: () => void
  takeFocus?: boolean
  onMouseEnter?: MouseEventHandler<HTMLDivElement>
  onMouseLeave?: MouseEventHandler<HTMLDivElement>
  children: ReactNode
}

function MenuSurface({ anchor, label, placement, iconColumn, request, id, testId, back, takeFocus, onMouseEnter, onMouseLeave, children }: SurfaceProps) {
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
      offset(nested ? (chain.look === 'lane' ? -4 : 4) : chain.gap),
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
          const bounds = chain.boundary?.rect()
          if (bounds) elements.floating.style.maxWidth = `${Math.max(0, bounds.width - 16)}px`
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
    if (!menu || chain.repairHeldFocus) return
    const rows = rowsOf(menu)
    if (!rows.some((row) => row.dataset.menuRow === current)) {
      setCurrent(rows[0]?.dataset.menuRow ?? null)
      if (document.activeElement === menu || (current !== null && document.activeElement === document.body)) {
        (rows[0] ?? menu).focus({ preventScroll: true })
      }
    }
  })

  // Goal tiles own their state and can change without a render of the surface.
  useLayoutEffect(() => {
    const menu = refs.floating.current
    if (!chain.repairHeldFocus || !menu) return
    let focused: HTMLElement | null = null
    const repair = () => {
      const active = document.activeElement
      const rows = rowsOf(menu, true)
      if (active instanceof HTMLElement && menu.contains(active)) focused = active
      const gone = active === document.body && focused !== null && !rows.includes(focused)
      const held = active instanceof HTMLElement && menu.contains(active) && active !== menu && !rows.includes(active)
      const row = gone || held ? rows[0] : rows.find((item) => item === active) ?? rows.find((item) => item.tabIndex === 0) ?? rows[0]
      for (const button of menu.querySelectorAll<HTMLElement>('[data-menu-row], [data-menu-controls] button')) {
        button.tabIndex = button === row ? 0 : -1
      }
      if ((gone && row) || held) (row ?? menu).focus({ preventScroll: true })
    }
    menu.addEventListener('focusin', repair)
    repair()
    const observer = new MutationObserver(repair)
    observer.observe(menu, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-disabled', 'disabled'] })
    return () => { observer.disconnect(); menu.removeEventListener('focusin', repair) }
  }, [chain.repairHeldFocus, refs.floating])

  useLayoutEffect(() => {
    const menu = refs.floating.current
    if (takeFocus && menu) (rowsOf(menu)[0] ?? menu).focus({ preventScroll: true })
  }, [refs.floating, takeFocus])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || !event.currentTarget.contains(event.target as Node)) return
    const rows = rowsOf(event.currentTarget, chain.repairHeldFocus)
    const index = rows.indexOf(document.activeElement as HTMLElement)
    let next: HTMLElement | undefined
    // Use the same chain for focused Escape and the shared Escape stack's fallback.
    if (event.key === 'Escape') {
      if (escapeMenu(event.target as Node)) { event.preventDefault(); event.stopPropagation() }
      return
    }
    event.stopPropagation()
    switch (event.key) {
      case 'Tab':
        if (chain.look === 'lane') event.preventDefault()
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
          (row.querySelector('[data-menu-label]')?.textContent ?? row.textContent)?.trim().toLocaleLowerCase().startsWith(prefix),
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
        ref={refs.setFloating} id={id} role="menu" aria-label={label} tabIndex={-1} data-olumi-menu="" data-testid={testId}
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
  content?: ReactNode
  description?: ReactNode
  checked?: boolean
  href?: string
  meta?: Pick<AriaAttributes, 'aria-label' | 'aria-keyshortcuts' | 'aria-haspopup'> & { [key: `data-${string}`]: string | undefined }
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
  onActivate?: (row: HTMLElement, toggle: boolean) => void
  onMouseEnter?: (event: SyntheticEvent<HTMLElement>, dismissTip: () => void) => void
  onMouseLeave?: MouseEventHandler<HTMLElement>
}

export function MenuItem(props: MenuItemProps) {
  return <MenuRow {...props} />
}

function MenuRow({ id, icon, label, trailing, content, description, checked, href, meta, danger, disabled, disabledReason, tip, onSelect, closeOnSelect = true,
  expanded, controls, onActivate, onMouseEnter, onMouseLeave }: RowProps) {
  const { look, dismiss, restoreAfterAction, repairHeldFocus } = useContext(MenuChain)
  const { iconColumn, nested, current, setCurrent, enterRow } = useContext(MenuLevel)
  const lane = look === 'lane'
  const tooltipId = useId()
  const { activeTooltip, showTooltip, hideTooltip } = useTipDelay(lane ? undefined : 300)
  useTipDismissOnMove(activeTooltip !== null, hideTooltip)

  const showTip = (event: SyntheticEvent<HTMLElement>) => {
    if (expanded || (lane && expanded !== undefined && !disabled)) return
    const note = disabled ? disabledReason || tip : tip
    const words = lane ? rowTipOf(event.currentTarget, label, note) : note
    if (words) showTooltip(words, event.currentTarget)
  }

  const focused = current === id
  const ink = disabled ? 'cursor-not-allowed text-text-light opacity-50'
    : lane ? `cursor-pointer hover:bg-panel-hover ${danger ? 'text-warning-ink' : 'text-text-body'}`
      : focused ? `cursor-pointer bg-panel-hover ${danger ? 'text-danger' : 'text-text-body'}`
        : 'cursor-pointer text-text-body hover:bg-panel-hover'
  const row = menuLook(lane).row
  const rowClass = lane
    ? `group flex w-full min-w-0 items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-text-header ${row} ${ink} ${checked ? 'bg-panel-hover font-medium' : ''}`
    : `group flex ${row} w-full items-center ${nested ? 'gap-1.5' : 'justify-between gap-2'} outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset transition-colors ${ink}`
  const iconInk = lane ? 'text-text-light'
    : focused ? 'text-text-body' : 'text-text-light group-hover:text-text-body'
  const labelGroup = <>
    {icon || iconColumn ? <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center ${iconInk} ${lane ? 'size-3.5' : 'size-4'}`}>{icon}</span> : null}
    {content || description ? (
      <span className="min-w-0 flex-1 break-words">
        <span data-menu-label={id}>{content ?? label}</span>
        {description && <span className={`block ${typography.viewPanelMeta} text-text-light`}>{description}</span>}
      </span>
    ) : <span className={`min-w-0 truncate ${lane ? 'flex-1' : nested ? 'flex-1 text-left' : ''}`} data-menu-label={id}>{label}</span>}
    {!lane && disabled && disabledReason ? <span className={`${typography.panelMeta} text-text-light`}>({disabledReason})</span> : null}
  </>
  const Row = href ? 'a' : 'button'
  return (
    <>
      <Row
        {...(href ? { href, target: '_blank', rel: 'noopener noreferrer' } : { type: 'button' })}
        {...meta}
        role={checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={checked} data-menu-row={id} tabIndex={!repairHeldFocus && current === id ? 0 : -1}
        aria-disabled={disabled || undefined} aria-describedby={activeTooltip ? tooltipId : undefined}
        aria-haspopup={expanded === undefined ? meta?.['aria-haspopup'] : 'menu'} aria-expanded={expanded} aria-controls={controls}
        className={rowClass}
        onFocus={(event: FocusEvent<HTMLElement>) => { setCurrent(id); if (focusRing(event)) showTip(event) }}
        onBlur={hideTooltip}
        onPointerEnter={lane ? showTip : undefined}
        onPointerLeave={lane ? hideTooltip : undefined}
        onMouseEnter={(event: MouseEvent<HTMLElement>) => {
          enterRow(id, event.currentTarget)
          showTip(event)
          onMouseEnter?.(event, hideTooltip)
        }}
        onMouseLeave={(event: MouseEvent<HTMLElement>) => { hideTooltip(); onMouseLeave?.(event) }}
        onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
          if (event.key !== 'ArrowRight' || !onActivate || disabled || event.defaultPrevented) return
          event.preventDefault()
          event.stopPropagation()
          hideTooltip()
          onActivate(event.currentTarget, false)
        }}
        onClick={(event: MouseEvent<HTMLElement>) => {
          if (disabled) { event.preventDefault(); return }
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
        {trailing || checked ? <span className={`shrink-0 ${typography.viewPanelMeta} text-text-light`}>{trailing ?? <OkIcon id="trigger-taken" size={14} decorative />}</span> : null}
      </Row>
      {activeTooltip && createPortal(lane
        ? <Tip id={tooltipId} text={activeTooltip.text} anchorRect={activeTooltip.rect} />
        : <MenuTooltip id={tooltipId} text={activeTooltip.text} anchorRect={activeTooltip.rect} visible />,
      document.body)}
    </>
  )
}

export function MenuLabel({ children, as: Element = 'div' }: { children: ReactNode; as?: 'div' | 'p' }) {
  return <Element className={`px-3 pb-2 ${typography.viewPanelMeta} font-medium text-text-light`} role="presentation">{children}</Element>
}

export function MenuSeparator() {
  const { look } = useContext(MenuChain)
  return <div role="separator" className={menuLook(look === 'lane').separator} />
}

export function SubMenu({ children, iconColumn = true, ...row }: Omit<MenuItemProps, 'trailing' | 'onSelect'> & { children: ReactNode; iconColumn?: boolean }) {
  const { look } = useContext(MenuChain)
  const { child, setChild } = useContext(MenuLevel)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
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

  const show = (button: HTMLElement, focus: boolean) => {
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
