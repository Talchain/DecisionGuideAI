import { useState, useEffect } from 'react'
import { TrendingUp, Info } from 'lucide-react'
import { useISLConformal } from '../../hooks/useISLConformal'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { Spinner } from '../../components/Spinner'
import { buildRichGraphPayload } from '../utils/graphPayload'

export function ConformalPredictionSection() {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const [enabled, setEnabled] = useState(false)
  const { data, loading, predict } = useISLConformal()

  // Auto-predict when enabled (debounced)
  useEffect(() => {
    if (!enabled || nodes.length === 0 || loading) return

    const timer = setTimeout(() => {
      predict({
        graph: buildRichGraphPayload(nodes, edges),
        options: {
          enable_conformal: true,
          confidence_level: 0.95,
        },
      }).catch(console.error)
    }, 1000)

    return () => clearTimeout(timer)
  }, [enabled, nodes, edges, predict, loading])

  if (nodes.length === 0) {
    return (
      <div className="p-4">
        <p className={`${typography.body} text-ink-900/50 text-center py-8`}>
          Add nodes to your graph to enable conformal prediction
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className={typography.h4}>Confidence Intervals</h3>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4"
          />
          <span className={typography.caption}>Enable</span>
        </label>
      </div>

      {enabled && (
        <>
          {loading && (
            <div className="flex items-center gap-2">
              <Spinner size="sm" />
              <span className={typography.body}>Computing intervals...</span>
            </div>
          )}

          {data && (
            <>
              {/* Overall Calibration */}
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-sky-600 mt-0.5" />
                  <div className="flex-1">
                    <p className={`${typography.label} text-sky-900`}>
                      Calibration: {Math.round(data.overall_calibration * 100)}%
                    </p>
                    <p className={`${typography.caption} text-sky-700 mt-1`}>
                      Based on {data.sample_size} samples. Higher is better.
                    </p>
                  </div>
                </div>
              </div>

              {/* Predictions with Intervals */}
              <div className="space-y-2">
                {data.predictions.map(pred => (
                  <PredictionCard key={pred.node_id} prediction={pred} nodes={nodes} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {!enabled && (
        <div className="p-3 bg-paper-50 border border-sand-200 rounded-lg">
          <p className={`${typography.body} text-ink-900/70`}>
            Enable to see 95% confidence intervals for outcome predictions
          </p>
        </div>
      )}
    </div>
  )
}

interface PredictionCardProps {
  prediction: any
  nodes: any[]
}

function PredictionCard({ prediction, nodes }: PredictionCardProps) {
  const node = nodes.find(n => n.id === prediction.node_id)
  const nodeName = node?.data?.label || prediction.node_id

  const qualityColors = {
    excellent: 'mint',
    good: 'sky',
    fair: 'sun',
    poor: 'carrot',
  }

  const color = qualityColors[prediction.calibration_quality as keyof typeof qualityColors]

  return (
    <div className={`p-3 rounded border border-${color}-200 bg-${color}-50`}>
      <div className="flex items-start gap-2">
        <TrendingUp className={`w-4 h-4 text-${color}-600 mt-0.5`} />
        <div className="flex-1">
          <p className={`${typography.label} text-${color}-900`}>
            {nodeName}
          </p>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className={`${typography.caption} text-${color}-700`}>
                Prediction:
              </span>
              <span className={`${typography.body} text-${color}-900 font-semibold`}>
                {typeof prediction.prediction === 'number'
                  ? prediction.prediction.toFixed(2)
                  : String(prediction.prediction)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`${typography.caption} text-${color}-700`}>
                95% Range:
              </span>
              <span className={`${typography.caption} text-${color}-800 font-mono`}>
                [{prediction.confidence_interval.lower.toFixed(2)}, {prediction.confidence_interval.upper.toFixed(2)}]
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className={`${typography.caption} text-${color}-700`}>
                Quality:
              </span>
              <span className={`${typography.caption} text-${color}-800 capitalize`}>
                {prediction.calibration_quality}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
