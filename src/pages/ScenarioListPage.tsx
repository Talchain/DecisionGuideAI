/**
 * Scenario hub — landing page after authentication.
 *
 * Features: filter tabs (Active/Archived/All), pin/unpin, duplicate,
 * archive/unarchive, delete, first-run welcome state, search.
 * Design System v4 compliant — all styling via semantic tokens.
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Trash2, AlertTriangle, Loader2,
  Pin, MoreVertical, Copy, Archive, ArchiveRestore,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useScenario } from '../hooks/useScenario'
import * as scenarioService from '../services/scenarioService'
import type { ScenarioListItem, ScenarioStage, AnalysisStatus, ScenarioEvent } from '../types/scenario'
import { Skeleton } from '../components/Skeleton'
import { formatRelativeTime } from '../utils/formatRelativeTime'
import { UserAvatarMenu } from '../components/layout/UserAvatarMenu'
import { typography } from '../styles/typography'
import { trackEvent } from '../lib/posthog'

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
// Filter tabs
// ---------------------------------------------------------------------------

type HubFilter = 'active' | 'archived' | 'all'

// ---------------------------------------------------------------------------
// Analysis status indicator
// ---------------------------------------------------------------------------

function AnalysisStatusIcon({ status }: { status: AnalysisStatus }) {
  switch (status) {
    case 'none':
      return null
    case 'running':
      return <Loader2 className="w-3 h-3 text-info animate-spin" aria-label="Analysis running" />
    case 'ready':
      return <span className="w-2 h-2 rounded-full bg-success" title="Analysis ready" />
    case 'failed':
      return <span className="w-2 h-2 rounded-full bg-danger" title="Analysis failed" />
  }
}

// ---------------------------------------------------------------------------
// Last-activity subtitle from events
// ---------------------------------------------------------------------------

function formatLastActivity(events: ScenarioEvent[] | null | undefined, updatedAt: string): string {
  if (!events || events.length === 0) {
    return `Created ${formatRelativeTime(updatedAt)}`
  }
  const lastEvent = events[events.length - 1]
  const details = lastEvent.details ?? {}

  switch (lastEvent.event_type) {
    case 'analysis_run':
      if (details.winner && details.probability != null) {
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
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="bg-panel rounded-[20px] shadow-3 p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={`${typography.h4} text-text-header`}>Delete decision</h3>
        <p className={`${typography.body} text-text-body mt-2`}>
          This will permanently delete &ldquo;{scenarioTitle}&rdquo; and its analysis. This cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className={`${typography.button} px-4 py-2 rounded-pill border border-[rgba(38,38,38,0.16)] text-text-body hover:bg-panel-hover transition-colors duration-fast`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`${typography.button} px-4 py-2 rounded-pill bg-danger text-text-on-color hover:bg-danger-hover transition-colors duration-fast`}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card action menu (three-dot)
// ---------------------------------------------------------------------------

function CardActionMenu({
  scenario,
  onPin,
  onArchive,
  onDuplicate,
  onDelete,
}: {
  scenario: ScenarioListItem
  onPin: () => void
  onArchive: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className="p-1.5 rounded-md text-text-light hover:text-text-body hover:bg-panel-hover opacity-0 group-hover:opacity-100 transition-all duration-fast"
        aria-label="Actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-40 rounded-md bg-panel shadow-2 border border-[rgba(38,38,38,0.08)] z-[100] py-1"
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          <button role="menuitem" onClick={() => { onPin(); setOpen(false) }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-panel-hover ${typography.bodySmall} text-text-body`}>
            <Pin className="w-3.5 h-3.5" />
            {scenario.is_pinned ? 'Unpin' : 'Pin'}
          </button>
          <button role="menuitem" onClick={() => { onDuplicate(); setOpen(false) }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-panel-hover ${typography.bodySmall} text-text-body`}>
            <Copy className="w-3.5 h-3.5" />
            Duplicate
          </button>
          <button role="menuitem" onClick={() => { onArchive(); setOpen(false) }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-panel-hover ${typography.bodySmall} text-text-body`}>
            {scenario.is_archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
            {scenario.is_archived ? 'Unarchive' : 'Archive'}
          </button>
          <hr className="my-1 border-[rgba(38,38,38,0.08)]" />
          <button role="menuitem" onClick={() => { onDelete(); setOpen(false) }}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-panel-hover ${typography.bodySmall} text-danger`}>
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ScenarioListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2" data-testid="scenario-list-skeleton">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-6 rounded-[20px] bg-panel shadow-1 space-y-3">
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
  const [filter, setFilter] = useState<HubFilter>('active')

  const fetchScenarios = useCallback(async () => {
    if (!isPersistenceActive || !user) return
    setLoading(true)
    setError(null)
    try {
      const list = await scenarioService.listScenarios(user.id)
      setScenarios(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load decisions')
    } finally {
      setLoading(false)
    }
  }, [isPersistenceActive, user])

  useEffect(() => { fetchScenarios() }, [fetchScenarios])

  // Re-fetch on tab focus
  useEffect(() => {
    const handler = () => { if (document.visibilityState === 'visible') fetchScenarios() }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [fetchScenarios])

  // Filter scenarios
  const filteredScenarios = useMemo(() => {
    switch (filter) {
      case 'active':
        return scenarios.filter(s => !s.is_archived)
      case 'archived':
        return scenarios.filter(s => s.is_archived)
      default:
        return scenarios
    }
  }, [scenarios, filter])

  const handleCreate = async () => {
    setCreating(true)
    try {
      await createScenario()
      trackEvent('scenario_created', {})
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create decision')
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
      setScenarios(prev => prev.filter(s => s.id !== deleteTarget.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete decision')
    } finally {
      setDeleting(false)
    }
  }

  const handlePin = async (scenario: ScenarioListItem) => {
    const next = !scenario.is_pinned
    // Optimistic update
    setScenarios(prev => prev.map(s => s.id === scenario.id ? { ...s, is_pinned: next } : s))
    try {
      await scenarioService.pinScenario(scenario.id, next)
    } catch {
      // Revert on failure
      setScenarios(prev => prev.map(s => s.id === scenario.id ? { ...s, is_pinned: !next } : s))
    }
  }

  const handleArchive = async (scenario: ScenarioListItem) => {
    const next = !scenario.is_archived
    setScenarios(prev => prev.map(s => s.id === scenario.id ? { ...s, is_archived: next } : s))
    try {
      await scenarioService.archiveScenario(scenario.id, next)
    } catch {
      setScenarios(prev => prev.map(s => s.id === scenario.id ? { ...s, is_archived: !next } : s))
    }
  }

  const handleDuplicate = async (scenario: ScenarioListItem) => {
    try {
      await scenarioService.duplicateScenario(scenario.id)
      trackEvent('scenario_created', { source: 'duplicate' })
      await fetchScenarios()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate decision')
    }
  }

  // Guest mode — redirect to login
  if (!isPersistenceActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas p-8">
        <div className="text-center max-w-md">
          <h1 className={`${typography.h3} text-text-header`}>Decisions</h1>
          <p className={`${typography.body} text-text-body mt-4`}>
            Sign in to save and manage your decisions.
          </p>
          <button
            onClick={() => navigate('/login')}
            className={`${typography.button} mt-6 px-6 py-3 rounded-pill bg-primary text-text-on-color shadow-1 hover:bg-primary-hover transition-all duration-fast`}
          >
            Sign in
          </button>
        </div>
      </div>
    )
  }

  const isFirstRun = !loading && scenarios.length === 0 && !error

  return (
    <div className="min-h-screen bg-canvas">
      {/* Hub header — minimal, with logo and avatar */}
      <header className="flex items-center justify-between px-6 py-4 sm:px-8">
        <a href="/" aria-label="Olumi home">
          <img src="/olumi-logo.png" alt="Olumi" className="h-8" />
        </a>
        <UserAvatarMenu />
      </header>

      <main className="max-w-3xl mx-auto px-6 pb-12 sm:px-8">
        {isFirstRun ? (
          /* ---- First-run welcome ---- */
          <div className="text-center py-20" data-testid="first-run">
            <h2 className={`${typography.h2} text-text-header`}>Welcome to Olumi</h2>
            <p className={`${typography.body} text-text-light mt-3 max-w-md mx-auto`}>
              Describe a decision you're facing and we'll build a model to help you think it through.
            </p>
            <button
              onClick={handleCreate}
              disabled={creating}
              className={`${typography.button} mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-pill bg-primary text-text-on-color shadow-1 hover:bg-primary-hover hover:-translate-y-px active:bg-primary-active active:translate-y-0 disabled:bg-primary-disabled disabled:cursor-not-allowed transition-all duration-fast`}
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Start a new decision
            </button>
          </div>
        ) : (
          <>
            {/* ---- Header row ---- */}
            <div className="flex items-center justify-between mb-6 mt-4">
              <h3 className={`${typography.h3} text-text-header`}>My decisions</h3>
              <button
                onClick={handleCreate}
                disabled={creating}
                className={`${typography.button} inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-primary text-text-on-color shadow-1 hover:bg-primary-hover hover:-translate-y-px active:bg-primary-active active:translate-y-0 disabled:bg-primary-disabled disabled:cursor-not-allowed transition-all duration-fast`}
              >
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                New decision
              </button>
            </div>

            {/* ---- Filter tabs ---- */}
            <div className="flex gap-1 mb-6" role="tablist">
              {(['active', 'archived', 'all'] as const).map(tab => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={filter === tab}
                  onClick={() => setFilter(tab)}
                  className={`${typography.label} px-3 py-1.5 rounded-pill transition-colors duration-fast ${
                    filter === tab
                      ? 'bg-panel shadow-1 text-text-header'
                      : 'text-text-light hover:text-text-body'
                  }`}
                >
                  {tab === 'active' ? 'Active' : tab === 'archived' ? 'Archived' : 'All'}
                </button>
              ))}
            </div>

            {/* ---- Error banner ---- */}
            {error && (
              <div className="mb-4 p-3 rounded-md bg-danger-light text-danger flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span className={typography.bodySmall}>{error}</span>
                <button onClick={fetchScenarios} className={`${typography.bodySmall} ml-auto underline hover:no-underline`}>
                  Retry
                </button>
              </div>
            )}

            {/* ---- Loading skeleton ---- */}
            {loading && scenarios.length === 0 && <ScenarioListSkeleton />}

            {/* ---- Empty state per filter ---- */}
            {!loading && filteredScenarios.length === 0 && !error && scenarios.length > 0 && (
              <div className="text-center py-16">
                <p className={`${typography.body} text-text-light`}>
                  {filter === 'active'
                    ? 'No active decisions. Start a new one or check your archive.'
                    : filter === 'archived'
                      ? 'No archived decisions.'
                      : 'No decisions yet.'}
                </p>
              </div>
            )}

            {/* ---- Scenario cards ---- */}
            {filteredScenarios.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2" data-testid="scenario-list">
                {filteredScenarios.map((scenario) => (
                  <div
                    key={scenario.id}
                    onClick={() => {
                      trackEvent('scenario_opened', { scenario_id: scenario.id, stage: scenario.stage })
                      navigate(`/scenario/${scenario.id}`)
                    }}
                    className="relative p-6 rounded-[20px] bg-panel shadow-1 hover:shadow-2 hover:-translate-y-0.5 cursor-pointer transition-all duration-fast group"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/scenario/${scenario.id}`) }}
                    data-testid="scenario-card"
                  >
                    {/* Top-right: pin + action menu */}
                    <div className="absolute top-4 right-4 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handlePin(scenario) }}
                        className={`p-1 rounded-md transition-colors duration-fast ${
                          scenario.is_pinned
                            ? 'text-primary'
                            : 'text-text-light opacity-0 group-hover:opacity-100 hover:text-text-body'
                        }`}
                        aria-label={scenario.is_pinned ? 'Unpin' : 'Pin'}
                      >
                        <Pin className={`w-3.5 h-3.5 ${scenario.is_pinned ? 'fill-current' : ''}`} />
                      </button>
                      <CardActionMenu
                        scenario={scenario}
                        onPin={() => handlePin(scenario)}
                        onArchive={() => handleArchive(scenario)}
                        onDuplicate={() => handleDuplicate(scenario)}
                        onDelete={() => setDeleteTarget(scenario)}
                      />
                    </div>

                    {/* Title */}
                    <h4 className={`${typography.h4} text-text-header pr-16 truncate`}>
                      {scenario.title || <span className="text-text-light">Untitled decision</span>}
                    </h4>

                    {/* Stage badge + analysis status */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`${typography.panelMeta} inline-flex items-center rounded-pill px-2.5 py-0.5 font-medium ${stageStyles[scenario.stage]}`}>
                        {stageLabels[scenario.stage]}
                      </span>
                      <AnalysisStatusIcon status={scenario.analysis_status} />
                    </div>

                    {/* Last activity */}
                    <p className={`${typography.bodySmall} text-text-light mt-3 truncate`}>
                      {formatLastActivity(scenario.events, scenario.updated_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteConfirmDialog
          scenarioTitle={deleteTarget.title || 'Untitled decision'}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
