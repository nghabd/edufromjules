#!/bin/bash

# CSP Security Fix - Verification Script
# This script verifies that all CSP fixes have been properly implemented

echo "================================"
echo "CSP Security Fix Verification"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check count
PASSED=0
FAILED=0
WARNINGS=0

# Function to print results
print_check() {
    local status=$1
    local message=$2
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $message"
        ((PASSED++))
    elif [ "$status" = "FAIL" ]; then
        echo -e "${RED}✗${NC} $message"
        ((FAILED++))
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠${NC} $message"
        ((WARNINGS++))
    fi
}

echo "1. File Structure Checks"
echo "------------------------"

# Check middleware.ts exists
if [ -f "middleware.ts" ]; then
    print_check "PASS" "middleware.ts exists"
else
    print_check "FAIL" "middleware.ts missing"
fi

# Check lib/nonce.ts exists
if [ -f "lib/nonce.ts" ]; then
    print_check "PASS" "lib/nonce.ts exists"
else
    print_check "FAIL" "lib/nonce.ts missing"
fi

# Check documentation
if [ -f "CSP_SECURITY_FIX.md" ]; then
    print_check "PASS" "CSP_SECURITY_FIX.md documentation exists"
else
    print_check "FAIL" "CSP_SECURITY_FIX.md missing"
fi

echo ""
echo "2. Code Content Checks"
echo "----------------------"

# Check middleware contains nonce generation
if grep -q "randomBytes" middleware.ts; then
    print_check "PASS" "middleware.ts includes nonce generation"
else
    print_check "FAIL" "middleware.ts missing nonce generation"
fi

# Check middleware exports config
if grep -q "export const config" middleware.ts; then
    print_check "PASS" "middleware.ts exports config"
else
    print_check "FAIL" "middleware.ts missing config export"
fi

# Check middleware sets CSP header
if grep -q "Content-Security-Policy" middleware.ts; then
    print_check "PASS" "middleware.ts sets CSP header"
else
    print_check "FAIL" "middleware.ts doesn't set CSP header"
fi

# Check nonce.ts exports getNonce
if grep -q "export function getNonce" lib/nonce.ts; then
    print_check "PASS" "lib/nonce.ts exports getNonce function"
else
    print_check "FAIL" "lib/nonce.ts missing getNonce export"
fi

echo ""
echo "3. Component Fixes"
echo "------------------"

# Check QuizResults.tsx converted color style
if grep -q 'className=.*text-green-500.*text-red-500' components/quiz/QuizResults.tsx; then
    print_check "PASS" "QuizResults.tsx inline style converted"
else
    print_check "WARN" "QuizResults.tsx color style may need review"
fi

# Check QuizComponent.tsx converted color style
if grep -q 'className=.*text-green-500.*text-red-500' components/quiz/QuizComponent.tsx; then
    print_check "PASS" "QuizComponent.tsx inline style converted"
else
    print_check "WARN" "QuizComponent.tsx color style may need review"
fi

# Check no dangerouslySetInnerHTML remains
if grep -q "dangerouslySetInnerHTML" components/**/*.tsx 2>/dev/null; then
    print_check "FAIL" "dangerouslySetInnerHTML found in components"
else
    print_check "PASS" "No dangerouslySetInnerHTML in components"
fi

echo ""
echo "4. Configuration Checks"
echo "-----------------------"

# Check next.config.ts doesn't have hardcoded CSP
if grep -q "const contentSecurityPolicy" next.config.ts; then
    print_check "FAIL" "next.config.ts still has hardcoded CSP"
else
    print_check "PASS" "next.config.ts has dynamic CSP via middleware"
fi

# Check next.config.ts still has other security headers
if grep -q "X-Content-Type-Options" next.config.ts; then
    print_check "PASS" "Other security headers maintained in next.config.ts"
else
    print_check "FAIL" "Security headers missing from next.config.ts"
fi

echo ""
echo "5. Dependencies Check"
echo "---------------------"

# Check package.json for Next.js 16+
if grep -q '"next".*"1[6-9]' package.json; then
    print_check "PASS" "Next.js 16+ detected"
elif grep -q '"next".*"^16' package.json; then
    print_check "PASS" "Next.js 16+ configured"
else
    print_check "WARN" "Next.js version check"
fi

echo ""
echo "================================"
echo "Verification Summary"
echo "================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ Verification FAILED - Please fix the above issues${NC}"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Verification PASSED with warnings - Review recommended${NC}"
    exit 0
else
    echo -e "${GREEN}✅ All checks PASSED - CSP fix is complete!${NC}"
    exit 0
fi
