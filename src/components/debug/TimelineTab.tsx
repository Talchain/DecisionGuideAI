/**
 * TimelineTab Component
 *
 * Vertical flow with expandable stages showing request lifecycle.
 * Part of the Debug Console redesign.
 *
 * Stages:
 * 1. UI Request - POST endpoint
 * 2. BFF Routing - Target and schema
 * 3. CEE Processing - Schema detection, duration, pipeline status
 * 4. LLM Call (unsafe only) - Prompt metadata, reveal toggles
 * 5. Post-Processing - Repairs, validation warnings
 * 6. PLoT /v2/run - Duration, status
 * 7. Response - Schema, adaptations
 */

import { useState, useCallback } from 'react'
import type { TimelineStage, TimelineStageStatus } from './types'

interface TimelineTabProps {
  stages: TimelineStage[]
  showUnsafe?: boolean
}

const STATUS_ICONS: Record<TimelineStageStatus, { icon: string; color: string }> = {
  pending: { icon: '○', color: '#94a3b8' },
  running: { icon: '◐', color: '#3b82f6' },
  success: { icon: '●', color: '#22c55e' },
  error: { icon: '●', color: '#ef4444' },
  skipped: { icon: '○', color: '#d1d5db' },
}

function formatDuration(ms?: number): string {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

interface StageRowProps {
  stage: TimelineStage
  isLast: boolean
  showUnsafe: boolean
  depth?: number
}

function StageRow({ stage, isLast, showUnsafe, depth = 0 }: StageRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const statusInfo = STATUS_ICONS[stage.status]

  // Skip unsafe stages if not in unsafe mode
  if (stage.isUnsafe && !showUnsafe) {
    return null
  }

  const hasDetails = Object.keys(stage.details).length > 0 || (stage.children && stage.children.length > 0)

  const handleToggle = useCallback(() => {
    if (hasDetails) {
      setIsExpanded(!isExpanded)
    }
  }, [hasDetails, isExpanded])

  return (
    <div style={{ marginLeft: depth * 16 }}>
      {/* Stage header */}
      <div
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '8px 0',
          cursor: hasDetails ? 'pointer' : 'default',
        }}
      >
        {/* Timeline connector */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: 20,
          }}
        >
          <span style={{ color: statusInfo.color, fontSize: 14 }}>{statusInfo.icon}</span>
          {!isLast && (
            <div
              style={{
                width: 2,
                flex: 1,
                minHeight: 20,
                background: '#e2e8f0',
                marginTop: 4,
              }}
            />
          )}
        </div>

        {/* Stage content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: stage.status === 'error' ? '#991b1b' : '#334155',
              }}
            >
              {stage.label}
            </span>
            {stage.duration && (
              <span style={{ fontSize: 10, color: '#64748b' }}>
                {formatDuration(stage.duration)}
              </span>
            )}
            {stage.isUnsafe && (
              <span
                style={{
                  fontSize: 9,
                  padding: '1px 4px',
                  background: '#fef3c7',
                  color: '#92400e',
                  borderRadius: 3,
                }}
              >
                UNSAFE
              </span>
            )}
            {hasDetails && (
              <span style={{ fontSize: 10, color: '#94a3b8' }}>
                {isExpanded ? '▼' : '▶'}
              </span>
            )}
          </div>

          {/* Quick summary (always visible) */}
          {stage.details.summary !== undefined && (
            <div
              style={{
                fontSize: 11,
                color: '#64748b',
                marginTop: 2,
              }}
            >
              {String(stage.details.summary ?? '')}
            </div>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && hasDetails && (
        <div
          style={{
            marginLeft: 32,
            padding: '8px 12px',
            background: '#f8fafc',
            borderRadius: 6,
            marginBottom: 8,
            fontSize: 11,
            fontFamily: 'monospace',
          }}
        >
          {Object.entries(stage.details)
            .filter(([key]) => key !== 'summary')
            .map(([key, value]) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  gap: 8,
                  padding: '2px 0',
                  borderBottom: '1px solid #e2e8f0',
                }}
              >
                <span style={{ color: '#64748b', minWidth: 100 }}>{key}:</span>
                <span style={{ color: '#334155', wordBreak: 'break-all' }}>
                  {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}
                </span>
              </div>
            ))}

          {/* Child stages */}
          {stage.children && stage.children.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {stage.children.map((child, index) => (
                <StageRow
                  key={child.id}
                  stage={child}
                  isLast={index === stage.children!.length - 1}
                  showUnsafe={showUnsafe}
                  depth={1}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * LLM I/O Section - Only visible in unsafe mode
 */
interface LLMIOSectionProps {
  promptMetadata?: {
    templateId?: string
    model?: string
    temperature?: number
  }
  promptText?: string
  responseText?: string
  tokenUsage?: { prompt: number; completion: number; total: number }
}

export function LLMIOSection({
  promptMetadata,
  promptText,
  responseText,
  tokenUsage,
}: LLMIOSectionProps) {
  const [showPrompt, setShowPrompt] = useState(false)
  const [showResponse, setShowResponse] = useState(false)

  if (!promptMetadata && !promptText && !responseText) {
    return (
      <div
        style={{
          padding: '12px',
          background: '#fef3c7',
          borderRadius: 6,
          fontSize: 11,
          color: '#92400e',
        }}
      >
        No LLM I/O data available for this request.
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '12px',
        background: '#fffbeb',
        border: '1px solid #fde68a',
        borderRadius: 6,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#92400e',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span>🔒</span>
        <span>LLM I/O (Sensitive)</span>
      </div>

      {/* Metadata */}
      {promptMetadata && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '80px 1fr',
            gap: '4px 8px',
            fontSize: 10,
            fontFamily: 'monospace',
            marginBottom: 8,
          }}
        >
          {promptMetadata.templateId && (
            <>
              <span style={{ color: '#92400e' }}>Template:</span>
              <span style={{ color: '#78350f' }}>{promptMetadata.templateId}</span>
            </>
          )}
          {promptMetadata.model && (
            <>
              <span style={{ color: '#92400e' }}>Model:</span>
              <span style={{ color: '#78350f' }}>{promptMetadata.model}</span>
            </>
          )}
          {promptMetadata.temperature !== undefined && (
            <>
              <span style={{ color: '#92400e' }}>Temperature:</span>
              <span style={{ color: '#78350f' }}>{promptMetadata.temperature}</span>
            </>
          )}
        </div>
      )}

      {/* Token usage */}
      {tokenUsage && (
        <div style={{ fontSize: 10, color: '#92400e', marginBottom: 8 }}>
          Tokens: {tokenUsage.prompt} prompt + {tokenUsage.completion} completion = {tokenUsage.total} total
        </div>
      )}

      {/* Reveal toggles */}
      <div style={{ display: 'flex', gap: 8 }}>
        {promptText && (
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            style={{
              padding: '4px 8px',
              background: showPrompt ? '#fde68a' : '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: 4,
              fontSize: 10,
              cursor: 'pointer',
              color: '#78350f',
            }}
          >
            {showPrompt ? 'Hide Prompt' : 'Reveal Prompt'}
          </button>
        )}
        {responseText && (
          <button
            onClick={() => setShowResponse(!showResponse)}
            style={{
              padding: '4px 8px',
              background: showResponse ? '#fde68a' : '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: 4,
              fontSize: 10,
              cursor: 'pointer',
              color: '#78350f',
            }}
          >
            {showResponse ? 'Hide Response' : 'Reveal Response'}
          </button>
        )}
      </div>

      {/* Prompt text */}
      {showPrompt && promptText && (
        <pre
          style={{
            marginTop: 8,
            padding: 8,
            background: '#fefce8',
            borderRadius: 4,
            fontSize: 9,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 200,
            overflow: 'auto',
            color: '#78350f',
          }}
        >
          {promptText}
        </pre>
      )}

      {/* Response text */}
      {showResponse && responseText && (
        <pre
          style={{
            marginTop: 8,
            padding: 8,
            background: '#fefce8',
            borderRadius: 4,
            fontSize: 9,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 200,
            overflow: 'auto',
            color: '#78350f',
          }}
        >
          {responseText}
        </pre>
      )}
    </div>
  )
}

export function TimelineTab({ stages, showUnsafe = false }: TimelineTabProps) {
  // Filter stages based on unsafe mode
  const visibleStages = stages.filter((s) => !s.isUnsafe || showUnsafe)

  if (visibleStages.length === 0) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          color: '#64748b',
          fontSize: 12,
        }}
      >
        No timeline data available. Run an analysis to see the request flow.
      </div>
    )
  }

  return (
    <div style={{ padding: '12px' }}>
      {visibleStages.map((stage, index) => (
        <StageRow
          key={stage.id}
          stage={stage}
          isLast={index === visibleStages.length - 1}
          showUnsafe={showUnsafe}
        />
      ))}
    </div>
  )
}

export default TimelineTab
