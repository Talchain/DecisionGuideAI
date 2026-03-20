/**
 * ArtefactBlock -- Renders an AI-generated interactive artefact.
 *
 * Wraps raw HTML content in a sandboxed iframe with Olumi design tokens.
 * Supports three states: expanded (default), collapsed (title bar only),
 * and maximised (overlay modal at up to 800px width).
 *
 * Auto-sizes iframe height to content via postMessage from the iframe template.
 * Collapses automatically when the artefact scrolls out of the viewport
 * (IntersectionObserver). Lazy-creates the iframe when the block first
 * enters the viewport.
 */

import { memo, useState, useCallback, useRef, useEffect, useId } from 'react'
import { X } from 'lucide-react'
import type { ArtefactBlock as ArtefactBlockData } from '../../canvas/conversation/types'
import { buildArtefactSrcdoc } from './artefactIframeTemplate'
import { ArtefactHeader } from './ArtefactHeader'
import { ArtefactActions } from './ArtefactActions'
import { useArtefactResize } from './useArtefactResize'
import styles from './Artefact.module.css'

/** Max inline iframe height in chat (px). Scrolls beyond this. */
const MAX_INLINE_HEIGHT = 600

interface ArtefactBlockProps {
  block: ArtefactBlockData
  onSendMessage: (message: string) => void
}

export const ArtefactBlock = memo(function ArtefactBlock({
  block,
  onSendMessage,
}: ArtefactBlockProps) {
  const instanceId = useId()
  const titleId = `artefact-title-${instanceId}`
  const containerRef = useRef<HTMLDivElement>(null)
  const expandBtnRef = useRef<HTMLButtonElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  const [collapsed, setCollapsed] = useState(false)
  const [maximised, setMaximised] = useState(false)
  const [iframeHeight, setIframeHeight] = useState(200)
  const [hasBeenVisible, setHasBeenVisible] = useState(false)
  // Track whether user manually toggled collapse (disables auto-collapse)
  const userToggledRef = useRef(false)

  // Lazy creation: only build iframe when block enters viewport
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasBeenVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Auto-collapse when artefact leaves viewport (only if user hasn't manually toggled)
  useEffect(() => {
    if (!hasBeenVisible) return
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && !userToggledRef.current) {
          setCollapsed(true)
        }
      },
      { threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasBeenVisible])

  // Iframe resize + action handler
  const iframeRefCb = useArtefactResize(
    useCallback((height: number) => { setIframeHeight(height) }, []),
    onSendMessage,
  )

  const handleToggleCollapse = useCallback(() => {
    userToggledRef.current = true
    setCollapsed((v) => !v)
  }, [])

  const handleMaximise = useCallback(() => {
    setMaximised(true)
    // Focus close button on next render
    requestAnimationFrame(() => closeBtnRef.current?.focus())
  }, [])

  const handleCloseMaximised = useCallback(() => {
    setMaximised(false)
    // Return focus to expand button
    requestAnimationFrame(() => expandBtnRef.current?.focus())
  }, [])

  // Handle Escape key for maximised overlay
  useEffect(() => {
    if (!maximised) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMaximised(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [maximised])

  const srcdoc = hasBeenVisible ? buildArtefactSrcdoc(block.content) : ''
  const clampedHeight = Math.min(iframeHeight, MAX_INLINE_HEIGHT)
  const hasActions = Array.isArray(block.actions) && block.actions.length > 0

  return (
    <>
      <div
        ref={containerRef}
        className={styles.artefactBlock}
        data-testid="artefact-block"
      >
        <ArtefactHeader
          block={block}
          collapsed={collapsed}
          onToggleCollapse={handleToggleCollapse}
          onMaximise={handleMaximise}
          expandBtnRef={expandBtnRef}
        />

        {!collapsed && hasBeenVisible && (
          <>
            <div
              className={styles.iframeWrapper}
              style={{ height: clampedHeight }}
              data-testid="artefact-iframe-wrapper"
            >
              <iframe
                ref={iframeRefCb}
                srcDoc={srcdoc}
                sandbox="allow-scripts"
                title={block.title}
                className={styles.iframe}
                data-testid="artefact-iframe"
              />
            </div>

            {hasActions && (
              <ArtefactActions
                actions={block.actions!}
                onSendMessage={onSendMessage}
              />
            )}
          </>
        )}
      </div>

      {/* Maximised overlay — dialog semantics with focus management */}
      {maximised && (
        <div
          className={styles.maximisedOverlay}
          onClick={handleCloseMaximised}
          data-testid="artefact-maximised-overlay"
        >
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events -- Escape handled via keydown listener */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={styles.maximisedPanel}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.maximisedHeader}>
              <span id={titleId} className={styles.maximisedTitle}>{block.title}</span>
              <button
                ref={closeBtnRef}
                type="button"
                className={styles.maximisedCloseBtn}
                onClick={handleCloseMaximised}
                aria-label="Close expanded artefact"
                data-testid="artefact-maximised-close"
              >
                <X size={16} />
              </button>
            </div>
            <div className={styles.maximisedContent}>
              <iframe
                srcDoc={srcdoc}
                sandbox="allow-scripts"
                title={block.title}
                className={styles.maximisedIframe}
                data-testid="artefact-maximised-iframe"
              />
            </div>
            {hasActions && (
              <div className={styles.maximisedActions}>
                <ArtefactActions
                  actions={block.actions!}
                  onSendMessage={onSendMessage}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
})
