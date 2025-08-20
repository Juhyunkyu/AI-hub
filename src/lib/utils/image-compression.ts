/**
 * 이미지 압축 유틸리티
 * 5MB 이상의 이미지를 자동으로 압축하여 업로드 크기를 줄입니다.
 */

export interface CompressedImage {
  file: File;
  originalSize: number;
  compressedSize: number;
  quality: number;
}

/**
 * 이미지를 압축하는 함수
 * @param file 원본 이미지 파일
 * @param maxSizeMB 최대 파일 크기 (MB)
 * @param maxWidth 최대 너비 (픽셀)
 * @param maxHeight 최대 높이 (픽셀)
 * @param cropToSquare 정사각형으로 크롭할지 여부 (프로필 이미지용)
 * @returns 압축된 이미지 정보
 */
export async function compressImage(
  file: File,
  maxSizeMB: number = 5,
  maxWidth: number = 1024,
  maxHeight: number = 1024,
  cropToSquare: boolean = false
): Promise<CompressedImage> {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  // 파일이 이미 충분히 작으면 압축하지 않음
  if (file.size <= maxSizeBytes) {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      quality: 1.0,
    };
  }

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // 이미지 크기 계산
      let { width, height } = img;
      
      if (cropToSquare) {
        // 정사각형으로 크롭
        const size = Math.min(width, height, maxWidth, maxHeight);
        canvas.width = size;
        canvas.height = size;
        
        // 중앙을 기준으로 정사각형 크롭
        const sourceX = (width - size) / 2;
        const sourceY = (height - size) / 2;
        
        ctx?.drawImage(img, sourceX, sourceY, size, size, 0, 0, size, size);
      } else {
        // 비율 유지하면서 크기 조정
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // 이미지 그리기
        ctx?.drawImage(img, 0, 0, width, height);
      }

      // 품질을 점진적으로 낮춰가며 압축
      let quality = 0.9;
      let compressedFile: File;

      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('이미지 압축에 실패했습니다'));
              return;
            }

            compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });

            // 목표 크기에 도달했거나 품질이 너무 낮아지면 중단
            if (compressedFile.size <= maxSizeBytes || quality <= 0.1) {
              resolve({
                file: compressedFile,
                originalSize: file.size,
                compressedSize: compressedFile.size,
                quality,
              });
            } else {
              // 품질을 더 낮춰서 다시 시도
              quality -= 0.1;
              tryCompress();
            }
          },
          file.type,
          quality
        );
      };

      tryCompress();
    };

    img.onerror = () => {
      reject(new Error('이미지를 로드할 수 없습니다'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * 파일 크기를 사람이 읽기 쉬운 형태로 변환
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
  const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  return supportedTypes.includes(file.type);
}
