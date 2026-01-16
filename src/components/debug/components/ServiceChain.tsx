/**
 * ServiceChain Component
 *
 * Horizontal flow diagram showing service call chain for Debug Panel V2.
 * Displays: UI → CEE → PLoT → ISL with status and duration for each.
 */

import { CSSProperties } from 'react'
import { formatDuration } from '../utils'

export type ChainNodeStatus = 'success' | 'error' | 'pending' | 'unavailable' | 'skipped'

export interface ChainNode {
  /** Service name */
  name: string
  /** Request duration in ms */
  duration_ms: number | null
  /** Status of the call */
  status: ChainNodeStatus
  /** HTTP status code */
  statusCode?: number | null
  /** Click handler */
  onClick?: () => void
}

export interface ServiceChainProps {
  /** Chain nodes to display */
  nodes: ChainNode[]
}

const STATUS_COLORS: Record<ChainNodeStatus, { bg: string; border: string; text: string; dot: string; icon: string }> = {
  success: { bg: '#dcfce7', border: '#86efac', text: '#166534', dot: '#22c55e', icon: '●' },
  error: { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b', dot: '#ef4444', icon: '✗' },
  pending: { bg: '#fef3c7', border: '#fde047', text: '#854d0e', dot: '#f59e0b', icon: '●' },
  unavailable: { bg: '#f1f5f9', border: '#e2e8f0', text: '#64748b', dot: '#94a3b8', icon: '●' },
  skipped: { bg: '#f1f5f9', border: '#e2e8f0', text: '#9ca3af', dot: '#d1d5db', icon: '●' },
}

function ChainNodeBox({ node }: { node: ChainNode }) {
  const colors = STATUS_COLORS[node.status]
  const isClickable = !!node.onClick

  const boxStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '8px 12px',
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    minWidth: 80,
    cursor: isClickable ? 'pointer' : 'default',
    transition: 'transform 0.1s, box-shadow 0.1s',
  }

  return (
    <div
      style={boxStyle}
      onClick={node.onClick}
      onMouseEnter={(e) => {
        if (isClickable) {
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
        }
      }}
      onMouseLeave={(e) => {
        if (isClickable) {
          e.currentTarget.style.transform = ''
          e.currentTarget.style.boxShadow = ''
        }
      }}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={`${node.name}: ${node.status}, ${formatDuration(node.duration_ms)}`}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          node.onClick?.()
        }
      }}
    >
      {/* Status icon + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontSize: 10,
            color: colors.dot,
            lineHeight: 1,
          }}
        >
          {colors.icon}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: colors.text,
          }}
        >
          {node.name}
        </span>
      </div>

      {/* Duration */}
      <div
        style={{
          fontSize: 10,
          fontFamily: 'monospace',
          color: '#64748b',
        }}
      >
        {formatDuration(node.duration_ms)}
      </div>

      {/* HTTP status code if available */}
      {node.statusCode !== undefined && node.statusCode !== null && (
        <div
          style={{
            fontSize: 9,
            fontFamily: 'monospace',
            color: node.statusCode >= 400 ? '#ef4444' : '#22c55e',
          }}
        >
          {node.statusCode}
        </div>
      )}
    </div>
  )
}

function Arrow() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        color: '#94a3b8',
        fontSize: 16,
        padding: '0 4px',
      }}
      aria-hidden="true"
    >
      →
    </div>
  )
}

export function ServiceChain({ nodes }: ServiceChainProps) {
  if (nodes.length === 0) {
    return (
      <div
        style={{
          padding: 16,
          textAlign: 'center',
          color: '#64748b',
          fontSize: 12,
        }}
      >
        No service calls recorded
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: '12px 0',
        overflowX: 'auto',
      }}
      role="list"
      aria-label="Service call chain"
    >
      {nodes.map((node, index) => (
        <div key={node.name} style={{ display: 'flex', alignItems: 'center' }} role="listitem">
          <ChainNodeBox node={node} />
          {index < nodes.length - 1 && <Arrow />}
        </div>
      ))}
    </div>
  )
}

export default ServiceChain
