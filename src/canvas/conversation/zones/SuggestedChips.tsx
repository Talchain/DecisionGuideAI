/**
 * SuggestedChips — stagger-animated action chips after AI messages.
 *
 * Each chip fades in + slides up with 70ms delay between.
 * Up to 2 chips (DS v5 §21.4 cap). Chip base: bg-panel, border
 * border-panel-border, hover:bg-panel-hover. Role metadata preserved via
 * data-chip-role and aria-label for styling/accessibility.
 *
 * In-flight behaviour: when isThinking=true all chips in this turn are disabled
 * (greyed out, not clickable). Re-enabled if request fails.
 * Historical chips (isHistorical=true) are not rendered.
 *
 * Click failures show a brief inline error that auto-dismisses after 5s.
 */

import { useState, useEffect } from 'react'
import { typography } from '../../../styles/typography'
import { isV5Eligible } from '../../../v5/eligibility'
import { logV5StateEvent } from '../../../v5/debugLog'
import { isAiPanelV2Enabled } from '../../../flags'
import { useAnalysisStatus } from '../../hooks/useAnalysisReady'
import { useCanvasStore } from '../../store'
import { classifyFreshnessForDisplay, type FreshnessDisplaySemantic } from '../../store/analysisFreshness'
import type { ActionChip } from '../types'

// Actions that V5 CEE handles end-to-end. Chips whose action_type is set and
// not in this list are filtered out when V5 is active. On V4 this set is
// unused — all chips pass through unchanged.
//
// Phase 2b of the V5 completion plan (2026-05-13): added `explain_results`
// and `what_would_flip`. Backend PR olumi-assistants-service#170 emits these
// as executable `action_type` chips and the new
// `dispatchDeterministicChipClick` path bypasses Sonnet ORIENT (~12s saved
// per click). Without these entries here, the V5 UI's filter below would
// HIDE the new executable chips, defeating the latency fix entirely.
const V5_ENABLED_ACTIONS = new Set<string>([
  'run_analysis',
  'edit_graph',
  'draft_graph',
  'explain_results',
  'what_would_flip',
])

// Chips whose action_type is in this set require analysis readiness
// (ceeAnalysisReady.status === 'ready') before they can render. Without it,
// a click would land on a run_analysis turn that the safety net at
// useConversation.ts:1687 demotes to conversation — visible to the user as
// a chip that promises action and delivers chat.
const READINESS_GATED_ACTIONS = new Set<string>(['run_analysis'])

/**
 * Run-analysis affordance detection. `action_type` is the primary key;
 * the fallback regex catches V4-legacy or prompt-only chips where the
 * `action_type` field is absent. Tolerant of "Run analysis", "Rerun
 * analysis", "Run the analysis", "Rerun the analysis", with or without a
 * trailing period. Conservative enough to NOT match conversational chips
 * like "Explain the analysis" or "What was the analysis?".
 */
const RUN_ANALYSIS_RE = /^(?:run|rerun)\s+(?:the\s+)?analysis\.?$/i

function normForMatch(s: string | undefined): string {
  return (s ?? '').trim()
}

function isRunAnalysisAffordance(chip: ActionChip): boolean {
  if (chip.action_type === 'run_analysis') return true
  return (
    RUN_ANALYSIS_RE.test(normForMatch(chip.label)) ||
    RUN_ANALYSIS_RE.test(normForMatch(chip.message)) ||
    RUN_ANALYSIS_RE.test(normForMatch(chip.prompt))
  )
}

/**
 * Product rule for the run-analysis affordance under aiPanelV2:
 *   - no analysis exists            → keep chip as-is ("Run analysis")
 *   - confirmed-current analysis    → suppress chip entirely
 *   - stale / cannot-confirm        → relabel chip to "Rerun" (may bypass the V5
 *                                     readiness gate — a prior analysis exists and
 *                                     a rerun re-derives inputs from the graph)
 *   - complete, NO freshness verdict→ keep ("Run analysis"), SUBJECT to the gate
 *
 * Two positive-signal branches:
 *   - SUPPRESS requires a CONFIRMED-CURRENT verdict (semantic === 'current').
 *   - the readiness-gate-bypassing 'relabel-rerun' requires a REAL freshness
 *     verdict ('changed' / 'cannot_confirm'), which implies a prior analysis that
 *     a rerun can re-derive from the current graph.
 * A completed analysis with NO freshness verdict ('none') gets neither: it is not
 * confirmed current (so not suppressed — matching useStageAwarePlaceholder, which
 * treats it as not-"latest"), but it has nothing rerunnable to justify bypassing
 * the readiness gate. Relabelling it to "Rerun" would let a run_analysis chip
 * survive the gate even when ceeAnalysisReady is missing, and a click then falls
 * back to a conversation turn ("promises action, delivers chat"). So it stays a
 * plain 'keep' chip, shown only when the readiness gate is satisfied.
 *
 * This replaces the legacy `isStale` from useStaleGuard, whose production input
 * `_internal.graphHash` is never written, so it never fired.
 */
type RunAnalysisPolish = 'suppress' | 'relabel-rerun' | 'keep'

function decideRunAnalysisPolish(
  resultsComplete: boolean,
  freshnessSemantic: FreshnessDisplaySemantic,
): RunAnalysisPolish {
  if (!resultsComplete) return 'keep'                     // no analysis yet
  if (freshnessSemantic === 'current') return 'suppress'  // confirmed-current owns the action
  if (freshnessSemantic === 'changed' || freshnessSemantic === 'cannot_confirm') {
    return 'relabel-rerun'  // real verdict: prior analysis exists → offer rerun (gate-bypassing)
  }
  return 'keep'  // 'none': complete but no verdict → not current, but no rerunnable
                 // analysis to justify a gate bypass; the readiness gate decides visibility
}

interface SuggestedChipsProps {
  chips: ActionChip[]
  onChipClick: (chip: ActionChip) => Promise<void>
  /** When true, all chips are disabled while a response is pending */
  isThinking?: boolean
  /**
   * When true, this turn's chips are historical (a newer response has arrived).
   * Historical chips are not rendered.
   */
  isHistorical?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SuggestedChips({
  chips,
  onChipClick,
  isThinking = false,
  isHistorical = false,
}: SuggestedChipsProps) {
  // All hooks are declared before any conditional return so that the hook
  // count is stable across renders. Downstream conditions (isHistorical,
  // visible.length === 0) use early-return AFTER the hook prelude — this
  // is the rules-of-hooks contract. Readiness transitions
  // (ready → missing, ready → not_ready) flip `visible` emptiness on the
  // fly; hoisting the two subscribers keeps React's dispatcher aligned.
  const [chipError, setChipError] = useState<string | null>(null)
  const analysisStatus = useAnalysisStatus()
  // aiPanelV2 polish: once an analysis has been RUN (results exist), the
  // canonical place for re-running it is the Analysis/readiness panel.
  // Decision is via `decideRunAnalysisPolish` (product rule, see helper above):
  // no analysis → keep; confirmed-current → suppress; stale/cannot-confirm →
  // "Rerun" (gate-bypassing); complete-but-no-verdict → keep (gate decides).
  // `freshnessSemantic` is the shared freshness display semantic, NOT the dead
  // useStaleGuard graph-hash path.
  const ceeFreshness = useCanvasStore((s) => s.analysisFreshness)
  const freshnessDirty = useCanvasStore((s) => s.analysisFreshnessDirty)
  const freshnessSemantic = classifyFreshnessForDisplay(ceeFreshness, freshnessDirty)
  const resultsComplete = useCanvasStore((s) => s.results?.status === 'complete')
  const aiPanelV2On = isAiPanelV2Enabled()
  useEffect(() => {
    if (!chipError) return
    const timer = setTimeout(() => setChipError(null), 5_000)
    return () => clearTimeout(timer)
  }, [chipError])

  // Historical chips removed entirely — no false affordance.
  if (isHistorical) return null

  // Evaluate V5 eligibility per-render so test env overrides (vi.stubEnv)
  // are picked up correctly. import.meta.env is Vite-inlined at build time,
  // but the check is cheap and correctness matters more here.
  const v5Active = isV5Eligible({ flag: import.meta.env.VITE_ENABLE_V5_ORCHESTRATOR }).eligible

  // Compute the run-analysis product state ONCE, then both the V5
  // readiness gate (below) AND the polish-map step downstream branch on
  // the same value. Keeping a single source of truth prevents a future
  // change to either branch from re-introducing "filtered before
  // relabel" behaviour.
  const runAnalysisPolish: RunAnalysisPolish = aiPanelV2On
    ? decideRunAnalysisPolish(resultsComplete, freshnessSemantic)
    : 'keep'

  // Filter rule (V5 active):
  //   action_type === 'run_analysis' → gated by analysisStatus === 'ready',
  //                                    EXCEPT when aiPanelV2 will relabel to
  //                                    "Rerun" (stale/cannot-confirm), in which
  //                                    case the chip must survive the gate so the
  //                                    polish can apply.
  //   action_type absent              → pass through (conversational)
  //   action_type in V5_ENABLED_ACTIONS but NOT readiness-gated → pass through
  //   action_type present but unknown → hide (treat as potentially executable
  //                                     with an unsatisfied gate)
  // On V4 (not V5-active), all chips pass through unchanged.
  const supported = v5Active
    ? chips.filter((c) => {
        if (!c.action_type) return true
        const isV5Known = V5_ENABLED_ACTIONS.has(c.action_type)
        if (!isV5Known) return false
        const needsReadiness = READINESS_GATED_ACTIONS.has(c.action_type)
        if (needsReadiness && analysisStatus !== 'ready') {
          // Single bypass: run_analysis survives when the polish will
          // relabel it. The decision is upstream (`runAnalysisPolish`).
          if (c.action_type === 'run_analysis' && runAnalysisPolish === 'relabel-rerun') {
            return true
          }
          return false
        }
        return true
      })
    : chips
  if (import.meta.env.DEV && v5Active) {
    const removedUnsupported = chips.filter(
      (c) => c.action_type && !V5_ENABLED_ACTIONS.has(c.action_type),
    )
    const removedUnready = chips.filter(
      (c) =>
        c.action_type &&
        V5_ENABLED_ACTIONS.has(c.action_type) &&
        READINESS_GATED_ACTIONS.has(c.action_type) &&
        analysisStatus !== 'ready' &&
        // Mirror the bypass — a chip that survived shouldn't show up as
        // "removed" in the dev log.
        !(c.action_type === 'run_analysis' && runAnalysisPolish === 'relabel-rerun'),
    )
    if (removedUnsupported.length > 0) {
      logV5StateEvent('chip_filter_unsupported', {
        count: removedUnsupported.length,
        action_types: removedUnsupported.map((c) => c.action_type ?? 'null'),
      })
    }
    if (removedUnready.length > 0) {
      logV5StateEvent('chip_filter_unready', {
        count: removedUnready.length,
        action_types: removedUnready.map((c) => c.action_type ?? 'null'),
        analysis_status: analysisStatus,
      })
    }
  }

  // aiPanelV2: apply the product rule to run-analysis affordances.
  // `runAnalysisPolish` was computed once upstream — the V5 filter and
  // this map step both consume the same value so they cannot diverge.
  // Detection covers both V2 chips (action_type === 'run_analysis') and
  // legacy prompt-style chips matched by the canonical regex.
  const polished = aiPanelV2On
    ? supported
        .filter((c) => !(isRunAnalysisAffordance(c) && runAnalysisPolish === 'suppress'))
        .map((c) =>
          isRunAnalysisAffordance(c) && runAnalysisPolish === 'relabel-rerun'
            ? { ...c, label: 'Rerun' }
            : c,
        )
    : supported

  // DS v5 §21.4: max 2 suggested action chips
  const visible = polished.filter(c => !!(c.message || c.prompt)).slice(0, 2)
  if (visible.length === 0) return null

  const disabled = isThinking || isHistorical

  function handleClick(chip: ActionChip) {
    if (disabled) return
    setChipError(null)
    onChipClick(chip).catch(() => {
      setChipError("That didn't work. Try typing your request instead.")
    })
  }

  return (
    <div className="flex flex-col self-start gap-1 mb-4">
      <div
        className="flex flex-wrap gap-2 mt-4"
        data-testid="suggested-chips"
      >
        {visible.map((chip, i) => {
          const roleLabel = chip.role
            ? chip.role.charAt(0).toUpperCase() + chip.role.slice(1)
            : null
          const ariaLabel = roleLabel
            ? `${roleLabel}: ${chip.label}`
            : chip.label

          return (
            <button
              key={chip.id ?? `chip-${i}`}
              type="button"
              onClick={() => handleClick(chip)}
              disabled={disabled}
              aria-label={ariaLabel}
              aria-disabled={disabled}
              className={[
                'suggested-chip chip-stagger-in',
                'inline-flex items-center gap-1.5',
                'bg-panel border border-panel-border rounded-full',
                'px-4 py-2 min-h-[44px]',
                'hover:bg-panel-hover active:bg-panel-border/30',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2',
                'text-text-body cursor-pointer font-sans',
                typography.bodySmall,
                'disabled:opacity-40 disabled:pointer-events-none',
                'transition-colors duration-200',
              ].join(' ')}
              style={{ animationDelay: `${i * 70}ms` }}
              data-testid={`suggested-chip-${chip.id}`}
              data-chip-role={chip.role ?? undefined}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {chipError && (
        <p
          className={`${typography.bodySmall} text-danger`}
          style={{ margin: 0, paddingLeft: 2 }}
          data-testid="chip-error"
        >
          {chipError}
        </p>
      )}

      <style>{`
        @keyframes chipStaggerIn {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .chip-stagger-in {
          animation: chipStaggerIn 250ms cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        .suggested-chip:not(:disabled):active {
          transform: scale(0.97);
          opacity: 0.85;
        }
        @media (prefers-reduced-motion: reduce) {
          .chip-stagger-in { animation: none; opacity: 1; }
          .suggested-chip:not(:disabled):active { transform: none; }
        }
      `}</style>
    </div>
  )
}
