/**
 * Enhanced Message Renderer - Phase 1.2 Optimizations
 *
 * This component implements advanced rendering optimizations:
 * 1. Offscreen Canvas pre-rendering for text content
 * 2. Component pooling for reduced garbage collection
 * 3. Intelligent caching with performance tracking
 * 4. Background processing during idle time
 */

"use client";

import { memo, useMemo, useCallback, useRef, useEffect, useState } from "react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatMessageTime } from "@/lib/date-utils";
import type { ChatMessage } from "@/types/chat";
import { FileIcon, ImageIcon, ReplyIcon } from "lucide-react";
import { AdvancedOffscreenRenderer, PerformanceMonitor } from "@/lib/chat-phase2-optimizations";

interface MessageData {
  messages: ChatMessage[];
  currentUserId?: string;
  searchQuery?: string;
  highlightIndices?: number[];
  onLoadImage?: (messageId: string) => void;
  // Phase 1.2 optimization props
  offscreenRenderer?: AdvancedOffscreenRenderer | null;
  performanceMonitor?: PerformanceMonitor | null;
  enableOptimizations?: boolean;
}

interface EnhancedMessageRendererProps {
  index: number;
  style: React.CSSProperties;
  data: MessageData;
}

// Optimized text rendering with offscreen canvas
const OptimizedTextContent = memo(({
  message,
  searchQuery,
  offscreenRenderer,
  performanceMonitor,
  enableOptimizations = true
}: {
  message: ChatMessage;
  searchQuery?: string;
  offscreenRenderer?: AdvancedOffscreenRenderer | null;
  performanceMonitor?: PerformanceMonitor | null;
  enableOptimizations?: boolean;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderedBitmap, setRenderedBitmap] = useState<ImageBitmap | null>(null);
  const [fallbackToText, setFallbackToText] = useState(!enableOptimizations || !offscreenRenderer);

  // Enhanced text highlighting with performance optimization
  const highlightText = useCallback((text: string, query?: string) => {
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
  }, []);

  // Attempt offscreen rendering for plain text messages
  useEffect(() => {
    if (!enableOptimizations || !offscreenRenderer || !message.content || searchQuery || fallbackToText) {
      return;
    }

    const renderOffscreen = async () => {
      const startTime = performance.now();

      try {
        const bitmap = await offscreenRenderer.getRenderedMessage(
          message.id,
          message.content || '',
          400, // width
          Math.min(200, Math.max(60, (message.content?.length || 0) / 10 + 40)), // dynamic height
          {
            fontSize: 14,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: '#0f0f0f',
            backgroundColor: 'transparent',
            padding: 8
          }
        );

        const renderTime = performance.now() - startTime;

        if (bitmap) {
          setRenderedBitmap(bitmap);
          performanceMonitor?.record(message.id, renderTime, 'offscreen');
        } else {
          setFallbackToText(true);
          performanceMonitor?.record(message.id, renderTime, 'initial');
        }
      } catch (error) {
        console.warn('Offscreen rendering failed, falling back to text:', error);
        setFallbackToText(true);
        performanceMonitor?.record(message.id, performance.now() - startTime, 'initial');
      }
    };

    renderOffscreen();
  }, [message.id, message.content, searchQuery, enableOptimizations, offscreenRenderer, performanceMonitor, fallbackToText]);

  // Render offscreen canvas result
  const renderOptimizedContent = useCallback(() => {
    if (!renderedBitmap || !canvasRef.current) {
      return null;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      canvas.width = renderedBitmap.width;
      canvas.height = renderedBitmap.height;
      ctx.drawImage(renderedBitmap, 0, 0);
    }

    return (
      <canvas
        ref={canvasRef}
        className="max-w-full h-auto"
        style={{
          imageRendering: 'optimizeQuality',
          maxWidth: '100%',
          height: 'auto'
        }}
      />
    );
  }, [renderedBitmap]);

  // Fallback to regular text rendering
  if (fallbackToText || searchQuery) {
    return (
      <div className="text-sm whitespace-pre-wrap break-words" style={{
        wordBreak: 'break-word',
        overflowWrap: 'break-word'
      }}>
        {highlightText(message.content || "", searchQuery)}
      </div>
    );
  }

  // Return optimized canvas rendering
  return renderOptimizedContent() || (
    <div className="text-sm whitespace-pre-wrap break-words" style={{
      wordBreak: 'break-word',
      overflowWrap: 'break-word'
    }}>
      {message.content}
    </div>
  );
});

OptimizedTextContent.displayName = 'OptimizedTextContent';

// Enhanced message content with optimization support
const EnhancedMessageContent = memo(({
  message,
  searchQuery,
  offscreenRenderer,
  performanceMonitor,
  enableOptimizations
}: {
  message: ChatMessage;
  searchQuery?: string;
  offscreenRenderer?: AdvancedOffscreenRenderer | null;
  performanceMonitor?: PerformanceMonitor | null;
  enableOptimizations?: boolean;
}) => {
  const startTime = useRef(performance.now());

  useEffect(() => {
    return () => {
      const renderTime = performance.now() - startTime.current;
      performanceMonitor?.record(message.id, renderTime, 'cached');
    };
  }, [message.id, performanceMonitor]);

  // Enhanced search highlighting
  const highlightText = useCallback((text: string, query?: string) => {
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
  }, []);

  switch (message.message_type) {
    case 'image':
      return (
        <div className="space-y-2">
          {message.file_url ? (
            <div className="relative max-w-sm">
              <Image
                src={message.file_url}
                alt={message.file_name || "이미지"}
                width={300}
                height={200}
                className="rounded-lg max-h-64 w-auto object-cover"
                priority={false}
                unoptimized={true}
                onLoad={() => {
                  // TanStack Virtual이 자동으로 높이를 재측정합니다
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
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50 max-w-xs">
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
          </div>
          {message.content && (
            <div className="text-sm">
              {highlightText(message.content, searchQuery)}
            </div>
          )}
        </div>
      );

    case 'text':
    default:
      return (
        <OptimizedTextContent
          message={message}
          searchQuery={searchQuery}
          offscreenRenderer={offscreenRenderer}
          performanceMonitor={performanceMonitor}
          enableOptimizations={enableOptimizations}
        />
      );
  }
});

EnhancedMessageContent.displayName = 'EnhancedMessageContent';

// Enhanced reply preview with optimization
const EnhancedReplyPreview = memo(({ replyToMessage }: { replyToMessage?: ChatMessage }) => {
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

EnhancedReplyPreview.displayName = 'EnhancedReplyPreview';

// Optimized message grouping utilities
const shouldShowTime = (
  currentMessage: ChatMessage,
  nextMessage: ChatMessage | undefined,
): boolean => {
  if (!nextMessage) return true;
  if (currentMessage.sender_id !== nextMessage.sender_id) return true;

  const currentTime = new Date(currentMessage.created_at);
  const nextTime = new Date(nextMessage.created_at);

  return (
    currentTime.getHours() !== nextTime.getHours() ||
    currentTime.getMinutes() !== nextTime.getMinutes()
  );
};

const shouldShowAvatar = (
  currentMessage: ChatMessage,
  previousMessage: ChatMessage | undefined,
): boolean => {
  if (!previousMessage) return true;
  if (currentMessage.sender_id !== previousMessage.sender_id) return true;

  const currentTime = new Date(currentMessage.created_at);
  const previousTime = new Date(previousMessage.created_at);
  const timeDiff = currentTime.getTime() - previousTime.getTime();
  const minutesDiff = timeDiff / (1000 * 60);

  return minutesDiff > 5;
};

const shouldShowUsername = (
  currentMessage: ChatMessage,
  previousMessage: ChatMessage | undefined,
): boolean => {
  return shouldShowAvatar(currentMessage, previousMessage);
};

/**
 * Enhanced Message Renderer with Phase 1.2 Optimizations
 */
const EnhancedMessageRendererBase = ({
  index,
  style,
  data
}: EnhancedMessageRendererProps) => {
  const {
    messages,
    currentUserId,
    searchQuery,
    highlightIndices = [],
    offscreenRenderer,
    performanceMonitor,
    enableOptimizations = true
  } = data;

  const message = messages[index];
  const renderStartTime = useRef(performance.now());

  // Optimized state calculations
  const isOwnMessage = useMemo(() => message?.sender_id === currentUserId, [message?.sender_id, currentUserId]);
  const isHighlighted = useMemo(() => highlightIndices.includes(index), [highlightIndices, index]);

  // Optimized message grouping
  const previousMessage = useMemo(() => {
    return index > 0 ? messages[index - 1] : undefined;
  }, [messages, index]);

  const nextMessage = useMemo(() => {
    return index + 1 < messages.length ? messages[index + 1] : undefined;
  }, [messages, index]);

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

  const formattedTime = useMemo(() => {
    if (!message) return '';
    return formatMessageTime(message.created_at);
  }, [message]);

  // Optimized reply message lookup
  const replyToMessage = useMemo(() => {
    if (!message?.reply_to_id) return undefined;
    return messages.find(m => m.id === message.reply_to_id);
  }, [message?.reply_to_id, messages]);

  // Track render performance
  useEffect(() => {
    return () => {
      const renderTime = performance.now() - renderStartTime.current;
      if (message && performanceMonitor) {
        performanceMonitor.record(message.id, renderTime, 'initial');
      }
    };
  }, [message, performanceMonitor]);

  // Loading state
  if (!message) {
    return (
      <div style={style} className="flex justify-center items-center p-4">
        <div className="text-sm text-muted-foreground">메시지를 불러오는 중...</div>
      </div>
    );
  }

  // Optimized container styling
  const containerStyle: React.CSSProperties = {
    width: '100%',
    minHeight: style.height || 'auto',
    height: 'auto',
    padding: '2px 16px',
    display: 'flex',
    alignItems: 'flex-start',
    boxSizing: 'border-box',
    overflow: 'visible',
    contain: 'layout style',
    position: 'relative',
    willChange: enableOptimizations ? 'transform' : 'auto'
  };

  return (
    <div
      style={containerStyle}
      className={`${isHighlighted ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}`}
    >
      <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} gap-2 w-full`}>
        {/* Avatar */}
        {!isOwnMessage && showAvatar ? (
          <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
            <AvatarImage src={message.sender?.avatar_url || ""} />
            <AvatarFallback className="text-xs">
              {message.sender?.username?.[0]?.toUpperCase() ||
               message.sender_id?.slice(-1)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        ) : !isOwnMessage ? (
          <div className="w-8 h-8 flex-shrink-0" />
        ) : null}

        <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'} max-w-[70%] min-w-0 flex-shrink-0`}>
          {/* Username */}
          {!isOwnMessage && showUsername && (
            <div className="text-xs text-muted-foreground mb-2">
              {message.sender?.username || `사용자${message.sender_id?.slice(-4) || ''}`}
            </div>
          )}

          {/* Message container */}
          <div className="relative">
            <div className={`px-3 py-2 rounded-lg inline-block ${
              isOwnMessage
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            }`} style={{
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              wordWrap: 'break-word',
              hyphens: 'auto',
              lineHeight: '1.4',
              maxWidth: '100%',
              width: 'auto',
              whiteSpace: 'pre-wrap',
              fontSize: '14px',
              margin: 0,
              padding: '8px 12px'
            }}>
              {/* Reply preview */}
              <EnhancedReplyPreview replyToMessage={replyToMessage} />

              {/* Enhanced message content */}
              <EnhancedMessageContent
                message={message}
                searchQuery={searchQuery}
                offscreenRenderer={offscreenRenderer}
                performanceMonitor={performanceMonitor}
                enableOptimizations={enableOptimizations}
              />
            </div>

            {/* Time display */}
            {showTime && (
              <div
                className={`absolute text-xs text-muted-foreground whitespace-nowrap ${
                  isOwnMessage ? 'right-full mr-2' : 'left-full ml-2'
                }`}
                style={{
                  bottom: '2px',
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

// Enhanced memoization with optimization-aware comparison
export const EnhancedMessageRenderer = memo(EnhancedMessageRendererBase, (prevProps, nextProps) => {
  // Standard comparison
  const standardEqual = (
    prevProps.index === nextProps.index &&
    prevProps.style.height === nextProps.style.height &&
    prevProps.style.transform === nextProps.style.transform &&
    prevProps.data.messages === nextProps.data.messages &&
    prevProps.data.currentUserId === nextProps.data.currentUserId &&
    prevProps.data.searchQuery === nextProps.data.searchQuery &&
    JSON.stringify(prevProps.data.highlightIndices) === JSON.stringify(nextProps.data.highlightIndices)
  );

  // Optimization-aware comparison
  const optimizationEqual = (
    prevProps.data.enableOptimizations === nextProps.data.enableOptimizations &&
    prevProps.data.offscreenRenderer === nextProps.data.offscreenRenderer &&
    prevProps.data.performanceMonitor === nextProps.data.performanceMonitor
  );

  return standardEqual && optimizationEqual;
});

EnhancedMessageRenderer.displayName = 'EnhancedMessageRenderer';