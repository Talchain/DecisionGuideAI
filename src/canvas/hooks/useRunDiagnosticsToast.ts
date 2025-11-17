import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { useToast } from '../ToastContext'

/**
 * Diagnostics resume toast hook
 *
 * Shows a single non-blocking toast when a streaming run has one or more
 * resumes, based on runMeta.diagnostics.resumes. Guarded per-run so it
 * cannot spam even if diagnostics are updated multiple times.
 */
export function useRunDiagnosticsToast() {
  const diagnostics = useCanvasStore(s => s.runMeta.diagnostics)
  const resultsStatus = useCanvasStore(s => s.results.status)
  const { showToast } = useToast()

  const hasShownForRunRef = useRef(false)

  // Reset guard whenever a new run starts
  useEffect(() => {
    if (resultsStatus === 'preparing') {
      hasShownForRunRef.current = false
    }
  }, [resultsStatus])

  // Show toast once per run when resumes > 0
  useEffect(() => {
    const resumes = diagnostics?.resumes ?? 0
    if (resumes > 0 && !hasShownForRunRef.current) {
      hasShownForRunRef.current = true
      showToast(
        `Connection resumed (${resumes}). Output may be slower; results remain valid.`,
        'info'
      )
    }
  }, [diagnostics?.resumes, showToast])
}
