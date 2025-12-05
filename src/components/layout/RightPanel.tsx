import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import styles from './RightPanel.module.css'

interface RightPanelProps {
  children: ReactNode
  width?: string
  className?: string
  title?: string
  onClose?: () => void
  'data-testid'?: string
}

export function RightPanel({ children, width = '32rem', className, title, onClose, ...rest }: RightPanelProps) {
  return (
    <aside
      className={`${styles.rightPanel} ${className ?? ''}`}
      style={{ width }}
      role="complementary"
      aria-label={title || 'Side panel'}
      {...rest}
    >
      {(title || onClose) && (
        <header className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={styles.closeButton}
              aria-label="Close panel"
            >
              <X size={18} />
            </button>
          )}
        </header>
      )}
      <div className={styles.content}>{children}</div>
    </aside>
  )
}
