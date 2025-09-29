import { useEffect, useRef, useState } from 'react'
import { isJobsProgressEnabled } from '../flags'
import { openJobsStream, type StreamHandle } from '../lib/sseClient'
import { getDefaults } from '../lib/session'

type JobRow = {
  id: string
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'
  progress?: number
  ts: number
}

export default function JobsProgressPanel() {
  if (!isJobsProgressEnabled()) return null

  const [jobs, setJobs] = useState<JobRow[]>([])
  const handleRef = useRef<StreamHandle | null>(null)
  const cancelBtnRef = useRef<HTMLButtonElement | null>(null)
  const [cancelling, setCancelling] = useState<boolean>(false)

  useEffect(() => {
    const { org } = getDefaults()
    // PoC: track a single job id
    const jobId = 'job-1'
    setJobs([{ id: jobId, status: 'queued', ts: Date.now(), progress: 0 }])
    const h = openJobsStream({
      jobId,
      org,
      onStatus: (s) => {
        setJobs((rows) => rows.map(r => r.id === jobId ? { ...r, status: s, ts: Date.now() } : r))
      },
      onProgress: (n) => {
        const v = Math.max(0, Math.min(100, Math.round(n)))
        setJobs((rows) => rows.map(r => r.id === jobId ? { ...r, progress: v, ts: Date.now() } : r))
      },
      onDone: () => {
        setJobs((rows) => rows.map(r => r.id === jobId ? { ...r, status: 'done', ts: Date.now() } : r))
      },
      onCancelled: () => {
        setJobs((rows) => rows.map(r => r.id === jobId ? { ...r, status: 'cancelled', ts: Date.now() } : r))
      },
      onError: () => {
        setJobs((rows) => rows.map(r => r.id === jobId ? { ...r, status: 'failed', ts: Date.now() } : r))
      },
    })
    handleRef.current = h
    return () => { h.close(); handleRef.current = null }
  }, [])

  const cancel = async (id: string) => {
    if (cancelling) return
    setCancelling(true)
    try {
      cancelBtnRef.current?.focus()
    } catch {}
    // Optimistic visual feedback for SRs; server echo may not arrive after close
    setJobs((rows) => rows.map(r => r.id === id ? { ...r, status: 'cancelled' } : r))
    try { await handleRef.current?.cancel() } catch {}
  }

  return (
    <section aria-labelledby="jobs-hdr" className="p-3 rounded-md border border-gray-200 bg-white text-sm">
      <h2 id="jobs-hdr" className="font-semibold mb-2">Jobs</h2>
      <ul role="list" data-testid="jobs-list" aria-live="polite" className="space-y-1">
        {jobs.map((j) => {
          const isActive = j.status === 'queued' || j.status === 'running'
          return (
            <li key={j.id} data-testid="job-item" className="flex items-center gap-2">
              <span data-testid="job-status" className="text-xs px-2 py-0.5 rounded-full border border-gray-300 bg-gray-50">
                {j.status === 'queued' && 'Queued'}
                {j.status === 'running' && 'Running'}
                {j.status === 'done' && 'Done'}
                {j.status === 'failed' && 'Failed'}
                {j.status === 'cancelled' && 'Cancelled'}
              </span>
              <span className="text-xs text-gray-700">{j.id}</span>
              <time data-testid="job-time" className="text-[11px] text-gray-400 ml-1">just now</time>
              <div className="ml-auto flex items-center gap-2">
                {typeof j.progress === 'number' && (
                  <div className="w-24 bg-gray-100 rounded h-2" aria-hidden="true">
                    <div className="h-2 rounded bg-emerald-500" style={{ width: `${j.progress}%` }} />
                  </div>
                )}
                {isActive && (
                  <button
                    type="button"
                    data-testid="job-cancel-btn"
                    aria-label={`Cancel job ${j.id}`}
                    title="Cancel job"
                    className="px-2 py-0.5 rounded border border-gray-300 text-xs"
                    onClick={() => cancel(j.id)}
                    ref={cancelBtnRef}
                    disabled={cancelling}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
