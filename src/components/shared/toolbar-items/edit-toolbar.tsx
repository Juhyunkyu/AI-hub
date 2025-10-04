"use client";

import { Button } from "@/components/ui/button";
import { Filter, Crop, Type, Smile, Pen, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="flex items-center gap-2">
      {/* 뒤로가기 버튼 */}
      <Button
        variant="secondary"
        size="lg"
        onClick={(e) => {
          e.stopPropagation();
          onBack();
        }}
        className="flex-col h-16 w-16 gap-1 bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border-none transition-all"
        aria-label="뒤로가기"
      >
        <ChevronLeft className="h-6 w-6" />
        <span className="text-xs">뒤로</span>
      </Button>

      {tools.map(({ icon: Icon, label, mode }) => (
        <Button
          key={mode}
          variant="secondary"
          size="lg"
          onClick={(e) => {
            e.stopPropagation();
            onModeChange(mode);
          }}
          className={cn(
            "flex-col h-16 w-16 gap-1 backdrop-blur-md border-none transition-all",
            activeMode === mode
              ? "bg-primary text-primary-foreground shadow-lg scale-105"
              : "bg-black/60 hover:bg-black/80 text-white"
          )}
        >
          <Icon className="h-5 w-5" />
          <span className="text-xs">{label}</span>
        </Button>
      ))}
    </div>
  );
}
