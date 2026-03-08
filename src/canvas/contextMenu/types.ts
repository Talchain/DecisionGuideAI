/**
 * Context menu type definitions.
 *
 * ContextTarget discriminated union describes what the user right-clicked on.
 * MenuItemDef / MenuDivider describe menu content.
 */

import type { ComponentType } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { EdgeData } from '../domain/edges'
import type { NodeType } from '../domain/nodes'

// ---------------------------------------------------------------------------
// Context target — what was right-clicked
// ---------------------------------------------------------------------------

export interface PaneTarget {
  kind: 'pane'
  screenPos: { x: number; y: number }
}

export interface NodeTarget {
  kind: 'node'
  nodeId: string
  nodeType: NodeType
  node: Node
  screenPos: { x: number; y: number }
}

export interface EdgeTarget {
  kind: 'edge'
  edgeId: string
  edge: Edge<EdgeData>
  isStructural: boolean
  screenPos: { x: number; y: number }
}

export interface MultiTarget {
  kind: 'multi'
  nodeIds: string[]
  edgeIds: string[]
  screenPos: { x: number; y: number }
}

export type ContextTarget = PaneTarget | NodeTarget | EdgeTarget | MultiTarget

// ---------------------------------------------------------------------------
// Menu items
// ---------------------------------------------------------------------------

export interface MenuItemDef {
  id: string
  label: string
  /** Lucide icon component */
  icon?: ComponentType<{ className?: string; size?: number }>
  /** Shape glyph for Add node submenu (rendered as text, not icon component) */
  glyph?: string
  /** Glyph colour class (e.g. 'text-danger') */
  glyphColor?: string
  shortcut?: string
  tooltip: string
  enabled: boolean
  disabledReason?: string
  action: () => void
  hasSubmenu?: boolean
  submenuItems?: MenuEntry[]
  /** Destructive actions (delete) get danger styling on hover */
  destructive?: boolean
}

export interface MenuDivider {
  type: 'divider'
}

export type MenuEntry = MenuItemDef | MenuDivider

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isDivider(entry: MenuEntry): entry is MenuDivider {
  return 'type' in entry && entry.type === 'divider'
}

export function isMenuItem(entry: MenuEntry): entry is MenuItemDef {
  return !isDivider(entry)
}
