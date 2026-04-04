/**
 * SuggestedChips — stagger-animated action chips after AI messages.
 *
 * Each chip fades in + slides up with 70ms delay between.
 * Up to 4 chips (0-3 suggested actions by default). DS v5 §21.4.
 * Chip base: bg-panel, border border-panel-border, hover:bg-panel-hover.
 * Role dot (8px, DS main colour): facilitator=info, challenger=danger, scientist=goal.
 * Missing/unknown role renders chip without dot (graceful fallback).
 *
 * In-flight behaviour: when isThinking=true all chips in this turn are disabled
 * (greyed out, not clickable). Re-enabled if request fails.
 * Historical chips (isHistorical=true) are visible but non-interactive.
 *
 * Click failures show a brief inline error that auto-dismisses after 5s.
 *
 * Feature flag: ORCHESTRATOR_RENDERING_V2
 * When OFF: legacy behaviour (no role dots, no in-flight disable, max 2 visible).
 */

import { useState, useEffect } from 'react'
import { typography } from '../../../styles/typography'
import { isOrchestratorRenderingV2Enabled } from '../../../flags'
import type { ActionChip } from '../types'

interface SuggestedChipsProps {
  chips: ActionChip[]
  onChipClick: (chip: ActionChip) => Promise<void>
  /** When true, all chips are disabled while a response is pending */
  isThinking?: boolean
  /**
   * When true, this turn's chips are historical (a newer response has arrived).
   * Historical chips are visible but non-interactive.
   */
  isHistorical?: boolean
}

// ---------------------------------------------------------------------------
// Role dot colour map (DS v5 §21.4 + §21.2 block type badge pattern)
// 8px diameter, main colour fill, no border.
// ---------------------------------------------------------------------------

type KnownRole = 'facilitator' | 'challenger' | 'scientist'

const ROLE_DOT_CLASS: Record<KnownRole, string> = {
  facilitator: 'bg-info',
  challenger: 'bg-danger',
  scientist: 'bg-goal',
}

function getRoleDotClass(role: string | undefined): string | null {
  if (!role) return null
  return ROLE_DOT_CLASS[role as KnownRole] ?? null
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
  const v2 = isOrchestratorRenderingV2Enabled()
  const [chipError, setChipError] = useState<string | null>(null)

  // Render-level filter: never show a chip that can't dispatch.
  // P1-3: Historical (greyed-out) chips are removed entirely — no false affordance.
  // v2: up to 3 chips (aligned with CEE chip-builder MAX_CHIPS=3). Legacy: cap at 2.
  if (isHistorical) return null
  const visible = chips.filter(c => !!(c.message || c.prompt)).slice(0, v2 ? 3 : 2)
  if (visible.length === 0) return null

  // Auto-dismiss chip error after 5s
  useEffect(() => {
    if (!chipError) return
    const timer = setTimeout(() => setChipError(null), 5_000)
    return () => clearTimeout(timer)
  }, [chipError])

  // In-flight disable is a v2 feature. Legacy path must remain clickable
  // during isThinking to preserve current behaviour when the flag is off.
  const disabled = v2 ? (isThinking || isHistorical) : false

  function handleClick(chip: ActionChip) {
    if (disabled) return
    setChipError(null)
    onChipClick(chip).catch(() => {
      setChipError("That didn't work. Try typing your request instead.")
    })
  }

  if (!v2) {
    // Legacy layout: vertical flex, no role dots, no in-flight disable
    return (
      <div className="flex flex-col self-start" style={{ gap: 4, marginBottom: 8 }}>
        <div className="flex flex-wrap" style={{ gap: 6, marginTop: 16 }} data-testid="suggested-chips">
          {visible.map((chip, i) => (
            <button
              key={chip.id ?? `chip-${i}`}
              type="button"
              onClick={() => handleClick(chip)}
              className={`suggested-chip chip-stagger-in bg-transparent border border-panel-border hover:bg-panel-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info text-text-body cursor-pointer ${typography.bodySmall}`}
              style={{
                padding: '5px 12px',
                borderRadius: 999,
                fontFamily: 'inherit',
                transition: 'all 150ms ease',
                animationDelay: `${i * 70}ms`,
              }}
              data-testid={`suggested-chip-${chip.id}`}
            >
              {chip.label}
            </button>
          ))}
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
          .suggested-chip:active {
            transform: scale(0.97);
            opacity: 0.85;
          }
          @media (prefers-reduced-motion: reduce) {
            .chip-stagger-in { animation: none; opacity: 1; }
            .suggested-chip:active { transform: none; }
          }
        `}</style>
      </div>
    )
  }

  // v2 layout: horizontal flex-wrap, role dots, in-flight disable
  return (
    <div className="flex flex-col self-start" style={{ gap: 4, marginBottom: 8 }}>
      <div
        className="flex flex-wrap"
        style={{ gap: 8, marginTop: 16 }}
        data-testid="suggested-chips"
      >
        {visible.map((chip, i) => {
          const dotClass = getRoleDotClass(chip.role)
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
                'suggested-chip-v2 chip-stagger-in',
                'inline-flex items-center gap-1.5',
                'bg-panel border border-panel-border',
                'hover:bg-panel-hover',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info',
                'text-text-body cursor-pointer',
                typography.bodySmall,
                disabled ? 'opacity-40 cursor-not-allowed disabled:hover:bg-panel' : '',
              ].join(' ')}
              style={{
                padding: '5px 12px',
                borderRadius: 999,
                fontFamily: 'inherit',
                transition: 'all 150ms ease',
                animationDelay: `${i * 70}ms`,
              }}
              data-testid={`suggested-chip-${chip.id}`}
              data-chip-role={chip.role ?? undefined}
            >
              {dotClass && (
                <span
                  className={`inline-block rounded-full flex-shrink-0 ${dotClass}`}
                  style={{ width: 8, height: 8 }}
                  aria-hidden="true"
                  data-testid={`chip-role-dot-${chip.id}`}
                />
              )}
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
        .suggested-chip-v2:not(:disabled):active {
          transform: scale(0.97);
          opacity: 0.85;
        }
        @media (prefers-reduced-motion: reduce) {
          .chip-stagger-in { animation: none; opacity: 1; }
          .suggested-chip-v2:not(:disabled):active { transform: none; }
        }
      `}</style>
    </div>
  )
}
