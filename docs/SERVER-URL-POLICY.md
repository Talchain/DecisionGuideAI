# Server URL Policy

## Overview

This policy establishes consistent patterns for server URL configuration across development, staging, and production environments while maintaining security and avoiding URL leakage.

## URL Patterns

### Standard URLs
- **Development**: `http://localhost:3001`
- **Staging**: `https://api-staging.decisionguide.ai`
- **Production**: `https://api.decisionguide.ai`

### Port Assignment
- **Development**: Port 3001 (primary), 3002-3009 (additional instances)
- **Docker Compose**: Port 3001 (exposed from container)
- **Production**: Port 443 (HTTPS) via load balancer

## Environment Variable Configuration

### Required Variables
```bash
# Server configuration
SERVER_PORT=3001
SERVER_HOST=localhost          # Development only
API_BASE_URL=                 # Auto-detected if not set

# Environment detection
NODE_ENV=development          # development|staging|production
ENVIRONMENT=local             # local|staging|production
```

### Auto-Detection Logic
```javascript
function getServerUrl() {
  // Explicit override takes precedence
  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL;
  }

  // Environment-based detection
  const env = process.env.NODE_ENV?.toLowerCase();
  const environment = process.env.ENVIRONMENT?.toLowerCase();

  if (env === 'production' || environment === 'production') {
    return 'https://api.decisionguide.ai';
  }

  if (environment === 'staging') {
    return 'https://api-staging.decisionguide.ai';
  }

  // Development default
  const port = process.env.SERVER_PORT || 3001;
  const host = process.env.SERVER_HOST || 'localhost';
  return `http://${host}:${port}`;
}
```

## Security Policies

### URL Exposure Prevention
1. **No hardcoded URLs** in client-side code or public documentation
2. **Environment-specific URLs** in OpenAPI specs
3. **Relative URLs** in client applications where possible
4. **URL validation** for external integrations

### CORS Policy Alignment
Server URLs must align with CORS origin policies:
```javascript
// Development: Allow localhost variants
const devOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8080',
  'http://127.0.0.1:3001'
];

// Production: Strict domain matching
const prodOrigins = [
  'https://app.decisionguide.ai',
  'https://decisionguide.ai'
];
```

## Implementation Requirements

### OpenAPI Specification
Server URLs must be configurable per environment:
```yaml
# openapi-v1.yml
servers:
  - url: http://localhost:3001
    description: Development server
  - url: https://api-staging.decisionguide.ai
    description: Staging server
  - url: https://api.decisionguide.ai
    description: Production server
```

### Service Discovery
Services should discover their own URLs through:
1. Environment variables (preferred)
2. Service discovery mechanisms
3. Configuration files
4. Runtime detection (fallback)

### Client Configuration
Client applications must:
1. Accept server URL as configuration parameter
2. Default to environment-appropriate URL
3. Validate URL format and security (HTTPS in production)
4. Support relative URLs for same-origin requests

## Development Guidelines

### Local Development
- Use `http://localhost:3001` as default
- Support custom ports via `SERVER_PORT`
- Allow host override via `SERVER_HOST`
- Provide `.env.example` with reasonable defaults

### Testing
- Tests should not hardcode server URLs
- Use environment variables or configuration
- Support test-specific URL overrides
- Mock external URLs in unit tests

### Docker/Container Deployment
```yaml
# docker-compose.yml
services:
  api:
    environment:
      - SERVER_PORT=3001
      - API_BASE_URL=http://localhost:3001
    ports:
      - "3001:3001"
```

## Monitoring and Validation

### Health Check URL Construction
Health checks should use the same URL construction logic:
```javascript
const baseUrl = getServerUrl();
const healthUrl = `${baseUrl}/health`;
```

### URL Validation Rules
1. **HTTPS required** in production environments
2. **Domain validation** against allowed patterns
3. **Port restrictions** based on environment
4. **Path validation** for API endpoints

## Migration Path

### Immediate Actions
1. ✅ Create server URL utility function
2. ✅ Update OpenAPI specs with environment servers
3. ✅ Add environment variable documentation
4. ✅ Implement URL auto-detection logic

### Gradual Migration
1. Replace hardcoded URLs in existing code
2. Update client SDKs to use configurable URLs
3. Add URL validation to CI/CD pipelines
4. Monitor for URL leakage in logs and responses

## Compliance

This policy ensures:
- **Security**: No URL leakage, proper HTTPS usage
- **Consistency**: Standardized patterns across environments
- **Flexibility**: Environment-specific configuration
- **Maintainability**: Centralized URL management
- **Testing**: Configurable URLs for different test scenarios

Regular audits should verify compliance with these URL policies across all services and client applications.