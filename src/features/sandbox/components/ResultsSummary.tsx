import React, { useState } from 'react';
import { TrendingUp, Target, Clock, BarChart3, Copy, Activity } from 'lucide-react';
import CompareDrawer from './CompareDrawer';
import { EngineStatus, StreamStats } from '../hooks/useEngineMode';

interface ResultsSummaryProps {
  seed: number;
  nodeCount: number;
  drivers: string[];
  templateName: string;
  templateId?: string;
  engineStatus?: EngineStatus;
  streamStats?: StreamStats;
  isStreaming?: boolean;
}

export default function ResultsSummary({
  seed,
  nodeCount,
  drivers,
  templateName,
  templateId,
  engineStatus,
  streamStats,
  isStreaming
}: ResultsSummaryProps) {
  const [compareOpen, setCompareOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const modelName = 'claude-3-5-sonnet-20241022';

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(`${label} copied!`);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (error) {
      setCopyFeedback('Copy failed');
      setTimeout(() => setCopyFeedback(null), 2000);
    }
  };

  const generateFilename = (type: string) => {
    return `analysis_${type}_seed${seed}_${modelName.split('-')[0]}.csv`;
  };
  return (
    <div className="bg-white rounded-lg border border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-medium text-gray-900">Results Summary</h2>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-6">
        {/* Analysis Overview */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Analysis Overview</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Target className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">SEED</span>
              </div>
              <div className="text-lg font-semibold text-blue-900 mt-1">{seed}</div>
            </div>

            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-green-700">NODES</span>
              </div>
              <div className="text-lg font-semibold text-green-900 mt-1">{nodeCount}</div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">Template</div>
            <div className="text-sm font-medium text-gray-900">{templateName}</div>
          </div>

          {/* Copy Helpers */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleCopy(seed.toString(), 'Seed')}
              className="flex items-center justify-center space-x-1 p-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              style={{ minHeight: '44px' }} // Mobile tap target
            >
              <Copy className="h-3 w-3" />
              <span>Copy Seed</span>
            </button>
            <button
              onClick={() => handleCopy(modelName, 'Model')}
              className="flex items-center justify-center space-x-1 p-2 bg-green-50 text-green-700 rounded-md hover:bg-green-100 transition-colors text-xs focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              style={{ minHeight: '44px' }} // Mobile tap target
            >
              <Copy className="h-3 w-3" />
              <span>Copy Model</span>
            </button>
          </div>

          {copyFeedback && (
            <div className="text-center p-2 bg-green-50 text-green-700 rounded-md text-xs">
              {copyFeedback}
            </div>
          )}
        </div>

        {/* Key Drivers */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Key Drivers</h3>

          {drivers.length > 0 ? (
            <div className="space-y-2">
              {drivers.slice(0, 3).map((driver, index) => (
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
          ) : (
            <div className="text-center py-8 text-gray-500">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No analysis results yet</p>
              <p className="text-xs">Select a template to see key drivers</p>
            </div>
          )}
        </div>

        {/* Performance Metrics */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Performance</h3>
            {isStreaming && (
              <div className="flex items-center space-x-1">
                <Activity className="h-3 w-3 text-blue-600 animate-pulse" />
                <span className="text-xs text-blue-600">Live</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
              <span className="text-xs text-gray-600">
                {streamStats?.firstTokenTime ? 'First Token' : 'Analysis Time'}
              </span>
              <span className="text-xs font-medium text-gray-900">
                {streamStats?.firstTokenTime
                  ? `${streamStats.firstTokenTime}ms`
                  : isStreaming
                  ? 'Streaming...'
                  : '2.3s'
                }
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
              <span className="text-xs text-gray-600">Mode</span>
              <span className="text-xs font-medium text-gray-900">
                {engineStatus?.mode === 'live' ? 'Live Gateway' : 'Fixtures'}
              </span>
            </div>
            <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
              <span className="text-xs text-gray-600">Confidence</span>
              <span className="text-xs font-medium text-green-700">HIGH (87%)</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
              <span className="text-xs text-gray-600">Currency</span>
              <span className="text-xs font-medium text-gray-900">USD</span>
            </div>
            {streamStats && (streamStats.resumeCount > 0 || streamStats.cancelCount > 0) && (
              <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                <span className="text-xs text-yellow-700">Interruptions</span>
                <span className="text-xs font-medium text-yellow-800">
                  {streamStats.resumeCount} resumes, {streamStats.cancelCount} cancels
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wide">Quick Actions</h3>

          <div className="space-y-2">
            <button
              onClick={() => setCompareOpen(true)}
              className="w-full flex items-center justify-between p-2 text-xs text-blue-600 hover:bg-blue-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              style={{ minHeight: '44px' }} // Mobile tap target
            >
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-3 w-3" />
                <span>Compare Options</span>
              </div>
            </button>
            <button className="w-full text-left p-2 text-xs text-blue-600 hover:bg-blue-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              Export Analysis ({generateFilename('report')})
            </button>
            <button className="w-full text-left p-2 text-xs text-blue-600 hover:bg-blue-50 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              Download Report ({generateFilename('full')})
            </button>
          </div>
        </div>
      </div>

      {/* Compare Drawer */}
      <CompareDrawer
        isOpen={compareOpen}
        onClose={() => setCompareOpen(false)}
        templateId={templateId}
      />
    </div>
  );
}