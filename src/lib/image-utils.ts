/**
 * 이미지 최적화 유틸리티 함수들
 * Context7 Next.js 15 패턴 기반으로 구현
 */

// Supabase 이미지 로더 (커스텀 로더)
export function supabaseImageLoader({
  src,
  width,
  quality
}: {
  src: string
  width: number
  quality?: number
}) {
  const url = new URL(src)
  url.searchParams.set('width', width.toString())
  url.searchParams.set('quality', (quality || 75).toString())
  url.searchParams.set('format', 'auto')
  return url.href
}

// 이미지 크기별 responsive sizes 생성
export function generateImageSizes(breakpoints: { [key: string]: string }): string {
  const entries = Object.entries(breakpoints)
  return entries
    .map(([breakpoint, size]) => `(max-width: ${breakpoint}) ${size}`)
    .join(', ')
}

// 기본 responsive sizes 설정
export const defaultImageSizes = {
  avatar: '64px',
  thumbnail: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  hero: '100vw',
  card: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px',
  gallery: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 300px'
}

// 이미지 타입별 품질 설정
export const imageQualitySettings = {
  avatar: 90,      // 높은 품질 (작은 크기)
  thumbnail: 75,   // 중간 품질 (중간 크기)
  hero: 85,        // 높은 품질 (큰 크기)
  gallery: 80,     // 중간-높은 품질
  background: 70   // 낮은 품질 (배경용)
}

// 이미지 포맷 감지 및 최적화
export function getOptimizedImageFormat(src: string): {
  format: string
  unoptimized: boolean
} {
  const extension = src.split('.').pop()?.toLowerCase()

  switch (extension) {
    case 'svg':
      return { format: 'svg', unoptimized: true }
    case 'gif':
      return { format: 'gif', unoptimized: true }
    case 'webp':
      return { format: 'webp', unoptimized: false }
    case 'avif':
      return { format: 'avif', unoptimized: false }
    default:
      return { format: 'auto', unoptimized: false }
  }
}

// 플레이스홀더 이미지 생성 (blur-up 효과용)
export function generateBlurDataURL(width: number, height: number, color = '#f3f4f6'): string {
  // SVG 기반 플레이스홀더 생성
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${color}"/>
    </svg>
  `

  const base64 = Buffer.from(svg).toString('base64')
  return `data:image/svg+xml;base64,${base64}`
}

// 이미지 압축 및 리사이징 설정
export const imageOptimizationConfig = {
  // Next.js 15에서 지원하는 최신 포맷
  formats: ['image/avif', 'image/webp'] as const,

  // 디바이스별 크기 (4K, 8K 포함)
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840, 7680],

  // 이미지 크기
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 512],

  // 품질 레벨
  qualities: [25, 50, 75, 90],

  // 캐시 TTL (6개월)
  minimumCacheTTL: 15552000
}

// 이미지 로딩 상태 관리
export interface ImageLoadingState {
  isLoading: boolean
  hasError: boolean
  isLoaded: boolean
}

export function createImageLoadingState(): ImageLoadingState {
  return {
    isLoading: true,
    hasError: false,
    isLoaded: false
  }
}

// 이미지 URL 검증
export function validateImageUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

// 이미지 메타데이터 추출
export interface ImageMetadata {
  width?: number
  height?: number
  format?: string
  size?: number
}

export async function getImageMetadata(src: string): Promise<ImageMetadata | null> {
  try {
    if (typeof window === 'undefined') return null

    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          format: src.split('.').pop()?.toLowerCase()
        })
      }
      img.onerror = () => resolve(null)
      img.src = src
    })
  } catch {
    return null
  }
}

// Context7에서 권장하는 이미지 최적화 설정 템플릿
export const contextSevenImageConfig = {
  // AVIF 우선, WebP 대체, 기본 JPEG/PNG
  formats: ['image/avif', 'image/webp'],

  // 확장된 캐시 TTL (Context7 권장)
  minimumCacheTTL: 15552000, // 6개월

  // 4K/8K 디스플레이 지원
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840, 7680],

  // 다양한 이미지 크기 지원
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 512],

  // 품질 단계별 최적화
  qualities: [25, 50, 75, 90],

  // 정적 이미지 import 최적화
  disableStaticImages: false,

  // SVG 처리 설정
  dangerouslyAllowSVG: false,
  contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
}