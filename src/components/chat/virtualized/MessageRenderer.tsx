"use client";

import { memo, useMemo, useEffect, type CSSProperties } from "react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatMessageTime } from "@/lib/date-utils";
import type { ChatMessage } from "@/types/chat";
import { FileIcon, ImageIcon, ReplyIcon, Download, MapPin } from "lucide-react";
import { ClickableImage } from "@/components/shared/image-lightbox";
import { loadKakaoMaps } from "@/lib/kakao-maps-loader";

interface MessageData {
  messages: ChatMessage[];
  currentUserId?: string;
  searchQuery?: string;
  highlightIndices?: number[];
  onLoadImage?: (messageId: string) => void;
  sendMessage?: (content: string, roomId: string, file?: File) => Promise<void>;
  currentRoomId?: string;
}

/**
 * 시간 표시 여부 결정 (카카오톡 스타일)
 * 같은 사용자가 같은 분 내에 연속으로 메시지를 보낸 경우 마지막에만 시간 표시
 */
function shouldShowTime(
  currentMessage: ChatMessage,
  nextMessage: ChatMessage | undefined,
): boolean {
  if (!nextMessage) return true; // 마지막 메시지는 항상 시간 표시

  // 다른 사용자면 시간 표시
  if (currentMessage.sender_id !== nextMessage.sender_id) return true;

  // 같은 사용자일 때 시간(분) 비교
  const currentTime = new Date(currentMessage.created_at);
  const nextTime = new Date(nextMessage.created_at);

  // 다른 분이면 시간 표시
  if (
    currentTime.getHours() !== nextTime.getHours() ||
    currentTime.getMinutes() !== nextTime.getMinutes()
  ) {
    return true;
  }

  return false; // 같은 분이면 시간 숨기기
}

/**
 * 아바타 표시 여부 결정 (메시지 그룹핑)
 * 같은 사용자의 연속 메시지에서는 첫 번째 메시지만 아바타 표시
 */
function shouldShowAvatar(
  currentMessage: ChatMessage,
  previousMessage: ChatMessage | undefined,
): boolean {
  if (!previousMessage) return true; // 첫 번째 메시지는 항상 아바타 표시

  // 다른 사용자면 아바타 표시
  if (currentMessage.sender_id !== previousMessage.sender_id) return true;

  // 같은 사용자의 연속 메시지면 아바타 숨기기 (시간 차이가 5분 이내인 경우)
  const currentTime = new Date(currentMessage.created_at);
  const previousTime = new Date(previousMessage.created_at);
  const timeDiff = currentTime.getTime() - previousTime.getTime();
  const minutesDiff = timeDiff / (1000 * 60);

  return minutesDiff > 5; // 5분 이상 차이나면 아바타 다시 표시
}

/**
 * 사용자명 표시 여부 결정 (아바타와 동일한 로직)
 */
function shouldShowUsername(
  currentMessage: ChatMessage,
  previousMessage: ChatMessage | undefined,
): boolean {
  return shouldShowAvatar(currentMessage, previousMessage);
}

interface MessageRendererProps {
  index: number;
  style: React.CSSProperties;
  data: MessageData;
}

/**
 * 메시지 타입별 컨텐츠 렌더링 컴포넌트
 */
const MessageContent = memo(({
  message,
  searchQuery,
  sendMessage,
  currentRoomId,
  currentUserId
}: {
  message: ChatMessage;
  searchQuery?: string;
  sendMessage?: (content: string, roomId: string, file?: File) => Promise<void>;
  currentRoomId?: string;
  currentUserId?: string;
}) => {
  // 검색어 하이라이트 함수
  const highlightText = (text: string, query?: string) => {
    if (!query || !text) return text;

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-900 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  switch (message.message_type) {
    case 'image':
      return (
        <div className="space-y-2">
          {message.file_url ? (
            <div className="relative max-w-sm">
              <ClickableImage
                src={message.file_url}
                alt={message.file_name || "이미지"}
                width={300}
                height={200}
                className="rounded-lg"
                fileName={message.file_name}
                priority={false}
                unoptimized={true}
                onLoad={() => {
                  // TanStack Virtual이 자동으로 높이를 재측정합니다
                }}
                enableDrawing={true}
                // Delete 기능을 위한 props
                messageId={message.id}
                senderId={message.sender_id}
                currentUserId={currentUserId}
                roomId={currentRoomId}
                senderName={message.sender?.username}
                senderAvatar={message.sender?.avatar_url}
                sentAt={message.created_at}
                onSend={async (imageDataUrl: string, fileName: string) => {
                  if (!sendMessage || !currentRoomId) {
                    console.warn('⚠️ sendMessage or currentRoomId not available');
                    return;
                  }

                  try {
                    // Data URL을 Blob으로 변환
                    const response = await fetch(imageDataUrl);
                    const blob = await response.blob();

                    // Blob을 File 객체로 변환 (편집된 이미지는 PNG로 저장)
                    const editedFile = new File([blob], fileName, { type: 'image/png' });

                    // 채팅 메시지로 전송
                    await sendMessage('', currentRoomId, editedFile);

                    console.log('✅ Edited image sent successfully:', fileName);
                  } catch (error) {
                    console.error('❌ Failed to send edited image:', error);
                  }
                }}
              />
              {message.content && (
                <div className="mt-2 text-sm">
                  {highlightText(message.content, searchQuery)}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">이미지를 불러올 수 없습니다</span>
            </div>
          )}
        </div>
      );

    case 'file':
      const handleFileDownload = async () => {
        if (!message.file_url) return;

        try {
          const response = await fetch(message.file_url);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);

          const link = document.createElement("a");
          link.href = url;
          link.download = message.file_name || `file-${Date.now()}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          window.URL.revokeObjectURL(url);
        } catch (error) {
          console.error("파일 다운로드 실패:", error);
        }
      };

      return (
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50 max-w-xs group">
            <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">
                {message.file_name || "파일"}
              </div>
              {message.file_size && (
                <div className="text-xs text-muted-foreground">
                  {(message.file_size / 1024).toFixed(1)} KB
                </div>
              )}
            </div>
            {message.file_url && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFileDownload}
                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                aria-label="다운로드"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
          {message.content && (
            <div className="text-sm">
              {highlightText(message.content, searchQuery)}
            </div>
          )}
        </div>
      );

    case 'location':
      // 위치 데이터 JSON 파싱
      let locationData = null;
      try {
        // file_name에서 location data 추출하거나 content에서 파싱
        const jsonStr = message.content || message.file_name || '';
        if (jsonStr.includes('"type":"location"')) {
          locationData = JSON.parse(jsonStr);
        }
      } catch (error) {
        console.warn('Failed to parse location data:', error);
      }

      if (locationData && locationData.type === 'location') {
        // LocationMessage 컴포넌트 사용 (카카오맵 통합)
        return <LocationMessage message={message} locationData={locationData} />;
      }

      // 위치 데이터가 아닌 경우 일반 파일로 표시
      return (
        <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50 max-w-xs">
          <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <div className="text-sm">위치 정보</div>
        </div>
      );

    case 'text':
    default:
      // Context7 Best Practice: 텍스트 메시지는 sanitize 후 안전하게 렌더링
      // 채팅은 plain text이므로 이미 안전하지만, 방어 심층화(Defense in Depth)
      const safeContent = message.content || "";

      return (
        <div className="text-sm whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
          {highlightText(safeContent, searchQuery)}
        </div>
      );
  }
});

MessageContent.displayName = 'MessageContent';

/**
 * 위치 메시지 컴포넌트 (카카오맵 통합)
 */
interface LocationMessageProps {
  message: ChatMessage;
  locationData: {
    type: string;
    name: string;
    address: string;
    coordinates: { x: string; y: string };
    phone?: string;
    url?: string;
  };
}

const LocationMessage = memo(({ message, locationData }: LocationMessageProps) => {
  // 카카오맵 초기화
  useEffect(() => {
    let isCancelled = false;

    const initializeMap = async () => {
      try {
        // Kakao Maps SDK 로드
        const kakaoAPI = await loadKakaoMaps();

        if (isCancelled) return;

        const container = document.getElementById(`map-${message.id}`);
        if (!container) return;

        // 지도 옵션 (Context7 문서 기반)
        const options = {
          center: new kakaoAPI.maps.LatLng(
            parseFloat(locationData.coordinates.y), // latitude
            parseFloat(locationData.coordinates.x)  // longitude
          ),
          level: 3, // 확대 레벨
          draggable: false, // 드래그 비활성화 (성능)
          scrollwheel: false, // 스크롤 줌 비활성화
          disableDoubleClickZoom: true, // 더블클릭 줌 비활성화
        };

        // 지도 생성
        const map = new kakaoAPI.maps.Map(container, options);

        // 마커 생성 및 표시
        const marker = new kakaoAPI.maps.Marker({
          position: options.center,
          map: map,
        });

        console.log(`✅ 카카오맵 초기화 완료: ${locationData.name}`);
      } catch (error) {
        if (!isCancelled) {
          console.error('카카오맵 초기화 실패:', error);
        }
      }
    };

    initializeMap();

    // Cleanup 함수
    return () => {
      isCancelled = true;
    };
  }, [message.id, locationData]);

  return (
    <div className="space-y-2 w-full">
      {/* 위치 정보 카드 - 한 줄로 표시 */}
      <div className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-background/80 backdrop-blur-sm w-full">
        <MapPin className="h-4 w-4 text-blue-500 flex-shrink-0" />
        <div className="min-w-0 flex-1 flex items-center gap-2 text-xs">
          <span className="font-semibold text-foreground truncate">{locationData.name}</span>
          <span className="text-foreground/60">·</span>
          <span className="text-foreground/70 truncate">{locationData.address}</span>
          {locationData.phone && (
            <>
              <span className="text-foreground/60">·</span>
              <span className="text-foreground/70 flex-shrink-0">📞 {locationData.phone}</span>
            </>
          )}
        </div>
      </div>

      {/* 카카오맵 표시 영역 - 더 큰 높이 */}
      <div className="w-full h-48 bg-muted rounded-lg overflow-hidden border">
        <div
          id={`map-${message.id}`}
          className="w-full h-full"
          style={{ minHeight: '192px' }}
        />
      </div>

      {/* 카카오맵으로 보기 버튼 - 가독성 개선 */}
      {locationData.url && (
        <div className="flex justify-end">
          <Button
            variant="default"
            size="sm"
            onClick={() => window.open(locationData.url, '_blank')}
            className="text-sm font-medium"
          >
            카카오맵에서 보기
          </Button>
        </div>
      )}
    </div>
  );
});

LocationMessage.displayName = 'LocationMessage';

/**
 * 답글 프리뷰 컴포넌트
 */
const ReplyPreview = memo(({ replyToMessage }: { replyToMessage?: ChatMessage }) => {
  if (!replyToMessage) return null;

  return (
    <div className="flex items-center gap-2 p-2 mb-2 bg-muted/30 rounded border-l-2 border-primary/50">
      <ReplyIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-muted-foreground truncate">
          {replyToMessage.sender?.username || "사용자"}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {replyToMessage.message_type === 'image' ? '📷 이미지' :
           replyToMessage.message_type === 'file' ? '📎 파일' :
           replyToMessage.content}
        </div>
      </div>
    </div>
  );
});

ReplyPreview.displayName = 'ReplyPreview';

/**
 * TanStack Virtual용 메시지 렌더러 컴포넌트
 *
 * React 19와 Next.js 15에 최적화된 가상화 메시지 렌더링
 * TanStack Virtual과 완전 호환
 */
const MessageRendererBase = ({
  index,
  style,
  data
}: MessageRendererProps) => {
  const {
    messages,
    currentUserId,
    searchQuery,
    highlightIndices = [],
    sendMessage,
    currentRoomId
  } = data;

  const message = messages[index];

  // 모든 훅은 조건부 호출 이전에 위치
  const isOwnMessage = message?.sender_id === currentUserId;
  const isHighlighted = highlightIndices.includes(index);

  // 이전/다음 메시지 정보 (그룹핑 결정용)
  const previousMessage = useMemo(() => {
    return index > 0 ? messages[index - 1] : undefined;
  }, [messages, index]);

  const nextMessage = useMemo(() => {
    return index + 1 < messages.length ? messages[index + 1] : undefined;
  }, [messages, index]);

  // 메시지 그룹핑 결정 - message가 있을 때만
  const showTime = useMemo(() => {
    if (!message) return false;
    return shouldShowTime(message, nextMessage);
  }, [message, nextMessage]);

  const showAvatar = useMemo(() => {
    if (!message) return false;
    return shouldShowAvatar(message, previousMessage);
  }, [message, previousMessage]);

  const showUsername = useMemo(() => {
    if (!message) return false;
    return shouldShowUsername(message, previousMessage);
  }, [message, previousMessage]);

  // 시간 포맷팅 최적화 - message가 있을 때만
  const formattedTime = useMemo(() => {
    if (!message) return '';
    return formatMessageTime(message.created_at);
  }, [message]);

  // 답글 대상 메시지 찾기 (성능 최적화를 위해 useMemo 사용)
  const replyToMessage = useMemo(() => {
    if (!message?.reply_to_id) return undefined;
    return messages.find(m => m.id === message.reply_to_id);
  }, [message?.reply_to_id, messages]);

  // 메시지가 없는 경우 (로딩 상태 등)
  if (!message) {
    return (
      <div style={style} className="flex justify-center items-center p-4">
        <div className="text-sm text-muted-foreground">메시지를 불러오는 중...</div>
      </div>
    );
  }


  // 컨테이너 스타일 - 텍스트 래핑을 허용하는 유연한 높이
  const containerStyle: CSSProperties = {
    width: '100%',
    minHeight: style.height || 'auto', // 최소 높이만 설정
    height: 'auto', // 콘텐츠에 따라 자연스러운 높이
    padding: '2px 16px', // 상하 간격 (4px total)
    display: 'flex',
    alignItems: 'flex-start',
    boxSizing: 'border-box',
    overflow: 'visible', // 텍스트 래핑이 보이도록 변경
    // 가상화와 호환되는 최적화
    contain: 'layout',
    position: 'relative'
  };

  return (
    <div
      style={containerStyle}
      className={`${isHighlighted ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}`}
    >
      <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} gap-2 ${
        message.message_type === 'location' ? 'w-full' : 'w-full'
      }`}>
        {/* 아바타 (내 메시지가 아니고 그룹핑 조건을 만족하는 경우만) */}
        {!isOwnMessage && showAvatar ? (
          <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
            <AvatarImage src={message.sender?.avatar_url || ""} />
            <AvatarFallback className="text-xs">
              {message.sender?.username?.[0]?.toUpperCase() ||
               message.sender_id?.slice(-1)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        ) : !isOwnMessage ? (
          /* 아바타 자리 플레이스홀더 (메시지 정렬을 위해) */
          <div className={`flex-shrink-0 ${message.message_type === 'location' ? 'w-0' : 'w-8 h-8'}`} />
        ) : null}

        <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} ${
          message.message_type === 'location'
            ? 'flex-1 max-w-[83%]'
            : 'max-w-[75%] sm:max-w-[80%]'
        } min-w-0 ${message.message_type === 'location' ? '' : 'flex-shrink-0'}`}>
          {/* 사용자명 (내 메시지가 아니고 그룹핑 조건을 만족하는 경우만) */}
          {!isOwnMessage && showUsername && (
            <div className="text-xs text-muted-foreground mb-2">
              {message.sender?.username || `사용자${message.sender_id?.slice(-4) || ''}`}
            </div>
          )}

          {/* 메시지 컨테이너 - 시간 분리된 깔끔한 구조 */}
          <div className={`relative ${message.message_type === 'location' ? 'w-full' : ''}`}>
            {/* 메시지 버블 - 텍스트만 배경과 테두리 적용 */}
            <div className={`${
              message.message_type === 'text'
                ? `rounded-lg inline-block px-3 py-2 ${
                    isOwnMessage
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`
                : message.message_type === 'location'
                ? 'block w-full p-0 min-w-full bg-transparent'
                : 'inline-block bg-transparent'
            }`} style={{
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              wordWrap: 'break-word',
              hyphens: 'auto',
              lineHeight: '1.4', // 정확한 lineHeight 지정
              maxWidth: '100%', // 부모 컨테이너(70%) 기준으로 100%
              width: 'auto',
              whiteSpace: 'pre-wrap',
              // 추가 스타일링 일관성
              fontSize: '14px', // text-sm 명시적 지정
              margin: 0,
              padding: message.message_type === 'text' ? '8px 12px' : '0' // 텍스트만 패딩 적용
            }}>
              {/* 답글 프리뷰 */}
              <ReplyPreview replyToMessage={replyToMessage} />

              {/* 메시지 컨텐츠 */}
              <MessageContent
                message={message}
                searchQuery={searchQuery}
                sendMessage={sendMessage}
                currentRoomId={currentRoomId}
                currentUserId={currentUserId}
              />
            </div>

            {/* 시간 표시 - absolute 포지셔닝으로 버블 외부에 배치 */}
            {showTime && (
              <div
                className={`absolute text-xs text-muted-foreground whitespace-nowrap ${
                  isOwnMessage ? 'right-full mr-2' : 'left-full ml-2'
                }`}
                style={{
                  bottom: '2px', // 버블 하단에 맞춤
                  transform: 'none'
                }}
              >
                {formattedTime}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// React.memo 비교 함수 - 성능 최적화
export const MessageRenderer = memo(MessageRendererBase, (prevProps, nextProps) => {
  // index, style, data가 모두 같으면 리렌더링 방지
  return (
    prevProps.index === nextProps.index &&
    prevProps.style.height === nextProps.style.height &&
    prevProps.style.transform === nextProps.style.transform &&
    prevProps.data.messages === nextProps.data.messages &&
    prevProps.data.currentUserId === nextProps.data.currentUserId &&
    prevProps.data.searchQuery === nextProps.data.searchQuery &&
    JSON.stringify(prevProps.data.highlightIndices) === JSON.stringify(nextProps.data.highlightIndices)
  );
});

MessageRenderer.displayName = 'MessageRenderer';