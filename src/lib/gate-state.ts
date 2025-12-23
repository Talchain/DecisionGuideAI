/**
 * Gate State Management
 *
 * Manages stage gates for controlling UI flow based on service responses.
 * Each gate has a status (pass/warn/fail) that determines what UI elements
 * are blocked or demoted.
 *
 * Gate definitions:
 * | Gate            | Source               | Default | Blocks            |
 * |-----------------|----------------------|---------|-------------------|
 * | graph_readiness | CEE draft response   | fail    | Run button        |
 * | validation      | ISL validate response| warn    | Results (if fail) |
 * | run             | PLoT run response    | fail    | Insights panel    |
 * | robustness      | ISL robustness resp  | warn    | Confidence display|
 *
 * @example
 * ```typescript
 * import { useGateStore, GateName } from '@/lib/gate-state'
 *
 * // Update a gate
 * useGateStore.getState().setGate('graph_readiness', 'pass')
 *
 * // Check gate status
 * const status = useGateStore.getState().getGateStatus('run')
 *
 * // React hook usage
 * const { gates, isBlocked } = useGateStore()
 * if (isBlocked('run')) { // Hide insights panel }
 * ```
 */

import { create } from 'zustand'

/**
 * Gate names matching the stage gate specification
 */
export type GateName = 'graph_readiness' | 'validation' | 'run' | 'robustness'

/**
 * Gate status values
 * - pass: Gate passed, no blocking
 * - warn: Gate warning, may demote UI elements
 * - fail: Gate failed, blocks dependent UI elements
 */
export type GateStatus = 'pass' | 'warn' | 'fail'

/**
 * Gate record with status and metadata
 */
export interface GateRecord {
  /** Current gate status */
  status: GateStatus
  /** ISO timestamp of last status update */
  updatedAt: string
  /** Request ID that triggered this status */
  requestId?: string
  /** Optional message from service */
  message?: string
  /** Service name that set this gate */
  service?: string
}

/**
 * Default gate statuses per specification
 */
const GATE_DEFAULTS: Record<GateName, GateStatus> = {
  graph_readiness: 'fail',
  validation: 'warn',
  run: 'fail',
  robustness: 'warn',
}

/**
 * Gate blocking rules per specification
 */
const GATE_BLOCKS: Record<GateName, string> = {
  graph_readiness: 'run_button',
  validation: 'results_panel', // Only blocks on fail
  run: 'insights_panel',
  robustness: 'confidence_display',
}

/**
 * Gate state store interface
 */
interface GateState {
  /** Current gate statuses */
  gates: Record<GateName, GateRecord>

  /**
   * Set a gate's status
   */
  setGate: (
    name: GateName,
    status: GateStatus,
    options?: {
      requestId?: string
      message?: string
      service?: string
    }
  ) => void

  /**
   * Reset a gate to its default status
   */
  resetGate: (name: GateName) => void

  /**
   * Reset all gates to defaults
   */
  resetAllGates: () => void

  /**
   * Get a gate's current status
   */
  getGateStatus: (name: GateName) => GateStatus

  /**
   * Check if a UI element is blocked by a gate
   */
  isBlocked: (name: GateName) => boolean

  /**
   * Check if a UI element should be demoted (warn status)
   */
  isDemoted: (name: GateName) => boolean

  /**
   * Get all gates with non-pass status
   */
  getIssues: () => Array<{ gate: GateName; record: GateRecord }>

  /**
   * Get gate history for diagnostics
   */
  getGateSnapshot: () => Record<GateName, GateRecord>
}

/**
 * Create initial gate records with defaults
 */
function createInitialGates(): Record<GateName, GateRecord> {
  const now = new Date().toISOString()
  return {
    graph_readiness: { status: GATE_DEFAULTS.graph_readiness, updatedAt: now },
    validation: { status: GATE_DEFAULTS.validation, updatedAt: now },
    run: { status: GATE_DEFAULTS.run, updatedAt: now },
    robustness: { status: GATE_DEFAULTS.robustness, updatedAt: now },
  }
}

/**
 * Zustand store for gate state management
 */
export const useGateStore = create<GateState>((set, get) => ({
  gates: createInitialGates(),

  setGate: (name, status, options) => {
    set((state) => ({
      gates: {
        ...state.gates,
        [name]: {
          status,
          updatedAt: new Date().toISOString(),
          requestId: options?.requestId,
          message: options?.message,
          service: options?.service,
        },
      },
    }))

    // Log gate transitions in development
    if (import.meta.env.DEV) {
      console.log(`[gate-state] ${name}: ${status}`, options?.message || '')
    }
  },

  resetGate: (name) => {
    set((state) => ({
      gates: {
        ...state.gates,
        [name]: {
          status: GATE_DEFAULTS[name],
          updatedAt: new Date().toISOString(),
        },
      },
    }))
  },

  resetAllGates: () => {
    set({ gates: createInitialGates() })
  },

  getGateStatus: (name) => {
    return get().gates[name]?.status ?? GATE_DEFAULTS[name]
  },

  isBlocked: (name) => {
    const status = get().getGateStatus(name)
    // validation only blocks on fail, not warn
    if (name === 'validation') {
      return status === 'fail'
    }
    // robustness only blocks on fail, not warn
    if (name === 'robustness') {
      return status === 'fail'
    }
    // graph_readiness and run block on fail
    return status === 'fail'
  },

  isDemoted: (name) => {
    const status = get().getGateStatus(name)
    return status === 'warn'
  },

  getIssues: () => {
    const { gates } = get()
    return (Object.entries(gates) as [GateName, GateRecord][])
      .filter(([, record]) => record.status !== 'pass')
      .map(([gate, record]) => ({ gate, record }))
  },

  getGateSnapshot: () => {
    return { ...get().gates }
  },
}))

/**
 * Get what UI element a gate blocks
 */
export function getBlockedElement(gate: GateName): string {
  return GATE_BLOCKS[gate]
}

/**
 * Get the default status for a gate
 */
export function getGateDefault(gate: GateName): GateStatus {
  return GATE_DEFAULTS[gate]
}

/**
 * All gate names for iteration
 */
export const ALL_GATES: GateName[] = ['graph_readiness', 'validation', 'run', 'robustness']

/**
 * Reset gate store (for testing)
 * @internal
 */
export function _resetGateStore(): void {
  useGateStore.getState().resetAllGates()
}
