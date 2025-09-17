# Context7 MCP 최적화 룰 📚

**프로젝트**: AI Hub (Next.js 15 + React 19 + Supabase)
**생성일**: 2025-01-13
**적용 범위**: 모든 코드 변경 시 필수 준수

---

## 🎯 **Context7 MCP 필수 사용 룰**

### **Rule 1: 모든 라이브러리 사용 전 Context7 MCP 확인**
```typescript
// ❌ 잘못된 방법
import { useState } from 'react'

// ✅ 올바른 방법 - Context7 MCP로 React 19 최신 패턴 확인 후 사용
// useOptimistic, useTransition, useActionState 등 최신 훅 우선 사용
import { useOptimistic, useTransition } from 'react'
```

**적용 대상**: Next.js, React, Supabase, TailwindCSS, TypeScript

---

## 📋 **의무 체크리스트**

### **매 작업 시 실행:**
1. ✅ `mcp__Context7__resolve-library-id` - 라이브러리 최신 버전 확인
2. ✅ `mcp__Context7__get-library-docs` - 최신 문서 및 패턴 가져오기
3. ✅ 최신 패턴 적용 (예: React 19 optimistic updates)
4. ✅ 성능 최적화 (AbortController, 캐싱, 재시도 로직)
5. ✅ 에러 처리 강화 (exponential backoff, fallback)

---

## 🚀 **Next.js 15 최신 패턴 (Context7 MCP)**

### **Server Components & Client Components**
```typescript
// ✅ Server Component (기본)
async function ServerPage() {
  const data = await fetch('...') // 서버에서 데이터 페칭
  return <ClientComponent initialData={data} />
}

// ✅ Client Component ('use client' 지시어)
'use client'
import { useOptimistic } from 'react'

function ClientComponent({ initialData }) {
  const [optimisticData, addOptimistic] = useOptimistic(...)
}
```

### **App Router 최적화**
```typescript
// ✅ 최신 App Router 구조
app/
├── layout.tsx          // Root Layout
├── page.tsx           // Home Page
├── api/               // API Routes
├── (auth)/           // Route Groups
└── [...slug]/        // Dynamic Routes
```

---

## 🔄 **React 19 Optimistic Updates (필수 패턴)**

### **메시지/데이터 업데이트**
```typescript
// ✅ Context7 MCP 패턴 - React 19 useOptimistic
import { useOptimistic, useTransition } from 'react'

function MessageForm({ messages, sendMessage }) {
  const [optimisticMessages, addOptimistic] = useOptimistic(
    messages,
    (state, newMessage) => [...state, newMessage]
  )

  const [isPending, startTransition] = useTransition()

  async function submitMessage(formData) {
    const message = { id: 'temp', content: formData.get('message') }
    addOptimistic(message) // 즉시 UI 업데이트

    startTransition(async () => {
      await sendMessage(message) // 서버 요청
    })
  }
}
```

### **Server Actions + useActionState**
```typescript
// ✅ Server Action (서버)
'use server'
async function createPost(prevState, formData) {
  // 서버 로직
  return { success: true, message: 'Created!' }
}

// ✅ Client Component
'use client'
import { useActionState } from 'react'

function PostForm() {
  const [state, action, pending] = useActionState(createPost, { message: '' })

  return (
    <form action={action}>
      <button disabled={pending}>
        {pending ? 'Creating...' : 'Create Post'}
      </button>
    </form>
  )
}
```

---

## 🗄️ **Supabase Realtime 최적화 (Context7 MCP)**

### **연결 상태 모니터링**
```typescript
// ✅ Supabase Realtime 최적화 패턴
const channel = supabase
  .channel('messages', {
    config: {
      broadcast: { self: false },
      private: true // 인증된 사용자만
    }
  })
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages'
  }, (payload) => {
    // Context7 MCP: 중복 방지
    if (!processedMessages.has(payload.new.id)) {
      handleNewMessage(payload.new)
      processedMessages.add(payload.new.id)
    }
  })
  .subscribe((status, err) => {
    switch (status) {
      case 'SUBSCRIBED':
        setConnected(true)
        break
      case 'CHANNEL_ERROR':
        // Context7 MCP: 자동 재연결
        reconnect()
        break
    }
  })
```

### **에러 처리 & 재시도**
```typescript
// ✅ Context7 MCP 패턴 - Exponential Backoff
async function fetchWithRetry(url, options, retryCount = 0) {
  const MAX_RETRIES = 3
  const RETRY_DELAY = Math.min(1000 * Math.pow(2, retryCount), 5000)

  try {
    // Context7 MCP: AbortController 사용
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok && response.status >= 500 && retryCount < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
      return fetchWithRetry(url, options, retryCount + 1)
    }

    return response
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      return fetchWithRetry(url, options, retryCount + 1)
    }
    throw error
  }
}
```

---

## 🎨 **TailwindCSS 4 최적화**

### **@theme inline 사용**
```css
/* ✅ TailwindCSS 4 최신 문법 */
@theme inline {
  --font-sans: var(--font-geist-sans);
  --color-background: var(--background);
}
```

### **폰트 최적화**
```typescript
// ✅ Next.js 15 + TailwindCSS 4 폰트 최적화
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",     // FOUT 방지
  preload: true        // 메인 폰트만 preload
})
```

---

## ⚡ **성능 최적화 체크리스트**

### **Bundle 최적화**
```typescript
// ✅ next.config.ts 최적화
experimental: {
  optimizePackageImports: [
    'lucide-react', '@supabase/supabase-js', 'zustand'
  ],
  reactCompiler: {
    compilationMode: 'annotation' // React 19 컴파일러
  },
  optimizeFonts: true // 폰트 preload 최적화
}
```

### **메모리 관리**
```typescript
// ✅ Context7 MCP - 메모리 효율적 상태 관리
const processedItems = useRef(new Set()) // WeakSet 대신 Set 사용
const cleanup = useCallback(() => {
  processedItems.current.clear() // 명시적 정리
}, [])

useEffect(() => cleanup, [cleanup])
```

---

## 🔒 **보안 최적화**

### **CSP 헤더**
```typescript
// ✅ next.config.ts 보안 설정
async headers() {
  return [{
    source: '/(.*)',
    headers: [{
      key: 'Content-Security-Policy',
      value: `
        default-src 'self';
        script-src 'self' 'unsafe-eval';
        connect-src 'self' https://*.supabase.co wss://*.supabase.co;
      `.replace(/\s+/g, ' ').trim()
    }]
  }]
}
```

### **환경 변수 보안**
```typescript
// ✅ 클라이언트에는 NEXT_PUBLIC_만 노출
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL // ✅ OK
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY // ✅ 서버만
```

---

## 📊 **모니터링 & 디버깅**

### **개발 환경 로깅**
```typescript
// ✅ Context7 MCP 디버깅 패턴
if (process.env.NODE_ENV === 'development') {
  console.log(`⚡ Optimistic update: ${data}`)
  console.log(`📊 Cache size: ${cache.size}`)
  console.log(`🔄 Retry attempt: ${retryCount}`)
}
```

### **에러 추적**
```typescript
// ✅ 구체적 에러 정보
try {
  await operation()
} catch (error) {
  console.error('Context7 MCP Error:', {
    operation: 'fetchUserData',
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  })
}
```

---

## 🚀 **배포 최적화**

### **Vercel 설정**
```json
// ✅ vercel.json 최적화
{
  "functions": {
    "src/app/api/**": {
      "maxDuration": 10
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "s-maxage=60, stale-while-revalidate" }
      ]
    }
  ]
}
```

---

## 📝 **코드 리뷰 체크리스트**

### **매 PR 시 확인:**
- [ ] Context7 MCP로 최신 패턴 확인했는가?
- [ ] React 19 useOptimistic 패턴 적용했는가?
- [ ] Supabase Realtime 에러 처리 강화했는가?
- [ ] AbortController + 재시도 로직 있는가?
- [ ] 메모리 누수 방지 코드가 있는가?
- [ ] 개발 환경 로깅이 적절한가?

---

## 🔄 **업데이트 룰**

### **주기적 업데이트 (월 1회)**
1. **Context7 MCP로 새로운 패턴 확인**
2. **Next.js/React 새 버전 체크**
3. **Supabase 새로운 기능 확인**
4. **성능 최적화 기법 업데이트**
5. **이 문서 업데이트**

---

**⚠️ 중요**: 이 룰을 따르지 않으면 성능 저하, 보안 취약점, 유지보수성 문제가 발생할 수 있습니다.

**📞 문의**: Context7 MCP 패턴이 불확실하면 항상 최신 문서부터 확인하세요!