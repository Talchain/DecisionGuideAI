import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Paperclip, ChevronDown, Sparkles } from 'lucide-react'
import { useCEEDraft } from '../../hooks/useCEEDraft'
import { DraftPreview } from './DraftPreview'
import { DraftLoadingAnimation } from './DraftLoadingAnimation'
import { ErrorAlert } from '../../components/ErrorAlert'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { CEEError } from '../../adapters/cee/client'
import { DraftGuidancePanel } from './DraftGuidancePanel'
import { RateLimitNotice } from './RateLimitNotice'
import { DEFAULT_EDGE_DATA, trimProvenance } from '../domain/edges'
import { Tooltip } from './Tooltip'

// Available AI models
const AI_MODELS = [
  { id: 'claude-sonnet', name: 'Claude Sonnet', description: 'Fast & capable' },
  { id: 'claude-opus', name: 'Claude Opus', description: 'Most powerful' },
  { id: 'claude-haiku', name: 'Claude Haiku', description: 'Fastest' },
] as const

type AIModelId = typeof AI_MODELS[number]['id']

/** Check if error indicates CEE service is unavailable */
function isCEEUnavailable(error: CEEError | Error): boolean {
  if (error instanceof CEEError) {
    // HTTP 404 (not found) or 503 (service unavailable)
    return error.status === 404 || error.status === 503
  }
  // Network-level failures (no HTTP status) - treat as service unavailable
  // These typically indicate the service is not reachable at all
  const message = error.message?.toLowerCase() ?? ''
  if (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('connection refused') ||
    message.includes('dns') ||
    message.includes('econnrefused')
  ) {
    return true
  }
  return false
}

/** Format CEE error for user-friendly display + debug info */
function formatCEEError(error: CEEError | Error): { message: string; debugInfo?: string; isUnavailable?: boolean } {
  if (error instanceof CEEError) {
    const debugParts = [`Message: ${error.message}`, `Status: ${error.status}`]
    if (error.correlationId) {
      debugParts.push(`Correlation ID: ${error.correlationId}`)
    }
    if (error.details) {
      try {
        const detailsString = typeof error.details === 'string'
          ? error.details
          : JSON.stringify(error.details, null, 2)
        debugParts.push(`Details: ${detailsString}`)
      } catch {
        // Ignore JSON stringify failures
      }
    }

    const debugInfo = debugParts.join('\n')

    // Check if service is unavailable (404/503)
    if (isCEEUnavailable(error)) {
      return {
        message: 'AI drafting is temporarily unavailable.',
        isUnavailable: true,
        debugInfo,
      }
    }

    // Map well-known backend error codes / messages to friendlier text
    const friendlyMessages: Record<string, string> = {
      'openai_response_invalid_schema': 'The AI service returned an unexpected response format. This is a temporary backend issue.',
      'Request timeout': 'The request took too long. The AI service may be starting up - please try again.',
      'Too Many Requests': 'Too many requests. Please wait a moment and try again.',
    }

    const rawDetails = error.details as any
    const reason = rawDetails?.reason ?? rawDetails?.details?.reason
    const code = rawDetails?.code ?? rawDetails?.details?.code

    let message = friendlyMessages[error.message] || error.message
    if (reason === 'empty_draft' || reason === 'empty_graph' || code === 'CEE_GRAPH_INVALID') {
      message = 'The AI assistant returned an empty draft for this description. Try adding more concrete context, factors, and relationships, then try again.'
    }

    return {
      message,
      debugInfo,
    }
  }

  // Check if non-CEEError is a network failure (treat as unavailable)
  if (isCEEUnavailable(error)) {
    return {
      message: 'AI drafting is temporarily unavailable.',
      isUnavailable: true,
    }
  }

  return { message: error.message }
}

export function DraftChat() {
  const [description, setDescription] = useState('')
  const [selectedModel, setSelectedModel] = useState<AIModelId>('claude-sonnet')
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const modelPickerRef = useRef<HTMLDivElement>(null)

  // State for auto-apply flow
  const [appliedNodeIds, setAppliedNodeIds] = useState<string[]>([])
  const [appliedEdgeIds, setAppliedEdgeIds] = useState<string[]>([])
  const [isOnCanvas, setIsOnCanvas] = useState(false)

  const {
    data: draft,
    loading,
    error,
    draft: generateDraft,
    guidance,
    retryAfterSeconds,
    reset,
  } = useCEEDraft()
  // React #185 FIX: Use individual selectors instead of destructuring from useCanvasStore()
  const showDraftChat = useCanvasStore(s => s.showDraftChat)
  const setShowDraftChat = useCanvasStore(s => s.setShowDraftChat)
  const pushHistory = useCanvasStore(s => s.pushHistory)
  const canvasNodes = useCanvasStore(s => s.nodes)
  const applyGuidedLayout = useCanvasStore(s => s.applyGuidedLayout)
  const resetCanvas = useCanvasStore(s => s.resetCanvas)

  // Auto-resize textarea based on content
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto'
    // Set to scrollHeight, capped at max height
    const maxHeight = 200
    const newHeight = Math.min(textarea.scrollHeight, maxHeight)
    textarea.style.height = `${newHeight}px`
  }, [])

  useEffect(() => {
    adjustTextareaHeight()
  }, [description, adjustTextareaHeight])

  // Close model picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(event.target as Node)) {
        setShowModelPicker(false)
      }
    }
    if (showModelPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showModelPicker])

  // Handle file attachment
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      setAttachedFiles(prev => [...prev, ...Array.from(files)])
    }
    // Reset input so same file can be selected again
    event.target.value = ''
  }, [])

  const removeFile = useCallback((index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleDraft = async () => {
    if (!description.trim()) return

    // If there is already a graph on the canvas, confirm before clearing it
    const { nodes, edges } = useCanvasStore.getState()
    const hasExistingGraph = (nodes?.length ?? 0) > 0 || (edges?.length ?? 0) > 0

    if (hasExistingGraph) {
      const confirmed = window.confirm(
        'Drafting a new decision will clear your current decision model from the canvas. Start a new draft?'
      )

      if (!confirmed) {
        return
      }

      // resetCanvas also closes the Draft panel; immediately reopen it so the
      // user stays in the drafting flow while we generate the new model.
      resetCanvas()
      setShowDraftChat(true)
    }

    try {
      const result = await generateDraft(description)
      // Auto-apply the draft to canvas immediately
      if (result?.nodes?.length) {
        const { nodeIds, edgeIds } = applyDraftToCanvas(result)
        setAppliedNodeIds(nodeIds)
        setAppliedEdgeIds(edgeIds)
        setIsOnCanvas(true)
      }
    } catch (err) {
      console.error('Draft failed:', err)
    }
  }

  // Apply draft to canvas and return the IDs of added nodes/edges
  const applyDraftToCanvas = useCallback((draftData: typeof draft) => {
    // Null-safe: bail out if draft or nodes/edges are missing
    if (!draftData?.nodes?.length) return { nodeIds: [], edgeIds: [] }

    // Convert CEE nodes to canvas nodes
    const nodes = draftData.nodes.map((n: any) => ({
      id: n.id,
      type: n.type,
      position: { x: 0, y: 0 }, // Layout algorithm will position
      data: {
        label: n.label,
        uncertainty: n.uncertainty,
      },
    }))

    const edges = (draftData.edges ?? []).map((e: any, i: number) => {
      const id = typeof e.id === 'string' && e.id.trim().length > 0 ? e.id : `e-${i}`

      const weight =
        typeof e.weight === 'number'
          ? Math.max(0, Math.min(1, e.weight))
          : DEFAULT_EDGE_DATA.weight

      const confidence =
        typeof e.belief === 'number' ? Math.max(0, Math.min(1, e.belief)) : undefined

      let provenanceText: string | undefined
      if (typeof e.provenance === 'string' && e.provenance.trim().length > 0) {
        provenanceText = trimProvenance(e.provenance)
      } else if (e.provenance && typeof e.provenance === 'object') {
        const source = e.provenance.source ?? ''
        const quote = e.provenance.quote ?? ''
        const location = e.provenance.location ?? ''
        const combined = [source, quote, location].filter(Boolean).join(' • ')
        if (combined) {
          provenanceText = trimProvenance(combined)
        }
      }

      return {
        id,
        source: e.from,
        target: e.to,
        type: 'styled',
        data: {
          ...DEFAULT_EDGE_DATA,
          weight,
          pathType: 'bezier',
          confidence,
          provenance: provenanceText,
        },
      }
    })

    // Push current state to history, then append nodes/edges in a single transaction
    pushHistory()
    const state = useCanvasStore.getState()
    useCanvasStore.setState({
      nodes: [...state.nodes, ...nodes],
      edges: [...state.edges, ...edges],
    })
    // Always apply layout for AI drafts since all nodes start at (0,0)
    // This ensures proper positioning whether starting fresh or replacing an existing graph
    try {
      applyGuidedLayout()
    } catch (error) {
      console.error('[DraftChat] Guided layout failed after applying draft', error)
    }

    return {
      nodeIds: nodes.map(n => n.id),
      edgeIds: edges.map(e => e.id),
    }
  }, [pushHistory, applyGuidedLayout])

  // Remove the applied draft from canvas
  const removeDraftFromCanvas = useCallback(() => {
    if (appliedNodeIds.length === 0 && appliedEdgeIds.length === 0) return

    pushHistory()
    const state = useCanvasStore.getState()
    useCanvasStore.setState({
      nodes: state.nodes.filter(n => !appliedNodeIds.includes(n.id)),
      edges: state.edges.filter(e => !appliedEdgeIds.includes(e.id)),
    })
    setIsOnCanvas(false)
  }, [appliedNodeIds, appliedEdgeIds, pushHistory])

  // Reinstate the draft to canvas
  const reinstateDraft = useCallback(() => {
    if (!draft) return
    const { nodeIds, edgeIds } = applyDraftToCanvas(draft)
    setAppliedNodeIds(nodeIds)
    setAppliedEdgeIds(edgeIds)
    setIsOnCanvas(true)
  }, [draft, applyDraftToCanvas])

  // Close the panel (keep current canvas state)
  const handleClose = useCallback(() => {
    reset()
    setAppliedNodeIds([])
    setAppliedEdgeIds([])
    setIsOnCanvas(false)
    setShowDraftChat(false)
  }, [reset, setShowDraftChat])

  // Legacy handlers for preview mode (kept for backward compatibility)
  const handleAccept = () => {
    // In auto-apply mode, this just closes the panel since graph is already applied
    handleClose()
  }

  const handleReject = () => {
    // Remove the graph if it's on canvas, then close
    if (isOnCanvas) {
      removeDraftFromCanvas()
    }
    handleClose()
  }

  const handleGuidanceQuestionClick = (question: string) => {
    setDescription((previous: string) => {
      const trimmed = previous.trim()
      if (!trimmed) {
        return question
      }
      return `${trimmed}\n\n${question}`
    })
  }

  // Don't render if panel is closed
  if (!showDraftChat) {
    return null
  }

  const selectedModelInfo = AI_MODELS.find(m => m.id === selectedModel) ?? AI_MODELS[0]

  return (
    <div
      className="fixed z-[2000] flex flex-col transition-all duration-300 ease-out"
      style={{
        // Position next to left sidebar (sidebar is at left: 12px with width ~52px)
        left: 'calc(12px + var(--leftsidebar-w, 52px) + 12px)',
        top: 'calc(var(--topbar-h) + 1rem)',
        bottom: 'calc(var(--bottombar-h, 0) + 1rem)',
        width: '400px',
        maxWidth: 'calc(100vw - 12px - var(--leftsidebar-w, 52px) - 48px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-chat-title"
      aria-describedby="draft-chat-description"
    >
      {/* Panel container with slide animation */}
      <div className="flex flex-col h-full bg-white rounded-2xl border border-sand-200 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-sand-100 bg-gradient-to-r from-sky-50 to-purple-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-purple-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 id="draft-chat-title" className={`${typography.label} text-ink-900`}>
                Olumi AI
              </h2>
              <p className="text-xs text-ink-500">Describe your decision to get started</p>
            </div>
          </div>
          <button
            onClick={() => setShowDraftChat(false)}
            className="p-1.5 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-sand-100 transition-colors"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Loading state - show animated visualization */}
          {loading && !draft && (
            <DraftLoadingAnimation />
          )}

          {!draft && !loading ? (
            <>
              {/* Guidance panel */}
              {guidance && (
                <DraftGuidancePanel
                  guidance={guidance}
                  onQuestionClick={handleGuidanceQuestionClick}
                />
              )}

              {/* Error handling */}
              {error && (() => {
                const formatted = formatCEEError(error)

                if (formatted.isUnavailable) {
                  return (
                    <div className="p-3 bg-sun-50 border border-sun-200 rounded-lg space-y-2" data-testid="cee-unavailable-banner">
                      <p className={`${typography.body} text-sun-800 font-medium`}>
                        {formatted.message}
                      </p>
                      <p className={`${typography.bodySmall} text-sun-700`}>
                        Build your model manually using:
                      </p>
                      <ul className={`${typography.bodySmall} text-sun-700 list-disc list-inside space-y-0.5`}>
                        <li><strong>+ Node</strong> button to add factors</li>
                        <li><strong>Templates</strong> drawer for pre-built models</li>
                        <li>Right-click canvas for quick-add menu</li>
                      </ul>
                      {formatted.debugInfo && (
                        <details className="mt-1">
                          <summary className={`${typography.caption} text-sun-700 cursor-pointer select-none`}>
                            Technical details
                          </summary>
                          <pre className={`${typography.caption} text-sun-700 font-mono text-xs mt-1 opacity-70 whitespace-pre-wrap break-all`}>
                            {formatted.debugInfo}
                          </pre>
                        </details>
                      )}
                    </div>
                  )
                }

                return (
                  <ErrorAlert
                    title="Draft failed"
                    message={formatted.message}
                    severity="error"
                    debugInfo={formatted.debugInfo}
                    action={{ label: 'Try again', onClick: handleDraft }}
                  />
                )
              })()}

              {retryAfterSeconds !== null && (
                <RateLimitNotice retryAfterSeconds={retryAfterSeconds} onRetry={handleDraft} />
              )}

              {/* Attached files preview */}
              {attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachedFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center gap-1.5 px-2 py-1 bg-sand-50 border border-sand-200 rounded-lg text-xs"
                    >
                      <Paperclip className="w-3 h-3 text-ink-400" />
                      <span className="max-w-[120px] truncate text-ink-700">{file.name}</span>
                      <button
                        onClick={() => removeFile(index)}
                        className="p-0.5 hover:bg-sand-200 rounded"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="w-3 h-3 text-ink-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}

          {/* Draft preview - shown when draft is ready */}
          {draft && (
            <DraftPreview
              draft={draft}
              onAccept={handleAccept}
              onReject={handleReject}
              // Summary mode props for auto-apply flow
              mode="summary"
              isOnCanvas={isOnCanvas}
              onRemove={removeDraftFromCanvas}
              onReinstate={reinstateDraft}
              onClose={handleClose}
            />
          )}
        </div>

        {/* Input area - Claude-style */}
        {!draft && (
          <div className="border-t border-sand-100 p-3 bg-paper-25">
            {/* Model selector and file attachment row */}
            <div className="flex items-center justify-between mb-2">
              {/* Model picker */}
              <div className="relative" ref={modelPickerRef}>
                <button
                  onClick={() => setShowModelPicker(prev => !prev)}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs text-ink-600 hover:bg-sand-100 rounded-lg transition-colors"
                >
                  <span className="font-medium">{selectedModelInfo.name}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showModelPicker ? 'rotate-180' : ''}`} />
                </button>

                {showModelPicker && (
                  <div className="absolute bottom-full left-0 mb-1 bg-white border border-sand-200 rounded-lg shadow-lg py-1 min-w-[180px] z-10">
                    {AI_MODELS.map(model => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model.id)
                          setShowModelPicker(false)
                        }}
                        className={`w-full px-3 py-2 text-left hover:bg-sand-50 transition-colors ${
                          selectedModel === model.id ? 'bg-sky-50' : ''
                        }`}
                      >
                        <div className="text-sm font-medium text-ink-900">{model.name}</div>
                        <div className="text-xs text-ink-500">{model.description}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* File attachment button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-ink-400 hover:text-ink-600 hover:bg-sand-100 rounded-lg transition-colors"
                aria-label="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
              />
            </div>

            {/* Textarea with auto-expand */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => {
                  // Submit on Enter (without Shift)
                  if (e.key === 'Enter' && !e.shiftKey && description.trim() && !loading) {
                    e.preventDefault()
                    handleDraft()
                  }
                }}
                placeholder="Describe your decision... e.g., We're deciding whether to expand into the European market. Key factors include regulatory costs, market size, and competition..."
                className={`
                  ${typography.body} w-full p-3 pr-12 rounded-xl border border-sand-200
                  focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20
                  resize-none overflow-hidden
                  placeholder:text-ink-400
                `}
                style={{ minHeight: '80px', maxHeight: '200px' }}
                rows={3}
              />

              {/* Send button */}
              <Tooltip content="Press Enter to send • Shift+Enter for new line" position="right">
                <button
                  onClick={handleDraft}
                  disabled={loading || !description.trim()}
                  className={`
                    absolute right-2 bottom-2 p-2 rounded-lg
                    ${description.trim() && !loading
                      ? 'bg-sky-500 text-white hover:bg-sky-600'
                      : 'bg-sand-100 text-ink-300 cursor-not-allowed'
                    }
                    transition-colors
                  `}
                  aria-label="Generate draft (Enter to send, Shift+Enter for new line)"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </Tooltip>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
