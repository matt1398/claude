#!/bin/bash

echo "==================================="
echo "Project Setup Verification"
echo "==================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
        return 0
    else
        echo -e "${RED}✗${NC} $1 (MISSING)"
        return 1
    fi
}

check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $1/"
        return 0
    else
        echo -e "${RED}✗${NC} $1/ (MISSING)"
        return 1
    fi
}

echo "Configuration Files:"
check_file "package.json"
check_file "electron.vite.config.ts"
check_file "tsconfig.json"
check_file "tsconfig.node.json"
check_file "tailwind.config.js"
check_file "postcss.config.js"
check_file ".gitignore"
echo ""

echo "Main Process:"
check_file "src/main/index.ts"
check_file "src/main/ipc/handlers.ts"
echo ""

echo "Preload:"
check_file "src/preload/index.ts"
echo ""

echo "Renderer:"
check_file "src/renderer/index.html"
check_file "src/renderer/main.tsx"
check_file "src/renderer/index.css"
check_file "src/renderer/App.tsx"
check_file "src/renderer/types/data.ts"
check_file "src/renderer/store/index.ts"
check_file "src/renderer/components/projects/ProjectsList.tsx"
check_file "src/renderer/components/sessions/SessionsList.tsx"
check_file "src/renderer/components/detail/SessionDetail.tsx"
echo ""

echo "Documentation:"
check_file "README.md"
check_file "INITIALIZATION_COMPLETE.md"
echo ""

echo "==================================="
echo "Next Steps:"
echo "==================================="
echo "1. Run: npm install"
echo "2. Run: npm run dev"
echo "3. Continue with Phase 1.3: ProjectScanner"
echo ""
