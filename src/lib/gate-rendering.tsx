/**
 * Gate-Based Rendering Utilities
 *
 * React hooks and components for conditional rendering based on stage gate statuses.
 * Implements the blocking/demoting rules from the observability specification.
 *
 * Gate rules:
 * | Gate            | Blocks on Fail        | Demotes on Warn      |
 * |-----------------|------------------------|----------------------|
 * | graph_readiness | Run button            | —                    |
 * | validation      | Results panel         | Results quality      |
 * | run             | Insights panel        | —                    |
 * | robustness      | Confidence display    | Confidence quality   |
 *
 * @example
 * ```tsx
 * import { useGateBlocking, GateGuard } from '@/lib/gate-rendering'
 *
 * // Hook usage
 * function RunButton() {
 *   const { isBlocked, tooltip } = useGateBlocking('graph_readiness')
 *   return <button disabled={isBlocked} title={tooltip}>Run</button>
 * }
 *
 * // Component usage
 * <GateGuard gate="run" fallback={<DisabledInsights />}>
 *   <InsightsPanel />
 * </GateGuard>
 * ```
 */

import { type ReactNode } from 'react'
import { useGateStore, type GateName } from './gate-state'

/**
 * Gate blocking state with contextual information
 */
export interface GateBlockingState {
  /** Whether the gate is blocking (fail status) */
  isBlocked: boolean
  /** Whether the gate is demoted (warn status) */
  isDemoted: boolean
  /** Current gate status */
  status: 'pass' | 'warn' | 'fail'
  /** Human-readable tooltip explaining the blocking reason */
  tooltip: string
  /** Optional message from the service */
  message?: string
}

/**
 * Human-readable gate descriptions for tooltips
 */
const GATE_DESCRIPTIONS: Record<GateName, { name: string; blockedMsg: string; demotedMsg: string }> = {
  graph_readiness: {
    name: 'Graph Readiness',
    blockedMsg: 'Graph is not ready for analysis. Check for validation errors.',
    demotedMsg: 'Graph may have minor issues that could affect results.',
  },
  validation: {
    name: 'Validation',
    blockedMsg: 'Validation failed. Results cannot be displayed.',
    demotedMsg: 'Some validation warnings detected. Results may be incomplete.',
  },
  run: {
    name: 'Analysis Run',
    blockedMsg: 'Analysis failed. Insights are unavailable.',
    demotedMsg: 'Analysis completed with warnings.',
  },
  robustness: {
    name: 'Robustness Check',
    blockedMsg: 'Robustness check failed. Confidence scores unavailable.',
    demotedMsg: 'Confidence scores may be less reliable due to robustness warnings.',
  },
}

/**
 * Hook to get gate blocking state for conditional rendering
 *
 * @param gate - Gate name to check
 * @returns Gate blocking state with tooltip
 */
export function useGateBlocking(gate: GateName): GateBlockingState {
  const { gates, isBlocked, isDemoted } = useGateStore()
  const record = gates[gate]
  const blocked = isBlocked(gate)
  const demoted = isDemoted(gate)
  const desc = GATE_DESCRIPTIONS[gate]

  let tooltip = ''
  if (blocked) {
    tooltip = record.message || desc.blockedMsg
  } else if (demoted) {
    tooltip = record.message || desc.demotedMsg
  }

  return {
    isBlocked: blocked,
    isDemoted: demoted,
    status: record.status,
    tooltip,
    message: record.message,
  }
}

/**
 * Hook to check if any gates are blocking
 *
 * @param gates - Array of gate names to check
 * @returns True if any gate is blocking
 */
export function useAnyGateBlocking(gates: GateName[]): boolean {
  const store = useGateStore()
  return gates.some((gate) => store.isBlocked(gate))
}

/**
 * Hook to check if all gates are passing
 *
 * @param gates - Array of gate names to check
 * @returns True if all gates are passing
 */
export function useAllGatesPassing(gates: GateName[]): boolean {
  const { getGateStatus } = useGateStore()
  return gates.every((gate) => getGateStatus(gate) === 'pass')
}

/**
 * Props for GateGuard component
 */
interface GateGuardProps {
  /** Gate to check */
  gate: GateName
  /** Content to render when gate is not blocking */
  children: ReactNode
  /** Content to render when gate is blocking (default: null) */
  fallback?: ReactNode
  /** If true, also hide on warn status (default: false, only fail blocks) */
  hideOnWarn?: boolean
}

/**
 * Component that conditionally renders children based on gate status
 *
 * @example
 * ```tsx
 * <GateGuard gate="run" fallback={<p>Analysis unavailable</p>}>
 *   <InsightsPanel />
 * </GateGuard>
 * ```
 */
export function GateGuard({ gate, children, fallback = null, hideOnWarn = false }: GateGuardProps) {
  const { isBlocked, isDemoted } = useGateBlocking(gate)

  if (isBlocked) return <>{fallback}</>
  if (hideOnWarn && isDemoted) return <>{fallback}</>

  return <>{children}</>
}

/**
 * Props for GateDemotion component
 */
interface GateDemotionProps {
  /** Gate to check */
  gate: GateName
  /** Content to render normally */
  children: ReactNode
  /** Wrapper to apply when demoted (receives children) */
  demotedWrapper?: (children: ReactNode) => ReactNode
  /** CSS class to apply when demoted */
  demotedClassName?: string
  /** Inline styles to apply when demoted */
  demotedStyle?: React.CSSProperties
}

/**
 * Component that applies demotion styling based on gate status
 *
 * @example
 * ```tsx
 * <GateDemotion
 *   gate="robustness"
 *   demotedClassName="opacity-50"
 *   demotedWrapper={(children) => (
 *     <div className="border-dashed border-amber-500">{children}</div>
 *   )}
 * >
 *   <ConfidenceBadge />
 * </GateDemotion>
 * ```
 */
export function GateDemotion({ gate, children, demotedWrapper, demotedClassName, demotedStyle }: GateDemotionProps) {
  const { isDemoted, tooltip } = useGateBlocking(gate)

  if (!isDemoted) return <>{children}</>

  let content = children

  // Apply wrapper if provided
  if (demotedWrapper) {
    content = demotedWrapper(content)
  }

  // Apply className/style if provided
  if (demotedClassName || demotedStyle) {
    content = (
      <div className={demotedClassName} style={demotedStyle} title={tooltip}>
        {content}
      </div>
    )
  }

  return <>{content}</>
}

/**
 * Default demotion styles for common use cases
 */
export const DEMOTION_STYLES = {
  /** Reduced opacity */
  faded: { opacity: 0.5 } as React.CSSProperties,
  /** Dashed border with warning color */
  bordered: {
    border: '1px dashed #f59e0b',
    borderRadius: 4,
    padding: 4,
  } as React.CSSProperties,
  /** Grayscale filter */
  grayscale: { filter: 'grayscale(50%)' } as React.CSSProperties,
}

/**
 * Get gate blocking status for imperative code (outside React)
 */
export function getGateBlockingSync(gate: GateName): GateBlockingState {
  const { gates, isBlocked, isDemoted, getGateStatus } = useGateStore.getState()
  const record = gates[gate]
  const blocked = isBlocked(gate)
  const demoted = isDemoted(gate)
  const desc = GATE_DESCRIPTIONS[gate]

  let tooltip = ''
  if (blocked) {
    tooltip = record.message || desc.blockedMsg
  } else if (demoted) {
    tooltip = record.message || desc.demotedMsg
  }

  return {
    isBlocked: blocked,
    isDemoted: demoted,
    status: record.status,
    tooltip,
    message: record.message,
  }
}
