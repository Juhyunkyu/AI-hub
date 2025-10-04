"use client";

import { BaseToolbar } from './toolbar-items/base-toolbar';
import { EditToolbar, type EditMode } from './toolbar-items/edit-toolbar';
import { PenToolbar } from './toolbar-items/pen-toolbar';

type ViewMode =
  | 'view'        // 기본: 작성자 정보 + 하단 기본 툴바
  | 'imageOnly'   // 이미지만 (UI 숨김)
  | 'editSelect'  // 편집 선택
  | 'editPen'     // 펜 편집
  | 'editFilter'  // 필터 편집
  | 'editCrop'    // 자르기 편집
  | 'editText'    // 텍스트 편집
  | 'editEmoji';  // 이모지 편집

interface LightboxToolbarProps {
  viewMode: ViewMode;
  visible: boolean;

  // Base toolbar handlers
  onDownload: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onEdit: () => void;
  onBack: () => void;

  // Edit toolbar handlers
  activeEditMode: EditMode | null;
  onEditModeChange: (mode: EditMode) => void;

  // Pen toolbar handlers
  penTool: 'pen' | 'eraser';
  penColor: string;
  onPenToolChange: (tool: 'pen' | 'eraser') => void;
  onPenColorChange: (color: string) => void;
  onClearAllDrawing: () => void;
}

export function LightboxToolbar({
  viewMode,
  visible,
  onDownload,
  onShare,
  onDelete,
  onEdit,
  onBack,
  activeEditMode,
  onEditModeChange,
  penTool,
  penColor,
  onPenToolChange,
  onPenColorChange,
  onClearAllDrawing
}: LightboxToolbarProps) {
  if (!visible) return null;

  return (
    <div className="flex justify-center w-full">
      {/* 기본 뷰: 기본 툴바 */}
      {viewMode === 'view' && (
        <BaseToolbar
          onDownload={onDownload}
          onShare={onShare}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      )}

      {/* 편집 선택 모드: 편집 툴바 */}
      {viewMode === 'editSelect' && (
        <EditToolbar
          activeMode={activeEditMode}
          onModeChange={onEditModeChange}
          onBack={onBack}
        />
      )}

      {/* 펜 편집 모드: 펜 툴바 */}
      {viewMode === 'editPen' && (
        <PenToolbar
          tool={penTool}
          color={penColor}
          onToolChange={onPenToolChange}
          onColorChange={onPenColorChange}
          onClearAll={onClearAllDrawing}
          onBack={onBack}
        />
      )}

      {/* 다른 편집 모드들 (필터, 자르기, 텍스트, 이모지)는 추후 구현 */}
    </div>
  );
}
