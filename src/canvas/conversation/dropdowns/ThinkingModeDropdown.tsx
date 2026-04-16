/**
 * ThinkingModeDropdown — thinking mode selector with node shapes.
 *
 * Uses NodeShape (factor circle = Fast, decision hexagon = Normal,
 * goal diamond = Deep). "Coming soon" badge. Only Normal is interactive.
 * Matches prototype: 14px padding, no header border, 12px mode name.
 */

import { ChevronDown } from 'lucide-react'
import { NodeShape } from '../primitives/NodeShape'
import type { NodeType } from '../../domain/nodes'
import { FlipDropdown } from '../../../components/ui/FlipDropdown'

// ─────────────────────────────────────────────────────────────────────────────
// Mode definitions
// ─────────────────────────────────────────────────────────────────────────────

export type ThinkingMode = 'fast' | 'normal' | 'deep'

interface ModeCard {
  id: ThinkingMode
  shapeKind: NodeType
  label: string
  description: string
  enabled: boolean
}

const MODES: ModeCard[] = [
  { id: 'fast',   shapeKind: 'factor',   label: 'Fast',          description: 'Quick responses for simple decisions',    enabled: false },
  { id: 'normal', shapeKind: 'decision', label: 'Normal',        description: 'Balanced speed and depth',                enabled: true },
  { id: 'deep',   shapeKind: 'goal',     label: 'Deep thinking', description: 'Thorough analysis for complex scenarios', enabled: false },
]

// ─────────────────────────────────────────────────────────────────────────────
// Trigger chip — standard outlined chip, 30px height
// ─────────────────────────────────────────────────────────────────────────────

interface ThinkingModeChipProps {
  selectedMode: ThinkingMode
  onClick: () => void
}

export function ThinkingModeChip({ selectedMode, onClick }: ThinkingModeChipProps) {
  const mode = MODES.find(m => m.id === selectedMode) ?? MODES[1]

  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="true"
      className="top-bar-chip cursor-pointer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 30,
        padding: '0 10px',
        borderRadius: 999,
        background: 'transparent',
        border: '1px solid var(--border-default, #EEE6D8)',
        color: 'var(--text-body, #3F3F3E)',
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: 'nowrap' as const,
        transition: 'all 100ms',
      }}
      data-testid="thinking-mode-chip"
    >
      <span>{mode.label}</span>
      <ChevronDown className="w-3.5 h-3.5 text-text-light" strokeWidth={1.8} aria-hidden="true" />
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Dropdown
// ─────────────────────────────────────────────────────────────────────────────

interface ThinkingModeDropdownProps {
  isOpen: boolean
  onClose: () => void
  selectedMode: ThinkingMode
  onSelectMode: (mode: ThinkingMode) => void
  anchorRef: React.RefObject<HTMLElement | null>
}

export function ThinkingModeDropdown({
  isOpen, onClose, selectedMode, onSelectMode, anchorRef,
}: ThinkingModeDropdownProps) {
  return (
    <FlipDropdown
      isOpen={isOpen}
      onClose={onClose}
      anchorRef={anchorRef}
      align="right"
      ariaLabel="Thinking mode"
      className="bg-panel"
      style={{
        padding: 14,
        minWidth: 240,
        borderRadius: 12,
        border: '1px solid var(--border-default, #EEE6D8)',
        boxShadow: '0 8px 24px rgba(38,38,38,0.14)',
        animation: 'thinkingModeIn 150ms cubic-bezier(0.0, 0, 0.2, 1) both',
      }}
      testId="thinking-mode-dropdown"
    >
      {/* Header */}
      <div className="flex items-center" style={{ gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-header, #262626)' }}>Thinking mode</span>
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-light, #908D8D)',
            padding: '2px 8px',
            borderRadius: 999,
            border: '1px solid var(--border-default, #EEE6D8)',
            lineHeight: 1.4,
          }}
        >
          Coming soon
        </span>
      </div>

      {/* Mode options */}
      {MODES.map(mode => {
        const isSelected = mode.id === selectedMode
        return (
          <button
            key={mode.id}
            type="button"
            role="menuitem"
            disabled={!mode.enabled}
            onClick={() => { if (mode.enabled) { onSelectMode(mode.id); onClose() } }}
            className="w-full text-left"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 11px',
              borderRadius: 12,
              border: mode.enabled && isSelected
                ? '1px solid rgba(82,163,200,0.4)'
                : '1px solid var(--border-default, #EEE6D8)',
              background: mode.enabled && isSelected ? 'var(--bg-panel-hover, #FEF9F3)' : 'transparent',
              marginBottom: 4,
              opacity: !mode.enabled ? 0.4 : 1,
              cursor: !mode.enabled ? 'default' : 'pointer',
              transition: 'all 200ms',
            }}
            data-testid={`thinking-mode-${mode.id}`}
          >
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                background: 'var(--bg-panel, #FEFEFE)',
                border: '1px solid var(--border-default, #EEE6D8)',
              }}
            >
              <NodeShape kind={mode.shapeKind} size={14} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-header, #262626)' }}>{mode.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-light, #908D8D)', marginTop: 1, lineHeight: 1.35 }}>{mode.description}</div>
            </div>
          </button>
        )
      })}

      {/* Footer */}
      <p style={{ fontSize: 11, color: 'var(--text-light, #908D8D)', marginTop: 8, lineHeight: 1.45 }}>
        Select the depth of reasoning for your analysis. Available in an upcoming release.
      </p>

      <style>{`
        @keyframes thinkingModeIn {
          from { opacity: 0; transform: translateY(4px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes thinkingModeIn {
            from { opacity: 1; }
            to   { opacity: 1; }
          }
        }
      `}</style>
    </FlipDropdown>
  )
}
