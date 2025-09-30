import type { NextConfig } from "next";

// Bundle Analyzer 설정 (조건부 활성화)
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

// Derive Supabase hostname for remote image optimization, if configured
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let imagesConfig: NextConfig["images"] | undefined = undefined;
try {
  if (supabaseUrl) {
    const { hostname, protocol } = new URL(supabaseUrl);
    const patterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
      {
        protocol: (protocol?.replace(":", "") as "http" | "https") || "https",
        hostname,
      },
    ];

    const extraDomains = (process.env.NEXT_PUBLIC_IMAGE_DOMAINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const d of extraDomains) {
      try {
        // Allow raw hostname or full URL
        if (d.includes("http://") || d.includes("https://")) {
          const u = new URL(d);
          patterns.push({
            protocol: (u.protocol.replace(":", "") as "http" | "https") || "https",
            hostname: u.hostname,
          });
        } else {
          patterns.push({ protocol: "https", hostname: d });
        }
      } catch {}
    }

    imagesConfig = { remotePatterns: patterns };
  }
} catch {
  // ignore invalid URL; keep default image config
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: imagesConfig,

  // Security headers including CSP for OAuth
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-eval' 'unsafe-inline' https://dapi.kakao.com;
              style-src 'self' 'unsafe-inline';
              img-src 'self' data: blob: https:;
              font-src 'self' data:;
              connect-src 'self'
                https://vzrtznpmbanzjbfyjkcb.supabase.co
                https://*.supabase.co
                wss://vzrtznpmbanzjbfyjkcb.supabase.co
                wss://*.supabase.co
                https://api.github.com
                https://github.com
                https://accounts.google.com
                https://oauth2.googleapis.com
                https://www.googleapis.com
                https://kauth.kakao.com
                https://kapi.kakao.com;
              frame-src 'self'
                https://accounts.google.com
                https://kauth.kakao.com;
            `.replace(/\s+/g, ' ').trim()
          }
        ]
      }
    ]
  },

  compiler: {
    // Remove console.* in production bundles except errors
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ["error", "warn"],
    } : false,
    // Enable React Compiler optimizations for React 19
    reactRemoveProperties: process.env.NODE_ENV === "production",
  },
  
  // Next.js 15 Performance Optimizations
  experimental: {
    // Optimize package imports for better tree shaking and reduced bundle size
    optimizePackageImports: [
      // UI 라이브러리 최적화
      'lucide-react',
      '@radix-ui/react-icons',
      '@radix-ui/react-avatar',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',

      // 백엔드 & 상태 관리
      '@supabase/supabase-js',
      'zustand',
      '@tanstack/react-query',
      '@tanstack/react-virtual',

      // 유틸리티 & 스타일링
      'sonner',
      'react-window',
      'highlight.js',
      'marked',
      'dompurify',
      'clsx',
      'class-variance-authority',
      'tailwind-merge',
      'next-themes',
      'web-vitals',
      'zod',

      // 가상화 & 성능
      '@tanstack/react-virtual'
    ],
    // Enable React Compiler for automatic optimization (React 19 compatible)
    reactCompiler: {
      compilationMode: 'annotation', // opt-in mode for selective optimization
    },
    // 추가 성능 최적화 옵션
    serverComponentsHmrCache: true, // 서버 컴포넌트 HMR 캐시
    ppr: false, // Partial Pre Rendering (아직 실험적)
  },
  
  // Turbopack optimizations (moved from experimental.turbo as it's now stable)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  
  // Bundle optimizations
  bundlePagesRouterDependencies: true,

  // Next.js 15 이미지 최적화 강화 (Context7 기반 최신 패턴)
  images: {
    ...imagesConfig,
    // WebP → AVIF 포맷 우선순위 (Context7 권장 패턴)
    formats: ['image/avif', 'image/webp'],
    // 캐시 TTL 31일 → 6개월로 연장 (성능 향상)
    minimumCacheTTL: 15552000, // 6개월 (180일)
    // 최신 디바이스 크기 대응 (4K, 8K 포함)
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840, 7680],
    // 작은 이미지 크기 최적화 확장
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 512],
    // 이미지 품질 단계별 최적화
    qualities: [25, 50, 75, 90],
    // 정적 이미지 import 최적화 활성화
    disableStaticImages: false,
    // 성능을 위한 unoptimized 글로벌 설정 (SVG, 작은 이미지용)
    unoptimized: false,
  } as NextConfig["images"],

  // Webpack 최적화 설정 추가
  webpack: (config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) => {
    // 프로덕션 환경에서 메모리 사용량 최적화
    if (!dev && config.cache) {
      config.cache = {
        type: 'memory',
        maxGenerations: 1, // 메모리 사용량 최적화
      };
    }

    // 번들 크기 최적화
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        ...config.optimization.splitChunks,
        chunks: 'all',
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          // React 핵심 라이브러리 별도 분리
          'react-vendor': {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react-vendor',
            priority: 30,
            chunks: 'all',
            maxSize: 200000, // 200KB 제한
          },
          // 기타 대용량 라이브러리
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
            chunks: 'all',
            maxSize: 250000, // 250KB 제한
          },
          // UI 라이브러리 별도 청킹
          ui: {
            test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|sonner)[\\/]/,
            name: 'ui-vendor',
            priority: 20,
            chunks: 'all',
          },
          // React Query 별도 청킹
          query: {
            test: /[\\/]node_modules[\\/]@tanstack[\\/]/,
            name: 'query-vendor',
            priority: 20,
            chunks: 'all',
          },
          // Supabase 별도 청킹 (용량이 큰 라이브러리)
          supabase: {
            test: /[\\/]node_modules[\\/]@supabase[\\/]/,
            name: 'supabase-vendor',
            priority: 25,
            chunks: 'all',
          },
          // 가상화 라이브러리 청킹
          virtualization: {
            test: /[\\/]node_modules[\\/](react-window|@tanstack\/react-virtual)[\\/]/,
            name: 'virtual-vendor',
            priority: 15,
            chunks: 'all',
          },
          // 마크다운 & 하이라이트 청킹
          markdown: {
            test: /[\\/]node_modules[\\/](marked|highlight\.js|lowlight|dompurify)[\\/]/,
            name: 'markdown-vendor',
            priority: 15,
            chunks: 'all',
          },
        },
      },
    };

    return config;
  },
};

// Bundle Analyzer와 함께 export
export default withBundleAnalyzer(nextConfig);
