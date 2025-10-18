#!/bin/bash
# Verify safe-screen hardening implementation

set -e

echo "🔍 Safe-Screen Hardening Verification"
echo "======================================"
echo ""

echo "Step 1: Build production..."
npm run build:prod
echo "✅ Production build complete"
echo ""

echo "Step 2: Run bundle policy..."
npm run ci:bundle-policy
echo "✅ Bundle policy passed"
echo ""

echo "Step 3: Run production E2E tests..."
npm run e2e:prod-safe
echo "✅ Production E2E tests passed"
echo ""

echo "======================================"
echo "✅ All verification steps passed!"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff"
echo "2. Commit: git commit -m 'test/ci(safe-screen): add force-safe network spy + require prod E2E & bundle policy'"
echo "3. Push and create PR"
echo "4. Configure branch protection to require:"
echo "   - 'Bundle Policy'"
echo "   - 'E2E (production safe-screen)'"
