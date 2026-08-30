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
import { GuestDraftImportBanner } from '../components/auth/GuestDraftImportBanner'
import { useScenario } from '../hooks/useScenario'
import * as scenarioService from '../services/scenarioService'
import type { ScenarioListItem, ScenarioStage, AnalysisStatus, ScenarioEvent } from '../types/scenario'
import { SYSTEM_MARKER_EVENT_TYPES } from '../types/scenario'
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
  frame: 'bg-panel text-info',
  ideate: 'bg-panel text-text-body',
  evaluate: 'bg-panel text-warning',
  decide: 'bg-panel text-success',
  optimise: 'bg-panel text-info',
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
  // Walk back past system persistence markers to the last event that represents
  // real user activity. The gated autosave appends a `graph_saved` marker after
  // EVERY graph write, so it is almost always the trailing event — reading
  // events[length-1] blindly would collapse every card to the generic
  // "Updated X ago" and silently lose "Model drafted…" / "Model updated…".
  // The skip-set is derived from the shared source of truth, never hand-listed.
  let lastEvent: ScenarioEvent | undefined
  for (let i = events.length - 1; i >= 0; i--) {
    if (!SYSTEM_MARKER_EVENT_TYPES.has(events[i].event_type)) {
      lastEvent = events[i]
      break
    }
  }
  // Only markers (e.g. a freshly-autosaved scenario with no other activity):
  // fall back to the relative time of the newest marker.
  if (!lastEvent) {
    return `Updated ${formatRelativeTime(events[events.length - 1].timestamp ?? updatedAt)}`
  }
  const details = lastEvent.details ?? {}

  switch (lastEvent.event_type) {
    case 'analysis_run':
      // ROADMAP 1.239: was `Analysis run — ${details.winner} led at N%`, gated
      // on `details.winner` alone and never on the verdict. Deleted rather
      // than gated, for the reason set out in full at renderTimeline.ts's
      // `analysis_run` template: `details.winner` has no writer in this build,
      // and this page holds `ScenarioEvent[]` and nothing else at render time
      // — no report, so no `DecisionVerdict`, so no entitlement to consult.
      // There is no gate to write here, only a claim to stop making.
      //
      // The probe's 0-count for this surface is VACUOUS, not clean: its
      // session was anonymous and the page rendered only the signed-out
      // prompt. Whether any persisted row carries a `winner` is still
      // UNVERIFIED LIVE and needs an authenticated-session probe;
      // residualComparative.scenarioList.spec.tsx supplies the component-level
      // pin the probe could not.
      return 'Analysis run'
    case 'graph_drafted':
      return `Model drafted with ${details.node_count ?? '?'} factors`
    case 'brief_generated':
      /*
       * ⭐ "BRIEF", NOT "DECISION BRIEF" — AND THIS IS A TRUTHFULNESS FIX, NOT A
       * VOCABULARY ONE.
       *
       * The event kind is `brief_generated`. The word "Decision" was added HERE,
       * by this surface, to an artefact whose own name does not carry it.
       *
       * ⚠ AND SINCE CEE #1110 (`aa134eac`, live on deployed `c24bfe37`) IT IS
       * SOMETIMES FALSE. That change made the runtime accept OPEN STRATEGIC
       * CHALLENGES — a statement of a problem with no decision verb drafts a
       * model. A user who brought one has no decision, so a card telling them
       * their "Decision brief" is ready names something they never had. Before
       * #1110 every scenario was a decision and this string was merely
       * inconsistent; it is now capable of being wrong.
       *
       * Its own siblings already agree: this switch's `graph_drafted` and
       * `patch_accepted` arms say "Model …", and `renderTimeline`'s neighbouring
       * `brief_shared` says plain "Brief shared" — the same artefact, two lines
       * apart, without the word.
       *
       * ⚠ SCOPE. One user-facing string on a mounted landing page. NOT a rename
       * of the internal `decision_brief` carrier, which is the producer's name
       * for its own payload and must keep it; and NOT `renderTimeline.ts`'s
       * identical line, which serves the Journey surface — derived dark at this
       * tip (`VITE_FEATURE_JOURNEY_TAB` absent from the build config, contrast:
       * 41 other `VITE_` keys present), so changing it would be invisible work.
       */
      return 'Brief generated'
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
  const { user, authenticated, sessionRestoreFailed } = useAuth()
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

  // ⚠⚠ A RETURNING USER WHOSE SESSION COULD NOT BE RESTORED IS NOT A NEW
  // VISITOR, AND MUST NOT BE GREETED AS ONE. This branch used to be the ONLY
  // thing an unrecognised visitor could see, so a signed-in owner whose token
  // refresh failed landed on "This is an invite-only pilot" — an introduction,
  // addressed to someone who has never been here, with no error and no hint
  // that anything went wrong. They cannot tell that from having been silently
  // logged out and losing their work, and the reasonable conclusion is the
  // alarming one.
  //
  // So the failure is STATED. Both doors stay open — sign in again, or carry on
  // as a guest — because the guest path is the supported pilot experience and
  // this must not become a gate. `AuthContext.sessionRestoreFailed` is `false`
  // for anyone who never had a session, so a genuine first-time visitor is
  // untouched by this and still gets the arrival screen below.
  if (!isPersistenceActive && sessionRestoreFailed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas p-8">
        <div className="text-center max-w-md" data-testid="session-restore-failed">
          <h1 className={`${typography.h3} text-text-header`}>You’ve been signed out</h1>
          <p className={`${typography.body} text-text-body mt-4`}>
            We couldn’t restore your session — it may have expired. Sign in again to get back to your models.
          </p>
          {/* ⚠ NO REASSURANCE ABOUT WHERE THE WORK IS. The sentence that wants
              to be written here — "nothing is lost, your models are on our
              servers, not in this browser" — is a positive storage-location
              claim, and `src/test/guestStorageClaims.ts` bans those for the
              reason that they keep turning out to be false in one half. The
              honest offer is the ACTION: sign in again. */}
          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className={`${typography.button} px-6 py-3 rounded-pill bg-primary text-text-on-color shadow-1 hover:bg-primary-hover transition-all duration-fast`}
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/canvas')}
              className={`${typography.button} px-6 py-3 rounded-pill border border-[rgba(38,38,38,0.16)] text-text-body hover:bg-panel-hover transition-colors duration-fast`}
            >
              Continue without an account
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Guest mode — offer sign-in (primary) and a guest path into the canvas
  // (secondary). Guest mode is the POC's primary flow and #/canvas works fully
  // as guest, so this branch must never be a dead end.
  //
  // ⚠⚠ AND MY OWN REPLACEMENT WAS FALSE TOO. #841 put "Sign in to create a saved
  // workspace." here. The mechanism is now settled: a guest's model is stored on
  // OLUMI'S SERVERS and re-fetched every load from a 36-byte UUID pointer — so it
  // is ALREADY saved, and an invitation to sign in "to save" tells the user their
  // work is at risk when it is not. I fixed one falsehood and shipped another in
  // the same sentence, which is why the licensed wording is now pinned centrally
  // rather than reasoned out per surface.
  //
  // ⚠ THE COPY MAKES NO CLAIM ABOUT WHERE GUEST WORK LIVES, deliberately.
  // A previous version read "Without an account, your work stays only in this
  // browser." Both halves were wrong at once:
  //   · "stays" asserts persistence the product does not guarantee — there is a
  //     settling window in which a guest's work is not yet durable;
  //   · "only in this browser" is a PRIVACY claim, and it is false: a guest's
  //     graph also exists server-side.
  // The second is the worse half. A reader takes "only in this browser" to mean
  // nothing leaves their machine, and that is not what happens.
  //
  // The remedy is not a more carefully hedged sentence about storage. First use
  // should say what Olumi IS and how to begin; the storage boundary is System A's
  // to define and is not settled enough to promise here. So the sign-in benefit
  // is stated plainly and nothing is claimed about the guest path.
  if (!isPersistenceActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas p-8">
        <div className="text-center max-w-md">
          <h1 className={`${typography.h3} text-text-header`}>Strategic reasoning</h1>
          <p className={`${typography.body} text-text-body mt-4`}>
            Olumi turns messy strategic work into a living visual model while keeping your judgement visible.
          </p>
          {/* ⚠⚠ THIS SENTENCE USED TO INVITE AN ACTION THE PRODUCT CANNOT
              PERFORM. It read "Sign up to keep your models across devices."
              There is no sign-up: the route table is `/login`, `/auth/callback`,
              `/brief/:slug`, `/panel/:round_id` plus the AuthGuard block
              (`poc/AppPoC.tsx`), with no `/signup` and no `/register`, and
              `AuthContext`'s `signUp` is a `legacyNoOp` since password auth was
              removed. `LoginPage` states the reality — "This is an invite-only
              pilot" — and deliberately ships NO sign-up and NO password reset
              ("Owners are pre-provisioned; the absence of a self-serve path is a
              decision, not an oversight"). So the arrival screen was sending an
              unguided colleague to look for a door that is not there, while the
              page they landed on said the opposite.

              ⚠ AND WHAT THIS COPY DELIBERATELY STILL DOES NOT SAY. The obvious
              replacement — "without an account your work stays only in this
              browser" — is FALSE and is BANNED by `test/guestStorageClaims.ts`.
              The mechanism is settled and server-side: a guest's model lives on
              Olumi's servers and is re-fetched every load from a 36-byte UUID
              pointer. That module's standing rule is to avoid positive
              storage-location claims altogether, so this says nothing about
              storage and names only what a guest demonstrably does not get.

              Both losses are derived from the gate, not guessed: TopBar renders
              "Ask your team" only for `panelScenarioId`, and the share control
              only for `shareScenarioId`, and CanvasMVP passes each as
              `isPersistenceActive && currentScenarioId ? … : null`. */}
          <p className={`${typography.bodySmall} text-text-light mt-3`}>
            This is an invite-only pilot. Sign in if you have an account.
          </p>
          <p className={`${typography.caption} text-text-light mt-2`}>
            Without one you can still build a model, but “Ask your team” and shareable links are unavailable.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className={`${typography.button} px-6 py-3 rounded-pill bg-primary text-text-on-color shadow-1 hover:bg-primary-hover transition-all duration-fast`}
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/canvas')}
              className={`${typography.button} px-6 py-3 rounded-pill border border-[rgba(38,38,38,0.16)] text-text-body hover:bg-panel-hover transition-colors duration-fast`}
            >
              Continue without an account
            </button>
          </div>
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
        {/* Login 3.4: one-time guest-draft import offer (flag-gated dark).
            Above the first-run ternary deliberately — a guest who signs in
            fresh has zero scenarios, so the draft offer must survive the
            welcome state. NO wrapper element: the banner returns null when
            no offer is due, so flag-off renders zero extra DOM (review S1 —
            an unconditional wrapper shifted the first-run state 16px). */}
        <GuestDraftImportBanner />
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
              <div className="mb-4 p-3 rounded-md bg-panel text-danger flex items-center gap-2">
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
