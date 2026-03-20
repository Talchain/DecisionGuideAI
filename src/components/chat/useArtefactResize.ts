/**
 * useArtefactResize -- Per-iframe message listener for artefact blocks.
 *
 * Handles two postMessage types from the sandboxed iframe:
 * - `olumi-artefact-resize`: reports body height for auto-sizing
 * - `olumi-artefact-action`: routes user-triggered actions to sendMessage
 *
 * Uses event.source matching to target the correct iframe when multiple
 * artefacts exist in the chat.
 */

import { useEffect, useCallback, useRef } from 'react'

export function useArtefactResize(
  onResize: (height: number) => void,
  onAction?: (message: string) => void,
) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const onResizeRef = useRef(onResize)
  onResizeRef.current = onResize
  const onActionRef = useRef(onAction)
  onActionRef.current = onAction

  // Per-iframe message listener that checks event.source
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // Only handle messages from this iframe
      if (!iframeRef.current || iframeRef.current.contentWindow !== event.source) return

      if (
        event.data?.type === 'olumi-artefact-resize' &&
        typeof event.data.height === 'number'
      ) {
        onResizeRef.current(event.data.height)
      }

      if (
        event.data?.type === 'olumi-artefact-action' &&
        typeof event.data.message === 'string'
      ) {
        onActionRef.current?.(event.data.message)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const setIframeRef = useCallback((el: HTMLIFrameElement | null) => {
    iframeRef.current = el
  }, [])

  return setIframeRef
}
