/**
 * PLoT SSE Canary (Phase A - Hidden)
 * Flag: VITE_UI_STREAM_CANARY=1
 */

const API_BASE = import.meta.env.VITE_PLOT_API_BASE_URL || 'https://plot-api.example.com'
const RETRY_MS = 1500
const KEEPALIVE_INTERVAL_MS = 15000

export type StreamEvent = {
  id: string
  event: string
  data: any
  response_id?: string
  template_id?: string
}

export class PlotStreamClient {
  private eventSource: EventSource | null = null
  private lastEventId: string | null = null
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null
  private reconnectAttempts = 0

  constructor(
    private token: string,
    private onEvent: (event: StreamEvent) => void,
    private onError?: (error: Error) => void
  ) {}

  connect() {
    const url = `${API_BASE}/v1/stream?enhanced=1&token=${this.token}`
    
    this.eventSource = new EventSource(url)
    
    this.eventSource.onmessage = (e) => {
      if (e.data === ':keepalive') {
        console.debug('[plotStream] Keepalive received')
        return
      }
      
      try {
        const data = JSON.parse(e.data)
        const event: StreamEvent = {
          id: e.lastEventId,
          event: e.type,
          data,
          response_id: data.response_id,
          template_id: data.template_id
        }
        
        this.lastEventId = e.lastEventId
        this.onEvent(event)
      } catch (err) {
        console.error('[plotStream] Parse error:', err)
      }
    }
    
    this.eventSource.onerror = () => {
      console.warn('[plotStream] Connection error, will retry')
      this.disconnect()
      
      if (this.reconnectAttempts < 5) {
        setTimeout(() => {
          this.reconnectAttempts++
          this.connect()
        }, RETRY_MS)
      } else {
        this.onError?.(new Error('Max reconnect attempts reached'))
      }
    }
    
    this.keepaliveTimer = setInterval(() => {
      console.debug('[plotStream] Keepalive check')
    }, KEEPALIVE_INTERVAL_MS)
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer)
      this.keepaliveTimer = null
    }
  }
}

export function isStreamCanaryEnabled(): boolean {
  return import.meta.env.VITE_UI_STREAM_CANARY === '1'
}
