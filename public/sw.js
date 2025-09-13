// 채팅 전용 Service Worker - 카카오톡 스타일 캐싱

const CACHE_NAME = 'chat-cache-v1';
const CHAT_API_CACHE = 'chat-api-cache-v1';

// 캐시할 리소스들
const urlsToCache = [
  '/',
  '/chat',
  '/api/chat/rooms',
  '/api/chat/messages'
];

// 설치 이벤트
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch 이벤트 - 네트워크 우선, 캐시 폴백
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 채팅 API 요청 처리
  if (url.pathname.startsWith('/api/chat/')) {
    event.respondWith(handleChatAPI(request));
  } else {
    // 일반 요청은 기본 캐시 전략
    event.respondWith(handleDefault(request));
  }
});

// 채팅 API 전용 캐싱 전략
async function handleChatAPI(request) {
  const url = new URL(request.url);
  const cacheKey = `${url.pathname}${url.search}`;
  
  try {
    // 1. 캐시에서 먼저 확인 (즉시 응답)
    const cache = await caches.open(CHAT_API_CACHE);
    const cachedResponse = await cache.match(cacheKey);
    
    if (cachedResponse) {
      // 캐시된 응답 즉시 반환
      const clonedResponse = cachedResponse.clone();
      
      // 백그라운드에서 최신 데이터 요청
      updateCache(request, cache, cacheKey);
      
      return clonedResponse;
    }
    
    // 2. 캐시에 없으면 네트워크 요청
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // 응답을 캐시에 저장
      cache.put(cacheKey, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('Chat API fetch failed:', error);
    
    // 네트워크 실패시 캐시 확인
    const cache = await caches.open(CHAT_API_CACHE);
    const cachedResponse = await cache.match(cacheKey);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // 둘 다 실패시 에러 응답
    return new Response(
      JSON.stringify({ error: 'Network unavailable' }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// 백그라운드 캐시 업데이트
async function updateCache(request, cache, cacheKey) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(cacheKey, networkResponse.clone());
    }
  } catch (error) {
    console.error('Background cache update failed:', error);
  }
}

// 기본 캐싱 전략
async function handleDefault(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    return cache.match(request);
  }
}

// 메시지 이벤트 처리 (앱에서 캐시 무효화 요청)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'INVALIDATE_CHAT_CACHE') {
    invalidateChatCache(event.data.pattern);
  }
});

async function invalidateChatCache(pattern) {
  const cache = await caches.open(CHAT_API_CACHE);
  const keys = await cache.keys();
  
  for (const request of keys) {
    const url = new URL(request.url);
    if (url.pathname.includes(pattern)) {
      await cache.delete(request);
    }
  }
}