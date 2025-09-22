#!/bin/bash
# 번들 분석 스크립트
# Usage: ./scripts/analyze-bundle.sh

echo "🔍 Next.js Bundle 분석 시작..."
echo "📊 Bundle Analyzer가 자동으로 브라우저에서 열립니다."
echo ""

# 번들 분석 실행
ANALYZE=true npm run build

echo ""
echo "✅ Bundle 분석 완료!"
echo "💡 최적화 권장사항:"
echo "   1. 큰 청크를 찾아 코드 분할 고려"
echo "   2. 미사용 의존성 제거"
echo "   3. dynamic import 활용"
echo "   4. tree shaking 최적화"