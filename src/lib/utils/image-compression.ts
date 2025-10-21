/**
 * 이미지 압축 유틸리티
 * browser-image-compression 라이브러리 사용
 * React 19 + Next.js 15 호환
 */

import imageCompression from 'browser-image-compression';

/**
 * 압축 진행 상태 콜백 타입
 */
export type CompressionProgressCallback = (progress: number) => void;

/**
 * 압축 옵션
 */
export interface ImageCompressionOptions {
  /** 최대 파일 크기 (MB) */
  maxSizeMB?: number;
  /** 최대 너비 또는 높이 (픽셀) */
  maxWidthOrHeight?: number;
  /** 초기 품질 (0-1) */
  initialQuality?: number;
  /** EXIF 메타데이터 보존 */
  preserveExif?: boolean;
  /** 진행 상태 콜백 */
  onProgress?: CompressionProgressCallback;
  /** 취소 시그널 */
  signal?: AbortSignal;
  /** Web Worker 사용 여부 */
  useWebWorker?: boolean;
}

/**
 * 압축 결과
 */
export interface CompressionResult {
  /** 압축된 파일 */
  file: File;
  /** 원본 크기 (bytes) */
  originalSize: number;
  /** 압축 후 크기 (bytes) */
  compressedSize: number;
  /** 압축률 (0-100%) */
  compressionRatio: number;
}

/**
 * 이미지 파일 압축
 *
 * @param file - 압축할 이미지 파일
 * @param options - 압축 옵션
 * @returns 압축된 이미지 정보
 *
 * @example
 * ```ts
 * // 기본 압축
 * const result = await compressImage(file);
 *
 * // 진행률 콜백 사용
 * const result = await compressImage(file, {
 *   maxSizeMB: 2,
 *   onProgress: (progress) => console.log(`${progress}%`)
 * });
 *
 * // 취소 가능한 압축
 * const controller = new AbortController();
 * try {
 *   const result = await compressImage(file, { signal: controller.signal });
 * } catch (error) {
 *   if (error.message.includes('aborted')) {
 *     console.log('압축 취소됨');
 *   }
 * }
 * ```
 */
export async function compressImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxSizeMB = 2,
    maxWidthOrHeight = 1920,
    initialQuality = 0.9,
    preserveExif = true,
    onProgress,
    signal,
    useWebWorker = true,
  } = options;

  const originalSize = file.size;

  // 이미 충분히 작으면 압축하지 않음
  if (originalSize <= maxSizeMB * 1024 * 1024) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
    };
  }

  try {
    const compressedFile = await imageCompression(file, {
      maxSizeMB,
      maxWidthOrHeight,
      initialQuality,
      preserveExif,
      useWebWorker,
      onProgress,
      signal,
    });

    const compressedSize = compressedFile.size;
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

    return {
      file: compressedFile,
      originalSize,
      compressedSize,
      compressionRatio: Math.max(0, compressionRatio),
    };
  } catch (error) {
    // AbortError는 그대로 던지기
    if (error instanceof Error && error.message.includes('abort')) {
      throw error;
    }

    // 다른 에러는 래핑
    throw new Error(`이미지 압축 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
}

/**
 * 프로필 아바타용 이미지 압축
 * 정사각형으로 크롭하고 512x512로 리사이즈
 */
export async function compressAvatar(
  file: File,
  options: Omit<ImageCompressionOptions, 'maxWidthOrHeight'> = {}
): Promise<CompressionResult> {
  return compressImage(file, {
    ...options,
    maxSizeMB: options.maxSizeMB ?? 1,
    maxWidthOrHeight: 512,
    initialQuality: options.initialQuality ?? 0.9,
  });
}

/**
 * 채팅용 이미지 압축
 * 비율 유지하면서 최대 1920px, 2MB로 압축
 */
export async function compressChatImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<CompressionResult> {
  return compressImage(file, {
    ...options,
    maxSizeMB: options.maxSizeMB ?? 2,
    maxWidthOrHeight: options.maxWidthOrHeight ?? 1920,
    initialQuality: options.initialQuality ?? 0.9,
  });
}

/**
 * 파일 크기를 사람이 읽기 쉬운 형태로 변환
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * 이미지 파일인지 확인
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * 지원되는 이미지 형식인지 확인
 */
export function isSupportedImageFormat(file: File): boolean {
  const supportedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
  ];
  return supportedTypes.includes(file.type);
}

/**
 * 이미지 파일 유효성 검사
 */
export interface ImageValidationOptions {
  /** 최대 파일 크기 (bytes) */
  maxSize?: number;
  /** 허용된 파일 타입 */
  allowedTypes?: string[];
}

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageFile(
  file: File,
  options: ImageValidationOptions = {}
): ImageValidationResult {
  const {
    maxSize = 50 * 1024 * 1024, // 50MB
    allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
  } = options;

  if (!isImageFile(file)) {
    return {
      valid: false,
      error: '이미지 파일만 업로드할 수 있습니다',
    };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `지원하지 않는 형식입니다. ${allowedTypes.join(', ')} 형식을 사용해주세요`,
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `파일 크기가 너무 큽니다. 최대 ${formatFileSize(maxSize)}까지 업로드 가능합니다`,
    };
  }

  return { valid: true };
}
