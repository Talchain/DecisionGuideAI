import React, { useState, useEffect } from 'react';
import { Grid, List } from 'lucide-react';
import StarterTemplates from './components/StarterTemplates';
import CanvasPane from './components/CanvasPane';
import ResultsSummary from './components/ResultsSummary';
import SimplifyToggle from './components/SimplifyToggle';
import ListView from './components/ListView';
import HealthStatus from './components/HealthStatus';
import StatusBanner, { CATALOGUE_PHRASES } from './components/StatusBanner';
import { useEngineMode } from './hooks/useEngineMode';
import { isMobileViewport } from './flags';

interface Template {
  id: string;
  name: string;
  description: string;
  seed: number;
  nodes: Array<{
    id: string;
    type: string;
    title: string;
    score: number;
    pros: string[];
    cons: string[];
  }>;
  drivers: string[];
}

export default function SandboxShell() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isSimplified, setIsSimplified] = useState(false);
  const [showListView, setShowListView] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'warning' | 'info' | 'loading';
    message: string;
    details?: string;
  } | null>(null);

  const { status, events, stats, isStreaming, startStream, simulateBlip, cancelStream, reset, checkHealth } = useEngineMode();

  // Mobile guardrails: ≤480px shows List first
  useEffect(() => {
    const checkMobile = () => {
      const mobile = isMobileViewport();
      setIsMobile(mobile);
      if (mobile && !showListView) {
        setShowListView(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [showListView]);

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setStatusBanner({
      type: 'success',
      message: CATALOGUE_PHRASES.TEMPLATE_LOADED,
      details: `${template.name} ready for analysis`
    });

    // Auto-dismiss success banner after 3 seconds
    setTimeout(() => setStatusBanner(null), 3000);

    // Start stream when template is selected (live mode only)
    if (template && status.mode === 'live') {
      startStream(template.id, template.seed);
    }
  };

  const handleSimplifyToggle = (simplified: boolean) => {
    setIsSimplified(simplified);
  };

  const toggleView = () => {
    setShowListView(!showListView);
  };

  // Handle streaming events for status banners
  useEffect(() => {
    if (status.mode === 'live') {
      if (isStreaming && !statusBanner) {
        setStatusBanner({
          type: 'loading',
          message: CATALOGUE_PHRASES.ANALYSING,
          details: 'Please wait while we process your scenario'
        });
      } else if (!isStreaming && events.length > 0) {
        const lastEvent = events[events.length - 1];
        if (lastEvent.type === 'done') {
          setStatusBanner({
            type: 'success',
            message: CATALOGUE_PHRASES.ANALYSIS_COMPLETE,
            details: `Analysis finished with ${stats.firstTokenTime}ms first token`
          });
          setTimeout(() => setStatusBanner(null), 4000);
        } else if (lastEvent.type === 'cancelled') {
          setStatusBanner({
            type: 'warning',
            message: 'Analysis cancelled',
            details: 'Stream was cancelled by user request'
          });
          setTimeout(() => setStatusBanner(null), 3000);
        } else if (lastEvent.type === 'error') {
          setStatusBanner({
            type: 'error',
            message: CATALOGUE_PHRASES.PROCESSING_ERROR,
            details: 'Please try again or contact support if the issue persists'
          });
        }
      }
    }
  }, [status.mode, isStreaming, events, stats.firstTokenTime, statusBanner]);

  // Handle connection state changes
  useEffect(() => {
    if (status.mode === 'live') {
      if (!status.connected && isStreaming) {
        setStatusBanner({
          type: 'warning',
          message: CATALOGUE_PHRASES.CONNECTION_LOST,
          details: 'Attempting to reconnect and resume analysis'
        });
      } else if (status.connected && stats.resumeCount > 0) {
        setStatusBanner({
          type: 'info',
          message: CATALOGUE_PHRASES.CONNECTION_RESTORED,
          details: `Resumed successfully (${stats.resumeCount} interruptions)`
        });
        setTimeout(() => setStatusBanner(null), 3000);
      }
    }
  }, [status.connected, isStreaming, stats.resumeCount, status.mode]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Decision Analysis Sandbox</h1>
              <p className="text-gray-600">Explore decision scenarios with interactive templates and analysis</p>
            </div>
            <HealthStatus status={status} onRefresh={checkHealth} />
          </div>
        </div>

        {/* Status Banner */}
        {statusBanner && (
          <div className="mb-6">
            <StatusBanner
              type={statusBanner.type}
              message={statusBanner.message}
              details={statusBanner.details}
              onDismiss={() => setStatusBanner(null)}
            />
          </div>
        )}

        {/* Template Selection */}
        <div className="mb-6">
          <StarterTemplates
            onTemplateSelect={handleTemplateSelect}
            selectedTemplateId={selectedTemplate?.id}
          />
        </div>

        {/* View Controls */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex flex-col sm:flex-row gap-4">
            <SimplifyToggle
              onToggle={handleSimplifyToggle}
              isSimplified={isSimplified}
            />

            {/* Stream Controls (Live Mode Only) */}
            {status.mode === 'live' && selectedTemplate && (
              <div className="flex gap-2">
                <button
                  onClick={() => startStream(selectedTemplate.id, selectedTemplate.seed)}
                  disabled={isStreaming}
                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  style={{ minHeight: '44px' }}
                  aria-label={isStreaming ? 'Analysis in progress' : 'Start analysis'}
                >
                  {isStreaming ? 'Streaming...' : 'Analyse'}
                </button>

                {isStreaming && (
                  <button
                    onClick={cancelStream}
                    className="px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    style={{ minHeight: '44px' }}
                    aria-label="Cancel analysis"
                  >
                    Cancel
                  </button>
                )}

                {status.mode === 'live' && stats.resumeCount < 1 && (
                  <button
                    onClick={simulateBlip}
                    disabled={!isStreaming}
                    className="px-3 py-2 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
                    style={{ minHeight: '44px' }}
                    aria-label="Simulate connection blip"
                  >
                    Blip
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            onClick={toggleView}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            style={{ minHeight: '44px' }} // Mobile tap target
          >
            {showListView ? (
              <>
                <Grid className="h-4 w-4" />
                <span className="text-sm font-medium">Switch to Canvas</span>
              </>
            ) : (
              <>
                <List className="h-4 w-4" />
                <span className="text-sm font-medium">Switch to List View</span>
              </>
            )}
          </button>
        </div>

        {/* Split Layout: Canvas/ListView | Results Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96 lg:h-[600px]">
          <div className="lg:col-span-2">
            {showListView ? (
              <ListView
                nodes={selectedTemplate?.nodes || []}
                templateName={selectedTemplate?.name || 'No template selected'}
                seed={selectedTemplate?.seed || 0}
                isVisible={showListView}
              />
            ) : (
              <CanvasPane
                nodes={selectedTemplate?.nodes || []}
                templateName={selectedTemplate?.name || 'No template selected'}
                seed={selectedTemplate?.seed || 0}
                isSimplified={isSimplified}
              />
            )}
          </div>
          <div>
            <ResultsSummary
              seed={selectedTemplate?.seed || 0}
              nodeCount={selectedTemplate?.nodes?.length || 0}
              drivers={selectedTemplate?.drivers || []}
              templateName={selectedTemplate?.name || 'No template selected'}
              templateId={selectedTemplate?.id}
              engineStatus={status}
              streamStats={stats}
              isStreaming={isStreaming}
            />
          </div>
        </div>
      </div>

      {/* Screen reader live announcements region */}
      <div
        id="live-announcements"
        className="sr-only"
        aria-live="polite"
        role="status"
      ></div>
    </div>
  );
}