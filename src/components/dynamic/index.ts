/**
 * 동적 임포트 컴포넌트 모음
 * Context7 Next.js 15 패턴 기반 라우트 레벨 코드 스플리팅
 */

import dynamic from 'next/dynamic'

// 관리자 패널 컴포넌트들 (지연 로딩)
export const DynamicAdminDashboard = dynamic(
  () => import('@/components/admin/admin-dashboard'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-96" />,
    ssr: false
  }
)

export const DynamicUserManagement = dynamic(
  () => import('@/components/admin/user-management'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-64" />,
    ssr: false
  }
)

export const DynamicPostManagement = dynamic(
  () => import('@/components/admin/post-management'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-64" />,
    ssr: false
  }
)

// 채팅 관련 컴포넌트들 (실시간 기능)
export const DynamicChatRoom = dynamic(
  () => import('@/components/chat/chat-room'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-96" />,
    ssr: false
  }
)

export const DynamicChatInput = dynamic(
  () => import('@/components/chat/chat-input'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-12" />,
    ssr: false
  }
)

export const DynamicMessageList = dynamic(
  () => import('@/components/chat/message-list'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-80" />,
    ssr: false
  }
)

// 게시물 에디터 (무거운 컴포넌트)
export const DynamicPostEditor = dynamic(
  () => import('@/components/post/post-editor'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-96" />,
    ssr: false
  }
)

export const DynamicCommentEditor = dynamic(
  () => import('@/components/post/comment-editor'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-32" />,
    ssr: false
  }
)

// 프로필 관련 컴포넌트들
export const DynamicProfileEditor = dynamic(
  () => import('@/components/profile/profile-editor'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-64" />,
    ssr: false
  }
)

export const DynamicProfileStats = dynamic(
  () => import('@/components/profile/profile-stats'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-32" />,
    ssr: false
  }
)

// 이미지 갤러리 (최적화된 컴포넌트)
export const DynamicImageGallery = dynamic(
  () => import('@/components/ui/image-gallery').then(mod => ({ default: mod.ImageGallery })),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg aspect-video" />,
    ssr: false
  }
)

export const DynamicLazyImage = dynamic(
  () => import('@/components/ui/lazy-image').then(mod => ({ default: mod.LazyImage })),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg aspect-square" />,
    ssr: false
  }
)

// 설정 관련 컴포넌트들
export const DynamicSettingsPanel = dynamic(
  () => import('@/components/settings/settings-panel'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-80" />,
    ssr: false
  }
)

export const DynamicThemeSelector = dynamic(
  () => import('@/components/settings/theme-selector'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-16" />,
    ssr: false
  }
)

// 검색 관련 컴포넌트들
export const DynamicSearchResults = dynamic(
  () => import('@/components/search/search-results'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-64" />,
    ssr: false
  }
)

export const DynamicAdvancedSearch = dynamic(
  () => import('@/components/search/advanced-search'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-48" />,
    ssr: false
  }
)

// 알림 관련 컴포넌트들
export const DynamicNotificationCenter = dynamic(
  () => import('@/components/notifications/notification-center'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-64" />,
    ssr: false
  }
)

export const DynamicNotificationList = dynamic(
  () => import('@/components/notifications/notification-list'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-80" />,
    ssr: false
  }
)

// 성능 모니터링 (개발/관리자용)
export const DynamicPerformanceMonitor = dynamic(
  () => import('@/components/performance/performance-monitor'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-32" />,
    ssr: false
  }
)

export const DynamicWebVitalsMonitor = dynamic(
  () => import('@/components/performance/WebVitalsMonitor'),
  {
    loading: () => null,
    ssr: false
  }
)

// 차트 및 데이터 시각화 (무거운 라이브러리)
export const DynamicAnalyticsChart = dynamic(
  () => import('@/components/analytics/analytics-chart'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-64" />,
    ssr: false
  }
)

export const DynamicStatsChart = dynamic(
  () => import('@/components/analytics/stats-chart'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-48" />,
    ssr: false
  }
)

// 파일 업로드 관련 (대용량 라이브러리)
export const DynamicFileUploader = dynamic(
  () => import('@/components/file/file-uploader'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-32" />,
    ssr: false
  }
)

export const DynamicImageUploader = dynamic(
  () => import('@/components/file/image-uploader'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-40" />,
    ssr: false
  }
)

// 모달 및 다이얼로그 (필요시 로딩)
export const DynamicConfirmDialog = dynamic(
  () => import('@/components/ui/confirm-dialog'),
  {
    loading: () => null,
    ssr: false
  }
)

export const DynamicShareDialog = dynamic(
  () => import('@/components/share/share-dialog'),
  {
    loading: () => null,
    ssr: false
  }
)

// 코드 편집기 (매우 무거운 컴포넌트)
export const DynamicCodeEditor = dynamic(
  () => import('@/components/editor/code-editor'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-96 flex items-center justify-center">
      <span className="text-muted-foreground">코드 에디터 로딩 중...</span>
    </div>,
    ssr: false
  }
)

export const DynamicMarkdownEditor = dynamic(
  () => import('@/components/editor/markdown-editor'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-64" />,
    ssr: false
  }
)

// 텍스트 에디터들 (리치 텍스트)
export const DynamicRichTextEditor = dynamic(
  () => import('@/components/editor/rich-text-editor'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-48" />,
    ssr: false
  }
)

// 게임 또는 인터랙티브 컨텐츠 (선택적 로딩)
export const DynamicInteractiveDemo = dynamic(
  () => import('@/components/interactive/demo'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-80" />,
    ssr: false
  }
)

// 3D 렌더링 컴포넌트 (매우 무거운 라이브러리)
export const Dynamic3DViewer = dynamic(
  () => import('@/components/3d/viewer'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg aspect-video flex items-center justify-center">
      <span className="text-muted-foreground">3D 뷰어 로딩 중...</span>
    </div>,
    ssr: false
  }
)

// 카메라 및 미디어 관련
export const DynamicCameraCapture = dynamic(
  () => import('@/components/media/camera-capture'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg aspect-video" />,
    ssr: false
  }
)

export const DynamicVideoPlayer = dynamic(
  () => import('@/components/media/video-player'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg aspect-video" />,
    ssr: false
  }
)

// 지도 컴포넌트 (지도 라이브러리)
export const DynamicMapView = dynamic(
  () => import('@/components/map/map-view'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-64" />,
    ssr: false
  }
)

// 캘린더 및 스케줄러
export const DynamicCalendar = dynamic(
  () => import('@/components/calendar/calendar'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-96" />,
    ssr: false
  }
)

export const DynamicEventScheduler = dynamic(
  () => import('@/components/calendar/event-scheduler'),
  {
    loading: () => <div className="animate-pulse bg-muted rounded-lg h-80" />,
    ssr: false
  }
)