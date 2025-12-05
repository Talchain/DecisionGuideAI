# Windsurf Continuation: Week 3 AI Integration

## Current Status

**Week 2 Layout (In Progress):**
- TopBar ✓
- LeftSidebar ✓  
- RightPanel ✓
- Legacy toolbar gated ✓
- **BLOCKER:** Old InputsDock/OutputsDock still rendering (see screenshot issue)

**Week 3 AI Integration (Ready to Start):**
- Backend confirmed: CEE Assistants via `/assist/v1/draft-graph`
- Hook ready: `useDraftModel` already wraps correct endpoint
- Architecture validated

---

## Backend Architecture (CONFIRMED)

### Clarifier Endpoint
**Service:** CEE Assistants (olumi-assistants-service)  
**Endpoint:** `POST /assist/v1/draft-graph`  
**Hook:** `useDraftModel` (already in codebase)  
**Feature Flag:** `clarifier_enabled`

### Request/Response Contract
```typescript
// Request
interface DraftGraphRequest {
  prompt: string;
  context?: string;
  files?: File[];
  clarifier_answers?: Array<{
    question_id: string;
    answer: string;
  }>;
}

// Response
interface DraftGraphResponse {
  graph: {
    nodes: Node[];
    edges: Edge[];
  };
  clarifier?: {
    questions: Array<{
      id: string;
      text: string;
      type: 'text' | 'multiple_choice' | 'binary';
      options?: string[];
      required?: boolean;
      multiple?: boolean;
      impact_hint?: string;
    }>;
    round: number;
  };
  quality?: {
    score: number;
    // ... other quality metrics
  };
}
```

### Multi-Turn Flow
```
Round 1: POST { prompt, context } 
      ← { graph, clarifier: { questions, round: 1 } }

Round 2: POST { prompt, context, clarifier_answers: [r1 answers] }
      ← { graph, clarifier: { questions, round: 2 } }

Round N: POST { prompt, context, clarifier_answers: [all answers] }
      ← { graph, clarifier: undefined } (complete)
```

**Max rounds:** 5 (design spec)  
**Complete when:** `response.clarifier === undefined`

---

## Priority Tasks

### URGENT: Complete Week 2 Layout (1h)

**Problem:** Screenshot shows old InputsDock/OutputsDock still rendering alongside new layout.

**Fix Required:**

1. **Add conditional rendering in ReactFlowGraph:**
```typescript
const USE_NEW_LAYOUT = pocFlags.contextBar ?? true

return (
  <div className={styles.wrapper}>
    {USE_NEW_LAYOUT ? (
      <>
        {/* NEW LAYOUT */}
        <TopBar {...} />
        <LeftSidebar {...} />
        <div className={styles.canvasMain}>
          <ReactFlow {...} />
        </div>
        {renderRightPanel()}
      </>
    ) : (
      <>
        {/* OLD LAYOUT */}
        <InputsDock {...} />
        <div className={styles.canvasMain}>
          <ReactFlow {...} />
        </div>
        <OutputsDock {...} />
        <CanvasToolbar />
      </>
    )}
  </div>
)
```

2. **Verify canvas width:**
   - With new layout: >70% viewport
   - Old panels completely hidden
   - No duplicate controls

3. **Test and verify:**
```bash
pnpm dev:canvas
# Confirm: Canvas maximized, old panels gone
```

**Only proceed to Week 3 after Week 2 verified working.**

---

## Week 3 Task 1: Multi-Turn AI Clarifier (Start After Week 2)

### 1.1 Extend Canvas Store (30min)

**File:** `src/canvas/store.ts`

**Add state:**
```typescript
interface CanvasState {
  // ... existing
  
  // AI Clarifier
  showAIClarifier: boolean;
  clarifierSession: {
    prompt: string;
    context: string;
    answers: Array<{ question_id: string; answer: string }>;
    round: number;
    status: 'active' | 'complete' | 'error';
  } | null;
  clarifierPreviewNodeIds: string[];
  clarifierPreviewEdgeIds: string[];
}
```

**Add actions:**
```typescript
interface CanvasActions {
  // ... existing
  
  // Clarifier panel
  setShowAIClarifier: (show: boolean) => void;
  startClarifierSession: (prompt: string, context: string) => void;
  updateClarifierAnswers: (answers: Array<{ question_id: string; answer: string }>) => void;
  completeClarifierSession: () => void;
  
  // Graph preview/apply
  applyClarifierGraph: (
    graph: { nodes: Node[]; edges: Edge[] },
    options: { preview: boolean }
  ) => void;
}
```

**Implementation:**
```typescript
applyClarifierGraph: (graph, { preview }) => {
  const state = get()
  
  if (preview) {
    // Add as ghost nodes/edges
    const previewNodes = graph.nodes.map(n => ({
      id: createNodeId(),
      ...n,
      style: {
        opacity: 0.6,
        border: '2px dashed var(--sky-500)',
      },
      data: {
        ...n.data,
        isPreview: true,
      },
    }))
    
    const previewEdges = graph.edges.map(e => ({
      id: createEdgeId(),
      source: e.from,
      target: e.to,
      ...e,
      style: {
        strokeDasharray: '5,5',
        opacity: 0.6,
      },
      data: {
        ...e.data,
        isPreview: true,
      },
    }))
    
    set({
      nodes: [...state.nodes, ...previewNodes],
      edges: [...state.edges, ...previewEdges],
      clarifierPreviewNodeIds: previewNodes.map(n => n.id),
      clarifierPreviewEdgeIds: previewEdges.map(e => e.id),
    })
  } else {
    // Apply permanently
    const finalNodes = graph.nodes.map(n => ({
      id: createNodeId(),
      ...n,
      data: { ...n.data, isPreview: false },
    }))
    
    const finalEdges = graph.edges.map(e => ({
      id: createEdgeId(),
      source: e.from,
      target: e.to,
      ...e,
      data: { ...e.data, isPreview: false },
    }))
    
    state.pushHistory() // Save to undo stack
    
    set({
      nodes: finalNodes,
      edges: finalEdges,
      clarifierPreviewNodeIds: [],
      clarifierPreviewEdgeIds: [],
    })
  }
}
```

### 1.2 Create AIClarifierChat Component (4h)

**File:** `src/canvas/panels/AIClarifierChat.tsx`

**Use existing patterns:**
- Reuse `useDraftModel` hook (wraps `/assist/v1/draft-graph`)
- Similar to `ClarifierPanel.tsx` but chat-style UI
- Integrate with existing telemetry (`draft.clarifier.submit`, `draft.clarifier.skip`)

**Key features:**
```typescript
export function AIClarifierChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([])
  const [round, setRound] = useState(0)
  const [answers, setAnswers] = useState<AnswerHistory[]>([])
  
  const { requestDraft, isLoading, error } = useDraftModel()
  const applyClarifierGraph = useCanvasStore(s => s.applyClarifierGraph)
  
  // Start session on mount
  useEffect(() => {
    startSession()
  }, [])
  
  async function startSession() {
    const prompt = useCanvasStore.getState().currentScenarioFraming?.title || ''
    const context = buildContext()
    
    const response = await requestDraft({
      prompt,
      context,
      clarifier_answers: [],
    })
    
    if (response.clarifier) {
      setCurrentQuestions(response.clarifier.questions)
      setRound(response.clarifier.round)
      
      // Show AI message
      setMessages([{
        role: 'assistant',
        content: response.clarifier.questions[0].text,
      }])
      
      // Preview graph
      if (response.graph) {
        applyClarifierGraph(response.graph, { preview: true })
      }
    }
  }
  
  async function handleSubmit(newAnswers: Answer[]) {
    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: formatAnswers(newAnswers),
    }])
    
    // Merge with previous answers
    const allAnswers = [...answers, ...newAnswers]
    setAnswers(allAnswers)
    
    // Call API
    const response = await requestDraft({
      prompt: session.prompt,
      context: session.context,
      clarifier_answers: allAnswers.map(a => ({
        question_id: a.question_id,
        answer: a.answer,
      })),
    })
    
    if (response.clarifier) {
      // More rounds
      setCurrentQuestions(response.clarifier.questions)
      setRound(response.clarifier.round)
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.clarifier.questions[0].text,
      }])
      
      // Update preview
      if (response.graph) {
        applyClarifierGraph(response.graph, { preview: true })
      }
    } else {
      // Complete
      handleComplete(response.graph)
    }
    
    track('draft.clarifier.submit', { round })
  }
  
  function handleSkip() {
    // Apply current preview
    const currentGraph = getCurrentPreviewGraph()
    if (currentGraph) {
      applyClarifierGraph(currentGraph, { preview: false })
    }
    
    track('draft.clarifier.skip', { round })
    closePanel()
  }
  
  function handleComplete(graph: Graph) {
    applyClarifierGraph(graph, { preview: false })
    
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `Great! I've drafted your model with ${graph.nodes.length} factors.`,
    }])
    
    // Auto-close after 3s
    setTimeout(() => closePanel(), 3000)
  }
  
  return (
    <div className="clarifier-chat">
      {/* Header */}
      <div className="header">
        <h2>Draft Your Decision Model</h2>
        <div className="progress">Round {round}/5</div>
      </div>
      
      {/* Messages */}
      <div className="messages">
        {messages.map((msg, i) => (
          <Message key={i} {...msg} />
        ))}
        {isLoading && <TypingIndicator />}
      </div>
      
      {/* Current Questions */}
      {currentQuestions.length > 0 && (
        <ClarifierPanel
          questions={currentQuestions}
          previousAnswers={answers}
          onSubmit={handleSubmit}
          onSkip={handleSkip}
          disabled={isLoading}
        />
      )}
      
      {/* Actions */}
      <div className="actions">
        <button onClick={handleSkip} disabled={isLoading}>
          Skip remaining
        </button>
        {round > 0 && (
          <button onClick={togglePreview}>
            {showPreview ? 'Hide' : 'Preview'} graph
          </button>
        )}
      </div>
    </div>
  )
}
```

**Styling:** Match existing design tokens, chat bubble style, smooth animations

### 1.3 Integration with Layout (1h)

**ReactFlowGraph.tsx:**
```typescript
function ReactFlowGraph() {
  const showAIClarifier = useCanvasStore(s => s.showAIClarifier)
  
  function renderRightPanel() {
    if (showAIClarifier) {
      return (
        <RightPanel width="400px" onClose={() => setShowAIClarifier(false)}>
          <AIClarifierChat />
        </RightPanel>
      )
    }
    
    if (showProvenanceHub) {
      return (
        <RightPanel width="360px" onClose={() => setShowProvenanceHub(false)}>
          <ProvenanceHubTab {...} />
        </RightPanel>
      )
    }
    
    return null
  }
  
  return (
    <>
      {USE_NEW_LAYOUT && (
        <>
          <TopBar {...} />
          <LeftSidebar
            onAiClick={() => setShowAIClarifier(true)}
            {...}
          />
        </>
      )}
      
      <div className={styles.canvasMain}>
        <ReactFlow {...} />
      </div>
      
      {renderRightPanel()}
    </>
  )
}
```

### 1.4 Testing (2h)

**File:** `src/canvas/panels/__tests__/AIClarifierChat.test.tsx`

```typescript
describe('AIClarifierChat', () => {
  const mockDraftGraph = vi.fn()
  
  beforeEach(() => {
    vi.mock('@/canvas/hooks/useDraftModel', () => ({
      useDraftModel: () => ({
        requestDraft: mockDraftGraph,
        isLoading: false,
        error: null,
      }),
    }))
  })
  
  it('starts session with opening question', async () => {
    mockDraftGraph.mockResolvedValue({
      graph: { nodes: [], edges: [] },
      clarifier: {
        questions: [{ id: '1', text: 'What decision?', type: 'text' }],
        round: 1,
      },
    })
    
    render(<AIClarifierChat />)
    
    await waitFor(() => {
      expect(screen.getByText(/what decision/i)).toBeInTheDocument()
    })
  })
  
  it('handles multi-turn conversation', async () => {
    // Round 1
    mockDraftGraph.mockResolvedValueOnce({
      graph: { nodes: [{ id: '1', label: 'Price' }], edges: [] },
      clarifier: { questions: [{ id: '1', text: 'Q1?', type: 'text' }], round: 1 },
    })
    
    render(<AIClarifierChat />)
    
    const input = await screen.findByRole('textbox')
    await userEvent.type(input, 'Raise pricing{Enter}')
    
    // Round 2
    mockDraftGraph.mockResolvedValueOnce({
      graph: { nodes: [{ id: '1', label: 'Price' }, { id: '2', label: 'Revenue' }], edges: [] },
      clarifier: { questions: [{ id: '2', text: 'Q2?', type: 'text' }], round: 2 },
    })
    
    await waitFor(() => {
      expect(screen.getByText(/q2\?/i)).toBeInTheDocument()
    })
  })
  
  it('applies graph preview during conversation', async () => {
    const mockApply = vi.fn()
    useCanvasStore.setState({ applyClarifierGraph: mockApply })
    
    mockDraftGraph.mockResolvedValue({
      graph: { nodes: [{ id: '1' }], edges: [] },
      clarifier: { questions: [...], round: 1 },
    })
    
    render(<AIClarifierChat />)
    
    await waitFor(() => {
      expect(mockApply).toHaveBeenCalledWith(
        expect.objectContaining({ nodes: [{ id: '1' }] }),
        { preview: true }
      )
    })
  })
  
  it('applies final graph on completion', async () => {
    const mockApply = vi.fn()
    
    mockDraftGraph
      .mockResolvedValueOnce({ graph: {...}, clarifier: { questions: [...], round: 1 } })
      .mockResolvedValueOnce({ graph: { nodes: [...], edges: [...] } }) // No clarifier = complete
    
    render(<AIClarifierChat />)
    
    // Answer question
    await userEvent.type(screen.getByRole('textbox'), 'Answer{Enter}')
    
    await waitFor(() => {
      expect(mockApply).toHaveBeenCalledWith(
        expect.any(Object),
        { preview: false }
      )
    })
  })
  
  it('tracks telemetry', async () => {
    const mockTrack = vi.fn()
    vi.mock('@/lib/telemetry', () => ({ track: mockTrack }))
    
    render(<AIClarifierChat />)
    
    await userEvent.type(screen.getByRole('textbox'), 'Answer{Enter}')
    
    expect(mockTrack).toHaveBeenCalledWith('draft.clarifier.submit', { round: 1 })
  })
  
  it('handles skip with graph apply', async () => {
    render(<AIClarifierChat />)
    
    await userEvent.click(screen.getByText(/skip/i))
    
    expect(mockTrack).toHaveBeenCalledWith('draft.clarifier.skip', expect.any(Object))
  })
})
```

---

## Session Persistence

**Store clarifier state in sessionStorage:**

```typescript
// On answer update
useEffect(() => {
  if (clarifierSession) {
    sessionStorage.setItem('clarifier-session', JSON.stringify({
      prompt: clarifierSession.prompt,
      answers: clarifierSession.answers,
      round: clarifierSession.round,
    }))
  }
}, [clarifierSession])

// On mount, restore if exists
useEffect(() => {
  const saved = sessionStorage.getItem('clarifier-session')
  if (saved) {
    const session = JSON.parse(saved)
    // Resume from where user left off
  }
}, [])
```

---

## Quality Standards

**Preview Styling:**
- Preview nodes: `opacity: 0.6`, `border: 2px dashed var(--sky-500)`
- Preview edges: `strokeDasharray: '5,5'`, `opacity: 0.6`
- On apply: Fade to solid in 300ms

**Chat UX:**
- Message appear animation: 200ms slide-up
- Typing indicator: 3 dots with bounce animation
- Auto-scroll to bottom on new messages
- Question options as styled buttons (not just text)

**Performance:**
- API responses cached per `clarifier_answers` hash
- Graph preview renders diff only (not full re-render)
- Messages virtualized if >50 messages (unlikely but safe)

**Error Handling:**
```typescript
if (error) {
  return (
    <div className="error-state">
      <p>Unable to connect to AI assistant</p>
      <button onClick={retry}>Try again</button>
      <button onClick={closePanel}>Close</button>
    </div>
  )
}
```

---

## Execution Instructions

**DO NOT STOP until complete:**

1. ✅ **Verify Week 2 complete** (old panels hidden, canvas maximized)
2. ⚠️ **If Week 2 not complete:** Fix first (1h priority)
3. Extend canvas store with clarifier state (30min)
4. Create AIClarifierChat component (4h)
5. Wire into ReactFlowGraph + LeftSidebar (1h)
6. Add comprehensive tests (2h)
7. Manual QA with dev server
8. Provide completion summary

**Total time:** ~8-9 hours

**Success criteria:**
- Click AI icon → Chat opens in right panel
- Multi-turn conversation works (max 5 rounds)
- Graph preview appears as ghost nodes/edges
- Final graph applies to canvas
- Skip applies current draft
- All tests passing
- Telemetry events firing

**Proceed autonomously. Do not stop until Task 1 complete.**
