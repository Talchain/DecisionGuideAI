import { useMemo } from 'react'
import { AlertCircle, CheckCircle, AlertTriangle, CloudOff } from 'lucide-react'
import type { CEEDraftResponse } from '../../adapters/cee/types'
import { typography } from '../../styles/typography'
import { Spinner } from '../../components/Spinner'
import { generateTemplatePreview } from '../utils/templatePreview'
import type { NodeKind } from '../../templates/blueprints/types'

interface DraftPreviewProps {
  draft: CEEDraftResponse | null | undefined
  loading?: boolean
  onAccept: () => void
  onReject: () => void
}

type DraftNode = CEEDraftResponse['nodes'][number]

// Tailwind-safe quality config with static class names
function getQualityConfig(quality: number) {
  if (quality >= 7) {
    return {
      containerClasses: 'bg-mint-50 border-mint-200',
      iconClasses: 'text-mint-600',
      icon: CheckCircle,
      label: 'Ready to use',
      actionText: 'Accept Draft',
    }
  } else if (quality >= 4) {
    return {
      containerClasses: 'bg-sun-50 border-sun-200',
      iconClasses: 'text-sun-600',
      icon: AlertTriangle,
      label: 'Review recommended',
      actionText: 'Review & Edit',
    }
  } else {
    return {
      containerClasses: 'bg-carrot-50 border-carrot-200',
      iconClasses: 'text-carrot-600',
      icon: AlertCircle,
      label: 'Needs improvement',
      actionText: 'Improve & Retry',
    }
  }
}

function normalizeDraftType(type: string | undefined): string {
  return (type || '').toLowerCase()
}

function mapDraftTypeToNodeKind(type: string | undefined): NodeKind {
  const t = normalizeDraftType(type)
  if (t === 'goal') return 'goal'
  if (t === 'decision') return 'decision'
  if (t === 'option') return 'option'
  if (t === 'outcome') return 'outcome'
  if (t === 'risk') return 'risk'
  if (t === 'event') return 'event'
  if (t === 'factor') return 'event'
  return 'decision'
}

function buildOutline(nodes: DraftNode[]) {
  const goals = nodes.filter(n => normalizeDraftType(n.type) === 'goal')
  const decisions = nodes.filter(n => normalizeDraftType(n.type) === 'decision')
  const options = nodes.filter(n => normalizeDraftType(n.type) === 'option')
  const outcomes = nodes.filter(n => normalizeDraftType(n.type) === 'outcome')
  const factors = nodes.filter(n => {
    const t = normalizeDraftType(n.type)
    return t === 'risk' || t === 'factor' || t === 'event'
  })
  return { goals, decisions, options, outcomes, factors }
}

function formatOutlineList(nodes: DraftNode[], max: number): string {
  if (!nodes.length) return 'Not identified yet'
  if (nodes.length <= max) {
    return nodes.map(n => n.label).join(', ')
  }
  const head = nodes.slice(0, max).map(n => n.label).join(', ')
  const remaining = nodes.length - max
  return `${head} (+${remaining} more)`
}

export function DraftPreview({ draft, loading, onAccept, onReject }: DraftPreviewProps) {
  // Null-safe derived values - prevent crashes when draft is missing or incomplete
  const nodes = draft?.nodes ?? []
  const edges = draft?.edges ?? []
  const quality = draft?.quality_overall ?? 0
  const structural = draft?.draft_warnings?.structural ?? []
  const completeness = draft?.draft_warnings?.completeness ?? []

  const config = useMemo(() => getQualityConfig(quality), [quality])
  const Icon = config.icon

  const outline = useMemo(() => buildOutline(nodes), [nodes])

  const previewUrl = useMemo(() => {
    if (!nodes.length) return null

    const blueprintNodes = nodes.map((n, index) => ({
      id: n.id || String(index),
      label: n.label,
      kind: mapDraftTypeToNodeKind(n.type),
    }))

    const blueprintEdges = edges.map((e, index) => ({
      id: `e-${index}`,
      from: e.from,
      to: e.to,
    }))

    try {
      return generateTemplatePreview(blueprintNodes as any, blueprintEdges as any)
    } catch {
      return null
    }
  }, [nodes, edges])

  // Empty/unavailable state - show friendly message instead of crashing
  if (!draft || nodes.length === 0) {
    return (
      <div className="space-y-4 p-4 bg-white rounded-lg border border-sand-200 shadow-panel" data-testid="draft-preview-empty">
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-paper-50 border-sand-200">
          <CloudOff className="w-5 h-5 text-ink-900/50" />
          <div className="flex-1">
            <p className={`${typography.label} text-ink-900`}>
              No draft available
            </p>
            <p className={`${typography.caption} text-ink-900/60`}>
              The AI assistant couldn't generate a draft. Try describing your decision differently or check your connection.
            </p>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            onClick={onReject}
            className={`
              ${typography.button} flex-1 py-2.5 rounded
              border border-sand-200 hover:bg-paper-50
              transition-colors
            `}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 bg-white rounded-lg border border-sand-200 shadow-panel" data-testid="draft-preview">
      {/* Quality Badge */}
      <div className={`
        flex items-center gap-3 p-3 rounded-lg border
        ${config.containerClasses}
      `}>
        <Icon className={`w-5 h-5 ${config.iconClasses}`} />
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className={typography.label}>
              Draft Quality: {quality}/10
            </span>
            <span className={`${typography.caption} text-ink-900/60`}>
              {config.label}
            </span>
          </div>
        </div>
      </div>

      {/* Graph Summary */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={typography.label}>Graph Structure</span>
          <span className={`${typography.caption} text-ink-900/60`}>
            {nodes.length} nodes · {edges.length} edges
          </span>
        </div>

        {/* Uncertain Nodes Warning */}
        {nodes.filter(n => n.uncertainty > 0.4).length > 0 && (
          <div className="flex items-start gap-2 p-2 bg-sun-50 rounded">
            <AlertTriangle className="w-4 h-4 text-sun-600 mt-0.5 flex-shrink-0" />
            <p className={`${typography.bodySmall} text-sun-800`}>
              {nodes.filter(n => n.uncertainty > 0.4).length} node{nodes.filter(n => n.uncertainty > 0.4).length !== 1 ? 's' : ''} marked as uncertain
              (shown with dotted borders)
            </p>
          </div>
        )}

        {/* Structural Warnings */}
        {structural.length > 0 && (
          <div className="flex items-start gap-2 p-2 bg-sun-50 border border-sun-200 rounded">
            <AlertCircle className="w-4 h-4 text-sun-700 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className={`${typography.bodySmall} text-sun-800`}>
                {structural.length} structural issue
                {structural.length !== 1 ? 's' : ''} detected
              </p>
              <button className={`${typography.caption} text-sky-600 underline hover:text-sky-700`}>
                View details
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Text Outline */}
      <div className="space-y-1">
        <p className={`${typography.caption} text-ink-900/60`}>Outline</p>
        <ul className="space-y-0.5">
          <li className={`${typography.bodySmall} text-ink-900/80`}>
            <span className="font-semibold">Your goal: </span>
            {formatOutlineList(outline.goals, 2)}
          </li>
          <li className={`${typography.bodySmall} text-ink-900/80`}>
            <span className="font-semibold">The decision(s) you face: </span>
            {formatOutlineList(outline.decisions, 3)}
          </li>
          <li className={`${typography.bodySmall} text-ink-900/80`}>
            <span className="font-semibold">Some options to consider: </span>
            {formatOutlineList(outline.options, 3)}
          </li>
          <li className={`${typography.bodySmall} text-ink-900/80`}>
            <span className="font-semibold">Factors that might influence your decision: </span>
            {formatOutlineList(outline.factors, 3)}
          </li>
          <li className={`${typography.bodySmall} text-ink-900/80`}>
            <span className="font-semibold">Potential outcomes: </span>
            {formatOutlineList(outline.outcomes, 3)}
          </li>
        </ul>
      </div>

      {/* Mini Graph Preview */}
      <div className="relative border border-sand-200 rounded-lg p-3 bg-canvas-25 min-h-[200px] flex items-center justify-center">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Draft graph preview"
            className="max-w-full max-h-[180px] mx-auto"
          />
        ) : (
          <p className={`${typography.caption} text-ink-900/50 text-center py-8`}>
            Graph preview will appear on canvas
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={onAccept}
          disabled={loading}
          className={`
            ${typography.button} flex-1 py-2.5 rounded
            bg-sky-500 text-white hover:bg-sky-600
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          `}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="sm" className="text-white" />
              <span>Adding to canvas...</span>
            </span>
          ) : (
            config.actionText
          )}
        </button>

        <button
          onClick={onReject}
          disabled={loading}
          className={`
            ${typography.button} px-6 py-2.5 rounded
            border border-sand-200 hover:bg-paper-50
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          `}
        >
          Cancel
        </button>
      </div>

      {/* Low Quality Help */}
      {quality < 4 && completeness.length > 0 && (
        <div className="space-y-2 p-3 bg-paper-50 rounded border-l-4 border-sky-500">
          <p className={`${typography.label} text-ink-900`}>
            To improve quality, consider including:
          </p>
          <ul className="space-y-1">
            {completeness.slice(0, 5).map((suggestion, i) => (
              <li key={i} className={`${typography.bodySmall} text-ink-900/70`}>
                • {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
