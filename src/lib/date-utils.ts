export function formatMessageTime(dateString: string): string {
  const messageDate = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());

  if (messageDay.getTime() === today.getTime()) {
    // 오늘: 시간만 표시 (예: "14:30")
    return messageDate.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } else if (messageDay.getTime() === yesterday.getTime()) {
    // 어제: "어제" 표시
    return '어제';
  } else {
    // 그 이전: 날짜 표시 (예: "12/25")
    return messageDate.toLocaleDateString('ko-KR', {
      month: 'numeric',
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
    // 오늘: 시간만 표시
    return messageDate.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } else if (messageDay.getTime() === yesterday.getTime()) {
    // 어제
    return '어제';
  } else {
    // 그 이전: 월/일 형태
    return messageDate.toLocaleDateString('ko-KR', {
      month: 'numeric',
      day: 'numeric'
    });
  }
}