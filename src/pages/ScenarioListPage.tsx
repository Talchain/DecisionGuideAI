/**
 * Scenario list page — full implementation (C.1b Task 4).
 *
 * Fetches the user's scenarios from Supabase and renders them as a
 * navigable list with stage badge, analysis status, and last-activity
 * subtitle derived from the most recent event.
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, RefreshCw, AlertTriangle, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useScenario } from '../hooks/useScenario'
import * as scenarioService from '../services/scenarioService'
import type { ScenarioListItem, ScenarioStage, AnalysisStatus, ScenarioEvent } from '../types/scenario'
import { Skeleton } from '../components/Skeleton'
import { formatRelativeTime } from '../utils/formatRelativeTime'

// ---------------------------------------------------------------------------
// Stage badge styles — semantic colours from the design system
// ---------------------------------------------------------------------------

const stageLabels: Record<ScenarioStage, string> = {
  frame: 'Frame',
  ideate: 'Ideate',
  evaluate: 'Evaluate',
  decide: 'Decide',
  optimise: 'Optimise',
}

const stageStyles: Record<ScenarioStage, string> = {
  frame: 'bg-info-light text-info',
  ideate: 'bg-factor-light text-text-body',
  evaluate: 'bg-warning-light text-warning',
  decide: 'bg-success-light text-success',
  optimise: 'bg-info-light text-info',
}

// ---------------------------------------------------------------------------
// Analysis status indicator
// ---------------------------------------------------------------------------

function AnalysisStatusIcon({ status }: { status: AnalysisStatus }) {
  switch (status) {
    case 'none':
      return <span className="w-2 h-2 rounded-full bg-gray-300" title="No analysis" />
    case 'running':
      return <Loader2 className="w-3.5 h-3.5 text-info animate-spin" aria-label="Analysis running" />
    case 'ready':
      return <CheckCircle2 className="w-3.5 h-3.5 text-success" aria-label="Analysis ready" />
    case 'failed':
      return <XCircle className="w-3.5 h-3.5 text-danger" aria-label="Analysis failed" />
  }
}

// ---------------------------------------------------------------------------
// Last-activity subtitle from events
// ---------------------------------------------------------------------------

function formatLastActivity(events: ScenarioEvent[] | null | undefined, updatedAt: string): string {
  if (!events || events.length === 0) {
    return `Created ${formatRelativeTime(updatedAt)}`
  }

  // Events are ordered by seq; take the last one
  const lastEvent = events[events.length - 1]
  const details = lastEvent.details ?? {}

  switch (lastEvent.event_type) {
    case 'analysis_run':
      if (details.winner && details.probability) {
        return `Analysis run — ${details.winner} won at ${Math.round(Number(details.probability) * 100)}%`
      }
      return 'Analysis run'
    case 'graph_drafted':
      return `Model drafted with ${details.node_count ?? '?'} factors`
    case 'brief_generated':
      return 'Decision brief generated'
    case 'patch_accepted':
      return `Model updated — ${details.summary ?? 'changes applied'}`
    case 'stage_changed':
      return `Moved to ${details.to ?? 'next'} stage`
    default:
      return `Updated ${formatRelativeTime(lastEvent.timestamp ?? updatedAt)}`
  }
}

// ---------------------------------------------------------------------------
// Confirmation dialog
// ---------------------------------------------------------------------------

function DeleteConfirmDialog({
  scenarioTitle,
  onConfirm,
  onCancel,
}: {
  scenarioTitle: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-text-header">Delete scenario</h3>
        <p className="mt-2 text-sm text-text-body">
          Delete &ldquo;{scenarioTitle}&rdquo;? This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-text-body hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm rounded-md bg-danger text-white hover:bg-danger/90"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ScenarioListSkeleton() {
  return (
    <div className="space-y-3" data-testid="scenario-list-skeleton">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-4 rounded-lg border border-gray-200 space-y-2">
          <Skeleton variant="text" width="60%" height="20px" />
          <Skeleton variant="text" width="40%" height="14px" />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ScenarioListPage() {
  const { user, authenticated } = useAuth()
  const { createScenario, deleteScenario, isPersistenceActive } = useScenario()
  const navigate = useNavigate()

  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ScenarioListItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchScenarios = useCallback(async () => {
    if (!isPersistenceActive || !user) return
    setLoading(true)
    setError(null)
    try {
      const list = await scenarioService.listScenarios(user.id)
      setScenarios(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenarios')
    } finally {
      setLoading(false)
    }
  }, [isPersistenceActive, user])

  // Fetch on mount
  useEffect(() => {
    fetchScenarios()
  }, [fetchScenarios])

  // Re-fetch on tab focus
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        fetchScenarios()
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [fetchScenarios])

  const handleCreate = async () => {
    setCreating(true)
    try {
      await createScenario()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scenario')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteScenario(deleteTarget.id)
      setDeleteTarget(null)
      await fetchScenarios()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete scenario')
    } finally {
      setDeleting(false)
    }
  }

  // Guest mode / unauthenticated — show a helpful message
  if (!isPersistenceActive) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-semibold text-text-header">Scenarios</h1>
          <p className="mt-4 text-text-body">
            Sign in to save and manage your decision scenarios in the cloud.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="mt-6 px-4 py-2 text-sm font-medium rounded-md bg-info text-white hover:bg-info/90"
          >
            Sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 sm:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-text-header">Scenarios</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchScenarios}
              disabled={loading}
              className="p-2 text-text-light hover:text-text-body rounded-md hover:bg-gray-100 disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-info text-white hover:bg-info/90 disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              New scenario
            </button>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-danger-light text-danger text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button
              onClick={fetchScenarios}
              className="ml-auto text-xs underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && scenarios.length === 0 && <ScenarioListSkeleton />}

        {/* Empty state */}
        {!loading && scenarios.length === 0 && !error && (
          <div className="text-center py-16" data-testid="empty-state">
            <h2 className="text-lg font-medium text-text-header">No scenarios yet</h2>
            <p className="mt-2 text-sm text-text-light max-w-sm mx-auto">
              Create your first decision scenario to get started with science-powered analysis.
            </p>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="mt-6 flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-info text-white hover:bg-info/90 disabled:opacity-50 mx-auto"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create scenario
            </button>
          </div>
        )}

        {/* Scenario list */}
        {scenarios.length > 0 && (
          <div className="space-y-2" data-testid="scenario-list">
            {scenarios.map((scenario) => (
              <div
                key={scenario.id}
                onClick={() => navigate(`/scenario/${scenario.id}`)}
                className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 bg-white hover:border-info/40 hover:shadow-sm cursor-pointer transition-all group"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/scenario/${scenario.id}`) }}
                data-testid="scenario-row"
              >
                {/* Analysis status icon */}
                <div className="flex-shrink-0">
                  <AnalysisStatusIcon status={scenario.analysis_status} />
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-header truncate">
                      {scenario.title || 'Untitled scenario'}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stageStyles[scenario.stage]}`}>
                      {stageLabels[scenario.stage]}
                    </span>
                  </div>
                  <p className="text-xs text-text-light mt-0.5 truncate">
                    {formatLastActivity(scenario.events, scenario.updated_at)}
                    {' · '}
                    {formatRelativeTime(scenario.updated_at)}
                  </p>
                </div>

                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteTarget(scenario)
                  }}
                  className="flex-shrink-0 p-1.5 text-text-light hover:text-danger rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Delete ${scenario.title || 'Untitled scenario'}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteConfirmDialog
          scenarioTitle={deleteTarget.title || 'Untitled scenario'}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
