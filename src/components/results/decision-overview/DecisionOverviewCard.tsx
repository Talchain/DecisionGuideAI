/**
 * Wave 1 — Decision overview card (brief §4): the orientation surface.
 *
 * Owns framing quality (the four canonical dimensions), ONE producer-backed
 * framing question, and hosts the persistent Actions menu. It shows no
 * analysis outcomes (§4.1). Four-state machine; only ready and needs-input
 * are reachable live (analysis_ready.status) — thin / contradictory /
 * unverified render only via stateOverride for the fixture gallery (plan
 * review B3: fixture states never mount dark on product). No decision
 * classification pills (contract-absent; deferred to Wave 5).
 *
 * DS v4/5: bg-panel card, panel typography tokens only, Lucide, sentence
 * case, en-GB, no em dashes in prose.
 */
import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, HelpCircle } from 'lucide-react'

import { useCanvasStore } from '../../../canvas/store'
import { useGuidanceStore, selectTopItem } from '../../../canvas/stores/guidanceStore'
import { isDecisionOverviewEnabled } from '../../../flags'
import { typography } from '../../../styles/typography'
import { ActionsMenu } from './ActionsMenu'

export type BriefStateOverride = 'thin' | 'contradictory' | 'unverified'

type BriefState = 'ready' | 'needs_input' | BriefStateOverride

export const OVERVIEW_COPY = {
  metaLabel: 'Decision overview',
  ready: 'Framing has the basics',
  readyNote: 'Goal, context, constraints and options',
  needsInput: 'Olumi needs a little more from you',
  needsInputNote: 'Answer the questions below to sharpen the framing',
  thin: 'Framing needs one clarification',
  thinNote: 'The goal is broad or important context is missing',
  contradictory: 'The brief contains a conflict',
  contradictoryNote: 'Resolve it before relying on the read',
  unverified: 'One claim in the brief is unverified',
  unverifiedNote: 'Add a source, correct it or confirm it',
  framingLabel: "Olumi's framing question",
  workThrough: 'Work through with Olumi',
} as const

const STATE_COPY: Record<BriefState, { line: string; note: string }> = {
  ready: { line: OVERVIEW_COPY.ready, note: OVERVIEW_COPY.readyNote },
  needs_input: { line: OVERVIEW_COPY.needsInput, note: OVERVIEW_COPY.needsInputNote },
  thin: { line: OVERVIEW_COPY.thin, note: OVERVIEW_COPY.thinNote },
  contradictory: { line: OVERVIEW_COPY.contradictory, note: OVERVIEW_COPY.contradictoryNote },
  unverified: { line: OVERVIEW_COPY.unverified, note: OVERVIEW_COPY.unverifiedNote },
}

const DIMENSIONS = ['Goal', 'Context', 'Constraints', 'Options'] as const

export interface DecisionOverviewCardProps {
  title?: string | null
  /** Fixture-gallery-only states (plan review B3) — never set on product. */
  stateOverride?: BriefStateOverride
}

export function DecisionOverviewCard({ title, stateOverride }: DecisionOverviewCardProps) {
  const analysisReady = useCanvasStore((s) => s.ceeAnalysisReady)
  const topGuidance = useGuidanceStore(selectTopItem)
  const sendMessage = useGuidanceStore((s) => s._sendMessage)

  // Live state derivation: ONLY ready / needs-input can fire from the wire
  // (analysis_ready.status). The gallery states arrive via stateOverride.
  const liveState: BriefState =
    analysisReady && analysisReady.status !== 'ready' ? 'needs_input' : 'ready'
  const state: BriefState = stateOverride ?? liveState
  const autoExpand = state !== 'ready'

  const [expanded, setExpanded] = useState(autoExpand)
  useEffect(() => setExpanded(autoExpand), [autoExpand])

  if (!isDecisionOverviewEnabled()) return null

  const copy = STATE_COPY[state]
  const StateIcon =
    state === 'ready' ? CheckCircle2 : state === 'contradictory' ? AlertTriangle : HelpCircle
  const iconTone =
    state === 'ready' ? 'text-text-light' : state === 'contradictory' ? 'text-danger' : 'text-warning'
  const questions = (analysisReady?.user_questions ?? []).slice(0, 3)

  return (
    <section
      data-testid="decision-overview"
      className="rounded-md border border-panel-border bg-panel"
    >
      <div className="flex items-start gap-2 px-3 pt-3">
        <div className="min-w-0 flex-1">
          <p className={`${typography.panelMeta} text-text-light`}>{OVERVIEW_COPY.metaLabel}</p>
          {title ? (
            <h2 className={`${typography.panelHeader} text-text-header truncate`}>{title}</h2>
          ) : null}
        </div>
        <ActionsMenu />
      </div>

      <button
        type="button"
        data-testid="brief-bar"
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
        className="mt-2 flex w-full items-center gap-2 border-t border-panel-border px-3 py-2 text-left hover:bg-panel-hover"
      >
        <StateIcon size={14} className={`flex-none ${iconTone}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className={`${typography.panelBody} block font-semibold text-text-header`}>{copy.line}</span>
          <span className={`${typography.panelMeta} block text-text-light`}>{copy.note}</span>
        </span>
        <ChevronDown
          size={14}
          className={`flex-none text-text-light transition-transform duration-fast ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div className="border-t border-panel-border px-3 py-2">
          <div className="grid grid-cols-2 gap-1.5">
            {DIMENSIONS.map((dim) => (
              <div
                key={dim}
                className="rounded-md border border-panel-border px-2 py-1.5"
                data-testid={`brief-dim-${dim.toLowerCase()}`}
              >
                <span className={`${typography.panelBody} block font-semibold text-text-header`}>{dim}</span>
              </div>
            ))}
          </div>

          {state === 'needs_input' && questions.length > 0 && (
            <ul className="mt-2 space-y-1" data-testid="brief-questions">
              {questions.map((q) => (
                <li key={q} className={`${typography.panelBody} text-text-body`}>
                  {q}
                </li>
              ))}
            </ul>
          )}

          {topGuidance && (
            <div className="mt-2 border-t border-panel-border pt-2" data-testid="framing-question">
              <p className={`${typography.panelMeta} text-text-light`}>{OVERVIEW_COPY.framingLabel}</p>
              <p className={`${typography.panelBody} mt-0.5 text-text-header`}>{topGuidance.title}</p>
              <button
                type="button"
                disabled={!sendMessage}
                onClick={() =>
                  sendMessage?.(
                    // primary_action is a union; only 'discuss' carries a
                    // prompt — fall back to working through the title.
                    topGuidance.primary_action.type === 'discuss'
                      ? topGuidance.primary_action.prompt
                      : `Help me work through: ${topGuidance.title}`,
                  )
                }
                className={`${typography.panelBody} mt-1.5 rounded-pill border border-panel-border px-3 py-1 text-text-body hover:bg-panel-hover disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {OVERVIEW_COPY.workThrough}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
