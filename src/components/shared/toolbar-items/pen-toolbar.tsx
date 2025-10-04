"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Pen, Eraser, Trash2, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

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
        <Button
          variant="secondary"
          size="lg"
          onClick={() => {
            onBack();
          }}
          className="h-11 w-11 bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border-none flex-shrink-0"
          aria-label="뒤로가기"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* 펜/지우개 토글 */}
        <Button
          variant="secondary"
          size="lg"
          onClick={() => {
            onToolChange('pen');
          }}
          className={cn(
            "h-11 w-11 backdrop-blur-md border-none transition-all flex-shrink-0",
            tool === 'pen'
              ? "bg-primary text-primary-foreground shadow-lg scale-105"
              : "bg-black/60 hover:bg-black/80 text-white"
          )}
          aria-label="펜"
        >
          <Pen className="h-4 w-4" />
        </Button>

        <Button
          variant="secondary"
          size="lg"
          onClick={() => {
            onToolChange('eraser');
          }}
          className={cn(
            "h-11 w-11 backdrop-blur-md border-none transition-all flex-shrink-0",
            tool === 'eraser'
              ? "bg-primary text-primary-foreground shadow-lg scale-105"
              : "bg-black/60 hover:bg-black/80 text-white"
          )}
          aria-label="지우개"
        >
          <Eraser className="h-4 w-4" />
        </Button>

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
              "h-9 w-9 rounded-full border-2 transition-all flex-shrink-0 cursor-pointer",
              color === c
                ? "border-white scale-110 shadow-lg shadow-white/50"
                : "border-white/30 hover:border-white/50"
            )}
            style={{ backgroundColor: c }}
            aria-label={`색상 ${c}`}
          />
        ))}

        {/* 전체 지우기 */}
        <Button
          variant="destructive"
          size="lg"
          onClick={() => {
            onClearAll();
          }}
          className="h-11 w-11 bg-red-500/80 hover:bg-red-600 text-white backdrop-blur-md border-none flex-shrink-0"
          aria-label="전체 지우기"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
