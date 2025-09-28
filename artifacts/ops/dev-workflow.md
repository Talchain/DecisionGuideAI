# Development Workflow Guide

## Quick Commands

```bash
# Quality checks
npm run typecheck && npm test

# Evidence management
node scripts/evidence-prune.mjs --dry-run
node scripts/evidence-prune.mjs

# Release preparation
npm run artefacts:scan
npm run contract:check
```

## Git Hooks (Optional)

### Pre-push Hook

Automatically run quality checks before pushing to prevent broken builds.

#### Setup (opt-in)

1. **Create the hook script:**
   ```bash
   cat > .git/hooks/pre-push << 'EOF'
   #!/bin/sh

   echo "🔍 Running pre-push quality checks..."

   # Run typecheck
   echo "📝 TypeScript type checking..."
   npm run typecheck
   if [ $? -ne 0 ]; then
     echo "❌ TypeScript errors found. Fix them before pushing."
     exit 1
   fi

   # Run fast test shard (subset of tests)
   echo "🧪 Running fast test shard..."
   npm test -- --reporter=basic --run
   if [ $? -ne 0 ]; then
     echo "❌ Tests failed. Fix them before pushing."
     exit 1
   fi

   echo "✅ Pre-push checks passed!"
   EOF

   chmod +x .git/hooks/pre-push
   ```

2. **Test the hook:**
   ```bash
   # This will trigger the pre-push hook
   git push origin your-branch --dry-run
   ```

#### Fast Test Shard

The pre-push hook runs a fast subset of tests to balance speed and confidence:

- Contract tests (schema validation)
- Unit tests (core logic)
- Smoke tests (basic functionality)

Full test suite still runs in CI.

#### Customisation

Edit `.git/hooks/pre-push` to adjust which checks run:

```bash
# Example: Skip tests, only run typecheck
npm run typecheck

# Example: Run specific test pattern
npm test -- --reporter=basic --run --testNamePattern="Contract"

# Example: Run additional checks
npm run contract:check
npm run artefacts:scan
```

#### Bypass Hook

Use `--no-verify` to skip the hook when needed:

```bash
git push --no-verify origin your-branch
```

### Pre-commit Hook (Alternative)

For faster feedback, run checks on commit instead:

```bash
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh

echo "🔍 Running pre-commit checks..."

# Only run typecheck (faster than full tests)
npm run typecheck
if [ $? -ne 0 ]; then
  echo "❌ TypeScript errors found."
  exit 1
fi

echo "✅ Pre-commit checks passed!"
EOF

chmod +x .git/hooks/pre-commit
```

## Development Best Practices

### Branch Naming

- `feat/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/update-area` - Documentation updates
- `refactor/component-name` - Code refactoring
- `test/test-area` - Test improvements

### Commit Messages

Follow conventional commits:

```
feat: add import dry-run API endpoint
fix: resolve CORS origin validation issue
docs: update SCM-lite seeding guide
test: add determinism guard for SCM diff
```

### Pull Request Size

Keep PRs manageable:
- ≤ 400 lines of code changes
- Single logical change
- Clear description and testing steps

### Quality Gates

Before submitting PR:

1. **Local validation:**
   ```bash
   npm run typecheck
   npm test
   npm run contract:check  # if schemas changed
   ```

2. **Documentation updates:**
   - Update relevant README files
   - Add API documentation
   - Update changelog if needed

3. **Testing:**
   - Add tests for new functionality
   - Update existing tests if needed
   - Verify edge cases

### Environment Setup

1. **Development:**
   ```bash
   # Basic setup
   npm ci
   npm run typecheck
   npm test

   # Feature flags for development
   export IMPORT_ENABLE=1
   export INSIGHTS_ENABLE=1
   export SCM_ENABLE=1
   ```

2. **Feature flag testing:**
   ```bash
   # Test with features disabled (production-like)
   unset IMPORT_ENABLE INSIGHTS_ENABLE SCM_ENABLE
   npm test

   # Test with features enabled
   export IMPORT_ENABLE=1 INSIGHTS_ENABLE=1 SCM_ENABLE=1
   npm test
   ```

## Troubleshooting

### Common Issues

**TypeScript errors:**
```bash
# Clear cache and rebuild
rm -rf node_modules/.cache
npm run typecheck
```

**Test failures:**
```bash
# Run specific test file
npm test -- path/to/test.ts

# Run with verbose output
npm test -- --reporter=verbose
```

**Git hook issues:**
```bash
# Check hook permissions
ls -la .git/hooks/pre-push

# Fix permissions
chmod +x .git/hooks/pre-push

# Test hook manually
.git/hooks/pre-push
```

### Performance Tips

**Faster type checking:**
```bash
# Use incremental mode
npx tsc --incremental --noEmit
```

**Faster testing:**
```bash
# Run only changed files
npm test -- --changed

# Run specific pattern
npm test -- --testNamePattern="Import"
```

**Evidence cleanup:**
```bash
# Free up disk space
node scripts/evidence-prune.mjs

# Check what would be removed
node scripts/evidence-prune.mjs --dry-run
```

## CI/CD Integration

The pre-push hook complements CI/CD:

- **Local**: Fast feedback (typecheck + smoke tests)
- **CI**: Comprehensive validation (full test suite, security scans)
- **CD**: Deployment validation (integration tests, smoke tests in staging)

This layered approach catches issues early while maintaining development velocity.