"use client";

import { useState, useCallback } from "react";
import type { LocationData } from "./types";
import { loadKakaoMaps } from "@/lib/kakao-maps-loader";

export function usePlacesSearch() {
  const [results, setResults] = useState<LocationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchPlaces = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 새로운 로더를 사용하여 SDK 로드
      const kakaoAPI = await loadKakaoMaps();

      // Places 서비스 초기화
      const places = new kakaoAPI.maps.services.Places();

      // 검색 실행
      await new Promise<void>((resolve, reject) => {
        places.keywordSearch(
          query,
          (data: any[], status: string) => {
            if (status === kakaoAPI.maps.services.Status.OK) {
              const locationResults: LocationData[] = data.map((place) => ({
                id: place.id,
                name: place.place_name,
                address: place.address_name || place.road_address_name || "",
                category: place.category_name,
                phone: place.phone || "",
                url: place.place_url || "",
                x: place.x, // longitude
                y: place.y, // latitude
              }));

              setResults(locationResults);
              resolve();
            } else if (status === kakaoAPI.maps.services.Status.ZERO_RESULT) {
              setResults([]);
              resolve();
            } else {
              reject(new Error("검색 중 오류가 발생했습니다"));
            }
          },
          {
            // 전국 검색을 위해 location과 radius 제거
            // Context7 문서 기반 권장: 키워드 검색 시 지역 제한 없이 검색
            size: 15, // 최대 결과 수
          }
        );
      });
    } catch (error) {
      console.error("Places search error:", error);
      const errorMessage = error instanceof Error ? error.message : "검색 중 오류가 발생했습니다";
      setError(errorMessage);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setIsLoading(false);
    setError(null);
  }, []);

  return {
    results,
    isLoading,
    error,
    searchPlaces,
    clearResults,
  };
}