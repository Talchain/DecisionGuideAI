/**
 * PayloadLabTab Component
 *
 * Interactive payload testing for ISL requests.
 * Only visible when ?unsafe=1 URL flag is set.
 *
 * Redesigned as three-step vertical flow:
 * - Step 1: Generate Draft (Prompt Tester)
 * - Step 2: ISL Payload (Editor + Validation)
 * - Step 3: Results (Table + Raw Response)
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { PayloadHistoryEntry, PayloadSnapshot, ISLTestResponse, ISLTestSummary, ConformalResult, ConformalRawResponse } from './types'
import { CEEClient } from '../../adapters/cee/client'
import { usePayloadTraceStore } from '../../lib/payload-trace-store'
import { useCanvasStore } from '../../canvas/store'
import { DEFAULT_EDGE_DATA } from '../../canvas/domain/edges'
import type { Edge } from '@xyflow/react'
import type { EdgeData } from '../../canvas/domain/edges'
import { buildISLConformalRequest, type UINode, type UIEdge } from '../../canvas/adapters/islRequestAdapter'

// =============================================================================
// Storage Keys
// =============================================================================

const HISTORY_KEY = 'olumi_payload_history'
const SNAPSHOTS_KEY = 'olumi_payload_snapshots'
const MAX_HISTORY = 20

// =============================================================================
// Storage Helpers
// =============================================================================

function loadHistory(): PayloadHistoryEntry[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveHistory(history: PayloadHistoryEntry[]): void {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
  } catch {
    // Ignore storage errors
  }
}

function loadSnapshots(): PayloadSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveSnapshots(snapshots: PayloadSnapshot[]): void {
  try {
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots))
  } catch {
    // Ignore storage errors
  }
}

// =============================================================================
// JSON Validation
// =============================================================================

interface ValidationResult {
  valid: boolean
  error?: string
  errors?: string[]  // Multiple ISL validation errors
  parsed?: object
}

function validateJson(text: string): ValidationResult {
  if (!text.trim()) {
    return { valid: false, error: 'Empty payload' }
  }
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null) {
      return { valid: false, error: 'Payload must be an object' }
    }
    return { valid: true, parsed }
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Invalid JSON' }
  }
}

// =============================================================================
// ISL Payload Validation
// =============================================================================

/**
 * Validate ISL-specific payload constraints.
 * Returns validation errors for ISL requirements.
 */
function validateISLPayload(payload: object): string[] {
  const errors: string[] = []
  const p = payload as Record<string, unknown>

  // confidence_level validation (must be >= 0.5 and <= 1)
  if ('confidence_level' in p) {
    const cl = p.confidence_level
    if (typeof cl !== 'number') {
      errors.push('confidence_level must be a number')
    } else if (cl < 0.5) {
      errors.push('confidence_level must be >= 0.5')
    } else if (cl > 1) {
      errors.push('confidence_level must be <= 1.0')
    }
  }

  // Required fields
  if (!p.model) {
    errors.push('model is required')
  }
  if (!p.intervention) {
    errors.push('intervention is required')
  }

  // model structure validation
  const model = p.model as Record<string, unknown> | undefined
  if (model && typeof model === 'object') {
    if (!Array.isArray(model.variables)) {
      errors.push('model.variables must be an array')
    }
    if (!model.equations || typeof model.equations !== 'object') {
      errors.push('model.equations is required')
    }
  }

  return errors
}

/**
 * Full validation: JSON syntax + ISL constraints
 */
function validatePayload(text: string): ValidationResult {
  const jsonResult = validateJson(text)
  if (!jsonResult.valid || !jsonResult.parsed) {
    return jsonResult
  }

  // Now check ISL-specific constraints
  const islErrors = validateISLPayload(jsonResult.parsed)
  if (islErrors.length > 0) {
    return {
      valid: false,
      errors: islErrors,
      parsed: jsonResult.parsed, // Still provide parsed for editing
    }
  }

  return { valid: true, parsed: jsonResult.parsed }
}

// =============================================================================
// Task 3: Fixed Intervention Extraction
// =============================================================================

/**
 * Extract interventions from CEE options in flat format for ISL.
 * Handles various value shapes: number, boolean, { value: number|boolean }
 */
function extractInterventionsForISL(option: unknown): Record<string, number> {
  const interventions: Record<string, number> = {}

  if (!option || typeof option !== 'object') return interventions

  const optionObj = option as Record<string, unknown>
  const rawInterventions = optionObj.interventions as Record<string, unknown> | undefined

  if (!rawInterventions || typeof rawInterventions !== 'object') return interventions

  for (const [key, value] of Object.entries(rawInterventions)) {
    if (typeof value === 'number') {
      interventions[key] = value
    } else if (typeof value === 'boolean') {
      interventions[key] = value ? 1 : 0
    } else if (value && typeof value === 'object') {
      // Handle nested { value: ... } format from CEE
      const nested = (value as Record<string, unknown>).value
      if (typeof nested === 'number') {
        interventions[key] = nested
      } else if (typeof nested === 'boolean') {
        interventions[key] = nested ? 1 : 0
      }
    }
  }

  return interventions
}

// =============================================================================
// Conformal Response Parsing
// =============================================================================

/**
 * Check if ISL response contains conformal prediction data
 */
function hasConformalResults(response: ISLTestResponse | null): boolean {
  if (!response) return false
  const rawResponse = response.raw_response as ConformalRawResponse | undefined
  return !!(rawResponse?.prediction_interval?.point_estimate)
}

/**
 * Check if ISL response contains options data (legacy/alternative endpoints)
 */
function hasOptionsResults(response: ISLTestResponse | null): boolean {
  if (!response) return false
  const options = response.summary?.options
  return Array.isArray(options) && options.length > 0
}

/**
 * Check if ISL response has any valid results
 */
function hasAnyResults(response: ISLTestResponse | null): boolean {
  return hasConformalResults(response) || hasOptionsResults(response)
}

/**
 * Extract conformal prediction results from ISL response
 */
function extractConformalResults(response: ISLTestResponse | null): ConformalResult[] {
  if (!response) return []

  const rawResponse = response.raw_response as ConformalRawResponse | undefined
  const interval = rawResponse?.prediction_interval
  if (!interval?.point_estimate) return []

  const variables = Object.keys(interval.point_estimate)

  return variables.map(variable => ({
    variable,
    lowerBound: interval.lower_bound?.[variable] ?? 0,
    pointEstimate: interval.point_estimate?.[variable] ?? 0,
    upperBound: interval.upper_bound?.[variable] ?? 0,
    intervalWidth: interval.interval_width?.[variable] ??
      (interval.upper_bound?.[variable] ?? 0) - (interval.lower_bound?.[variable] ?? 0),
  }))
}

/**
 * Extract coverage guarantee from conformal response
 */
function extractCoverageGuarantee(response: ISLTestResponse | null): { nominal: number; guaranteed: number } | null {
  if (!response) return null

  const rawResponse = response.raw_response as ConformalRawResponse | undefined
  const coverage = rawResponse?.coverage_guarantee
  if (!coverage) return null

  return {
    nominal: coverage.nominal_coverage ?? 0,
    guaranteed: coverage.guaranteed_coverage ?? 0,
  }
}

// =============================================================================
// Collapsible Section Component
// =============================================================================

interface CollapsibleSectionProps {
  title: string
  stepNumber: number
  defaultOpen?: boolean
  forceOpen?: boolean  // External control to force section open
  id?: string  // For scrolling
  children: React.ReactNode
  badge?: React.ReactNode
}

function CollapsibleSection({ title, stepNumber, defaultOpen = true, forceOpen, id, children, badge }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  // Respond to external forceOpen changes
  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true)
    }
  }, [forceOpen])

  return (
    <div id={id} style={{
      border: '1px solid #e2e8f0',
      borderRadius: 8,
      marginBottom: 12,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '10px 12px',
          background: '#f8fafc',
          border: 'none',
          borderBottom: isOpen ? '1px solid #e2e8f0' : 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          textAlign: 'left',
        }}
      >
        <span style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#3b82f6',
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {stepNumber}
        </span>
        <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: '#334155' }}>
          {title}
        </span>
        {badge}
        <span style={{ fontSize: 10, color: '#94a3b8' }}>
          {isOpen ? '▼' : '▶'}
        </span>
      </button>
      {isOpen && (
        <div style={{ padding: 12 }}>
          {children}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Confirmation Modal Component
// =============================================================================

interface ConfirmationModalProps {
  title: string
  message: string
  onCancel: () => void
  onSaveFirst?: () => void
  onConfirm: () => void
}

function ConfirmationModal({ title, message, onCancel, onSaveFirst, onConfirm }: ConfirmationModalProps) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 8,
        padding: 20,
        maxWidth: 400,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: '#334155' }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 12px',
              fontSize: 11,
              border: '1px solid #e2e8f0',
              borderRadius: 4,
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          {onSaveFirst && (
            <button
              onClick={onSaveFirst}
              style={{
                padding: '6px 12px',
                fontSize: 11,
                border: '1px solid #93c5fd',
                borderRadius: 4,
                background: '#dbeafe',
                cursor: 'pointer',
                color: '#1d4ed8',
              }}
            >
              Save Current First
            </button>
          )}
          <button
            onClick={onConfirm}
            style={{
              padding: '6px 12px',
              fontSize: 11,
              border: 'none',
              borderRadius: 4,
              background: '#ef4444',
              cursor: 'pointer',
              color: '#fff',
            }}
          >
            Replace
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// Empty Results State Component
// =============================================================================

interface EmptyResultsStateProps {
  nSamplesUsed?: number
  durationMs?: number
}

function EmptyResultsState({ nSamplesUsed, durationMs }: EmptyResultsStateProps) {
  return (
    <div
      style={{
        padding: '16px',
        background: '#fef3c7',
        border: '1px solid #fde68a',
        borderRadius: 6,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 14 }}>⚠</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#92400e' }}>
          No simulation results returned
        </span>
      </div>
      <div style={{ fontSize: 10, color: '#a16207', lineHeight: 1.5 }}>
        ISL processed the request but returned no option results.
        {durationMs !== undefined && (
          <span> (Duration: {(durationMs / 1000).toFixed(1)}s)</span>
        )}
        {nSamplesUsed !== undefined && (
          <span> (Samples used: {nSamplesUsed})</span>
        )}
        <br /><br />
        This may occur when:
        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
          <li>The model structure doesn&apos;t support simulation</li>
          <li>Intervention targets non-existent variables</li>
          <li>Monte Carlo sampling produced no valid outcomes</li>
        </ul>
        <br />
        Check the Raw ISL Response below for details.
      </div>
    </div>
  )
}

// =============================================================================
// Conformal Results Table Component
// =============================================================================

interface ConformalResultsTableProps {
  response: ISLTestResponse
  runNumber: number
  label?: string
}

function ConformalResultsTable({ response, runNumber, label }: ConformalResultsTableProps) {
  const conformalResults = extractConformalResults(response)
  const coverage = extractCoverageGuarantee(response)
  const durationMs = response.summary?.duration_ms ?? 0

  const handleCopyTable = useCallback(() => {
    if (conformalResults.length === 0) return
    const header = 'Variable\tLower\tPoint Est\tUpper\tWidth'
    const rows = conformalResults.map(
      (r) => `${r.variable}\t${r.lowerBound.toFixed(2)}\t${r.pointEstimate.toFixed(2)}\t${r.upperBound.toFixed(2)}\t${r.intervalWidth.toFixed(2)}`
    )
    navigator.clipboard.writeText([header, ...rows].join('\n'))
  }, [conformalResults])

  const handleDownloadJSON = useCallback(() => {
    const json = JSON.stringify(response.raw_response, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `isl-conformal-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [response])

  // Handle empty conformal results
  if (conformalResults.length === 0) {
    return (
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>
            {label ? `${label} - ` : ''}Run #{runNumber} ({(durationMs / 1000).toFixed(1)}s)
          </span>
          <button
            onClick={handleDownloadJSON}
            style={{
              padding: '2px 6px',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              fontSize: 9,
              cursor: 'pointer',
            }}
            title="Download JSON"
          >
            📥 JSON
          </button>
        </div>
        <EmptyResultsState
          nSamplesUsed={response.summary?.n_samples_used}
          durationMs={durationMs}
        />
      </div>
    )
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>
          {label ? `${label} - ` : ''}Run #{runNumber} ({(durationMs / 1000).toFixed(1)}s)
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={handleDownloadJSON}
            style={{
              padding: '2px 6px',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              fontSize: 9,
              cursor: 'pointer',
            }}
            title="Download JSON"
          >
            📥 JSON
          </button>
          <button
            onClick={handleCopyTable}
            style={{
              padding: '2px 6px',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              fontSize: 9,
              cursor: 'pointer',
            }}
            title="Copy table"
          >
            📋 Copy
          </button>
        </div>
      </div>

      {/* Conformal results header */}
      <div
        style={{
          padding: '6px 10px',
          background: '#dbeafe',
          border: '1px solid #93c5fd',
          borderRadius: '6px 6px 0 0',
          fontSize: 10,
          fontWeight: 600,
          color: '#1d4ed8',
        }}
      >
        Conformal Prediction Intervals
      </div>

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 10,
          fontFamily: 'monospace',
          border: '1px solid #e2e8f0',
          borderTop: 'none',
        }}
      >
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
              Variable
            </th>
            <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
              Lower
            </th>
            <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontWeight: 700 }}>
              Point Est
            </th>
            <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
              Upper
            </th>
            <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
              Width
            </th>
          </tr>
        </thead>
        <tbody>
          {conformalResults.map((result) => (
            <tr key={result.variable}>
              <td style={{ padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>
                {result.variable}
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                {result.lowerBound.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>
                {result.pointEstimate.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                {result.upperBound.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#94a3b8' }}>
                {result.intervalWidth.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Coverage guarantee */}
      {coverage && (
        <div
          style={{
            padding: '6px 10px',
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderTop: 'none',
            borderRadius: '0 0 6px 6px',
            fontSize: 10,
            color: '#166534',
          }}
        >
          Coverage: {(coverage.nominal * 100).toFixed(0)}% nominal
          {coverage.guaranteed !== coverage.nominal && (
            <span> (guaranteed: {(coverage.guaranteed * 100).toFixed(0)}%)</span>
          )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Results Table (Options-based)
// =============================================================================

interface ResultsTableProps {
  summary: ISLTestSummary
  runNumber: number
  compareWith?: ISLTestSummary
}

function ResultsTable({ summary, runNumber, compareWith }: ResultsTableProps) {
  const hasOptions = summary.options && summary.options.length > 0
  const compareHasOptions = compareWith?.options && compareWith.options.length > 0

  const handleCopyTable = useCallback(() => {
    if (!hasOptions) return
    const header = 'Option\tp10\tp50\tp90\tWinner %'
    const rows = summary.options.map(
      (o) => `${o.label}\t${(o.p10 * 100).toFixed(1)}%\t${(o.p50 * 100).toFixed(1)}%\t${(o.p90 * 100).toFixed(1)}%\t${(o.winner_pct * 100).toFixed(0)}%`
    )
    navigator.clipboard.writeText([header, ...rows].join('\n'))
  }, [summary, hasOptions])

  const handleDownloadCSV = useCallback(() => {
    if (!hasOptions) return
    const header = 'Option,p10,p50,p90,Winner %'
    const rows = summary.options.map(
      (o) => `"${o.label}",${o.p10},${o.p50},${o.p90},${o.winner_pct}`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `isl-results-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [summary, hasOptions])

  const handleDownloadJSON = useCallback(() => {
    const json = JSON.stringify(summary, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `isl-results-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [summary])

  // Handle empty results
  if (!hasOptions) {
    return (
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>
            Run #{runNumber} ({(summary.duration_ms / 1000).toFixed(1)}s)
          </span>
          <button
            onClick={handleDownloadJSON}
            style={{
              padding: '2px 6px',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              fontSize: 9,
              cursor: 'pointer',
            }}
            title="Download JSON"
          >
            📥 JSON
          </button>
        </div>
        <EmptyResultsState
          nSamplesUsed={summary.n_samples_used}
          durationMs={summary.duration_ms}
        />
      </div>
    )
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>
          Run #{runNumber} ({(summary.duration_ms / 1000).toFixed(1)}s)
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={handleDownloadCSV}
            style={{
              padding: '2px 6px',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              fontSize: 9,
              cursor: 'pointer',
            }}
            title="Download CSV"
          >
            📥 CSV
          </button>
          <button
            onClick={handleDownloadJSON}
            style={{
              padding: '2px 6px',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              fontSize: 9,
              cursor: 'pointer',
            }}
            title="Download JSON"
          >
            📥 JSON
          </button>
          <button
            onClick={handleCopyTable}
            style={{
              padding: '2px 6px',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: 3,
              fontSize: 9,
              cursor: 'pointer',
            }}
            title="Copy table"
          >
            📋 Copy
          </button>
        </div>
      </div>

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 10,
          fontFamily: 'monospace',
        }}
      >
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
              Option
            </th>
            <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
              p10
            </th>
            <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
              p50
            </th>
            <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
              p90
            </th>
            <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
              Winner %
            </th>
            {compareWith && (
              <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
                Δ p50
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {summary.options.map((opt) => {
            const compareOpt = compareWith?.options.find((o) => o.id === opt.id)
            const delta = compareOpt ? opt.p50 - compareOpt.p50 : undefined
            const isSignificant = delta !== undefined && Math.abs(delta) > 0.05

            return (
              <tr key={opt.id}>
                <td style={{ padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>
                  {opt.label}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
                  {(opt.p10 * 100).toFixed(1)}%
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontWeight: 600 }}>
                  {(opt.p50 * 100).toFixed(1)}%
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
                  {(opt.p90 * 100).toFixed(1)}%
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
                  {(opt.winner_pct * 100).toFixed(0)}%
                </td>
                {compareWith && (
                  <td
                    style={{
                      padding: '6px 8px',
                      textAlign: 'right',
                      borderBottom: '1px solid #e2e8f0',
                      color: isSignificant ? (delta! > 0 ? '#22c55e' : '#ef4444') : '#64748b',
                      fontWeight: isSignificant ? 600 : 400,
                    }}
                  >
                    {delta !== undefined ? `${delta > 0 ? '+' : ''}${(delta * 100).toFixed(1)}%` : '—'}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// =============================================================================
// Raw ISL Response Viewer
// =============================================================================

interface RawResponseViewerProps {
  response: unknown
  label?: string
}

function RawResponseViewer({ response, label = 'Raw ISL Response' }: RawResponseViewerProps) {
  const [copied, setCopied] = useState(false)

  const responseJson = useMemo(() => {
    if (!response) return ''
    return JSON.stringify(response, null, 2)
  }, [response])

  const handleCopy = useCallback(() => {
    if (!responseJson) return
    navigator.clipboard.writeText(responseJson).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [responseJson])

  if (!response) return null

  return (
    <div style={{ marginTop: 12, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
      <details>
        <summary style={{
          padding: '8px 12px',
          background: '#f8fafc',
          cursor: 'pointer',
          fontSize: 10,
          fontWeight: 600,
          color: '#334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{label}</span>
          <button
            onClick={(e) => {
              e.preventDefault()
              handleCopy()
            }}
            style={{
              padding: '2px 6px',
              background: copied ? '#dcfce7' : '#fff',
              border: '1px solid',
              borderColor: copied ? '#86efac' : '#e2e8f0',
              borderRadius: 3,
              fontSize: 9,
              cursor: 'pointer',
            }}
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
        </summary>
        <pre style={{
          margin: 0,
          padding: 12,
          background: '#fff',
          fontSize: 9,
          fontFamily: 'monospace',
          maxHeight: 300,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>{responseJson}</pre>
      </details>
    </div>
  )
}

// =============================================================================
// JSON Diff Viewer for Compare Mode
// =============================================================================

interface JsonDiffViewerProps {
  left: unknown
  right: unknown
  leftLabel?: string
  rightLabel?: string
}

function computeJsonDiff(left: unknown, right: unknown, path = ''): Array<{ path: string; type: 'added' | 'removed' | 'changed'; leftVal?: string; rightVal?: string }> {
  const diffs: Array<{ path: string; type: 'added' | 'removed' | 'changed'; leftVal?: string; rightVal?: string }> = []

  if (typeof left !== typeof right) {
    diffs.push({ path: path || 'root', type: 'changed', leftVal: JSON.stringify(left), rightVal: JSON.stringify(right) })
    return diffs
  }

  if (typeof left !== 'object' || left === null || right === null) {
    if (left !== right) {
      diffs.push({ path: path || 'root', type: 'changed', leftVal: JSON.stringify(left), rightVal: JSON.stringify(right) })
    }
    return diffs
  }

  const leftObj = left as Record<string, unknown>
  const rightObj = right as Record<string, unknown>
  const allKeys = new Set([...Object.keys(leftObj), ...Object.keys(rightObj)])

  for (const key of allKeys) {
    const newPath = path ? `${path}.${key}` : key
    if (!(key in leftObj)) {
      diffs.push({ path: newPath, type: 'added', rightVal: JSON.stringify(rightObj[key]) })
    } else if (!(key in rightObj)) {
      diffs.push({ path: newPath, type: 'removed', leftVal: JSON.stringify(leftObj[key]) })
    } else {
      diffs.push(...computeJsonDiff(leftObj[key], rightObj[key], newPath))
    }
  }

  return diffs
}

function JsonDiffViewer({ left, right, leftLabel = 'Payload A', rightLabel = 'Payload B' }: JsonDiffViewerProps) {
  const diffs = useMemo(() => computeJsonDiff(left, right), [left, right])
  const leftJson = useMemo(() => JSON.stringify(left, null, 2), [left])
  const rightJson = useMemo(() => JSON.stringify(right, null, 2), [right])

  const numericDeltas = useMemo(() => {
    const deltas: Array<{ path: string; delta: number; percent?: number }> = []
    for (const diff of diffs) {
      if (diff.type === 'changed') {
        try {
          const leftNum = parseFloat(diff.leftVal ?? '0')
          const rightNum = parseFloat(diff.rightVal ?? '0')
          if (!isNaN(leftNum) && !isNaN(rightNum)) {
            const delta = rightNum - leftNum
            const percent = leftNum !== 0 ? ((rightNum - leftNum) / leftNum) * 100 : undefined
            deltas.push({ path: diff.path, delta, percent })
          }
        } catch {
          // Non-numeric values
        }
      }
    }
    return deltas
  }, [diffs])

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', marginTop: 12 }}>
      {numericDeltas.length > 0 && (
        <div style={{ padding: '8px 12px', background: '#fef3c7', borderBottom: '1px solid #fde68a' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>
            Numeric Deltas ({numericDeltas.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {numericDeltas.slice(0, 5).map((d) => (
              <span key={d.path} style={{
                fontSize: 9,
                fontFamily: 'monospace',
                padding: '2px 6px',
                background: '#fff',
                borderRadius: 4,
                color: d.delta > 0 ? '#16a34a' : d.delta < 0 ? '#dc2626' : '#64748b',
              }}>
                {d.path.split('.').pop()}: {d.delta > 0 ? '+' : ''}{d.delta.toFixed(3)}
                {d.percent !== undefined && ` (${d.percent > 0 ? '+' : ''}${d.percent.toFixed(1)}%)`}
              </span>
            ))}
            {numericDeltas.length > 5 && (
              <span style={{ fontSize: 9, color: '#92400e' }}>+{numericDeltas.length - 5} more</span>
            )}
          </div>
        </div>
      )}

      <div style={{ padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: 12, fontSize: 10 }}>
          <span style={{ color: '#16a34a' }}>+{diffs.filter(d => d.type === 'added').length} added</span>
          <span style={{ color: '#dc2626' }}>-{diffs.filter(d => d.type === 'removed').length} removed</span>
          <span style={{ color: '#f59e0b' }}>~{diffs.filter(d => d.type === 'changed').length} changed</span>
        </div>
      </div>

      {/* Task 6: Labeled Compare Mode Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 200 }}>
        <div style={{ borderRight: '1px solid #e2e8f0' }}>
          <div style={{ padding: '4px 8px', background: '#fef2f2', fontSize: 10, fontWeight: 600, color: '#991b1b' }}>
            {leftLabel} (Primary)
          </div>
          <pre style={{
            margin: 0,
            padding: 8,
            fontSize: 9,
            fontFamily: 'monospace',
            maxHeight: 300,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: '#fff',
          }}>{leftJson}</pre>
        </div>
        <div>
          <div style={{ padding: '4px 8px', background: '#f0fdf4', fontSize: 10, fontWeight: 600, color: '#166534' }}>
            {rightLabel} (Compare)
          </div>
          <pre style={{
            margin: 0,
            padding: 8,
            fontSize: 9,
            fontFamily: 'monospace',
            maxHeight: 300,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: '#fff',
          }}>{rightJson}</pre>
        </div>
      </div>

      {diffs.length > 0 && (
        <details style={{ borderTop: '1px solid #e2e8f0' }}>
          <summary style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 10, color: '#3b82f6' }}>
            View Detailed Changes ({diffs.length})
          </summary>
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            {diffs.map((diff, i) => (
              <div key={i} style={{
                padding: '4px 12px',
                fontSize: 9,
                fontFamily: 'monospace',
                borderBottom: '1px solid #f1f5f9',
                background: diff.type === 'added' ? '#f0fdf4' : diff.type === 'removed' ? '#fef2f2' : '#fffbeb',
              }}>
                <span style={{ color: diff.type === 'added' ? '#16a34a' : diff.type === 'removed' ? '#dc2626' : '#f59e0b' }}>
                  {diff.type === 'added' ? '+' : diff.type === 'removed' ? '-' : '~'}
                </span>
                {' '}<span style={{ color: '#475569' }}>{diff.path}</span>
                {diff.leftVal && <span style={{ color: '#dc2626' }}> {diff.leftVal}</span>}
                {diff.type === 'changed' && ' → '}
                {diff.rightVal && <span style={{ color: '#16a34a' }}>{diff.rightVal}</span>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

// =============================================================================
// Reproducibility Bundle Export
// =============================================================================

interface ReproducibilityBundle {
  meta: {
    exportedAt: string
    environment: string
    uiBuild: string
    sessionId: string
  }
  llm?: {
    prompts: unknown[]
    responses: unknown[]
  }
  graphs: {
    canvas: {
      nodes: unknown[]
      edges: unknown[]
    }
    cee?: unknown
  }
  isl: {
    compiledPayload: unknown
    lastResponse?: unknown
  }
  results?: {
    summary?: unknown
    raw?: unknown
  }
}

function createReproducibilityBundle(
  nodes: unknown[],
  edges: unknown[],
  compiledPayload: unknown,
  rawResponse?: unknown,
  ceePipelineTrace?: unknown,
  resultsSummary?: unknown
): ReproducibilityBundle {
  return {
    meta: {
      exportedAt: new Date().toISOString(),
      environment: String(import.meta.env.VITE_APP_ENV || 'development'),
      uiBuild: String(import.meta.env.VITE_BUILD_ID || 'dev'),
      sessionId: `session-${Date.now()}`,
    },
    llm: ceePipelineTrace ? {
      prompts: ((ceePipelineTrace as any)?.llm_calls ?? []).map((c: any) => c?.request),
      responses: ((ceePipelineTrace as any)?.llm_calls ?? []).map((c: any) => c?.response),
    } : undefined,
    graphs: {
      canvas: { nodes, edges },
      cee: (ceePipelineTrace as any)?.final_graph,
    },
    isl: {
      compiledPayload,
      lastResponse: rawResponse,
    },
    results: (resultsSummary || rawResponse) ? { summary: resultsSummary, raw: rawResponse } : undefined,
  }
}

// =============================================================================
// Artefact Chain Navigator
// =============================================================================

interface ArtefactStage {
  id: string
  label: string
  count?: number
  status: 'pending' | 'complete' | 'error' | 'active'
}

interface ArtefactChainNavigatorProps {
  stages: ArtefactStage[]
  onStageClick?: (stageId: string) => void
  activeStage?: string
}

function ArtefactChainNavigator({ stages, onStageClick, activeStage }: ArtefactChainNavigatorProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '8px 12px',
      background: '#f8fafc',
      borderRadius: 8,
      gap: 4,
      overflowX: 'auto',
      marginBottom: 12,
    }}>
      {stages.map((stage, idx) => (
        <div key={stage.id} style={{ display: 'flex', alignItems: 'center' }}>
          <button
            onClick={() => onStageClick?.(stage.id)}
            style={{
              padding: '4px 8px',
              background: stage.status === 'error' ? '#fee2e2'
                : stage.status === 'active' || stage.id === activeStage ? '#dbeafe'
                : stage.status === 'complete' ? '#dcfce7'
                : '#f1f5f9',
              border: '1px solid',
              borderColor: stage.status === 'error' ? '#fca5a5'
                : stage.status === 'active' || stage.id === activeStage ? '#93c5fd'
                : stage.status === 'complete' ? '#86efac'
                : '#e2e8f0',
              borderRadius: 6,
              fontSize: 9,
              fontFamily: 'monospace',
              cursor: onStageClick ? 'pointer' : 'default',
              color: stage.status === 'error' ? '#991b1b'
                : stage.status === 'active' || stage.id === activeStage ? '#1d4ed8'
                : stage.status === 'complete' ? '#166534'
                : '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
            }}
            title={`${stage.label}${stage.count !== undefined ? ` (${stage.count} items)` : ''}`}
          >
            <span>{stage.label}</span>
            {stage.count !== undefined && (
              <span style={{
                background: 'rgba(0,0,0,0.1)',
                padding: '1px 4px',
                borderRadius: 4,
                fontSize: 8,
              }}>{stage.count}</span>
            )}
          </button>
          {idx < stages.length - 1 && (
            <span style={{ margin: '0 4px', color: '#94a3b8', fontSize: 10 }}>→</span>
          )}
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

interface PayloadLabTabProps {
  lastISLPayload?: object
  onRunTest?: (payload: object, seed: string, nSamples: number) => Promise<ISLTestResponse>
  initialPayload?: object
  onPayloadLoaded?: () => void
  onNavigateToTab?: (tabId: string) => void
}

type PromptTesterRunStatus = 'success' | 'failed'

type PromptTesterRun = {
  runNumber: number
  status: PromptTesterRunStatus
  durationMs: number
  counts: Record<string, number>
  optionCount: number
  edgeCount: number
  raw: unknown
}

function extractKindCountsFromDraft(draft: unknown): { counts: Record<string, number>; edgeCount: number } {
  const obj = draft as any
  const nodes: any[] = Array.isArray(obj?.nodes)
    ? obj.nodes
    : Array.isArray(obj?.graph?.nodes)
      ? obj.graph.nodes
      : []
  const edges: any[] = Array.isArray(obj?.edges)
    ? obj.edges
    : Array.isArray(obj?.graph?.edges)
      ? obj.graph.edges
      : []

  const counts: Record<string, number> = {}
  for (const n of nodes) {
    const kind = n?.kind ?? n?.type
    if (typeof kind !== 'string' || kind.trim().length === 0) continue
    counts[kind] = (counts[kind] ?? 0) + 1
  }

  return { counts, edgeCount: edges.length }
}

function computeMissingKinds(counts: Record<string, number>): string[] {
  const missing: string[] = []
  if ((counts.decision ?? 0) < 1) missing.push('decision')
  if ((counts.goal ?? 0) < 1) missing.push('goal')
  if ((counts.option ?? 0) < 2) missing.push('option')
  return missing
}

function toCsvRow(run: PromptTesterRun): string {
  const cols = [
    run.runNumber,
    run.status,
    run.durationMs,
    run.optionCount,
    run.edgeCount,
  ]
  return cols.join(',')
}

function toCsvHeader(): string {
  return 'run,status,duration_ms,option_count,edge_count'
}

/**
 * Build ISL payload from draft result with proper intervention extraction
 */
function buildISLPayloadFromDraft(draft: unknown, nodes: UINode[], edges: UIEdge[]): object | null {
  const obj = draft as any
  const analysisReady = obj?.analysis_ready
  const options = analysisReady?.options ?? []

  // Extract interventions from first option using fixed extraction
  const firstOption = options[0]
  const intervention = extractInterventionsForISL(firstOption)

  // If no interventions from options, fallback to factor values
  if (Object.keys(intervention).length === 0) {
    for (const node of nodes) {
      if ((node.type === 'factor' || node.data?.kind === 'factor') && typeof node.data?.value === 'number') {
        intervention[node.id] = node.data.value
      }
    }
  }

  try {
    return buildISLConformalRequest(nodes, edges, intervention, [])
  } catch {
    return null
  }
}

export function PayloadLabTab({ lastISLPayload, onRunTest, initialPayload, onPayloadLoaded, onNavigateToTab }: PayloadLabTabProps) {
  const payloads = usePayloadTraceStore((s) => s.payloads)
  const cooldownTimeoutRef = useRef<number | null>(null)

  // Canvas state
  const canvasNodes = useCanvasStore((s) => s.nodes)
  const canvasEdges = useCanvasStore((s) => s.edges)
  const ceePipelineTrace = useCanvasStore((s) => s.ceePipelineTrace)
  const ceeAnalysisReady = useCanvasStore((s) => s.ceeAnalysisReady)

  // Auto-compile ISL payload from canvas
  const autoCompiledPayload = useMemo(() => {
    if (canvasNodes.length === 0) return null

    try {
      const uiNodes: UINode[] = canvasNodes.map((n) => ({
        id: n.id,
        type: String(n.type ?? n.data?.kind ?? 'factor'),
        data: {
          label: n.data?.label as string | undefined,
          kind: n.data?.kind as string | undefined,
          value: n.data?.value as number | undefined,
        },
      }))

      const uiEdges: UIEdge[] = canvasEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        data: {
          weight: e.data?.weight,
          direction: e.data?.direction,
          strengthStd: e.data?.strengthStd,
        },
      }))

      // Task 3: Use fixed intervention extraction
      let intervention: Record<string, number> = {}
      if (ceeAnalysisReady?.options?.length) {
        intervention = extractInterventionsForISL(ceeAnalysisReady.options[0])
      }
      if (Object.keys(intervention).length === 0) {
        for (const node of uiNodes) {
          if (node.type === 'factor' && typeof node.data?.value === 'number') {
            intervention[node.id] = node.data.value
          }
        }
      }

      return buildISLConformalRequest(uiNodes, uiEdges, intervention, [])
    } catch {
      return null
    }
  }, [canvasNodes, canvasEdges, ceeAnalysisReady])

  // State
  const [payloadText, setPayloadText] = useState('')
  const [seed, setSeed] = useState('42')
  const [nSamples, setNSamples] = useState(1000)
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<ISLTestSummary | null>(null)
  const [rawResponse, setRawResponse] = useState<unknown>(null)
  const [runCount, setRunCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [resultsExpandTrigger, setResultsExpandTrigger] = useState(0) // Increment to force expand

  // Compare mode
  const [compareMode, setCompareMode] = useState(false)
  const [compareDiffMode, setCompareDiffMode] = useState(false)
  const [comparePayloadText, setComparePayloadText] = useState('')
  const [compareResults, setCompareResults] = useState<ISLTestSummary | null>(null)
  const [compareRawResponse, setCompareRawResponse] = useState<unknown>(null)

  // Artefact Chain Navigator state
  const [activeArtefactStage, setActiveArtefactStage] = useState<string>('isl')

  // History and snapshots
  const [history, setHistory] = useState<PayloadHistoryEntry[]>([])
  const [snapshots, setSnapshots] = useState<PayloadSnapshot[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [snapshotName, setSnapshotName] = useState('')

  // Prompt tester state
  const [promptBrief, setPromptBrief] = useState('')
  const [promptVersion, setPromptVersion] = useState('')
  const [modelName, setModelName] = useState('')
  const [draftBusy, setDraftBusy] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)
  const [draftResult, setDraftResult] = useState<PromptTesterRun | null>(null)
  const [detRuns, setDetRuns] = useState<PromptTesterRun[]>([])
  const [cooldownUntil, setCooldownUntil] = useState<number>(0)
  const [recentRunTimes, setRecentRunTimes] = useState<number[]>([])

  // Task 7: Confirmation modal state
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<object | null>(null)

  // Load history and snapshots on mount
  useEffect(() => {
    setHistory(loadHistory())
    setSnapshots(loadSnapshots())
  }, [])

  // Ref for callback
  const onPayloadLoadedRef = useRef(onPayloadLoaded)
  useEffect(() => {
    onPayloadLoadedRef.current = onPayloadLoaded
  }, [onPayloadLoaded])

  // Initialize payload
  useEffect(() => {
    if (initialPayload && !payloadText) {
      setPayloadText(JSON.stringify(initialPayload, null, 2))
      onPayloadLoadedRef.current?.()
    } else if (lastISLPayload && !payloadText) {
      setPayloadText(JSON.stringify(lastISLPayload, null, 2))
    } else if (autoCompiledPayload && !payloadText) {
      setPayloadText(JSON.stringify(autoCompiledPayload, null, 2))
    }
  }, [lastISLPayload, initialPayload, payloadText, autoCompiledPayload])

  const now = Date.now()
  const inCooldown = cooldownUntil > now
  const cooldownSeconds = inCooldown ? Math.ceil((cooldownUntil - now) / 1000) : 0

  const cleanedRunTimes = useMemo(() => {
    const cutoff = Date.now() - 60_000
    return recentRunTimes.filter((t) => t >= cutoff)
  }, [recentRunTimes])

  const withinRateLimit = cleanedRunTimes.length < 10

  useEffect(() => {
    if (cleanedRunTimes.length !== recentRunTimes.length) {
      setRecentRunTimes(cleanedRunTimes)
    }
  }, [cleanedRunTimes, recentRunTimes.length])

  useEffect(() => {
    return () => {
      if (cooldownTimeoutRef.current !== null) {
        window.clearTimeout(cooldownTimeoutRef.current)
        cooldownTimeoutRef.current = null
      }
    }
  }, [])

  const latestCeeFailureBrief = useMemo(() => {
    const failures = payloads.filter((p) => p.service === 'CEE' && (p.error || (p.status && p.status >= 400)))
    const hit = failures[0]
    const body = hit?.request?.body as any
    const brief = body?.brief
    return typeof brief === 'string' ? brief : null
  }, [payloads])

  const latestCeeSuccessBrief = useMemo(() => {
    const successes = payloads.filter((p) => p.service === 'CEE' && p.status && p.status >= 200 && p.status < 400)
    const hit = successes[0]
    const body = hit?.request?.body as any
    const brief = body?.brief
    return typeof brief === 'string' ? brief : null
  }, [payloads])

  const applyDraftToCanvas = useCallback((draft: unknown) => {
    const obj = draft as any
    const rawNodes: any[] = Array.isArray(obj?.nodes)
      ? obj.nodes
      : Array.isArray(obj?.graph?.nodes)
        ? obj.graph.nodes
        : []
    const rawEdges: any[] = Array.isArray(obj?.edges)
      ? obj.edges
      : Array.isArray(obj?.graph?.edges)
        ? obj.graph.edges
        : []

    if (rawNodes.length === 0) return

    const nodes = rawNodes.map((n: any) => ({
      id: String(n.id),
      type: n.kind || n.type,
      position: { x: 0, y: 0 },
      data: {
        label: n.label,
        kind: n.kind || n.type,
        uncertainty: n.uncertainty,
        description: n.description,
        ...(n.observed_state ? { observedState: n.observed_state } : {}),
      },
    }))

    const edges: Array<Edge<EdgeData>> = rawEdges.map((e: any, i: number) => {
      const id = typeof e.id === 'string' && e.id.trim().length > 0 ? e.id : `e-${Date.now()}-${i}`
      const direction = e.effect_direction
      const strengthStd = typeof e.strength?.std === 'number' ? e.strength.std : typeof e.strength_std === 'number' ? e.strength_std : undefined
      const rawWeight =
        typeof e.strength?.mean === 'number'
          ? e.strength.mean
          : typeof e.strength_mean === 'number'
            ? e.strength_mean
            : typeof e.weight === 'number'
              ? e.weight
              : DEFAULT_EDGE_DATA.weight
      const weight = Math.max(0, Math.min(2, Math.abs(rawWeight)))
      const confidence = typeof e.belief === 'number' ? Math.max(0, Math.min(1, e.belief)) : undefined

      return {
        id,
        source: String(e.from),
        target: String(e.to),
        type: 'styled',
        data: {
          ...DEFAULT_EDGE_DATA,
          weight,
          pathType: 'bezier',
          confidence,
          beliefExists: confidence,
          ...(direction ? { direction } : {}),
          ...(strengthStd !== undefined ? { strengthStd } : {}),
        } satisfies EdgeData,
      }
    })

    const state = useCanvasStore.getState()
    useCanvasStore.setState({
      nodes: [...state.nodes, ...nodes],
      edges: [...state.edges, ...edges],
      pendingFitView: true,
    })

    try {
      state.applyLayout()
    } catch {
      // ignore
    }
  }, [])

  const runDraftOnce = useCallback(async (runNumber: number): Promise<PromptTesterRun> => {
    const start = Date.now()
    const client = new CEEClient()
    const raw = await client.draftModel(promptBrief)
    const durationMs = Date.now() - start
    const { counts, edgeCount } = extractKindCountsFromDraft(raw)
    const optionCount = counts.option ?? 0
    const missing = computeMissingKinds(counts)
    const status: PromptTesterRunStatus = missing.length === 0 ? 'success' : 'failed'
    return {
      runNumber,
      status,
      durationMs,
      counts,
      optionCount,
      edgeCount,
      raw,
    }
  }, [promptBrief])

  const enforceRateLimit = useCallback((): string | null => {
    const current = Date.now()
    if (cooldownUntil > current) {
      return `Cooldown active (${Math.ceil((cooldownUntil - current) / 1000)}s).`
    }
    const cutoff = current - 60_000
    const kept = recentRunTimes.filter((t) => t >= cutoff)
    if (kept.length >= 10) {
      return 'Rate limit exceeded (max 10 runs per minute).'
    }
    return null
  }, [cooldownUntil, recentRunTimes])

  const startCooldown = useCallback(() => {
    const now = Date.now()
    setCooldownUntil(now + 5_000)

    if (cooldownTimeoutRef.current !== null) {
      window.clearTimeout(cooldownTimeoutRef.current)
    }
    cooldownTimeoutRef.current = window.setTimeout(() => {
      setCooldownUntil(0)
      cooldownTimeoutRef.current = null
    }, 5_000)
  }, [])

  const recordRun = useCallback(() => {
    setRecentRunTimes((prev) => [Date.now(), ...prev].slice(0, 50))
  }, [])

  const handleRunDraft = useCallback(async () => {
    if (!promptBrief.trim()) {
      setDraftError('Brief is required')
      return
    }

    const limitError = enforceRateLimit()
    if (limitError) {
      setDraftError(limitError)
      return
    }

    setDraftBusy(true)
    setDraftError(null)
    setDraftResult(null)
    setDetRuns([])

    try {
      recordRun()
      startCooldown()
      const run = await runDraftOnce(1)
      setDraftResult(run)
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : 'Draft failed')
    } finally {
      setDraftBusy(false)
    }
  }, [enforceRateLimit, promptBrief, recordRun, runDraftOnce, startCooldown])

  const handleDeterminismTest = useCallback(async () => {
    if (!promptBrief.trim()) {
      setDraftError('Brief is required')
      return
    }

    const limitError = enforceRateLimit()
    if (limitError) {
      setDraftError(limitError)
      return
    }

    setDraftBusy(true)
    setDraftError(null)
    setDraftResult(null)
    setDetRuns([])

    const runSequence = async (index: number, acc: PromptTesterRun[]): Promise<void> => {
      if (index >= 5) return
      const perRunLimit = enforceRateLimit()
      if (perRunLimit) throw new Error(perRunLimit)
      recordRun()
      startCooldown()
      const run = await runDraftOnce(index + 1)
      const next = [...acc, run]
      setDetRuns(next)
      await new Promise((r) => setTimeout(r, 5_000))
      return runSequence(index + 1, next)
    }

    try {
      await runSequence(0, [])
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : 'Determinism test failed')
    } finally {
      setDraftBusy(false)
    }
  }, [enforceRateLimit, promptBrief, recordRun, runDraftOnce, startCooldown])

  const handleExportDetCsv = useCallback(() => {
    const csv = [toCsvHeader(), ...detRuns.map((r) => toCsvRow(r))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prompt-determinism-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [detRuns])

  const determinismSummary = useMemo(() => {
    if (detRuns.length === 0) return null
    const total = detRuns.length
    const successCount = detRuns.filter((r) => r.status === 'success').length
    const avgDurationAll = Math.round(detRuns.reduce((sum, r) => sum + r.durationMs, 0) / total)
    const successes = detRuns.filter((r) => r.status === 'success')
    const failures = detRuns.filter((r) => r.status === 'failed')
    const avgSuccess = successes.length > 0 ? Math.round(successes.reduce((sum, r) => sum + r.durationMs, 0) / successes.length) : null
    const avgFail = failures.length > 0 ? Math.round(failures.reduce((sum, r) => sum + r.durationMs, 0) / failures.length) : null
    const optionRate = Math.round((successes.filter((r) => r.optionCount >= 2).length / total) * 100)
    const slowFails = failures.some((r) => r.durationMs > 50_000)
    return {
      total,
      successCount,
      avgDurationAll,
      avgSuccess,
      avgFail,
      optionRate,
      slowFails,
    }
  }, [detRuns])

  // Task 4: Send to ISL handler
  const handleSendToISL = useCallback(() => {
    if (!draftResult?.raw) return

    // Build UINode and UIEdge arrays from draft
    const obj = draftResult.raw as any
    const rawNodes: any[] = Array.isArray(obj?.nodes)
      ? obj.nodes
      : Array.isArray(obj?.graph?.nodes)
        ? obj.graph.nodes
        : []
    const rawEdges: any[] = Array.isArray(obj?.edges)
      ? obj.edges
      : Array.isArray(obj?.graph?.edges)
        ? obj.graph.edges
        : []

    const uiNodes: UINode[] = rawNodes.map((n: any) => ({
      id: String(n.id),
      type: n.kind || n.type || 'factor',
      data: {
        label: n.label,
        kind: n.kind || n.type,
        value: n.value,
      },
    }))

    const uiEdges: UIEdge[] = rawEdges.map((e: any, i: number) => ({
      id: typeof e.id === 'string' ? e.id : `e-${i}`,
      source: String(e.from),
      target: String(e.to),
      data: {
        weight: e.strength?.mean ?? e.strength_mean ?? e.weight ?? 0.5,
        direction: e.effect_direction,
      },
    }))

    const islPayload = buildISLPayloadFromDraft(draftResult.raw, uiNodes, uiEdges)
    if (!islPayload) {
      setDraftError('Failed to build ISL payload from draft')
      return
    }

    // Task 7: Check if editor has content and show confirmation
    if (payloadText.trim()) {
      setPendingPayload(islPayload)
      setShowReplaceConfirm(true)
    } else {
      setPayloadText(JSON.stringify(islPayload, null, 2))
    }
  }, [draftResult, payloadText])

  // Task 7: Confirm replace handler
  const handleConfirmReplace = useCallback(() => {
    if (pendingPayload) {
      setPayloadText(JSON.stringify(pendingPayload, null, 2))
    }
    setShowReplaceConfirm(false)
    setPendingPayload(null)
  }, [pendingPayload])

  // Task 7: Save current first handler
  const handleSaveCurrentFirst = useCallback(() => {
    setShowSaveDialog(true)
    setShowReplaceConfirm(false)
  }, [])

  // Validation - uses full ISL validation (JSON syntax + ISL constraints)
  const validation = useMemo(() => validatePayload(payloadText), [payloadText])
  const compareValidation = useMemo(
    () => (compareMode ? validatePayload(comparePayloadText) : { valid: true }),
    [compareMode, comparePayloadText]
  )

  // Handlers
  const handleRun = useCallback(async () => {
    if (!validation.valid || !validation.parsed) return
    if (!onRunTest) {
      setError('Test runner not configured')
      return
    }

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[PayloadLab] Compare mode:', compareMode)
      if (compareMode) {
        // eslint-disable-next-line no-console
        console.log('[PayloadLab] Run Both - starting parallel calls')
      }
    }

    setIsRunning(true)
    setError(null)

    try {
      const response = await onRunTest(validation.parsed, seed, nSamples)
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('[PayloadLab] Payload A result:', {
          optionsCount: response.summary?.options?.length ?? 0,
          nSamplesUsed: response.summary?.n_samples_used,
          durationMs: response.summary?.duration_ms,
        })
      }
      setResults(response.summary)
      setRawResponse(response)
      setRunCount((c) => c + 1)

      // Add to history
      const entry: PayloadHistoryEntry = {
        id: `hist-${Date.now()}`,
        timestamp: new Date(),
        payload: validation.parsed,
        seed,
        n_samples: nSamples,
        results: response.summary,
        duration_ms: response.summary.duration_ms,
      }
      const newHistory = [entry, ...history].slice(0, MAX_HISTORY)
      setHistory(newHistory)
      saveHistory(newHistory)

      // Run compare if in compare mode
      if (compareMode && compareValidation.valid && compareValidation.parsed) {
        const compareResponse = await onRunTest(compareValidation.parsed, seed, nSamples)
        setCompareResults(compareResponse.summary)
        setCompareRawResponse(compareResponse)

        if (import.meta.env.DEV) {
          // Log comparison summary with conformal detection
          const hasResultsA = hasAnyResults(response)
          const hasResultsB = hasAnyResults(compareResponse)
          // eslint-disable-next-line no-console
          console.log('[PayloadLab] Results comparison:', {
            hasResultsA,
            hasResultsB,
            conformalA: extractConformalResults(response).length,
            conformalB: extractConformalResults(compareResponse).length,
            optionsA: response.summary?.options?.length ?? 0,
            optionsB: compareResponse.summary?.options?.length ?? 0,
          })
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Test failed')
    } finally {
      setIsRunning(false)
      // Task 3: Auto-expand Results section and scroll into view
      setResultsExpandTrigger((t) => t + 1)
      setTimeout(() => {
        document.getElementById('payload-lab-results')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 100)
    }
  }, [validation, compareValidation, compareMode, seed, nSamples, history, onRunTest])

  const handleSaveSnapshot = useCallback(() => {
    if (!validation.valid || !validation.parsed || !snapshotName.trim()) return

    const snapshot: PayloadSnapshot = {
      id: `snap-${Date.now()}`,
      name: snapshotName.trim(),
      payload: validation.parsed,
      created_at: new Date(),
    }
    const newSnapshots = [snapshot, ...snapshots]
    setSnapshots(newSnapshots)
    saveSnapshots(newSnapshots)
    setShowSaveDialog(false)
    setSnapshotName('')

    // If we were saving before replacing, now do the replace
    if (pendingPayload) {
      setPayloadText(JSON.stringify(pendingPayload, null, 2))
      setPendingPayload(null)
    }
  }, [validation, snapshotName, snapshots, pendingPayload])

  const handleLoadSnapshot = useCallback((snapshot: PayloadSnapshot) => {
    setPayloadText(JSON.stringify(snapshot.payload, null, 2))
  }, [])

  const handleLoadHistory = useCallback((entry: PayloadHistoryEntry) => {
    setPayloadText(JSON.stringify(entry.payload, null, 2))
    setSeed(entry.seed)
    setNSamples(entry.n_samples)
  }, [])

  const handleReset = useCallback(() => {
    // Clear primary payload
    if (lastISLPayload) {
      setPayloadText(JSON.stringify(lastISLPayload, null, 2))
    } else {
      setPayloadText('')
    }

    // Clear compare mode state
    setCompareMode(false)
    setComparePayloadText('')
    setCompareDiffMode(false)

    // Clear all results
    setResults(null)
    setCompareResults(null)
    setRawResponse(null)
    setCompareRawResponse(null)
    setError(null)

    // Reset expand trigger
    setResultsExpandTrigger(0)
  }, [lastISLPayload])

  // Task 5: Handle keyboard events for select all
  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow select all (Ctrl+A / Cmd+A)
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      // Let the default behavior happen - don't prevent it
      return
    }
  }, [])

  return (
    <div style={{ padding: '12px' }}>
      {/* Task 7: Confirmation Modal */}
      {showReplaceConfirm && (
        <ConfirmationModal
          title="Replace ISL Payload?"
          message="The ISL editor contains unsaved changes. Replace with draft result?"
          onCancel={() => {
            setShowReplaceConfirm(false)
            setPendingPayload(null)
          }}
          onSaveFirst={handleSaveCurrentFirst}
          onConfirm={handleConfirmReplace}
        />
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
          padding: '8px 12px',
          background: '#fef3c7',
          border: '1px solid #fde68a',
          borderRadius: 6,
        }}
      >
        <span style={{ fontSize: 14 }}>🧪</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#92400e' }}>
          Payload Lab
        </span>
        <span style={{ fontSize: 10, color: '#a16207' }}>
          Test ISL payloads directly. Results are not persisted to server.
        </span>
      </div>

      {/* Task 2: Step 1 - Generate Draft */}
      <CollapsibleSection
        stepNumber={1}
        title="GENERATE DRAFT"
        badge={draftResult && (
          <span style={{
            padding: '2px 8px',
            borderRadius: 999,
            background: draftResult.status === 'success' ? '#dcfce7' : '#fee2e2',
            fontSize: 9,
            fontWeight: 600,
            color: draftResult.status === 'success' ? '#166534' : '#991b1b',
          }}>
            {draftResult.status.toUpperCase()}
          </span>
        )}
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button
            onClick={() => latestCeeFailureBrief && setPromptBrief(latestCeeFailureBrief)}
            disabled={!latestCeeFailureBrief}
            style={{
              padding: '4px 8px',
              fontSize: 10,
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              background: latestCeeFailureBrief ? '#fff' : '#f1f5f9',
              cursor: latestCeeFailureBrief ? 'pointer' : 'not-allowed',
              color: '#334155',
            }}
          >
            Load from last failure
          </button>
          <button
            onClick={() => latestCeeSuccessBrief && setPromptBrief(latestCeeSuccessBrief)}
            disabled={!latestCeeSuccessBrief}
            style={{
              padding: '4px 8px',
              fontSize: 10,
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              background: latestCeeSuccessBrief ? '#fff' : '#f1f5f9',
              cursor: latestCeeSuccessBrief ? 'pointer' : 'not-allowed',
              color: '#334155',
            }}
          >
            Load from last success
          </button>
        </div>

        <textarea
          value={promptBrief}
          onChange={(e) => setPromptBrief(e.target.value)}
          placeholder="Brief input..."
          style={{
            width: '100%',
            height: 100,
            padding: 10,
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            fontSize: 11,
            fontFamily: 'monospace',
            resize: 'vertical',
            marginBottom: 10,
          }}
        />

        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: '#64748b' }}>prompt_version</span>
            <input
              value={promptVersion}
              onChange={(e) => setPromptVersion(e.target.value)}
              placeholder="(optional)"
              style={{
                width: 120,
                padding: '4px 8px',
                fontSize: 10,
                border: '1px solid #e2e8f0',
                borderRadius: 6,
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: '#64748b' }}>model</span>
            <input
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="(optional)"
              style={{
                width: 120,
                padding: '4px 8px',
                fontSize: 10,
                border: '1px solid #e2e8f0',
                borderRadius: 6,
              }}
            />
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>
            {inCooldown ? `Cooldown: ${cooldownSeconds}s` : withinRateLimit ? `Remaining: ${10 - cleanedRunTimes.length}/min` : 'Rate limit hit'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button
            onClick={handleRunDraft}
            disabled={draftBusy || inCooldown || !withinRateLimit}
            style={{
              padding: '6px 10px',
              fontSize: 10,
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              background: '#fff',
              cursor: draftBusy || inCooldown || !withinRateLimit ? 'not-allowed' : 'pointer',
              color: '#334155',
            }}
          >
            {draftBusy ? 'Running...' : 'Run Draft'}
          </button>
          <button
            onClick={handleDeterminismTest}
            disabled={draftBusy || inCooldown || !withinRateLimit}
            style={{
              padding: '6px 10px',
              fontSize: 10,
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              background: '#fff',
              cursor: draftBusy || inCooldown || !withinRateLimit ? 'not-allowed' : 'pointer',
              color: '#334155',
            }}
          >
            Determinism Test (5x)
          </button>
        </div>

        {draftError && (
          <div style={{ padding: '8px 10px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 11, color: '#991b1b', marginBottom: 10 }}>
            {draftError}
          </div>
        )}

        {/* Draft Result Card */}
        {draftResult && (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, background: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: draftResult.status === 'success' ? '#dcfce7' : '#fee2e2',
                  border: `1px solid ${draftResult.status === 'success' ? '#86efac' : '#fca5a5'}`,
                  fontSize: 10,
                  fontWeight: 700,
                  color: draftResult.status === 'success' ? '#166534' : '#991b1b',
                  fontFamily: 'monospace',
                }}>{draftResult.status.toUpperCase()}</span>
                <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>{draftResult.durationMs}ms</span>
              </div>
            </div>

            {/* Node counts */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {Object.entries(draftResult.counts).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => (
                <span key={k} style={{
                  padding: '2px 8px',
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 4,
                  fontSize: 10,
                  fontFamily: 'monospace',
                }}>
                  {k}:{v}
                </span>
              ))}
              <span style={{
                padding: '2px 8px',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 4,
                fontSize: 10,
                fontFamily: 'monospace',
              }}>
                edges:{draftResult.edgeCount}
              </span>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  const json = JSON.stringify(draftResult.raw, null, 2)
                  navigator.clipboard.writeText(json).catch(() => {})
                }}
                style={{ padding: '4px 8px', fontSize: 10, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
              >
                Copy JSON
              </button>
              <button
                onClick={() => applyDraftToCanvas(draftResult.raw)}
                style={{ padding: '4px 8px', fontSize: 10, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
              >
                Apply to Canvas
              </button>
              {/* Task 4: Send to ISL button */}
              <button
                onClick={handleSendToISL}
                style={{
                  padding: '4px 10px',
                  fontSize: 10,
                  border: '1px solid #16a34a',
                  borderRadius: 6,
                  background: '#dcfce7',
                  cursor: 'pointer',
                  color: '#166534',
                  fontWeight: 600,
                }}
              >
                ▶ Send to ISL
              </button>
            </div>
          </div>
        )}

        {/* Determinism Results */}
        {detRuns.length > 0 && (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, marginTop: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>Determinism Test Results</div>
              <button
                onClick={handleExportDetCsv}
                style={{ padding: '4px 8px', fontSize: 10, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
              >
                Export CSV
              </button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: 'monospace' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>Run</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>Duration</th>
                  <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>Options</th>
                </tr>
              </thead>
              <tbody>
                {detRuns.map((r) => (
                  <tr key={r.runNumber}>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }}>#{r.runNumber}</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e2e8f0', color: r.status === 'success' ? '#166534' : '#991b1b', fontWeight: 700 }}>
                      {r.status.toUpperCase()}
                    </td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>{r.durationMs}ms</td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>{r.optionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {determinismSummary && (
              <div style={{ marginTop: 10, fontSize: 10, color: '#64748b' }}>
                Success rate: {determinismSummary.successCount}/{determinismSummary.total} ({Math.round((determinismSummary.successCount / determinismSummary.total) * 100)}%)
                {' • '}Avg: {determinismSummary.avgDurationAll}ms
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>

      {/* Task 2: Step 2 - ISL Payload */}
      <CollapsibleSection
        stepNumber={2}
        title="ISL PAYLOAD"
        badge={validation.valid && (
          <span style={{
            padding: '2px 8px',
            borderRadius: 999,
            background: '#dcfce7',
            fontSize: 9,
            color: '#166534',
          }}>
            ✓ Valid
          </span>
        )}
      >
        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            onClick={() => {
              const lastISL = payloads.find((p) => p.service === 'ISL' && p.request?.body)
              if (lastISL?.request?.body) {
                setPayloadText(JSON.stringify(lastISL.request.body, null, 2))
                onPayloadLoadedRef.current?.()
              }
            }}
            disabled={!payloads.some((p) => p.service === 'ISL' && p.request?.body)}
            style={{
              padding: '4px 8px',
              fontSize: 10,
              border: '1px solid #e2e8f0',
              borderRadius: 4,
              background: '#fff',
              cursor: payloads.some((p) => p.service === 'ISL') ? 'pointer' : 'not-allowed',
              opacity: payloads.some((p) => p.service === 'ISL') ? 1 : 0.5,
            }}
          >
            📥 Load from Last ISL
          </button>
          <button
            onClick={() => {
              const bundle = createReproducibilityBundle(
                canvasNodes,
                canvasEdges,
                validation.parsed,
                rawResponse,
                ceePipelineTrace,
                results
              )
              const json = JSON.stringify(bundle, null, 2)
              const blob = new Blob([json], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `reproducibility-bundle-${Date.now()}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}
            style={{
              padding: '4px 8px',
              fontSize: 10,
              border: '1px solid #93c5fd',
              borderRadius: 4,
              background: '#dbeafe',
              cursor: 'pointer',
              color: '#1d4ed8',
            }}
          >
            📦 Download Bundle
          </button>
        </div>

        {/* Artefact Chain Navigator */}
        <ArtefactChainNavigator
          stages={[
            { id: 'llm-raw', label: 'LLM Raw', count: ceePipelineTrace?.llm_call_count, status: ceePipelineTrace ? 'complete' : 'pending' },
            { id: 'parsed', label: 'Parsed', count: ceePipelineTrace?.final_graph?.node_count, status: ceePipelineTrace?.final_graph ? 'complete' : 'pending' },
            { id: 'normalised', label: 'Normalised', count: canvasNodes.length, status: canvasNodes.length > 0 ? 'complete' : 'pending' },
            { id: 'validated', label: 'Validated', status: validation.valid ? 'complete' : payloadText ? 'error' : 'pending' },
            { id: 'isl', label: 'ISL', status: results ? 'complete' : isRunning ? 'active' : 'pending' },
          ]}
          activeStage={activeArtefactStage}
          onStageClick={(stageId) => {
            setActiveArtefactStage(stageId)
            if (onNavigateToTab) {
              if (stageId === 'llm-raw' || stageId === 'parsed') {
                onNavigateToTab('cee-pipeline')
              }
            }
          }}
        />

        {/* Task 6: Editor area with labels for compare mode */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            {compareMode && (
              <div style={{ fontSize: 10, fontWeight: 600, color: '#991b1b', marginBottom: 4, padding: '2px 8px', background: '#fef2f2', borderRadius: 4 }}>
                PAYLOAD A (editing)
              </div>
            )}
            {/* Task 5: Fixed textarea with proper keyboard handling */}
            <textarea
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              onKeyDown={handleEditorKeyDown}
              placeholder="Paste ISL payload JSON here..."
              style={{
                width: '100%',
                height: compareMode ? 200 : 280,
                padding: '8px',
                fontSize: 10,
                fontFamily: 'monospace',
                border: `1px solid ${validation.valid ? '#e2e8f0' : '#fca5a5'}`,
                borderRadius: 6,
                resize: 'vertical',
                // Task 5: Ensure text selection works
                userSelect: 'text',
                WebkitUserSelect: 'text',
              }}
            />
            <div
              style={{
                fontSize: 10,
                marginTop: 4,
                color: validation.valid ? '#22c55e' : '#ef4444',
              }}
            >
              {validation.valid ? (
                '✓ Valid ISL payload'
              ) : validation.error ? (
                `✗ ${validation.error}`
              ) : validation.errors ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {validation.errors.map((err, i) => (
                    <span key={i}>⚠ {err}</span>
                  ))}
                </div>
              ) : (
                '✗ Invalid payload'
              )}
            </div>
          </div>

          {compareMode && (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#166534', marginBottom: 4, padding: '2px 8px', background: '#f0fdf4', borderRadius: 4 }}>
                PAYLOAD B (compare with)
              </div>
              <textarea
                value={comparePayloadText}
                onChange={(e) => setComparePayloadText(e.target.value)}
                onKeyDown={handleEditorKeyDown}
                placeholder="Compare payload JSON..."
                style={{
                  width: '100%',
                  height: 200,
                  padding: '8px',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  border: `1px solid ${compareValidation.valid ? '#e2e8f0' : '#fca5a5'}`,
                  borderRadius: 6,
                  resize: 'vertical',
                  userSelect: 'text',
                  WebkitUserSelect: 'text',
                }}
              />
              <div
                style={{
                  fontSize: 10,
                  marginTop: 4,
                  color: compareValidation.valid ? '#22c55e' : '#ef4444',
                }}
              >
                {compareValidation.valid ? (
                  '✓ Valid ISL payload'
                ) : compareValidation.error ? (
                  `✗ ${compareValidation.error}`
                ) : compareValidation.errors ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {compareValidation.errors.map((err, i) => (
                      <span key={i}>⚠ {err}</span>
                    ))}
                  </div>
                ) : (
                  '✗ Invalid payload'
                )}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px',
            background: '#f8fafc',
            borderRadius: 6,
            marginBottom: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <label style={{ fontSize: 10, color: '#64748b' }}>Seed:</label>
            <input
              type="text"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              style={{
                width: 60,
                padding: '4px 6px',
                fontSize: 10,
                border: '1px solid #e2e8f0',
                borderRadius: 4,
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <label style={{ fontSize: 10, color: '#64748b' }}>Samples:</label>
            <input
              type="number"
              value={nSamples}
              onChange={(e) => setNSamples(parseInt(e.target.value) || 1000)}
              style={{
                width: 60,
                padding: '4px 6px',
                fontSize: 10,
                border: '1px solid #e2e8f0',
                borderRadius: 4,
              }}
            />
          </div>

          {/* History/Snapshots selectors */}
          <select
            onChange={(e) => {
              const idx = parseInt(e.target.value)
              if (!isNaN(idx) && history[idx]) {
                handleLoadHistory(history[idx])
              }
            }}
            style={{
              padding: '4px 8px',
              fontSize: 10,
              border: '1px solid #e2e8f0',
              borderRadius: 4,
              background: '#fff',
            }}
            defaultValue=""
          >
            <option value="" disabled>
              History ({history.length})
            </option>
            {history.map((h, i) => (
              <option key={h.id} value={i}>
                {new Date(h.timestamp).toLocaleTimeString()} - {h.seed}
              </option>
            ))}
          </select>

          <select
            onChange={(e) => {
              const snap = snapshots.find((s) => s.id === e.target.value)
              if (snap) handleLoadSnapshot(snap)
            }}
            style={{
              padding: '4px 8px',
              fontSize: 10,
              border: '1px solid #e2e8f0',
              borderRadius: 4,
              background: '#fff',
            }}
            defaultValue=""
          >
            <option value="" disabled>
              Saved ({snapshots.length})
            </option>
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowSaveDialog(true)}
            disabled={!validation.valid}
            style={{
              padding: '4px 8px',
              fontSize: 10,
              border: '1px solid #e2e8f0',
              borderRadius: 4,
              background: '#fff',
              cursor: validation.valid ? 'pointer' : 'not-allowed',
              opacity: validation.valid ? 1 : 0.5,
            }}
          >
            + Save as...
          </button>

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setCompareMode(!compareMode)}
            style={{
              padding: '6px 12px',
              fontSize: 10,
              background: compareMode ? '#dbeafe' : '#f1f5f9',
              border: '1px solid',
              borderColor: compareMode ? '#93c5fd' : '#e2e8f0',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {compareMode ? '✓ Compare' : '↔ Compare'}
          </button>

          <button
            onClick={handleReset}
            style={{
              padding: '6px 12px',
              fontSize: 10,
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>

          <button
            onClick={handleRun}
            disabled={!validation.valid || isRunning}
            style={{
              padding: '6px 16px',
              fontSize: 10,
              fontWeight: 600,
              background: validation.valid && !isRunning ? '#22c55e' : '#94a3b8',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: validation.valid && !isRunning ? 'pointer' : 'not-allowed',
            }}
          >
            {isRunning ? 'Running...' : compareMode ? '▶ Run Both' : '▶ Run ISL'}
          </button>
        </div>

        {/* Save dialog */}
        {showSaveDialog && (
          <div
            style={{
              padding: '12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              marginBottom: 12,
            }}
          >
            <input
              type="text"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              placeholder="Snapshot name..."
              style={{
                width: '100%',
                padding: '6px 8px',
                fontSize: 11,
                border: '1px solid #e2e8f0',
                borderRadius: 4,
                marginBottom: 8,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleSaveSnapshot}
                disabled={!snapshotName.trim()}
                style={{
                  padding: '4px 12px',
                  fontSize: 10,
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: snapshotName.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false)
                  setSnapshotName('')
                }}
                style={{
                  padding: '4px 12px',
                  fontSize: 10,
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: 4,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Task 2: Step 3 - Results */}
      <CollapsibleSection
        stepNumber={3}
        title="RESULTS"
        id="payload-lab-results"
        defaultOpen={!!rawResponse}
        forceOpen={resultsExpandTrigger > 0}
        badge={rawResponse && (() => {
          const response = rawResponse as ISLTestResponse
          const conformalVars = extractConformalResults(response)
          const optionsCount = results?.options?.length ?? 0
          if (conformalVars.length > 0) {
            return (
              <span style={{
                padding: '2px 8px',
                borderRadius: 999,
                background: '#dbeafe',
                fontSize: 9,
                color: '#1d4ed8',
              }}>
                {conformalVars.length} var{conformalVars.length !== 1 ? 's' : ''} (conformal)
              </span>
            )
          }
          if (optionsCount > 0) {
            return (
              <span style={{
                padding: '2px 8px',
                borderRadius: 999,
                background: '#dcfce7',
                fontSize: 9,
                color: '#166534',
              }}>
                {optionsCount} options
              </span>
            )
          }
          return (
            <span style={{
              padding: '2px 8px',
              borderRadius: 999,
              background: '#fef3c7',
              fontSize: 9,
              color: '#92400e',
            }}>
              0 results
            </span>
          )
        })()}
      >
        {error && (
          <div
            style={{
              padding: '8px 12px',
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: 6,
              marginBottom: 12,
              fontSize: 11,
              color: '#991b1b',
            }}
          >
            {error}
          </div>
        )}

        {rawResponse ? (
          <>
            {/* Detect response type */}
            {(() => {
              const primaryResponse = rawResponse as ISLTestResponse
              const isConformal = hasConformalResults(primaryResponse)

              // Compare mode with both results
              if (compareMode && compareResults && compareRawResponse) {
                const compareResponse = compareRawResponse as ISLTestResponse
                const compareIsConformal = hasConformalResults(compareResponse)

                return (
                  <div>
                    {/* Summary row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '8px 12px',
                        background: '#f0fdf4',
                        border: '1px solid #86efac',
                        borderRadius: 6,
                        marginBottom: 12,
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#166534' }}>Compare Results</span>
                      <span style={{ fontSize: 10, color: '#16a34a' }}>
                        {isConformal || compareIsConformal ? (
                          <>A: {extractConformalResults(primaryResponse).length} vars | B: {extractConformalResults(compareResponse).length} vars</>
                        ) : (
                          <>A: {results?.options?.length ?? 0} options | B: {compareResults.options?.length ?? 0} options</>
                        )}
                      </span>
                    </div>

                    {/* Side by side tables */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div style={{ border: '1px solid #fca5a5', borderRadius: 8, padding: 8, background: '#fef2f2' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#991b1b', marginBottom: 8 }}>
                          Payload A (Primary)
                        </div>
                        {isConformal ? (
                          <ConformalResultsTable response={primaryResponse} runNumber={runCount} />
                        ) : results ? (
                          <ResultsTable summary={results} runNumber={runCount} />
                        ) : (
                          <EmptyResultsState />
                        )}
                      </div>
                      <div style={{ border: '1px solid #86efac', borderRadius: 8, padding: 8, background: '#f0fdf4' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#166534', marginBottom: 8 }}>
                          Payload B (Compare)
                        </div>
                        {compareIsConformal ? (
                          <ConformalResultsTable response={compareResponse} runNumber={runCount} />
                        ) : compareResults ? (
                          <ResultsTable summary={compareResults} runNumber={runCount} />
                        ) : (
                          <EmptyResultsState />
                        )}
                      </div>
                    </div>

                    {/* Delta analysis for conformal results */}
                    {(isConformal || compareIsConformal) && (() => {
                      const conformalA = extractConformalResults(primaryResponse)
                      const conformalB = extractConformalResults(compareResponse)
                      if (conformalA.length === 0 || conformalB.length === 0) return null

                      return (
                        <div style={{ marginTop: 12, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                            Δ Conformal Analysis (B - A)
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {conformalA.map((varA) => {
                              const varB = conformalB.find((v) => v.variable === varA.variable)
                              if (!varB) return null
                              const delta = varB.pointEstimate - varA.pointEstimate
                              const percentChange = varA.pointEstimate !== 0 ? (delta / varA.pointEstimate) * 100 : 0
                              const isSignificant = Math.abs(percentChange) > 5
                              return (
                                <div
                                  key={varA.variable}
                                  style={{
                                    padding: '4px 8px',
                                    background: '#fff',
                                    border: '1px solid',
                                    borderColor: isSignificant ? (delta > 0 ? '#86efac' : '#fca5a5') : '#e2e8f0',
                                    borderRadius: 6,
                                    fontSize: 9,
                                    fontFamily: 'monospace',
                                  }}
                                >
                                  <span style={{ color: '#64748b' }}>{varA.variable}: </span>
                                  <span
                                    style={{
                                      color: isSignificant ? (delta > 0 ? '#16a34a' : '#dc2626') : '#64748b',
                                      fontWeight: isSignificant ? 600 : 400,
                                    }}
                                  >
                                    {delta > 0 ? '+' : ''}{delta.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    {percentChange !== 0 && ` (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%)`}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}

                    {/* Delta analysis for options-based results */}
                    {!isConformal && !compareIsConformal && results?.options?.length > 0 && compareResults.options?.length > 0 && (
                      <div style={{ marginTop: 12, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                          Δ Analysis (B - A)
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {results.options.map((optA) => {
                            const optB = compareResults.options?.find((o) => o.id === optA.id)
                            if (!optB) return null
                            const delta = optB.p50 - optA.p50
                            const isSignificant = Math.abs(delta) > 0.05
                            return (
                              <div
                                key={optA.id}
                                style={{
                                  padding: '4px 8px',
                                  background: '#fff',
                                  border: '1px solid',
                                  borderColor: isSignificant ? (delta > 0 ? '#86efac' : '#fca5a5') : '#e2e8f0',
                                  borderRadius: 6,
                                  fontSize: 9,
                                  fontFamily: 'monospace',
                                }}
                              >
                                <span style={{ color: '#64748b' }}>{optA.label}: </span>
                                <span
                                  style={{
                                    color: isSignificant ? (delta > 0 ? '#16a34a' : '#dc2626') : '#64748b',
                                    fontWeight: isSignificant ? 600 : 400,
                                  }}
                                >
                                  {delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}% p50
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Payload diff viewer */}
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#334155' }}>Payload Comparison</span>
                        <button
                          onClick={() => setCompareDiffMode(!compareDiffMode)}
                          style={{
                            padding: '2px 6px',
                            fontSize: 9,
                            border: '1px solid',
                            borderColor: compareDiffMode ? '#93c5fd' : '#e2e8f0',
                            borderRadius: 4,
                            background: compareDiffMode ? '#dbeafe' : '#f8fafc',
                            cursor: 'pointer',
                            color: compareDiffMode ? '#1d4ed8' : '#64748b',
                          }}
                        >
                          {compareDiffMode ? '✓ Show Diff' : 'Show Diff'}
                        </button>
                      </div>
                      {compareDiffMode && validation.parsed && compareValidation.parsed && (
                        <JsonDiffViewer
                          left={validation.parsed}
                          right={compareValidation.parsed}
                          leftLabel="Primary Payload"
                          rightLabel="Compare Payload"
                        />
                      )}
                    </div>
                  </div>
                )
              }

              // Single results mode
              if (isConformal) {
                return <ConformalResultsTable response={primaryResponse} runNumber={runCount} />
              }

              if (results) {
                return <ResultsTable summary={results} runNumber={runCount} />
              }

              return <EmptyResultsState durationMs={results?.duration_ms} nSamplesUsed={results?.n_samples_used} />
            })()}

            <RawResponseViewer response={rawResponse} label="Raw ISL Response" />
          </>
        ) : (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>
            No results yet. Run an ISL test to see results here.
          </div>
        )}
      </CollapsibleSection>

      {/* No test runner message */}
      {!onRunTest && (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: 11,
            background: '#f8fafc',
            borderRadius: 8,
          }}
        >
          Payload Lab requires a BFF endpoint to be configured.
          <br />
          Contact your administrator to enable this feature.
        </div>
      )}
    </div>
  )
}

export default PayloadLabTab
