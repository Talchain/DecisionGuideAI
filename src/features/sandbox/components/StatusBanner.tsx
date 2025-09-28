import React from 'react';
import { AlertCircle, CheckCircle, Info, XCircle, Clock } from 'lucide-react';

export type StatusType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface StatusBannerProps {
  type: StatusType;
  message: string;
  details?: string;
  onDismiss?: () => void;
  className?: string;
}

// British English catalogue phrases for common error taxonomy
export const CATALOGUE_PHRASES = {
  // Connection & Network
  CONNECTION_LOST: "Connection lost. We're attempting to reconnect automatically.",
  CONNECTION_RESTORED: "Connection restored. Analysis will continue.",
  NETWORK_ERROR: "Network error occurred. Please check your connection and try again.",
  TIMEOUT_ERROR: "Request timed out. The service may be experiencing high demand.",

  // Authentication & Permissions
  AUTH_REQUIRED: "Authentication required. Please sign in to continue.",
  PERMISSION_DENIED: "Access denied. You don't have permission for this action.",
  SESSION_EXPIRED: "Your session has expired. Please refresh and try again.",

  // Rate Limiting & Capacity
  RATE_LIMITED: "Too many requests. Please wait a moment before trying again.",
  CAPACITY_EXCEEDED: "Service is at capacity. We're working to resolve this shortly.",
  QUOTA_EXCEEDED: "Usage limit reached. Please upgrade your plan or try again later.",

  // Data & Processing
  INVALID_DATA: "Invalid data received. Please check your input and try again.",
  PROCESSING_ERROR: "Processing error occurred. Our team has been notified.",
  DATA_UNAVAILABLE: "Data temporarily unavailable. Please try again in a few moments.",

  // Analysis Specific
  ANALYSIS_FAILED: "Analysis could not be completed. Please try with a different template.",
  MODEL_UNAVAILABLE: "Analysis model temporarily unavailable. Please try again shortly.",
  SEED_ERROR: "Invalid seed value. Please select a different template.",

  // Success States
  ANALYSIS_COMPLETE: "Analysis completed successfully.",
  TEMPLATE_LOADED: "Template loaded successfully.",
  EXPORT_READY: "Export prepared and ready for download.",

  // Loading States
  ANALYSING: "Analysing your scenario. This may take a few moments.",
  CONNECTING: "Connecting to analysis service...",
  LOADING_TEMPLATE: "Loading template data...",
} as const;

export default function StatusBanner({
  type,
  message,
  details,
  onDismiss,
  className = ''
}: StatusBannerProps) {
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'loading':
        return 'bg-gray-50 border-gray-200 text-gray-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-600" />;
      case 'loading':
        return <Clock className="h-5 w-5 text-gray-600 animate-pulse" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  const getAriaRole = () => {
    if (type === 'error') return 'alert';
    if (type === 'loading') return 'status';
    return 'status';
  };

  return (
    <div
      className={`rounded-md border p-4 ${getTypeStyles()} ${className}`}
      role={getAriaRole()}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="flex">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium">
            {message}
          </p>
          {details && (
            <p className="mt-1 text-sm opacity-75">
              {details}
            </p>
          )}
        </div>
        {onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                onClick={onDismiss}
                className="inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 hover:opacity-75 transition-opacity"
                style={{ minHeight: '44px', minWidth: '44px' }}
                aria-label="Dismiss status message"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}