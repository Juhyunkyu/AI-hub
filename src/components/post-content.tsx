"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    kakao?: Kakao;
  }
}

interface Kakao {
  maps?: KakaoMaps;
}

interface KakaoMaps {
  LatLng: new (lat: number, lng: number) => KLatLng;
  Map: new (el: HTMLElement, opts: { center: KLatLng; level: number }) => KMap;
  Marker: new (opts: { position: KLatLng }) => KMarker;
  InfoWindow: new (opts: { content: string }) => KInfoWindow;
  load(cb: () => void): void;
}

type KLatLng = unknown;
type KMap = unknown;
interface KMarker {
  setMap(map: KMap): void;
}
interface KInfoWindow {
  open(map: KMap, marker: KMarker): void;
}

export function PostContent({ html }: { html: string }) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function initMaps() {
      const maps = window.kakao?.maps;
      if (!maps) return;
      const nodes = document.querySelectorAll<HTMLElement>(
        ".kakao-map[data-provider='kakao']"
      );
      nodes.forEach((el) => {
        const lat = parseFloat(el.dataset.lat || "0");
        const lng = parseFloat(el.dataset.lng || "0");
        const name = el.dataset.name || "장소";
        const zoom = parseInt(el.dataset.zoom || "3", 10);
        if (!isFinite(lat) || !isFinite(lng)) return;
        if (!el.style.height) el.style.height = "240px";
        if (!el.style.borderRadius) el.style.borderRadius = "8px";
        const center = new maps.LatLng(lat, lng);
        const map = new maps.Map(el, { center, level: zoom });
        const marker = new maps.Marker({ position: center });
        marker.setMap(map);
        const iw = new maps.InfoWindow({
          content: `<div style='padding:6px 8px'>${name}</div>`,
        });
        iw.open(map, marker);
      });
    }

    if (window.kakao?.maps) {
      window.kakao.maps.load(initMaps);
    } else {
      const key = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
      if (key) {
        const src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`;
        const existed = document.querySelector(
          `script[src^='https://dapi.kakao.com/v2/maps/sdk.js']`
        );
        if (existed) {
          window.kakao?.maps?.load?.(initMaps);
        } else {
          const s = document.createElement("script");
          s.src = src;
          s.async = true;
          s.onload = () => {
            window.kakao?.maps?.load?.(initMaps);
          };
          document.head.appendChild(s);
        }
      }
    }

    // 목록 스타일 보정: Tailwind Typography 미적용 환경에서도 불릿/넘버링 표시
    const root = rootRef.current;
    if (root) {
      root.querySelectorAll<HTMLUListElement>("ul").forEach((ul) => {
        ul.classList.add("list-disc", "pl-6", "my-2");
      });
      root.querySelectorAll<HTMLOListElement>("ol").forEach((ol) => {
        ol.classList.add("list-decimal", "pl-6", "my-2");
      });
    }
  }, [html]);

  return (
    <div
      ref={rootRef}
      className="prose dark:prose-invert max-w-none text-sm sm:text-base"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
