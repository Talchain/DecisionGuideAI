# Node.js Version Alignment

## Summary

All environments and configurations now standardized to Node.js 22.x for consistency and access to the latest JavaScript features and performance improvements.

## Version Requirements

- **Minimum**: Node.js ≥22.0.0, npm ≥10.0.0
- **Recommended**: Node.js 22.x LTS
- **CI/CD**: Node.js 22.x
- **Docker**: node:22-alpine

## Configuration Files Updated

### package.json (Root)
```json
{
  "engines": {
    "node": ">=22.0.0",
    "npm": ">=10.0.0"
  }
}
```

### sdk/olumi-poc-sdk/package.json
```json
{
  "engines": {
    "node": ">=22.0.0",
    "npm": ">=10.0.0"
  }
}
```

### Docker Images
- `docker/Dockerfile.gateway`: `FROM node:22-alpine`
- `docker/Dockerfile.engine`: `FROM node:22-alpine`
- `docker/Dockerfile.jobs`: `FROM node:22-alpine`

### CI/CD (.github/workflows/ci.yml)
- Updated to Node.js 22.x ✅

### Development Environment
- `.nvmrc`: `22` (for automatic version switching)

## Developer Setup

### Using nvm (recommended)
```bash
# Install/use correct Node version
nvm use

# Or install if not already present
nvm install

# Verify version
node --version  # Should show v20.x.x
npm --version   # Should show 9.x.x or higher
```

### Without nvm
Ensure you have Node.js 20.x installed:
```bash
# Check current version
node --version

# If not 20.x, download from https://nodejs.org/
# Choose "LTS" version (currently 20.x)
```

## Verification

Run this command to verify your environment meets requirements:
```bash
# Check Node version
node -e "
const major = parseInt(process.version.slice(1));
if (major >= 20) {
  console.log('✅ Node.js version OK:', process.version);
} else {
  console.log('❌ Node.js version too old:', process.version);
  console.log('   Please upgrade to Node.js 20.x or later');
  process.exit(1);
}
"

# Check npm version
npm --version
```

## Benefits of Node.js 20

- **Performance**: Faster V8 engine, improved startup times
- **Security**: Latest security patches and best practices
- **Features**: Modern JavaScript/TypeScript features
- **Stability**: LTS support until April 2026
- **Ecosystem**: Better compatibility with latest npm packages

## Migration Notes

Previously the project had mixed versions:
- CI: Node 20.x ✅
- Dockerfiles: Node 18.x → **Updated to 20.x**
- SDK: ≥18.0.0 → **Updated to ≥20.0.0**
- Root project: No engine constraints → **Added ≥20.0.0**

This alignment ensures consistency across all development, testing, and deployment environments.