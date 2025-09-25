# Contract Negative Test Examples

**⚠️ These examples are designed to FAIL** - they demonstrate what should NOT work in the DecisionGuide AI API.

## Purpose

These negative test cases help developers understand:
- Required fields and their validation rules
- Expected data types for all fields
- Proper authorization and header formatting
- Error responses and status codes

## Files Overview

### `missing-fields.json`
**Should Fail:** Missing required fields in requests
- Missing `decisionTitle` in analysis requests
- Missing or insufficient `options` array
- Empty analysis IDs in URLs
- Missing authorization tokens

**Expected Behavior:** HTTP 400 or 404 responses with clear error messages

### `wrong-types.json`
**Should Fail:** Incorrect data types for fields
- String instead of array for options
- Numbers instead of strings for titles
- Booleans instead of strings for context fields
- Objects instead of primitive types

**Expected Behavior:** HTTP 400 responses with type validation errors

### `forbidden-headers.json`
**Should Fail:** Invalid or forbidden HTTP headers
- Missing `Authorization: Bearer <token>` header
- Wrong authorization formats (Basic auth, empty tokens)
- Incorrect `Content-Type` for JSON endpoints
- Admin/debug headers in public API calls
- Malformed header values with illegal characters

**Expected Behavior:** HTTP 401, 403, 415, or 431 responses based on violation type

## Usage in Testing

### Manual Testing with curl
```bash
# Test missing required field
curl -X POST 'http://localhost:3000/api/analysis' \
  -H 'Authorization: Bearer test-token' \
  -H 'Content-Type: application/json' \
  -d '{"options": [{"name": "A", "description": "Option A"}]}'
# Expected: 400 - Missing decisionTitle

# Test wrong data type
curl -X POST 'http://localhost:3000/api/analysis' \
  -H 'Authorization: Bearer test-token' \
  -H 'Content-Type: application/json' \
  -d '{"decisionTitle": 123, "options": []}'
# Expected: 400 - decisionTitle must be string

# Test missing authorization
curl -X GET 'http://localhost:3000/api/analysis/ana_test_001'
# Expected: 401 - Authorization required
```

### Integration Testing
Copy scenarios from these files to create comprehensive negative test suites that verify:

1. **Field Validation**: All required fields are enforced
2. **Type Checking**: Data types are strictly validated
3. **Authentication**: Security headers are properly checked
4. **Error Handling**: Appropriate error codes and messages are returned

### Contract Wall Integration

These examples link to the main [Contract Wall report](../../../index.html#contract-wall) to ensure:
- API validation rules are properly documented
- Frontend components handle error states gracefully
- Backend services return consistent error formats

## Validation Rules Summary

### Required Fields
- `decisionTitle`: String, non-empty
- `options`: Array, minimum 2 items
- `Authorization`: Bearer token format
- `Content-Type`: application/json for JSON endpoints

### Data Types
- Strings: `decisionTitle`, option names/descriptions, timeline, budget
- Arrays: `options`, constraints, pros/cons
- Booleans: `graceful` (cancel requests), feature flags
- Numbers: timeout values, confidence scores

### HTTP Status Codes
- `400`: Validation errors, type errors, malformed requests
- `401`: Missing or invalid authentication
- `403`: Forbidden headers or operations
- `404`: Resource not found (invalid IDs)
- `415`: Wrong content-type
- `431`: Header too large

---

**⚠️ Important**: These are examples of what should FAIL. Do not use these payloads for successful API calls.

*Link: [Main Contract Examples](../examples/README.md) | [Contract Wall](../../../index.html#contract-wall)*