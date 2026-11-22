/** The canvas adapts its existing actions to the shared menu and owns transitions into edit forms. */
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { OkIcon } from '../../olumiView/look/icons'
import { Menu, MenuItem, MenuSeparator, SubMenu } from '../../olumiView/look/Menu.tsx'
import { useShowToast } from '../ToastContext'
import { useMenuItems } from './useMenuItems'
import { useLaneItems } from './useLaneMenu'
import { isDivider, isMenuItem, type ContextTarget, type MenuEntry } from './types'
import { SetValuePopover } from './SetValuePopover'
import { setValueCustom, type FactorValueWriter } from './actions'
import { useModelEditAuthority } from '../hooks/useModelEditAuthority'
import { isOlumiCoreLane } from '../../olumiCore/lane'
import { CardMenuHeader } from '../../olumiView/v12/chat/CardMenuHeader'
import { freeCanvas } from '../../olumiView/v12/edit/placeBeside'
import { FOOT_CONTROLS, HEAD_CONTROLS, LENS_KEYS, regionsOf } from '../../olumiView/regions'
import { DOCK_SELECTOR, SIDEBAR_SELECTOR, TOP_BAR_SELECTOR } from '../utils/computeFitPadding'

export interface CanvasContextMenuProps {
  target: ContextTarget
  onClose: () => void
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number }
  /** The mode the canvas is ACTUALLY in (`effectiveMode`), not the raw stored value. */
  interactionMode?: 'select' | 'hand'
  /** Omitted by hosts with no mode to switch; the menu row is then absent. */
  onSetInteractionMode?: (mode: 'select' | 'hand') => void
}

/** What a menu's items hook hands the shared menu: the rows, and (the lane only) a small edit form that stands in for the menu while it is open. */
export interface MenuItemsOptions {
  target: ContextTarget
  showToast: ReturnType<typeof useShowToast>
  screenToFlowPosition: CanvasContextMenuProps['screenToFlowPosition']
  onClose: () => void
  onOpenCustomValue: (nodeId: string) => void
  factorValueWriter: FactorValueWriter | undefined
  interactionMode?: 'select' | 'hand'
  onSetInteractionMode?: (mode: 'select' | 'hand') => void
}
export type MenuItemsHook = (o: MenuItemsOptions) => { items: MenuEntry[]; overlay: ReactNode | null }
/** The previous product's rows (the legacy canvas). Never swapped for another hook in a mounted menu. */
const useLegacyItems: MenuItemsHook = (o) => ({ items: useMenuItems(o), overlay: null })

export function CanvasContextMenu(props: CanvasContextMenuProps) {
  // Mount the menu in the opening commit so its focus and dismissal are ready
  // while Floating UI measures the panel. Each lane owns its items hook.
  return isOlumiCoreLane()
    ? <CanvasContextMenuBase key="lane" {...props} useItems={useLaneItems} />
    : <CanvasContextMenuBase key="older" {...props} useItems={useLegacyItems} />
}

export function CanvasContextMenuBase({
  target,
  onClose,
  screenToFlowPosition,
  interactionMode,
  onSetInteractionMode,
  useItems,
}: CanvasContextMenuProps & { useItems: MenuItemsHook }) {
  const showToast = useShowToast()
  const [customValueNodeId, setCustomValueNodeId] = useState<string | null>(null)
  const lane = isOlumiCoreLane()

  const authorityNodeId = target.kind === 'node' ? target.nodeId : null
  const { proposeFactorValue } = useModelEditAuthority(authorityNodeId)
  const factorValueWriter = useMemo<FactorValueWriter | undefined>(
    () => (authorityNodeId ? { nodeId: authorityNodeId, propose: proposeFactorValue } : undefined),
    [authorityNodeId, proposeFactorValue],
  )

  const handleOpenCustomValue = useCallback((nodeId: string) => {
    setCustomValueNodeId(nodeId)
  }, [])

  const { items, overlay } = useItems({
    target,
    showToast,
    screenToFlowPosition,
    onClose,
    onOpenCustomValue: handleOpenCustomValue,
    factorValueWriter,
    interactionMode,
    onSetInteractionMode,
  })

  if (overlay !== null) return <>{overlay}</>
  if (customValueNodeId) {
    return createPortal(
      <SetValuePopover
        nodeId={customValueNodeId}
        anchorPos={target.screenPos}
        onConfirm={(nodeId, value) => setValueCustom(nodeId, value, factorValueWriter, showToast)}
        onClose={() => { setCustomValueNodeId(null); onClose() }}
      />,
      document.body,
    )
  }

  return (
    <Menu anchor={target.opener ?? target.screenPos} opener={target.opener} request={target} label="Canvas context menu"
      onClose={onClose} look={lane ? 'lane' : 'older'}
      boundary={lane ? canvasBoundary : undefined} iconColumn={lane || hasIcon(items)}>
      {lane && target.kind === 'node' ? <CardMenuHeader nodeId={target.nodeId} /> : null}
      <ContextRows items={items} lane={lane} />
    </Menu>
  )
}

const canvasBoundary = {
  rect: canvasMenuBoundary,
  elements: () => document.querySelectorAll([
    DOCK_SELECTOR, SIDEBAR_SELECTOR, TOP_BAR_SELECTOR, ...HEAD_CONTROLS, ...FOOT_CONTROLS, ...LENS_KEYS,
  ].join(',')),
}

function canvasMenuBoundary() {
  const { left, top, right, bottom } = freeCanvas()
  const { foot, keys = [] } = regionsOf()
  const floor = [...foot, ...keys].reduce((y, control) =>
    control.right > left && control.left < right && control.top > top && control.bottom > control.top ? Math.min(y, control.top) : y,
  bottom)
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, floor - top) }
}

function hasIcon(items: MenuEntry[]) {
  return items.some((entry) => isMenuItem(entry) && Boolean(entry.glyph || entry.iconId || entry.icon))
}

function ContextRows({ items, lane }: { items: MenuEntry[]; lane: boolean }) {
  return items.map((item, index) => {
    if (isDivider(item)) return <MenuSeparator key={index} />
    const LegacyIcon = item.icon
    const iconSize = lane ? 14 : 16
    const iconColor = lane ? undefined : item.glyphColor ?? (item.id.startsWith('ask-ai') ? 'text-info' : undefined)
    const icon = item.glyph
      ? <span className={`olumi-menu-symbol text-sm ${lane ? '' : iconColor ?? 'text-text-light'}`}>{item.glyph}</span>
      : item.iconId !== undefined
        ? <OkIcon id={item.iconId} variant={item.iconAlt ? 'alt' : undefined} size={iconSize} decorative inherit className={iconColor} />
        : LegacyIcon && <LegacyIcon size={iconSize} className={iconColor} />
    const props = {
      id: item.id, label: item.label, icon, danger: item.destructive,
      disabled: !item.enabled, disabledReason: item.disabledReason, tip: item.tooltip, closeOnSelect: false,
    }
    if (item.hasSubmenu && item.submenuItems) {
      return (
        <SubMenu key={item.id} {...props} iconColumn={lane || hasIcon(item.submenuItems)}>
          <ContextRows items={item.submenuItems} lane={lane} />
        </SubMenu>
      )
    }
    return <MenuItem key={item.id} {...props} trailing={item.shortcut} onSelect={item.action} />
  })
}
