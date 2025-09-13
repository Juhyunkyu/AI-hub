"use client";

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // 페이지 로드 후 Service Worker 등록
      window.addEventListener('load', async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
          });

          console.log('🚀 Service Worker registered successfully:', registration.scope);

          // 업데이트 확인
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              console.log('📦 New Service Worker installing...');
              
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('🔄 New Service Worker available, refresh to update');
                  } else {
                    console.log('✅ Service Worker installed for the first time');
                  }
                }
              });
            }
          });

          // 백그라운드 동기화 지원
          if ('sync' in window.ServiceWorkerRegistration.prototype) {
            console.log('📲 Background sync supported');
          }

          // 푸시 알림 지원 확인
          if ('PushManager' in window) {
            console.log('🔔 Push messaging supported');
          }

        } catch (error) {
          console.error('❌ Service Worker registration failed:', error);
        }
      });

      // 캐시 무효화 헬퍼 함수 전역 등록
      window.invalidateChatCache = (pattern: string) => {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'INVALIDATE_CHAT_CACHE',
            pattern
          });
          console.log(`🗑️ Cache invalidated for pattern: ${pattern}`);
        }
      };

      // Service Worker 메시지 리스너
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('📨 Message from Service Worker:', event.data);
      });

    } else {
      console.warn('⚠️ Service Workers not supported');
    }
  }, []);

  return null; // 렌더링할 UI 없음
}

// 타입 선언
declare global {
  interface Window {
    invalidateChatCache: (pattern: string) => void;
  }
}