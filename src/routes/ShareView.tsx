/**
 * Share View Route
 *
 * Deep-link handler for /#/share/:hash
 * Displays shared analysis results in read-only mode.
 *
 * Security:
 * - Never fetches debug/preview/interim data
 * - Validates hash format (alphanumeric, 8-64 chars)
 * - Sanitizes all user-generated content
 * - Fail-closed: invalid hash → error screen
 *
 * Query params (optional):
 * - template: template ID (sanitized, max 50 chars)
 *
 * Flag: VITE_FEATURE_SHARE_ALLOWLIST=0|1 (allowlist check when ON)
 */

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { sanitizeLabel } from '../canvas/persist'

interface ShareData {
  hash: string
  seed?: number
  graph?: {
    nodes: Array<{ id: string; label?: string; x?: number; y?: number }>
    edges: Array<{ from: string; to: string; label?: string; weight?: number }>
  }
  drivers?: Array<{
    label: string
    polarity: string
    strength: string
    node_id?: string
    edge_id?: string
  }>
  template_id?: string
}

/**
 * Validate share hash format (basic check)
 */
function isValidShareHash(hash: string): boolean {
  // Hash should be alphanumeric, 8-64 chars
  return /^[a-zA-Z0-9]{8,64}$/.test(hash)
}

/**
 * Check if hash is allowlisted (when feature enabled)
 */
async function checkAllowlist(hash: string): Promise<boolean> {
  const allowlistEnabled = String(import.meta.env.VITE_FEATURE_SHARE_ALLOWLIST) === '1'

  if (!allowlistEnabled) {
    // Allowlist disabled - all hashes allowed
    return true
  }

  try {
    // TODO: Implement actual API call to /v1/allowlist endpoint
    // For now, mock response
    console.log('[ShareView] Checking allowlist for hash:', hash)

    // Simulated check (replace with real API)
    await new Promise(resolve => setTimeout(resolve, 300))
    return true // Mock: all allowed for now
  } catch (err) {
    console.error('[ShareView] Allowlist check failed:', err)
    return false
  }
}

/**
 * Fetch shared analysis data by hash
 * Never includes debug/preview/interim fields
 */
async function fetchSharedData(hash: string, templateId?: string): Promise<ShareData | null> {
  try {
    // TODO: Implement actual API call to backend
    // Endpoint: GET /v1/share/:hash?template=:id
    // Backend returns: { hash, seed, graph, drivers, template_id }
    // NEVER includes: debug, preview, interim data

    console.log('[ShareView] Fetching shared data:', { hash, templateId })

    // Simulated fetch (replace with real API)
    await new Promise(resolve => setTimeout(resolve, 500))

    // Mock data for development
    return {
      hash,
      seed: 42,
      graph: {
        nodes: [
          { id: 'n1', label: 'Start', x: 100, y: 100 },
          { id: 'n2', label: 'End', x: 300, y: 100 },
        ],
        edges: [
          { from: 'n1', to: 'n2', label: 'causes', weight: 0.8 },
        ],
      },
      drivers: [
        { label: 'Driver 1', polarity: 'positive', strength: 'strong' },
      ],
      template_id: templateId,
    }
  } catch (err) {
    console.error('[ShareView] Failed to fetch shared data:', err)
    return null
  }
}

export default function ShareView() {
  const { hash } = useParams<{ hash: string }>()
  const [searchParams] = useSearchParams()
  const templateId = searchParams.get('template')

  const [status, setStatus] = useState<'loading' | 'validating' | 'allowed' | 'not-allowed' | 'error' | 'not-found'>('loading')
  const [data, setData] = useState<ShareData | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    if (!hash) {
      setStatus('error')
      setErrorMessage('No share hash provided')
      return
    }

    // Validate hash format
    if (!isValidShareHash(hash)) {
      setStatus('error')
      setErrorMessage('Invalid share hash format. Hash must be alphanumeric and 8-64 characters.')
      return
    }

    // Check allowlist and fetch data
    ;(async () => {
      setStatus('validating')

      const isAllowed = await checkAllowlist(hash)
      if (!isAllowed) {
        setStatus('not-allowed')
        return
      }

      setStatus('allowed')

      // Fetch shared data
      const result = await fetchSharedData(hash, templateId || undefined)

      if (!result) {
        setStatus('not-found')
        setErrorMessage('Shared analysis not found or unavailable.')
        return
      }

      setData(result)
    })()
  }, [hash, templateId])

  // Loading state
  if (status === 'loading' || status === 'validating') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" aria-hidden="true" />
          <p className="mt-4 text-gray-600">
            {status === 'loading' ? 'Loading shared analysis...' : 'Validating share link...'}
          </p>
        </div>
      </div>
    )
  }

  // Not allowed
  if (status === 'not-allowed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-2xl" aria-hidden="true">✗</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">Access Denied</h1>
          </div>
          <p className="text-gray-600 mb-6">
            This share link is not on the allowlist. The analysis may have been removed or is not available for sharing.
          </p>
          <Link
            to="/plot"
            className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Go to PLoT Workspace
          </Link>
        </div>
      </div>
    )
  }

  // Error or not found
  if (status === 'error' || status === 'not-found') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <span className="text-2xl" aria-hidden="true">⚠</span>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">
              {status === 'error' ? 'Invalid Share Link' : 'Not Found'}
            </h1>
          </div>
          <p className="text-gray-600 mb-6">
            {errorMessage || 'The requested analysis could not be found.'}
          </p>
          <Link
            to="/plot"
            className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Go to PLoT Workspace
          </Link>
        </div>
      </div>
    )
  }

  // Success - display shared data
  if (status === 'allowed' && data) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Shared Analysis</h1>
              <p className="text-sm text-gray-500 mt-1">
                Hash: {sanitizeLabel(data.hash)} • Seed: {data.seed ?? 'N/A'}
              </p>
            </div>
            <Link
              to="/plot"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Open in Workspace
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-6xl mx-auto p-4 space-y-6">
          {/* Graph Summary */}
          {data.graph && (
            <section className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Graph Summary</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Nodes:</span>{' '}
                  <span className="text-gray-600">{data.graph.nodes.length}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Edges:</span>{' '}
                  <span className="text-gray-600">{data.graph.edges.length}</span>
                </div>
              </div>

              {/* Nodes List */}
              {data.graph.nodes.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Nodes</h3>
                  <div className="space-y-1">
                    {data.graph.nodes.map(node => (
                      <div key={node.id} className="text-sm text-gray-600">
                        • {sanitizeLabel(node.label || node.id)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Drivers */}
          {data.drivers && data.drivers.length > 0 && (
            <section className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Drivers</h2>
              <div className="space-y-3">
                {data.drivers.map((driver, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {sanitizeLabel(driver.label)}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        <span className="font-medium">Polarity:</span> {driver.polarity} •{' '}
                        <span className="font-medium">Strength:</span> {driver.strength}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Template Info */}
          {data.template_id && (
            <section className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <span className="font-medium">Template:</span> {sanitizeLabel(data.template_id)}
              </p>
            </section>
          )}

          {/* Read-only notice */}
          <div className="text-center text-sm text-gray-500 py-4">
            This is a read-only view of a shared analysis. To edit or run new analyses,{' '}
            <Link to="/plot" className="text-blue-600 hover:underline">
              open the PLoT Workspace
            </Link>
            .
          </div>
        </main>
      </div>
    )
  }

  // Fallback
  return null
}
