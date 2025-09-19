# Team Hub Supazod Validation System Guide

Supabase + Zod 통합 검증 시스템의 완전한 구현 가이드입니다.

## 📋 목차

- [개요](#개요)
- [생성된 파일 구조](#생성된-파일-구조)
- [기본 사용법](#기본-사용법)
- [API Routes에서 사용하기](#api-routes에서-사용하기)
- [React 컴포넌트에서 사용하기](#react-컴포넌트에서-사용하기)
- [고급 기능](#고급-기능)
- [문제 해결](#문제-해결)

## 개요

이 시스템은 **Supazod**를 사용하여 Supabase 타입에서 자동으로 Zod 스키마를 생성하고, 추가적인 검증 유틸리티와 React 훅을 제공합니다.

### 주요 특징

- ✅ **타입 안전성**: Supabase 타입과 100% 일치하는 Zod 스키마
- ✅ **자동 생성**: 데이터베이스 스키마 변경 시 자동 업데이트
- ✅ **향상된 검증**: 커스텀 검증 규칙 추가 가능
- ✅ **API 통합**: Next.js 15 API Routes와 완벽 호환
- ✅ **React 훅**: 클라이언트 측 폼 검증을 위한 useValidation
- ✅ **에러 처리**: 구조화된 에러 메시지와 다국어 지원

## 생성된 파일 구조

```
src/lib/schemas/
├── supabase-generated.ts     # Supazod 자동 생성 스키마
├── supabase-types.ts         # 생성된 타입 정의
├── utilities.ts              # 검증 유틸리티 함수
└── index.ts                  # 통합 익스포트

src/lib/hooks/
└── useValidation.ts          # React 검증 훅

src/app/api/
├── validation-test/          # 검증 시스템 테스트 API
└── example-validation/       # 완전한 검증 예제 API

src/components/examples/
└── ZodValidationDemo.tsx     # 데모 컴포넌트

scripts/
└── generate-zod-schemas.js   # 스키마 생성 스크립트
```

## 기본 사용법

### 1. 스키마 생성

```bash
# Supabase 타입에서 Zod 스키마 자동 생성
node scripts/generate-zod-schemas.js
```

### 2. 기본 스키마 가져오기

```typescript
import {
  // 기본 생성된 스키마
  publicPostsRowSchema,
  publicPostsInsertSchema,
  publicPostsUpdateSchema,

  // 향상된 커스텀 스키마
  EnhancedPostSchema,
  EnhancedProfileSchema,

  // 쿼리 파라미터 스키마
  PostQuerySchema,

  // 검증 유틸리티
  validateSchema,
  validateOrThrow,
  createApiResponse,
  createValidationError,
} from '@/lib/schemas';
```

### 3. 기본 검증

```typescript
import { EnhancedPostSchema } from '@/lib/schemas/supabase-generated';

const postData = {
  title: 'My Post',
  content: 'This is the content',
  // ... other fields
};

// 안전한 검증
const result = EnhancedPostSchema.safeParse(postData);

if (result.success) {
  console.log('Valid data:', result.data);
} else {
  console.error('Validation errors:', result.error.issues);
}

// 예외 발생 검증
try {
  const validData = EnhancedPostSchema.parse(postData);
  // validData는 타입 안전함
} catch (error) {
  // 검증 실패 처리
}
```

## API Routes에서 사용하기

### 기본 패턴

```typescript
// src/app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  publicPostsInsertSchema,
  validateRequestBody,
  createApiResponse,
  createValidationError,
} from '@/lib/schemas/supabase-generated';

export async function POST(request: NextRequest) {
  try {
    // 요청 바디 검증
    const validation = await validateRequestBody(
      request,
      publicPostsInsertSchema.omit({ id: true, created_at: true })
    );

    if (!validation.success) {
      return NextResponse.json(
        createValidationError(validation.error.issues),
        { status: 400 }
      );
    }

    const { title, content } = validation.data;

    // 데이터베이스 작업
    // ...

    return NextResponse.json(createApiResponse({ id: 'new-post-id' }));
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 쿼리 파라미터 검증

```typescript
import { validateSearchParams, PostQuerySchema } from '@/lib/schemas/supabase-generated';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const validation = validateSearchParams(searchParams, PostQuerySchema);

  if (!validation.success) {
    return NextResponse.json(
      createValidationError(validation.error.issues),
      { status: 400 }
    );
  }

  const { page, limit, search, orderBy, order } = validation.data;
  // 모든 값이 타입 안전하며 기본값이 적용됨
}
```

### 향상된 검증 사용

```typescript
import { validateOrThrow, ValidationSchemaError } from '@/lib/schemas/utilities';

export async function POST(request: NextRequest) {
  try {
    // 검증 실패 시 자동으로 예외 발생
    const data = await validateRequestBody(
      request,
      EnhancedPostSchema.omit({ id: true })
    );

    // data는 이미 검증된 상태

  } catch (error) {
    if (error instanceof ValidationSchemaError) {
      return NextResponse.json(
        createValidationError(error.issues),
        { status: 400 }
      );
    }

    throw error;
  }
}
```

## React 컴포넌트에서 사용하기

### useValidation 훅 사용

```typescript
import { useValidation } from '@/lib/hooks/useValidation';
import { EnhancedPostSchema } from '@/lib/schemas/supabase-generated';

function PostForm() {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
  });

  const validation = useValidation(EnhancedPostSchema, {
    validateOnChange: true, // 실시간 검증
    customMessages: {
      title: '제목을 입력해주세요',
      content: '내용을 입력해주세요',
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await validation.validate(formData);

    if (result.success) {
      // API 호출
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        className={validation.getFieldError('title') ? 'error' : ''}
      />
      {validation.getFieldError('title') && (
        <p className="error">{validation.getFieldError('title')}</p>
      )}

      <button type="submit" disabled={!validation.isValid}>
        {validation.isValidating ? 'Validating...' : 'Submit'}
      </button>
    </form>
  );
}
```

### 폼 검증 훅 사용

```typescript
import { useFormValidation } from '@/lib/hooks/useValidation';

function EnhancedForm() {
  const validation = useFormValidation(EnhancedPostSchema, {
    validateOnChange: true,
  });

  const handleFieldChange = (field: string, value: string) => {
    // 개별 필드 검증
    validation.validateField(field, value);
  };

  return (
    <form>
      <input
        onChange={(e) => handleFieldChange('title', e.target.value)}
      />

      {/* 모든 에러 표시 */}
      {Object.entries(validation.fieldErrors).map(([field, error]) => (
        <p key={field} className="error">{field}: {error}</p>
      ))}
    </form>
  );
}
```

## 고급 기능

### 커스텀 스키마 확장

```typescript
import { publicPostsInsertSchema } from '@/lib/schemas/supabase-generated';

// 기존 스키마 확장
const CustomPostSchema = publicPostsInsertSchema.extend({
  tags: z.array(z.string()).min(1, '최소 1개의 태그가 필요합니다'),
  category: z.enum(['tech', 'news', 'blog']),
}).omit({
  id: true,
  created_at: true,
});

// 부분 업데이트 스키마
const PostUpdateSchema = CustomPostSchema.partial();

// 특정 필드만 선택
const PostPreviewSchema = CustomPostSchema.pick({
  title: true,
  content: true,
});
```

### 조건부 검증

```typescript
const ConditionalPostSchema = z.object({
  type: z.enum(['link', 'text']),
  title: z.string().min(1),
  content: z.string().optional(),
  url: z.string().url().optional(),
}).refine(
  (data) => {
    if (data.type === 'link') {
      return !!data.url; // 링크 타입이면 URL 필수
    }
    if (data.type === 'text') {
      return !!data.content; // 텍스트 타입이면 내용 필수
    }
    return true;
  },
  {
    message: '링크 타입은 URL이, 텍스트 타입은 내용이 필요합니다',
    path: ['type'], // 에러가 표시될 필드
  }
);
```

### 비동기 검증

```typescript
const AsyncPostSchema = EnhancedPostSchema.refine(
  async (data) => {
    // 제목 중복 확인 API 호출
    const response = await fetch(`/api/posts/check-title?title=${data.title}`);
    const { exists } = await response.json();
    return !exists;
  },
  {
    message: '이미 존재하는 제목입니다',
    path: ['title'],
  }
);

// 비동기 검증 사용
const result = await AsyncPostSchema.safeParseAsync(formData);
```

### 다국어 에러 메시지

```typescript
const i18nMessages = {
  ko: {
    'title.required': '제목은 필수입니다',
    'title.min': '제목은 최소 {min}글자 이상이어야 합니다',
    'content.max': '내용은 최대 {max}글자까지 입력 가능합니다',
  },
  en: {
    'title.required': 'Title is required',
    'title.min': 'Title must be at least {min} characters',
    'content.max': 'Content must be at most {max} characters',
  },
};

const validation = useValidation(EnhancedPostSchema, {
  customMessages: i18nMessages[currentLanguage],
});
```

## 문제 해결

### 일반적인 문제들

#### 1. 스키마 생성 실패

```bash
# Supabase 타입 파일 확인
ls -la src/types/supabase.ts

# 의존성 확인
npm list supazod zod

# 스크립트 재실행
node scripts/generate-zod-schemas.js
```

#### 2. 타입 에러

```typescript
// 생성된 타입을 명시적으로 임포트
import type { PublicPostsRow } from '@/lib/schemas/supabase-types';

// 또는 z.infer 사용
import { publicPostsRowSchema } from '@/lib/schemas/supabase-generated';
type Post = z.infer<typeof publicPostsRowSchema>;
```

#### 3. 런타임 검증 실패

```typescript
// 상세한 에러 정보 확인
const result = schema.safeParse(data);
if (!result.success) {
  console.log('Validation errors:', result.error.format());
  // 또는
  console.log('Issues:', result.error.issues);
}
```

### 성능 최적화

#### 1. 스키마 캐싱

```typescript
// 스키마를 모듈 레벨에서 정의
const CachedPostSchema = publicPostsInsertSchema.omit({ id: true });

// 함수 내부에서 재사용
export function validatePost(data: unknown) {
  return CachedPostSchema.safeParse(data);
}
```

#### 2. 선택적 검증

```typescript
// 전체 스키마 대신 필요한 필드만 검증
const QuickValidation = PostSchema.pick({ title: true, content: true });
```

#### 3. 지연 로딩

```typescript
// 큰 스키마는 필요할 때만 로드
const LazySchema = z.lazy(() => import('./heavy-schema').then(m => m.HeavySchema));
```

## 추가 자료

- [Zod 공식 문서](https://zod.dev/)
- [Supazod GitHub](https://github.com/dohooo/supazod)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [React Hook Form + Zod](https://react-hook-form.com/get-started#SchemaValidation)

---

**생성일**: 2025-01-19
**버전**: 1.0
**최종 업데이트**: Phase 2.4 완료