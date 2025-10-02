"use client";

import { MapPinIcon, PhoneIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchResultsProps, LocationData } from "./types";
import { cn } from "@/lib/utils";

export function SearchResults({
  results,
  selectedId,
  onSelect,
  isLoading = false,
  error,
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground px-1">
          검색 중...
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <MapPinIcon className="h-6 w-6 text-destructive" />
        </div>
        <div className="text-sm text-destructive font-medium mb-2">
          검색 중 오류가 발생했습니다
        </div>
        <div className="text-xs text-muted-foreground">
          {error}
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MapPinIcon className="h-12 w-12 text-muted-foreground mb-4" />
        <div className="text-sm text-muted-foreground">
          검색 결과가 없습니다
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          다른 키워드로 검색해보세요
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground px-1">
        {results.length}개의 검색 결과
      </div>
      <ScrollArea className="h-[300px]">
        <div className="space-y-2 pr-2">
          {results.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              isSelected={selectedId === location.id}
              onSelect={() => onSelect(location)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

interface LocationCardProps {
  location: LocationData;
  isSelected: boolean;
  onSelect: () => void;
}

function LocationCard({ location, isSelected, onSelect }: LocationCardProps) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:shadow-md",
        isSelected && "ring-2 ring-primary bg-primary/5"
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            <MapPinIcon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="font-medium text-sm leading-tight">
              {location.name}
            </div>
            <div className="text-xs text-muted-foreground leading-tight">
              {location.address}
            </div>
            {location.category && (
              <div className="text-xs text-muted-foreground">
                {location.category}
              </div>
            )}
            {location.phone && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <PhoneIcon className="h-3 w-3" />
                {location.phone}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}