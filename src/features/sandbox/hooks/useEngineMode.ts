import { useState, useEffect } from 'react';
import { isLiveGatewayEnabled } from '../flags';

// Frozen SSE events as per contract
export type SSEEventType = 'hello' | 'token' | 'cost' | 'done' | 'cancelled' | 'limited' | 'error';

export interface SSEEvent {
  type: SSEEventType;
  data: any;
  id?: string;
  timestamp: string;
}

export interface EngineStatus {
  mode: 'fixtures' | 'live';
  connected: boolean;
  health?: {
    status: string;
    p95_ms: number;
  };
  correlationId?: string;
}

export interface StreamStats {
  firstTokenTime?: number;
  resumeCount: number;
  cancelCount: number;
  startTime?: number;
}

export function useEngineMode() {
  const [status, setStatus] = useState<EngineStatus>({
    mode: isLiveGatewayEnabled() ? 'live' : 'fixtures',
    connected: false
  });

  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [stats, setStats] = useState<StreamStats>({
    resumeCount: 0,
    cancelCount: 0
  });

  const [isStreaming, setIsStreaming] = useState(false);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);
  const [lastEventId, setLastEventId] = useState<string | null>(null);

  // Health check for live mode
  useEffect(() => {
    if (status.mode === 'live') {
      checkHealth();
    }
  }, [status.mode]);

  const checkHealth = async () => {
    try {
      const response = await fetch('/health', {
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const health = await response.json();
        const correlationId = response.headers.get('X-Olumi-Correlation-Id');

        setStatus(prev => ({
          ...prev,
          health: {
            status: health.status || 'unknown',
            p95_ms: health.p95_ms || 0
          },
          correlationId: correlationId || undefined
        }));
      }
    } catch (error) {
      console.warn('Health check failed:', error);
    }
  };

  const announce = (message: string) => {
    const liveRegion = document.getElementById('live-announcements');
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  };

  const startStream = (scenarioId: string, seed: number) => {
    if (status.mode === 'fixtures') {
      startFixtureStream(scenarioId, seed);
    } else {
      startLiveStream(scenarioId, seed);
    }
  };

  const startFixtureStream = (scenarioId: string, seed: number) => {
    setIsStreaming(true);
    setStats(prev => ({ ...prev, startTime: Date.now() }));
    announce('Results streaming');

    // Simulate fixtures-based stream
    const fixtureEvents: SSEEvent[] = [
      {
        type: 'hello',
        data: { sessionId: `fixture-${scenarioId}`, timestamp: new Date().toISOString() },
        id: '1',
        timestamp: new Date().toISOString()
      },
      {
        type: 'token',
        data: { text: '# Analysis Results\n\n', timestamp: new Date().toISOString() },
        id: '2',
        timestamp: new Date().toISOString()
      },
      {
        type: 'token',
        data: { text: `Analysis for ${scenarioId} with seed ${seed}`, timestamp: new Date().toISOString() },
        id: '3',
        timestamp: new Date().toISOString()
      },
      {
        type: 'cost',
        data: { amount: 0.001, currency: 'USD', timestamp: new Date().toISOString() },
        id: '4',
        timestamp: new Date().toISOString()
      },
      {
        type: 'done',
        data: { sessionId: `fixture-${scenarioId}`, totalTokens: 25, timestamp: new Date().toISOString() },
        id: '5',
        timestamp: new Date().toISOString()
      }
    ];

    // Emit events with delays
    fixtureEvents.forEach((event, index) => {
      setTimeout(() => {
        setEvents(prev => [...prev, event]);
        setLastEventId(event.id || null);

        if (event.type === 'token' && !stats.firstTokenTime) {
          const ttff = Date.now() - (stats.startTime || Date.now());
          setStats(prev => ({ ...prev, firstTokenTime: ttff }));
        }

        if (event.type === 'done') {
          setIsStreaming(false);
          announce('Report available');
        }
      }, index * 300);
    });
  };

  const startLiveStream = (scenarioId: string, seed: number) => {
    const url = new URL('/stream', window.location.origin);
    url.searchParams.set('scenarioId', scenarioId);
    url.searchParams.set('seed', seed.toString());

    if (lastEventId && stats.resumeCount > 0) {
      url.searchParams.set('lastEventId', lastEventId);
    }

    const es = new EventSource(url.toString());
    setEventSource(es);
    setIsStreaming(true);
    setStats(prev => ({ ...prev, startTime: Date.now() }));
    announce('Results streaming');

    es.onopen = () => {
      setStatus(prev => ({ ...prev, connected: true }));
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const sseEvent: SSEEvent = {
          type: data.type as SSEEventType,
          data,
          id: event.lastEventId || undefined,
          timestamp: new Date().toISOString()
        };

        setEvents(prev => [...prev, sseEvent]);
        setLastEventId(event.lastEventId || null);

        // Track first token timing
        if (data.type === 'token' && !stats.firstTokenTime) {
          const ttff = Date.now() - (stats.startTime || Date.now());
          setStats(prev => ({ ...prev, firstTokenTime: ttff }));
        }

        // Handle terminal events
        if (data.type === 'done' || data.type === 'cancelled') {
          setIsStreaming(false);
          setStatus(prev => ({ ...prev, connected: false }));
          announce(data.type === 'done' ? 'Report available' : 'Stream cancelled');
        }

      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    };

    es.onerror = () => {
      setStatus(prev => ({ ...prev, connected: false }));
      setIsStreaming(false);
      announce('Connection error');
    };
  };

  const simulateBlip = () => {
    if (stats.resumeCount >= 1) {
      announce('Resume limit reached');
      return;
    }

    if (eventSource) {
      eventSource.close();
      setEventSource(null);
      setStatus(prev => ({ ...prev, connected: false }));
      setStats(prev => ({ ...prev, resumeCount: prev.resumeCount + 1 }));

      // Resume after brief delay
      setTimeout(() => {
        announce('Connection restored; continuing');
        if (status.mode === 'live') {
          // In live mode, would restart with lastEventId
          // For now, just update status
          setStatus(prev => ({ ...prev, connected: true }));
        }
      }, 1000);
    }
  };

  const cancelStream = () => {
    setStats(prev => ({ ...prev, cancelCount: prev.cancelCount + 1 }));

    if (stats.cancelCount === 0) {
      // First cancel - actually cancel
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }
      setIsStreaming(false);
      setStatus(prev => ({ ...prev, connected: false }));
      announce('Stream cancelled');

      // Add cancelled event
      const cancelEvent: SSEEvent = {
        type: 'cancelled',
        data: { reason: 'user_cancelled', timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString()
      };
      setEvents(prev => [...prev, cancelEvent]);
    }
    // Second cancel is idempotent - no-op
  };

  const reset = () => {
    setEvents([]);
    setStats({ resumeCount: 0, cancelCount: 0 });
    setLastEventId(null);
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }
    setIsStreaming(false);
    setStatus(prev => ({ ...prev, connected: false }));
  };

  return {
    status,
    events,
    stats,
    isStreaming,
    startStream,
    simulateBlip,
    cancelStream,
    reset,
    checkHealth
  };
}