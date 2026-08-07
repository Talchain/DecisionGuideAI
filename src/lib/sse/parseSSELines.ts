/**
 * The app's single SSE line parser (extracted from
 * `canvas/conversation/turnService.ts`, ROADMAP 2.122).
 *
 * Two consumers now read `text/event-stream` from CEE — the V4 orchestrator
 * stream (`turnService.streamOrchestratorTurn`) and the staged V5 turn
 * (`v5/streamedDraftFrames.streamStageFrames`). A second, independently
 * written parser is exactly the hand-maintained-mirror defect (CLAUDE.md trap
 * 12): the two would drift on multi-line `data:`, on CRLF, or on trailing
 * flush, and the drift would read as green in both suites.
 *
 * `turnService` re-exports this symbol, so its existing spec
 * (`__tests__/streamEventParsing.spec.ts`, ~30 cases) covers this module
 * verbatim without being touched.
 */

/**
 * Parse a raw SSE text chunk (already split into lines) into structured events.
 *
 * Handles multi-line `data:` fields per the SSE spec (consecutive data lines
 * joined with `\n`) and `:` comment lines as heartbeat signals.
 *
 * @returns The parsed events and whether the chunk showed any liveness at all
 *          (a bare heartbeat counts — it carries no event but proves the
 *          socket is alive, which is what the silence watchdog needs).
 */
export function parseSSELines(
  lines: string[],
  /** When true, flush any buffered event at the end even without a trailing
   *  blank line. Only set this when processing the final chunk of a stream. */
  flush = false,
): { events: Array<{ eventType: string; data: string }>; hadActivity: boolean } {
  const events: Array<{ eventType: string; data: string }> = []
  let currentEventType = ''
  let dataLines: string[] = []
  let hadActivity = false

  for (const rawLine of lines) {
    // Normalise CRLF / bare CR — servers may use \r\n line endings
    const line = rawLine.replace(/\r$/, '')

    if (line === '') {
      // Empty line = event boundary per SSE spec
      if (dataLines.length > 0) {
        events.push({ eventType: currentEventType, data: dataLines.join('\n') })
        dataLines = []
        currentEventType = ''
      }
      continue
    }
    if (line.startsWith(':')) {
      // Comment line = heartbeat signal
      hadActivity = true
      continue
    }
    if (line.startsWith('event: ')) {
      currentEventType = line.slice(7).trim()
      hadActivity = true
    } else if (line.startsWith('data: ')) {
      dataLines.push(line.slice(6))
      hadActivity = true
    } else if (line.startsWith('data:')) {
      // `data:` with no space — still valid per SSE spec
      dataLines.push(line.slice(5))
      hadActivity = true
    }
  }

  // Flush trailing buffered event on EOF (stream ended without final blank line)
  if (flush && dataLines.length > 0) {
    events.push({ eventType: currentEventType, data: dataLines.join('\n') })
  }

  return { events, hadActivity }
}
