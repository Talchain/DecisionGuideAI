import { useEffect, useRef, useState, useCallback } from 'react'
import { Save, Share2, MoreVertical, Check, BookOpen, Keyboard, HelpCircle } from 'lucide-react'
import Tooltip from '../Tooltip'
import { Spinner } from '../Spinner'
import styles from './TopBar.module.css'

// Custom events for help actions (communicated to ReactFlowGraph)
export const HELP_EVENTS = {
  SHOW_ONBOARDING: 'topbar:show-onboarding',
  SHOW_KEYBOARD_LEGEND: 'topbar:show-keyboard-legend',
  SHOW_INFLUENCE_EXPLAINER: 'topbar:show-influence-explainer',
} as const

interface TopBarProps {
  scenarioTitle: string
  onTitleChange: (title: string) => void
  onSave?: () => Promise<void>
  onShare?: () => void
  isDirty?: boolean
  lastSaved?: Date | null
}

export const TopBar = ({
  scenarioTitle,
  onTitleChange,
  onSave,
  onShare,
  isDirty = false,
  lastSaved = null,
}: TopBarProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(scenarioTitle)
  const [isSaving, setIsSaving] = useState(false)
  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Keep CSS layout variable in sync so docks respect top bar height
  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const previous = root.style.getPropertyValue('--topbar-h')
    root.style.setProperty('--topbar-h', '45px')
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

  useEffect(() => {
    if (!showMenu) return

    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
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

  return (
    <div className={styles.topBar} role="banner">
      {/* Left section */}
      <div className={styles.topBarLeft}>
        <a href="/" className={styles.logoLink} aria-label="Olumi home">
          <img
            src="/olumi-logo.png"
            alt="Olumi"
            className={styles.logo}
          />
        </a>

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

        {/* Dirty indicator */}
        {isDirty && !isSaving && (
          <span className={styles.dirtyIndicator} aria-label="Unsaved changes" />
        )}
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
                onClick={() => console.log('Export')}
              >
                Export
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles.dropdownMenuButton}
                onClick={() => console.log('Version history')}
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
              <button
                type="button"
                role="menuitem"
                className={styles.dropdownMenuButton}
                onClick={() => console.log('Settings')}
              >
                Settings
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
