"use client";

import React, { useState, useCallback } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MapLocationPicker } from "@/components/map/map-location-picker";
import { LocationData } from "@/components/map/types";
import { toast } from "sonner";

export interface LocationOptionProps {
  onLocationSelect?: (location: LocationData) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

export function LocationOption({
  onLocationSelect,
  onError,
  disabled = false,
  className,
}: LocationOptionProps) {
  const [showMapPicker, setShowMapPicker] = useState(false);

  // 위치 선택 처리
  const handleLocationSelect = useCallback((location: LocationData) => {
    if (onLocationSelect) {
      onLocationSelect(location);
      toast.success(`${location.name} 위치가 선택되었습니다`);
    } else {
      // 기본 동작: 위치 정보를 클립보드에 복사
      const locationText = `📍 ${location.name}\n${location.address}${location.phone ? `\n📞 ${location.phone}` : ''}`;
      navigator.clipboard.writeText(locationText).then(() => {
        toast.success("위치 정보가 클립보드에 복사되었습니다");
      }).catch(() => {
        toast.error("클립보드 복사에 실패했습니다");
      });
    }
    setShowMapPicker(false);
  }, [onLocationSelect]);

  // 에러 처리
  const handleError = useCallback((error: string) => {
    onError?.(error);
    toast.error(error);
  }, [onError]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowMapPicker(true)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 w-full justify-start h-12 px-4",
          "hover:bg-accent hover:text-accent-foreground",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        aria-label="위치 공유"
      >
        <MapPin className="w-5 h-5 text-primary" />
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium">위치 공유</span>
          <span className="text-xs text-muted-foreground">지도에서 위치 선택</span>
        </div>
      </Button>

      {/* 지도 위치 선택 모달 */}
      <MapLocationPicker
        open={showMapPicker}
        onOpenChange={setShowMapPicker}
        onLocationSelect={handleLocationSelect}
      />
    </>
  );
}

// 간단한 지도 버튼 (아이콘만)
export function SimpleLocationButton({
  onLocationSelect,
  disabled = false,
  className,
}: {
  onLocationSelect?: (location: LocationData) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [showMapPicker, setShowMapPicker] = useState(false);

  const handleLocationSelect = useCallback((location: LocationData) => {
    onLocationSelect?.(location);
    setShowMapPicker(false);
  }, [onLocationSelect]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowMapPicker(true)}
        disabled={disabled}
        className={cn(
          "w-10 h-10 p-0 rounded-full",
          "hover:bg-accent hover:text-accent-foreground",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        aria-label="위치 공유"
      >
        <MapPin className="w-4 h-4" />
      </Button>

      <MapLocationPicker
        open={showMapPicker}
        onOpenChange={setShowMapPicker}
        onLocationSelect={handleLocationSelect}
      />
    </>
  );
}