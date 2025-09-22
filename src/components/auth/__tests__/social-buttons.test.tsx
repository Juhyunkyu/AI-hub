import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SocialButtons } from '../social-buttons'

// Mock Supabase client
const mockSignInWithOAuth = vi.fn()
const mockSupabaseClient = {
  auth: {
    signInWithOAuth: mockSignInWithOAuth
  }
}

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => mockSupabaseClient
}))

// Mock console methods to avoid test output noise
const originalConsoleError = console.error
const originalConsoleLog = console.log

describe('SocialButtons', () => {
  beforeEach(() => {
    // Mock console methods
    console.error = vi.fn()
    console.log = vi.fn()

    // Reset mocks
    mockSignInWithOAuth.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
    console.error = originalConsoleError
    console.log = originalConsoleLog
  })

  describe('렌더링', () => {
    it('모든 소셜 로그인 버튼이 렌더링되어야 한다', () => {
      render(<SocialButtons />)

      expect(screen.getByRole('button', { name: /google로 계속하기/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /github로 계속하기/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /kakao로 계속하기/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /naver로 계속하기/i })).toBeInTheDocument()
    })

    it('각 버튼에 적절한 아이콘이 있어야 한다', () => {
      render(<SocialButtons />)

      // Google 아이콘 (SVG)
      const googleButton = screen.getByRole('button', { name: /google로 계속하기/i })
      expect(googleButton.querySelector('svg')).toBeInTheDocument()

      // GitHub 아이콘 (lucide-react)
      const githubButton = screen.getByRole('button', { name: /github로 계속하기/i })
      expect(githubButton.querySelector('svg')).toBeInTheDocument()

      // Kakao 아이콘 (SVG)
      const kakaoButton = screen.getByRole('button', { name: /kakao로 계속하기/i })
      expect(kakaoButton.querySelector('svg')).toBeInTheDocument()

      // Naver 아이콘 (SVG)
      const naverButton = screen.getByRole('button', { name: /naver로 계속하기/i })
      expect(naverButton.querySelector('svg')).toBeInTheDocument()
    })

    it('버튼들이 적절한 스타일 클래스를 가져야 한다', () => {
      render(<SocialButtons />)

      const googleButton = screen.getByRole('button', { name: /google로 계속하기/i })
      const githubButton = screen.getByRole('button', { name: /github로 계속하기/i })
      const kakaoButton = screen.getByRole('button', { name: /kakao로 계속하기/i })
      const naverButton = screen.getByRole('button', { name: /naver로 계속하기/i })

      // Google 버튼 - 회색 배경
      expect(googleButton).toHaveClass('bg-gray-50')

      // Kakao 버튼 - 노란색 배경
      expect(kakaoButton).toHaveClass('bg-[#FEE500]')

      // Naver 버튼 - 초록색 배경
      expect(naverButton).toHaveClass('bg-[#03C75A]')

      // 모든 버튼이 적절한 높이를 가져야 함
      expect(googleButton).toHaveClass('h-9')
      expect(githubButton).toHaveClass('h-9')
      expect(kakaoButton).toHaveClass('h-9')
      expect(naverButton).toHaveClass('h-9')
    })
  })

  describe('Google 로그인', () => {
    it('Google 버튼 클릭 시 OAuth 로그인이 호출되어야 한다', async () => {
      mockSignInWithOAuth.mockResolvedValue({ error: null })

      render(<SocialButtons />)

      const googleButton = screen.getByRole('button', { name: /google로 계속하기/i })
      fireEvent.click(googleButton)

      await waitFor(() => {
        expect(mockSignInWithOAuth).toHaveBeenCalledWith({
          provider: 'google',
          options: {
            redirectTo: expect.any(String)
          }
        })
      })
    })

    it('Google 로그인 실패 시 에러를 로깅해야 한다', async () => {
      const errorMessage = 'OAuth error'
      mockSignInWithOAuth.mockResolvedValue({ error: { message: errorMessage } })

      render(<SocialButtons />)

      const googleButton = screen.getByRole('button', { name: /google로 계속하기/i })
      fireEvent.click(googleButton)

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith('Social login error:', { message: errorMessage })
      })
    })
  })

  describe('GitHub 로그인', () => {
    it('GitHub 버튼 클릭 시 OAuth 로그인이 호출되어야 한다', async () => {
      mockSignInWithOAuth.mockResolvedValue({ error: null })

      render(<SocialButtons />)

      const githubButton = screen.getByRole('button', { name: /github로 계속하기/i })
      fireEvent.click(githubButton)

      await waitFor(() => {
        expect(mockSignInWithOAuth).toHaveBeenCalledWith({
          provider: 'github',
          options: {
            redirectTo: expect.any(String)
          }
        })
      })
    })

    it('GitHub 로그인 실패 시 에러를 로깅해야 한다', async () => {
      const errorMessage = 'User already registered'
      mockSignInWithOAuth.mockResolvedValue({ error: { message: errorMessage } })

      render(<SocialButtons />)

      const githubButton = screen.getByRole('button', { name: /github로 계속하기/i })
      fireEvent.click(githubButton)

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith('Social login error:', { message: errorMessage })
      })
    })
  })

  describe('Kakao 로그인', () => {
    it('Kakao 버튼 클릭 시 OAuth 로그인이 호출되어야 한다', async () => {
      mockSignInWithOAuth.mockResolvedValue({ error: null })

      render(<SocialButtons />)

      const kakaoButton = screen.getByRole('button', { name: /kakao로 계속하기/i })
      fireEvent.click(kakaoButton)

      await waitFor(() => {
        expect(mockSignInWithOAuth).toHaveBeenCalledWith({
          provider: 'kakao',
          options: {
            redirectTo: expect.any(String)
          }
        })
      })
    })
  })

  describe('Naver 로그인', () => {
    it('Naver 버튼 클릭 시 OAuth 로그인이 호출되어야 한다', async () => {
      mockSignInWithOAuth.mockResolvedValue({ error: null })

      render(<SocialButtons />)

      const naverButton = screen.getByRole('button', { name: /naver로 계속하기/i })
      fireEvent.click(naverButton)

      await waitFor(() => {
        expect(mockSignInWithOAuth).toHaveBeenCalledWith({
          provider: 'naver',
          options: {
            redirectTo: expect.any(String)
          }
        })
      })
    })
  })

  describe('에러 처리', () => {
    it('네트워크 오류 시 에러를 로깅해야 한다', async () => {
      mockSignInWithOAuth.mockRejectedValue(new Error('Network error'))

      render(<SocialButtons />)

      const googleButton = screen.getByRole('button', { name: /google로 계속하기/i })
      fireEvent.click(googleButton)

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith('Social login error:', new Error('Network error'))
      })
    })

    it('예상치 못한 오류 시 에러를 로깅해야 한다', async () => {
      mockSignInWithOAuth.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      render(<SocialButtons />)

      const googleButton = screen.getByRole('button', { name: /google로 계속하기/i })
      fireEvent.click(googleButton)

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith('Social login error:', new Error('Unexpected error'))
      })
    })
  })

  describe('접근성', () => {
    it('모든 버튼에 적절한 aria-label이 있어야 한다', () => {
      render(<SocialButtons />)

      expect(screen.getByRole('button', { name: /google로 계속하기/i })).toHaveAttribute('aria-label', 'Google로 계속하기')
      expect(screen.getByRole('button', { name: /github로 계속하기/i })).toHaveAttribute('aria-label', 'GitHub로 계속하기')
      expect(screen.getByRole('button', { name: /kakao로 계속하기/i })).toHaveAttribute('aria-label', 'Kakao로 계속하기')
      expect(screen.getByRole('button', { name: /naver로 계속하기/i })).toHaveAttribute('aria-label', 'Naver로 계속하기')
    })

    it('아이콘 SVG들이 접근성을 위해 aria-hidden을 가져야 한다', () => {
      render(<SocialButtons />)

      // 모든 SVG가 aria-hidden="true"를 가져야 함
      const svgs = document.querySelectorAll('svg')
      svgs.forEach(svg => {
        expect(svg).toHaveAttribute('aria-hidden')
      })
    })

    it('키보드 네비게이션이 가능해야 한다', () => {
      render(<SocialButtons />)

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).not.toHaveAttribute('tabIndex', '-1')
      })
    })
  })

  describe('리다이렉트 URL', () => {
    it('브라우저 환경에서 현재 origin을 redirectTo로 사용해야 한다', async () => {
      // window.location.origin을 모킹
      Object.defineProperty(window, 'location', {
        value: {
          origin: 'https://example.com'
        },
        writable: true
      })

      mockSignInWithOAuth.mockResolvedValue({ error: null })

      render(<SocialButtons />)

      const googleButton = screen.getByRole('button', { name: /google로 계속하기/i })
      fireEvent.click(googleButton)

      await waitFor(() => {
        expect(mockSignInWithOAuth).toHaveBeenCalledWith({
          provider: 'google',
          options: {
            redirectTo: 'https://example.com'
          }
        })
      })
    })
  })
})