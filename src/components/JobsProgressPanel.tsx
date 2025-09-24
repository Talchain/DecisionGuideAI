import { useEffect, useRef, useState } from 'react'
import { isJobsProgressEnabled } from '../flags'
import { openJobsStream, type StreamHandle } from '../lib/sseClient'
import { getDefaults } from '../lib/session'

export default function JobsProgressPanel() {
  if (!isJobsProgressEnabled()) return null

  const [started, setStarted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<'idle' | 'in_progress' | 'done' | 'cancelled' | 'error'>('idle')
  const handleRef = useRef<StreamHandle | null>(null)

  useEffect(() => {
    return () => {
      handleRef.current?.close()
      handleRef.current = null
    }
  }, [])

  const start = () => {
    if (started) return
    setStarted(true)
    setStatus('in_progress')
    setProgress(0)

    const { org } = getDefaults()
    const h = openJobsStream({
      jobId: 'demo-job',
      org,
      onProgress: (n) => {
        const v = Math.max(0, Math.min(100, Math.round(n)))
        setProgress(v)
      },
      onDone: () => {
        setStatus('done')
        setStarted(false)
      },
      onCancelled: () => {
        setStatus('cancelled')
        setStarted(false)
      },
      onError: () => {
        setStatus('error')
        setStarted(false)
      },
    })
    handleRef.current = h
  }

  const cancel = () => {
    if (!started) return
    setStatus('cancelled')
    setStarted(false)
    const h = handleRef.current
    h?.close()
    h?.cancel().catch(() => {})
    handleRef.current = null
  }

  return (
    <div className="p-3 rounded-md border border-gray-200 bg-white text-sm">
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          data-testid="jobs-start-btn"
          onClick={start}
          className="px-2 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
          disabled={started}
        >
          Start Job
        </button>
        <button
          type="button"
          data-testid="jobs-cancel-btn"
          onClick={cancel}
          className="px-2 py-1 rounded bg-gray-200 text-gray-900 disabled:opacity-50"
          disabled={!started}
        >
          Cancel
        </button>
        <div data-testid="jobs-status" className="ml-auto text-xs px-2 py-1 rounded-full border border-gray-300">
          {status === 'idle' && 'Idle'}
          {status === 'in_progress' && 'In progress'}
          {status === 'done' && 'Done'}
          {status === 'cancelled' && 'Cancelled'}
          {status === 'error' && 'Error'}
        </div>
      </div>

      <div
        className="w-full bg-gray-100 rounded h-3"
        aria-live="polite"
        aria-busy={started ? 'true' : 'false'}
      >
        <div
          role="progressbar"
          data-testid="jobs-progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-3 rounded bg-emerald-500"
          style={{ width: `${progress}%` }}
          title={`${progress}%`}
        />
      </div>
    </div>
  )
}
