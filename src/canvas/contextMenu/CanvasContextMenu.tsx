/** The canvas adapts its existing actions to the shared menu and owns transitions into edit forms. */
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Menu } from '../../olumiView/look/Menu.tsx'
import { useShowToast } from '../ToastContext'
import { useMenuItems } from './useMenuItems'
import { useLaneItems } from './useLaneMenu'
import { type ContextTarget, type MenuEntry } from './types'
import { SetValuePopover } from './SetValuePopover'
import { setValueCustom, type FactorValueWriter } from './actions'
import { useModelEditAuthority } from '../hooks/useModelEditAuthority'
import { isOlumiCoreLane } from '../../olumiCore/lane'
import { ContextRows, hasIcon } from './ContextRows'
import { CardMenuHeader } from '../../olumiView/v12/chat/CardMenuHeader'
import { canvasChromeMenuBoundary } from '../../olumiView/look/menu'

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
      boundary={lane ? canvasChromeMenuBoundary : undefined} iconColumn={lane || hasIcon(items)}>
      {lane && target.kind === 'node' ? <CardMenuHeader nodeId={target.nodeId} /> : null}
      <ContextRows items={items} lane={lane} />
    </Menu>
  )
}
