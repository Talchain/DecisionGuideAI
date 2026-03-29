import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, Share2, MoreVertical, Check, BookOpen, Keyboard, HelpCircle, Users, Shield, ShieldAlert, Clock, Settings, ChevronRight, AlertTriangle, User } from 'lucide-react'
import Tooltip from '../Tooltip'
import { Spinner } from '../Spinner'
import styles from './TopBar.module.css'
import { useAnalysisMetadata } from '../../canvas/hooks/useAnalysisMetadata'
import { isGraphLensEnabled } from '../../flags'
import { useCanvasStore } from '../../canvas/store'
import { LensDropdown } from '../../canvas/components/LensDropdown'
import { LENS_TOGGLE_EVENT } from '../../canvas/hooks/useCanvasKeyboardShortcuts'
import { useStagePill } from '../../canvas/hooks/useStagePill'
import { useSettingsStore } from '../../canvas/settingsStore'
import { UserAvatarMenu } from './UserAvatarMenu'

// Custom events for help actions (communicated to ReactFlowGraph)
export const HELP_EVENTS = {
  SHOW_ONBOARDING: 'topbar:show-onboarding',
  SHOW_KEYBOARD_LEGEND: 'topbar:show-keyboard-legend',
  SHOW_INFLUENCE_EXPLAINER: 'topbar:show-influence-explainer',
} as const

/**
 * ViewModeDropdown — Standard / Detailed toggle in the top bar.
 * Internal type: 'standard' | 'expert'. User-facing labels: "Standard" / "Detailed".
 */
function ViewModeDropdown() {
  const viewMode = useCanvasStore(s => s.viewMode)
  const setViewMode = useCanvasStore(s => s.setViewMode)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const label = viewMode === 'expert' ? 'Detailed' : 'Standard'

  return (
    <div ref={ref} className="relative">
      <Tooltip content="Switch canvas detail level">
        <button
          type="button"
          className={styles.metadataChip}
          onClick={() => setOpen(v => !v)}
          aria-label={`View: ${label}. Click to change.`}
        >
          <Settings size={12} aria-hidden="true" />
          <span className={styles.metadataLabel}>{label}</span>
        </button>
      </Tooltip>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-panel border border-panel-border rounded-lg shadow-2 py-1 min-w-[120px]">
          {(['standard', 'expert'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-panel-hover transition-colors ${viewMode === mode ? 'font-semibold text-text-header' : 'text-text-body'}`}
              onClick={() => { setViewMode(mode); setOpen(false) }}
            >
              {mode === 'expert' ? 'Detailed' : 'Standard'}
              {viewMode === mode && <Check size={12} className="inline ml-1.5 text-info" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface TopBarProps {
  scenarioTitle: string
  onTitleChange: (title: string) => void
  onSave?: () => Promise<void>
  onShare?: () => void
  isDirty?: boolean
  lastSaved?: Date | null
  // C.1a: Supabase persistence status
  saveStatus?: 'saved' | 'saving' | 'error'
  saveError?: string | null
  isPersisted?: boolean
}

export const TopBar = ({
  scenarioTitle,
  onTitleChange,
  onSave,
  onShare,
  isDirty = false,
  lastSaved = null,
  saveStatus,
  saveError,
  isPersisted = false,
}: TopBarProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(scenarioTitle)
  const [isSaving, setIsSaving] = useState(false)
  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [settingsExpanded, setSettingsExpanded] = useState(false)
  const [showSavedPill, setShowSavedPill] = useState(false)
  const [lensOpen, setLensOpen] = useState(false)

  // Listen for L key toggle event from useCanvasKeyboardShortcuts
  useEffect(() => {
    const handler = () => setLensOpen(v => !v)
    window.addEventListener(LENS_TOGGLE_EVENT, handler)
    return () => window.removeEventListener(LENS_TOGGLE_EVENT, handler)
  }, [])

  // Close lens dropdown when comparison mode hides the chip
  const comparisonActive = useCanvasStore(s => s.comparisonMode.active)
  useEffect(() => {
    if (comparisonActive) setLensOpen(false)
  }, [comparisonActive])

  const menuRef = useRef<HTMLDivElement | null>(null)

  // C.1a: Auto-fade "Saved" pill after 2s
  const prevSaveStatusRef = useRef(saveStatus)
  useEffect(() => {
    if (saveStatus === 'saved' && prevSaveStatusRef.current === 'saving') {
      setShowSavedPill(true)
      const timer = setTimeout(() => setShowSavedPill(false), 2000)
      return () => clearTimeout(timer)
    }
    if (saveStatus === 'saving') {
      setShowSavedPill(false)
    }
    prevSaveStatusRef.current = saveStatus
  }, [saveStatus])

  // Floating pill TopBar - set topbar-h to pill bottom (12px top + 45px height = 57px)
  // This ensures LeftSidebar and other elements position correctly below the pill
  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const previous = root.style.getPropertyValue('--topbar-h')
    root.style.setProperty('--topbar-h', '57px')
    return () => {
      root.style.setProperty('--topbar-h', previous || '0px')
    }
  }, [])

  useEffect(() => {
    setEditValue(scenarioTitle)
  }, [scenarioTitle])

  const handleTitleSubmit = () => {
    const next = editValue.trim()
    if (next && next !== scenarioTitle) {
      onTitleChange(next)
    }
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!onSave || isSaving || !isDirty) return

    setIsSaving(true)
    try {
      await onSave()
      setShowSavedConfirmation(true)
      setTimeout(() => setShowSavedConfirmation(false), 2000)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Save failed:', error)
    } finally {
      setIsSaving(false)
    }
  }

  // Reset settingsExpanded when menu closes
  useEffect(() => {
    if (!showMenu) {
      setSettingsExpanded(false)
    }
  }, [showMenu])

  useEffect(() => {
    if (!showMenu) return

    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscapeKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [showMenu])

  // Help action handlers - emit custom events for ReactFlowGraph to handle
  const handleShowOnboarding = useCallback(() => {
    window.dispatchEvent(new CustomEvent(HELP_EVENTS.SHOW_ONBOARDING))
    setShowMenu(false)
  }, [])

  const handleShowKeyboardLegend = useCallback(() => {
    window.dispatchEvent(new CustomEvent(HELP_EVENTS.SHOW_KEYBOARD_LEGEND))
    setShowMenu(false)
  }, [])

  const handleShowInfluenceExplainer = useCallback(() => {
    window.dispatchEvent(new CustomEvent(HELP_EVENTS.SHOW_INFLUENCE_EXPLAINER))
    setShowMenu(false)
  }, [])

  const formatRelativeTime = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return date.toLocaleDateString()
  }

  const saveTooltip = lastSaved
    ? `Last saved ${formatRelativeTime(lastSaved)}`
    : 'Save changes'

  const saveDisabled = !isDirty || isSaving

  // Decision Graph Display v2 Task 13: Analysis metadata
  const analysisMetadata = useAnalysisMetadata()
  // A.15: Stage lifecycle pill
  const stagePill = useStagePill()

  // Canvas settings from store
  const {
    showGrid,
    gridSize,
    snapToGrid,
    showAlignmentGuides,
    highContrastMode,
    setShowGrid,
    setGridSize,
    setSnapToGrid,
    setShowAlignmentGuides,
    setHighContrastMode,
  } = useSettingsStore()

  return (
    <div className={styles.topBar} role="banner">
      {/* Left section - logo and title */}
      <div className={styles.topBarLeft}>
        <a href="/" className={styles.logoLink} aria-label="Olumi home">
          <img
            src="/olumi-logo.png"
            alt="Olumi"
            className={styles.logo}
          />
        </a>

        {/* Divider between logo and title */}
        <div className={styles.divider} aria-hidden="true" />

        {/* Editable title */}
        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value.slice(0, 60))}
            onBlur={handleTitleSubmit}
            onKeyDown={e => {
              if (e.key === 'Enter') handleTitleSubmit()
              if (e.key === 'Escape') {
                setEditValue(scenarioTitle)
                setIsEditing(false)
              }
            }}
            className={styles.titleInput}
            autoFocus
            aria-label="Edit scenario title"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className={styles.titleButton}
            aria-label="Edit scenario title"
          >
            <span className={styles.titleText}>{scenarioTitle}</span>
            <svg
              width="9"
              height="9"
              viewBox="0 0 12 12"
              className={styles.chevronIcon}
              aria-hidden="true"
            >
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>
        )}

        {/* Dirty indicator (localStorage mode only) */}
        {!isPersisted && isDirty && !isSaving && (
          <span className={styles.dirtyIndicator} aria-label="Unsaved changes" />
        )}

        {/* C.1a: Supabase persistence save status */}
        {isPersisted && saveStatus === 'saving' && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-gray-500 bg-gray-100 rounded-full"
            role="status"
            aria-live="polite"
          >
            <Clock className="w-3 h-3 animate-pulse" />
            <span>Saving…</span>
          </div>
        )}
        {isPersisted && showSavedPill && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-text-body bg-panel rounded-full transition-opacity duration-300"
            role="status"
            aria-live="polite"
          >
            <Check className="w-3 h-3" />
            <span>Saved</span>
          </div>
        )}
        {isPersisted && saveStatus === 'error' && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-warning bg-panel rounded-full"
            role="status"
            aria-live="polite"
            title={saveError ?? 'Save failed'}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Save failed — retrying</span>
          </div>
        )}
      </div>

      {/* Decision Graph Display v2 Task 13: Analysis metadata chips */}
      <div className={styles.topBarCenter}>
        {/* A.15: Stage lifecycle pill */}
        <Tooltip content={`Decision stage: ${stagePill.label}`}>
          <div
            className={`${styles.stagePill}${stagePill.isGenerating ? ` ${styles.stagePillGenerating}` : ''}`}
            style={{ borderColor: stagePill.borderColor }}
            data-stage={stagePill.stage}
            data-stage-source={stagePill.source}
          >
            <span className={styles.metadataLabel}>{stagePill.label}</span>
          </div>
        </Tooltip>

        {/* Scenario Count (only show when complete) */}
        {analysisMetadata.scenarioCount !== null && analysisMetadata.runStatus === 'complete' && (
          <Tooltip content={`Analyzed ${analysisMetadata.scenarioCount.toLocaleString()} scenarios`}>
            <div className={styles.metadataChip}>
              <Users size={12} aria-hidden="true" />
              <span className={styles.metadataLabel}>
                {analysisMetadata.scenarioCount.toLocaleString()} scenarios
              </span>
            </div>
          </Tooltip>
        )}

        {/* Stability (only show when complete) */}
        {analysisMetadata.stability !== null && analysisMetadata.runStatus === 'complete' && (
          <Tooltip content={analysisMetadata.stability === 'stable' ? 'Recommendation is stable across scenarios' : 'Recommendation may change with different assumptions'}>
            <div className={styles.metadataChip} data-stability={analysisMetadata.stability}>
              {analysisMetadata.stability === 'stable' ? (
                <Shield size={12} aria-hidden="true" />
              ) : (
                <ShieldAlert size={12} aria-hidden="true" />
              )}
              <span className={styles.metadataLabel}>
                {analysisMetadata.stability === 'stable' ? 'Stable' : 'Sensitive'}
              </span>
            </div>
          </Tooltip>
        )}

        {/* Last Run Time (only show when complete) */}
        {analysisMetadata.relativeTime !== null && analysisMetadata.runStatus === 'complete' && (
          <Tooltip content={analysisMetadata.computedAt ? `Completed ${new Date(analysisMetadata.computedAt).toLocaleString()}` : 'Analysis completed'}>
            <div className={styles.metadataChip}>
              <Clock size={12} aria-hidden="true" />
              <span className={styles.metadataLabel}>
                {analysisMetadata.relativeTime}
              </span>
            </div>
          </Tooltip>
        )}

        {/* Graph Lens dropdown (post-analysis only) */}
        {isGraphLensEnabled() && (
          <LensDropdown
            isOpen={lensOpen}
            onClose={() => setLensOpen(false)}
            onToggle={() => setLensOpen(v => !v)}
          />
        )}

        {/* View mode dropdown: Standard / Detailed */}
        <ViewModeDropdown />
      </div>

      {/* Right section */}
      <div className={styles.topBarRight}>
        {/* Save button */}
        <Tooltip content={saveTooltip}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveDisabled}
            className={`${styles.saveButton} ${showSavedConfirmation ? styles.saveButtonSaved : ''}`}
            aria-label="Save scenario"
          >
            {showSavedConfirmation ? (
              <>
                <Check size={12} aria-hidden="true" />
                <span>Saved</span>
              </>
            ) : isSaving ? (
              <>
                <Spinner size="sm" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={12} aria-hidden="true" />
                <span>Save</span>
              </>
            )}
          </button>
        </Tooltip>

        {/* Share button */}
        <Tooltip content="Generate shareable link">
          <button
            type="button"
            onClick={onShare}
            className={styles.shareButton}
            aria-label="Share scenario"
          >
            <Share2 size={12} aria-hidden="true" />
            <span className={styles.buttonLabel}>Share</span>
          </button>
        </Tooltip>

        {/* Menu dropdown */}
        <div className={styles.menuDropdown} ref={menuRef}>
          <Tooltip content="More options">
            <button
              type="button"
              onClick={() => setShowMenu(prev => !prev)}
              className={styles.menuButton}
              aria-label="More options"
              aria-expanded={showMenu}
              aria-haspopup="true"
            >
              <MoreVertical size={15} aria-hidden="true" />
            </button>
          </Tooltip>

          {showMenu && (
            <div className={styles.dropdownMenu} role="menu">
              <button
                type="button"
                role="menuitem"
                className={styles.dropdownMenuButton}
                onClick={() => console.warn('Export')}
              >
                Export
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.dropdownMenuButton}
                onClick={() => console.warn('Version history')}
              >
                Version history
              </button>
              <hr className={styles.dropdownMenuDivider} />
              {/* Help & Learning section */}
              <div className={styles.dropdownMenuLabel}>Need a refresher?</div>
              <button
                type="button"
                role="menuitem"
                className={styles.dropdownMenuButton}
                onClick={handleShowOnboarding}
              >
                <BookOpen size={14} aria-hidden="true" />
                <span>Show onboarding tour</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.dropdownMenuButton}
                onClick={handleShowKeyboardLegend}
              >
                <Keyboard size={14} aria-hidden="true" />
                <span>Keyboard shortcuts</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.dropdownMenuButton}
                onClick={handleShowInfluenceExplainer}
              >
                <HelpCircle size={14} aria-hidden="true" />
                <span>Influence explainer</span>
              </button>
              <hr className={styles.dropdownMenuDivider} />
              {/* Settings expandable section */}
              <button
                type="button"
                role="menuitem"
                className={styles.dropdownMenuButton}
                onClick={() => setSettingsExpanded(!settingsExpanded)}
                aria-expanded={settingsExpanded}
                aria-controls="canvas-settings-panel"
              >
                <Settings size={14} aria-hidden="true" />
                <span>Settings</span>
                <ChevronRight
                  size={14}
                  className={`${styles.settingsChevron} ${settingsExpanded ? styles.settingsChevronExpanded : ''}`}
                  aria-hidden="true"
                />
              </button>

              {settingsExpanded && (
                <div
                  id="canvas-settings-panel"
                  role="group"
                  aria-label="Canvas settings"
                  className={styles.settingsSection}
                >
                  {/* Show Grid */}
                  <label htmlFor="setting-show-grid" className={styles.settingsRow}>
                    <span>Show Grid</span>
                    <input
                      id="setting-show-grid"
                      type="checkbox"
                      checked={showGrid}
                      onChange={(e) => setShowGrid(e.target.checked)}
                      className={styles.settingsCheckbox}
                    />
                  </label>

                  {/* Grid Size - only when grid is enabled */}
                  {showGrid && (
                    <div className={styles.settingsSliderRow}>
                      <label htmlFor="setting-grid-size">Grid Size: {gridSize}px</label>
                      <input
                        id="setting-grid-size"
                        type="range"
                        min="8"
                        max="24"
                        step="8"
                        value={gridSize}
                        onChange={(e) => setGridSize(Number(e.target.value) as 8 | 16 | 24)}
                        className={styles.settingsSlider}
                        aria-valuemin={8}
                        aria-valuemax={24}
                        aria-valuenow={gridSize}
                        aria-valuetext={`${gridSize} pixels`}
                      />
                      <div className={styles.settingsSliderLabels} aria-hidden="true">
                        <span>8px</span>
                        <span>16px</span>
                        <span>24px</span>
                      </div>
                    </div>
                  )}

                  {/* Snap to Grid */}
                  <label htmlFor="setting-snap-to-grid" className={styles.settingsRow}>
                    <span>Snap to Grid</span>
                    <input
                      id="setting-snap-to-grid"
                      type="checkbox"
                      checked={snapToGrid}
                      onChange={(e) => setSnapToGrid(e.target.checked)}
                      className={styles.settingsCheckbox}
                    />
                  </label>

                  {/* Alignment Guides */}
                  <label htmlFor="setting-alignment-guides" className={styles.settingsRow}>
                    <span>Alignment Guides</span>
                    <input
                      id="setting-alignment-guides"
                      type="checkbox"
                      checked={showAlignmentGuides}
                      onChange={(e) => setShowAlignmentGuides(e.target.checked)}
                      className={styles.settingsCheckbox}
                    />
                  </label>

                  {/* High Contrast Mode */}
                  <label htmlFor="setting-high-contrast" className={styles.settingsRow}>
                    <span>High Contrast Mode</span>
                    <input
                      id="setting-high-contrast"
                      type="checkbox"
                      checked={highContrastMode}
                      onChange={(e) => setHighContrastMode(e.target.checked)}
                      className={styles.settingsCheckbox}
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User avatar + account dropdown */}
        <UserAvatarMenu />
      </div>
    </div>
  )
}
