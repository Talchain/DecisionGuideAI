# Experimental Streaming API

**Status**: Experimental - DISABLED by default

## Overview

This experimental streaming API (`src/lib/streaming-api-v1.ts`) explores alternative event structures and was created for research purposes. It introduces different event names and envelope schemas that are **NOT compatible** with the current frozen contract.

## Current State

- **Environment Flag**: `STREAM_ALT_EVENTS=0` (default: disabled)
- **Production Impact**: None - this API is completely fenced off from production paths
- **Testing**: Available via conformance script when flag is enabled

## Experimental Events

The experimental API uses these event types (NOT used in production):
- `run.start`
- `run.heartbeat`
- `step.progress`
- `step.retry`
- `run.error`
- `run.complete`

## Frozen Production Events

The production system uses ONLY these frozen events:
- `hello`
- `token`
- `cost`
- `done`
- `cancelled`
- `limited`
- `error`

## Future Considerations

This experimental API may be developed further in future versions, but will remain disabled by default to ensure compatibility with existing integrations including Windsurf and pilot deployments.

---

*This file documents the experimental API state as of v0.1.1*