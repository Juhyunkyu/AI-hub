#!/bin/bash

# AI 지식 교류 허브 - 번들 최적화 스크립트
# 성능 분석 및 번들 크기 모니터링 자동화

set -e

echo "🚀 Starting bundle optimization analysis..."

# 1. 기존 빌드 정리
echo "🧹 Cleaning previous builds..."
rm -rf .next/

# 2. 의존성 정리
echo "📦 Checking dependencies..."
npm ls --depth=0 | grep -E "(react-virtualized|@types/react-virtualized)" || echo "✅ react-virtualized successfully removed"

# 3. 번들 분석과 함께 빌드
echo "🔍 Building with bundle analysis..."
ANALYZE=true npm run build

# 4. 번들 크기 분석
echo "📊 Bundle size analysis:"

if [ -d ".next/static/chunks" ]; then
    echo "Client-side chunks:"
    du -sh .next/static/chunks/*.js 2>/dev/null | sort -hr | head -10

    echo -e "\nServer-side chunks:"
    find .next/server -name "*.js" -exec du -sh {} \; 2>/dev/null | sort -hr | head -10

    # 총 번들 크기 계산
    CLIENT_SIZE=$(du -sh .next/static/chunks/ 2>/dev/null | cut -f1)
    SERVER_SIZE=$(du -sh .next/server/ 2>/dev/null | cut -f1)

    echo -e "\n📈 Summary:"
    echo "Client bundle size: $CLIENT_SIZE"
    echo "Server bundle size: $SERVER_SIZE"

    # 성능 목표 체크
    CLIENT_SIZE_KB=$(du -sk .next/static/chunks/ 2>/dev/null | cut -f1)
    if [ "$CLIENT_SIZE_KB" -lt 2048 ]; then
        echo "✅ Client bundle size is under 2MB target"
    else
        echo "⚠️  Client bundle size exceeds 2MB target"
    fi
else
    echo "❌ Build failed - no chunks found"
    exit 1
fi

# 5. TypeScript 에러 체크
echo -e "\n🔍 TypeScript error analysis:"
npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "(error|warning)" | wc -l | xargs -I {} echo "Found {} TypeScript issues"

# 6. 번들 분석 리포트 링크
if [ -f ".next/analyze/client.html" ]; then
    echo -e "\n📊 Bundle analysis reports generated:"
    echo "Client: file://$(pwd)/.next/analyze/client.html"
    echo "Server: file://$(pwd)/.next/analyze/nodejs.html"
    echo "Edge: file://$(pwd)/.next/analyze/edge.html"

    # 브라우저에서 자동 열기 (선택사항)
    if command -v xdg-open > /dev/null; then
        echo "🌐 Opening client bundle analysis..."
        xdg-open .next/analyze/client.html &
    fi
fi

# 7. 최적화 권장사항
echo -e "\n💡 Optimization recommendations:"

# 큰 청크 파일 체크
LARGE_CHUNKS=$(find .next/static/chunks -name "*.js" -size +300k 2>/dev/null)
if [ -n "$LARGE_CHUNKS" ]; then
    echo "⚠️  Large chunks found (>300KB):"
    echo "$LARGE_CHUNKS" | while read -r file; do
        echo "  - $(basename "$file"): $(du -sh "$file" | cut -f1)"
    done
    echo "Consider code splitting or dynamic imports"
fi

# React 컴파일러 체크
if grep -q '"reactCompiler"' next.config.ts; then
    echo "✅ React Compiler enabled for optimization"
else
    echo "💡 Consider enabling React Compiler for automatic optimizations"
fi

echo -e "\n🎉 Bundle optimization analysis complete!"
echo "📋 Next steps:"
echo "1. Review bundle analysis reports"
echo "2. Apply dynamic imports for large components"
echo "3. Fix TypeScript errors for better tree shaking"
echo "4. Monitor performance metrics after deployment"