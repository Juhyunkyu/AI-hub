"use client";

import React, { useCallback, useState, useEffect } from "react";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { LocationOptionProps, LocationData } from "./types";

export function LocationOption({
  onLocationSelect,
  onError,
  disabled = false,
  className,
}: LocationOptionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // 현재 위치 가져오기
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      const error = "이 브라우저에서는 위치 서비스를 지원하지 않습니다.";
      setLocationError(error);
      onError?.(error);
      return;
    }

    setIsLoading(true);
    setLocationError(null);

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000, // 1분간 캐시된 위치 정보 사용
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          // 주소 정보 가져오기 (역지오코딩)
          const address = await getAddressFromCoords(latitude, longitude);

          const locationData: LocationData = {
            latitude,
            longitude,
            address,
            placeName: "현재 위치",
            mapUrl: `https://map.kakao.com/link/map/${latitude},${longitude}`,
          };

          setCurrentLocation(locationData);
          setIsLoading(false);
        } catch (error) {
          setIsLoading(false);
          const errorMessage = "위치 정보를 처리하는 중 오류가 발생했습니다.";
          setLocationError(errorMessage);
          onError?.(errorMessage);
        }
      },
      (error) => {
        setIsLoading(false);
        let errorMessage = "위치 정보를 가져올 수 없습니다.";

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "위치 접근 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "위치 정보를 사용할 수 없습니다.";
            break;
          case error.TIMEOUT:
            errorMessage = "위치 정보 요청이 시간 초과되었습니다.";
            break;
        }

        setLocationError(errorMessage);
        onError?.(errorMessage);
      },
      options
    );
  }, [onError]);

  // 좌표를 주소로 변환 (Kakao API 대신 간단한 형태로)
  const getAddressFromCoords = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      // 실제 프로덕션에서는 Kakao Geocoder API를 사용해야 합니다
      // 여기서는 간단한 형태로 구현
      return `위도: ${lat.toFixed(6)}, 경도: ${lng.toFixed(6)}`;
    } catch (error) {
      return `위도: ${lat.toFixed(6)}, 경도: ${lng.toFixed(6)}`;
    }
  }, []);

  // 위치 공유 버튼 클릭
  const handleLocationClick = useCallback(() => {
    if (disabled) return;
    setShowLocationDialog(true);
    getCurrentLocation();
  }, [disabled, getCurrentLocation]);

  // 위치 선택 확인
  const handleLocationConfirm = useCallback(() => {
    if (currentLocation) {
      onLocationSelect(currentLocation);
      setShowLocationDialog(false);
      setCurrentLocation(null);
      setLocationError(null);
    }
  }, [currentLocation, onLocationSelect]);

  // 다이얼로그 닫기
  const handleDialogClose = useCallback(() => {
    setShowLocationDialog(false);
    setCurrentLocation(null);
    setLocationError(null);
    setIsLoading(false);
  }, []);

  return (
    <>
      {/* 위치 공유 버튼 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLocationClick}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 w-full justify-start h-12 px-4",
          "hover:bg-accent hover:text-accent-foreground",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        aria-label="위치 공유"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-600">
          <MapPin className="w-4 h-4" />
        </div>
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium">지도</span>
          <span className="text-xs text-muted-foreground">
            현재 위치 공유
          </span>
        </div>
      </Button>

      {/* 위치 선택 다이얼로그 */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              위치 공유
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* 로딩 상태 */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">
                  현재 위치를 가져오는 중...
                </span>
              </div>
            )}

            {/* 에러 상태 */}
            {locationError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{locationError}</AlertDescription>
              </Alert>
            )}

            {/* 위치 정보 표시 */}
            {currentLocation && !isLoading && (
              <div className="space-y-3">
                <div className="p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-red-500 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="font-medium text-sm">{currentLocation.placeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {currentLocation.address}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDialogClose}
                  >
                    취소
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleLocationConfirm}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    위치 공유
                  </Button>
                </div>
              </div>
            )}

            {/* 재시도 버튼 */}
            {locationError && !isLoading && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={getCurrentLocation}
                  className="gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  다시 시도
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// 간단한 위치 버튼 (다이얼로그 없이 바로 현재 위치 공유)
export function QuickLocationButton({
  onLocationSelect,
  onError,
  disabled = false,
  className,
}: LocationOptionProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleQuickLocation = useCallback(() => {
    if (disabled || !navigator.geolocation) {
      onError?.("위치 서비스를 사용할 수 없습니다.");
      return;
    }

    setIsLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const locationData: LocationData = {
          latitude,
          longitude,
          address: `위도: ${latitude.toFixed(6)}, 경도: ${longitude.toFixed(6)}`,
          placeName: "현재 위치",
          mapUrl: `https://map.kakao.com/link/map/${latitude},${longitude}`,
        };

        onLocationSelect(locationData);
        setIsLoading(false);
      },
      (error) => {
        setIsLoading(false);
        onError?.("위치 정보를 가져올 수 없습니다.");
      }
    );
  }, [disabled, onLocationSelect, onError]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleQuickLocation}
      disabled={disabled || isLoading}
      className={cn(
        "flex items-center gap-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      aria-label="빠른 위치 공유"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <MapPin className="w-4 h-4" />
      )}
      위치 공유
    </Button>
  );
}