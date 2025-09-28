# Correlation Header Alignment

**Status**: Updated in v0.1.1

## Overview

Correlation headers have been aligned to use the canonical `X-Olumi-Correlation-Id` header across all streaming, report, and compare endpoints.

## Current Implementation

### Canonical Header
- **Primary**: `X-Olumi-Correlation-Id` (UUIDv4 format)
- **Usage**: All new implementations should use this header

### Compatibility Header
- **Secondary**: `X-Correlation-ID` (temporary compatibility)
- **Purpose**: Maintains compatibility with existing clients during transition
- **Planned**: Removal in future version

## Headers in Responses

All API responses now include both headers:

```http
X-Olumi-Correlation-Id: 123e4567-e89b-12d3-a456-426614174000
X-Correlation-ID: 123e4567-e89b-12d3-a456-426614174000
```

## Headers in Requests

The system accepts correlation IDs from either header (precedence order):

1. `X-Olumi-Correlation-Id` (preferred)
2. `x-olumi-correlation-id` (case-insensitive)
3. `X-Correlation-ID` (compatibility)
4. `x-correlation-id` (case-insensitive)

## Integration Notes

### For New Clients
Use `X-Olumi-Correlation-Id` for all requests and expect it in responses.

### For Existing Clients
Continue using `X-Correlation-ID` for now. The system will accept both and respond with both headers.

### Migration Timeline
- **v0.1.1**: Both headers supported (current)
- **Future version**: `X-Correlation-ID` marked as deprecated
- **Later version**: `X-Correlation-ID` removed entirely

## Correlation ID Format

- **Format**: UUIDv4 (RFC 4122)
- **Example**: `123e4567-e89b-12d3-a456-426614174000`
- **Validation**: Strict UUIDv4 format required
- **Generation**: Automatic if not provided

## Security Considerations

- Correlation IDs are logged for tracing but contain no sensitive information
- Safe to include in log aggregation and monitoring systems
- Should not be used for authentication or authorization

## Implementation Changes

### src/lib/correlation.ts
- `addCorrelationHeader()` now includes both headers
- `extractCorrelationId()` accepts both headers with precedence
- All functions updated to support canonical header

### All API Endpoints
- Streaming endpoints include both correlation headers
- Report endpoints include both correlation headers
- Compare endpoints include both correlation headers

---

*This alignment ensures compatibility while establishing the canonical correlation header for future development.*