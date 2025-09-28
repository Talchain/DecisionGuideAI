import React, { useState } from 'react';
import { Activity, AlertCircle, CheckCircle } from 'lucide-react';
import { EngineStatus } from '../hooks/useEngineMode';

interface HealthStatusProps {
  status: EngineStatus;
  onRefresh?: () => void;
}

export default function HealthStatus({ status, onRefresh }: HealthStatusProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (status.mode !== 'live') {
    return null;
  }

  const getStatusIcon = () => {
    if (!status.health) {
      return <Activity className="h-4 w-4 text-gray-400" />;
    }

    switch (status.health.status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'unhealthy':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    if (!status.health) return 'Unknown';
    return status.health.status.charAt(0).toUpperCase() + status.health.status.slice(1);
  };

  return (
    <div className="relative">
      <button
        onClick={onRefresh}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className="flex items-center space-x-1 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        style={{ minHeight: '44px', minWidth: '44px' }} // Mobile tap target
        aria-label={`Gateway health: ${getStatusText()}. Click to refresh.`}
      >
        {getStatusIcon()}
        <span className="text-xs font-medium text-gray-700 sr-only sm:not-sr-only">
          {status.connected ? 'Live' : 'Disconnected'}
        </span>
      </button>

      {/* Health Tooltip */}
      {showTooltip && status.health && (
        <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
          <div className="space-y-1">
            <div>Status: {getStatusText()}</div>
            <div>P95: {status.health.p95_ms}ms</div>
            {status.correlationId && (
              <div className="text-gray-400 text-xs">
                {status.correlationId.slice(0, 8)}...
              </div>
            )}
          </div>
          {/* Tooltip arrow */}
          <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
        </div>
      )}
    </div>
  );
}