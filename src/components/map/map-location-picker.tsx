"use client";

import { useState, useCallback, useRef } from "react";
import { SearchIcon, XIcon, MapPinIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MapLocationPickerProps, LocationData } from "./types";
import { MapView } from "./map-view";
import { SearchResults } from "./search-results";
import { usePlacesSearch } from "./use-places-search";

export function MapLocationPicker({
  open,
  onOpenChange,
  onLocationSelect,
}: MapLocationPickerProps) {
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debounceTimeout = useRef<NodeJS.Timeout>();

  const {
    results,
    isLoading,
    error,
    searchPlaces,
    clearResults,
  } = usePlacesSearch();

  // 검색 실행 (디바운스)
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }

      if (!query.trim()) {
        clearResults();
        return;
      }

      debounceTimeout.current = setTimeout(() => {
        searchPlaces(query.trim());
      }, 300);
    },
    [searchPlaces, clearResults]
  );

  // 장소 선택
  const handleLocationSelect = useCallback((location: LocationData) => {
    setSelectedLocation(location);
  }, []);

  // 공유하기
  const handleShare = useCallback(() => {
    if (!selectedLocation) return;

    onLocationSelect(selectedLocation);
    toast.success(`${selectedLocation.name} 위치가 공유되었습니다`);
    onOpenChange(false);

    // 상태 리셋
    setSelectedLocation(null);
    setSearchQuery("");
    clearResults();
  }, [selectedLocation, onLocationSelect, onOpenChange, clearResults]);

  // 취소
  const handleCancel = useCallback(() => {
    onOpenChange(false);
    setSelectedLocation(null);
    setSearchQuery("");
    clearResults();
  }, [onOpenChange, clearResults]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[600px] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <MapPinIcon className="h-5 w-5" />
            지도에서 위치 선택
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col">
          {/* 검색창 */}
          <div className="px-6 py-4 border-b">
            <Command className="rounded-lg border border-border">
              <CommandInput
                placeholder="장소를 검색하세요... (예: 세강병원, 서울시청)"
                value={searchQuery}
                onValueChange={handleSearch}
                className="border-0 focus:ring-0"
              />
            </Command>
          </div>

          {/* 메인 컨텐츠 영역 - 50:50 레이아웃 */}
          <div className="flex-1 flex">
            {/* 지도 영역 - 50% */}
            <div className="flex-1 p-6">
              <MapView
                selectedLocation={selectedLocation || undefined}
                onLocationClick={handleLocationSelect}
              />
            </div>

            {/* 검색 결과 영역 - 50% */}
            <div className="flex-1 border-l bg-muted/20 p-6">
              <SearchResults
                results={results}
                selectedId={selectedLocation?.id}
                onSelect={handleLocationSelect}
                isLoading={isLoading}
              />
            </div>
          </div>

          {/* 하단 버튼 */}
          <div className="flex justify-between items-center px-6 py-4 border-t bg-muted/30">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="gap-2"
            >
              <XIcon className="h-4 w-4" />
              취소
            </Button>

            <div className="flex items-center gap-3">
              {selectedLocation && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">{selectedLocation.name}</span> 선택됨
                </div>
              )}
              <Button
                onClick={handleShare}
                disabled={!selectedLocation}
                className="gap-2"
              >
                <MapPinIcon className="h-4 w-4" />
                공유하기
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}