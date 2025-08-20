/**
 * 서버와 클라이언트에서 일관된 날짜 포맷을 제공하는 유틸리티
 */

/**
 * 날짜를 한국어 형식으로 포맷팅
 * @param dateString ISO 날짜 문자열
 * @returns 포맷된 날짜 문자열
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  
  // 서버와 클라이언트에서 일관된 포맷 사용
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * 날짜를 상대적 시간으로 표시 (예: "3분 전", "1시간 전")
 * @param dateString ISO 날짜 문자열
 * @returns 상대적 시간 문자열
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return '방금 전';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}분 전`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}시간 전`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}일 전`;
  }

  // 7일 이상 지난 경우 절대 날짜 표시
  return formatDate(dateString);
}

/**
 * 날짜를 간단한 형식으로 표시 (예: "2025.08.12")
 * @param dateString ISO 날짜 문자열
 * @returns 간단한 날짜 문자열
 */
export function formatSimpleDate(dateString: string): string {
  const date = new Date(dateString);
  
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\. /g, '.').replace(/\.$/, '');
}
