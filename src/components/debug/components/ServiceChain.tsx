/**
 * ServiceChain Component
 *
 * Horizontal flow diagram showing service call chain for Debug Panel V2.
 * Displays: UI → CEE → PLoT → ISL with status and duration for each.
 *
 * Enhanced with expandable CEE pipeline steps (Phase A1).
 */

import { CSSProperties, useState } from 'react'
import { formatDuration } from '../utils'

export type ChainNodeStatus = 'success' | 'error' | 'pending' | 'unavailable' | 'skipped'

/**
 * Pipeline step data for CEE observability
 */
export interface PipelineStepData {
  /** Step identifier */
  step: string
  /** Model used (if LLM step) */
  model?: string
  /** Duration in milliseconds */
  latency_ms: number
  /** Whether step succeeded */
  success: boolean
  /** Error message if failed */
  error?: string
  /** Token usage */
  tokens?: {
    input: number
    output: number
    total: number
  }
  /** Whether this is a repair step */
  isRepair?: boolean
  /** Validation failure details */
  validationFailure?: {
    rulesChecked: number
    rulesFailed: string[]
  }
}

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
  /** CEE pipeline steps (for expandable CEE node) */
  pipelineSteps?: PipelineStepData[]
  /** Total step count (shown in collapsed state) */
  stepCount?: number
}

export interface ServiceChainProps {
  /** Chain nodes to display */
  nodes: ChainNode[]
}

const STATUS_COLORS: Record<ChainNodeStatus, { bg: string; border: string; text: string; dot: string; icon: string }> = {
  success: { bg: '#dcfce7', border: '#86efac', text: '#166534', dot: '#22c55e', icon: '✓' },
  error: { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b', dot: '#ef4444', icon: '✗' },
  pending: { bg: '#fef3c7', border: '#fde047', text: '#854d0e', dot: '#f59e0b', icon: '●' },
  unavailable: { bg: '#f1f5f9', border: '#e2e8f0', text: '#64748b', dot: '#94a3b8', icon: '●' },
  skipped: { bg: '#f1f5f9', border: '#e2e8f0', text: '#9ca3af', dot: '#d1d5db', icon: '●' },
}

/**
 * Map step name to human-readable label
 */
function formatStepName(step: string): string {
  const labels: Record<string, string> = {
    draft_graph: 'draft_graph',
    repair_graph: 'repair_graph',
    factor_enrichment: 'factor_enrichment',
    suggest_options: 'suggest_options',
    clarify_brief: 'clarify_brief',
    critique_graph: 'critique_graph',
    explain_diff: 'explain_diff',
    factor_extraction: 'factor_extraction',
    constraint_extraction: 'constraint_extraction',
    validate: 'validate',
  }
  return labels[step] ?? step
}

/**
 * Expandable CEE node with pipeline steps
 */
function ExpandableCEENode({
  node,
  expanded,
  onToggle,
}: {
  node: ChainNode
  expanded: boolean
  onToggle: () => void
}) {
  const colors = STATUS_COLORS[node.status]
  const hasPipelineSteps = node.pipelineSteps && node.pipelineSteps.length > 0
  const isExpandable = hasPipelineSteps

  // Collapsed view
  const collapsedBox: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '8px 12px',
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    minWidth: 80,
    cursor: isExpandable ? 'pointer' : node.onClick ? 'pointer' : 'default',
    transition: 'transform 0.1s, box-shadow 0.1s',
  }

  if (!expanded) {
    return (
      <div
        style={collapsedBox}
        onClick={isExpandable ? onToggle : node.onClick}
        onMouseEnter={(e) => {
          if (isExpandable || node.onClick) {
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = ''
          e.currentTarget.style.boxShadow = ''
        }}
        role={isExpandable || node.onClick ? 'button' : undefined}
        tabIndex={isExpandable || node.onClick ? 0 : undefined}
        aria-label={`${node.name}: ${node.status}, ${formatDuration(node.duration_ms)}${hasPipelineSteps ? ', click to expand' : ''}`}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if ((isExpandable || node.onClick) && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            isExpandable ? onToggle() : node.onClick?.()
          }
        }}
      >
        {/* Status icon + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: colors.dot, lineHeight: 1 }}>
            {colors.icon}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: colors.text }}>
            {node.name}
          </span>
          {isExpandable && (
            <span style={{ fontSize: 10, color: '#94a3b8' }}>▼</span>
          )}
        </div>

        {/* Step count (if expandable) */}
        {hasPipelineSteps && (
          <div style={{ fontSize: 10, color: '#64748b' }}>
            {node.stepCount ?? node.pipelineSteps!.length} steps
          </div>
        )}

        {/* Duration */}
        <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b' }}>
          {formatDuration(node.duration_ms)}
        </div>

        {/* HTTP status code */}
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

  // Expanded view with pipeline steps
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {/* Header (collapsible) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '8px 12px',
          cursor: 'pointer',
          borderBottom: `1px solid ${colors.border}`,
        }}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`Collapse ${node.name} pipeline`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle()
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: colors.dot, lineHeight: 1 }}>
            {colors.icon}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: colors.text }}>
            {node.name}
          </span>
        </div>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>▲</span>
      </div>

      {/* Pipeline steps list */}
      <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {node.pipelineSteps!.map((step, i) => {
          const stepSuccess = step.success
          const isValidation = step.step === 'validate'
          const isRepair = step.isRepair || step.step.includes('repair')

          // Determine step status colors
          let stepBg = '#fff'
          let stepBorder = '#e2e8f0'
          let stepIcon = '✓'
          let stepIconColor = '#22c55e'

          if (!stepSuccess) {
            stepBg = '#fffbeb'
            stepBorder = '#fde68a'
            stepIcon = '✗'
            stepIconColor = '#f59e0b'
          }
          if (isRepair) {
            stepBg = stepSuccess ? '#fef3c7' : '#fffbeb'
            stepBorder = '#fde68a'
            stepIcon = stepSuccess ? '⚡' : '✗'
            stepIconColor = '#f59e0b'
          }

          return (
            <div
              key={`${step.step}-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 8px',
                background: stepBg,
                border: `1px solid ${stepBorder}`,
                borderRadius: 4,
                fontSize: 11,
              }}
            >
              {/* Connector line */}
              <span style={{ color: '#cbd5e1', fontSize: 10 }}>
                {i === 0 ? '┌' : i === node.pipelineSteps!.length - 1 ? '└' : '├'}
              </span>

              {/* Status icon */}
              <span style={{ color: stepIconColor, fontSize: 10, flexShrink: 0 }}>
                {stepIcon}
              </span>

              {/* Step name */}
              <span style={{ fontWeight: 500, color: '#374151', flex: 1 }}>
                {formatStepName(step.step)}
              </span>

              {/* Model (if LLM step) */}
              {step.model && (
                <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'monospace' }}>
                  ({step.model})
                </span>
              )}

              {/* Duration */}
              <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>
                {formatDuration(step.latency_ms)}
              </span>

              {/* Validation failure indicator */}
              {isValidation && !stepSuccess && step.validationFailure && (
                <span
                  style={{ fontSize: 9, color: '#dc2626' }}
                  title={step.validationFailure.rulesFailed.join(', ')}
                >
                  {step.validationFailure.rulesFailed.length} failed
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Total duration footer */}
      <div
        style={{
          padding: '4px 12px',
          borderTop: `1px solid ${colors.border}`,
          fontSize: 10,
          color: '#64748b',
          fontFamily: 'monospace',
          textAlign: 'center',
        }}
      >
        Total: {formatDuration(node.duration_ms)}
      </div>
    </div>
  )
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
  const [expandedNode, setExpandedNode] = useState<string | null>(null)

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
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: 4,
        padding: '12px 0',
        overflowX: 'auto',
      }}
      role="list"
      aria-label="Service call chain"
    >
      {nodes.map((node, index) => {
        const isCEE = node.name === 'CEE'
        const hasPipelineSteps = node.pipelineSteps && node.pipelineSteps.length > 0
        const isExpanded = expandedNode === node.name

        return (
          <div key={node.name} style={{ display: 'flex', alignItems: 'flex-start' }} role="listitem">
            {isCEE && hasPipelineSteps ? (
              <ExpandableCEENode
                node={node}
                expanded={isExpanded}
                onToggle={() => setExpandedNode(isExpanded ? null : node.name)}
              />
            ) : (
              <ChainNodeBox node={node} />
            )}
            {index < nodes.length - 1 && (
              <div style={{ alignSelf: 'center', marginTop: isExpanded ? 0 : undefined }}>
                <Arrow />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default ServiceChain
