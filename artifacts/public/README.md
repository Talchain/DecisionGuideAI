# Public Assets

This directory contains public-facing demonstration and monitoring assets for Decision Guide AI.

## Files

- `demo.html` - Stakeholder demonstration page (see below)
- `ops-console.html` - Operations monitoring console (dev/pilot only)

## How to use demo.html

The stakeholder demonstration page provides a complete interface for testing Decision Guide AI's streaming analysis capabilities with both live Gateway integration and offline fixtures.

### Running the Demo

1. **Start a local static server:**
   ```bash
   python3 -m http.server 8081
   ```

2. **Open the demo in your browser:**
   ```
   http://localhost:8081/demo.html
   ```

3. **For live testing with the Gateway:**
   - Ensure the Decision Guide AI service is running (typically on port 3001)
   - Set the Base URL to `http://localhost:3001`
   - Switch Mode to "Live Gateway"

### Modes

**Fixtures Mode (Default):**
- Works completely offline
- Uses embedded deterministic event streams
- Demonstrates all UI behaviour without requiring a live Gateway
- Perfect for stakeholder demos and testing

**Live Gateway Mode:**
- Connects to a real Decision Guide AI instance
- Streams live analysis results
- Requires proper CORS configuration
- Use for integration testing and live demonstrations

### Status Badges

The demo tracks three key performance indicators:

1. **First Token Under Budget (≤500ms):**
   - **GREEN:** First analysis token received within 500ms of connection
   - **RED:** First token took longer than 500ms
   - Measures time to first token (TTFF) from EventSource connection establishment

2. **Single Resume Occurred:**
   - **GREEN:** Exactly one resume happened after using "Simulate Blip"
   - **RED:** No resumes, or multiple resume attempts
   - Tests the Last-Event-ID resume semantics with one automatic retry only

3. **Cancel Idempotent (≤150ms):**
   - **GREEN:** Second "Stop" press had no additional effect and terminal state arrived within 150ms
   - **RED:** Cancel was not idempotent or took too long
   - Validates that cancellation is idempotent (first cancels, second is no-op)

### Using Compare

The "Compare Left vs Right" button demonstrates the comparison API:

- In **Fixtures Mode:** Shows a pre-built comparison result with headline and drivers
- In **Live Gateway Mode:** Makes a POST request to `/compare` with the configured scenario IDs
- Results display a concise headline delta and 3 key drivers

### Download Buttons

**Download Snapshot:**
- Available after a successful run completes
- In Live Gateway mode: Downloads ZIP bundle via `/runs/{runId}/snapshot`
- In Fixtures mode: Shows appropriate error message

**Download Evidence Pack:**
- Links to `pilot-evidence-pack.zip` if available in the same directory
- Disabled with tooltip if evidence pack not found
- Provides packaged evidence bundle for pilot deployments

### Frozen SSE Events

The demo strictly uses the frozen SSE event contract:

- `hello` - Session establishment
- `token` - Analysis text fragments
- `cost` - Cost tracking
- `done` - Successful completion
- `cancelled` - User or system cancellation
- `limited` - Rate limiting
- `error` - Error conditions

**Resume Semantics:**
- Uses `Last-Event-ID` header for resumption
- Allows ONE automatic resume only
- "Simulate Blip" deliberately drops the EventSource connection once
- Subsequent manual reconnects should be blocked (fails the badge)

### Accessibility Features

- ARIA live region announces key state changes:
  - "Results streaming" when analysis starts
  - "Connection restored; continuing" after resume
  - "Stream cancelled" when stopped
  - "Report available" when analysis completes
  - "Reduced visual complexity" if simplify mode added
- Mobile-friendly responsive design (works at ≤480px)
- Large tap targets (minimum 44px) for mobile
- Semantic HTML structure
- Keyboard navigation support

### Browser Compatibility

- Modern browsers with EventSource support
- CORS-compliant for cross-origin requests
- No external dependencies or bundlers required
- Vanilla HTML/CSS/JavaScript only

### Troubleshooting

**CORS Errors:**
- Ensure the Gateway service includes appropriate CORS headers
- Use same-origin requests when possible (serve demo from same host)

**Connection Failures:**
- Verify the Base URL is correct and service is running
- Check browser developer tools for detailed error messages
- Try Fixtures mode to verify the demo interface works

**Missing Features:**
- Evidence pack download requires `pilot-evidence-pack.zip` in the same directory
- Snapshot download only works in Live Gateway mode with valid run IDs
- Correlation ID display depends on Gateway response headers (may be blocked by CORS)

### Privacy and Security

- Page is static and read-only
- No request bodies are logged
- Settings persist in localStorage only
- No external network requests in Fixtures mode
- Correlation IDs displayed when available (respects CORS limitations)