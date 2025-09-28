# Signed Pilot Access Links

**Purpose**: Optional temporary, shareable pilot URLs with HMAC authentication (OFF by default)

## 🔒 Security Model

**Design Principle**: No secrets in browser - all authentication server-side
- Links expire automatically (default 30 minutes)
- HMAC-SHA256 signature prevents tampering
- Optional feature - disabled unless explicitly configured
- Development/pilot use only - not for production

## ⚙️ Configuration

### Environment Setup
```bash
# Feature disabled by default
# PILOT_SIGNING_KEY=         # (unset = feature OFF)

# Enable signing (set a secure key)
export PILOT_SIGNING_KEY="your-secure-256-bit-key-here"
export PILOT_LINK_TTL_MIN=30  # Optional: TTL in minutes (default 30)
```

### Key Requirements
- **Minimum Length**: 32 characters
- **Randomness**: Use cryptographically secure random generator
- **Rotation**: Change key periodically in production deployments

```bash
# Generate secure signing key
openssl rand -hex 32
# Example: a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456

export PILOT_SIGNING_KEY="a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
```

## 🚀 API Usage

### POST /pilot/sign-link

**Request**:
```bash
curl -X POST "http://localhost:3001/pilot/sign-link" \
  -H "Content-Type: application/json" \
  -d '{
    "path": "/stream",
    "params": {
      "route": "critique",
      "scenarioId": "pricing-v1",
      "seed": 42
    },
    "ttlMin": 30
  }'
```

**Response**:
```json
{
  "url": "http://localhost:3001/stream?route=critique&scenarioId=pricing-v1&seed=42&olumi_signed=a1b2c3d4e5f6&exp=1696003600"
}
```

## 📋 Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | API path to sign (must start with `/`) |
| `params` | object | Yes | Query parameters to include in signed URL |
| `ttlMin` | number | No | TTL in minutes (1-1440, default 30) |

### Valid Paths
- `/stream` - Stream endpoints
- `/report` - Report endpoints
- `/compare` - Comparison endpoints
- `/runs/{runId}/snapshot` - Snapshot downloads
- Any other pilot API path

## 🔐 Signature Verification

### URL Structure
```
http://localhost:3001/stream?route=critique&scenarioId=pricing-v1&seed=42&olumi_signed=SIGNATURE&exp=TIMESTAMP
```

**Components**:
- Original parameters: `route`, `scenarioId`, `seed`
- Signature: `olumi_signed` (HMAC-SHA256 hex)
- Expiry: `exp` (Unix timestamp)

### Verification Process
1. **Extract Parameters**: Parse original params, signature, and expiry
2. **Check Expiry**: `exp` must be > current Unix timestamp
3. **Verify Signature**: HMAC-SHA256 over `path + sorted_params + exp`
4. **Timing Safe**: Use constant-time comparison

```javascript
// Signature generation algorithm
function generateSignature(path, params, exp, signingKey) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  const payload = `${path}?${sortedParams}&exp=${exp}`;

  return crypto
    .createHmac('sha256', signingKey)
    .update(payload)
    .digest('hex');
}
```

## 🌐 JavaScript Integration

### Generating Signed Links
```javascript
async function createSignedLink(path, params, ttlMinutes = 30) {
  const response = await fetch('/pilot/sign-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path,
      params,
      ttlMin: ttlMinutes
    })
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Signed links not enabled on this server');
    }
    throw new Error(`Failed to create signed link: ${response.status}`);
  }

  const { url } = await response.json();
  return url;
}

// Usage examples
const streamLink = await createSignedLink('/stream', {
  route: 'critique',
  scenarioId: 'pricing-analysis',
  seed: 42
});

const reportLink = await createSignedLink('/report', {
  scenarioId: 'market-analysis',
  seed: 17
}, 60); // 1 hour TTL
```

### Using Signed Links
```javascript
async function useSignedLink(signedUrl) {
  // Signed URLs work exactly like regular URLs
  const response = await fetch(signedUrl);

  if (response.status === 401) {
    throw new Error('Signed link expired or invalid');
  }

  return response;
}

// EventSource with signed URL
const signedStreamUrl = await createSignedLink('/stream', {
  route: 'critique',
  scenarioId: 'test',
  seed: 42
});

const eventSource = new EventSource(signedStreamUrl);
eventSource.onmessage = (event) => {
  console.log('Received:', event.data);
};
```

## 🔄 Share Link Workflow

### 1. Generate Link for Sharing
```javascript
async function shareScenario(scenarioId, seed) {
  try {
    const shareUrl = await createSignedLink('/stream', {
      route: 'critique',
      scenarioId,
      seed
    }, 60); // 1 hour for recipient to use

    // Copy to clipboard or send via email/slack
    navigator.clipboard.writeText(shareUrl);
    return shareUrl;

  } catch (error) {
    if (error.message.includes('not enabled')) {
      // Fallback to regular URL for development
      return `http://localhost:3001/stream?route=critique&scenarioId=${scenarioId}&seed=${seed}`;
    }
    throw error;
  }
}
```

### 2. Recipient Uses Link
```javascript
// Link automatically includes authentication
// No additional setup required
const eventSource = new EventSource(sharedSignedUrl);
```

## ⏰ Expiry Handling

### Default TTL Behavior
- **Default**: 30 minutes
- **Maximum**: 1440 minutes (24 hours)
- **Minimum**: 1 minute

### Expiry Responses
```bash
# Expired link
curl "http://localhost:3001/stream?...&olumi_signed=expired&exp=1696000000"
# Response: 401 {"type": "BAD_INPUT", "message": "Signed link expired"}

# Invalid signature
curl "http://localhost:3001/stream?...&olumi_signed=invalid&exp=9999999999"
# Response: 401 {"type": "BAD_INPUT", "message": "Invalid signature"}
```

### Client-Side Expiry Check
```javascript
function isSignedLinkExpired(signedUrl) {
  const url = new URL(signedUrl);
  const exp = parseInt(url.searchParams.get('exp'));

  if (!exp) return false; // Not a signed link

  return Math.floor(Date.now() / 1000) >= exp;
}

// Usage
if (isSignedLinkExpired(shareUrl)) {
  console.log('Link has expired - generate new one');
}
```

## 🚨 Error Scenarios

### Feature Disabled
```bash
curl -X POST "http://localhost:3001/pilot/sign-link" -d '{}'
# Response: 404 {"type": "BAD_INPUT", "message": "Signed pilot links not enabled"}
```

### Invalid Request
```bash
# Missing path
curl -X POST "http://localhost:3001/pilot/sign-link" \
  -H "Content-Type: application/json" \
  -d '{"params": {"test": "value"}}'
# Response: 400 {"type": "BAD_INPUT", "message": "path field required"}

# Invalid TTL
curl -X POST "http://localhost:3001/pilot/sign-link" \
  -H "Content-Type: application/json" \
  -d '{"path": "/test", "params": {}, "ttlMin": 2000}'
# Response: 400 {"type": "BAD_INPUT", "message": "ttlMin must be between 1 and 1440 minutes"}
```

## 🛡️ Security Best Practices

### 1. Key Management
```bash
# DO: Use environment variables
export PILOT_SIGNING_KEY="$(openssl rand -hex 32)"

# DON'T: Hardcode in application
const SIGNING_KEY = "hardcoded-key"; // ❌ Never do this
```

### 2. Appropriate TTL
```javascript
// Short-lived links for immediate use
const quickLink = await createSignedLink('/report', params, 5); // 5 minutes

// Longer links for async sharing
const shareLink = await createSignedLink('/stream', params, 60); // 1 hour

// DON'T: Overly long TTLs
const badLink = await createSignedLink('/stream', params, 1440); // ❌ 24 hours too long
```

### 3. URL Handling
```javascript
// DO: Treat signed URLs as sensitive
function shareLinkSecurely(signedUrl) {
  // Share via secure channels only
  // Don't log URLs containing signatures
  console.log('Generated signed link (signature hidden)');
}

// DON'T: Log full URLs
console.log(`Generated: ${signedUrl}`); // ❌ Exposes signature
```

## 🔗 Development vs Production

### Development Mode
```bash
# Optional - development works fine without signing
# PILOT_SIGNING_KEY unset = feature disabled gracefully
```

### Pilot Deployment
```bash
# Enable signing for secure sharing
export PILOT_SIGNING_KEY="$(openssl rand -hex 32)"
export PILOT_LINK_TTL_MIN=30

# Rotate key periodically
echo "New key: $(openssl rand -hex 32)"
```

### CORS Compatibility
Signed links work with existing CORS configuration:
```bash
# Existing CORS origins still apply
export CORS_ORIGINS="http://localhost:3000,http://localhost:5173"
```

## 📊 Monitoring & Debugging

### Check Feature Status
```bash
curl "http://localhost:3001/healthz"
# Look for signing status in health response
```

### Signature Debugging
```javascript
// Verify signature manually (development only)
function debugSignature(path, params, exp, signature, key) {
  const expected = generateSignature(path, params, exp, key);
  console.log('Expected:', expected);
  console.log('Received:', signature);
  console.log('Match:', expected === signature);
}
```

---

**Security**: HMAC-SHA256 with server-side key
**Default State**: OFF (requires `PILOT_SIGNING_KEY` to enable)
**TTL Range**: 1-1440 minutes (default 30)
**Use Case**: Temporary pilot access sharing