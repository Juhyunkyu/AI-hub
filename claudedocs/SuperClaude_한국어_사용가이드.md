# SuperClaude 한국어 사용 가이드

**버전**: v1.0
**작성일**: 2025-01-24
**대상**: Claude Code 사용자

---

## 📋 목차

1. [SuperClaude란?](#superClaude란)
2. [설치 및 설정](#설치-및-설정)
3. [핵심 명령어 체계](#핵심-명령어-체계)
4. [에이전트 시스템](#에이전트-시스템)
5. [플래그와 옵션](#플래그와-옵션)
6. [실전 활용 예시](#실전-활용-예시)
7. [자주 묻는 질문](#자주-묻는-질문)

---

## SuperClaude란?

### 🎯 간단한 설명
SuperClaude는 Claude Code를 더 똑똑하고 전문적으로 만들어주는 확장 프레임워크입니다. 마치 Claude에게 전문가들을 붙여주는 것과 같습니다.

### 💡 핵심 개념
- **명령어 시스템**: `/sc:`로 시작하는 특별한 명령어들
- **에이전트 시스템**: `@agent-`로 불러내는 전문가들
- **플래그 시스템**: `--flag`로 동작 방식을 조정
- **자동 최적화**: 상황에 맞는 최적의 도구와 방법 선택

### 🔧 작동 원리
SuperClaude는 소프트웨어가 아니라 **설정 파일 모음**입니다. Claude가 이 설정을 읽고 행동 방식을 바꾸는 방식으로 작동합니다.

---

## 설치 및 설정

### 📦 설치 방법
```bash
# 기본 설치 위치: ~/.claude/
# 설치 후 Claude Code가 자동으로 읽어들임
```

### ✅ 설치 확인
```bash
# Claude Code 채팅창에서 테스트
/sc:help
```

### 🎛️ 기본 설정
설치 후 별다른 설정 없이 바로 사용 가능합니다. 모든 명령어는 **Claude Code 채팅창**에서 입력합니다.

---

## 핵심 명령어 체계

### 🔍 기본 워크플로우 명령어

#### `/sc:brainstorm` - 아이디어 구체화
```bash
# 사용법
/sc:brainstorm "웹 쇼핑몰 만들고 싶어"

# 이럴 때 사용
- 막연한 아이디어를 구체적인 계획으로 만들고 싶을 때
- 프로젝트 시작 전 요구사항 정리할 때
```

#### `/sc:implement` - 기능 구현
```bash
# 사용법
/sc:implement "사용자 인증 시스템"
/sc:implement "결제 모듈" --type backend --focus security

# 이럴 때 사용
- 구체적인 기능을 만들고 싶을 때
- 프론트엔드, 백엔드, 풀스택 구현할 때
```

#### `/sc:analyze` - 코드 분석
```bash
# 사용법
/sc:analyze .
/sc:analyze src/auth/ --focus security

# 이럴 때 사용
- 기존 코드의 문제점을 찾고 싶을 때
- 보안, 성능, 품질 검사할 때
```

### 🔬 전문 분석 명령어

#### `/sc:business-panel` - 비즈니스 전문가 패널
```bash
# 사용법
/sc:business-panel "스타트업 전략 검토해줘"
/sc:business-panel @business_plan.pdf --mode debate

# 이럴 때 사용
- 비즈니스 전략을 검토받고 싶을 때
- 경영진 관점의 조언이 필요할 때
```

#### `/sc:research` - 심층 리서치
```bash
# 사용법
/sc:research "AI 코딩 도구 트렌드"
/sc:research "Next.js vs React" --depth deep

# 이럴 때 사용
- 최신 기술 동향을 파악하고 싶을 때
- 기술 선택을 위한 비교 분석이 필요할 때
```

### 🛠️ 개발 지원 명령어

#### `/sc:test` - 테스트 자동화
```bash
# 사용법
/sc:test --coverage
/sc:test --type integration --fix

# 이럴 때 사용
- 테스트 코드를 자동으로 생성하고 싶을 때
- 테스트 커버리지를 높이고 싶을 때
```

#### `/sc:improve` - 코드 개선
```bash
# 사용법
/sc:improve src/
/sc:improve --type performance --preview

# 이럴 때 사용
- 기존 코드를 더 좋게 만들고 싶을 때
- 성능, 품질, 보안을 향상시키고 싶을 때
```

#### `/sc:troubleshoot` - 문제 해결
```bash
# 사용법
/sc:troubleshoot "로그인이 안 돼요"
/sc:troubleshoot "빌드 에러" --type build

# 이럴 때 사용
- 버그나 에러를 해결하고 싶을 때
- 원인을 체계적으로 찾고 싶을 때
```

### 📝 도움말 명령어

#### `/sc:help` - 전체 명령어 목록
```bash
# 사용법
/sc:help

# 기능
- 사용 가능한 모든 /sc: 명령어 보기
- 각 명령어의 간단한 설명 보기
```

---

## 에이전트 시스템

### 🤖 에이전트란?
에이전트는 특정 분야의 전문가입니다. `@agent-이름` 형태로 불러내서 전문적인 도움을 받을 수 있습니다.

### 🏗️ 아키텍처 에이전트

#### `@agent-system-architect` - 시스템 아키텍트
```bash
# 사용법
@agent-system-architect "대규모 서비스 아키텍처 설계해줘"

# 전문 분야
- 대규모 분산 시스템 설계
- 마이크로서비스 아키텍처
- 확장성 있는 시스템 구조
```

#### `@agent-frontend-architect` - 프론트엔드 아키텍트
```bash
# 사용법
@agent-frontend-architect "React 앱 구조 개선해줘"

# 전문 분야
- 웹 애플리케이션 아키텍처
- UX/UI 설계
- 프론트엔드 성능 최적화
```

#### `@agent-backend-architect` - 백엔드 아키텍트
```bash
# 사용법
@agent-backend-architect "API 서버 구조 설계해줘"

# 전문 분야
- 서버 사이드 시스템
- API 설계
- 데이터베이스 아키텍처
```

### 🔍 품질 관리 에이전트

#### `@agent-security-engineer` - 보안 엔지니어
```bash
# 사용법
@agent-security-engineer "인증 시스템 보안 검토해줘"

# 전문 분야
- 애플리케이션 보안
- 취약점 분석
- 보안 위협 모델링
```

#### `@agent-performance-engineer` - 성능 엔지니어
```bash
# 사용법
@agent-performance-engineer "웹사이트 속도 최적화해줘"

# 전문 분야
- 시스템 성능 최적화
- 확장성 분석
- 병목 지점 해결
```

#### `@agent-quality-engineer` - 품질 엔지니어
```bash
# 사용법
@agent-quality-engineer "테스트 전략 수립해줘"

# 전문 분야
- 종합적인 테스트 전략
- 품질 보증 프로세스
- 테스트 자동화
```

### 🔬 전문 분석 에이전트

#### `@agent-root-cause-analyst` - 근본 원인 분석가
```bash
# 사용법
@agent-root-cause-analyst "서버 장애 원인 찾아줘"

# 전문 분야
- 체계적인 문제 조사
- 근본 원인 분석
- 문제 해결 방법론
```

#### `@agent-deep-research-agent` - 심층 리서치 전문가
```bash
# 사용법
@agent-deep-research-agent "AI 개발 동향 조사해줘"

# 전문 분야
- 종합적인 리서치
- 다단계 추론
- 최신 기술 동향 분석
```

### 🛠️ 개발 전문 에이전트

#### `@agent-python-expert` - 파이썬 전문가
```bash
# 사용법
@agent-python-expert "데이터 처리 파이프라인 최적화해줘"

# 전문 분야
- 파이썬 언어 전문
- 데이터 처리
- 라이브러리 활용
```

#### `@agent-refactoring-expert` - 리팩토링 전문가
```bash
# 사용법
@agent-refactoring-expert "레거시 코드 개선해줘"

# 전문 분야
- 코드 품질 개선
- 구조적 리팩토링
- 기술 부채 해결
```

### 🤔 자동 활성화
에이전트는 자동으로도 활성화됩니다:
```bash
# 예시: 이렇게 말하면 자동으로 보안 엔지니어가 활성화
/sc:implement "JWT 인증" → security-engineer 자동 활성화

# 예시: 이렇게 말하면 자동으로 프론트엔드 아키텍트가 활성화
/sc:design "React 대시보드" → frontend-architect 자동 활성화
```

---

## 플래그와 옵션

### 🧠 분석 깊이 플래그

#### `--think` - 기본 분석
```bash
# 사용법
/sc:analyze src/ --think

# 특징
- 토큰: ~4,000개
- 시간: 빠름
- 깊이: 기본적인 분석
```

#### `--think-hard` - 심층 분석
```bash
# 사용법
/sc:analyze src/ --think-hard

# 특징
- 토큰: ~10,000개
- 시간: 보통
- 깊이: 상세한 분석
```

#### `--ultrathink` - 최대 깊이 분석
```bash
# 사용법
/sc:analyze src/ --ultrathink

# 특징
- 토큰: ~32,000개
- 시간: 느림
- 깊이: 매우 상세한 분석
```

### 🛠️ MCP 서버 플래그

#### `--c7` 또는 `--context7` - 공식 문서 활용
```bash
# 사용법
/sc:implement "React 컴포넌트" --c7

# 언제 사용?
- React, Vue, Angular 등 프레임워크 사용할 때
- 공식 문서의 패턴을 따르고 싶을 때
```

#### `--magic` - UI 컴포넌트 생성
```bash
# 사용법
/sc:implement "로그인 폼" --magic

# 언제 사용?
- 버튼, 폼, 모달 등 UI 컴포넌트 만들 때
- 21st.dev의 현대적 패턴 사용하고 싶을 때
```

#### `--seq` 또는 `--sequential` - 단계별 추론
```bash
# 사용법
/sc:troubleshoot "복잡한 버그" --seq

# 언제 사용?
- 복잡한 문제를 단계별로 해결하고 싶을 때
- 체계적인 분석이 필요할 때
```

### ⚙️ 실행 제어 플래그

#### `--safe-mode` - 안전 모드
```bash
# 사용법
/sc:improve src/ --safe-mode

# 특징
- 최대한 보수적으로 실행
- 위험한 변경 사항 차단
- 프로덕션 환경에서 추천
```

#### `--loop` - 반복 개선
```bash
# 사용법
/sc:improve "성능 최적화" --loop

# 특징
- 여러 번 반복해서 개선
- 점진적 향상
- 품질 향상에 효과적
```

#### `--validate` - 사전 검증
```bash
# 사용법
/sc:implement "결제 시스템" --validate

# 특징
- 실행 전 위험도 평가
- 안전성 확인
- 중요한 작업에 추천
```

### 🎯 타겟 지정 플래그

#### `--type` - 작업 유형 지정
```bash
# 사용법
/sc:implement "인증" --type backend
/sc:analyze . --type security
/sc:improve src/ --type performance

# 옵션
- frontend, backend, fullstack
- security, performance, quality
- unit, integration, e2e
```

#### `--focus` - 집중 영역 지정
```bash
# 사용법
/sc:analyze src/ --focus security
/sc:improve . --focus performance

# 옵션
- performance, security, quality
- architecture, accessibility, testing
```

### 💡 추천 플래그 조합

#### 프론트엔드 개발
```bash
/sc:implement "사용자 대시보드" --magic --c7
```

#### 백엔드 개발
```bash
/sc:implement "API 서버" --seq --think --focus security
```

#### 대규모 프로젝트
```bash
/sc:analyze . --ultrathink --all-mcp --safe-mode
```

#### 품질 개선
```bash
/sc:improve src/ --type quality --safe --loop --validate
```

---

## 실전 활용 예시

### 🚀 프로젝트 시작하기

#### 1단계: 아이디어 구체화
```bash
/sc:brainstorm "온라인 도서 관리 서비스"
```
**결과**: 상세한 요구사항과 기능 목록 생성

#### 2단계: 아키텍처 설계
```bash
@agent-system-architect "도서 관리 서비스 전체 아키텍처 설계해줘"
```
**결과**: 시스템 구조도와 기술 스택 추천

#### 3단계: 기능별 구현
```bash
/sc:implement "사용자 인증 시스템" --type backend --focus security
/sc:implement "도서 검색 UI" --magic --c7
```
**결과**: 실제 동작하는 코드 생성

### 🔍 코드 품질 관리

#### 전체 코드 분석
```bash
/sc:analyze . --think-hard --focus quality
```

#### 보안 검토
```bash
@agent-security-engineer "전체 시스템 보안 검토해줘"
```

#### 성능 최적화
```bash
/sc:improve src/ --type performance --loop
```

#### 테스트 추가
```bash
/sc:test --coverage --type integration
```

### 💼 비즈니스 전략 수립

#### 시장 분석
```bash
/sc:business-panel "도서 관리 앱 시장 분석" --mode discussion
```

#### 경쟁사 분석
```bash
/sc:business-panel @competitor_analysis.pdf --mode debate
```

#### 전략적 의사결정
```bash
/sc:business-panel "유료 모델 vs 광고 모델" --mode socratic
```

### 🛠️ 문제 해결 과정

#### 버그 발견 시
```bash
/sc:troubleshoot "로그인 후 대시보드가 안 떠요"
```

#### 근본 원인 분석
```bash
@agent-root-cause-analyst "사용자 로그인 실패율이 높아지고 있어요"
```

#### 체계적 해결
```bash
/sc:implement "로그인 시스템 개선" --validate --safe-mode
```

### 📚 학습과 연구

#### 기술 동향 파악
```bash
/sc:research "2024년 웹 개발 트렌드" --depth deep
```

#### 심층 분석
```bash
@agent-deep-research-agent "GraphQL vs REST API 완전 비교"
```

#### 프레임워크 비교
```bash
/sc:business-panel "Next.js vs Nuxt.js 선택 기준" --experts "porter,christensen"
```

---

## 자주 묻는 질문

### ❓ 기본 사용법

**Q: SuperClaude 명령어를 어디서 입력하나요?**
A: Claude Code 채팅창에서 입력합니다. 터미널이 아니에요.

**Q: /sc:help가 안 되는데요?**
A: SuperClaude가 제대로 설치되지 않았을 수 있습니다. ~/.claude/ 폴더를 확인해보세요.

**Q: 명령어를 잘못 입력했어요.**
A: 괜찮습니다. 다시 입력하면 됩니다. Claude가 명령어를 알아서 해석해줍니다.

### ❓ 고급 사용법

**Q: 여러 플래그를 함께 사용할 수 있나요?**
A: 네, 가능합니다. 예: `/sc:analyze . --think-hard --focus security --safe-mode`

**Q: 에이전트와 명령어를 함께 쓸 수 있나요?**
A: 네, 가능합니다. 예: `/sc:implement "API" --type backend` 후에 `@agent-security-engineer "보안 검토"`

**Q: 어떤 명령어를 언제 써야 하나요?**
A:
- 프로젝트 시작: `/sc:brainstorm`
- 코드 작성: `/sc:implement`
- 문제 해결: `/sc:troubleshoot`
- 코드 개선: `/sc:improve`
- 전문 상담: `@agent-전문가이름`

### ❓ 문제 해결

**Q: 명령어가 너무 오래 걸려요.**
A: `--quick` 플래그를 사용하거나 더 구체적인 요청을 해보세요.

**Q: 결과가 만족스럽지 않아요.**
A: `--think-hard`나 `--ultrathink` 플래그로 더 깊은 분석을 요청해보세요.

**Q: 에러가 났어요.**
A: `/sc:troubleshoot "에러 내용"`으로 해결 방법을 찾아보세요.

### ❓ 최적화

**Q: 어떤 플래그 조합이 가장 좋나요?**
A: 작업에 따라 다릅니다:
- 프론트엔드: `--magic --c7`
- 백엔드: `--seq --think`
- 품질 개선: `--safe-mode --validate`
- 빠른 작업: `--quick`

**Q: 토큰을 절약하고 싶어요.**
A: `--token-efficient` 플래그를 사용하세요.

**Q: 더 정확한 결과를 원해요.**
A: `--ultrathink --validate` 조합을 사용하세요.

---

## 📞 추가 도움말

### 🔗 유용한 명령어 조합
```bash
# 프로젝트 전체 분석
/sc:analyze . --think-hard --all-mcp

# 안전한 코드 개선
/sc:improve src/ --safe-mode --validate --preview

# 전문가 협업
/sc:business-panel "전략 검토" --mode debate --experts "porter,collins"

# 빠른 프로토타입
/sc:implement "MVP" --magic --quick
```

### 💡 효과적인 사용 팁
1. **구체적으로 요청하세요**: "웹사이트 만들어줘" 보다는 "온라인 도서관 관리 시스템"
2. **단계별로 진행하세요**: brainstorm → implement → test → improve
3. **적절한 플래그를 사용하세요**: 상황에 맞는 플래그로 결과 품질 향상
4. **에이전트를 활용하세요**: 전문 분야는 해당 전문가에게 맡기기

### 🎯 성공 사례 패턴
```bash
# 성공적인 프로젝트 진행 순서
1. /sc:brainstorm "아이디어"
2. @agent-system-architect "아키텍처 설계"
3. /sc:implement "핵심 기능" --validate
4. /sc:test --coverage
5. /sc:improve . --type quality
6. @agent-security-engineer "보안 검토"
```

---

**📝 마지막 한마디**

SuperClaude는 단순한 명령어 모음이 아니라 **개발 방식을 바꾸는 도구**입니다. 처음에는 복잡해 보일 수 있지만, 몇 번 사용해보면 개발이 훨씬 체계적이고 효율적으로 바뀐다는 걸 느끼실 거예요.

가장 중요한 건 **실제로 써보는 것**입니다. `/sc:help`부터 시작해서 하나씩 천천히 익혀나가세요!

*"완벽한 도구는 없지만, 적절한 도구를 적절한 때에 사용하는 것이 전문가의 길입니다."*

---

**📚 문서 버전 관리**
- v1.0 (2025-01-24): 초기 버전 작성
- 향후 업데이트는 이 섹션에 기록됩니다.