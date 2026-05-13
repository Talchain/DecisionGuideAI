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
import { useAnalysisStatus } from '../../hooks/useAnalysisReady'
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

  // Filter rule (V5 active):
  //   action_type === 'run_analysis' → gated by analysisStatus === 'ready'
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
        if (needsReadiness && analysisStatus !== 'ready') return false
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
        analysisStatus !== 'ready',
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

  // DS v5 §21.4: max 2 suggested action chips
  const visible = supported.filter(c => !!(c.message || c.prompt)).slice(0, 2)
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
