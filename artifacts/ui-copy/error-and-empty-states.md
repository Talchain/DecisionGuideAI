# Error and Empty State Copy

User-friendly messages for common platform states. All copy uses plain English and maintains a helpful, professional tone.

## Network & Connection Errors

### Network Blip (Auto-Resume)
**Title**: "Connection hiccup detected"
**Message**: "Your analysis is still running. We're reconnecting automatically..."
**Action**: "Hang tight - this usually takes just a moment."
**Technical Note**: Shows when Last-Event-ID reconnection is in progress.

### Connection Lost (Manual Retry)
**Title**: "Connection lost"
**Message**: "We lost connection to your analysis. Your progress is saved."
**Action**: "Click 'Reconnect' to continue where you left off."
**Button**: "Reconnect"
**Technical Note**: When auto-reconnect fails and user action is needed.

### Streaming Stalled
**Title**: "Analysis is taking longer than expected"
**Message**: "Sometimes complex decisions need extra thinking time. Your analysis is still processing."
**Action**: "You can wait it out or start fresh with a simplified version."
**Buttons**: "Keep Waiting" / "Start Over"

## Analysis States

### Analysis Cancelled
**Title**: "Analysis stopped"
**Message**: "You stopped the analysis. No problem - you can start over anytime."
**Detail**: "Any partial results have been saved to your history."
**Action**: "Ready to try again?"
**Button**: "New Analysis"

### Analysis Failed
**Title**: "Something went wrong"
**Message**: "We couldn't complete your analysis. This is usually temporary."
**Detail**: "Our team has been notified and will look into it."
**Action**: "Try starting a new analysis, or check back in a few minutes."
**Button**: "Try Again"

## Rate Limiting

### Rate Limited (Soft)
**Title**: "Taking a quick breather"
**Message**: "You've been using the platform a lot today (which is great!). Just need to pace things a bit."
**Detail**: "You can start a new analysis in 15 minutes, or upgrade for unlimited access."
**Actions**: "Upgrade Plan" / "Wait 15 min"

### Rate Limited (Hard)
**Title**: "Daily limit reached"
**Message**: "You've hit your daily analysis limit. Your account resets at midnight."
**Detail**: "Need more? Upgrading gives you unlimited daily analyses plus priority processing."
**Actions**: "Upgrade Plan" / "See Recent Results"

## Empty States

### No Reports Yet
**Title**: "No analysis reports yet"
**Message**: "Your completed analyses will appear here once you finish one."
**Detail**: "Each report includes your decision breakdown, recommendations, and reasoning."
**Action**: "Ready to analyze your first decision?"
**Button**: "Start New Analysis"

### No Saved Decisions
**Title**: "No saved decisions"
**Message**: "Decision scenarios you create will be saved here for future reference."
**Detail**: "Save time by reusing similar scenarios or sharing them with team members."
**Action**: "Create your first decision scenario."
**Button**: "Create Decision"

### No Analysis History
**Title**: "No analysis history"
**Message**: "Your past analyses will show up here, making it easy to refer back to previous insights."
**Detail**: "History includes both completed and partial analyses, so nothing gets lost."
**Action**: "Start your first analysis to build your decision history."

### Search No Results
**Title**: "No matches found"
**Message**: "We couldn't find any analyses matching '{search_query}'."
**Suggestions**:
- "Try different keywords"
- "Check for typos"
- "Browse all analyses instead"
**Button**: "Clear Search"

## Loading States

### Initial Analysis Loading
**Title**: "Preparing your analysis..."
**Message**: "Setting up the decision framework and gathering insights."
**Detail**: "This usually takes 2-3 seconds."

### Analysis in Progress
**Messages**: (Rotate through these as analysis streams)
- "Analyzing your decision options..."
- "Weighing pros and cons..."
- "Calculating risk factors..."
- "Building recommendations..."
- "Finalizing insights..."

### Export in Progress
**Title**: "Preparing your report..."
**Message**: "Formatting your analysis for export. Almost ready!"
**Detail**: "Large reports may take up to 30 seconds."

## System Status

### Maintenance Mode
**Title**: "Platform maintenance in progress"
**Message**: "We're making some improvements and will be back shortly."
**Detail**: "Maintenance typically takes 15-30 minutes. Your data is safe."
**Action**: "Check our status page for updates."
**Link**: "Status Page"

### Service Degraded
**Title**: "Running a bit slowly today"
**Message**: "Our analysis engine is under heavy load but still working."
**Detail**: "Analyses may take 30-60 seconds longer than usual."
**Action**: "Everything will work normally - just a bit slower."

### Simulation Mode Active
**Title**: "Demo mode active"
**Message**: "You're seeing simulated results. No real AI analysis or costs incurred."
**Detail**: "Perfect for testing and demonstrations. Switch to live mode when ready."
**Badge**: "🎭 Demo Mode"

## Permission & Access

### Feature Not Available
**Title**: "Feature not available on your plan"
**Message**: "Advanced analysis features are available with Pro and Enterprise plans."
**Detail**: "Upgrade to access detailed risk analysis, scenario modeling, and PDF exports."
**Actions**: "Learn About Plans" / "Continue with Basic"

### Session Expired
**Title**: "Session expired"
**Message**: "For security, we signed you out after 2 hours of inactivity."
**Detail**: "Your work is saved. Just sign back in to continue."
**Button**: "Sign In Again"

## Copy Guidelines

### Tone Principles
- **Helpful, not apologetic**: Explain what's happening and how to move forward
- **Clear, not technical**: Use plain English; avoid jargon
- **Confident, not uncertain**: "We're reconnecting" vs "We'll try to reconnect"
- **Action-oriented**: Always provide a clear next step

### Voice Characteristics
- Professional but friendly
- Confident and reassuring
- Concise but informative
- Focused on solutions

### Avoid
- Excessive apologies ("We're so sorry...")
- Technical error codes in user-facing messages
- Vague language ("Something might be wrong")
- Blame ("You entered invalid data")
- False promises ("This will never happen again")

### Technical Integration Notes
- Messages support basic Markdown for **bold** and *emphasis*
- Button text should be 2-3 words maximum
- Titles should be 6 words or less
- Include {dynamic_values} for variables like search queries
- Consider screen readers: use clear, descriptive text

### Testing Checklist
- [ ] Messages are scannable (users often don't read fully)
- [ ] Actions are clear and obvious
- [ ] No double negatives or confusing phrasing
- [ ] Works well when read aloud
- [ ] Maintains brand voice and tone
- [ ] Provides appropriate level of detail for the context