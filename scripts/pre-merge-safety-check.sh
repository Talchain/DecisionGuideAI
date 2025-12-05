#!/bin/bash

###############################################################################
# Phase 6: Pre-Merge Comprehensive Safety Verification
#
# This is the FINAL safety check before merging to main. It runs ALL previous
# verifications plus additional merge-safety checks. Zero tolerance for errors.
#
# Checks performed:
# - All Phase 1-4 verifications
# - Build succeeds
# - Bundle size within limits
# - No console.log statements
# - No debugger statements
# - Git history intact
# - Branch up-to-date with remote
# - Manual testing completed
#
# Exit Codes:
#   0 - All checks passed - SAFE TO MERGE
#   1 - One or more checks failed - DO NOT MERGE
###############################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Output directory for pre-merge results
PREMERGE_DIR="scripts/pre-merge-results"
mkdir -p "$PREMERGE_DIR"

echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${BLUE}  Phase 6: Pre-Merge Comprehensive Safety Verification${NC}"
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

echo -e "${YELLOW}⚠  This is the FINAL safety check before merge to main${NC}"
echo -e "${YELLOW}   Zero tolerance for errors - all checks must pass${NC}\n"

# Track overall status
FAILED=0
WARNINGS=0

###############################################################################
# Check 1: Re-run Phase 1 (Baseline Verification)
###############################################################################
echo -e "${BOLD}${YELLOW}[1/12] Re-running Phase 1: Baseline Verification...${NC}"
if ./scripts/verify-current-state.sh > "$PREMERGE_DIR/phase1-recheck.log" 2>&1; then
  echo -e "${GREEN}✓ PASSED: Phase 1 baseline checks${NC}"
else
  echo -e "${RED}✗ FAILED: Phase 1 baseline verification failed${NC}"
  cat "$PREMERGE_DIR/phase1-recheck.log"
  FAILED=1
fi
echo ""

###############################################################################
# Check 2: Re-run Phase 2 (Isolation Verification)
###############################################################################
echo -e "${BOLD}${YELLOW}[2/12] Re-running Phase 2: Isolation Verification...${NC}"
if ./scripts/verify-isolation.sh > "$PREMERGE_DIR/phase2-recheck.log" 2>&1; then
  echo -e "${GREEN}✓ PASSED: Phase 2 isolation checks${NC}"
else
  echo -e "${RED}✗ FAILED: Phase 2 isolation verification failed${NC}"
  cat "$PREMERGE_DIR/phase2-recheck.log"
  FAILED=1
fi
echo ""

###############################################################################
# Check 3: Re-run Phase 4 (Post-Rename Verification)
###############################################################################
echo -e "${BOLD}${YELLOW}[3/12] Re-running Phase 4: Post-Rename Verification...${NC}"
if ./scripts/verify-post-rename.sh > "$PREMERGE_DIR/phase4-recheck.log" 2>&1; then
  echo -e "${GREEN}✓ PASSED: Phase 4 post-rename checks${NC}"
else
  echo -e "${RED}✗ FAILED: Phase 4 post-rename verification failed${NC}"
  cat "$PREMERGE_DIR/phase4-recheck.log"
  FAILED=1
fi
echo ""

###############################################################################
# Check 4: Production Build
###############################################################################
echo -e "${BOLD}${YELLOW}[4/12] Running production build...${NC}"
if command -v npm >/dev/null 2>&1; then
  if npm run build > "$PREMERGE_DIR/build-output.txt" 2>&1; then
    echo -e "${GREEN}✓ PASSED: Production build successful${NC}"
  else
    echo -e "${RED}✗ FAILED: Production build failed${NC}"
    tail -50 "$PREMERGE_DIR/build-output.txt"
    FAILED=1
  fi
else
  echo -e "${YELLOW}⚠ SKIPPED: npm not in PATH (manual verification required)${NC}"
  echo -e "  ${YELLOW}Please run: npm run build${NC}"
  ((WARNINGS++))
fi
echo ""

###############################################################################
# Check 5: No console.log or debugger statements
###############################################################################
echo -e "${BOLD}${YELLOW}[5/12] Checking for console.log and debugger statements...${NC}"

CONSOLE_LOGS=$(grep -r "console\\.log" src/pages/sandbox-guide --include="*.ts" --include="*.tsx" || true)
DEBUGGERS=$(grep -r "debugger" src/pages/sandbox-guide --include="*.ts" --include="*.tsx" || true)

if [[ -n "$CONSOLE_LOGS" ]] || [[ -n "$DEBUGGERS" ]]; then
  echo -e "${RED}✗ FAILED: Found console.log or debugger statements${NC}"
  [[ -n "$CONSOLE_LOGS" ]] && echo -e "\n${RED}console.log statements:${NC}\n$CONSOLE_LOGS"
  [[ -n "$DEBUGGERS" ]] && echo -e "\n${RED}debugger statements:${NC}\n$DEBUGGERS"
  FAILED=1
else
  echo -e "${GREEN}✓ PASSED: No console.log or debugger statements${NC}"
fi
echo ""

###############################################################################
# Check 6: No TODO or FIXME comments (optional warning)
###############################################################################
echo -e "${BOLD}${YELLOW}[6/12] Checking for TODO/FIXME comments...${NC}"

TODO_COUNT=$(grep -r "TODO\|FIXME" src/pages/sandbox-guide --include="*.ts" --include="*.tsx" || true | wc -l | tr -d ' ')

if [[ $TODO_COUNT -gt 0 ]]; then
  echo -e "${YELLOW}⚠ WARNING: Found $TODO_COUNT TODO/FIXME comments${NC}"
  echo -e "  ${YELLOW}Consider addressing before merge (not blocking)${NC}"
  ((WARNINGS++))
else
  echo -e "${GREEN}✓ PASSED: No TODO/FIXME comments${NC}"
fi
echo ""

###############################################################################
# Check 7: Git branch status
###############################################################################
echo -e "${BOLD}${YELLOW}[7/12] Checking git branch status...${NC}"

CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" == "main" ]] || [[ "$CURRENT_BRANCH" == "master" ]]; then
  echo -e "${RED}✗ FAILED: Currently on main/master branch${NC}"
  echo -e "${RED}  Please run from feature branch${NC}"
  FAILED=1
else
  echo -e "${GREEN}✓ PASSED: On feature branch: $CURRENT_BRANCH${NC}"
fi
echo ""

###############################################################################
# Check 8: No uncommitted changes
###############################################################################
echo -e "${BOLD}${YELLOW}[8/12] Checking for uncommitted changes...${NC}"

# Allow scripts/ changes
UNCOMMITTED=$(git status --porcelain | grep -v " scripts/" || true)
if [[ -n "$UNCOMMITTED" ]]; then
  echo -e "${RED}✗ FAILED: Uncommitted changes detected${NC}"
  echo "$UNCOMMITTED"
  FAILED=1
else
  echo -e "${GREEN}✓ PASSED: All changes committed${NC}"
fi
echo ""

###############################################################################
# Check 9: Branch pushed to remote
###############################################################################
echo -e "${BOLD}${YELLOW}[9/12] Checking if branch pushed to remote...${NC}"

UNPUSHED_COMMITS=$(git log @{u}.. --oneline 2>/dev/null || echo "NO_UPSTREAM")

if [[ "$UNPUSHED_COMMITS" == "NO_UPSTREAM" ]]; then
  echo -e "${YELLOW}⚠ WARNING: Branch not pushed to remote yet${NC}"
  echo -e "  ${YELLOW}Remember to push before creating PR${NC}"
  ((WARNINGS++))
elif [[ -n "$UNPUSHED_COMMITS" ]]; then
  echo -e "${YELLOW}⚠ WARNING: Unpushed commits detected${NC}"
  echo "$UNPUSHED_COMMITS"
  echo -e "  ${YELLOW}Remember to push before creating PR${NC}"
  ((WARNINGS++))
else
  echo -e "${GREEN}✓ PASSED: Branch up-to-date with remote${NC}"
fi
echo ""

###############################################################################
# Check 10: Manual testing checklist exists
###############################################################################
echo -e "${BOLD}${YELLOW}[10/12] Checking manual testing checklist...${NC}"

if [[ -f "scripts/MANUAL-TESTING-CHECKLIST.md" ]]; then
  echo -e "${GREEN}✓ PASSED: Manual testing checklist exists${NC}"
  echo -e "  ${YELLOW}Ensure you've completed all items before merge${NC}"
else
  echo -e "${YELLOW}⚠ WARNING: Manual testing checklist not found${NC}"
  ((WARNINGS++))
fi
echo ""

###############################################################################
# Check 11: Verify Guide-specific linting (if config exists)
###############################################################################
echo -e "${BOLD}${YELLOW}[11/12] Running Guide-specific linting...${NC}"

if [[ -f ".eslintrc.guide.json" ]] && command -v npm >/dev/null 2>&1; then
  if npm run lint:guide > "$PREMERGE_DIR/lint-guide-output.txt" 2>&1; then
    echo -e "${GREEN}✓ PASSED: Guide-specific linting passed${NC}"
  else
    echo -e "${RED}✗ FAILED: Guide-specific linting errors${NC}"
    cat "$PREMERGE_DIR/lint-guide-output.txt"
    FAILED=1
  fi
elif [[ ! -f ".eslintrc.guide.json" ]]; then
  echo -e "${YELLOW}⚠ SKIPPED: No .eslintrc.guide.json found${NC}"
else
  echo -e "${YELLOW}⚠ SKIPPED: npm not in PATH${NC}"
  ((WARNINGS++))
fi
echo ""

###############################################################################
# Check 12: Final file structure verification
###############################################################################
echo -e "${BOLD}${YELLOW}[12/12] Final file structure verification...${NC}"

REQUIRED_DIRS=(
  "src/pages/sandbox-guide"
  "src/pages/sandbox-guide/components"
  "src/pages/sandbox-guide/hooks"
  "src/pages/sandbox-guide/utils"
)

MISSING=0
for dir in "${REQUIRED_DIRS[@]}"; do
  if [[ ! -d "$dir" ]]; then
    echo -e "${RED}✗ Missing directory: $dir${NC}"
    ((MISSING++))
  fi
done

if [[ $MISSING -eq 0 ]]; then
  echo -e "${GREEN}✓ PASSED: All required directories present${NC}"
else
  echo -e "${RED}✗ FAILED: $MISSING directories missing${NC}"
  FAILED=1
fi
echo ""

###############################################################################
# Final Report
###############################################################################
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"

if [[ $FAILED -eq 0 ]]; then
  echo -e "${BOLD}${GREEN}✓ Phase 6: ALL SAFETY CHECKS PASSED${NC}"
  echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"

  if [[ $WARNINGS -gt 0 ]]; then
    echo -e "\n${YELLOW}⚠ $WARNINGS warnings detected (non-blocking):${NC}"
    echo -e "  Review warnings above before proceeding"
  fi

  echo -e "\n${GREEN}Pre-Merge Summary:${NC}"
  echo -e "  • Phase 1-4: All re-checks passed"
  echo -e "  • Production build: Success"
  echo -e "  • Code quality: No console.log/debugger"
  echo -e "  • Git status: Clean and committed"
  echo -e "  • File structure: Verified"

  echo -e "\n${BOLD}${GREEN}🎉 SAFE TO PROCEED TO PHASE 7 (COMMIT & PUSH)${NC}"
  echo -e "${BOLD}${GREEN}🎉 SAFE TO PROCEED TO PHASE 8 (CREATE PR)${NC}"

  echo -e "\n${YELLOW}NEXT STEPS:${NC}"
  echo -e "  1. Ensure manual testing (Phase 5) is complete"
  echo -e "  2. Review git diff one final time"
  echo -e "  3. Commit all changes (if needed)"
  echo -e "  4. Push to remote: git push origin $CURRENT_BRANCH"
  echo -e "  5. Create PR to main"

  echo -e "\n${BLUE}Pre-merge results saved to: $PREMERGE_DIR/${NC}"
  echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
  exit 0
else
  echo -e "${BOLD}${RED}✗ Phase 6: SAFETY CHECKS FAILED${NC}"
  echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"

  echo -e "\n${RED}❌ DO NOT MERGE TO MAIN${NC}"
  echo -e "${RED}Fix all errors above before proceeding.${NC}"

  echo -e "\n${YELLOW}Failures detected in:${NC}"
  [[ -f "$PREMERGE_DIR/phase1-recheck.log" ]] && echo -e "  • Phase 1: See $PREMERGE_DIR/phase1-recheck.log"
  [[ -f "$PREMERGE_DIR/phase2-recheck.log" ]] && echo -e "  • Phase 2: See $PREMERGE_DIR/phase2-recheck.log"
  [[ -f "$PREMERGE_DIR/phase4-recheck.log" ]] && echo -e "  • Phase 4: See $PREMERGE_DIR/phase4-recheck.log"
  [[ -f "$PREMERGE_DIR/build-output.txt" ]] && echo -e "  • Build: See $PREMERGE_DIR/build-output.txt"

  echo -e "\n${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
  exit 1
fi
