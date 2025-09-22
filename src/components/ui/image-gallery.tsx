'use client'

import { useState, useRef, useEffect } from 'react'
import { OptimizedImage } from './optimized-image'
import { LazyImage } from './lazy-image'
import { useImagePreloader, useResponsiveImageSize } from '@/hooks/use-optimized-image'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'

interface ImageGalleryItem {
  id: string
  src: string
  alt: string
  thumbnail?: string
  caption?: string
}

interface ImageGalleryProps {
  images: ImageGalleryItem[]
  className?: string
  preloadCount?: number
  enableLightbox?: boolean
  enableZoom?: boolean
  aspectRatio?: 'square' | 'video' | 'auto'
}

/**
 * 고성능 이미지 갤러리 컴포넌트
 * Context7 패턴 기반으로 구현된 최적화 갤러리
 */
export function ImageGallery({
  images,
  className,
  preloadCount = 5,
  enableLightbox = true,
  enableZoom = true,
  aspectRatio = 'square'
}: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  // 처음 몇 개 이미지 프리로드
  const preloadUrls = images.slice(0, preloadCount).map(img => img.src)
  const { isPreloading, progress } = useImagePreloader(preloadUrls)

  const openLightbox = (index: number) => {
    if (!enableLightbox) return
    setSelectedIndex(index)
    setIsLightboxOpen(true)
  }

  const closeLightbox = () => {
    setIsLightboxOpen(false)
    setSelectedIndex(null)
  }

  const navigateImage = (direction: 'prev' | 'next') => {
    if (selectedIndex === null) return

    const newIndex = direction === 'next'
      ? (selectedIndex + 1) % images.length
      : (selectedIndex - 1 + images.length) % images.length

    setSelectedIndex(newIndex)
  }

  const aspectRatioClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    auto: ''
  }

  return (
    <>
      <div className={cn('space-y-4', className)}>
        {isPreloading && (
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <div
              key={image.id}
              className={cn(
                'relative overflow-hidden rounded-lg cursor-pointer group',
                aspectRatioClasses[aspectRatio]
              )}
              onClick={() => openLightbox(index)}
            >
              <LazyImage
                src={image.thumbnail || image.src}
                alt={image.alt}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                quality={80}
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />

              {enableLightbox && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                  <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              )}

              {image.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <p className="text-white text-sm truncate">{image.caption}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 라이트박스 모달 */}
      {isLightboxOpen && selectedIndex !== null && (
        <ImageLightbox
          images={images}
          currentIndex={selectedIndex}
          onClose={closeLightbox}
          onNavigate={navigateImage}
          enableZoom={enableZoom}
        />
      )}
    </>
  )
}

/**
 * 이미지 라이트박스 컴포넌트
 */
interface ImageLightboxProps {
  images: ImageGalleryItem[]
  currentIndex: number
  onClose: () => void
  onNavigate: (direction: 'prev' | 'next') => void
  enableZoom?: boolean
}

function ImageLightbox({
  images,
  currentIndex,
  onClose,
  onNavigate,
  enableZoom = true
}: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const imageRef = useRef<HTMLDivElement>(null)

  const currentImage = images[currentIndex]

  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          onNavigate('prev')
          break
        case 'ArrowRight':
          onNavigate('next')
          break
        case '+':
        case '=':
          if (enableZoom) setZoom(prev => Math.min(prev + 0.5, 3))
          break
        case '-':
          if (enableZoom) setZoom(prev => Math.max(prev - 0.5, 0.5))
          break
        case '0':
          if (enableZoom) {
            setZoom(1)
            setPosition({ x: 0, y: 0 })
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, onNavigate, enableZoom])

  // 드래그 핸들러
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!enableZoom || zoom <= 1) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !enableZoom) return
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // 이미지 변경시 줌/위치 리셋
  useEffect(() => {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
  }, [currentIndex])

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
      {/* 컨트롤 버튼들 */}
      <div className="absolute top-4 right-4 flex gap-2">
        {enableZoom && (
          <>
            <button
              onClick={() => setZoom(prev => Math.min(prev + 0.5, 3))}
              className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button
              onClick={() => setZoom(prev => Math.max(prev - 0.5, 0.5))}
              className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
          </>
        )}
        <button
          onClick={onClose}
          className="p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 네비게이션 버튼들 */}
      {images.length > 1 && (
        <>
          <button
            onClick={() => onNavigate('prev')}
            className="absolute left-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => onNavigate('next')}
            className="absolute right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* 메인 이미지 */}
      <div
        ref={imageRef}
        className="relative max-w-[90vw] max-h-[90vh] cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease'
        }}
      >
        <OptimizedImage
          src={currentImage.src}
          alt={currentImage.alt}
          width={800}
          height={600}
          className="object-contain"
          priority
          quality={90}
        />
      </div>

      {/* 이미지 정보 */}
      {currentImage.caption && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg">
          <p className="text-center">{currentImage.caption}</p>
          <p className="text-xs text-gray-300 text-center mt-1">
            {currentIndex + 1} / {images.length}
          </p>
        </div>
      )}
    </div>
  )
}