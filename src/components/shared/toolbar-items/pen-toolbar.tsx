"use client";

import React, { useState, useRef, useEffect } from "react";
import { Pen, Eraser, Trash2, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useResponsive } from "@/hooks/use-responsive";
import { ToolbarButton } from './toolbar-button';

interface PenToolbarProps {
  tool: 'pen' | 'eraser';
  color: string;
  onToolChange: (tool: 'pen' | 'eraser') => void;
  onColorChange: (color: string) => void;
  onClearAll: () => void;
  onBack: () => void;
}

export function PenToolbar({
  tool,
  color,
  onToolChange,
  onColorChange,
  onClearAll,
  onBack
}: PenToolbarProps) {
  const { isMobile } = useResponsive();
  const colors = [
    '#000000', // 검정
    '#FF0000', // 빨강
    '#0000FF', // 파랑
    '#FFFF00', // 노랑
    '#00FF00', // 초록
    '#FFFFFF', // 하양
  ];

  const [isDragging, setIsDragging] = useState(false);
  const colorButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // 드래그 스크롤 상태
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isScrollDragging, setIsScrollDragging] = useState(false);
  const [scrollStart, setScrollStart] = useState({ x: 0, scrollLeft: 0 });

  // 전역 마우스 업 이벤트 (드래그 중 마우스를 떼면 종료)
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setIsScrollDragging(false);
    };
    const handleGlobalTouchEnd = () => setIsDragging(false);

    if (isDragging || isScrollDragging) {
      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('touchend', handleGlobalTouchEnd);
    }

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isDragging, isScrollDragging]);


  // 드래그 스크롤 핸들러
  const handleScrollMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsScrollDragging(true);
    setScrollStart({
      x: e.pageX - scrollContainerRef.current.offsetLeft,
      scrollLeft: scrollContainerRef.current.scrollLeft
    });
  };

  const handleScrollMouseMove = (e: React.MouseEvent) => {
    if (!isScrollDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - scrollStart.x) * 2; // 스크롤 속도 조절
    scrollContainerRef.current.scrollLeft = scrollStart.scrollLeft - walk;
  };

  return (
    <div
      ref={scrollContainerRef}
      className="w-full overflow-x-auto scrollbar-hide touch-pan-x cursor-grab active:cursor-grabbing"
      onMouseDown={handleScrollMouseDown}
      onMouseMove={handleScrollMouseMove}
      onMouseLeave={() => setIsScrollDragging(false)}
    >
      <div className="flex items-center gap-1.5 px-4 min-w-max">
        {/* 뒤로가기 버튼 */}
        <ToolbarButton
          icon={ChevronLeft}
          label="뒤로가기"
          onClick={onBack}
        />

        {/* 펜/지우개 토글 */}
        <ToolbarButton
          icon={Pen}
          label="펜"
          isActive={tool === 'pen'}
          onClick={() => onToolChange('pen')}
        />

        <ToolbarButton
          icon={Eraser}
          label="지우개"
          isActive={tool === 'eraser'}
          onClick={() => onToolChange('eraser')}
        />

        <div className="w-px h-7 bg-white/30 mx-0.5 flex-shrink-0" />

        {/* 색상 팔레트 - 가로 스크롤 + 드래그 지원 */}
        {colors.map((c, index) => (
          <button
            key={c}
            ref={(el) => { colorButtonsRef.current[index] = el; }}
            onClick={() => {
              onColorChange(c);
            }}
            onMouseDown={() => {
              setIsDragging(true);
              onColorChange(c);
            }}
            onMouseEnter={() => {
              if (isDragging) {
                onColorChange(c);
              }
            }}
            onMouseUp={() => {
              setIsDragging(false);
            }}
            onTouchStart={() => {
              setIsDragging(true);
              onColorChange(c);
            }}
            onTouchMove={(e) => {
              if (isDragging) {
                // 터치 위치의 요소 찾기
                const touch = e.touches[0];
                const element = document.elementFromPoint(touch.clientX, touch.clientY);
                const buttonIndex = colorButtonsRef.current.findIndex(btn => btn === element);
                if (buttonIndex !== -1) {
                  onColorChange(colors[buttonIndex]);
                }
              }
            }}
            onTouchEnd={() => {
              setIsDragging(false);
            }}
            className={cn(
              "rounded-full border-2 transition-all flex-shrink-0 cursor-pointer",
              isMobile ? "h-7 w-7" : "h-9 w-9",  // 모바일: 28px, 데스크톱: 36px
              color === c
                ? "border-white scale-110 shadow-lg shadow-white/50"
                : "border-white/30 hover:border-white/50"
            )}
            style={{ backgroundColor: c }}
            aria-label={`색상 ${c}`}
          />
        ))}

        {/* 전체 지우기 */}
        <ToolbarButton
          icon={Trash2}
          label="전체 지우기"
          variant="destructive"
          onClick={onClearAll}
        />
      </div>
    </div>
  );
}
