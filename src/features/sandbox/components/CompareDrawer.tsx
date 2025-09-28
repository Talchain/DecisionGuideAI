import React, { useState, useEffect, useRef } from 'react';
import { BarChart3, TrendingUp, X, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import compareData from '../fixtures/compare.json';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface CompareResult {
  schema: string;
  meta: {
    seed: number;
    model: string;
  };
  summary: {
    headline: string;
    confidence: string;
  };
  drivers: string[];
  left: {
    scenario: string;
    option: string;
    score: number;
  };
  right: {
    scenario: string;
    option: string;
    score: number;
  };
}

interface CompareDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  leftOption?: string;
  rightOption?: string;
  templateId?: string;
}

export default function CompareDrawer({
  isOpen,
  onClose,
  leftOption = 'option-1',
  rightOption = 'option-2',
  templateId = 'pricing-change'
}: CompareDrawerProps) {
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const focusTrapRef = useFocusTrap(isOpen);

  // Focus management: focus headline when Compare completes
  useEffect(() => {
    if (isOpen && compareResult && headlineRef.current) {
      headlineRef.current.focus();
    }
  }, [isOpen, compareResult]);

  // Load compare fixtures based on template
  useEffect(() => {
    if (isOpen) {
      setLoading(true);

      // Simulate loading delay for realism
      setTimeout(() => {
        let resultKey = 'pricing-vs-feature'; // default

        // Map template to compare fixture
        if (templateId === 'feature-launch') {
          resultKey = 'launch-vs-beta';
        } else if (templateId === 'build-vs-buy') {
          resultKey = 'build-vs-buy';
        }

        const result = compareData.compare[resultKey as keyof typeof compareData.compare];
        setCompareResult(result as CompareResult);
        setLoading(false);
      }, 800);
    }
  }, [isOpen, templateId]);

  if (!isOpen) return null;

  const getConfidenceColor = (confidence: string) => {
    switch (confidence.toUpperCase()) {
      case 'HIGH':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'MEDIUM':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'LOW':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getScoreDelta = () => {
    if (!compareResult) return { delta: 0, direction: 'neutral' };

    const delta = compareResult.right.score - compareResult.left.score;
    const direction = delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral';

    return { delta: Math.abs(delta), direction };
  };

  const scoreDelta = getScoreDelta();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center p-4 z-50">
      <div
        ref={focusTrapRef}
        className="bg-white rounded-t-lg w-full max-w-4xl max-h-[80vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-drawer-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <h2 id="compare-drawer-title" className="text-lg font-semibold text-gray-900">Compare Analysis</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            style={{ minHeight: '44px', minWidth: '44px' }} // Mobile tap target
            aria-label="Close compare drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="text-gray-600">Analysing comparison...</span>
              </div>
            </div>
          ) : compareResult ? (
            <div className="space-y-6">
              {/* Headline Result */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <h3
                    ref={headlineRef}
                    className="text-lg font-medium text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    tabIndex={-1}
                  >
                    Key Finding
                  </h3>
                  <div className={`flex items-center space-x-1 px-2 py-1 rounded-full border text-xs font-medium ${getConfidenceColor(compareResult.summary.confidence)}`}>
                    <span>{compareResult.summary.confidence}</span>
                  </div>
                </div>
                <p className="text-blue-800 text-base leading-relaxed">
                  {compareResult.summary.headline}
                </p>
              </div>

              {/* Score Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-600 mb-2">Left Option</h4>
                  <div className="text-2xl font-bold text-gray-900">{compareResult.left.score}</div>
                  <p className="text-xs text-gray-500 mt-1 capitalize">{compareResult.left.option.replace('-', ' ')}</p>
                </div>

                <div className="bg-white rounded-lg p-4 border-2 border-blue-200 flex items-center justify-center">
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1 mb-2">
                      {scoreDelta.direction === 'positive' ? (
                        <ArrowUpRight className="h-5 w-5 text-green-600" />
                      ) : scoreDelta.direction === 'negative' ? (
                        <ArrowDownRight className="h-5 w-5 text-red-600" />
                      ) : (
                        <div className="h-5 w-5" />
                      )}
                      <span className={`text-lg font-bold ${
                        scoreDelta.direction === 'positive' ? 'text-green-600' :
                        scoreDelta.direction === 'negative' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {scoreDelta.direction !== 'neutral' ? `±${scoreDelta.delta.toFixed(1)}` : '0.0'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">Score Difference</p>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-600 mb-2">Right Option</h4>
                  <div className="text-2xl font-bold text-blue-900">{compareResult.right.score}</div>
                  <p className="text-xs text-gray-500 mt-1 capitalize">{compareResult.right.option.replace('-', ' ')}</p>
                </div>
              </div>

              {/* Key Drivers */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-gray-600" />
                  Three Key Drivers
                </h4>
                <div className="space-y-3">
                  {compareResult.drivers.map((driver, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-blue-700">{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700">{driver}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Metadata */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-600 mb-3">Analysis Details</h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-gray-500">Schema:</span>
                    <span className="ml-2 font-mono text-gray-900">{compareResult.schema}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Seed:</span>
                    <span className="ml-2 font-mono text-gray-900">{compareResult.meta.seed}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Model:</span>
                    <span className="ml-2 font-mono text-gray-900">{compareResult.meta.model}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No comparison data</p>
                <p className="text-sm">Select options to compare</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500">
              Currency: <span className="font-medium">USD</span>
            </div>
            <div className="flex space-x-2">
              <button className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                Export CSV (seed_{compareResult?.meta.seed}_{compareResult?.meta.model.split('-')[0]})
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                style={{ minHeight: '44px' }} // Mobile tap target
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}