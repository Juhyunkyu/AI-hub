"use client";

import { useEffect, useRef, useState } from "react";
import { MapViewProps, LocationData } from "./types";
import { loadKakaoMaps } from "@/lib/kakao-maps-loader";

const SEOUL_CENTER = { lat: 37.5665, lng: 126.9780 };

export function MapView({ selectedLocation, onLocationClick }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerInstance = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Kakao Maps SDK 로드 및 지도 초기화
  useEffect(() => {
    let isCancelled = false;

    const initializeMap = async () => {
      try {
        // 새로운 로더를 사용하여 SDK 로드
        const kakaoAPI = await loadKakaoMaps();

        // 컴포넌트가 언마운트된 경우 중단
        if (isCancelled || !mapRef.current) return;

        // 이미 초기화된 경우 중단
        if (mapInstance.current) return;

        const options = {
          center: new kakaoAPI.maps.LatLng(SEOUL_CENTER.lat, SEOUL_CENTER.lng),
          level: 8, // 서울시 전체가 보이는 레벨
        };

        mapInstance.current = new kakaoAPI.maps.Map(mapRef.current, options);
        setIsMapReady(true);
        setMapError(null);

      } catch (error) {
        if (!isCancelled) {
          console.error("지도 초기화 실패:", error);
          setMapError(error instanceof Error ? error.message : "지도를 로딩할 수 없습니다");
          setIsMapReady(false);
        }
      }
    };

    initializeMap();

    // Cleanup 함수
    return () => {
      isCancelled = true;
      if (mapInstance.current) {
        mapInstance.current = null;
      }
      if (markerInstance.current) {
        markerInstance.current.setMap(null);
        markerInstance.current = null;
      }
      setIsMapReady(false);
    };
  }, []);

  // 선택된 위치로 지도 이동 및 마커 표시
  useEffect(() => {
    if (!mapInstance.current || !selectedLocation) return;

    const { x, y } = selectedLocation;
    const position = new window.kakao.maps.LatLng(parseFloat(y), parseFloat(x));

    // 기존 마커 제거
    if (markerInstance.current) {
      markerInstance.current.setMap(null);
    }

    // 새 마커 생성
    markerInstance.current = new window.kakao.maps.Marker({
      position,
      map: mapInstance.current,
    });

    // 지도 중심 이동 (애니메이션)
    mapInstance.current.panTo(position);

    // 적절한 줌 레벨로 조정
    mapInstance.current.setLevel(3);
  }, [selectedLocation]);

  return (
    <div className="relative h-full w-full">
      <div
        ref={mapRef}
        className="h-full w-full rounded-lg border border-border"
        style={{ minHeight: "300px" }}
      />

      {/* 에러 상태 */}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 rounded-lg">
          <div className="text-center p-4">
            <div className="text-sm text-destructive font-medium mb-2">
              지도 로딩 실패
            </div>
            <div className="text-xs text-muted-foreground">
              {mapError}
            </div>
          </div>
        </div>
      )}

      {/* 로딩 상태 */}
      {!isMapReady && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
            <div className="text-sm text-muted-foreground">
              지도를 로딩 중...
            </div>
          </div>
        </div>
      )}

      {/* 지도가 준비되었지만 위치가 선택되지 않은 상태 */}
      {isMapReady && !selectedLocation && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80 rounded-lg pointer-events-none">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">
              장소를 검색하여 지도에서 확인하세요
            </div>
          </div>
        </div>
      )}
    </div>
  );
}