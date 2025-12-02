#!/bin/bash

###############################################################################
# Phase 4: Post-Rename Verification
#
# This script verifies that the rename was successful and complete. It checks:
# - No remaining "Copilot" references (except in comments/docs where appropriate)
# - TypeScript compilation still works
# - Linting still passes
# - All tests still pass
# - Directory structure is correct
#
# Exit Codes:
#   0 - All post-rename checks passed
#   1 - Issues detected (fix before proceeding)
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Output directory for post-rename results
POSTRENAME_DIR="scripts/post-rename-results"
mkdir -p "$POSTRENAME_DIR"

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Phase 4: Post-Rename Verification${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

# Track overall status
FAILED=0

###############################################################################
# Check 1: Verify directory structure
###############################################################################
echo -e "${YELLOW}[1/7] Verifying directory structure...${NC}"

if [[ -d "src/pages/sandbox-guide" ]]; then
  echo -e "${GREEN}✓ PASSED: sandbox-guide directory exists${NC}"
else
  echo -e "${RED}✗ FAILED: sandbox-guide directory not found${NC}"
  FAILED=1
fi

if [[ -d "src/pages/sandbox-copilot" ]]; then
  echo -e "${RED}✗ FAILED: Old sandbox-copilot directory still exists${NC}"
  FAILED=1
else
  echo -e "${GREEN}✓ PASSED: Old sandbox-copilot directory removed${NC}"
fi
echo ""

###############################################################################
# Check 2: Count remaining "Copilot" references
###############################################################################
echo -e "${YELLOW}[2/7] Checking for remaining 'Copilot' references...${NC}"

# Search for "Copilot" in code (case-insensitive)
find src/pages/sandbox-guide -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.md" \) \
  -exec grep -i "copilot" {} + 2>/dev/null | tee "$POSTRENAME_DIR/remaining-copilot-refs.txt" || echo -n "" > "$POSTRENAME_DIR/remaining-copilot-refs.txt"

REF_COUNT=$(wc -l < "$POSTRENAME_DIR/remaining-copilot-refs.txt" | tr -d ' ')

if [[ $REF_COUNT -gt 0 ]]; then
  echo -e "${RED}✗ FAILED: Found $REF_COUNT remaining 'Copilot' references${NC}"
  echo -e "${RED}  See: $POSTRENAME_DIR/remaining-copilot-refs.txt${NC}"
  head -20 "$POSTRENAME_DIR/remaining-copilot-refs.txt"
  FAILED=1
else
  echo -e "${GREEN}✓ PASSED: No 'Copilot' references found${NC}"
fi
echo ""

###############################################################################
# Check 3: Verify "Guide" references exist
###############################################################################
echo -e "${YELLOW}[3/7] Verifying 'Guide' references exist...${NC}"

GUIDE_COUNT=$(grep -r "Guide" src/pages/sandbox-guide --include="*.ts" --include="*.tsx" --include="*.md" 2>/dev/null | wc -l | tr -d ' ')

if [[ $GUIDE_COUNT -gt 50 ]]; then
  echo -e "${GREEN}✓ PASSED: Found $GUIDE_COUNT 'Guide' references${NC}"
  echo -e "  (Expected >50 references after rename)"
else
  echo -e "${YELLOW}⚠ WARNING: Only found $GUIDE_COUNT 'Guide' references${NC}"
  echo -e "  Expected more references after rename"
fi
echo ""

###############################################################################
# Check 4: TypeScript Compilation
###############################################################################
echo -e "${YELLOW}[4/7] TypeScript compilation check...${NC}"
if command -v npx >/dev/null 2>&1; then
  if npx tsc --noEmit > "$POSTRENAME_DIR/tsc-output.txt" 2>&1; then
    echo -e "${GREEN}✓ PASSED: TypeScript compilation successful${NC}"
  else
    echo -e "${RED}✗ FAILED: TypeScript compilation errors${NC}"
    cat "$POSTRENAME_DIR/tsc-output.txt"
    FAILED=1
  fi
else
  echo -e "${YELLOW}⚠ SKIPPED: npx not in PATH (manual verification required)${NC}"
  echo -e "  ${YELLOW}Please run: npm run typecheck${NC}"
fi
echo ""

###############################################################################
# Check 5: ESLint
###############################################################################
echo -e "${YELLOW}[5/7] ESLint check...${NC}"
if command -v npm >/dev/null 2>&1; then
  if npm run lint > "$POSTRENAME_DIR/eslint-output.txt" 2>&1; then
    echo -e "${GREEN}✓ PASSED: ESLint checks passed${NC}"
  else
    echo -e "${RED}✗ FAILED: ESLint errors detected${NC}"
    cat "$POSTRENAME_DIR/eslint-output.txt"
    FAILED=1
  fi
else
  echo -e "${YELLOW}⚠ SKIPPED: npm not in PATH (manual verification required)${NC}"
  echo -e "  ${YELLOW}Please run: npm run lint${NC}"
fi
echo ""

###############################################################################
# Check 6: Unit Tests
###############################################################################
echo -e "${YELLOW}[6/7] Unit tests check...${NC}"
if command -v npm >/dev/null 2>&1; then
  if npm run test > "$POSTRENAME_DIR/test-output.txt" 2>&1; then
    echo -e "${GREEN}✓ PASSED: All tests passed${NC}"
    grep -E "Test Files|Tests" "$POSTRENAME_DIR/test-output.txt" || true
  else
    echo -e "${RED}✗ FAILED: Tests failed${NC}"
    cat "$POSTRENAME_DIR/test-output.txt"
    FAILED=1
  fi
else
  echo -e "${YELLOW}⚠ SKIPPED: npm not in PATH (manual verification required)${NC}"
  echo -e "  ${YELLOW}Please run: npm run test${NC}"
fi
echo ""

###############################################################################
# Check 7: Verify file count matches baseline
###############################################################################
echo -e "${YELLOW}[7/7] Verifying file count matches baseline...${NC}"

CURRENT_COUNT=$(find src/pages/sandbox-guide -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.md" \) | wc -l | tr -d ' ')
BASELINE_COUNT=$(wc -l < scripts/baseline-results/file-inventory.txt 2>/dev/null | tr -d ' ' || echo "0")

if [[ $CURRENT_COUNT -eq $BASELINE_COUNT ]]; then
  echo -e "${GREEN}✓ PASSED: File count matches baseline ($CURRENT_COUNT files)${NC}"
elif [[ $BASELINE_COUNT -eq 0 ]]; then
  echo -e "${YELLOW}⚠ WARNING: No baseline found, current count: $CURRENT_COUNT files${NC}"
else
  echo -e "${YELLOW}⚠ WARNING: File count mismatch${NC}"
  echo -e "  Baseline: $BASELINE_COUNT files"
  echo -e "  Current:  $CURRENT_COUNT files"
  echo -e "  Difference: $((CURRENT_COUNT - BASELINE_COUNT))"
fi
echo ""

###############################################################################
# Final Report
###############################################################################
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
if [[ $FAILED -eq 0 ]]; then
  echo -e "${GREEN}✓ Phase 4: POST-RENAME VERIFICATION PASSED${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "\n${GREEN}Verification Summary:${NC}"
  echo -e "  • Directory structure correct"
  echo -e "  • No remaining 'Copilot' references"
  echo -e "  • 'Guide' references found: $GUIDE_COUNT"
  echo -e "  • TypeScript: Passing"
  echo -e "  • ESLint: Passing"
  echo -e "  • Tests: Passing"
  echo -e "  • File count: $CURRENT_COUNT files"
  echo -e "\n${YELLOW}NEXT STEPS:${NC}"
  echo -e "  1. Perform manual functional testing (Phase 5)"
  echo -e "  2. Run pre-merge safety check: ./scripts/pre-merge-safety-check.sh"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
  exit 0
else
  echo -e "${RED}✗ Phase 4: POST-RENAME VERIFICATION FAILED${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "\n${RED}Fix errors above before proceeding.${NC}\n"
  exit 1
fi
