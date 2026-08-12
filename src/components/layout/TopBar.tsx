import { useEffect, useRef, useState, useCallback } from 'react'
import { Share2, Users, Shield, ShieldAlert, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import Tooltip from '../Tooltip'
import styles from './TopBar.module.css'
import { useAnalysisMetadata } from '../../canvas/hooks/useAnalysisMetadata'
import { useStagePill } from '../../canvas/hooks/useStagePill'
import { UserAvatarMenu } from './UserAvatarMenu'
import { KebabMenu } from './KebabMenu'
import { ScenarioSwitcher } from '../../canvas/components/ScenarioSwitcher'
import { ownerPanelHash } from '../../collab/panelRoute'
import { MENU_EXCLUSIVE_EVENT } from './LeftSidebar'
import { useUIStore } from '../../stores/uiStore'

// Custom events for help actions (communicated to ReactFlowGraph)
// Lane 4 (P5): SHOW_ONBOARDING removed — its only dispatcher was the kebab
// "Replay tour" item, which fired into an overlay gated off in every deploy
// context (a control that lied). ReactFlowGraph's literal
// 'topbar:show-onboarding' listener + gated overlay remain as dead code;
// retire-or-revive is a rowed follow-up.
export const HELP_EVENTS = {
  SHOW_KEYBOARD_LEGEND: 'topbar:show-keyboard-legend',
  SHOW_INFLUENCE_EXPLAINER: 'topbar:show-influence-explainer',
  SHOW_TOAST: 'topbar:show-toast',
} as const

interface TopBarProps {
  scenarioTitle: string
  onTitleChange: (title: string) => void
  onSave?: () => Promise<void>
  onShare?: () => void
  isDirty?: boolean
  // C.1a: Supabase persistence status
  saveStatus?: 'saved' | 'saving' | 'error'
  saveError?: string | null
  isPersisted?: boolean
  /**
   * COLLAB: when a PERSISTED scenario is on the canvas, its id — and the bar
   * shows the "Ask your team" entry to the blind-panel owner page. Null/absent
   * hides it: a guest scenario cannot mint a round (CEE refuses — no immutable
   * model version to pin), so showing the entry would be a control that lies.
   */
  panelScenarioId?: string | null
}

export const TopBar = ({
  scenarioTitle,
  onTitleChange,
  onSave,
  onShare,
  isDirty = false,
  saveStatus,
  saveError,
  isPersisted = false,
  panelScenarioId = null,
}: TopBarProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(scenarioTitle)
  const [showSavedPill, setShowSavedPill] = useState(false)

  // The kebab menu's open-state lives in uiStore, NOT in component-local
  // `useState`. That is the whole point: `applyV5State` dispatches the AI's
  // ui_directive verbs from a once-per-envelope, non-render side-effect site
  // whose only reach into the UI is `useUIStore.getState()`. A `useState`
  // here made menus, pop-ups and coach-marks structurally unreachable to any
  // assistant gesture. Both selectors return primitives, so no useShallow is
  // needed and no fresh object is created per render.
  const showMenu = useUIStore(s => s.activeOverlaySurface === 'top_bar_menu')
  const overlayOrigin = useUIStore(s => s.overlaySurfaceOrigin)
  const setOverlaySurface = useUIStore(s => s.setOverlaySurface)
  const closeMenu = useCallback(() => {
    // Close only OUR surface. Without this check a stray close would lower
    // whichever surface happened to be raised — including one this component
    // does not own.
    if (useUIStore.getState().activeOverlaySurface === 'top_bar_menu') {
      setOverlaySurface(null)
    }
  }, [setOverlaySurface])

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
    if (!onSave) return
    try {
      await onSave()
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Save failed:', error)
    }
  }

  // USER AGENCY over an assistant-raised surface. These dismissals are
  // deliberately unconditional on WHO raised the menu: the assistant may put
  // it on screen, and Escape / click-outside must always take it back.
  useEffect(() => {
    if (!showMenu) return

    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(event.target as Node)) {
        closeMenu()
      }
    }

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscapeKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [showMenu, closeMenu])

  // Close kebab menu when another menu claims exclusivity
  useEffect(() => {
    const handler = (e: Event) => {
      const source = (e as CustomEvent).detail?.source
      if (source !== 'kebab') closeMenu()
    }
    window.addEventListener(MENU_EXCLUSIVE_EVENT, handler)
    return () => window.removeEventListener(MENU_EXCLUSIVE_EVENT, handler)
  }, [closeMenu])

  // KEEP THE STORE TRUTHFUL ABOUT WHAT IS ON SCREEN. An overlay surface is
  // anchored to a control; if that control is not mounted, a raised surface is
  // a claim the screen does not support. Component-local `useState` gave this
  // for free — it died with the component. A store does not, so the owner of a
  // surface must lower it on unmount, or a route change would leave the store
  // asserting a menu that no longer exists (and the next mount would paint it
  // open). Unmount-only: nothing is cleared while the bar is alive, so an
  // assistant gesture is never swallowed mid-session.
  // Empty deps on purpose: this must be strictly unmount-only, so it reads the
  // store directly rather than closing over an action whose identity could
  // drift and turn the cleanup into a mid-life dismissal.
  useEffect(
    () => () => {
      if (useUIStore.getState().activeOverlaySurface === 'top_bar_menu') {
        useUIStore.getState().setOverlaySurface(null)
      }
    },
    [],
  )

  // Claim exclusivity whenever OUR menu becomes raised — by a user click OR by
  // an assistant gesture that never passes through a click handler. Announcing
  // from the state transition rather than from `onToggle` is what makes the two
  // paths equivalent; sibling menus (LeftSidebar's lens, UserAvatarMenu) still
  // own their state and only learn about us through this event.
  useEffect(() => {
    if (!showMenu) return
    window.dispatchEvent(
      new CustomEvent(MENU_EXCLUSIVE_EVENT, { detail: { source: 'kebab' } }),
    )
  }, [showMenu])

  // Help action handlers - emit custom events for ReactFlowGraph to handle
  const handleShowKeyboardLegend = useCallback(() => {
    window.dispatchEvent(new CustomEvent(HELP_EVENTS.SHOW_KEYBOARD_LEGEND))
    closeMenu()
  }, [closeMenu])

  const handleShowInfluenceExplainer = useCallback(() => {
    window.dispatchEvent(new CustomEvent(HELP_EVENTS.SHOW_INFLUENCE_EXPLAINER))
    closeMenu()
  }, [closeMenu])

  // Decision Graph Display v2 Task 13: Analysis metadata
  const analysisMetadata = useAnalysisMetadata()
  // A.15: Stage lifecycle pill
  const stagePill = useStagePill()

  // `data-overlay-origin` is present only while an overlay this bar owns is
  // raised, and names WHO raised it. A surface the assistant put on screen must
  // be attributable rather than appearing to move on its own; this is the hook
  // a visible attribution (and any browser-level check) binds to.
  return (
    <div
      className={styles.topBar}
      role="banner"
      {...(showMenu && overlayOrigin ? { 'data-overlay-origin': overlayOrigin } : {})}
    >
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
            aria-label="Edit decision title"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className={styles.titleButton}
            aria-label="Edit decision title"
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
        {!isPersisted && isDirty && saveStatus !== 'saving' && (
          <span className={styles.dirtyIndicator} aria-label="Unsaved changes" />
        )}

        {/* Lane 4 (P5): scenario switching, save-as, duplicate, rename,
            delete, and scenario export/import (.olumi.json) — previously
            only reachable from the production-unmounted CanvasToolbar. */}
        <div className={styles.divider} aria-hidden="true" />
        <ScenarioSwitcher dropdownPosition="below" />

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
          <Tooltip content={analysisMetadata.stability === 'stable' ? 'Result is stable across scenarios' : 'Result may change with different assumptions'}>
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

      </div>

      {/* Right section */}
      <div className={styles.topBarRight}>
        {/* Save status indicator (replaces save button) */}
        {isPersisted && (() => {
          const isClickable = (saveStatus === 'error') || (isDirty && saveStatus !== 'saving')
          const handleClick = isClickable ? handleSave : undefined

          if (saveStatus === 'saving') {
            return (
              <span className={styles.saveStatus} role="status" aria-live="polite">
                <span className="inline-block w-3 h-3 border-[1.5px] border-current border-t-transparent rounded-full animate-spin text-text-light" aria-hidden="true" />
                <span className="text-text-light">Saving{'\u2026'}</span>
              </span>
            )
          }
          if (saveStatus === 'saved' && showSavedPill) {
            return (
              <span className={styles.saveStatus} role="status" aria-live="polite">
                <CheckCircle size={12} className="text-text-light" aria-hidden="true" />
                <span className="text-text-light">Saved</span>
              </span>
            )
          }
          if (saveStatus === 'error') {
            return (
              <button
                type="button"
                className={`${styles.saveStatus} ${styles.saveStatusClickable}`}
                role="status"
                aria-live="polite"
                onClick={handleClick}
                title={saveError ?? 'Save failed'}
              >
                <XCircle size={12} className="text-danger" aria-hidden="true" />
                <span className="text-danger">Save failed</span>
              </button>
            )
          }
          if (isDirty) {
            return (
              <button
                type="button"
                className={`${styles.saveStatus} ${styles.saveStatusClickable}`}
                role="status"
                aria-live="polite"
                onClick={handleClick}
              >
                <AlertTriangle size={12} className="text-warning" aria-hidden="true" />
                <span className="text-warning">Unsaved</span>
              </button>
            )
          }
          return null
        })()}

        {/* COLLAB: entry to the blind-panel owner page — previously URL-only.
            An anchor, not a navigate(): the app is a HashRouter and this is
            the same pattern as the logo link, so middle-click/new-tab work.
            Rendered only for a persisted scenario (see the prop's doc). */}
        {panelScenarioId != null && panelScenarioId !== '' && (
          <Tooltip content="Ask your team — everyone answers privately, then compare">
            <a
              href={ownerPanelHash(panelScenarioId)}
              className={styles.iconButton}
              aria-label="Ask your team"
              data-testid="topbar-panel-link"
            >
              <Users size={14} aria-hidden="true" />
            </a>
          </Tooltip>
        )}

        {/* Share button */}
        <Tooltip content="Generate shareable link">
          <button
            type="button"
            onClick={onShare}
            className={styles.shareButton}
            aria-label="Share decision"
          >
            <Share2 size={14} aria-hidden="true" />
          </button>
        </Tooltip>

        {/* Version history */}
        <Tooltip content="Version history (coming soon)">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Version history"
            onClick={() => {
              window.dispatchEvent(new CustomEvent(HELP_EVENTS.SHOW_TOAST, {
                detail: { message: 'Version history is coming soon.', level: 'info' },
              }))
            }}
          >
            <Clock size={14} aria-hidden="true" />
          </button>
        </Tooltip>

        {/* Kebab menu */}
        <KebabMenu
          isOpen={showMenu}
          onToggle={() => {
            // The exclusivity announcement rides the state transition (effect
            // above), so the user path and the assistant path behave alike.
            setOverlaySurface(showMenu ? null : 'top_bar_menu')
          }}
          onClose={closeMenu}
          onStartRename={() => { setIsEditing(true); closeMenu() }}
          onShowKeyboardLegend={handleShowKeyboardLegend}
          onShowInfluenceExplainer={handleShowInfluenceExplainer}
          menuRef={menuRef}
        />

        {/* User avatar + account dropdown */}
        <UserAvatarMenu />
      </div>
    </div>
  )
}
