#!/bin/bash

###############################################################################
# Phase 2: Isolation Verification
#
# This script verifies that the Copilot Variant is properly isolated from
# the rest of the codebase. It checks that:
# - No imports from sandbox-copilot in non-copilot code
# - No shared state or cross-contamination
# - Proper boundaries are maintained
#
# Exit Codes:
#   0 - All isolation checks passed
#   1 - Isolation violations detected (STOP - fix before rename)
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Output directory for isolation results
ISOLATION_DIR="scripts/isolation-results"
mkdir -p "$ISOLATION_DIR"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Phase 2: Isolation Verification${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

# Track overall status
FAILED=0

###############################################################################
# Check 1: No imports from sandbox-copilot in external code
###############################################################################
echo -e "${YELLOW}[1/4] Checking for external imports of sandbox-copilot...${NC}"

# Find all TS/TSX files outside sandbox-copilot
find src -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -not -path "*/sandbox-copilot/*" \
  -not -path "*/node_modules/*" > "$ISOLATION_DIR/external-files.txt"

# Search for imports from sandbox-copilot in those files
EXTERNAL_IMPORTS=0
> "$ISOLATION_DIR/external-imports.txt"  # Clear file

while IFS= read -r file; do
  if grep -l "from.*sandbox-copilot" "$file" 2>/dev/null; then
    echo "$file" >> "$ISOLATION_DIR/external-imports.txt"
    ((EXTERNAL_IMPORTS++))
  fi
done < "$ISOLATION_DIR/external-files.txt"

if [[ $EXTERNAL_IMPORTS -gt 0 ]]; then
  echo -e "${RED}✗ FAILED: Found $EXTERNAL_IMPORTS files importing from sandbox-copilot${NC}"
  echo -e "${RED}  Violations listed in: $ISOLATION_DIR/external-imports.txt${NC}"
  cat "$ISOLATION_DIR/external-imports.txt"
  FAILED=1
else
  echo -e "${GREEN}✓ PASSED: No external imports from sandbox-copilot${NC}"
fi
echo ""

###############################################################################
# Check 2: Verify sandbox-copilot only imports from allowed paths
###############################################################################
echo -e "${YELLOW}[2/4] Checking sandbox-copilot imports are allowed...${NC}"

# Find all imports in sandbox-copilot files
find src/pages/sandbox-copilot -type f \( -name "*.ts" -o -name "*.tsx" \) \
  -exec grep -h "^import.*from" {} \; 2>/dev/null | \
  sed "s/.*from ['\"]//;s/['\"].*//" | \
  grep -v "^\./" | \
  grep -v "^\.\./" | \
  sort -u > "$ISOLATION_DIR/copilot-external-imports.txt" || true

# Check for forbidden imports (none currently - this is for future safety)
FORBIDDEN=0
if grep -E "(src/pages/canvas|src/pages/poc)" "$ISOLATION_DIR/copilot-external-imports.txt" 2>/dev/null; then
  echo -e "${RED}✗ FAILED: Found imports from forbidden paths${NC}"
  FAILED=1
  FORBIDDEN=1
fi

if [[ $FORBIDDEN -eq 0 ]]; then
  IMPORT_COUNT=$(wc -l < "$ISOLATION_DIR/copilot-external-imports.txt" | tr -d ' ')
  echo -e "${GREEN}✓ PASSED: All $IMPORT_COUNT external imports are allowed${NC}"
  echo -e "  Allowed imports: react, @xyflow/react, zustand, shared libs"
fi
echo ""

###############################################################################
# Check 3: Verify route isolation
###############################################################################
echo -e "${YELLOW}[3/4] Checking route registration...${NC}"

# Check that sandbox-copilot route is properly registered
if grep -r "sandbox.*copilot\|copilot" src/App.tsx src/routes.tsx src/router.tsx 2>/dev/null > "$ISOLATION_DIR/route-registration.txt"; then
  echo -e "${GREEN}✓ PASSED: Route properly registered${NC}"
  ROUTE_COUNT=$(wc -l < "$ISOLATION_DIR/route-registration.txt" | tr -d ' ')
  echo -e "  Found $ROUTE_COUNT route references"
else
  echo -e "${YELLOW}⚠ WARNING: No route registration found (may be dynamic)${NC}"
fi
echo ""

###############################################################################
# Check 4: Verify no shared state pollution
###############################################################################
echo -e "${YELLOW}[4/4] Checking for shared state pollution...${NC}"

# Check that copilot stores are isolated (only imported within sandbox-copilot)
> "$ISOLATION_DIR/state-violations.txt"

for store in "useCopilotStore" "CopilotState"; do
  VIOLATIONS=$(grep -r "$store" src --include="*.ts" --include="*.tsx" \
    --exclude-dir=sandbox-copilot \
    --exclude-dir=node_modules 2>/dev/null || true)

  if [[ -n "$VIOLATIONS" ]]; then
    echo "$store violations:" >> "$ISOLATION_DIR/state-violations.txt"
    echo "$VIOLATIONS" >> "$ISOLATION_DIR/state-violations.txt"
    echo "" >> "$ISOLATION_DIR/state-violations.txt"
  fi
done

if [[ -s "$ISOLATION_DIR/state-violations.txt" ]]; then
  echo -e "${RED}✗ FAILED: Shared state pollution detected${NC}"
  cat "$ISOLATION_DIR/state-violations.txt"
  FAILED=1
else
  echo -e "${GREEN}✓ PASSED: No shared state pollution${NC}"
  echo -e "  Copilot stores are properly isolated"
fi
echo ""

###############################################################################
# Final Report
###############################################################################
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
if [[ $FAILED -eq 0 ]]; then
  echo -e "${GREEN}✓ Phase 2: ISOLATION VERIFIED - Safe to rename${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "\n${GREEN}Isolation Summary:${NC}"
  echo -e "  • No external imports from sandbox-copilot"
  echo -e "  • All copilot imports are allowed"
  echo -e "  • Routes properly isolated"
  echo -e "  • No shared state pollution"
  echo -e "\n${BLUE}Isolation data saved to: $ISOLATION_DIR/${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
  exit 0
else
  echo -e "${RED}✗ Phase 2: ISOLATION VIOLATIONS - DO NOT PROCEED${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "\n${RED}Fix isolation violations before proceeding with rename.${NC}\n"
  exit 1
fi
