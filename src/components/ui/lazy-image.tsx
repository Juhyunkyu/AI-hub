'use client'

import { useState } from 'react'
import { OptimizedImage } from './optimized-image'
import { useImageLazyLoading } from '@/hooks/use-optimized-image'
import { cn } from '@/lib/utils'

interface LazyImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  fill?: boolean
  sizes?: string
  quality?: number
  threshold?: number
  placeholder?: React.ReactNode
  priority?: boolean
}

/**
 * 지연 로딩이 적용된 최적화 이미지 컴포넌트
 * Context7 패턴을 활용한 Intersection Observer 기반 구현
 */
export function LazyImage({
  src,
  alt,
  width,
  height,
  className,
  fill = false,
  sizes,
  quality = 75,
  threshold = 0.1,
  placeholder,
  priority = false,
  ...props
}: LazyImageProps) {
  const { ref, isInView } = useImageLazyLoading(threshold)
  const [isLoaded, setIsLoaded] = useState(false)

  // priority가 true이면 지연 로딩 비활성화
  const shouldLoad = priority || isInView

  const defaultPlaceholder = (
    <div
      className={cn(
        'bg-muted animate-pulse rounded-md flex items-center justify-center',
        className
      )}
      style={fill ? undefined : { width, height }}
    >
      <div className="w-8 h-8 text-muted-foreground">
        <svg
          className="w-full h-full"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </div>
  )

  return (
    <div
      ref={ref}
      className={cn('relative', className)}
      style={fill ? undefined : { width, height }}
    >
      {shouldLoad ? (
        <OptimizedImage
          src={src}
          alt={alt}
          width={width}
          height={height}
          fill={fill}
          sizes={sizes}
          quality={quality}
          priority={priority}
          className={cn(
            'transition-opacity duration-300',
            !isLoaded && 'opacity-0'
          )}
          onLoad={() => setIsLoaded(true)}
          {...props}
        />
      ) : (
        placeholder || defaultPlaceholder
      )}
    </div>
  )
}

/**
 * 이미지 갤러리를 위한 지연 로딩 컴포넌트
 */
export function LazyImageGallery({
  images,
  className,
  itemClassName,
  aspectRatio = 'square'
}: {
  images: Array<{
    src: string
    alt: string
    id?: string
  }>
  className?: string
  itemClassName?: string
  aspectRatio?: 'square' | 'video' | 'auto'
}) {
  const aspectRatioClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    auto: ''
  }

  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4', className)}>
      {images.map((image, index) => (
        <div
          key={image.id || index}
          className={cn(
            'relative overflow-hidden rounded-lg',
            aspectRatioClasses[aspectRatio],
            itemClassName
          )}
        >
          <LazyImage
            src={image.src}
            alt={image.alt}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            quality={80}
            className="object-cover"
          />
        </div>
      ))}
    </div>
  )
}

/**
 * 배경 이미지를 위한 지연 로딩 컴포넌트
 */
export function LazyBackgroundImage({
  src,
  alt,
  children,
  className,
  overlay = false,
  overlayOpacity = 0.5,
  priority = false
}: {
  src: string
  alt: string
  children?: React.ReactNode
  className?: string
  overlay?: boolean
  overlayOpacity?: number
  priority?: boolean
}) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      <LazyImage
        src={src}
        alt={alt}
        fill
        priority={priority}
        quality={70}
        sizes="100vw"
        className="object-cover"
      />

      {overlay && (
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: overlayOpacity }}
        />
      )}

      {children && (
        <div className="relative z-10">
          {children}
        </div>
      )}
    </div>
  )
}