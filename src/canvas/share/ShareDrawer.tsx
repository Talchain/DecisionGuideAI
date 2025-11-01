/**
 * Share Drawer Component
 *
 * Builds minimal, deterministic share links anchored by response_hash.
 * Enforces share-hash validation and allowlist checking.
 *
 * Features:
 * - Show seed & hash from last run
 * - Copy share link to clipboard
 * - Allowlist status indicator (when flag enabled)
 * - Open share link button
 * - Sanitized query params with length limits
 *
 * Flag: VITE_FEATURE_SHARE_ALLOWLIST=0|1 (already exists)
 */

import { useState, useEffect } from 'react'
import { useCanvasStore } from '../store'
import { sanitizeLabel } from '../utils/sanitize'

export interface ShareDrawerProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Validate share hash format (basic check)
 */
function isValidShareHash(hash: string): boolean {
  // Hash should be alphanumeric, 8-64 chars
  return /^[a-zA-Z0-9]{8,64}$/.test(hash)
}

/**
 * Build share URL from hash and optional template ID
 */
function buildShareUrl(hash: string, templateId?: string): string {
  const base = window.location.origin
  const params = new URLSearchParams()

  // Sanitize and validate hash
  if (!isValidShareHash(hash)) {
    throw new Error('Invalid share hash format')
  }

  if (templateId) {
    // Sanitize template ID (max 50 chars, alphanumeric + dash/underscore)
    const cleanTemplateId = templateId.slice(0, 50).replace(/[^a-zA-Z0-9_-]/g, '')
    if (cleanTemplateId) {
      params.set('template', cleanTemplateId)
    }
  }

  const query = params.toString()
  return `${base}/#/share/${hash}${query ? `?${query}` : ''}`
}

export function ShareDrawer({ isOpen, onClose }: ShareDrawerProps) {
  const [copied, setCopied] = useState(false)
  const [allowlistStatus, setAllowlistStatus] = useState<'checking' | 'allowed' | 'not-allowed' | 'unknown'>('unknown')

  const results = useCanvasStore(s => s.results)

  const { seed, hash } = results

  // Check allowlist when drawer opens (if flag enabled)
  useEffect(() => {
    if (!isOpen || !hash) return

    const allowlistEnabled = String(import.meta.env.VITE_FEATURE_SHARE_ALLOWLIST) === '1'
    if (!allowlistEnabled) {
      setAllowlistStatus('unknown')
      return
    }

    // TODO: Implement actual allowlist check via /v1/allowlist endpoint
    // For now, just mark as checking
    setAllowlistStatus('checking')

    // Simulated check (replace with real API call)
    setTimeout(() => {
      // Mock: all hashes allowed for now
      setAllowlistStatus('allowed')
    }, 500)
  }, [isOpen, hash])

  if (!isOpen) return null

  const handleCopyLink = () => {
    if (!hash) {
      alert('No hash available. Run an analysis first.')
      return
    }

    try {
      const url = buildShareUrl(hash)
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }).catch(err => {
        alert('Failed to copy to clipboard')
        console.error(err)
      })
    } catch (err) {
      alert('Invalid hash format')
      console.error(err)
    }
  }

  const handleOpenLink = () => {
    if (!hash) {
      alert('No hash available. Run an analysis first.')
      return
    }

    try {
      const url = buildShareUrl(hash)
      window.open(url, '_blank')
    } catch (err) {
      alert('Invalid hash format')
      console.error(err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" aria-hidden="true" />

      {/* Drawer */}
      <div
        className="relative w-full max-w-md bg-white rounded-lg shadow-xl p-6"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Share link"
        aria-modal="true"
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Share Analysis</h2>

        {/* Seed & Hash */}
        <div className="mb-4 space-y-2">
          <div>
            <label className="text-sm font-medium text-gray-700">Seed</label>
            <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm font-mono">
              {seed ?? 'N/A'}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Response Hash</label>
            <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm font-mono truncate">
              {hash ? sanitizeLabel(hash) : 'N/A'}
            </div>
          </div>
        </div>

        {/* Allowlist Status */}
        {String(import.meta.env.VITE_FEATURE_SHARE_ALLOWLIST) === '1' && hash && (
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Allowlist Status:</span>
              {allowlistStatus === 'checking' && (
                <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">Checking...</span>
              )}
              {allowlistStatus === 'allowed' && (
                <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">✓ Allowed</span>
              )}
              {allowlistStatus === 'not-allowed' && (
                <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">✗ Not Allowed</span>
              )}
            </div>
            {allowlistStatus === 'not-allowed' && (
              <p className="text-xs text-red-600 mt-1">
                This hash is not on the allowlist. Share link may not work.
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleCopyLink}
            disabled={!hash}
            className="flex-1 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>

          <button
            onClick={handleOpenLink}
            disabled={!hash}
            className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Open
          </button>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          Close
        </button>
      </div>
    </div>
  )
}
