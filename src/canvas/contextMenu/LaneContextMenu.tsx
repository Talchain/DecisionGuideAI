/** The right-click menu on the olumi-core lane: the shared menu (CanvasContextMenu.tsx) with the lane's own rows and edit form (laneMenu.ts). Loaded lazily, only on the lane. */
import { CanvasContextMenuBase, type CanvasContextMenuProps } from './CanvasContextMenu'
import { useLaneItems } from './useLaneMenu'

export default function LaneContextMenu(props: CanvasContextMenuProps) {
  return <CanvasContextMenuBase {...props} useItems={useLaneItems} />
}
