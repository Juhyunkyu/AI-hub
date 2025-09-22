'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  createImageLoadingState,
  getImageMetadata,
  validateImageUrl,
  type ImageLoadingState,
  type ImageMetadata
} from '@/lib/image-utils'

interface UseOptimizedImageOptions {
  src: string
  preload?: boolean
  onLoad?: () => void
  onError?: (error: Error) => void
}

interface UseOptimizedImageReturn extends ImageLoadingState {
  metadata: ImageMetadata | null
  preloadImage: () => void
  resetState: () => void
}

/**
 * 최적화된 이미지 로딩을 위한 커스텀 훅
 * Context7 패턴 기반으로 구현
 */
export function useOptimizedImage({
  src,
  preload = false,
  onLoad,
  onError
}: UseOptimizedImageOptions): UseOptimizedImageReturn {
  const [state, setState] = useState<ImageLoadingState>(createImageLoadingState)
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null)

  const resetState = useCallback(() => {
    setState(createImageLoadingState())
    setMetadata(null)
  }, [])

  const preloadImage = useCallback(() => {
    if (!validateImageUrl(src)) {
      const error = new Error('Invalid image URL')
      setState(prev => ({ ...prev, isLoading: false, hasError: true }))
      onError?.(error)
      return
    }

    setState(prev => ({ ...prev, isLoading: true, hasError: false }))

    const img = new Image()

    img.onload = () => {
      setState({
        isLoading: false,
        hasError: false,
        isLoaded: true
      })

      setMetadata({
        width: img.naturalWidth,
        height: img.naturalHeight,
        format: src.split('.').pop()?.toLowerCase()
      })

      onLoad?.()
    }

    img.onerror = () => {
      const error = new Error(`Failed to load image: ${src}`)
      setState({
        isLoading: false,
        hasError: true,
        isLoaded: false
      })
      onError?.(error)
    }

    img.src = src
  }, [src, onLoad, onError])

  // preload가 true이거나 src가 변경되면 이미지 로드
  useEffect(() => {
    if (preload && src) {
      preloadImage()
    }
  }, [preload, src, preloadImage])

  // src 변경시 상태 리셋
  useEffect(() => {
    resetState()
  }, [src, resetState])

  return {
    ...state,
    metadata,
    preloadImage,
    resetState
  }
}

/**
 * 여러 이미지를 병렬로 프리로드하는 훅
 */
export function useImagePreloader(urls: string[]) {
  const [loadedCount, setLoadedCount] = useState(0)
  const [isPreloading, setIsPreloading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const preloadImages = useCallback(async () => {
    if (!urls.length) return

    setIsPreloading(true)
    setLoadedCount(0)
    setErrors([])

    const promises = urls.map((url) => {
      return new Promise<void>((resolve) => {
        const img = new Image()

        img.onload = () => {
          setLoadedCount(prev => prev + 1)
          resolve()
        }

        img.onerror = () => {
          setErrors(prev => [...prev, url])
          setLoadedCount(prev => prev + 1)
          resolve()
        }

        img.src = url
      })
    })

    await Promise.all(promises)
    setIsPreloading(false)
  }, [urls])

  useEffect(() => {
    preloadImages()
  }, [preloadImages])

  return {
    loadedCount,
    totalCount: urls.length,
    isComplete: loadedCount === urls.length,
    isPreloading,
    errors,
    progress: urls.length ? (loadedCount / urls.length) * 100 : 0
  }
}

/**
 * 반응형 이미지 크기를 계산하는 훅
 */
export function useResponsiveImageSize(
  baseWidth: number,
  breakpoints: { [key: string]: number } = {
    '640px': 100,   // 모바일: 100% 너비
    '1024px': 50,   // 태블릿: 50% 너비
    '1920px': 33    // 데스크톱: 33% 너비
  }
) {
  const [currentSize, setCurrentSize] = useState(baseWidth)
  const [sizes, setSizes] = useState('')

  useEffect(() => {
    // breakpoints를 기반으로 sizes 문자열 생성
    const sizesArray = Object.entries(breakpoints)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([breakpoint, percentage]) =>
        `(max-width: ${breakpoint}) ${percentage}vw`
      )

    setSizes(sizesArray.join(', '))

    // 현재 뷰포트에 맞는 크기 계산
    const updateSize = () => {
      const viewportWidth = window.innerWidth

      for (const [breakpoint, percentage] of Object.entries(breakpoints)) {
        if (viewportWidth <= parseInt(breakpoint)) {
          setCurrentSize((viewportWidth * percentage) / 100)
          break
        }
      }
    }

    if (typeof window !== 'undefined') {
      updateSize()
      window.addEventListener('resize', updateSize)
      return () => window.removeEventListener('resize', updateSize)
    }
  }, [baseWidth, breakpoints])

  return {
    currentSize: Math.round(currentSize),
    sizes
  }
}

/**
 * 이미지 지연 로딩을 위한 Intersection Observer 훅
 */
export function useImageLazyLoading(threshold = 0.1) {
  const [isInView, setIsInView] = useState(false)
  const [ref, setRef] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!ref) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.unobserve(ref) // 한 번 보이면 관찰 중단
        }
      },
      { threshold }
    )

    observer.observe(ref)

    return () => {
      if (ref) observer.unobserve(ref)
    }
  }, [ref, threshold])

  return { ref: setRef, isInView }
}