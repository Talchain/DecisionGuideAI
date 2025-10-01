import { useEffect, useState } from 'react'
import { fetchDraftFlows, getAuditInfo, type AuditInfo } from '../lib/engine.adapter'

export default function EngineAuditPanel() {
  const [info, setInfo] = useState<AuditInfo>(() => getAuditInfo())
  const [busy, setBusy] = useState(false)
  const [dataHash, setDataHash] = useState<string | null>(null)

  const refresh = () => setInfo(getAuditInfo())

  const onFetch = async () => {
    setBusy(true)
    try {
      const { data, status } = await fetchDraftFlows()
      if (status !== 304 && data != null) {
        try { setDataHash(String(JSON.stringify(data).length)) } catch { setDataHash(null) }
      }
      refresh()
    } catch {
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const onRefetch = async () => {
    // Same as fetch; If-None-Match will be sent when cachedEtag exists
    await onFetch()
  }

  useEffect(() => {
    // Initial paint in case adapter already has values
    refresh()
  }, [])

  const hdr = info.lastHeaders || {}
  const etag = hdr['etag'] || hdr['ETag'] || null
  const contentLength = hdr['content-length'] || hdr['Content-Length'] || null
  const cacheControl = hdr['cache-control'] || hdr['Cache-Control'] || null
  const vary = hdr['vary'] || hdr['Vary'] || null

  return (
    <div data-testid="audit-panel" className="mt-3 p-3 rounded-md border border-gray-200 bg-white text-sm">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">Engine Audit</h2>
        <div className="flex items-center gap-2">
          <button type="button" data-testid="audit-fetch-btn" onClick={onFetch} disabled={busy} className="px-2 py-1 rounded border text-xs">Fetch</button>
          <button type="button" data-testid="audit-refetch-btn" onClick={onRefetch} disabled={busy} className="px-2 py-1 rounded border text-xs">Re-fetch</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[11px] text-gray-600">Last status</div>
          <div data-testid="audit-last-status" className="text-sm">{info.lastStatus ?? '—'}</div>
        </div>
        <div>
          <div className="text-[11px] text-gray-600">Cached ETag</div>
          <div data-testid="audit-cached-etag" className="text-sm">{info.cachedEtag ?? '—'}</div>
        </div>
        <div>
          <div className="text-[11px] text-gray-600">Last data hash</div>
          <div data-testid="audit-data-hash" className="text-sm">{dataHash ?? '—'}</div>
        </div>
        <div className="col-span-2 mt-2">
          <div className="text-[11px] text-gray-600 mb-1">Headers (last /draft-flows)</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-gray-600">ETag:</span> <span data-testid="audit-header-etag">{etag ?? '—'}</span></div>
            <div><span className="text-gray-600">Content-Length:</span> <span data-testid="audit-header-content-length">{contentLength ?? '—'}</span></div>
            <div><span className="text-gray-600">Cache-Control:</span> <span data-testid="audit-header-cache-control">{cacheControl ?? '—'}</span></div>
            <div><span className="text-gray-600">Vary:</span> <span data-testid="audit-header-vary">{vary ?? '—'}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
