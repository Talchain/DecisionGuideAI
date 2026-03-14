/**
 * DebugPanelV2 Component
 *
 * Restructured 5-tab debug panel layout:
 * - Summary: At-a-glance health check
 * - Data Flow: Service chain tracing
 * - Pipeline: CEE internal processing stages
 * - Captured: Recorded payloads (redacted at capture time)
 * - Payload Lab: Interactive testing for CEE drafts and ISL payloads
 */

import { useState, useCallback, useMemo, CSSProperties } from 'react'
import { useDebugData } from './hooks/useDebugData'
import { SummaryTab, DataFlowTab, PipelineTab, RawTab, LLMCallsTab, ContractIntegrityTab } from './tabs'
import { PayloadLabTab } from './PayloadLabTab'
import { exportDebugBundle, exportDebugBundleAsync, copyRequestId } from './utils/exportBundle'
import { isDebugBundleV1_5Enabled } from '../../flags'
import type { ISLTestResponse } from './types'
import { ISLClient } from '../../adapters/isl/client'
import { useCanvasStore } from '../../canvas/store'

// =============================================================================
// Types
// =============================================================================

type V2Tab = 'summary' | 'data-flow' | 'pipeline' | 'llm-calls' | 'contracts' | 'raw' | 'payload-lab'

interface TabConfig {
  id: V2Tab
  label: string
}

const V2_TABS: TabConfig[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'data-flow', label: 'Data Flow' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'llm-calls', label: 'LLM Calls' },
  { id: 'contracts', label: 'Contract Integrity' },
  { id: 'raw', label: 'Captured' },
  { id: 'payload-lab', label: 'Payload Lab' },
]

// =============================================================================
// Component
// =============================================================================

export interface DebugPanelV2Props {
  /** Close panel handler */
  onClose?: () => void
  /** Current panel width */
  width?: number
  /** Current panel height */
  height?: number
  /** Whether panel is in expanded mode */
  expanded?: boolean
  /** Toggle expanded mode */
  onToggleExpanded?: () => void
}

export function DebugPanelV2({ onClose, width, height, expanded, onToggleExpanded }: DebugPanelV2Props) {
  const [activeTab, setActiveTab] = useState<V2Tab>('summary')
  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [includeFullGraph, setIncludeFullGraph] = useState(false)

  // Get debug data
  const data = useDebugData()

  // Handle copy request ID
  const handleCopyRequestId = useCallback(async () => {
    const success = await copyRequestId(data.overall.request_id)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }, [data.overall.request_id])

  // Handle export all (fetch graph data at export time to avoid subscription issues)
  const handleExportAll = useCallback(async () => {
    setExporting(true)
    try {
      // Get current graph data from store only when needed for export
      const graphData = includeFullGraph
        ? {
            nodes: useCanvasStore.getState().nodes,
            edges: useCanvasStore.getState().edges,
          }
        : undefined

      const options = { includeFullGraph, graphData }

      // V1.5: Use async path for full capture (display_state, panel_state, orchestrator)
      if (isDebugBundleV1_5Enabled()) {
        await exportDebugBundleAsync(data, options)
      } else {
        exportDebugBundle(data, options)
      }
    } finally {
      setExporting(false)
    }
  }, [data, includeFullGraph])

  // Navigation handlers for Summary tab
  const navigateToDataFlow = useCallback(() => setActiveTab('data-flow'), [])
  const navigateToPipeline = useCallback(() => setActiveTab('pipeline'), [])
  const navigateToRaw = useCallback(() => setActiveTab('raw'), [])

  // ISL client instance (memoized to avoid recreation)
  const islClient = useMemo(() => new ISLClient({ timeout: 60000 }), [])

  // ISL test runner for Payload Lab - uses ISLClient for proper observability
  const handleRunISLTest = useCallback(async (
    payload: object,
    seed: string,
    nSamples: number
  ): Promise<ISLTestResponse> => {
    const startTime = Date.now()

    // Add seed and n_samples to the request
    const requestPayload = {
      ...payload,
      seed,
      n_samples: nSamples,
    }

    try {
      // Use ISLClient.conformalPredict for proper observability headers
      // Cast to expected type since PayloadLab generates valid ISL conformal requests
      const rawResponse = await islClient.conformalPredict(
        requestPayload as Parameters<typeof islClient.conformalPredict>[0]
      )
      const duration_ms = Date.now() - startTime

      // Transform to ISLTestResponse format
      return {
        summary: {
          duration_ms,
          options: [],
        },
        raw_response: rawResponse,
      }
    } catch (error) {
      // Cap error message length for UI safety (P3 fix)
      const message = error instanceof Error ? error.message : String(error)
      const truncatedMessage = message.length > 300 ? message.slice(0, 300) + '...' : message
      throw new Error(truncatedMessage)
    }
  }, [islClient])

  // Derive status for header badge
  const statusColor =
    data.overall.status === 'error'
      ? '#ef4444'
      : data.overall.status === 'pending'
        ? '#f59e0b'
        : '#22c55e'
  const statusLabel =
    data.overall.status === 'error' ? 'Error' : data.overall.status === 'pending' ? 'Pending' : 'OK'

  // Styles
  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
  }

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: '#1e293b',
    color: '#fff',
    minHeight: 44,
  }

  const tabBarStyle: CSSProperties = {
    display: 'flex',
    gap: 0,
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    padding: '0 12px',
  }

  const tabStyle = (isActive: boolean): CSSProperties => ({
    padding: '10px 16px',
    fontSize: 12,
    fontWeight: isActive ? 600 : 400,
    color: isActive ? '#1d4ed8' : '#64748b',
    background: 'transparent',
    border: 'none',
    borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
    cursor: 'pointer',
    transition: 'color 0.1s, border-color 0.1s',
  })

  const contentStyle: CSSProperties = {
    flex: 1,
    overflow: 'auto',
    background: '#f8fafc',
  }

  const buttonStyle: CSSProperties = {
    padding: '4px 12px',
    fontSize: 11,
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 4,
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    transition: 'background 0.1s',
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Status badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 4,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: statusColor,
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 600 }}>{statusLabel}</span>
          </div>

          {/* Title */}
          <span style={{ fontSize: 13, fontWeight: 600 }}>Debug Panel</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Copy Request ID button */}
          <button
            onClick={handleCopyRequestId}
            style={{
              ...buttonStyle,
              color: copied ? '#4ade80' : '#fff',
            }}
            disabled={!data.overall.request_id}
            title={data.overall.request_id ?? 'No request ID'}
            aria-label="Copy request ID"
          >
            {copied ? 'Copied!' : 'Copy Request ID'}
          </button>

          {/* Include Full Graph checkbox */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              color: exporting ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.8)',
              cursor: exporting ? 'not-allowed' : 'pointer',
              opacity: exporting ? 0.6 : 1,
            }}
            title="Include full graph data (factors, edges, options) in export. Note: descriptions are not redacted and may contain raw user text."
          >
            <input
              type="checkbox"
              checked={includeFullGraph}
              onChange={(e) => setIncludeFullGraph(e.target.checked)}
              disabled={exporting}
              style={{ cursor: exporting ? 'not-allowed' : 'pointer' }}
            />
            Full Graph
          </label>

          {/* Export All button */}
          <button
            onClick={handleExportAll}
            style={buttonStyle}
            disabled={!data.hasData || exporting}
            aria-label="Export all debug data"
          >
            {exporting ? 'Exporting...' : 'Export All'}
          </button>

          {/* Expand toggle button */}
          {onToggleExpanded && (
            <button
              onClick={onToggleExpanded}
              style={{
                ...buttonStyle,
                padding: '4px 8px',
                minWidth: 28,
              }}
              aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
              title={expanded ? 'Collapse panel' : 'Expand to 50% width'}
            >
              {expanded ? '⊟' : '⊞'}
            </button>
          )}

          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              style={{
                ...buttonStyle,
                padding: '4px 8px',
                minWidth: 28,
              }}
              aria-label="Close debug panel"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div style={tabBarStyle} role="tablist" aria-label="Debug panel tabs">
        {V2_TABS.map((tab) => (
          <button
            key={tab.id}
            style={tabStyle(activeTab === tab.id)}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div
        style={contentStyle}
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={activeTab}
      >
        {activeTab === 'summary' && (
          <SummaryTab
            data={data}
            onNavigateToDataFlow={navigateToDataFlow}
            onNavigateToPipeline={navigateToPipeline}
            onNavigateToRaw={navigateToRaw}
          />
        )}
        {activeTab === 'data-flow' && <DataFlowTab data={data} />}
        {activeTab === 'pipeline' && <PipelineTab data={data} />}
        {activeTab === 'llm-calls' && <LLMCallsTab data={data} />}
        {activeTab === 'contracts' && <ContractIntegrityTab data={data} />}
        {activeTab === 'raw' && <RawTab data={data} />}
        {activeTab === 'payload-lab' && <PayloadLabTab onRunTest={handleRunISLTest} />}
      </div>
    </div>
  )
}

export default DebugPanelV2
