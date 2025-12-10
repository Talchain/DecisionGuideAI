import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, GitBranch, Activity, PlayCircle } from 'lucide-react'
import { useDockState } from '../hooks/useDockState'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useCanvasStore } from '../store'
import { useEngineLimits } from '../hooks/useEngineLimits'
import { deriveLimitsStatus } from '../utils/limitsStatus'
import { buildHealthStrings } from '../utils/graphHealthStrings'
import { typography } from '../../styles/typography'
import { Collapsible } from '../../components/Collapsible'
import { EmptyState } from './EmptyState'

type InputsDockTab = 'documents' | 'scenarios' | 'limits'

interface InputsDockState {
  isOpen: boolean
  activeTab: InputsDockTab
}

interface InputsDockProps {
  onShowDocuments?: () => void
  currentNodes?: number
  currentEdges?: number
  renderDocumentsTab?: () => JSX.Element
}

function FramingSection() {
  // React #185 FIX: Use shallow comparison for object selector
  const framing = useCanvasStore(s => s.currentScenarioFraming)
  const updateFraming = useCanvasStore(s => s.updateScenarioFraming)
  const [showAdvanced, setShowAdvanced] = useState(() =>
    Boolean(framing?.constraints || framing?.risks || framing?.uncertainties)
  )

  const hasCoreFraming = Boolean(framing?.title || framing?.goal || framing?.timeline)

  const handleChange = (field: 'title' | 'goal' | 'timeline' | 'constraints' | 'risks' | 'uncertainties') =>
    (event: any) => {
      updateFraming({ [field]: event.target.value } as any)
    }

  return (
    <section
      aria-label="Decision framing"
      data-testid="framing-section"
      className="space-y-4"
    >
      <Collapsible
        title="Framing"
        description="Capture the decision, goal, and timing so each scenario stays grounded."
        defaultOpen={!hasCoreFraming}
        className="space-y-2"
        bodyClassName="mt-2 space-y-4"
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="framing-title" className={`block ${typography.code} font-medium text-ink-900`}>
              Decision or question
            </label>
            <input
              id="framing-title"
              type="text"
              className={`w-full rounded border border-sand-300 px-2 py-1 ${typography.caption} text-ink-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
              value={framing?.title ?? ''}
              onChange={handleChange('title')}
              placeholder="What decision are you making?"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="framing-goal" className={`block ${typography.code} font-medium text-ink-900`}>
              Primary goal
            </label>
            <textarea
              id="framing-goal"
              rows={2}
              className={`w-full rounded border border-sand-300 px-2 py-1 ${typography.caption} text-ink-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none`}
              value={framing?.goal ?? ''}
              onChange={handleChange('goal')}
              placeholder="What does a good outcome look like?"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="framing-timeline" className={`block ${typography.code} font-medium text-ink-900`}>
              Timeline or horizon
            </label>
            <input
              id="framing-timeline"
              type="text"
              className={`w-full rounded border border-sand-300 px-2 py-1 ${typography.caption} text-ink-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
              value={framing?.timeline ?? ''}
              onChange={handleChange('timeline')}
              placeholder="For example: next quarter, 12–18 months."
            />
          </div>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className={`inline-flex items-center ${typography.code} font-medium text-blue-700 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded`}
            data-testid="framing-toggle-advanced"
          >
            {showAdvanced ? 'Hide extra structure' : 'Add more structure'}
          </button>

          {showAdvanced && (
            <div className="mt-1 space-y-3" data-testid="framing-advanced">
              <div className="space-y-1">
                <label htmlFor="framing-constraints" className={`block ${typography.code} font-medium text-ink-900`}>
                  Constraints
                </label>
                <textarea
                  id="framing-constraints"
                  rows={2}
                  className={`w-full rounded border border-sand-300 px-2 py-1 ${typography.caption} text-ink-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none`}
                  value={framing?.constraints ?? ''}
                  onChange={handleChange('constraints')}
                  placeholder="Key constraints or non-negotiables."
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="framing-risks" className={`block ${typography.code} font-medium text-ink-900`}>
                  Risks
                </label>
                <textarea
                  id="framing-risks"
                  rows={2}
                  className={`w-full rounded border border-sand-300 px-2 py-1 ${typography.caption} text-ink-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none`}
                  value={framing?.risks ?? ''}
                  onChange={handleChange('risks')}
                  placeholder="What could go wrong or be costly?"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="framing-uncertainties" className={`block ${typography.code} font-medium text-ink-900`}>
                  Uncertainties
                </label>
                <textarea
                  id="framing-uncertainties"
                  rows={2}
                  className={`w-full rounded border border-sand-300 px-2 py-1 ${typography.caption} text-ink-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none`}
                  value={framing?.uncertainties ?? ''}
                  onChange={handleChange('uncertainties')}
                  placeholder="Unknowns, assumptions, or information gaps."
                />
              </div>
            </div>
          )}
        </div>
      </Collapsible>
    </section>
  )
}

function formatScenarioRunTime(iso: string | null): string {
  if (!iso) return 'Unknown'

  // Deterministic, timezone-agnostic format: YYYY-MM-DD HH:MM from ISO string
  const safe = iso.trim()
  if (!safe) return 'Unknown'
  if (safe.length >= 16) {
    const base = safe.slice(0, 16) // e.g. 2025-11-18T14:03
    return base.replace('T', ' ')
  }
  return safe
}

function ScenarioRunSummary() {
  const lastHash = useCanvasStore(s => s.currentScenarioLastResultHash)
  const lastRunAt = useCanvasStore(s => s.currentScenarioLastRunAt)
  const lastRunSeed = useCanvasStore(s => s.currentScenarioLastRunSeed)
  const setShowResultsPanel = useCanvasStore(s => s.setShowResultsPanel)

  const hasRunMetadata = Boolean(lastHash || lastRunAt)

  if (!hasRunMetadata) {
    return (
      <section
        aria-label="Scenario run summary"
        className="mt-4"
        data-testid="scenario-run-summary-empty"
      >
        <div className="rounded-lg border border-sand-200 bg-paper-50">
          <EmptyState
            icon={PlayCircle}
            title="Ready to analyze"
            description="Run an analysis to see how your decision model performs with current inputs."
            hint="Results will appear in the Outputs panel"
            className="py-4"
            testId="scenario-run-empty-state"
          />
        </div>
      </section>
    )
  }

  const hashSnippet = lastHash ? `${lastHash.slice(0, 8)}…` : null
  const formattedTime = formatScenarioRunTime(lastRunAt ?? null)

  return (
    <section
      aria-label="Last run for this decision"
      className="mt-4 rounded border border-sand-200 bg-sand-50 px-3 py-2 space-y-1"
      data-testid="scenario-run-summary"
    >
      <div className="flex items-center justify-between">
        <h2 className={`${typography.code} font-semibold text-ink-900 uppercase tracking-wide`}>
          Last run for this decision
        </h2>
        {hashSnippet && (
          <code className={`${typography.code} text-ink-900/80`} aria-label="Last run hash snippet">
            {hashSnippet}
          </code>
        )}
      </div>
      <p className={`${typography.code} text-ink-900/80`}>
        <span className="font-medium text-ink-900">Last run:</span>{' '}
        <span>{formattedTime}</span>
      </p>
      {lastRunSeed && (
        <p className={`${typography.code} text-ink-900/80`}>
          <span className="font-medium text-ink-900">Seed:</span>{' '}
          <span>{lastRunSeed}</span>
        </p>
      )}
      <button
        type="button"
        onClick={() => setShowResultsPanel(true)}
        className={`mt-1 inline-flex items-center px-2 py-1 rounded border border-blue-200 text-blue-700 ${typography.code} font-medium hover:bg-blue-50`}
      >
        Open latest results
      </button>
    </section>
  )
}

function LimitsTabBody({ currentNodes, currentEdges }: { currentNodes: number; currentEdges: number }) {
  const { limits, loading, error, fetchedAt, source, retry } = useEngineLimits()
  // React #185 FIX: Use shallow comparison for object selector
  const graphHealth = useCanvasStore(s => s.graphHealth)

  if (error) {
    const timestamp = fetchedAt ? new Date(fetchedAt).toLocaleString() : 'Unknown'
    return (
      <div className="space-y-2" data-testid="limits-tab-error">
        <p className={`${typography.code} text-carrot-600 font-medium`}>Limits unavailable</p>
        <p className={`${typography.code} text-ink-900/80`}>{error.message}</p>
        <p className={`${typography.code} text-ink-900/60`}>Last attempt: {timestamp}</p>
        <button
          type="button"
          onClick={retry}
          className={`inline-flex items-center px-2 py-1 rounded border border-blue-200 text-blue-700 ${typography.code} font-medium hover:bg-blue-50`}
        >
          Retry fetching limits
        </button>
      </div>
    )
  }

  if (loading || !limits) {
    return (
      <div className="space-y-2" data-testid="limits-tab-loading">
        <p className={`${typography.code} text-ink-900 font-medium`}>Loading limits…</p>
        <p className={`${typography.code} text-ink-900/70`}>Nodes {currentNodes} • Edges {currentEdges}</p>
      </div>
    )
  }

  const limitsStatus = deriveLimitsStatus(limits, currentNodes, currentEdges)
  const nodesPercent = limitsStatus?.nodes.percent ?? 0
  const edgesPercent = limitsStatus?.edges.percent ?? 0
  const timestamp = fetchedAt ? new Date(fetchedAt).toLocaleString() : 'Unknown'
  const sourceLabel = source === 'fallback' ? 'Fallback' : source === 'live' ? 'Live' : 'Unknown'
  const healthView = buildHealthStrings(graphHealth ?? null)

  return (
    <div className="space-y-3" data-testid="limits-tab-body">
      <div className={`space-y-1 ${typography.code} text-ink-900/80`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={`${typography.label} text-ink-900 uppercase tracking-wide`}>Limits and health</h2>
          <button
            type="button"
            className={`${typography.code} text-sky-600 hover:underline`}
            title="A factor is a node in your model and a connection is an edge between nodes. Olumi works best when you stay under roughly 50 factors and 200 connections."
          >
            What counts as a factor?
          </button>
        </div>
        <p className={`${typography.code} text-ink-900/70`}>
          Olumi works best with models under 50 factors and 200 connections.
        </p>
        <p className={`${typography.code} text-ink-900/60`}>
          (Track your model&apos;s complexity as you build.)
        </p>
      </div>

      <div className={`space-y-2 ${typography.code} text-ink-900/80`}>
        <div className="flex items-center justify-between">
          <span className="font-medium">Limits</span>
          <span className="text-ink-900/70">{limitsStatus?.zoneLabel ?? 'Limits unavailable'}</span>
        </div>
        <p className="text-ink-900/70">{limitsStatus?.message ?? 'Limits could not be loaded.'}</p>
      </div>

      <div className={`space-y-1 ${typography.code} text-ink-900/80`}>
        <div className="flex items-center justify-between">
          <span className="font-medium">Nodes</span>
          <span className="tabular-nums text-ink-900">
            {currentNodes} / {limits.nodes.max} ({nodesPercent}%)
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-medium">Edges</span>
          <span className="tabular-nums text-ink-900">
            {currentEdges} / {limits.edges.max} ({edgesPercent}%)
          </span>
        </div>
      </div>

      <div className={`space-y-1 ${typography.code} text-ink-900/80`}>
        <div className="flex items-center justify-between">
          <span className="font-medium">Source</span>
          <span className="text-ink-900/70">{sourceLabel}</span>
        </div>
        <div className="flex items-center justify-between text-ink-900/60">
          <span>Last fetched</span>
          <span>{timestamp}</span>
        </div>
      </div>

      <div className={`space-y-1 ${typography.code} text-ink-900/80`}>
        <div className="font-medium">Health</div>
        <div className="text-ink-900">{healthView.label}</div>
        <div className="text-ink-900/70">{healthView.detail}</div>
      </div>
    </div>
  )
}

const STORAGE_KEY = 'canvas.inputsDock.v1'

const INPUT_TABS: { id: InputsDockTab; label: string }[] = [
  { id: 'documents', label: 'Documents' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'limits', label: 'Limits and health' },
]

export function InputsDock({ onShowDocuments, currentNodes = 0, currentEdges = 0, renderDocumentsTab }: InputsDockProps) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [state, setState] = useDockState<InputsDockState>(STORAGE_KEY, {
    isOpen: true,
    activeTab: 'scenarios',
  })
  const showTemplatesPanel = useCanvasStore(s => s.showTemplatesPanel)
  const wasOpenBeforeTemplates = useRef<boolean | null>(null)

  // Auto-collapse the left dock when Templates is open to free canvas space,
  // and restore the previous open state when Templates closes.
  useEffect(() => {
    if (showTemplatesPanel) {
      setState(prev => {
        if (wasOpenBeforeTemplates.current === null) {
          wasOpenBeforeTemplates.current = prev.isOpen
        }
        if (!prev.isOpen) return prev
        return { ...prev, isOpen: false }
      })
      return
    }

    if (wasOpenBeforeTemplates.current) {
      setState(prev => ({ ...prev, isOpen: true }))
    }
    wasOpenBeforeTemplates.current = null
  }, [showTemplatesPanel, setState])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const value = state.isOpen ? 'var(--dock-left-expanded)' : 'var(--dock-left-collapsed)'
    root.style.setProperty('--dock-left-offset', value)

    return () => {
      root.style.setProperty('--dock-left-offset', '0rem')
    }
  }, [state.isOpen])
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem('panel.documents.width')
      if (!stored) return
      const parsed = Number(stored)
      if (!Number.isFinite(parsed)) return
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0
      if (!viewportWidth) return
      const minWidth = 280
      const maxWidth = Math.min(480, Math.floor(viewportWidth * 0.4))
      const clamped = Math.max(minWidth, Math.min(maxWidth, parsed))
      const root = document.documentElement
      root.style.setProperty('--dock-left-expanded', `${clamped}px`)
    } catch {}
  }, [])
  const transitionClass = prefersReducedMotion ? '' : 'transition-[width] duration-200 ease-in-out'

  const activeLabel = useMemo(
    () => INPUT_TABS.find(tab => tab.id === state.activeTab)?.label ?? '',
    [state.activeTab]
  )

  const toggleOpen = () => {
    setState(prev => ({ ...prev, isOpen: !prev.isOpen }))
  }

  const handleTabClick = (tab: InputsDockTab) => {
    setState(prev => ({ ...prev, isOpen: true, activeTab: tab }))
  }

  const handleResizeStart = (event: any) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    event.preventDefault()

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0
    if (!viewportWidth) return

    const minWidth = 280
    const maxWidth = Math.min(480, Math.floor(viewportWidth * 0.4))
    const root = document.documentElement

    const handleMove = (e: MouseEvent) => {
      const nextWidth = e.clientX
      const clamped = Math.max(minWidth, Math.min(maxWidth, nextWidth))
      root.style.setProperty('--dock-left-expanded', `${clamped}px`)
      try {
        localStorage.setItem('panel.documents.width', String(clamped))
      } catch {}
    }

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }

  return (
    <aside
      className={`${transitionClass} fixed left-0 border-r border-sand-200 bg-paper-50 shadow-panel flex flex-col rounded-b-2xl relative pointer-events-auto`}
      style={{
        width: state.isOpen ? 'var(--dock-left-expanded, 20rem)' : 'var(--dock-left-collapsed, 2.5rem)',
        top: 'var(--topbar-h, 0px)',
        height: 'calc(100vh - var(--topbar-h, 0px) - var(--bottombar-h))',
        maxHeight: 'calc(100vh - var(--topbar-h, 0px) - var(--bottombar-h))',
      }}
      aria-label="Inputs dock"
      data-testid="inputs-dock"
    >
      {state.isOpen && (
        <div
          aria-hidden="true"
          onMouseDown={handleResizeStart}
          className="absolute inset-y-0 right-0 w-1 cursor-col-resize bg-transparent hover:bg-sand-200/60"
        />
      )}
      <div className="sticky top-0 z-10 bg-paper-50 border-b border-sand-200">
        <div className="flex items-center justify-between px-2 py-2">
          <button
            type="button"
            onClick={toggleOpen}
            className={`inline-flex items-center justify-center w-6 h-6 rounded border border-sand-200 ${typography.caption} text-ink-900/70 hover:bg-paper-50`}
            data-testid="inputs-dock-toggle"
            aria-label={state.isOpen ? 'Collapse inputs dock' : 'Expand inputs dock'}
          >
            {state.isOpen ? '<' : '>'}
          </button>
          {state.isOpen && (
            <span className={`ml-2 ${typography.caption} font-medium text-ink-900/70 truncate`} aria-live="polite">
              {activeLabel}
            </span>
          )}
        </div>

        {state.isOpen && (
          <nav
            className="flex gap-1 px-2 py-2 border-t border-sand-200"
            aria-label="Inputs sections"
          >
            {INPUT_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={`flex-1 px-2 py-1 rounded ${typography.caption} font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-info-500 focus-visible:ring-offset-1 ${
                  state.activeTab === tab.id
                    ? 'bg-sky-200 text-sky-600 border-b-2 border-sky-500'
                    : 'text-ink-900/70 hover:bg-paper-50 hover:text-ink-900 border-b-2 border-transparent'
                }`}
                data-testid={tab.id === 'documents' ? 'inputs-dock-tab-documents' : undefined}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {!state.isOpen && (
        <nav
          className="flex flex-col items-center gap-2 py-3"
          aria-label="Inputs sections"
        >
          {INPUT_TABS.map(tab => {
            const Icon =
              tab.id === 'documents' ? FileText : tab.id === 'scenarios' ? GitBranch : Activity
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={`flex items-center justify-center w-7 h-7 rounded-full border ${typography.caption} focus:outline-none focus-visible:ring-2 focus-visible:ring-info-500 focus-visible:ring-offset-1 ${
                  state.activeTab === tab.id
                    ? 'bg-sky-200 text-sky-600 border-sky-500'
                    : 'text-ink-900/70 bg-paper-50 border-sand-200 hover:bg-paper-50 hover:text-ink-900'
                }`}
                aria-label={tab.label}
                title={tab.label}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )
          })}
        </nav>
      )}

      {state.isOpen && (
        <div
          className={`flex-1 px-3 py-3 ${typography.caption} text-ink-900/70 overflow-y-auto`}
          data-testid="inputs-dock-body"
          tabIndex={-1}
        >
          {state.activeTab === 'documents' && (
            renderDocumentsTab ? (
              renderDocumentsTab()
            ) : (
              <div className="space-y-2">
                <p>Source documents and related controls live in the documents manager.</p>
                {onShowDocuments && (
                  <button
                    type="button"
                    onClick={onShowDocuments}
                    className={`inline-flex items-center px-2 py-1 rounded border border-sky-500 text-sky-600 ${typography.caption} font-medium hover:bg-paper-50`}
                    data-testid="inputs-dock-open-documents"
                  >
                    Open documents manager
                  </button>
                )}
              </div>
            )
          )}
          {state.activeTab === 'scenarios' && (
            <>
              <FramingSection />
              <ScenarioRunSummary />
            </>
          )}
          {state.activeTab === 'limits' && (
            <LimitsTabBody currentNodes={currentNodes} currentEdges={currentEdges} />
          )}
        </div>
      )}
    </aside>
  )
}
