/**
 * AI Clarifier Chat Panel
 * Multi-turn conversational interface for drafting decision models
 * Week 3: AI Integration
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { Send, SkipForward, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useCanvasStore } from '../store'
import { useCEEDraft } from '../../hooks/useCEEDraft'
import { typography } from '../../styles/typography'
import styles from './AIClarifierChat.module.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ClarifierQuestion {
  id: string
  text: string
  type: 'text' | 'multiple_choice' | 'binary'
  options?: string[]
}

export const AIClarifierChat = memo(function AIClarifierChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [currentQuestions, setCurrentQuestions] = useState<ClarifierQuestion[]>([])
  const [showPreview, setShowPreview] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Store selectors
  const clarifierSession = useCanvasStore(s => s.clarifierSession)
  const applyClarifierGraph = useCanvasStore(s => s.applyClarifierGraph)
  const setShowAIClarifier = useCanvasStore(s => s.setShowAIClarifier)
  const startClarifierSession = useCanvasStore(s => s.startClarifierSession)
  const updateClarifierAnswers = useCanvasStore(s => s.updateClarifierAnswers)
  const clearClarifierPreview = useCanvasStore(s => s.clearClarifierPreview)
  const currentScenarioFraming = useCanvasStore(s => s.currentScenarioFraming)

  // CEE Draft hook
  const { loading, error, draft: generateDraft, reset: resetDraft } = useCEEDraft()

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Start session on mount if no session exists
  useEffect(() => {
    if (!clarifierSession) {
      const prompt = currentScenarioFraming?.title || ''
      const context = buildContextString()
      startClarifierSession(prompt, context)

      // Add opening message
      setMessages([{
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Hi! I'll help you build your decision model. Tell me about the decision you're trying to make - what options are you considering and what factors matter most?",
        timestamp: new Date(),
      }])
    }
  }, [clarifierSession, startClarifierSession, currentScenarioFraming])

  const buildContextString = useCallback(() => {
    const parts: string[] = []
    if (currentScenarioFraming?.goal) {
      parts.push(`Goal: ${currentScenarioFraming.goal}`)
    }
    if (currentScenarioFraming?.timeline) {
      parts.push(`Timeline: ${currentScenarioFraming.timeline}`)
    }
    return parts.join('\n')
  }, [currentScenarioFraming])

  const handleSubmit = useCallback(async () => {
    if (!inputValue.trim() || loading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    setInputValue('')

    try {
      // Call the draft API
      const result = await generateDraft(inputValue.trim())

      if (result) {
        // Show AI response
        const aiMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.nodes?.length > 0
            ? `I've drafted a model with ${result.nodes.length} factors. Would you like to add more details or apply this to your canvas?`
            : "I understand. Can you tell me more about the specific factors that influence this decision?",
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, aiMessage])

        // Apply preview if we have nodes
        if (result.nodes?.length > 0) {
          applyClarifierGraph(
            { nodes: result.nodes, edges: result.edges || [] },
            { preview: true }
          )
          setShowPreview(true)
        }

        // Update clarifier answers
        if (clarifierSession) {
          updateClarifierAnswers([
            ...clarifierSession.answers,
            { question_id: `round-${clarifierSession.round}`, answer: inputValue.trim() }
          ])
        }
      }
    } catch (err) {
      console.error('Clarifier draft failed:', err)
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "I'm having trouble processing that. Could you try rephrasing or providing more details?",
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }, [inputValue, loading, generateDraft, applyClarifierGraph, clarifierSession, updateClarifierAnswers])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  const handleSkip = useCallback(() => {
    // Apply current preview permanently and close
    const state = useCanvasStore.getState()
    if (state.clarifierPreviewNodeIds.length > 0) {
      // Convert previews to permanent nodes
      const previewNodes = state.nodes.filter(n =>
        state.clarifierPreviewNodeIds.includes(n.id)
      )
      const previewEdges = state.edges.filter(e =>
        state.clarifierPreviewEdgeIds.includes(e.id)
      )

      // Clear preview first
      clearClarifierPreview()

      // Apply permanently - CRITICAL: include node IDs for edge mapping
      applyClarifierGraph(
        {
          nodes: previewNodes.map(n => ({
            id: n.id, // Required for nodeIdMap to remap edges correctly
            ...n.data,
            type: n.type,
            position: n.position,
          })),
          edges: previewEdges.map(e => ({
            from: e.source,
            to: e.target,
            weight: e.data?.weight,
            belief: e.data?.belief,
          })),
        },
        { preview: false }
      )
    }

    setShowAIClarifier(false)
  }, [clearClarifierPreview, applyClarifierGraph, setShowAIClarifier])

  const handleApply = useCallback(() => {
    // Apply the current graph and close
    handleSkip()
  }, [handleSkip])

  const togglePreview = useCallback(() => {
    console.log('[AIClarifierChat] togglePreview called, showPreview:', showPreview)
    if (showPreview) {
      console.log('[AIClarifierChat] Clearing preview nodes...')
      clearClarifierPreview()
    }
    setShowPreview(!showPreview)
  }, [showPreview, clearClarifierPreview])

  const handleClose = useCallback(() => {
    clearClarifierPreview()
    resetDraft()
    setShowAIClarifier(false)
  }, [clearClarifierPreview, resetDraft, setShowAIClarifier])

  const round = clarifierSession?.round ?? 0

  return (
    <div className={styles.container}>
      {/* Progress indicator */}
      <div className={styles.progress}>
        <span className={typography.caption}>Round {round + 1}</span>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${Math.min((round + 1) * 20, 100)}%` }}
          />
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`${styles.message} ${styles[msg.role]}`}
          >
            <div className={styles.messageContent}>
              {msg.content}
            </div>
            <time className={styles.messageTime}>
              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </time>
          </div>
        ))}

        {loading && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.loadingIndicator}>
              <Loader2 className={styles.spinner} size={16} />
              <span>Thinking...</span>
            </div>
          </div>
        )}

        {error && (
          <div className={styles.errorBanner}>
            <span>{error.message}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className={styles.inputArea}>
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your decision, factors, or ask for changes..."
          className={styles.input}
          rows={2}
          disabled={loading}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!inputValue.trim() || loading}
          className={styles.sendButton}
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button
          type="button"
          onClick={togglePreview}
          className={styles.actionButton}
          disabled={!showPreview && round === 0}
          title={showPreview ? 'Remove preview nodes from canvas' : 'Show draft on canvas'}
        >
          {showPreview ? <EyeOff size={16} /> : <Eye size={16} />}
          <span>{showPreview ? 'Discard preview' : 'Show preview'}</span>
        </button>

        <button
          type="button"
          onClick={handleSkip}
          className={styles.actionButton}
          disabled={round === 0}
        >
          <SkipForward size={16} />
          <span>Apply & close</span>
        </button>
      </div>
    </div>
  )
})

AIClarifierChat.displayName = 'AIClarifierChat'
