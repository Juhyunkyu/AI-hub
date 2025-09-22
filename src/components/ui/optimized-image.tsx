'use client'

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  fill?: boolean
  sizes?: string
  quality?: number
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  onLoad?: () => void
  onError?: () => void
  unoptimized?: boolean
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  fill = false,
  sizes,
  quality = 75,
  placeholder = 'empty',
  blurDataURL,
  onLoad,
  onError,
  unoptimized = false,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleLoad = () => {
    setIsLoading(false)
    onLoad?.()
  }

  const handleError = () => {
    setIsLoading(false)
    setHasError(true)
    onError?.()
  }

  // 자동 sizes 설정 (responsive 이미지용)
  const defaultSizes = sizes || (fill
    ? '100vw'
    : '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
  )

  if (hasError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted text-muted-foreground',
          'border border-border rounded-md',
          className
        )}
        style={fill ? undefined : { width, height }}
      >
        <span className="text-sm">이미지 로드 실패</span>
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      <Image
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        sizes={defaultSizes}
        quality={quality}
        priority={priority}
        placeholder={placeholder}
        blurDataURL={blurDataURL}
        unoptimized={unoptimized}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          'transition-opacity duration-300',
          isLoading && 'opacity-0',
          !isLoading && 'opacity-100'
        )}
        {...props}
      />

      {isLoading && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            'bg-muted animate-pulse rounded-md'
          )}
          style={fill ? undefined : { width, height }}
        >
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}

// 사용자 아바타 최적화 컴포넌트
export function OptimizedAvatar({
  src,
  alt,
  size = 40,
  className,
  priority = false,
  ...props
}: {
  src?: string | null
  alt: string
  size?: number
  className?: string
  priority?: boolean
}) {
  return (
    <OptimizedImage
      src={src || '/default-avatar.png'}
      alt={alt}
      width={size}
      height={size}
      className={cn('rounded-full', className)}
      priority={priority}
      quality={90}
      sizes={`${size}px`}
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+BMb0Cd0rh4IaOjdSyPLXh1YL8cA+F5q5NdBPbj1EzFBVJ5+Ec2s5t1R2pxY3gAJ+KP8GG4R3h4OGwWJy+dWAh0A6cCrj3q8Fhg4YKbTCz5hUTi34tVTOgVFXjSQWO3k0bIqdjb3SFcfJ9gvzL6UHXDUS6SBJKqO5nKSM1Q/iLjhgRVaBD2dNFj2YG7Ck8cVCtJ4nC8RbOB"
      {...props}
    />
  )
}

// 게시물 이미지 최적화 컴포넌트
export function OptimizedPostImage({
  src,
  alt,
  className,
  aspectRatio = 'auto',
  priority = false,
  ...props
}: {
  src: string
  alt: string
  className?: string
  aspectRatio?: 'auto' | 'square' | 'video' | 'wide'
  priority?: boolean
}) {
  const aspectRatioClasses = {
    auto: '',
    square: 'aspect-square',
    video: 'aspect-video',
    wide: 'aspect-[21/9]'
  }

  return (
    <div className={cn('relative overflow-hidden rounded-lg', aspectRatioClasses[aspectRatio], className)}>
      <OptimizedImage
        src={src}
        alt={alt}
        fill
        priority={priority}
        quality={85}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className="object-cover"
        {...props}
      />
    </div>
  )
}