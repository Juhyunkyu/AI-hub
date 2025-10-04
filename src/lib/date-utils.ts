export function formatMessageTime(dateString: string): string {
  const messageDate = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());

  if (messageDay.getTime() === today.getTime()) {
    // 오늘: "오후 5:43" 형식
    return messageDate.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } else if (messageDay.getTime() === yesterday.getTime()) {
    // 어제: "어제" 표시
    return '어제';
  } else {
    // 그 이전: "9월 10일" 형태
    return messageDate.toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric'
    });
  }
}

export function formatLastMessageTime(dateString: string): string {
  const messageDate = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());

  if (messageDay.getTime() === today.getTime()) {
    // 오늘: "오후 5:43" 형식
    return messageDate.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } else if (messageDay.getTime() === yesterday.getTime()) {
    // 어제
    return '어제';
  } else {
    // 그 이전: "9월 10일" 형태
    return messageDate.toLocaleDateString('ko-KR', {
      month: 'long',
      day: 'numeric'
    });
  }
}

export function formatTimeAgo(date: string | Date): string {
  const messageDate = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - messageDate.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return '방금 전';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}분 전`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}시간 전`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}일 전`;
  } else {
    return messageDate.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}