/**
 * 라우트 레벨 코드 스플리팅 유틸리티
 * Context7 Next.js 15 패턴 기반 구현
 */

import { ComponentType, lazy } from 'react'

/**
 * 라우트별 동적 로딩 설정
 */
export interface RouteConfig {
  path: string
  component: () => Promise<{ default: ComponentType<any> }>
  preload?: boolean
  critical?: boolean
  chunkName?: string
}

/**
 * 라우트 기반 코드 스플리팅 매니저
 */
export class RouteSplittingManager {
  private routes = new Map<string, RouteConfig>()
  private preloadedRoutes = new Set<string>()
  private criticalRoutes = new Set<string>()

  /**
   * 라우트 등록
   */
  registerRoute(config: RouteConfig) {
    this.routes.set(config.path, config)

    if (config.critical) {
      this.criticalRoutes.add(config.path)
    }
  }

  /**
   * 여러 라우트 일괄 등록
   */
  registerRoutes(configs: RouteConfig[]) {
    configs.forEach(config => this.registerRoute(config))
  }

  /**
   * 라우트 컴포넌트 동적 로딩
   */
  loadRoute(path: string) {
    const config = this.routes.get(path)
    if (!config) {
      throw new Error(`Route not found: ${path}`)
    }

    return lazy(config.component)
  }

  /**
   * 라우트 프리로딩
   */
  async preloadRoute(path: string) {
    if (this.preloadedRoutes.has(path)) {
      return
    }

    const config = this.routes.get(path)
    if (!config) {
      return
    }

    try {
      await config.component()
      this.preloadedRoutes.add(path)
    } catch (error) {
      console.error(`Failed to preload route: ${path}`, error)
    }
  }

  /**
   * 크리티컬 라우트들 프리로딩
   */
  async preloadCriticalRoutes() {
    const preloadPromises = Array.from(this.criticalRoutes).map(path =>
      this.preloadRoute(path)
    )

    await Promise.all(preloadPromises)
  }

  /**
   * 사용자 인터랙션 기반 지능형 프리로딩
   */
  enableIntelligentPreloading() {
    // 마우스 호버시 프리로딩
    document.addEventListener('mouseover', (e) => {
      const link = (e.target as Element)?.closest('a[href]') as HTMLAnchorElement
      if (link) {
        const path = link.getAttribute('href')
        if (path && this.routes.has(path)) {
          this.preloadRoute(path)
        }
      }
    })

    // 뷰포트 진입시 프리로딩 (Intersection Observer)
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const link = entry.target as HTMLAnchorElement
          const path = link.getAttribute('href')
          if (path && this.routes.has(path)) {
            this.preloadRoute(path)
          }
        }
      })
    }, { threshold: 0.1 })

    // 링크들 관찰 시작
    document.querySelectorAll('a[href]').forEach(link => {
      observer.observe(link)
    })
  }
}

/**
 * 글로벌 라우트 스플리팅 매니저 인스턴스
 */
export const routeManager = new RouteSplittingManager()

/**
 * 기본 라우트 설정들
 */
export const defaultRouteConfigs: RouteConfig[] = [
  // 크리티컬 라우트들 (즉시 로딩)
  {
    path: '/',
    component: () => import('@/app/page'),
    critical: true,
    chunkName: 'page-home'
  },
  {
    path: '/posts',
    component: () => import('@/app/posts/page'),
    critical: true,
    chunkName: 'page-posts'
  },

  // 인증 관련
  {
    path: '/auth/login',
    component: () => import('@/app/(auth)/login/page'),
    preload: false,
    chunkName: 'page-auth-login'
  },
  {
    path: '/auth/register',
    component: () => import('@/app/(auth)/register/page'),
    preload: false,
    chunkName: 'page-auth-register'
  },

  // 사용자 영역
  {
    path: '/profile',
    component: () => import('@/app/profile/page'),
    preload: true,
    chunkName: 'page-profile'
  },

  // 채팅 (실시간 기능)
  {
    path: '/chat',
    component: () => import('@/app/chat/page'),
    preload: false,
    chunkName: 'page-chat'
  },

  // 관리자 영역 (역할 기반 로딩)
  {
    path: '/admin-panel',
    component: () => import('@/app/admin-panel/page'),
    preload: false,
    chunkName: 'page-admin'
  },

  // 설정 페이지
  {
    path: '/settings',
    component: () => import('@/app/settings/page'),
    preload: false,
    chunkName: 'page-settings'
  },

  // 검색 결과
  {
    path: '/search',
    component: () => import('@/app/search/page'),
    preload: false,
    chunkName: 'page-search'
  },

  // 컬렉션
  {
    path: '/collections',
    component: () => import('@/app/collections/page'),
    preload: false,
    chunkName: 'page-collections'
  }
]

/**
 * 컴포넌트 레벨 코드 스플리팅
 */
export const createDynamicComponent = <T = any>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  options: {
    loading?: ComponentType
    error?: ComponentType<{ error: Error; retry: () => void }>
    chunkName?: string
    preload?: boolean
  } = {}
) => {
  const Component = lazy(importFn)

  // 프리로딩 옵션이 활성화된 경우
  if (options.preload && typeof window !== 'undefined') {
    // 유휴 시간에 프리로딩
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => importFn())
    } else {
      // requestIdleCallback 미지원시 setTimeout 사용
      setTimeout(() => importFn(), 100)
    }
  }

  return Component
}

/**
 * 사용자 역할 기반 동적 로딩
 */
export const createRoleBasedComponent = <T = any>(
  roleComponents: Record<string, () => Promise<{ default: ComponentType<T> }>>,
  userRole: string,
  fallbackComponent?: () => Promise<{ default: ComponentType<T> }>
) => {
  const importFn = roleComponents[userRole] || fallbackComponent

  if (!importFn) {
    throw new Error(`No component found for role: ${userRole}`)
  }

  return lazy(importFn)
}

/**
 * 기능 플래그 기반 동적 로딩
 */
export const createFeatureFlagComponent = <T = any>(
  featureComponents: Record<string, () => Promise<{ default: ComponentType<T> }>>,
  enabledFeatures: string[],
  defaultComponent: () => Promise<{ default: ComponentType<T> }>
) => {
  // 활성화된 기능 중 우선순위가 높은 컴포넌트 선택
  for (const feature of enabledFeatures) {
    if (featureComponents[feature]) {
      return lazy(featureComponents[feature])
    }
  }

  return lazy(defaultComponent)
}

/**
 * 디바이스 타입 기반 동적 로딩
 */
export const createResponsiveComponent = <T = any>(
  components: {
    mobile?: () => Promise<{ default: ComponentType<T> }>
    tablet?: () => Promise<{ default: ComponentType<T> }>
    desktop: () => Promise<{ default: ComponentType<T> }>
  }
) => {
  if (typeof window === 'undefined') {
    return lazy(components.desktop)
  }

  const width = window.innerWidth

  if (width < 768 && components.mobile) {
    return lazy(components.mobile)
  }

  if (width < 1024 && components.tablet) {
    return lazy(components.tablet)
  }

  return lazy(components.desktop)
}

/**
 * 번들 크기 분석 헬퍼
 */
export const analyzeBundleSize = async (
  componentImport: () => Promise<any>
) => {
  const start = performance.now()
  const module = await componentImport()
  const end = performance.now()

  console.log(`Bundle load time: ${end - start}ms`)

  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.name.includes('chunk')) {
          console.log(`Chunk load time: ${entry.duration}ms`)
        }
      })
    })
    observer.observe({ entryTypes: ['navigation', 'resource'] })
  }

  return module
}

/**
 * 라우트 매니저 초기화
 */
export const initializeRouteSplitting = () => {
  // 기본 라우트들 등록
  routeManager.registerRoutes(defaultRouteConfigs)

  // 크리티컬 라우트들 프리로딩
  if (typeof window !== 'undefined') {
    routeManager.preloadCriticalRoutes()

    // 지능형 프리로딩 활성화
    document.addEventListener('DOMContentLoaded', () => {
      routeManager.enableIntelligentPreloading()
    })
  }
}