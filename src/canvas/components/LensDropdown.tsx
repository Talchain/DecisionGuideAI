/**
 * LensDropdown — Graph Lens mode selector.
 *
 * Displays in the TopBar as an outlined pill chip (icon-only at rest).
 * Opens a dropdown with lens modes: Full model, option isolation (per option),
 * sensitivity, fragile edges, causal graph, evidence quality, robustness.
 *
 * Design system: Lucide icons only, bg-panel dropdown, outlined pill,
 * sentence case, neutral backgrounds. No emoji.
 */

import { useRef, useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Layers, Check, ChevronDown } from 'lucide-react'
import { useCanvasStore, selectResultsStatus, selectReport } from '../store'
import type { LensMode } from '../store'

// ─── Dropdown trigger chip ───────────────────────────────────────────────────

interface LensChipProps {
  isActive: boolean
  onClick: () => void
  chipRef: React.RefObject<HTMLButtonElement | null>
}

function LensChip({ isActive, onClick, chipRef }: LensChipProps) {
  return (
    <button
      ref={chipRef}
      type="button"
      onClick={onClick}
      aria-haspopup="true"
      aria-label="Graph lens"
      title="Graph lens (L)"
      className="top-bar-chip cursor-pointer inline-flex items-center border border-panel-border bg-transparent rounded-full relative"
      style={{
        gap: 4,
        height: 30,
        padding: '0 8px',
        color: isActive ? 'var(--semantic-info, #3b82f6)' : 'var(--text-light, #908D8D)',
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: 'nowrap' as const,
        transition: 'color 200ms ease',
      }}
      data-testid="lens-chip"
    >
      <Layers size={16} strokeWidth={1.8} aria-hidden="true" />
      {/* Active indicator dot — always rendered, fades via opacity for smooth transition */}
      <span
        style={{
          position: 'absolute',
          top: 3,
          right: 3,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--semantic-info, #3b82f6)',
          opacity: isActive ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
        aria-hidden="true"
      />
      <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
    </button>
  )
}

// ─── Dropdown panel ──────────────────────────────────────────────────────────

interface LensDropdownProps {
  isOpen: boolean
  onClose: () => void
  onToggle: () => void
}

export function LensDropdown({ isOpen, onClose, onToggle }: LensDropdownProps) {
  const chipRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const lensMode = useCanvasStore(s => s.lens.active)
  const lensOptionId = useCanvasStore(s => s.lens.selectedOptionId)
  const setLens = useCanvasStore(s => s.setLens)
  const resultsStatus = useCanvasStore(selectResultsStatus)
  const report = useCanvasStore(selectReport)
  const comparisonActive = useCanvasStore(s => s.comparisonMode.active)

  // Get options from report
  const options = (report as Record<string, unknown> | null | undefined)
    ?.option_comparison as Array<{ option_id: string; option_label: string }> | undefined

  const isActive = lensMode !== 'full'
  const hasResults = resultsStatus === 'complete'
  // Expanded lenses (causal, evidence) are available pre-analysis; others require results
  const hasNodes = useCanvasStore(s => s.nodes.length > 0)
  const isVisible = !comparisonActive && (hasResults || hasNodes)

  // Position dropdown below the chip, clamped to viewport
  useEffect(() => {
    if (!isOpen || !chipRef.current) return
    const r = chipRef.current.getBoundingClientRect()
    const dropdownHeight = 400 // approximate max height (increased for new items)
    const dropdownWidth = 220  // minWidth from style

    let top = r.bottom + 6
    let left = r.left

    // Flip above if it would overflow bottom
    if (top + dropdownHeight > window.innerHeight) {
      top = r.top - dropdownHeight - 6
    }
    // Clamp right edge
    if (left + dropdownWidth > window.innerWidth) {
      left = window.innerWidth - dropdownWidth - 8
    }

    setPos({ top, left })

    // Auto-focus the active (or first) menu item for keyboard navigation
    requestAnimationFrame(() => {
      const active = popoverRef.current?.querySelector('[role="menuitem"][data-active="true"]') as HTMLElement | null
      const first = popoverRef.current?.querySelector('[role="menuitem"]') as HTMLElement | null
      ;(active ?? first)?.focus()
    })
  }, [isOpen])

  // Outside click + Escape
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        chipRef.current && !chipRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        chipRef.current?.focus()
      }
    }
    const tid = setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    document.addEventListener('keydown', handleEscape)
    return () => {
      clearTimeout(tid)
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  const handleSelect = useCallback((mode: LensMode, optionId?: string) => {
    setLens(mode, optionId)
    onClose()
  }, [setLens, onClose])

  if (!isVisible) return null

  return (
    <>
      <LensChip isActive={isActive} onClick={isOpen ? onClose : onToggle} chipRef={chipRef} />

      {isOpen && createPortal(
        <div
          ref={popoverRef}
          role="menu"
          aria-label="Graph lens"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              const items = popoverRef.current?.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')
              if (!items?.length) return
              const focused = document.activeElement
              const idx = Array.from(items).indexOf(focused as Element)
              const next = e.key === 'ArrowDown'
                ? (idx + 1) % items.length
                : (idx - 1 + items.length) % items.length
              ;(items[next] as HTMLElement).focus()
            }
          }}
          className="border border-panel-border bg-panel shadow-2 rounded-md motion-reduce:!animate-none"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 9000,
            padding: '4px 0',
            minWidth: 220,
            animation: 'thinkingModeIn 150ms cubic-bezier(0.0, 0, 0.2, 1) both',
          }}
          data-testid="lens-dropdown"
        >
          {/* Full model */}
          <LensMenuItem
            label="Full model"
            isActive={lensMode === 'full'}
            onClick={() => handleSelect('full')}
          />

          {/* Separator */}
          {options && options.length >= 2 && (
            <div className="h-px my-1" style={{ background: 'var(--border-default, #EEE6D8)' }} />
          )}

          {/* Option items */}
          {options && options.length >= 2 && options.map(opt => (
            <LensMenuItem
              key={opt.option_id}
              label={opt.option_label}
              isActive={lensMode === 'option' && lensOptionId === opt.option_id}
              onClick={() => handleSelect('option', opt.option_id)}
              dotColor="var(--semantic-option, #8b5cf6)"
            />
          ))}

          {/* Separator */}
          <div className="h-px my-1" style={{ background: 'var(--border-default, #EEE6D8)' }} />

          {/* Sensitivity */}
          <LensMenuItem
            label="Sensitivity"
            isActive={lensMode === 'sensitivity'}
            onClick={() => handleSelect('sensitivity')}
            disabled={!hasResults}
            disabledTooltip="Run analysis first"
          />

          {/* Fragile edges */}
          <LensMenuItem
            label="Fragile edges"
            isActive={lensMode === 'fragile'}
            onClick={() => handleSelect('fragile')}
            disabled={!hasResults}
            disabledTooltip="Run analysis first"
          />

          {/* Separator — Analytical lenses */}
          <div className="h-px my-1" style={{ background: 'var(--border-default, #EEE6D8)' }} />

          {/* Causal graph */}
          <LensMenuItem
            label="Causal graph"
            description="Pure causal structure"
            isActive={lensMode === 'causal'}
            onClick={() => handleSelect('causal')}
          />

          {/* Evidence quality */}
          <LensMenuItem
            label="Evidence quality"
            description="What's grounded vs assumed"
            isActive={lensMode === 'evidence'}
            onClick={() => handleSelect('evidence')}
          />

          {/* Robustness — disabled when no results */}
          <LensMenuItem
            label="Robustness"
            description="Where the result is vulnerable"
            isActive={lensMode === 'robustness'}
            onClick={() => handleSelect('robustness')}
            disabled={!hasResults}
            disabledTooltip="Run analysis first"
          />
        </div>,
        document.body,
      )}
    </>
  )
}

// ─── Menu item ───────────────────────────────────────────────────────────────

interface LensMenuItemProps {
  label: string
  description?: string
  isActive: boolean
  onClick: () => void
  dotColor?: string
  disabled?: boolean
  disabledTooltip?: string
}

function LensMenuItem({ label, description, isActive, onClick, dotColor, disabled, disabledTooltip }: LensMenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={disabled ? undefined : onClick}
      title={disabled ? disabledTooltip : undefined}
      aria-disabled={disabled || undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '8px 12px',
        background: 'transparent',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12,
        fontWeight: isActive ? 500 : 400,
        color: disabled
          ? 'var(--text-disabled, #C5C0B8)'
          : isActive ? 'var(--semantic-info, #3b82f6)' : 'var(--text-body, #3F3F3E)',
        textAlign: 'left',
        transition: 'background 100ms ease',
        opacity: disabled ? 0.6 : 1,
      }}
      className={disabled ? '' : 'hover:bg-panel-hover'}
      data-testid={`lens-item-${label.toLowerCase().replace(/\s+/g, '-')}`}
      data-active={isActive ? 'true' : undefined}
    >
      {dotColor && (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
          }}
          aria-hidden="true"
        />
      )}
      <span style={{ flex: 1 }}>
        {label}
        {description && (
          <span
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 400,
              color: disabled ? 'var(--text-disabled, #C5C0B8)' : 'var(--text-light, #908D8D)',
              marginTop: 1,
            }}
          >
            {description}
          </span>
        )}
      </span>
      {isActive && <Check size={16} strokeWidth={2} aria-hidden="true" />}
    </button>
  )
}
