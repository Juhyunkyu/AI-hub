# 전통적 Playwright 설치 및 사용법 가이드

**환경**: Windows 10 + WSL2 (Ubuntu 20.04) + X11 (VcXsrv)
**목적**: 자동화된 테스트 스크립트 작성 및 CI/CD 통합
**작성일**: 2025-01-18

---

## 📋 목차

- [1. 사전 준비사항](#1-사전-준비사항)
- [2. Playwright 설치](#2-playwright-설치)
- [3. 설정 파일 작성](#3-설정-파일-작성)
- [4. 테스트 작성법](#4-테스트-작성법)
- [5. 실행 및 디버깅](#5-실행-및-디버깅)
- [6. 고급 기능](#6-고급-기능)
- [7. CI/CD 통합](#7-cicd-통합)
- [8. 문제 해결](#8-문제-해결)

---

## 1. 사전 준비사항

### 🖥️ Windows 10 환경 준비

#### VcXsrv 설치 및 설정
```bash
# Windows에서:
1. VcXsrv 다운로드 및 설치
2. XLaunch 실행
3. 설정: Multiple windows → Native opengl → Clipboard 허용
4. "Disable access control" 체크 (중요!)
```

#### WSL2 환경변수 설정
```bash
# ~/.bashrc에 추가
echo 'export DISPLAY=$(awk "/nameserver / {print $2; exit}" /etc/resolv.conf):0' >> ~/.bashrc
echo 'export LIBGL_ALWAYS_INDIRECT=1' >> ~/.bashrc
source ~/.bashrc

# 연결 확인
sudo apt install -y x11-apps
xclock  # Windows에 시계가 뜨면 성공
```

---

## 2. Playwright 설치

### 📦 기본 설치

```bash
# 프로젝트 폴더 생성
mkdir my-playwright-project
cd my-playwright-project

# Node.js 프로젝트 초기화
npm init -y

# Playwright 설치
npm i -D @playwright/test

# 브라우저 설치
npx playwright install

# 시스템 의존성 설치 (sudo 필요)
sudo apt-get install -y \
    libcups2 libxkbcommon0 libxdamage1 libcairo2 \
    libpango-1.0-0 libgtk-3-0 libgconf-2-4 \
    libnss3 libxss1 libasound2

# WebKit 추가 의존성 (선택사항)
sudo apt-get install -y \
    libwoff1 libopus0 libwebp6 libwebpdemux2 \
    libenchant-2-2 libsecret-1-0 libhyphen0 \
    libegl1 libevdev2 libgles2 libharfbuzz-icu0 \
    libwebpmux3 x264
```

### ✅ 설치 확인

```bash
# Playwright 버전 확인
npx playwright --version

# 설치된 브라우저 확인
npx playwright install --dry-run

# 간단한 테스트 실행
npx playwright test --help
```

---

## 3. 설정 파일 작성

### ⚙️ playwright.config.js

```javascript
// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  // 테스트 파일 디렉토리
  testDir: './tests',

  // 병렬 실행 설정
  fullyParallel: true,

  // CI 환경에서 test.only 방지
  forbidOnly: !!process.env.CI,

  // 재시도 설정
  retries: process.env.CI ? 2 : 0,

  // 워커 수 설정
  workers: process.env.CI ? 1 : undefined,

  // 리포터 설정
  reporter: [
    ['html'],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['junit', { outputFile: 'playwright-report/results.xml' }]
  ],

  // 글로벌 설정
  use: {
    // 기본 URL
    baseURL: 'http://localhost:3000',

    // 스크린샷 설정
    screenshot: 'only-on-failure',

    // 비디오 설정
    video: 'retain-on-failure',

    // 트레이스 설정
    trace: 'retain-on-failure',

    // 뷰포트 설정
    viewport: { width: 1280, height: 720 },

    // 타임아웃 설정
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  // 브라우저 프로젝트 설정
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // headed 모드 설정 (개발 시)
        headless: process.env.CI ? true : false,
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        headless: process.env.CI ? true : false,
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        headless: process.env.CI ? true : false,
      },
    },

    // 모바일 브라우저 (선택사항)
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // 개발 서버 자동 시작
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

### 📁 폴더 구조

```
my-playwright-project/
├── tests/                    # 테스트 파일
│   ├── auth/                 # 인증 관련 테스트
│   ├── api/                  # API 테스트
│   ├── e2e/                  # End-to-End 테스트
│   └── utils/                # 테스트 유틸리티
├── playwright.config.js      # Playwright 설정
├── package.json              # 프로젝트 설정
└── README.md                 # 프로젝트 문서
```

---

## 4. 테스트 작성법

### 🧪 기본 테스트 구조

```javascript
// tests/example.spec.js
const { test, expect } = require('@playwright/test');

test.describe('기본 테스트 그룹', () => {

  // 각 테스트 전 실행
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('페이지 제목 확인', async ({ page }) => {
    await expect(page).toHaveTitle(/Expected Title/);
  });

  test('네비게이션 테스트', async ({ page }) => {
    // 클릭 이벤트
    await page.click('text=로그인');

    // URL 확인
    await expect(page).toHaveURL(/.*login/);

    // 요소 확인
    await expect(page.locator('h1')).toHaveText('로그인');
  });
});
```

### 🔐 인증 테스트 예제

```javascript
// tests/auth/login.spec.js
const { test, expect } = require('@playwright/test');

test.describe('로그인 기능', () => {

  test('성공적인 로그인', async ({ page }) => {
    await page.goto('/login');

    // 폼 입력
    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'password123');

    // 제출
    await page.click('button[type="submit"]');

    // 성공 확인
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('.welcome-message')).toBeVisible();
  });

  test('잘못된 자격증명', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrongpass');
    await page.click('button[type="submit"]');

    // 에러 메시지 확인
    await expect(page.locator('.error-message')).toHaveText('잘못된 자격증명입니다');
  });

  test('소셜 로그인', async ({ page }) => {
    await page.goto('/login');

    // Google 로그인 버튼 클릭
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('text=Google로 로그인')
    ]);

    // 팝업에서 로그인 처리 (테스트 환경에서)
    await popup.waitForLoadState();
    // ... 소셜 로그인 플로우
  });
});
```

### 📝 폼 테스트 예제

```javascript
// tests/forms/contact.spec.js
const { test, expect } = require('@playwright/test');

test.describe('연락처 폼', () => {

  test('폼 제출 성공', async ({ page }) => {
    await page.goto('/contact');

    // 필수 필드 입력
    await page.fill('input[name="name"]', '홍길동');
    await page.fill('input[name="email"]', 'hong@example.com');
    await page.fill('textarea[name="message"]', '문의 내용입니다.');

    // 파일 업로드 (선택사항)
    await page.setInputFiles('input[type="file"]', 'tests/fixtures/sample.pdf');

    // 체크박스 선택
    await page.check('input[name="agree"]');

    // 드롭다운 선택
    await page.selectOption('select[name="category"]', 'general');

    // 제출
    await page.click('button[type="submit"]');

    // 성공 메시지 확인
    await expect(page.locator('.success-message')).toBeVisible();
  });

  test('필수 필드 검증', async ({ page }) => {
    await page.goto('/contact');

    // 빈 폼 제출
    await page.click('button[type="submit"]');

    // 검증 메시지 확인
    await expect(page.locator('.field-error')).toHaveCount(3);
  });
});
```

### 🔄 API 테스트 예제

```javascript
// tests/api/posts.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Posts API', () => {

  test('게시물 목록 조회', async ({ request }) => {
    const response = await request.get('/api/posts');

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const posts = await response.json();
    expect(posts).toHaveProperty('data');
    expect(posts.data.length).toBeGreaterThan(0);
  });

  test('게시물 생성', async ({ request }) => {
    const newPost = {
      title: '테스트 게시물',
      content: '테스트 내용',
      author: 'testuser'
    };

    const response = await request.post('/api/posts', {
      data: newPost
    });

    expect(response.ok()).toBeTruthy();

    const created = await response.json();
    expect(created.data.title).toBe(newPost.title);
  });
});
```

---

## 5. 실행 및 디버깅

### 🚀 기본 실행 명령어

```bash
# 전체 테스트 실행
npx playwright test

# 특정 브라우저만
npx playwright test --project=chromium

# 여러 브라우저 동시
npx playwright test --project=chromium --project=firefox

# 특정 파일
npx playwright test tests/auth/login.spec.js

# 특정 테스트만
npx playwright test --grep "로그인"

# headed 모드 (브라우저 창 보기)
npx playwright test --headed

# 디버그 모드
npx playwright test --debug

# UI 모드 (GUI 테스트 러너)
npx playwright test --ui
```

### 🔍 고급 실행 옵션

```bash
# 병렬 실행 워커 수 조정
npx playwright test --workers=4

# 특정 태그 실행
npx playwright test --grep "@smoke"

# 특정 태그 제외
npx playwright test --grep-invert "@slow"

# 실패한 테스트만 재실행
npx playwright test --last-failed

# 업데이트된 스냅샷
npx playwright test --update-snapshots

# 최대 실패 수 제한
npx playwright test --max-failures=3

# 리포터 지정
npx playwright test --reporter=json
```

### 🐛 디버깅 기법

```javascript
// 테스트 일시 정지
await page.pause();

// 스크린샷 촬영
await page.screenshot({ path: 'debug.png' });

// 페이지 HTML 저장
const html = await page.content();
console.log(html);

// 네트워크 요청 모니터링
page.on('request', request => {
  console.log('Request:', request.url());
});

page.on('response', response => {
  console.log('Response:', response.url(), response.status());
});

// 콘솔 메시지 캡처
page.on('console', msg => {
  console.log('Console:', msg.text());
});
```

---

## 6. 고급 기능

### 📸 비주얼 테스팅

```javascript
// 스크린샷 비교
test('비주얼 회귀 테스트', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveScreenshot('dashboard.png');
});

// 특정 요소만 스크린샷
test('버튼 스타일 테스트', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.primary-button')).toHaveScreenshot('button.png');
});
```

### 🎭 Mock 및 Intercept

```javascript
// API 응답 Mock
test('API Mock 테스트', async ({ page }) => {
  // API 응답 인터셉트
  await page.route('/api/users', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ users: [{ id: 1, name: 'Test User' }] })
    });
  });

  await page.goto('/users');
  await expect(page.locator('.user-name')).toHaveText('Test User');
});

// 네트워크 차단
test('오프라인 테스트', async ({ page }) => {
  await page.route('**/*', route => route.abort());
  await page.goto('/offline');
  await expect(page.locator('.offline-message')).toBeVisible();
});
```

### 🏪 상태 관리

```javascript
// 로그인 상태 저장
test.describe('인증된 사용자 테스트', () => {
  test.use({ storageState: 'auth.json' });

  test('대시보드 접근', async ({ page }) => {
    await page.goto('/dashboard');
    // 이미 로그인된 상태
  });
});

// 인증 설정 스크립트
// auth-setup.js
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('/login');
  await page.fill('input[name="email"]', 'user@example.com');
  await page.fill('input[name="password"]', 'password');
  await page.click('button[type="submit"]');

  await page.waitForURL('/dashboard');
  await page.context().storageState({ path: 'auth.json' });

  await browser.close();
})();
```

### 📱 모바일 테스팅

```javascript
// 모바일 뷰포트 테스트
test('모바일 반응형', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/');

  // 모바일 메뉴 테스트
  await page.click('.mobile-menu-toggle');
  await expect(page.locator('.mobile-menu')).toBeVisible();
});

// 터치 이벤트 테스트
test('터치 제스처', async ({ page }) => {
  await page.goto('/gallery');

  // 스와이프 시뮬레이션
  await page.locator('.gallery-item').first().swipe('left');
  await expect(page.locator('.gallery-item').nth(1)).toBeVisible();
});
```

---

## 7. CI/CD 통합

### 🔄 GitHub Actions 설정

```yaml
# .github/workflows/playwright.yml
name: Playwright Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - uses: actions/setup-node@v4
      with:
        node-version: 18

    - name: Install dependencies
      run: npm ci

    - name: Install Playwright Browsers
      run: npx playwright install --with-deps

    - name: Run Playwright tests
      run: npx playwright test

    - name: Upload test results
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 30
```

### 🐳 Docker 설정

```dockerfile
# Dockerfile.playwright
FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

CMD ["npx", "playwright", "test"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  playwright:
    build:
      context: .
      dockerfile: Dockerfile.playwright
    volumes:
      - ./tests:/app/tests
      - ./playwright-report:/app/playwright-report
    environment:
      - CI=true
```

### ⚙️ 환경별 설정

```javascript
// playwright.config.js
const config = {
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
  },

  projects: [
    {
      name: 'staging',
      use: {
        baseURL: 'https://staging.example.com',
      },
    },
    {
      name: 'production',
      use: {
        baseURL: 'https://example.com',
      },
    },
  ],
};
```

---

## 8. 문제 해결

### ❌ 일반적인 문제들

#### 브라우저 실행 실패
```bash
# 문제: browserType.launch 실패
# 해결: 의존성 설치
sudo npx playwright install-deps

# 또는 개별 설치
sudo apt-get install -y libcups2 libxkbcommon0 libxdamage1
```

#### X11 연결 문제
```bash
# 문제: Can't open display
# 해결: DISPLAY 환경변수 확인
echo $DISPLAY

# VcXsrv 재시작 및 설정 확인
# "Disable access control" 체크 필수
```

#### 타임아웃 문제
```javascript
// 타임아웃 늘리기
test('느린 테스트', async ({ page }) => {
  test.setTimeout(60000); // 60초
  await page.goto('/slow-page');
});
```

#### 메모리 문제
```bash
# 워커 수 줄이기
npx playwright test --workers=1

# 병렬 실행 비활성화
npx playwright test --workers=1 --fully-parallel=false
```

### 🔧 성능 최적화

```javascript
// 불필요한 리소스 차단
test.beforeEach(async ({ page }) => {
  await page.route('**/*.{png,jpg,jpeg,gif,svg}', route => route.abort());
  await page.route('**/*.{css}', route => route.abort());
});

// 재사용 가능한 브라우저 컨텍스트
const { chromium } = require('@playwright/test');

let browser;
let context;

test.beforeAll(async () => {
  browser = await chromium.launch();
  context = await browser.newContext();
});

test.afterAll(async () => {
  await context.close();
  await browser.close();
});
```

### 📊 리포팅 개선

```javascript
// 커스텀 리포터
class CustomReporter {
  onTestResult(test, result) {
    if (result.status === 'failed') {
      console.log(`❌ ${test.title}: ${result.error?.message}`);
    } else if (result.status === 'passed') {
      console.log(`✅ ${test.title}`);
    }
  }
}

module.exports = CustomReporter;
```

---

## 📚 참고 자료

- [Playwright 공식 문서](https://playwright.dev/)
- [Playwright GitHub](https://github.com/microsoft/playwright)
- [Best Practices Guide](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
- [Community Examples](https://github.com/mxschmitt/awesome-playwright)

---

**작성자 노트**: 이 가이드는 실제 프로덕션 환경에서 검증된 설정과 패턴들을 기반으로 작성되었습니다. 프로젝트 요구사항에 맞게 조정하여 사용하시기 바랍니다.