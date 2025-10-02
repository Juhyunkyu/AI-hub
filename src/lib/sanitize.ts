/**
 * DOMPurify 중앙화된 XSS 보안 유틸리티
 *
 * Context7 문서 기반 구현:
 * - /cure53/dompurify (165 code snippets)
 * - React 19 + Next.js 15 호환
 * - isomorphic-dompurify 사용 (서버/클라이언트 모두 지원)
 *
 * 보안 정책:
 * 1. 게시물: HTML 태그 허용 (리치 콘텐츠)
 * 2. 채팅: TEXT_ONLY 모드 (모든 HTML 제거)
 * 3. 방어 심층화 (Defense in Depth)
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * 게시물용 DOMPurify 설정
 *
 * Context7 패턴:
 * - ALLOWED_TAGS: 안전한 HTML 태그만 허용
 * - ALLOWED_ATTR: 필요한 속성만 허용
 * - KEEP_CONTENT: 제거된 태그의 텍스트는 유지
 *
 * 허용 태그: 리치 텍스트 편집에 필요한 안전한 태그들
 */
const POST_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    // 텍스트 포맷팅
    'p', 'br', 'strong', 'em', 'u', 's', 'del', 'ins', 'mark',

    // 제목
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',

    // 리스트
    'ul', 'ol', 'li',

    // 링크 및 미디어
    'a', 'img',

    // 코드
    'code', 'pre',

    // 인용
    'blockquote',

    // 기타
    'span', 'div',

    // 텍스트 노드 (Context7 권장)
    '#text'
  ],

  ALLOWED_ATTR: {
    // 링크 속성
    'a': ['href', 'target', 'rel'],

    // 이미지 속성
    'img': ['src', 'alt', 'width', 'height', 'loading'],

    // 스타일링 (제한적)
    '*': ['class']
  },

  // Context7 Best Practice: 제거된 태그의 콘텐츠는 유지
  KEEP_CONTENT: true,

  // Context7 Best Practice: DOM Clobbering 방지
  SANITIZE_DOM: true,

  // Context7 Best Practice: Named Property 보호
  SANITIZE_NAMED_PROPS: true,

  // 허용된 URI 프로토콜만 사용 (Context7 패턴)
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
};

/**
 * 채팅 메시지용 DOMPurify 설정
 *
 * Context7 패턴:
 * - TEXT_ONLY 모드: 모든 HTML 제거
 * - ALLOWED_TAGS: [] (빈 배열)
 * - 순수 텍스트만 허용
 */
const CHAT_CONFIG: DOMPurify.Config = {
  // Context7 Best Practice: TEXT_ONLY 모드
  ALLOWED_TAGS: [], // 모든 HTML 태그 제거
  ALLOWED_ATTR: {}, // 모든 속성 제거
  KEEP_CONTENT: true, // 텍스트는 유지

  // 추가 보안 설정
  SANITIZE_DOM: true,
  SANITIZE_NAMED_PROPS: true
};

/**
 * 게시물 HTML 콘텐츠 sanitize
 *
 * @param dirty - 사용자 입력 HTML
 * @returns 안전한 HTML 문자열
 *
 * @example
 * ```typescript
 * const userInput = '<p onclick="alert(1)">Hello</p><script>alert(2)</script>';
 * const clean = sanitizePostContent(userInput);
 * // 결과: '<p>Hello</p>' (onclick과 script 제거됨)
 * ```
 */
export function sanitizePostContent(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }

  try {
    // Context7 패턴: DOMPurify.sanitize(dirty, config)
    const clean = DOMPurify.sanitize(dirty, POST_CONFIG);
    return clean;
  } catch (error) {
    console.error('❌ DOMPurify sanitization failed:', error);
    // 실패 시 빈 문자열 반환 (안전 우선)
    return '';
  }
}

/**
 * 채팅 메시지 텍스트 sanitize
 *
 * @param dirty - 사용자 입력 텍스트
 * @returns 안전한 텍스트 (모든 HTML 제거)
 *
 * @example
 * ```typescript
 * const userInput = 'Hello <script>alert(1)</script> World';
 * const clean = sanitizeChatMessage(userInput);
 * // 결과: 'Hello  World' (script 태그 완전 제거)
 * ```
 */
export function sanitizeChatMessage(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') {
    return '';
  }

  try {
    // Context7 패턴: TEXT_ONLY 모드로 모든 HTML 제거
    const clean = DOMPurify.sanitize(dirty, CHAT_CONFIG);
    return clean;
  } catch (error) {
    console.error('❌ DOMPurify sanitization failed:', error);
    // 실패 시 빈 문자열 반환
    return '';
  }
}

/**
 * 일반 텍스트 sanitize (HTML 완전 제거)
 *
 * @param dirty - 사용자 입력
 * @returns 순수 텍스트
 *
 * @example
 * ```typescript
 * const userInput = '<b>Username</b>';
 * const clean = sanitizeText(userInput);
 * // 결과: 'Username'
 * ```
 */
export function sanitizeText(dirty: string): string {
  return sanitizeChatMessage(dirty);
}

/**
 * URL sanitize 및 검증
 *
 * Context7 패턴: ALLOWED_URI_REGEXP 사용
 *
 * @param url - 사용자 입력 URL
 * @returns 안전한 URL 또는 null
 *
 * @example
 * ```typescript
 * sanitizeUrl('https://example.com'); // 'https://example.com'
 * sanitizeUrl('javascript:alert(1)'); // null (차단)
 * sanitizeUrl('http://example.com'); // 'http://example.com'
 * ```
 */
export function sanitizeUrl(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    // Context7 권장: URL 프로토콜 검증
    const allowedProtocols = /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

    if (!allowedProtocols.test(url)) {
      console.warn('⚠️ Blocked unsafe URL protocol:', url);
      return null;
    }

    // URL 객체로 추가 검증
    const parsedUrl = new URL(url, window?.location?.origin || 'http://localhost');

    // javascript:, data:, vbscript: 등 차단
    if (['javascript:', 'data:', 'vbscript:'].some(proto =>
      parsedUrl.protocol.toLowerCase().startsWith(proto)
    )) {
      console.warn('⚠️ Blocked dangerous URL protocol:', parsedUrl.protocol);
      return null;
    }

    return parsedUrl.href;
  } catch (error) {
    console.error('❌ URL sanitization failed:', error);
    return null;
  }
}

/**
 * DOMPurify 설정 내보내기 (고급 사용자용)
 */
export const SANITIZE_CONFIGS = {
  POST: POST_CONFIG,
  CHAT: CHAT_CONFIG
} as const;

/**
 * DOMPurify 인스턴스 직접 접근 (고급 사용자용)
 *
 * Context7 패턴: Hooks 추가 가능
 *
 * @example
 * ```typescript
 * import { getDOMPurify } from './sanitize';
 *
 * const purify = getDOMPurify();
 * purify.addHook('afterSanitizeAttributes', (node) => {
 *   // Custom logic
 * });
 * ```
 */
export function getDOMPurify() {
  return DOMPurify;
}
