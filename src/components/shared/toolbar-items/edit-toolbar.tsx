"use client";

import { Filter, Crop, Type, Smile, Pen, ChevronLeft } from "lucide-react";
import { ToolbarButton } from './toolbar-button';

export type EditMode = 'filter' | 'crop' | 'text' | 'emoji' | 'pen';

interface EditToolbarProps {
  activeMode: EditMode | null;
  onModeChange: (mode: EditMode) => void;
  onBack: () => void;
}

export function EditToolbar({ activeMode, onModeChange, onBack }: EditToolbarProps) {
  const tools = [
    { icon: Filter, label: "필터", mode: 'filter' as EditMode },
    { icon: Crop, label: "자르기", mode: 'crop' as EditMode },
    { icon: Type, label: "텍스트", mode: 'text' as EditMode },
    { icon: Smile, label: "이모지", mode: 'emoji' as EditMode },
    { icon: Pen, label: "펜", mode: 'pen' as EditMode },
  ];

  return (
    <div className="flex items-center gap-3">
      {/* 뒤로가기 버튼 */}
      <ToolbarButton
        icon={ChevronLeft}
        label="뒤로가기"
        onClick={onBack}
      />

      {tools.map(({ icon, label, mode }) => (
        <ToolbarButton
          key={mode}
          icon={icon}
          label={label}
          isActive={activeMode === mode}
          onClick={() => onModeChange(mode)}
        />
      ))}
    </div>
  );
}
