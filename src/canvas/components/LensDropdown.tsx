/**
 * LensDropdown — Graph Lens mode selector.
 *
 * Displays in the TopBar as an outlined pill chip (icon-only at rest).
 * Opens a dropdown with lens modes: Full model, option isolation (per option),
 * sensitivity, and fragile edges.
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
      className="top-bar-chip cursor-pointer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 30,
        padding: '0 8px',
        borderRadius: 999,
        background: 'transparent',
        border: '1px solid var(--border-default, #EEE6D8)',
        color: isActive ? 'var(--semantic-info, #3b82f6)' : 'var(--text-light, #908D8D)',
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: 'nowrap' as const,
        transition: 'color 200ms ease',
        position: 'relative',
      }}
      data-testid="lens-chip"
    >
      <Layers size={16} strokeWidth={1.8} aria-hidden="true" />
      {/* Active indicator dot */}
      {isActive && (
        <span
          style={{
            position: 'absolute',
            top: 3,
            right: 3,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--semantic-info, #3b82f6)',
          }}
          aria-hidden="true"
        />
      )}
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
  const isVisible = resultsStatus === 'complete' && !comparisonActive

  // Position dropdown below the chip
  useEffect(() => {
    if (!isOpen || !chipRef.current) return
    const r = chipRef.current.getBoundingClientRect()
    setPos({
      top: r.bottom + 6,
      left: r.left,
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
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            zIndex: 9000,
            padding: '4px 0',
            minWidth: 200,
            borderRadius: 12,
            border: '1px solid var(--border-default, #EEE6D8)',
            boxShadow: '0 8px 24px rgba(38,38,38,0.14)',
            background: 'var(--bg-panel, #FEFEFE)',
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
            <div style={{ height: 1, margin: '4px 0', background: 'var(--border-default, #EEE6D8)' }} />
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
          <div style={{ height: 1, margin: '4px 0', background: 'var(--border-default, #EEE6D8)' }} />

          {/* Sensitivity */}
          <LensMenuItem
            label="Sensitivity"
            isActive={lensMode === 'sensitivity'}
            onClick={() => handleSelect('sensitivity')}
          />

          {/* Fragile edges */}
          <LensMenuItem
            label="Fragile edges"
            isActive={lensMode === 'fragile'}
            onClick={() => handleSelect('fragile')}
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
  isActive: boolean
  onClick: () => void
  dotColor?: string
}

function LensMenuItem({ label, isActive, onClick, dotColor }: LensMenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '8px 12px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: isActive ? 500 : 400,
        color: isActive ? 'var(--semantic-info, #3b82f6)' : 'var(--text-body, #3F3F3E)',
        textAlign: 'left',
        transition: 'background 100ms ease',
      }}
      className="hover:bg-panel-hover"
      data-testid={`lens-item-${label.toLowerCase().replace(/\s+/g, '-')}`}
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
      <span style={{ flex: 1 }}>{label}</span>
      {isActive && <Check size={16} strokeWidth={2} aria-hidden="true" />}
    </button>
  )
}
