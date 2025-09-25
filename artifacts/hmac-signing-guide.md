# HMAC Signing Guide

**🔐 Internal HMAC Signing for DecisionGuide AI Platform**

## Overview

HMAC (Hash-based Message Authentication Code) signing provides cryptographic verification that requests are authentic and haven't been tampered with. This guide shows how to enable, test, and disable HMAC signing for internal API communication.

**⚠️ Default State: DISABLED** - HMAC signing is OFF by default for security and simplicity.

## Enable HMAC Signing

### Step 1: Generate Signing Keys
```bash
# Generate a secure HMAC key (256-bit recommended)
openssl rand -hex 32

# Example output: a1b2c3d4e5f6...
# Save this key securely - it will be your HMAC_SIGNING_KEY
```

### Step 2: Set Environment Variables
```bash
# Enable HMAC signing
export ENABLE_HMAC_SIGNING=true

# Set the signing key (use your generated key)
export HMAC_SIGNING_KEY="a1b2c3d4e5f6789abcdef1234567890abcdef1234567890abcdef1234567890ab"

# Optional: Set signing algorithm (default: sha256)
export HMAC_ALGORITHM="sha256"

# Optional: Set timestamp window in seconds (default: 300 = 5 minutes)
export HMAC_TIMESTAMP_WINDOW=300
```

### Step 3: Verify Configuration
```bash
# Check that HMAC is enabled
npm run flags:print | grep HMAC

# Should show:
# ENABLE_HMAC_SIGNING: true
# HMAC_SIGNING_KEY: [hidden]
```

## HMAC Request Format

### Required Headers
Every signed request must include:

```http
Authorization: Bearer your-api-token
X-HMAC-Timestamp: 1695659700
X-HMAC-Signature: sha256=a1b2c3d4e5f6789abcdef1234567890
Content-Type: application/json
```

### Signature Generation Process

1. **Create String to Sign:**
```
HTTP_METHOD + "\n" +
REQUEST_PATH + "\n" +
QUERY_STRING + "\n" +  (empty if no query)
TIMESTAMP + "\n" +
CONTENT_TYPE + "\n" +
REQUEST_BODY
```

2. **Generate HMAC:**
```bash
# Example signing string for POST /api/analysis
echo -n "POST
/api/analysis

1695659700
application/json
{\"decisionTitle\":\"Test\",\"options\":[{\"name\":\"A\",\"description\":\"First\"},{\"name\":\"B\",\"description\":\"Second\"}]}" | \
openssl dgst -sha256 -hmac "your-hmac-key" -binary | openssl base64
```

## Testing HMAC End-to-End

### Dry-Run Test with curl

```bash
#!/bin/bash
# HMAC Test Script - Dry Run

# Configuration
HMAC_KEY="a1b2c3d4e5f6789abcdef1234567890abcdef1234567890abcdef1234567890ab"
API_TOKEN="your-api-token"
BASE_URL="http://localhost:3000"
TIMESTAMP=$(date +%s)

# Request details
METHOD="POST"
PATH="/api/analysis"
CONTENT_TYPE="application/json"
BODY='{"decisionTitle":"HMAC Test","options":[{"name":"Option A","description":"First choice"},{"name":"Option B","description":"Second choice"}]}'

# Create string to sign
STRING_TO_SIGN="${METHOD}
${PATH}

${TIMESTAMP}
${CONTENT_TYPE}
${BODY}"

# Generate signature
SIGNATURE=$(echo -n "${STRING_TO_SIGN}" | openssl dgst -sha256 -hmac "${HMAC_KEY}" -binary | openssl base64)

echo "🔐 HMAC Signing Test"
echo "===================="
echo "Timestamp: ${TIMESTAMP}"
echo "Signature: sha256=${SIGNATURE}"
echo
echo "String to Sign:"
echo "---------------"
echo "${STRING_TO_SIGN}"
echo
echo "curl Command:"
echo "-------------"
echo "curl -X POST '${BASE_URL}${PATH}' \\"
echo "  -H 'Authorization: Bearer ${API_TOKEN}' \\"
echo "  -H 'Content-Type: ${CONTENT_TYPE}' \\"
echo "  -H 'X-HMAC-Timestamp: ${TIMESTAMP}' \\"
echo "  -H 'X-HMAC-Signature: sha256=${SIGNATURE}' \\"
echo "  -d '${BODY}'"

# Uncomment to actually execute:
# curl -X POST "${BASE_URL}${PATH}" \
#   -H "Authorization: Bearer ${API_TOKEN}" \
#   -H "Content-Type: ${CONTENT_TYPE}" \
#   -H "X-HMAC-Timestamp: ${TIMESTAMP}" \
#   -H "X-HMAC-Signature: sha256=${SIGNATURE}" \
#   -d "${BODY}"
```

### Expected Success Response
```json
{
  "analysisId": "ana_hmac_test_001",
  "status": "queued",
  "hmac_verified": true,
  "timestamp": "2024-09-24T19:15:00Z"
}
```

### Expected Error Responses

**Missing Signature:**
```json
{
  "error": "hmac_required",
  "message": "HMAC signature is required when HMAC signing is enabled",
  "status": 401
}
```

**Invalid Signature:**
```json
{
  "error": "hmac_verification_failed",
  "message": "HMAC signature verification failed",
  "timestamp_valid": true,
  "status": 401
}
```

**Timestamp Too Old:**
```json
{
  "error": "hmac_timestamp_expired",
  "message": "Request timestamp is outside acceptable window",
  "timestamp_provided": 1695659400,
  "server_time": 1695659700,
  "window_seconds": 300,
  "status": 401
}
```

## Testing Different Scenarios

### Valid Request Test
```bash
# Test with correct signature (should succeed)
curl -X GET 'http://localhost:3000/api/analysis/ana_test_001' \
  -H 'Authorization: Bearer valid-token' \
  -H 'X-HMAC-Timestamp: 1695659700' \
  -H 'X-HMAC-Signature: sha256=valid-signature-here'
```

### Invalid Signature Test
```bash
# Test with wrong signature (should fail with 401)
curl -X GET 'http://localhost:3000/api/analysis/ana_test_001' \
  -H 'Authorization: Bearer valid-token' \
  -H 'X-HMAC-Timestamp: 1695659700' \
  -H 'X-HMAC-Signature: sha256=wrong-signature'
```

### Expired Timestamp Test
```bash
# Test with old timestamp (should fail with 401)
OLD_TIMESTAMP=$(($(date +%s) - 600))  # 10 minutes ago
curl -X GET 'http://localhost:3000/api/analysis/ana_test_001' \
  -H 'Authorization: Bearer valid-token' \
  -H "X-HMAC-Timestamp: ${OLD_TIMESTAMP}" \
  -H 'X-HMAC-Signature: sha256=any-signature'
```

## Security Considerations

### Key Management
- **Never commit keys to version control**
- **Rotate keys regularly** (recommended: monthly)
- **Use different keys for different environments**
- **Store keys in secure environment variables or key management systems**

### Timestamp Security
- **Short window prevents replay attacks** (default: 5 minutes)
- **Server and client clocks should be synchronized**
- **Consider network latency in timestamp window**

### Transport Security
- **Always use HTTPS in production**
- **HMAC provides message integrity, not confidentiality**
- **Combine with proper TLS configuration**

## Disable HMAC Signing

### Emergency Disable
```bash
# Quick disable (current session only)
export ENABLE_HMAC_SIGNING=false

# Or use panic-off switch
source ./tools/panic-off.sh
```

### Permanent Disable
```bash
# Remove or comment out in environment files
# ENABLE_HMAC_SIGNING=true
# HMAC_SIGNING_KEY=...

# Restart services to pick up changes
npm run dev  # or your service restart command
```

### Verify Disabled
```bash
# Check that HMAC is disabled
npm run flags:print | grep HMAC

# Should show:
# ENABLE_HMAC_SIGNING: false (or not present)

# Test that requests work without HMAC headers
curl -X GET 'http://localhost:3000/api/analysis' \
  -H 'Authorization: Bearer valid-token'
# Should succeed without X-HMAC-* headers
```

## Troubleshooting

### Common Issues

**Clock Skew:**
- Error: "Request timestamp is outside acceptable window"
- Solution: Synchronize server and client clocks, or increase `HMAC_TIMESTAMP_WINDOW`

**Key Mismatch:**
- Error: "HMAC signature verification failed"
- Solution: Verify the signing key matches on both client and server

**Missing Headers:**
- Error: "HMAC signature is required"
- Solution: Include both `X-HMAC-Timestamp` and `X-HMAC-Signature` headers

**Wrong String Format:**
- Error: "HMAC signature verification failed"
- Solution: Ensure string-to-sign format exactly matches specification

### Debug Mode
```bash
# Enable debug logging for HMAC
export LOG_LEVEL=debug
export ENABLE_DEBUG_MODE=true

# Check logs for HMAC verification details
npm run dev 2>&1 | grep -i hmac
```

---

**⚠️ Security Reminder**:
- Keep defaults OFF in production
- Enable only when cryptographic verification is required
- Test thoroughly in development before production deployment
- Have disable procedures ready for emergencies

*Last updated: September 2024*