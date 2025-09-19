import { useState, useEffect } from 'react';

/**
 * 반응형 화면 크기 감지 훅
 * 768px을 기준으로 모바일/데스크탑을 구분
 */
export function useResponsive() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { isMobile };
}