/**
 * Dev-only banner showing adapter mode and probe status
 */

import { useState, useEffect } from 'react'
import { RefreshCw, AlertCircle, CheckCircle, Info } from 'lucide-react'
import { getProbeStatus, reprobeCapability, getAdapterMode, type ProbeResult } from '../../adapters/plot/autoDetectAdapter'

interface AdapterStatusBannerProps {
  visible?: boolean;
}

export function AdapterStatusBanner({ visible = true }: AdapterStatusBannerProps): JSX.Element | null {
  const [probeStatus, setProbeStatus] = useState<ProbeResult | null>(null)
  const [adapterMode, setAdapterMode] = useState<'httpv1' | 'mock' | 'auto'>('auto')
  const [reprobing, setReprobing] = useState(false)

  useEffect(() => {
    if (!visible) return;

    // Get initial status
    Promise.all([
      getProbeStatus(),
      getAdapterMode(),
    ]).then(([probe, mode]) => {
      setProbeStatus(probe)
      setAdapterMode(mode)
    })
  }, [visible])

  const handleReprobe = async () => {
    setReprobing(true)
    try {
      const probe = await reprobeCapability()
      setProbeStatus(probe)
      const mode = await getAdapterMode()
      setAdapterMode(mode)
    } finally {
      setReprobing(false)
    }
  }

  if (!visible || !probeStatus) return null

  const isV1Available = probeStatus.available
  const isDev = import.meta.env.DEV

  // Only show in DEV when v1 is unavailable (user needs to know why fallback)
  if (!isDev || isV1Available) return null

  return (
    <div className="mx-4 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-yellow-900">
            PLoT v1 routes unavailable
          </p>
          <p className="text-xs text-yellow-700 mt-1">
            Using mock adapter until backend deploys <code className="bg-yellow-100 px-1 py-0.5 rounded text-xs">/v1/run</code> and <code className="bg-yellow-100 px-1 py-0.5 rounded text-xs">/v1/stream</code> endpoints.
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-yellow-600">
            <span>Mode: <strong>{adapterMode}</strong></span>
            <span>•</span>
            <span>Health: <strong>{probeStatus.healthStatus}</strong></span>
            {probeStatus.endpoints.health && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  GET /health OK
                </span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={handleReprobe}
          disabled={reprobing}
          className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100 rounded transition-colors disabled:opacity-50"
          title="Re-check v1 endpoint availability"
        >
          <RefreshCw className={`w-3 h-3 ${reprobing ? 'animate-spin' : ''}`} />
          Re-probe
        </button>
      </div>
    </div>
  )
}
