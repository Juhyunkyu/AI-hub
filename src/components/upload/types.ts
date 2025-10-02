// 파일 업로드 컴포넌트 공통 타입 정의

export interface FileUploadOptions {
  onFileSelect: (files: File[]) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

export interface AttachmentMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
  onClick: () => void;
  disabled?: boolean;
}

export interface ChatAttachmentMenuProps {
  onFileSelect: (files: File[]) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}


export interface GalleryOptionProps extends FileUploadOptions {
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // bytes
}

export interface CameraOptionProps extends FileUploadOptions {
  captureMode?: 'user' | 'environment'; // front or back camera
  accept?: string;
}

export interface FileOptionProps extends FileUploadOptions {
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number;
}

export interface LocationOptionProps {
  onLocationSelect?: (location: any) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
}


// 파일 타입 유틸리티
export const FileTypes = {
  IMAGES: {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
  },
  VIDEOS: {
    'video/mp4': ['.mp4'],
    'video/webm': ['.webm'],
    'video/ogg': ['.ogv'],
  },
  DOCUMENTS: {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'text/plain': ['.txt'],
  },
  ALL: '*',
} as const;

// 파일 크기 제한 상수
export const FILE_SIZE_LIMITS = {
  IMAGE: 10 * 1024 * 1024, // 10MB
  VIDEO: 100 * 1024 * 1024, // 100MB
  DOCUMENT: 50 * 1024 * 1024, // 50MB
  DEFAULT: 25 * 1024 * 1024, // 25MB
} as const;