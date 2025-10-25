/**
 * KeyboardMap - Keyboard shortcuts reference modal
 *
 * Opens via ? key or Cmd/Ctrl+K
 * Lists all functional keyboard shortcuts
 */

import { useEffect } from 'react'
import styles from './KeyboardMap.module.css'

interface ShortcutRowProps {
  keys: string[]
  description: string
}

function ShortcutRow({ keys, description }: ShortcutRowProps) {
  return (
    <div className={styles.row}>
      <div className={styles.keys}>
        {keys.map((key, index) => (
          <span key={index}>
            <kbd className={styles.key}>{key}</kbd>
            {index < keys.length - 1 && <span className={styles.plus}>+</span>}
          </span>
        ))}
      </div>
      <div className={styles.description}>{description}</div>
    </div>
  )
}

interface KeyboardMapProps {
  isOpen: boolean
  onClose: () => void
}

export function KeyboardMap({ isOpen, onClose }: KeyboardMapProps) {
  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-map-title"
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 id="keyboard-map-title" className={styles.title}>
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Actions</h3>
            <ShortcutRow
              keys={['⌘/Ctrl', 'Enter']}
              description="Run selected template"
            />
            <ShortcutRow
              keys={['Alt/Option', 'V']}
              description="Jump to next invalid node"
            />
            <ShortcutRow
              keys={['⌘/Ctrl', 'T']}
              description="Toggle Templates panel"
            />
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Editing</h3>
            <ShortcutRow
              keys={['⌘/Ctrl', 'Z']}
              description="Undo"
            />
            <ShortcutRow
              keys={['⌘/Ctrl', 'Shift', 'Z']}
              description="Redo"
            />
            <ShortcutRow
              keys={['⌘/Ctrl', 'A']}
              description="Select all"
            />
            <ShortcutRow
              keys={['Delete']}
              description="Delete selected"
            />
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Navigation</h3>
            <ShortcutRow
              keys={['Esc']}
              description="Close current panel/modal"
            />
            <ShortcutRow
              keys={['?']}
              description="Show this keyboard map"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
