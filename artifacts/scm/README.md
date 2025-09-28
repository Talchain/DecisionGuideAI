# SCM-lite (Proof of Concept)

Version control and diff functionality for scenarios. This is a read-only proof of concept implementation.

## Overview

SCM-lite provides "track changes" functionality for scenarios without altering the official truth. The engine remains untouched, and all new surfaces are additive and flag-gated.

## Configuration

The following environment variables control SCM-lite behaviour:

- `SCM_ENABLE=1` - Enables all SCM endpoints (default: 0)
- `SCM_WRITES=0` - Disables persistence; write endpoints return 404 (default: 0)
- `SCM_WRITES=1` - Enables persistence to `artifacts/scm/` (development only)
- `SCM_SIGNING_KEY` - Optional HMAC signing key for manifests (default: unset)

## API Endpoints

All endpoints are prefixed with `/scm` and return appropriate security headers.

### List Versions

```bash
# List all available versions
curl -X GET http://localhost:3000/scm/versions
```

Response:
```json
{
  "schema": "versions.v1",
  "versions": [
    {
      "id": "v-1234567890-abc123",
      "label": "Initial version",
      "scenarioId": "scenario-001",
      "createdAt": "2025-01-15T10:30:00Z",
      "checksum": "sha256hash..."
    }
  ]
}
```

### Get Version

```bash
# Get a specific version with its scenario
curl -X GET http://localhost:3000/scm/versions/v-1234567890-abc123
```

Response:
```json
{
  "schema": "version.v1",
  "metadata": {
    "id": "v-1234567890-abc123",
    "label": "Initial version",
    "scenarioId": "scenario-001",
    "createdAt": "2025-01-15T10:30:00Z",
    "checksum": "sha256hash..."
  },
  "scenario": {
    "nodes": [...],
    "links": [...]
  }
}
```

### Calculate Diff

```bash
# Diff between two versions
curl -X POST http://localhost:3000/scm/diff \
  -H "Content-Type: application/json" \
  -d '{
    "baseRef": "v-1234567890-abc123",
    "candidate": {
      "versionId": "v-1234567891-def456"
    }
  }'

# Diff with inline scenario
curl -X POST http://localhost:3000/scm/diff \
  -H "Content-Type: application/json" \
  -d '{
    "baseRef": "v-1234567890-abc123",
    "candidate": {
      "inlineScenario": {
        "nodes": [
          {"id": "node1", "label": "Updated Node", "weight": 0.8}
        ],
        "links": []
      }
    }
  }'
```

Response:
```json
{
  "schema": "diff.v1",
  "meta": {
    "baseRef": "abc12345",
    "candidateRef": "def67890",
    "createdAt": "2025-01-15T10:35:00Z"
  },
  "summary": {
    "nodesAdded": 1,
    "nodesRemoved": 0,
    "nodesChanged": 2,
    "linksAdded": 0,
    "linksRemoved": 1,
    "weightsChanged": 3
  },
  "changes": [
    {
      "path": "node[node1].weight",
      "before": 0.5,
      "after": 0.8
    }
  ]
}
```

### Suggest Mode

```bash
# Create a proposal (transient by default when SCM_WRITES=0)
curl -X POST http://localhost:3000/scm/suggest \
  -H "Content-Type: application/json" \
  -d '{
    "baseRef": "v-1234567890-abc123",
    "title": "Adjust decision weights",
    "note": "Increase weight for cost factor",
    "candidateScenario": {
      "nodes": [
        {"id": "node1", "label": "Cost Factor", "weight": 0.9}
      ],
      "links": []
    }
  }'
```

Response (with `X-Proposal-Transient: true` header when not persisted):
```json
{
  "schema": "proposal.v1",
  "proposal": {
    "id": "prop-1234567890-transient",
    "baseRef": "v-1234567890-abc123",
    "title": "Adjust decision weights",
    "note": "Increase weight for cost factor",
    "createdAt": "2025-01-15T10:40:00Z"
  },
  "diff": {
    "schema": "diff.v1",
    "meta": {...},
    "summary": {...},
    "changes": [...]
  }
}
```

### Get Proposal (when SCM_WRITES=1)

```bash
# Get a persisted proposal
curl -X GET http://localhost:3000/scm/proposals/prop-1234567890-xyz789
```

Returns 404 when `SCM_WRITES=0`.

## CLI Usage

The `olumi-scm` command-line tool provides convenient access to SCM functionality:

```bash
# List all versions
npm run scm list

# Get a specific version
npm run scm get v-1234567890-abc123

# Calculate diff between versions
npm run scm diff --base v-1234567890-abc123 --candidate v-1234567891-def456

# Calculate diff with local file
npm run scm diff --base v-1234567890-abc123 --candidate ./my-scenario.json

# Create a proposal
npm run scm suggest --base v-1234567890-abc123 --title "My changes" --file ./my-scenario.json
```

## Security

- No request bodies are logged
- All responses include standard security headers
- CORS defaults remain closed
- Optional HMAC signing for manifests when `SCM_SIGNING_KEY` is set

## Limitations

This proof of concept is read-only by default. When `SCM_WRITES=0`:
- Proposals are transient (not persisted)
- The `/scm/proposals/{id}` endpoint returns 404
- All write operations return appropriate error messages

For development testing with persistence, set `SCM_WRITES=1`.