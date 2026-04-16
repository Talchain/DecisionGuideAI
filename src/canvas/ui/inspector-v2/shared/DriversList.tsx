/**
 * DriversList — shared "What drives this" section for Outcome and Risk panels.
 *
 * Renders inbound factor connections as ConnectionRows without category badges
 * (node shape already communicates type). Labels are not truncated — the full
 * factor name is visible.
 */

import { ConnectionRow } from './ConnectionRow'
import type { NodeType } from '../../../domain/nodes'

export interface DriverItem {
  edgeId: string
  nodeId: string
  nodeKind: NodeType
  label: string
  strength: { weight: number; direction: 'positive' | 'negative' }
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
          onClick={onNavigate ? () => onNavigate(conn.nodeId) : undefined}
        />
      ))}
    </div>
  )
}
