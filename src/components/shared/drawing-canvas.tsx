"use client";

import { useState, useEffect } from "react";

// 전역 Canvas 투명 스타일
if (typeof window !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    .konvajs-content canvas {
      background: transparent !important;
    }
  `;
  if (!document.querySelector('style[data-canvas-transparent]')) {
    style.setAttribute('data-canvas-transparent', 'true');
    document.head.appendChild(style);
  }
}

export interface DrawLine {
  tool: 'pen' | 'eraser';
  points: number[];
  color: string;
  width: number;
}

interface DrawingCanvasProps {
  stageRef: any;
  lines: DrawLine[];
  width: number;
  height: number;
  rotation: number;  // 회전 각도 (0, 90, 180, 270)
  onMouseDown: (e: any) => void;
  onMouseMove: (e: any) => void;
  onMouseUp: () => void;
}

export function DrawingCanvas({
  stageRef,
  lines,
  width,
  height,
  rotation,
  onMouseDown,
  onMouseMove,
  onMouseUp
}: DrawingCanvasProps) {
  const [Konva, setKonva] = useState<any>(null);

  useEffect(() => {
    // 동적으로 react-konva 로드 (Next.js SSR 호환)
    import('react-konva').then((module) => {
      setKonva(module);
    });
  }, []);

  useEffect(() => {
    // 모든 Canvas 요소를 투명하게 설정 (Konva는 여러 레이어 생성)
    if (stageRef.current) {
      const canvases = stageRef.current.content?.getElementsByTagName('canvas');
      if (canvases && canvases.length > 0) {
        Array.from(canvases).forEach((canvas: any) => {
          canvas.style.backgroundColor = 'transparent';
          canvas.style.opacity = '1'; // 완전 불투명하게 유지 (그림만)
        });
        console.log(`✅ ${canvases.length} Canvas layers set to transparent`);
      }
    }
  }, [stageRef, Konva, lines]); // lines 변경 시에도 재적용

  if (!Konva) {
    return null; // 로딩 중에는 아무것도 표시하지 않음 (투명)
  }

  const { Stage, Layer, Line } = Konva;

  // 회전에 따라 Stage의 offset 계산 (중심 기준 회전)
  const getStageOffset = () => {
    switch (rotation % 360) {
      case 90:
        return { x: height, y: 0 };
      case 180:
        return { x: width, y: height };
      case 270:
        return { x: 0, y: width };
      default:
        return { x: 0, y: 0 };
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: 'auto',
        background: 'transparent' // 래퍼도 투명
      }}
    >
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        rotation={rotation}
        offsetX={getStageOffset().x}
        offsetY={getStageOffset().y}
        listening={true}
        // ✅ 핵심: clearBeforeDraw를 false로 설정하여 배경 클리어 방지
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onTouchStart={onMouseDown}
        onTouchMove={onMouseMove}
        onTouchEnd={onMouseUp}
      >
        <Layer
          listening={true}
          clearBeforeDraw={false} // ✅ 레이어 클리어 방지
        >
          {lines.map((line, i) => (
            <Line
              key={i}
              points={line.points}
              stroke={line.tool === 'eraser' ? 'white' : line.color}
              strokeWidth={line.width}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
              globalCompositeOperation={
                line.tool === 'eraser' ? 'destination-out' : 'source-over'
              }
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
