import { defineConfig, devices } from '@playwright/test'
import { AxeMatchers } from '@axe-core/playwright'
import path from 'path'

/**
 * Production-grade E2E testing configuration for AI Knowledge Hub
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

  /* Enhanced reporting with comprehensive coverage */
  reporter: [
    ['html', {
      open: 'never',
      outputFolder: 'test-results/html-report'
    }],
    ['json', {
      outputFile: 'test-results/results.json'
    }],
    ['junit', {
      outputFile: 'test-results/results.xml'
    }],
    ['line'],
    // Custom reporter for performance metrics
    ['./tests/utils/performance-reporter.ts']
  ],

  /* Enhanced shared settings for comprehensive testing */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Enhanced tracing for debugging */
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',

    /* Browser context options - 더 큰 뷰포트로 실제 브라우저 환경에 가깝게 */
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,

    /* Extended timeouts for real-time features */
    actionTimeout: 15000,
    navigationTimeout: 30000,

    /* Enhanced permissions for comprehensive testing */
    javaScriptEnabled: true,
    permissions: ['notifications', 'clipboard-read', 'clipboard-write'],

    /* Enhanced browser features */
    hasTouch: false,
    isMobile: false,

    /* Locale and timezone for consistent testing */
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',

    /* Extra HTTP headers for API testing */
    extraHTTPHeaders: {
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
    }
  },

  /* Comprehensive cross-browser and device testing */
  projects: [
    // Desktop browsers
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 1920, height: 1080 }
      }
    },
    {
      name: 'firefox-desktop',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 }
      }
    },
    {
      name: 'webkit-desktop',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      }
    },

    // Tablet testing
    {
      name: 'tablet-chrome',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 768 }
      }
    },

    // Mobile testing
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 393, height: 851 }
      }
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 390, height: 844 }
      }
    },

    // Accessibility testing with high contrast
    {
      name: 'accessibility-desktop',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 1920, height: 1080 },
        colorScheme: 'dark',
        forcedColors: 'active'
      }
    },

    // Performance testing on lower-end devices
    {
      name: 'performance-mobile',
      use: {
        ...devices['Galaxy S9+'],
        launchOptions: {
          slowMo: 100  // Simulate slower device
        }
      }
    }
  ],

  /* Enhanced web server configuration */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2분
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      NODE_ENV: 'test',
      NEXT_TELEMETRY_DISABLED: '1'
    }
  },

  /* Enhanced timeout configuration */
  timeout: 60 * 1000, // 1분 (실시간 기능 테스트용)
  expect: {
    timeout: 10000,  // 증가된 expect timeout
    toHaveScreenshot: {
      threshold: 0.2,
      maxDiffPixels: 1000
    },
    toMatchSnapshot: {
      threshold: 0.2
    }
  },

  /* Output directory for test artifacts */
  outputDir: 'test-results/artifacts',

  /* Enhanced test match patterns */
  testMatch: /.*\.(e2e|integration)\.spec\.ts/,
  testIgnore: /.*\.skip\.spec\.ts/,

  /* Enhanced global setup and teardown */
  globalSetup: require.resolve('./tests/utils/global-setup.ts'),
  globalTeardown: require.resolve('./tests/utils/global-teardown.ts'),

  /* Test metadata for reporting */
  metadata: {
    testType: 'e2e',
    environment: process.env.NODE_ENV || 'test',
    buildId: process.env.BUILD_ID || 'local',
    browser: 'multi-browser'
  }

})