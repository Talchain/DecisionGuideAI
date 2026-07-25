/**
 * DriversList — shared "What drives this" section for Outcome and Risk panels.
 *
 * Renders inbound factor connections as ConnectionRows without category badges
 * (node shape already communicates type). Labels are not truncated — the full
 * factor name is visible.
 */

import { ConnectionRow } from './ConnectionRow'
import type { NodeType } from '../../../domain/nodes'
import type { EdgeValueDisplay } from '../../../domain/edgeValueProvenance'

export interface DriverItem {
  edgeId: string
  nodeId: string
  nodeKind: NodeType
  label: string
  /** Already through the provenance gate — see `ConnectionRowProps.strength`. */
  strength: EdgeValueDisplay
}

interface DriversListProps {
  drivers: DriverItem[]
  techMode: boolean
  onNavigate?: (id: string) => void
}

export function DriversList({ drivers, techMode, onNavigate }: DriversListProps) {
  if (drivers.length === 0) return null

  return (
    <div data-testid="drivers-list">
      {drivers.map(conn => (
        <ConnectionRow
          key={conn.edgeId}
          nodeKind={conn.nodeKind}
          label={conn.label}
          strength={conn.strength}
          techMode={techMode}
          fullLabel
          onClick={onNavigate ? () => onNavigate(conn.nodeId) : undefined}
        />
      ))}
    </div>
  )
}
