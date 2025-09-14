"use client";

import { useCallback } from "react";
import type { ChatMessage } from "@/types/chat";

interface UseMessageHeightReturn {
  estimateSize: (index: number, messages: ChatMessage[]) => number;
  estimateHeight: (message: ChatMessage) => number;
}

/**
 * TanStack Virtual과 통합된 메시지 높이 추정 훅 (정확도 개선 버전)
 *
 * 기능:
 * - 보수적이고 정확한 높이 계산으로 measureElement 의존도 강화
 * - 수동 줄바꿈(\n)과 자동 줄바꿈 정확 처리
 * - 시간 표시 분리로 메시지 넓이 계산 정확성 향상
 * - 과도한 버퍼 제거로 간격 일관성 확보
 */
export function useMessageHeight(): UseMessageHeightReturn {
  // 실제 CSS 값을 기반으로 한 정확한 높이 계산
  const containerPadding = 2; // padding: 1px 16px (상하 2px)
  const bubblePaddingVertical = 16; // px-3 py-2 = padding: 8px 12px (상하 16px)
  const fontSize = 14; // text-sm = 14px
  const lineHeight = 1.4; // CSS line-height
  const actualLineHeight = Math.round(fontSize * lineHeight); // 14 * 1.4 = 19.6 → 20px
  const baseMargin = 2; // 최소한의 여백만 추가
  const replyPreviewHeight = 32; // 답글 프리뷰 높이

  // 기본 높이 (최소 높이)
  const baseHeight = containerPadding + bubblePaddingVertical + actualLineHeight + baseMargin;

  /**
   * 메시지 타입별 높이 추정 (정확한 계산)
   */
  const estimateHeight = useCallback((message: ChatMessage): number => {
    let finalHeight = baseHeight;

    // 답글이 있는 경우 추가 높이
    if (message.reply_to_id) {
      finalHeight += replyPreviewHeight;
    }

    // 메시지 타입별 높이 계산
    switch (message.message_type) {
      case 'image':
        // 이미지: 기본 이미지 높이 + 정확한 패딩
        const imageHeight = 200; // max-h-64 예상 높이
        return finalHeight + imageHeight;

      case 'file':
        // 파일: 파일 정보 표시 영역 + 정확한 패딩
        const fileInfoHeight = 60; // 파일 아이콘 + 이름 + 크기
        return finalHeight + fileInfoHeight;

      case 'text':
      default:
        // 텍스트: 수동 줄바꿈(\n) + 자동 줄바꿈 모두 처리
        const content = message.content || '';
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

        // 1. 수동 줄바꿈 처리
        const lines = content.split('\n');

        // 2. 컨테이너 넓이 기반 자동 줄바꿈 계산 (더 보수적으로 계산)
        const containerWidth = isMobile ? 280 : 400; // 실제 사용 가능한 넓이
        const messageWidth = containerWidth * 0.7 - 24; // 70% - px-3(좌우 24px)
        const avgCharWidth = 9; // 한글/영문 혼합 평균 넓이 (보수적 추정)

        // 3. 각 줄에 대해 자동 줄바꿈 계산 (더 정확하게)
        let totalLines = 0;
        lines.forEach(line => {
          if (line.length === 0) {
            totalLines += 1; // 빈 줄
          } else {
            const charsPerLine = Math.floor(messageWidth / avgCharWidth);
            const autoWrappedLines = Math.max(1, Math.ceil(line.length / charsPerLine));
            totalLines += autoWrappedLines;
          }
        });

        // 4. 최종 높이 계산 (정확한 계산, 과도한 버퍼 제거)
        const textHeight = totalLines * actualLineHeight;

        return finalHeight + textHeight;
    }
  }, [baseHeight, replyPreviewHeight, containerPadding, bubblePaddingVertical, actualLineHeight, baseMargin]);

  /**
   * TanStack Virtual의 estimateSize와 호환되는 함수
   * 현실적인 추정값으로 measureElement와의 차이 최소화
   */
  const estimateSize = useCallback((index: number, messages: ChatMessage[]): number => {
    if (index < 0 || index >= messages.length) {
      return 60; // 현실적인 기본 높이
    }

    const message = messages[index];

    // 현실적인 추정값 - measureElement와 큰 차이 없도록
    switch (message.message_type) {
      case 'image':
        return 220; // 이미지 현실적 추정 높이
      case 'file':
        return 80; // 파일 현실적 추정 높이
      case 'text':
      default:
        // 텍스트 길이 기반 더 정확한 추정 (자동 줄바꿈 고려)
        const content = message.content || '';

        // 1. 수동 줄바꿈(\n) 계산
        const manualLines = content.split('\n');

        // 2. 각 줄의 자동 줄바꿈 추정 (모바일/데스크탑 구분)
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        const messageMaxWidth = isMobile ? 200 : 320; // 실제 텍스트 영역 넓이
        const avgCharWidth = 8; // 한글/영문 혼합 평균 넓이
        const charsPerLine = Math.floor(messageMaxWidth / avgCharWidth);

        let totalLines = 0;
        manualLines.forEach(line => {
          if (line.length === 0) {
            totalLines += 1; // 빈 줄
          } else {
            // 자동 줄바꿈 추정
            const wrappedLines = Math.ceil(line.length / charsPerLine);
            totalLines += wrappedLines;
          }
        });

        // 3. 최종 높이 계산 (여유있게)
        const lineHeight = 24; // 실제 line-height
        return 40 + (totalLines - 1) * lineHeight;
    }
  }, []);

  return { estimateSize, estimateHeight };
}