/**
 * Kakao Maps SDK 로더 - 글로벌 싱글톤 패턴
 * 중복 로딩 방지 및 견고한 오류 처리
 */

declare global {
  interface Window {
    kakao: any;
  }
}

export interface KakaoMapsAPI {
  maps: any;
  services: any;
}

class KakaoMapsLoader {
  private static instance: KakaoMapsLoader;
  private loadPromise: Promise<KakaoMapsAPI> | null = null;
  private isLoaded = false;
  private apiKey: string;

  private constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY || '';
    if (!this.apiKey) {
      console.warn('NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY가 설정되지 않았습니다');
    }
  }

  public static getInstance(): KakaoMapsLoader {
    if (!KakaoMapsLoader.instance) {
      KakaoMapsLoader.instance = new KakaoMapsLoader();
    }
    return KakaoMapsLoader.instance;
  }

  /**
   * Kakao Maps SDK 로드
   */
  public async load(): Promise<KakaoMapsAPI> {
    // 이미 로드됨
    if (this.isLoaded && window.kakao?.maps?.services) {
      return {
        maps: window.kakao.maps,
        services: window.kakao.maps.services,
      };
    }

    // 이미 로딩 중인 경우 기존 Promise 반환
    if (this.loadPromise) {
      return this.loadPromise;
    }

    // 새로운 로딩 Promise 생성
    this.loadPromise = this._loadScript();
    return this.loadPromise;
  }

  private async _loadScript(): Promise<KakaoMapsAPI> {
    return new Promise((resolve, reject) => {
      // API 키 체크
      if (!this.apiKey) {
        reject(new Error('Kakao Maps API 키가 설정되지 않았습니다'));
        return;
      }

      // 이미 존재하는 스크립트 확인
      const existingScript = document.querySelector('script[src*="dapi.kakao.com"]');
      if (existingScript) {
        // 기존 스크립트가 있으면 로딩 완료까지 대기
        this._waitForLoad(resolve, reject);
        return;
      }

      // 새 스크립트 생성
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${this.apiKey}&libraries=services&autoload=false`;
      script.async = true;

      // 로딩 성공
      script.onload = () => {
        this._waitForLoad(resolve, reject);
      };

      // 로딩 실패
      script.onerror = (error) => {
        console.error('Kakao Maps SDK 로딩 실패:', error);
        reject(new Error('Kakao Maps SDK 스크립트 로딩에 실패했습니다'));
      };

      document.head.appendChild(script);
    });
  }

  private _waitForLoad(resolve: (value: KakaoMapsAPI) => void, reject: (reason?: any) => void): void {
    // 이벤트 기반 접근 - setTimeout 제거
    const handleLoad = () => {
      if (window.kakao && window.kakao.maps) {
        // autoload=false이므로 수동으로 load 호출
        window.kakao.maps.load(() => {
          if (window.kakao.maps.services) {
            this.isLoaded = true;
            resolve({
              maps: window.kakao.maps,
              services: window.kakao.maps.services,
            });
          } else {
            reject(new Error('Kakao Maps services 라이브러리를 찾을 수 없습니다'));
          }
        });
      } else {
        // Promise-based 재시도
        Promise.resolve().then(() => {
          if (window.kakao && window.kakao.maps) {
            handleLoad();
          } else {
            reject(new Error('Kakao Maps SDK 로딩 실패'));
          }
        });
      }
    };

    handleLoad();
  }

  /**
   * SDK가 로드되었는지 확인
   */
  public isReady(): boolean {
    return this.isLoaded && !!window.kakao?.maps?.services;
  }

  /**
   * 로딩 상태 초기화 (개발 환경에서 테스트용)
   */
  public reset(): void {
    this.isLoaded = false;
    this.loadPromise = null;
  }
}

// 싱글톤 인스턴스 export
export const kakaoMapsLoader = KakaoMapsLoader.getInstance();

// 편의 함수들
export const loadKakaoMaps = () => kakaoMapsLoader.load();
export const isKakaoMapsReady = () => kakaoMapsLoader.isReady();