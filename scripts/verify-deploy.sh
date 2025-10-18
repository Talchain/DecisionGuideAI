#!/bin/bash
# Pre-deployment verification for safe-screen fix

set -e

echo "🚀 Safe-Screen Fix - Pre-Deployment Verification"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILED=0

echo "Step 1/3: Building production..."
if npm run build:prod > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Production build successful${NC}"
else
    echo -e "${RED}❌ Production build failed${NC}"
    FAILED=1
fi
echo ""

echo "Step 2/3: Verifying bundle policy..."
if npm run ci:bundle-policy; then
    echo -e "${GREEN}✅ Bundle policy passed (safe chunks are React-free)${NC}"
else
    echo -e "${RED}❌ Bundle policy failed${NC}"
    FAILED=1
fi
echo ""

echo "Step 3/3: Running production E2E tests..."
if npm run e2e:prod-safe; then
    echo -e "${GREEN}✅ Production E2E tests passed${NC}"
    echo "   - Happy path: safe-screen hidden by 2.5s"
    echo "   - Force-safe: 0 React requests"
    echo "   - Abort: safe-screen shows at ~2.2s"
else
    echo -e "${RED}❌ Production E2E tests failed${NC}"
    FAILED=1
fi
echo ""

echo "=================================================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All verification steps passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review changes: git diff"
    echo "2. Commit: git commit -m 'fix(safe-screen): harden air-gap, eliminate flash, enforce prod guards'"
    echo "3. Push: git push origin <branch-name>"
    echo "4. Create PR and verify CI passes"
    echo "5. Test Netlify preview:"
    echo "   - /#/canvas (happy path)"
    echo "   - /?forceSafe=1#/canvas (force-safe mode)"
    echo "6. Merge after all checks pass"
    exit 0
else
    echo -e "${RED}❌ Verification failed - fix errors before deploying${NC}"
    exit 1
fi
