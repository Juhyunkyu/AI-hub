import { QueryClient } from '@tanstack/react-query';

// QueryClient 인스턴스 생성 및 설정
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 데이터가 오래되었다고 간주하는 시간 (5분)
      staleTime: 5 * 60 * 1000, // 5 minutes
      // 백그라운드에서 리페치하는 시간 (10분)
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      // 에러 재시도 횟수
      retry: (failureCount, error: any) => {
        // 401, 403, 404 등의 에러는 재시도하지 않음
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // 최대 3번까지 재시도
        return failureCount < 3;
      },
      // 재시도 지연 시간 (지수 백오프)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      // 뮤테이션 에러 재시도 없음 (사용자 액션이므로)
      retry: false,
    },
  },
});